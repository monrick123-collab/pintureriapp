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
        
        // Let's get the 5 most recent sales
        const { data, error } = await supabase
            .from('sales')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);
            
        console.log("Most recent sales:", JSON.stringify(data, null, 2));
        console.log("Error (if any):", error);
        
    } catch (e) {
        console.error(e);
    }
}
main();
