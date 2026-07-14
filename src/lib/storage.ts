import { Job, WindowItem, Employee, Settings, StyleMaterial } from "../types";

const KEYS = {
  JOBS: "curtain_jobs",
  WINDOWS: "curtain_windows",
  EMPLOYEES: "curtain_employees",
  SETTINGS: "curtain_settings",
};

export const generateId = (): string => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const DEFAULT_SETTINGS: Settings = {
  curtainStyles: [
    "ผ้าม่านจีบ (Pleated)",
    "ผ้าม่านตาไก่ (Grommet)",
    "ผ้าม่านพับ (Roman)",
    "ผ้าม่านลอน (Wave)",
    "ม่านม้วน (Roller)",
    "ม่านคอกระเช้า (Tab Top)",
  ],
  patterns: [
    "สีพื้นเรียบหรู (Elegant Solid)",
    "ลายทางแนวดิ่ง (Vertical Stripes)",
    "ลายดอกไม้ธรรมชาติ (Floral Pattern)",
    "ผ้าทึบแสง 100% (Blackout Coating)",
    "ผ้าโปร่งแสงถนอมสายตา (Sheer Lace)",
    "ลายเรขาคณิต (Geometric Style)",
  ],
  tracks: [
    "รางไมโคร ตัวเอ็ม (Standard M-Track)",
    "รางโชว์อลูมิเนียมพรีเมียม (Premium Aluminum Rod)",
    "รางดัดโค้งพิเศษ (Flexible Curve Track)",
    "รางม้วนดึงโซ่ไข่มุก (Roller Roller System)",
    "รางมอเตอร์ไฟฟ้า (Smart Motorized Track)",
  ],
  accessories: [
    "สายรวบม่านพู่ระย้าหรู (Luxury Tassel Tiebacks)",
    "สายรวบม่านแม่เหล็กสไตล์โมเดิร์น (Modern Magnetic Tie)",
    "ตะขอเกี่ยวกำแพงเหล็กดัดรมดำ (Black Forged Wall Hooks)",
    "ด้ามจูงอะคริลิคใสพิเศษ (Clear Acrylic Wand)",
  ],
};

const DEFAULT_EMPLOYEES: Employee[] = [
  { id: "1", name: "ผู้ดูแลระบบ (Admin)", aiQuota: 100, aiUsed: 0, username: "admin", password: "123", role: "admin" },
  { id: "2", name: "คุณอรพรรณ (Designer)", aiQuota: 30, aiUsed: 4, username: "designer1", password: "123", role: "designer" },
  { id: "3", name: "คุณธีรเดช (Sales Representative)", aiQuota: 30, aiUsed: 12, username: "sales1", password: "123", role: "installer" },
];

