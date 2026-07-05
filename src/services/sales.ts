import { supabase } from '@/db/supabase';
import type { CartItem, Invoice, DailyReport, MonthlyReport, TopProduct, PaymentMethod } from '@/types/index';
import type { OfflineSale } from '@/services/offlineQueue';

/** Day-end summary for a cashier */
export interface DayEndSummary {
  total_sales: number;
  cash_total: number;
  card_total: number;
  credit_total: number;
  invoice_count: number;
}

export async function getDayEndSummary(
  cashierId: string
): Promise<DayEndSummary> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('invoices')
    .select('total_amount, payment_method')
    .eq('cashier_id', cashierId)
    .gte('created_at', today.toISOString());
  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  return {
    total_sales:   rows.reduce((s, r) => s + Number(r.total_amount), 0),
    cash_total:    rows.filter(r => r.payment_method === 'cash').reduce((s, r) => s + Number(r.total_amount), 0),
    card_total:    rows.filter(r => r.payment_method === 'card').reduce((s, r) => s + Number(r.total_amount), 0),
    credit_total:  rows.filter(r => r.payment_method === 'credit').reduce((s, r) => s + Number(r.total_amount), 0),
    invoice_count: rows.length,
  };
}

/**
 * Compute cart item totals applying promotion (buy X get Y), product-level
 * percent discount, AND a per-line manual discount entered by the cashier.
 */
export function computeCartItem(
  product: { id: string; barcode: string; name: string; cost: number; price: number; qty: number; discount_type: string; discount_value: number },
  qty: number,
  promotion: { buy_qty: number; free_qty: number } | null,
  lineDiscountType: 'none' | 'percent' | 'amount' = 'none',
  lineDiscountValue = 0
): Omit<CartItem, 'product'> {
  // Free items from promotion
  const sets = promotion ? Math.floor(qty / promotion.buy_qty) : 0;
  const freeQty = promotion ? sets * promotion.free_qty : 0;
  const paidQty = qty;

  // Product-level percent discount
  const subtotal = paidQty * product.price;
  const productDiscount = product.discount_type === 'percent'
    ? (subtotal * product.discount_value) / 100
    : 0;

  // Per-line cashier discount
  const afterProductDiscount = subtotal - productDiscount;
  let lineDiscount = 0;
  if (lineDiscountType === 'percent') {
    lineDiscount = (afterProductDiscount * Math.min(lineDiscountValue, 100)) / 100;
  } else if (lineDiscountType === 'amount') {
    lineDiscount = Math.min(lineDiscountValue, afterProductDiscount);
  }

  const discountAmount = productDiscount + lineDiscount;
  const total = subtotal - discountAmount;
  const profit = total - paidQty * product.cost;

  return { qty, freeQty, lineDiscountType, lineDiscountValue, discountAmount, total, profit };
}

/**
 * Multi-item checkout — invoice + invoice_items + stock deduction
 */
export async function checkoutCart(
  cart: CartItem[],
  cashierId: string,
  cashierUsername: string,
  paymentMethod: PaymentMethod,
  branchId: string | null = null,
  shopId: string,
  customerName: string | null = null,
  customerPhone: string | null = null,
  tenderedAmount: number | null = null
): Promise<Invoice> {
  if (cart.length === 0) throw new Error('Cart හිස්ය');

  const totalAmount = cart.reduce((s, c) => s + c.total, 0);
  const totalProfit = cart.reduce((s, c) => s + c.profit, 0);
  const changeAmount = paymentMethod === 'cash' && tenderedAmount != null
    ? tenderedAmount - totalAmount
    : null;

  const { data: inv, error: invErr } = await supabase
    .from('invoices')
    .insert({
      total_amount:     totalAmount,
      total_profit:     totalProfit,
      cashier_id:       cashierId,
      cashier_username: cashierUsername,
      payment_method:   paymentMethod,
      branch_id:        branchId || null,
      shop_id:          shopId,
      customer_name:    customerName || null,
      customer_phone:   customerPhone || null,
      tendered_amount:  tenderedAmount,
      change_amount:    changeAmount,
    })
    .select()
    .maybeSingle();

  if (invErr || !inv) throw invErr ?? new Error('Invoice සෑදීම අසාර්ථකයි');

  const lineItems = cart.map(c => ({
    invoice_id:      inv.id,
    product_id:      c.product.id,
    product_name:    c.product.name,
    barcode:         c.product.barcode,
    unit:            c.product.unit,
    qty:             c.qty,
    free_qty:        c.freeQty,
    price_per_unit:  c.product.price,
    cost_per_unit:   c.product.cost,
    discount_type:   c.product.discount_type,
    discount_value:  c.product.discount_value,
    discount_amount: c.discountAmount,
    total:           c.total,
    profit:          c.profit,
  }));

  const { error: itemsErr } = await supabase.from('invoice_items').insert(lineItems);
  if (itemsErr) throw itemsErr;

  // Deduct stock: paid qty + free qty
  for (const c of cart) {
    const deduct = c.qty + c.freeQty;
    const { error: stockErr } = await supabase
      .from('products')
      .update({ qty: c.product.qty - deduct })
      .eq('id', c.product.id);
    if (stockErr) throw stockErr;
  }

  const { data: full, error: fetchErr } = await supabase
    .from('invoices')
    .select('*, items:invoice_items(*)')
    .eq('id', inv.id)
    .maybeSingle();

  if (fetchErr || !full) throw fetchErr ?? new Error('Invoice ලබාගැනීම අසාර්ථකයි');
  return full as Invoice;
}

