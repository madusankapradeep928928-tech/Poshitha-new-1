import { supabase } from '@/db/supabase';
import type { Branch } from '@/types/index';

export async function getBranches(): Promise<Branch[]> {
  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function addBranch(name: string, address: string | null, shopId: string): Promise<void> {
  const { error } = await supabase
    .from('branches')
    .insert({ name, address: address || null, shop_id: shopId });
  if (error) throw error;
}

export async function updateBranch(
  id: string,
  updates: Partial<Pick<Branch, 'name' | 'address'>>
): Promise<void> {
  const { error } = await supabase
    .from('branches')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteBranch(id: string): Promise<void> {
  const { error } = await supabase
    .from('branches')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
