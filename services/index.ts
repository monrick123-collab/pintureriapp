// Export all services from a single entry point
export { ProductService } from './productService';
export { StockService } from './inventory/stockService';
export { RestockService } from './restock/restockService';
export { TransferService } from './transfer/transferService';
export { ReturnService } from './return/returnService';
export { BranchService } from './branchService';
export { SupplyService } from './supply/supplyService';
export { PackagingService } from './packaging/packagingService';
export { CoinService } from './coin/coinService';
export { InternalSupplyService } from './supply/internalSupplyService';

// Legacy exports for backward compatibility
export { InventoryService } from './inventoryService';
export { SalesService } from './salesService';
export { DiscountService } from './discountService';
export { NotificationService } from './notificationService';
export { ClientService } from './clientService';
export { FinanceService } from './financeService';
export { AccountingService } from './accountingService';
export { UserService } from './userService';
export { quotationService } from './quotationService';
export { AiService } from './aiService';
export { analyzeInventory, analyzeFinances } from './geminiService';