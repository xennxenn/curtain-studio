import { db, storage } from "./firebase";
import { ref as sRef, uploadString, getDownloadURL } from "firebase/storage";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDoc,
  getDocs,
  updateDoc
} from "firebase/firestore";
import { Job, WindowItem, Employee, Settings } from "../types";

// Default configuration settings
export const DEFAULT_SETTINGS: Settings = {
  curtainStyles: [
    "ผ้าม่านจีบ (Pleated)",
    "ผ้าม่านตาไก่ (Grommet)",
    "ผ้าม่านพับ (Roman)",
    "ผ้าม่านลอน (Wave)",
    "ผ้าม่านลอนกลับ (Ripple Fold)",
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
  styleMaterials: [
    { id: "style-1", name: "ม่านจีบ", imageBase64: "", category: "curtain", operationOptions: ["รวบซ้าย", "รวบขวา", "แยกกลาง"], styleEnForAi: "pinch pleat curtains" },
    { id: "style-2", name: "ม่านตาไก่", imageBase64: "", category: "curtain", operationOptions: ["รวบซ้าย", "รวบขวา", "แยกกลาง"], styleEnForAi: "eyelet grommet curtains" },
    { id: "style-3", name: "ม่านพับ", imageBase64: "", category: "roman", operationOptions: ["ดึงโซ่ฝั่งซ้าย", "ดึงโซ่ฝั่งขวา", "ใช้งานมอเตอร์"], styleEnForAi: "roman shades" },
    { id: "style-4", name: "ม่านลอน", imageBase64: "", category: "curtain", operationOptions: ["รวบซ้าย", "รวบขวา", "แยกกลาง"], styleEnForAi: "wave fold curtains" },
    { id: "style-7", name: "ม่านลอนกลับ", imageBase64: "", category: "curtain", operationOptions: ["รวบซ้าย", "รวบขวา", "แยกกลาง"], styleEnForAi: "back-fold wave fold curtains" },
    { id: "style-5", name: "ม่านม้วน", imageBase64: "", category: "roller", operationOptions: ["ดึงโซ่ฝั่งซ้าย", "ดึงโซ่ฝั่งขวา", "ใช้งานมอเตอร์"], styleEnForAi: "roller shades" },
    { id: "style-6", name: "มู่ลี่ไม้", imageBase64: "", category: "blind", operationOptions: ["ดึงโซ่ฝั่งซ้าย", "ดึงโซ่ฝั่งขวา", "ใช้งานมอเตอร์"], styleEnForAi: "venetian wood blinds" },
  ],
  hemMaterials: [
    { id: "hem-1", name: "พอดีพื้น", imageBase64: "" },
    { id: "hem-2", name: "ลอยจากพื้น 1 ซม.", imageBase64: "" },
    { id: "hem-3", name: "กองพื้นหรูหรา +5 ซม.", imageBase64: "" },
    { id: "hem-4", name: "กองพื้นหรูหรา +10 ซม.", imageBase64: "" },
    { id: "hem-5", name: "พอดีขอบวงกบล่าง", imageBase64: "" },
    { id: "hem-6", name: "เลยวงกบล่าง 15 ซม.", imageBase64: "" },
  ],
  solidFabricMaterials: [
    { id: "solid-1", name: "CITADEL", colorName: "LONDON GRAY", type: "Blackout" },
    { id: "solid-2", name: "CITADEL", colorName: "CHASSIS GREY", type: "Blackout" },
    { id: "solid-3", name: "GLAMOUR", colorName: "GOLDEN BRONZE", type: "Drapery" },
    { id: "solid-4", name: "GLAMOUR", colorName: "CHAMPAGNE GOLD", type: "Drapery" },
    { id: "solid-5", name: "SERENE", colorName: "COCOA BROWN", type: "Dimout" },
    { id: "solid-6", name: "SERENE", colorName: "CREAMY BEIGE", type: "Dimout" },
    { id: "solid-7", name: "ROYAL LUXE", colorName: "DEEP FOREST GREEN", type: "Energy Saving" },
    { id: "solid-8", name: "ROYAL LUXE", colorName: "MIDNIGHT NAVY", type: "Energy Saving" },
    { id: "solid-9", name: "SHERWOOD", colorName: "SAGE MIST", type: "Multipurpose" },
  ],
  sheerFabricMaterials: [
    { id: "sheer-1", name: "AFFINITY", colorName: "WHITE", type: "Sheer" },
    { id: "sheer-2", name: "AFFINITY", colorName: "SOFT CREAM", type: "Sheer" },
    { id: "sheer-3", name: "AURA", colorName: "CREAMY IVORY", type: "Sheer" },
    { id: "sheer-4", name: "AURA", colorName: "SILVER SHIMMER", type: "Sheer" },
    { id: "sheer-5", name: "LACE CLASSIC", colorName: "SNOW FLAKE", type: "Sheer" },
  ],
  blindMaterials: [
    { id: "blind-1", name: "PREMIUM WOOD", colorName: "NATURAL OAK", type: "Wood Blinds" },
    { id: "blind-2", name: "PREMIUM WOOD", colorName: "MATTE BLACK", type: "Wood Blinds" },
    { id: "blind-3", name: "PREMIUM WOOD", colorName: "PURE WHITE", type: "Wood Blinds" },
    { id: "blind-4", name: "ALUMINUM SLEEK", colorName: "PLATINUM SILVER", type: "Aluminum Blinds" },
  ],
  rollerMaterials: [
    { id: "roller-1", name: "ECO SHADE", colorName: "COOL GRAY", type: "Roller Shades" },
    { id: "roller-2", name: "ECO SHADE", colorName: "SAND BEIGE", type: "Roller Shades" },
    { id: "roller-3", name: "NIGHTFALL", colorName: "CHARCOAL BLACK", type: "Blockout Roller" },
    { id: "roller-4", name: "NIGHTFALL", colorName: "OFF WHITE", type: "Dimout Roller" },
  ],
  blindTapeMaterials: [
    { id: "tape-1", name: "BLIND COTTON TAPE", colorName: "CHARCOAL COAL", type: "Blinds Fabric Tape" },
    { id: "tape-2", name: "BLIND COTTON TAPE", colorName: "IVORY CREAM", type: "Blinds Fabric Tape" },
    { id: "tape-3", name: "BLIND COTTON TAPE", colorName: "CHOCOLATE BROWN", type: "Blinds Fabric Tape" },
    { id: "tape-4", name: "BLIND COTTON TAPE", colorName: "WARM GREY", type: "Blinds Fabric Tape" },
  ],
  trackMaterials: [
    { id: "track-1", name: "รางไมโคร ตัวเอ็ม (Standard M-Track)" },
    { id: "track-2", name: "รางโชว์อลูมิเนียมพรีเมียม (Premium Aluminum Rod)" },
    { id: "track-3", name: "รางดัดโค้งพิเศษ (Flexible Curve Track)" },
    { id: "track-4", name: "รางม้วนดึงโซ่ไข่มุก (Roller Roller System)" },
    { id: "track-5", name: "รางมอเตอร์ไฟฟ้า (Smart Motorized Track)" },
  ],
  accessoryMaterials: [
    { id: "acc-1", name: "สายรวบม่านพู่ระย้าหรู (Luxury Tassel Tiebacks)" },
    { id: "acc-2", name: "สายรวบม่านแม่เหล็กสไตล์โมเดิร์น (Modern Magnetic Tie)" },
    { id: "acc-3", name: "ตะขอเกี่ยวกำแพงเหล็กดัดรมดำ (Black Forged Wall Hooks)" },
    { id: "acc-4", name: "ด้ามจูงอะคริลิคใสพิเศษ (Clear Acrylic Wand)" },
  ],
  fabricTypes: ["Blackout", "Dimout", "Drapery", "Energy Saving"],
  hangingTypes: [
    "หัวผ้าม่านแขวนปิดรางม่าน",
    "หัวผ้าม่านใต้รางม่าน",
    "สวมห่วงตาไก่",
    "ซ่อนในกล่องม่าน",
  ],
  usageTypes: [
    "แยกกลาง (แยกซ้าย-ขวา)",
    "เก็บข้างซ้าย (ฝั่งเดียว)",
    "เก็บข้างขวา (ฝั่งเดียว)",
    "ดึงม้วนขึ้น-ลง",
    "ยึดตายตัว",
  ],
  clearanceOptions: [
    "พอดีเฟรม",
    "เลยเฟรม 10 ซม.",
    "เลยเฟรม 15 ซม.",
    "เลยเฟรม 20 ซม.",
    "พอดีพื้น",
  ],
  clearanceTopOptions: [
    "เลยเฟรม 10 ซม.",
    "เลยเฟรม 15 ซม.",
    "เลยเฟรม 20 ซม.",
    "ติดเพดาน",
  ],
};

export const DEFAULT_EMPLOYEES: Employee[] = [
  { id: "1", name: "ผู้ดูแลระบบ (Admin)", aiQuota: 100, aiUsed: 0, username: "T58121", password: "Admin", role: "admin" },
  { id: "2", name: "คุณอรพรรณ (Designer)", aiQuota: 30, aiUsed: 4, username: "designer1", password: "123", role: "designer" },
  { id: "3", name: "คุณธีรเดช (Sales Representative)", aiQuota: 30, aiUsed: 12, username: "sales1", password: "123", role: "installer" },
];

// REAL-TIME FIRESTORE EVENT SUBSCRIBERS WITH SEEDING LOGIC
export const subscribeJobs = (callback: (jobs: Job[]) => void) => {
  return onSnapshot(collection(db, "jobs"), (snapshot) => {
    const list: Job[] = [];
    snapshot.forEach((d) => {
      list.push(d.data() as Job);
    });
    // Sort by createdAt descending
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    callback(list);
  });
};

export const subscribeWindows = (callback: (windows: WindowItem[]) => void) => {
  return onSnapshot(collection(db, "windows"), (snapshot) => {
    const list: WindowItem[] = [];
    snapshot.forEach((d) => {
      list.push(d.data() as WindowItem);
    });
    callback(list);
  });
};

export const subscribeEmployees = (callback: (employees: Employee[]) => void) => {
  const employeesColRef = collection(db, "employees");

  // Seed default employees once if getDocs confirms collection is empty
  getDocs(employeesColRef).then((snap) => {
    if (snap.empty) {
      console.log("Seeding default employees to Firestore...");
      for (const emp of DEFAULT_EMPLOYEES) {
        setDoc(doc(db, "employees", emp.id), emp).catch(err => {
          console.error("Failed to seed default employee:", emp.name, err);
        });
      }
    }
  }).catch((err) => {
    console.error("Error checking employees collection existence:", err);
  });

  return onSnapshot(employeesColRef, (snapshot) => {
    if (!snapshot.empty) {
      const list: Employee[] = [];
      snapshot.forEach((d) => {
        list.push(d.data() as Employee);
      });
      list.sort((a, b) => Number(a.id) - Number(b.id));
      callback(list);
    }
  });
};

const migrationAttempted = new Set<string>();

// Keep track of the current in-memory cached settings
let currentCachedSettings: Settings | null = null;

export const subscribeSettings = (callback: (settings: Settings) => void) => {
  const subDocFields = [
    "styleMaterials",
    "hemMaterials",
    "solidFabricMaterials",
    "sheerFabricMaterials",
    "blindMaterials",
    "rollerMaterials",
    "blindTapeMaterials"
  ];

  let mergedSettings: Settings = { ...DEFAULT_SETTINGS };
  const unsubscribes: (() => void)[] = [];
  const loadedSubcollections = new Set<string>();
  let isGlobalLoaded = false;

  const triggerCallback = () => {
    if (isGlobalLoaded) {
      if (!mergedSettings.clearanceTopOptions) {
        mergedSettings.clearanceTopOptions = DEFAULT_SETTINGS.clearanceTopOptions || [];
      }
      currentCachedSettings = JSON.parse(JSON.stringify(mergedSettings));
      callback({ ...mergedSettings });
    }
  };

  // 1. Subscribe to global document
  const globalRef = doc(db, "settings", "global");
  const unsubGlobal = onSnapshot(globalRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      mergedSettings = {
        ...mergedSettings,
        ...data
      };
      isGlobalLoaded = true;
      triggerCallback();
    } else {
      console.log("Global settings do not exist. Seeding default settings...");
      isGlobalLoaded = true;
      firebaseStorage.saveSettings(DEFAULT_SETTINGS)
        .then(() => triggerCallback())
        .catch((err) => console.error("Failed to seed default settings:", err));
    }
  }, (err) => {
    console.error("Error in onSnapshot for settings/global:", err);
  });
  unsubscribes.push(unsubGlobal);

  // 2. Subscribe to each subcollection
  subDocFields.forEach((field) => {
    const colRef = collection(db, "settings", "global", field);
    const oldDocRef = doc(db, "settings", field);

    const unsubCol = onSnapshot(colRef, async (snapshot) => {
      // Robust Check: Always look for the old separate document first as the source of truth
      try {
        const oldDocSnap = await getDoc(oldDocRef);
        if (oldDocSnap.exists()) {
          const oldItems = oldDocSnap.data().items;
          if (Array.isArray(oldItems) && oldItems.length > 0) {
            console.log(`[subscribeSettings] Migrating ${oldItems.length} items for ${field} from old separate document.`);
            
            // 1. Instantly update local state so the user sees all their fabrics immediately (no delay)
            mergedSettings = {
              ...mergedSettings,
              [field]: oldItems
            };
            loadedSubcollections.add(field);
            triggerCallback();

            // 2. Perform migration in background if not already running in this session
            if (!migrationAttempted.has(field)) {
              migrationAttempted.add(field);
              
              const migratePromises = oldItems.map(item => 
                setDoc(doc(db, "settings", "global", field, item.id), item)
              );
              
              Promise.all(migratePromises)
                .then(async () => {
                  console.log(`[subscribeSettings] Migration succeeded for ${field}. Deleting old document.`);
                  await deleteDoc(oldDocRef);
                })
                .catch((err) => {
                  console.error(`[subscribeSettings] Migration failed for ${field}:`, err);
                  // Allow retry on next listener trigger
                  migrationAttempted.delete(field);
                });
            }
            return;
          }
        }
      } catch (err) {
        console.error(`[subscribeSettings] Error checking or migrating old separate document for ${field}:`, err);
      }

      // If old document does not exist or migration is complete, use the subcollection data
      if (!snapshot.empty) {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as any[];

        mergedSettings = {
          ...mergedSettings,
          [field]: items
        };
        loadedSubcollections.add(field);
        triggerCallback();
      } else {
        // Subcollection is empty AND no old separate document exists. Seeding defaults...
        if (!migrationAttempted.has(field)) {
          migrationAttempted.add(field);
          const defaultItems = (DEFAULT_SETTINGS as any)[field] || [];
          if (defaultItems.length > 0) {
            console.log(`[subscribeSettings] ${field} subcollection is empty. Seeding DEFAULT_SETTINGS...`);
            
            // Instantly show default items
            mergedSettings = {
              ...mergedSettings,
              [field]: defaultItems
            };
            loadedSubcollections.add(field);
            triggerCallback();

            const seedPromises = defaultItems.map((item: any) => 
              setDoc(doc(db, "settings", "global", field, item.id), item)
            );
            Promise.all(seedPromises)
              .then(() => {
                console.log(`[subscribeSettings] Successfully seeded default items for ${field}.`);
              })
              .catch((err) => {
                console.error(`[subscribeSettings] Error seeding defaults for ${field}:`, err);
                migrationAttempted.delete(field);
              });
          } else {
            mergedSettings = {
              ...mergedSettings,
              [field]: []
            };
            loadedSubcollections.add(field);
            triggerCallback();
          }
        }
      }
    }, (err) => {
      console.error(`Error in onSnapshot for settings/global/${field}:`, err);
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
      compressImage(win.preImageBase64, 800, 0.85),
      compressImage(win.aiPreviewBase64, 800, 0.85),
      compressImage(win.fabricImageBase64, 400, 0.85),
      compressImage(win.sheerImageBase64, 400, 0.85),
      compressImage(win.styleImageBase64, 400, 0.85),
      compressImage(win.hemImageBase64, 400, 0.85),
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

  try {
    const fileRef = sRef(storage, path);
    // Timeout uploadString after 25000ms (25 seconds) instead of 1.5 seconds
    await withTimeout(uploadString(fileRef, base64Str, "data_url"), 25000, null);
    const downloadUrl = await withTimeout(getDownloadURL(fileRef), 10000, "");
    if (downloadUrl) {
      return downloadUrl;
    }
    return base64Str;
  } catch (err) {
    console.warn(`Firebase Storage upload failed at ${path}, falling back to compressed base64.`, err);
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

// Map items with a concurrency limit to prevent network choke
async function mapWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency = 3
): Promise<R[]> {
  const results: R[] = [];
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    batches.push(items.slice(i, i + concurrency));
  }
  for (const batch of batches) {
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

// Compare helper for material lists
const isMaterialItemEqual = (item1: any, item2: any) => {
  if (!item1 || !item2) return item1 === item2;
  return (
    item1.id === item2.id &&
    item1.name === item2.name &&
    item1.imageBase64 === item2.imageBase64 &&
    item1.colorName === item2.colorName &&
    item1.type === item2.type
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
    await setDoc(doc(db, "jobs", job.id), data);
  },

  async deleteJob(id: string): Promise<void> {
    await deleteDoc(doc(db, "jobs", id));
  },

  async saveWindow(win: WindowItem): Promise<void> {
    const uploadedWin = await uploadWindowImages(win);
    await setDoc(doc(db, "windows", uploadedWin.id), uploadedWin);
  },

  async updateWindowMetadata(id: string, metadata: Partial<WindowItem>): Promise<void> {
    const docRef = doc(db, "windows", id);
    await updateDoc(docRef, metadata);
  },

  async deleteWindow(id: string): Promise<void> {
    await deleteDoc(doc(db, "windows", id));
  },

  async saveEmployee(emp: Employee): Promise<void> {
    await setDoc(doc(db, "employees", emp.id), emp);
  },

  async deleteEmployee(id: string): Promise<void> {
    await deleteDoc(doc(db, "employees", id));
  },

  async saveSettings(settings: Settings, onProgress?: (percent: number) => void): Promise<void> {
    const cached = currentCachedSettings;

    // Determine which parts actually changed to avoid redundant uploads and writes
    const styleChanged = !cached || !isCollectionEqual(settings.styleMaterials, cached.styleMaterials);
    const hemChanged = !cached || !isCollectionEqual(settings.hemMaterials, cached.hemMaterials);
    const solidChanged = !cached || !isCollectionEqual(settings.solidFabricMaterials, cached.solidFabricMaterials);
    const sheerChanged = !cached || !isCollectionEqual(settings.sheerFabricMaterials, cached.sheerFabricMaterials);
    const blindChanged = !cached || !isCollectionEqual(settings.blindMaterials, cached.blindMaterials);
    const rollerChanged = !cached || !isCollectionEqual(settings.rollerMaterials, cached.rollerMaterials);
    const blindTapeChanged = !cached || !isCollectionEqual(settings.blindTapeMaterials, cached.blindTapeMaterials);
    const globalChanged = !cached || !isGlobalSettingsEqual(settings, cached);

    // If nothing changed at all, return immediately (milisecond responsiveness!)
    if (!styleChanged && !hemChanged && !solidChanged && !sheerChanged && !blindChanged && !rollerChanged && !blindTapeChanged && !globalChanged) {
      if (onProgress) onProgress(100);
      return;
    }

    const updatedSettings = { ...settings };

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
        const pct = Math.round((completedUploads / totalToUpload) * 100);
        onProgress(Math.min(pct, 99));
      }
    };

    if (totalToUpload === 0 && onProgress) {
      onProgress(100);
    }

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
      return await mapWithConcurrency(
        materials,
        async (m) => {
          if (m.imageBase64 && m.imageBase64.startsWith("data:image/")) {
            const compressed = await compressImage(m.imageBase64, 400, 0.85);
            const url = await uploadImageIfBase64(
              compressed,
              `settings/${folder}/${m.id}.jpg`
            );
            updateProgress();
            return { ...m, imageBase64: url || m.imageBase64 };
          }
          return m;
        },
        3
      );
    };

    // Upload only changed collections
    if (styleChanged && updatedSettings.styleMaterials) {
      updatedSettings.styleMaterials = await uploadMaterials(updatedSettings.styleMaterials, "styleMaterials");
    }
    if (hemChanged && updatedSettings.hemMaterials) {
      updatedSettings.hemMaterials = await uploadMaterials(updatedSettings.hemMaterials, "hemMaterials");
    }
    if (solidChanged && updatedSettings.solidFabricMaterials) {
      updatedSettings.solidFabricMaterials = await uploadMaterials(updatedSettings.solidFabricMaterials, "solidFabricMaterials");
    }
    if (sheerChanged && updatedSettings.sheerFabricMaterials) {
      updatedSettings.sheerFabricMaterials = await uploadMaterials(updatedSettings.sheerFabricMaterials, "sheerFabricMaterials");
    }
    if (blindChanged && updatedSettings.blindMaterials) {
      updatedSettings.blindMaterials = await uploadMaterials(updatedSettings.blindMaterials, "blindMaterials");
    }
    if (rollerChanged && updatedSettings.rollerMaterials) {
      updatedSettings.rollerMaterials = await uploadMaterials(updatedSettings.rollerMaterials, "rollerMaterials");
    }
    if (blindTapeChanged && updatedSettings.blindTapeMaterials) {
      updatedSettings.blindTapeMaterials = await uploadMaterials(updatedSettings.blindTapeMaterials, "blindTapeMaterials");
    }

    // Split the uploaded settings into separate document structures
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

    const dbPromises: Promise<any>[] = [];

    // Save general/global options if changed
    if (globalChanged) {
      dbPromises.push(setDoc(doc(db, "settings", "global"), globalSettings));
    }

    const collectionsToSave = [
      { id: "styleMaterials", items: styleMaterials || [], hasChanged: styleChanged },
      { id: "hemMaterials", items: hemMaterials || [], hasChanged: hemChanged },
      { id: "solidFabricMaterials", items: solidFabricMaterials || [], hasChanged: solidChanged },
      { id: "sheerFabricMaterials", items: sheerFabricMaterials || [], hasChanged: sheerChanged },
      { id: "blindMaterials", items: blindMaterials || [], hasChanged: blindChanged },
      { id: "rollerMaterials", items: rollerMaterials || [], hasChanged: rollerChanged },
      { id: "blindTapeMaterials", items: blindTapeMaterials || [], hasChanged: blindTapeChanged }
    ];

    // Only save subcollections that actually changed
    for (const col of collectionsToSave) {
      if (!col.hasChanged) continue;

      const colRef = collection(db, "settings", "global", col.id);
      const snapshot = await getDocs(colRef);
      const newIds = new Set(col.items.map(item => item.id));

      const batchPromises: Promise<any>[] = [];

      // 1. Write/update new and modified items only
      col.items.forEach((item) => {
        const docRef = doc(db, "settings", "global", col.id, item.id);
        const cachedCol = cached ? (cached as any)[col.id] as any[] : undefined;
        const cachedItem = cachedCol?.find((x: any) => x.id === item.id);

        // Only write to Firestore if item is new or actually modified
        if (!cachedItem || !isMaterialItemEqual(item, cachedItem)) {
          batchPromises.push(setDoc(docRef, item));
        }
      });

      // 2. Delete items that are removed from settings
      snapshot.docs.forEach((d) => {
        if (!newIds.has(d.id)) {
          batchPromises.push(deleteDoc(doc(db, "settings", "global", col.id, d.id)));
        }
      });

      if (batchPromises.length > 0) {
        dbPromises.push(Promise.all(batchPromises));
      }
    }

    if (dbPromises.length > 0) {
      await Promise.all(dbPromises);
    }

    // Explicitly update cache with latest saved settings
    currentCachedSettings = JSON.parse(JSON.stringify(updatedSettings));

    if (onProgress) onProgress(100);
  },

  async incrementEmployeeAiUsage(employeeId: string): Promise<void> {
    const docRef = doc(db, "employees", employeeId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const current = snap.data() as Employee;
      await setDoc(docRef, {
        ...current,
        aiUsed: (current.aiUsed || 0) + 1
      });
    }
  }
};
