import { db, storage } from "./firebase";
import { ref as sRef, uploadString, getDownloadURL } from "firebase/storage";
import { uploadSwatchToDrive, isDriveConnected } from "./googleDrive";
import {
  COMPLETE_DEFAULT_SETTINGS,
  DEFAULT_EMPLOYEES as SEED_EMPLOYEES,
} from "./defaultCatalogData";
import {
  idbGet,
  idbSet,
  PERMANENT_KEYS,
  getDedicatedGeminiApiKey,
  getDedicatedGeminiApiKeyAsync,
  saveDedicatedGeminiApiKey,
  removeDedicatedGeminiApiKey,
} from "./indexedDbStorage";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDoc,
  getDocs,
  updateDoc,
  writeBatch,
  WriteBatch
} from "firebase/firestore";
import { Job, WindowItem, Employee, Settings } from "../types";

// Quota Status Management
export interface QuotaStatus {
  isExhausted: boolean;
  message?: string;
  upgradeUrl: string;
  lastChecked: number;
}

export const FIRESTORE_UPGRADE_URL =
  "https://console.firebase.google.com/project/gen-lang-client-0145749136/firestore/databases/(default)/data";

let quotaState: QuotaStatus = {
  isExhausted: false,
  message: "",
  upgradeUrl: FIRESTORE_UPGRADE_URL,
  lastChecked: Date.now()
};

const quotaListeners = new Set<(status: QuotaStatus) => void>();

export const subscribeQuotaStatus = (listener: (status: QuotaStatus) => void) => {
  quotaListeners.add(listener);
  listener(quotaState);
  return () => {
    quotaListeners.delete(listener);
  };
};

export const getQuotaStatus = (): QuotaStatus => quotaState;

export const markQuotaExhausted = (msg?: string) => {
  console.warn("[Firestore Notice]", msg);
};

export const resetQuotaStatus = () => {
  try {
    localStorage.removeItem("firestore_quota_status");
  } catch {}
};

export const isQuotaError = (err: any): boolean => {
  if (!err) return false;
  const msg = (err?.message || String(err)).toLowerCase();
  const code = (err?.code || "").toLowerCase();
  return (
    code.includes("resource-exhausted") ||
    msg.includes("resource-exhausted") ||
    msg.includes("quota")
  );
};

// Safe wrapper for Firestore writes - always tries Firestore
async function safeFirestoreWrite<T>(opName: string, writeFn: () => Promise<T>): Promise<T | null> {
  try {
    return await writeFn();
  } catch (err: any) {
    console.warn(`[Firestore Save Notice] ${opName}:`, err?.message || err);
    return null;
  }
}

// Complete default configuration settings loaded from pre-seeded master catalog
export const DEFAULT_SETTINGS: Settings = COMPLETE_DEFAULT_SETTINGS;

export const DEFAULT_EMPLOYEES: Employee[] = SEED_EMPLOYEES;

// REAL-TIME FIRESTORE EVENT SUBSCRIBERS WITH SEEDING LOGIC AND LOCALSTORAGE CACHE FALLBACK
export const LOCAL_STORAGE_KEYS = {
  SETTINGS: "curtain_settings_backup",
  JOBS: "curtain_jobs_backup",
  WINDOWS: "curtain_windows_backup",
  EMPLOYEES: "curtain_employees_backup",
};

// Helper to recover and merge all available jobs from all local & permanent storage layers
export async function loadAllMergedLocalJobs(): Promise<Job[]> {
  const map = new Map<string, Job>();

  // 1. curtain_jobs_backup
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.JOBS);
    if (raw) {
      const arr: Job[] = JSON.parse(raw);
      if (Array.isArray(arr)) {
        arr.forEach((j) => {
          if (j && j.id) map.set(j.id, j);
        });
      }
    }
  } catch {}

  // 2. curtain_jobs
  try {
    const raw = localStorage.getItem("curtain_jobs");
    if (raw) {
      const arr: Job[] = JSON.parse(raw);
      if (Array.isArray(arr)) {
        arr.forEach((j) => {
          if (j && j.id && !map.has(j.id)) map.set(j.id, j);
        });
      }
    }
  } catch {}

  // 3. curtain_editing_job
  try {
    const raw = localStorage.getItem("curtain_editing_job");
    if (raw) {
      const j: Job = JSON.parse(raw);
      if (j && j.id && !map.has(j.id)) map.set(j.id, j);
    }
  } catch {}

  // 4. IndexedDB permanent jobs
  try {
    const idbJobs = await idbGet<Job[]>(PERMANENT_KEYS.JOBS);
    if (idbJobs && Array.isArray(idbJobs)) {
      idbJobs.forEach((j) => {
        if (j && j.id && !map.has(j.id)) map.set(j.id, j);
      });
    }
  } catch {}

  return Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

// Helper to recover and merge all available windows from all local & permanent storage layers
export async function loadAllMergedLocalWindows(): Promise<WindowItem[]> {
  const map = new Map<string, WindowItem>();

  // 1. curtain_windows_backup
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.WINDOWS);
    if (raw) {
      const arr: WindowItem[] = JSON.parse(raw);
      if (Array.isArray(arr)) {
        arr.forEach((w) => {
          if (w && w.id) map.set(w.id, w);
        });
      }
    }
  } catch {}

  // 2. curtain_windows
  try {
    const raw = localStorage.getItem("curtain_windows");
    if (raw) {
      const arr: WindowItem[] = JSON.parse(raw);
      if (Array.isArray(arr)) {
        arr.forEach((w) => {
          if (w && w.id && !map.has(w.id)) map.set(w.id, w);
        });
      }
    }
  } catch {}

  // 3. IndexedDB permanent windows
  try {
    const idbWindows = await idbGet<WindowItem[]>(PERMANENT_KEYS.WINDOWS);
    if (idbWindows && Array.isArray(idbWindows)) {
      idbWindows.forEach((w) => {
        if (w && w.id && !map.has(w.id)) map.set(w.id, w);
      });
    }
  } catch {}

  return Array.from(map.values());
}

export const subscribeJobs = (callback: (jobs: Job[]) => void) => {
  // Load from all local backups immediately so user sees existing jobs instantly
  loadAllMergedLocalJobs().then((merged) => {
    if (merged.length > 0) {
      callback(merged);
    }
  });

  return onSnapshot(
    collection(db, "jobs"),
    async (snapshot) => {
      const snapList: Job[] = [];
      snapshot.forEach((d) => {
        const item = d.data() as Job;
        if (item && item.id) snapList.push(item);
      });

      // Merge snapshot with all local/IDB jobs so NO job is ever wiped if Firestore is empty/reset
      const localMerged = await loadAllMergedLocalJobs();
      const map = new Map<string, Job>();
      snapList.forEach((j) => map.set(j.id, j));
      
      // If local has jobs not yet present in Firestore, persist them to Firestore so all devices see them
      localMerged.forEach((j) => {
        if (!map.has(j.id)) {
          map.set(j.id, j);
          if (!quotaState.isExhausted) {
            safeFirestoreWrite("syncLocalJobToCloud", () => setDoc(doc(db, "jobs", j.id), j));
          }
        }
      });

      const finalList = Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      try {
        localStorage.setItem(LOCAL_STORAGE_KEYS.JOBS, JSON.stringify(finalList));
        localStorage.setItem("curtain_jobs", JSON.stringify(finalList));
      } catch {}
      idbSet(PERMANENT_KEYS.JOBS, finalList);

      callback(finalList);
    },
    (err) => {
      if (isQuotaError(err)) {
        markQuotaExhausted(err?.message);
      }
      console.warn("subscribeJobs Firestore notice (using local cache):", err?.message || err);
      loadAllMergedLocalJobs().then(callback);
    }
  );
};

