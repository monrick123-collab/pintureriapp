import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rqrumtpqutzdbwtqjaoh.supabase.co';
const supabaseKey = 'sb_publishable_rTrOdDmjiGGzl-jYeEcbeQ_pJMTSMgf';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
    const d = new Date();
    // Replicate exactly what the frontend is doing
    const localDateString = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    console.log("Local date string used by frontend:", localDateString);

    const start = new Date(localDateString);
    start.setHours(0, 0, 0, 0);
    const end = new Date(localDateString);
    end.setHours(23, 59, 59, 999);
    
    console.log("Start filter:", start.toISOString());
    console.log("End filter:", end.toISOString());

    const { data: sales, error: sError } = await supabase.from('sales')
        .select('id, branch_id, total, created_at, payment_method')
        .eq('branch_id', 'BR-CENTRO')
        .order('created_at', { ascending: false })
        .limit(5);

    console.log("\nLast 5 sales for BR-CENTRO:");
    console.log(sales);
    if(sError) console.error(sError);

    process.exit(0);
}

testQuery().catch(console.error);
