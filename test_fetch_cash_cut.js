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

        const url = urlMatch[1];
        const key = keyMatch[1];

        const d = new Date();
        const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

        const body = JSON.stringify({
            p_branch_id: 'BR-CENTRO',
            p_date: dateStr
        });

        console.log(`Fetching RPC for BR-CENTRO on ${dateStr}...`);

        const res = await fetch(`${url}/rest/v1/rpc/get_daily_cash_cut_data`, {
            method: 'POST',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json'
            },
            body: body
        });

        const data = await res.json();
        console.log("Response:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
}
main();