export const subscribeWindows = (callback: (windows: WindowItem[]) => void) => {
  loadAllMergedLocalWindows().then((merged) => {
    if (merged.length > 0) {
      callback(merged);
    }
  });

  return onSnapshot(
    collection(db, "windows"),
    async (snapshot) => {
      const snapList: WindowItem[] = [];
      snapshot.forEach((d) => {
        const item = d.data() as WindowItem;
        if (item && item.id) snapList.push(item);
      });

      const localMerged = await loadAllMergedLocalWindows();
      const map = new Map<string, WindowItem>();
      snapList.forEach((w) => map.set(w.id, w));
      
      // If local has windows not yet in Firestore, push them so all devices see all windows
      localMerged.forEach((w) => {
        if (!map.has(w.id)) {
          map.set(w.id, w);
          if (!quotaState.isExhausted) {
            safeFirestoreWrite("syncLocalWindowToCloud", () => setDoc(doc(db, "windows", w.id), w));
          }
        }
      });

      const finalList = Array.from(map.values());

      try {
        localStorage.setItem(LOCAL_STORAGE_KEYS.WINDOWS, JSON.stringify(finalList));
        localStorage.setItem("curtain_windows", JSON.stringify(finalList));
      } catch {}
      idbSet(PERMANENT_KEYS.WINDOWS, finalList);

      callback(finalList);
    },
    (err) => {
      if (isQuotaError(err)) {
        markQuotaExhausted(err?.message);
      }
      console.warn("subscribeWindows Firestore notice (using local cache):", err?.message || err);
      loadAllMergedLocalWindows().then(callback);
    }
  );
};

export const subscribeEmployees = (callback: (employees: Employee[]) => void) => {
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEYS.EMPLOYEES);
    if (cached) {
      callback(JSON.parse(cached));
    } else {
      callback(DEFAULT_EMPLOYEES);
    }
  } catch (err) {
    console.warn("Failed to parse cached employees from localStorage", err);
    callback(DEFAULT_EMPLOYEES);
  }

  const employeesColRef = collection(db, "employees");

  // Only check seeding if quota is healthy
  if (!quotaState.isExhausted) {
    getDocs(employeesColRef)
      .then((snap) => {
        if (snap.empty && !quotaState.isExhausted) {
          console.log("Seeding default employees to Firestore...");
          for (const emp of DEFAULT_EMPLOYEES) {
            safeFirestoreWrite("seedEmployee", () => setDoc(doc(db, "employees", emp.id), emp));
          }
        }
      })
      .catch((err) => {
        if (isQuotaError(err)) markQuotaExhausted(err?.message);
      });
  }

  return onSnapshot(
    employeesColRef,
    (snapshot) => {
      if (!snapshot.empty) {
        const list: Employee[] = [];
        snapshot.forEach((d) => {
          list.push(d.data() as Employee);
        });
        list.sort((a, b) => Number(a.id) - Number(b.id));
        try {
          localStorage.setItem(LOCAL_STORAGE_KEYS.EMPLOYEES, JSON.stringify(list));
        } catch {}
        callback(list);
      }
    },
    (err) => {
      if (isQuotaError(err)) {
        markQuotaExhausted(err?.message);
      }
      console.warn("subscribeEmployees Firestore notice (using local cache or defaults):", err?.message || err);
      try {
        const cached = localStorage.getItem(LOCAL_STORAGE_KEYS.EMPLOYEES);
        if (cached) {
          callback(JSON.parse(cached));
        } else {
          callback(DEFAULT_EMPLOYEES);
        }
      } catch {
        callback(DEFAULT_EMPLOYEES);
      }
    }
  );
};

// Keep track of the current in-memory cached settings and explicitly deleted item IDs
let currentCachedSettings: Settings | null = null;
const deletedItemIds = new Set<string>();

export const markItemDeleted = (id: string) => {
  deletedItemIds.add(id);
};

export const clearDeletedItemIds = () => {
  deletedItemIds.clear();
};

