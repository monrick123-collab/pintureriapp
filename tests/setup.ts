/**
 * Setup global para la suite de pruebas PinturaMax.
 * Carga credenciales de tests desde tests/.env.test si existe.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Cargar .env.test manualmente si existe (credenciales de roles de prueba)
try {
  const envTestPath = resolve(__dirname, '.env.test');
  const contents = readFileSync(envTestPath, 'utf-8');
  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = val;
    }
  }
} catch {
  // .env.test no existe — los tests de auth se saltearán automáticamente
}

/** Crea un cliente Supabase con la clave anon (igual que la app en producción). */
export function createTestClient() {
  const url = import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  return createClient(url, key);
}

/** Retorna true si las credenciales de prueba para un rol están ausentes o vacías. */
export function missingCredentials(email?: string, password?: string): boolean {
  return !email || !password || email.trim() === '' || password.trim() === '';
}

/** Credenciales de test leídas de process.env (pobladas desde .env.test). */
export const testCreds = {
  admin: {
    email: process.env.TEST_ADMIN_EMAIL || '',
    password: process.env.TEST_ADMIN_PASSWORD || '',
  },
  seller: {
    email: process.env.TEST_SELLER_EMAIL || '',
    password: process.env.TEST_SELLER_PASSWORD || '',
  },
  storeManager: {
    email: process.env.TEST_STORE_MANAGER_EMAIL || '',
    password: process.env.TEST_STORE_MANAGER_PASSWORD || '',
  },
};
