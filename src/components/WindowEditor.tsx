import React, { useState, useRef } from "react";
import { Upload, Palette, Sparkles, AlertCircle, RefreshCw, BadgeCheck, X, Ruler, Layers, ChevronDown, ChevronUp, Sliders, FileText, Eye } from "lucide-react";
import { WindowItem, Settings } from "../types";
import { generateId } from "../lib/storage";
import { CurtainAreaDrawer } from "./CurtainAreaDrawer";

interface WindowEditorProps {
  winData?: WindowItem;
  index: number;
  isNew?: boolean;
  jobId: string;
  settings: Settings;
  onSave: (window: WindowItem) => Promise<boolean>;
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
      distanceLeft: base.distanceLeft || "พอดีเฟรม",
      distanceRight: base.distanceRight || "พอดีเฟรม",
      distanceTop: base.distanceTop || "ติดเพดาน",
      distanceBottom: base.distanceBottom || "พอดีพื้น",
      notes: base.notes || "",
      isDoubleLayer: base.isDoubleLayer !== undefined ? base.isDoubleLayer : false,
      styleImageBase64: base.styleImageBase64 || null,
      sheerImageBase64: base.sheerImageBase64 || null,
      hemImageBase64: base.hemImageBase64 || null,
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

  const roomInputRef = useRef<HTMLInputElement>(null);

  // Helper to create solid color data URL if no image base64
  const createColorSwatch = (hex: string): string => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = hex;
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

  const handleStyleChange = (styleName: string) => {
    const matched = (settings.styleMaterials || []).find(x => x.name === styleName);
    const styleIsBlind = matched?.category === "blind" || styleName.includes("มู่ลี่") || styleName.includes("Blind");
    const styleIsRoller = matched?.category === "roller" || styleName.includes("ม้วน") || styleName.includes("Roller");

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

    setLocalData(prev => ({
      ...prev,
      style: styleName,
      styleImageBase64: matched?.imageBase64 || null,
      solidFabricName: updatedSolid,
      sheerFabricName: updatedSheer,
      fabricImageBase64: updatedSolidImg,
      sheerImageBase64: updatedSheerImg,
    }));
  };

  const handleHemChange = (hemName: string) => {
    const matched = (settings.hemMaterials || []).find(x => x.name === hemName);
    setLocalData(prev => ({
      ...prev,
      hemStyleText: hemName,
      hemImageBase64: matched?.imageBase64 || null
    }));
  };

  const handleSolidFabricChange = (fullName: string) => {
    const matched = (settings.solidFabricMaterials || []).find(x => `${x.name} / ${x.colorName}` === fullName);
    const swatch = matched?.imageBase64 || (matched ? createColorSwatch(matched.imageColorHex) : null);
    
    setLocalData(prev => ({
      ...prev,
      solidFabricName: fullName,
      color: matched ? `${matched.colorName}` : prev.color,
      fabricImageBase64: swatch || null
    }));
  };

  const handleSheerFabricChange = (fullName: string) => {
    const matched = (settings.sheerFabricMaterials || []).find(x => `${x.name} / ${x.colorName}` === fullName);
    const swatch = matched?.imageBase64 || (matched ? createColorSwatch(matched.imageColorHex) : null);

    setLocalData(prev => ({
      ...prev,
      sheerFabricName: fullName,
      sheerImageBase64: swatch || null
    }));
  };

  const handleBlindFabricChange = (fullName: string) => {
    const matched = (settings.blindMaterials || []).find(x => `${x.name} / ${x.colorName}` === fullName);
    setLocalData(prev => ({
      ...prev,
      solidFabricName: fullName,
      color: matched ? matched.colorName : prev.color,
      fabricImageBase64: matched?.imageBase64 || null
    }));
  };

  const handleBlindTapeChange = (fullName: string) => {
    const matched = (settings.blindTapeMaterials || []).find(x => `${x.name} / ${x.colorName}` === fullName);
    setLocalData(prev => ({
      ...prev,
      sheerFabricName: fullName,
      sheerImageBase64: matched?.imageBase64 || null
    }));
  };