export const subscribeSettings = (callback: (settings: Settings) => void) => {
  const dedicatedApiKey = getDedicatedGeminiApiKey();

  // 1. Load from local storage backup immediately to ensure zero UI delay and offline resiliency
  try {
    const cachedBackup = localStorage.getItem(LOCAL_STORAGE_KEYS.SETTINGS);
    if (cachedBackup) {
      const parsed: Settings = JSON.parse(cachedBackup);
      if (dedicatedApiKey && !parsed.customGeminiApiKey) {
        parsed.customGeminiApiKey = dedicatedApiKey;
      }
      currentCachedSettings = parsed;
      callback(parsed);
    } else {
      currentCachedSettings = { ...DEFAULT_SETTINGS };
      callback({ ...DEFAULT_SETTINGS });
    }
  } catch (err) {
    console.warn("Failed to parse settings backup from localStorage:", err);
  }

  const subDocFields: (keyof Settings)[] = [
    "styleMaterials",
    "hemMaterials",
    "solidFabricMaterials",
    "sheerFabricMaterials",
    "blindMaterials",
    "rollerMaterials",
    "blindTapeMaterials",
    "trackMaterials",
    "accessoryMaterials",
  ];

  const fieldToIdbKey: Record<string, string> = {
    styleMaterials: PERMANENT_KEYS.STYLE_MATERIALS,
    hemMaterials: PERMANENT_KEYS.HEM_MATERIALS,
    solidFabricMaterials: PERMANENT_KEYS.SOLID_FABRICS,
    sheerFabricMaterials: PERMANENT_KEYS.SHEER_FABRICS,
    blindMaterials: PERMANENT_KEYS.BLIND_MATERIALS,
    rollerMaterials: PERMANENT_KEYS.ROLLER_MATERIALS,
    blindTapeMaterials: PERMANENT_KEYS.BLIND_TAPE_MATERIALS,
    trackMaterials: PERMANENT_KEYS.TRACK_MATERIALS,
    accessoryMaterials: PERMANENT_KEYS.ACCESSORY_MATERIALS,
  };

  let mergedSettings: Settings = currentCachedSettings ? { ...currentCachedSettings } : { ...DEFAULT_SETTINGS };
  if (dedicatedApiKey && !mergedSettings.customGeminiApiKey) {
    mergedSettings.customGeminiApiKey = dedicatedApiKey;
  }

  // 2. Fetch server catalog cache if available (for instant container-wide sync)
  fetch("/api/catalog/current")
    .then((r) => r.json())
    .then((data) => {
      if (data && data.hasServerCatalog && data.catalog) {
        const serverCat = data.catalog;
        mergedSettings = {
          ...mergedSettings,
          ...serverCat,
        };
        triggerCallback();
      }
    })
    .catch(() => {});

  // 3. Asynchronously load complete datasets from persistent IndexedDB
  (async () => {
    try {
      const [
        savedSettingsIdb,
        solidIdb,
        sheerIdb,
        blindIdb,
        rollerIdb,
        blindTapeIdb,
        styleIdb,
        hemIdb,
        trackIdb,
        accIdb,
        apiKeyIdb
      ] = await Promise.all([
        idbGet<Settings>(PERMANENT_KEYS.SETTINGS),
        idbGet<any[]>(PERMANENT_KEYS.SOLID_FABRICS),
        idbGet<any[]>(PERMANENT_KEYS.SHEER_FABRICS),
        idbGet<any[]>(PERMANENT_KEYS.BLIND_MATERIALS),
        idbGet<any[]>(PERMANENT_KEYS.ROLLER_MATERIALS),
        idbGet<any[]>(PERMANENT_KEYS.BLIND_TAPE_MATERIALS),
        idbGet<any[]>(PERMANENT_KEYS.STYLE_MATERIALS),
        idbGet<any[]>(PERMANENT_KEYS.HEM_MATERIALS),
        idbGet<any[]>(PERMANENT_KEYS.TRACK_MATERIALS),
        idbGet<any[]>(PERMANENT_KEYS.ACCESSORY_MATERIALS),
        getDedicatedGeminiApiKeyAsync(),
      ]);

      let hasIdbUpdates = false;
      const nextMerged = { ...mergedSettings, ...(savedSettingsIdb || {}) };

      if (apiKeyIdb && !nextMerged.customGeminiApiKey) {
        nextMerged.customGeminiApiKey = apiKeyIdb;
        hasIdbUpdates = true;
      }

      if (savedSettingsIdb) {
        subDocFields.forEach((field) => {
          if (Array.isArray((savedSettingsIdb as any)[field])) {
            (nextMerged as any)[field] = (savedSettingsIdb as any)[field];
            hasIdbUpdates = true;
          }
        });
      } else {
        // Only if no savedSettingsIdb exists, fallback to separate collection keys if available
        if (solidIdb && Array.isArray(solidIdb)) {
          nextMerged.solidFabricMaterials = solidIdb.filter(x => x && x.id && !deletedItemIds.has(x.id));
          hasIdbUpdates = true;
        }
        if (sheerIdb && Array.isArray(sheerIdb)) {
          nextMerged.sheerFabricMaterials = sheerIdb.filter(x => x && x.id && !deletedItemIds.has(x.id));
          hasIdbUpdates = true;
        }
        if (blindIdb && Array.isArray(blindIdb)) {
          nextMerged.blindMaterials = blindIdb.filter(x => x && x.id && !deletedItemIds.has(x.id));
          hasIdbUpdates = true;
        }
        if (rollerIdb && Array.isArray(rollerIdb)) {
          nextMerged.rollerMaterials = rollerIdb.filter(x => x && x.id && !deletedItemIds.has(x.id));
          hasIdbUpdates = true;
        }
        if (blindTapeIdb && Array.isArray(blindTapeIdb)) {
          nextMerged.blindTapeMaterials = blindTapeIdb.filter(x => x && x.id && !deletedItemIds.has(x.id));
          hasIdbUpdates = true;
        }
        if (styleIdb && Array.isArray(styleIdb)) {
          nextMerged.styleMaterials = styleIdb.filter(x => x && x.id && !deletedItemIds.has(x.id));
          hasIdbUpdates = true;
        }
        if (hemIdb && Array.isArray(hemIdb)) {
          nextMerged.hemMaterials = hemIdb.filter(x => x && x.id && !deletedItemIds.has(x.id));
          hasIdbUpdates = true;
        }
        if (trackIdb && Array.isArray(trackIdb)) {
          nextMerged.trackMaterials = trackIdb;
          hasIdbUpdates = true;
        }
        if (accIdb && Array.isArray(accIdb)) {
          nextMerged.accessoryMaterials = accIdb;
          hasIdbUpdates = true;
        }
      }

      if (hasIdbUpdates || savedSettingsIdb) {
        mergedSettings = nextMerged;
        currentCachedSettings = JSON.parse(JSON.stringify(nextMerged));
        callback({ ...nextMerged });
      }
    } catch (idbErr) {
      console.warn("IndexedDB async load warning:", idbErr);
    }
  })();

  const unsubscribes: (() => void)[] = [];
  let isGlobalLoaded = false;

  const triggerCallback = () => {
    if (!mergedSettings.clearanceTopOptions) {
      mergedSettings.clearanceTopOptions = DEFAULT_SETTINGS.clearanceTopOptions || [];
    }
    const activeApiKey = getDedicatedGeminiApiKey();
    if (activeApiKey && !mergedSettings.customGeminiApiKey) {
      mergedSettings.customGeminiApiKey = activeApiKey;
    }
    currentCachedSettings = JSON.parse(JSON.stringify(mergedSettings));
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.SETTINGS, JSON.stringify(mergedSettings));
    } catch {}
    idbSet(PERMANENT_KEYS.SETTINGS, mergedSettings).catch(() => {});
    callback({ ...mergedSettings });
  };

  // 1. Subscribe to catalog_bundle and global document (authoritative fast snapshot for whole catalog)
  const bundleRef = doc(db, "settings", "catalog_bundle");
  const unsubBundle = onSnapshot(bundleRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data() as Partial<Settings>;
      if (data) {
        subDocFields.forEach((field) => {
          if (Array.isArray((data as any)[field])) {
            (mergedSettings as any)[field] = (data as any)[field];
          }
        });
        mergedSettings = {
          ...mergedSettings,
          ...data,
        };
        if (data.customGeminiApiKey) {
          saveDedicatedGeminiApiKey(data.customGeminiApiKey).catch(() => {});
          fetch("/api/config/gemini-key", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ apiKey: data.customGeminiApiKey })
          }).catch(() => {});
        }
        isGlobalLoaded = true;
        triggerCallback();
      }
    } else if (!quotaState.isExhausted) {
      // If bundle doesn't exist on Firestore yet, push our merged settings up to Firestore
      const hasMaterials = (mergedSettings.solidFabricMaterials?.length || 0) > 0 ||
        (mergedSettings.blindMaterials?.length || 0) > 0 ||
        (mergedSettings.styleMaterials?.length || 0) > 0;
      if (hasMaterials) {
        safeFirestoreWrite("seedInitialBundle", () => setDoc(bundleRef, mergedSettings));
      }
    }
  }, (err) => {
    console.warn("Notice for settings/catalog_bundle:", err?.message || err);
  });
  unsubscribes.push(unsubBundle);

  // 2. Subscribe to global document (company logo, distances, patterns, apiKey, etc.)
  const globalRef = doc(db, "settings", "global");
  const unsubGlobal = onSnapshot(globalRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      const currentApiKey = mergedSettings.customGeminiApiKey || getDedicatedGeminiApiKey();

      subDocFields.forEach((field) => {
        if (Array.isArray(data[field])) {
          (mergedSettings as any)[field] = data[field];
        }
      });

      mergedSettings = {
        ...mergedSettings,
        ...data,
        customGeminiApiKey: data.customGeminiApiKey || currentApiKey || undefined
      };
      if (data.customGeminiApiKey) {
        saveDedicatedGeminiApiKey(data.customGeminiApiKey).catch(() => {});
        fetch("/api/config/gemini-key", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: data.customGeminiApiKey })
        }).catch(() => {});
      }
      isGlobalLoaded = true;
      triggerCallback();
    } else if (!quotaState.isExhausted) {
      safeFirestoreWrite("seedInitialGlobalSettings", () => setDoc(globalRef, mergedSettings));
    }
  }, (err) => {
    console.warn("Error in onSnapshot for settings/global:", err?.message || err);
  });
  unsubscribes.push(unsubGlobal);

  // 3. Subscribe to each subcollection in Firestore (authoritative real-time sync for fabrics, blinds, styles, etc.)
  subDocFields.forEach((field) => {
    const colRef = collection(db, "settings", "global", field);

    const unsubCol = onSnapshot(colRef, (snapshot) => {
      if (!snapshot.empty) {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as any[];

        mergedSettings = {
          ...mergedSettings,
          [field]: items
        };

        const idbKey = fieldToIdbKey[field];
        if (idbKey) {
          idbSet(idbKey, items).catch(() => {});
        }
        triggerCallback();
      }
    }, (err) => {
      console.warn(`Error in onSnapshot for settings/global/${field}:`, err?.message || err);
    });
    unsubscribes.push(unsubCol);
  });

  return () => {
    unsubscribes.forEach((u) => u());
  };
};

