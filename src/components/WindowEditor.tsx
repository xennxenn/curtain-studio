import React, { useState, useRef } from "react";
import { Upload, Palette, Sparkles, AlertCircle, RefreshCw, BadgeCheck, X, Ruler, Layers, ChevronDown, ChevronUp, Sliders, FileText, Eye, Download, Save } from "lucide-react";
import { WindowItem, Settings } from "../types";
import { generateId } from "../lib/storage";
import { CurtainAreaDrawer } from "./CurtainAreaDrawer";
import { SearchableSelect } from "./SearchableSelect";
import { getSolidFabricSwatch, getSheerFabricSwatch } from "../lib/fabricUtils";
import { getDedicatedGeminiApiKey } from "../lib/indexedDbStorage";

interface WindowEditorProps {
  winData?: WindowItem;
  index: number;
  isNew?: boolean;
  jobId: string;
  settings: Settings;
  onSave: (window: WindowItem, isSilent?: boolean) => Promise<boolean>;
  onDelete?: () => void;
  incrementEmployeeAiUsage: () => void;
  activeEmployeeQuotaExceeded: boolean;
}

// Convert image file to downscaled base64
const downscaleImage = (file: File, maxWidth = 1024, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let scale = 1;
        if (img.width > maxWidth) {
          scale = maxWidth / img.width;
        }
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        } else {
          reject(new Error("Canvas 2D Context failed"));
        }
      };
      img.onerror = (e) => reject(e);
    };
    reader.onerror = (e) => reject(e);
  });
};

