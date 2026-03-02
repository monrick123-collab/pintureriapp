import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rqrumtpqutzdbwtqjaoh.supabase.co';
const supabaseKey = 'sb_publishable_rTrOdDmjiGGzl-jYeEcbeQ_pJMTSMgf';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testCoin() {
    console.log("Starting script...");
    const { data: folio, error: folioError } = await supabase.rpc('get_next_folio', {
        p_branch_id: 'BR-MAIN',
        p_folio_type: 'coin_change'
    });
    console.log("Folio:", folio, "Error:", folioError ? folioError.message : null);

    const { data: insertData, error: insertError } = await supabase
        .from('coin_change_requests')
        .insert({
            branch_id: 'BR-MAIN',
            folio: folio || 0,
            amount: 220,
            requester_id: 'a701358f-e7d3-4c95-8b5c-785cad7acb6d',
            status: 'pending',
            breakdown_details: { "100": 1, "50": 2, "20": 1 }
        }).select();

    console.log("Insert Data:", insertData, "Error:", insertError ? insertError.message : null);
    process.exit(0);
}

testCoin().catch(console.error);
