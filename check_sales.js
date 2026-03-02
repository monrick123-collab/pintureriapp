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

        console.log(`Fetching last 5 sales for BR-CENTRO...`);

        const controller = new AbortController();
        const timeout = setTimeout(() => {
            controller.abort();
        }, 5000);

        const res = await fetch(`${url}/rest/v1/sales?branch_id=eq.BR-CENTRO&order=created_at.desc&limit=5`, {
            method: 'GET',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json'
            },
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!res.ok) {
            console.error("HTTP Error", res.status, await res.text());
            process.exit(1);
        }

        const data = await res.json();
        console.log("Last 5 Sales:", JSON.stringify(data, null, 2));
        process.exit(0);
    } catch (e) {
        console.error("Caught error:", e.message);
        process.exit(1);
    }
}
main();
