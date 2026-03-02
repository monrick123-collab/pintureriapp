const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function main() {
    try {
        const env = fs.readFileSync('.env', 'utf-8');
        const urlMatch = env.match(/VITE_SUPABASE_URL=([^ \n]+)/);
        const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=([^ \n]+)/);
        
        if (!urlMatch || !keyMatch) {
            console.error("Missing credentials in .env");
            process.exit(1);
        }
        
        const supabase = createClient(urlMatch[1], keyMatch[1]);
        
        console.log("Testing RPC get_daily_cash_cut_data for BR-CENTRO...");
        const d = new Date();
        const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        
        const { data, error } = await supabase.rpc('get_daily_cash_cut_data', {
            p_branch_id: 'BR-CENTRO',
            p_date: dateStr
        });
            
        console.log("RPC Data:", JSON.stringify(data, null, 2));
        console.log("RPC Error (if any):", error);
        
    } catch (e) {
        console.error(e);
    }
}
main();
