import { InventoryService } from './services/inventoryService.js';
(async () => {
    try {
        console.log("Testing march:");
        const res1 = await InventoryService.getRestockSheets(undefined, "2026-03-01", "2026-03-06");
        console.log("March results:", res1.length);
        
        console.log("Testing feb:");
        const res2 = await InventoryService.getRestockSheets(undefined, "2026-02-02", "2026-02-06");
        console.log("Feb results:", res2.length);

        console.log("Testing march again:");
        const res3 = await InventoryService.getRestockSheets(undefined, "2026-03-01", "2026-03-06");
        console.log("March results again:", res3.length);
    } catch(e) { console.error(e) }
})()
