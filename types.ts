
export enum UserRole {
  ADMIN = 'ADMIN',
  SELLER = 'SELLER',
  WAREHOUSE = 'WAREHOUSE',
  WAREHOUSE_SUB = 'WAREHOUSE_SUB',
  FINANCE = 'FINANCE'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  branchId?: string; // Links user to a specific branch (e.g. for POS)
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  manager: string;
  phone: string;
  status: 'active' | 'inactive';
  type: 'warehouse' | 'store';
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
  status: 'pending' | 'completed' | 'cancelled';
  branchName?: string;
  items?: RestockRequest[]; // Joined items
}

export interface RestockRequest {
  id: string;
  branchId: string;
  branchName?: string; // Optional (joined)
  productId: string;
  productName?: string; // Optional (joined)
  quantity: number;
  status: RestockStatus;
  createdAt: string;
  approvedAt?: string;
  shippedAt?: string;
  receivedAt?: string;

  // New fields for Sheets
  sheetId?: string;
  unitPrice?: number;
  totalPrice?: number;
  product?: Product; // Joined product
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
  productId: string;
  quantity: number;
  reason: string;
  status: 'pending_authorization' | 'approved' | 'rejected';
  authorizedBy?: string;
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
  status: 'sent_to_branch' | 'processing' | 'completed' | 'cancelled';
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
