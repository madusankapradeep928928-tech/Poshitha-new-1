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

// ─── Invoice Receipt (80mm Thermal Receipt Format) ──────────────────────────
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
    <div className="max-w-md mx-auto space-y-4 print:m-0 print:p-0">
      {/* Screen Controls (Hidden during printing) */}
      <Card className="print:hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-green-500">
            <CheckCircle2 className="w-5 h-5" />
            <CardTitle className="text-lg text-balance">Invoice සාර්ථකව නිකුත් කෙරිණ</CardTitle>
          </div>
        </CardHeader>
        <CardFooter className="gap-2 flex-wrap">
          <Button onClick={onPrint} className="gap-2 bg-primary text-white w-full sm:w-auto">
            <Printer className="w-4 h-4" /> Print Bill
          </Button>
          <Button variant="outline" onClick={onNew} className="gap-2 w-full sm:w-auto">
            <RotateCcw className="w-4 h-4" /> නව Bill
          </Button>
        </CardFooter>
      </Card>

      {/* Thermal Bill View */}
      <div id="print-invoice" className="w-[80mm] mx-auto p-4 bg-white text-black font-mono text-xs leading-tight print:p-2 print:w-full">
        {/* Shop header */}
        <div className="text-center mb-4">
          <h2 className="text-base font-bold uppercase tracking-wider">{shopName}</h2>
          <p className="text-[10px] text-zinc-700">LMP Complex, Bandaranayake Street, Alawwa</p>
          <p className="text-[10px] text-zinc-700">Tel: 0715600215</p>
          <p className="text-[10px] text-zinc-700">Email: anuaracchigeinfo@gmail.com</p>
        </div>

        {/* Invoice Meta Data */}
        <div className="space-y-0.5 border-b border-dashed border-zinc-400 pb-2 mb-2">
          <div className="flex justify-between">
            <span>Invoice No:</span>
            <span className="font-bold">#{invoice.invoice_no}</span>
          </div>
          <div className="flex justify-between">
            <span>Date:</span>
            <span>{new Date(invoice.created_at).toLocaleString('si-LK')}</span>
          </div>
          <div className="flex justify-between">
            <span>Cashier:</span>
            <span>{invoice.cashier_username}</span>
          </div>
          {invoice.customer_name && (
            <div className="flex justify-between">
              <span>Customer:</span>
              <span>{invoice.customer_name}</span>
            </div>
          )}
          {invoice.customer_phone && (
            <div className="flex justify-between">
              <span>Phone:</span>
              <span>{invoice.customer_phone}</span>
            </div>
          )}
        </div>

        {/* Table Headers */}
        <div className="flex font-bold border-b border-dashed border-zinc-400 pb-1 mb-1">
          <span className="w-[55%]">Item Description</span>
          <span className="w-[20%] text-center">Qty</span>
          <span className="w-[25%] text-right">Amount</span>
        </div>

        {/* Items List */}
        <div className="space-y-1 border-b border-dashed border-zinc-400 pb-2 mb-2">
          {invoice.items?.map(item => (
            <div key={item.id} className="space-y-0.5">
              <div className="flex items-start">
                <span className="w-[55%] truncate pr-1">{item.product_name}</span>
                <span className="w-[20%] text-center">
                  {fmtQty(Number(item.qty), item.unit ?? 'pcs')}
                </span>
                <span className="w-[25%] text-right">{item.total.toFixed(2)}</span>
              </div>
              <p className="text-[10px] text-zinc-600 pl-2">
                Rs. {item.price_per_unit.toFixed(2)} each
              </p>
              {item.free_qty > 0 && (
                <p className="text-[10px] text-zinc-600 pl-2">+ {fmtQty(Number(item.free_qty), item.unit ?? 'pcs')} Free</p>
              )}
              {item.discount_amount > 0 && (
                <p className="text-[10px] text-zinc-600 pl-2">- Rs. {item.discount_amount.toFixed(2)} Discount</p>
              )}
            </div>
          ))}
        </div>

        {/* Financials Summary */}
        <div className="space-y-1 text-right border-b border-dashed border-zinc-400 pb-2 mb-2 font-bold">
          <div className="flex justify-between">
            <span className="font-normal text-zinc-600">Subtotal:</span>
            <span>{(invoice.total_amount + (invoice.items?.reduce((s, i) => s + i.discount_amount, 0) || 0)).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-normal text-zinc-600">Total Discount:</span>
            <span>{(invoice.items?.reduce((s, i) => s + i.discount_amount, 0) || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm pt-1 border-t border-dotted border-zinc-300">
            <span>GRAND TOTAL:</span>
            <span>{invoice.total_amount.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Details */}
        <div className="space-y-0.5 mb-4">
          <div className="flex justify-between">
            <span>Payment Method:</span>
            <span className="font-bold uppercase">{PAYMENT_LABELS[invoice.payment_method]}</span>
          </div>
          {invoice.tendered_amount != null && (
            <>
              <div className="flex justify-between">
                <span>Tendered Amount:</span>
                <span className="font-bold">{invoice.tendered_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-0.5">
                <span>Balance Due:</span>
                <span>{(invoice.change_amount ?? 0).toFixed(2)}</span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="text-center pt-2 border-t border-dashed border-zinc-400">
          <p className="font-bold">Total Items Sold: {invoice.items?.length || 0}</p>
          <p className="mt-1 text-[11px] tracking-wide">Thank you, Come Again!</p>
        </div>
      </div>
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
  const totalItems     = cart.length;   
  const totalDiscount  = cart.reduce((s, c) => s + c.discountAmount, 0);
  const totalFreeItems = cart.reduce((s, c) => s + c.freeQty, 0);
  const parsedTendered = parseFloat(tenderedAmount) || 0;
  const changeAmount   = paymentMethod === 'cash' ? Math.max(0, parsedTendered - totalAmount) : 0;

  // Load products & quick button config
  useEffect(() => {
    async function loadProducts() {
      if (isOnline) {
        try {
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
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
