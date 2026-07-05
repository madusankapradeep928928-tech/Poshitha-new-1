import { supabase } from '@/db/supabase';
import type { Supplier } from '@/types/index';

export async function getSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function addSupplier(
  name: string,
  phone: string | null,
  email: string | null,
  shopId: string
): Promise<void> {
  const { error } = await supabase
    .from('suppliers')
    .insert({ name, phone: phone || null, email: email || null, shop_id: shopId });
  if (error) throw error;
}

export async function updateSupplier(
  id: string,
  updates: Partial<Pick<Supplier, 'name' | 'phone' | 'email'>>
): Promise<void> {
  const { error } = await supabase
    .from('suppliers')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteSupplier(id: string): Promise<void> {
  const { error } = await supabase
    .from('suppliers')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