// Ensure any base64 string is downscaled if it is too large
const ensureBase64Downscaled = (base64Str: string | null, maxWidth = 1024, quality = 0.7): Promise<string | null> => {
  if (!base64Str) return Promise.resolve(null);
  if (base64Str.length < 50000 || !base64Str.startsWith("data:image/")) {
    return Promise.resolve(base64Str);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      if (img.width <= maxWidth) {
        resolve(base64Str);
        return;
      }
      const canvas = document.createElement("canvas");
      const scale = maxWidth / img.width;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
};

export const WindowEditor: React.FC<WindowEditorProps> = ({
  winData,
  index,
  isNew = false,
  jobId,
  settings,
  onSave,
  onDelete,
  incrementEmployeeAiUsage,
  activeEmployeeQuotaExceeded,
}) => {
  const [localData, setLocalData] = useState<WindowItem>(() => {
    const defaultStyle = settings.styleMaterials?.[0]?.name || "ม่านจีบ";
    const defaultSolidFabric = settings.solidFabricMaterials?.[0]
      ? `${settings.solidFabricMaterials[0].name} / ${settings.solidFabricMaterials[0].colorName}`
      : "CITADEL / LONDON GRAY";
    const defaultSheerFabric = settings.sheerFabricMaterials?.[0]
      ? `${settings.sheerFabricMaterials[0].name} / ${settings.sheerFabricMaterials[0].colorName}`
      : "AFFINITY / WHITE";
    const defaultHem = settings.hemMaterials?.[0]?.name || "พอดีพื้น";

    const base = winData || {
      id: generateId(),
      jobId,
      roomName: "",
      windowCode: `W${index}`,
      width: "250",
      height: "280",
      style: defaultStyle,
      pattern: settings.patterns[0] || "",
      color: "เทาอมดำ",
      track: settings.tracks[0] || "รางม่านจีบ",
      accessories: settings.accessories[0] || "ตะขอสายรวบม่าน สีเงิน, ด้ามจูงอะคลิลิก ยาว 150 ซม.",
      preImageBase64: null,
      fabricImageBase64: null,
      aiPreviewBase64: null,
      aiDescription: "",
    };

    const matchedStyle = (settings.styleMaterials || []).find(s => s.name === base.style);
    const sheerStyleVal = base.sheerStyle || base.style || defaultStyle;
    const matchedSheerStyle = (settings.styleMaterials || []).find(s => s.name === sheerStyleVal);

    return {
      ...base,
      windowCode: base.windowCode || `W${index}`,
      solidFabricName: base.solidFabricName || defaultSolidFabric,
      sheerFabricName: base.sheerFabricName || defaultSheerFabric,
      hemStyleText: base.hemStyleText || defaultHem,
      layer1Style: base.layer1Style || "ม่านจีบ (แยกกลาง)",
      layer2Style: base.layer2Style || "ม่านจีบ (แยกกลาง)",
      track1Style: base.track1Style || "รางม่านจีบ",
      track2Style: base.track2Style || "รางม่านจีบ",
      mountingType: base.mountingType || "ติดเพดาน",
      hangingType: base.hangingType || "หัวผ้าม่านแขวนปิดรางม่าน",
      distanceLeft: base.distanceLeft || settings.defaultDistanceLeft || "พอดีเฟรม",
      distanceRight: base.distanceRight || settings.defaultDistanceRight || "พอดีเฟรม",
      distanceTop: base.distanceTop || settings.defaultDistanceTop || "ติดเพดาน",
      distanceBottom: base.distanceBottom || base.hemStyleText || defaultHem,
      notes: base.notes || "",
      isDoubleLayer: base.isDoubleLayer !== undefined ? base.isDoubleLayer : false,
      styleImageBase64: base.styleImageBase64 || null,
      sheerImageBase64: base.sheerImageBase64 || null,
      hemImageBase64: base.hemImageBase64 || null,
      styleEnForAi: base.styleEnForAi || matchedStyle?.styleEnForAi || "",
      sheerStyle: sheerStyleVal,
      sheerStyleEnForAi: base.sheerStyleEnForAi || matchedSheerStyle?.styleEnForAi || "",
    };
  });

  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [activeAreaId, setActiveAreaId] = useState<string | null>(() => {
    return winData?.areas && winData.areas.length > 0 ? winData.areas[0].id : null;
  });
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiStatusMsg, setAiStatusMsg] = useState("");
  const [dragActiveRoom, setDragActiveRoom] = useState(false);
  const [showAdvancedSpecs, setShowAdvancedSpecs] = useState(!isNew);
  const [customAccessory, setCustomAccessory] = useState("");

  const [undoStack, setUndoStack] = useState<WindowItem[]>([]);
  const [redoStack, setRedoStack] = useState<WindowItem[]>([]);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  const lastBlurSnapshotRef = useRef<string>("");
  const lastSavedRef = useRef<string>("");
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    lastBlurSnapshotRef.current = JSON.stringify(localData);
  }, []);

  const handleInputBlur = () => {
    const currentStr = JSON.stringify(localData);
    if (lastBlurSnapshotRef.current !== currentStr) {
      const prevObj = JSON.parse(lastBlurSnapshotRef.current || currentStr);
      setUndoStack(old => [...old.slice(-20), prevObj]);
      setRedoStack([]);
      lastBlurSnapshotRef.current = currentStr;
    }
  };

  const setLocalDataWithHistory = (newVal: WindowItem | ((prev: WindowItem) => WindowItem)) => {
    setLocalData(prev => {
      const next = typeof newVal === "function" ? newVal(prev) : newVal;
      const changed = JSON.stringify(prev) !== JSON.stringify(next);
      if (changed) {
        setUndoStack(old => [...old.slice(-20), prev]);
        setRedoStack([]);
        lastBlurSnapshotRef.current = JSON.stringify(next);
      }
      return next;
    });
  };

  const getAccessoryOptions = (): string[] => {
    const list1 = settings.accessories || [];
    const list2 = (settings.accessoryMaterials || []).map(a => a.name);
    // Combine and remove duplicates
    const combined = Array.from(new Set([...list1, ...list2])).filter(Boolean);
    return combined.length > 0 ? combined : ["สายรวบม่านพู่ไหมเดียว", "ตะขอเกี่ยวกำแพงเหล็กดัด", "โซ่ถ่วงชายม่านเกรดดี"];
  };

  const handleAddAccessory = (name: string) => {
    if (!name) return;
    const current = (localData.accessories || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
    
    if (!current.includes(name)) {
      const updated = [...current, name].join(", ");
      setLocalDataWithHistory(prev => ({
        ...prev,
        accessories: updated
      }));
    }
  };

  const handleRemoveAccessory = (name: string) => {
    const current = (localData.accessories || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
    
    const updated = current.filter(x => x !== name).join(", ");
    setLocalDataWithHistory(prev => ({
      ...prev,
      accessories: updated
    }));
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack(old => old.slice(0, -1));
    setRedoStack(old => [...old, localData]);
    setLocalData(previous);
    lastBlurSnapshotRef.current = JSON.stringify(previous);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(old => old.slice(0, -1));
    setUndoStack(old => [...old, localData]);
    setLocalData(next);
    lastBlurSnapshotRef.current = JSON.stringify(next);
  };

  // Debounced auto-save hook for existing window
  React.useEffect(() => {
    if (isNew || !localData.roomName.trim()) return;

    const currentSerialized = JSON.stringify(localData);
    if (!lastSavedRef.current) {
      lastSavedRef.current = currentSerialized;
      return;
    }

    if (currentSerialized !== lastSavedRef.current) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      setIsAutoSaving(true);
      autoSaveTimeoutRef.current = setTimeout(async () => {
        try {
          const success = await onSave(localData);
          if (success) {
            lastSavedRef.current = currentSerialized;
          }
        } catch (err) {
          console.error("Auto save window failed:", err);
        } finally {
          setIsAutoSaving(false);
        }
      }, 1500);
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [localData, isNew, onSave]);

  // Synchronize external prop updates (like isHidden and orderIndex) into localData
  React.useEffect(() => {
    if (winData) {
      setLocalData(prev => {
        if (prev.isHidden !== winData.isHidden || prev.orderIndex !== winData.orderIndex) {
          return {
            ...prev,
            isHidden: winData.isHidden,
            orderIndex: winData.orderIndex,
          };
        }
        return prev;
      });
    }
  }, [winData]);

  const roomInputRef = useRef<HTMLInputElement>(null);

  // Helper to create solid color data URL if no image base64
  const COLOR_NAME_TO_HEX: Record<string, string> = {
    "LONDON GRAY": "#5a5b5c",
    "CHASSIS GREY": "#4a4b4c",
    "GOLDEN BRONZE": "#a87c43",
    "CHAMPAGNE GOLD": "#e8d3a7",
    "COCOA BROWN": "#5c4033",
    "CREAMY BEIGE": "#ebd9c3",
    "DEEP FOREST GREEN": "#1b4d3e",
    "MIDNIGHT NAVY": "#191970",
    "SAGE MIST": "#9faf9a",
    "WHITE": "#f7f7f7",
    "SOFT CREAM": "#f5f2eb",
    "CREAMY IVORY": "#fffff0",
    "SILVER SHIMMER": "#e2e2e4",
    "SNOW FLAKE": "#fcfcff",
    "NATURAL OAK": "#dfbf9f",
    "MATTE BLACK": "#111111",
    "PURE WHITE": "#ffffff",
    "PLATINUM SILVER": "#e5e4e2",
    "COOL GRAY": "#90a4ae",
    "SAND BEIGE": "#d7ccc8",
    "CHARCOAL BLACK": "#212121",
    "OFF WHITE": "#fafafa",
    "CHARCOAL COAL": "#2b2b2b",
    "IVORY CREAM": "#fdf6e2",
    "CHOCOLATE BROWN": "#3d2314",
    "WARM GREY": "#8a8581"
  };

  const createColorSwatch = (colorOrHex: string): string => {
    try {
      const clean = colorOrHex.trim().toUpperCase();
      const fillStyle = COLOR_NAME_TO_HEX[clean] || (colorOrHex.startsWith("#") ? colorOrHex : "#cbd5e1");
      const canvas = document.createElement("canvas");
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = fillStyle;
        ctx.fillRect(0, 0, 100, 100);
        return canvas.toDataURL("image/png");
      }
    } catch (e) {
      console.error(e);
    }
    return "";
  };

  const selectedStyleObj = (settings.styleMaterials || []).find(s => s.name === localData.style);
  const isBlind = selectedStyleObj?.category === "blind" || localData.style.includes("มู่ลี่") || localData.style.includes("Blind");
  const isRoller = selectedStyleObj?.category === "roller" || localData.style.includes("ม้วน") || localData.style.includes("Roller");

  const getOperationOptionsForStyle = (styleName: string): string[] => {
    const usageOptions = settings.usageTypes || [];
    if (!styleName) return [];
    if (styleName.includes("มู่ลี่") || styleName.includes("Blind")) {
      return ["ปรับเปิด-ปิดใบมู่ลี่", "ยึดตายตัว"];
    }
    if (styleName.includes("ม้วน") || styleName.includes("Roller")) {
      return ["ดึงม้วนขึ้น-ลง", "ยึดตายตัว"];
    }
    return usageOptions.map(u => {
      if (u.includes("แยกกลาง")) return `${styleName} (แยกกลาง)`;
      if (u.includes("เก็บข้างซ้าย") || u.includes("รวบซ้าย")) return `${styleName} (รวบซ้าย)`;
      if (u.includes("เก็บข้างขวา") || u.includes("รวบขวา")) return `${styleName} (รวบขวา)`;
      // Extract what is inside parentheses or clean up
      const parenIndex = u.indexOf("(");
      if (parenIndex !== -1) {
        return `${styleName} ${u.substring(parenIndex)}`;
      }
      return `${styleName} (${u})`;
    });
  };

  const getStyleImageForDoubleLayer = (solidStyle: string, sheerStyleName: string | undefined, isDouble: boolean | undefined) => {
    const list = settings.styleMaterials || [];
    if (isDouble && sheerStyleName && solidStyle !== sheerStyleName) {
      // First try to find style material that contains both styles in its name, e.g. "ม่านลอน / ม่านจีบ" or "ม่านจีบ / ม่านลอน"
      const dualMatch = list.find(x => 
        (x.name.includes(solidStyle) && x.name.includes(sheerStyleName)) ||
        (x.name.includes(sheerStyleName) && x.name.includes(solidStyle))
      );
      if (dualMatch) return dualMatch;
    }
    // Fallback to solid style
    return list.find(x => x.name === solidStyle) || null;
  };

  const handleStyleChange = (styleName: string) => {
    const matched = getStyleImageForDoubleLayer(styleName, localData.sheerStyle, localData.isDoubleLayer);
    const primaryStyleInfo = (settings.styleMaterials || []).find(x => x.name === styleName);
    const styleIsBlind = primaryStyleInfo?.category === "blind" || styleName.includes("มู่ลี่") || styleName.includes("Blind");
    const styleIsRoller = primaryStyleInfo?.category === "roller" || styleName.includes("ม้วน") || styleName.includes("Roller");

    let updatedSolid = localData.solidFabricName;
    let updatedSheer = localData.sheerFabricName;
    let updatedSolidImg = localData.fabricImageBase64;
    let updatedSheerImg = localData.sheerImageBase64;

    if (styleIsBlind) {
      const defaultBlind = settings.blindMaterials?.[0];
      const defaultTape = settings.blindTapeMaterials?.[0];
      if (defaultBlind) {
        updatedSolid = `${defaultBlind.name} / ${defaultBlind.colorName}`;
        updatedSolidImg = defaultBlind.imageBase64 || null;
      }
      if (defaultTape) {
        updatedSheer = `${defaultTape.name} / ${defaultTape.colorName}`;
        updatedSheerImg = defaultTape.imageBase64 || null;
      }
    } else if (styleIsRoller) {
      const defaultRoller = settings.rollerMaterials?.[0];
      if (defaultRoller) {
        updatedSolid = `${defaultRoller.name} / ${defaultRoller.colorName}`;
        updatedSolidImg = defaultRoller.imageBase64 || null;
      }
      updatedSheer = "";
      updatedSheerImg = null;
    } else {
      const defaultSolidCurtain = settings.solidFabricMaterials?.[0];
      const defaultSheerCurtain = settings.sheerFabricMaterials?.[0];
      if (defaultSolidCurtain) {
        updatedSolid = `${defaultSolidCurtain.name} / ${defaultSolidCurtain.colorName}`;
        updatedSolidImg = defaultSolidCurtain.imageBase64 || null;
      }
      if (defaultSheerCurtain) {
        updatedSheer = `${defaultSheerCurtain.name} / ${defaultSheerCurtain.colorName}`;
        updatedSheerImg = defaultSheerCurtain.imageBase64 || null;
      }
    }

    // Smart sync layer1Style and layer2Style for perfect data consistency
    const syncOperationWithStyle = (oldOp: string, newStyle: string, isBlindMode: boolean, isRollerMode: boolean) => {
      if (isBlindMode) return "ปรับเปิด-ปิดใบมู่ลี่";
      if (isRollerMode) return "ดึงม้วนขึ้น-ลง";
      if (!oldOp) return `${newStyle} (แยกกลาง)`;
      
      const parenIndex = oldOp.indexOf("(");
      if (parenIndex !== -1) {
        const suffix = oldOp.substring(parenIndex);
        return `${newStyle} ${suffix}`;
      }
      return `${newStyle} (แยกกลาง)`;
    };

    const updatedLayer1Style = syncOperationWithStyle(localData.layer1Style, styleName, styleIsBlind, styleIsRoller);
    const updatedLayer2Style = syncOperationWithStyle(localData.layer2Style, "ม่านโปร่ง", false, false);

    setLocalDataWithHistory(prev => ({
      ...prev,
      style: styleName,
      styleImageBase64: matched?.imageBase64 || null,
      styleEnForAi: matched?.styleEnForAi || "",
      sheerStyle: styleName, // Sync sheer style to solid style by default
      sheerStyleEnForAi: matched?.styleEnForAi || "",
      solidFabricName: updatedSolid,
      sheerFabricName: updatedSheer,
      fabricImageBase64: updatedSolidImg,
      sheerImageBase64: updatedSheerImg,
      layer1Style: updatedLayer1Style,
      layer2Style: updatedLayer2Style,
    }));
  };

  const handleSheerStyleChange = (styleName: string) => {
    const matched = getStyleImageForDoubleLayer(localData.style, styleName, localData.isDoubleLayer);
    const sheerStyleInfo = (settings.styleMaterials || []).find(x => x.name === styleName);
    setLocalDataWithHistory(prev => ({
      ...prev,
      sheerStyle: styleName,
      sheerStyleEnForAi: sheerStyleInfo?.styleEnForAi || "",
      styleImageBase64: matched?.imageBase64 || prev.styleImageBase64
    }));
  };

  const handleDoubleLayerToggle = (checked: boolean) => {
    const matched = getStyleImageForDoubleLayer(localData.style, localData.sheerStyle, checked);
    setLocalDataWithHistory(prev => ({
      ...prev,
      isDoubleLayer: checked,
      styleImageBase64: matched?.imageBase64 || prev.styleImageBase64,
      styleEnForAi: matched?.styleEnForAi || prev.styleEnForAi
    }));
  };

  const handleHemChange = (hemName: string) => {
    const matched = (settings.hemMaterials || []).find(x => x.name === hemName);
    setLocalDataWithHistory(prev => ({
      ...prev,
      hemStyleText: hemName,
      hemImageBase64: matched?.imageBase64 || null,
      distanceBottom: hemName // Sync distanceBottom to match hemStyleText automatically
    }));
  };

  const handleSolidFabricChange = (fullName: string) => {
    const matched = (settings.solidFabricMaterials || []).find(x => `${x.name} / ${x.colorName}` === fullName);
    const swatch = matched?.imageBase64 || (matched ? createColorSwatch(matched.imageColorHex || matched.colorName) : null);
    
    setLocalDataWithHistory(prev => ({
      ...prev,
      solidFabricName: fullName,
      color: matched ? `${matched.colorName}` : prev.color,
      fabricImageBase64: swatch || null
    }));
  };

  const handleSheerFabricChange = (fullName: string) => {
    const matched = (settings.sheerFabricMaterials || []).find(x => `${x.name} / ${x.colorName}` === fullName);
    const swatch = matched?.imageBase64 || (matched ? createColorSwatch(matched.imageColorHex || matched.colorName) : null);

    setLocalDataWithHistory(prev => ({
      ...prev,
      sheerFabricName: fullName,
      sheerImageBase64: swatch || null
    }));
  };

  const handleBlindFabricChange = (fullName: string) => {
    const matched = (settings.blindMaterials || []).find(x => `${x.name} / ${x.colorName}` === fullName);
    setLocalDataWithHistory(prev => ({
      ...prev,
      solidFabricName: fullName,
      color: matched ? matched.colorName : prev.color,
      fabricImageBase64: matched?.imageBase64 || null
    }));
  };

  const handleBlindTapeChange = (fullName: string) => {
    const matched = (settings.blindTapeMaterials || []).find(x => `${x.name} / ${x.colorName}` === fullName);
    setLocalDataWithHistory(prev => ({
      ...prev,
      sheerFabricName: fullName,
      sheerImageBase64: matched?.imageBase64 || null
    }));
  };

  const handleRollerFabricChange = (fullName: string) => {
    const matched = (settings.rollerMaterials || []).find(x => `${x.name} / ${x.colorName}` === fullName);
    setLocalDataWithHistory(prev => ({
      ...prev,
      solidFabricName: fullName,
      color: matched ? matched.colorName : prev.color,
      fabricImageBase64: matched?.imageBase64 || null
    }));
  };

  // Status message sequence for AI generation to improve UX
  const animateStatusMessages = () => {
    const messages = [
      "กำลังเชื่อมต่อระบบประมวลผลเซิร์ฟเวอร์ AI...",
      "วิเคราะห์โครงสร้างกระจก ประตู และเฟอร์นิเจอร์ในห้องเดิม...",
      "กำหนดมิติต้นแบบการห้อยย้อยของผ้าม่านอย่างเป็นธรรมชาติ...",
      "ปัญญาประดิษฐ์กำลังเย็บสเกลผ้าม่านเข้ามุมโค้งและรางแขวน...",
      "ปรับแต่งเฉดสี ความโปร่งแสง แสงและเงาตามต้องการ...",
    ];
    let step = 0;
    setAiStatusMsg(messages[0]);
    const interval = setInterval(() => {
      step++;
      if (step < messages.length) {
        setAiStatusMsg(messages[step]);
      } else {
        clearInterval(interval);
      }
    }, 4000);
    return interval;
  };

  const handleDragRoom = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActiveRoom(true);
    } else if (e.type === "dragleave") {
      setDragActiveRoom(false);
    }
  };

  const handleDropRoom = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveRoom(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      await loadRoomFile(file);
    }
  };

  const loadRoomFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("กรุณาอัปโหลดรูปภาพเท่านั้น");
      return;
    }
    try {
      const base64 = await downscaleImage(file, 1024, 0.7);
      setLocalData((prev) => ({
        ...prev,
        preImageBase64: base64,
        aiPreviewBase64: null, // Clear old preview if room changed
      }));
    } catch (e) {
      alert("ไม่สามารถอ่านรูปภาพได้");
    }
  };

  const handleGenAI = async () => {
    if (activeEmployeeQuotaExceeded) {
      alert("โควต้าสร้างภาพ AI ของพนักงานท่านนี้เต็มแล้ว กรุณาเพิ่มสิทธิในหน้าตั้งค่า");
      return;
    }
    if (!localData.preImageBase64) {
      alert("กรุณาอัปโหลดภาพหน้างานจริงก่อนทำ AI Preview");
      return;
    }

    // Enforce required specifications before AI Generation
    const missingSpecs: string[] = [];
    if (!localData.layer1Style) missingSpecs.push("รูปแบบการใช้งาน ชั้นที่ 1");
    if (!localData.track1Style) missingSpecs.push("ประเภทรางม่าน ชั้นที่ 1");
    if (localData.isDoubleLayer) {
      if (!localData.layer2Style) missingSpecs.push("รูปแบบการใช้งาน ชั้นที่ 2");
      if (!localData.track2Style) missingSpecs.push("ประเภทรางม่าน ชั้นที่ 2");
    }
    if (!localData.distanceLeft) missingSpecs.push("ระยะเผื่อด้านซ้าย");
    if (!localData.distanceRight) missingSpecs.push("ระยะเผื่อด้านขวา");
    if (!localData.distanceTop) missingSpecs.push("ระยะเผื่อด้านบน");
    if (!localData.distanceBottom) missingSpecs.push("ระยะเผื่อด้านล่าง");

    if (missingSpecs.length > 0) {
      alert(`กรุณากรอกข้อมูลสเปกที่จำเป็นให้ครบถ้วนก่อนสร้างภาพ AI:\n- ${missingSpecs.join("\n- ")}`);
      return;
    }

    setIsGeneratingAI(true);
    setAiError(null);
    const msgInterval = animateStatusMessages();

    try {
      let currentSolid = null;
      let currentSheer = null;

      if (isBlind) {
        currentSolid = (settings.blindMaterials || []).find(
          (x) => `${x.name} / ${x.colorName}` === localData.solidFabricName
        );
        currentSheer = (settings.blindTapeMaterials || []).find(
          (x) => `${x.name} / ${x.colorName}` === localData.sheerFabricName
        );
      } else if (isRoller) {
        currentSolid = (settings.rollerMaterials || []).find(
          (x) => `${x.name} / ${x.colorName}` === localData.solidFabricName
        );
      } else {
        currentSolid = (settings.solidFabricMaterials || []).find(
          (x) => `${x.name} / ${x.colorName}` === localData.solidFabricName
        );
        currentSheer = (settings.sheerFabricMaterials || []).find(
          (x) => `${x.name} / ${x.colorName}` === localData.sheerFabricName
        );
      }

      // Dynamically downscale all images right before posting to prevent HTTP 413 (Payload Too Large) and reduce network overhead.
      // We increase the max width and quality of the fabric/sheer swatches so that Gemini can see fine patterns (like marble veins or linen weave) and replicate them accurately.
      const [scaledRoom, scaledFabric, scaledSheer] = await Promise.all([
        ensureBase64Downscaled(localData.preImageBase64, 1024, 0.7),
        ensureBase64Downscaled(localData.fabricImageBase64, 1024, 0.9),
        ensureBase64Downscaled(localData.sheerImageBase64, 1024, 0.9)
      ]);

      const response = await fetch("/api/gemini/preview-curtain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomImage: scaledRoom,
          fabricImage: scaledFabric,
          sheerImage: scaledSheer,
          style: localData.style,
          styleEnForAi: localData.styleEnForAi || "",
          sheerStyle: localData.sheerStyle || localData.style,
          sheerStyleEnForAi: localData.sheerStyleEnForAi || "",
          pattern: localData.pattern,
          color: localData.color,
          track: localData.track,
          accessories: localData.accessories,
          notes: localData.notes || "",
          isDoubleLayer: localData.isDoubleLayer || false,
          layer1Style: localData.layer1Style,
          layer2Style: localData.layer2Style,
          solidFabricType: currentSolid?.type || "Blackout",
          sheerFabricType: currentSheer?.type || "Sheer",
          isBlind,
          isRoller,
          solidFabricName: localData.solidFabricName,
          sheerFabricName: localData.sheerFabricName,
          customGeminiApiKey: settings.customGeminiApiKey || getDedicatedGeminiApiKey() || undefined,
          distanceLeft: localData.distanceLeft,
          distanceRight: localData.distanceRight,
          distanceTop: localData.distanceTop,
          distanceBottom: localData.distanceBottom,
          hemStyleText: localData.hemStyleText,
        }),
      });

      const responseText = await response.text();
      clearInterval(msgInterval);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        if (response.status === 413) {
          setAiError("รูปภาพมีขนาดใหญ่เกินไปสำหรับส่งขึ้นระบบประมวลผล (413 Payload Too Large) กรุณาใช้รูปที่มีขนาดไฟล์เล็กลง");
        } else if (response.status === 504) {
          setAiError("เซิร์ฟเวอร์ตอบกลับช้าเกินไป (504 Gateway Timeout) กรุณากดลองใหม่อีกครั้ง");
        } else if (response.status === 502) {
          setAiError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ระบบ AI ได้ (502 Bad Gateway) กรุณาตรวจสอบความถูกต้องของ API Key ในแถบตั้งค่า");
        } else {
          setAiError(`เกิดข้อผิดพลาดทางเทคนิคจากระบบ (HTTP ${response.status}): ${responseText.substring(0, 150) || "ไม่สามารถแปลคำตอบจากระบบได้"}`);
        }
        return;
      }

      if (data.success) {
        const updatedLocalData = {
          ...localData,
          aiPreviewBase64: data.imageUrl,
          aiDescription: data.description || "จำลองผ้าม่านด้วย AI เรียบร้อยแล้ว",
        };
        setLocalData(updatedLocalData);
        incrementEmployeeAiUsage();
        setIsGeneratingAI(false);

        // Auto-save generated image & specifications immediately and silently to database/cloud
        try {
          await onSave(updatedLocalData, true);
        } catch (saveErr) {
          console.error("Auto-save of generated AI preview failed:", saveErr);
        }
      } else {
        setAiError(data.message || "เกิดข้อผิดพลาดในการสร้างภาพ");
      }
    } catch (err: any) {
      clearInterval(msgInterval);
      setAiError("เกิดข้อผิดพลาดทางเครือข่าย กรุณาลองใหม่อีกครั้ง: " + (err.message || err));
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSave = async () => {
    if (!localData.roomName.trim()) {
      alert("⚠️ บันทึกไม่สำเร็จ: กรุณากรอกชื่อห้อง / จุดติดตั้ง ก่อนบันทึกข้อมูล");
      return;
    }
    if (!localData.windowCode.trim()) {
      alert("⚠️ บันทึกไม่สำเร็จ: กรุณากรอกรหัสบาน (เช่น W1, W2) ก่อนบันทึกข้อมูล");
      return;
    }
    
    // Validate width and height
    const wVal = parseFloat(localData.width);
    const hVal = parseFloat(localData.height);
    if (isNaN(wVal) || wVal <= 0 || isNaN(hVal) || hVal <= 0) {
      alert("⚠️ บันทึกไม่สำเร็จ: กรุณากรอกขนาดความกว้างและความสูงเป็นตัวเลขจำนวนเต็มบวกที่ถูกต้อง");
      return;
    }

    try {
      const success = await onSave(localData);
      if (!success) {
        alert("❌ บันทึกไม่สำเร็จ: เกิดข้อผิดพลาดของระบบในการเก็บข้อมูล กรุณาลองอีกครั้งในภายหลัง");
      }
    } catch (err: any) {
      alert(`❌ บันทึกไม่สำเร็จ: ${err?.message || "เกิดข้อผิดพลาดในการเข้าถึงฐานข้อมูลจุดติดตั้ง"}`);
    }
  };

  const solidFabricOptions = (settings.solidFabricMaterials || []).map((fb) => {
    const val = `${fb.name} / ${fb.colorName}`;
    const swatch = fb.imageBase64 || createColorSwatch(fb.imageColorHex || fb.colorName);
    return {
      value: val,
      label: `${fb.name} - ${fb.colorName} [${fb.type}]`,
      type: fb.type,
      swatch: swatch || undefined
    };
  });

  const sheerFabricOptions = (settings.sheerFabricMaterials || []).map((fb) => {
    const val = `${fb.name} / ${fb.colorName}`;
    const swatch = fb.imageBase64 || createColorSwatch(fb.imageColorHex || fb.colorName);
    return {
      value: val,
      label: `${fb.name} - ${fb.colorName} [${fb.type}]`,
      type: fb.type,
      swatch: swatch || undefined
    };
  });

  const blindOptions = (settings.blindMaterials || []).map((fb) => {
    const val = `${fb.name} / ${fb.colorName}`;
    return {
      value: val,
      label: `${fb.name} - ${fb.colorName}`,
      type: fb.type,
      swatch: fb.imageBase64 || undefined
    };
  });

  const blindTapeOptions = [
    { value: "", label: "ไม่ใส่เทปผ้า (ด้ายเชือกธรรมดา)" },
    ...(settings.blindTapeMaterials || []).map((fb) => {
      const val = `${fb.name} / ${fb.colorName}`;
      return {
        value: val,
        label: `${fb.name} - ${fb.colorName}`,
        type: fb.type,
        swatch: fb.imageBase64 || undefined
      };
    })
  ];

  const rollerOptions = (settings.rollerMaterials || []).map((fb) => {
    const val = `${fb.name} / ${fb.colorName}`;
    return {
      value: val,
      label: `${fb.name} - ${fb.colorName}`,
      type: fb.type,
      swatch: fb.imageBase64 || undefined
    };
  });

  return (
    <div
      className={`relative p-6 md:p-8 rounded-3xl border-2 transition-all duration-300 ${
        isNew
          ? "border-dashed border-indigo-200 bg-indigo-50/10 hover:border-indigo-400 hover:bg-indigo-50/20"
          : "border-slate-200 bg-white hover:border-indigo-200 hover:shadow-lg hover:shadow-slate-200/40"
      }`}
    >
      {/* Floating Sticky Actions Panel in Top-Right Corner */}
      <div className="sticky top-4 right-4 z-50 flex items-center justify-end pointer-events-none mb-6">
        <div className="bg-white/95 backdrop-blur-md border border-slate-200/80 p-2.5 rounded-2xl shadow-xl flex items-center gap-2 pointer-events-auto transition-all hover:shadow-2xl">
          {/* Auto-save Status Indicator */}
          <div className="px-2 py-1 text-[10px] font-bold flex items-center gap-1.5 text-slate-500">
            {isAutoSaving ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin text-indigo-500" />
                <span className="text-indigo-600">กำลังบันทึก...</span>
              </>
            ) : (
              <>
                <BadgeCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-600">บันทึกออโต้แล้ว</span>
              </>
            )}
          </div>

          <div className="h-4 w-px bg-slate-200"></div>

          {/* Undo Button */}
          <button
            type="button"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="p-1.5 hover:bg-slate-100 rounded-xl disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 transition flex items-center justify-center cursor-pointer"
            title="ย้อนกลับ (Undo)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
          </button>

          {/* Redo Button */}
          <button
            type="button"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="p-1.5 hover:bg-slate-100 rounded-xl disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 transition flex items-center justify-center cursor-pointer"
            title="ทำซ้ำ (Redo)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>
          </button>

          <div className="h-4 w-px bg-slate-200"></div>

          {/* Explicit Save Button */}
          <button
            type="button"
            onClick={handleSave}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black px-4.5 py-2 rounded-xl shadow-md shadow-indigo-600/10 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>บันทึกจุดติดตั้ง</span>
          </button>
        </div>
      </div>

      {/* Title block */}
      <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
        <h4 className="font-extrabold text-slate-800 text-lg flex items-center gap-2">
          {isNew ? (
            <>
              <div className="bg-indigo-100 text-indigo-600 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                +
              </div>
              <div>
                <span>เพิ่มบานหน้าต่าง / จุดติดตั้งใหม่</span>
                <span className="block text-xs text-slate-400 font-normal mt-0.5">ระบุมิติและสเปกของบานเพื่อสร้าง PDF เอกสารสเปก</span>
              </div>
            </>
          ) : (
            <>
              <div className="bg-slate-900 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                {localData.windowCode}
              </div>
              <div>
                <span>จุดติดตั้ง: {localData.roomName || "ระบุห้อง"}</span>
                <span className="block text-xs text-slate-400 font-normal mt-0.5">บานรหัส: {localData.windowCode} | กว้าง {localData.width} x สูง {localData.height} ซม.</span>
              </div>
            </>
          )}
        </h4>

        {!isNew && onDelete && (
          <button
            onClick={() => {
              if (confirm("ลบจุดติดตั้งนี้หรือไม่? ข้อมูลทั้งหมดจะสูญหาย")) {
                onDelete();
              }
            }}
            className="text-slate-400 hover:text-rose-600 p-2.5 hover:bg-rose-50 rounded-xl transition cursor-pointer"
            title="ลบจุดนี้"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-8">
        {/* Core Settings Block */}
        <div className="space-y-5">
          {/* Room Name and Code */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                ชื่อห้อง / จุดติดตั้ง <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={localData.roomName}
                onChange={(e) => setLocalData({ ...localData, roomName: e.target.value })}
                onBlur={handleInputBlur}
                placeholder="เช่น ห้องนอนใหญ่, ห้องนั่งเล่นหลัก"
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                รหัสบาน <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={localData.windowCode}
                onChange={(e) => setLocalData({ ...localData, windowCode: e.target.value })}
                onBlur={handleInputBlur}
                placeholder="เช่น W1, W2"
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-center font-bold"
              />
            </div>
          </div>

          {/* Width and Height */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Ruler className="w-3.5 h-3.5 text-indigo-500" />
                <span>ความกว้างรวม (ซม.)</span>
              </label>
              <input
                type="text"
                value={localData.width}
                onChange={(e) => setLocalData({ ...localData, width: e.target.value })}
                onBlur={handleInputBlur}
                placeholder="เช่น 250"
                className="w-full bg-white border border-slate-200 text-slate-800 text-sm rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Ruler className="w-3.5 h-3.5 text-indigo-500" />
                <span>ความสูงรวม (ซม.)</span>
              </label>
              <input
                type="text"
                value={localData.height}
                onChange={(e) => setLocalData({ ...localData, height: e.target.value })}
                onBlur={handleInputBlur}
                placeholder="เช่น 280"
                className="w-full bg-white border border-slate-200 text-slate-800 text-sm rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition font-semibold"
              />
            </div>
          </div>

          {/* Double Layer Toggle Control */}
          <div className="bg-indigo-50/40 p-4 rounded-2xl border border-indigo-100 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>รูปแบบการติดตั้ง 2 ชั้น (ทึบ + โปร่ง)</span>
              </span>
              <p className="text-[10px] text-slate-400">เมื่อเลือก ระบบจะบังคับปิดโปร่งและรวบม่านทึบเมื่อสั่ง AI</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={localData.isDoubleLayer || false}
                onChange={(e) => handleDoubleLayerToggle(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Custom Swatch Swaps & Names Rows */}
          <div className="space-y-4 border-t border-slate-100 pt-4">
            <h5 className="text-xs font-black text-slate-900 tracking-wide uppercase flex items-center gap-1.5 mb-2">
              <Palette className="w-4 h-4 text-indigo-600" />
              <span>สเปกและสวอชวัสดุจากระบบตั้งค่าฐานข้อมูลกลาง</span>
            </h5>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* รูปแบบผ้าม่าน swatch & name */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-extrabold text-slate-500">รูปแบบผ้าม่าน</span>
                  <select
                    value={localData.style}
                    onChange={(e) => handleStyleChange(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-2 py-1.5 mt-1 focus:ring-2 focus:ring-indigo-500/10 outline-none font-bold cursor-pointer"
                  >
                    {(settings.styleMaterials || []).map((st) => (
                      <option key={st.id} value={st.name}>{st.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* คำสั่ง AI รูปแบบม่านภาษาอังกฤษ */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-extrabold text-slate-500">คำสั่ง AI ภาษาอังกฤษ (English AI Style Prompt)</span>
                  <input
                    type="text"
                    value={localData.styleEnForAi || ""}
                    onChange={(e) => setLocalData({ ...localData, styleEnForAi: e.target.value })}
                    onBlur={handleInputBlur}
                    placeholder="เช่น wave fold curtains, wood blinds, eyelet"
                    className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-2 py-1.5 mt-1 focus:ring-2 focus:ring-indigo-500/10 outline-none font-bold"
                  />
                  <span className="text-[9px] text-slate-400 block mt-1 leading-tight">
                    ระบุสไตล์เป็นภาษาอังกฤษสั่ง AI (ดึงค่าเริ่มต้นอัตโนมัติ)
                  </span>
                </div>
              </div>

              {/* รูปแบบผ้าม่านโปร่ง (แสดงเมื่อเลือกติดตั้ง 2 ชั้น) */}
              {localData.isDoubleLayer && (
                <>
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-indigo-200 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-extrabold text-indigo-700 flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        <span>รูปแบบผ้าม่านโปร่ง (ชั้นใน)</span>
                      </span>
                      <select
                        value={localData.sheerStyle || localData.style}
                        onChange={(e) => handleSheerStyleChange(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-2 py-1.5 mt-1 focus:ring-2 focus:ring-indigo-500/10 outline-none font-bold cursor-pointer"
                      >
                        {(settings.styleMaterials || []).map((st) => (
                          <option key={st.id} value={st.name}>{st.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-indigo-200 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-extrabold text-indigo-700 flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        <span>คำสั่ง AI รูปแบบม่านโปร่งภาษาอังกฤษ</span>
                      </span>
                      <input
                        type="text"
                        value={localData.sheerStyleEnForAi || ""}
                        onChange={(e) => setLocalData({ ...localData, sheerStyleEnForAi: e.target.value })}
                        onBlur={handleInputBlur}
                        placeholder="เช่น wave fold curtains, pinch pleat"
                        className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-2 py-1.5 mt-1 focus:ring-2 focus:ring-indigo-500/10 outline-none font-bold"
                      />
                      <span className="text-[9px] text-slate-400 block mt-1 leading-tight">
                        ระบุสไตล์เป็นภาษาอังกฤษสั่ง AI สำหรับม่านโปร่งโดยเฉพาะ (เช่น ม่านลอน หรือม่านตาไก่)
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* ระยะชายม่าน swatch & name */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-extrabold text-slate-500">ระยะชายม่าน</span>
                  <select
                    value={localData.hemStyleText}
                    onChange={(e) => handleHemChange(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-2 py-1.5 mt-1 focus:ring-2 focus:ring-indigo-500/10 outline-none font-bold cursor-pointer"
                  >
                    {(settings.hemMaterials || []).map((hm) => (
                      <option key={hm.id} value={hm.name}>{hm.name}</option>
                    ))}
                  </select>
                </div>

              </div>

              {isBlind ? (
                <>
                  {/* Blinds Fabric/Material selection */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-extrabold text-slate-500 block mb-1">วัสดุมู่ลี่ / สีใบมู่ลี่</span>
                      <SearchableSelect
                        options={blindOptions}
                        value={localData.solidFabricName}
                        onChange={handleBlindFabricChange}
                        placeholder="ค้นหาวัสดุมู่ลี่..."
                      />
                    </div>
                    {localData.solidFabricName && (
                      <div className="w-12 h-12 rounded-xl border border-slate-200 bg-white overflow-hidden flex items-center justify-center shrink-0 shadow-sm mt-4">
                        {(() => {
                          const swatch = getSolidFabricSwatch(localData.solidFabricName, settings, localData.fabricImageBase64);
                          return swatch ? (
                            <img src={swatch} alt="blind swatch" className="w-full h-full object-cover" />
                          ) : (
                            <div className="text-[9px] text-slate-400">No Img</div>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Blinds Cotton Tape selection */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-extrabold text-slate-500 block mb-1">สีเทปผ้าตกแต่งมู่ลี่</span>
                      <SearchableSelect
                        options={blindTapeOptions}
                        value={localData.sheerFabricName}
                        onChange={handleBlindTapeChange}
                        placeholder="ค้นหาเทปผ้าตกแต่ง..."
                      />
                    </div>
                    {localData.sheerFabricName && (
                      <div className="w-12 h-12 rounded-xl border border-slate-200 bg-white overflow-hidden flex items-center justify-center shrink-0 shadow-sm mt-4">
                        {(() => {
                          const swatch = getSheerFabricSwatch(localData.sheerFabricName, settings, localData.sheerImageBase64);
                          return swatch ? (
                            <img src={swatch} alt="tape swatch" className="w-full h-full object-cover" />
                          ) : (
                            <div className="text-[9px] text-slate-400">No Img</div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </>
              ) : isRoller ? (
                <>
                  {/* Roller Shade Fabric/Material selection */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 flex items-center justify-between gap-3 col-span-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-extrabold text-slate-500 block mb-1">วัสดุม่านม้วน / สีม่านม้วน</span>
                      <SearchableSelect
                        options={rollerOptions}
                        value={localData.solidFabricName}
                        onChange={handleRollerFabricChange}
                        placeholder="ค้นหาวัสดุม่านม้วน..."
                      />
                    </div>
                    {localData.solidFabricName && (
                      <div className="w-12 h-12 rounded-xl border border-slate-200 bg-white overflow-hidden flex items-center justify-center shrink-0 shadow-sm mt-4">
                        {(() => {
                          const swatch = getSolidFabricSwatch(localData.solidFabricName, settings, localData.fabricImageBase64);
                          return swatch ? (
                            <img src={swatch} alt="roller swatch" className="w-full h-full object-cover" />
                          ) : (
                            <div className="text-[9px] text-slate-400">No Img</div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* ผ้าม่านทึบ swatch & name */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-extrabold text-slate-500 block mb-1">ผ้าม่านทึบ (ผ้าหลัก)</span>
                      <SearchableSelect
                        options={solidFabricOptions}
                        value={localData.solidFabricName}
                        onChange={handleSolidFabricChange}
                        placeholder="ค้นหาผ้าม่านทึบ..."
                      />
                    </div>
                    {localData.solidFabricName && (
                      <div className="w-12 h-12 rounded-xl border border-slate-200 bg-white overflow-hidden flex items-center justify-center shrink-0 shadow-sm mt-4">
                        {(() => {
                          const swatch = getSolidFabricSwatch(localData.solidFabricName, settings, localData.fabricImageBase64);
                          return swatch ? (
                            <img src={swatch} alt="solid swatch" className="w-full h-full object-cover" />
                          ) : (
                            <div className="text-[9px] text-slate-400">No Img</div>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* ผ้าม่านโปร่ง swatch & name */}
                  <div className={`bg-slate-50 p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all duration-300 ${
                    localData.isDoubleLayer 
                      ? "opacity-100 border-slate-200/60 scale-100" 
                      : "opacity-40 border-slate-100 scale-95 pointer-events-none"
                  }`}>
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-extrabold text-slate-500 block mb-1">ผ้าม่านโปร่ง (ชั้นใน)</span>
                      <SearchableSelect
                        options={sheerFabricOptions}
                        value={localData.sheerFabricName}
                        onChange={handleSheerFabricChange}
                        placeholder="ค้นหาผ้าม่านโปร่ง..."
                        disabled={!localData.isDoubleLayer}
                      />
                    </div>
                    {localData.isDoubleLayer && localData.sheerFabricName && (
                      <div className="w-12 h-12 rounded-xl border border-slate-200 bg-white overflow-hidden flex items-center justify-center shrink-0 shadow-sm mt-4">
                        {(() => {
                          const swatch = getSheerFabricSwatch(localData.sheerFabricName, settings, localData.sheerImageBase64);
                          return swatch ? (
                            <img src={swatch} alt="sheer swatch" className="w-full h-full object-cover" />
                          ) : (
                            <div className="text-[9px] text-slate-400">No Img</div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Advanced specs toggle collapsible (Moved here so all specs come before AI generation) */}
        <div className="border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => setShowAdvancedSpecs(!showAdvancedSpecs)}
            className="w-full flex items-center justify-between text-slate-700 hover:text-slate-900 font-bold text-xs bg-slate-50 border border-slate-200 px-4 py-3 rounded-2xl cursor-pointer transition"
          >
            <span className="flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-indigo-500" />
              <span>ปรับสเปกการติดตั้งชั้นสูงและระยะรอบม่าน (Advanced PDF Specifications)</span>
            </span>
            {showAdvancedSpecs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showAdvancedSpecs && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 bg-slate-50/40 p-5 rounded-2xl border border-slate-100 animate-fade-in">
              {/* Layers design options */}
              <div className="space-y-4">
                <h6 className="text-[11px] font-black uppercase text-indigo-600 tracking-wider flex items-center gap-1.5 border-b border-indigo-100 pb-1">
                  <Layers className="w-3.5 h-3.5" />
                  <span>สเปกแต่ละชั้นผ้าม่าน (Double Layers Spec)</span>
                </h6>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      ชั้นที่ 1: รูปแบบการใช้งาน (Operation)
                    </label>
                    <select
                      value={localData.layer1Style}
                      required
                      onChange={(e) => setLocalData({ ...localData, layer1Style: e.target.value })}
                      className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold cursor-pointer"
                    >
                      <option value="">-- เลือกรูปแบบการใช้งานชั้นที่ 1 --</option>
                      {getOperationOptionsForStyle(localData.style).map((op) => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      ชั้นที่ 1: ประเภทรางม่าน (Track)
                    </label>
                    <select
                      value={localData.track1Style}
                      required
                      onChange={(e) => setLocalData({ ...localData, track1Style: e.target.value })}
                      className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold cursor-pointer"
                    >
                      <option value="">-- เลือกรางม่านชั้นที่ 1 --</option>
                      {(settings.trackMaterials || []).map((tr) => (
                        <option key={tr.id} value={tr.name}>{tr.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      ชั้นที่ 2: รูปแบบการใช้งาน (Operation - Sheer)
                    </label>
                    <select
                      value={localData.layer2Style}
                      required={localData.isDoubleLayer}
                      onChange={(e) => setLocalData({ ...localData, layer2Style: e.target.value })}
                      className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold cursor-pointer disabled:bg-slate-50 disabled:text-slate-400"
                      disabled={!localData.isDoubleLayer}
                    >
                      <option value="">{localData.isDoubleLayer ? "-- เลือกรูปแบบการใช้งานชั้นที่ 2 --" : "ไม่ได้เปิดใช้งานม่าน 2 ชั้น"}</option>
                      {localData.isDoubleLayer && getOperationOptionsForStyle("ม่านโปร่ง").map((op) => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      ชั้นที่ 2: ประเภทรางม่าน (Track - Sheer)
                    </label>
                    <select
                      value={localData.track2Style}
                      required={localData.isDoubleLayer}
                      onChange={(e) => setLocalData({ ...localData, track2Style: e.target.value })}
                      className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold cursor-pointer disabled:bg-slate-50 disabled:text-slate-400"
                      disabled={!localData.isDoubleLayer}
                    >
                      <option value="">{localData.isDoubleLayer ? "-- เลือกรางม่านชั้นที่ 2 --" : "ไม่ได้เปิดใช้งานม่าน 2 ชั้น"}</option>
                      {(settings.trackMaterials || []).map((tr) => (
                        <option key={tr.id} value={tr.name}>{tr.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      การยึดติดตั้งรางม่าน (Mounting)
                    </label>
                    <select
                      value={localData.mountingType}
                      required
                      onChange={(e) => setLocalData({ ...localData, mountingType: e.target.value })}
                      className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold cursor-pointer"
                    >
                      <option value="">-- เลือกวิธีการยึดติดตั้ง --</option>
                      <option value="ติดผนัง (Wall Mount)">ติดผนัง (Wall Mount)</option>
                      <option value="ติดเพดาน (Ceiling Mount)">ติดเพดาน (Ceiling Mount)</option>
                      <option value="ซ่อนในกล่องม่าน (Cove Mount)">ซ่อนในกล่องม่าน (Cove Mount)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      รูปแบบการแขวนม่าน (Hanging Type)
                    </label>
                    <select
                      value={localData.hangingType}
                      required
                      onChange={(e) => setLocalData({ ...localData, hangingType: e.target.value })}
                      className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold cursor-pointer"
                    >
                      <option value="">-- เลือกรูปแบบการแขวนม่าน --</option>
                      {(settings.hangingTypes || []).map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    อุปกรณ์เสริมพ่วงติดตั้ง (Accessories) <span className="text-[9px] text-slate-400 font-normal lowercase">(เลือกจากรายการ หรือเพิ่มเองได้)</span>
                  </label>
                  
                  {/* Dropdown to select predefined options */}
                  <div className="flex gap-2">
                    <select
                      onChange={(e) => {
                        handleAddAccessory(e.target.value);
                        e.target.value = ""; // reset selection
                      }}
                      className="flex-1 bg-white border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer font-bold"
                    >
                      <option value="">-- เลือกรายการอุปกรณ์เสริมพ่วงติดตั้ง --</option>
                      {getAccessoryOptions().map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>

                    {/* Quick custom addition input */}
                    <div className="flex gap-1.5 shrink-0 w-1/3">
                      <input
                        type="text"
                        value={customAccessory}
                        onChange={(e) => setCustomAccessory(e.target.value)}
                        placeholder="พิมพ์เพิ่มเอง..."
                        className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none font-semibold"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const trimmed = customAccessory.trim();
                            if (trimmed) {
                              handleAddAccessory(trimmed);
                              setCustomAccessory("");
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const trimmed = customAccessory.trim();
                          if (trimmed) {
                            handleAddAccessory(trimmed);
                            setCustomAccessory("");
                          }
                        }}
                        className="bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 font-black text-xs px-3 rounded-xl transition cursor-pointer shrink-0"
                      >
                        + เพิ่ม
                      </button>
                    </div>
                  </div>

                  {/* Selected items pills/tags display */}
                  <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200/60 rounded-xl min-h-[38px]">
                    {(localData.accessories || "")
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean).length === 0 ? (
                      <span className="text-[10px] text-slate-400 font-bold italic p-1">ยังไม่มีอุปกรณ์เสริมที่เลือก</span>
                    ) : (
                      (localData.accessories || "")
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .map((item, tagIdx) => (
                          <div
                            key={tagIdx}
                            className="inline-flex items-center gap-1 bg-white border border-slate-200 text-slate-700 text-[10px] font-extrabold px-2 py-1 rounded-lg shadow-sm"
                          >
                            <span>{item}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveAccessory(item)}
                              className="text-slate-400 hover:text-rose-600 transition p-0.5"
                              title="ลบออก"
                            >
                              <X className="w-3 h-3 stroke-[3]" />
                            </button>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>

              {/* Clearance & Offset spacing offsets */}
              <div className="space-y-4">
                <h6 className="text-[11px] font-black uppercase text-indigo-600 tracking-wider flex items-center gap-1.5 border-b border-indigo-100 pb-1">
                  <Ruler className="w-3.5 h-3.5" />
                  <span>ระยะม่านและชายผ้า (Hem offset spacing)</span>
                </h6>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      ระยะม่าน: ด้านซ้าย <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <select
                      value={localData.distanceLeft}
                      required
                      onChange={(e) => setLocalData({ ...localData, distanceLeft: e.target.value })}
                      className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold cursor-pointer"
                    >
                      <option value="">-- เลือกระยะด้านซ้าย --</option>
                      {(settings.clearanceOptions || []).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      ระยะม่าน: ด้านขวา <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <select
                      value={localData.distanceRight}
                      required
                      onChange={(e) => setLocalData({ ...localData, distanceRight: e.target.value })}
                      className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold cursor-pointer"
                    >
                      <option value="">-- เลือกระยะด้านขวา --</option>
                      {(settings.clearanceOptions || []).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      ระยะม่าน: ด้านบน <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <select
                      value={localData.distanceTop}
                      required
                      onChange={(e) => setLocalData({ ...localData, distanceTop: e.target.value })}
                      className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold cursor-pointer"
                    >
                      <option value="">-- เลือกระยะด้านบน --</option>
                      {((settings.clearanceTopOptions && settings.clearanceTopOptions.length > 0)
                        ? settings.clearanceTopOptions
                        : (settings.clearanceOptions || [])
                      ).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      ระยะม่าน: ด้านล่าง <span className="text-slate-500 font-bold">(ยึดตามระยะชายม่าน)</span>
                    </label>
                    <div className="w-full bg-slate-50 border border-slate-200 text-slate-500 text-xs rounded-lg px-3 py-2.5 font-bold">
                      {localData.hemStyleText || "พอดีพื้น"}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    <span>หมายเหตุเพิ่มเติมสำหรับบานนี้ (Notes spec)</span>
                  </label>
                  <textarea
                    value={localData.notes}
                    onChange={(e) => setLocalData({ ...localData, notes: e.target.value })}
                    onBlur={handleInputBlur}
                    placeholder="เช่น มู่ลี่อะลูมิเนียมเดิมถอนเปลี่ยนใหม่, ต้องใช้ลิฟต์ยกสูงกรณีฝ้าโถงวัดสูง 5 เมตร"
                    className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none h-14 resize-none"
                  ></textarea>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Media & AI preview Column */}
        <div className="space-y-6">
          {/* Room photo upload */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Upload className="w-3.5 h-3.5 text-indigo-500" />
              <span>รูปถ่ายหน้างานจริงก่อนติดตั้ง (Before) <span className="text-rose-500">*</span></span>
            </label>
            <div
              onDragEnter={handleDragRoom}
              onDragOver={handleDragRoom}
              onDragLeave={handleDragRoom}
              onDrop={handleDropRoom}
              onClick={() => roomInputRef.current?.click()}
              className={`relative group rounded-2xl border-2 transition-all flex flex-col items-center justify-center text-center p-4 cursor-pointer overflow-hidden aspect-[4/3] ${
                localData.preImageBase64
                  ? "border-slate-200 bg-slate-50"
                  : dragActiveRoom
                  ? "border-indigo-500 bg-indigo-50/40 scale-95"
                  : "border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400"
              }`}
            >
              {localData.preImageBase64 ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <img
                    src={localData.preImageBase64}
                    alt="Room"
                    className="max-w-full max-h-full object-contain rounded-xl"
                  />
                  <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition duration-200 flex items-center justify-center rounded-xl">
                    <span className="text-xs text-white font-bold bg-indigo-600 px-4 py-2 rounded-xl shadow-lg">
                      เปลี่ยนรูปถ่าย
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="bg-white rounded-2xl shadow border border-slate-200/80 p-3 w-12 h-12 flex items-center justify-center mx-auto text-slate-500">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-slate-700 block">ลากหรือคลิกเพื่ออัปโหลดภาพถ่ายห้อง</span>
                  <span className="text-[10px] text-slate-400 block leading-tight">
                    รองรับ JPG, PNG (สเกลดรอปดาวน์ให้ AI วิเคราะห์)
                  </span>
                </div>
              )}
              <input
                type="file"
                ref={roomInputRef}
                onChange={(e) => e.target.files?.[0] && loadRoomFile(e.target.files[0])}
                className="hidden"
                accept="image/*"
              />
            </div>
          </div>

          {/* Curtain Drawing Workspace & Specifications (Moved before AI Preview) */}
          {localData.preImageBase64 && (
            <div className="border-t border-slate-100 pt-5">
              <CurtainAreaDrawer
                preImageBase64={localData.preImageBase64}
                areas={localData.areas || []}
                onAreasChange={(updatedAreas) => {
                  setLocalData((prev) => ({ ...prev, areas: updatedAreas }));
                }}
                activeAreaId={activeAreaId}
                onActiveAreaChange={setActiveAreaId}
                defaultWidth={localData.width}
                defaultHeight={localData.height}
                parentSolidFabricName={localData.solidFabricName || ""}
                parentSheerFabricName={localData.sheerFabricName || ""}
                isDoubleLayer={!!localData.isDoubleLayer}
                parentStyle={localData.style || ""}
                parentHemStyleText={localData.hemStyleText || ""}
                parentLayer1Style={localData.layer1Style || ""}
                parentLayer2Style={localData.layer2Style || ""}
                parentTrack1Style={localData.track1Style || ""}
                parentTrack2Style={localData.track2Style || ""}
                parentMountingType={localData.mountingType || ""}
                parentHangingType={localData.hangingType || ""}
                parentDistanceLeft={localData.distanceLeft || ""}
                parentDistanceRight={localData.distanceRight || ""}
                parentDistanceTop={localData.distanceTop || ""}
                parentDistanceBottom={localData.distanceBottom || ""}
                parentAccessories={localData.accessories || ""}
                settings={settings}
              />
            </div>
          )}

          {/* AI Simulation preview */}
          <div className="space-y-2 border-t border-slate-100 pt-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>ภาพตัวอย่างติดตั้งจำลองโดย AI (After)</span>
              </span>

              <button
                type="button"
                onClick={handleGenAI}
                disabled={!localData.preImageBase64 || isGeneratingAI || activeEmployeeQuotaExceeded}
                className="bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 hover:from-indigo-600 hover:via-purple-700 hover:to-pink-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg shadow-indigo-500/20 transition-all duration-300 disabled:opacity-40 disabled:shadow-none flex items-center gap-1.5 cursor-pointer animate-pulse"
              >
                {isGeneratingAI ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>{isGeneratingAI ? "กำลังวิเคราะห์สร้างม่าน..." : "จำลองภาพด้วย AI"}</span>
              </button>
            </div>

            {localData.aiPreviewBase64 ? (
              <div className="relative rounded-2xl border border-indigo-100 overflow-hidden aspect-[4/3] bg-slate-950 flex items-center justify-center shadow-lg group animate-fade-in">
                <img
                  src={localData.aiPreviewBase64}
                  alt="AI Preview"
                  className="max-w-full max-h-full object-contain"
                />
                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition duration-300 flex flex-col items-center justify-center gap-3">
                  <button 
                    type="button"
                    onClick={() => {
                      if (confirm("ต้องการอัปโหลดรูปภาพจำลองแมนนวลหรือเปลี่ยนใหม่หรือไม่?")) {
                        // Let user manually upload/overwrite the AI preview if they want to load their own simulated image
                        const fileInput = document.createElement("input");
                        fileInput.type = "file";
                        fileInput.accept = "image/*";
                        fileInput.onchange = async (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) {
                            const base64 = await downscaleImage(file, 1024, 0.7);
                            setLocalData(prev => ({ ...prev, aiPreviewBase64: base64 }));
                          }
                        };
                        fileInput.click();
                      }
                    }}
                    className="bg-white/95 text-slate-800 text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg hover:bg-white transition cursor-pointer"
                  >
                    อัปโหลดภาพจำลองเอง / เปลี่ยนรูป
                  </button>

                  <a
                    href={localData.aiPreviewBase64}
                    download={`AI-Simulation-${localData.roomName || "window"}-${localData.windowCode || "W"}.png`}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg transition duration-300 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>ดาวน์โหลดรูปจำลองนี้</span>
                  </a>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-slate-950/85 backdrop-blur-sm text-white px-4 py-2.5 text-[11px] leading-relaxed flex items-center gap-2">
                  <BadgeCheck className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
                  <span className="font-medium truncate">{localData.aiDescription}</span>
                </div>
              </div>
            ) : isGeneratingAI ? (
              <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/5 p-6 flex flex-col items-center justify-center text-center aspect-[4/3] shadow-inner animate-pulse">
                <div className="w-12 h-12 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin flex items-center justify-center mb-4"></div>
                <h5 className="font-bold text-slate-700 text-sm">{aiStatusMsg}</h5>
                <p className="text-slate-400 text-xs mt-1 max-w-xs">
                  ขั้นตอนนี้จำลองสเกลผ้าม่านแบบ 3D perspective ของมิติห้อง
                </p>
              </div>
            ) : (
              <div 
                onClick={() => {
                  // Allow clicking placeholder to manually upload simulated photo
                  const fileInput = document.createElement("input");
                  fileInput.type = "file";
                  fileInput.accept = "image/*";
                  fileInput.onchange = async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                      const base64 = await downscaleImage(file, 1024, 0.7);
                      setLocalData(prev => ({ ...prev, aiPreviewBase64: base64, aiDescription: "อัปโหลดภาพจำลองแล้ว" }));
                    }
                  };
                  fileInput.click();
                }}
                className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 flex flex-col items-center justify-center text-center aspect-[4/3] hover:bg-slate-100/70 border-indigo-200 cursor-pointer transition"
              >
                <Sparkles className="w-10 h-10 text-indigo-300 mb-2" />
                <span className="text-xs text-slate-500 font-medium px-4">
                  กดปุ่ม <strong>"จำลองภาพด้วย AI"</strong> ด้านบน หรือคลิกบล็อกนี้เพื่อ <strong>อัปโหลดภาพผลลัพธ์ติดตั้งด้วยตนเอง</strong>
                </span>
                <p className="text-[10px] text-slate-400 mt-2 max-w-[300px]">
                  *ภาพนี้จะถูกพิมพ์ลงในใบสรุปการติดตั้งผ้าม่าน PDF เป็น ภาพหน้างานหลังติดตั้ง (After)
                </p>
              </div>
            )}

            {aiError && (
              <div className="bg-rose-50 border border-rose-100 text-rose-700 px-4 py-3 rounded-xl text-xs flex items-start gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{aiError}</span>
              </div>
            )}
          </div>
        </div>
      </div>


      <div className="mt-8 pt-5 border-t border-slate-100 flex justify-end gap-3">
        <button
          onClick={handleSave}
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-3.5 px-8 rounded-xl transition flex items-center gap-2 shadow-lg shadow-slate-900/15 cursor-pointer"
        >
          <BadgeCheck className="w-4 h-4" />
          <span>{isNew ? "เพิ่มจุดติดตั้งนี้" : "บันทึกการเปลี่ยนแปลงจุดนี้"}</span>
        </button>
      </div>
    </div>
  );
};
