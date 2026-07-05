export type UserRole = 'cashier' | 'admin' | 'super_admin';
export type PaymentMethod = 'cash' | 'card' | 'credit';
export type DiscountType = 'none' | 'percent';
export type ShopPlan = 'free' | 'pro';
export type ShopStatus = 'active' | 'suspended';
export type LicenseStatus = 'inactive' | 'active' | 'expired';

export interface Branch {
  id: string;
  shop_id: string;
  name: string;
  address: string | null;
  created_at: string;
}

export interface Supplier {
  id: string;
  shop_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
}

/** Shop = Tenant */
export interface Shop {
  id: string;
  name: string;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  plan: ShopPlan;
  status: ShopStatus;
  quick_buttons: string[];   // array of product IDs
  license_key: string | null;
  license_status: LicenseStatus;
  license_activated_at: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  username: string;
  email: string | null;
  role: UserRole;
  shop_id: string | null;
  branch_id: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  shop_id: string;
  barcode: string;
  name: string;
  unit: string;
  cost: number;
  price: number;
  qty: number;
  discount_type: DiscountType;
  discount_value: number;
  supplier_id: string | null;
  branch_id: string | null;
  expiry: string;
  created_at: string;
  updated_at: string;
}

/** Buy X Get Y Free promotion linked to a product */
export interface Promotion {
  id: string;
  shop_id: string;
  product_id: string;
  barcode: string;
  buy_qty: number;
  free_qty: number;
  active: boolean;
  created_at: string;
}

/** v2: Invoice (multi-item bill) */
export interface Invoice {
  id: string;
  shop_id: string;
  invoice_no: number;
  total_amount: number;
  total_profit: number;
  cashier_id: string;
  cashier_username: string;
  payment_method: PaymentMethod;
  branch_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  tendered_amount: number | null;
  change_amount: number | null;
  created_at: string;
  items?: InvoiceItem[];
}

/** v2: Single line item within an invoice */
export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string;
  product_name: string;
  barcode: string;
  unit: string;
  qty: number;
  free_qty: number;
  price_per_unit: number;
  cost_per_unit: number;
  discount_type: DiscountType;
  discount_value: number;
  discount_amount: number;
  total: number;
  profit: number;
  created_at: string;
}

export interface CartItem {
  product: Product;
  qty: number;
  /** free items from promotion (Buy X Get Y) */
  freeQty: number;
  /** per-line manual discount amount entered by cashier */
  lineDiscountType: 'none' | 'percent' | 'amount';
  lineDiscountValue: number;
  discountAmount: number;
  total: number;
  profit: number;
}

/** A bill snapshot stored on server while cashier works on another bill */
export interface HeldBill {
  id: string;
  shop_id: string;
  cashier_id: string;
  label: string | null;
  cart_json: CartItem[];
  customer_name: string | null;
  customer_phone: string | null;
  held_at: string;
}

/** Daily report summary */
export interface DailyReport {
  date: string;
  total_sales: number;
  total_profit: number;
  total_cost: number;
  invoice_count: number;
}

/** Monthly report summary */
export interface MonthlyReport {
  year: number;
  month: number;
  total_sales: number;
  total_profit: number;
  total_cost: number;
  invoice_count: number;
}

/** Top-selling product entry */
export interface TopProduct {
  product_name: string;
  total_qty: number;
  total_revenue: number;
  total_profit: number;
}
