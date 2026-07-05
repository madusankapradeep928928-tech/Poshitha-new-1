import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { getBranches } from '@/services/branches';
import type { Branch } from '@/types/index';
import {
  ShoppingCart, Package, BarChart2, Settings, LogOut, Menu,
  Store, Users, Building2, Truck, ShieldCheck, User,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/billing',       icon: ShoppingCart, label: 'බිල්පත් / POS',     roles: ['admin', 'cashier', 'super_admin'] },
  { to: '/products',      icon: Package,      label: 'භාණ්ඩ',               roles: ['admin', 'cashier'] },
  { to: '/branches',      icon: Building2,    label: 'ශාඛා',                roles: ['admin'] },
  { to: '/suppliers',     icon: Truck,        label: 'සැපයුම්කරුවන්',       roles: ['admin'] },
  { to: '/reports',       icon: BarChart2,    label: 'වාර්තා',               roles: ['admin', 'cashier'] },
  { to: '/users',         icon: Users,        label: 'පරිශීලකයින්',          roles: ['admin'] },
  { to: '/shop-profile',  icon: Store,        label: 'කඩයේ Profile',         roles: ['admin'] },
  { to: '/super-admin',   icon: ShieldCheck,  label: 'Super Admin',          roles: ['super_admin'] },
  { to: '/settings',      icon: Settings,     label: 'සැකසුම්',             roles: ['admin'] },
];

function SidebarContent({ onNavClick, pendingCount }: { onNavClick?: () => void; pendingCount: number }) {
  const { profile, shop, signOut } = useAuth();
  const navigate = useNavigate();
  const [branchName, setBranchName] = useState<string | null>(null);

  // Load branch name for cashier if branch_id is assigned
  useEffect(() => {
    if (!profile?.branch_id) { setBranchName(null); return; }
    getBranches()
      .then(branches => {
        const b: Branch | undefined = branches.find((br: Branch) => br.id === profile.branch_id);
        setBranchName(b?.name ?? null);
      })
      .catch(() => setBranchName(null));
  }, [profile?.branch_id]);

  const handleSignOut = async () => {
    await signOut();
    toast.success('සාර්ථකව ඉවත් විය');
    navigate('/login');
  };

  const visibleItems = navItems.filter(
    item => item.roles.includes(profile?.role ?? 'cashier')
  );

  return (
    <div className="flex flex-col h-full bg-sidebar">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary overflow-hidden shrink-0">
          {shop?.logo_url ? (
            <img src={shop.logo_url} alt={shop.name} className="w-full h-full object-cover" />
          ) : (
            <Store className="w-5 h-5 text-primary-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-bold text-sidebar-foreground leading-tight truncate">
            {shop?.name ?? 'POShitha Pro'}
          </h1>
          <p className="text-xs text-sidebar-foreground/60">POS System v3</p>
        </div>
      </div>

      {/* User info */}
      <div className="px-4 py-3 mx-3 mt-3 rounded-lg bg-sidebar-accent">
        <p className="text-xs text-sidebar-foreground/60 flex items-center gap-1">
          <User className="w-3 h-3" /> ලොගින් වී ඇත්තේ
        </p>
        <p className="text-sm font-semibold text-sidebar-foreground truncate">{profile?.username ?? '—'}</p>
        <Badge
          className={cn(
            'mt-1 text-xs',
            profile?.role === 'super_admin'
              ? 'bg-amber-500 text-white hover:bg-amber-500'
              : profile?.role === 'admin'
                ? 'bg-primary text-primary-foreground'
                : 'bg-sidebar-foreground/20 text-sidebar-foreground'
          )}
        >
          {profile?.role === 'super_admin' ? 'Super Admin'
            : profile?.role === 'admin' ? 'Admin'
            : 'Cashier'}
        </Badge>
        {branchName && (
          <p className="text-xs text-sidebar-foreground/70 mt-1 flex items-center gap-1 truncate">
            <Building2 className="w-3 h-3 shrink-0" />
            <span className="truncate">{branchName}</span>
          </p>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        {visibleItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavClick}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="truncate flex-1">{label}</span>
            {to === '/billing' && pendingCount > 0 && (
              <Badge className="text-xs bg-amber-500 text-white hover:bg-amber-500 px-1.5 shrink-0">
                {pendingCount}
              </Badge>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Sign out */}
      <div className="p-3 border-t border-sidebar-border">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>ඉවත් වන්න</span>
        </Button>
      </div>
    </div>
  );
}

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pendingCount } = useOfflineSync();
  const { shop } = useAuth();

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-border">
        <SidebarContent pendingCount={pendingCount} />
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 overflow-x-hidden flex flex-col">
        {/* Global offline banner */}
        <OfflineBanner />

        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card sticky top-0 z-30">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 bg-sidebar">
              <SidebarContent onNavClick={() => setMobileOpen(false)} pendingCount={pendingCount} />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-6 h-6 rounded overflow-hidden shrink-0 bg-primary flex items-center justify-center">
              {shop?.logo_url ? (
                <img src={shop.logo_url} alt={shop.name} className="w-full h-full object-cover" />
              ) : (
                <Store className="w-3.5 h-3.5 text-primary-foreground" />
              )}
            </div>
            <h1 className="font-bold text-sm truncate">{shop?.name ?? 'POShitha Pro'}</h1>
          </div>
          {pendingCount > 0 && (
            <Badge className="text-xs bg-amber-500 text-white hover:bg-amber-500 shrink-0">
              {pendingCount}
            </Badge>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
