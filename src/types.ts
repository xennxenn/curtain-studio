export interface Employee {
  id: string;
  name: string;
  aiQuota: number;
  aiUsed: number;
  username?: string;
  password?: string;
  role?: "admin" | "designer" | "installer";
}

export interface FabricMaterial {
  id: string;
  name: string; // ชื่อผ้า
  colorCode?: string; // รหัสสี (optional, legacy)
  colorName: string; // สีผ้า
  imageColorHex?: string; // โทนสี (optional, legacy)
  type: string; // Blackout, Dimout, Drapery, Sheer, Blind, Roller, Tape, etc.
  imageBase64?: string;
}

export interface StyleMaterial {
  id: string;
  name: string;
  imageBase64?: string;
  category?: "curtain" | "blind" | "roller" | "roman"; // ประเภทรูปแบบ
  operationOptions?: string[]; // ตัวเลือกการใช้งาน เช่น รวบซ้าย, รวบขวา, แยกกลาง
  styleEnForAi?: string; // คำสั่ง AI ภาษาอังกฤษสำหรับรูปแบบม่านนี้
}

export interface HemMaterial {
  id: string;
  name: string;
  imageBase64?: string;
}

export interface Settings {
  curtainStyles: string[];
  patterns: string[];
  tracks: string[];
  accessories: string[];
  
  styleMaterials?: StyleMaterial[];
  hemMaterials?: HemMaterial[];
  solidFabricMaterials?: FabricMaterial[];
  sheerFabricMaterials?: FabricMaterial[];

  // Blinds & Roller Database
  blindMaterials?: FabricMaterial[];
  rollerMaterials?: FabricMaterial[];
  blindTapeMaterials?: FabricMaterial[];

  // Track & Accessories Database
  trackMaterials?: { id: string; name: string }[];
  accessoryMaterials?: { id: string; name: string }[];
  fabricTypes?: string[];
  customGeminiApiKey?: string;
  hangingTypes?: string[];
  usageTypes?: string[];
  clearanceOptions?: string[];
  clearanceTopOptions?: string[];
  companyLogoBase64?: string;
  companyLogoSize?: "S" | "M" | "L" | "XL";
  defaultDistanceLeft?: string;
  defaultDistanceRight?: string;
  defaultDistanceTop?: string;
}

export interface CurtainArea {
  id: string;
  name: string;
  points: { x: number; y: number }[]; // Normalized coordinate points 0 to 100
  isClosed: boolean;
  
  // Independent specs for each area
  width: string;
  height: string;
  style: string;
  pattern: string;
  solidFabricName: string;
  solidFabricColor: string;
  sheerFabricName: string;
  sheerFabricColor: string;
  hemStyleText: string;
  usageType: string;       // การใช้งาน
  distanceLeft: string;
  distanceRight: string;
  distanceTop: string;
  distanceBottom: string;
  hangingType: string;     // การแขวนม่าน
  trackType: string;       // รางม่าน
  notes: string;
  layerDisplayType?: "ทั้งหมด" | "ม่านทึบ" | "ม่านโปร่ง";
  styleEnForAi?: string;
  sheerStyle?: string;       // รูปแบบม่านโปร่ง
  sheerStyleEnForAi?: string; // คำสั่ง AI ภาษาอังกฤษสำหรับม่านโปร่ง
}

export interface WindowItem {
  id: string;
  jobId: string;
  roomName: string;
  windowCode: string; // e.g., "W1"
  width: string;
  height: string;
  style: string;
  pattern: string;
  color: string;
  track: string;
  accessories: string;
  
  // Custom design specs matching PDF layout
  solidFabricName: string; // "CITADEL / LONDON GRAY"
  sheerFabricName: string; // "AFFINITY / WHITE"
  hemStyleText: string;    // "พอดีพื้น"
  
  layer1Style: string;     // "ม่านจีบ (แยกกลาง)"
  layer2Style: string;     // "ม่านจีบ (แยกกลาง)"
  track1Style: string;     // "รางม่านจีบ"
  track2Style: string;     // "รางม่านจีบ"
  mountingType: string;    // "ติดเพดาน"
  hangingType: string;     // "หัวผ้าม่านแขวนปิดรางม่าน"
  
  distanceLeft: string;    // "พอดีเฟรม"
  distanceRight: string;   // "พอดีเฟรม"
  distanceTop: string;     // "ติดเพดาน"
  distanceBottom: string;  // "พอดีพื้น"
  notes: string;           // "หมายเหตุเฉพาะบานนี้"
  isDoubleLayer?: boolean; // ผ้าม่าน 2 ชั้นหรือไม่
  styleEnForAi?: string;   // คำสั่ง AI สำหรับม่านนี้โดยเฉพาะ (ภาษาอังกฤษ)
  sheerStyle?: string;     // รูปแบบม่านโปร่ง
  sheerStyleEnForAi?: string; // คำสั่ง AI สำหรับม่านโปร่งโดยเฉพาะ (ภาษาอังกฤษ)

  // Base64 Images
  preImageBase64: string | null;     // ภาพหน้างานเดิม (ก่อนติดตั้ง)
  aiPreviewBase64: string | null;    // ภาพหน้างานตัวอย่าง (หลังติดตั้ง)
  styleImageBase64: string | null;   // รูปแบบผ้าม่าน swatch
  fabricImageBase64: string | null;  // ผ้าม่านทึบ swatch
  sheerImageBase64: string | null;   // ผ้าม่านโปร่ง swatch
  hemImageBase64: string | null;     // ระยะชายม่าน swatch
  
  aiDescription: string;
  
  areas?: CurtainArea[]; // Multiple drawn polygon areas
  orderIndex?: number;   // สำหรับจัดเรียงลำดับจุดติดตั้ง
  isHidden?: boolean;    // สำหรับซ่อนจุดติดตั้งจากใบเสนอราคา/รายงาน
}

export interface Job {
  id: string;
  customerName: string;
  phone: string;
  address: string;
  notes: string;
  employeeId: string;
  createdAt: number;
  updatedAt: number;
}
