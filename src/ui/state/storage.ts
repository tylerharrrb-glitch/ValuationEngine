/**
 * Client-side storage (spec Part 10). Saved valuations live in this browser's IndexedDB only;
 * nothing is sent to a server. JSON export / import lets the user move them.
 */
import type { CompanyData } from '../../domain/company';
import type { Assumptions } from '../../domain/assumptions';
import type { RatesSnapshot } from '../../domain/rates';
import type { SecondaryInputs } from '../../domain/secondary';

export interface SavedValuation {
  id: string;
  name: string;
  savedAt: string;
  company: CompanyData;
  assumptions: Assumptions;
  secondary: SecondaryInputs;
  snapshot: RatesSnapshot;
}

const DB = 'wolf-v2';
const STORE = 'valuations';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    t.oncomplete = () => db.close();
  });
}

export const listSaved = () => tx<SavedValuation[]>('readonly', (s) => s.getAll() as IDBRequest<SavedValuation[]>);
export const saveValuation = (v: SavedValuation) => tx<IDBValidKey>('readwrite', (s) => s.put(v));
export const deleteSaved = (id: string) => tx<undefined>('readwrite', (s) => s.delete(id) as IDBRequest<undefined>);

/** Removes every saved valuation and every WOLF key in localStorage. */
export async function clearAllLocalData(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
  try {
    // Includes keys left by the pre-v2 app: wolf_valuations, wolf_valuation_state, wolf_user, fmp_api_key.
    for (const k of Object.keys(localStorage)) if (k.startsWith('wolf') || k === 'fmp_api_key') localStorage.removeItem(k);
  } catch {
    /* storage unavailable */
  }
}

export function downloadBlob(data: BlobPart, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readJsonFile<T>(file: File): Promise<T> {
  return file.text().then((t) => JSON.parse(t) as T);
}
