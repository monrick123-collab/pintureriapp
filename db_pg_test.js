import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('stock_transfers').insert({
      from_branch_id: 'BR-MAIN',
      to_branch_id: 'TestDest',
      folio: null,
      notes: 'test fallback manually',
      status: 'pending'
  });
  console.log("Insert with null folio:", error);

  const { data: d2, error: e2 } = await supabase.from('stock_transfers').insert({
      from_branch_id: 'BR-MAIN',
      to_branch_id: 'TestDest',
      folio: 9999,
      notes: 'test valid folio manually',
      status: 'pending'
  });
  console.log("Insert with int folio:", e2);
}
run();
