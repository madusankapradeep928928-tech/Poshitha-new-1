import { supabase } from '@/db/supabase';
import type { Product, DiscountType } from '@/types/index';

export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

/** Branch-aware product load for POS:
 *  - If branchId supplied → products with matching branch OR branch_id IS NULL
 *  - Otherwise returns all products for the shop
 */
export async function getProductsForPOS(shopId: string, branchId?: string | null): Promise<Product[]> {
  let q = supabase.from('products').select('*').eq('shop_id', shopId);
  if (branchId) {
    q = q.or(`branch_id.is.null,branch_id.eq.${branchId}`);
  }
  const { data, error } = await q.order('name', { ascending: true });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function getProductByBarcode(barcode: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('barcode', barcode)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function addProduct(
  barcode: string,
  name: string,
  unit: string,
  cost: number,
  price: number,
  qty: number,
  expiry: string,
  branchId: string | null,
  supplierId: string | null,
  shopId: string
): Promise<void> {
  const { error } = await supabase
    .from('products')
    .insert({
      barcode,
      name,
      unit,
      cost,
      price,
      qty,
      expiry: expiry || '',
      discount_type: 'none',
      discount_value: 0,
      branch_id: branchId || null,
      supplier_id: supplierId || null,
      shop_id: shopId,
    });
  if (error) throw error;
}

export async function updateProduct(
  id: string,
  updates: Partial<Pick<
    Product,
    'name' | 'unit' | 'cost' | 'price' | 'qty' | 'expiry'
    | 'branch_id' | 'supplier_id' | 'discount_type' | 'discount_value'
  >>
): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

export async function setProductDiscount(
  id: string,
  discountType: DiscountType,
  discountValue: number
): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ discount_type: discountType, discount_value: discountValue })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

/** Fetch only barcodes for duplicate check — if no shopId, fetch all */
export async function getExistingBarcodes(shopId?: string): Promise<Set<string>> {
  let query = supabase.from('products').select('barcode');
  if (shopId) query = query.eq('shop_id', shopId);
  const { data, error } = await query;
  if (error) throw error;
  return new Set((data ?? []).map((r: { barcode: string }) => r.barcode));
}

export interface BulkProductRow {
  barcode: string;
  name: string;
  unit: string;
  cost: number;
  price: number;
  qty: number;
  expiry: string;
  shop_id: string;
}

/** Insert multiple products in a single round-trip */
export async function bulkInsertProducts(rows: BulkProductRow[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from('products').insert(
    rows.map(r => ({
      barcode:        r.barcode,
      name:           r.name,
      unit:           r.unit,
      cost:           r.cost,
      price:          r.price,
      qty:            r.qty,
      expiry:         r.expiry || '',
      discount_type:  'none',
      discount_value: 0,
      branch_id:      null,
      supplier_id:    null,
      shop_id:        r.shop_id,
    }))
  );
  if (error) throw error;
}

export async function getLowStockProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .lt('qty', 10)
    .order('qty', { ascending: true });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}