export const storage = {
  getJobs(): Job[] {
    const data = localStorage.getItem(KEYS.JOBS);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  saveJob(job: Job): void {
    const jobs = this.getJobs();
    const idx = jobs.findIndex((j) => j.id === job.id);
    if (idx >= 0) {
      jobs[idx] = { ...job, updatedAt: Date.now() };
    } else {
      jobs.push({ ...job, createdAt: Date.now(), updatedAt: Date.now() });
    }
    localStorage.setItem(KEYS.JOBS, JSON.stringify(jobs));
  },

  deleteJob(id: string): void {
    const jobs = this.getJobs().filter((j) => j.id !== id);
    localStorage.setItem(KEYS.JOBS, JSON.stringify(jobs));

    // Also cascade delete windows of this job
    const windows = this.getWindows().filter((w) => w.jobId !== id);
    localStorage.setItem(KEYS.WINDOWS, JSON.stringify(windows));
  },

  getWindows(): WindowItem[] {
    const data = localStorage.getItem(KEYS.WINDOWS);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  getWindowsForJob(jobId: string): WindowItem[] {
    return this.getWindows().filter((w) => w.jobId === jobId);
  },

  saveWindow(window: WindowItem): void {
    const windows = this.getWindows();
    const idx = windows.findIndex((w) => w.id === window.id);
    if (idx >= 0) {
      windows[idx] = window;
    } else {
      windows.push(window);
    }
    localStorage.setItem(KEYS.WINDOWS, JSON.stringify(windows));
  },

  deleteWindow(id: string): void {
    const windows = this.getWindows().filter((w) => w.id !== id);
    localStorage.setItem(KEYS.WINDOWS, JSON.stringify(windows));
  },

  getEmployees(): Employee[] {
    const data = localStorage.getItem(KEYS.EMPLOYEES);
    if (!data) {
      localStorage.setItem(KEYS.EMPLOYEES, JSON.stringify(DEFAULT_EMPLOYEES));
      return DEFAULT_EMPLOYEES;
    }
    try {
      return JSON.parse(data);
    } catch {
      return DEFAULT_EMPLOYEES;
    }
  },

  saveEmployee(employee: Employee): void {
    const employees = this.getEmployees();
    const idx = employees.findIndex((e) => e.id === employee.id);
    if (idx >= 0) {
      employees[idx] = employee;
    } else {
      employees.push(employee);
    }
    localStorage.setItem(KEYS.EMPLOYEES, JSON.stringify(employees));
  },

  incrementEmployeeAiUsage(employeeId: string): void {
    const employees = this.getEmployees();
    const emp = employees.find((e) => e.id === employeeId);
    if (emp) {
      emp.aiUsed += 1;
      this.saveEmployee(emp);
    }
  },

  deleteEmployee(id: string): void {
    const employees = this.getEmployees().filter((e) => e.id !== id);
    localStorage.setItem(KEYS.EMPLOYEES, JSON.stringify(employees));
  },

  getSettings(): Settings {
    const DEFAULT_STYLE_MATERIALS: StyleMaterial[] = [
      { id: "style-1", name: "ม่านจีบ", imageBase64: "", category: "curtain", operationOptions: ["รวบซ้าย", "รวบขวา", "แยกกลาง"] },
      { id: "style-2", name: "ม่านตาไก่", imageBase64: "", category: "curtain", operationOptions: ["รวบซ้าย", "รวบขวา", "แยกกลาง"] },
      { id: "style-3", name: "ม่านพับ", imageBase64: "", category: "roman", operationOptions: ["ดึงโซ่ฝั่งซ้าย", "ดึงโซ่ฝั่งขวา", "ใช้งานมอเตอร์"] },
      { id: "style-4", name: "ม่านลอน", imageBase64: "", category: "curtain", operationOptions: ["รวบซ้าย", "รวบขวา", "แยกกลาง"] },
      { id: "style-5", name: "ม่านม้วน", imageBase64: "", category: "roller", operationOptions: ["ดึงโซ่ฝั่งซ้าย", "ดึงโซ่ฝั่งขวา", "ใช้งานมอเตอร์"] },
      { id: "style-6", name: "มู่ลี่ไม้", imageBase64: "", category: "blind", operationOptions: ["ดึงโซ่ฝั่งซ้าย", "ดึงโซ่ฝั่งขวา", "ใช้งานมอเตอร์"] },
    ];

    const DEFAULT_HEM_MATERIALS = [
      { id: "hem-1", name: "พอดีพื้น", imageBase64: "" },
      { id: "hem-2", name: "ลอยจากพื้น 1 ซม.", imageBase64: "" },
      { id: "hem-3", name: "กองพื้นหรูหรา +5 ซม.", imageBase64: "" },
      { id: "hem-4", name: "กองพื้นหรูหรา +10 ซม.", imageBase64: "" },
      { id: "hem-5", name: "พอดีขอบวงกบล่าง", imageBase64: "" },
      { id: "hem-6", name: "เลยวงกบล่าง 15 ซม.", imageBase64: "" },
    ];

    const DEFAULT_SOLID_FABRICS = [
      { id: "solid-1", name: "CITADEL", colorName: "LONDON GRAY", type: "Blackout" },
      { id: "solid-2", name: "CITADEL", colorName: "CHASSIS GREY", type: "Blackout" },
      { id: "solid-3", name: "GLAMOUR", colorName: "GOLDEN BRONZE", type: "Drapery" },
      { id: "solid-4", name: "GLAMOUR", colorName: "CHAMPAGNE GOLD", type: "Drapery" },
      { id: "solid-5", name: "SERENE", colorName: "COCOA BROWN", type: "Dimout" },
      { id: "solid-6", name: "SERENE", colorName: "CREAMY BEIGE", type: "Dimout" },
      { id: "solid-7", name: "ROYAL LUXE", colorName: "DEEP FOREST GREEN", type: "Energy Saving" },
      { id: "solid-8", name: "ROYAL LUXE", colorName: "MIDNIGHT NAVY", type: "Energy Saving" },
      { id: "solid-9", name: "SHERWOOD", colorName: "SAGE MIST", type: "Multipurpose" },
    ];

    const DEFAULT_SHEER_FABRICS = [
      { id: "sheer-1", name: "AFFINITY", colorName: "WHITE", type: "Sheer" },
      { id: "sheer-2", name: "AFFINITY", colorName: "SOFT CREAM", type: "Sheer" },
      { id: "sheer-3", name: "AURA", colorName: "CREAMY IVORY", type: "Sheer" },
      { id: "sheer-4", name: "AURA", colorName: "SILVER SHIMMER", type: "Sheer" },
      { id: "sheer-5", name: "LACE CLASSIC", colorName: "SNOW FLAKE", type: "Sheer" },
    ];

    const DEFAULT_BLINDS = [
      { id: "blind-1", name: "PREMIUM WOOD", colorName: "NATURAL OAK", type: "Wood Blinds" },
      { id: "blind-2", name: "PREMIUM WOOD", colorName: "MATTE BLACK", type: "Wood Blinds" },
      { id: "blind-3", name: "PREMIUM WOOD", colorName: "PURE WHITE", type: "Wood Blinds" },
      { id: "blind-4", name: "ALUMINUM SLEEK", colorName: "PLATINUM SILVER", type: "Aluminum Blinds" },
    ];

    const DEFAULT_ROLLERS = [
      { id: "roller-1", name: "ECO SHADE", colorName: "COOL GRAY", type: "Roller Shades" },
      { id: "roller-2", name: "ECO SHADE", colorName: "SAND BEIGE", type: "Roller Shades" },
      { id: "roller-3", name: "NIGHTFALL", colorName: "CHARCOAL BLACK", type: "Blockout Roller" },
      { id: "roller-4", name: "NIGHTFALL", colorName: "OFF WHITE", type: "Dimout Roller" },
    ];

    const DEFAULT_TAPES = [
      { id: "tape-1", name: "BLIND COTTON TAPE", colorName: "CHARCOAL COAL", type: "Blinds Fabric Tape" },
      { id: "tape-2", name: "BLIND COTTON TAPE", colorName: "IVORY CREAM", type: "Blinds Fabric Tape" },
      { id: "tape-3", name: "BLIND COTTON TAPE", colorName: "CHOCOLATE BROWN", type: "Blinds Fabric Tape" },
      { id: "tape-4", name: "BLIND COTTON TAPE", colorName: "WARM GREY", type: "Blinds Fabric Tape" },
    ];

    const DEFAULT_TRACK_ITEMS = [
      { id: "track-1", name: "รางไมโคร ตัวเอ็ม (Standard M-Track)" },
      { id: "track-2", name: "รางโชว์อลูมิเนียมพรีเมียม (Premium Aluminum Rod)" },
      { id: "track-3", name: "รางดัดโค้งพิเศษ (Flexible Curve Track)" },
      { id: "track-4", name: "รางม้วนดึงโซ่ไข่มุก (Roller Roller System)" },
      { id: "track-5", name: "รางมอเตอร์ไฟฟ้า (Smart Motorized Track)" },
    ];

    const DEFAULT_ACCESSORY_ITEMS = [
      { id: "acc-1", name: "สายรวบม่านพู่ระย้าหรู (Luxury Tassel Tiebacks)" },
      { id: "acc-2", name: "สายรวบม่านแม่เหล็กสไตล์โมเดิร์น (Modern Magnetic Tie)" },
      { id: "acc-3", name: "ตะขอเกี่ยวกำแพงเหล็กดัดรมดำ (Black Forged Wall Hooks)" },
      { id: "acc-4", name: "ด้ามจูงอะคริลิคใสพิเศษ (Clear Acrylic Wand)" },
    ];

    const DEFAULT_HANGING_TYPES = [
      "หัวผ้าม่านแขวนปิดรางม่าน",
      "หัวผ้าม่านใต้รางม่าน",
      "สวมห่วงตาไก่",
      "ซ่อนในกล่องม่าน",
    ];

    const DEFAULT_USAGE_TYPES = [
      "แยกกลาง (แยกซ้าย-ขวา)",
      "เก็บข้างซ้าย (ฝั่งเดียว)",
      "เก็บข้างขวา (ฝั่งเดียว)",
      "ดึงม้วนขึ้น-ลง",
      "ยึดตายตัว",
    ];

    const DEFAULT_CLEARANCE_OPTIONS = [
      "พอดีเฟรม",
      "เลยเฟรม 10 ซม.",
      "เลยเฟรม 15 ซม.",
      "เลยเฟรม 20 ซม.",
      "ติดเพดาน",
      "พอดีพื้น",
    ];

    const data = localStorage.getItem(KEYS.SETTINGS);
    let settings: Settings;
    if (!data) {
      settings = { ...DEFAULT_SETTINGS };
    } else {
      try {
        settings = JSON.parse(data);
      } catch {
        settings = { ...DEFAULT_SETTINGS };
      }
    }

    let modified = false;
    if (!settings.styleMaterials || settings.styleMaterials.length === 0) {
      settings.styleMaterials = DEFAULT_STYLE_MATERIALS;
      modified = true;
    } else {
      // update style materials to make sure they have categories & operationOptions
      settings.styleMaterials = settings.styleMaterials.map((sm, i) => {
        const found = DEFAULT_STYLE_MATERIALS.find(d => d.name === sm.name || d.id === sm.id);
        if (found) {
          return { ...sm, category: sm.category || found.category, operationOptions: sm.operationOptions || found.operationOptions };
        }
        return sm;
      });
    }

    if (!settings.hemMaterials || settings.hemMaterials.length === 0) {
      settings.hemMaterials = DEFAULT_HEM_MATERIALS;
      modified = true;
    }
    if (!settings.solidFabricMaterials || settings.solidFabricMaterials.length === 0) {
      settings.solidFabricMaterials = DEFAULT_SOLID_FABRICS;
      modified = true;
    }
    if (!settings.sheerFabricMaterials || settings.sheerFabricMaterials.length === 0) {
      settings.sheerFabricMaterials = DEFAULT_SHEER_FABRICS;
      modified = true;
    }
    if (!settings.blindMaterials || settings.blindMaterials.length === 0) {
      settings.blindMaterials = DEFAULT_BLINDS;
      modified = true;
    }
    if (!settings.rollerMaterials || settings.rollerMaterials.length === 0) {
      settings.rollerMaterials = DEFAULT_ROLLERS;
      modified = true;
    }
    if (!settings.blindTapeMaterials || settings.blindTapeMaterials.length === 0) {
      settings.blindTapeMaterials = DEFAULT_TAPES;
      modified = true;
    }
    if (!settings.trackMaterials || settings.trackMaterials.length === 0) {
      settings.trackMaterials = DEFAULT_TRACK_ITEMS;
      modified = true;
    }
    if (!settings.accessoryMaterials || settings.accessoryMaterials.length === 0) {
      settings.accessoryMaterials = DEFAULT_ACCESSORY_ITEMS;
      modified = true;
    }
    if (!settings.fabricTypes || settings.fabricTypes.length === 0) {
      settings.fabricTypes = ["Blackout", "Dimout", "Drapery", "Energy Saving"];
      modified = true;
    }
    if (!settings.hangingTypes || settings.hangingTypes.length === 0) {
      settings.hangingTypes = DEFAULT_HANGING_TYPES;
      modified = true;
    }
    if (!settings.usageTypes || settings.usageTypes.length === 0) {
      settings.usageTypes = DEFAULT_USAGE_TYPES;
      modified = true;
    }
    if (!settings.clearanceOptions || settings.clearanceOptions.length === 0) {
      settings.clearanceOptions = DEFAULT_CLEARANCE_OPTIONS;
      modified = true;
    }

    if (modified) {
      localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    }

    return settings;
  },

  saveSettings(settings: Settings): void {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  },
};
