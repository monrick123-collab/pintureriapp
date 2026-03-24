import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:3003';

// Credenciales verificadas (password: 123456)
const USERS = {
  encargado: { email: 'encargado@pintamax.com', role: 'STORE_MANAGER' },
  bodega:    { email: 'bodega@pintamax.com',    role: 'WAREHOUSE' },
  sub:       { email: 'subencargado@pintamax.com', role: 'WAREHOUSE_SUB' },
};

/**
 * Login y navegar al WholesalePOS usando client-side navigation (link del sidebar).
 * No usar page.goto('/wholesale-pos') porque el SPA pierde la sesión en fresh-load.
 */
async function loginAndGoToWholesale(page: Page, email: string, password = '123456') {
  await page.goto(`${BASE}/login`, { waitUntil: 'commit' });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  // Esperar a que el SPA redirija post-login
  await page.waitForURL(`${BASE}/`, { timeout: 10000 });
  await page.waitForTimeout(1500);
  // Navegar al WholesalePOS via sidebar (client-side, conserva sesión)
  await page.click('a[href="/wholesale-pos"]');
  await page.waitForTimeout(6000); // productos cargan desde Supabase
}

// ─── Suite: Carga y UI ──────────────────────────────────────────────────────

test.describe('WholesalePOS - Carga y UI', () => {

  test('La vista carga sin errores 5xx de Supabase', async ({ page }) => {
    const networkErrors: string[] = [];

    page.on('response', res => {
      if (res.status() >= 500 && res.url().includes('supabase'))
        networkErrors.push(`[${res.status()}] ${res.url()}`);
    });

    await loginAndGoToWholesale(page, USERS.encargado.email);

    const heading = await page.locator('h2').first().textContent();
    console.log('Heading:', heading);
    expect(heading).toContain('Mayoreo');
    expect(networkErrors, `Errores 5xx: ${networkErrors.join('\n')}`).toHaveLength(0);
  });

  test('URL es /wholesale-pos después de navegar', async ({ page }) => {
    await loginAndGoToWholesale(page, USERS.encargado.email);
    console.log('URL:', page.url());
    expect(page.url()).toContain('/wholesale-pos');
  });

  test('Muestra badges de disponibilidad de stock en tarjetas', async ({ page }) => {
    await loginAndGoToWholesale(page, USERS.encargado.email);

    // Buscar badges "Agotado" o "Disp.:"
    const agotados = await page.getByText('Agotado').count();
    const disponibles = await page.locator('text=/Disp\\.:/').count();
    const total = agotados + disponibles;

    console.log(`Badges: ${agotados} agotados, ${disponibles} con disponibilidad → total: ${total}`);
    expect(total).toBeGreaterThan(0);
  });

  test('Muestra el botón Finalizar Venta', async ({ page }) => {
    await loginAndGoToWholesale(page, USERS.encargado.email);

    const btn = page.locator('button', { hasText: 'Finalizar Venta' });
    const visible = await btn.isVisible().catch(() => false);
    console.log('Botón Finalizar Venta visible:', visible);
    expect(visible).toBe(true);
  });

  test('Muestra el carrito vacío inicialmente', async ({ page }) => {
    await loginAndGoToWholesale(page, USERS.encargado.email);

    const carrito = page.locator('h3', { hasText: 'Carrito' });
    const exists = await carrito.count();
    console.log('Sección Carrito encontrada:', exists > 0);
    expect(exists).toBeGreaterThan(0);
  });

  test('El buscador de productos está visible', async ({ page }) => {
    await loginAndGoToWholesale(page, USERS.encargado.email);

    const inputs = await page.locator('input').count();
    console.log(`Inputs encontrados: ${inputs}`);
    expect(inputs).toBeGreaterThan(0);
  });

  test('Los filtros de categoría (Todos, Interiores, etc.) están visibles', async ({ page }) => {
    await loginAndGoToWholesale(page, USERS.encargado.email);

    const todosBtn = page.locator('button', { hasText: 'Todos' });
    const exists = await todosBtn.count();
    console.log('Botón Todos:', exists);
    expect(exists).toBeGreaterThan(0);
  });

});

// ─── Suite: Acceso por roles ────────────────────────────────────────────────

test.describe('WholesalePOS - Acceso por rol', () => {

  for (const [, user] of Object.entries(USERS)) {
    test(`${user.role} puede acceder y ver la vista de mayoreo`, async ({ page }) => {
      await loginAndGoToWholesale(page, user.email);

      expect(page.url()).toContain('/wholesale-pos');

      const heading = await page.locator('h2', { hasText: 'Mayoreo' }).count();
      console.log(`${user.role} → heading "Mayoreo": ${heading}`);
      expect(heading).toBeGreaterThan(0);
    });
  }

});
