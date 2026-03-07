import { InventoryService } from './services/inventoryService';

(async () => {
    try {
        console.log("Testing March 1st - March 6th");
        const res1 = await InventoryService.getRestockSheets(undefined, "2026-03-01", "2026-03-06");
        console.log("Results for march:", res1.length);

        console.log("\nTesting Feb 2nd - Feb 6th");
        const res2 = await InventoryService.getRestockSheets(undefined, "2026-02-02", "2026-02-06");
        console.log("Results for feb:", res2.length);

        console.log("\nTesting March 1st - March 6th again");
        const res3 = await InventoryService.getRestockSheets(undefined, "2026-03-01", "2026-03-06");
        console.log("Results for march again:", res3.length);
    } catch (e) {
        console.error(e);
    }
})();
