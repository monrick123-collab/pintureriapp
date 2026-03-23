
export enum UserRole {
  ADMIN = 'ADMIN',
  SELLER = 'SELLER',
  WAREHOUSE = 'WAREHOUSE',
  WAREHOUSE_SUB = 'WAREHOUSE_SUB',
  FINANCE = 'FINANCE',
  STORE_MANAGER = 'STORE_MANAGER'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  branchId?: string; // Links user to a specific branch (e.g. for POS)
}

export interface BranchConfig {
  enable_manual_tinting: boolean;
  enable_ai_dynamic_pricing: boolean;
  enable_pro_portal: boolean;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  manager: string;
  phone: string;
  status: 'active' | 'inactive';
  type: 'warehouse' | 'store';
  config?: BranchConfig; // New configuration field
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  brand?: string; // New field
  description: string;
  price: number;
  stock: number;
  inventory: Record<string, number>;
  image?: string;
  status: 'available' | 'low' | 'out' | 'expired';
  wholesalePrice?: number;
  wholesaleMinQty?: number;
  costPrice?: number;
  packageType?: 'cubeta' | 'galon' | 'litro' | 'medio' | 'cuarto' | 'aerosol' | 'complemento';
  // New Inventory Fields
  min_stock?: number;
  max_stock?: number;
  location?: string;
  supplier_id?: string;
  unit_measure?: string;
}

export interface BulkInventoryItem {
  id: string;
  branchId: string;
  productId: string;
  availableLiters: number;
  updatedAt?: string;
  product?: Product;
}

export type ExpenseCategory = 'renta' | 'servicios' | 'salarios' | 'suministros' | 'otros';

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  branchId: string;
  createdAt: string;
}

export type RestockStatus = 'pending_admin' | 'approved_warehouse' | 'shipped' | 'completed' | 'rejected';

export interface RestockSheet {
  id: string;
  branchId: string;
  folio: number;
  totalAmount: number;
  createdAt: string;
  status: 'pending' | 'approved' | 'shipped' | 'completed' | 'cancelled' | 'rejected';
  branchName?: string;
  items?: RestockItem[]; // Joined items
  departureTime?: string;
  arrivalTime?: string;
}

export interface RestockItem {
  id: string;
  sheetId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  product?: Product; // Joined product
}

export interface RestockRequest {
  id: string;
  branchId: string;
  branchName?: string; // Optional (joined)
  productId: string;
  productName?: string; // Optional (joined)
  productImage?: string; // Optional (joined)
  quantity: number;
  status: RestockStatus;
  createdAt: string;
  approvedAt?: string;
  shippedAt?: string;
  receivedAt?: string;
}

// New interfaces for Supply Orders (Point 2)
export type SupplyStatus = 'pending' | 'processing' | 'shipped' | 'received' | 'received_with_incidents' | 'cancelled';

export interface SupplyOrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName?: string;
  productImage?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status?: 'pending' | 'received_full' | 'received_partial' | 'damaged';
  received_quantity?: number;
  notes?: string;
}

export interface SupplyOrder {
  id: string;
  folio: number;
  branchId: string;
  branchName?: string;
  createdBy: string;
  createdByName?: string;
  assignedAdminId?: string;
  assignedAdminName?: string;
  status: SupplyStatus;
  estimatedArrival?: string;
  totalAmount: number;
  createdAt: string;
  items?: SupplyOrderItem[];
}

export interface CartItem extends Product {
  quantity: number;
  selectedColor?: string;
}

