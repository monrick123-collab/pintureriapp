/**
 * TIER 2 — Pruebas de Guardas de Acceso por Rol
 *
 * Tests unitarios PUROS — sin red, sin Supabase.
 * Verifican la lógica de guardas de App.tsx extraída como función pura.
 *
 * Fuente de verdad: App.tsx — condiciones de acceso por ruta.
 */
import { describe, it, expect } from 'vitest';
import { UserRole } from '../../types';

// ─── Lógica de guardas extraída de App.tsx ────────────────────────────────────
// Esta función replica EXACTAMENTE las condiciones de cada Route en App.tsx.
// Si cambian las guardas en App.tsx, actualizar aquí también.

type Role = keyof typeof UserRole;

function canAccess(role: Role, path: string): boolean {
  const r = role as UserRole;

  switch (path) {
    // /pos → todos los roles autenticados
    case '/pos':
      return true;

    // /wholesale-pos → ADMIN, WAREHOUSE, WAREHOUSE_SUB, STORE_MANAGER
    case '/wholesale-pos':
      return [UserRole.ADMIN, UserRole.WAREHOUSE, UserRole.WAREHOUSE_SUB, UserRole.STORE_MANAGER]
        .includes(r);

    // /municipal-pos → ADMIN, STORE_MANAGER, WAREHOUSE, WAREHOUSE_SUB
    case '/municipal-pos':
      return [UserRole.ADMIN, UserRole.STORE_MANAGER, UserRole.WAREHOUSE, UserRole.WAREHOUSE_SUB]
        .includes(r);

    // /finance → ADMIN, FINANCE
    case '/finance':
      return [UserRole.ADMIN, UserRole.FINANCE].includes(r);

    // /users → solo ADMIN
    case '/users':
      return r === UserRole.ADMIN;

    // /branches → solo ADMIN
    case '/branches':
      return r === UserRole.ADMIN;

    // /quotations → ADMIN, STORE_MANAGER
    case '/quotations':
      return [UserRole.ADMIN, UserRole.STORE_MANAGER].includes(r);

    // /returns → ADMIN, WAREHOUSE, WAREHOUSE_SUB, STORE_MANAGER
    case '/returns':
      return [UserRole.ADMIN, UserRole.WAREHOUSE, UserRole.WAREHOUSE_SUB, UserRole.STORE_MANAGER]
        .includes(r);

    // /restocks → ADMIN, WAREHOUSE, WAREHOUSE_SUB, STORE_MANAGER
    case '/restocks':
      return [UserRole.ADMIN, UserRole.WAREHOUSE, UserRole.WAREHOUSE_SUB, UserRole.STORE_MANAGER]
        .includes(r);

    // /transfers → ADMIN, WAREHOUSE, WAREHOUSE_SUB, STORE_MANAGER
    case '/transfers':
      return [UserRole.ADMIN, UserRole.WAREHOUSE, UserRole.WAREHOUSE_SUB, UserRole.STORE_MANAGER]
        .includes(r);

    // /cash-cut → ADMIN, WAREHOUSE, WAREHOUSE_SUB, FINANCE, STORE_MANAGER
    case '/cash-cut':
      return [UserRole.ADMIN, UserRole.WAREHOUSE, UserRole.WAREHOUSE_SUB, UserRole.FINANCE, UserRole.STORE_MANAGER]
        .includes(r);

    // /admin-cash-cuts → solo ADMIN
    case '/admin-cash-cuts':
      return r === UserRole.ADMIN;

    // /finance-dashboard → ADMIN, FINANCE
    case '/finance-dashboard':
      return [UserRole.ADMIN, UserRole.FINANCE].includes(r);

    default:
      return false;
  }
}

// ─── Tests por ruta ───────────────────────────────────────────────────────────

describe('/pos — acceso para todos los roles', () => {
  const roles: Role[] = ['ADMIN', 'SELLER', 'STORE_MANAGER', 'WAREHOUSE', 'WAREHOUSE_SUB', 'FINANCE'];
  for (const role of roles) {
    it(`✓ ${role} tiene acceso a /pos`, () => {
      expect(canAccess(role, '/pos')).toBe(true);
    });
  }
});

describe('/wholesale-pos — restringido (sin SELLER ni FINANCE)', () => {
  it('✓ ADMIN tiene acceso', () => expect(canAccess('ADMIN', '/wholesale-pos')).toBe(true));
  it('✓ WAREHOUSE tiene acceso', () => expect(canAccess('WAREHOUSE', '/wholesale-pos')).toBe(true));
  it('✓ WAREHOUSE_SUB tiene acceso', () => expect(canAccess('WAREHOUSE_SUB', '/wholesale-pos')).toBe(true));
  it('✓ STORE_MANAGER tiene acceso', () => expect(canAccess('STORE_MANAGER', '/wholesale-pos')).toBe(true));
  it('✗ SELLER NO tiene acceso', () => expect(canAccess('SELLER', '/wholesale-pos')).toBe(false));
  it('✗ FINANCE NO tiene acceso', () => expect(canAccess('FINANCE', '/wholesale-pos')).toBe(false));
});

