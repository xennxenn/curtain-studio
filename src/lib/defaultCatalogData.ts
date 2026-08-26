import { FabricMaterial, StyleMaterial, HemMaterial, Employee, Settings } from "../types";

export const DEFAULT_EMPLOYEES: Employee[] = [
  { id: "1", name: "ผู้ดูแลระบบ (Admin)", username: "admin", role: "admin", password: "123", aiQuota: 9999, aiUsed: 0 },
  { id: "2", name: "คุณพิมพ์มาดา (Designer 1)", username: "pim", role: "designer", password: "123", aiQuota: 100, aiUsed: 0 },
  { id: "3", name: "คุณธนกร (Designer 2)", username: "thanakorn", role: "designer", password: "123", aiQuota: 100, aiUsed: 0 },
  { id: "4", name: "คุณณภัทร (Sales & Site)", username: "naphat", role: "installer", password: "123", aiQuota: 100, aiUsed: 0 },
];

export const INITIAL_SOLID_FABRICS: FabricMaterial[] = [
  { id: "solid-1", name: "CITADEL", colorName: "01 LONDON GRAY", type: "Blackout", imageBase64: "", uploadedAt: new Date().toISOString() },
  { id: "solid-2", name: "CITADEL", colorName: "02 CHASSIS GREY", type: "Blackout", imageBase64: "", uploadedAt: new Date().toISOString() },
  { id: "solid-3", name: "GLAMOUR", colorName: "05 GOLDEN BRONZE", type: "Dimout", imageBase64: "", uploadedAt: new Date().toISOString() },
  { id: "solid-4", name: "GLAMOUR", colorName: "12 CHAMPAGNE GOLD", type: "Dimout", imageBase64: "", uploadedAt: new Date().toISOString() },
  { id: "solid-5", name: "SERENE", colorName: "03 COCOA BROWN", type: "Dimout", imageBase64: "", uploadedAt: new Date().toISOString() },
  { id: "solid-6", name: "SERENE", colorName: "08 CREAMY BEIGE", type: "Dimout", imageBase64: "", uploadedAt: new Date().toISOString() },
  { id: "solid-7", name: "ROYAL LUXE", colorName: "11 DEEP FOREST GREEN", type: "Blackout", imageBase64: "", uploadedAt: new Date().toISOString() },
  { id: "solid-8", name: "ROYAL LUXE", colorName: "14 MIDNIGHT NAVY", type: "Blackout", imageBase64: "", uploadedAt: new Date().toISOString() },
  { id: "solid-9", name: "SHERWOOD", colorName: "07 SAGE MIST", type: "Drapery", imageBase64: "", uploadedAt: new Date().toISOString() },
  { id: "solid-10", name: "MONACO", colorName: "04 WARM TAUPE", type: "Dimout", imageBase64: "", uploadedAt: new Date().toISOString() },
  { id: "solid-11", name: "VELVET TOUCH", colorName: "09 DUSKY ROSE", type: "Dimout", imageBase64: "", uploadedAt: new Date().toISOString() },
  { id: "solid-12", name: "NORDIC LINEN", colorName: "02 OATMEAL NATURAL", type: "Drapery", imageBase64: "", uploadedAt: new Date().toISOString() },
];

export const INITIAL_SHEER_FABRICS: FabricMaterial[] = [
  { id: "sheer-1", name: "AFFINITY", colorName: "01 PURE WHITE", type: "Sheer", imageBase64: "", uploadedAt: new Date().toISOString() },
  { id: "sheer-2", name: "AFFINITY", colorName: "02 SOFT CREAM", type: "Sheer", imageBase64: "", uploadedAt: new Date().toISOString() },
  { id: "sheer-3", name: "AURA", colorName: "03 CREAMY IVORY", type: "Sheer", imageBase64: "", uploadedAt: new Date().toISOString() },
  { id: "sheer-4", name: "AURA", colorName: "04 SILVER SHIMMER", type: "Sheer", imageBase64: "", uploadedAt: new Date().toISOString() },
  { id: "sheer-5", name: "LACE CLASSIC", colorName: "09 SNOW FLAKE", type: "Sheer", imageBase64: "", uploadedAt: new Date().toISOString() },
  { id: "sheer-6", name: "CHIFFON BREEZE", colorName: "01 PEARL WHITE", type: "Sheer", imageBase64: "", uploadedAt: new Date().toISOString() },
];