/**
 * Replay a queued offline sale — used by useOfflineSync after reconnect.
 * Creates the invoice + items exactly as checkoutCart does, but from the
 * pre-computed OfflineSale snapshot (no need to re-fetch products).
 */
export async function checkoutOfflineSale(sale: OfflineSale): Promise<void> {
  const { data: inv, error: invErr } = await supabase
    .from('invoices')
    .insert({
      total_amount:     sale.total_amount,
      total_profit:     sale.items.reduce((s, i) => s + i.profit, 0),
      cashier_id:       sale.cashier_id,
      cashier_username: sale.cashier_username,
      payment_method:   sale.payment_method,
      branch_id:        sale.branch_id || null,
      shop_id:          sale.shop_id,
    })
    .select()
    .maybeSingle();

  if (invErr || !inv) throw invErr ?? new Error('Invoice සෑදීම අසාර්ථකයි');

  const lineItems = sale.items.map(i => ({
    invoice_id:      inv.id,
    product_id:      i.product_id,
    product_name:    i.product_name,
    barcode:         i.barcode,
    unit:            i.unit ?? 'pcs',
    qty:             i.qty,
    free_qty:        i.free_qty,
    price_per_unit:  i.unit_price,
    cost_per_unit:   i.cost,
    discount_type:   'none',
    discount_value:  0,
    discount_amount: i.discount_amount,
    total:           i.total,
    profit:          i.profit,
  }));

  const { error: itemsErr } = await supabase.from('invoice_items').insert(lineItems);
  if (itemsErr) throw itemsErr;

  // Deduct stock (best-effort — may already be deducted if partially synced)
  for (const item of sale.items) {
    const deduct = item.qty + item.free_qty;
    const { data: prod } = await supabase
      .from('products')
      .select('qty')
      .eq('id', item.product_id)
      .maybeSingle();
    if (prod && prod.qty >= deduct) {
      await supabase
        .from('products')
        .update({ qty: prod.qty - deduct })
        .eq('id', item.product_id);
    }
  }
}

/** අද දිනයේ invoices */
export async function getTodayInvoices(): Promise<Invoice[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from('invoices')
    .select('*, items:invoice_items(*)')
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: false });
  if (error) throw error;
  return Array.isArray(data) ? (data as Invoice[]) : [];
}

/** Daily report for a given date (YYYY-MM-DD) */
export async function getDailyReport(
  dateStr: string,
  branchId: string | null = null
): Promise<DailyReport> {
  const start = new Date(dateStr);
  start.setHours(0, 0, 0, 0);
  const end = new Date(dateStr);
  end.setHours(23, 59, 59, 999);

  let query = supabase
    .from('invoices')
    .select('total_amount, total_profit')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString());

  if (branchId) query = query.eq('branch_id', branchId);

  const { data, error } = await query;
  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  const total_sales = rows.reduce((s, r) => s + (Number(r.total_amount) || 0), 0);
  const total_profit = rows.reduce((s, r) => s + (Number(r.total_profit) || 0), 0);
  const total_cost = total_sales - total_profit;

  return {
    date: dateStr,
    total_sales,
    total_profit,
    total_cost,
    invoice_count: rows.length,
  };
}

/** Monthly report */
export async function getMonthlyReport(
  year: number,
  month: number,
  branchId: string | null = null
): Promise<MonthlyReport> {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  let query = supabase
    .from('invoices')
    .select('total_amount, total_profit')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString());

  if (branchId) query = query.eq('branch_id', branchId);

  const { data, error } = await query;
  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  const total_sales = rows.reduce((s, r) => s + (Number(r.total_amount) || 0), 0);
  const total_profit = rows.reduce((s, r) => s + (Number(r.total_profit) || 0), 0);
  const total_cost = total_sales - total_profit;

  return { year, month, total_sales, total_profit, total_cost, invoice_count: rows.length };
}

/** Top-selling products for a date */
export async function getTopProducts(
  dateStr: string,
  limit = 10
): Promise<TopProduct[]> {
  const start = new Date(dateStr);
  start.setHours(0, 0, 0, 0);
  const end = new Date(dateStr);
  end.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from('invoice_items')
    .select('product_name, qty, total, profit')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString());

  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  const map = new Map<string, TopProduct>();

  for (const r of rows) {
    const existing = map.get(r.product_name);
    if (existing) {
      existing.total_qty += r.qty;
      existing.total_revenue += Number(r.total);
      existing.total_profit += Number(r.profit);
    } else {
      map.set(r.product_name, {
        product_name: r.product_name,
        total_qty: r.qty,
        total_revenue: Number(r.total),
        total_profit: Number(r.profit),
      });
    }
  }

  return [...map.values()]
    .sort((a, b) => b.total_qty - a.total_qty)
    .slice(0, limit);
}
