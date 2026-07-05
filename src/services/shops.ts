import { supabase } from '@/db/supabase';
import type { Shop } from '@/types/index';

/** Get current user's shop */
export async function getMyShop(): Promise<Shop | null> {
  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Update shop profile */
export async function updateShop(
  shopId: string,
  updates: Partial<Pick<Shop, 'name' | 'logo_url' | 'phone' | 'email' | 'address' | 'quick_buttons'>>
): Promise<void> {
  const { error } = await supabase
    .from('shops')
    .update(updates)
    .eq('id', shopId);
  if (error) throw error;
}

/** Super Admin: list all shops */
export async function getAllShops(): Promise<Shop[]> {
  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

/** Super Admin: suspend or activate a shop */
export async function setShopStatus(shopId: string, status: 'active' | 'suspended'): Promise<void> {
  const { error } = await supabase
    .from('shops')
    .update({ status })
    .eq('id', shopId);
  if (error) throw error;
}

/** Super Admin: renew (re-activate) a shop's existing license key */
export async function renewShopLicense(shopId: string): Promise<void> {
  const { error } = await supabase
    .from('shops')
    .update({
      license_status:       'active',
      license_activated_at: new Date().toISOString(),
    })
    .eq('id', shopId);
  if (error) throw error;
}

/** Super Admin: revoke a shop's license (mark inactive, clear key) */
export async function revokeShopLicense(shopId: string): Promise<void> {
  const { error } = await supabase
    .from('shops')
    .update({
      license_status:       'inactive',
      license_key:          null,
      license_activated_at: null,
    })
    .eq('id', shopId);
  if (error) throw error;
}

/** Upload shop logo to storage and return public URL */
export async function uploadShopLogo(shopId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${shopId}/logo.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('shop-logos')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('shop-logos').getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Activate a license key for the given shop.
 * Delegates to the edge function so the SALT stays server-side.
 * Returns true on success, throws on failure.
 */
export async function activateLicense(shopId: string, key: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('license-validate', {
    body: { key: key.trim().toLowerCase(), shop_id: shopId },
  });
  if (error) {
    const msg = await error?.context?.text().catch(() => error?.message);
    throw new Error(msg || 'License activation දෝෂය');
  }
  if (data?.error) throw new Error(data.error);
}

/**
 * Generate a license key for a shop (super_admin only).
 * Returns the raw key string.
 */
export async function generateLicenseKey(shopId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('license-generate', {
    body: { shop_id: shopId },
  });
  if (error) {
    const msg = await error?.context?.text().catch(() => error?.message);
    throw new Error(msg || 'Key generate දෝෂය');
  }
  if (data?.error) throw new Error(data.error);
  return data.key as string;
}
