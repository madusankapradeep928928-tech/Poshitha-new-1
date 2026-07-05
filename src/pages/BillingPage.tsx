import { useState, useRef, useCallback, useEffect } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { getProductByBarcode, getProducts, getProductsForPOS } from '@/services/products';
import { getActivePromotionByBarcode } from '@/services/promotions';
import { checkoutCart, computeCartItem, getDayEndSummary } from '@/services/sales';
import type { DayEndSummary } from '@/services/sales';
import { holdBill, getHeldBills, deleteHeldBill } from '@/services/heldBills';
import { updateShop } from '@/services/shops';
import { cacheProducts, getCachedProducts, enqueueSale } from '@/services/offlineQueue';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useAuth } from '@/contexts/AuthContext';
import type { CartItem, Invoice, PaymentMethod, Promotion, Product, HeldBill } from '@/types/index';
import {
  Barcode, ShoppingCart, Trash2, Plus, Minus, CreditCard,
  Banknote, CheckCircle2, Printer, RotateCcw, Tag, Gift,
  WifiOff, CloudOff, Clock, Search, PauseCircle, PlayCircle,
  BarChart2, User, Phone, Eye, Settings2, X, Percent, Hash,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { isFloatUnit, qtyStep, minQty, fmtQty } from '@/lib/unitUtils';

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { value: 'cash',   label: 'මුදල් (Cash)',    icon: <Banknote   className="w-4 h-4" /> },
  { value: 'card',   label: 'කාඩ් (Card)',     icon: <CreditCard className="w-4 h-4" /> },
  { value: 'credit', label: 'ණය (Credit)',     icon: <Hash       className="w-4 h-4" /> },
];

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'මුදල්', card: 'කාඩ්', credit: 'ණය',
};

type LineDiscountType = 'none' | 'percent' | 'amount';

interface ActiveCartItem extends CartItem {
  promo: Promotion | null;
  lineDiscountType: LineDiscountType;
  lineDiscountValue: number;
}

