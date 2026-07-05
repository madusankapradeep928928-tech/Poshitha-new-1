import { supabase } from '@/db/supabase';
import type { CartItem, HeldBill } from '@/types/index';

/** Save current cart as a held bill */
export async function holdBill(
  shopId: string,
  cashierId: string,
  cart: CartItem[],
  customerName: string | null,
  customerPhone: string | null,
  label?: string
): Promise<HeldBill> {
  const { data, error } = await supabase
    .from('held_bills')
    .insert({
      shop_id:        shopId,
      cashier_id:     cashierId,
      label:          label || null,
      cart_json:      cart,
      customer_name:  customerName || null,
      customer_phone: customerPhone || null,
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Hold bill save කිරීම අසාර්ථකයි');
  return data as HeldBill;
}

/** List all held bills for this shop */
export async function getHeldBills(shopId: string): Promise<HeldBill[]> {
  const { data, error } = await supabase
    .from('held_bills')
    .select('*')
    .eq('shop_id', shopId)
    .order('held_at', { ascending: false });
  if (error) throw error;
  return Array.isArray(data) ? (data as HeldBill[]) : [];
}

/** Delete a held bill after resuming */
export async function deleteHeldBill(id: string): Promise<void> {
  const { error } = await supabase
    .from('held_bills')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
