
export enum UserRole {
  ADMIN = 'ADMIN',
  SELLER = 'SELLER',
  WAREHOUSE = 'WAREHOUSE',
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
  clientName?: string; // Potential join
  subtotal: number;
  discountAmount: number;
  iva: number;
  total: number;
  status: 'completed' | 'cancelled';
  paymentMethod: 'cash' | 'card' | 'transfer';
  createdAt: string;
  items: SaleItem[];

  // New fields for Point 3
  isWholesale: boolean;
  paymentType: 'contado' | 'credito';
  departureAdminId?: string;
  departureAdminName?: string;
}

// New interface for Price Requests (Point 4)
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