// WRITE / DELETE ACTION IMPLEMENTATIONS
const compressImage = (base64Str: string | null, maxWidth: number, quality = 0.5): Promise<string | null> => {
  if (!base64Str) return Promise.resolve(null);
  if (!base64Str.startsWith("data:image/")) {
    return Promise.resolve(base64Str);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        } else {
          resolve(base64Str);
        }
      } catch (err) {
        console.error("Failed to compress image in onload:", err);
        resolve(base64Str);
      }
    };
    img.onerror = (err) => {
      console.error("Failed to load image for compression:", err);
      resolve(base64Str);
    };
    img.src = base64Str;
  });
};

const compressWindowImages = async (win: WindowItem): Promise<WindowItem> => {
  try {
    const [
      compressedPreImage,
      compressedAiPreview,
      compressedFabricImage,
      compressedSheerImage,
      compressedStyleImage,
      compressedHemImage,
    ] = await Promise.all([
      compressImage(win.preImageBase64, 640, 0.65),
      compressImage(win.aiPreviewBase64, 640, 0.65),
      compressImage(win.fabricImageBase64, 320, 0.65),
      compressImage(win.sheerImageBase64, 320, 0.65),
      compressImage(win.styleImageBase64, 320, 0.65),
      compressImage(win.hemImageBase64, 320, 0.65),
    ]);

    return {
      ...win,
      preImageBase64: compressedPreImage,
      aiPreviewBase64: compressedAiPreview,
      fabricImageBase64: compressedFabricImage,
      sheerImageBase64: compressedSheerImage,
      styleImageBase64: compressedStyleImage,
      hemImageBase64: compressedHemImage,
    };
  } catch (err) {
    console.error("Failed to compress window images:", err);
    return win;
  }
};

const withTimeout = <T>(promise: Promise<T>, ms: number, fallbackValue: T): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallbackValue), ms))
  ]);
};

const uploadImageIfBase64 = async (
  base64Str: string | null,
  path: string
): Promise<string | null> => {
  if (!base64Str) return null;
  if (base64Str.startsWith("http://") || base64Str.startsWith("https://")) {
    return base64Str;
  }
  if (!base64Str.startsWith("data:image/")) {
    return base64Str;
  }

  // 1. If Google Drive is connected, upload swatches and settings images directly to Google Drive
  if (isDriveConnected()) {
    try {
      const sanitizedName = path.replace(/[^a-zA-Z0-9._-]/g, "_");
      const driveUrl = await uploadSwatchToDrive(sanitizedName, base64Str);
      if (driveUrl && (driveUrl.startsWith("http://") || driveUrl.startsWith("https://"))) {
        return driveUrl;
      }
    } catch (gErr) {
      console.warn(`Google Drive upload notice at ${path}:`, gErr);
    }
  }

  // 2. For swatch images when Google Drive is not connected, store high-efficiency base64 directly
  // This bypasses Firebase Storage rate limits and completes instantaneously (< 5ms)
  if (path.startsWith("settings/")) {
    return base64Str;
  }

  // 3. Fallback for jobs/windows
  try {
    const fileRef = sRef(storage, path);
    await withTimeout(
      uploadString(fileRef, base64Str, "data_url", {
        contentType: "image/jpeg",
        cacheControl: "public,max-age=31536000,immutable"
      }),
      2500,
      null
    );
    const downloadUrl = await withTimeout(getDownloadURL(fileRef), 2000, "");
    if (downloadUrl) {
      return downloadUrl;
    }
    return base64Str;
  } catch (err) {
    return base64Str;
  }
};

const uploadWindowImages = async (win: WindowItem): Promise<WindowItem> => {
  try {
    const compressed = await compressWindowImages(win);

    const [
      preImageUrl,
      aiPreviewUrl,
      fabricImageUrl,
      sheerImageUrl,
      styleImageUrl,
      hemImageUrl,
    ] = await Promise.all([
      uploadImageIfBase64(compressed.preImageBase64, `jobs/${win.jobId}/windows/${win.id}/preImage_${Date.now()}.jpg`),
      uploadImageIfBase64(compressed.aiPreviewBase64, `jobs/${win.jobId}/windows/${win.id}/aiPreview_${Date.now()}.jpg`),
      uploadImageIfBase64(compressed.fabricImageBase64, `jobs/${win.jobId}/windows/${win.id}/fabricImage_${Date.now()}.jpg`),
      uploadImageIfBase64(compressed.sheerImageBase64, `jobs/${win.jobId}/windows/${win.id}/sheerImage_${Date.now()}.jpg`),
      uploadImageIfBase64(compressed.styleImageBase64, `jobs/${win.jobId}/windows/${win.id}/styleImage_${Date.now()}.jpg`),
      uploadImageIfBase64(compressed.hemImageBase64, `jobs/${win.jobId}/windows/${win.id}/hemImage_${Date.now()}.jpg`),
    ]);

    return {
      ...compressed,
      preImageBase64: preImageUrl,
      aiPreviewBase64: aiPreviewUrl,
      fabricImageBase64: fabricImageUrl,
      sheerImageBase64: sheerImageUrl,
      styleImageBase64: styleImageUrl,
      hemImageBase64: hemImageUrl,
    };
  } catch (err) {
    console.error("Failed to upload window images to Storage:", err);
    return win;
  }
};

// High-speed parallel worker queue pool
async function runWithConcurrency<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency = 8
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      results[idx] = await fn(items[idx], idx);
    }
  });

  await Promise.all(workers);
  return results;
}

// Fast atomic batch commits for Firestore (committed in chunks of up to 250 operations with 4s timeout protection)
async function commitBatchOperations(
  operations: ((batch: WriteBatch) => void)[],
  onChunkProgress?: (completedOps: number, totalOps: number) => void
) {
  if (operations.length === 0) return;
  if (quotaState.isExhausted) {
    console.info("[Offline Local Mode] Firestore write quota exceeded; changes are saved safely to local storage.");
    return;
  }
  const CHUNK_SIZE = 250;
  let completed = 0;
  for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
    if (quotaState.isExhausted) break;
    const chunk = operations.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const op of chunk) {
      op(batch);
    }
    try {
      await withTimeout(batch.commit(), 4000, null);
      completed += chunk.length;
      if (onChunkProgress) onChunkProgress(completed, operations.length);
    } catch (err: any) {
      if (isQuotaError(err)) {
        markQuotaExhausted(err?.message);
        break;
      }
      console.warn("Batch commit notice:", err?.message || err);
      completed += chunk.length;
      if (onChunkProgress) onChunkProgress(completed, operations.length);
    }
  }
}

// Compare helper for material lists
const isMaterialItemEqual = (item1: any, item2: any) => {
  if (!item1 || !item2) return item1 === item2;
  return (
    item1.id === item2.id &&
    item1.name === item2.name &&
    item1.imageBase64 === item2.imageBase64 &&
    item1.colorName === item2.colorName &&
    item1.type === item2.type &&
    item1.category === item2.category &&
    item1.styleEnForAi === item2.styleEnForAi &&
    JSON.stringify(item1.operationOptions) === JSON.stringify(item2.operationOptions)
  );
};

const isCollectionEqual = (arr1: any[] | undefined, arr2: any[] | undefined) => {
  if (!arr1 && !arr2) return true;
  if (!arr1 || !arr2) return false;
  if (arr1.length !== arr2.length) return false;
  for (let i = 0; i < arr1.length; i++) {
    if (!isMaterialItemEqual(arr1[i], arr2[i])) return false;
  }
  return true;
};

