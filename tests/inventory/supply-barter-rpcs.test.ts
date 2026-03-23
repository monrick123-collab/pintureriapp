/**
 * Tests de Validación — RPCs Atómicos: Recepción de Suministros y Trueque
 *
 * Sección A: Unit tests con vi.mock — confirmSupplyOrderArrival y acceptCounterOffer
 *   verifican que el servicio llama al RPC correcto con los parámetros esperados.
 *
 * Sección B: Integración — verifica que los RPCs existen en Supabase y son
 *   accesibles con clave anon. Usa UUIDs inexistentes para provocar errores
 *   de negocio ("no encontrado") en lugar de errores de infraestructura
 *   ("function does not exist"), lo que confirma que el RPC está activo.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestClient } from '../setup';

vi.mock('../../services/supabase', () => ({
    supabase: { rpc: vi.fn(), from: vi.fn() },
}));

const FAKE_UUID = '00000000-0000-0000-0000-000000000000';

function isNetworkTimeout(error: any): boolean {
    return (
        error?.message?.includes('fetch failed') ||
        error?.details?.includes('ConnectTimeoutError') ||
        error?.message?.includes('ConnectTimeoutError')
    );
}

// ─── Sección A — Unit tests ───────────────────────────────────────────────────

describe('confirmSupplyOrderArrival() — llama RPC atómico confirm_supply_order_arrival', () => {
    let InventoryService: typeof import('../../services/inventoryService').InventoryService;
    let supabase: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        const invModule = await import('../../services/inventoryService');
        const supabaseModule = await import('../../services/supabase');
        InventoryService = invModule.InventoryService;
        supabase = supabaseModule.supabase;
    });

    it('sin receivedItems: llama rpc con p_items=null (flujo completo)', async () => {
        supabase.rpc.mockResolvedValue({ data: { status: 'received', has_incidents: false }, error: null });

        await InventoryService.confirmSupplyOrderArrival('order-001');

        expect(supabase.rpc).toHaveBeenCalledWith('confirm_supply_order_arrival', {
            p_order_id: 'order-001',
            p_items: null,
        });
    });

    it('con receivedItems: mapea camelCase → snake_case y envía array JSONB', async () => {
        supabase.rpc.mockResolvedValue({ data: { status: 'received', has_incidents: false }, error: null });

        const items = [
            { id: 'item-1', productId: 'prod-1', status: 'received_full', receivedQuantity: 10 },
            { id: 'item-2', productId: 'prod-2', status: 'received_partial', receivedQuantity: 5, notes: 'Faltan 2' },
        ];

        await InventoryService.confirmSupplyOrderArrival('order-001', items);

        const args = supabase.rpc.mock.calls[0][1];
        expect(args.p_order_id).toBe('order-001');
        expect(args.p_items).toHaveLength(2);
        expect(args.p_items[0]).toMatchObject({
            id: 'item-1',
            product_id: 'prod-1',
            status: 'received_full',
            received_quantity: 10,
            notes: null,
        });
        expect(args.p_items[1]).toMatchObject({
            id: 'item-2',
            product_id: 'prod-2',
            status: 'received_partial',
            received_quantity: 5,
            notes: 'Faltan 2',
        });
    });

    it('lanza Error si el RPC falla', async () => {
        supabase.rpc.mockResolvedValue({ data: null, error: { message: 'El pedido no está en estado Enviado' } });

        await expect(
            InventoryService.confirmSupplyOrderArrival('order-bad')
        ).rejects.toThrow('El pedido no está en estado Enviado');
    });
});

describe('acceptCounterOffer() — llama RPC atómico accept_barter_counter_offer', () => {
    let InventoryService: typeof import('../../services/inventoryService').InventoryService;
    let supabase: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        const invModule = await import('../../services/inventoryService');
        const supabaseModule = await import('../../services/supabase');
        InventoryService = invModule.InventoryService;
        supabase = supabaseModule.supabase;
    });

    it('llama rpc con p_barter_id correcto', async () => {
        supabase.rpc.mockResolvedValue({ data: { inserted_items: 3 }, error: null });

        await InventoryService.acceptCounterOffer('barter-123');

        expect(supabase.rpc).toHaveBeenCalledWith('accept_barter_counter_offer', {
            p_barter_id: 'barter-123',
        });
    });

    it('lanza Error si el RPC falla (estado inválido)', async () => {
        supabase.rpc.mockResolvedValue({
            data: null,
            error: { message: 'El trueque no está en estado counter_proposed. Estado actual: pending_approval' },
        });

        await expect(
            InventoryService.acceptCounterOffer('barter-bad')
        ).rejects.toThrow('counter_proposed');
    });

    it('lanza Error si el trueque no existe', async () => {
        supabase.rpc.mockResolvedValue({ data: null, error: { message: 'Trueque no encontrado' } });

        await expect(
            InventoryService.acceptCounterOffer(FAKE_UUID)
        ).rejects.toThrow('Trueque no encontrado');
    });
});

// ─── Sección B — Integración: RPCs contra Supabase real ──────────────────────

describe('RPCs de suministros y trueque — existencia y acceso anon', () => {
    it('confirm_supply_order_arrival: RPC existe y es callable con clave anon', async () => {
        const client = createTestClient();
        const { error } = await client.rpc('confirm_supply_order_arrival', {
            p_order_id: FAKE_UUID,
            p_items: null,
        });

        if (isNetworkTimeout(error)) {
            console.log('  ⚠ Sin conexión a Supabase — test saltado');
            return;
        }

        expect(error?.message, 'El RPC confirm_supply_order_arrival no existe en Supabase')
            .not.toContain('Could not find the function');
        expect(error?.message).toContain('no encontrado');
    });

    it('confirm_supply_order_arrival: rechaza pedido que no está en estado shipped', async () => {
        const client = createTestClient();

        // Buscar un pedido real que NO esté en estado 'shipped'
        const { data: orders } = await client
            .from('supply_orders')
            .select('id, status')
            .neq('status', 'shipped')
            .limit(1);

        if (!orders || orders.length === 0) {
            console.log('  ⚠ No hay pedidos en estado distinto a shipped — test saltado');
            return;
        }

        const { error } = await client.rpc('confirm_supply_order_arrival', {
            p_order_id: orders[0].id,
            p_items: null,
        });

        if (isNetworkTimeout(error)) {
            console.log('  ⚠ Sin conexión a Supabase — test saltado');
            return;
        }

        expect(error, 'El RPC debió rechazar el pedido por estado inválido').not.toBeNull();
        expect(error?.message).toContain('Estado actual');
    });

    it('accept_barter_counter_offer: RPC existe y es callable con clave anon', async () => {
        const client = createTestClient();
        const { error } = await client.rpc('accept_barter_counter_offer', {
            p_barter_id: FAKE_UUID,
        });

        if (isNetworkTimeout(error)) {
            console.log('  ⚠ Sin conexión a Supabase — test saltado');
            return;
        }

        expect(error?.message, 'El RPC accept_barter_counter_offer no existe en Supabase')
            .not.toContain('Could not find the function');
        expect(error?.message).toContain('no encontrado');
    });

    it('accept_barter_counter_offer: rechaza trueque en estado distinto a counter_proposed', async () => {
        const client = createTestClient();

        const { data: barters } = await client
            .from('barter_transfers')
            .select('id, status')
            .neq('status', 'counter_proposed')
            .limit(1);

        if (!barters || barters.length === 0) {
            console.log('  ⚠ No hay trueques en estado distinto a counter_proposed — test saltado');
            return;
        }

        const { error } = await client.rpc('accept_barter_counter_offer', {
            p_barter_id: barters[0].id,
        });

        if (isNetworkTimeout(error)) {
            console.log('  ⚠ Sin conexión a Supabase — test saltado');
            return;
        }

        expect(error, 'El RPC debió rechazar el trueque por estado inválido').not.toBeNull();
        expect(error?.message).toContain('Estado actual');
    });
});