describe('/municipal-pos — restringido (sin SELLER ni FINANCE)', () => {
  it('✓ ADMIN tiene acceso', () => expect(canAccess('ADMIN', '/municipal-pos')).toBe(true));
  it('✓ STORE_MANAGER tiene acceso', () => expect(canAccess('STORE_MANAGER', '/municipal-pos')).toBe(true));
  it('✓ WAREHOUSE tiene acceso', () => expect(canAccess('WAREHOUSE', '/municipal-pos')).toBe(true));
  it('✓ WAREHOUSE_SUB tiene acceso', () => expect(canAccess('WAREHOUSE_SUB', '/municipal-pos')).toBe(true));
  it('✗ SELLER NO tiene acceso', () => expect(canAccess('SELLER', '/municipal-pos')).toBe(false));
  it('✗ FINANCE NO tiene acceso', () => expect(canAccess('FINANCE', '/municipal-pos')).toBe(false));
});

describe('/finance — solo ADMIN y FINANCE', () => {
  it('✓ ADMIN tiene acceso', () => expect(canAccess('ADMIN', '/finance')).toBe(true));
  it('✓ FINANCE tiene acceso', () => expect(canAccess('FINANCE', '/finance')).toBe(true));
  it('✗ SELLER NO tiene acceso', () => expect(canAccess('SELLER', '/finance')).toBe(false));
  it('✗ STORE_MANAGER NO tiene acceso', () => expect(canAccess('STORE_MANAGER', '/finance')).toBe(false));
  it('✗ WAREHOUSE NO tiene acceso', () => expect(canAccess('WAREHOUSE', '/finance')).toBe(false));
});

describe('/users y /branches — solo ADMIN', () => {
  it('✓ ADMIN tiene acceso a /users', () => expect(canAccess('ADMIN', '/users')).toBe(true));
  it('✗ STORE_MANAGER NO tiene acceso a /users', () => expect(canAccess('STORE_MANAGER', '/users')).toBe(false));
  it('✗ SELLER NO tiene acceso a /users', () => expect(canAccess('SELLER', '/users')).toBe(false));

  it('✓ ADMIN tiene acceso a /branches', () => expect(canAccess('ADMIN', '/branches')).toBe(true));
  it('✗ WAREHOUSE NO tiene acceso a /branches', () => expect(canAccess('WAREHOUSE', '/branches')).toBe(false));
});

describe('/returns — bodega + tienda, sin SELLER ni FINANCE', () => {
  it('✓ ADMIN tiene acceso', () => expect(canAccess('ADMIN', '/returns')).toBe(true));
  it('✓ WAREHOUSE tiene acceso', () => expect(canAccess('WAREHOUSE', '/returns')).toBe(true));
  it('✓ WAREHOUSE_SUB tiene acceso', () => expect(canAccess('WAREHOUSE_SUB', '/returns')).toBe(true));
  it('✓ STORE_MANAGER tiene acceso', () => expect(canAccess('STORE_MANAGER', '/returns')).toBe(true));
  it('✗ SELLER NO tiene acceso', () => expect(canAccess('SELLER', '/returns')).toBe(false));
  it('✗ FINANCE NO tiene acceso', () => expect(canAccess('FINANCE', '/returns')).toBe(false));
});

describe('/cash-cut — incluye FINANCE (único módulo no-admin)', () => {
  it('✓ FINANCE tiene acceso a /cash-cut', () => expect(canAccess('FINANCE', '/cash-cut')).toBe(true));
  it('✓ ADMIN tiene acceso', () => expect(canAccess('ADMIN', '/cash-cut')).toBe(true));
  it('✓ STORE_MANAGER tiene acceso', () => expect(canAccess('STORE_MANAGER', '/cash-cut')).toBe(true));
  it('✗ SELLER NO tiene acceso a /cash-cut', () => expect(canAccess('SELLER', '/cash-cut')).toBe(false));

  it('✓ Solo ADMIN accede a /admin-cash-cuts', () => expect(canAccess('ADMIN', '/admin-cash-cuts')).toBe(true));
  it('✗ FINANCE NO accede a /admin-cash-cuts', () => expect(canAccess('FINANCE', '/admin-cash-cuts')).toBe(false));
  it('✗ STORE_MANAGER NO accede a /admin-cash-cuts', () => expect(canAccess('STORE_MANAGER', '/admin-cash-cuts')).toBe(false));
});
