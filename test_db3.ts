import { InventoryService } from './services/inventoryService';

async function test() {
  console.log("Testing transfer fallback");
  try {
    await InventoryService.createStockTransfer('BR-MAIN', 'BR-SUR', 'test fallback', []);
    console.log("Success with fallback");
  } catch (e) {
    console.log("Error still:", e);
  }
}
test();
