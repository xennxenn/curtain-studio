export interface FabricItem {
  name: string;
  colorCode: string;
  colorName: string;
  imageColorHex: string;
}

export const SOLID_FABRICS: FabricItem[] = [
  { name: "CITADEL", colorCode: "01", colorName: "LONDON GRAY", imageColorHex: "#5A5D64" },
  { name: "CITADEL", colorCode: "02", colorName: "CHASSIS GREY", imageColorHex: "#3F4248" },
  { name: "GLAMOUR", colorCode: "05", colorName: "GOLDEN BRONZE", imageColorHex: "#8C7B62" },
  { name: "GLAMOUR", colorCode: "12", colorName: "CHAMPAGNE GOLD", imageColorHex: "#D4C5A9" },
  { name: "SERENE", colorCode: "03", colorName: "COCOA BROWN", imageColorHex: "#4E3E38" },
  { name: "SERENE", colorCode: "08", colorName: "CREAMY BEIGE", imageColorHex: "#F2E8D5" },
  { name: "ROYAL LUXE", colorCode: "11", colorName: "DEEP FOREST GREEN", imageColorHex: "#1B3B32" },
  { name: "ROYAL LUXE", colorCode: "14", colorName: "MIDNIGHT NAVY", imageColorHex: "#1A2E40" },
  { name: "SHERWOOD", colorCode: "07", colorName: "SAGE MIST", imageColorHex: "#9AA69B" },
];

export const SHEER_FABRICS: FabricItem[] = [
  { name: "AFFINITY", colorCode: "01", colorName: "WHITE", imageColorHex: "#FBFBFC" },
  { name: "AFFINITY", colorCode: "02", colorName: "SOFT CREAM", imageColorHex: "#FCF9EE" },
  { name: "AURA", colorCode: "03", colorName: "CREAMY IVORY", imageColorHex: "#FAF5E6" },
  { name: "AURA", colorCode: "04", colorName: "SILVER SHIMMER", imageColorHex: "#EAEBEC" },
  { name: "LACE CLASSIC", colorCode: "09", colorName: "SNOW FLAKE", imageColorHex: "#FFFFFF" },
];

export const HEM_STYLES = [
  "พอดีพื้น",
  "ลอยจากพื้น 1 ซม.",
  "กองพื้นหรูหรา +5 ซม.",
  "กองพื้นหรูหรา +10 ซม.",
  "พอดีขอบวงกบล่าง",
  "เลยวงกบล่าง 15 ซม.",
];

export const CURTAIN_STYLES = [
  "ม่านจีบ",
  "ม่านตาไก่",
  "ม่านพับ",
  "ม่านลอน",
  "ม่านม้วน",
  "ม่านปรับแสง",
];

export const USAGE_TYPES = [
  "แยกกลาง (แยกซ้าย-ขวา)",
  "เก็บข้างซ้าย (ฝั่งเดียว)",
  "เก็บข้างขวา (ฝั่งเดียว)",
  "ดึงม้วนขึ้น-ลง",
  "ยึดตายตัว",
];

export const TRACK_TYPES = [
  "รางม่านจีบ",
  "รางไมโคร ตัวเอ็ม",
  "รางโชว์อลูมิเนียม",
  "รางดัดโค้งพิเศษ",
  "รางมอเตอร์ไฟฟ้า",
];

export const HANGING_TYPES = [
  "หัวผ้าม่านแขวนปิดรางม่าน",
  "หัวผ้าม่านใต้รางม่าน",
  "สวมห่วงตาไก่",
  "ซ่อนในกล่องม่าน",
];

export const DISTANCE_OPTIONS = [
  "พอดีเฟรม",
  "เลยเฟรม 10 ซม.",
  "เลยเฟรม 15 ซม.",
  "เลยเฟรม 20 ซม.",
  "ติดเพดาน",
  "พอดีพื้น",
];
