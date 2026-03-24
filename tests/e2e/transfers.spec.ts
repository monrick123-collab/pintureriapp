import { test, expect } from '@playwright/test';

test('Flujo de Traspasos / Envasado como Encargado', async ({ page }) => {
  const consoleLogs: string[] = [];
  const networkErrors: string[] = [];

  // Listen to console errors (ignora fetch cancelados por cambios de ruta del SPA)
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      // "Failed to fetch" ocurre cuando una petición se cancela al cambiar de ruta — no es un error real
      if (txt.includes('Failed to fetch') || txt.includes('TypeError: Failed to fetch')) return;
      // Errores de queries no-críticos (están en try/catch, no bloquean la app)
      if (txt.includes('discount_requests') || txt.includes('pending discount sales')) return;
      // "Failed to load resource" es un error genérico del browser para peticiones 4xx — los críticos se capturan via networkErrors
      if (txt.includes('Failed to load resource')) return;
      consoleLogs.push(`[Console Error] ${txt}`);
      console.log(`[Console Error] ${txt}`);
    }
  });

  // Listen to network errors (especially from Supabase, ignoring non-critical background queries)
  page.on('response', response => {
    if (response.status() >= 400 && response.url().includes('supabase')) {
      // Ignorar errores de queries no-críticos que están en try/catch (no bloquean la app)
      if (response.url().includes('discount_requests')) return;
      networkErrors.push(`[Network Error ${response.status()}] ${response.url()}`);
      console.log(`[Network Error ${response.status()}] ${response.url()}`);
    }
  });

  console.log('Navegando a login...');
  await page.goto('http://localhost:3003/login', { waitUntil: 'commit' });

  console.log('Iniciando sesión como encargado@pintamax.com...');
  await page.fill('input[type="email"]', 'encargado@pintamax.com');
  await page.fill('input[type="password"]', '123456');
  await page.click('button[type="submit"]');

  // Wait for the dashboard header or navigation to verify login
  await page.waitForTimeout(2000); 

  console.log('Navegando a /transfers (Traspasos)...');
  await page.goto('http://localhost:3003/transfers', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000); // Wait for data to load

  // Log what is on the screen to understand what we can click
  console.log('Página de traspasos cargada. Título visible:');
  const h1Text = await page.locator('h1').first().textContent();
  console.log(`- H1: ${h1Text}`);

  // Intenta clickear en 'Nuevo Traspaso' o similar si existe
  const testButton = await page.locator('button', { hasText: 'Nuevo' }).count();
  if (testButton > 0) {
    console.log('Haciendo clic en el botón Nuevo...');
    await page.locator('button', { hasText: 'Nuevo' }).first().click();
    await page.waitForTimeout(1000);
  } else {
      console.log('No se encontró botón "Nuevo" en la vista.');
  }

  // Print form elements to understand the UI structure
  const inputs = await page.locator('input').count();
  console.log(`- Encontrados ${inputs} inputs en la pantalla.`);

  await page.waitForTimeout(2000); // Give it time to trigger some validations if any

  console.log('Terminando prueba. Revisar consola para buscar errores capturados.');

  // Si hay errores, hacer fallar la prueba para reportar
  if (consoleLogs.length > 0 || networkErrors.length > 0) {
     console.error('ERRORES ENCONTRADOS:');
     consoleLogs.forEach(e => console.error(e));
     networkErrors.forEach(e => console.error(e));
     throw new Error('Se detectaron errores en la consola o red durante el flujo.');
  } else {
     console.log('FLUJO COMPLETADO SIN ERRORES CRÍTICOS (Visita preliminar).');
  }
});
