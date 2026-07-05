/**
 * SmartImportDialog — Universal Excel / CSV import for products.
 *
 * Features (mirrors the Python backend logic provided by the user):
 *  1. Universal column mapping — auto-detect ANY column name in 5 languages
 *     (English, Sinhala, Tamil, Chinese, Japanese)
 *  2. 3-step fuzzy detection: exact → Dice-coefficient similarity → partial substring
 *  3. Price / number string cleaning — strips Rs. $ /- , spaces etc.
 *  4. Auto-generate barcodes for rows with missing barcode
 *  5. Duplicate barcode guard (DB + within-batch)
 *  6. Inline error fixer — edit wrong rows right in the dialog and re-import
 *  7. Error log Excel download
 */
import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import {
  Upload, FileDown, Download, Loader2, CheckCircle2, XCircle,
  ChevronRight, Wand2, AlertTriangle, RefreshCw, Pencil, Check, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getExistingBarcodes, bulkInsertProducts } from '@/services/products';
import type { BulkProductRow } from '@/services/products';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImportError {
  row:     number;
  barcode: string;
  name:    string;
  price:   string;
  cost:    string;
  stock:   string;
  unit:    string;
  error:   string;
  // editable override values (filled by inline editor)
  fixName?:   string;
  fixPrice?:  string;
  fixCost?:   string;
  fixStock?:  string;
  fixUnit?:   string;
  fixBarcode?: string;
}

interface ImportResult {
  success: number;
  errors:  ImportError[];
}

interface DetectedMap {
  [excelCol: string]: string; // excelCol → standard field name
}

interface Props {
  open:    boolean;
  onOpenChange: (v: boolean) => void;
  shopId:  string;
  onDone:  () => void;
}

// ─── Universal Column Map (matches the Python universal_map) ─────────────────

const UNIVERSAL_MAP: Record<string, string[]> = {
  barcode: [
    'barcode', 'bar code', 'bar_code', 'code', 'item code', 'item_code',
    'product code', 'product_code', 'sku', 'ean', 'upc', 'scan code',
    'බාර්කෝඩ්', 'කේතය', 'භාණ්ඩ කේතය',
    'ஸ்கேன் குறியீடு', 'குறியீடு',
    '条码', '条形码', '商品编码',
    'コード', 'バーコード',
  ],
  name: [
    'name', 'item', 'product', 'item name', 'item_name', 'product name', 'product_name',
    'description', 'desc', 'title', 'goods', 'article',
    'නම', 'භාණ්ඩය', 'භාණ්ඩ නම', 'විස්තරය',
    'பெயர்', 'பொருள்', 'பொருள் பெயர்',
    '名称', '品名', '商品名', '货品名',
    '名前', '商品名', '品目',
  ],
  selling_price: [
    'selling_price', 'selling price', 'price', 'sell price', 'sell_price',
    'sale price', 'sale_price', 'mrp', 'retail price', 'retail_price',
    'unit price', 'unit_price', 'sp', 'rs', 'rs.', 'amount',
    'මිල', 'විකිණුම් මිල', 'වි.මිල', 'විකිණීමේ මිල',
    'விலை', 'விற்பனை விலை', 'விற்பனை_விலை',
    '价格', '售价', '销售价', '单价',
    '販売価格', '売値', '価格',
  ],
  cost_price: [
    'cost_price', 'cost price', 'cost', 'buy price', 'buy_price',
    'purchase price', 'purchase_price', 'wholesale price', 'wholesale_price',
    'cp', 'buying price',
    'ගැනුම් මිල', 'ග.මිල', 'මිලදී ගැනීමේ මිල',
    'கொள்முதல் விலை', 'கொள்முதல்_விலை',
    '成本价', '进价', '采购价',
    '仕入れ価格', '原価',
  ],
  stock: [
    'stock', 'qty', 'quantity', 'on hand', 'on_hand', 'balance',
    'inventory', 'available', 'count', 'units', 'opening stock', 'opening_stock',
    'තොගය', 'ප්‍රමාණය', 'ස්ටොක්',
    'இருப்பு', 'அளவு', 'கையிருப்பு',
    '库存', '数量', '在库',
    '在庫', '数量', '残量',
  ],
  category: [
    'category', 'cat', 'type', 'group', 'department', 'section', 'class',
    'වර්ගය', 'කාණ්ඩය', 'ගොනුව',
    'பிரிவு', 'வகை',
    '类别', '分类', '品类',
    'カテゴリ', '分類',
  ],
  unit: [
    'unit', 'uom', 'unit of measure', 'measure', 'pack size', 'pack_size',
    'ඒකකය',
    'அலகு',
    '单位',
    '単位',
  ],
};

