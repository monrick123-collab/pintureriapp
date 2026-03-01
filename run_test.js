import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  console.log("Mocking transfer creation...");
  
  // Try inserting directly without auth, it will probably fail due to RLS,
  // let's see the error message exactly.
  const { data, error } = await supabase
    .from('stock_transfers')
    .insert({
        from_branch_id: 'BR-MAIN',
        to_branch_id: 'BR-SUR',
        folio: 200,
        notes: 'test',
        status: 'pending'
    })
    .select()
    .single();

  console.log("Insert result:", { data, error });
}
test();
