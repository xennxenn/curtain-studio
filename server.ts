import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { COMPLETE_DEFAULT_SETTINGS } from "./src/lib/defaultCatalogData";

dotenv.config();

const __filenameResolved = typeof __filename !== "undefined"
  ? __filename
  : (typeof import.meta !== "undefined" && import.meta.url)
    ? fileURLToPath(import.meta.url)
    : "";
const __dirnameResolved = typeof __dirname !== "undefined"
  ? __dirname
  : path.dirname(__filenameResolved);

const DATA_DIR = path.join(process.cwd(), "data");
const CONFIG_FILE_PATH = path.join(DATA_DIR, "server-data-cache.json");
const DATABASE_FILE_PATH = path.join(DATA_DIR, "server-database.json");

const DEFAULT_EMPLOYEES = [
  { id: "1", name: "ผู้ดูแลระบบ (Admin)", aiQuota: 100, aiUsed: 0, username: "T58121", password: "Admin", role: "admin" },
  { id: "2", name: "คุณอรพรรณ (Designer)", aiQuota: 30, aiUsed: 4, username: "designer1", password: "123", role: "designer" },
  { id: "3", name: "คุณธีรเดช (Sales Representative)", aiQuota: 30, aiUsed: 12, username: "sales1", password: "123", role: "installer" },
];

interface ServerDatabaseState {
  apiKey: string | null;
  catalog: any;
  jobs: any[];
  windows: any[];
  employees: any[];
  savedAt: string;
}

// Helper to safely persist complete server database to disk
function saveServerDatabaseToDisk(state: {
  apiKey: string | null;
  catalog: any;
  jobs: any[];
  windows: any[];
  employees: any[];
}) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const payload: ServerDatabaseState = {
      apiKey: state.apiKey || null,
      catalog: state.catalog || { ...COMPLETE_DEFAULT_SETTINGS },
      jobs: state.jobs || [],
      windows: state.windows || [],
      employees: state.employees && state.employees.length > 0 ? state.employees : DEFAULT_EMPLOYEES,
      savedAt: new Date().toISOString(),
    };
    fs.writeFileSync(DATABASE_FILE_PATH, JSON.stringify(payload, null, 2), "utf-8");
    // Also save legacy config file for compatibility
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify({ apiKey: payload.apiKey, catalog: payload.catalog, savedAt: payload.savedAt }, null, 2), "utf-8");
  } catch (err) {
    console.warn("Failed to write server database to disk:", err);
  }
}

// Helper to load complete server database from disk on startup
function loadServerDataFromDisk(): ServerDatabaseState {
  try {
    if (fs.existsSync(DATABASE_FILE_PATH)) {
      const raw = fs.readFileSync(DATABASE_FILE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        apiKey: parsed.apiKey || null,
        catalog: parsed.catalog || { ...COMPLETE_DEFAULT_SETTINGS },
        jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
        windows: Array.isArray(parsed.windows) ? parsed.windows : [],
        employees: Array.isArray(parsed.employees) && parsed.employees.length > 0 ? parsed.employees : DEFAULT_EMPLOYEES,
        savedAt: parsed.savedAt || new Date().toISOString(),
      };
    } else if (fs.existsSync(CONFIG_FILE_PATH)) {
      const raw = fs.readFileSync(CONFIG_FILE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        apiKey: parsed.apiKey || null,
        catalog: parsed.catalog || { ...COMPLETE_DEFAULT_SETTINGS },
        jobs: [],
        windows: [],
        employees: DEFAULT_EMPLOYEES,
        savedAt: new Date().toISOString(),
      };
    }
  } catch (err) {
    console.warn("Failed to load server database from disk:", err);
  }
  return {
    apiKey: null,
    catalog: { ...COMPLETE_DEFAULT_SETTINGS },
    jobs: [],
    windows: [],
    employees: DEFAULT_EMPLOYEES,
    savedAt: new Date().toISOString(),
  };
}