export const INITIAL_BLIND_MATERIALS: FabricMaterial[] = [
  { id: "blind-1", name: "BASSWOOD PREMIUM", colorName: "01 NATURAL TEAK (ไม้สักธรรมชาติ)", type: "Wood Blinds", imageBase64: "", uploadedAt: new Date().toISOString() },
  { id: "blind-2", name: "BASSWOOD PREMIUM", colorName: "02 DARK WALNUT (ไม้วอลนัทเข้ม)", type: "Wood Blinds", imageBase64: "", uploadedAt: new Date().toISOString() },
  { id: "blind-3", name: "BASSWOOD PREMIUM", colorName: "03 SNOW WHITE (ขาวนวล)", type: "Wood Blinds", imageBase64: "", uploadedAt: new Date().toISOString() },
  { id: "blind-4", name: "FOAM WOOD (กันน้ำ)", colorName: "04 CHARCOAL GREY", type: "Wood Blinds", imageBase64: "", uploadedAt: new Date().toISOString() },
];

export const INITIAL_ROLLER_MATERIALS: FabricMaterial[] = [
  { id: "roller-1", name: "SUNSCREEN 5%", colorName: "01 WHITE GREY (กันแดด 95%)", type: "Roller Shades", imageBase64: "", uploadedAt: new Date().toISOString() },
  { id: "roller-2", name: "SUNSCREEN 3%", colorName: "02 CHARCOAL BRONZE", type: "Roller Shades", imageBase64: "", uploadedAt: new Date().toISOString() },
  { id: "roller-3", name: "BLACKOUT 100%", colorName: "03 IVORY WHITE (ทึบแสงสนิท)", type: "Roller Shades", imageBase64: "", uploadedAt: new Date().toISOString() },
  { id: "roller-4", name: "BLACKOUT 100%", colorName: "04 SLATE GREY (เทาเข้ม)", type: "Roller Shades", imageBase64: "", uploadedAt: new Date().toISOString() },
];

export const INITIAL_BLIND_TAPE_MATERIALS: FabricMaterial[] = [
  { id: "tape-1", name: "COTTON TAPE 25MM", colorName: "01 BEIGE (ครีม)", type: "Fabric Tape", imageBase64: "", uploadedAt: new Date().toISOString() },
  { id: "tape-2", name: "COTTON TAPE 25MM", colorName: "02 DARK BROWN (น้ำตาลเข้ม)", type: "Fabric Tape", imageBase64: "", uploadedAt: new Date().toISOString() },
  { id: "tape-3", name: "COTTON TAPE 25MM", colorName: "03 BLACK (ดำ)", type: "Fabric Tape", imageBase64: "", uploadedAt: new Date().toISOString() },
  { id: "tape-4", name: "COTTON TAPE 38MM", colorName: "04 WIDE GREY (เทากว้าง)", type: "Fabric Tape", imageBase64: "", uploadedAt: new Date().toISOString() },
];

