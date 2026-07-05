import { useAuth } from '@/contexts/AuthContext';

interface RouteGuardProps {
  children: React.ReactNode;
}

/**
 * RouteGuard — no login required.
 * Auth redirect removed; AppKeyGate handles silent auto-login.
 * Shows a spinner only while the AuthContext is initialising.
 */
export function RouteGuard({ children }: RouteGuardProps) {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return <>{children}</>;
}