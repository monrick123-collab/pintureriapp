/**
 * TIER 1 — Pruebas de Conectividad con Supabase
 *
 * Pruebas de integración REALES: hacen llamadas al Supabase de producción
 * usando la clave anon (idéntica a como lo hace la app).
 * Todas son operaciones de solo lectura — cero modificaciones a la DB.
 */
import { describe, it, expect } from 'vitest';
import { InventoryService } from '../../services/inventoryService';
import { SalesService } from '../../services/salesService';

// ─── Bloque 1: Variables de entorno ─────────────────────────────────────────

describe('Configuración de entorno', () => {
  it('VITE_SUPABASE_URL está definida y no vacía', () => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    expect(url, 'VITE_SUPABASE_URL falta en .env').toBeTruthy();
    expect(url).toMatch(/^https:\/\/.+\.supabase\.co/);
  });

  it('VITE_SUPABASE_ANON_KEY está definida y no vacía', () => {
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    expect(key, 'VITE_SUPABASE_ANON_KEY falta en .env').toBeTruthy();
    expect(key.length).toBeGreaterThan(10);
  });
});

// ─── Bloque 2: Sucursales (branches) ─────────────────────────────────────────

describe('getBranches() — conectividad Supabase', () => {
  it('retorna un array (no null, no undefined)', async () => {
    const branches = await InventoryService.getBranches();
    expect(branches).toBeDefined();
    expect(Array.isArray(branches)).toBe(true);
  });

  it('retorna al menos una sucursal', async () => {
    const branches = await InventoryService.getBranches();
    expect(branches.length).toBeGreaterThan(0);
  });

  it('cada sucursal tiene los campos requeridos: id, name, status', async () => {
    const branches = await InventoryService.getBranches();
    for (const b of branches) {
      expect(b.id, `branch.id está vacío`).toBeTruthy();
      expect(b.name, `branch '${b.id}' no tiene name`).toBeTruthy();
      expect(['active', 'inactive']).toContain(b.status);
    }
  });

  it('el campo type de cada branch es "warehouse" o "store"', async () => {
    const branches = await InventoryService.getBranches();
    for (const b of branches) {
      expect(['warehouse', 'store']).toContain(b.type);
    }
  });
});

// ─── Bloque 3: Productos ─────────────────────────────────────────────────────

describe('getProducts() — catálogo global', () => {
  it('retorna un array (no null, no undefined)', async () => {
    const products = await InventoryService.getProducts();
    expect(products).toBeDefined();
    expect(Array.isArray(products)).toBe(true);
  });

  it('retorna al menos un producto', async () => {
    const products = await InventoryService.getProducts();
    expect(products.length).toBeGreaterThan(0);
  });

  it('cada producto tiene id, name, price >= 0, stock >= 0', async () => {
    const products = await InventoryService.getProducts();
    for (const p of products.slice(0, 20)) { // Revisar primeros 20
      expect(p.id, `product.id vacío`).toBeTruthy();
      expect(p.name, `product '${p.id}' sin name`).toBeTruthy();
      expect(typeof p.price).toBe('number');
      expect(p.price).toBeGreaterThanOrEqual(0);
      expect(typeof p.stock).toBe('number');
      expect(p.stock).toBeGreaterThanOrEqual(0);
    }
  });

  it('cada producto tiene un status válido', async () => {
    const products = await InventoryService.getProducts();
    const validStatuses = ['available', 'low', 'out', 'expired'];
    for (const p of products.slice(0, 20)) {
      expect(validStatuses, `status inválido en producto '${p.id}': '${p.status}'`)
        .toContain(p.status);
    }
  });
});

// ─── Bloque 4: Productos por sucursal ────────────────────────────────────────

describe('getProductsByBranch(branchId) — stock filtrado por sucursal', () => {
  it('retorna array para una sucursal real', async () => {
    const branches = await InventoryService.getBranches();
    expect(branches.length, 'No hay sucursales en la DB').toBeGreaterThan(0);

    const firstBranch = branches[0];
    const products = await InventoryService.getProductsByBranch(firstBranch.id);

    expect(Array.isArray(products)).toBe(true);
    // Puede estar vacío si la sucursal no tiene inventario, pero no debe lanzar error
  });

  it('con branchId="ALL" retorna el catálogo completo', async () => {
    const all = await InventoryService.getProductsByBranch('ALL');
    const full = await InventoryService.getProducts();
    expect(Array.isArray(all)).toBe(true);
    // Misma cantidad que el catálogo global
    expect(all.length).toBe(full.length);
  });

  it('no retorna null ni lanza error con un branchId inexistente', async () => {
    const products = await InventoryService.getProductsByBranch('BR-INEXISTENTE-999');
    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBe(0);
  });
});

// ─── Bloque 5: Historial de ventas ───────────────────────────────────────────

describe('getSalesByBranch(branchId) — historial de ventas', () => {
  it('retorna array para una sucursal real', async () => {
    const branches = await InventoryService.getBranches();
    const firstBranch = branches[0];

    const sales = await SalesService.getSalesByBranch(firstBranch.id);
    expect(Array.isArray(sales)).toBe(true);
  });

  it('cada venta tiene los campos mínimos requeridos', async () => {
    const branches = await InventoryService.getBranches();
    // Buscar una sucursal con ventas (tipo 'store')
    const storeBranch = branches.find(b => b.type === 'store') || branches[0];
    const sales = await SalesService.getSalesByBranch(storeBranch.id);

    if (sales.length === 0) return; // No hay ventas aún — test pasa de todas formas

    for (const s of sales.slice(0, 10)) {
      expect(s.id, `sale.id vacío`).toBeTruthy();
      expect(s.branchId, `sale '${s.id}' sin branchId`).toBeTruthy();
      expect(typeof s.total).toBe('number');
      expect(s.total).toBeGreaterThanOrEqual(0);
      expect(s.createdAt, `sale '${s.id}' sin createdAt`).toBeTruthy();
    }
  });

  it('getSaleDetail(id) retorna detalle completo para una venta existente', async () => {
    const branches = await InventoryService.getBranches();
    const storeBranch = branches.find(b => b.type === 'store') || branches[0];
    const sales = await SalesService.getSalesByBranch(storeBranch.id);

    if (sales.length === 0) {
      console.log('  ⚠ No hay ventas en la sucursal — test de getSaleDetail saltado');
      return;
    }

    const detail = await SalesService.getSaleDetail(sales[0].id);
    expect(detail).not.toBeNull();
    expect(detail!.id).toBe(sales[0].id);
    expect(Array.isArray(detail!.items)).toBe(true);
  });

  it('getSaleDetail con ID inexistente retorna null (no lanza error)', async () => {
    const result = await SalesService.getSaleDetail('00000000-0000-0000-0000-000000000000');
    expect(result).toBeNull();
  });
});
