
import { createClient } from '@supabase/supabase-js';
// import { Database } from '../types_db';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Faltan las variables de entorno de Supabase. La base de datos no conectará.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
