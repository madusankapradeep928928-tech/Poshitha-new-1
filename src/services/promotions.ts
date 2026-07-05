import { supabase } from '@/db/supabase';
import type { Promotion } from '@/types/index';

/** Get all active promotions */
export async function getPromotions(): Promise<Promotion[]> {
  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

/** Get active promotion for a specific product barcode (for cart logic) */
export async function getActivePromotionByBarcode(barcode: string): Promise<Promotion | null> {
  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .eq('barcode', barcode)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Upsert a promotion for a product — replaces any existing one */
export async function upsertPromotion(
  productId: string,
  barcode: string,
  buyQty: number,
  freeQty: number,
  shopId: string
): Promise<void> {
  // Deactivate previous promotions for this product first
  await supabase
    .from('promotions')
    .update({ active: false })
    .eq('product_id', productId);

  const { error } = await supabase
    .from('promotions')
    .insert({ product_id: productId, barcode, buy_qty: buyQty, free_qty: freeQty, active: true, shop_id: shopId });
  if (error) throw error;
}

/** Deactivate all promotions for a product */
export async function deactivatePromotion(productId: string): Promise<void> {
  const { error } = await supabase
    .from('promotions')
    .update({ active: false })
    .eq('product_id', productId);
  if (error) throw error;
}

/** Delete a promotion by its id */
export async function deletePromotion(id: string): Promise<void> {
  const { error } = await supabase
    .from('promotions')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
