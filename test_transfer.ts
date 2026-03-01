import { InventoryService } from './services/inventoryService';

async function test() {
  try {
    await InventoryService.createStockTransfer('BR-MAIN', 'BR-SUR', 'test backend manual', []);
    console.log("Success");
  } catch(e) {
    console.log("Error:", e);
  }
}
test();
