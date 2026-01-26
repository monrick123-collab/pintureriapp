
import { createClient } from '@supabase/supabase-js';
// import { Database } from '../types_db';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    if (import.meta.env.DEV) {
        console.warn('⚠️ Alerta: Faltan las variables de entorno de Supabase (VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY). Verifica tu archivo .env');
    }
}

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key'
);
