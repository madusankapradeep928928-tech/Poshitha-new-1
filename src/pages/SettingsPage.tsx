import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import { getProducts, } from '@/services/products';
import { updateShop, generateLicenseKey } from '@/services/shops';
import type { Product } from '@/types/index';
import {
  Settings, Database, Download, Shield, Info, Store,
  Zap, X, Search, KeyRound, Copy, RefreshCw, CheckCircle2, Loader2,
} from 'lucide-react';
import { maskLicenseKey, licenseStatusLabel, licenseStatusClass } from '@/lib/licenseUtils';

export default function SettingsPage() {
  const { profile, shop, refreshShop } = useAuth();
  const isAdmin      = profile?.role === 'admin' || profile?.role === 'super_admin';
  const isSuperAdmin = profile?.role === 'super_admin';

  // Quick Buttons state
  const [products, setProducts]         = useState<Product[]>([]);
  const [qbSearch, setQbSearch]         = useState('');
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());
  const [savingQb, setSavingQb]         = useState(false);

  // License management state (super_admin)
  const [licenseTarget, setLicenseTarget] = useState('');   // shop_id to generate key for
  const [generatedKey, setGeneratedKey]   = useState('');
  const [genLoading, setGenLoading]       = useState(false);
  const [copied, setCopied]               = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    getProducts().then(setProducts).catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    if (shop?.quick_buttons) setSelectedIds(new Set(shop.quick_buttons));
  }, [shop]);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(qbSearch.toLowerCase()) ||
    p.barcode.includes(qbSearch)
  );

  const toggleQb = (id: string) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const saveQuickButtons = async () => {
    if (!shop) return;
    setSavingQb(true);
    try {
      await updateShop(shop.id, { quick_buttons: [...selectedIds] });
      toast.success('Quick buttons සුරකිණ');
    } catch { toast.error('Save දෝෂය'); }
    finally { setSavingQb(false); }
  };

  const handleGenerateKey = async () => {
    const targetId = licenseTarget.trim() || shop?.id;
    if (!targetId) { toast.error('Shop ID ඇතුළු කරන්න'); return; }
    setGenLoading(true);
    setGeneratedKey('');
    try {
      const k = await generateLicenseKey(targetId);
      setGeneratedKey(k);
      toast.success('License key සාර්ථකව generate විය');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generate දෝෂය');
    } finally {
      setGenLoading(false);
    }
  };

  const handleCopyKey = async () => {
    if (!generatedKey) return;
    await navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    toast.success('Key clipboard එකට copy විය');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBackup = async () => {
    try {
      const [{ data: prods }, { data: invoices }] = await Promise.all([
        supabase.from('products').select('*').order('name'),
        supabase.from('invoices').select('*, items:invoice_items(*)').order('created_at', { ascending: false }),
      ]);
      const backup = {
        exported_at: new Date().toISOString(),
        version: '2.0',
        products: prods ?? [],
        invoices: invoices ?? [],
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `poshitha_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Backup සාර්ථකව download විය');
    } catch { toast.error('Backup download අසාර්ථකයි'); }
  };

  return (
    <AppLayout>
      <div className="space-y-4 max-w-2xl">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold text-balance">සැකසුම්</h2>
        </div>

        {/* System info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="w-4 h-4" />
              පද්ධති තොරතුරු
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">සිස්ටම් නාමය</p>
                <p className="font-semibold">POShitha Pro</p>
              </div>
              <div>
                <p className="text-muted-foreground">අනුවාදය</p>
                <p className="font-semibold">v2.1.0</p>
              </div>
              <div>
                <p className="text-muted-foreground">ලොගින් වී ඇත</p>
                <p className="font-semibold">{profile?.username ?? '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Role</p>
                <Badge className={isAdmin ? 'bg-primary text-primary-foreground' : ''}>
                  {profile?.role === 'admin' ? 'Admin' : profile?.role === 'super_admin' ? 'Super Admin' : 'Cashier'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Product Buttons (Admin only) */}
        {isAdmin && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4" />
                ශීඝ්‍ර භාණ්ඩ Buttons
              </CardTitle>
              <CardDescription>
                Billing POS screen එකේ ශීඝ්‍ර access සඳහා භාණ්ඩ තෝරාගන්න
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Selected chips */}
              {selectedIds.size > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {[...selectedIds].map(id => {
                    const p = products.find(x => x.id === id);
                    return p ? (
                      <Badge key={id} variant="secondary" className="gap-1 pr-1">
                        {p.name}
                        <button onClick={() => toggleQb(id)} className="ml-0.5 hover:text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}

              {/* Product search */}
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <Input
                  placeholder="භාණ්ඩ සොවන්න..."
                  value={qbSearch}
                  onChange={e => setQbSearch(e.target.value)}
                  className="px-2 h-8 text-sm"
                />
              </div>

              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {filteredProducts.slice(0, 20).map(p => (
                  <label key={p.id}
                    className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-muted/30 cursor-pointer min-h-10"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={() => toggleQb(p.id)}
                      className="accent-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.barcode} · Rs. {p.price.toFixed(2)}</p>
                    </div>
                  </label>
                ))}
                {filteredProducts.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2 text-center">භාණ්ඩ හමු නොවිය</p>
                )}
              </div>

              <Button onClick={saveQuickButtons} disabled={savingQb} size="sm" className="gap-2">
                {savingQb ? 'Saving...' : 'Save'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* License Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary" />
              License
            </CardTitle>
            <CardDescription>
              Software license status සහ activation තොරතුරු
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current status row */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-1">Status</p>
                <Badge className={licenseStatusClass(shop?.license_status ?? 'inactive')}>
                  {licenseStatusLabel(shop?.license_status ?? 'inactive')}
                </Badge>
              </div>
              {shop?.license_key && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">License Key</p>
                  <p className="font-mono text-xs tracking-wider truncate">
                    {maskLicenseKey(shop.license_key)}
                  </p>
                </div>
              )}
              {shop?.license_activated_at && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Activated</p>
                  <p className="text-sm font-medium">
                    {new Date(shop.license_activated_at).toLocaleDateString('si-LK')}
                  </p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground text-xs mb-1">Shop ID</p>
                <p className="font-mono text-xs break-all text-muted-foreground">
                  {shop?.id ?? '—'}
                </p>
              </div>
            </div>

            {/* Refresh button for admins */}
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={refreshShop}
                className="gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Status Refresh
              </Button>
            )}

            {/* Super Admin: generate license key for any shop */}
            {isSuperAdmin && (
              <>
                <Separator />
                <div className="space-y-3">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-primary" />
                    License Key Generate (Super Admin)
                  </p>
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">
                      Shop ID (හිස් නම් ඔබේ shop ID භාවිත වේ)
                    </p>
                    <Input
                      placeholder={shop?.id ?? 'Shop UUID'}
                      value={licenseTarget}
                      onChange={e => setLicenseTarget(e.target.value)}
                      className="px-3 font-mono text-xs h-8"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={handleGenerateKey}
                    disabled={genLoading}
                    className="gap-2"
                  >
                    {genLoading
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Generating…</>
                      : <><KeyRound className="w-3.5 h-3.5" />Key Generate කරන්න</>
                    }
                  </Button>

                  {/* Generated key display */}
                  {generatedKey && (
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                      <p className="text-xs text-muted-foreground">Generated Key:</p>
                      <p className="font-mono text-sm font-bold tracking-widest text-foreground break-all">
                        {generatedKey}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCopyKey}
                        className="gap-2 h-7 text-xs"
                      >
                        {copied
                          ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-600" />Copied!</>
                          : <><Copy className="w-3.5 h-3.5" />Copy Key</>
                        }
                      </Button>
                      <p className="text-xs text-muted-foreground text-pretty">
                        ⚠️ මෙම key ගනුදෙනුකරු වෙත ලබා දෙන්න. System restart කළ විට key නැවත generate කළ හැක.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Backup */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="w-4 h-4" />
              දත්ත Backup
            </CardTitle>
            <CardDescription>
              සියලු භාණ්ඩ සහ Invoice දත්ත JSON ගොනුවක් ලෙස download කරන්න
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground text-pretty">
                  Products සහ Invoices දත්ත JSON format backup. නිතිපතා backup ගැනීම නිර්දේශ කෙරේ.
                </p>
              </div>
              <Button onClick={handleBackup} variant="outline" className="shrink-0 gap-2">
                <Download className="w-4 h-4" />
                Backup
              </Button>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Legal */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4" />
              නෛතික
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div>
              <p className="font-medium text-foreground mb-1">පරිශීලක ගිවිසුම</p>
              <p className="text-pretty">
                POShitha Pro භාවිතය ව්‍යාපාරික හා නෛතික කටයුතු සඳහා රක්ෂිතයි.
                මෙම මෘදුකාංගය ශ්‍රී ලංකා නීතිය යටතේ ක්‍රියාත්මක වේ.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">රහස්‍යතා ප්‍රතිපත්තිය</p>
              <p className="text-pretty">
                ඔබේ දත්ත Supabase cloud platform හි ආරක්ෂිතව ගබඩා වේ.
                අපි ඔබේ දත්ත තෙවන පාර්ශ්ව සමඟ බෙදා නොගනිමු.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
