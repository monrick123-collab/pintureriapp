/**
 * TIER 3 — Pruebas del módulo POS: processSale + Auth por rol
 *
 * Sección A: Unit tests con vi.mock — prueba processSale() SIN modificar la DB.
 *   - Verifica que se llama al RPC correcto con los parámetros correctos.
 *   - Verifica manejo de errores.
 *
 * Sección B: Integración GET (solo lectura) — sin mock.
 *
 * Sección C: Auth real por rol — necesita tests/.env.test con credenciales.
 *   - Se saltea automáticamente si las credenciales están vacías.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { testCreds, missingCredentials, createTestClient } from '../setup';

// ─── Sección A — Unit tests con mock ─────────────────────────────────────────

// Mock del módulo Supabase ANTES de importar el servicio
vi.mock('../../services/supabase', () => {
  const mockRpc = vi.fn();
  const mockFrom = vi.fn();

  const mockSupabase = {
    rpc: mockRpc,
    from: mockFrom,
  };

  return { supabase: mockSupabase };
});

describe('processSale() — unit tests con Supabase mockeado', () => {
  let SalesService: typeof import('../../services/salesService').SalesService;
  let supabase: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Importar dinámicamente para que el mock ya esté activo
    const salesModule = await import('../../services/salesService');
    const supabaseModule = await import('../../services/supabase');
    SalesService = salesModule.SalesService;
    supabase = supabaseModule.supabase;
  });

  it('llama a supabase.rpc("process_sale") con los parámetros correctos', async () => {
    const fakeId = 'abc123-fake-sale-id';
    supabase.rpc.mockResolvedValue({ data: fakeId, error: null });

    const branchId = 'BR-TEST';
    const items = [{
      productId: 'prod-001',
      productName: 'Pintura Blanca 1L',
      quantity: 2,
      price: 150,
    }];

    await SalesService.processSale(branchId, items, 300, 'cash', undefined, {
      subtotal: 300,
      iva: 0,
    });

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith('process_sale', expect.objectContaining({
      p_branch_id: branchId,
      p_total: 300,
      p_payment_method: 'cash',
      p_items: [{ product_id: 'prod-001', quantity: 2, price: 150, product_name: 'Pintura Blanca 1L' }],
      p_subtotal: 300,
      p_discount_amount: 0,
      p_iva: 0,
      p_payment_status: 'approved',
    }));
  });

  it('retorna el sale ID (string) cuando el RPC tiene éxito', async () => {
    const expectedId = 'sale-uuid-1234-5678';
    supabase.rpc.mockResolvedValue({ data: expectedId, error: null });

    const result = await SalesService.processSale('BR-TEST', [{
      productId: 'p1', productName: 'Prod', quantity: 1, price: 100
    }], 100, 'cash', undefined, { subtotal: 100, iva: 0 });

    expect(result).toBe(expectedId);
    expect(typeof result).toBe('string');
  });

  it('lanza Error cuando el RPC retorna error', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'insufficient stock for product prod-001' }
    });

    await expect(
      SalesService.processSale('BR-TEST', [{
        productId: 'prod-001', productName: 'Producto', quantity: 99999, price: 10
      }], 999990, 'cash', undefined, { subtotal: 999990, iva: 0 })
    ).rejects.toThrow('insufficient stock for product prod-001');
  });

  it('mapea correctamente items con múltiples productos', async () => {
    supabase.rpc.mockResolvedValue({ data: 'sale-xyz', error: null });

    const items = [
      { productId: 'p1', productName: 'Pintura A', quantity: 3, price: 100 },
      { productId: 'p2', productName: 'Pintura B', quantity: 1, price: 250 },
    ];

    await SalesService.processSale('BR-TEST', items, 550, 'card', undefined, {
      subtotal: 500, iva: 50, discountAmount: 0
    });

    const rpcArgs = supabase.rpc.mock.calls[0][1];
    expect(rpcArgs.p_items).toHaveLength(2);
    expect(rpcArgs.p_items[0]).toEqual({ product_id: 'p1', quantity: 3, price: 100, product_name: 'Pintura A' });
    expect(rpcArgs.p_items[1]).toEqual({ product_id: 'p2', quantity: 1, price: 250, product_name: 'Pintura B' });
    expect(rpcArgs.p_subtotal).toBe(500);
    expect(rpcArgs.p_iva).toBe(50);
  });

  it('envía p_is_wholesale=true para venta mayoreo', async () => {
    supabase.rpc.mockResolvedValue({ data: 'sale-w', error: null });

    await SalesService.processSale('BR-TEST', [{
      productId: 'p1', productName: 'Cubeta', quantity: 5, price: 800
    }], 4000, 'transfer', undefined, {
      subtotal: 4000, iva: 0, isWholesale: true, paymentType: 'credito', creditDays: 30
    });

    const rpcArgs = supabase.rpc.mock.calls[0][1];
    expect(rpcArgs.p_is_wholesale).toBe(true);
    expect(rpcArgs.p_payment_type).toBe('credito');
    expect(rpcArgs.p_credit_days).toBe(30);
  });

  it('no lanza error aunque la notificación falle (notificaciones son secundarias)', async () => {
    supabase.rpc.mockResolvedValue({ data: 'sale-notif', error: null });

    // Mock de from() para que createNotification falle — NO debe afectar la venta
    supabase.from.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ data: null, error: { message: 'notification error' } })
    });

    // Esto simula una venta con transferencia pendiente de aprobación
    // (activa el bloque de notificación en processSale)
    const result = await SalesService.processSale('BR-TEST', [{
      productId: 'p1', productName: 'Prod', quantity: 1, price: 500
    }], 500, 'transfer', undefined, {
      subtotal: 500, iva: 0, isWholesale: true, paymentStatus: 'pending'
    });

    // La venta debe completarse aunque la notificación fallé
    expect(result).toBe('sale-notif');
  });
});

// ─── Sección B — Integración GET (sin mock) ───────────────────────────────────

describe('SalesService integración — solo lectura contra Supabase real', () => {
  // Reimportar sin mock para estas pruebas (usamos cliente real)
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('getSalesByBranch devuelve estructura correcta', async () => {
    // Crear cliente real (anon key) y hacer la consulta directamente
    const client = createTestClient();
    const { data, error } = await client
      .from('sales')
      .select('id, branch_id, total, created_at, payment_method')
      .limit(5)
      .order('created_at', { ascending: false });

    expect(error, `Error Supabase al leer sales: ${error?.message}`).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    if (data && data.length > 0) {
      const sale = data[0];
      expect(sale.id).toBeTruthy();
      expect(sale.branch_id).toBeTruthy();
      expect(typeof sale.total).toBe('number');
      expect(sale.created_at).toBeTruthy();
    }
  });

  it('consulta a sale_items no falla y retorna estructura correcta', async () => {
    const client = createTestClient();
    const { data: sales } = await client
      .from('sales')
      .select('id')
      .limit(1)
      .order('created_at', { ascending: false });

    if (!sales || sales.length === 0) {
      console.log('  ⚠ No hay ventas en la DB — test saltado');
      return;
    }

    const { data: items, error } = await client
      .from('sale_items')
      .select('id, sale_id, product_id, quantity, unit_price')
      .eq('sale_id', sales[0].id);

    expect(error, `Error Supabase al leer sale_items: ${error?.message}`).toBeNull();
    expect(Array.isArray(items)).toBe(true);

    if (items && items.length > 0) {
      expect(items[0].sale_id).toBe(sales[0].id);
      expect(typeof items[0].quantity).toBe('number');
      expect(items[0].quantity).toBeGreaterThan(0);
    }
  });

  it('anon key puede leer tabla profiles (sin datos sensibles)', async () => {
    const client = createTestClient();
    const { data, error } = await client
      .from('profiles')
      .select('id, role, branch_id')
      .limit(3);

    expect(error, `Error RLS en profiles: ${error?.message}`).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    if (data && data.length > 0) {
      const validRoles = ['ADMIN', 'SELLER', 'WAREHOUSE', 'WAREHOUSE_SUB', 'FINANCE', 'STORE_MANAGER'];
      for (const p of data) {
        expect(p.id).toBeTruthy();
        expect(validRoles).toContain(p.role);
      }
    }
  });
});

// ─── Sección C — Auth real por rol ───────────────────────────────────────────

describe('Auth real — login con credenciales por rol', () => {
  it('Admin puede autenticarse con email/password', async () => {
    if (missingCredentials(testCreds.admin.email, testCreds.admin.password)) {
      console.log('  ⚠ TEST_ADMIN_EMAIL/PASSWORD no definidos en tests/.env.test — saltado');
      return;
    }

    const client = createTestClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: testCreds.admin.email,
      password: testCreds.admin.password,
    });

    expect(error, `Login Admin falló: ${error?.message}`).toBeNull();
    expect(data.user).not.toBeNull();
    expect(data.user!.email).toBe(testCreds.admin.email);

    // Verificar que profiles retorna role=ADMIN
    const { data: profile } = await client
      .from('profiles')
      .select('role, branch_id')
      .eq('id', data.user!.id)
      .single();

    expect(profile).not.toBeNull();
    expect(profile!.role).toBe('ADMIN');

    // Cerrar sesión
    await client.auth.signOut();
  });

  it('Seller puede autenticarse y su perfil tiene role=SELLER', async () => {
    if (missingCredentials(testCreds.seller.email, testCreds.seller.password)) {
      console.log('  ⚠ TEST_SELLER_EMAIL/PASSWORD no definidos en tests/.env.test — saltado');
      return;
    }

    const client = createTestClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: testCreds.seller.email,
      password: testCreds.seller.password,
    });

    expect(error, `Login Seller falló: ${error?.message}`).toBeNull();
    expect(data.user).not.toBeNull();

    const { data: profile } = await client
      .from('profiles')
      .select('role, branch_id')
      .eq('id', data.user!.id)
      .single();

    expect(profile!.role).toBe('SELLER');
    // Seller siempre debe tener un branch_id asignado
    expect(profile!.branch_id, 'Seller no tiene branch_id asignado').toBeTruthy();

    await client.auth.signOut();
  });

  it('Store Manager puede autenticarse y tiene branch_id asignado', async () => {
    if (missingCredentials(testCreds.storeManager.email, testCreds.storeManager.password)) {
      console.log('  ⚠ TEST_STORE_MANAGER_EMAIL/PASSWORD no definidos en tests/.env.test — saltado');
      return;
    }

    const client = createTestClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: testCreds.storeManager.email,
      password: testCreds.storeManager.password,
    });

    expect(error, `Login StoreManager falló: ${error?.message}`).toBeNull();
    expect(data.user).not.toBeNull();

    const { data: profile } = await client
      .from('profiles')
      .select('role, branch_id')
      .eq('id', data.user!.id)
      .single();

    expect(profile!.role).toBe('STORE_MANAGER');
    expect(profile!.branch_id, 'Store Manager no tiene branch_id — no podrá vender').toBeTruthy();

    await client.auth.signOut();
  });

  it('Credenciales incorrectas retornan error (no auth bypass)', async () => {
    const client = createTestClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: 'usuario-falso@test.com',
      password: 'contraseña-incorrecta-12345',
    });

    // Supabase DEBE rechazar credenciales inválidas
    expect(error).not.toBeNull();
    expect(data.user).toBeNull();
  });
});
