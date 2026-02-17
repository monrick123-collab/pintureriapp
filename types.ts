
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
  image: string;
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
export type SupplyStatus = 'pending' | 'processing' | 'shipped' | 'received' | 'cancelled';

export interface SupplyOrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName?: string;
  productImage?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
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
  type: 'Individual' | 'Empresa';
  municipality?: string;
  locality?: string;
  creditLimit?: number;
  creditDays?: number;
  isActiveCredit?: boolean;
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
  createdAt: string;
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
  status: 'pending_authorization' | 'approved' | 'rejected';
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
  targetPackageType: 'litro' | 'galon';
  quantityDrum: number;
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
  folio: number;
  amount: number;
  breakdown?: Record<string, number>; // e.g. { "500": 2, "200": 5 }
  status: 'pending' | 'completed' | 'cancelled';
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