export interface FinancialInvoice {
  id: string;
  counterparty: string;
  counterpartyId: string;
  issueDate: string;
  dueDate: string;
  status: 'overdue' | 'pending' | 'paid';
  amount: number;
  branch: string;
  colorCode?: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  taxId: string;
  address: string;
  type: 'Individual' | 'Empresa' | 'Municipio';
  municipality?: string;
  locality?: string;
  creditLimit?: number;
  creditDays?: number;
  isActiveCredit?: boolean;
  isMunicipality?: boolean;
  extraPercentage?: number;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Sale {
  id: string;
  branchId: string;
  branchName?: string;
  clientId?: string;
  clientName?: string;
  subtotal: number;
  discountAmount: number;
  iva: number;
  total: number;
  status: 'completed' | 'cancelled';
  paymentMethod: 'cash' | 'card' | 'transfer';
  paymentStatus?: 'pending' | 'approved' | 'rejected';
  transferReference?: string;
  pendingSince?: string;
  rejectionReason?: string;
  createdAt: string;
  folio?: number;
  items: SaleItem[];
  isWholesale: boolean;
  paymentType: 'contado' | 'credito';
  departureAdminId?: string;
  departureAdminName?: string;
  creditDays?: number;
  billingBank?: string;
  billingSocialReason?: string;
  billingInvoiceNumber?: string;
  deliveryReceiverName?: string;
  promotionRequestId?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
}

export interface Quotation {
  id: string;
  folio: number;
  clientId?: string;
  clientName?: string;
  items: SaleItem[];
  subtotal: number;
  discountAmount: number;
  iva: number;
  total: number;
  status: 'pending' | 'completed' | 'cancelled';
  saleId?: string;
  branchId: string;
  createdBy: string;
  createdAt: string;
}

export interface Return {
  id: string;
  branchId: string;
  folio?: number;
  productId: string;
  quantity: number;
  reason: string;
  status: 'pending_authorization' | 'approved' | 'rejected' | 'received_at_warehouse' | 'closed';
  authorizedBy?: string;
  authorizedByName?: string;
  transportedBy?: string;
  receivedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InternalSupply {
  id: string;
  branchId: string;
  description: string;
  amount: number;
  category: 'limpieza' | 'papeleria';
  createdAt: string;
}

export interface PackagingRequest {
  id: string;
  bulkProductId: string;
  targetPackageType: 'cuarto_litro' | 'medio_litro' | 'litro' | 'galon';
  targetProductId?: string;   // producto resultado (botella) que se agrega al inventario
  quantityDrum: number;
  litersRequested?: number;   // litros a envasar (puede ser < quantityDrum * 200)
  packagesProduced?: number;  // calculado al completar
  status: 'sent_to_branch' | 'received_at_branch' | 'processing' | 'completed' | 'cancelled';
  stockReleased?: boolean;
  branchId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientPayment {
  id: string;
  clientId: string;
  amount: number;
  paymentMethod: 'cash' | 'transfer';
  receivedByAdminId?: string;
  authorizedByAdminId?: string;
  transferReference?: string;
  paymentStatus: 'on_time' | 'late';
  createdAt: string;
}

export interface ClientMarketingSpend {
  id: string;
  clientId: string;
  description: string;
  amount: number;
  createdAt: string;
}

export interface PriceRequest {
  id: string;
  productId: string;
  productName?: string;
  requesterId: string;
  requesterName?: string;
  status: 'pending' | 'resolved';
  createdAt: string;
}

export interface DiscountRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  branchId: string;
  amount: number;
  type: 'percentage' | 'fixed';
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  createdAt: string;
}

export interface InternalConsumption {
  id: string;
  productId: string;
  productName?: string;
  productImage?: string;
  branchId: string;
  branchName?: string;
  userId: string;
  userName?: string;
  quantity: number;
  reason: string;
  costAtTime?: number;
  createdAt: string;
}

// --- Finance Modules Types ---

export interface Supplier {
  id: string;
  name: string;
  taxId?: string;
  contactInfo?: string; // Legacy
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  paymentTermsDays: number;
  commercialConditions?: Record<string, any>;
  createdAt: string;
}

export type InvoiceStatus = 'received' | 'verified' | 'authorized' | 'paid' | 'rejected';

export interface SupplierInvoice {
  id: string;
  supplierId: string;
  supplierName?: string; // Joined
  invoiceFolio: string;
  amount: number;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  pdfUrl?: string;
  xmlUrl?: string;
  notes?: string;
  createdAt: string;
}

export interface SupplierPayment {
  id: string;
  invoiceId: string;
  amount: number;
  paymentMethod: 'transfer' | 'check' | 'cash';
  reference?: string;
  paymentDate: string;
}

export interface Lease {
  id: string;
  propertyName: string;
  landlordName: string;
  monthlyAmount: number;
  paymentDay: number;
  contractStart?: string;
  contractEnd?: string;
  active: boolean;
  branchId?: string;
}

export interface LeasePayment {
  id: string;
  leaseId: string;
  amount: number;
  paymentDate: string; // The month covered
  paidAt: string;
  notes?: string;
}

export interface CoinChangeRequest {
  id: string;
  branchId: string;
  branchName?: string;
  folio: number;
  amount: number;
  breakdown?: Record<string, number>; // e.g. { "500": 2, "200": 5 }
  status: 'pending' | 'coins_sent' | 'completed' | 'cancelled';
  requesterId: string;
  requesterName?: string;
  receiverId?: string;
  receiverName?: string;
  collectedById?: string;
  collectedByName?: string;
  createdAt: string;
}

export interface StockTransfer {
  id: string;
  fromBranchId: string;
  fromBranchName?: string;
  toBranchId: string;
  toBranchName?: string;
  folio: number;
  status: 'pending' | 'in_transit' | 'completed' | 'cancelled';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  items?: StockTransferItem[];
}

export interface StockTransferItem {
  id: string;
  transferId: string;
  productId: string;
  productName?: string;
  quantity: number;
}

export interface BarterTransfer {
  id: string;
  fromBranchId: string;
  fromBranchName?: string;
  toBranchId: string;
  toBranchName?: string;
  folio: number;
  status: 'pending_offer' | 'pending_selection' | 'pending_approval' | 'approved' | 'in_transit' | 'completed' | 'rejected' | 'cancelled' | 'counter_proposed';
  notes?: string;
  requestedBy: string;
  requestedByName?: string;
  selectedBy?: string;
  selectedByName?: string;
  selectedAt?: string;
  counterProposalBy?: string;
  counterProposalByName?: string;
  counterProposalAt?: string;
  authorizedBy?: string;
  authorizedByName?: string;
  authorizedAt?: string;
  dispatchedBy?: string;
  dispatchedByName?: string;
  dispatchedAt?: string;
  receivedBy?: string;
  receivedAt?: string;
  createdAt: string;
  updatedAt: string;
  givenItems?: BarterItem[];
  receivedItems?: BarterItem[];
  selections?: BarterSelection[];
  counterOffers?: BarterCounterOffer[];
}

export interface BarterItem {
  id: string;
  barterId: string;
  productId: string;
  productName?: string;
  productSku?: string;
  productImage?: string;
  quantity: number;
}

export interface BarterSelection {
  id: string;
  barterId: string;
  productId: string;
  productName?: string;
  productSku?: string;
  productImage?: string;
  quantity: number;
  selectedBy: string;
  createdAt: string;
}

export interface BarterCounterOffer {
  id: string;
  barterId: string;
  productId: string;
  productName?: string;
  productSku?: string;
  productImage?: string;
  quantity: number;
  proposedBy: string;
  notes?: string;
  createdAt: string;
}

export interface BarterInventoryHold {
  id: string;
  barterId: string;
  branchId: string;
  productId: string;
  productName?: string;
  quantity: number;
  createdAt: string;
}

export interface BarterSuggestion {
  productId: string;
  productName: string;
  productSku: string;
  fromBranchStock: number;
  toBranchStock: number;
  surplus: number;
  deficit: number;
  suggestionScore: number;
}

export interface Notification {
  id: string;
  userId?: string;
  targetRole?: string;
  targetBranchId?: string;
  title: string;
  message: string;
  actionUrl?: string;
  isRead: boolean;
  createdAt: string;
}

// --- Promotion System Types ---

export interface WholesalePromotion {
  id: string;
  name: string;
  description?: string;
  minQuantity: number;
  maxQuantity?: number;
  discountPercent: number;
  isActive: boolean;
  autoApply: boolean;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromotionRequest {
  id: string;
  saleId?: string;
  promotionId?: string;
  branchId: string;
  clientId?: string;
  clientName?: string;
  totalItems: number;
  subtotal: number;
  requestedDiscountPercent: number;
  requestedDiscountAmount: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedBy: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  items?: any[];
}

// --- Shipping System Types ---

export type ShippingEntityType = 'stock_transfer' | 'barter_transfer' | 'restock_sheet';
export type ShippingStatus = 'pending' | 'shipped' | 'in_transit' | 'delivered' | 'cancelled';

export interface ShippingOrder {
  id: string;
  entityType: ShippingEntityType;
  entityId: string;
  originBranchId: string;
  destinationBranchId: string;
  carrier?: string;
  trackingNumber?: string;
  status: ShippingStatus;
  estimatedDeliveryDate?: string;
  shippedAt?: string;
  deliveredAt?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShippingTrackingHistory {
  id: string;
  shippingOrderId: string;
  status: string;
  location?: string;
  notes?: string;
  createdAt: string;
}

// --- Restock Incident Types ---

export interface RestockIncident {
  id: string;
  restockSheetId: string;
  productId: string;
  productName?: string;
  expectedQuantity: number;
  receivedQuantity: number;
  difference: number;
  incidentType: 'missing' | 'damaged' | 'extra' | 'wrong_product' | 'other';
  notes?: string;
  status: 'pending' | 'resolved' | 'credited';
  createdBy: string;
  resolvedBy?: string;
  resolvedAt?: string;
  creditAmount?: number;
  createdAt: string;
}

export interface RestockItemWithReceived extends RestockItem {
  receivedQuantity?: number;
  differenceReason?: string;
}

// --- Packaging v3 Types ---

export interface PackagingSettings {
  galon_liters: number;
  drum_liters: number;
}

export interface PackagingOrderLine {
  id?: string;
  orderId: string;
  packageType: 'galon' | 'litro' | 'medio_litro' | 'cuarto_litro';
  targetProductId: string;
  targetProductName?: string;
  quantityRequested: number;
  litersPerUnit: number;
  litersSubtotal: number;
  quantityProduced?: number;
}