// ─── Fuzzy helpers ─────────────────────────────────────────────────────────────

/** Dice-coefficient bigram similarity (mirrors Python difflib.SequenceMatcher ratio) */
function diceSim(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bg = a.slice(i, i + 2);
    bigrams.set(bg, (bigrams.get(bg) ?? 0) + 1);
  }
  let hit = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bg = b.slice(i, i + 2);
    const cnt = bigrams.get(bg) ?? 0;
    if (cnt > 0) { bigrams.set(bg, cnt - 1); hit++; }
  }
  return (2 * hit) / (a.length + b.length - 2);
}

function getCloseMatches(word: string, candidates: string[], cutoff = 0.6): string[] {
  return candidates
    .map(c => ({ c, s: diceSim(word, c) }))
    .filter(x => x.s >= cutoff)
    .sort((a, b) => b.s - a.s)
    .map(x => x.c);
}

/**
 * detectColumns — 3-step column detection matching the Python backend:
 *   Step 1: exact keyword match
 *   Step 2: fuzzy match (Dice ≥ 0.6)
 *   Step 3: partial substring containment
 * Returns: { excelColumn → standardFieldName }
 */
function detectColumns(rawHeaders: string[]): DetectedMap {
  const headers = rawHeaders.map(h => h.toLowerCase().trim());
  const result: DetectedMap = {};
  const usedHeaders = new Set<string>();

  for (const [standard, keywords] of Object.entries(UNIVERSAL_MAP)) {
    // Already mapped?
    if (Object.values(result).includes(standard)) continue;

    // Step 1 — exact keyword match
    let found = false;
    for (const kw of keywords) {
      const idx = headers.indexOf(kw.toLowerCase());
      if (idx !== -1 && !usedHeaders.has(headers[idx])) {
        result[rawHeaders[idx]] = standard;
        usedHeaders.add(headers[idx]);
        found = true;
        break;
      }
    }
    if (found) continue;

    // Step 2 — fuzzy match against all headers (Dice ≥ 0.6)
    const unmatched = headers.filter(h => !usedHeaders.has(h));
    // Try fuzzy match between standard name and each header
    const fuzzyByStandard = getCloseMatches(standard, unmatched, 0.6);
    if (fuzzyByStandard.length > 0) {
      const h = fuzzyByStandard[0];
      const origIdx = headers.indexOf(h);
      result[rawHeaders[origIdx]] = standard;
      usedHeaders.add(h);
      continue;
    }
    // Also try each keyword against each header
    outer:
    for (const kw of keywords) {
      for (const h of unmatched) {
        if (diceSim(kw.toLowerCase(), h) >= 0.6) {
          const origIdx = headers.indexOf(h);
          result[rawHeaders[origIdx]] = standard;
          usedHeaders.add(h);
          found = true;
          break outer;
        }
      }
    }
    if (found) continue;

    // Step 3 — partial substring containment
    outer3:
    for (const h of unmatched) {
      for (const kw of keywords) {
        const kwL = kw.toLowerCase();
        if (kwL.includes(h) || h.includes(kwL)) {
          const origIdx = headers.indexOf(h);
          result[rawHeaders[origIdx]] = standard;
          usedHeaders.add(h);
          break outer3;
        }
      }
    }
  }

  return result;
}

// ─── Number / price string cleaner (mirrors Python re.sub(r'[^\d.]', '', s)) ─

