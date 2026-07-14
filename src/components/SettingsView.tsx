import React, { useState } from "react";
import { 
  Plus, Trash2, Users, Database, ShieldAlert, BadgeCheck, 
  Palette, FileImage, Layers, Tag, Ruler, Sliders, Eye, Lock, Unlock, FolderUp, Edit3
} from "lucide-react";
import { Employee, Settings, FabricMaterial, StyleMaterial, HemMaterial } from "../types";
import { generateId } from "../lib/storage";

interface SettingsViewProps {
  employees: Employee[];
  settings: Settings;
  onSaveSettings: (settings: Settings) => void;
  onSaveEmployee: (employee: Employee) => void;
  onDeleteEmployee: (id: string) => void;
  activeEmployeeId: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  employees,
  settings,
  onSaveSettings,
  onSaveEmployee,
  onDeleteEmployee,
  activeEmployeeId,
}) => {
  const [activeTab, setActiveTab] = useState<
    "employees" | "styles" | "hems" | "solid_fabrics" | "sheer_fabrics" | "blinds_rollers" | "general"
  >("solid_fabrics");

  // Admin authentication state
  const activeEmployee = employees.find((e) => e.id === activeEmployeeId);
  const isAdmin = activeEmployee?.role === "admin";
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [isPasswordUnlocked, setIsPasswordUnlocked] = useState(false);

  const canViewEmployees = isAdmin || isPasswordUnlocked;

  // Employee CRUD State
  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpUsername, setNewEmpUsername] = useState("");
  const [newEmpPassword, setNewEmpPassword] = useState("");
  const [newEmpRole, setNewEmpRole] = useState<"admin" | "designer" | "installer">("designer");
  const [newEmpQuota, setNewEmpQuota] = useState(30);

  // Style State
  const [newStyleName, setNewStyleName] = useState("");
  const [newStyleCategory, setNewStyleCategory] = useState<"curtain" | "blind" | "roller" | "roman">("curtain");
  const [newStyleOps, setNewStyleOps] = useState<string>("รวบซ้าย, รวบขวา, แยกกลาง");
  const [newStyleImg, setNewStyleImg] = useState<string>("");

  // Hem State
  const [newHemName, setNewHemName] = useState("");
  const [newHemImg, setNewHemImg] = useState<string>("");

  // Fabric States (Solid & Sheer)
  const [fabricBrand, setFabricBrand] = useState(""); // ชื่อผ้า
  const [fabricColorName, setFabricColorName] = useState(""); // สีผ้า
  const [fabricType, setFabricType] = useState("Blackout");
  const [fabricImg, setFabricImg] = useState<string>("");
  const [folderUploadType, setFolderUploadType] = useState("Blackout");
  const [customApiKey, setCustomApiKey] = useState(settings.customGeminiApiKey || "");
  const [showApiKey, setShowApiKey] = useState(false);

  // Blinds & Rollers State
  const [blindName, setBlindName] = useState(""); // ชื่อผ้า/วัสดุ
  const [blindColorName, setBlindColorName] = useState(""); // สีผ้า
  const [blindType, setBlindType] = useState("Wood Blinds"); // Wood Blinds, Roller, Fabric Tape
  const [blindImg, setBlindImg] = useState<string>("");

  // Helper to convert image files to Base64
  const processImage = (file: File, onComplete: (base64: string) => void) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 400; // Keep swatches compact
        const scale = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.75);
          onComplete(compressedBase64);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Folder/Bulk Upload Handler
  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>, dbType: "solid" | "sheer" | "blinds") => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const importedItems: FabricMaterial[] = [];
    let processedCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;

      // Extract folder and file names
      // webkitRelativePath format e.g., "Folder_Name/File_Name.jpg"
      const relPath = file.webkitRelativePath || "";
      const pathParts = relPath.split("/");

      let parsedFabricName = "";
      let parsedColorName = "";

      if (pathParts.length >= 2) {
        // Folder name is fabric brand name
        parsedFabricName = pathParts[pathParts.length - 2].toUpperCase();
        // File name is color name
        const fileName = pathParts[pathParts.length - 1];
        parsedColorName = fileName.substring(0, fileName.lastIndexOf(".")).toUpperCase();
      } else {
        // Fallback if flat upload
        parsedFabricName = "IMPORTED_FABRIC";
        const fileName = file.name;
        parsedColorName = fileName.substring(0, fileName.lastIndexOf(".")).toUpperCase();
      }

      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (evt) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement("canvas");
              const MAX_WIDTH = 400;
              const scale = MAX_WIDTH / img.width;
              canvas.width = MAX_WIDTH;
              canvas.height = img.height * scale;
              const ctx = canvas.getContext("2d");
              if (ctx) {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL("image/jpeg", 0.75));
              } else reject(new Error("Canvas error"));
            };
            img.src = evt.target?.result as string;
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        importedItems.push({
          id: generateId(),
          name: parsedFabricName,
          colorName: parsedColorName,
          type: dbType === "sheer" ? "Sheer" : dbType === "solid" ? folderUploadType : "Wood Blinds",
          imageBase64: base64,
        });
        processedCount++;
      } catch (err) {
        console.error("Error processing file", file.name, err);
      }
    }

    if (importedItems.length > 0) {
      if (dbType === "solid") {
        onSaveSettings({
          ...settings,
          solidFabricMaterials: [...(settings.solidFabricMaterials || []), ...importedItems],
        });
      } else if (dbType === "sheer") {
        onSaveSettings({
          ...settings,
          sheerFabricMaterials: [...(settings.sheerFabricMaterials || []), ...importedItems],
        });
      } else if (dbType === "blinds") {
        // Save as wood/aluminum blinds or roller shades based on file naming or default to blinds
        onSaveSettings({
          ...settings,
          blindMaterials: [...(settings.blindMaterials || []), ...importedItems],
        });
      }
      alert(`นำเข้าโฟลเดอร์เสร็จสิ้น! บันทึกสำเร็จทั้งหมด ${processedCount} รายการ โดยดึง "ชื่อผ้า" จากชื่อโฟลเดอร์ และ "สีผ้า" จากชื่อไฟล์รูปภาพ`);
    }
  };

  // Employee Operations
  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName.trim()) return;
    onSaveEmployee({
      id: generateId(),
      name: newEmpName.trim(),
      username: newEmpUsername.trim() || undefined,
      password: newEmpPassword.trim() || undefined,
      role: newEmpRole,
      aiQuota: newEmpQuota,
      aiUsed: 0,
    });
    setNewEmpName("");
    setNewEmpUsername("");
    setNewEmpPassword("");
    setNewEmpRole("designer");
    setNewEmpQuota(30);
  };

  const handleAdminVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const foundAdmin = employees.find((emp) => emp.role === "admin");
    const correctPassword = foundAdmin?.password || "123";
    if (adminPasswordInput === correctPassword || adminPasswordInput === "admin") {
      setIsPasswordUnlocked(true);
      setAdminPasswordInput("");
    } else {
      alert("รหัสผ่านผู้ดูแลระบบไม่ถูกต้อง!");
    }
  };

  // Style operations
  const handleAddStyle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStyleName.trim()) return;
    const styleMaterials = settings.styleMaterials || [];
    const opsList = newStyleOps.split(",").map((s) => s.trim()).filter(Boolean);
    const newItem: StyleMaterial = {
      id: generateId(),
      name: newStyleName.trim(),
      category: newStyleCategory,
      operationOptions: opsList.length > 0 ? opsList : undefined,
      imageBase64: newStyleImg || undefined,
    };
    onSaveSettings({
      ...settings,
      styleMaterials: [...styleMaterials, newItem],
    });
    setNewStyleName("");
    setNewStyleCategory("curtain");
    setNewStyleOps("รวบซ้าย, รวบขวา, แยกกลาง");
    setNewStyleImg("");
  };

  const handleRemoveStyle = (id: string) => {
    const styleMaterials = settings.styleMaterials || [];
    onSaveSettings({
      ...settings,
      styleMaterials: styleMaterials.filter((x) => x.id !== id),
    });
  };

  // Hem operations
  const handleAddHem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHemName.trim()) return;
    const hemMaterials = settings.hemMaterials || [];
    const newItem: HemMaterial = {
      id: generateId(),
      name: newHemName.trim(),
      imageBase64: newHemImg || undefined,
    };
    onSaveSettings({
      ...settings,
      hemMaterials: [...hemMaterials, newItem],
    });
    setNewHemName("");
    setNewHemImg("");
  };

  const handleRemoveHem = (id: string) => {
    const hemMaterials = settings.hemMaterials || [];
    onSaveSettings({
      ...settings,
      hemMaterials: hemMaterials.filter((x) => x.id !== id),
    });
  };

  // Solid fabric operations
  const handleAddSolidFabric = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fabricBrand.trim() || !fabricColorName.trim()) return;
    const list = settings.solidFabricMaterials || [];
    const newItem: FabricMaterial = {
      id: generateId(),
      name: fabricBrand.trim().toUpperCase(),
      colorName: fabricColorName.trim().toUpperCase(),
      type: fabricType,
      imageBase64: fabricImg || undefined,
    };
    onSaveSettings({
      ...settings,
      solidFabricMaterials: [...list, newItem],
    });
    setFabricBrand("");
    setFabricColorName("");
    setFabricType("Blackout");
    setFabricImg("");
  };

  const handleRemoveSolidFabric = (id: string) => {
    const list = settings.solidFabricMaterials || [];
    onSaveSettings({
      ...settings,
      solidFabricMaterials: list.filter((x) => x.id !== id),
    });
  };

  // Sheer fabric operations
  const handleAddSheerFabric = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fabricBrand.trim() || !fabricColorName.trim()) return;
    const list = settings.sheerFabricMaterials || [];
    const newItem: FabricMaterial = {
      id: generateId(),
      name: fabricBrand.trim().toUpperCase(),
      colorName: fabricColorName.trim().toUpperCase(),
      type: "Sheer",
      imageBase64: fabricImg || undefined,
    };
    onSaveSettings({
      ...settings,
      sheerFabricMaterials: [...list, newItem],
    });
    setFabricBrand("");
    setFabricColorName("");
    setFabricImg("");
  };

  const handleRemoveSheerFabric = (id: string) => {
    const list = settings.sheerFabricMaterials || [];
    onSaveSettings({
      ...settings,
      sheerFabricMaterials: list.filter((x) => x.id !== id),
    });
  };

  // Blinds & Roller operations
  const handleAddBlindMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blindName.trim() || !blindColorName.trim()) return;

    if (blindType === "Wood Blinds" || blindType === "Aluminum Blinds") {
      const list = settings.blindMaterials || [];
      const newItem: FabricMaterial = {
        id: generateId(),
        name: blindName.trim().toUpperCase(),
        colorName: blindColorName.trim().toUpperCase(),
        type: blindType,
        imageBase64: blindImg || undefined,
      };
      onSaveSettings({
        ...settings,
        blindMaterials: [...list, newItem],
      });
    } else if (blindType === "Roller Shades") {
      const list = settings.rollerMaterials || [];
      const newItem: FabricMaterial = {
        id: generateId(),
        name: blindName.trim().toUpperCase(),
        colorName: blindColorName.trim().toUpperCase(),
        type: blindType,
        imageBase64: blindImg || undefined,
      };
      onSaveSettings({
        ...settings,
        rollerMaterials: [...list, newItem],
      });
    } else if (blindType === "Fabric Tape") {
      const list = settings.blindTapeMaterials || [];
      const newItem: FabricMaterial = {
        id: generateId(),
        name: blindName.trim().toUpperCase(),
        colorName: blindColorName.trim().toUpperCase(),
        type: blindType,
        imageBase64: blindImg || undefined,
      };
      onSaveSettings({
        ...settings,
        blindTapeMaterials: [...list, newItem],
      });
    }

    setBlindName("");
    setBlindColorName("");
    setBlindImg("");
  };

  const handleRemoveBlindMaterial = (id: string, group: "blind" | "roller" | "tape") => {
    if (group === "blind") {
      const list = settings.blindMaterials || [];
      onSaveSettings({ ...settings, blindMaterials: list.filter((x) => x.id !== id) });
    } else if (group === "roller") {
      const list = settings.rollerMaterials || [];
      onSaveSettings({ ...settings, rollerMaterials: list.filter((x) => x.id !== id) });
    } else if (group === "tape") {
      const list = settings.blindTapeMaterials || [];
      onSaveSettings({ ...settings, blindTapeMaterials: list.filter((x) => x.id !== id) });
    }
  };

  // Tracks & Accessories CRUD Editor
  const CustomMaterialCRUD: React.FC<{
    label: string;
    description: string;
    items: { id: string; name: string }[];
    fieldKey: "trackMaterials" | "accessoryMaterials";
  }> = ({ label, description, items, fieldKey }) => {
    const [nameText, setNameText] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);

    const handleSave = () => {
      if (!nameText.trim()) return;
      let updated = [...items];

      if (editingId) {
        // Edit Mode
        updated = updated.map((item) => (item.id === editingId ? { ...item, name: nameText.trim() } : item));
        setEditingId(null);
      } else {
        // Create Mode
        if (updated.some((x) => x.name.toLowerCase() === nameText.trim().toLowerCase())) {
          alert("มีชื่อนี้ในระบบแล้ว");
          return;
        }
        updated.push({ id: generateId(), name: nameText.trim() });
      }

      onSaveSettings({ ...settings, [fieldKey]: updated });
      setNameText("");
    };

    const handleRemove = (id: string) => {
      onSaveSettings({ ...settings, [fieldKey]: items.filter((x) => x.id !== id) });
    };

    const handleEditStart = (item: { id: string; name: string }) => {
      setEditingId(item.id);
      setNameText(item.name);
    };

    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex flex-col h-full justify-between">
        <div>
          <h4 className="font-extrabold text-slate-800 text-base flex items-center justify-between">
            <span>{label}</span>
            <span className="text-xs font-normal text-slate-400">({items.length} รายการ)</span>
          </h4>
          <p className="text-xs text-slate-400 mb-4 mt-0.5">{description}</p>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={nameText}
              onChange={(e) => setNameText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder={editingId ? "กำลังแก้ไข..." : "พิมพ์ชื่อและกดบันทึก..."}
              className="flex-1 bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
            />
            <button
              type="button"
              onClick={handleSave}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold px-4 py-2 transition flex items-center gap-1 cursor-pointer"
            >
              {editingId ? <Edit3 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{editingId ? "อัปเดต" : "เพิ่ม"}</span>
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setNameText("");
                }}
                className="bg-slate-200 text-slate-600 rounded-xl text-xs px-2"
              >
                ยกเลิก
              </button>
            )}
          </div>

          <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between bg-slate-50/50 hover:bg-slate-50 border border-slate-150 p-2.5 rounded-xl text-xs"
              >
                <span className="font-semibold text-slate-700 leading-tight">{item.name}</span>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleEditStart(item)}
                    className="text-slate-400 hover:text-indigo-600 p-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    className="text-slate-400 hover:text-rose-500 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Fabric Light-Control / Reflection CRUD Editor
  const FabricTypesCRUD: React.FC = () => {
    const currentTypes = settings.fabricTypes || ["Blackout", "Dimout", "Drapery", "Energy Saving"];
    const [nameText, setNameText] = useState("");
    const [editingIndex, setEditingIndex] = useState<number | null>(null);

    const handleSave = () => {
      if (!nameText.trim()) return;
      let updated = [...currentTypes];
      const trimmed = nameText.trim();

      if (editingIndex !== null) {
        // Edit Mode
        updated[editingIndex] = trimmed;
        setEditingIndex(null);
      } else {
        // Create Mode
        if (updated.some((x) => x.toLowerCase() === trimmed.toLowerCase())) {
          alert("มีคุณสมบัตินี้ในระบบแล้ว");
          return;
        }
        updated.push(trimmed);
      }

      onSaveSettings({ ...settings, fabricTypes: updated });
      setNameText("");
    };

    const handleRemove = (index: number) => {
      const typeToRemove = currentTypes[index];
      if (confirm(`คุณต้องการลบคุณสมบัติ "${typeToRemove}" ใช่หรือไม่? มีผลกับตัวเลือกข้อมูลผ้าม่าน`)) {
        const updated = currentTypes.filter((_, idx) => idx !== index);
        onSaveSettings({ ...settings, fabricTypes: updated });
      }
    };

    const handleEditStart = (index: number, val: string) => {
      setEditingIndex(index);
      setNameText(val);
    };

    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex flex-col h-full justify-between">
        <div>
          <h4 className="font-extrabold text-slate-800 text-base flex items-center justify-between">
            <span>คุณสมบัติการสะท้อน/ควบคุมแสง (Fabric Properties)</span>
            <span className="text-xs font-normal text-slate-400">({currentTypes.length} รายการ)</span>
          </h4>
          <p className="text-xs text-slate-400 mb-4 mt-0.5">เพิ่ม ลบ แก้ไขลักษณะการสะท้อนกรองแสงของผ้าม่านทึบ (เช่น Blackout, Dimout, ม่านกันแสงยูวี, ม่านกันความร้อน)</p>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={nameText}
              onChange={(e) => setNameText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder={editingIndex !== null ? "กำลังแก้ไขคุณสมบัติ..." : "พิมพ์สเปกคุณสมบัติและกดบันทึก..."}
              className="flex-1 bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
            />
            <button
              type="button"
              onClick={handleSave}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold px-4 py-2 transition flex items-center gap-1 cursor-pointer shrink-0"
            >
              {editingIndex !== null ? <Edit3 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{editingIndex !== null ? "อัปเดต" : "เพิ่ม"}</span>
            </button>
            {editingIndex !== null && (
              <button
                type="button"
                onClick={() => {
                  setEditingIndex(null);
                  setNameText("");
                }}
                className="bg-slate-200 text-slate-600 rounded-xl text-xs px-2"
              >
                ยกเลิก
              </button>
            )}
          </div>

          <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
            {currentTypes.map((type, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-slate-50/50 hover:bg-slate-50 border border-slate-150 p-2.5 rounded-xl text-xs"
              >
                <span className="font-semibold text-slate-700 leading-tight">{type}</span>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleEditStart(idx, type)}
                    className="text-slate-400 hover:text-indigo-600 p-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    className="text-slate-400 hover:text-rose-500 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Generic list editor for simple string arrays
  const StringListCRUD: React.FC<{
    label: string;
    description: string;
    items: string[];
    fieldKey: "hangingTypes" | "usageTypes" | "clearanceOptions";
    placeholder?: string;
  }> = ({ label, description, items = [], fieldKey, placeholder }) => {
    const [nameText, setNameText] = useState("");
    const [editingIndex, setEditingIndex] = useState<number | null>(null);

    const handleSave = () => {
      if (!nameText.trim()) return;
      const updated = [...items];
      const trimmed = nameText.trim();

      if (editingIndex !== null) {
        updated[editingIndex] = trimmed;
        setEditingIndex(null);
      } else {
        if (updated.some((x) => x.toLowerCase() === trimmed.toLowerCase())) {
          alert("มีตัวเลือกนี้ในระบบแล้ว");
          return;
        }
        updated.push(trimmed);
      }

      onSaveSettings({ ...settings, [fieldKey]: updated });
      setNameText("");
    };

    const handleRemove = (index: number) => {
      if (confirm(`คุณต้องการลบตัวเลือก "${items[index]}" ใช่หรือไม่?`)) {
        const updated = items.filter((_, idx) => idx !== index);
        onSaveSettings({ ...settings, [fieldKey]: updated });
      }
    };

    const handleEditStart = (index: number, val: string) => {
      setEditingIndex(index);
      setNameText(val);
    };

    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex flex-col h-full justify-between">
        <div>
          <h4 className="font-extrabold text-slate-800 text-base flex items-center justify-between">
            <span>{label}</span>
            <span className="text-xs font-normal text-slate-400">({items.length} รายการ)</span>
          </h4>
          <p className="text-xs text-slate-400 mb-4 mt-0.5">{description}</p>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={nameText}
              onChange={(e) => setNameText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder={placeholder || "พิมพ์ตัวเลือก..."}
              className="flex-1 bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
            />
            <button
              type="button"
              onClick={handleSave}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold px-4 py-2 transition flex items-center gap-1 cursor-pointer shrink-0"
            >
              {editingIndex !== null ? <Edit3 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{editingIndex !== null ? "อัปเดต" : "เพิ่ม"}</span>
            </button>
            {editingIndex !== null && (
              <button
                type="button"
                onClick={() => {
                  setEditingIndex(null);
                  setNameText("");
                }}
                className="bg-slate-200 text-slate-600 rounded-xl text-xs px-2"
              >
                ยกเลิก
              </button>
            )}
          </div>

          <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-slate-50/50 hover:bg-slate-50 border border-slate-150 p-2.5 rounded-xl text-xs"
              >
                <span className="font-semibold text-slate-700 leading-tight">{item}</span>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleEditStart(idx, item)}
                    className="text-slate-400 hover:text-indigo-600 p-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    className="text-slate-400 hover:text-rose-500 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Intro section */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-indigo-950/10">
        <h2 className="text-2xl md:text-3xl font-black tracking-tight">
          ตั้งค่าการทำงานและฐานข้อมูลกลาง
        </h2>
        <p className="text-sm text-indigo-200 mt-2 max-w-3xl leading-relaxed font-medium">
          ระบบบริหารข้อมูลผ้าม่านพรีเมียม สเปกสีลายถัก สวอชมู่ลี่ไม้ ม่านม้วน รางม่าน อุปกรณ์ติดตั้ง 
          และจัดการสิทธิ์นักออกแบบเพื่อให้โควต้าประมวลผลรูปจำลองด้วย AI ทำงานได้ดีที่สุด
        </p>
      </div>

      {/* Tabs list */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-1.5">
        <button
          onClick={() => setActiveTab("solid_fabrics")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === "solid_fabrics"
              ? "bg-slate-900 text-white shadow-lg shadow-slate-900/10"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>ผ้าม่านทึบ (Solid)</span>
        </button>

        <button
          onClick={() => setActiveTab("sheer_fabrics")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === "sheer_fabrics"
              ? "bg-slate-900 text-white shadow-lg shadow-slate-900/10"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>ผ้าม่านโปร่ง (Sheer)</span>
        </button>

        <button
          onClick={() => setActiveTab("blinds_rollers")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === "blinds_rollers"
              ? "bg-slate-900 text-white shadow-lg shadow-slate-900/10"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>มู่ลี่ & ม่านม้วน (Blinds/Rollers)</span>
        </button>

        <button
          onClick={() => setActiveTab("styles")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === "styles"
              ? "bg-slate-900 text-white shadow-lg shadow-slate-900/10"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>รูปแบบม่าน & วิธีใช้งาน</span>
        </button>

        <button
          onClick={() => setActiveTab("hems")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === "hems"
              ? "bg-slate-900 text-white shadow-lg shadow-slate-900/10"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Ruler className="w-4 h-4" />
          <span>ระยะชายม่าน</span>
        </button>

        <button
          onClick={() => setActiveTab("general")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === "general"
              ? "bg-slate-900 text-white shadow-lg shadow-slate-900/10"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Database className="w-4 h-4" />
          <span>ราง & อุปกรณ์เสริม (CRUD)</span>
        </button>

        <button
          onClick={() => setActiveTab("employees")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === "employees"
              ? "bg-rose-600 text-white shadow-lg shadow-rose-600/10"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>พนักงาน & ผู้ใช้งานระบบ</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* TAB: Employees */}
        {activeTab === "employees" && (
          <div className="lg:col-span-3">
            {!canViewEmployees ? (
              <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-3xl p-8 shadow-xl text-center">
                <Lock className="w-12 h-12 text-rose-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-800">ระบบจำกัดสิทธิเฉพาะแอดมิน</h3>
                <p className="text-xs text-slate-400 mt-1 mb-6">
                  กรุณากรอกรหัสผ่านเพื่อเข้าใช้งานฐานข้อมูลพนักงาน (เพิ่ม ลบ แก้ไข) หรือสลับบัญชีผู้รับผิดชอบเป็นผู้ดูแลระบบ
                </p>
                <form onSubmit={handleAdminVerify} className="space-y-4">
                  <input
                    type="password"
                    required
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    placeholder="กรอกรหัสผ่านแอดมิน (เช่น 123)"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-4 py-3 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition text-center font-mono"
                  />
                  <button
                    type="submit"
                    className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl py-3.5 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>ปลดล็อกด้วยรหัสผ่านแอดมิน</span>
                  </button>
                </form>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm h-fit">
                  <h3 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
                    <Users className="w-4.5 h-4.5 text-rose-500" />
                    <span>เพิ่ม/แก้ไขพนักงานเข้าระบบ</span>
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">กำหนดรหัสผ่าน บทบาท และโควต้าใช้งาน AI รายเดือน</p>

                  <form onSubmit={handleAddEmployee} className="space-y-3.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        ชื่อพนักงาน / ดีไซเนอร์
                      </label>
                      <input
                        type="text"
                        required
                        value={newEmpName}
                        onChange={(e) => setNewEmpName(e.target.value)}
                        placeholder="เช่น คุณอรพรรณ (Designer)"
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Username
                        </label>
                        <input
                          type="text"
                          required
                          value={newEmpUsername}
                          onChange={(e) => setNewEmpUsername(e.target.value)}
                          placeholder="orapan_d"
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Password
                        </label>
                        <input
                          type="password"
                          required
                          value={newEmpPassword}
                          onChange={(e) => setNewEmpPassword(e.target.value)}
                          placeholder="รหัสผ่าน"
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          หน้าที่รับผิดชอบ (Role)
                        </label>
                        <select
                          value={newEmpRole}
                          onChange={(e) => setNewEmpRole(e.target.value as any)}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-2 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
                        >
                          <option value="admin">ผู้ดูแลระบบ (Admin)</option>
                          <option value="designer">ดีไซเนอร์ (Designer)</option>
                          <option value="installer">ช่างติดตั้ง (Installer)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          โควต้า AI (รูป/เดือน)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="500"
                          required
                          value={newEmpQuota}
                          onChange={(e) => setNewEmpQuota(parseInt(e.target.value) || 0)}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl py-3 transition flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/10 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>บันทึกเพิ่มพนักงาน</span>
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                      <span>รายชื่อผู้รับผิดชอบระบบและสิทธิ์ ({employees.length})</span>
                    </h3>
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase">
                      Admin Authorized
                    </span>
                  </div>
                  
                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                    {employees.map((emp) => (
                      <div
                        key={emp.id}
                        className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-150 rounded-xl hover:bg-slate-100/55 transition"
                      >
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 text-sm">{emp.name}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              emp.role === "admin"
                                ? "bg-purple-100 text-purple-700 border border-purple-200"
                                : emp.role === "designer"
                                ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                                : "bg-slate-150 text-slate-700"
                            }`}>
                              {emp.role === "admin" ? "Admin" : emp.role === "designer" ? "Designer" : "Installer / Sales"}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-400 font-semibold">
                            <div className="flex items-center gap-1">
                              <BadgeCheck className="w-3.5 h-3.5 text-indigo-500" />
                              <span>โควต้าภาพ AI:</span>
                              <span className="font-mono text-indigo-600">
                                {emp.aiUsed} / {emp.aiQuota} รูป
                              </span>
                            </div>
                            {emp.username && (
                              <div className="flex items-center gap-1">
                                <span>Username:</span>
                                <span className="font-mono text-slate-700 bg-slate-200/50 px-1.5 rounded">{emp.username}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {employees.length > 1 && emp.role !== "admin" && (
                          <button
                            type="button"
                            onClick={() => onDeleteEmployee(emp.id)}
                            className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-xl transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: Style Materials with custom options */}
        {activeTab === "styles" && (
          <>
            <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm h-fit">
              <h3 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
                <Layers className="w-4.5 h-4.5 text-indigo-500" />
                <span>เพิ่มรูปแบบการติดตั้งผ้าม่าน</span>
              </h3>
              <p className="text-xs text-slate-400 mb-4">ระบุวิธีกาง แถบแม่เหล็ก หรือโซ่แยกดึงของมู่ลี่ม่านม้วน</p>

              <form onSubmit={handleAddStyle} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    ชื่อรูปแบบม่าน (Style Name)
                  </label>
                  <input
                    type="text"
                    required
                    value={newStyleName}
                    onChange={(e) => setNewStyleName(e.target.value)}
                    placeholder="เช่น ม่านลอน, มู่ลี่ไม้บาสวูด"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      ประเภทผลิตภัณฑ์
                    </label>
                    <select
                      value={newStyleCategory}
                      onChange={(e) => setNewStyleCategory(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-2 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
                    >
                      <option value="curtain">ม่านผ้า (Curtain)</option>
                      <option value="blind">มู่ลี่ (Blind)</option>
                      <option value="roller">ม่านม้วน (Roller)</option>
                      <option value="roman">ม่านพับ (Roman)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      ตัวเลือกการใช้งานเริ่มต้น
                    </label>
                    <select
                      onChange={(e) => setNewStyleOps(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-2 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
                    >
                      <option value="รวบซ้าย, รวบขวา, แยกกลาง">ม่านแบบสไลด์ (ซ้าย, ขวา, แยกกลาง)</option>
                      <option value="ดึงโซ่ฝั่งซ้าย, ดึงโซ่ฝั่งขวา, ใช้งานมอเตอร์">ม่านแนวดึง (โซ่ซ้าย, โซ่ขวา, มอเตอร์)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    ระบุตัวเลือกการใช้งานย่อย (แบ่งด้วยจุลภาค `,`)
                  </label>
                  <input
                    type="text"
                    required
                    value={newStyleOps}
                    onChange={(e) => setNewStyleOps(e.target.value)}
                    placeholder="เช่น รวบซ้าย, รวบขวา, แยกกลาง"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    รูปภาพสวอชลายเส้นรูปแบบม่าน (Swatch Outline)
                  </label>
                  <div className="mt-1 flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
                      {newStyleImg ? (
                        <img src={newStyleImg} alt="preview" className="w-full h-full object-cover" />
                      ) : (
                        <Layers className="w-6 h-6 text-slate-300" />
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) processImage(file, setNewStyleImg);
                      }}
                      className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl py-3 transition flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/10 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>บันทึกรูปแบบม่าน</span>
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
              <h3 className="text-base font-bold text-slate-800 mb-3">
                รายการสเปกรูปแบบผ้าม่าน & มู่ลี่ทั้งหมด ({(settings.styleMaterials || []).length})
              </h3>
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {(settings.styleMaterials || []).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3.5 p-3.5 bg-slate-50 border border-slate-150 rounded-2xl hover:border-slate-300 transition"
                  >
                    <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                      {item.imageBase64 ? (
                        <img src={item.imageBase64} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <Layers className="w-6 h-6 text-slate-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-800 text-sm">{item.name}</span>
                        <span className="px-2 py-0.5 bg-slate-200/60 text-slate-600 rounded-md text-[9px] font-black uppercase tracking-tight">
                          {item.category || "curtain"}
                        </span>
                      </div>
                      <p className="text-[10px] font-semibold text-indigo-600 mt-1">
                        การควบคุม: {item.operationOptions?.join(" / ") || "รวบซ้าย, รวบขวา, แยกกลาง"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveStyle(item.id)}
                      className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-xl transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* TAB: Hems */}
        {activeTab === "hems" && (
          <>
            <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm h-fit">
              <h3 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
                <Ruler className="w-4.5 h-4.5 text-indigo-500" />
                <span>เพิ่มสเปกระยะชายม่าน</span>
              </h3>
              <p className="text-xs text-slate-400 mb-4">เพิ่มระยะห่างหรือการกองพื้นลอยชายเพื่อดีไซน์ที่หรูหรา</p>

              <form onSubmit={handleAddHem} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    ชื่อสเปกระยะชายม่าน
                  </label>
                  <input
                    type="text"
                    required
                    value={newHemName}
                    onChange={(e) => setNewHemName(e.target.value)}
                    placeholder="เช่น ลอยจากพื้น 1 ซม."
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    รูปภาพตัวอย่างระยะชายม่าน
                  </label>
                  <div className="mt-1 flex items-center gap-4">
                    <div className="w-20 h-20 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
                      {newHemImg ? (
                        <img src={newHemImg} alt="preview" className="w-full h-full object-cover" />
                      ) : (
                        <FileImage className="w-8 h-8 text-slate-300" />
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) processImage(file, setNewHemImg);
                      }}
                      className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl py-3 transition flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/10 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>บันทึกระยะชายม่าน</span>
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
              <h3 className="text-base font-bold text-slate-800 mb-3">
                รายการระยะชายม่านในระบบ ({(settings.hemMaterials || []).length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[480px] overflow-y-auto pr-1">
                {(settings.hemMaterials || []).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-150 rounded-2xl hover:border-slate-300 transition"
                  >
                    <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                      {item.imageBase64 ? (
                        <img src={item.imageBase64} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <Ruler className="w-6 h-6 text-slate-300" />
                      )}
                    </div>
                    <span className="font-bold text-slate-800 text-xs flex-1">{item.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveHem(item.id)}
                      className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-xl transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* TAB: Solid Fabrics */}
        {activeTab === "solid_fabrics" && (
          <>
            <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm h-fit space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
                  <Palette className="w-4.5 h-4.5 text-indigo-500" />
                  <span>เพิ่มผ้าม่านทึบ (Solid)</span>
                </h3>
                <p className="text-xs text-slate-400 mb-4">กำหนดสเปก ชื่อผ้า และสีผ้า โดยดึงเฉดสีจากรูปภาพจริงเท่านั้น</p>

                <form onSubmit={handleAddSolidFabric} className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        ชื่อผ้า (Fabric Name)
                      </label>
                      <input
                        type="text"
                        required
                        value={fabricBrand}
                        onChange={(e) => setFabricBrand(e.target.value)}
                        placeholder="เช่น CITADEL, GLAMOUR"
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        สีผ้า (Fabric Color)
                      </label>
                      <input
                        type="text"
                        required
                        value={fabricColorName}
                        onChange={(e) => setFabricColorName(e.target.value)}
                        placeholder="เช่น LONDON GRAY"
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      คุณสมบัติการสะท้อน/ควบคุมแสง
                    </label>
                    <select
                      value={fabricType}
                      onChange={(e) => setFabricType(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-2.5 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
                    >
                      {(settings.fabricTypes || ["Blackout", "Dimout", "Drapery", "Energy Saving"]).map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      รูปภาพจริงสวอชผ้า (Real Photo Swatch ONLY)
                    </label>
                    <div className="mt-1 flex items-center gap-4">
                      <div className="w-16 h-16 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
                        {fabricImg ? (
                          <img src={fabricImg} alt="preview" className="w-full h-full object-cover" />
                        ) : (
                          <FileImage className="w-8 h-8 text-slate-300" />
                        )}
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        required
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) processImage(file, setFabricImg);
                        }}
                        className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl py-3 transition flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/10 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>บันทึกผ้าทึบแสง</span>
                  </button>
                </form>
              </div>

              {/* Folder Import Module */}
              <div className="border-t border-slate-100 pt-5 space-y-3">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2">
                  <FolderUp className="w-4 h-4 text-indigo-500" />
                  <span>อัปโหลดข้อมูลเป็นโฟลเดอร์ผ้า (Bulk Folder Import)</span>
                </h4>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  เลือกโฟลเดอร์จากคอมพิวเตอร์ ระบบจะดึง <strong>ชื่อโฟลเดอร์เป็นชื่อผ้า</strong> และ <strong>ชื่อไฟล์เป็นชื่อสีผ้า</strong> ทันที สะดวกและรวดเร็ว
                </p>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    คุณสมบัติการสะท้อน/ควบคุมแสงสำหรับโฟลเดอร์นี้
                  </label>
                  <select
                    value={folderUploadType}
                    onChange={(e) => setFolderUploadType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-2.5 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
                  >
                    {(settings.fabricTypes || ["Blackout", "Dimout", "Drapery", "Energy Saving"]).map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div className="relative border border-dashed border-slate-300 bg-slate-50/50 rounded-xl p-3 text-center transition hover:bg-slate-50">
                  <input
                    type="file"
                    {...{ webkitdirectory: "", directory: "", multiple: true }}
                    onChange={(e) => handleFolderUpload(e, "solid")}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <FolderUp className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                  <span className="text-[10px] font-bold text-indigo-600">กดเลือกโฟลเดอร์ผ้าเพื่อนำเข้าพร้อมกัน</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
              <h3 className="text-base font-bold text-slate-800 mb-3">
                รายการผ้าม่านทึบแสง ({(settings.solidFabricMaterials || []).length} สีแบบ)
              </h3>
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {(settings.solidFabricMaterials || []).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3.5 p-3 bg-slate-50 border border-slate-150 rounded-2xl hover:border-slate-250 transition"
                  >
                    <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                      {item.imageBase64 ? (
                        <img src={item.imageBase64} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-400">
                          No Swatch
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-800 text-xs">
                          {item.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight bg-slate-200/80 text-slate-700">
                          {item.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-indigo-600 font-bold mt-0.5">สีผ้า: {item.colorName}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveSolidFabric(item.id)}
                      className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-xl transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* TAB: Sheer Fabrics */}
        {activeTab === "sheer_fabrics" && (
          <>
            <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm h-fit space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
                  <Eye className="w-4.5 h-4.5 text-indigo-500" />
                  <span>เพิ่มผ้าโปร่งแสง (Sheer)</span>
                </h3>
                <p className="text-xs text-slate-400 mb-4">กำหนดสเปกแบรนด์ ชื่อผ้าและสีผ้า โดยดึงเฉดสีจากรูปภาพจริงเท่านั้น</p>

                <form onSubmit={handleAddSheerFabric} className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        ชื่อผ้า (Fabric Name)
                      </label>
                      <input
                        type="text"
                        required
                        value={fabricBrand}
                        onChange={(e) => setFabricBrand(e.target.value)}
                        placeholder="เช่น AFFINITY, AURA"
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        สีผ้า (Fabric Color)
                      </label>
                      <input
                        type="text"
                        required
                        value={fabricColorName}
                        onChange={(e) => setFabricColorName(e.target.value)}
                        placeholder="such as WHITE, SOFT CREAM"
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      รูปภาพจริงสวอชผ้าโปร่ง (Real Photo Swatch ONLY)
                    </label>
                    <div className="mt-1 flex items-center gap-4">
                      <div className="w-16 h-16 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
                        {fabricImg ? (
                          <img src={fabricImg} alt="preview" className="w-full h-full object-cover" />
                        ) : (
                          <FileImage className="w-8 h-8 text-slate-300" />
                        )}
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        required
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) processImage(file, setFabricImg);
                        }}
                        className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl py-3 transition flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/10 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>บันทึกผ้าม่านโปร่งแสง</span>
                  </button>
                </form>
              </div>

              {/* Folder Import Module */}
              <div className="border-t border-slate-100 pt-5">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2">
                  <FolderUp className="w-4 h-4 text-indigo-500" />
                  <span>อัปโหลดข้อมูลโปร่งแบบโฟลเดอร์ (Bulk Folder Import)</span>
                </h4>
                <p className="text-[10px] text-slate-400 mb-3 leading-relaxed">
                  เลือกโฟลเดอร์ผ้าโปร่งจากเครื่องคอมพิวเตอร์ ระบบจะใช้ <strong>ชื่อโฟลเดอร์เป็นชื่อผ้า</strong> และ <strong>ชื่อไฟล์เป็นสีผ้าโปร่ง</strong>
                </p>
                <div className="relative border border-dashed border-slate-300 bg-slate-50/50 rounded-xl p-3 text-center transition hover:bg-slate-50">
                  <input
                    type="file"
                    {...{ webkitdirectory: "", directory: "", multiple: true }}
                    onChange={(e) => handleFolderUpload(e, "sheer")}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <FolderUp className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                  <span className="text-[10px] font-bold text-indigo-600">กดเลือกโฟลเดอร์ผ้าโปร่งเพื่อนำเข้าพร้อมกัน</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
              <h3 className="text-base font-bold text-slate-800 mb-3">
                รายการผ้าม่านโปร่งแสง ({(settings.sheerFabricMaterials || []).length} สีแบบ)
              </h3>
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {(settings.sheerFabricMaterials || []).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3.5 p-3 bg-slate-50 border border-slate-150 rounded-2xl hover:border-slate-250 transition"
                  >
                    <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                      {item.imageBase64 ? (
                        <img src={item.imageBase64} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-400">
                          No Swatch
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-800 text-xs">
                          {item.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight bg-slate-200/80 text-slate-700">
                          {item.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-indigo-600 font-bold mt-0.5">สีผ้า: {item.colorName}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveSheerFabric(item.id)}
                      className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-xl transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* TAB: Blinds & Roller Shades */}
        {activeTab === "blinds_rollers" && (
          <>
            <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm h-fit space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
                  <Sliders className="w-4.5 h-4.5 text-indigo-500" />
                  <span>เพิ่มวัสดุมู่ลี่ & ม่านม้วน</span>
                </h3>
                <p className="text-xs text-slate-400 mb-4">กำหนดสเปกสำหรับมู่ลี่อลูมิเนียม มู่ลี่ไม้ เทปผ้า และม่านม้วน</p>

                <form onSubmit={handleAddBlindMaterial} className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        ชื่อสินค้า/ผ้า/วัสดุ
                      </label>
                      <input
                        type="text"
                        required
                        value={blindName}
                        onChange={(e) => setBlindName(e.target.value)}
                        placeholder="เช่น PREMIUM WOOD"
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        สีวัสดุ (Color Name)
                      </label>
                      <input
                        type="text"
                        required
                        value={blindColorName}
                        onChange={(e) => setBlindColorName(e.target.value)}
                        placeholder="เช่น NATURAL OAK"
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      ประเภทสินค้าเฉพาะกลุ่ม
                    </label>
                    <select
                      value={blindType}
                      onChange={(e) => setBlindType(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-2.5 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
                    >
                      <option value="Wood Blinds">มู่ลี่ไม้ (Wood Blinds)</option>
                      <option value="Aluminum Blinds">มู่ลี่อะลูมิเนียม (Aluminum Blinds)</option>
                      <option value="Roller Shades">ม่านม้วน (Roller Shades)</option>
                      <option value="Fabric Tape">เทปผ้าสำหรับมู่ลี่ (Fabric Tape for Blinds)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      รูปภาพจริงเนื้อวัสดุสวอช (Real Photo Swatch ONLY)
                    </label>
                    <div className="mt-1 flex items-center gap-4">
                      <div className="w-16 h-16 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
                        {blindImg ? (
                          <img src={blindImg} alt="preview" className="w-full h-full object-cover" />
                        ) : (
                          <FileImage className="w-8 h-8 text-slate-300" />
                        )}
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        required
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) processImage(file, setBlindImg);
                        }}
                        className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl py-3 transition flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/10 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>บันทึกฐานข้อมูลมู่ลี่/ม่านม้วน</span>
                  </button>
                </form>
              </div>

              {/* Directory import for blinds */}
              <div className="border-t border-slate-100 pt-5">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2">
                  <FolderUp className="w-4 h-4 text-indigo-500" />
                  <span>นำเข้าสวอชมู่ลี่เป็นโฟลเดอร์ (Bulk Folder Import)</span>
                </h4>
                <div className="relative border border-dashed border-slate-300 bg-slate-50/50 rounded-xl p-3 text-center transition hover:bg-slate-50">
                  <input
                    type="file"
                    {...{ webkitdirectory: "", directory: "", multiple: true }}
                    onChange={(e) => handleFolderUpload(e, "blinds")}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <FolderUp className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                  <span className="text-[10px] font-bold text-indigo-600">กดเลือกโฟลเดอร์นำเข้าสวอชมู่ลี่/ม่านม้วน</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-8 max-h-[650px] overflow-y-auto pr-1">
              {/* Wood & Aluminum Blinds List */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
                <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
                  <span>มู่ลี่ไม้และมู่ลี่อะลูมิเนียม ({(settings.blindMaterials || []).length} รายการ)</span>
                  <span className="text-[10px] font-bold text-slate-400">WOOD & ALUMINUM BLINDS</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(settings.blindMaterials || []).map((item) => (
                    <div key={item.id} className="flex items-center justify-between bg-slate-50 border border-slate-150 p-2.5 rounded-xl text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                          {item.imageBase64 && <img src={item.imageBase64} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 truncate max-w-[130px]">{item.name}</p>
                          <p className="text-[10px] text-indigo-600 font-bold mt-0.5">{item.colorName}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveBlindMaterial(item.id, "blind")}
                        className="text-slate-400 hover:text-rose-500 p-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Roller Shades List */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
                <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
                  <span>ม่านม้วน ({(settings.rollerMaterials || []).length} รายการ)</span>
                  <span className="text-[10px] font-bold text-slate-400">ROLLER SHADES</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(settings.rollerMaterials || []).map((item) => (
                    <div key={item.id} className="flex items-center justify-between bg-slate-50 border border-slate-150 p-2.5 rounded-xl text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                          {item.imageBase64 && <img src={item.imageBase64} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 truncate max-w-[130px]">{item.name}</p>
                          <p className="text-[10px] text-indigo-600 font-bold mt-0.5">{item.colorName}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveBlindMaterial(item.id, "roller")}
                        className="text-slate-400 hover:text-rose-500 p-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Blinds Fabric Tape Ribbon List */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
                <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
                  <span>เทปผ้าสำหรับตกแต่งมู่ลี่ ({(settings.blindTapeMaterials || []).length} รายการ)</span>
                  <span className="text-[10px] font-bold text-slate-400">COTTON TAPE RIBBONS</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(settings.blindTapeMaterials || []).map((item) => (
                    <div key={item.id} className="flex items-center justify-between bg-slate-50 border border-slate-150 p-2.5 rounded-xl text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                          {item.imageBase64 && <img src={item.imageBase64} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 truncate max-w-[130px]">{item.name}</p>
                          <p className="text-[10px] text-indigo-600 font-bold mt-0.5">{item.colorName}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveBlindMaterial(item.id, "tape")}
                        className="text-slate-400 hover:text-rose-500 p-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* TAB: General (Tracks, Accessories & Light Control CRUD) */}
        {activeTab === "general" && (
          <div className="lg:col-span-3 space-y-6">
            {/* Gemini API Key Banner */}
            <div className="bg-gradient-to-r from-indigo-50 to-slate-50 border border-indigo-100 rounded-3xl p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1 max-w-2xl">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    การตั้งค่าคีย์ระบบประมวลผลรูปภาพ AI (Gemini AI Client Setting)
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    เพื่อประสิทธิภาพสูงสุดในการจำลองผ้าม่านด้วย AI แบบไม่จำกัดความเร็วและหมดปัญหาคีย์ชนกัน (429 Rate Limit) 
                    คุณสามารถเชื่อมต่อ Gemini API Key ส่วนตัวที่เปิดใช้งานการชำระเงินจริง (Pay-As-You-Go) ได้จาก Google AI Studio
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a 
                    href="https://aistudio.google.com" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                  >
                    รับ API Key ฟรี / อัปเกรดแผน
                  </a>
                </div>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row gap-3 max-w-2xl">
                <div className="relative flex-1">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={customApiKey}
                    onChange={(e) => setCustomApiKey(e.target.value)}
                    placeholder="ป้อน Gemini API Key ของคุณที่นี่ (AI_zaSy...)"
                    className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl pl-3 pr-10 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showApiKey ? <Eye className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onSaveSettings({ ...settings, customGeminiApiKey: customApiKey.trim() || undefined });
                      alert("บันทึกคีย์ Gemini ส่วนตัวเรียบร้อยแล้ว! ระบบจะเริ่มใช้งานคีย์นี้ทันที");
                    }}
                    className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer whitespace-nowrap"
                  >
                    บันทึกคีย์
                  </button>
                  {settings.customGeminiApiKey && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomApiKey("");
                        onSaveSettings({ ...settings, customGeminiApiKey: undefined });
                        alert("ลบคีย์ส่วนตัวแล้ว ระบบจะกลับไปใช้คีย์กลางฟรีของระบบ");
                      }}
                      className="bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold px-3 py-2.5 rounded-xl transition cursor-pointer whitespace-nowrap"
                    >
                      ลบออก
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <CustomMaterialCRUD
                label="ฐานข้อมูลรางม่านติดตั้ง (Hanging Tracks Database)"
                description="จัดการ ลบ เพิ่ม หรือแก้ไขข้อมูลชื่อรางติดตั้งเพื่อไปแสดงในระบบดรอปดาวน์ใบเสนอราคา"
                items={settings.trackMaterials || []}
                fieldKey="trackMaterials"
              />
              <CustomMaterialCRUD
                label="ฐานข้อมูลอุปกรณ์เสริมพ่วงติดตั้ง (Accessories Database)"
                description="สายรวบม่านพู่ระย้า หรืองานจับจีบอะคริลิคพกพาเพื่อเสริมราคาและสเปกการเย็บติดตั้งจริง"
                items={settings.accessoryMaterials || []}
                fieldKey="accessoryMaterials"
              />
              <FabricTypesCRUD />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
              <StringListCRUD
                label="ตัวเลือกการแขวนม่าน (Hanging Types)"
                description="แก้ไขรูปแบบการแขวนม่าน เช่น หัวผ้าม่านแขวนปิดรางม่าน, หัวผ้าม่านใต้รางม่าน, สวมห่วงตาไก่, ซ่อนในกล่องม่าน"
                items={settings.hangingTypes || []}
                fieldKey="hangingTypes"
                placeholder="เช่น หัวผ้าม่านแบบใหม่..."
              />
              <StringListCRUD
                label="รูปแบบการรวบใช้งาน (Operation / Usage Types)"
                description="รูปแบบเก็บผ้าม่าน เช่น แยกกลาง (แยกซ้าย-ขวา), เก็บข้างซ้าย (ฝั่งเดียว), เก็บข้างขวา (ฝั่งเดียว)"
                items={settings.usageTypes || []}
                fieldKey="usageTypes"
                placeholder="เช่น การรวบเก็บแบบใหม่..."
              />
              <StringListCRUD
                label="ระยะรอบวงกบม่าน (Clearance Spacing Offsets)"
                description="ระยะผ้าม่านเลยกรอบวงกบหน้าต่างด้านซ้าย ขวา บน ล่าง เช่น พอดีเฟรม, เลยเฟรม 10 ซม., เลยเฟรม 15 ซม., ติดเพดาน"
                items={settings.clearanceOptions || []}
                fieldKey="clearanceOptions"
                placeholder="เช่น เลยเฟรม 30 ซม...."
              />
            </div>
          </div>
        )}

      </div>

      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 flex items-start space-x-3 max-w-4xl">
        <ShieldAlert className="w-6 h-6 text-slate-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-500 leading-relaxed">
          <p className="font-bold text-slate-700 mb-1">ข้อแนะนำด้านพื้นที่และแสงสว่าง:</p>
          ฐานข้อมูลผ้าม่านประเภท <strong>Blackout (กันแสงได้ 100%)</strong> และ <strong>Sheer (ผ้าม่านโปร่งยอมให้แสงลอดผ่านได้ดี)</strong> 
          ช่วยให้แบบร่าง AI ประเมินการจำลองเอฟเฟกต์แสงเงากลางวันหลังสวมผ้าเข้ากับขอบเขตที่เลือกได้แม่นยำสูงสุด 
          โดยไม่สิ้นเปลืองพื้นที่ดิสก์ขอบคุณการบีบอัดภาพสวอชคุณภาพสูงแบบจัดเรียง
        </div>
      </div>
    </div>
  );
};
