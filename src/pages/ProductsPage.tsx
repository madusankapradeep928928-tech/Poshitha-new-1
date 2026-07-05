import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { getProducts, addProduct, updateProduct, deleteProduct, setProductDiscount } from '@/services/products';
import { getBranches } from '@/services/branches';
import { getSuppliers } from '@/services/suppliers';
import { getPromotions, upsertPromotion, deactivatePromotion } from '@/services/promotions';
import { useAuth } from '@/contexts/AuthContext';
import type { Product, Branch, Supplier, Promotion, DiscountType } from '@/types/index';
import { SmartImportDialog } from '@/components/products/SmartImportDialog';
import {
  Package, Plus, RefreshCw, Pencil, Trash2, Download,
  AlertTriangle, Tag, Gift, X, Check, Clock,
  Upload,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { isFloatUnit, inputStep, fmtQty } from '@/lib/unitUtils';

// ─── Constants ───────────────────────────────────────────────────────────────
const UNITS = [
  { value: 'pcs',    label: 'pcs — කෑල' },
  { value: 'kg',     label: 'kg — කිලෝ' },
  { value: 'g',      label: 'g — ග්‍රෑම්' },
  { value: 'l',      label: 'l — ලීටර්' },
  { value: 'ml',     label: 'ml — මිලි' },
  { value: 'm',      label: 'm — මීටර්' },
  { value: 'pack',   label: 'pack — පැකට්' },
  { value: 'box',    label: 'box — පෙට්ටිය' },
  { value: 'dozen',  label: 'dozen — ඩජනය' },
  { value: 'bottle', label: 'bottle — බෝතලය' },
  { value: 'bag',    label: 'bag — බෑගය' },
];

const EMPTY_FORM = {
  barcode: '', name: '', unit: 'pcs', cost: '', price: '', qty: '',
  expiry: '', branch_id: 'none', supplier_id: 'none',
};

// ─── Expiry helpers ───────────────────────────────────────────────────────────
function getExpiryStatus(expiry: string): 'expired' | 'soon' | 'ok' | 'none' {
  if (!expiry) return 'none';
  const exp = new Date(expiry);
  const today = new Date();
  const diff = (exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0)   return 'expired';
  if (diff <= 30) return 'soon';
  return 'ok';
}

function ExpiryBadge({ expiry }: { expiry: string }) {
  const status = getExpiryStatus(expiry);
  if (status === 'none') return <span className="text-xs text-muted-foreground">—</span>;
  const formatted = new Date(expiry).toLocaleDateString('si-LK');
  if (status === 'expired') return (
    <Badge variant="destructive" className="text-xs gap-1">
      <Clock className="w-2.5 h-2.5" />
      කල් ඉකුත්
    </Badge>
  );
  if (status === 'soon') return (
    <Badge className="text-xs bg-amber-500 text-white hover:bg-amber-500 gap-1">
      <Clock className="w-2.5 h-2.5" />
      {formatted}
    </Badge>
  );
  return <span className="text-xs text-muted-foreground">{formatted}</span>;
}

// ─── Offer Panel ─────────────────────────────────────────────────────────────
function OfferPanel({
  product,
  promotion,
  onSaved,
  shopId,
}: {
  product: Product;
  promotion: Promotion | undefined;
  onSaved: () => void;
  shopId: string;
}) {
  const [offerType, setOfferType] = useState<'none' | 'discount' | 'promo'>('none');
  const [discountVal, setDiscountVal] = useState(String(product.discount_value || ''));
  const [buyQty, setBuyQty]   = useState(String(promotion?.buy_qty  ?? ''));
  const [freeQty, setFreeQty] = useState(String(promotion?.free_qty ?? ''));
  const [saving, setSaving]   = useState(false);

  const handleSaveDiscount = async () => {
    const val = parseFloat(discountVal);
    if (isNaN(val) || val <= 0 || val > 100) { toast.error('වට්ටම 1–100 අතර ඇතුළත් කරන්න'); return; }
    setSaving(true);
    try {
      await setProductDiscount(product.id, 'percent', val);
      toast.success(`${product.name} — ${val}% වට්ටම සුරකිණ`);
      setOfferType('none');
      onSaved();
    } catch { toast.error('දෝෂය'); }
    finally { setSaving(false); }
  };

  const handleRemoveDiscount = async () => {
    setSaving(true);
    try {
      await setProductDiscount(product.id, 'none', 0);
      toast.success('වට්ටම ඉවත් කළා');
      setOfferType('none');
      onSaved();
    } catch { toast.error('දෝෂය'); }
    finally { setSaving(false); }
  };

  const handleSavePromo = async () => {
    const buy  = parseInt(buyQty,  10);
    const free = parseInt(freeQty, 10);
    if (isNaN(buy) || buy < 1 || isNaN(free) || free < 1) { toast.error('Buy / Free ප්‍රමාණය ඇතුළත් කරන්න'); return; }
    setSaving(true);
    try {
      await upsertPromotion(product.id, product.barcode, buy, free, shopId);
      toast.success(`Buy ${buy} Get ${free} Free — Promotion සුරකිණ`);
      setOfferType('none');
      onSaved();
    } catch { toast.error('දෝෂය'); }
    finally { setSaving(false); }
  };

  const handleRemovePromo = async () => {
    setSaving(true);
    try {
      await deactivatePromotion(product.id);
      toast.success('Promotion ඉවත් කළා');
      setOfferType('none');
      onSaved();
    } catch { toast.error('දෝෂය'); }
    finally { setSaving(false); }
  };

  const hasDiscount = product.discount_type === 'percent' && product.discount_value > 0;
  const hasPromo    = !!promotion && promotion.active;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {hasDiscount && (
          <Badge variant="secondary" className="gap-1 text-xs">
            <Tag className="w-3 h-3" />
            {product.discount_value}% Off
            <button onClick={handleRemoveDiscount} className="ml-0.5 hover:text-destructive" disabled={saving}>
              <X className="w-2.5 h-2.5" />
            </button>
          </Badge>
        )}
        {hasPromo && (
          <Badge variant="secondary" className="gap-1 text-xs">
            <Gift className="w-3 h-3" />
            Buy {promotion.buy_qty} Get {promotion.free_qty} Free
            <button onClick={handleRemovePromo} className="ml-0.5 hover:text-destructive" disabled={saving}>
              <X className="w-2.5 h-2.5" />
            </button>
          </Badge>
        )}
        {!hasDiscount && !hasPromo && <span className="text-xs text-muted-foreground">—</span>}
      </div>

      {offerType === 'none' ? (
        <div className="flex gap-1">
          <Button variant="outline" size="sm" className="h-6 text-xs px-2 gap-1"
            onClick={() => setOfferType('discount')}>
            <Tag className="w-3 h-3" />වට්ටම
          </Button>
          <Button variant="outline" size="sm" className="h-6 text-xs px-2 gap-1"
            onClick={() => setOfferType('promo')}>
            <Gift className="w-3 h-3" />Promo
          </Button>
        </div>
      ) : offerType === 'discount' ? (
        <div className="flex items-center gap-1">
          <Input type="number" min="1" max="100" placeholder="%" value={discountVal}
            onChange={e => setDiscountVal(e.target.value)} className="h-7 w-16 text-xs px-2" />
          <span className="text-xs text-muted-foreground">%</span>
          <Button size="sm" className="h-7 px-2" onClick={handleSaveDiscount} disabled={saving}>
            <Check className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setOfferType('none')}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs text-muted-foreground">Buy</span>
          <Input type="number" min="1" placeholder="2" value={buyQty}
            onChange={e => setBuyQty(e.target.value)} className="h-7 w-12 text-xs px-2" />
          <span className="text-xs text-muted-foreground">Get</span>
          <Input type="number" min="1" placeholder="1" value={freeQty}
            onChange={e => setFreeQty(e.target.value)} className="h-7 w-12 text-xs px-2" />
          <span className="text-xs text-muted-foreground">Free</span>
          <Button size="sm" className="h-7 px-2" onClick={handleSavePromo} disabled={saving}>
            <Check className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setOfferType('none')}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProductsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const shopId = profile?.shop_id ?? '';

  const [products,   setProducts]   = useState<Product[]>([]);
  const [branches,   setBranches]   = useState<Branch[]>([]);
  const [suppliers,  setSuppliers]  = useState<Supplier[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving,  setSaving]  = useState(false);
  const [search,  setSearch]  = useState('');
  const [expiryFilter, setExpiryFilter] = useState<'all' | 'expired' | 'soon'>('all');

  // ── Smart import state ────────────────────────────────────────────────────
  const [smartImportOpen, setSmartImportOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, b, s, pr] = await Promise.all([
        getProducts(), getBranches(), getSuppliers(), getPromotions(),
      ]);
      setProducts(p);
      setBranches(b);
      setSuppliers(s);
      setPromotions(pr);
    } catch {
      toast.error('දත්ත ලබාගැනීමේ දෝෂය');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // promo map: product_id → active promotion
  const promoMap = new Map<string, Promotion>();
  for (const pr of promotions) {
    if (pr.active) promoMap.set(pr.product_id, pr);
  }

  const filtered = products.filter(p => {
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.includes(search);
    const status = getExpiryStatus(p.expiry);
    const matchExpiry =
      expiryFilter === 'all'     ? true :
      expiryFilter === 'expired' ? status === 'expired' :
                                   status === 'soon';
    return matchSearch && matchExpiry;
  });

  const getSupplierName = (id: string | null) => suppliers.find(s => s.id === id)?.name ?? '—';
  const getBranchName   = (id: string | null) => branches.find(b => b.id === id)?.name ?? '—';
  const getUnitLabel    = (unit: string) => UNITS.find(u => u.value === unit)?.value ?? unit;

  // ── Dialog helpers ──
  const openAdd = () => {
    setEditProduct(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setForm({
      barcode:     p.barcode,
      name:        p.name,
      unit:        p.unit || 'pcs',
      cost:        String(p.cost),
      price:       String(p.price),
      qty:         String(p.qty),
      expiry:      p.expiry || '',
      branch_id:   p.branch_id   ?? 'none',
      supplier_id: p.supplier_id ?? 'none',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const { barcode, name, unit, cost, price, qty, expiry } = form;
    if (!barcode.trim() || !name.trim()) { toast.error('Barcode සහ නාමය ඇතුළත් කරන්න'); return; }
    const costN  = parseFloat(cost);
    const priceN = parseFloat(price);
    const qtyN   = parseFloat(qty);
    if (isNaN(costN)  || costN  < 0) { toast.error('ගැනුම් මිල ඇතුළත් කරන්න'); return; }
    if (isNaN(priceN) || priceN <= 0) { toast.error('විකිණුම් මිල ඇතුළත් කරන්න'); return; }
    if (isNaN(qtyN)   || qtyN   < 0) { toast.error('ප්‍රමාණය ඇතුළත් කරන්න'); return; }
    if (costN > priceN) toast.warning('ගැනුම් මිල විකිණුම් මිලට වඩා වැඩිය!');

    setSaving(true);
    try {
      const branchId   = form.branch_id   === 'none' ? null : form.branch_id;
      const supplierId = form.supplier_id === 'none' ? null : form.supplier_id;
      if (editProduct) {
        await updateProduct(editProduct.id, {
          name: name.trim(), unit, cost: costN, price: priceN,
          qty: qtyN, expiry: expiry || '', branch_id: branchId, supplier_id: supplierId,
        });
        toast.success('භාණ්ඩය යාවත්කාලීන කළා');
      } else {
        await addProduct(barcode.trim(), name.trim(), unit, costN, priceN, qtyN, expiry || '', branchId, supplierId, shopId);
        toast.success('භාණ්ඩය එකතු කළා');
      }
      setDialogOpen(false);
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'දෝෂය';
      toast.error(msg.includes('duplicate') || msg.includes('unique') ? 'Barcode දැනටමත් ඇත' : msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProduct(deleteTarget.id);
      toast.success('භාණ්ඩය ඉවත් කළා');
      setDeleteTarget(null);
      load();
    } catch { toast.error('ඉවත් කිරීම අසාර්ථකයි'); }
  };

  const handleExport = () => {
    const rows = filtered.map(p => ({
      'Barcode':          p.barcode,
      'නාමය':            p.name,
      'ඒකකය':            p.unit,
      'ගැනුම් මිල (Rs.)': p.cost,
      'විකිණුම් මිල (Rs.)': p.price,
      'Stock':            p.qty,
      'කල් ඉකුත් වීම':   p.expiry || '—',
      'වට්ටම':           p.discount_type === 'percent' ? `${p.discount_value}%` : '—',
      'Promotion': (() => { const pr = promoMap.get(p.id); return pr ? `Buy ${pr.buy_qty} Get ${pr.free_qty} Free` : '—'; })(),
      'සැපයුම්කරු':      getSupplierName(p.supplier_id),
      'ශාඛාව':           getBranchName(p.branch_id),
      'Asset Value (Rs.)': p.qty * p.price,
      'Profit Margin (%)': p.price > 0 ? (((p.price - p.cost) / p.price) * 100).toFixed(1) : '0',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, `products_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Summary stats
  const expiredCount  = products.filter(p => getExpiryStatus(p.expiry) === 'expired').length;
  const expiringSoon  = products.filter(p => getExpiryStatus(p.expiry) === 'soon').length;
  const discountedCount = products.filter(p => p.discount_type === 'percent' && p.discount_value > 0).length;
  const promoCount    = [...promoMap.values()].filter(p => p.active).length;

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold text-balance">භාණ්ඩ කළමනාකරණය</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Input
              placeholder="හොයන්න..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-40 px-3"
            />
            <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="sr-only md:not-sr-only">යාවත්කාලීන</span>
            </Button>
            {isAdmin && (
              <>
                <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
                  <Download className="w-3.5 h-3.5" />
                  <span className="sr-only md:not-sr-only">Excel</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSmartImportOpen(true)} className="gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span className="sr-only md:not-sr-only">Import</span>
                </Button>
                <Button size="sm" onClick={openAdd} className="gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  <span>නව භාණ්ඩය</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'සම්පූර්ණ භාණ්ඩ',    value: products.length,                          color: 'text-primary' },
            { label: 'අඩු Stock (< 10)',    value: products.filter(p => p.qty < 10).length, color: 'text-destructive' },
            { label: 'කල් ඉකුත් / ළඟාවේ', value: expiredCount + expiringSoon,              color: 'text-amber-500' },
            { label: 'Offers සක්‍රීය',      value: discountedCount + promoCount,             color: 'text-green-500' },
          ].map((s, i) => (
            <Card key={i} className="h-full">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground text-pretty">{s.label}</p>
                {loading
                  ? <Skeleton className="h-7 w-16 mt-1 bg-muted" />
                  : <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>}
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="products">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="products" className="gap-1.5">
              <Package className="w-3.5 h-3.5" />
              <span>භාණ්ඩ ලැයිස්තුව</span>
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="offers" className="gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                <span>Offers</span>
                {(discountedCount + promoCount) > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 min-w-4 text-xs px-1">
                    {discountedCount + promoCount}
                  </Badge>
                )}
              </TabsTrigger>
            )}
            {(expiredCount + expiringSoon) > 0 && (
              <TabsTrigger value="expiry" className="gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Expiry</span>
                <Badge variant="destructive" className="ml-1 h-4 min-w-4 text-xs px-1">
                  {expiredCount + expiringSoon}
                </Badge>
              </TabsTrigger>
            )}
          </TabsList>

          {/* ── Products Tab ── */}
          <TabsContent value="products" className="mt-3">
            <Card>
              <CardContent className="p-0">
                <div className="w-full max-w-full overflow-x-auto bg-card rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">Barcode</TableHead>
                        <TableHead className="whitespace-nowrap">නාමය</TableHead>
                        <TableHead className="whitespace-nowrap">ඒකකය</TableHead>
                        {isAdmin && <TableHead className="whitespace-nowrap">ගැනුම් මිල</TableHead>}
                        <TableHead className="whitespace-nowrap">විකිණුම් මිල</TableHead>
                        <TableHead className="whitespace-nowrap">Stock</TableHead>
                        <TableHead className="whitespace-nowrap">කල් ඉකුත්</TableHead>
                        <TableHead className="whitespace-nowrap">Offer</TableHead>
                        <TableHead className="whitespace-nowrap">සැපයුම්කරු</TableHead>
                        {isAdmin && <TableHead className="whitespace-nowrap text-right">ක්‍රියා</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            {Array.from({ length: isAdmin ? 10 : 8 }).map((__, j) => (
                              <TableCell key={j}><Skeleton className="h-5 w-full bg-muted" /></TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={isAdmin ? 10 : 8} className="text-center py-12 text-muted-foreground whitespace-nowrap">
                            {search ? 'හොයාගත නොහැකිය' : 'භාණ්ඩ නොමැත'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.map(p => {
                          const promo  = promoMap.get(p.id);
                          const expSt  = getExpiryStatus(p.expiry);
                          return (
                            <TableRow key={p.id} className={cn(expSt === 'expired' && 'bg-destructive/5')}>
                              <TableCell className="whitespace-nowrap font-mono text-sm">{p.barcode}</TableCell>
                              <TableCell className="whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  {p.qty < 10 && <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />}
                                  {p.name}
                                </div>
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                <Badge variant="outline" className="text-xs font-mono">
                                  {getUnitLabel(p.unit)}
                                </Badge>
                              </TableCell>
                              {isAdmin && (
                                <TableCell className="whitespace-nowrap text-sm">Rs. {p.cost.toFixed(2)}</TableCell>
                              )}
                              <TableCell className="whitespace-nowrap font-medium">Rs. {p.price.toFixed(2)}</TableCell>
                              <TableCell className="whitespace-nowrap">
                                <Badge variant={p.qty < 10 ? 'destructive' : p.qty < 20 ? 'secondary' : 'outline'}>
                                  {fmtQty(Number(p.qty), p.unit)} {getUnitLabel(p.unit)}
                                </Badge>
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                <ExpiryBadge expiry={p.expiry} />
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                <div className="flex flex-wrap gap-1">
                                  {p.discount_type === 'percent' && p.discount_value > 0 && (
                                    <Badge className="text-xs bg-amber-500 text-white hover:bg-amber-500 gap-1">
                                      <Tag className="w-2.5 h-2.5" />{p.discount_value}%
                                    </Badge>
                                  )}
                                  {promo && promo.active && (
                                    <Badge className="text-xs bg-green-500 text-white hover:bg-green-500 gap-1">
                                      <Gift className="w-2.5 h-2.5" />B{promo.buy_qty}G{promo.free_qty}
                                    </Badge>
                                  )}
                                  {!(p.discount_type === 'percent' && p.discount_value > 0) && !(promo && promo.active) && (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                                {getSupplierName(p.supplier_id)}
                              </TableCell>
                              {isAdmin && (
                                <TableCell className="whitespace-nowrap text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost" size="icon"
                                      className="h-7 w-7 text-destructive hover:text-destructive"
                                      onClick={() => setDeleteTarget(p)}>
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Offers Tab ── */}
          {isAdmin && (
            <TabsContent value="offers" className="mt-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-balance">
                    <Tag className="w-4 h-4 text-amber-500" />
                    Discount & Promotion කළමනාකරණය
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    භාණ්ඩයක් සිට Offer button click කර වට්ටමක් හෝ Buy X Get Y Free promotion set කරන්න.
                  </p>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="w-full max-w-full overflow-x-auto bg-card rounded-b-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">Barcode</TableHead>
                          <TableHead className="whitespace-nowrap">නාමය</TableHead>
                          <TableHead className="whitespace-nowrap">ඒකකය</TableHead>
                          <TableHead className="whitespace-nowrap">මිල (Rs.)</TableHead>
                          <TableHead className="whitespace-nowrap">Stock</TableHead>
                          <TableHead className="whitespace-nowrap min-w-[260px]">Discount / Promotion</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading
                          ? Array.from({ length: 5 }).map((_, i) => (
                              <TableRow key={i}>{[1,2,3,4,5,6].map(j => (
                                <TableCell key={j}><Skeleton className="h-5 w-full bg-muted" /></TableCell>
                              ))}</TableRow>
                            ))
                          : filtered.length === 0
                            ? <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground whitespace-nowrap">
                                {search ? 'හොයාගත නොහැකිය' : 'භාණ්ඩ නොමැත'}
                              </TableCell></TableRow>
                            : filtered.map(p => (
                                <TableRow key={p.id}>
                                  <TableCell className="whitespace-nowrap font-mono text-sm">{p.barcode}</TableCell>
                                  <TableCell className="whitespace-nowrap font-medium">{p.name}</TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    <Badge variant="outline" className="text-xs font-mono">{p.unit}</Badge>
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">Rs. {p.price.toFixed(2)}</TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    <Badge variant={p.qty < 10 ? 'destructive' : 'outline'}>{fmtQty(Number(p.qty), p.unit)}</Badge>
                                  </TableCell>
                                  <TableCell>
                                    <OfferPanel product={p} promotion={promoMap.get(p.id)} onSaved={load} shopId={shopId} />
                                  </TableCell>
                                </TableRow>
                              ))
                        }
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* ── Expiry Tab ── */}
          {(expiredCount + expiringSoon) > 0 && (
            <TabsContent value="expiry" className="mt-3">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <CardTitle className="text-base flex items-center gap-2 text-balance">
                      <Clock className="w-4 h-4 text-amber-500" />
                      Expiry අනතුරු ඇඟවීම
                    </CardTitle>
                    <div className="flex gap-1">
                      {(['all','expired','soon'] as const).map(f => (
                        <Button key={f} size="sm" variant={expiryFilter === f ? 'default' : 'outline'}
                          className="h-7 text-xs px-3"
                          onClick={() => setExpiryFilter(f)}>
                          {f === 'all' ? 'සියල්ල' : f === 'expired' ? 'කල් ඉකුත්' : '30 දිනෙන්'}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="w-full max-w-full overflow-x-auto bg-card rounded-b-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">Barcode</TableHead>
                          <TableHead className="whitespace-nowrap">නාමය</TableHead>
                          <TableHead className="whitespace-nowrap">ඒකකය</TableHead>
                          <TableHead className="whitespace-nowrap">Stock</TableHead>
                          <TableHead className="whitespace-nowrap">කල් ඉකුත් දිනය</TableHead>
                          <TableHead className="whitespace-nowrap">තත්ත්වය</TableHead>
                          {isAdmin && <TableHead className="whitespace-nowrap text-right">ක්‍රියා</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products
                          .filter(p => {
                            const st = getExpiryStatus(p.expiry);
                            if (expiryFilter === 'expired') return st === 'expired';
                            if (expiryFilter === 'soon')    return st === 'soon';
                            return st === 'expired' || st === 'soon';
                          })
                          .sort((a, b) => (a.expiry < b.expiry ? -1 : 1))
                          .map(p => {
                            const st = getExpiryStatus(p.expiry);
                            return (
                              <TableRow key={p.id} className={cn(st === 'expired' && 'bg-destructive/5')}>
                                <TableCell className="whitespace-nowrap font-mono text-sm">{p.barcode}</TableCell>
                                <TableCell className="whitespace-nowrap font-medium">{p.name}</TableCell>
                                <TableCell className="whitespace-nowrap">
                                  <Badge variant="outline" className="text-xs font-mono">{p.unit}</Badge>
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  <Badge variant={p.qty < 10 ? 'destructive' : 'outline'}>{fmtQty(Number(p.qty), p.unit)}</Badge>
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-sm">
                                  {p.expiry ? new Date(p.expiry).toLocaleDateString('si-LK') : '—'}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {st === 'expired'
                                    ? <Badge variant="destructive" className="gap-1"><Clock className="w-3 h-3" />කල් ඉකුත්</Badge>
                                    : <Badge className="bg-amber-500 text-white hover:bg-amber-500 gap-1"><Clock className="w-3 h-3" />ළඟාවේ</Badge>
                                  }
                                </TableCell>
                                {isAdmin && (
                                  <TableCell className="whitespace-nowrap text-right">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                  </TableCell>
                                )}
                              </TableRow>
                            );
                          })
                        }
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* ── Add / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editProduct ? 'භාණ්ඩය සංස්කරණය' : 'නව භාණ්ඩය'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">

              {/* Barcode */}
              <div className="space-y-1.5 col-span-2">
                <Label className="text-sm font-normal">Barcode</Label>
                <Input
                  placeholder="1234567890"
                  value={form.barcode}
                  onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
                  disabled={!!editProduct}
                  className="px-3"
                />
              </div>

              {/* Name */}
              <div className="space-y-1.5 col-span-2">
                <Label className="text-sm font-normal">භාණ්ඩ නාමය</Label>
                <Input
                  placeholder="Anchor Milk 400g"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="px-3"
                />
              </div>

              {/* Unit */}
              <div className="space-y-1.5">
                <Label className="text-sm font-normal">ඒකකය (Unit)</Label>
                <Select value={form.unit} onValueChange={v => setForm(f => ({ ...f, unit: v }))}>
                  <SelectTrigger><SelectValue placeholder="ඒකකය" /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map(u => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Expiry */}
              <div className="space-y-1.5">
                <Label className="text-sm font-normal">කල් ඉකුත් දිනය (විකල්ප)</Label>
                <Input
                  type="date"
                  value={form.expiry}
                  onChange={e => setForm(f => ({ ...f, expiry: e.target.value }))}
                  className="px-3"
                />
              </div>

              {/* Cost */}
              <div className="space-y-1.5">
                <Label className="text-sm font-normal">ගැනුම් මිල (Rs.)</Label>
                <Input
                  type="number" min="0" step="0.01" placeholder="0.00"
                  value={form.cost}
                  onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
                  className="px-3"
                />
              </div>

              {/* Price */}
              <div className="space-y-1.5">
                <Label className="text-sm font-normal">විකිණුම් මිල (Rs.)</Label>
                <Input
                  type="number" min="0" step="0.01" placeholder="0.00"
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  className="px-3"
                />
              </div>

              {/* Qty */}
              <div className="space-y-1.5">
                <Label className="text-sm font-normal">
                  ප්‍රමාණය (Stock)
                  {isFloatUnit(form.unit) && (
                    <span className="text-muted-foreground ml-1 font-normal text-xs">— දශම ඉලක්කම් ✓</span>
                  )}
                </Label>
                <Input
                  type="number"
                  min="0"
                  step={inputStep(form.unit)}
                  placeholder={isFloatUnit(form.unit) ? '0.000' : '0'}
                  value={form.qty}
                  onChange={e => setForm(f => ({ ...f, qty: e.target.value }))}
                  className="px-3"
                />
              </div>

              {/* Supplier */}
              <div className="space-y-1.5">
                <Label className="text-sm font-normal">සැපයුම්කරු (විකල්ප)</Label>
                <Select value={form.supplier_id} onValueChange={v => setForm(f => ({ ...f, supplier_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="තෝරන්න" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— නැත —</SelectItem>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Branch */}
              <div className="space-y-1.5 col-span-2">
                <Label className="text-sm font-normal">ශාඛාව (විකල්ප)</Label>
                <Select value={form.branch_id} onValueChange={v => setForm(f => ({ ...f, branch_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="ශාඛාව" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— නැත —</SelectItem>
                    {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>අවලංගු</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'සුරකිමින්...' : editProduct ? 'යාවත්කාලීන' : 'එකතු කරන්න'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Alert ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>භාණ්ඩය ඉවත් කරන්නද?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" ඉවත් කිරීම ස්ථිර ක්‍රියාවකි.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>අවලංගු</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              ඉවත් කරන්න
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Smart Import Dialog ───────────────────────────────────────────── */}
      <SmartImportDialog
        open={smartImportOpen}
        onOpenChange={setSmartImportOpen}
        shopId={shopId}
        onDone={load}
      />
    </AppLayout>
  );
}
