import { test, expect } from '@playwright/test';

const SUPABASE_URL = 'https://rqrumtpqutzdbwtqjaoh.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxcnVtdHBxdXR6ZGJ3dHFqYW9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2OTMzNDUsImV4cCI6MjA4MjI2OTM0NX0.lXz4lV5prIQraVHiZc7I_C3t8qDZi8GYRxBDaN5Yfc8';

const BRANCH = 'BR-MAYOREO';
const PRODUCT_WITH_STOCK = 'a1111111-0000-0000-0000-000000000001';  // [TEST] Pintura Blanca 20L
const PRODUCT_WITHOUT_ROW = '36d1f85f-781d-4e8a-8fdb-afc3febdc48e'; // Aerosol Negro Mate (sin fila en BR-MAYOREO)
const CLIENT_ID = 'c5fc5175-1ac5-48ac-a93b-bae74d20ed1e';

async function callProcessSale(items: object[], branchId = BRANCH, extraOpts = {}) {
  const body = {
    p_branch_id: branchId,
    p_total: 100,
    p_payment_method: 'cash',
    p_items: items,
    p_client_id: CLIENT_ID,
    p_is_wholesale: true,
    p_payment_type: 'contado',
    p_payment_status: 'pending',
    ...extraOpts
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/process_sale`, {
    method: 'POST',
    headers: {
      'apikey': ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return { status: res.status, data };
}

async function getStock(productId: string, branchId: string) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/inventory?select=stock&product_id=eq.${productId}&branch_id=eq.${branchId}`,
    { headers: { 'apikey': ANON_KEY } }
  );
  const rows = await res.json();
  return rows[0]?.stock ?? null;
}

// ─── Suite: process_sale RPC ────────────────────────────────────────────────

test.describe('process_sale RPC - Validación de inventario', () => {

  test('Venta exitosa descuenta stock correctamente', async () => {
    const stockAntes = await getStock(PRODUCT_WITH_STOCK, BRANCH);
    expect(stockAntes).toBeGreaterThanOrEqual(1);

    const { status, data } = await callProcessSale([{
      product_id: PRODUCT_WITH_STOCK,
      product_name: '[TEST] Pintura Blanca 20L',
      quantity: 1,
      price: 850,
    }]);

    console.log(`process_sale exitosa → status: ${status}, sale_id: ${data}`);
    expect(status).toBe(200);
    expect(typeof data).toBe('string'); // UUID de la venta

    const stockDespues = await getStock(PRODUCT_WITH_STOCK, BRANCH);
    console.log(`Stock: ${stockAntes} → ${stockDespues}`);
    expect(stockDespues).toBe(stockAntes - 1);
  });

  test('Venta con cantidad > stock retorna error legible (no constraint violation)', async () => {
    const { status, data } = await callProcessSale([{
      product_id: PRODUCT_WITH_STOCK,
      product_name: '[TEST] Pintura Blanca 20L',
      quantity: 99999,
      price: 850,
    }]);

    console.log(`Respuesta stock insuficiente → status: ${status}`, data);

    // Debe ser error (no 200)
    expect(status).not.toBe(200);

    // El mensaje debe ser legible (RAISE EXCEPTION del RPC), NO una violación de constraint
    const msg: string = data?.message || '';
    expect(msg).toContain('Stock insuficiente');
    expect(msg).not.toContain('violates check constraint');
    expect(msg).not.toContain('inventory_stock_non_negative');
  });

  test('Venta de producto sin fila de inventario en la sucursal retorna error legible', async () => {
    // Este es el bug original: el UPSERT antiguo insertaba stock = -quantity
    // El nuevo UPDATE simplemente devuelve 0 rows → RAISE EXCEPTION
    const { status, data } = await callProcessSale([{
      product_id: PRODUCT_WITHOUT_ROW,
      product_name: 'Aerosol Negro Mate',
      quantity: 1,
      price: 320,
    }]);

    console.log(`Producto sin fila inventario → status: ${status}`, data);

    expect(status).not.toBe(200);
    const msg: string = data?.message || '';
    expect(msg).toContain('Stock insuficiente');

    // Verificar que NO se creó una fila con stock negativo (el bug original)
    const stock = await getStock(PRODUCT_WITHOUT_ROW, BRANCH);
    if (stock !== null) {
      expect(stock).toBeGreaterThanOrEqual(0); // Si existe la fila, no puede ser negativo
    }
    // Si stock === null, la fila no existe → correcto, el RPC no la creó
    console.log(`Stock del producto en ${BRANCH}: ${stock ?? 'sin fila (correcto)'}`);
  });

  test('El stock NO disminuye cuando la venta falla por stock insuficiente', async () => {
    const stockAntes = await getStock(PRODUCT_WITH_STOCK, BRANCH);

    await callProcessSale([{
      product_id: PRODUCT_WITH_STOCK,
      product_name: '[TEST] Pintura Blanca 20L',
      quantity: 99999,
      price: 850,
    }]);

    const stockDespues = await getStock(PRODUCT_WITH_STOCK, BRANCH);
    console.log(`Stock después de venta fallida: ${stockAntes} → ${stockDespues}`);
    expect(stockDespues).toBe(stockAntes); // No debe cambiar
  });

  test('Venta sin p_client_id (parámetro opcional) funciona correctamente', async () => {
    const stockAntes = await getStock(PRODUCT_WITH_STOCK, BRANCH);
    expect(stockAntes).toBeGreaterThanOrEqual(1);

    const body = {
      p_branch_id: BRANCH,
      p_total: 850,
      p_payment_method: 'cash',
      p_items: [{
        product_id: PRODUCT_WITH_STOCK,
        product_name: '[TEST] Pintura Blanca 20L',
        quantity: 1,
        price: 850,
      }],
      p_is_wholesale: true,
      p_payment_type: 'contado',
      p_payment_status: 'pending',
      // Sin p_client_id
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/process_sale`, {
      method: 'POST',
      headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    console.log(`Venta sin cliente → status: ${res.status}, data:`, data);
    expect(res.status).toBe(200);
    expect(typeof data).toBe('string');
  });

});