// Helper function to resolve image payload (base64 or HTTP/HTTPS url)
async function resolveImagePayload(imageInput: string): Promise<{ mimeType: string; data: string } | null> {
  if (!imageInput) return null;
  
  if (imageInput.startsWith("data:image/")) {
    const matches = imageInput.match(/^data:(image\/\w+);base64,(.+)$/);
    if (matches) {
      return {
        mimeType: matches[1],
        data: matches[2]
      };
    }
  } else if (imageInput.startsWith("http://") || imageInput.startsWith("https://")) {
    try {
      const response = await fetch(imageInput);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const buffer = await response.arrayBuffer();
      const base64Data = Buffer.from(buffer).toString("base64");
      let mimeType = response.headers.get("content-type") || "image/jpeg";
      if (!mimeType.startsWith("image/")) {
        mimeType = "image/jpeg";
      }
      return {
        mimeType,
        data: base64Data
      };
    } catch (err) {
      console.error(`Error fetching image from URL (${imageInput}):`, err);
      return null;
    }
  }
  return null;
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: "/ws" });
  const PORT = 3000;

  // Increase payload limit for base64 image transfers
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Load server-side persisted data from disk on startup
  const initialDiskData = loadServerDataFromDisk();

  // Central stored API key in memory (set by Admin)
  let serverConfiguredApiKey: string | null = initialDiskData.apiKey;

  // Central in-memory authoritative state caches
  let serverCatalogCache: any = initialDiskData.catalog || { ...COMPLETE_DEFAULT_SETTINGS };
  let serverJobsCache: any[] = initialDiskData.jobs || [];
  let serverWindowsCache: any[] = initialDiskData.windows || [];
  let serverEmployeesCache: any[] = initialDiskData.employees || DEFAULT_EMPLOYEES;

  const saveCurrentServerState = () => {
    saveServerDatabaseToDisk({
      apiKey: serverConfiguredApiKey,
      catalog: serverCatalogCache,
      jobs: serverJobsCache,
      windows: serverWindowsCache,
      employees: serverEmployeesCache,
    });
  };

  // Set of connected WebSocket clients
  const activeClients = new Set<WebSocket>();

  // Broadcast helper function to push realtime events to all connected clients
  function broadcast(event: { type: string; data?: any; senderId?: string }, excludeWs?: WebSocket) {
    const msg = JSON.stringify({ ...event, timestamp: Date.now() });
    for (const client of activeClients) {
      if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
        try {
          client.send(msg);
        } catch (e) {
          console.warn("[WS] Failed to send WebSocket message:", e);
        }
      }
    }
  }

  // Handle WebSocket connections
  wss.on("connection", (ws: WebSocket, req) => {
    activeClients.add(ws);
    console.log(`[WS] Client connected from ${req.socket.remoteAddress}. Active clients: ${activeClients.size}`);

    // Send complete initial snapshot to newly connected client
    try {
      ws.send(JSON.stringify({
        type: "INIT",
        data: {
          catalog: serverCatalogCache,
          jobs: serverJobsCache,
          windows: serverWindowsCache,
          employees: serverEmployeesCache,
          serverTime: Date.now(),
          connectedCount: activeClients.size,
        },
      }));
    } catch (err) {
      console.warn("[WS] Error sending INIT snapshot:", err);
    }

    // Broadcast client count to all clients
    broadcast({ type: "CLIENT_COUNT", data: { count: activeClients.size } });

    ws.on("message", (rawMessage) => {
      try {
        const parsed = JSON.parse(rawMessage.toString());
        const { type, data, senderId } = parsed;

        if (type === "PING") {
          ws.send(JSON.stringify({ type: "PONG", timestamp: Date.now() }));
          return;
        }

        if (type === "SETTINGS_UPDATE") {
          if (data && typeof data === "object") {
            const prev = serverCatalogCache || {};
            const merged = { ...prev, ...data };
            const materialKeys = [
              "solidFabricMaterials", "sheerFabricMaterials", "blindMaterials",
              "rollerMaterials", "blindTapeMaterials", "styleMaterials",
              "hemMaterials", "trackMaterials", "accessoryMaterials"
            ];
            materialKeys.forEach((k) => {
              if (Array.isArray(data[k])) {
                merged[k] = data[k];
              }
            });
            serverCatalogCache = merged;
            saveCurrentServerState();
            broadcast({ type: "SETTINGS_UPDATE", data: serverCatalogCache, senderId }, ws);
          }
        } else if (type === "MATERIAL_SAVE") {
          const { collectionKey, item } = data || {};
          if (collectionKey && item && item.id) {
            const list = Array.isArray(serverCatalogCache[collectionKey]) ? [...serverCatalogCache[collectionKey]] : [];
            const idx = list.findIndex((x: any) => x.id === item.id);
            if (idx >= 0) list[idx] = item;
            else list.push(item);
            serverCatalogCache[collectionKey] = list;
            saveCurrentServerState();
            broadcast({ type: "MATERIAL_SAVE", data: { collectionKey, item }, senderId }, ws);
          }
        } else if (type === "MATERIAL_DELETE") {
          const { collectionKey, itemId } = data || {};
          if (collectionKey && itemId) {
            const list = Array.isArray(serverCatalogCache[collectionKey]) ? [...serverCatalogCache[collectionKey]] : [];
            serverCatalogCache[collectionKey] = list.filter((x: any) => x.id !== itemId);
            saveCurrentServerState();
            broadcast({ type: "MATERIAL_DELETE", data: { collectionKey, itemId }, senderId }, ws);
          }
        } else if (type === "JOB_SAVE") {
          if (data && data.id) {
            const idx = serverJobsCache.findIndex((j: any) => j.id === data.id);
            if (idx >= 0) serverJobsCache[idx] = data;
            else serverJobsCache.unshift(data);
            saveCurrentServerState();
            broadcast({ type: "JOB_SAVE", data, senderId }, ws);
          }
        } else if (type === "JOB_DELETE") {
          const jobId = typeof data === "string" ? data : data?.jobId;
          if (jobId) {
            serverJobsCache = serverJobsCache.filter((j: any) => j.id !== jobId);
            serverWindowsCache = serverWindowsCache.filter((w: any) => w.jobId !== jobId);
            saveCurrentServerState();
            broadcast({ type: "JOB_DELETE", data: { jobId }, senderId }, ws);
          }
        } else if (type === "WINDOW_SAVE") {
          if (data && data.id) {
            const idx = serverWindowsCache.findIndex((w: any) => w.id === data.id);
            if (idx >= 0) serverWindowsCache[idx] = data;
            else serverWindowsCache.push(data);
            saveCurrentServerState();
            broadcast({ type: "WINDOW_SAVE", data, senderId }, ws);
          }
        } else if (type === "WINDOW_DELETE") {
          const windowId = typeof data === "string" ? data : data?.windowId;
          if (windowId) {
            serverWindowsCache = serverWindowsCache.filter((w: any) => w.id !== windowId);
            saveCurrentServerState();
            broadcast({ type: "WINDOW_DELETE", data: { windowId }, senderId }, ws);
          }
        } else if (type === "EMPLOYEE_SAVE") {
          if (data && data.id) {
            const idx = serverEmployeesCache.findIndex((e: any) => e.id === data.id);
            if (idx >= 0) serverEmployeesCache[idx] = data;
            else serverEmployeesCache.push(data);
            saveCurrentServerState();
            broadcast({ type: "EMPLOYEE_SAVE", data, senderId }, ws);
          }
        } else if (type === "EMPLOYEE_DELETE") {
          const empId = typeof data === "string" ? data : data?.employeeId;
          if (empId) {
            serverEmployeesCache = serverEmployeesCache.filter((e: any) => e.id !== empId);
            saveCurrentServerState();
            broadcast({ type: "EMPLOYEE_DELETE", data: { employeeId: empId }, senderId }, ws);
          }
        } else if (type === "FORCE_SYNC_ALL") {
          if (data) {
            if (data.catalog) serverCatalogCache = data.catalog;
            if (Array.isArray(data.jobs)) serverJobsCache = data.jobs;
            if (Array.isArray(data.windows)) serverWindowsCache = data.windows;
            if (Array.isArray(data.employees) && data.employees.length > 0) serverEmployeesCache = data.employees;
            saveCurrentServerState();
            broadcast({
              type: "FULL_STATE_UPDATE",
              data: {
                catalog: serverCatalogCache,
                jobs: serverJobsCache,
                windows: serverWindowsCache,
                employees: serverEmployeesCache,
              },
              senderId,
            }, ws);
          }
        }
      } catch (err) {
        console.warn("[WS] Error handling message:", err);
      }
    });

    ws.on("close", () => {
      activeClients.delete(ws);
      console.log(`[WS] Client disconnected. Active clients: ${activeClients.size}`);
      broadcast({ type: "CLIENT_COUNT", data: { count: activeClients.size } });
    });

    ws.on("error", (e) => {
      console.warn("[WS] Client socket error:", e);
      activeClients.delete(ws);
    });
  });

  // Keep-alive heartbeat every 25s
  setInterval(() => {
    for (const ws of activeClients) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.ping();
        } catch {
          activeClients.delete(ws);
        }
      }
    }
  }, 25000);

  // Shared lazy initializer for Gemini Client
  let aiClient: GoogleGenAI | null = null;
  function getGeminiClient(customApiKey?: string) {
    if (customApiKey && typeof customApiKey === "string" && customApiKey.trim().length > 10) {
      if (serverConfiguredApiKey !== customApiKey.trim()) {
        serverConfiguredApiKey = customApiKey.trim();
        saveCurrentServerState();
      }
    }
    const keyToUse = (serverConfiguredApiKey && serverConfiguredApiKey.trim().length > 10)
      ? serverConfiguredApiKey.trim()
      : (customApiKey && typeof customApiKey === "string" && customApiKey.trim().length > 10) 
      ? customApiKey.trim() 
      : process.env.GEMINI_API_KEY;

    if (!keyToUse || keyToUse.trim().length < 10) {
      throw new Error("GEMINI_API_KEY is not configured in server or admin settings.");
    }

    return new GoogleGenAI({
      apiKey: keyToUse.trim(),
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }

  // API endpoints
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      time: new Date().toISOString(),
      activeClients: activeClients.size,
      itemsCount: {
        jobs: serverJobsCache.length,
        windows: serverWindowsCache.length,
        employees: serverEmployeesCache.length,
        fabrics: (serverCatalogCache.solidFabricMaterials || []).length,
      }
    });
  });

  // Full Realtime Server State Snapshot (REST API fallback)
  app.get("/api/realtime/state", (req, res) => {
    res.json({
      success: true,
      data: {
        catalog: serverCatalogCache,
        jobs: serverJobsCache,
        windows: serverWindowsCache,
        employees: serverEmployeesCache,
        connectedCount: activeClients.size,
        serverTime: Date.now(),
      }
    });
  });

  // Realtime Sync Endpoints for REST Clients
  app.post("/api/realtime/sync-settings", (req, res) => {
    const { settings, senderId } = req.body;
    if (settings && typeof settings === "object") {
      serverCatalogCache = { ...serverCatalogCache, ...settings };
      saveCurrentServerState();
      broadcast({ type: "SETTINGS_UPDATE", data: serverCatalogCache, senderId });
      res.json({ success: true, message: "บันทึกและบรอดแคสต์ข้อมูลการตั้งค่าเรียบร้อยแล้ว" });
    } else {
      res.status(400).json({ success: false, message: "ข้อมูลการตั้งค่าไม่ถูกต้อง" });
    }
  });

  app.post("/api/realtime/sync-material", (req, res) => {
    const { collectionKey, item, senderId } = req.body;
    if (collectionKey && item && item.id) {
      const list = Array.isArray(serverCatalogCache[collectionKey]) ? [...serverCatalogCache[collectionKey]] : [];
      const idx = list.findIndex((x: any) => x.id === item.id);
      if (idx >= 0) list[idx] = item;
      else list.push(item);
      serverCatalogCache[collectionKey] = list;
      saveCurrentServerState();
      broadcast({ type: "MATERIAL_SAVE", data: { collectionKey, item }, senderId });
      res.json({ success: true, message: "บันทึกและบรอดแคสต์วัสดุเรียบร้อยแล้ว" });
    } else {
      res.status(400).json({ success: false, message: "ข้อมูลวัสดุไม่ถูกต้อง" });
    }
  });

  app.post("/api/realtime/delete-material", (req, res) => {
    const { collectionKey, itemId, senderId } = req.body;
    if (collectionKey && itemId) {
      const list = Array.isArray(serverCatalogCache[collectionKey]) ? [...serverCatalogCache[collectionKey]] : [];
      serverCatalogCache[collectionKey] = list.filter((x: any) => x.id !== itemId);
      saveCurrentServerState();
      broadcast({ type: "MATERIAL_DELETE", data: { collectionKey, itemId }, senderId });
      res.json({ success: true, message: "ลบและบรอดแคสต์วัสดุเรียบร้อยแล้ว" });
    } else {
      res.status(400).json({ success: false, message: "ข้อมูลไม่ถูกต้อง" });
    }
  });

  app.post("/api/realtime/sync-job", (req, res) => {
    const { job, senderId } = req.body;
    if (job && job.id) {
      const idx = serverJobsCache.findIndex((j: any) => j.id === job.id);
      if (idx >= 0) serverJobsCache[idx] = job;
      else serverJobsCache.unshift(job);
      saveCurrentServerState();
      broadcast({ type: "JOB_SAVE", data: job, senderId });
      res.json({ success: true, message: "บันทึกและบรอดแคสต์งานเรียบร้อยแล้ว" });
    } else {
      res.status(400).json({ success: false, message: "ข้อมูลงานไม่ถูกต้อง" });
    }
  });

  app.post("/api/realtime/delete-job", (req, res) => {
    const { jobId, senderId } = req.body;
    if (jobId) {
      serverJobsCache = serverJobsCache.filter((j: any) => j.id !== jobId);
      serverWindowsCache = serverWindowsCache.filter((w: any) => w.jobId !== jobId);
      saveCurrentServerState();
      broadcast({ type: "JOB_DELETE", data: { jobId }, senderId });
      res.json({ success: true, message: "ลบและบรอดแคสต์งานเรียบร้อยแล้ว" });
    } else {
      res.status(400).json({ success: false, message: "ข้อมูล jobId ไม่ถูกต้อง" });
    }
  });

  app.post("/api/realtime/sync-window", (req, res) => {
    const { window, senderId } = req.body;
    if (window && window.id) {
      const idx = serverWindowsCache.findIndex((w: any) => w.id === window.id);
      if (idx >= 0) serverWindowsCache[idx] = window;
      else serverWindowsCache.push(window);
      saveCurrentServerState();
      broadcast({ type: "WINDOW_SAVE", data: window, senderId });
      res.json({ success: true, message: "บันทึกและบรอดแคสต์หน้าต่างเรียบร้อยแล้ว" });
    } else {
      res.status(400).json({ success: false, message: "ข้อมูลหน้าต่างไม่ถูกต้อง" });
    }
  });

  app.post("/api/realtime/delete-window", (req, res) => {
    const { windowId, senderId } = req.body;
    if (windowId) {
      serverWindowsCache = serverWindowsCache.filter((w: any) => w.id !== windowId);
      saveCurrentServerState();
      broadcast({ type: "WINDOW_DELETE", data: { windowId }, senderId });
      res.json({ success: true, message: "ลบและบรอดแคสต์หน้าต่างเรียบร้อยแล้ว" });
    } else {
      res.status(400).json({ success: false, message: "ข้อมูล windowId ไม่ถูกต้อง" });
    }
  });

  app.post("/api/realtime/sync-employee", (req, res) => {
    const { employee, senderId } = req.body;
    if (employee && employee.id) {
      const idx = serverEmployeesCache.findIndex((e: any) => e.id === employee.id);
      if (idx >= 0) serverEmployeesCache[idx] = employee;
      else serverEmployeesCache.push(employee);
      saveCurrentServerState();
      broadcast({ type: "EMPLOYEE_SAVE", data: employee, senderId });
      res.json({ success: true, message: "บันทึกและบรอดแคสต์พนักงานเรียบร้อยแล้ว" });
    } else {
      res.status(400).json({ success: false, message: "ข้อมูลพนักงานไม่ถูกต้อง" });
    }
  });

  app.post("/api/realtime/delete-employee", (req, res) => {
    const { employeeId, senderId } = req.body;
    if (employeeId) {
      serverEmployeesCache = serverEmployeesCache.filter((e: any) => e.id !== employeeId);
      saveCurrentServerState();
      broadcast({ type: "EMPLOYEE_DELETE", data: { employeeId }, senderId });
      res.json({ success: true, message: "ลบและบรอดแคสต์พนักงานเรียบร้อยแล้ว" });
    } else {
      res.status(400).json({ success: false, message: "ข้อมูล employeeId ไม่ถูกต้อง" });
    }
  });

  app.post("/api/realtime/sync-all", (req, res) => {
    const { catalog, jobs, windows, employees, senderId } = req.body;
    if (catalog) serverCatalogCache = catalog;
    if (Array.isArray(jobs)) serverJobsCache = jobs;
    if (Array.isArray(windows)) serverWindowsCache = windows;
    if (Array.isArray(employees) && employees.length > 0) serverEmployeesCache = employees;
    saveCurrentServerState();
    broadcast({
      type: "FULL_STATE_UPDATE",
      data: {
        catalog: serverCatalogCache,
        jobs: serverJobsCache,
        windows: serverWindowsCache,
        employees: serverEmployeesCache,
      },
      senderId,
    });
    res.json({
      success: true,
      message: "ซิงค์ฐานข้อมูลทั้งหมดขึ้นเซิร์ฟเวอร์และบรอดแคสต์ไปยังทุกเครื่องเรียบร้อยแล้ว",
      counts: {
        jobs: serverJobsCache.length,
        windows: serverWindowsCache.length,
        employees: serverEmployeesCache.length,
      }
    });
  });

  // Central Catalog Bundle Sync (Legacy API compatibility)
  app.get("/api/catalog/current", (req, res) => {
    if (!serverCatalogCache) {
      serverCatalogCache = { ...COMPLETE_DEFAULT_SETTINGS };
    }

    res.json({ 
      success: true, 
      hasServerCatalog: true,
      catalog: serverCatalogCache 
    });
  });

  app.post("/api/catalog/sync", (req, res) => {
    const { catalog, allowEmptyWipe } = req.body;
    if (catalog && typeof catalog === "object") {
      const prevCatalog = serverCatalogCache || {};
      const mergedCatalog = { ...prevCatalog, ...catalog };

      const materialKeys = [
        "solidFabricMaterials",
        "sheerFabricMaterials",
        "blindMaterials",
        "rollerMaterials",
        "blindTapeMaterials",
        "styleMaterials",
        "hemMaterials",
        "trackMaterials",
        "accessoryMaterials",
      ];

      materialKeys.forEach((key) => {
        if (Array.isArray(catalog[key])) {
          if (catalog[key].length > 0 || allowEmptyWipe) {
            mergedCatalog[key] = catalog[key];
          } else if (Array.isArray(prevCatalog[key]) && prevCatalog[key].length > 0) {
            mergedCatalog[key] = prevCatalog[key];
          }
        } else if (Array.isArray(prevCatalog[key])) {
          mergedCatalog[key] = prevCatalog[key];
        }
      });

      serverCatalogCache = mergedCatalog;
      saveCurrentServerState();
      broadcast({ type: "SETTINGS_UPDATE", data: serverCatalogCache });
      res.json({ success: true, message: "บันทึกข้อมูลแคตตาล็อกบนเซิร์ฟเวอร์เรียบร้อยแล้ว" });
    } else {
      res.status(400).json({ success: false, message: "ข้อมูลแคตตาล็อกไม่ถูกต้อง" });
    }
  });

  // Emergency Catalog Restore from Backup File
  app.post("/api/catalog/restore-backup", (req, res) => {
    try {
      const backupPath = path.join(process.cwd(), "data", "catalog-backup.json");
      if (fs.existsSync(backupPath)) {
        const raw = fs.readFileSync(backupPath, "utf-8");
        const backupData = JSON.parse(raw);
        if (backupData && backupData.catalog) {
          serverCatalogCache = backupData.catalog;
          saveCurrentServerState();
          broadcast({ type: "SETTINGS_UPDATE", data: serverCatalogCache });
          return res.json({ success: true, catalog: backupData.catalog, message: "กู้คืนข้อมูลแคตตาล็อกสำเร็จ" });
        }
      }
      res.status(404).json({ success: false, message: "ไม่พบไฟล์สำรองข้อมูล" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message || "เกิดข้อผิดพลาดในการกู้คืน" });
    }
  });

  // Central Gemini API Key Configuration
  app.get("/api/config/gemini-key-status", (req, res) => {
    const hasKey = !!(
      (serverConfiguredApiKey && serverConfiguredApiKey.length > 10) || 
      (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 10)
    );
    res.json({ 
      hasConfiguredKey: hasKey, 
      source: serverConfiguredApiKey ? "admin_central" : process.env.GEMINI_API_KEY ? "env_secret" : "none" 
    });
  });

  app.post("/api/config/gemini-key", (req, res) => {
    const { apiKey } = req.body;
    if (apiKey && typeof apiKey === "string" && apiKey.trim().length > 10) {
      serverConfiguredApiKey = apiKey.trim();
      saveCurrentServerState();
      res.json({ success: true, message: "บันทึก API Key กลางบนเซิร์ฟเวอร์เรียบร้อยแล้ว ทุกเครื่องสามารถใช้งานได้ทันที" });
    } else if (apiKey === "" || apiKey === null) {
      serverConfiguredApiKey = null;
      saveCurrentServerState();
      res.json({ success: true, message: "ยกเลิก API Key กลางบนเซิร์ฟเวอร์เรียบร้อยแล้ว" });
    } else {
      res.status(400).json({ success: false, message: "รูปแบบ API Key ไม่ถูกต้อง" });
    }
  });

  // AI Curtain preview generator
  app.post("/api/gemini/preview-curtain", async (req: express.Request, res: express.Response) => {
    try {
      const { 
        roomImage, 
        fabricImage, 
        sheerImage,
        style, 
        styleEnForAi,
        sheerStyle,
        sheerStyleEnForAi,
        pattern, 
        color, 
        track, 
        accessories, 
        notes,
        isDoubleLayer,
        layer1Style,
        layer2Style,
        solidFabricType,
        sheerFabricType,
        isBlind,
        isRoller,
        solidFabricName,
        sheerFabricName,
        customGeminiApiKey,
        distanceLeft,
        distanceRight,
        distanceTop,
        distanceBottom,
        hemStyleText
      } = req.body;

      if (!roomImage) {
        return res.status(400).json({ success: false, message: "กรุณาอัปโหลดรูปภาพห้องก่อน" });
      }

      // Lazy check and initialize Gemini Client
      let ai;
      try {
        ai = getGeminiClient(customGeminiApiKey);
      } catch (authError: any) {
        return res.status(500).json({
          success: false,
          message: "ไม่พบ API Key สำหรับใช้บริการ AI กรุณากำหนดค่าในแถบ Settings > Secrets ในเมนูหลัก",
        });
      }

      // Parse room image (could be base64 data or Firebase Storage URL)
      const resolvedRoom = await resolveImagePayload(roomImage);
      if (!resolvedRoom) {
        return res.status(400).json({ success: false, message: "ฟอร์แมตรูปภาพห้องไม่ถูกต้องหรือไม่สามารถดึงรูปภาพได้" });
      }
      const roomMime = resolvedRoom.mimeType;
      const roomData = resolvedRoom.data;

      // Prepare Prompt based on product category
      let promptText = "";

      // Translate style to English for Gemini image model to understand S-Fold/Wave fold accurately
      let styleDescription = "";
      if (styleEnForAi && styleEnForAi.trim()) {
        styleDescription = styleEnForAi.trim();
        const styleEnLower = styleEnForAi.toLowerCase();
        if (styleEnLower.includes("wave") || styleEnLower.includes("s-fold") || styleEnLower.includes("ripple") || styleEnLower.includes("ลอน")) {
          styleDescription += " - Uniform, continuous flowing S-shaped soft waves without any pleat pinches or gathers at the top header. The waves must run perfectly and symmetrically from top to bottom. ABSOLUTELY DO NOT RENDER PINCH PLEATS OR SHIRRED CREASES AT THE TOP. IT MUST BE PERFECT MODERN WAVE FOLDS.";
        }
      } else {
        styleDescription = style || "Standard Curtains";
        const styleLower = (style || "").toLowerCase();
        if (styleLower.includes("ลอน") || styleLower.includes("ลอนกลับ") || styleLower.includes("wave") || styleLower.includes("s-fold") || styleLower.includes("ripple")) {
          styleDescription = "Wave Fold Curtains (S-Fold / Ripple Fold / ม่านลอน / ม่านลอนกลับ) - Beautiful modern wave fold curtains, featuring perfectly uniform, continuous, flowing S-shaped soft waves without any pleat pinches, gathers, or creases at the top header. The waves must run perfectly straight and symmetrically from the top track all the way down to the bottom hem. ABSOLUTELY DO NOT RENDER PINCH PLEATS OR SHIRRED CREASES AT THE TOP. IT MUST BE PERFECT MODERN WAVE FOLDS.";
        } else if (styleLower.includes("จีบ") || styleLower.includes("pleat")) {
          styleDescription = "Pinch Pleated Curtains - Classic structured curtains with pinched gathers/pleats at the top header, creating vertical tailored columns.";
        } else if (styleLower.includes("ตาไก่") || styleLower.includes("grommet") || styleLower.includes("eyelet")) {
          styleDescription = "Grommet Curtains (Eyelet) - Curtains with large metal rings/eyelets at the top header through which a prominent wooden or metal curtain rod runs.";
        } else if (styleLower.includes("พับ") || styleLower.includes("roman")) {
          styleDescription = "Roman Shades / Roman Blinds - Fabric window shades that fold up horizontally into clean, neat accordion folds when raised.";
        } else if (styleLower.includes("ม้วน") || styleLower.includes("roller")) {
          styleDescription = "Roller Shades - Modern, flat tensioned screen shades rolled around a top tube.";
        } else if (styleLower.includes("คอกระเช้า") || styleLower.includes("tab top")) {
          styleDescription = "Tab Top Curtains - Curtains with fabric loops/tabs sewn onto the top header, hanging directly from a decorative rod.";
        }
      }

      // Translate sheer style to English for Gemini image model to understand S-Fold/Wave fold accurately for sheer layer as well
      let sheerStyleDescription = "";
      if (isDoubleLayer) {
        if (sheerStyleEnForAi && sheerStyleEnForAi.trim()) {
          sheerStyleDescription = sheerStyleEnForAi.trim();
          const sheerStyleEnLower = sheerStyleEnForAi.toLowerCase();
          if (sheerStyleEnLower.includes("wave") || sheerStyleEnLower.includes("s-fold") || sheerStyleEnLower.includes("ripple") || sheerStyleEnLower.includes("ลอน")) {
            sheerStyleDescription += " - Uniform, continuous flowing S-shaped soft waves without any pleat pinches or gathers at the top header. The waves must run perfectly and symmetrically from top to bottom. ABSOLUTELY DO NOT RENDER PINCH PLEATS OR SHIRRED CREASES AT THE TOP. IT MUST BE PERFECT MODERN WAVE FOLDS.";
          }
        } else {
          // If no sheerStyle is specified, default to matching style
          const currentSheerStyle = sheerStyle || style || "Standard Curtains";
          sheerStyleDescription = currentSheerStyle;
          const sheerLower = currentSheerStyle.toLowerCase();
          if (sheerLower.includes("ลอน") || sheerLower.includes("ลอนกลับ") || sheerLower.includes("wave") || sheerLower.includes("s-fold") || sheerLower.includes("ripple")) {
            sheerStyleDescription = "Wave Fold Curtains (S-Fold / Ripple Fold / ม่านลอน / ม่านลอนกลับ) - Beautiful modern wave fold curtains, featuring perfectly uniform, continuous, flowing S-shaped soft waves without any pleat pinches, gathers, or creases at the top header. The waves must run perfectly straight and symmetrically from the top track all the way down to the bottom hem. ABSOLUTELY DO NOT RENDER PINCH PLEATS OR SHIRRED CREASES AT THE TOP. IT MUST BE PERFECT MODERN WAVE FOLDS.";
          } else if (sheerLower.includes("จีบ") || sheerLower.includes("pleat")) {
            sheerStyleDescription = "Pinch Pleated Curtains - Classic structured curtains with pinched gathers/pleats at the top header, creating vertical tailored columns.";
          } else if (sheerLower.includes("ตาไก่") || sheerLower.includes("grommet") || sheerLower.includes("eyelet")) {
            sheerStyleDescription = "Grommet Curtains (Eyelet) - Curtains with large metal rings/eyelets at the top header through which a prominent wooden or metal curtain rod runs.";
          }
        }
      }

      // Translate pattern and texture details for accuracy
      let patternDescription = pattern || "Solid matching color";
      const patternLower = (pattern || "").toLowerCase();
      if (patternLower.includes("พื้น") || patternLower.includes("solid")) {
        patternDescription = "Solid plain color fabric without pattern, smooth and elegant texture.";
      } else if (patternLower.includes("ทางแนวดิ่ง") || patternLower.includes("stripe")) {
        patternDescription = "Vertical striped pattern with clean, elegant parallel lines.";
      } else if (patternLower.includes("ดอกไม้") || patternLower.includes("floral")) {
        patternDescription = "Natural elegant floral pattern style.";
      } else if (patternLower.includes("ทึบแสง 100%") || patternLower.includes("blackout")) {
        patternDescription = "100% Blackout coating fabric with a solid, premium opaque look.";
      } else if (patternLower.includes("โปร่งแสง") || patternLower.includes("sheer") || patternLower.includes("lace")) {
        patternDescription = "Translucent sheer fabric, soft texture that lets light filter gently.";
      } else if (patternLower.includes("เรขาคณิต") || patternLower.includes("geometric")) {
        patternDescription = "Modern geometric patterned shapes.";
      }

      if (isBlind) {
        promptText = `Please overlay realistic, professionally styled blinds (horizontal slats, wood or faux-wood blinds) onto the window(s) of this room.
Maintain the exact structure of the room, including the walls, flooring, ceiling, furniture, window frame outlines, lighting sources, shadows, and overall perspective.
Do not modify or alter any of these surrounding elements. Only overlay or replace the window glass areas or pre-existing curtains with the new blinds setup.

Blinds Details:
- Category: Venetian Blinds / Wood Blinds / มู่ลี่
- Slat Material & Color: ${solidFabricName || "Wood or Faux-Wood slats"}
- Slat Style: ${styleDescription}
- Cotton Decorative Tape (เทปผ้า): ${sheerFabricName ? `Elegant vertical cloth tape bands colored: ${sheerFabricName}` : "No decorative tape (standard ladder strings)"}
- Notes/Instructions: ${notes || "None"}

CRITICAL AI INSTRUCTION FOR BLINDS (มู่ลี่):
1. Render realistic horizontal slats fitted perfectly inside or covering the window frames.
2. The blinds should be fully closed (or tilted to let some daylight filter between slats naturally).
3. If cotton decorative tape is specified, render clean, straight vertical fabric bands of the designated color/hue spacing evenly across the slats from top to bottom.
4. Ensure materials have accurate textures (e.g., real wood grain or smooth matte finishes).`;
      } else if (isRoller) {
        promptText = `Please overlay realistic, professionally styled roller shades (ม่านม้วน) onto the window(s) of this room.
Maintain the exact structure of the room, including the walls, flooring, ceiling, furniture, window frame outlines, lighting sources, shadows, and overall perspective.
Do not modify or alter any of these surrounding elements. Only overlay or replace the window glass areas or pre-existing curtains with the new roller shade setup.

Roller Shade Details:
- Category: Roller Shades / ม่านม้วน
- Roller Fabric & Color: ${solidFabricName || "Matte solid fabric"}
- Fabric Density: ${solidFabricType || "Dimout / Blackout"}
- Notes/Instructions: ${notes || "None"}

CRITICAL AI INSTRUCTION FOR ROLLER SHADES (ม่านม้วน):
1. Render a clean, perfectly smooth, tensioned flat sheet of fabric suspended from a compact roller tube at the top of the window frames.
2. The roller shade should cover the window pane neatly, ending with a straight bottom hem bar.
3. Keep the appearance minimalist, modern, and perfectly clean with zero organic hanging folds or drapes.`;
      } else {
        // Construct detailed hem style and bottom position instructions based on localData configurations
        let hemInstructionText = "";
        const bottomVal = (distanceBottom || hemStyleText || "").toString().toLowerCase();
        if (bottomVal.includes("กองพื้น") || bottomVal.includes("5") || bottomVal.includes("puddle")) {
          hemInstructionText = `
- Curtain Bottom Hem (ระยะชายม่าน): "กองพื้น 5 ซม." (Puddle 5 cm).
  CRITICAL PHYSICAL REQUIREMENT FOR BOTTOM HEM: The curtains MUST drape and pool/puddle directly onto the floor surface. The fabric MUST touch the ground and pool elegantly by exactly 5 cm. ABSOLUTELY DO NOT RENDER THE CURTAINS FLOATING or suspended above the floor. They must reach the floor and rest/gather softly on the floor.`;
        } else if (bottomVal.includes("ลอย") || bottomVal.includes("clearance")) {
          hemInstructionText = `
- Curtain Bottom Hem (ระยะชายม่าน): "ลอยจากพื้น" (Float above floor).
  CRITICAL PHYSICAL REQUIREMENT FOR BOTTOM HEM: The curtains MUST hang down and stop neatly about 1-2 cm above the floor. They must float and never touch or gather on the ground.`;
        } else {
          hemInstructionText = `
- Curtain Bottom Hem (ระยะชายม่าน): ${distanceBottom || hemStyleText || "Standard Floor length"}.
  CRITICAL PHYSICAL REQUIREMENT FOR BOTTOM HEM: Ensure the bottom hem position adheres strictly to the specified value: "${distanceBottom || hemStyleText || "Standard floor length"}"`;
        }

        // Construct detailed track and clearance side extensions
        let clearanceInstructionText = "";
        if (distanceLeft || distanceRight || distanceTop) {
          clearanceInstructionText = `
- Curtain Track and Coverage Boundaries:
  * Left wall extension: ${distanceLeft || "Standard"}
  * Right wall extension: ${distanceRight || "Standard"}
  * Top ceiling/wall position: ${distanceTop || "Standard"}
  The curtain tracks or decorative rod MUST extend onto the left and right sides flanking the window according to these values, and mount high near the ceiling or upper wall as designated.`;
        }

        promptText = `Please overlay realistic, professionally styled curtains onto the window(s) of this room.
Maintain the exact structure of the room, including the walls, flooring, ceiling, furniture, window frame outlines, lighting sources, shadows, and overall perspective.
Do not modify, alter, or paint over any of these surrounding elements. Only overlay or replace the window glass areas or pre-existing curtains with the new curtain setup.

Curtain Design Specifications (You MUST follow these exactly):
- Outer Curtain Style: ${styleDescription}
- Sheer Curtain Style: ${isDoubleLayer ? sheerStyleDescription : "None"}
- Material color/hue: ${color || "Matching the room tone"}
- Pattern/Fabric style: ${patternDescription}
- Solid Fabric Name (Outer Layer): "${solidFabricName || "Not specified"}"
- Sheer Fabric Name (Inner Layer): "${sheerFabricName || "Not specified"}"
- Hanging Track/Rod setup: ${track || "Hidden track or standard rod"}
- Accessories: ${accessories || "None"}
- Additional instructions: ${notes || "None"}
${hemInstructionText}
${clearanceInstructionText}

STRICT SPECIFICATION FOR FABRIC & COLOR ACCURACY:
1. The outer solid/opaque curtains MUST match the specified color "${color || "matching color"}", pattern style "${patternDescription}", and fabric specification "${solidFabricName || "designated solid fabric"}" EXACTLY. Do not use random or generic colors.
2. If a fabric swatch image is attached (the second image part in the input), treat it as the ultimate source of truth for color, texture, pattern, and design. You MUST replicate its visual properties DIRECTLY onto the newly generated curtains. For instance, if the swatch shows a marble vein pattern (such as AGATE / SNOWDIRT), wavy waves, geometric prints, or linen weaves, do NOT render a plain grey or solid fabric. Instead, render the curtains using that exact marble/wavy texture pattern beautifully and clearly, aligned naturally with the curves, folds, and highlights of the curtain fabric.
3. The inner sheer curtains (if double layer) MUST match the sheer fabric specification "${sheerFabricName || "designated sheer fabric"}" and sheer pattern exactly. If a sheer fabric swatch image is attached (the third image part in the input), use its design, color, weave, and lace texture as the source of truth for the inner sheer layer.

STRICT SPECIFICATION FOR DESIGN STYLES (SUPPORT MIXED STYLES):
1. Render the outer solid/opaque curtain EXACTLY in its designated style: "${styleDescription}". If specified as Wave Fold (ม่านลอน), it must have flowing uniform S-shaped waves from top to bottom without pinch pleats. If specified as Pinch Pleat (ม่านจีบ), it must have classic pinched gathers at the top.
2. Render the inner sheer curtain (if double layer) EXACTLY in its designated sheer style: "${sheerStyleDescription}".
3. IMPORTANT: Dual layers CAN have different, mixed styles. For example, the outer solid curtain can be a Wave Fold (ม่านลอน) while the inner sheer curtain is a Pinch Pleat (ม่านจีบ). Render them EXACTLY as specified for each layer individually! Do not force both layers to use the same style if they are specified differently.`;

        if (isDoubleLayer) {
          promptText += `

- Layers Configuration: Double Layer setup (2-layered curtains).
- Inner Layer (Sheer) Style: ${sheerStyleDescription}
- Inner Layer (Sheer Fabric): "${sheerFabricName || "Sheer curtain"}" (Fabric Type: ${sheerFabricType || "Sheer"}).
- Outer Layer (Solid) Style: ${styleDescription}
- Outer Layer (Solid Fabric): "${solidFabricName || "Solid curtain"}" (Fabric Type: ${solidFabricType || "Blackout"}).

CRITICAL AI INSTRUCTION FOR 2-LAYER CONFIGURATION:
Because this is a 2-layered curtain setup, you MUST follow these placement rules:
1. The sheer curtain (inner layer) must be completely CLOSED (drawn fully across the window pane), allowing soft, diffused daylight to pass through beautifully.
2. The sheer curtain layer MUST be rendered using the EXACT style/type specified for it: "${sheerStyleDescription}".
3. The solid/opaque curtain (outer layer) must be draped or gathered according to the specified layout:
   - If style/notes indicate Left Gather ("รวบซ้าย"), drape and stack the solid curtain tightly to the LEFT side of the window.
   - If style/notes indicate Right Gather ("รวบขวา"), drape and stack the solid curtain tightly to the RIGHT side of the window.
   - If style/notes indicate Center Split ("แยกกลาง"), split the solid curtain and stack the panels neatly on BOTH the left and right sides of the window.
   This arrangement must beautifully expose the closed sheer curtain layer in the uncovered portions of the window. Let light simulate accurately through the sheer curtain based on its fabric type (e.g., Blackout, Dimout, Sheer).`;
        } else {
          promptText += `

- Layers Configuration: Single Layer setup (Solid curtain only: "${solidFabricName || "Solid fabric"}").`;
        }

        promptText += `

CRITICAL REQUIREMENT FOR CURTAIN TIEBACKS / BELTS (สายรวบผ้าม่าน):
Any tiebacks, belts, or straps used to pull back, gather, or hold the curtains (สายรวบผ้าม่าน) MUST be rendered as being made from the EXACT same solid fabric, pattern, texture, and color as the curtain panels themselves. ABSOLUTELY DO NOT use metallic chains, glossy golden ropes, tassels, or contrasting materials for holding the curtains. The tiebacks must match the main fabric seamlessly.

CRITICAL QUALITY & REALISM GUIDELINES:
1. Render the final image with maximum photographic quality, realistic fabric textures, crisp drapery folds, and organic hanging gravity.
2. The lighting and shadows must interact naturally with the curtain folds, showing accurate highlights and depth.
3. Sunlight coming from the window must filter realistically through the sheer fabric, casting soft diffused illumination.
4. Ensure the rest of the room is preserved with 100% pixel-perfect accuracy; only overlay the curtain setup onto the window area.`;
      }

      const contentsParts: any[] = [
        {
          inlineData: {
            mimeType: roomMime,
            data: roomData,
          },
        }
      ];

      // Optional fabric pattern image
      if (fabricImage) {
        const resolvedFabric = await resolveImagePayload(fabricImage);
        if (resolvedFabric) {
          contentsParts.push({
            inlineData: {
              mimeType: resolvedFabric.mimeType,
              data: resolvedFabric.data,
            },
          });
          promptText += `

CRITICAL FABRIC PATTERN REPLICATION RULE:
- The input contains a fabric swatch image (the second image in the parts list) named "${solidFabricName || "material swatch"}".
- This swatch has a highly specific pattern, design, color, and texture (for example, if it's "AGATE / SNOWDIRT", it contains detailed marble veins, swirling patterns, mineral stripes, or organic lines).
- You MUST capture the exact pattern, color, and style from this swatch image and map it directly onto the fabric of the outer curtains.
- Under no circumstances should you generate plain, flat, or solid-colored curtains if the swatch shows a distinct pattern.
- Ensure the pattern follows the flows, shadows, and natural vertical folds of the curtain panels.`;
        }
      }

      // Optional sheer pattern image
      if (sheerImage) {
        const resolvedSheer = await resolveImagePayload(sheerImage);
        if (resolvedSheer) {
          contentsParts.push({
            inlineData: {
              mimeType: resolvedSheer.mimeType,
              data: resolvedSheer.data,
            },
          });
          promptText += `

CRITICAL SHEER PATTERN REPLICATION RULE:
- Use the sheer fabric swatch image (the third image in the parts list) named "${sheerFabricName || "sheer swatch"}" as reference for the inner sheer curtain's color, translucency, texture, and lace pattern.
- Replicate its design and texture properties directly onto the sheer curtain layer.`;
        }
      }

      // Add the prompt text part at the end
      contentsParts.push({ text: promptText });

      console.log("Calling Gemini API with style:", style, "color:", color, "pattern:", pattern, "double layer:", isDoubleLayer);

      // Call the AI model for image editing tasks (gemini-3.1-flash-lite-image)
      const apiResponse = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-image",
        contents: { parts: contentsParts },
      });

      // Find the image part in candidates
      let base64Result: string | null = null;
      let mimeTypeResult: string = "image/png";

      const candidate = apiResponse.candidates?.[0];
      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData) {
            base64Result = part.inlineData.data;
            mimeTypeResult = part.inlineData.mimeType || "image/png";
            break;
          }
        }
      }

      if (!base64Result) {
        console.error("Gemini API did not return any image data.", JSON.stringify(apiResponse));
        return res.status(500).json({
          success: false,
          message: "ระบบ AI ไม่ได้ส่งรูปภาพจำลองกลับมา กรุณาลองอัปเดตรายละเอียดและลองอีกครั้ง",
        });
      }

      let descriptionText = `ภาพจำลองการติดตั้งผ้าม่านแบบ ${style} สี ${color} สร้างโดยระบบ AI อัจฉริยะ`;
      if (isBlind) {
        descriptionText = `ภาพจำลองการติดตั้งมู่ลี่แบบ ${style} สี/สเปก ${solidFabricName} ${sheerFabricName ? `พร้อมเทปผ้าตกแต่งสี ${sheerFabricName}` : ""} สร้างโดยระบบ AI อัจฉริยะ`;
      } else if (isRoller) {
        descriptionText = `ภาพจำลองการติดตั้งม่านม้วนแบบ ${style} สี/สเปก ${solidFabricName} สร้างโดยระบบ AI อัจฉริยะ`;
      }

      res.json({
        success: true,
        imageUrl: `data:${mimeTypeResult};base64,${base64Result}`,
        description: descriptionText
      });

    } catch (error: any) {
      console.error("Error calling Gemini API:", error);
      const errMsg = error.message || String(error);
      let friendlyMsg = "เกิดข้อผิดพลาดจากระบบประมวลผลรูปภาพ AI: " + errMsg;
      
      if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("Quota")) {
        friendlyMsg = "ระบบแจ้งเตือน: คุณใช้งานโควต้าโมเดลประมวลผลรูปภาพ AI ฟรีเกินกำหนดแล้ว (429 Quota Exceeded) กรุณาเข้าไปที่เมนู Settings หรือติดต่อผู้ดูแลระบบเพื่อเปิดใช้แผนบริการชำระเงิน (Paid Model Flow) หรือลองจำลองรูปภาพใหม่อีกครั้งในภายหลัง";
      }
      
      res.status(500).json({
        success: false,
        message: friendlyMsg,
      });
    }
  });

  // Serve static assets / Vite setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Running with Realtime WebSocket on http://localhost:${PORT}`);
  });
}

startServer();
