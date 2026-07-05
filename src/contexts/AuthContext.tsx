import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/db/supabase';
import type { User } from '@supabase/supabase-js';
import type { Profile, Shop } from '@/types/index';
import { toast } from 'sonner';

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Profile ලබාගැනීම අසාර්ථකයි:', error);
    return null;
  }
  return data;
}

export async function getShopById(shopId: string): Promise<Shop | null> {
  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .eq('id', shopId)
    .maybeSingle();
  if (error) return null;
  return data;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  shop: Shop | null;
  loading: boolean;
  signInWithUsername: (username: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithUsername: (username: string, password: string) => Promise<{ error: Error | null }>;
  /** Register a brand-new shop + owner account */
  registerShop: (shopName: string, username: string, password: string, email?: string) => Promise<{ error: Error | null }>;
  /** Add a cashier to the current shop */
  addCashier: (username: string, password: string, branchId?: string | null) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshShop: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfileAndShop = async (userId: string) => {
    const profileData = await getProfile(userId);
    setProfile(profileData);
    if (profileData?.shop_id) {
      const shopData = await getShopById(profileData.shop_id);
      setShop(shopData);
    } else {
      setShop(null);
    }
  };

  const refreshProfile = async () => {
    if (!user) { setProfile(null); setShop(null); return; }
    await loadProfileAndShop(user.id);
  };

  const refreshShop = async () => {
    if (!profile?.shop_id) return;
    const shopData = await getShopById(profile.shop_id);
    setShop(shopData);
  };

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        if (session?.user) loadProfileAndShop(session.user.id);
      })
      .catch((error: Error) => {
        toast.error(`Session දෝෂය: ${error.message}`);
      })
      .finally(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfileAndShop(session.user.id);
      } else {
        setProfile(null);
        setShop(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  /** Login with username (mapped to email) — checks shop suspension */
  const signInWithUsername = async (username: string, password: string) => {
    try {
      // Normalise: lowercase + strip spaces so "Super admin" → "superadmin@miaoda.com"
      const normalised = username.trim().toLowerCase().replace(/\s+/g, '');
      const email = `${normalised}@miaoda.com`;
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Check if shop is suspended (super_admin has no shop — skip)
      if (data.user) {
        const prof = await getProfile(data.user.id);
        if (prof?.shop_id) {
          const shopData = await getShopById(prof.shop_id);
          if (shopData?.status === 'suspended') {
            await supabase.auth.signOut();
            throw new Error('ඔබගේ කඩය තාවකාලිකව අක්‍රිය කර ඇත. කරුණාකර පරිපාලකයාට දන්වන්න.');
          }
        }
      }
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  /** Legacy: register a single user (cashier) with default shop */
  const signUpWithUsername = async (username: string, password: string) => {
    try {
      const email = `${username}@miaoda.com`;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } },
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  /** Register a brand-new shop + owner */
  const registerShop = async (shopName: string, username: string, password: string, email?: string) => {
    try {
      const authEmail = email || `${username}@miaoda.com`;
      // 1. Create auth user
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: authEmail,
        password,
        options: { data: { username } },
      });
      if (signUpErr) throw signUpErr;
      if (!data.user) throw new Error('ලියාපදිංචිය අසාර්ථකයි');

      // 2. Call the DB function to create shop + admin profile atomically
      const { error: rpcErr } = await supabase.rpc('register_shop_owner', {
        p_user_id:   data.user.id,
        p_username:  username,
        p_shop_name: shopName,
        p_email:     email || null,
      });
      if (rpcErr) throw rpcErr;

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  /** Add a cashier to the current logged-in shop */
  const addCashier = async (username: string, password: string, branchId?: string | null) => {
    try {
      if (!profile?.shop_id) throw new Error('Shop ID හමු නොවිණි');
      const email = `${username}@miaoda.com`;
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } },
      });
      if (signUpErr) throw signUpErr;
      if (!data.user) throw new Error('ලියාපදිංචිය අසාර්ථකයි');

      const { error: rpcErr } = await supabase.rpc('add_cashier_to_shop', {
        p_user_id:   data.user.id,
        p_username:  username,
        p_shop_id:   profile.shop_id,
        p_branch_id: branchId ?? null,
      });
      if (rpcErr) throw rpcErr;

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setShop(null);
  };

  return (
    <AuthContext.Provider value={{
      user, profile, shop, loading,
      signInWithUsername, signUpWithUsername,
      registerShop, addCashier,
      signOut, refreshProfile, refreshShop,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
