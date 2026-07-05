import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import {
  getAllShops, setShopStatus,
  generateLicenseKey, activateLicense,
  renewShopLicense, revokeShopLicense,
} from '@/services/shops';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import type { Shop } from '@/types/index';
import { maskLicenseKey, licenseStatusLabel, licenseStatusClass } from '@/lib/licenseUtils';
import {
  ShieldCheck, Search, RefreshCw, Store,
  Crown, Sparkles, CheckCircle2, Ban, KeyRound,
  Copy, RotateCcw, Trash2, Loader2,
  ShieldOff, ShieldAlert, Activity, LayoutDashboard,
} from 'lucide-react';

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, icon: Icon }: {
  label: string; value: number; color: string;
  icon: React.ElementType;
}) {
  return (
    <Card className="h-full">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`rounded-lg p-2 bg-muted ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-2xl font-bold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-1 text-pretty">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SuperAdminPage() {
  const [shops,    setShops]   = useState<Shop[]>([]);
  const [loading,  setLoading] = useState(true);
  const [search,   setSearch]  = useState('');

  // Confirm dialog state
  const [confirmState, setConfirmState] = useState<{
    type: 'suspend' | 'activate' | 'revoke' | 'renew';
    shop: Shop;
  } | null>(null);
  const [acting, setActing] = useState(false);

  // Key generator dialog
  const [keyDialog, setKeyDialog] = useState<{ shop: Shop } | null>(null);
  const [generatedKey, setGeneratedKey] = useState('');
  const [genLoading,   setGenLoading]   = useState(false);
  const [activating,   setActivating]   = useState(false);
  const [keyCopied,    setKeyCopied]    = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setShops(await getAllShops());
    } catch {
      toast.error('Shops ලැයිස්තුව ලබාගැනීම අසාර්ථකයි');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = search
    ? shops.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (s.license_key ?? '').includes(search.toLowerCase())
      )
    : shops;

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalShops       = shops.length;
  const activeLicenses   = shops.filter(s => s.license_status === 'active').length;
  const inactiveLicenses = shops.filter(s => s.license_status === 'inactive').length;
  const suspendedShops   = shops.filter(s => s.status === 'suspended').length;

  // ── Confirm actions ────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!confirmState) return;
    setActing(true);
    const { type, shop } = confirmState;
    try {
      if (type === 'suspend')  await setShopStatus(shop.id, 'suspended');
      if (type === 'activate') await setShopStatus(shop.id, 'active');
      if (type === 'revoke')   await revokeShopLicense(shop.id);
      if (type === 'renew')    await renewShopLicense(shop.id);
      toast.success(confirmLabels[type].success(shop.name));
      await load();
    } catch {
      toast.error('ක්‍රියාව අසාර්ථකයි');
    } finally {
      setActing(false);
      setConfirmState(null);
    }
  };

  const confirmLabels: Record<string, {
    title: string;
    desc: (name: string) => string;
    btn: string;
    danger?: boolean;
    success: (name: string) => string;
  }> = {
    suspend:  { title: 'කඩය අක්‍රිය කිරීම',     desc: n => `"${n}" අක්‍රිය කළ විට login කළ නොහැකිය.`,          btn: 'අක්‍රිය කරන්න', danger: true,  success: n => `"${n}" අක්‍රිය කෙරිණි` },
    activate: { title: 'කඩය සක්‍රිය කිරීම',     desc: n => `"${n}" නැවත සක්‍රිය කිරීමෙන් login කළ හැකිවේ.`,   btn: 'සක්‍රිය කරන්න', danger: false, success: n => `"${n}" සක්‍රිය කෙරිණි` },
    revoke:   { title: 'License අවලංගු කිරීම',  desc: n => `"${n}" හි license key ඉවත් කෙරේ. Re-activate කළ යුතු වේ.`, btn: 'Revoke කරන්න', danger: true, success: n => `"${n}" license revoke කෙරිණි` },
    renew:    { title: 'License Renew කිරීම',   desc: n => `"${n}" හි license නැවත active කෙරේ.`,              btn: 'Renew කරන්න', danger: false, success: n => `"${n}" license renewed` },
  };

  // ── Key generator ─────────────────────────────────────────────────────────
  const openKeyDialog = (shop: Shop) => {
    setKeyDialog({ shop });
    setGeneratedKey('');
    setKeyCopied(false);
  };

  const handleGenerate = async () => {
    if (!keyDialog) return;
    setGenLoading(true);
    setGeneratedKey('');
    try {
      const k = await generateLicenseKey(keyDialog.shop.id);
      setGeneratedKey(k);
      toast.success('Key සාර්ථකව generate විය');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generate දෝෂය');
    } finally {
      setGenLoading(false);
    }
  };

  const handleActivateNow = async () => {
    if (!keyDialog || !generatedKey) return;
    setActivating(true);
    try {
      await activateLicense(keyDialog.shop.id, generatedKey);
      toast.success(`"${keyDialog.shop.name}" license activate කෙරිණි`);
      setKeyDialog(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Activation දෝෂය');
    } finally {
      setActivating(false);
    }
  };

  const handleCopyKey = async () => {
    if (!generatedKey) return;
    await navigator.clipboard.writeText(generatedKey);
    setKeyCopied(true);
    toast.success('Key clipboard එකට copy විය');
    setTimeout(() => setKeyCopied(false), 2000);
  };

  return (
    <AppLayout>
      <div className="space-y-5">

        {/* ── Page Header ──────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" />
              <h1 className="text-xl md:text-2xl font-bold text-balance">Super Admin Control</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              සියලු කඩ, license keys සහ system access කළමනාකරණය
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2 h-9 shrink-0">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="sr-only md:not-sr-only">යාවත්කාලීන</span>
          </Button>
        </div>

        {/* ── Stats ────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[72px] bg-muted rounded-xl" />)
          ) : (
            <>
              <StatCard label="මුළු කඩ"            value={totalShops}       color="text-primary"      icon={LayoutDashboard} />
              <StatCard label="License සක්‍රිය"     value={activeLicenses}   color="text-green-600"    icon={ShieldCheck} />
              <StatCard label="License නොමැත"      value={inactiveLicenses} color="text-amber-600"    icon={ShieldAlert} />
              <StatCard label="Suspended"           value={suspendedShops}   color="text-destructive"  icon={ShieldOff} />
            </>
          )}
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <Tabs defaultValue="licenses">
          <TabsList className="h-9">
            <TabsTrigger value="licenses" className="gap-1.5 text-xs">
              <KeyRound className="w-3.5 h-3.5" />License Control
            </TabsTrigger>
            <TabsTrigger value="shops" className="gap-1.5 text-xs">
              <Store className="w-3.5 h-3.5" />Shops
            </TabsTrigger>
          </TabsList>

          {/* ── License Control Tab ──────────────────────────────────────── */}
          <TabsContent value="licenses" className="mt-4 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="කඩය, email හෝ key සෙවීම…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 px-9"
              />
            </div>

            {/* License table */}
            <Card>
              <div className="overflow-x-auto w-full max-w-full">
                <table className="w-full min-w-max text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">කඩය</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">License</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap hidden md:table-cell">Key</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap hidden lg:table-cell">Activated</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="px-4 py-3" colSpan={5}><Skeleton className="h-5 w-full bg-muted" /></td>
                        </tr>
                      ))
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                          <Store className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">{search ? 'ගැළපෙන ප්‍රතිඵල නොමැත' : 'ලියාපදිංචි කඩ නොමැත'}</p>
                        </td>
                      </tr>
                    ) : filtered.map(shop => (
                      <LicenseRow
                        key={shop.id}
                        shop={shop}
                        onGenKey={() => openKeyDialog(shop)}
                        onRevoke={() => setConfirmState({ type: 'revoke', shop })}
                        onRenew={() => setConfirmState({ type: 'renew', shop })}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* ── Shops Tab ────────────────────────────────────────────────── */}
          <TabsContent value="shops" className="mt-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="කඩය, email සෙවීම…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 px-9"
              />
            </div>

            <div className="space-y-2">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full bg-muted" />)
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Store className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">{search ? 'ගැළපෙන ප්‍රතිඵල නොමැත' : 'ලියාපදිංචි කඩ නොමැත'}</p>
                </div>
              ) : filtered.map(shop => (
                <ShopRow
                  key={shop.id}
                  shop={shop}
                  onSuspend={() => setConfirmState({ type: 'suspend', shop })}
                  onActivate={() => setConfirmState({ type: 'activate', shop })}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Key Generator Dialog ───────────────────────────────────────────── */}
      <Dialog open={!!keyDialog} onOpenChange={open => { if (!open && !genLoading && !activating) setKeyDialog(null); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary" />
              License Key — {keyDialog?.shop.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Shop info */}
            <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm space-y-1">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground text-xs">Shop ID</span>
                <span className="font-mono text-xs truncate">{keyDialog?.shop.id.slice(0, 18)}…</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground text-xs">දැනට License</span>
                <Badge className={`text-xs ${licenseStatusClass(keyDialog?.shop.license_status ?? 'inactive')}`}>
                  {licenseStatusLabel(keyDialog?.shop.license_status ?? 'inactive')}
                </Badge>
              </div>
            </div>

            {/* Generate button */}
            <Button onClick={handleGenerate} disabled={genLoading} className="w-full gap-2">
              {genLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" />Generating…</>
                : <><KeyRound className="w-4 h-4" />නව Key Generate කරන්න</>
              }
            </Button>

            {/* Generated key display */}
            {generatedKey && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                <p className="text-xs text-muted-foreground">Generated Key:</p>
                <p className="font-mono text-base font-bold tracking-widest text-foreground text-center py-1 break-all">
                  {generatedKey}
                </p>
                <Separator />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopyKey} className="flex-1 gap-1.5">
                    {keyCopied
                      ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-600" />Copied</>
                      : <><Copy className="w-3.5 h-3.5" />Copy Key</>
                    }
                  </Button>
                  <Button size="sm" onClick={handleActivateNow} disabled={activating} className="flex-1 gap-1.5">
                    {activating
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Activating…</>
                      : <><Activity className="w-3.5 h-3.5" />දැන්ම Activate</>
                    }
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-pretty">
                  "Copy Key" — ගනුදෙනුකරු වෙත key ලබා දී ඔවුන් activate කිරීමට හැර.
                  "දැන්ම Activate" — super admin ලෙස වහාම activate.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setKeyDialog(null)} disabled={genLoading || activating}>
              වසන්න
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm Dialog ─────────────────────────────────────────────────── */}
      <AlertDialog open={!!confirmState} onOpenChange={open => { if (!open) setConfirmState(null); }}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmState ? confirmLabels[confirmState.type].title : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmState ? confirmLabels[confirmState.type].desc(confirmState.shop.name) : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={acting}>අවලංගු</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={acting}
              className={confirmState && confirmLabels[confirmState.type].danger
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : ''}
            >
              {acting
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5 inline" />සිදු කරමින්…</>
                : (confirmState ? confirmLabels[confirmState.type].btn : '')
              }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

// ─── License row ──────────────────────────────────────────────────────────────
function LicenseRow({ shop, onGenKey, onRevoke, onRenew }: {
  shop: Shop;
  onGenKey: () => void;
  onRevoke: () => void;
  onRenew:  () => void;
}) {
  return (
    <tr className="border-b border-border/50 hover:bg-muted/20 transition-colors">
      {/* Shop name */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden">
            {shop.logo_url
              ? <img src={shop.logo_url} alt={shop.name} className="w-full h-full object-cover" />
              : <Store className="w-3.5 h-3.5 text-muted-foreground" />
            }
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate max-w-[120px]">{shop.name}</p>
            <p className="text-xs text-muted-foreground truncate max-w-[120px]">{shop.email || '—'}</p>
          </div>
        </div>
      </td>

      {/* License status */}
      <td className="px-4 py-3 whitespace-nowrap">
        <Badge className={`text-xs ${licenseStatusClass(shop.license_status)}`}>
          {licenseStatusLabel(shop.license_status)}
        </Badge>
      </td>

      {/* Key (masked) */}
      <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell">
        {shop.license_key
          ? <span className="font-mono text-xs text-muted-foreground">{maskLicenseKey(shop.license_key)}</span>
          : <span className="text-xs text-muted-foreground/50 italic">—</span>
        }
      </td>

      {/* Activated date */}
      <td className="px-4 py-3 whitespace-nowrap hidden lg:table-cell text-xs text-muted-foreground">
        {shop.license_activated_at
          ? new Date(shop.license_activated_at).toLocaleDateString('si-LK')
          : '—'
        }
      </td>

      {/* Actions */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm" variant="outline"
            onClick={onGenKey}
            className="h-7 text-xs gap-1 px-2"
            title="Key Generate"
          >
            <KeyRound className="w-3 h-3" />
            <span className="sr-only lg:not-sr-only">Key</span>
          </Button>
          {shop.license_status === 'active' ? (
            <Button
              size="sm" variant="outline"
              onClick={onRevoke}
              className="h-7 text-xs gap-1 px-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/40"
              title="License Revoke"
            >
              <Trash2 className="w-3 h-3" />
              <span className="sr-only lg:not-sr-only">Revoke</span>
            </Button>
          ) : (
            <Button
              size="sm" variant="outline"
              onClick={onRenew}
              disabled={!shop.license_key}
              className="h-7 text-xs gap-1 px-2 text-green-600 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 border-green-600/40 disabled:opacity-40"
              title="License Renew"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="sr-only lg:not-sr-only">Renew</span>
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Shop row (Shops tab) ─────────────────────────────────────────────────────
function ShopRow({ shop, onSuspend, onActivate }: {
  shop: Shop; onSuspend: () => void; onActivate: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/40 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
        {shop.logo_url
          ? <img src={shop.logo_url} alt={shop.name} className="w-full h-full object-cover" />
          : <Store className="w-5 h-5 text-muted-foreground" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate">{shop.name}</p>
          {shop.plan === 'pro'
            ? <Badge className="text-xs gap-1 bg-amber-500 text-white hover:bg-amber-500 shrink-0"><Crown className="w-2.5 h-2.5" />Pro</Badge>
            : <Badge variant="secondary" className="text-xs gap-1 shrink-0"><Sparkles className="w-2.5 h-2.5" />Free</Badge>
          }
          <Badge className={`text-xs shrink-0 ${licenseStatusClass(shop.license_status)}`}>
            {licenseStatusLabel(shop.license_status)}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {shop.email || '—'} · {new Date(shop.created_at).toLocaleDateString('si-LK')}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant={shop.status === 'active' ? 'default' : 'destructive'}
          className={`text-xs hidden sm:flex ${shop.status === 'active' ? 'bg-green-600 hover:bg-green-600 text-white' : ''}`}>
          {shop.status === 'active' ? 'සක්‍රිය' : 'අක්‍රිය'}
        </Badge>
        {shop.status === 'active' ? (
          <Button size="sm" variant="outline" onClick={onSuspend}
            className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/40">
            <Ban className="w-3.5 h-3.5" />
            <span className="sr-only sm:not-sr-only">අක්‍රිය</span>
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={onActivate}
            className="h-8 text-xs gap-1.5 text-green-600 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 border-green-600/40">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="sr-only sm:not-sr-only">සක්‍රිය</span>
          </Button>
        )}
      </div>
    </div>
  );
}
