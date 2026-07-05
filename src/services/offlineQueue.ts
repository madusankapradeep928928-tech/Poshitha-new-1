/**
 * Offline sales queue — IndexedDB (via idb)
 * Pending sales are stored here when the device is offline and
 * automatically synced once the connection is restored.
 */
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { PaymentMethod } from '@/types/index';

// ─── Schema ──────────────────────────────────────────────────────────────────
export interface OfflineCartItem {
  product_id: string;
  barcode: string;
  product_name: string;
  unit: string;
  unit_price: number;
  cost: number;
  qty: number;
  free_qty: number;
  discount_amount: number;
  total: number;
  profit: number;
}

export interface OfflineSale {
  id: string;                // crypto.randomUUID()
  items: OfflineCartItem[];
  total_amount: number;
  payment_method: PaymentMethod;
  cashier_id: string;
  cashier_username: string;
  branch_id: string | null;
  shop_id: string;
  queued_at: string;         // ISO string
  sync_attempts: number;
}

interface PoshithaDB extends DBSchema {
  pending_sales: {
    key: string;
    value: OfflineSale;
    indexes: { by_queued_at: string };
  };
  product_cache: {
    key: string;
    value: { id: string; data: unknown; cached_at: string };
  };
}

// ─── DB singleton ─────────────────────────────────────────────────────────────
let dbPromise: Promise<IDBPDatabase<PoshithaDB>> | null = null;

function getDB(): Promise<IDBPDatabase<PoshithaDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PoshithaDB>('poshitha-offline', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('pending_sales')) {
          const store = db.createObjectStore('pending_sales', { keyPath: 'id' });
          store.createIndex('by_queued_at', 'queued_at');
        }
        if (!db.objectStoreNames.contains('product_cache')) {
          db.createObjectStore('product_cache', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

// ─── Pending Sales API ────────────────────────────────────────────────────────
export async function enqueueSale(sale: Omit<OfflineSale, 'id' | 'queued_at' | 'sync_attempts'>): Promise<string> {
  const db = await getDB();
  const id = crypto.randomUUID();
  const entry: OfflineSale = {
    ...sale,
    id,
    queued_at: new Date().toISOString(),
    sync_attempts: 0,
  };
  await db.put('pending_sales', entry);
  return id;
}

export async function getPendingSales(): Promise<OfflineSale[]> {
  const db = await getDB();
  return db.getAllFromIndex('pending_sales', 'by_queued_at');
}

export async function removePendingSale(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('pending_sales', id);
}

export async function incrementSyncAttempts(id: string): Promise<void> {
  const db = await getDB();
  const sale = await db.get('pending_sales', id);
  if (sale) {
    sale.sync_attempts += 1;
    await db.put('pending_sales', sale);
  }
}

export async function getPendingCount(): Promise<number> {
  const db = await getDB();
  return db.count('pending_sales');
}

// ─── Product Cache API ────────────────────────────────────────────────────────
export async function cacheProducts(products: unknown[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('product_cache', 'readwrite');
  // Clear old cache first
  await tx.store.clear();
  await tx.store.put({ id: 'all', data: products, cached_at: new Date().toISOString() });
  await tx.done;
}

export async function getCachedProducts<T>(): Promise<T[] | null> {
  const db = await getDB();
  const entry = await db.get('product_cache', 'all');
  if (!entry) return null;
  return entry.data as T[];
}