export const INITIAL_STYLE_MATERIALS: StyleMaterial[] = [
  { id: "style-1", name: "ม่านจีบ", imageBase64: "", category: "curtain", operationOptions: ["รวบซ้าย", "รวบขวา", "แยกกลาง"], styleEnForAi: "pinch pleat curtains" },
  { id: "style-2", name: "ม่านตาไก่", imageBase64: "", category: "curtain", operationOptions: ["รวบซ้าย", "รวบขวา", "แยกกลาง"], styleEnForAi: "eyelet grommet curtains" },
  { id: "style-3", name: "ม่านพับ", imageBase64: "", category: "roman", operationOptions: ["ดึงโซ่ฝั่งซ้าย", "ดึงโซ่ฝั่งขวา", "ใช้งานมอเตอร์"], styleEnForAi: "roman shades" },
  { id: "style-4", name: "ม่านลอน", imageBase64: "", category: "curtain", operationOptions: ["รวบซ้าย", "รวบขวา", "แยกกลาง"], styleEnForAi: "wave fold curtains" },
  { id: "style-7", name: "ม่านลอนกลับ", imageBase64: "", category: "curtain", operationOptions: ["รวบซ้าย", "รวบขวา", "แยกกลาง"], styleEnForAi: "back-fold wave fold curtains" },
  { id: "style-5", name: "ม่านม้วน", imageBase64: "", category: "roller", operationOptions: ["ดึงโซ่ฝั่งซ้าย", "ดึงโซ่ฝั่งขวา", "ใช้งานมอเตอร์"], styleEnForAi: "roller shades" },
  { id: "style-6", name: "มู่ลี่ไม้", imageBase64: "", category: "blind", operationOptions: ["ดึงโซ่ฝั่งซ้าย", "ดึงโซ่ฝั่งขวา", "ใช้งานมอเตอร์"], styleEnForAi: "venetian wood blinds" },
];

export const INITIAL_HEM_MATERIALS: HemMaterial[] = [
  { id: "hem-1", name: "พอดีพื้น", imageBase64: "" },
  { id: "hem-2", name: "ลอยจากพื้น 1 ซม.", imageBase64: "" },
  { id: "hem-3", name: "กองพื้นหรูหรา +5 ซม.", imageBase64: "" },
  { id: "hem-4", name: "กองพื้นหรูหรา +10 ซม.", imageBase64: "" },
  { id: "hem-5", name: "พอดีขอบวงกบล่าง", imageBase64: "" },
  { id: "hem-6", name: "เลยวงกบล่าง 15 ซม.", imageBase64: "" },
];

export const INITIAL_TRACK_MATERIALS = [
  { id: "track-1", name: "รางไมโคร ตัวเอ็ม (Standard M-Track)" },
  { id: "track-2", name: "รางโชว์อลูมิเนียมพรีเมียม (Premium Aluminum Rod)" },
  { id: "track-3", name: "รางดัดโค้งพิเศษ (Flexible Curve Track)" },
  { id: "track-4", name: "รางม้วนดึงโซ่ไข่มุก (Roller Roller System)" },
  { id: "track-5", name: "รางมอเตอร์ไฟฟ้า (Smart Motorized Track)" },
];

export const INITIAL_ACCESSORY_MATERIALS = [
  { id: "acc-1", name: "สายรวบม่านพู่ระย้าหรู (Luxury Tassel Tiebacks)" },
  { id: "acc-2", name: "สายรวบม่านแม่เหล็กสไตล์โมเดิร์น (Modern Magnetic Tie)" },
  { id: "acc-3", name: "ตะขอเกี่ยวกำแพงเหล็กดัดรมดำ (Black Forged Wall Hooks)" },
  { id: "acc-4", name: "ด้ามจูงอะคริลิคใสพิเศษ (Clear Acrylic Wand)" },
];

export const COMPLETE_DEFAULT_SETTINGS: Settings = {
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
  styleMaterials: INITIAL_STYLE_MATERIALS,
  hemMaterials: INITIAL_HEM_MATERIALS,
  solidFabricMaterials: INITIAL_SOLID_FABRICS,
  sheerFabricMaterials: INITIAL_SHEER_FABRICS,
  blindMaterials: INITIAL_BLIND_MATERIALS,
  rollerMaterials: INITIAL_ROLLER_MATERIALS,
  blindTapeMaterials: INITIAL_BLIND_TAPE_MATERIALS,
  trackMaterials: INITIAL_TRACK_MATERIALS,
  accessoryMaterials: INITIAL_ACCESSORY_MATERIALS,
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
    "ติดเพดาน",
    "พอดีพื้น",
  ],
  clearanceTopOptions: [
    "พอดีเฟรม",
    "เลยเฟรม 10 ซม.",
    "เลยเฟรม 15 ซม.",
    "เลยเฟรม 20 ซม.",
    "ติดเพดาน",
    "ใต้กล่องม่าน",
    "กล่องม่านซ่อนราง",
  ],
};
