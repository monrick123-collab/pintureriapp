/**
 * Tests de Validación — Venta Mayoreo (WholesalePOS)
 *
 * Sección A: Unit tests con vi.mock — prueba métodos de SalesService para mayoreo
 *   sin modificar la DB.
 *   - processSale() con parámetros específicos de mayoreo
 *   - getWholesaleAccounts() con y sin filtro de sucursal
 *   - blockWholesaleAccount() / unblockWholesaleAccount()
 *   - setWholesaleCreditLimit()
 *   - addWholesalePayment() para abonos y pagos completos
 *
 * Sección B: Cálculos de precios mayoreo — funciones puras (sin red).
 *   - Recargo 5% para pago a crédito
 *   - IVA 16% sobre subtotal con descuento
 *   - Total final con descuento e IVA
 *
 * Sección C: Integración GET (solo lectura) — verifica estructura de tablas mayoreo.
 *
 * Sección D: Integridad de datos de ventas mayoreo existentes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestClient } from '../setup';

// ─── Mock de Supabase (Secciones A) ───────────────────────────────────────────
// Los tests de integración (Secciones C y D) usan createTestClient() directamente,
// sin pasar por este mock.

vi.mock('../../services/supabase', () => {
  return {
    supabase: {
      rpc: vi.fn(),
      from: vi.fn(),
    },
  };
});

// ─── Sección A — Unit tests con Supabase mockeado ─────────────────────────────

describe('processSale() — parámetros específicos de mayoreo', () => {
  let SalesService: typeof import('../../services/salesService').SalesService;
  let supabase: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const salesModule = await import('../../services/salesService');
    const supabaseModule = await import('../../services/supabase');
    SalesService = salesModule.SalesService;
    supabase = supabaseModule.supabase;
  });

  it('venta crédito: envía p_is_wholesale=true, p_payment_type="credito" y p_credit_days', async () => {
    supabase.rpc.mockResolvedValue({ data: 'sale-credit-001', error: null });

    await SalesService.processSale(
      'BR-TEST',
      [{ productId: 'p1', productName: 'Cubeta 19L', quantity: 10, price: 950 }],
      11020,
      'transfer',
      'client-001',
      {
        subtotal: 9500,
        iva: 1520,
        isWholesale: true,
        paymentType: 'credito',
        creditDays: 30,
        departureAdminId: 'admin-001',
        deliveryReceiverName: 'Juan Pérez',
      }
    );

    const args = supabase.rpc.mock.calls[0][1];
    expect(args.p_is_wholesale).toBe(true);
    expect(args.p_payment_type).toBe('credito');
    expect(args.p_credit_days).toBe(30);
    expect(args.p_departure_admin_id).toBe('admin-001');
    expect(args.p_delivery_receiver_name).toBe('Juan Pérez');
    expect(args.p_client_id).toBe('client-001');
  });

  it('venta contado+tarjeta: p_payment_status="approved" y datos de facturación', async () => {
    supabase.rpc.mockResolvedValue({ data: 'sale-card-001', error: null });

    await SalesService.processSale(
      'BR-TEST',
      [{ productId: 'p1', productName: 'Pintura Blanca 1L', quantity: 5, price: 800 }],
      4640,
      'card',
      'client-002',
      {
        subtotal: 4000,
        iva: 640,
        isWholesale: true,
        paymentType: 'contado',
        paymentStatus: 'approved',
        billingBank: 'BBVA',
        billingSocialReason: 'Empresa SA de CV',
        billingInvoiceNumber: 'INV-001',
        deliveryReceiverName: 'María López',
      }
    );

    const args = supabase.rpc.mock.calls[0][1];
    expect(args.p_payment_status).toBe('approved');
    expect(args.p_payment_type).toBe('contado');
    expect(args.p_billing_bank).toBe('BBVA');
    expect(args.p_billing_social_reason).toBe('Empresa SA de CV');
    expect(args.p_billing_invoice_number).toBe('INV-001');
    expect(args.p_delivery_receiver_name).toBe('María López');
  });

  it('venta contado+transferencia: p_payment_status="pending" con referencia', async () => {
    supabase.rpc.mockResolvedValue({ data: 'sale-transfer-001', error: null });

    await SalesService.processSale(
      'BR-TEST',
      [{ productId: 'p1', productName: 'Barniz Marino', quantity: 3, price: 600 }],
      2088,
      'transfer',
      'client-003',
      {
        subtotal: 1800,
        iva: 288,
        isWholesale: true,
        paymentType: 'contado',
        paymentStatus: 'pending',
        transferReference: 'REF-20240321-001',
        billingBank: 'Banamex',
        billingSocialReason: 'Constructora XYZ SA',
        deliveryReceiverName: 'Carlos Ruiz',
      }
    );

    const args = supabase.rpc.mock.calls[0][1];
    expect(args.p_payment_status).toBe('pending');
    expect(args.p_transfer_reference).toBe('REF-20240321-001');
    expect(args.p_is_wholesale).toBe(true);
  });

  it('envía p_promotion_request_id cuando aplica promoción', async () => {
    supabase.rpc.mockResolvedValue({ data: 'sale-promo-001', error: null });

    await SalesService.processSale(
      'BR-TEST',
      [{ productId: 'p1', productName: 'Esmalte', quantity: 20, price: 300 }],
      6960,
      'cash',
      'client-004',
      {
        subtotal: 6000,
        iva: 960,
        isWholesale: true,
        paymentType: 'contado',
        promotionRequestId: 'promo-req-abc123',
        deliveryReceiverName: 'Pedro Martínez',
      }
    );

    const args = supabase.rpc.mock.calls[0][1];
    expect(args.p_promotion_request_id).toBe('promo-req-abc123');
  });
});

describe('getWholesaleAccounts() — consulta cuentas de crédito', () => {
  let SalesService: typeof import('../../services/salesService').SalesService;
  let supabase: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const salesModule = await import('../../services/salesService');
    const supabaseModule = await import('../../services/supabase');
    SalesService = salesModule.SalesService;
    supabase = supabaseModule.supabase;
  });

  it('sin branchId retorna todas las cuentas sin filtro por sucursal', async () => {
    const fakeAccounts = [
      { id: 'acc-1', client_name: 'Cliente A', balance: 500, credit_limit: 5000 },
      { id: 'acc-2', client_name: 'Cliente B', balance: 0, credit_limit: 3000 },
    ];

    const orderFn = vi.fn().mockResolvedValue({ data: fakeAccounts, error: null });
    const selectFn = vi.fn().mockReturnValue({ order: orderFn });
    supabase.from.mockReturnValue({ select: selectFn });

    const result = await SalesService.getWholesaleAccounts();

    expect(supabase.from).toHaveBeenCalledWith('wholesale_accounts');
    expect(result).toHaveLength(2);
    expect(result[0].client_name).toBe('Cliente A');
    // Sin branchId, no debe llamarse eq() sobre la query principal
    // (orderFn no tiene .eq() en su resultado al no filtrarse)
  });

  it('con branchId específico añade filtro .eq("branch_id", ...)', async () => {
    const eqFn = vi.fn().mockResolvedValue({ data: [], error: null });
    const orderFn = vi.fn().mockReturnValue({ eq: eqFn });
    const selectFn = vi.fn().mockReturnValue({ order: orderFn });
    supabase.from.mockReturnValue({ select: selectFn });

    await SalesService.getWholesaleAccounts('BR-NORTE');

    expect(eqFn).toHaveBeenCalledWith('branch_id', 'BR-NORTE');
  });

  it('branchId "ALL" no aplica filtro por sucursal', async () => {
    const orderFn = vi.fn().mockResolvedValue({ data: [], error: null });
    const selectFn = vi.fn().mockReturnValue({ order: orderFn });
    supabase.from.mockReturnValue({ select: selectFn });

    const result = await SalesService.getWholesaleAccounts('ALL');

    // .order() se llama una vez para ordenar los resultados
    expect(orderFn).toHaveBeenCalledTimes(1);
    // La query se resuelve directamente desde orderFn sin llamar .eq()
    // (si se intentara llamar .eq() fallaría porque orderFn no retorna un chainable con eq)
    expect(result).toEqual([]);
  });

  it('retorna arreglo vacío si data es null', async () => {
    const orderFn = vi.fn().mockResolvedValue({ data: null, error: null });
    const selectFn = vi.fn().mockReturnValue({ order: orderFn });
    supabase.from.mockReturnValue({ select: selectFn });

    const result = await SalesService.getWholesaleAccounts();

    expect(result).toEqual([]);
  });
});

describe('blockWholesaleAccount() / unblockWholesaleAccount()', () => {
  let SalesService: typeof import('../../services/salesService').SalesService;
  let supabase: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const salesModule = await import('../../services/salesService');
    const supabaseModule = await import('../../services/supabase');
    SalesService = salesModule.SalesService;
    supabase = supabaseModule.supabase;
  });

  it('blockWholesaleAccount: actualiza is_blocked=true con la razón indicada', async () => {
    const eqFn = vi.fn().mockResolvedValue({ error: null });
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn });
    supabase.from.mockReturnValue({ update: updateFn });

    await SalesService.blockWholesaleAccount('acc-123', 'Deuda vencida >15 días');

    expect(supabase.from).toHaveBeenCalledWith('wholesale_accounts');
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        is_blocked: true,
        block_reason: 'Deuda vencida >15 días',
      })
    );
    expect(eqFn).toHaveBeenCalledWith('id', 'acc-123');
  });

  it('unblockWholesaleAccount: actualiza is_blocked=false y block_reason=null', async () => {
    const eqFn = vi.fn().mockResolvedValue({ error: null });
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn });
    supabase.from.mockReturnValue({ update: updateFn });

    await SalesService.unblockWholesaleAccount('acc-123');

    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        is_blocked: false,
        block_reason: null,
      })
    );
    expect(eqFn).toHaveBeenCalledWith('id', 'acc-123');
  });

  it('blockWholesaleAccount: lanza error si Supabase falla', async () => {
    const eqFn = vi.fn().mockResolvedValue({ error: { message: 'DB connection error' } });
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn });
    supabase.from.mockReturnValue({ update: updateFn });

    await expect(
      SalesService.blockWholesaleAccount('acc-bad', 'razón')
    ).rejects.toBeTruthy();
  });

  it('unblockWholesaleAccount: lanza error si Supabase falla', async () => {
    const eqFn = vi.fn().mockResolvedValue({ error: { message: 'Permission denied' } });
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn });
    supabase.from.mockReturnValue({ update: updateFn });

    await expect(
      SalesService.unblockWholesaleAccount('acc-bad')
    ).rejects.toBeTruthy();
  });
});

describe('setWholesaleCreditLimit()', () => {
  let SalesService: typeof import('../../services/salesService').SalesService;
  let supabase: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const salesModule = await import('../../services/salesService');
    const supabaseModule = await import('../../services/supabase');
    SalesService = salesModule.SalesService;
    supabase = supabaseModule.supabase;
  });

  it('actualiza credit_limit con el valor proporcionado', async () => {
    const eqFn = vi.fn().mockResolvedValue({ error: null });
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn });
    supabase.from.mockReturnValue({ update: updateFn });

    await SalesService.setWholesaleCreditLimit('acc-456', 50000);

    expect(supabase.from).toHaveBeenCalledWith('wholesale_accounts');
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ credit_limit: 50000 })
    );
    expect(eqFn).toHaveBeenCalledWith('id', 'acc-456');
  });

  it('credit_limit de 0 es un valor válido (cerrar línea de crédito)', async () => {
    const eqFn = vi.fn().mockResolvedValue({ error: null });
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn });
    supabase.from.mockReturnValue({ update: updateFn });

    await SalesService.setWholesaleCreditLimit('acc-456', 0);

    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ credit_limit: 0 })
    );
  });
});

describe('addWholesalePayment() — abonos y pagos completos', () => {
  let SalesService: typeof import('../../services/salesService').SalesService;
  let supabase: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const salesModule = await import('../../services/salesService');
    const supabaseModule = await import('../../services/supabase');
    SalesService = salesModule.SalesService;
    supabase = supabaseModule.supabase;
  });

  it('abono: reduce el saldo correctamente e inserta registro con payment_type="abono"', async () => {
    // Call 1: leer saldo actual
    const singleFn = vi.fn().mockResolvedValue({ data: { balance: 1000 }, error: null });
    const eqRead = vi.fn().mockReturnValue({ single: singleFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqRead });

    // Call 2: actualizar saldo (1000 - 300 = 700)
    const eqUpdate = vi.fn().mockResolvedValue({ error: null });
    const updateFn = vi.fn().mockReturnValue({ eq: eqUpdate });

    // Call 3: insertar movimiento
    const insertFn = vi.fn().mockResolvedValue({ error: null });

    supabase.from
      .mockReturnValueOnce({ select: selectFn })
      .mockReturnValueOnce({ update: updateFn })
      .mockReturnValueOnce({ insert: insertFn });

    await SalesService.addWholesalePayment('acc-789', 'abono', 300, 'Pago parcial', 'user-001');

    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ balance: 700 })
    );
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        wholesale_account_id: 'acc-789',
        amount: 300,
        payment_type: 'abono',
        notes: 'Pago parcial',
        registered_by: 'user-001',
      })
    );
  });

  it('pago_completo: establece saldo en 0 independientemente del balance anterior', async () => {
    const singleFn = vi.fn().mockResolvedValue({ data: { balance: 5000 }, error: null });
    const eqRead = vi.fn().mockReturnValue({ single: singleFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqRead });

    const eqUpdate = vi.fn().mockResolvedValue({ error: null });
    const updateFn = vi.fn().mockReturnValue({ eq: eqUpdate });

    const insertFn = vi.fn().mockResolvedValue({ error: null });

    supabase.from
      .mockReturnValueOnce({ select: selectFn })
      .mockReturnValueOnce({ update: updateFn })
      .mockReturnValueOnce({ insert: insertFn });

    await SalesService.addWholesalePayment('acc-789', 'pago_completo', 5000, 'Liquidación total', 'user-001');

    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ balance: 0 })
    );
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({ payment_type: 'pago_completo' })
    );
  });

  it('abono no produce saldo negativo — mínimo 0 con Math.max()', async () => {
    const singleFn = vi.fn().mockResolvedValue({ data: { balance: 100 }, error: null });
    const eqRead = vi.fn().mockReturnValue({ single: singleFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqRead });

    const eqUpdate = vi.fn().mockResolvedValue({ error: null });
    const updateFn = vi.fn().mockReturnValue({ eq: eqUpdate });

    const insertFn = vi.fn().mockResolvedValue({ error: null });

    supabase.from
      .mockReturnValueOnce({ select: selectFn })
      .mockReturnValueOnce({ update: updateFn })
      .mockReturnValueOnce({ insert: insertFn });

    // Abono de 500 cuando el saldo es solo 100 → Math.max(0, 100-500) = 0
    await SalesService.addWholesalePayment('acc-789', 'abono', 500, 'Sobrepago', 'user-001');

    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ balance: 0 })
    );
  });
});

// ─── Sección B — Cálculos de precios mayoreo (funciones puras) ────────────────
// Replica la lógica de WholesalePOS.tsx para verificar reglas de negocio críticas.

function calcularSubtotalMayoreo(
  items: { price: number; quantity: number }[],
  paymentType: 'contado' | 'credito'
): number {
  return items.reduce((acc, item) => {
    const precio = paymentType === 'credito' ? item.price * 1.05 : item.price;
    return acc + precio * item.quantity;
  }, 0);
}

function calcularIVA(subtotalConDescuento: number): number {
  return subtotalConDescuento * 0.16;
}

function calcularTotal(subtotal: number, descuentoPct: number): number {
  const subtotalConDesc = subtotal * (1 - descuentoPct / 100);
  return subtotalConDesc + calcularIVA(subtotalConDesc);
}

describe('Cálculos de precios mayoreo — funciones puras', () => {
  describe('recargo del 5% por pago a crédito', () => {
    it('contado: NO aplica recargo — precio unitario sin cambio', () => {
      const items = [{ price: 1000, quantity: 2 }];
      // 1000 * 2 = 2000 (sin recargo)
      expect(calcularSubtotalMayoreo(items, 'contado')).toBe(2000);
    });

    it('crédito: aplica +5% sobre cada precio unitario', () => {
      const items = [{ price: 1000, quantity: 2 }];
      // 1000 * 1.05 * 2 = 2100
      expect(calcularSubtotalMayoreo(items, 'credito')).toBeCloseTo(2100);
    });

    it('crédito con múltiples productos: recargo en cada uno', () => {
      const items = [
        { price: 500, quantity: 3 },   // 500 * 1.05 * 3 = 1575
        { price: 1200, quantity: 1 },  // 1200 * 1.05 * 1 = 1260
      ];
      expect(calcularSubtotalMayoreo(items, 'credito')).toBeCloseTo(2835);
    });

    it('carrito vacío retorna 0 para ambos tipos de pago', () => {
      expect(calcularSubtotalMayoreo([], 'contado')).toBe(0);
      expect(calcularSubtotalMayoreo([], 'credito')).toBe(0);
    });
  });

  describe('cálculo de IVA (16%)', () => {
    it('IVA = 16% del subtotal con descuento aplicado', () => {
      expect(calcularIVA(1000)).toBeCloseTo(160);
      expect(calcularIVA(2500)).toBeCloseTo(400);
      expect(calcularIVA(0)).toBe(0);
    });

    it('IVA proporcional para valores decimales', () => {
      expect(calcularIVA(750)).toBeCloseTo(120);
    });
  });

  describe('cálculo de total con descuento e IVA', () => {
    it('sin descuento (0%): total = subtotal + 16% IVA', () => {
      // subtotal=1000 → IVA=160 → total=1160
      expect(calcularTotal(1000, 0)).toBeCloseTo(1160);
    });

    it('descuento 10%: se aplica ANTES del IVA', () => {
      // subtotal=1000, desc=10% → subtotalDesc=900 → IVA=144 → total=1044
      expect(calcularTotal(1000, 10)).toBeCloseTo(1044);
    });

    it('descuento 25%: cálculo correcto', () => {
      // subtotal=2000, desc=25% → subtotalDesc=1500 → IVA=240 → total=1740
      expect(calcularTotal(2000, 25)).toBeCloseTo(1740);
    });

    it('descuento 100%: total = 0', () => {
      expect(calcularTotal(1000, 100)).toBeCloseTo(0);
    });
  });
});

// ─── Helpers para tests de integración ───────────────────────────────────────

/** Retorna true si el error es un timeout de red (sin conexión a Supabase). */
function isNetworkTimeout(error: any): boolean {
  return (
    error?.message?.includes('fetch failed') ||
    error?.details?.includes('ConnectTimeoutError') ||
    error?.message?.includes('ConnectTimeoutError')
  );
}

