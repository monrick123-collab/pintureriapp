import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('stock_transfers').insert({
    from_branch_id: 'BR-MAIN',
    to_branch_id: 'TestDest',
    folio: 99999,
    notes: 'test RLS',
    status: 'pending'
  });
  console.log("Insert result:", error);
  if(!error) {
    // Clean up
    await supabase.from('stock_transfers').delete().eq('folio', 99999);
  }
}
check();