const isGlobalSettingsEqual = (s1: Partial<Settings> | null, s2: Partial<Settings> | null) => {
  if (!s1 || !s2) return s1 === s2;
  return (
    s1.companyLogoBase64 === s2.companyLogoBase64 &&
    s1.companyLogoSize === s2.companyLogoSize &&
    s1.defaultDistanceLeft === s2.defaultDistanceLeft &&
    s1.defaultDistanceRight === s2.defaultDistanceRight &&
    s1.defaultDistanceTop === s2.defaultDistanceTop &&
    s1.customGeminiApiKey === s2.customGeminiApiKey &&
    JSON.stringify(s1.curtainStyles) === JSON.stringify(s2.curtainStyles) &&
    JSON.stringify(s1.patterns) === JSON.stringify(s2.patterns) &&
    JSON.stringify(s1.tracks) === JSON.stringify(s2.tracks) &&
    JSON.stringify(s1.accessories) === JSON.stringify(s2.accessories) &&
    JSON.stringify(s1.fabricTypes) === JSON.stringify(s2.fabricTypes) &&
    JSON.stringify(s1.hangingTypes) === JSON.stringify(s2.hangingTypes) &&
    JSON.stringify(s1.usageTypes) === JSON.stringify(s2.usageTypes) &&
    JSON.stringify(s1.clearanceOptions) === JSON.stringify(s2.clearanceOptions) &&
    JSON.stringify(s1.clearanceTopOptions) === JSON.stringify(s2.clearanceTopOptions) &&
    JSON.stringify(s1.trackMaterials) === JSON.stringify(s2.trackMaterials) &&
    JSON.stringify(s1.accessoryMaterials) === JSON.stringify(s2.accessoryMaterials)
  );
};

