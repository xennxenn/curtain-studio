import { Settings, Job, WindowItem, Employee } from "../types";
import { idbSet, PERMANENT_KEYS } from "./indexedDbStorage";

// Generate a persistent or session client ID to distinguish self broadcasts
const CLIENT_ID = (typeof crypto !== "undefined" && crypto.randomUUID) 
  ? crypto.randomUUID() 
  : "client_" + Math.random().toString(36).substring(2, 9);

export type RealtimeConnectionState = "connected" | "connecting" | "disconnected" | "reconnecting";

interface RealtimeStatus {
  state: RealtimeConnectionState;
  activeClients: number;
  lastSyncTime: number | null;
}

type SettingsListener = (settings: Settings) => void;
type JobsListener = (jobs: Job[]) => void;
type WindowsListener = (windows: WindowItem[]) => void;
type EmployeesListener = (employees: Employee[]) => void;
type StatusListener = (status: RealtimeStatus) => void;

class RealtimeSyncManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 30;
  private reconnectTimer: any = null;
  private pingInterval: any = null;
  private isExplicitlyClosed = false;

  private currentStatus: RealtimeStatus = {
    state: "connecting",
    activeClients: 1,
    lastSyncTime: null,
  };

  private settingsListeners = new Set<SettingsListener>();
  private jobsListeners = new Set<JobsListener>();
  private windowsListeners = new Set<WindowsListener>();
  private employeesListeners = new Set<EmployeesListener>();
  private statusListeners = new Set<StatusListener>();

  // Cached in-memory states for quick local access
  private cachedSettings: Settings | null = null;
  private cachedJobs: Job[] = [];
  private cachedWindows: WindowItem[] = [];
  private cachedEmployees: Employee[] = [];

  constructor() {
    if (typeof window !== "undefined") {
      // Pre-load from local storage so cached data is ready immediately
      try {
        const rawJobs = localStorage.getItem("curtain_jobs_backup") || localStorage.getItem("curtain_jobs");
        if (rawJobs) this.cachedJobs = JSON.parse(rawJobs);
      } catch {}
      try {
        const rawWins = localStorage.getItem("curtain_windows_backup") || localStorage.getItem("curtain_windows");
        if (rawWins) this.cachedWindows = JSON.parse(rawWins);
      } catch {}
      try {
        const rawSet = localStorage.getItem("curtain_settings_backup") || localStorage.getItem("curtain_settings");
        if (rawSet) this.cachedSettings = JSON.parse(rawSet);
      } catch {}

      this.initConnection();
      // Fetch initial HTTP snapshot as well to guarantee zero latency on first paint
      this.fetchServerStateSnapshot();
    }
  }

  public getClientId(): string {
    return CLIENT_ID;
  }

  public getStatus(): RealtimeStatus {
    return { ...this.currentStatus };
  }

  private updateStatus(partial: Partial<RealtimeStatus>) {
    this.currentStatus = { ...this.currentStatus, ...partial };
    this.statusListeners.forEach((cb) => {
      try {
        cb(this.getStatus());
      } catch (err) {
        console.warn("Error in statusListener:", err);
      }
    });
  }

  public subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.getStatus());
    return () => this.statusListeners.delete(listener);
  }

  public subscribeSettings(listener: SettingsListener): () => void {
    this.settingsListeners.add(listener);
    if (this.cachedSettings) {
      listener(this.cachedSettings);
    }
    return () => this.settingsListeners.delete(listener);
  }

  public subscribeJobs(listener: JobsListener): () => void {
    this.jobsListeners.add(listener);
    if (this.cachedJobs.length > 0) {
      listener(this.cachedJobs);
    }
    return () => this.jobsListeners.delete(listener);
  }

  public subscribeWindows(listener: WindowsListener): () => void {
    this.windowsListeners.add(listener);
    if (this.cachedWindows.length > 0) {
      listener(this.cachedWindows);
    }
    return () => this.windowsListeners.delete(listener);
  }

  public subscribeEmployees(listener: EmployeesListener): () => void {
    this.employeesListeners.add(listener);
    if (this.cachedEmployees.length > 0) {
      listener(this.cachedEmployees);
    }
    return () => this.employeesListeners.delete(listener);
  }

  private initConnection() {
    if (typeof window === "undefined") return;

    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    this.updateStatus({ state: this.reconnectAttempts > 0 ? "reconnecting" : "connecting" });

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log("⚡ [RealtimeSync] WebSocket connected successfully to server broadcast hub!");
        this.reconnectAttempts = 0;
        this.updateStatus({ state: "connected", lastSyncTime: Date.now() });

        // Start ping heartbeat every 20s
        clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: "PING" }));
          }
        }, 20000);
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.handleIncomingMessage(payload);
        } catch (err) {
          console.warn("[RealtimeSync] Error parsing message:", err);
        }
      };

      this.ws.onclose = () => {
        console.log("⚡ [RealtimeSync] WebSocket connection closed. Scheduling auto-reconnect...");
        this.updateStatus({ state: "disconnected" });
        clearInterval(this.pingInterval);
        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        console.warn("[RealtimeSync] WebSocket encountered error:", err);
        try {
          this.ws?.close();
        } catch {}
      };
    } catch (err) {
      console.warn("[RealtimeSync] Failed to initialize WebSocket:", err);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    clearTimeout(this.reconnectTimer);
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      if (!this.isExplicitlyClosed) {
        this.initConnection();
      }
    }, delay);
  }

  private handleIncomingMessage(payload: any) {
    const { type, data, senderId } = payload;

    // Ignore self-sent echoes if needed, but for most mutations applying it guarantees sync
    if (type === "PONG") {
      return;
    }

    if (type === "CLIENT_COUNT") {
      if (data && typeof data.count === "number") {
        this.updateStatus({ activeClients: data.count });
      }
      return;
    }

    if (type === "INIT" || type === "FULL_STATE_UPDATE") {
      const { catalog, jobs, windows, employees, connectedCount } = data || {};
      this.updateStatus({
        activeClients: typeof connectedCount === "number" ? connectedCount : this.currentStatus.activeClients,
        lastSyncTime: Date.now(),
      });

      // 1. Catalog Merging
      if (catalog && typeof catalog === "object") {
        if (!this.cachedSettings) {
          this.cachedSettings = catalog;
        } else {
          this.cachedSettings = { ...this.cachedSettings, ...catalog };
        }
        this.persistCatalogLocally(this.cachedSettings);
        this.settingsListeners.forEach((cb) => cb(this.cachedSettings!));
      }

      // 2. Jobs Merging (Never wipe if server has 0 and local has items)
      if (Array.isArray(jobs)) {
        if (jobs.length > 0) {
          const map = new Map<string, Job>();
          this.cachedJobs.forEach((j) => { if (j && j.id) map.set(j.id, j); });
          jobs.forEach((j) => { if (j && j.id) map.set(j.id, j); });
          const merged = Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          this.cachedJobs = merged;
          this.persistJobsLocally(merged);
          this.jobsListeners.forEach((cb) => cb(merged));
        } else if (this.cachedJobs.length > 0) {
          // Server was empty, broadcast our local jobs to populate server
          this.sendEvent("FORCE_SYNC_ALL", {
            catalog: this.cachedSettings,
            jobs: this.cachedJobs,
            windows: this.cachedWindows,
            employees: this.cachedEmployees,
          }, "/api/realtime/sync-all", {
            catalog: this.cachedSettings,
            jobs: this.cachedJobs,
            windows: this.cachedWindows,
            employees: this.cachedEmployees,
          });
          this.jobsListeners.forEach((cb) => cb(this.cachedJobs));
        }
      }

      // 3. Windows Merging (Never wipe if server has 0 and local has items)
      if (Array.isArray(windows)) {
        if (windows.length > 0) {
          const map = new Map<string, WindowItem>();
          this.cachedWindows.forEach((w) => { if (w && w.id) map.set(w.id, w); });
          windows.forEach((w) => { if (w && w.id) map.set(w.id, w); });
          const merged = Array.from(map.values());
          this.cachedWindows = merged;
          this.persistWindowsLocally(merged);
          this.windowsListeners.forEach((cb) => cb(merged));
        } else if (this.cachedWindows.length > 0) {
          this.windowsListeners.forEach((cb) => cb(this.cachedWindows));
        }
      }

      // 4. Employees Merging
      if (Array.isArray(employees) && employees.length > 0) {
        this.cachedEmployees = employees;
        this.persistEmployeesLocally(employees);
        this.employeesListeners.forEach((cb) => cb(employees));
      }
      return;
    }

    if (type === "SETTINGS_UPDATE") {
      if (data && typeof data === "object") {
        this.cachedSettings = data;
        this.persistCatalogLocally(data);
        this.settingsListeners.forEach((cb) => cb(data));
        this.updateStatus({ lastSyncTime: Date.now() });
      }
    } else if (type === "MATERIAL_SAVE") {
      const { collectionKey, item } = data || {};
      if (collectionKey && item && this.cachedSettings) {
        const list = Array.isArray((this.cachedSettings as any)[collectionKey])
          ? [...(this.cachedSettings as any)[collectionKey]]
          : [];
        const idx = list.findIndex((x: any) => x.id === item.id);
        if (idx >= 0) list[idx] = item;
        else list.push(item);
        const updated = { ...this.cachedSettings, [collectionKey]: list };
        this.cachedSettings = updated;
        this.persistCatalogLocally(updated);
        this.settingsListeners.forEach((cb) => cb(updated));
        this.updateStatus({ lastSyncTime: Date.now() });
      }
    } else if (type === "MATERIAL_DELETE") {
      const { collectionKey, itemId } = data || {};
      if (collectionKey && itemId && this.cachedSettings) {
        const list = Array.isArray((this.cachedSettings as any)[collectionKey])
          ? [...(this.cachedSettings as any)[collectionKey]]
          : [];
        const filtered = list.filter((x: any) => x.id !== itemId);
        const updated = { ...this.cachedSettings, [collectionKey]: filtered };
        this.cachedSettings = updated;
        this.persistCatalogLocally(updated);
        this.settingsListeners.forEach((cb) => cb(updated));
        this.updateStatus({ lastSyncTime: Date.now() });
      }
    } else if (type === "JOB_SAVE") {
      if (data && data.id) {
        const list = [...this.cachedJobs];
        const idx = list.findIndex((j) => j.id === data.id);
        if (idx >= 0) list[idx] = data;
        else list.unshift(data);
        this.cachedJobs = list;
        this.persistJobsLocally(list);
        this.jobsListeners.forEach((cb) => cb(list));
        this.updateStatus({ lastSyncTime: Date.now() });
      }
    } else if (type === "JOB_DELETE") {
      const jobId = typeof data === "string" ? data : data?.jobId;
      if (jobId) {
        const list = this.cachedJobs.filter((j) => j.id !== jobId);
        this.cachedJobs = list;
        this.persistJobsLocally(list);
        this.jobsListeners.forEach((cb) => cb(list));

        const winList = this.cachedWindows.filter((w) => w.jobId !== jobId);
        this.cachedWindows = winList;
        this.persistWindowsLocally(winList);
        this.windowsListeners.forEach((cb) => cb(winList));
        this.updateStatus({ lastSyncTime: Date.now() });
      }
    } else if (type === "WINDOW_SAVE") {
      if (data && data.id) {
        const list = [...this.cachedWindows];
        const idx = list.findIndex((w) => w.id === data.id);
        if (idx >= 0) list[idx] = data;
        else list.push(data);
        this.cachedWindows = list;
        this.persistWindowsLocally(list);
        this.windowsListeners.forEach((cb) => cb(list));
        this.updateStatus({ lastSyncTime: Date.now() });
      }
    } else if (type === "WINDOW_DELETE") {
      const windowId = typeof data === "string" ? data : data?.windowId;
      if (windowId) {
        const list = this.cachedWindows.filter((w) => w.id !== windowId);
        this.cachedWindows = list;
        this.persistWindowsLocally(list);
        this.windowsListeners.forEach((cb) => cb(list));
        this.updateStatus({ lastSyncTime: Date.now() });
      }
    } else if (type === "EMPLOYEE_SAVE") {
      if (data && data.id) {
        const list = [...this.cachedEmployees];
        const idx = list.findIndex((e) => e.id === data.id);
        if (idx >= 0) list[idx] = data;
        else list.push(data);
        this.cachedEmployees = list;
        this.persistEmployeesLocally(list);
        this.employeesListeners.forEach((cb) => cb(list));
        this.updateStatus({ lastSyncTime: Date.now() });
      }
    } else if (type === "EMPLOYEE_DELETE") {
      const employeeId = typeof data === "string" ? data : data?.employeeId;
      if (employeeId) {
        const list = this.cachedEmployees.filter((e) => e.id !== employeeId);
        this.cachedEmployees = list;
        this.persistEmployeesLocally(list);
        this.employeesListeners.forEach((cb) => cb(list));
        this.updateStatus({ lastSyncTime: Date.now() });
      }
    }
  }

  private persistCatalogLocally(catalog: Settings) {
    try {
      localStorage.setItem("curtain_settings", JSON.stringify(catalog));
      localStorage.setItem("curtain_settings_backup", JSON.stringify(catalog));
    } catch {}
    idbSet(PERMANENT_KEYS.SETTINGS, catalog);
  }

  private persistJobsLocally(jobs: Job[]) {
    try {
      localStorage.setItem("curtain_jobs", JSON.stringify(jobs));
      localStorage.setItem("curtain_jobs_backup", JSON.stringify(jobs));
    } catch {}
    idbSet(PERMANENT_KEYS.JOBS, jobs);
  }

  private persistWindowsLocally(windows: WindowItem[]) {
    try {
      localStorage.setItem("curtain_windows", JSON.stringify(windows));
      localStorage.setItem("curtain_windows_backup", JSON.stringify(windows));
    } catch {}
    idbSet(PERMANENT_KEYS.WINDOWS, windows);
  }

  private persistEmployeesLocally(employees: Employee[]) {
    try {
      localStorage.setItem("curtain_employees", JSON.stringify(employees));
      localStorage.setItem("curtain_employees_backup", JSON.stringify(employees));
    } catch {}
    idbSet("permanent_employees", employees);
  }

  public async fetchServerStateSnapshot(): Promise<boolean> {
    try {
      const res = await fetch("/api/realtime/state");
      if (!res.ok) return false;
      const json = await res.json();
      if (json && json.success && json.data) {
        this.handleIncomingMessage({ type: "INIT", data: json.data });
        return true;
      }
    } catch (err) {
      console.warn("[RealtimeSync] Could not fetch HTTP state snapshot:", err);
    }
    return false;
  }

  private sendEvent(type: string, data: any, apiFallbackUrl?: string, apiFallbackBody?: any) {
    const payload = {
      type,
      data,
      senderId: CLIENT_ID,
      timestamp: Date.now(),
    };

    let sentViaWs = false;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(payload));
        sentViaWs = true;
      } catch (err) {
        console.warn("[RealtimeSync] Failed to send over WebSocket:", err);
      }
    }

    // If WS is not open or as backup, send via REST API
    if (!sentViaWs && apiFallbackUrl) {
      fetch(apiFallbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(apiFallbackBody || { data }), senderId: CLIENT_ID }),
      }).catch((e) => console.warn("[RealtimeSync] HTTP fallback sync error:", e));
    }
  }

  public broadcastSettings(settings: Settings) {
    this.cachedSettings = settings;
    this.sendEvent("SETTINGS_UPDATE", settings, "/api/realtime/sync-settings", { settings });
  }

  public broadcastMaterialSave(collectionKey: string, item: any) {
    if (this.cachedSettings) {
      const list = Array.isArray((this.cachedSettings as any)[collectionKey])
        ? [...(this.cachedSettings as any)[collectionKey]]
        : [];
      const idx = list.findIndex((x: any) => x.id === item.id);
      if (idx >= 0) list[idx] = item;
      else list.push(item);
      this.cachedSettings = { ...this.cachedSettings, [collectionKey]: list };
    }
    this.sendEvent("MATERIAL_SAVE", { collectionKey, item }, "/api/realtime/sync-material", { collectionKey, item });
  }

  public broadcastMaterialDelete(collectionKey: string, itemId: string) {
    if (this.cachedSettings) {
      const list = Array.isArray((this.cachedSettings as any)[collectionKey])
        ? [...(this.cachedSettings as any)[collectionKey]]
        : [];
      this.cachedSettings = { ...this.cachedSettings, [collectionKey]: list.filter((x: any) => x.id !== itemId) };
    }
    this.sendEvent("MATERIAL_DELETE", { collectionKey, itemId }, "/api/realtime/delete-material", { collectionKey, itemId });
  }

  public broadcastJobSave(job: Job) {
    const list = [...this.cachedJobs];
    const idx = list.findIndex((j) => j.id === job.id);
    if (idx >= 0) list[idx] = job;
    else list.unshift(job);
    this.cachedJobs = list;
    this.sendEvent("JOB_SAVE", job, "/api/realtime/sync-job", { job });
  }

  public broadcastJobDelete(jobId: string) {
    this.cachedJobs = this.cachedJobs.filter((j) => j.id !== jobId);
    this.cachedWindows = this.cachedWindows.filter((w) => w.jobId !== jobId);
    this.sendEvent("JOB_DELETE", { jobId }, "/api/realtime/delete-job", { jobId });
  }

  public broadcastWindowSave(window: WindowItem) {
    const list = [...this.cachedWindows];
    const idx = list.findIndex((w) => w.id === window.id);
    if (idx >= 0) list[idx] = window;
    else list.push(window);
    this.cachedWindows = list;
    this.sendEvent("WINDOW_SAVE", window, "/api/realtime/sync-window", { window });
  }

  public broadcastWindowDelete(windowId: string) {
    this.cachedWindows = this.cachedWindows.filter((w) => w.id !== windowId);
    this.sendEvent("WINDOW_DELETE", { windowId }, "/api/realtime/delete-window", { windowId });
  }

  public broadcastEmployeeSave(employee: Employee) {
    const list = [...this.cachedEmployees];
    const idx = list.findIndex((e) => e.id === employee.id);
    if (idx >= 0) list[idx] = employee;
    else list.push(employee);
    this.cachedEmployees = list;
    this.sendEvent("EMPLOYEE_SAVE", employee, "/api/realtime/sync-employee", { employee });
  }

  public broadcastEmployeeDelete(employeeId: string) {
    this.cachedEmployees = this.cachedEmployees.filter((e) => e.id !== employeeId);
    this.sendEvent("EMPLOYEE_DELETE", { employeeId }, "/api/realtime/delete-employee", { employeeId });
  }

  public broadcastFullState(state: { catalog: Settings; jobs: Job[]; windows: WindowItem[]; employees: Employee[] }) {
    this.sendEvent("FORCE_SYNC_ALL", state, "/api/realtime/sync-all", state);
  }
}

export const realtimeSync = new RealtimeSyncManager();
