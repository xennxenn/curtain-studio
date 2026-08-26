// Persistent IndexedDB & Dual-Layer Storage Engine for Curtain Preview App
// Provides virtually unlimited storage capacity for fabric swatches, high-res images, and API keys.

const DB_NAME = "CurtainAppDB";
const DB_VERSION = 1;
const STORE_NAME = "keyval";

export const PERMANENT_KEYS = {
  GEMINI_API_KEY: "curtain_gemini_api_key_permanent",
  SETTINGS: "curtain_settings_backup_idb",
  JOBS: "curtain_jobs_permanent",
  WINDOWS: "curtain_windows_permanent",
  EMPLOYEES: "curtain_employees_permanent",
  SOLID_FABRICS: "swatches_solidFabricMaterials",
  SHEER_FABRICS: "swatches_sheerFabricMaterials",
  BLIND_MATERIALS: "swatches_blindMaterials",
  ROLLER_MATERIALS: "swatches_rollerMaterials",
  BLIND_TAPE_MATERIALS: "swatches_blindTapeMaterials",
  STYLE_MATERIALS: "swatches_styleMaterials",
  HEM_MATERIALS: "swatches_hemMaterials",
  TRACK_MATERIALS: "swatches_trackMaterials",
  ACCESSORY_MATERIALS: "swatches_accessoryMaterials",
};

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.reject(new Error("IndexedDB is not supported in this environment"));
  }
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };
      request.onerror = (event) => {
        console.error("IndexedDB open error:", (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }
  return dbPromise;
}

export async function idbGet<T = any>(key: string): Promise<T | undefined> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => resolve(undefined);
    });
  } catch (e) {
    console.warn(`[IndexedDB] Failed to get key "${key}":`, e);
    return undefined;
  }
}

export async function idbSet<T = any>(key: string, value: T): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = (e) => {
        console.warn(`[IndexedDB] Error putting key "${key}":`, e);
        reject(req.error);
      };
    });
  } catch (e) {
    console.warn(`[IndexedDB] Failed to set key "${key}":`, e);
  }
}

export async function idbDelete(key: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch (e) {
    console.warn(`[IndexedDB] Failed to delete key "${key}":`, e);
  }
}

// -------------------------------------------------------------
// DEDICATED GEMINI API KEY PERMANENT STORAGE
// -------------------------------------------------------------
export function getDedicatedGeminiApiKey(): string {
  try {
    if (typeof localStorage !== "undefined") {
      const key = localStorage.getItem(PERMANENT_KEYS.GEMINI_API_KEY);
      if (key && key.trim().length > 5) {
        return key.trim();
      }
    }
  } catch {}
  return "";
}

export async function getDedicatedGeminiApiKeyAsync(): Promise<string> {
  const fromLocal = getDedicatedGeminiApiKey();
  if (fromLocal) return fromLocal;
  try {
    const fromIdb = await idbGet<string>(PERMANENT_KEYS.GEMINI_API_KEY);
    if (fromIdb && fromIdb.trim().length > 5) {
      try {
        localStorage.setItem(PERMANENT_KEYS.GEMINI_API_KEY, fromIdb.trim());
      } catch {}
      return fromIdb.trim();
    }
  } catch {}
  return "";
}

export async function saveDedicatedGeminiApiKey(apiKey: string): Promise<void> {
  const cleanKey = (apiKey || "").trim();
  if (!cleanKey) {
    await removeDedicatedGeminiApiKey();
    return;
  }
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(PERMANENT_KEYS.GEMINI_API_KEY, cleanKey);
    }
  } catch (e) {
    console.warn("Failed to write API key to localStorage:", e);
  }
  await idbSet(PERMANENT_KEYS.GEMINI_API_KEY, cleanKey);
}

export async function removeDedicatedGeminiApiKey(): Promise<void> {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(PERMANENT_KEYS.GEMINI_API_KEY);
    }
  } catch {}
  await idbDelete(PERMANENT_KEYS.GEMINI_API_KEY);
}
