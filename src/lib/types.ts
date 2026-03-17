export type UserRole = 'owner' | 'employee';

export interface Store {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  store_id: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  barcode: string;
  price: number;
  cost_price: number;
  stock: number;
  image_url: string | null;
  category_id: string | null;
  store_id: string | null;  // Link to store/branch
  created_at: string;
  categories?: Category | null;
}

export interface Transaction {
  id: string;
  user_id: string;
  shift_id: string | null;  // Link transaction to a specific shift
  store_id: string | null;  // Link to store/branch
  total: number;
  payment_method: 'cash' | 'qris' | 'transfer';
  discount: number;
  created_at: string;
}

export interface TransactionItem {
  id: string;
  transaction_id: string;
  product_id: string;
  quantity: number;
  price: number;
  cost_price: number;
}

export interface Shift {
  id: string;
  user_id: string;
  store_id: string | null;  // Link to store/branch
  opening_cash: number;
  closing_cash: number | null;
  opened_at: string;
  closed_at: string | null;
  status: 'open' | 'closed';
}

export interface StockLog {
  id: string;
  product_id: string;
  type: 'restock' | 'sale' | 'adjustment';
  quantity: number;
  note: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  user_id: string;
  store_id: string | null;  // Link to store/branch
  category: string;
  amount: number;
  description: string | null;
  date: string;
  created_at: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}
