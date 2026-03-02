import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rqrumtpqutzdbwtqjaoh.supabase.co';
const supabaseKey = 'sb_publishable_rTrOdDmjiGGzl-jYeEcbeQ_pJMTSMgf';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testCoin() {
    console.log("Fetching a valid profile...");
    const { data: profiles, error: profErr } = await supabase.from('profiles').select('id, branch_id').limit(1);
    if (profErr || !profiles || profiles.length === 0) {
        console.error("Could not fetch a valid profile ID", profErr);
        process.exit(1);
    }
    const realUserId = profiles[0].id;
    const realBranch = profiles[0].branch_id || 'BR-MAIN';
    console.log("Using User ID:", realUserId, "Branch:", realBranch);

    console.log("Getting folio...");
    const { data: folio, error: folioError } = await supabase.rpc('get_next_folio', {
        p_branch_id: realBranch,
        p_folio_type: 'coin_change'
    });
    console.log("Folio result:", folio, "Error:", folioError ? folioError.message : null);

    console.log("Inserting request...");
    const { data: insertData, error: insertError } = await supabase
        .from('coin_change_requests')
        .insert({
            branch_id: realBranch,
            folio: folio || 0,
            amount: 220,
            requester_id: realUserId,
            status: 'pending',
            breakdown_details: {"100": 1, "50": 2, "20": 1}
        }).select();
        
    console.log("Insert Data:", insertData, "Error:", insertError ? insertError : null);
    process.exit(0);
}

testCoin().catch(console.error);