// ─── Invoice Receipt ────────────────────────────────────────────────────────
function InvoiceReceipt({
  invoice,
  shopName,
  isAdmin,
  onPrint,
  onNew,
}: {
  invoice: Invoice;
  shopName: string;
  isAdmin: boolean;
  onPrint: () => void;
  onNew: () => void;
}) {
  return (
    <div className="max-w-xl mx-auto space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-green-500">
            <CheckCircle2 className="w-5 h-5" />
            <CardTitle className="text-lg text-balance">Invoice සාර්ථකව නිකුත් කෙරිණ</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4" id="print-invoice">
          {/* Shop header */}
          <div className="text-center border-b border-border pb-3">
            <p className="font-bold text-base">{shopName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Invoice #{invoice.invoice_no}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <span className="text-muted-foreground">Cashier:</span>
            <span>{invoice.cashier_username}</span>
            <span className="text-muted-foreground">ගෙවීම:</span>
            <span>{PAYMENT_LABELS[invoice.payment_method]}</span>
            {invoice.customer_name && (
              <>
                <span className="text-muted-foreground">පාරිභෝගිකයා:</span>
                <span>{invoice.customer_name}</span>
              </>
            )}
            {invoice.customer_phone && (
              <>
                <span className="text-muted-foreground">දුරකථන:</span>
                <span>{invoice.customer_phone}</span>
              </>
            )}
            <span className="text-muted-foreground">දිනය:</span>
            <span>{new Date(invoice.created_at).toLocaleString('si-LK')}</span>
          </div>
          <Separator />
          {/* Items */}
          <div className="space-y-2">
            {invoice.items?.map(item => (
              <div key={item.id} className="text-sm">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Rs. {item.price_per_unit.toFixed(2)} × {fmtQty(Number(item.qty), item.unit ?? 'pcs')} {item.unit}
                    </p>
                  </div>
                  <p className="font-semibold shrink-0">Rs. {item.total.toFixed(2)}</p>
                </div>
                {item.free_qty > 0 && (
                  <p className="text-xs text-green-500">+ {fmtQty(Number(item.free_qty), item.unit ?? 'pcs')} {item.unit} නොමිලේ</p>
                )}
                {item.discount_amount > 0 && (
                  <p className="text-xs text-amber-500">- Rs. {item.discount_amount.toFixed(2)} වට්ටම</p>
                )}
              </div>
            ))}
          </div>
          <Separator />
          <div className="space-y-1">
            <div className="flex justify-between font-bold text-base">
              <span>මුළු</span>
              <span>Rs. {invoice.total_amount.toFixed(2)}</span>
            </div>
            {invoice.tendered_amount != null && (
              <>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>ලබාදුන්:</span>
                  <span>Rs. {invoice.tendered_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold text-green-500">
                  <span>ඉතිරිය:</span>
                  <span>Rs. {(invoice.change_amount ?? 0).toFixed(2)}</span>
                </div>
              </>
            )}
          </div>
          {isAdmin && invoice.total_profit > 0 && (
            <p className="text-sm text-green-500 text-right">ලාභය: Rs. {invoice.total_profit.toFixed(2)}</p>
          )}
        </CardContent>
        <CardFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={onPrint} className="gap-2">
            <Printer className="w-4 h-4" /> Print
          </Button>
          <Button onClick={onNew} className="gap-2">
            <RotateCcw className="w-4 h-4" /> නව Bill
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// ─── Invoice Preview Modal ──────────────────────────────────────────────────
function InvoicePreviewModal({
  open, onClose, onConfirm,
  cart, paymentMethod, customerName, customerPhone,
  totalAmount, tenderedAmount, changeAmount,
  shopName, cashierName, checkingOut,
}: {
  open: boolean; onClose: () => void; onConfirm: () => void;
  cart: ActiveCartItem[]; paymentMethod: PaymentMethod;
  customerName: string; customerPhone: string;
  totalAmount: number; tenderedAmount: string; changeAmount: number;
  shopName: string; cashierName: string; checkingOut: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-balance">Invoice Preview</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="text-center border-b border-border pb-2">
            <p className="font-bold">{shopName}</p>
            <p className="text-xs text-muted-foreground">Cashier: {cashierName}</p>
          </div>
          {(customerName || customerPhone) && (
            <div className="text-xs text-muted-foreground">
              {customerName && <p>පාරිභෝගිකයා: {customerName}</p>}
              {customerPhone && <p>දුරකථන: {customerPhone}</p>}
            </div>
          )}
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {cart.map(c => (
              <div key={c.product.id} className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{c.product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.qty} {c.product.unit} × Rs. {c.product.price.toFixed(2)}
                    {c.freeQty > 0 && <span className="text-green-500 ml-1">+{c.freeQty} නොමිලේ</span>}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold">Rs. {c.total.toFixed(2)}</p>
                  {c.discountAmount > 0 && (
                    <p className="text-xs text-amber-500">-{c.discountAmount.toFixed(2)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Separator />
          <div className="space-y-1">
            <div className="flex justify-between font-bold">
              <span>මුළු</span>
              <span>Rs. {totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>ගෙවීම</span>
              <span>{PAYMENT_LABELS[paymentMethod]}</span>
            </div>
            {paymentMethod === 'cash' && tenderedAmount && (
              <>
                <div className="flex justify-between text-muted-foreground">
                  <span>ලබාදුන්</span>
                  <span>Rs. {parseFloat(tenderedAmount || '0').toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold text-green-500">
                  <span>ඉතිරිය</span>
                  <span>Rs. {changeAmount.toFixed(2)}</span>
                </div>
              </>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={onClose}>අවලංගු</Button>
          <Button onClick={onConfirm} disabled={checkingOut}>
            {checkingOut ? 'Checkout...' : 'තහවුරු කර Checkout'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Held Bills Modal ───────────────────────────────────────────────────────
function HeldBillsModal({
  open, onClose, heldBills, onResume,
}: {
  open: boolean; onClose: () => void;
  heldBills: HeldBill[]; onResume: (bill: HeldBill) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-balance">Hold කළ Bills ({heldBills.length})</DialogTitle>
        </DialogHeader>
        {heldBills.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Hold කළ bills නොමැත</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {heldBills.map(b => (
              <div key={b.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 cursor-pointer"
                onClick={() => onResume(b)}
              >
                <PlayCircle className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {b.customer_name || b.label || 'Bill'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {b.cart_json.length} items · {new Date(b.held_at).toLocaleTimeString('si-LK')}
                  </p>
                </div>
                <p className="text-sm font-semibold shrink-0">
                  Rs. {b.cart_json.reduce((s, i) => s + (i as CartItem).total, 0).toFixed(0)}
                </p>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>වසන්න</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Day-End Summary Modal ──────────────────────────────────────────────────
function DayEndModal({
  open, onClose, summary,
}: {
  open: boolean; onClose: () => void; summary: DayEndSummary | null;
}) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-balance">දින අවසාන සාරාංශ</DialogTitle>
        </DialogHeader>
        {summary ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-muted-foreground">Invoices:</span>
              <span className="font-semibold">{summary.invoice_count}</span>
              <span className="text-muted-foreground">මුළු විකුණුම්:</span>
              <span className="font-bold text-primary">Rs. {summary.total_sales.toFixed(2)}</span>
              <span className="text-muted-foreground flex items-center gap-1"><Banknote className="w-3 h-3" />Cash:</span>
              <span>Rs. {summary.cash_total.toFixed(2)}</span>
              <span className="text-muted-foreground flex items-center gap-1"><CreditCard className="w-3 h-3" />Card:</span>
              <span>Rs. {summary.card_total.toFixed(2)}</span>
              <span className="text-muted-foreground flex items-center gap-1"><Hash className="w-3 h-3" />ණය:</span>
              <span>Rs. {summary.credit_total.toFixed(2)}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-2">Loading...</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>වසන්න</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Quick Product Config Modal (Admin) ────────────────────────────────────
function QuickButtonsConfigModal({
  open, onClose,
  products, currentIds, shopId, onSaved,
}: {
  open: boolean; onClose: () => void;
  products: Product[]; currentIds: string[]; shopId: string;
  onSaved: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(currentIds));
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.barcode.includes(search)
  );

  const toggle = (id: string) =>
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const handleSave = async () => {
    setSaving(true);
    try {
      const ids = [...selected];
      await updateShop(shopId, { quick_buttons: ids });
      onSaved(ids);
      toast.success('Quick buttons සුරකිණ');
      onClose();
    } catch {
      toast.error('Save කිරීම අසාර්ථකයි');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-balance">Quick Buttons Configure</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="නම හෝ barcode සොවන්න..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3"
          />
          <p className="text-xs text-muted-foreground">{selected.size} තෝරාගෙන ඇත</p>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {filtered.map(p => (
              <label key={p.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 cursor-pointer min-h-12"
              >
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                  className="accent-primary"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.barcode} · Rs. {p.price.toFixed(2)}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>අවලංගු</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function BillingPage() {
  const { profile, shop } = useAuth();
  const { isOnline } = useNetworkStatus();
  const barcodeRef = useRef<HTMLInputElement>(null);

  const [barcode, setBarcode]             = useState('');
  const [nameSearch, setNameSearch]       = useState('');
  const [nameResults, setNameResults]     = useState<Product[]>([]);
  const [cart, setCart]                   = useState<ActiveCartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [tenderedAmount, setTenderedAmount] = useState('');
  const [customerName, setCustomerName]   = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [scanning, setScanning]           = useState(false);
  const [checkingOut, setCheckingOut]     = useState(false);
  const [lastInvoice, setLastInvoice]     = useState<Invoice | null>(null);
  const [lastOffline, setLastOffline]     = useState(false);

  // Modal states
  const [showPreview, setShowPreview]       = useState(false);
  const [showHeld, setShowHeld]             = useState(false);
  const [showDayEnd, setShowDayEnd]         = useState(false);
  const [showQBConfig, setShowQBConfig]     = useState(false);
  const [dayEndSummary, setDayEndSummary]   = useState<DayEndSummary | null>(null);
  const [heldBills, setHeldBills]           = useState<HeldBill[]>([]);
  const [quickButtonIds, setQuickButtonIds] = useState<string[]>([]);

  const [localProducts, setLocalProducts] = useState<Product[]>([]);

  const isAdmin  = profile?.role === 'admin' || profile?.role === 'super_admin';
  const shopId   = profile?.shop_id ?? '';
  const branchId = profile?.branch_id ?? null;
  const shopName = shop?.name ?? 'POShitha Pro';

  const totalAmount    = cart.reduce((s, c) => s + c.total, 0);
  const totalProfit    = cart.reduce((s, c) => s + c.profit, 0);
  // For pcs units sum integers; for float units sum as weight — use line count for badge
  const totalItems     = cart.length;   // number of distinct lines
  const totalDiscount  = cart.reduce((s, c) => s + c.discountAmount, 0);
  const totalFreeItems = cart.reduce((s, c) => s + c.freeQty, 0);
  const parsedTendered = parseFloat(tenderedAmount) || 0;
  const changeAmount   = paymentMethod === 'cash' ? Math.max(0, parsedTendered - totalAmount) : 0;

  // Load products & quick button config
  useEffect(() => {
    async function loadProducts() {
      if (isOnline) {
        try {
          // If cashier has a branch assigned, load only that branch's products
          const products = shopId
            ? await getProductsForPOS(shopId, branchId)
            : await getProducts();
          setLocalProducts(products);
          await cacheProducts(products);
        } catch {
          const cached = await getCachedProducts<Product>();
          if (cached) setLocalProducts(cached);
        }
      } else {
        const cached = await getCachedProducts<Product>();
        if (cached) setLocalProducts(cached);
      }
    }
    loadProducts();
  }, [isOnline, shopId, branchId]);

  // Sync quick button IDs from shop config
  useEffect(() => {
    if (shop?.quick_buttons) setQuickButtonIds(shop.quick_buttons);
  }, [shop]);

  const quickProducts = quickButtonIds
    .map(id => localProducts.find(p => p.id === id))
    .filter(Boolean) as Product[];

  // Name search
  useEffect(() => {
    if (!nameSearch.trim()) { setNameResults([]); return; }
    const q = nameSearch.toLowerCase();
    setNameResults(localProducts.filter(p =>
      p.name.toLowerCase().includes(q) || p.barcode.includes(nameSearch)
    ).slice(0, 8));
  }, [nameSearch, localProducts]);

  // ── Rebuild cart item after qty/discount change ──────────────────────────
  const rebuildItem = (c: ActiveCartItem, newQty: number, ldt?: LineDiscountType, ldv?: number): ActiveCartItem => {
    const discType  = ldt ?? c.lineDiscountType;
    const discValue = ldv ?? c.lineDiscountValue;
    const computed  = computeCartItem(c.product, newQty, c.promo, discType, discValue);
    return { ...c, ...computed, lineDiscountType: discType, lineDiscountValue: discValue };
  };

  // ── Add to cart ────────────────────────────────────────────────────────────
  const addToCartByProduct = useCallback(async (product: Product, promoArg?: Promotion | null) => {
    let promo = promoArg ?? null;
    if (promoArg === undefined && isOnline) {
      try { promo = await getActivePromotionByBarcode(product.barcode); }
      catch { promo = null; }
    }
    setCart(prev => {
      const idx = prev.findIndex(c => c.product.id === product.id);
      if (idx >= 0) {
        const existing = prev[idx];
        const step   = qtyStep(product.unit);
        const newQty = parseFloat((existing.qty + step).toFixed(3));
        if (newQty > product.qty) {
          toast.error(`ප්‍රමාණවත් stock නොමැත (ඇත: ${fmtQty(product.qty, product.unit)} ${product.unit})`);
          return prev;
        }
        return prev.map((c, i) => i === idx ? rebuildItem({ ...c, product }, newQty) : c);
      }
      if (product.qty <= 0) { toast.error(`'${product.name}' — stock නොමැත`); return prev; }
      const computed = computeCartItem(product, 1, promo, 'none', 0);
      return [...prev, { product, promo, ...computed, lineDiscountType: 'none', lineDiscountValue: 0 }];
    });
    setNameSearch('');
    setNameResults([]);
    setTimeout(() => barcodeRef.current?.focus(), 50);
  }, [isOnline]);

  const addToCart = useCallback(async (bc: string) => {
    if (!bc.trim()) return;
    setScanning(true);
    try {
      let product: Product | null = null;
      let promo: Promotion | null = null;
      if (isOnline) {
        [product, promo] = await Promise.all([
          getProductByBarcode(bc.trim()),
          getActivePromotionByBarcode(bc.trim()),
        ]);
      } else {
        product = localProducts.find(p => p.barcode === bc.trim()) ?? null;
      }
      if (!product) { toast.error('භාණ්ඩය හමු නොවිය'); return; }
      await addToCartByProduct(product, promo);
      setBarcode('');
    } catch {
      toast.error('Barcode scan දෝෂය');
    } finally {
      setScanning(false);
    }
  }, [isOnline, localProducts, addToCartByProduct]);

  // ── Cart qty & discount ────────────────────────────────────────────────────
  const setQty = (productId: string, newQty: number) => {
    setCart(prev =>
      prev.map(c => {
        if (c.product.id !== productId) return c;
        const min = minQty(c.product.unit);
        if (newQty < min) return null as unknown as ActiveCartItem;
        if (newQty > c.product.qty) {
          toast.error(`Stock ප්‍රමාණය: ${fmtQty(c.product.qty, c.product.unit)} ${c.product.unit}`);
          return c;
        }
        return rebuildItem(c, parseFloat(newQty.toFixed(3)));
      }).filter(Boolean)
    );
  };

  const setLineDiscount = (productId: string, type: LineDiscountType, value: number) => {
    setCart(prev =>
      prev.map(c =>
        c.product.id === productId ? rebuildItem(c, c.qty, type, value) : c
      )
    );
  };

  const removeItem = (productId: string) => setCart(prev => prev.filter(c => c.product.id !== productId));

  // ── Checkout ───────────────────────────────────────────────────────────────
  const doCheckout = async () => {
    if (cart.length === 0) { toast.error('Cart හිස්ය'); return; }
    if (!profile) { toast.error('Login කරන්න'); return; }
    if (paymentMethod === 'cash' && parsedTendered < totalAmount) {
      toast.error('ලබාදෙන මුදල ප්‍රමාණවත් නොවේ'); return;
    }
    setCheckingOut(true);
    setShowPreview(false);
    try {
      if (isOnline) {
        const invoice = await checkoutCart(
          cart, profile.id, profile.username, paymentMethod, null, shopId,
          customerName || null, customerPhone || null,
          paymentMethod === 'cash' ? parsedTendered : null
        );
        setLastInvoice(invoice);
        setLastOffline(false);
        resetBill();
        toast.success(`Invoice #${invoice.invoice_no} නිකුත් කෙරිණ`);
      } else {
        const offlineItems = cart.map(c => ({
          product_id: c.product.id, barcode: c.product.barcode,
          product_name: c.product.name, unit: c.product.unit, unit_price: c.product.price,
          cost: c.product.cost, qty: c.qty, free_qty: c.freeQty,
          discount_amount: c.discountAmount, total: c.total, profit: c.profit,
        }));
        await enqueueSale({
          items: offlineItems, total_amount: totalAmount,
          payment_method: paymentMethod, cashier_id: profile.id,
          cashier_username: profile.username, branch_id: branchId, shop_id: shopId,
        });
        setLastOffline(true);
        resetBill();
        toast.warning('Offline — Bill queue කෙරිණ');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Checkout දෝෂය');
    } finally {
      setCheckingOut(false);
    }
  };

  const resetBill = () => {
    setCart([]); setCustomerName(''); setCustomerPhone('');
    setTenderedAmount(''); setPaymentMethod('cash');
  };

  const resetInvoice = () => {
    setLastInvoice(null); setLastOffline(false);
    setTimeout(() => barcodeRef.current?.focus(), 50);
  };

  // ── Hold / Resume ──────────────────────────────────────────────────────────
  const handleHold = async () => {
    if (cart.length === 0) { toast.error('Cart හිස්ය'); return; }
    if (!profile) return;
    try {
      await holdBill(shopId, profile.id, cart, customerName || null, customerPhone || null);
      resetBill();
      toast.success('Bill hold කෙරිණ');
    } catch { toast.error('Hold දෝෂය'); }
  };

  const openHeldBills = async () => {
    try {
      const bills = await getHeldBills(shopId);
      setHeldBills(bills);
      setShowHeld(true);
    } catch { toast.error('Held bills ලබාගැනීම අසාර්ථකයි'); }
  };

  const resumeBill = async (bill: HeldBill) => {
    if (cart.length > 0 && !confirm('වත්මන් cart ඉවත් කිරීමද?')) return;
    setCart(bill.cart_json as ActiveCartItem[]);
    setCustomerName(bill.customer_name ?? '');
    setCustomerPhone(bill.customer_phone ?? '');
    await deleteHeldBill(bill.id);
    setHeldBills(prev => prev.filter(b => b.id !== bill.id));
    setShowHeld(false);
    toast.success('Bill resume කෙරිණ');
  };

  // ── Day-End Summary ────────────────────────────────────────────────────────
  const openDayEnd = async () => {
    if (!profile) return;
    setDayEndSummary(null);
    setShowDayEnd(true);
    try {
      const summary = await getDayEndSummary(profile.id);
      setDayEndSummary(summary);
    } catch { toast.error('Summary ලබාගැනීම අසාර්ථකයි'); }
  };

  // ── Offline receipt ────────────────────────────────────────────────────────
  if (lastOffline) {
    return (
      <AppLayout>
        <div className="max-w-xl mx-auto space-y-4">
          <Card className="border-amber-500/40">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-amber-500">
                <CloudOff className="w-5 h-5" />
                <CardTitle className="text-lg text-balance">Offline — Bill Queue කෙරිණ</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-pretty">
                ඔබ offline ය. Bill queue ගත කෙරිණ. Internet ලැබෙන විට sync වේ.
              </p>
              <div className="flex items-center gap-2 p-3 mt-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-sm text-amber-600">{new Date().toLocaleString('si-LK')}</span>
              </div>
            </CardContent>
            <CardFooter className="gap-2">
              <Button variant="outline" onClick={() => window.print()} className="gap-2">
                <Printer className="w-4 h-4" /> Print
              </Button>
              <Button onClick={resetInvoice} className="gap-2">
                <RotateCcw className="w-4 h-4" /> නව Bill
              </Button>
            </CardFooter>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // ── Invoice receipt ────────────────────────────────────────────────────────
  if (lastInvoice) {
    return (
      <AppLayout>
        <InvoiceReceipt
          invoice={lastInvoice}
          shopName={shopName}
          isAdmin={isAdmin}
          onPrint={() => window.print()}
          onNew={resetInvoice}
        />
      </AppLayout>
    );
  }

  // ── Main POS ───────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">

        {/* ── Left: scan + search + quick buttons + cart ── */}
        <div className="lg:col-span-5 space-y-3 flex flex-col">
          {/* Offline warning */}
          {!isOnline && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-600">
              <WifiOff className="w-4 h-4 shrink-0" />
              <p className="text-sm font-medium">Offline — Checkout queue ගත කෙරේ</p>
            </div>
          )}

          {/* Barcode + Name Search */}
          <Card>
            <CardContent className="pt-4 pb-4 space-y-2">
              {/* Barcode */}
              <div className="flex gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Barcode className="w-4 h-4 text-muted-foreground shrink-0" />
                  <Input
                    ref={barcodeRef}
                    placeholder="Barcode scan / ටයිප් කරන්න..."
                    value={barcode}
                    onChange={e => setBarcode(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addToCart(barcode); }}
                    className="flex-1 min-w-0 px-3"
                    autoFocus
                  />
                </div>
                <Button onClick={() => addToCart(barcode)} disabled={!barcode.trim() || scanning} className="shrink-0">
                  {scanning ? 'සොයමින්...' : 'Add'}
                </Button>
              </div>

              {/* Name Search */}
              <div className="relative">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                  <Input
                    placeholder="නාමයෙන් සොවන්න..."
                    value={nameSearch}
                    onChange={e => setNameSearch(e.target.value)}
                    className="flex-1 px-3"
                  />
                  {nameSearch && (
                    <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8"
                      onClick={() => { setNameSearch(''); setNameResults([]); }}>
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                {nameResults.length > 0 && (
                  <div className="absolute z-50 left-6 right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                    {nameResults.map(p => (
                      <button key={p.id}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted/50 text-left text-sm"
                        onClick={() => addToCartByProduct(p)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.unit} · Rs. {p.price.toFixed(2)} · Stock: {p.qty}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Product Buttons */}
          {(quickProducts.length > 0 || isAdmin) && (
            <Card>
              <CardHeader className="pb-2 pt-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm text-balance">ශීඝ්‍ර භාණ්ඩ</CardTitle>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowQBConfig(true)}>
                      <Settings2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pb-3">
                {quickProducts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Admin settings icon click කර quick buttons configure කරන්න
                  </p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                    {quickProducts.map(p => (
                      <button key={p.id}
                        onClick={() => addToCartByProduct(p)}
                        className="text-left p-2 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors"
                      >
                        <p className="text-xs font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">Rs. {p.price.toFixed(2)}</p>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Cart */}
          <Card className="flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-balance">
                  Cart {totalItems > 0 && <span className="text-muted-foreground font-normal text-sm">({totalItems} items)</span>}
                </CardTitle>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {totalFreeItems > 0 && (
                    <Badge className="text-xs bg-green-500 text-white hover:bg-green-500 gap-1">
                      <Gift className="w-3 h-3" />Free ×{totalFreeItems}
                    </Badge>
                  )}
                  {totalDiscount > 0 && (
                    <Badge className="text-xs bg-amber-500 text-white hover:bg-amber-500 gap-1">
                      <Tag className="w-3 h-3" />-Rs.{totalDiscount.toFixed(0)}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 overflow-y-auto max-h-[40vh]">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                  <ShoppingCart className="w-8 h-8 opacity-30" />
                  <p className="text-sm">Cart හිස්ය. Barcode scan කරන්න.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cart.map(c => (
                    <CartLineItem key={c.product.id} item={c} isAdmin={isAdmin}
                      onSetQty={qty => setQty(c.product.id, qty)}
                      onSetDiscount={(type, val) => setLineDiscount(c.product.id, type, val)}
                      onRemove={() => removeItem(c.product.id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right: customer + payment + checkout ── */}
        <div className="lg:col-span-2 space-y-3">
          {/* Customer Info */}
          <Card>
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm text-balance">පාරිභෝගික තොරතුරු (විකල්ප)</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 space-y-2">
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <Input
                  placeholder="නම..."
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="px-2 h-8 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <Input
                  placeholder="දුරකථන..."
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  className="px-2 h-8 text-sm"
                />
              </div>
            </CardContent>
          </Card>

          {/* Payment */}
          <Card>
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm text-balance">ගෙවීමේ ක්‍රමය</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 space-y-3">
              <div className="grid grid-cols-3 gap-1">
                {PAYMENT_OPTIONS.map(opt => (
                  <button key={opt.value}
                    onClick={() => setPaymentMethod(opt.value)}
                    className={cn(
                      'flex flex-col items-center gap-1 p-2 rounded-lg border text-xs font-medium transition-colors',
                      paymentMethod === opt.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:bg-muted/30 text-muted-foreground'
                    )}
                  >
                    {opt.icon}
                    <span className="whitespace-nowrap text-[10px]">{opt.value === 'cash' ? 'Cash' : opt.value === 'card' ? 'Card' : 'ණය'}</span>
                  </button>
                ))}
              </div>

              {/* Cash change calculator */}
              {paymentMethod === 'cash' && (
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">ලබාදෙන මුදල (Rs.)</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={tenderedAmount}
                      onChange={e => setTenderedAmount(e.target.value)}
                      className="px-3 mt-1"
                    />
                  </div>
                  {parsedTendered > 0 && (
                    <div className={cn(
                      'flex justify-between text-sm font-semibold p-2 rounded-lg',
                      changeAmount >= 0 ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'
                    )}>
                      <span>ඉතිරිය:</span>
                      <span>Rs. {changeAmount.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Total + Actions */}
          <Card>
            <CardContent className="pt-4 pb-4 space-y-3">
              <div className="space-y-1">
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-sm text-amber-500">
                    <span>වට්ටම</span>
                    <span>-Rs. {totalDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-xl">
                  <span>මුළු</span>
                  <span>Rs. {totalAmount.toFixed(2)}</span>
                </div>
                {isAdmin && totalProfit > 0 && (
                  <p className="text-xs text-green-500 text-right">ලාභය: Rs. {totalProfit.toFixed(2)}</p>
                )}
              </div>

              <Button
                className="w-full h-11 text-base font-semibold gap-2"
                disabled={cart.length === 0 || checkingOut}
                onClick={() => setShowPreview(true)}
              >
                <Eye className="w-4 h-4" />
                Preview &amp; Checkout
              </Button>

              <div className="grid grid-cols-2 gap-1.5">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs"
                  onClick={handleHold} disabled={cart.length === 0}>
                  <PauseCircle className="w-3.5 h-3.5" />Hold
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={openHeldBills}>
                  <PlayCircle className="w-3.5 h-3.5" />Resume
                </Button>
              </div>

              <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={openDayEnd}>
                <BarChart2 className="w-3.5 h-3.5" />දින අවසාන සාරාංශ
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Modals ── */}
      <InvoicePreviewModal
        open={showPreview} onClose={() => setShowPreview(false)} onConfirm={doCheckout}
        cart={cart} paymentMethod={paymentMethod}
        customerName={customerName} customerPhone={customerPhone}
        totalAmount={totalAmount} tenderedAmount={tenderedAmount} changeAmount={changeAmount}
        shopName={shopName} cashierName={profile?.username ?? ''} checkingOut={checkingOut}
      />
      <HeldBillsModal
        open={showHeld} onClose={() => setShowHeld(false)}
        heldBills={heldBills} onResume={resumeBill}
      />
      <DayEndModal
        open={showDayEnd} onClose={() => setShowDayEnd(false)} summary={dayEndSummary}
      />
      {isAdmin && (
        <QuickButtonsConfigModal
          open={showQBConfig} onClose={() => setShowQBConfig(false)}
          products={localProducts} currentIds={quickButtonIds}
          shopId={shopId} onSaved={setQuickButtonIds}
        />
      )}
    </AppLayout>
  );
}

// ─── Cart Line Item Component ──────────────────────────────────────────────
function CartLineItem({
  item, isAdmin, onSetQty, onSetDiscount, onRemove,
}: {
  item: ActiveCartItem;
  isAdmin: boolean;
  onSetQty: (qty: number) => void;
  onSetDiscount: (type: LineDiscountType, value: number) => void;
  onRemove: () => void;
}) {
  const [showDiscount, setShowDiscount] = useState(false);
  const [discType, setDiscType]         = useState<LineDiscountType>(item.lineDiscountType);
  const [discVal, setDiscVal]           = useState(String(item.lineDiscountValue || ''));
  // Local string state so user can type "1." or "0.5" freely
  const [qtyStr, setQtyStr]             = useState(fmtQty(item.qty, item.product.unit));

  // Keep local display in sync when parent qty changes externally (e.g. resume bill)
  const unit = item.product.unit;
  const step = qtyStep(unit);

  const commitQty = (raw: string) => {
    const v = parseFloat(raw);
    if (!isNaN(v) && v > 0) onSetQty(v);
    else setQtyStr(fmtQty(item.qty, unit)); // revert bad input
  };

  const applyDiscount = () => {
    const val = parseFloat(discVal) || 0;
    if (discType === 'percent' && val > 100) { toast.error('වට්ටම 1-100% ✓'); return; }
    const lineTotal = item.qty * item.product.price;
    if (discType === 'amount' && val > lineTotal) { toast.error('වට්ටම total ට වඩා වැඩිය'); return; }
    onSetDiscount(discType, val);
    setShowDiscount(false);
  };

  const subtotal = item.qty * item.product.price;

  return (
    <div className="p-2.5 rounded-lg border border-border bg-muted/20 space-y-1.5">
      {/* Row 1: name + qty + total + remove */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{item.product.name}</p>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground/70">{unit}</span>
            {' '}· Rs. {item.product.price.toFixed(2)}/{unit}
            {item.discountAmount > 0 && (
              <span className="text-amber-500 ml-1">-Rs.{item.discountAmount.toFixed(2)}</span>
            )}
          </p>
        </div>

        {/* Qty controls — wider input for float units */}
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="outline" size="icon" className="h-6 w-6"
            onClick={() => {
              const next = parseFloat((item.qty - step).toFixed(3));
              onSetQty(next);
              setQtyStr(fmtQty(next, unit));
            }}>
            <Minus className="w-3 h-3" />
          </Button>
          <Input
            type="number"
            min={step}
            step={step}
            value={qtyStr}
            onChange={e => setQtyStr(e.target.value)}
            onBlur={e => commitQty(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitQty(qtyStr); }}
            className={cn(
              'h-6 text-center text-sm px-1 font-semibold',
              isFloatUnit(unit) ? 'w-16' : 'w-10',
            )}
          />
          <Button variant="outline" size="icon" className="h-6 w-6"
            onClick={() => {
              const next = parseFloat((item.qty + step).toFixed(3));
              onSetQty(next);
              setQtyStr(fmtQty(next, unit));
            }}
            disabled={item.qty >= item.product.qty}>
            <Plus className="w-3 h-3" />
          </Button>
        </div>

        {/* Total */}
        <div className="w-16 text-right shrink-0">
          {item.discountAmount > 0 && (
            <p className="text-xs text-muted-foreground line-through">Rs.{subtotal.toFixed(0)}</p>
          )}
          <p className="font-semibold text-sm">Rs.{item.total.toFixed(2)}</p>
          {isAdmin && <p className="text-xs text-green-500">+{item.profit.toFixed(0)}</p>}
        </div>

        <Button variant="ghost" size="icon"
          className="h-6 w-6 text-destructive hover:text-destructive shrink-0"
          onClick={onRemove}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      {/* Badges + discount toggle */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {item.freeQty > 0 && (
          <Badge className="text-xs bg-green-500/15 text-green-600 border border-green-500/30 hover:bg-green-500/15 gap-1 h-5">
            <Gift className="w-3 h-3" />{fmtQty(item.freeQty, unit)} {unit} නොමිලේ
          </Badge>
        )}
        {item.discountAmount > 0 && (
          <Badge className="text-xs bg-amber-500/15 text-amber-600 border border-amber-500/30 hover:bg-amber-500/15 gap-1 h-5">
            <Tag className="w-3 h-3" />
            {item.lineDiscountType === 'percent' ? `${item.lineDiscountValue}%` : `Rs.${item.lineDiscountValue}`} discount
          </Badge>
        )}
        <button
          onClick={() => setShowDiscount(p => !p)}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 ml-auto"
        >
          <Percent className="w-3 h-3" />
          <span>{showDiscount ? 'Close' : 'Discount'}</span>
        </button>
      </div>

      {/* Inline discount form */}
      {showDiscount && (
        <div className="flex items-center gap-1.5 pt-1">
          <Select value={discType} onValueChange={v => setDiscType(v as LineDiscountType)}>
            <SelectTrigger className="h-7 w-20 text-xs px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="percent">%</SelectItem>
              <SelectItem value="amount">Rs.</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number"
            placeholder="0"
            value={discVal}
            onChange={e => setDiscVal(e.target.value)}
            className="h-7 px-2 text-xs flex-1 min-w-0"
            disabled={discType === 'none'}
          />
          <Button size="sm" className="h-7 px-2 text-xs" onClick={applyDiscount}>Apply</Button>
        </div>
      )}
    </div>
  );
}