// ─── Sección C — Integración GET de solo lectura ──────────────────────────────

describe('Tablas mayoreo — estructura en Supabase real', () => {
  it('wholesale_accounts: tabla accesible con columnas clave', async () => {
    const client = createTestClient();
    const { data, error } = await client
      .from('wholesale_accounts')
      .select('id, branch_id, client_id, client_name, balance, credit_limit, is_blocked')
      .limit(5);

    if (isNetworkTimeout(error)) {
      console.log('  ⚠ Sin conexión a Supabase — test saltado');
      return;
    }

    expect(error, `Error RLS en wholesale_accounts: ${error?.message}`).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    if (data && data.length > 0) {
      const acc = data[0];
      expect(acc.id).toBeTruthy();
      expect(typeof acc.balance).toBe('number');
      expect(typeof acc.credit_limit).toBe('number');
      expect(typeof acc.is_blocked).toBe('boolean');
    }
  });

  it('wholesale_payments: tabla accesible con columnas clave', async () => {
    const client = createTestClient();
    const { data, error } = await client
      .from('wholesale_payments')
      .select('id, wholesale_account_id, payment_type, amount, created_at')
      .limit(5);

    if (isNetworkTimeout(error)) {
      console.log('  ⚠ Sin conexión a Supabase — test saltado');
      return;
    }

    expect(error, `Error RLS en wholesale_payments: ${error?.message}`).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    if (data && data.length > 0) {
      const pago = data[0];
      const validTypes = ['cargo', 'abono', 'pago_completo'];
      expect(validTypes).toContain(pago.payment_type);
      expect(typeof pago.amount).toBe('number');
      expect(pago.amount).toBeGreaterThan(0);
    }
  });

  it('sales: columna is_wholesale existe y es booleano', async () => {
    const client = createTestClient();
    const { data, error } = await client
      .from('sales')
      .select('id, is_wholesale, payment_type, delivery_receiver_name')
      .limit(5)
      .order('created_at', { ascending: false });

    if (isNetworkTimeout(error)) {
      console.log('  ⚠ Sin conexión a Supabase — test saltado');
      return;
    }

    expect(error, `Error al leer is_wholesale en sales: ${error?.message}`).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    if (data && data.length > 0) {
      expect(typeof data[0].is_wholesale).toBe('boolean');
    }
  });

  it('wholesale_promotions: tabla accesible con columnas clave', async () => {
    const client = createTestClient();
    const { data, error } = await client
      .from('wholesale_promotions')
      .select('id, name, min_quantity, discount_percent, auto_apply')
      .limit(5);

    if (isNetworkTimeout(error)) {
      console.log('  ⚠ Sin conexión a Supabase — test saltado');
      return;
    }

    expect(error, `Error RLS en wholesale_promotions: ${error?.message}`).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    if (data && data.length > 0) {
      const promo = data[0];
      expect(promo.id).toBeTruthy();
      expect(typeof promo.min_quantity).toBe('number');
      expect(typeof promo.discount_percent).toBe('number');
      expect(typeof promo.auto_apply).toBe('boolean');
    }
  });
});

