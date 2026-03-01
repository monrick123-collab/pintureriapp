import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Getting next folio for BR-MAIN transfer...");
  const { data: folio, error: folioError } = await supabase.rpc('get_next_folio', {
      p_branch_id: 'BR-MAIN',
      p_folio_type: 'transfer'
  });
  console.log("Folio result:", folio, "Error:", folioError);

  if (!folioError && typeof folio === 'number' && folio > 0) {
      console.log("Folio works. Testing insert...");
  } else {
      console.log("Folio might be null. Let's check branch_folios for BR-MAIN");
      const { data: bf } = await supabase.from('branch_folios').select('*').eq('branch_id', 'BR-MAIN');
      console.log("branch_folios:", bf);
  }
}
test();