  const handleRollerFabricChange = (fullName: string) => {
    const matched = (settings.rollerMaterials || []).find(x => `${x.name} / ${x.colorName}` === fullName);
    setLocalData(prev => ({
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

      const response = await fetch("/api/gemini/preview-curtain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomImage: localData.preImageBase64,
          fabricImage: localData.fabricImageBase64,
          sheerImage: localData.sheerImageBase64,
          style: localData.style,
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
          customGeminiApiKey: settings.customGeminiApiKey,
        }),
      });

      const data = await response.json();
      clearInterval(msgInterval);

      if (data.success) {
        setLocalData((prev) => ({
          ...prev,
          aiPreviewBase64: data.imageUrl,
          aiDescription: data.description || "จำลองผ้าม่านด้วย AI เรียบร้อยแล้ว",
        }));
        incrementEmployeeAiUsage();
      } else {
        setAiError(data.message || "เกิดข้อผิดพลาดในการสร้างภาพ");
      }
    } catch (err: any) {
      clearInterval(msgInterval);
      setAiError("เกิดข้อผิดพลาดทางเครือข่าย กรุณาลองใหม่อีกครั้ง");
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
      if (success) {
        if (isNew) {
          alert(`🎉 สำเร็จ: เพิ่มจุดติดตั้งใหม่ "${localData.roomName}" (บานรหัส ${localData.windowCode}) เรียบร้อยแล้ว!`);
          
          const defaultStyle = settings.styleMaterials?.[0]?.name || "ม่านจีบ";
          const defaultSolidFabric = settings.solidFabricMaterials?.[0]
            ? `${settings.solidFabricMaterials[0].name} / ${settings.solidFabricMaterials[0].colorName}`
            : "CITADEL / LONDON GRAY";
          const defaultSheerFabric = settings.sheerFabricMaterials?.[0]
            ? `${settings.sheerFabricMaterials[0].name} / ${settings.sheerFabricMaterials[0].colorName}`
            : "AFFINITY / WHITE";
          const defaultHem = settings.hemMaterials?.[0]?.name || "พอดีพื้น";

          // Reset state for next item
          setLocalData({
            id: generateId(),
            jobId,
            roomName: "",
            windowCode: `W${index + 1}`,
            width: "250",
            height: "280",
            style: defaultStyle,
            pattern: settings.patterns[0] || "",
            color: "เทาอมดำ",
            track: settings.tracks[0] || "รางม่านจีบ",
            accessories: settings.accessories[0] || "ตะขอสายรวบม่าน สีเงิน, ด้ามจูงอะคลิลิก ยาว 150 ซม.",
            solidFabricName: defaultSolidFabric,
            sheerFabricName: defaultSheerFabric,
            hemStyleText: defaultHem,
            layer1Style: "ม่านจีบ (แยกกลาง)",
            layer2Style: "ม่านจีบ (แยกกลาง)",
            track1Style: "รางม่านจีบ",
            track2Style: "รางม่านจีบ",
            mountingType: "ติดเพดาน",
            hangingType: "หัวผ้าม่านแขวนปิดรางม่าน",
            distanceLeft: "พอดีเฟรม",
            distanceRight: "พอดีเฟรม",
            distanceTop: "ติดเพดาน",
            distanceBottom: "พอดีพื้น",
            notes: "",
            isDoubleLayer: false,
            preImageBase64: null,
            fabricImageBase64: null,
            sheerImageBase64: null,
            styleImageBase64: null,
            hemImageBase64: null,
            aiPreviewBase64: null,
            aiDescription: "",
          });
        } else {
          alert(`🎉 สำเร็จ: บันทึกข้อมูลการเปลี่ยนแปลงสำหรับ "${localData.roomName}" (บานรหัส ${localData.windowCode}) เรียบร้อยแล้ว`);
        }
      } else {
        alert("❌ บันทึกไม่สำเร็จ: เกิดข้อผิดพลาดของระบบในการเก็บข้อมูล กรุณาลองอีกครั้งในภายหลัง");
      }
    } catch (err: any) {
      alert(`❌ บันทึกไม่สำเร็จ: ${err?.message || "เกิดข้อผิดพลาดในการเข้าถึงฐานข้อมูลจุดติดตั้ง"}`);
    }
  };

  return (
    <div
      className={`p-6 md:p-8 rounded-3xl border-2 transition-all duration-300 ${
        isNew
          ? "border-dashed border-indigo-200 bg-indigo-50/10 hover:border-indigo-400 hover:bg-indigo-50/20"
          : "border-slate-200 bg-white hover:border-indigo-200 hover:shadow-lg hover:shadow-slate-200/40"
      }`}
    >
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
                onChange={(e) => setLocalData({ ...localData, isDoubleLayer: e.target.checked })}
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
                <div className="mt-2.5 border border-slate-200 rounded-xl aspect-video flex items-center justify-center bg-white overflow-hidden shrink-0 relative group">
                  {localData.styleImageBase64 ? (
                    <img src={localData.styleImageBase64} alt="style" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-[9px] text-slate-400 font-bold p-1">
                      <Layers className="w-5 h-5 text-slate-300 mb-1" />
                      <span>ไม่มีรูปภาพตัวอย่าง</span>
                    </div>
                  )}
                </div>
              </div>

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
                <div className="mt-2.5 border border-slate-200 rounded-xl aspect-video flex items-center justify-center bg-white overflow-hidden shrink-0 relative group">
                  {localData.hemImageBase64 ? (
                    <img src={localData.hemImageBase64} alt="hem" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-[9px] text-slate-400 font-bold p-1">
                      <Ruler className="w-5 h-5 text-slate-300 mb-1" />
                      <span>ไม่มีรูปภาพตัวอย่าง</span>
                    </div>
                  )}
                </div>
              </div>

              {isBlind ? (
                <>
                  {/* Blinds Fabric/Material selection */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-extrabold text-slate-500">วัสดุมู่ลี่ / สีใบมู่ลี่</span>
                      <select
                        value={localData.solidFabricName}
                        onChange={(e) => handleBlindFabricChange(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-2 py-1.5 mt-1 focus:ring-2 focus:ring-indigo-500/10 outline-none font-bold cursor-pointer"
                      >
                        {(settings.blindMaterials || []).map((fb) => {
                          const val = `${fb.name} / ${fb.colorName}`;
                          return (
                            <option key={fb.id} value={val}>
                              {fb.name} - {fb.colorName}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div className="mt-2.5 border border-slate-200 rounded-xl aspect-video flex items-center justify-center bg-white overflow-hidden shrink-0 relative">
                      {localData.fabricImageBase64 ? (
                        <img src={localData.fabricImageBase64} alt="blind" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-[9px] text-slate-400 font-bold p-1">
                          <Palette className="w-5 h-5 text-slate-300 mb-1" />
                          <span>ไม่มีรูปภาพตัวอย่าง</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Blinds Cotton Tape selection */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-extrabold text-slate-500">สีเทปผ้าตกแต่งมู่ลี่</span>
                      <select
                        value={localData.sheerFabricName}
                        onChange={(e) => handleBlindTapeChange(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-2 py-1.5 mt-1 focus:ring-2 focus:ring-indigo-500/10 outline-none font-bold cursor-pointer"
                      >
                        <option value="">ไม่ใส่เทปผ้า (ด้ายเชือกธรรมดา)</option>
                        {(settings.blindTapeMaterials || []).map((fb) => {
                          const val = `${fb.name} / ${fb.colorName}`;
                          return (
                            <option key={fb.id} value={val}>
                              {fb.name} - {fb.colorName}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div className="mt-2.5 border border-slate-200 rounded-xl aspect-video flex items-center justify-center bg-white overflow-hidden shrink-0 relative">
                      {localData.sheerImageBase64 ? (
                        <img src={localData.sheerImageBase64} alt="tape" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-[9px] text-slate-400 font-bold p-1">
                          <Palette className="w-5 h-5 text-slate-300 mb-1" />
                          <span>ด้ายเชือกธรรมดา</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : isRoller ? (
                <>
                  {/* Roller Shade Fabric/Material selection */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 flex flex-col justify-between col-span-2">
                    <div>
                      <span className="text-[11px] font-extrabold text-slate-500">วัสดุม่านม้วน / สีม่านม้วน</span>
                      <select
                        value={localData.solidFabricName}
                        onChange={(e) => handleRollerFabricChange(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-2 py-1.5 mt-1 focus:ring-2 focus:ring-indigo-500/10 outline-none font-bold cursor-pointer"
                      >
                        {(settings.rollerMaterials || []).map((fb) => {
                          const val = `${fb.name} / ${fb.colorName}`;
                          return (
                            <option key={fb.id} value={val}>
                              {fb.name} - {fb.colorName}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div className="mt-2.5 border border-slate-200 rounded-xl aspect-[3/1] flex items-center justify-center bg-white overflow-hidden shrink-0 relative">
                      {localData.fabricImageBase64 ? (
                        <img src={localData.fabricImageBase64} alt="roller" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-[9px] text-slate-400 font-bold p-1">
                          <Palette className="w-5 h-5 text-slate-300 mb-1" />
                          <span>ไม่มีรูปภาพตัวอย่าง</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* ผ้าม่านทึบ swatch & name */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-extrabold text-slate-500">ผ้าม่านทึบ (ผ้าหลัก)</span>
                      <select
                        value={localData.solidFabricName}
                        onChange={(e) => handleSolidFabricChange(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-2 py-1.5 mt-1 focus:ring-2 focus:ring-indigo-500/10 outline-none font-bold cursor-pointer"
                      >
                        {(settings.solidFabricMaterials || []).map((fb) => {
                          const val = `${fb.name} / ${fb.colorName}`;
                          return (
                            <option key={fb.id} value={val}>
                              {fb.name} - {fb.colorName} [{fb.type}]
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div className="mt-2.5 border border-slate-200 rounded-xl aspect-video flex items-center justify-center bg-white overflow-hidden shrink-0 relative">
                      {localData.fabricImageBase64 ? (
                        <img src={localData.fabricImageBase64} alt="fabric" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-[9px] text-slate-400 font-bold p-1">
                          <Palette className="w-5 h-5 text-slate-300 mb-1" />
                          <span>ไม่มีรูปภาพตัวอย่าง</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ผ้าม่านโปร่ง swatch & name */}
                  <div className={`bg-slate-50 p-3.5 rounded-2xl border flex flex-col justify-between transition-all duration-300 ${
                    localData.isDoubleLayer 
                      ? "opacity-100 border-slate-200/60 scale-100" 
                      : "opacity-40 border-slate-100 scale-95 pointer-events-none"
                  }`}>
                    <div>
                      <span className="text-[11px] font-extrabold text-slate-500">ผ้าม่านโปร่ง (ชั้นใน)</span>
                      <select
                        value={localData.sheerFabricName}
                        disabled={!localData.isDoubleLayer}
                        onChange={(e) => handleSheerFabricChange(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-2 py-1.5 mt-1 focus:ring-2 focus:ring-indigo-500/10 outline-none font-bold cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        {(settings.sheerFabricMaterials || []).map((fb) => {
                          const val = `${fb.name} / ${fb.colorName}`;
                          return (
                            <option key={fb.id} value={val}>
                              {fb.name} - {fb.colorName} [{fb.type}]
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div className="mt-2.5 border border-slate-200 rounded-xl aspect-video flex items-center justify-center bg-white overflow-hidden shrink-0 relative">
                      {localData.isDoubleLayer && localData.sheerImageBase64 ? (
                        <img src={localData.sheerImageBase64} alt="sheer" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-[9px] text-slate-400 font-bold p-1">
                          <Eye className="w-5 h-5 text-slate-300 mb-1" />
                          <span>{localData.isDoubleLayer ? "ไม่มีรูปภาพตัวอย่าง" : "ปิดการติดตั้ง 2 ชั้น"}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
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
                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <button 
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
                    className="bg-white/95 text-slate-800 text-xs font-bold px-3 py-2 rounded-lg shadow cursor-pointer"
                  >
                    อัปโหลดภาพจำลองเอง / เคลียร์ใหม่
                  </button>
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
                  *ภาพนี้จะถูกพิมพ์ลงในใบเสนอราคา PDF เป็น ภาพหน้างานหลังติดตั้ง (After)
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

      {/* Advanced specs toggle collapsible */}
      <div className="mt-6 border-t border-slate-100 pt-4">
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
                    ชั้นที่ 1: รูปแบบ
                  </label>
                  <input
                    type="text"
                    value={localData.layer1Style}
                    onChange={(e) => setLocalData({ ...localData, layer1Style: e.target.value })}
                    className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    placeholder="เช่น ม่านจีบ (แยกกลาง)"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    ชั้นที่ 1: รางม่าน
                  </label>
                  <input
                    type="text"
                    value={localData.track1Style}
                    onChange={(e) => setLocalData({ ...localData, track1Style: e.target.value })}
                    className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    placeholder="เช่น รางม่านจีบ"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    ชั้นที่ 2: รูปแบบ
                  </label>
                  <input
                    type="text"
                    value={localData.layer2Style}
                    onChange={(e) => setLocalData({ ...localData, layer2Style: e.target.value })}
                    className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    placeholder="เช่น ม่านโปร่ง (แยกกลาง)"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    ชั้นที่ 2: รางม่าน
                  </label>
                  <input
                    type="text"
                    value={localData.track2Style}
                    onChange={(e) => setLocalData({ ...localData, track2Style: e.target.value })}
                    className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    placeholder="เช่น รางม่านจีบ"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    การยึดติด (Mounting)
                  </label>
                  <input
                    type="text"
                    value={localData.mountingType}
                    onChange={(e) => setLocalData({ ...localData, mountingType: e.target.value })}
                    className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    placeholder="เช่น ติดเพดาน"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    การแขวน (Hanging Type)
                  </label>
                  <input
                    type="text"
                    value={localData.hangingType}
                    onChange={(e) => setLocalData({ ...localData, hangingType: e.target.value })}
                    className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    placeholder="เช่น หัวผ้าม่านแขวนปิดรางม่าน"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  อุปกรณ์เสริมพ่วงติดตั้ง (Accessories)
                </label>
                <input
                  type="text"
                  value={localData.accessories}
                  onChange={(e) => setLocalData({ ...localData, accessories: e.target.value })}
                  className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  placeholder="เช่น ตะขอเกี่ยวกำแพงเหล็กดัดรมดำ"
                />
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
                    ระยะม่าน: ด้านซ้าย
                  </label>
                  <input
                    type="text"
                    value={localData.distanceLeft}
                    onChange={(e) => setLocalData({ ...localData, distanceLeft: e.target.value })}
                    className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    placeholder="เช่น พอดีเฟรม / เลยเฟรม 15 ซม."
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    ระยะม่าน: ด้านขวา
                  </label>
                  <input
                    type="text"
                    value={localData.distanceRight}
                    onChange={(e) => setLocalData({ ...localData, distanceRight: e.target.value })}
                    className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    placeholder="เช่น พอดีเฟรม / เลยเฟรม 15 ซม."
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    ระยะม่าน: ด้านบน
                  </label>
                  <input
                    type="text"
                    value={localData.distanceTop}
                    onChange={(e) => setLocalData({ ...localData, distanceTop: e.target.value })}
                    className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    placeholder="เช่น ติดเพดาน / เลยเฟรมบน 10 ซม."
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    ระยะม่าน: ด้านล่าง
                  </label>
                  <input
                    type="text"
                    value={localData.distanceBottom}
                    onChange={(e) => setLocalData({ ...localData, distanceBottom: e.target.value })}
                    className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    placeholder="เช่น พอดีพื้น / ลอยจากพื้น 1 ซม."
                  />
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
                  placeholder="เช่น มู่ลี่อะลูมิเนียมเดิมถอนเปลี่ยนใหม่, ต้องใช้ลิฟต์ยกสูงกรณีฝ้าโถงวัดสูง 5 เมตร"
                  className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none h-14 resize-none"
                ></textarea>
              </div>
            </div>
          </div>
        )}
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
