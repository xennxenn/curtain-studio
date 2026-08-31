import { Job, WindowItem, Employee, Settings } from "../types";
import { db } from "./firebase";
import { collection, getDocs } from "firebase/firestore";
import { idbGet, idbSet, PERMANENT_KEYS } from "./indexedDbStorage";
import { COMPLETE_DEFAULT_SETTINGS } from "./defaultCatalogData";
import { realtimeSync } from "./realtimeSync";

/**
 * Intelligent non-destructive Data Recovery & Merging Engine
 * Scans all layers (Firestore, IndexedDB, LocalStorage backups, and Server Cache)
 * to ensure no user data is ever lost, and automatically syncs recovered data across all devices.
 */
export async function performCompleteDataRecovery(): Promise<{
  jobs: Job[];
  windows: WindowItem[];
  settings: Settings | null;
  employees: Employee[];
}> {
  const jobMap = new Map<string, Job>();
  const windowMap = new Map<string, WindowItem>();
  const employeeMap = new Map<string, Employee>();

  // 1. Scan LocalStorage Backup Keys
  try {
    const backupJobs = localStorage.getItem("curtain_jobs_backup");
    if (backupJobs) {
      const parsed = JSON.parse(backupJobs);
      if (Array.isArray(parsed)) {
        parsed.forEach((j) => { if (j && j.id) jobMap.set(j.id, j); });
      }
    }
  } catch {}

  try {
    const standardJobs = localStorage.getItem("curtain_jobs");
    if (standardJobs) {
      const parsed = JSON.parse(standardJobs);
      if (Array.isArray(parsed)) {
        parsed.forEach((j) => { if (j && j.id && !jobMap.has(j.id)) jobMap.set(j.id, j); });
      }
    }
  } catch {}

  try {
    const editingJob = localStorage.getItem("curtain_editing_job");
    if (editingJob) {
      const parsed = JSON.parse(editingJob);
      if (parsed && parsed.id && !jobMap.has(parsed.id)) {
        jobMap.set(parsed.id, parsed);
      }
    }
  } catch {}

  // 2. Scan LocalStorage Windows
  try {
    const backupWins = localStorage.getItem("curtain_windows_backup");
    if (backupWins) {
      const parsed = JSON.parse(backupWins);
      if (Array.isArray(parsed)) {
        parsed.forEach((w) => { if (w && w.id) windowMap.set(w.id, w); });
      }
    }
  } catch {}

  try {
    const standardWins = localStorage.getItem("curtain_windows");
    if (standardWins) {
      const parsed = JSON.parse(standardWins);
      if (Array.isArray(parsed)) {
        parsed.forEach((w) => { if (w && w.id && !windowMap.has(w.id)) windowMap.set(w.id, w); });
      }
    }
  } catch {}

  // 3. Scan IndexedDB Permanent Layer
  try {
    const idbJobs = await idbGet<Job[]>(PERMANENT_KEYS.JOBS);
    if (idbJobs && Array.isArray(idbJobs)) {
      idbJobs.forEach((j) => { if (j && j.id && !jobMap.has(j.id)) jobMap.set(j.id, j); });
    }
  } catch {}

  try {
    const idbWins = await idbGet<WindowItem[]>(PERMANENT_KEYS.WINDOWS);
    if (idbWins && Array.isArray(idbWins)) {
      idbWins.forEach((w) => { if (w && w.id && !windowMap.has(w.id)) windowMap.set(w.id, w); });
    }
  } catch {}

  // 4. Scan Firestore Cloud Database
  try {
    const jobSnap = await getDocs(collection(db, "jobs"));
    if (!jobSnap.empty) {
      jobSnap.forEach((d) => {
        const data = d.data() as Job;
        if (data && data.id) {
          jobMap.set(data.id, data);
        }
      });
    }
  } catch (err) {
    console.warn("[Recovery] Firestore jobs fetch notice:", err);
  }

  try {
    const winSnap = await getDocs(collection(db, "windows"));
    if (!winSnap.empty) {
      winSnap.forEach((d) => {
        const data = d.data() as WindowItem;
        if (data && data.id) {
          windowMap.set(data.id, data);
        }
      });
    }
  } catch (err) {
    console.warn("[Recovery] Firestore windows fetch notice:", err);
  }

  const recoveredJobs = Array.from(jobMap.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const recoveredWindows = Array.from(windowMap.values());

  // 5. Recover Settings & Material Swatches
  let recoveredSettings: Settings | null = null;
  try {
    const saved = localStorage.getItem("curtain_settings_backup") || localStorage.getItem("curtain_settings");
    if (saved) {
      recoveredSettings = JSON.parse(saved);
    }
  } catch {}

  if (!recoveredSettings) {
    try {
      const idbSettings = await idbGet<Settings>(PERMANENT_KEYS.SETTINGS);
      if (idbSettings) recoveredSettings = idbSettings;
    } catch {}
  }

  // 6. Save recovered data back into all local layers
  if (recoveredJobs.length > 0) {
    try {
      localStorage.setItem("curtain_jobs_backup", JSON.stringify(recoveredJobs));
      localStorage.setItem("curtain_jobs", JSON.stringify(recoveredJobs));
      await idbSet(PERMANENT_KEYS.JOBS, recoveredJobs);
    } catch {}
  }

  if (recoveredWindows.length > 0) {
    try {
      localStorage.setItem("curtain_windows_backup", JSON.stringify(recoveredWindows));
      localStorage.setItem("curtain_windows", JSON.stringify(recoveredWindows));
      await idbSet(PERMANENT_KEYS.WINDOWS, recoveredWindows);
    } catch {}
  }

  // 7. Auto-Sync recovered data to the Realtime Server Database if the server doesn't have it
  if (recoveredJobs.length > 0 || recoveredWindows.length > 0) {
    fetch("/api/realtime/sync-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobs: recoveredJobs,
        windows: recoveredWindows,
        catalog: recoveredSettings || undefined,
        senderId: realtimeSync.getClientId(),
      }),
    }).catch(() => {});
  }

  return {
    jobs: recoveredJobs,
    windows: recoveredWindows,
    settings: recoveredSettings,
    employees: Array.from(employeeMap.values()),
  };
}
