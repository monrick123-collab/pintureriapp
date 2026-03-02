import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rqrumtpqutzdbwtqjaoh.supabase.co';
const supabaseKey = 'sb_publishable_rTrOdDmjiGGzl-jYeEcbeQ_pJMTSMgf';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const d = new Date();
    const localDateString = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    
    const { data: sales, error } = await supabase.rpc('get_daily_cash_cut_data', {
        p_branch_id: 'BR-MAIN',
        p_date: localDateString
    });
    console.log("BR-MAIN sales:", sales?.sales?.length || 0);

    const { data: salesCentro } = await supabase.rpc('get_daily_cash_cut_data', {
        p_branch_id: 'BR-CENTRO',
        p_date: localDateString
    });
    console.log("BR-CENTRO sales:", salesCentro?.sales?.length || 0);

    const { data: salesNorte } = await supabase.rpc('get_daily_cash_cut_data', {
        p_branch_id: 'BR-NORTE',
        p_date: localDateString
    });
    console.log("BR-NORTE sales:", salesNorte?.sales?.length || 0);

    process.exit(0);
}

check().catch(console.error);