export const firebaseStorage = {
  async saveJob(job: Job): Promise<void> {
    const data = {
      ...job,
      createdAt: job.createdAt || Date.now(),
      updatedAt: Date.now()
    };
    try {
      const current = await loadAllMergedLocalJobs();
      const idx = current.findIndex(j => j.id === job.id);
      if (idx >= 0) current[idx] = data;
      else current.unshift(data);
      localStorage.setItem(LOCAL_STORAGE_KEYS.JOBS, JSON.stringify(current));
      localStorage.setItem("curtain_jobs", JSON.stringify(current));
      await idbSet(PERMANENT_KEYS.JOBS, current);
    } catch {}

    await safeFirestoreWrite("saveJob", () => setDoc(doc(db, "jobs", job.id), data));
  },

  async deleteJob(id: string): Promise<void> {
    try {
      const current = await loadAllMergedLocalJobs();
      const filtered = current.filter((j: Job) => j.id !== id);
      localStorage.setItem(LOCAL_STORAGE_KEYS.JOBS, JSON.stringify(filtered));
      localStorage.setItem("curtain_jobs", JSON.stringify(filtered));
      await idbSet(PERMANENT_KEYS.JOBS, filtered);

      // Cascade delete windows
      const currentWins = await loadAllMergedLocalWindows();
      const filteredWins = currentWins.filter((w: WindowItem) => w.jobId !== id);
      localStorage.setItem(LOCAL_STORAGE_KEYS.WINDOWS, JSON.stringify(filteredWins));
      localStorage.setItem("curtain_windows", JSON.stringify(filteredWins));
      await idbSet(PERMANENT_KEYS.WINDOWS, filteredWins);
    } catch {}

    await safeFirestoreWrite("deleteJob", () => deleteDoc(doc(db, "jobs", id)));
  },

  async saveWindow(win: WindowItem): Promise<void> {
    try {
      const current = await loadAllMergedLocalWindows();
      const idx = current.findIndex(w => w.id === win.id);
      if (idx >= 0) current[idx] = win;
      else current.push(win);
      localStorage.setItem(LOCAL_STORAGE_KEYS.WINDOWS, JSON.stringify(current));
      localStorage.setItem("curtain_windows", JSON.stringify(current));
      await idbSet(PERMANENT_KEYS.WINDOWS, current);
    } catch {}

    const uploadedWin = await uploadWindowImages(win);
    await safeFirestoreWrite("saveWindow", () => setDoc(doc(db, "windows", uploadedWin.id), uploadedWin));
  },

  async updateWindowMetadata(id: string, metadata: Partial<WindowItem>): Promise<void> {
    try {
      const current = await loadAllMergedLocalWindows();
      const idx = current.findIndex(w => w.id === id);
      if (idx >= 0) {
        current[idx] = { ...current[idx], ...metadata };
        localStorage.setItem(LOCAL_STORAGE_KEYS.WINDOWS, JSON.stringify(current));
        localStorage.setItem("curtain_windows", JSON.stringify(current));
        await idbSet(PERMANENT_KEYS.WINDOWS, current);
      }
    } catch {}

    await safeFirestoreWrite("updateWindowMetadata", () => {
      const docRef = doc(db, "windows", id);
      return updateDoc(docRef, metadata);
    });
  },

  async deleteWindow(id: string): Promise<void> {
    try {
      const current = await loadAllMergedLocalWindows();
      const filtered = current.filter((w: WindowItem) => w.id !== id);
      localStorage.setItem(LOCAL_STORAGE_KEYS.WINDOWS, JSON.stringify(filtered));
      localStorage.setItem("curtain_windows", JSON.stringify(filtered));
      await idbSet(PERMANENT_KEYS.WINDOWS, filtered);
    } catch {}

    await safeFirestoreWrite("deleteWindow", () => deleteDoc(doc(db, "windows", id)));
  },

  async saveEmployee(emp: Employee): Promise<void> {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEYS.EMPLOYEES);
      let list: Employee[] = cached ? JSON.parse(cached) : [];
      const idx = list.findIndex(e => e.id === emp.id);
      if (idx >= 0) list[idx] = emp;
      else list.push(emp);
      localStorage.setItem(LOCAL_STORAGE_KEYS.EMPLOYEES, JSON.stringify(list));
    } catch {}

    await safeFirestoreWrite("saveEmployee", () => setDoc(doc(db, "employees", emp.id), emp));
  },

  async deleteEmployee(id: string): Promise<void> {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEYS.EMPLOYEES);
      if (cached) {
        const list: Employee[] = JSON.parse(cached).filter((e: Employee) => e.id !== id);
        localStorage.setItem(LOCAL_STORAGE_KEYS.EMPLOYEES, JSON.stringify(list));
      }
    } catch {}

    await safeFirestoreWrite("deleteEmployee", () => deleteDoc(doc(db, "employees", id)));
  },

  async saveSettings(settings: Settings, onProgress?: (percent: number) => void): Promise<void> {
    const updatedSettings = { ...settings };
    const prevCached = currentCachedSettings ? JSON.parse(JSON.stringify(currentCachedSettings)) : null;
    
    // Save or clear Dedicated Gemini API Key
    if (updatedSettings.customGeminiApiKey && updatedSettings.customGeminiApiKey.trim().length > 5) {
      await saveDedicatedGeminiApiKey(updatedSettings.customGeminiApiKey.trim());
    } else if (updatedSettings.customGeminiApiKey === "" || updatedSettings.customGeminiApiKey === undefined) {
      // If explicitly cleared
      if (settings.customGeminiApiKey === undefined || settings.customGeminiApiKey === "") {
        await removeDedicatedGeminiApiKey();
      }
    }

    // Always instantly write to memory cache and IndexedDB so no swatches/settings are ever lost!
    currentCachedSettings = JSON.parse(JSON.stringify(updatedSettings));
    
    // Asynchronously write complete unconstrained datasets to IndexedDB
    try {
      await Promise.all([
        idbSet(PERMANENT_KEYS.SETTINGS, updatedSettings),
        idbSet(PERMANENT_KEYS.SOLID_FABRICS, updatedSettings.solidFabricMaterials || []),
        idbSet(PERMANENT_KEYS.SHEER_FABRICS, updatedSettings.sheerFabricMaterials || []),
        idbSet(PERMANENT_KEYS.BLIND_MATERIALS, updatedSettings.blindMaterials || []),
        idbSet(PERMANENT_KEYS.ROLLER_MATERIALS, updatedSettings.rollerMaterials || []),
        idbSet(PERMANENT_KEYS.BLIND_TAPE_MATERIALS, updatedSettings.blindTapeMaterials || []),
        idbSet(PERMANENT_KEYS.STYLE_MATERIALS, updatedSettings.styleMaterials || []),
        idbSet(PERMANENT_KEYS.HEM_MATERIALS, updatedSettings.hemMaterials || []),
      ]);
    } catch (idbErr) {
      console.warn("IndexedDB settings write notice:", idbErr);
    }

    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.SETTINGS, JSON.stringify(updatedSettings));
    } catch (err) {
      console.warn("LocalStorage settings save warning (handled by IndexedDB):", err);
    }

    const cached = prevCached;

    // Determine which parts actually changed to avoid redundant uploads and writes
    const styleChanged = !cached || !isCollectionEqual(settings.styleMaterials, cached.styleMaterials);
    const hemChanged = !cached || !isCollectionEqual(settings.hemMaterials, cached.hemMaterials);
    const solidChanged = !cached || !isCollectionEqual(settings.solidFabricMaterials, cached.solidFabricMaterials);
    const sheerChanged = !cached || !isCollectionEqual(settings.sheerFabricMaterials, cached.sheerFabricMaterials);
    const blindChanged = !cached || !isCollectionEqual(settings.blindMaterials, cached.blindMaterials);
    const rollerChanged = !cached || !isCollectionEqual(settings.rollerMaterials, cached.rollerMaterials);
    const blindTapeChanged = !cached || !isCollectionEqual(settings.blindTapeMaterials, cached.blindTapeMaterials);
    const globalChanged = !cached || !isGlobalSettingsEqual(settings, cached);

    // Calculate total items to upload in changed collections only
    let totalToUpload = 0;
    if (globalChanged && updatedSettings.companyLogoBase64 && updatedSettings.companyLogoBase64.startsWith("data:image/")) {
      totalToUpload++;
    }
    const countArrayUploads = (arr: any[] | undefined, hasChanged: boolean) => {
      if (!arr || !hasChanged) return;
      for (const item of arr) {
        if (item.imageBase64 && item.imageBase64.startsWith("data:image/")) {
          totalToUpload++;
        }
      }
    };
    countArrayUploads(updatedSettings.styleMaterials, styleChanged);
    countArrayUploads(updatedSettings.hemMaterials, hemChanged);
    countArrayUploads(updatedSettings.solidFabricMaterials, solidChanged);
    countArrayUploads(updatedSettings.sheerFabricMaterials, sheerChanged);
    countArrayUploads(updatedSettings.blindMaterials, blindChanged);
    countArrayUploads(updatedSettings.rollerMaterials, rollerChanged);
    countArrayUploads(updatedSettings.blindTapeMaterials, blindTapeChanged);

    let completedUploads = 0;
    const updateProgress = () => {
      if (totalToUpload > 0 && onProgress) {
        completedUploads++;
        const pct = Math.round((completedUploads / totalToUpload) * 80);
        onProgress(Math.min(pct, 80));
      }
    };

    if (totalToUpload === 0 && onProgress) {
      onProgress(30);
    }

    try {
      // 1. Company logo (only if global changed)
      if (globalChanged && updatedSettings.companyLogoBase64 && updatedSettings.companyLogoBase64.startsWith("data:image/")) {
        const logoUrl = await uploadImageIfBase64(
          updatedSettings.companyLogoBase64,
          `settings/companyLogo.jpg`
        );
        if (logoUrl) updatedSettings.companyLogoBase64 = logoUrl;
        updateProgress();
      }

      // Helper for array of materials
      const uploadMaterials = async <T extends { id: string; imageBase64?: string }>(
        materials: T[] | undefined,
        folder: string
      ): Promise<T[] | undefined> => {
        if (!materials) return undefined;
        return await runWithConcurrency(
          materials,
          async (m) => {
            if (m.imageBase64 && m.imageBase64.startsWith("data:image/")) {
              const url = await uploadImageIfBase64(
                m.imageBase64,
                `settings/${folder}/${m.id}.jpg`
              );
              updateProgress();
              return { ...m, imageBase64: url || m.imageBase64 };
            }
            return m;
          },
          8
        );
      };

      if (onProgress) onProgress(85);

      // Split the settings into separate document structures
      const {
        styleMaterials,
        hemMaterials,
        solidFabricMaterials,
        sheerFabricMaterials,
        blindMaterials,
        rollerMaterials,
        blindTapeMaterials,
        ...globalSettings
      } = updatedSettings;

      // Immediately write latest clean collections to permanent IndexedDB keys to prevent stale restorations
      await Promise.allSettled([
        idbSet(PERMANENT_KEYS.SETTINGS, updatedSettings),
        idbSet(PERMANENT_KEYS.SOLID_FABRICS, solidFabricMaterials || []),
        idbSet(PERMANENT_KEYS.SHEER_FABRICS, sheerFabricMaterials || []),
        idbSet(PERMANENT_KEYS.BLIND_MATERIALS, blindMaterials || []),
        idbSet(PERMANENT_KEYS.ROLLER_MATERIALS, rollerMaterials || []),
        idbSet(PERMANENT_KEYS.BLIND_TAPE_MATERIALS, blindTapeMaterials || []),
        idbSet(PERMANENT_KEYS.STYLE_MATERIALS, styleMaterials || []),
        idbSet(PERMANENT_KEYS.HEM_MATERIALS, hemMaterials || []),
        idbSet(PERMANENT_KEYS.TRACK_MATERIALS, updatedSettings.trackMaterials || []),
        idbSet(PERMANENT_KEYS.ACCESSORY_MATERIALS, updatedSettings.accessoryMaterials || []),
      ]);

      // Save general/global options and bundle to Firestore
      await safeFirestoreWrite("saveSettingsBundle", () => setDoc(doc(db, "settings", "catalog_bundle"), updatedSettings));
      if (globalChanged) {
        await safeFirestoreWrite("saveSettingsGlobal", () => setDoc(doc(db, "settings", "global"), updatedSettings));
      }

      // Sync to server-side cache for instant container-wide availability
      fetch("/api/catalog/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catalog: updatedSettings }),
      }).catch(() => {});

      if (updatedSettings.customGeminiApiKey) {
        fetch("/api/config/gemini-key", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: updatedSettings.customGeminiApiKey }),
        }).catch(() => {});
      }

      const collectionsToSave = [
        { id: "styleMaterials", items: styleMaterials || [], hasChanged: styleChanged },
        { id: "hemMaterials", items: hemMaterials || [], hasChanged: hemChanged },
        { id: "solidFabricMaterials", items: solidFabricMaterials || [], hasChanged: solidChanged },
        { id: "sheerFabricMaterials", items: sheerFabricMaterials || [], hasChanged: sheerChanged },
        { id: "blindMaterials", items: blindMaterials || [], hasChanged: blindChanged },
        { id: "rollerMaterials", items: rollerMaterials || [], hasChanged: rollerChanged },
        { id: "blindTapeMaterials", items: blindTapeMaterials || [], hasChanged: blindTapeChanged },
        { id: "trackMaterials", items: (updatedSettings.trackMaterials || []) as any[], hasChanged: true },
        { id: "accessoryMaterials", items: (updatedSettings.accessoryMaterials || []) as any[], hasChanged: true },
      ];

      // Parallel save of subcollections to Firestore
      await Promise.allSettled(
        collectionsToSave
          .filter((col) => col.hasChanged)
          .map(async (col) => {
            try {
              const cachedCol = cached ? ((cached as any)[col.id] as any[]) : undefined;
              const batchOps: ((batch: WriteBatch) => void)[] = [];

              // 1. Write/update new and modified items only
              col.items.forEach((item) => {
                const cachedItem = cachedCol?.find((x: any) => x.id === item.id);
                if (!cachedItem || !isMaterialItemEqual(item, cachedItem)) {
                  const docRef = doc(db, "settings", "global", col.id, item.id);
                  batchOps.push((batch) => batch.set(docRef, item));
                }
              });

              // 2. Delete items that were removed in this update or marked deleted
              if (cachedCol) {
                const newIds = new Set(col.items.map((item) => item.id));
                cachedCol.forEach((oldItem: any) => {
                  if (!newIds.has(oldItem.id)) {
                    deletedItemIds.add(oldItem.id);
                    const docRef = doc(db, "settings", "global", col.id, oldItem.id);
                    batchOps.push((batch) => batch.delete(docRef));
                  }
                });
              }

              // 3. Perform fast atomic batch writes
              if (batchOps.length > 0) {
                await commitBatchOperations(batchOps);
              }
            } catch (colErr: any) {
              console.warn(`Firestore save error for ${col.id}:`, colErr);
            }
          })
      );

      if (onProgress) onProgress(95);
    } catch (err: any) {
      console.warn("Firestore saveSettings notice:", err?.message || err);
    }

    // Explicitly update cache with latest saved settings
    currentCachedSettings = JSON.parse(JSON.stringify(updatedSettings));
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.SETTINGS, JSON.stringify(updatedSettings));
    } catch {}

    if (onProgress) {
      onProgress(100);
    }
  },

  async saveSingleMaterial<T extends { id: string }>(
    collectionKey: "solidFabricMaterials" | "sheerFabricMaterials" | "blindMaterials" | "rollerMaterials" | "blindTapeMaterials" | "styleMaterials" | "hemMaterials" | "trackMaterials" | "accessoryMaterials",
    item: T
  ): Promise<void> {
    // 1. Immediately update in-memory cache
    if (currentCachedSettings) {
      const list = (((currentCachedSettings as any)[collectionKey] || []) as T[]).slice();
      const idx = list.findIndex(x => x.id === item.id);
      if (idx >= 0) {
        list[idx] = { ...item };
      } else {
        list.push({ ...item });
      }
      (currentCachedSettings as any)[collectionKey] = list;

      const fieldToIdbKey: Record<string, string> = {
        styleMaterials: PERMANENT_KEYS.STYLE_MATERIALS,
        hemMaterials: PERMANENT_KEYS.HEM_MATERIALS,
        solidFabricMaterials: PERMANENT_KEYS.SOLID_FABRICS,
        sheerFabricMaterials: PERMANENT_KEYS.SHEER_FABRICS,
        blindMaterials: PERMANENT_KEYS.BLIND_MATERIALS,
        rollerMaterials: PERMANENT_KEYS.ROLLER_MATERIALS,
        blindTapeMaterials: PERMANENT_KEYS.BLIND_TAPE_MATERIALS,
        trackMaterials: PERMANENT_KEYS.TRACK_MATERIALS,
        accessoryMaterials: PERMANENT_KEYS.ACCESSORY_MATERIALS,
      };
      const idbKey = fieldToIdbKey[collectionKey];
      if (idbKey) {
        idbSet(idbKey, list).catch(() => {});
      }
      try {
        localStorage.setItem(LOCAL_STORAGE_KEYS.SETTINGS, JSON.stringify(currentCachedSettings));
      } catch {}
    }

    // 2. Persist to Firestore directly in background without blocking UI
    safeFirestoreWrite("saveSingleMaterial", () =>
      setDoc(doc(db, "settings", "global", collectionKey, item.id), item)
    );
  },

  async deleteSingleMaterial(
    collectionKey: "solidFabricMaterials" | "sheerFabricMaterials" | "blindMaterials" | "rollerMaterials" | "blindTapeMaterials" | "styleMaterials" | "hemMaterials" | "trackMaterials" | "accessoryMaterials",
    itemId: string
  ): Promise<void> {
    markItemDeleted(itemId);

    // 1. Immediately update in-memory cache & local storage
    if (currentCachedSettings) {
      const list = (((currentCachedSettings as any)[collectionKey] || []) as any[]).filter(x => x.id !== itemId);
      (currentCachedSettings as any)[collectionKey] = list;

      const fieldToIdbKey: Record<string, string> = {
        styleMaterials: PERMANENT_KEYS.STYLE_MATERIALS,
        hemMaterials: PERMANENT_KEYS.HEM_MATERIALS,
        solidFabricMaterials: PERMANENT_KEYS.SOLID_FABRICS,
        sheerFabricMaterials: PERMANENT_KEYS.SHEER_FABRICS,
        blindMaterials: PERMANENT_KEYS.BLIND_MATERIALS,
        rollerMaterials: PERMANENT_KEYS.ROLLER_MATERIALS,
        blindTapeMaterials: PERMANENT_KEYS.BLIND_TAPE_MATERIALS,
        trackMaterials: PERMANENT_KEYS.TRACK_MATERIALS,
        accessoryMaterials: PERMANENT_KEYS.ACCESSORY_MATERIALS,
      };
      const idbKey = fieldToIdbKey[collectionKey];
      if (idbKey) {
        idbSet(idbKey, list).catch(() => {});
      }
      try {
        localStorage.setItem(LOCAL_STORAGE_KEYS.SETTINGS, JSON.stringify(currentCachedSettings));
      } catch {}
    }

    // 2. Delete from Firestore directly in background
    safeFirestoreWrite("deleteSingleMaterial", () =>
      deleteDoc(doc(db, "settings", "global", collectionKey, itemId))
    );
  },

  async incrementEmployeeAiUsage(employeeId: string): Promise<void> {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEYS.EMPLOYEES);
      if (cached) {
        const list: Employee[] = JSON.parse(cached);
        const idx = list.findIndex(e => e.id === employeeId);
        if (idx >= 0) {
          list[idx] = { ...list[idx], aiUsed: (list[idx].aiUsed || 0) + 1 };
          localStorage.setItem(LOCAL_STORAGE_KEYS.EMPLOYEES, JSON.stringify(list));
        }
      }
    } catch {}

    await safeFirestoreWrite("incrementEmployeeAiUsage", async () => {
      const docRef = doc(db, "employees", employeeId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const current = snap.data() as Employee;
        await setDoc(docRef, {
          ...current,
          aiUsed: (current.aiUsed || 0) + 1
        });
      }
    });
  },

  async saveAllToFirestore(
    settings: Settings,
    employees?: Employee[],
    onProgress?: (msg: string, percent: number) => void
  ): Promise<void> {
    if (onProgress) onProgress("กำลังบันทึกข้อมูลและแคตตาล็อกขึ้นคลาวด์กลาง...", 20);
    await this.saveSettings(settings, (pct) => {
      if (onProgress) onProgress(`กำลังซิงค์แคตตาล็อกวัสดุ (${pct}%)...`, Math.round(pct * 0.7));
    });
    if (employees && employees.length > 0) {
      if (onProgress) onProgress("กำลังซิงค์รายชื่อพนักงานและสิทธิ์การใช้งาน...", 80);
      const empBatchOps: ((batch: WriteBatch) => void)[] = [];
      employees.forEach((emp) => {
        if (emp && emp.id) {
          const docRef = doc(db, "employees", emp.id);
          empBatchOps.push((batch) => batch.set(docRef, emp));
        }
      });
      if (empBatchOps.length > 0) {
        await commitBatchOperations(empBatchOps);
      }
    }
    if (onProgress) onProgress("✓ ซิงค์ฐานข้อมูลทั้งหมดขึ้นคลาวด์เรียบร้อยแล้ว!", 100);
  },

  /**
   * Force push all local datasets (fabrics, sheers, blinds, rollers, tapes, styles, hems, tracks, accessories, jobs, windows, employees)
   * to Firestore shared cloud database so all employee devices receive 100% of the centralized catalog in Realtime!
   */
  async forcePushAllLocalDataToFirestore(
    onProgress?: (msg: string, percent: number) => void
  ): Promise<{ syncedItems: number; jobsCount: number; windowsCount: number }> {
    resetQuotaStatus();
    let totalItems = 0;

    if (onProgress) onProgress("กำลังรวบรวมข้อมูลทั้งหมดจากระบบเครื่องนี้...", 10);

    // 1. Gather all local settings
    const settings = currentCachedSettings || (await idbGet<Settings>(PERMANENT_KEYS.SETTINGS)) || DEFAULT_SETTINGS;
    
    // 2. Prepare subcollections
    const collectionsToPush: { key: string; label: string; items: any[] }[] = [
      { key: "solidFabricMaterials", label: "ผ้าม่านทึบ", items: settings.solidFabricMaterials || [] },
      { key: "sheerFabricMaterials", label: "ผ้าม่านโปร่ง", items: settings.sheerFabricMaterials || [] },
      { key: "blindMaterials", label: "มู่ลี่ไม้", items: settings.blindMaterials || [] },
      { key: "rollerMaterials", label: "ม่านม้วน", items: settings.rollerMaterials || [] },
      { key: "blindTapeMaterials", label: "เทปบันไดมู่ลี่", items: settings.blindTapeMaterials || [] },
      { key: "styleMaterials", label: "รูปแบบม่าน", items: settings.styleMaterials || [] },
      { key: "hemMaterials", label: "ระยะชายม่าน", items: settings.hemMaterials || [] },
      { key: "trackMaterials", label: "รางม่าน", items: settings.trackMaterials || [] },
      { key: "accessoryMaterials", label: "อุปกรณ์เสริม", items: settings.accessoryMaterials || [] },
    ];

    const grandTotalCatalogItems = collectionsToPush.reduce((acc, c) => acc + c.items.length, 0) || 1;
    let catalogItemsProcessed = 0;

    for (const col of collectionsToPush) {
      if (col.items.length > 0) {
        const batchOps: ((batch: WriteBatch) => void)[] = [];
        col.items.forEach((item) => {
          if (item && item.id) {
            const docRef = doc(db, "settings", "global", col.key, item.id);
            batchOps.push((batch) => batch.set(docRef, item));
            totalItems++;
          }
        });

        if (batchOps.length > 0) {
          await commitBatchOperations(batchOps, (completedInCol) => {
            const currentTotal = catalogItemsProcessed + completedInCol;
            const pct = Math.min(65, 10 + Math.round((currentTotal / grandTotalCatalogItems) * 55));
            if (onProgress) {
              onProgress(`กำลังส่งข้อมูล ${col.label} (${completedInCol}/${col.items.length} รายการ)...`, pct);
            }
          });
        }
        catalogItemsProcessed += col.items.length;
      }
    }

    // 3. Save global settings
    if (onProgress) onProgress("กำลังบันทึกการตั้งค่าระบบส่วนกลางขึ้นคลาวด์...", 68);
    const {
      styleMaterials,
      hemMaterials,
      solidFabricMaterials,
      sheerFabricMaterials,
      blindMaterials,
      rollerMaterials,
      blindTapeMaterials,
      ...globalSettings
    } = settings;
    try {
      await withTimeout(setDoc(doc(db, "settings", "catalog_bundle"), settings), 5000, null);
      await withTimeout(setDoc(doc(db, "settings", "global"), settings), 5000, null);
      
      fetch("/api/catalog/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catalog: settings }),
      }).catch(() => {});

      if (settings.customGeminiApiKey) {
        fetch("/api/config/gemini-key", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: settings.customGeminiApiKey }),
        }).catch(() => {});
      }
    } catch {}

    // 4. Gather and push all local jobs
    if (onProgress) onProgress("กำลังตรวจสอบและส่งข้อมูลรายการงาน (Jobs) ขึ้นคลาวด์...", 75);
    const localJobs = await loadAllMergedLocalJobs();
    if (localJobs.length > 0) {
      const jobBatchOps: ((batch: WriteBatch) => void)[] = [];
      localJobs.forEach((job) => {
        if (job && job.id) {
          const docRef = doc(db, "jobs", job.id);
          jobBatchOps.push((batch) => batch.set(docRef, job));
        }
      });
      if (jobBatchOps.length > 0) {
        await commitBatchOperations(jobBatchOps, (done, total) => {
          const pct = Math.min(85, 75 + Math.round((done / total) * 10));
          if (onProgress) onProgress(`กำลังซิงค์โครงการงาน (${done}/${total})...`, pct);
        });
      }
    }

    // 5. Gather and push all local windows
    if (onProgress) onProgress("กำลังส่งข้อมูลหน้าต่าง (Windows) ขึ้นคลาวด์...", 86);
    const localWindows = await loadAllMergedLocalWindows();
    if (localWindows.length > 0) {
      const winBatchOps: ((batch: WriteBatch) => void)[] = [];
      for (const win of localWindows) {
        if (win && win.id) {
          const compressed = await compressWindowImages(win);
          const docRef = doc(db, "windows", win.id);
          winBatchOps.push((batch) => batch.set(docRef, compressed));
        }
      }
      if (winBatchOps.length > 0) {
        await commitBatchOperations(winBatchOps, (done, total) => {
          const pct = Math.min(96, 86 + Math.round((done / total) * 10));
          if (onProgress) onProgress(`กำลังซิงค์รายการหน้าต่าง (${done}/${total})...`, pct);
        });
      }
    }

    // 6. Push employees
    if (onProgress) onProgress("กำลังซิงค์รายชื่อพนักงานและสิทธิ์การใช้งาน...", 97);
    const cachedEmps = localStorage.getItem(LOCAL_STORAGE_KEYS.EMPLOYEES);
    if (cachedEmps) {
      try {
        const emps: Employee[] = JSON.parse(cachedEmps);
        const empBatchOps: ((batch: WriteBatch) => void)[] = [];
        emps.forEach((emp) => {
          if (emp && emp.id) {
            const docRef = doc(db, "employees", emp.id);
            empBatchOps.push((batch) => batch.set(docRef, emp));
          }
        });
        if (empBatchOps.length > 0) {
          await commitBatchOperations(empBatchOps);
        }
      } catch {}
    }

    if (onProgress) onProgress("✓ ซิงค์ฐานข้อมูลทั้งหมดขึ้นคลาวด์ส่วนกลางเรียบร้อยแล้ว!", 100);

    return {
      syncedItems: totalItems,
      jobsCount: localJobs.length,
      windowsCount: localWindows.length
    };
  }
};
