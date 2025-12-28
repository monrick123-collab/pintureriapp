
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
  description: string;
  price: number;
  stock: number;
  inventory: Record<string, number>;
  image: string;
  status: 'available' | 'low' | 'out' | 'expired';
  wholesalePrice?: number;
  wholesaleMinQty?: number;
  costPrice?: number;
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
  subtotal: number;
  discountAmount: number;
  iva: number;
  total: number;
  status: 'completed' | 'cancelled';
  paymentMethod: 'cash' | 'card' | 'transfer';
  createdAt: string;
  items: SaleItem[];
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
