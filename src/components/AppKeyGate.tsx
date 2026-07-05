/**
 * AppKeyGate — silent auto-login.
 * No key or password required from the user.
 * Automatically signs in as super_admin on every app load.
 * Shows a brief spinner while authenticating, then renders the app.
 */
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { Loader2 } from 'lucide-react';

const ADMIN_EMAIL = 'superadmin@miaoda.com';
const ADMIN_PASS  = 'Tls14547';

interface AppKeyGateProps {
  children: React.ReactNode;
}

export function AppKeyGate({ children }: AppKeyGateProps) {
  const { user } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // If already authenticated (session restored), go straight in
    if (user) { setReady(true); return; }

    // Silent auto-login — no UI interaction required
    const autoLogin = async () => {
      try {
        await supabase.auth.signOut();           // clear any stale token
        await supabase.auth.signInWithPassword({ // sign in as super_admin
          email:    ADMIN_EMAIL,
          password: ADMIN_PASS,
        });
      } catch {
        // Even on failure, still render the app (offline / demo mode)
      } finally {
        setReady(true);
      }
    };

    autoLogin();
  }, [user]);

  // Brief spinner while auto-login is in progress
  if (!ready) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
          <span className="text-2xl font-bold text-primary-foreground">P</span>
        </div>
        <Loader2 className="w-6 h-6 animate-spin text-primary opacity-60" />
        <p className="text-sm text-muted-foreground">POShitha Pro ආරම්භ වෙමින්…</p>
      </div>
    );
  }

  return <>{children}</>;
}