function cleanNumber(raw: unknown): number {
  if (raw === null || raw === undefined || raw === '') return NaN;
  const str = String(raw).replace(/[^\d.]/g, '').trim(); // strip Rs, $, /-, commas, spaces
  // Handle multiple dots: keep only first
  const parts = str.split('.');
  const cleaned = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : str;
  return parseFloat(cleaned);
}

// ─── Barcode generator ────────────────────────────────────────────────────────

function generateBarcode(existing: Set<string>): string {
  for (let i = 0; i < 1000; i++) {
    const bc = '200' + String(Math.floor(100_000_000 + Math.random() * 900_000_000));
    if (!existing.has(bc)) { existing.add(bc); return bc; }
  }
  throw new Error('Barcode generate කළ නොහැකිය');
}

// ─── Error log export ─────────────────────────────────────────────────────────

function downloadErrorLog(errors: ImportError[]) {
  const rows = errors.map(e => ({
    'Row':       e.row,
    'Barcode':   e.barcode,
    'නාමය':     e.name,
    'මිල':      e.price,
    'ගැ.මිල':  e.cost,
    'Stock':     e.stock,
    'Unit':      e.unit,
    'දෝෂය':     e.error,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'දෝෂ ලොගය');
  XLSX.writeFile(wb, `import_errors_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`);
}

// ─── Template download ────────────────────────────────────────────────────────

function downloadTemplate() {
  const sample = [
    { name: 'කොකා කෝලා 330ml', selling_price: 250, cost_price: 200, barcode: '', stock: 48, unit: 'bottle', category: 'Beverages' },
    { name: 'Milo 400g',       selling_price: 680, cost_price: 580, barcode: '', stock: 24, unit: 'pcs',    category: 'Food' },
  ];
  const ws = XLSX.utils.json_to_sheet(sample);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  XLSX.writeFile(wb, 'smart_import_template.xlsx');
}

// ─── Inline Error Row Editor ──────────────────────────────────────────────────

function ErrorRowEditor({
  err,
  onChange,
}: {
  err: ImportError;
  onChange: (updated: ImportError) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [vals, setVals] = useState({
    name:    err.fixName    ?? err.name,
    price:   err.fixPrice   ?? err.price,
    cost:    err.fixCost    ?? err.cost,
    stock:   err.fixStock   ?? err.stock,
    barcode: err.fixBarcode ?? err.barcode,
  });

  const save = () => {
    onChange({
      ...err,
      fixName:    vals.name,
      fixPrice:   vals.price,
      fixCost:    vals.cost,
      fixStock:   vals.stock,
      fixBarcode: vals.barcode,
    });
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="flex items-start gap-2 py-2">
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground shrink-0">Row {err.row}</span>
            <span className="text-xs font-medium truncate max-w-[10rem]">
              {err.fixName ?? err.name}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              Rs.{err.fixPrice ?? err.price}
            </span>
          </div>
          <p className="text-xs text-destructive flex items-start gap-1">
            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
            {err.error}
          </p>
        </div>
        <Button
          variant="ghost" size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => setEditing(true)}
          title="දෝෂය නිවැරදි කරන්න"
        >
          <Pencil className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="py-2 space-y-1.5 bg-muted/30 rounded-lg px-2">
      <p className="text-xs font-medium text-foreground">Row {err.row} — නිවැරදි කරන්න</p>
      <div className="grid grid-cols-2 gap-1.5">
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground">නාමය *</label>
          <Input
            value={vals.name}
            onChange={e => setVals(v => ({ ...v, name: e.target.value }))}
            className="h-7 text-xs px-2"
            placeholder="භාණ්ඩ නාමය"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">මිල (Rs.) *</label>
          <Input
            value={vals.price}
            onChange={e => setVals(v => ({ ...v, price: e.target.value }))}
            className="h-7 text-xs px-2"
            placeholder="250"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">ගැ.මිල</label>
          <Input
            value={vals.cost}
            onChange={e => setVals(v => ({ ...v, cost: e.target.value }))}
            className="h-7 text-xs px-2"
            placeholder="200"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Stock</label>
          <Input
            value={vals.stock}
            onChange={e => setVals(v => ({ ...v, stock: e.target.value }))}
            className="h-7 text-xs px-2"
            placeholder="0"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Barcode</label>
          <Input
            value={vals.barcode}
            onChange={e => setVals(v => ({ ...v, barcode: e.target.value }))}
            className="h-7 text-xs px-2 font-mono"
            placeholder="හිස් නම් auto"
          />
        </div>
      </div>
      <div className="flex gap-1.5 justify-end pt-0.5">
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEditing(false)}>
          <X className="w-3 h-3" />
        </Button>
        <Button size="sm" className="h-7 px-2 gap-1" onClick={save}>
          <Check className="w-3 h-3" />
          සුරකින්න
        </Button>
      </div>
    </div>
  );
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────

type Step = 'idle' | 'preview' | 'importing' | 'results';

export function SmartImportDialog({ open, onOpenChange, shopId, onDone }: Props) {
  const [step,          setStep]          = useState<Step>('idle');
  const [file,          setFile]          = useState<File | null>(null);
  const [detectedMap,   setDetectedMap]   = useState<DetectedMap>({});
  const [result,        setResult]        = useState<ImportResult | null>(null);
  const [errorRows,     setErrorRows]     = useState<ImportError[]>([]);
  const [fixImporting,  setFixImporting]  = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [parsedRows,    setParsedRows]    = useState<Record<string, any>[]>([]);

  const reset = () => {
    setStep('idle'); setFile(null); setDetectedMap({});
    setResult(null); setErrorRows([]); setParsedRows([]);
  };

  const handleClose = (v: boolean) => {
    if (step === 'importing' || fixImporting) return;
    if (!v) reset();
    onOpenChange(v);
  };

  // ── Step 1: file chosen → preview column detection ─────────────────────────
  const handleFileChange = useCallback(async (chosen: File | null) => {
    if (!chosen) return;
    setFile(chosen);
    try {
      const buf   = await chosen.arrayBuffer();
      const wb    = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (rows.length === 0) { toast.error('File එකේ දත්ත නොමැත'); return; }

      const headers = Object.keys(rows[0]);
      const detected = detectColumns(headers);
      setDetectedMap(detected);
      setParsedRows(rows);
      setStep('preview');
    } catch {
      toast.error('File කියවීමේ දෝෂය — Excel හෝ CSV file දෙන්න');
    }
  }, []);

  // ── Step 2: do the actual import ───────────────────────────────────────────
  const runImport = useCallback(async (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rows: Record<string, any>[],
    colMap: DetectedMap,
    existingBarcodes: Set<string>,
    batchBarcodes: Set<string>,
  ): Promise<ImportResult> => {
    // Reverse map: standard field → excel column name
    const rev: Record<string, string> = {};
    for (const [exCol, std] of Object.entries(colMap)) rev[std] = exCol;

    // Helper: get value by standard field name
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const get = (row: Record<string, any>, field: string) => {
      const col = rev[field];
      if (col && col in row) return row[col];
      // Fallback: case-insensitive key search
      const match = Object.keys(row).find(k => k.toLowerCase().trim() === field.toLowerCase());
      return match ? row[match] : '';
    };

    const valid: BulkProductRow[] = [];
    const errors: ImportError[]   = [];

    rows.forEach((row, idx) => {
      const rowNum = idx + 2;
      const rawName    = get(row, 'name');
      const rawPrice   = get(row, 'selling_price');
      const rawCost    = get(row, 'cost_price');
      const rawStock   = get(row, 'stock');
      const rawBarcode = get(row, 'barcode');
      const rawUnit    = get(row, 'unit');

      try {
        const name = String(rawName ?? '').trim();
        if (!name || name.toLowerCase() === 'nan') throw new Error('භාණ්ඩ නාමය හිස්ය');

        const sellingPrice = cleanNumber(rawPrice);
        if (isNaN(sellingPrice) || sellingPrice < 0)
          throw new Error(`විකිණුම් මිල වැරදියි: "${rawPrice}"`);
        // If selling price is 0 and cost exists, use cost as fallback
        const effectivePrice = sellingPrice > 0 ? sellingPrice : (isNaN(cleanNumber(rawCost)) ? 0 : cleanNumber(rawCost));
        if (effectivePrice <= 0)
          throw new Error(`මිල ශූන්‍යයි — "${rawPrice}" — 0 ට වඩා වැඩි මිලක් දෙන්න`);

        const costPrice = isNaN(cleanNumber(rawCost)) ? 0 : Math.max(0, cleanNumber(rawCost));
        const stock     = isNaN(cleanNumber(rawStock)) ? 0 : Math.max(0, cleanNumber(rawStock));
        let   barcode   = String(rawBarcode ?? '').trim().replace(/\.0$/, ''); // strip Excel decimal
        const unit      = String(rawUnit ?? 'pcs').trim() || 'pcs';

        // Auto-generate if missing, blank, or nan
        if (!barcode || barcode.toLowerCase() === 'nan' || barcode === '0') {
          barcode = generateBarcode(batchBarcodes);
        }
        // Auto-generate if duplicate in DB or within this batch — never reject
        if (existingBarcodes.has(barcode) || batchBarcodes.has(barcode)) {
          barcode = generateBarcode(batchBarcodes);
        }

        batchBarcodes.add(barcode);
        valid.push({
          barcode, name,
          unit:    unit || 'pcs',
          cost:    costPrice,
          price:   effectivePrice,
          qty:     stock,
          expiry:  '',
          shop_id: shopId || '00000000-0000-0000-0000-000000000001',
        });
      } catch (err) {
        errors.push({
          row:     rowNum,
          barcode: String(rawBarcode ?? '—').trim(),
          name:    String(rawName    ?? '—').trim(),
          price:   String(rawPrice   ?? ''),
          cost:    String(rawCost    ?? ''),
          stock:   String(rawStock   ?? ''),
          unit:    String(rawUnit    ?? 'pcs'),
          error:   err instanceof Error ? err.message : String(err),
        });
      }
    });

    if (valid.length > 0) await bulkInsertProducts(valid);
    return { success: valid.length, errors };
  }, [shopId]);

  const handleImport = useCallback(async () => {
    setStep('importing');
    try {
      const existingBarcodes = await getExistingBarcodes(shopId || undefined);
      const batchBarcodes    = new Set<string>(existingBarcodes);
      const res = await runImport(parsedRows, detectedMap, existingBarcodes, batchBarcodes);
      setResult(res);
      setErrorRows(res.errors);
      setStep('results');
      if (res.success > 0) {
        toast.success(`${res.success} භාණ්ඩ import විය`);
        onDone();
      }
      if (res.errors.length > 0) toast.warning(`${res.errors.length} rows දෝෂ — නිවැරදි කරන්න`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import දෝෂය');
      setStep('preview');
    }
  }, [parsedRows, detectedMap, shopId, runImport, onDone]);

  // ── Fix errors and re-import those rows ───────────────────────────────────
  const handleFixImport = useCallback(async () => {
    const fixable = errorRows.filter(e => (e.fixName ?? e.name).trim());
    if (fixable.length === 0) { toast.error('නිවැරදි කිරීමට rows නොමැත'); return; }

    setFixImporting(true);
    try {
      // Build synthetic rows from the edited error data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const syntheticRows: Record<string, any>[] = fixable.map(e => ({
        name:          e.fixName    ?? e.name,
        selling_price: e.fixPrice   ?? e.price,
        cost_price:    e.fixCost    ?? e.cost,
        stock:         e.fixStock   ?? e.stock,
        barcode:       e.fixBarcode ?? e.barcode,
        unit:          e.fixUnit    ?? e.unit,
      }));

      // For these rows the colMap is already standard names → pass identity
      const identityMap: DetectedMap = {
        name: 'name', selling_price: 'selling_price', cost_price: 'cost_price',
        stock: 'stock', barcode: 'barcode', unit: 'unit',
      };

      const existingBarcodes = await getExistingBarcodes(shopId || undefined);
      const batchBarcodes    = new Set<string>(existingBarcodes);
      const res = await runImport(syntheticRows, identityMap, existingBarcodes, batchBarcodes);

      // Merge: remove fixed errors, keep still-failing ones
      const nowFixed = fixable.map((_, i) => i);
      const stillFailing = res.errors;
      const unchanged    = errorRows.filter(e => !fixable.includes(e));
      setErrorRows([...unchanged, ...stillFailing]);
      setResult(prev => ({
        success: (prev?.success ?? 0) + res.success,
        errors:  [...unchanged, ...stillFailing],
      }));

      if (res.success > 0) {
        toast.success(`${res.success} rows fix කර import විය`);
        onDone();
      }
      if (stillFailing.length > 0) toast.warning(`${stillFailing.length} rows තවමත් දෝෂ ඇත`);
      else if (res.success > 0)    toast.success('සියලු දෝෂ නිවැරදි කළා!');

      // silence "unused" warning
      void nowFixed;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fix import දෝෂය');
    } finally {
      setFixImporting(false);
    }
  }, [errorRows, shopId, runImport, onDone]);

  // ─── Render ────────────────────────────────────────────────────────────────

  const stdLabel: Record<string, string> = {
    name: 'නාමය', selling_price: 'විකිණුම් මිල', cost_price: 'ගැනුම් මිල',
    stock: 'Stock', barcode: 'Barcode', unit: 'ඒකකය', category: 'Category',
  };

  const detectedEntries = Object.entries(detectedMap);
  const hasName  = Object.values(detectedMap).includes('name');
  const hasPrice = Object.values(detectedMap).includes('selling_price');
  const canImport = hasName && hasPrice;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-primary" />
            Smart Excel Import — භාණ්ඩ
          </DialogTitle>
        </DialogHeader>

        {/* ── Step indicator ─────────────────────────────── */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {(['idle', 'preview', 'results'] as const).map((s, i) => (
            <span key={s} className="flex items-center gap-1">
              <span className={cn(
                'w-5 h-5 rounded-full flex items-center justify-center font-medium',
                step === s
                  ? 'bg-primary text-primary-foreground'
                  : (step === 'results' && i < 2) || (step === 'preview' && i < 1)
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground',
              )}>
                {i + 1}
              </span>
              <span className={step === s ? 'text-foreground font-medium' : ''}>
                {s === 'idle' ? 'File' : s === 'preview' ? 'Column Map' : 'ප්‍රතිඵල'}
              </span>
              {i < 2 && <ChevronRight className="w-3 h-3" />}
            </span>
          ))}
        </div>

        <Separator />

        {/* ══════════════════════════════════════════════════ */}
        {/* STEP: idle — file upload                          */}
        {/* ══════════════════════════════════════════════════ */}
        {(step === 'idle' || step === 'preview') && (
          <div className="space-y-4">
            {/* Template tip */}
            <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-3">
              <FileDown className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-sm font-medium">ඕනෑම Excel format ✓</p>
                <p className="text-xs text-muted-foreground text-pretty">
                  Sinhala, English, Tamil, Chinese, Japanese column names detect කරයි.
                  <span className="font-semibold"> නාමය + මිල </span>
                  අනිවාර්ය. Barcode නොමැත්නම් auto-generate.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate} className="shrink-0 gap-1 h-8">
                <Download className="w-3.5 h-3.5" />
                Template
              </Button>
            </div>

            {/* Drop zone */}
            <div>
              <label className="text-sm text-foreground font-normal mb-1.5 block">
                Excel / CSV file
              </label>
              <label className={cn(
                'flex flex-col items-center justify-center w-full h-28 rounded-lg border-2 border-dashed cursor-pointer transition-colors',
                file
                  ? 'border-primary/60 bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-muted/30',
              )}>
                <input
                  type="file" accept=".xlsx,.xls,.csv" className="sr-only"
                  onChange={e => handleFileChange(e.target.files?.[0] ?? null)}
                />
                {file ? (
                  <div className="flex flex-col items-center gap-1 px-4 text-center">
                    <CheckCircle2 className="w-6 h-6 text-primary" />
                    <p className="text-sm font-medium truncate max-w-xs">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB — {parsedRows.length} rows</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <Upload className="w-6 h-6" />
                    <p className="text-sm">Click කර file තෝරන්න</p>
                    <p className="text-xs">.xlsx, .xls, .csv</p>
                  </div>
                )}
              </label>
            </div>

            {/* Column mapping preview */}
            {step === 'preview' && detectedEntries.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5 text-primary" />
                  <p className="text-sm font-medium">Auto-Detected Columns</p>
                </div>
                <div className="rounded-lg border divide-y text-sm overflow-hidden">
                  {detectedEntries.map(([exCol, std]) => (
                    <div key={exCol} className="flex items-center gap-2 px-3 py-2">
                      <span className="font-mono text-xs text-muted-foreground flex-1 truncate">{exCol}</span>
                      <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                      <Badge
                        variant={std === 'name' || std === 'selling_price' ? 'default' : 'secondary'}
                        className="text-xs shrink-0"
                      >
                        {stdLabel[std] ?? std}
                      </Badge>
                    </div>
                  ))}
                </div>

                {!canImport && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">අනිවාර්ය columns හොයාගත නොහැකිය</p>
                      <p>
                        {!hasName  && '"නාමය / Name / item_name" '}
                        {!hasPrice && '"මිල / price / selling_price" '}
                        column Excel file එකේ ඇතිදැයි බලන්න.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/* STEP: importing — spinner                         */}
        {/* ══════════════════════════════════════════════════ */}
        {step === 'importing' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {parsedRows.length} rows import කරමින්...
            </p>
          </div>
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/* STEP: results                                      */}
        {/* ══════════════════════════════════════════════════ */}
        {step === 'results' && result && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-muted/20 p-3 flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-green-500 shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{result.success}</p>
                  <p className="text-xs text-muted-foreground">සාර්ථකව import</p>
                </div>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3 flex items-center gap-3">
                <XCircle className="w-8 h-8 text-destructive shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-destructive">{errorRows.length}</p>
                  <p className="text-xs text-muted-foreground">දෝෂ rows</p>
                </div>
              </div>
            </div>

            {/* Error editor */}
            {errorRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <Pencil className="w-3.5 h-3.5 text-amber-500" />
                    දෝෂ Rows — Inline Edit කරන්න
                  </p>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => downloadErrorLog(errorRows)}
                    className="gap-1 h-7 text-xs"
                  >
                    <Download className="w-3 h-3" />
                    Error Log
                  </Button>
                </div>
                <div className="max-h-60 overflow-y-auto rounded-lg border divide-y bg-card px-3">
                  {errorRows.map((err, i) => (
                    <ErrorRowEditor
                      key={`${err.row}-${i}`}
                      err={err}
                      onChange={updated => {
                        setErrorRows(prev => prev.map((e, j) => j === i ? updated : e));
                      }}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  <Pencil className="w-3 h-3 inline mr-1" />
                  Edit icon click කර row fix කරන්න, ඉන්පසු "Fix & Import" click කරන්න.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ─── Footer buttons ─────────────────────────────── */}
        <DialogFooter className="gap-2 flex-wrap">
          {step !== 'importing' && (
            <Button variant="outline" onClick={() => handleClose(false)} disabled={fixImporting}>
              වසන්න
            </Button>
          )}

          {step === 'preview' && (
            <>
              <Button
                variant="ghost" size="sm"
                onClick={() => { setFile(null); setStep('idle'); setDetectedMap({}); }}
                className="gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                නව File
              </Button>
              <Button
                onClick={handleImport}
                disabled={!canImport || step !== 'preview'}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                Import කරන්න ({parsedRows.length} rows)
              </Button>
            </>
          )}

          {step === 'results' && errorRows.length > 0 && (
            <Button
              onClick={handleFixImport}
              disabled={fixImporting}
              className="gap-2"
              variant="default"
            >
              {fixImporting
                ? <><Loader2 className="w-4 h-4 animate-spin" />Fixing…</>
                : <><RefreshCw className="w-4 h-4" />Fix &amp; Import ({errorRows.length} rows)</>
              }
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
