
import { createClient } from '@supabase/supabase-js';
// import { Database } from '../types_db';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    const errorMsg = 'Error: Faltan las variables de entorno de Supabase (VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY). Por favor verifica tu archivo .env';
    console.error(errorMsg);
    // Throwing is safer than returning a broken client if you want to catch it early
    // But for now we just export the client (it will throw on first call anyway)
}

export const supabase = createClient(
    supabaseUrl || 'https://missing-url.supabase.co',
    supabaseAnonKey || 'missing-key'
);