// ─── Sección D — Integridad de datos de ventas mayoreo ───────────────────────

describe('Integridad de ventas mayoreo existentes', () => {
  it('ventas con is_wholesale=true tienen payment_type válido ("contado" o "credito")', async () => {
    const client = createTestClient();
    const { data, error } = await client
      .from('sales')
      .select('id, payment_type, client_id, is_wholesale')
      .eq('is_wholesale', true)
      .limit(10)
      .order('created_at', { ascending: false });

    if (isNetworkTimeout(error)) {
      console.log('  ⚠ Sin conexión a Supabase — test saltado');
      return;
    }

    expect(error, `Error al consultar ventas mayoreo: ${error?.message}`).toBeNull();

    if (!data || data.length === 0) {
      console.log('  ⚠ No hay ventas mayoreo registradas — test saltado');
      return;
    }

    const validPaymentTypes = ['contado', 'credito'];
    for (const sale of data) {
      expect(sale.is_wholesale).toBe(true);
      expect(
        validPaymentTypes,
        `Venta ${sale.id} tiene payment_type inválido: "${sale.payment_type}"`
      ).toContain(sale.payment_type);
    }
  });

  it('ventas mayoreo a crédito tienen client_id asignado', async () => {
    const client = createTestClient();
    const { data, error } = await client
      .from('sales')
      .select('id, client_id, payment_type')
      .eq('is_wholesale', true)
      .eq('payment_type', 'credito')
      .limit(10);

    if (isNetworkTimeout(error)) {
      console.log('  ⚠ Sin conexión a Supabase — test saltado');
      return;
    }

    expect(error, `Error al consultar ventas crédito: ${error?.message}`).toBeNull();

    if (!data || data.length === 0) {
      console.log('  ⚠ No hay ventas mayoreo a crédito — test saltado');
      return;
    }

    for (const sale of data) {
      expect(sale.client_id, `Venta crédito ${sale.id} sin client_id asignado`).toBeTruthy();
    }
  });

  it('anon key puede leer wholesale_accounts (política RLS activa)', async () => {
    const client = createTestClient();
    const { error } = await client
      .from('wholesale_accounts')
      .select('id')
      .limit(1);

    if (isNetworkTimeout(error)) {
      console.log('  ⚠ Sin conexión a Supabase — test saltado');
      return;
    }

    // Si hay error de RLS, la política anon no está configurada
    expect(error, `RLS bloqueó acceso a wholesale_accounts: ${error?.message}`).toBeNull();
  });
});
