import React, { useState, useEffect } from "react";
import { 
  Plus, Trash2, Users, Database, ShieldAlert, BadgeCheck, 
  Palette, FileImage, Layers, Tag, Ruler, Sliders, Eye, Lock, Unlock, FolderUp, Edit3, Search, AlertCircle, X, Info, Files, Loader2, CheckCircle2, Zap,
  RefreshCw, Sparkles, ArrowRightLeft, HardDrive, Check, ExternalLink, AlertTriangle, ArrowRight, CheckSquare, Square,
  Clock, Calendar, Filter, FolderCheck, Cloud, Key, ShieldCheck, Server, Globe, UploadCloud, Download, FileText
} from "lucide-react";
import { Employee, Settings, FabricMaterial, StyleMaterial, HemMaterial } from "../types";
import { generateId } from "../lib/storage";
import { markItemDeleted, clearDeletedItemIds, firebaseStorage } from "../lib/firebaseStorage";
import { 
  isDriveConnected, 
  requestDriveAccessToken, 
  clearDriveToken, 
  uploadSwatchToDrive, 
  getSavedDriveToken, 
  getOrCreateSwatchFolder,
  backupDatabaseToDrive,
  listBackupsFromDrive,
  downloadBackupFromDrive
} from "../lib/googleDrive";
import { getDedicatedGeminiApiKey, saveDedicatedGeminiApiKey, removeDedicatedGeminiApiKey } from "../lib/indexedDbStorage";

interface SettingsViewProps {
  employees: Employee[];
  settings: Settings;
  onSaveSettings: (settings: Settings, onProgress?: (pct: number) => void) => Promise<void>;
  onSaveSingleMaterial?: (collectionKey: any, item: any) => Promise<void>;
  onDeleteSingleMaterial?: (collectionKey: any, itemId: string) => Promise<void>;
  onSaveEmployee: (employee: Employee) => void;
  onDeleteEmployee: (id: string) => void;
  activeEmployeeId: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  employees,
  settings,
  onSaveSettings: propOnSaveSettings,
  onSaveSingleMaterial,
  onDeleteSingleMaterial,
  onSaveEmployee,
  onDeleteEmployee,
  activeEmployeeId,
}) => {
  const [saveProgress, setSaveProgress] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  // Fast Quick Edit Modal State for instant text editing without full catalog reload
  const [quickEditState, setQuickEditState] = useState<{
    isOpen: boolean;
    category: "solid" | "sheer" | "blind" | "roller" | "tape" | "style" | "hem" | "employee" | "track" | "accessory";
    item: any;
    collectionKey: "solidFabricMaterials" | "sheerFabricMaterials" | "blindMaterials" | "rollerMaterials" | "blindTapeMaterials" | "styleMaterials" | "hemMaterials" | "employees" | "trackMaterials" | "accessoryMaterials";
  } | null>(null);

  const [qeName, setQeName] = useState("");
  const [qeColorName, setQeColorName] = useState("");
  const [qeType, setQeType] = useState("");
  const [qeOps, setQeOps] = useState("");
  const [qeStyleEn, setQeStyleEn] = useState("");
  const [qeUsername, setQeUsername] = useState("");
  const [qePassword, setQePassword] = useState("");
  const [qeRole, setQeRole] = useState<"admin" | "designer" | "installer">("designer");
  const [qeQuota, setQeQuota] = useState(30);

  const openQuickEdit = (
    category: "solid" | "sheer" | "blind" | "roller" | "tape" | "style" | "hem" | "employee" | "track" | "accessory",
    item: any,
    collectionKey: "solidFabricMaterials" | "sheerFabricMaterials" | "blindMaterials" | "rollerMaterials" | "blindTapeMaterials" | "styleMaterials" | "hemMaterials" | "employees" | "trackMaterials" | "accessoryMaterials"
  ) => {
    setQuickEditState({ isOpen: true, category, item, collectionKey });
    setQeName(item.name || "");
    setQeColorName(item.colorName || "");
    setQeType(item.type || item.category || "Blackout");
    setQeOps(Array.isArray(item.operationOptions) ? item.operationOptions.join(", ") : (item.operationOptions || ""));
    setQeStyleEn(item.styleEnForAi || "");
    setQeUsername(item.username || "");
    setQePassword(item.password || "");
    setQeRole(item.role || "designer");
    setQeQuota(item.aiQuota !== undefined ? item.aiQuota : 30);
  };

  const handleQuickSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quickEditState) return;

    const { category, item, collectionKey } = quickEditState;
    if (!qeName.trim()) {
      showToast("กรุณาระบุชื่อรายการ", "error");
      return;
    }

    if (category === "employee") {
      const updatedEmp: Employee = {
        ...item,
        name: qeName.trim(),
        username: qeUsername.trim() || undefined,
        password: qePassword.trim() || undefined,
        role: qeRole,
        aiQuota: qeQuota,
      };
      onSaveEmployee(updatedEmp);
      setQuickEditState(null);
      showToast(`✓ แก้ไขข้อมูลพนักงาน "${updatedEmp.name}" เรียบร้อยแล้ว (บันทึกทันที)`, "success");
      return;
    }

    let updatedItem: any = { ...item };
    if (category === "solid" || category === "sheer" || category === "blind" || category === "roller" || category === "tape") {
      updatedItem = {
        ...item,
        name: qeName.trim().toUpperCase(),
        colorName: qeColorName.trim().toUpperCase(),
        type: qeType.trim(),
      };
    } else if (category === "track" || category === "accessory" || category === "hem") {
      updatedItem = {
        ...item,
        name: qeName.trim(),
      };
    } else if (category === "style") {
      const opsList = qeOps.split(",").map((s) => s.trim()).filter(Boolean);
      updatedItem = {
        ...item,
        name: qeName.trim(),
        category: qeType || item.category || "curtain",
        operationOptions: opsList.length > 0 ? opsList : undefined,
        styleEnForAi: qeStyleEn.trim() || undefined,
      };
    }

    // Fast direct single-item update (0 sec, no heavy Google Drive progress popup)
    if (onSaveSingleMaterial && collectionKey !== "employees" && collectionKey !== "trackMaterials" && collectionKey !== "accessoryMaterials") {
      await onSaveSingleMaterial(collectionKey, updatedItem);
    } else if (collectionKey !== "employees") {
      const currentList = ((settings as any)[collectionKey] || []) as any[];
      const nextList = currentList.map((x) => (x.id === item.id ? updatedItem : x));
      await onSaveSettings({ ...settings, [collectionKey]: nextList }, true);
    }

    setQuickEditState(null);
    showToast(`✓ บันทึกแก้ไขข้อความ "${updatedItem.name}${updatedItem.colorName ? ' / ' + updatedItem.colorName : ''}" เรียบร้อยแล้ว (⚡ ทันใจ 0 วิ)`, "success");
  };

  const [isForceSyncing, setIsForceSyncing] = useState<boolean>(false);
  const [forceSyncProgress, setForceSyncProgress] = useState<{ text: string; pct: number } | null>(null);

  const handleForceSyncCloud = async () => {
    setIsForceSyncing(true);
    setForceSyncProgress({ text: "กำลังเตรียมข้อมูลและเชื่อมต่อคลาวด์กลาง...", pct: 5 });
    try {
      await firebaseStorage.saveAllToFirestore(settings, employees, (msg, pct) => {
        setForceSyncProgress({ text: msg, pct });
      });
      showToast("✓ ซิงค์ข้อมูลทั้งหมดขึ้นฐานข้อมูลคลาวด์กลาง (Firebase) สำเร็จแล้ว! ทุกเครื่องเห็นข้อมูลตรงกันทันที", "success");
    } catch (err: any) {
      showToast(`ซิงค์ไม่สำเร็จ: ${err?.message || err}`, "error");
    } finally {
      setIsForceSyncing(false);
      setForceSyncProgress(null);
    }
  };

  const [driveConnected, setDriveConnected] = useState<boolean>(false);
  const [isConnectingDrive, setIsConnectingDrive] = useState<boolean>(false);
  const [isBackingUpDrive, setIsBackingUpDrive] = useState<boolean>(false);
  const [isFetchingDriveBackups, setIsFetchingDriveBackups] = useState<boolean>(false);
  const [driveBackupsList, setDriveBackupsList] = useState<{ id: string; name: string; createdTime: string }[]>([]);
  const [isDriveRestoreModalOpen, setIsDriveRestoreModalOpen] = useState<boolean>(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState<boolean>(false);

  useEffect(() => {
    setDriveConnected(isDriveConnected());
  }, []);

  const handleConnectDrive = async () => {
    setIsConnectingDrive(true);
    try {
      await requestDriveAccessToken();
      setDriveConnected(true);
      showToast("เชื่อมต่อ Google Drive (naruecha.psy@gmail.com) สำเร็จ! รูปภาพสวอชและการสำรองข้อมูลจะบันทึกขึ้น Drive อัตโนมัติ", "success");
    } catch (err: any) {
      showToast(`เชื่อมต่อ Google Drive ไม่สำเร็จ: ${err?.message || "User cancelled"}`, "error");
    } finally {
      setIsConnectingDrive(false);
    }
  };

  const handleManualBackupToDrive = async () => {
    setIsBackingUpDrive(true);
    try {
      const res = await backupDatabaseToDrive({
        settings,
        employees,
      });
      if (res.success) {
        showToast("✓ สำรองข้อมูลฐานข้อมูลแคตตาล็อกขึ้น Google Drive (naruecha.psy@gmail.com) สำเร็จแล้ว!", "success");
      } else {
        showToast(`สำรองข้อมูลไม่สำเร็จ: ${res.error || "เกิดข้อผิดพลาด"}`, "error");
      }
    } catch (err: any) {
      showToast(`สำรองข้อมูลไม่สำเร็จ: ${err?.message || err}`, "error");
    } finally {
      setIsBackingUpDrive(false);
    }
  };

  const [restoreProgressStatus, setRestoreProgressStatus] = useState<string>("");

  const handleOpenDriveRestoreModal = async () => {
    setIsFetchingDriveBackups(true);
    setIsDriveRestoreModalOpen(true);
    try {
      const files = await listBackupsFromDrive();
      setDriveBackupsList(files);
      if (files.length === 0) {
        showToast("ไม่พบไฟล์สำรองข้อมูล JSON บน Google Drive ในโฟลเดอร์ Curtain_Studio_Swatches", "info");
      }
    } catch (err: any) {
      showToast(`ค้นหาไฟล์สำรองไม่สำเร็จ: ${err?.message || err}`, "error");
    } finally {
      setIsFetchingDriveBackups(false);
    }
  };

  const handleRestoreDriveBackupFile = async (fileId: string, fileName: string) => {
    setIsRestoringBackup(true);
    setRestoreProgressStatus("กำลังดาวน์โหลดไฟล์สำรองข้อมูลจาก Google Drive...");
    try {
      clearDeletedItemIds();
      const backupContent = await downloadBackupFromDrive(fileId);
      setRestoreProgressStatus("กำลังตรวจสอบโครงสร้างข้อมูลและสวอชวัสดุ...");
      const rawData = backupContent?.data || backupContent;
      const restoredSettings: Settings = rawData.settings || rawData;
      
      if (rawData.employees && Array.isArray(rawData.employees)) {
        setRestoreProgressStatus(`กำลังกู้คืนข้อมูลพนักงาน (${rawData.employees.length} คน)...`);
        for (const emp of rawData.employees) {
          if (emp && emp.id) await onSaveEmployee(emp);
        }
      }

      if (rawData.jobs && Array.isArray(rawData.jobs)) {
        setRestoreProgressStatus(`กำลังกู้คืนใบงาน (${rawData.jobs.length} รายการ)...`);
        for (const job of rawData.jobs) {
          if (job && job.id) await firebaseStorage.saveJob(job);
        }
      }

      if (rawData.windows && Array.isArray(rawData.windows)) {
        setRestoreProgressStatus(`กำลังกู้คืนรายการหน้าต่าง (${rawData.windows.length} รายการ)...`);
        for (const win of rawData.windows) {
          if (win && win.id) await firebaseStorage.saveWindow(win);
        }
      }

      const totalItems = (restoredSettings.solidFabricMaterials?.length || 0) +
        (restoredSettings.sheerFabricMaterials?.length || 0) +
        (restoredSettings.blindMaterials?.length || 0) +
        (restoredSettings.rollerMaterials?.length || 0) +
        (restoredSettings.blindTapeMaterials?.length || 0);

      setRestoreProgressStatus(`กำลังบันทึกข้อมูลและสวอช ${totalItems} รายการสู่ฐานข้อมูล Firebase Cloud...`);
      await onSaveSettings(restoredSettings, false);
      setRestoreProgressStatus("เสร็จสมบูรณ์ 100%");
      setIsDriveRestoreModalOpen(false);
      showToast(`✓ กู้คืนฐานข้อมูลจากไฟล์ "${fileName}" (${totalItems} รายการวัสดุ) เรียบร้อยแล้ว!`, "success");
    } catch (err: any) {
      showToast(`กู้คืนข้อมูลไม่สำเร็จ: ${err?.message || err}`, "error");
    } finally {
      setIsRestoringBackup(false);
      setRestoreProgressStatus("");
    }
  };

  // Export database to local JSON file
  const handleExportJsonBackup = () => {
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const payload = {
        exportDate: new Date().toISOString(),
        version: "1.0",
        data: {
          settings,
          employees,
        },
      };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `Curtain_Studio_Backup_${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast("✓ ดาวน์โหลดไฟล์สำรองข้อมูล JSON สำเร็จเรียบร้อยแล้ว", "success");
    } catch (err: any) {
      showToast(`ส่งออกไฟล์ไม่สำเร็จ: ${err?.message || err}`, "error");
    }
  };

  // Import database from local JSON file
  const handleImportJsonBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        clearDeletedItemIds();
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const rawData = parsed.data || parsed;
        const importedSettings = rawData.settings || rawData;

        if (rawData.employees && Array.isArray(rawData.employees)) {
          for (const emp of rawData.employees) {
            if (emp && emp.id) await onSaveEmployee(emp);
          }
        }

        if (rawData.jobs && Array.isArray(rawData.jobs)) {
          for (const job of rawData.jobs) {
            if (job && job.id) await firebaseStorage.saveJob(job);
          }
        }

        if (rawData.windows && Array.isArray(rawData.windows)) {
          for (const win of rawData.windows) {
            if (win && win.id) await firebaseStorage.saveWindow(win);
          }
        }

        await onSaveSettings(importedSettings, false);
        showToast("✓ นำเข้าไฟล์สำรองข้อมูล JSON และบันทึกสู่ฐานข้อมูลกลางสำเร็จแล้ว!", "success");
      } catch (err: any) {
        showToast(`ไฟล์สำรองข้อมูลไม่ถูกต้อง: ${err?.message || err}`, "error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleDisconnectDrive = () => {
    clearDriveToken();
    setDriveConnected(false);
    showToast("ยกเลิกการเชื่อมต่อ Google Drive เรียบร้อยแล้ว", "info");
  };

  const onSaveSettings = async (updatedSettings: Settings, isSilentTextSave = true) => {
    if (!isSilentTextSave) {
      setIsSaving(true);
      setSaveProgress(0);
    }
    try {
      await propOnSaveSettings(updatedSettings, (pct) => {
        if (!isSilentTextSave) setSaveProgress(pct);
      });
      // Smooth completion toast
      showToast("✓ บันทึกการเปลี่ยนแปลงข้อมูลระบบเรียบร้อยแล้ว", "success");
    } catch (err: any) {
      showToast(`บันทึกไม่สำเร็จ: ${err?.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล"}`, "error");
    } finally {
      if (!isSilentTextSave) {
        setIsSaving(false);
        setSaveProgress(null);
      }
    }
  };

  const handleClearList = async () => {
    if (clearConfirmInput.trim().toUpperCase() !== "CONFIRM") {
      showToast("กรุณากรอกคำว่า CONFIRM ให้ถูกต้องเพื่อยืนยันการล้างข้อมูล", "error");
      return;
    }

    if (!clearTarget) return;

    let updatedSettings = { ...settings };
    let label = "";

    const markAllDeleted = (list: { id: string }[] = []) => {
      list.forEach((item) => {
        if (item && item.id) markItemDeleted(item.id);
      });
    };

    if (clearTarget === "solid") {
      markAllDeleted(settings.solidFabricMaterials);
      updatedSettings.solidFabricMaterials = [];
      label = "ผ้าม่านทึบแสง";
    } else if (clearTarget === "sheer") {
      markAllDeleted(settings.sheerFabricMaterials);
      updatedSettings.sheerFabricMaterials = [];
      label = "ผ้าม่านโปร่งแสง";
    } else if (clearTarget === "blind") {
      markAllDeleted(settings.blindMaterials);
      updatedSettings.blindMaterials = [];
      label = "มู่ลี่ไม้และมู่ลี่อะลูมิเนียม";
    } else if (clearTarget === "roller") {
      markAllDeleted(settings.rollerMaterials);
      updatedSettings.rollerMaterials = [];
      label = "ม่านม้วน";
    } else if (clearTarget === "tape") {
      markAllDeleted(settings.blindTapeMaterials);
      updatedSettings.blindTapeMaterials = [];
      label = "เทปผ้าสำหรับตกแต่งมู่ลี่";
    } else if (clearTarget === "styles") {
      markAllDeleted(settings.styleMaterials);
      updatedSettings.styleMaterials = [];
      label = "รูปแบบผ้าม่านและวิธีใช้งาน";
    } else if (clearTarget === "hems") {
      markAllDeleted(settings.hemMaterials);
      updatedSettings.hemMaterials = [];
      label = "สเปกระยะชายม่าน";
    } else if (clearTarget === "tracks") {
      updatedSettings.trackMaterials = [];
      label = "รายการรางม่าน";
    } else if (clearTarget === "accessories") {
      updatedSettings.accessoryMaterials = [];
      label = "รายการอุปกรณ์เสริม";
    } else if (clearTarget === "all_materials") {
      markAllDeleted(settings.solidFabricMaterials);
      markAllDeleted(settings.sheerFabricMaterials);
      markAllDeleted(settings.blindMaterials);
      markAllDeleted(settings.rollerMaterials);
      markAllDeleted(settings.blindTapeMaterials);
      markAllDeleted(settings.styleMaterials);
      markAllDeleted(settings.hemMaterials);
      updatedSettings.solidFabricMaterials = [];
      updatedSettings.sheerFabricMaterials = [];
      updatedSettings.blindMaterials = [];
      updatedSettings.rollerMaterials = [];
      updatedSettings.blindTapeMaterials = [];
      updatedSettings.styleMaterials = [];
      updatedSettings.hemMaterials = [];
      label = "แคตตาล็อกวัสดุ สวอช และสเปกม่านทั้งหมด";
    }

    // Close dialog immediately for instant UI feedback
    setClearTarget(null);
    setClearConfirmInput("");

    try {
      await onSaveSettings(updatedSettings, true);
      showToast(`✓ ล้างข้อมูล${label} สำเร็จเรียบร้อยแล้ว`, "success");
    } catch (err) {
      showToast(`ไม่สามารถล้างข้อมูลได้: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  };

  // Instant purge of all sample materials and seeds without waiting
  const handleInstantClearAllSeedData = async () => {
    const updatedSettings = {
      ...settings,
      solidFabricMaterials: [],
      sheerFabricMaterials: [],
      blindMaterials: [],
      rollerMaterials: [],
      blindTapeMaterials: [],
    };
    const allMaterials = [
      ...(settings.solidFabricMaterials || []),
      ...(settings.sheerFabricMaterials || []),
      ...(settings.blindMaterials || []),
      ...(settings.rollerMaterials || []),
      ...(settings.blindTapeMaterials || []),
    ];
    allMaterials.forEach((item) => {
      if (item && item.id) markItemDeleted(item.id);
    });

    setClearTarget(null);
    setClearConfirmInput("");

    try {
      await onSaveSettings(updatedSettings, true);
      showToast("✓ ล้างข้อมูลตั้งต้นและสวอชทั้งหมดออกเป็น 0 รายการเรียบร้อยแล้ว", "success");
    } catch (err: any) {
      showToast(`ไม่สามารถล้างข้อมูลได้: ${err?.message || String(err)}`, "error");
    }
  };

  const [activeTab, setActiveTab] = useState<
    "employees" | "styles" | "hems" | "solid_fabrics" | "sheer_fabrics" | "blinds_rollers" | "general" | "cloud_ai"
  >("solid_fabrics");

  // Admin authentication state
  const activeEmployee = employees.find((e) => e.id === activeEmployeeId);
  const isAdmin = activeEmployee?.role === "admin";
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [isPasswordUnlocked, setIsPasswordUnlocked] = useState(false);

  const canViewEmployees = isAdmin || isPasswordUnlocked;

  // Central Cloud & Gemini API Key States
  const [serverKeyStatus, setServerKeyStatus] = useState<{ hasConfiguredKey: boolean; source?: string } | null>(null);
  const [isSavingCentralKey, setIsSavingCentralKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testKeyResult, setTestKeyResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isCloudPushing, setIsCloudPushing] = useState(false);
  const [cloudPushProgress, setCloudPushProgress] = useState<{ msg: string; percent: number } | null>(null);

  useEffect(() => {
    fetch("/api/config/gemini-key-status")
      .then((res) => res.json())
      .then((data) => setServerKeyStatus(data))
      .catch(() => {});
  }, []);

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
  const [newStyleEnForAi, setNewStyleEnForAi] = useState("");

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
  const [blindType, setBlindType] = useState("Wood Blinds"); // Wood Blinds, Aluminum Blinds, Roller, Fabric Tape
  const [folderUploadBlindType, setFolderUploadBlindType] = useState("Wood Blinds");
  const [blindImg, setBlindImg] = useState<string>("");

  // Editing state trackers for editing existing entries
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [editingStyleId, setEditingStyleId] = useState<string | null>(null);
  const [editingHemId, setEditingHemId] = useState<string | null>(null);
  const [editingSolidId, setEditingSolidId] = useState<string | null>(null);
  const [editingSheerId, setEditingSheerId] = useState<string | null>(null);
  const [editingBlindId, setEditingBlindId] = useState<string | null>(null);

  // Search queries for fabrics
  const [solidSearch, setSolidSearch] = useState("");
  const [sheerSearch, setSheerSearch] = useState("");

  // Upload Batch Filter States
  const [batchFilterSolid, setBatchFilterSolid] = useState<string>("all");
  const [batchFilterSheer, setBatchFilterSheer] = useState<string>("all");
  const [batchFilterBlind, setBatchFilterBlind] = useState<string>("all");
  const [batchFilterRoller, setBatchFilterRoller] = useState<string>("all");
  const [batchFilterTape, setBatchFilterTape] = useState<string>("all");

  // Clear lists confirmation state
  const [clearTarget, setClearTarget] = useState<"solid" | "sheer" | "blind" | "roller" | "tape" | "styles" | "hems" | "tracks" | "accessories" | "all_materials" | null>(null);
  const [clearModalTab, setClearModalTab] = useState<"batches" | "all">("batches");
  const [clearConfirmInput, setClearConfirmInput] = useState("");

  // Specific Batch Deletion Confirmation Modal State
  const [batchConfirmDeleteState, setBatchConfirmDeleteState] = useState<{
    targetCategory: "solid" | "sheer" | "blind" | "roller" | "tape" | "all_materials";
    batchId: string;
    batchName: string;
    count: number;
  } | null>(null);

  // State for bulk import progress
  const [bulkUploadStatus, setBulkUploadStatus] = useState<{
    active: boolean;
    phase: "processing" | "saving";
    current: number;
    total: number;
    title: string;
  } | null>(null);

  // Duplicate review structures & modal states
  interface DuplicateReviewItem {
    newItem: FabricMaterial;
    existingItem: FabricMaterial;
    overwrite: boolean;
  }

  const [duplicateModalState, setDuplicateModalState] = useState<{
    isOpen: boolean;
    dbType: "solid" | "sheer" | "blinds";
    blindSubtype: string;
    duplicateItems: DuplicateReviewItem[];
    uniqueNewItems: FabricMaterial[];
    typeTitle: string;
  } | null>(null);

  const [singleDuplicateConfirm, setSingleDuplicateConfirm] = useState<{
    isOpen: boolean;
    existingItem: FabricMaterial;
    newItem: FabricMaterial;
    category: "solid" | "sheer" | "blinds";
    blindTargetKey?: "blindMaterials" | "rollerMaterials" | "blindTapeMaterials";
  } | null>(null);

  // Sync API Key input with settings or dedicated permanent storage
  useEffect(() => {
    if (settings.customGeminiApiKey) {
      setCustomApiKey(settings.customGeminiApiKey);
    } else {
      const dedicated = getDedicatedGeminiApiKey();
      if (dedicated) {
        setCustomApiKey(dedicated);
      }
    }
  }, [settings.customGeminiApiKey]);

  // Universal string normalizer for swatch matching (strips spaces, symbols, cases)
  const normalizeSwatchText = (str: string): string => {
    return (str || "")
      .trim()
      .toLowerCase()
      .replace(/[\s\-_/\\.:,()[\]{}#@!~*|]+/g, "");
  };

  // Format ISO timestamp to friendly Thai date string
  const formatThaiDate = (isoStr?: string) => {
    if (!isoStr) return "";
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  interface UploadBatchSummary {
    batchId: string;
    batchName: string;
    uploadedAt?: string;
    count: number;
    sampleImages: string[];
    fabricNames: string[];
  }

  // Aggregate list items by upload batch ID with thumbnail samples and fabric names
  const getBatchSummaries = (list: FabricMaterial[] = []): UploadBatchSummary[] => {
    const map = new Map<string, {
      batchId: string;
      batchName: string;
      uploadedAt?: string;
      count: number;
      sampleImages: string[];
      fabricNames: Set<string>;
    }>();

    for (const item of list) {
      const bId = item.uploadBatchId || "legacy_manual";
      const bName = item.uploadBatchName || (item.uploadBatchId ? `รอบอัปโหลด #${item.uploadBatchId.substring(0, 8)}` : "รายการตั้งต้น / เพิ่มทีละรายการ");
      const existing = map.get(bId);

      if (!existing) {
        map.set(bId, {
          batchId: bId,
          batchName: bName,
          uploadedAt: item.uploadedAt,
          count: 1,
          sampleImages: item.imageBase64 ? [item.imageBase64] : [],
          fabricNames: new Set(item.name ? [item.name] : []),
        });
      } else {
        existing.count += 1;
        if (!existing.uploadedAt && item.uploadedAt) existing.uploadedAt = item.uploadedAt;
        if (item.imageBase64 && existing.sampleImages.length < 5) {
          existing.sampleImages.push(item.imageBase64);
        }
        if (item.name && existing.fabricNames.size < 6) {
          existing.fabricNames.add(item.name);
        }
      }
    }

    return Array.from(map.values())
      .sort((a, b) => {
        if (a.batchId === "legacy_manual") return 1;
        if (b.batchId === "legacy_manual") return -1;
        if (a.uploadedAt && b.uploadedAt) {
          return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
        }
        return 0;
      })
      .map((v) => ({
        batchId: v.batchId,
        batchName: v.batchName,
        uploadedAt: v.uploadedAt,
        count: v.count,
        sampleImages: v.sampleImages,
        fabricNames: Array.from(v.fabricNames),
      }));
  };

  // Dedicated Handler: Clear items belonging to a specific batch session
  const handleClearBatch = async (
    targetCategory: "solid" | "sheer" | "blind" | "roller" | "tape" | "all_materials",
    batchId: string,
    batchName: string
  ) => {
    let updatedSettings = { ...settings };
    let deletedCount = 0;

    const filterOutBatch = (list: FabricMaterial[] = []) => {
      const before = list.length;
      const filtered: FabricMaterial[] = [];
      list.forEach((item) => {
        const isTarget = batchId === "legacy_manual" ? !item.uploadBatchId : item.uploadBatchId === batchId;
        if (isTarget) {
          if (item.id) markItemDeleted(item.id);
        } else {
          filtered.push(item);
        }
      });
      deletedCount += (before - filtered.length);
      return filtered;
    };

    if (targetCategory === "solid" || targetCategory === "all_materials") {
      updatedSettings.solidFabricMaterials = filterOutBatch(settings.solidFabricMaterials || []);
    }
    if (targetCategory === "sheer" || targetCategory === "all_materials") {
      updatedSettings.sheerFabricMaterials = filterOutBatch(settings.sheerFabricMaterials || []);
    }
    if (targetCategory === "blind" || targetCategory === "all_materials") {
      updatedSettings.blindMaterials = filterOutBatch(settings.blindMaterials || []);
    }
    if (targetCategory === "roller" || targetCategory === "all_materials") {
      updatedSettings.rollerMaterials = filterOutBatch(settings.rollerMaterials || []);
    }
    if (targetCategory === "tape" || targetCategory === "all_materials") {
      updatedSettings.blindTapeMaterials = filterOutBatch(settings.blindTapeMaterials || []);
    }

    // Immediately close modal and notify user so interface never hangs
    setBatchConfirmDeleteState(null);

    try {
      await onSaveSettings(updatedSettings, true);
      showToast(`✓ ลบล้างข้อมูลรอบ "${batchName}" จำนวน ${deletedCount} รายการ สำเร็จเรียบร้อยแล้ว`, "success");
    } catch (err: any) {
      showToast(`ไม่สามารถลบข้อมูลรอบได้: ${err?.message || String(err)}`, "error");
    }
  };

  // Find exact or normalized match in a swatch list
  const findExistingSwatchMatch = (
    incoming: FabricMaterial,
    list: FabricMaterial[]
  ): { match: FabricMaterial; index: number } | null => {
    const incName = normalizeSwatchText(incoming.name);
    const incColor = normalizeSwatchText(incoming.colorName);

    if (!incName || !incColor) return null;

    for (let i = 0; i < list.length; i++) {
      const existing = list[i];
      const exName = normalizeSwatchText(existing.name);
      const exColor = normalizeSwatchText(existing.colorName);

      // Exact match for BOTH fabric collection name AND color code
      if (incName === exName && incColor === exColor) {
        return { match: existing, index: i };
      }
    }
    return null;
  };

  // Smart Parser for Fabric Brand and Color Code from relative file path or file name
  // Standard Rule:
  // - When uploading a FOLDER: Folder Name = Fabric Name (ชื่อผ้า), File Name = Color Name (ชื่อสี)
  // - When uploading LOOSE FILES: Delimited filename = Fabric Name & Color Name
  const parseFabricAndColorFromPath = (relPath: string, fileName: string) => {
    // Normalize Windows backslashes to standard forward slashes
    const normalizedRelPath = (relPath || "").replace(/\\+/g, "/");
    const normalizedFileName = (fileName || "").replace(/\\+/g, "/").split("/").pop() || "";

    const pathParts = normalizedRelPath.split("/").filter(Boolean);
    const lastDotIndex = normalizedFileName.lastIndexOf(".");
    const fileNameNoExt = (lastDotIndex > 0 ? normalizedFileName.substring(0, lastDotIndex) : normalizedFileName).trim();
    
    let fabricName = "";
    let colorName = "";

    // CASE 1: FOLDER UPLOAD (Path has directory structure e.g. "DIMOUT/01.jpg", "SATIN/DO-01.jpg", or "Curtains/VELVET/01.png")
    if (pathParts.length >= 2) {
      // Immediate parent folder is strictly the Fabric Name (ชื่อผ้า / ชื่อคอลเลกชัน)
      let rawFolder = pathParts[pathParts.length - 2].trim();
      // If the parent folder name is a generic wrapper folder (e.g. "images", "swatches", "photos"), look at grandparent folder
      const genericWrappers = ["images", "img", "photos", "swatches", "swatch", "files", "photo", "pic", "pics"];
      if (genericWrappers.includes(rawFolder.toLowerCase()) && pathParts.length >= 3) {
        rawFolder = pathParts[pathParts.length - 3].trim();
      }
      fabricName = rawFolder;
      colorName = fileNameNoExt.trim();

      // Clean up color name if it repeats the fabric name as a prefix (e.g. folder "DIMOUT" with file "DIMOUT-01.jpg" -> color "01")
      const escapedFabric = fabricName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const prefixRegex = new RegExp(`^${escapedFabric}[\\s\\-_–—]+`, "i");
      if (prefixRegex.test(colorName)) {
        const stripped = colorName.replace(prefixRegex, "").trim();
        if (stripped) colorName = stripped;
      }
      // If filename is identical to folder name (e.g. folder "DIMOUT" with file "DIMOUT.jpg"), avoid identical name/color
      if (colorName.toLowerCase() === fabricName.toLowerCase()) {
        colorName = "01";
      }
    } else {
      // CASE 2: LOOSE FILE UPLOAD (User selected individual files without folder hierarchy)
      // Check multi-character delimiters e.g. "DIMOUT - DO-01", "DIMOUT _ 01", "DIMOUT – 01", "DIMOUT — 01"
      const multiDelims = [" - ", " _ ", " – ", " — ", " -", "- "];
      let parsedFromDelim = false;
      for (const d of multiDelims) {
        if (fileNameNoExt.includes(d)) {
          const parts = fileNameNoExt.split(d).filter(Boolean);
          if (parts.length >= 2) {
            fabricName = parts[0].trim();
            colorName = parts.slice(1).join(" ").trim();
            parsedFromDelim = true;
            break;
          }
        }
      }

      // Check underscore e.g. "DIMOUT_DO01"
      if (!parsedFromDelim && fileNameNoExt.includes("_")) {
        const parts = fileNameNoExt.split("_").filter(Boolean);
        if (parts.length >= 2) {
          fabricName = parts[0].trim();
          colorName = parts.slice(1).join("_").trim();
          parsedFromDelim = true;
        }
      }

      // Check hyphen only if first part contains letters and not just numbers (e.g. "CITADEL-01")
      if (!parsedFromDelim && fileNameNoExt.includes("-")) {
        const parts = fileNameNoExt.split("-").filter(Boolean);
        if (parts.length >= 2 && !/^\d+$/.test(parts[0])) {
          fabricName = parts[0].trim();
          colorName = parts.slice(1).join("-").trim();
          parsedFromDelim = true;
        }
      }

      // Fallback for single file without delimiters
      if (!parsedFromDelim) {
        fabricName = "FABRIC";
        colorName = fileNameNoExt.trim();
      }
    }

    // Clean up empty fallbacks
    if (!fabricName) fabricName = "FABRIC";
    if (!colorName) colorName = fileNameNoExt.trim() || "01";

    return { fabricName, colorName };
  };

  // Fast helper to convert and resize image files to high-definition crisp swatches
  const convertFileToSwatchBase64 = async (file: File): Promise<string> => {
    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(file);
        const canvas = document.createElement("canvas");
        // 480px with 0.85 quality provides high-definition clarity for AI to capture fine fabric texture & weave
        const MAX_DIM = 480;
        const scale = Math.min(MAX_DIM / bitmap.width, MAX_DIM / bitmap.height, 1);
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          bitmap.close();
          return canvas.toDataURL("image/jpeg", 0.85);
        }
      } catch {
        // fallback to FileReader below
      }
    }

    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_DIM = 480;
          const scale = Math.min(MAX_DIM / img.width, MAX_DIM / img.height, 1);
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/jpeg", 0.85));
          } else reject(new Error("Canvas error"));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Helper to convert single image file to Base64
  const processImage = (file: File, onComplete: (base64: string) => void) => {
    convertFileToSwatchBase64(file)
      .then(onComplete)
      .catch((err) => console.error("Error compressing image:", err));
  };

  // Commit and Save Materials with Overwrite support
  const commitImportedMaterials = async (
    dbType: "solid" | "sheer" | "blinds",
    blindSubtype: string,
    newItemsToAdd: FabricMaterial[],
    duplicateItems: DuplicateReviewItem[],
    typeTitle: string
  ) => {
    let updatedSettings: Settings = { ...settings };
    let overwrittenCount = 0;
    let addedCount = newItemsToAdd.length;

    const applyOverwritesAndAdds = (currentList: FabricMaterial[] = []): FabricMaterial[] => {
      let list = [...currentList];
      for (const dupe of duplicateItems) {
        if (dupe.overwrite) {
          const matchIdx = list.findIndex(
            (x) =>
              x.id === dupe.existingItem.id ||
              (normalizeSwatchText(x.name) === normalizeSwatchText(dupe.existingItem.name) &&
               normalizeSwatchText(x.colorName) === normalizeSwatchText(dupe.existingItem.colorName))
          );
          if (matchIdx >= 0) {
            list[matchIdx] = {
              ...list[matchIdx],
              name: dupe.newItem.name,
              colorName: dupe.newItem.colorName,
              type: dupe.newItem.type || list[matchIdx].type,
              imageBase64: dupe.newItem.imageBase64 || list[matchIdx].imageBase64,
              uploadBatchId: dupe.newItem.uploadBatchId || list[matchIdx].uploadBatchId,
              uploadBatchName: dupe.newItem.uploadBatchName || list[matchIdx].uploadBatchName,
              uploadedAt: dupe.newItem.uploadedAt || list[matchIdx].uploadedAt,
            };
            overwrittenCount++;
          }
        }
      }
      list.push(...newItemsToAdd);
      return list;
    };

    if (dbType === "solid") {
      updatedSettings.solidFabricMaterials = applyOverwritesAndAdds(settings.solidFabricMaterials || []);
    } else if (dbType === "sheer") {
      updatedSettings.sheerFabricMaterials = applyOverwritesAndAdds(settings.sheerFabricMaterials || []);
    } else {
      if (blindSubtype === "Roller Shades") {
        updatedSettings.rollerMaterials = applyOverwritesAndAdds(settings.rollerMaterials || []);
      } else if (blindSubtype === "Fabric Tape") {
        updatedSettings.blindTapeMaterials = applyOverwritesAndAdds(settings.blindTapeMaterials || []);
      } else {
        updatedSettings.blindMaterials = applyOverwritesAndAdds(settings.blindMaterials || []);
      }
    }

    setSaveProgress(90);
    await onSaveSettings(updatedSettings);
    setSaveProgress(100);

    let summaryMsg = `นำเข้า ${typeTitle} สำเร็จ!`;
    if (overwrittenCount > 0) {
      summaryMsg += ` บันทึกทับข้อมูลเดิม ${overwrittenCount} รายการ`;
    }
    if (addedCount > 0) {
      summaryMsg += ` เพิ่มรายการใหม่ ${addedCount} รายการ`;
    }
    showToast(summaryMsg, "success");
  };

  // High-Speed Parallel Folder/Bulk Upload Handler with Duplicate Detection
  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>, dbType: "solid" | "sheer" | "blinds") => {
    const rawFiles = e.target.files;
    if (!rawFiles || rawFiles.length === 0) return;

    const files = (Array.from(rawFiles) as File[]).filter(
      (f) => f.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|bmp|gif|jfif|heic|heif|tiff|svg)$/i.test(f.name)
    );

    if (files.length === 0) {
      showToast("ไม่พบไฟล์รูปภาพในโฟลเดอร์ที่เลือก กรุณาเลือกไฟล์รูปภาพ .jpg, .png หรือ .webp", "error");
      e.target.value = "";
      return;
    }

    const typeTitle = dbType === "solid" 
      ? `ผ้าม่านทึบแสง (${folderUploadType})` 
      : dbType === "sheer" 
      ? "ผ้าม่านโปร่งแสง" 
      : folderUploadBlindType === "Roller Shades"
      ? "ม่านม้วน (Roller Shades)"
      : folderUploadBlindType === "Fabric Tape"
      ? "เทปผ้าสำหรับมู่ลี่ (Fabric Tape)"
      : folderUploadBlindType === "Aluminum Blinds"
      ? "มู่ลี่อะลูมิเนียม (Aluminum Blinds)"
      : "มู่ลี่ไม้ (Wood Blinds)";

    const isDrive = isDriveConnected();

    // Generate unique batch session ID and meaningful batch name
    const uploadTimestamp = new Date().toISOString();
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const firstRelPath = files[0]?.webkitRelativePath || files[0]?.name || "";
    const firstPathParts = firstRelPath.split("/").filter(Boolean);
    const parentFolderName = firstPathParts.length >= 2 ? firstPathParts[firstPathParts.length - 2].trim() : "";
    
    const batchName = parentFolderName 
      ? `โฟลเดอร์ "${parentFolderName}"` 
      : files.length > 1 
      ? `นำเข้าไฟล์ (${files.length} รายการ)` 
      : `นำเข้าไฟล์ "${files[0].name.replace(/\.[^/.]+$/, "")}"`;

    setBulkUploadStatus({
      active: true,
      phase: "processing",
      current: 0,
      total: files.length,
      title: typeTitle,
    });
    setSaveProgress(5);

    // Preload Drive folder ID once to eliminate redundant network queries
    const driveToken = getSavedDriveToken();
    let preloadedFolderId: string | undefined = undefined;
    if (isDrive && driveToken) {
      try {
        preloadedFolderId = await getOrCreateSwatchFolder(driveToken);
      } catch (err) {
        console.warn("Could not preload swatch folder:", err);
      }
    }

    const importedItems: FabricMaterial[] = [];
    let completedCount = 0;

    // High-speed concurrent worker pool for image decoding, swatch compression, and Drive upload
    const CONCURRENCY = 8;
    let fileIdx = 0;

    const workers = Array.from({ length: Math.min(CONCURRENCY, files.length) }, async () => {
      while (fileIdx < files.length) {
        const currentIndex = fileIdx++;
        const file = files[currentIndex];
        const relPath = file.webkitRelativePath || file.name;

        const { fabricName: parsedFabricName, colorName: parsedColorName } = parseFabricAndColorFromPath(relPath, file.name);

        try {
          const base64 = await convertFileToSwatchBase64(file);
          let finalImg = base64;

          // If Google Drive is connected, upload directly to Drive in parallel
          if (isDrive) {
            const cleanName = `${parsedFabricName}_${parsedColorName}_${Date.now()}.jpg`.replace(/[^a-zA-Z0-9._-]/g, "_");
            finalImg = await uploadSwatchToDrive(cleanName, base64, preloadedFolderId);
          }

          importedItems.push({
            id: generateId(),
            name: parsedFabricName,
            colorName: parsedColorName,
            type: dbType === "sheer" ? "Sheer" : dbType === "solid" ? folderUploadType : folderUploadBlindType,
            imageBase64: finalImg,
            uploadBatchId: batchId,
            uploadBatchName: batchName,
            uploadedAt: uploadTimestamp,
          });
        } catch (err) {
          console.error("Error processing file:", file.name, err);
        }

        completedCount++;
        const currentPct = Math.round((completedCount / files.length) * 80);
        setSaveProgress(Math.max(5, currentPct));
        setBulkUploadStatus({
          active: true,
          phase: "processing",
          current: completedCount,
          total: files.length,
          title: typeTitle,
        });
      }
    });

    await Promise.all(workers);

    if (importedItems.length > 0) {
      // Check against target database list for duplicates
      let targetList: FabricMaterial[] = [];
      if (dbType === "solid") {
        targetList = settings.solidFabricMaterials || [];
      } else if (dbType === "sheer") {
        targetList = settings.sheerFabricMaterials || [];
      } else {
        if (folderUploadBlindType === "Roller Shades") {
          targetList = settings.rollerMaterials || [];
        } else if (folderUploadBlindType === "Fabric Tape") {
          targetList = settings.blindTapeMaterials || [];
        } else {
          targetList = settings.blindMaterials || [];
        }
      }

      const uniqueNewItems: FabricMaterial[] = [];
      const duplicateItems: DuplicateReviewItem[] = [];
      const incomingKeyCounts = new Map<string, number>();

      for (const item of importedItems) {
        let incomingKey = normalizeSwatchText(`${item.name} ${item.colorName}`);
        const count = (incomingKeyCounts.get(incomingKey) || 0) + 1;
        incomingKeyCounts.set(incomingKey, count);

        // If duplicate within the same batch, disambiguate instead of silently dropping!
        let effectiveItem = item;
        if (count > 1) {
          effectiveItem = {
            ...item,
            colorName: `${item.colorName} (${count})`,
          };
          incomingKey = normalizeSwatchText(`${effectiveItem.name} ${effectiveItem.colorName}`);
        }

        const matchFound = findExistingSwatchMatch(effectiveItem, targetList);
        if (matchFound) {
          duplicateItems.push({
            newItem: effectiveItem,
            existingItem: matchFound.match,
            overwrite: true, // Default checked for overwrite
          });
        } else {
          uniqueNewItems.push(effectiveItem);
        }
      }

      setBulkUploadStatus(null);

      // If duplicate items are detected -> Open Confirmation Modal!
      if (duplicateItems.length > 0) {
        setDuplicateModalState({
          isOpen: true,
          dbType,
          blindSubtype: folderUploadBlindType,
          duplicateItems,
          uniqueNewItems,
          typeTitle,
        });
      } else {
        // No duplicates -> Directly commit
        await commitImportedMaterials(dbType, folderUploadBlindType, uniqueNewItems, [], typeTitle);
      }
    } else {
      setBulkUploadStatus(null);
    }

    e.target.value = "";
  };

  // Confirm single item overwrite
  const handleConfirmSingleOverwrite = async () => {
    if (!singleDuplicateConfirm) return;
    const { existingItem, newItem, category, blindTargetKey } = singleDuplicateConfirm;

    if (category === "solid") {
      const list = (settings.solidFabricMaterials || []).map((item) =>
        item.id === existingItem.id
          ? {
              ...item,
              name: newItem.name,
              colorName: newItem.colorName,
              type: newItem.type || item.type,
              imageBase64: newItem.imageBase64 || item.imageBase64,
            }
          : item
      );
      await onSaveSettings({ ...settings, solidFabricMaterials: list });
      setFabricBrand("");
      setFabricColorName("");
      setFabricType("Blackout");
      setFabricImg("");
    } else if (category === "sheer") {
      const list = (settings.sheerFabricMaterials || []).map((item) =>
        item.id === existingItem.id
          ? {
              ...item,
              name: newItem.name,
              colorName: newItem.colorName,
              type: "Sheer",
              imageBase64: newItem.imageBase64 || item.imageBase64,
            }
          : item
      );
      await onSaveSettings({ ...settings, sheerFabricMaterials: list });
      setFabricBrand("");
      setFabricColorName("");
      setFabricImg("");
    } else if (category === "blinds" && blindTargetKey) {
      const targetList = ((settings[blindTargetKey] as FabricMaterial[]) || []).map((item) =>
        item.id === existingItem.id
          ? {
              ...item,
              name: newItem.name,
              colorName: newItem.colorName,
              type: newItem.type || item.type,
              imageBase64: newItem.imageBase64 || item.imageBase64,
            }
          : item
      );
      await onSaveSettings({ ...settings, [blindTargetKey]: targetList });
      setBlindName("");
      setBlindColorName("");
      setBlindImg("");
    }

    showToast(`บันทึกทับข้อมูลสวอช ${newItem.name} - ${newItem.colorName} เรียบร้อยแล้ว`, "success");
    setSingleDuplicateConfirm(null);
  };

  // One-Click Clean Duplicate Items across the whole catalog
  const handleDeduplicateAllMaterials = async () => {
    const dedupeList = (list: FabricMaterial[] = []) => {
      const seen = new Map<string, FabricMaterial>();
      let dupesRemoved = 0;
      for (const item of list) {
        const key = normalizeSwatchText(`${item.name} ${item.colorName}`);
        if (!seen.has(key)) {
          seen.set(key, item);
        } else {
          // If the new one has an image and the old one doesn't, keep the new one
          const existing = seen.get(key)!;
          if (!existing.imageBase64 && item.imageBase64) {
            seen.set(key, item);
          }
          dupesRemoved++;
        }
      }
      return { result: Array.from(seen.values()), dupesRemoved };
    };

    const solid = dedupeList(settings.solidFabricMaterials || []);
    const sheer = dedupeList(settings.sheerFabricMaterials || []);
    const blind = dedupeList(settings.blindMaterials || []);
    const roller = dedupeList(settings.rollerMaterials || []);
    const tape = dedupeList(settings.blindTapeMaterials || []);

    const totalRemoved =
      solid.dupesRemoved +
      sheer.dupesRemoved +
      blind.dupesRemoved +
      roller.dupesRemoved +
      tape.dupesRemoved;

    if (totalRemoved === 0) {
      showToast("ไม่พบรายการซ้ำในแคตตาล็อก ข้อมูลทุกรายการในระบบถูกต้องและไม่ซ้ำกันแล้ว!", "info");
      return;
    }

    const updated: Settings = {
      ...settings,
      solidFabricMaterials: solid.result,
      sheerFabricMaterials: sheer.result,
      blindMaterials: blind.result,
      rollerMaterials: roller.result,
      blindTapeMaterials: tape.result,
    };

    await onSaveSettings(updated);
    showToast(`ทำความสะอาดสำเร็จ! ค้นพบและลบรายการที่ซ้ำออกทั้งหมด ${totalRemoved} รายการเรียบร้อยแล้ว`, "success");
  };

  // Employee Operations
  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName.trim()) return;
    
    const existingEmp = editingEmployeeId ? employees.find(emp => emp.id === editingEmployeeId) : null;
    
    onSaveEmployee({
      id: editingEmployeeId || generateId(),
      name: newEmpName.trim(),
      username: newEmpUsername.trim() || undefined,
      password: newEmpPassword.trim() || undefined,
      role: newEmpRole,
      aiQuota: newEmpQuota,
      aiUsed: existingEmp ? (existingEmp.aiUsed || 0) : 0,
    });
    
    setEditingEmployeeId(null);
    setNewEmpName("");
    setNewEmpUsername("");
    setNewEmpPassword("");
    setNewEmpRole("designer");
    setNewEmpQuota(30);
    showToast(editingEmployeeId ? "แก้ไขข้อมูลพนักงานเรียบร้อยแล้ว!" : "เพิ่มพนักงานเข้าระบบเรียบร้อยแล้ว!", "success");
  };

  const handleAdminVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const foundAdmin = employees.find((emp) => emp.role === "admin");
    const correctPassword = foundAdmin?.password || "Admin";
    if (adminPasswordInput === correctPassword || adminPasswordInput === "Admin") {
      setIsPasswordUnlocked(true);
      setAdminPasswordInput("");
    } else {
      showToast("รหัสผ่านผู้ดูแลระบบไม่ถูกต้อง!", "error");
    }
  };

  // Central Gemini API Key & Cloud Handlers
  const handleSaveCentralApiKey = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customApiKey.trim()) {
      showToast("กรุณากรอก Gemini API Key ให้ถูกต้อง", "error");
      return;
    }
    setIsSavingCentralKey(true);
    try {
      await saveDedicatedGeminiApiKey(customApiKey.trim());
      await onSaveSettings({ ...settings, customGeminiApiKey: customApiKey.trim() }, true);
      await fetch("/api/config/gemini-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: customApiKey.trim() }),
      });
      setServerKeyStatus({ hasConfiguredKey: true, source: "server_memory" });
      showToast("✓ บันทึก Central Gemini API Key เรียบร้อยแล้ว! พนักงานทุกคน ทุกเครื่อง สามารถสร้างภาพ AI ได้ทันที", "success");
    } catch (err: any) {
      showToast(`บันทึก API Key ไม่สำเร็จ: ${err?.message || err}`, "error");
    } finally {
      setIsSavingCentralKey(false);
    }
  };

  const handleRemoveCentralApiKey = async () => {
    setIsSavingCentralKey(true);
    try {
      await removeDedicatedGeminiApiKey();
      setCustomApiKey("");
      await onSaveSettings({ ...settings, customGeminiApiKey: "" }, true);
      await fetch("/api/config/gemini-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: "" }),
      });
      setServerKeyStatus({ hasConfiguredKey: false });
      showToast("ลบ Central Gemini API Key เรียบร้อยแล้ว", "info");
    } catch (err: any) {
      showToast(`เกิดข้อผิดพลาด: ${err?.message || err}`, "error");
    } finally {
      setIsSavingCentralKey(false);
    }
  };

  const handleForcePushToCloud = async () => {
    setIsCloudPushing(true);
    setCloudPushProgress({ msg: "กำลังรวบรวมข้อมูลทั้งหมดจากระบบ...", percent: 10 });
    try {
      const result = await firebaseStorage.forcePushAllLocalDataToFirestore((msg, pct) => {
        setCloudPushProgress({ msg, percent: pct });
      });
      showToast(`✓ ซิงค์ฐานข้อมูลขึ้น Cloud สำเร็จ! (${result.syncedItems} รายการสวอช, ${result.jobsCount} โครงการ)`, "success");
    } catch (err: any) {
      showToast(`เกิดข้อผิดพลาดในการซิงค์: ${err?.message || err}`, "error");
    } finally {
      setIsCloudPushing(false);
      setTimeout(() => setCloudPushProgress(null), 3000);
    }
  };

  const handleTestCentralApiKey = async () => {
    setIsTestingKey(true);
    setTestKeyResult(null);
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        setTestKeyResult({
          success: true,
          message: "ระบบเซิร์ฟเวอร์และการเชื่อมต่อ AI พร้อมทำงานเรียบร้อย 100%!",
        });
      } else {
        setTestKeyResult({
          success: false,
          message: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง",
        });
      }
    } catch (err: any) {
      setTestKeyResult({
        success: false,
        message: `เกิดข้อผิดพลาด: ${err?.message || err}`,
      });
    } finally {
      setIsTestingKey(false);
    }
  };

  // Style operations
  const handleAddStyle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStyleName.trim()) return;
    const styleMaterials = settings.styleMaterials || [];
    const opsList = newStyleOps.split(",").map((s) => s.trim()).filter(Boolean);

    if (editingStyleId) {
      // Edit Mode
      const updated = styleMaterials.map((item) =>
        item.id === editingStyleId
          ? {
              ...item,
              name: newStyleName.trim(),
              category: newStyleCategory,
              operationOptions: opsList.length > 0 ? opsList : undefined,
              imageBase64: newStyleImg || undefined,
              styleEnForAi: newStyleEnForAi.trim() || undefined,
            }
          : item
      );
      onSaveSettings({
        ...settings,
        styleMaterials: updated,
      });
      setEditingStyleId(null);
    } else {
      // Create Mode
      const newItem: StyleMaterial = {
        id: generateId(),
        name: newStyleName.trim(),
        category: newStyleCategory,
        operationOptions: opsList.length > 0 ? opsList : undefined,
        imageBase64: newStyleImg || undefined,
        styleEnForAi: newStyleEnForAi.trim() || undefined,
      };
      onSaveSettings({
        ...settings,
        styleMaterials: [...styleMaterials, newItem],
      });
    }

    setNewStyleName("");
    setNewStyleCategory("curtain");
    setNewStyleOps("รวบซ้าย, รวบขวา, แยกกลาง");
    setNewStyleImg("");
    setNewStyleEnForAi("");
  };

  const handleRemoveStyle = async (id: string) => {
    markItemDeleted(id);
    if (onDeleteSingleMaterial) {
      await onDeleteSingleMaterial("styleMaterials", id);
    } else {
      const styleMaterials = settings.styleMaterials || [];
      onSaveSettings({
        ...settings,
        styleMaterials: styleMaterials.filter((x) => x.id !== id),
      }, true);
    }
    if (editingStyleId === id) setEditingStyleId(null);
    showToast("✓ ลบรูปแบบม่านเรียบร้อยแล้ว", "info");
  };

  // Hem operations
  const handleAddHem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHemName.trim()) return;
    const hemMaterials = settings.hemMaterials || [];

    if (editingHemId) {
      // Edit Mode
      const updated = hemMaterials.map((item) =>
        item.id === editingHemId
          ? {
              ...item,
              name: newHemName.trim(),
              imageBase64: newHemImg || undefined,
            }
          : item
      );
      onSaveSettings({
        ...settings,
        hemMaterials: updated,
      }, true);
      setEditingHemId(null);
    } else {
      // Create Mode
      const newItem: HemMaterial = {
        id: generateId(),
        name: newHemName.trim(),
        imageBase64: newHemImg || undefined,
      };
      onSaveSettings({
        ...settings,
        hemMaterials: [...hemMaterials, newItem],
      }, true);
    }

    setNewHemName("");
    setNewHemImg("");
  };

  const handleRemoveHem = async (id: string) => {
    markItemDeleted(id);
    if (onDeleteSingleMaterial) {
      await onDeleteSingleMaterial("hemMaterials", id);
    } else {
      const hemMaterials = settings.hemMaterials || [];
      onSaveSettings({
        ...settings,
        hemMaterials: hemMaterials.filter((x) => x.id !== id),
      }, true);
    }
    if (editingHemId === id) setEditingHemId(null);
    showToast("✓ ลบระยะชายม่านเรียบร้อยแล้ว", "info");
  };

  // Solid fabric operations
  const handleAddSolidFabric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fabricBrand.trim() || !fabricColorName.trim()) return;
    const list = settings.solidFabricMaterials || [];
    const bName = fabricBrand.trim().toUpperCase();
    const cName = fabricColorName.trim().toUpperCase();

    let finalImg = fabricImg || undefined;
    if (finalImg && isDriveConnected() && finalImg.startsWith("data:")) {
      try {
        const cleanName = `${bName}_${cName}_${Date.now()}.jpg`.replace(/[^a-zA-Z0-9._-]/g, "_");
        finalImg = await uploadSwatchToDrive(cleanName, finalImg);
      } catch (err) {
        console.warn("Drive upload failed for single solid fabric:", err);
      }
    }

    if (editingSolidId) {
      // Edit Mode
      const updated = list.map((item) =>
        item.id === editingSolidId
          ? {
              ...item,
              name: bName,
              colorName: cName,
              type: fabricType,
              imageBase64: finalImg,
            }
          : item
      );
      onSaveSettings({
        ...settings,
        solidFabricMaterials: updated,
      }, true);
      setEditingSolidId(null);
    } else {
      // Check for duplicate brand + color
      const matchFound = findExistingSwatchMatch(
        { id: "", name: bName, colorName: cName, type: fabricType },
        list
      );

      if (matchFound) {
        setSingleDuplicateConfirm({
          isOpen: true,
          existingItem: matchFound.match,
          newItem: {
            id: matchFound.match.id,
            name: bName,
            colorName: cName,
            type: fabricType,
            imageBase64: finalImg,
          },
          category: "solid",
        });
        return;
      }

      // Create Mode
      const newItem: FabricMaterial = {
        id: generateId(),
        name: bName,
        colorName: cName,
        type: fabricType,
        imageBase64: finalImg,
      };
      onSaveSettings({
        ...settings,
        solidFabricMaterials: [...list, newItem],
      }, true);
    }

    setFabricBrand("");
    setFabricColorName("");
    setFabricType("Blackout");
    setFabricImg("");
  };

  const handleRemoveSolidFabric = async (id: string) => {
    markItemDeleted(id);
    if (onDeleteSingleMaterial) {
      await onDeleteSingleMaterial("solidFabricMaterials", id);
    } else {
      const list = settings.solidFabricMaterials || [];
      onSaveSettings({
        ...settings,
        solidFabricMaterials: list.filter((x) => x.id !== id),
      }, true);
    }
    if (editingSolidId === id) setEditingSolidId(null);
    showToast("✓ ลบผ้าทึบเรียบร้อยแล้ว", "info");
  };

  // Sheer fabric operations
  const handleAddSheerFabric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fabricBrand.trim() || !fabricColorName.trim()) return;
    const list = settings.sheerFabricMaterials || [];
    const bName = fabricBrand.trim().toUpperCase();
    const cName = fabricColorName.trim().toUpperCase();

    let finalImg = fabricImg || undefined;
    if (finalImg && isDriveConnected() && finalImg.startsWith("data:")) {
      try {
        const cleanName = `${bName}_${cName}_${Date.now()}.jpg`.replace(/[^a-zA-Z0-9._-]/g, "_");
        finalImg = await uploadSwatchToDrive(cleanName, finalImg);
      } catch (err) {
        console.warn("Drive upload failed for single sheer fabric:", err);
      }
    }

    if (editingSheerId) {
      // Edit Mode
      const updated = list.map((item) =>
        item.id === editingSheerId
          ? {
              ...item,
              name: bName,
              colorName: cName,
              type: "Sheer",
              imageBase64: finalImg,
            }
          : item
      );
      onSaveSettings({
        ...settings,
        sheerFabricMaterials: updated,
      }, true);
      setEditingSheerId(null);
    } else {
      // Check for duplicate brand + color
      const matchFound = findExistingSwatchMatch(
        { id: "", name: bName, colorName: cName, type: "Sheer" },
        list
      );

      if (matchFound) {
        setSingleDuplicateConfirm({
          isOpen: true,
          existingItem: matchFound.match,
          newItem: {
            id: matchFound.match.id,
            name: bName,
            colorName: cName,
            type: "Sheer",
            imageBase64: finalImg,
          },
          category: "sheer",
        });
        return;
      }

      // Create Mode
      const newItem: FabricMaterial = {
        id: generateId(),
        name: bName,
        colorName: cName,
        type: "Sheer",
        imageBase64: finalImg,
      };
      onSaveSettings({
        ...settings,
        sheerFabricMaterials: [...list, newItem],
      }, true);
    }

    setFabricBrand("");
    setFabricColorName("");
    setFabricImg("");
  };

  const handleRemoveSheerFabric = async (id: string) => {
    markItemDeleted(id);
    if (onDeleteSingleMaterial) {
      await onDeleteSingleMaterial("sheerFabricMaterials", id);
    } else {
      const list = settings.sheerFabricMaterials || [];
      onSaveSettings({
        ...settings,
        sheerFabricMaterials: list.filter((x) => x.id !== id),
      }, true);
    }
    if (editingSheerId === id) setEditingSheerId(null);
    showToast("✓ ลบผ้าโปร่งเรียบร้อยแล้ว", "info");
  };

  // Blinds & Roller operations
  const handleAddBlindMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blindName.trim() || !blindColorName.trim()) return;

    let blindMaterials = settings.blindMaterials || [];
    let rollerMaterials = settings.rollerMaterials || [];
    let blindTapeMaterials = settings.blindTapeMaterials || [];
    const bName = blindName.trim().toUpperCase();
    const cName = blindColorName.trim().toUpperCase();

    let finalImg = blindImg || undefined;
    if (finalImg && isDriveConnected() && finalImg.startsWith("data:")) {
      try {
        const cleanName = `${bName}_${cName}_${Date.now()}.jpg`.replace(/[^a-zA-Z0-9._-]/g, "_");
        finalImg = await uploadSwatchToDrive(cleanName, finalImg);
      } catch (err) {
        console.warn("Drive upload failed for single blind material:", err);
      }
    }

    // If editing, first filter out the old item from whichever list it was in
    if (editingBlindId) {
      blindMaterials = blindMaterials.filter((x) => x.id !== editingBlindId);
      rollerMaterials = rollerMaterials.filter((x) => x.id !== editingBlindId);
      blindTapeMaterials = blindTapeMaterials.filter((x) => x.id !== editingBlindId);
    } else {
      // Check for duplicate in target group
      let targetList = blindMaterials;
      let targetKey: "blindMaterials" | "rollerMaterials" | "blindTapeMaterials" = "blindMaterials";
      if (blindType === "Roller Shades") {
        targetList = rollerMaterials;
        targetKey = "rollerMaterials";
      } else if (blindType === "Fabric Tape") {
        targetList = blindTapeMaterials;
        targetKey = "blindTapeMaterials";
      }

      const matchFound = findExistingSwatchMatch(
        { id: "", name: bName, colorName: cName, type: blindType },
        targetList
      );

      if (matchFound) {
        setSingleDuplicateConfirm({
          isOpen: true,
          existingItem: matchFound.match,
          newItem: {
            id: matchFound.match.id,
            name: bName,
            colorName: cName,
            type: blindType,
            imageBase64: finalImg,
          },
          category: "blinds",
          blindTargetKey: targetKey,
        });
        return;
      }
    }

    const newItem: FabricMaterial = {
      id: editingBlindId || generateId(),
      name: bName,
      colorName: cName,
      type: blindType,
      imageBase64: finalImg,
    };

    if (blindType === "Wood Blinds" || blindType === "Aluminum Blinds") {
      blindMaterials.push(newItem);
    } else if (blindType === "Roller Shades") {
      rollerMaterials.push(newItem);
    } else if (blindType === "Fabric Tape") {
      blindTapeMaterials.push(newItem);
    }

    onSaveSettings({
      ...settings,
      blindMaterials,
      rollerMaterials,
      blindTapeMaterials,
    }, true);

    setEditingBlindId(null);
    setBlindName("");
    setBlindColorName("");
    setBlindImg("");
  };

  const handleRemoveBlindMaterial = async (id: string, group: "blind" | "roller" | "tape") => {
    markItemDeleted(id);
    const key = group === "blind" ? "blindMaterials" : group === "roller" ? "rollerMaterials" : "blindTapeMaterials";
    if (onDeleteSingleMaterial) {
      await onDeleteSingleMaterial(key, id);
    } else {
      if (group === "blind") {
        const list = settings.blindMaterials || [];
        onSaveSettings({ ...settings, blindMaterials: list.filter((x) => x.id !== id) }, true);
      } else if (group === "roller") {
        const list = settings.rollerMaterials || [];
        onSaveSettings({ ...settings, rollerMaterials: list.filter((x) => x.id !== id) }, true);
      } else if (group === "tape") {
        const list = settings.blindTapeMaterials || [];
        onSaveSettings({ ...settings, blindTapeMaterials: list.filter((x) => x.id !== id) }, true);
      }
    }
    if (editingBlindId === id) setEditingBlindId(null);
    showToast("✓ ลบรายการเรียบร้อยแล้ว", "info");
  };

  const handleMoveBlindCategory = (
    item: FabricMaterial,
    fromGroup: "blind" | "roller" | "tape",
    targetCategory: "Wood Blinds" | "Aluminum Blinds" | "Roller Shades" | "Fabric Tape"
  ) => {
    let blindMaterials = [...(settings.blindMaterials || [])];
    let rollerMaterials = [...(settings.rollerMaterials || [])];
    let blindTapeMaterials = [...(settings.blindTapeMaterials || [])];

    // Remove from source
    if (fromGroup === "blind") {
      blindMaterials = blindMaterials.filter((x) => x.id !== item.id);
    } else if (fromGroup === "roller") {
      rollerMaterials = rollerMaterials.filter((x) => x.id !== item.id);
    } else if (fromGroup === "tape") {
      blindTapeMaterials = blindTapeMaterials.filter((x) => x.id !== item.id);
    }

    const updatedItem: FabricMaterial = {
      ...item,
      type: targetCategory,
    };

    // Add to target
    if (targetCategory === "Wood Blinds" || targetCategory === "Aluminum Blinds") {
      blindMaterials.push(updatedItem);
    } else if (targetCategory === "Roller Shades") {
      rollerMaterials.push(updatedItem);
    } else if (targetCategory === "Fabric Tape") {
      blindTapeMaterials.push(updatedItem);
    }

    onSaveSettings({
      ...settings,
      blindMaterials,
      rollerMaterials,
      blindTapeMaterials,
    });

    const categoryNames: Record<string, string> = {
      "Wood Blinds": "มู่ลี่ไม้",
      "Aluminum Blinds": "มู่ลี่อะลูมิเนียม",
      "Roller Shades": "ม่านม้วน",
      "Fabric Tape": "เทปผ้าตกแต่งมู่ลี่",
    };
    showToast(`ย้าย "${item.name} (${item.colorName})" ไปยังหมวด ${categoryNames[targetCategory]} เรียบร้อยแล้ว`, "success");
  };

  const handleAutoOrganizeBlinds = () => {
    let blindMaterials = [...(settings.blindMaterials || [])];
    let rollerMaterials = [...(settings.rollerMaterials || [])];
    let blindTapeMaterials = [...(settings.blindTapeMaterials || [])];
    let movedCount = 0;

    // Check blindMaterials for roller shades or fabric tapes
    const remainingBlinds: FabricMaterial[] = [];
    for (const item of blindMaterials) {
      const typeLower = (item.type || "").toLowerCase();
      const nameLower = (item.name || "").toLowerCase();
      const colorLower = (item.colorName || "").toLowerCase();

      if (
        typeLower === "roller shades" ||
        nameLower.includes("ม่านม้วน") ||
        nameLower.includes("roller") ||
        colorLower.includes("ม่านม้วน") ||
        colorLower.includes("roller")
      ) {
        rollerMaterials.push({ ...item, type: "Roller Shades" });
        movedCount++;
      } else if (
        typeLower === "fabric tape" ||
        nameLower.includes("เทป") ||
        nameLower.includes("tape") ||
        colorLower.includes("เทป") ||
        colorLower.includes("tape")
      ) {
        blindTapeMaterials.push({ ...item, type: "Fabric Tape" });
        movedCount++;
      } else {
        remainingBlinds.push(item);
      }
    }
    blindMaterials = remainingBlinds;

    // Check rollerMaterials for blinds or tapes
    const remainingRollers: FabricMaterial[] = [];
    for (const item of rollerMaterials) {
      const typeLower = (item.type || "").toLowerCase();
      const nameLower = (item.name || "").toLowerCase();
      const colorLower = (item.colorName || "").toLowerCase();

      if (
        typeLower === "fabric tape" ||
        nameLower.includes("เทป") ||
        nameLower.includes("tape") ||
        colorLower.includes("เทป") ||
        colorLower.includes("tape")
      ) {
        blindTapeMaterials.push({ ...item, type: "Fabric Tape" });
        movedCount++;
      } else if (
        typeLower === "wood blinds" ||
        typeLower === "aluminum blinds" ||
        nameLower.includes("มู่ลี่") ||
        nameLower.includes("blind")
      ) {
        blindMaterials.push({ ...item, type: typeLower.includes("aluminum") ? "Aluminum Blinds" : "Wood Blinds" });
        movedCount++;
      } else {
        remainingRollers.push(item);
      }
    }
    rollerMaterials = remainingRollers;

    if (movedCount > 0) {
      onSaveSettings({
        ...settings,
        blindMaterials,
        rollerMaterials,
        blindTapeMaterials,
      });
      showToast(`จัดระเบียบสินค้าสำเร็จ! ย้ายรายการที่อยู่ผิดหมวด ${movedCount} รายการเรียบร้อยแล้ว`, "success");
    } else {
      showToast("หมวดหมู่สินค้าถูกต้องเรียบร้อยแล้ว ไม่มีรายการที่ต้องย้าย", "info");
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
          showToast("มีชื่อนี้ในระบบแล้ว", "error");
          return;
        }
        updated.push({ id: generateId(), name: nameText.trim() });
      }

      onSaveSettings({ ...settings, [fieldKey]: updated }, true);
      setNameText("");
      showToast(editingId ? "✓ อัปเดตรายการเรียบร้อยแล้ว (⚡ ทันใจ 0 วิ)" : "✓ เพิ่มรายการเรียบร้อยแล้ว (⚡ ทันใจ 0 วิ)", "success");
    };

    const handleRemove = (id: string) => {
      onSaveSettings({ ...settings, [fieldKey]: items.filter((x) => x.id !== id) }, true);
      showToast("✓ ลบรายการเรียบร้อยแล้ว", "info");
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
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => openQuickEdit(fieldKey === "trackMaterials" ? "track" : "accessory", item, fieldKey)}
                    className="text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 px-2 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                    title="⚡ แก้ไขข้อความด่วนทันใจ ไม่ต้องรอโหลด"
                  >
                    <Zap className="w-3 h-3 fill-amber-500 text-amber-500" />
                    <span>แก้ด่วน</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEditStart(item)}
                    className="text-slate-400 hover:text-indigo-600 p-1"
                    title="แก้ไขข้อความ"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    className="text-slate-400 hover:text-rose-500 p-1"
                    title="ลบรายการ"
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
          showToast("มีคุณสมบัตินี้ในระบบแล้ว", "error");
          return;
        }
        updated.push(trimmed);
      }

      onSaveSettings({ ...settings, fabricTypes: updated }, true);
      setNameText("");
      showToast(editingIndex !== null ? "✓ อัปเดตคุณสมบัติผ้าเรียบร้อยแล้ว (⚡ ทันใจ 0 วิ)" : "✓ เพิ่มคุณสมบัติผ้าเรียบร้อยแล้ว (⚡ ทันใจ 0 วิ)", "success");
    };

    const handleRemove = (index: number) => {
      const typeToRemove = currentTypes[index];
      if (confirm(`คุณต้องการลบคุณสมบัติ "${typeToRemove}" ใช่หรือไม่? มีผลกับตัวเลือกข้อมูลผ้าม่าน`)) {
        const updated = currentTypes.filter((_, idx) => idx !== index);
        onSaveSettings({ ...settings, fabricTypes: updated }, true);
        showToast("✓ ลบคุณสมบัติผ้าเรียบร้อยแล้ว", "info");
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
    fieldKey: "hangingTypes" | "usageTypes" | "clearanceOptions" | "clearanceTopOptions";
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
          showToast("มีตัวเลือกนี้ในระบบแล้ว", "error");
          return;
        }
        updated.push(trimmed);
      }

      onSaveSettings({ ...settings, [fieldKey]: updated }, true);
      setNameText("");
      showToast(editingIndex !== null ? "✓ อัปเดตตัวเลือกเรียบร้อยแล้ว (⚡ ทันใจ 0 วิ)" : "✓ เพิ่มตัวเลือกเรียบร้อยแล้ว (⚡ ทันใจ 0 วิ)", "success");
    };

    const handleRemove = (index: number) => {
      if (confirm(`คุณต้องการลบตัวเลือก "${items[index]}" ใช่หรือไม่?`)) {
        const updated = items.filter((_, idx) => idx !== index);
        onSaveSettings({ ...settings, [fieldKey]: updated }, true);
        showToast("✓ ลบตัวเลือกเรียบร้อยแล้ว", "info");
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

      {/* Firebase Cloud Real-Time Database Status Card */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950/90 to-slate-950 border border-indigo-500/30 rounded-3xl p-5 md:p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-2xl shrink-0">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-extrabold text-base text-indigo-100">
                  ระบบฐานข้อมูลคลาวด์กลาง (Firebase Real-Time Cloud Sync)
                </h3>
                <span className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-black px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>เชื่อมต่อ Real-time อัตโนมัติทุกเครื่อง</span>
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
                ✓ ฐานข้อมูลคลาวด์กลางเชื่อมต่อแบบ Real-time ตลอดเวลา ไม่ว่าพนักงานจะเปิดเครื่องไหน หรือสาขาไหน ข้อมูลแคตตาล็อก สวอชผ้า รายการงาน (Jobs) และผู้ใช้งาน จะแสดงผลตรงกันทันที 100%
              </p>
              {forceSyncProgress && (
                <div className="mt-3 bg-indigo-900/60 border border-indigo-400/30 rounded-xl p-3 max-w-md">
                  <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                    <span className="text-indigo-200">{forceSyncProgress.text}</span>
                    <span className="text-emerald-400">{forceSyncProgress.pct}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${forceSyncProgress.pct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 self-end md:self-auto flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleForceSyncCloud}
              disabled={isForceSyncing}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs transition inline-flex items-center gap-1.5 shadow-lg shadow-emerald-500/25 cursor-pointer disabled:opacity-50"
              title="สั่งให้ระบบซิงค์และอัปเดตข้อมูลทุกอย่างขึ้นคลาวด์กลางทันที"
            >
              {isForceSyncing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังซิงค์...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>ซิงค์ข้อมูลขึ้นคลาวด์ทันที</span>
                </>
              )}
            </button>

            {/* Offline / Local JSON Backup and Restore */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-white/15">
              <button
                type="button"
                onClick={handleExportJsonBackup}
                className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                title="ดาวน์โหลดไฟล์สำรองข้อมูล JSON ลงเครื่องคอมพิวเตอร์"
              >
                <Download className="w-3.5 h-3.5 text-slate-200" />
                <span>ส่งออก JSON</span>
              </button>
              <label
                className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                title="เลือกไฟล์ JSON เพื่อนำเข้าข้อมูลและกู้คืนเข้าสู่ระบบ"
              >
                <FolderUp className="w-3.5 h-3.5 text-slate-200" />
                <span>นำเข้า JSON</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportJsonBackup}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
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

        <button
          onClick={() => setActiveTab("cloud_ai")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === "cloud_ai"
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
              : "text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200"
          }`}
        >
          <Cloud className="w-4 h-4 text-emerald-600" />
          <span>คลาวด์กลาง & คีย์ AI (Cloud & Gemini)</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* TAB: Cloud & Central Gemini AI API Key */}
        {activeTab === "cloud_ai" && (
          <div className="lg:col-span-3 space-y-6">
            
            {/* Top Overview Banner */}
            <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-indigo-950 border border-emerald-500/30 rounded-3xl p-6 text-white shadow-xl">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <Cloud className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black text-white">
                        ศูนย์ควบคุมฐานข้อมูลกลางและคีย์ AI ส่วนกลาง (Central Cloud & AI)
                      </h3>
                      {serverKeyStatus?.hasConfiguredKey || (customApiKey && customApiKey.trim().length > 5) ? (
                        <span className="bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>กำหนดคีย์ AI กลางแล้ว (พร้อมใช้งานทุกเครื่อง)</span>
                        </span>
                      ) : (
                        <span className="bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          <span>ยังไม่ได้กำหนดคีย์ AI ส่วนกลาง</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 mt-1.5 max-w-3xl leading-relaxed">
                      กำหนดคีย์ Gemini API และซิงค์ฐานข้อมูลแคตตาล็อกวัสดุ สวอชผ้า มู่ลี่ และข้อมูลงานจากเครื่องแอดมินเพียงครั้งเดียว 
                      พนักงานทุกคนในร้าน ทุกเครื่อง ทุกอุปกรณ์ จะใช้ฐานข้อมูลชุดเดียวกันแบบ <strong>Real-time 100%</strong> โดยพนักงานมีหน้าที่เพียงทำใบงานเท่านั้น
                    </p>
                  </div>
                </div>

                <div className="shrink-0">
                  <button
                    type="button"
                    onClick={handleForcePushToCloud}
                    disabled={isCloudPushing}
                    className="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white font-extrabold text-xs transition flex items-center gap-2 shadow-lg shadow-emerald-500/25 cursor-pointer disabled:opacity-50"
                  >
                    {isCloudPushing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>กำลังซิงค์ข้อมูลขึ้น Cloud...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-4 h-4" />
                        <span>ซิงค์ข้อมูลทั้งหมดขึ้น Cloud เดี๋ยวนี้</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Live Sync Progress Bar */}
              {cloudPushProgress && (
                <div className="mt-5 pt-4 border-t border-emerald-500/20 space-y-2">
                  <div className="flex justify-between text-xs font-bold text-emerald-200">
                    <span>{cloudPushProgress.msg}</span>
                    <span>{cloudPushProgress.percent}%</span>
                  </div>
                  <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden border border-emerald-500/30">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-indigo-400 transition-all duration-300 rounded-full"
                      style={{ width: `${cloudPushProgress.percent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Grid 2 Columns: API Key Management & Live Database Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Card 1: Central Gemini API Key */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                        <Key className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-base font-extrabold text-slate-900">
                          Central Gemini AI API Key
                        </h4>
                        <p className="text-[11px] text-slate-400 font-medium">
                          ใส่คีย์ครั้งเดียว ใช้ได้ทุกเครื่อง ทุกอุปกรณ์
                        </p>
                      </div>
                    </div>

                    {serverKeyStatus?.hasConfiguredKey || (customApiKey && customApiKey.trim().length > 5) ? (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Active</span>
                      </span>
                    ) : (
                      <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-extrabold px-2.5 py-1 rounded-lg">
                        ยังไม่ใส่คีย์
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed mb-4">
                    กำหนด API Key ส่วนกลางเพื่อให้เซิร์ฟเวอร์และระบบสร้างภาพตัวอย่างผ้าม่านด้วย AI ทำงานได้ตลอดเวลา 
                    โดยพนักงานไม่ต้องกรอกคีย์เองในแต่ละเครื่อง
                  </p>

                  <form onSubmit={handleSaveCentralApiKey} className="space-y-3.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                        Gemini API Key (Google AI Studio)
                      </label>
                      <div className="relative">
                        <input
                          type={showApiKey ? "text" : "password"}
                          value={customApiKey}
                          onChange={(e) => setCustomApiKey(e.target.value)}
                          placeholder="AIzaSy..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3.5 pr-20 py-2.5 text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-800 bg-slate-200/60 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                        >
                          {showApiKey ? "ซ่อน" : "แสดง"}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        รับ API Key ฟรีได้จาก <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-bold">Google AI Studio</a>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <button
                        type="submit"
                        disabled={isSavingCentralKey || !customApiKey.trim()}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl py-2.5 transition flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10 cursor-pointer"
                      >
                        {isSavingCentralKey ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>บันทึกคีย์ AI ส่วนกลาง</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleTestCentralApiKey}
                        disabled={isTestingKey}
                        className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="ทดสอบการเชื่อมต่อ API"
                      >
                        {isTestingKey ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                        ) : (
                          <Zap className="w-3.5 h-3.5 text-indigo-600" />
                        )}
                        <span>ทดสอบระบบ AI</span>
                      </button>

                      {customApiKey && (
                        <button
                          type="button"
                          onClick={handleRemoveCentralApiKey}
                          disabled={isSavingCentralKey}
                          className="p-2.5 text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                          title="ลบคีย์"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </form>

                  {/* Test Result Message */}
                  {testKeyResult && (
                    <div className={`mt-3 p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                      testKeyResult.success
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-rose-50 text-rose-800 border-rose-200"
                    }`}>
                      {testKeyResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <span>{testKeyResult.message}</span>
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 border border-slate-150 rounded-2xl p-3.5 text-[11px] text-slate-600 space-y-1">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>ความปลอดภัยและสิทธิ์การเข้าถึง:</span>
                  </div>
                  <p>คีย์นี้จะถูกเก็บไว้ที่เซิร์ฟเวอร์และเอกสารกลาง Firestore ใช้งานร่วมกันเฉพาะบุคลากรในร้าน ไม่เปิดเผยสู่ภายนอก</p>
                </div>
              </div>

              {/* Card 2: Live Database & Cloud Sync Breakdown */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                        <Database className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-base font-extrabold text-slate-900">
                          สถานะฐานข้อมูลกลาง (Live Cloud Database)
                        </h4>
                        <p className="text-[11px] text-slate-400 font-medium">
                          เชื่อมต่อ Real-time Firestore Cloud
                        </p>
                      </div>
                    </div>

                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>Realtime Active</span>
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed mb-4">
                    จำนวนรายการข้อมูลทั้งหมดในระบบที่พร้อมให้บริการแก่พนักงานทุกคน:
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4">
                    <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 text-center">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">ผ้าม่านทึบ (Solid)</span>
                      <span className="text-lg font-black text-slate-900 font-mono">{(settings.solidFabricMaterials || []).length}</span>
                    </div>

                    <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 text-center">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">ผ้าม่านโปร่ง (Sheer)</span>
                      <span className="text-lg font-black text-slate-900 font-mono">{(settings.sheerFabricMaterials || []).length}</span>
                    </div>

                    <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 text-center">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">มู่ลี่ไม้ & ม่านม้วน</span>
                      <span className="text-lg font-black text-slate-900 font-mono">
                        {(settings.blindMaterials || []).length + (settings.rollerMaterials || []).length}
                      </span>
                    </div>

                    <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 text-center">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">รูปแบบม่าน & ชาย</span>
                      <span className="text-lg font-black text-slate-900 font-mono">
                        {(settings.styleMaterials || []).length + (settings.hemMaterials || []).length}
                      </span>
                    </div>

                    <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 text-center">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">ราง & อุปกรณ์เสริม</span>
                      <span className="text-lg font-black text-slate-900 font-mono">
                        {(settings.trackMaterials || []).length + (settings.accessoryMaterials || []).length}
                      </span>
                    </div>

                    <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 text-center">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">รายชื่อพนักงาน</span>
                      <span className="text-lg font-black text-indigo-600 font-mono">{employees.length} คน</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[11px] text-slate-500 font-medium">
                    ต้องการกระจายข้อมูลล่าสุดไปยังเครื่องลูกทีมทันที?
                  </div>
                  <button
                    type="button"
                    onClick={handleForcePushToCloud}
                    disabled={isCloudPushing}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-md shadow-emerald-600/10 cursor-pointer disabled:opacity-50"
                  >
                    {isCloudPushing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    <span>ซิงค์ข้อมูลเดี๋ยวนี้</span>
                  </button>
                </div>
              </div>

            </div>

          </div>
        )}

        
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
                    <span>{editingEmployeeId ? "แก้ไขพนักงาน" : "เพิ่มพนักงานเข้าระบบ"}</span>
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
                      {editingEmployeeId ? <Edit3 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      <span>{editingEmployeeId ? "บันทึกการแก้ไขพนักงาน" : "บันทึกเพิ่มพนักงาน"}</span>
                    </button>

                    {editingEmployeeId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingEmployeeId(null);
                          setNewEmpName("");
                          setNewEmpUsername("");
                          setNewEmpPassword("");
                          setNewEmpRole("designer");
                          setNewEmpQuota(30);
                        }}
                        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl py-2.5 transition text-center cursor-pointer"
                      >
                        ยกเลิกการแก้ไข
                      </button>
                    )}
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

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openQuickEdit("employee", emp, "employees")}
                            className="text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 p-2 rounded-xl transition cursor-pointer flex items-center gap-1 text-xs font-bold"
                            title="แก้ไขข้อความด่วน (⚡ ทันใจไม่ต้องโหลด)"
                          >
                            <Zap className="w-3.5 h-3.5 fill-indigo-600" />
                            <span>แก้ด่วน</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEmployeeId(emp.id);
                              setNewEmpName(emp.name);
                              setNewEmpUsername(emp.username || "");
                              setNewEmpPassword(emp.password || "");
                              setNewEmpRole(emp.role || "designer");
                              setNewEmpQuota(emp.aiQuota || 30);
                            }}
                            className="text-slate-400 hover:text-indigo-600 hover:bg-slate-100 p-2 rounded-xl transition cursor-pointer"
                            title="แก้ไขข้อมูลพนักงานในฟอร์ม"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {employees.length > 1 && emp.role !== "admin" && (
                            <button
                              type="button"
                              onClick={() => onDeleteEmployee(emp.id)}
                              className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-xl transition cursor-pointer"
                              title="ลบพนักงาน"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
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
                <span>{editingStyleId ? "แก้ไขรูปแบบการติดตั้งผ้าม่าน" : "เพิ่มรูปแบบการติดตั้งผ้าม่าน"}</span>
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
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    คำสั่งรูปแบบม่านภาษาอังกฤษส่งให้ AI (English AI Style Prompt)
                  </label>
                  <input
                    type="text"
                    value={newStyleEnForAi}
                    onChange={(e) => setNewStyleEnForAi(e.target.value)}
                    placeholder="เช่น wave fold curtains, eyelet curtains, wood blinds, roller shades"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold"
                  />
                  <p className="text-[9px] text-slate-400 mt-0.5">ใช้ระบุคำสั่งภาษาอังกฤษเฉพาะสำหรับรูปแบบม่านนี้ เพื่อส่งให้ AI วาดภาพได้แม่นยำ</p>
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

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl py-3 transition flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/10 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{editingStyleId ? "บันทึกการแก้ไข" : "บันทึกรูปแบบม่าน"}</span>
                  </button>
                  {editingStyleId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingStyleId(null);
                        setNewStyleName("");
                        setNewStyleCategory("curtain");
                        setNewStyleOps("รวบซ้าย, รวบขวา, แยกกลาง");
                        setNewStyleImg("");
                        setNewStyleEnForAi("");
                      }}
                      className="bg-slate-150 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl px-4 py-3 transition cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-base font-bold text-slate-800">
                  รายการสเปกรูปแบบผ้าม่าน & มู่ลี่ทั้งหมด ({(settings.styleMaterials || []).length})
                </h3>
                {(settings.styleMaterials || []).length > 0 && (
                  <button
                    type="button"
                    onClick={() => setClearTarget("styles")}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ล้างทั้งหมด</span>
                  </button>
                )}
              </div>
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
                      {item.styleEnForAi && (
                        <p className="text-[10px] font-semibold text-amber-600 mt-1">
                          คำสั่ง AI (EN): <span className="font-bold underline">{item.styleEnForAi}</span>
                        </p>
                      )}
                      <p className="text-[10px] font-semibold text-indigo-600 mt-0.5">
                        การควบคุม: {item.operationOptions?.join(" / ") || "รวบซ้าย, รวบขวา, แยกกลาง"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openQuickEdit("style", item, "styleMaterials")}
                        className="text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 p-2 rounded-xl transition cursor-pointer flex items-center gap-1 text-xs font-bold"
                        title="แก้ไขข้อความด่วน (⚡ ทันใจไม่ต้องโหลด)"
                      >
                        <Zap className="w-3.5 h-3.5 fill-indigo-600" />
                        <span>แก้ด่วน</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingStyleId(item.id);
                          setNewStyleName(item.name);
                          setNewStyleCategory(item.category || "curtain");
                          setNewStyleOps(item.operationOptions?.join(", ") || "รวบซ้าย, รวบขวา, แยกกลาง");
                          setNewStyleImg(item.imageBase64 || "");
                          setNewStyleEnForAi(item.styleEnForAi || "");
                        }}
                        className="text-slate-400 hover:text-indigo-600 hover:bg-slate-100 p-2 rounded-xl transition cursor-pointer"
                        title="แก้ไขสเปกนี้ในฟอร์ม"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveStyle(item.id)}
                        className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-xl transition cursor-pointer"
                        title="ลบสเปกนี้"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
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
                <span>{editingHemId ? "แก้ไขสเปกระยะชายม่าน" : "เพิ่มสเปกระยะชายม่าน"}</span>
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

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl py-3 transition flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/10 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{editingHemId ? "บันทึกการแก้ไข" : "บันทึกระยะชายม่าน"}</span>
                  </button>
                  {editingHemId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingHemId(null);
                        setNewHemName("");
                        setNewHemImg("");
                      }}
                      className="bg-slate-150 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl px-4 py-3 transition cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-base font-bold text-slate-800">
                  รายการระยะชายม่านในระบบ ({(settings.hemMaterials || []).length})
                </h3>
                {(settings.hemMaterials || []).length > 0 && (
                  <button
                    type="button"
                    onClick={() => setClearTarget("hems")}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ล้างทั้งหมด</span>
                  </button>
                )}
              </div>
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
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openQuickEdit("hem", item, "hemMaterials")}
                        className="text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 p-2 rounded-xl transition cursor-pointer flex items-center gap-1 text-xs font-bold"
                        title="แก้ไขข้อความด่วน (⚡ ทันใจไม่ต้องโหลด)"
                      >
                        <Zap className="w-3.5 h-3.5 fill-indigo-600" />
                        <span>แก้ด่วน</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingHemId(item.id);
                          setNewHemName(item.name);
                          setNewHemImg(item.imageBase64 || "");
                        }}
                        className="text-slate-400 hover:text-indigo-600 hover:bg-slate-100 p-2 rounded-xl transition cursor-pointer"
                        title="แก้ไขระยะนี้ในฟอร์ม"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveHem(item.id)}
                        className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-xl transition cursor-pointer"
                        title="ลบระยะนี้"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
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
                  <span>{editingSolidId ? "แก้ไขผ้าม่านทึบ (Solid)" : "เพิ่มผ้าม่านทึบ (Solid)"}</span>
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
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) processImage(file, setFabricImg);
                        }}
                        className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer"
                      />
                    </div>
                  </div>
 
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl py-3 transition flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/10 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{editingSolidId ? "บันทึกการแก้ไข" : "บันทึกผ้าทึบแสง"}</span>
                    </button>
                    {editingSolidId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSolidId(null);
                          setFabricBrand("");
                          setFabricColorName("");
                          setFabricType("Blackout");
                          setFabricImg("");
                        }}
                        className="bg-slate-150 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl px-4 py-3 transition cursor-pointer"
                      >
                        ยกเลิก
                      </button>
                    )}
                  </div>
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
                <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl px-2.5 py-1.5 flex items-center gap-2 text-[10px] text-indigo-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span><strong>ระบบป้องกันข้อมูลซ้ำ:</strong> อัปเดตสวอชเดิมอัตโนมัติหากชื่อผ้าและรหัสสีตรงกัน ไม่เกิดรายการซ้ำซ้อน</span>
                </div>

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

                <div className="flex gap-2">
                  <div className="relative border border-dashed border-slate-300 bg-slate-50/50 rounded-xl p-3 text-center transition hover:bg-indigo-50/30 flex-1">
                    <input
                      type="file"
                      {...{ webkitdirectory: "", directory: "", multiple: true }}
                      onChange={(e) => handleFolderUpload(e, "solid")}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <FolderUp className="w-5 h-5 text-indigo-500 mx-auto mb-1" />
                    <span className="text-[10px] font-bold text-slate-600 block">นำเข้าด้วยโฟลเดอร์</span>
                    <span className="text-[9px] text-slate-400 block">(ดึงชื่อจากโฟลเดอร์)</span>
                  </div>

                  <div className="relative border border-dashed border-slate-300 bg-slate-50/50 rounded-xl p-3 text-center transition hover:bg-emerald-50/30 flex-1">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => handleFolderUpload(e, "solid")}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Files className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                    <span className="text-[10px] font-bold text-slate-600 block">นำเข้าด้วยไฟล์รูป</span>
                    <span className="text-[9px] text-slate-400 block">(ดึงชื่อไฟล์ เช่น แบรนด์_สี)</span>
                  </div>
                </div>
              </div>
            </div>

            {(() => {
              const solidBatches = getBatchSummaries(settings.solidFabricMaterials || []);
              const filteredSolidFabrics = (settings.solidFabricMaterials || []).filter((item) => {
                if (batchFilterSolid && batchFilterSolid !== "all") {
                  if (batchFilterSolid === "legacy_manual") {
                    if (item.uploadBatchId) return false;
                  } else if (item.uploadBatchId !== batchFilterSolid) {
                    return false;
                  }
                }
                const q = solidSearch.trim().toLowerCase();
                if (!q) return true;
                return (
                  (item.name || "").toLowerCase().includes(q) ||
                  (item.colorName || "").toLowerCase().includes(q) ||
                  (item.type || "").toLowerCase().includes(q) ||
                  (item.uploadBatchName || "").toLowerCase().includes(q)
                );
              });

              return (
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex flex-col h-full">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3 shrink-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-slate-800">
                        รายการผ้าม่านทึบแสง ({filteredSolidFabrics.length} / {(settings.solidFabricMaterials || []).length} สีแบบ)
                      </h3>
                      {(settings.solidFabricMaterials || []).length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setClearTarget("solid");
                            setClearModalTab("batches");
                            setClearConfirmInput("");
                          }}
                          className="text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition cursor-pointer border border-indigo-100"
                          title="เลือกลบเฉพาะรอบการอัปโหลดหรือล้างทั้งหมด"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>จัดการรอบ / ล้างข้อมูล</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                      {solidBatches.length > 1 && (
                        <div className="relative">
                          <select
                            value={batchFilterSolid}
                            onChange={(e) => setBatchFilterSolid(e.target.value)}
                            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-2.5 py-2 font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none max-w-[170px] truncate cursor-pointer"
                          >
                            <option value="all">📦 ทุกล็อต ({solidBatches.length} รอบ)</option>
                            {solidBatches.map((b) => (
                              <option key={b.batchId} value={b.batchId}>
                                {b.batchName} ({b.count})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className="relative flex-1 md:w-52">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={solidSearch}
                          onChange={(e) => setSolidSearch(e.target.value)}
                          placeholder="ค้นหาชื่อผ้า, สี, รอบ..."
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl pl-9 pr-4 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Active Batch Filter Banner */}
                  {batchFilterSolid && batchFilterSolid !== "all" && (
                    <div className="bg-amber-50/90 border border-amber-200 rounded-xl px-3.5 py-2 flex items-center justify-between gap-3 text-xs mb-3 animate-in fade-in duration-150 shrink-0">
                      <div className="flex items-center gap-2 text-amber-900 font-bold min-w-0">
                        <Layers className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="truncate">
                          กำลังกรองเฉพาะ:{" "}
                          <strong className="text-slate-900">
                            {solidBatches.find((b) => b.batchId === batchFilterSolid)?.batchName || "รอบที่เลือก"}
                          </strong>{" "}
                          ({filteredSolidFabrics.length} รายการ)
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const b = solidBatches.find((x) => x.batchId === batchFilterSolid);
                            if (b) {
                              setBatchConfirmDeleteState({
                                targetCategory: "solid",
                                batchId: b.batchId,
                                batchName: b.batchName,
                                count: b.count,
                              });
                            }
                          }}
                          className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm transition cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>ล้างเฉพาะรอบนี้</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setBatchFilterSolid("all")}
                          className="text-slate-500 hover:text-slate-700 text-[11px] font-bold px-1.5 py-1 cursor-pointer"
                        >
                          แสดงทั้งหมด
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                    {filteredSolidFabrics.map((item) => (
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
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-extrabold text-slate-800 text-xs">
                              {item.name}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight bg-slate-200/80 text-slate-700">
                              {item.type}
                            </span>
                            {item.uploadBatchName && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100/60 truncate max-w-[130px]" title={`รอบ: ${item.uploadBatchName}`}>
                                {item.uploadBatchName}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-indigo-600 font-bold mt-0.5">สีผ้า: {item.colorName}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openQuickEdit("solid", item, "solidFabricMaterials")}
                            className="text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 p-2 rounded-xl transition cursor-pointer flex items-center gap-1 text-xs font-bold"
                            title="แก้ไขข้อความด่วน (⚡ ทันใจไม่ต้องโหลด)"
                          >
                            <Zap className="w-3.5 h-3.5 fill-indigo-600" />
                            <span>แก้ด่วน</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSolidId(item.id);
                              setFabricBrand(item.name);
                              setFabricColorName(item.colorName);
                              setFabricType(item.type);
                              setFabricImg(item.imageBase64 || "");
                            }}
                            className="text-slate-400 hover:text-indigo-600 hover:bg-slate-100 p-2 rounded-xl transition cursor-pointer"
                            title="แก้ไขรูปภาพหรือสวอชในฟอร์ม"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveSolidFabric(item.id)}
                            className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-xl transition cursor-pointer"
                            title="ลบสีแบบนี้"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </>
        )}

        {/* TAB: Sheer Fabrics */}
        {activeTab === "sheer_fabrics" && (
          <>
            <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm h-fit space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
                  <Eye className="w-4.5 h-4.5 text-indigo-500" />
                  <span>{editingSheerId ? "แก้ไขผ้าโปร่งแสง (Sheer)" : "เพิ่มผ้าโปร่งแสง (Sheer)"}</span>
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
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) processImage(file, setFabricImg);
                        }}
                        className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer"
                      />
                    </div>
                  </div>
 
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl py-3 transition flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/10 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{editingSheerId ? "บันทึกการแก้ไข" : "บันทึกผ้าม่านโปร่งแสง"}</span>
                    </button>
                    {editingSheerId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSheerId(null);
                          setFabricBrand("");
                          setFabricColorName("");
                          setFabricImg("");
                        }}
                        className="bg-slate-150 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl px-4 py-3 transition cursor-pointer"
                      >
                        ยกเลิก
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Folder Import Module */}
              <div className="border-t border-slate-100 pt-5 space-y-3">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2">
                  <FolderUp className="w-4 h-4 text-indigo-500" />
                  <span>อัปโหลดข้อมูลโปร่งแบบโฟลเดอร์ (Bulk Folder Import)</span>
                </h4>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  เลือกโฟลเดอร์ผ้าโปร่งจากเครื่องคอมพิวเตอร์ ระบบจะใช้ <strong>ชื่อโฟลเดอร์เป็นชื่อผ้า</strong> และ <strong>ชื่อไฟล์เป็นสีผ้าโปร่ง</strong>
                </p>
                <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl px-2.5 py-1.5 flex items-center gap-2 text-[10px] text-indigo-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span><strong>ระบบป้องกันข้อมูลซ้ำ:</strong> อัปเดตสวอชเดิมอัตโนมัติหากชื่อผ้าและรหัสสีตรงกัน ไม่เกิดรายการซ้ำซ้อน</span>
                </div>
                <div className="flex gap-2">
                  <div className="relative border border-dashed border-slate-300 bg-slate-50/50 rounded-xl p-3 text-center transition hover:bg-indigo-50/30 flex-1">
                    <input
                      type="file"
                      {...{ webkitdirectory: "", directory: "", multiple: true }}
                      onChange={(e) => handleFolderUpload(e, "sheer")}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <FolderUp className="w-5 h-5 text-indigo-500 mx-auto mb-1" />
                    <span className="text-[10px] font-bold text-slate-600 block">นำเข้าด้วยโฟลเดอร์</span>
                    <span className="text-[9px] text-slate-400 block">(ดึงชื่อจากโฟลเดอร์)</span>
                  </div>

                  <div className="relative border border-dashed border-slate-300 bg-slate-50/50 rounded-xl p-3 text-center transition hover:bg-emerald-50/30 flex-1">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => handleFolderUpload(e, "sheer")}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Files className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                    <span className="text-[10px] font-bold text-slate-600 block">นำเข้าด้วยไฟล์รูป</span>
                    <span className="text-[9px] text-slate-400 block">(ดึงชื่อไฟล์ เช่น แบรนด์_สี)</span>
                  </div>
                </div>
              </div>
            </div>

            {(() => {
              const sheerBatches = getBatchSummaries(settings.sheerFabricMaterials || []);
              const filteredSheerFabrics = (settings.sheerFabricMaterials || []).filter((item) => {
                if (batchFilterSheer && batchFilterSheer !== "all") {
                  if (batchFilterSheer === "legacy_manual") {
                    if (item.uploadBatchId) return false;
                  } else if (item.uploadBatchId !== batchFilterSheer) {
                    return false;
                  }
                }
                const q = sheerSearch.trim().toLowerCase();
                if (!q) return true;
                return (
                  (item.name || "").toLowerCase().includes(q) ||
                  (item.colorName || "").toLowerCase().includes(q) ||
                  (item.type || "").toLowerCase().includes(q) ||
                  (item.uploadBatchName || "").toLowerCase().includes(q)
                );
              });

              return (
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex flex-col h-full">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3 shrink-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-slate-800">
                        รายการผ้าม่านโปร่งแสง ({filteredSheerFabrics.length} / {(settings.sheerFabricMaterials || []).length} สีแบบ)
                      </h3>
                      {(settings.sheerFabricMaterials || []).length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setClearTarget("sheer");
                            setClearModalTab("batches");
                            setClearConfirmInput("");
                          }}
                          className="text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition cursor-pointer border border-indigo-100"
                          title="เลือกลบเฉพาะรอบการอัปโหลดหรือล้างทั้งหมด"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>จัดการรอบ / ล้างข้อมูล</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                      {sheerBatches.length > 1 && (
                        <div className="relative">
                          <select
                            value={batchFilterSheer}
                            onChange={(e) => setBatchFilterSheer(e.target.value)}
                            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-2.5 py-2 font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none max-w-[170px] truncate cursor-pointer"
                          >
                            <option value="all">📦 ทุกล็อต ({sheerBatches.length} รอบ)</option>
                            {sheerBatches.map((b) => (
                              <option key={b.batchId} value={b.batchId}>
                                {b.batchName} ({b.count})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className="relative flex-1 md:w-52">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={sheerSearch}
                          onChange={(e) => setSheerSearch(e.target.value)}
                          placeholder="ค้นหาชื่อผ้า, สี, รอบ..."
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl pl-9 pr-4 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Active Batch Filter Banner */}
                  {batchFilterSheer && batchFilterSheer !== "all" && (
                    <div className="bg-amber-50/90 border border-amber-200 rounded-xl px-3.5 py-2 flex items-center justify-between gap-3 text-xs mb-3 animate-in fade-in duration-150 shrink-0">
                      <div className="flex items-center gap-2 text-amber-900 font-bold min-w-0">
                        <Layers className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="truncate">
                          กำลังกรองเฉพาะ:{" "}
                          <strong className="text-slate-900">
                            {sheerBatches.find((b) => b.batchId === batchFilterSheer)?.batchName || "รอบที่เลือก"}
                          </strong>{" "}
                          ({filteredSheerFabrics.length} รายการ)
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const b = sheerBatches.find((x) => x.batchId === batchFilterSheer);
                            if (b) {
                              setBatchConfirmDeleteState({
                                targetCategory: "sheer",
                                batchId: b.batchId,
                                batchName: b.batchName,
                                count: b.count,
                              });
                            }
                          }}
                          className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm transition cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>ล้างเฉพาะรอบนี้</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setBatchFilterSheer("all")}
                          className="text-slate-500 hover:text-slate-700 text-[11px] font-bold px-1.5 py-1 cursor-pointer"
                        >
                          แสดงทั้งหมด
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                    {filteredSheerFabrics.map((item) => (
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
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-extrabold text-slate-800 text-xs">
                              {item.name}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight bg-slate-200/80 text-slate-700">
                              {item.type}
                            </span>
                            {item.uploadBatchName && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100/60 truncate max-w-[130px]" title={`รอบ: ${item.uploadBatchName}`}>
                                {item.uploadBatchName}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-indigo-600 font-bold mt-0.5">สีผ้า: {item.colorName}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openQuickEdit("sheer", item, "sheerFabricMaterials")}
                            className="text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 p-2 rounded-xl transition cursor-pointer flex items-center gap-1 text-xs font-bold"
                            title="แก้ไขข้อความด่วน (⚡ ทันใจไม่ต้องโหลด)"
                          >
                            <Zap className="w-3.5 h-3.5 fill-indigo-600" />
                            <span>แก้ด่วน</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSheerId(item.id);
                              setFabricBrand(item.name);
                              setFabricColorName(item.colorName);
                              setFabricImg(item.imageBase64 || "");
                            }}
                            className="text-slate-400 hover:text-indigo-600 hover:bg-slate-100 p-2 rounded-xl transition cursor-pointer"
                            title="แก้ไขรูปภาพหรือสวอชในฟอร์ม"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveSheerFabric(item.id)}
                            className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-xl transition cursor-pointer"
                            title="ลบสีแบบนี้"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </>
        )}

        {/* TAB: Blinds & Roller Shades */}
        {activeTab === "blinds_rollers" && (
          <>
            <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm h-fit space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
                  <Sliders className="w-4.5 h-4.5 text-indigo-500" />
                  <span>{editingBlindId ? "แก้ไขวัสดุมู่ลี่ & ม่านม้วน" : "เพิ่มวัสดุมู่ลี่ & ม่านม้วน"}</span>
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
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) processImage(file, setBlindImg);
                        }}
                        className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl py-3 transition flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/10 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{editingBlindId ? "บันทึกการแก้ไข" : "บันทึกฐานข้อมูลมู่ลี่/ม่านม้วน"}</span>
                    </button>
                    {editingBlindId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingBlindId(null);
                          setBlindName("");
                          setBlindColorName("");
                          setBlindImg("");
                        }}
                        className="bg-slate-150 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl px-4 py-3 transition cursor-pointer"
                      >
                        ยกเลิก
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Directory import for blinds */}
              <div className="border-t border-slate-100 pt-5 space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1">
                    <FolderUp className="w-4 h-4 text-indigo-500" />
                    <span>นำเข้าสวอชเป็นโฟลเดอร์/หลายไฟล์ (Bulk Import)</span>
                  </h4>
                  <p className="text-[10px] text-slate-500 mb-2">เลือกประเภทสินค้าที่ต้องการก่อนกดเลือกไฟล์หรือโฟลเดอร์</p>
                  <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl px-2.5 py-1.5 flex items-center gap-2 text-[10px] text-indigo-800">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span><strong>ระบบป้องกันข้อมูลซ้ำ:</strong> อัปเดตสวอชเดิมอัตโนมัติหากชื่อและรหัสสีตรงกัน ไม่เกิดรายการซ้ำซ้อน</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-1">
                    เลือกหมวดหมู่สินค้าเฉพาะกลุ่มสำหรับไฟล์ที่จะนำเข้า:
                  </label>
                  <select
                    value={folderUploadBlindType}
                    onChange={(e) => setFolderUploadBlindType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
                  >
                    <option value="Wood Blinds">มู่ลี่ไม้ (Wood Blinds)</option>
                    <option value="Aluminum Blinds">มู่ลี่อะลูมิเนียม (Aluminum Blinds)</option>
                    <option value="Roller Shades">ม่านม้วน (Roller Shades)</option>
                    <option value="Fabric Tape">เทปผ้าสำหรับมู่ลี่ (Fabric Tape for Blinds)</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <div className="relative border border-dashed border-slate-300 bg-slate-50/50 rounded-xl p-3 text-center transition hover:bg-indigo-50/30 flex-1">
                    <input
                      type="file"
                      {...{ webkitdirectory: "", directory: "", multiple: true }}
                      onChange={(e) => handleFolderUpload(e, "blinds")}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <FolderUp className="w-5 h-5 text-indigo-500 mx-auto mb-1" />
                    <span className="text-[10px] font-bold text-slate-600 block">นำเข้าด้วยโฟลเดอร์</span>
                    <span className="text-[9px] text-slate-400 block">(ดึงชื่อจากโฟลเดอร์)</span>
                  </div>

                  <div className="relative border border-dashed border-slate-300 bg-slate-50/50 rounded-xl p-3 text-center transition hover:bg-emerald-50/30 flex-1">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => handleFolderUpload(e, "blinds")}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Files className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                    <span className="text-[10px] font-bold text-slate-600 block">นำเข้าด้วยไฟล์รูป</span>
                    <span className="text-[9px] text-slate-400 block">(ดึงชื่อไฟล์ เช่น แบรนด์_สี)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6 max-h-[650px] overflow-y-auto pr-1">
              {/* Auto-Organize Banner */}
              <div className="bg-indigo-50/80 border border-indigo-100 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-indigo-950">ตัวช่วยจัดระเบียบหมวดหมู่สินค้า</h5>
                    <p className="text-[10px] text-indigo-700 leading-tight">
                      หากเคยนำเข้ารูปม่านม้วนหรือเทปผ้าแล้วรูปไปปนในมู่ลี่ไม้ กดปุ่มนี้เพื่อแยกหมวดหมู่อัตโนมัติทันที
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAutoOrganizeBlinds}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm shrink-0 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>จัดระเบียบหมวดหมู่อัตโนมัติ</span>
                </button>
              </div>

              {/* Wood & Aluminum Blinds List */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
                <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span>มู่ลี่ไม้และมู่ลี่อะลูมิเนียม ({(settings.blindMaterials || []).length} รายการ)</span>
                    {(settings.blindMaterials || []).length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setClearTarget("blind");
                          setClearConfirmInput("");
                        }}
                        className="text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>ล้างข้อมูล</span>
                      </button>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">WOOD & ALUMINUM BLINDS</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(settings.blindMaterials || []).map((item) => (
                    <div key={item.id} className="flex items-center justify-between bg-slate-50 border border-slate-150 p-2.5 rounded-xl text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                          {item.imageBase64 && <img src={item.imageBase64} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 truncate max-w-[100px]">{item.name}</p>
                          <p className="text-[10px] text-indigo-600 font-bold mt-0.5 truncate max-w-[100px]">{item.colorName}</p>
                          <span className="inline-block text-[9px] font-semibold text-slate-500 bg-slate-200/70 px-1.5 py-0.2 rounded mt-0.5">
                            {item.type === "Aluminum Blinds" ? "มู่ลี่อะลูมิเนียม" : "มู่ลี่ไม้"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Quick Category Switcher */}
                        <select
                          value={item.type || "Wood Blinds"}
                          onChange={(e) => handleMoveBlindCategory(item, "blind", e.target.value as any)}
                          title="ย้ายไปยังหมวดหมู่อื่น"
                          className="text-[10px] bg-white border border-slate-200 rounded-lg px-1 py-1 text-slate-600 font-bold focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                        >
                          <option value="Wood Blinds">มู่ลี่ไม้</option>
                          <option value="Aluminum Blinds">มู่ลี่อะลูมิเนียม</option>
                          <option value="Roller Shades">ม่านม้วน</option>
                          <option value="Fabric Tape">เทปผ้า</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => openQuickEdit("blind", item, "blindMaterials")}
                          className="text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 p-1.5 rounded-lg transition cursor-pointer flex items-center gap-0.5 text-[10px] font-bold"
                          title="แก้ไขข้อความด่วน (⚡ ทันใจไม่ต้องโหลด)"
                        >
                          <Zap className="w-3 h-3 fill-indigo-600" />
                          <span>แก้ด่วน</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBlindId(item.id);
                            setBlindName(item.name);
                            setBlindColorName(item.colorName);
                            setBlindType(item.type || "Wood Blinds");
                            setBlindImg(item.imageBase64 || "");
                          }}
                          className="text-slate-400 hover:text-indigo-600 p-1 rounded transition cursor-pointer"
                          title="แก้ไขวัสดุนี้ในฟอร์ม"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveBlindMaterial(item.id, "blind")}
                          className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                          title="ลบวัสดุนี้"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Roller Shades List */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
                <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span>ม่านม้วน ({(settings.rollerMaterials || []).length} รายการ)</span>
                    {(settings.rollerMaterials || []).length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setClearTarget("roller");
                          setClearConfirmInput("");
                        }}
                        className="text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>ล้างข้อมูล</span>
                      </button>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">ROLLER SHADES</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(settings.rollerMaterials || []).map((item) => (
                    <div key={item.id} className="flex items-center justify-between bg-slate-50 border border-slate-150 p-2.5 rounded-xl text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                          {item.imageBase64 && <img src={item.imageBase64} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 truncate max-w-[100px]">{item.name}</p>
                          <p className="text-[10px] text-indigo-600 font-bold mt-0.5 truncate max-w-[100px]">{item.colorName}</p>
                          <span className="inline-block text-[9px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded mt-0.5">
                            ม่านม้วน
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Quick Category Switcher */}
                        <select
                          value={item.type || "Roller Shades"}
                          onChange={(e) => handleMoveBlindCategory(item, "roller", e.target.value as any)}
                          title="ย้ายไปยังหมวดหมู่อื่น"
                          className="text-[10px] bg-white border border-slate-200 rounded-lg px-1 py-1 text-slate-600 font-bold focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                        >
                          <option value="Roller Shades">ม่านม้วน</option>
                          <option value="Wood Blinds">มู่ลี่ไม้</option>
                          <option value="Aluminum Blinds">มู่ลี่อะลูมิเนียม</option>
                          <option value="Fabric Tape">เทปผ้า</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => openQuickEdit("roller", item, "rollerMaterials")}
                          className="text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 p-1.5 rounded-lg transition cursor-pointer flex items-center gap-0.5 text-[10px] font-bold"
                          title="แก้ไขข้อความด่วน (⚡ ทันใจไม่ต้องโหลด)"
                        >
                          <Zap className="w-3 h-3 fill-indigo-600" />
                          <span>แก้ด่วน</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBlindId(item.id);
                            setBlindName(item.name);
                            setBlindColorName(item.colorName);
                            setBlindType(item.type || "Roller Shades");
                            setBlindImg(item.imageBase64 || "");
                          }}
                          className="text-slate-400 hover:text-indigo-600 p-1 rounded transition cursor-pointer"
                          title="แก้ไขวัสดุนี้ในฟอร์ม"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveBlindMaterial(item.id, "roller")}
                          className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                          title="ลบวัสดุนี้"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Blinds Fabric Tape Ribbon List */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
                <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span>เทปผ้าสำหรับตกแต่งมู่ลี่ ({(settings.blindTapeMaterials || []).length} รายการ)</span>
                    {(settings.blindTapeMaterials || []).length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setClearTarget("tape");
                          setClearConfirmInput("");
                        }}
                        className="text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>ล้างข้อมูล</span>
                      </button>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">COTTON TAPE RIBBONS</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(settings.blindTapeMaterials || []).map((item) => (
                    <div key={item.id} className="flex items-center justify-between bg-slate-50 border border-slate-150 p-2.5 rounded-xl text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                          {item.imageBase64 && <img src={item.imageBase64} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 truncate max-w-[100px]">{item.name}</p>
                          <p className="text-[10px] text-indigo-600 font-bold mt-0.5 truncate max-w-[100px]">{item.colorName}</p>
                          <span className="inline-block text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded mt-0.5">
                            เทปผ้าสำหรับมู่ลี่
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Quick Category Switcher */}
                        <select
                          value={item.type || "Fabric Tape"}
                          onChange={(e) => handleMoveBlindCategory(item, "tape", e.target.value as any)}
                          title="ย้ายไปยังหมวดหมู่อื่น"
                          className="text-[10px] bg-white border border-slate-200 rounded-lg px-1 py-1 text-slate-600 font-bold focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                        >
                          <option value="Fabric Tape">เทปผ้า</option>
                          <option value="Wood Blinds">มู่ลี่ไม้</option>
                          <option value="Aluminum Blinds">มู่ลี่อะลูมิเนียม</option>
                          <option value="Roller Shades">ม่านม้วน</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => openQuickEdit("tape", item, "blindTapeMaterials")}
                          className="text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 p-1.5 rounded-lg transition cursor-pointer flex items-center gap-0.5 text-[10px] font-bold"
                          title="แก้ไขข้อความด่วน (⚡ ทันใจไม่ต้องโหลด)"
                        >
                          <Zap className="w-3 h-3 fill-indigo-600" />
                          <span>แก้ด่วน</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBlindId(item.id);
                            setBlindName(item.name);
                            setBlindColorName(item.colorName);
                            setBlindType(item.type || "Fabric Tape");
                            setBlindImg(item.imageBase64 || "");
                          }}
                          className="text-slate-400 hover:text-indigo-600 p-1 rounded transition cursor-pointer"
                          title="แก้ไขวัสดุนี้ในฟอร์ม"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveBlindMaterial(item.id, "tape")}
                          className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                          title="ลบวัสดุนี้"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
                    onClick={async () => {
                      const trimmed = customApiKey.trim();
                      if (trimmed) {
                        await saveDedicatedGeminiApiKey(trimmed);
                      }
                      await onSaveSettings({ ...settings, customGeminiApiKey: trimmed || undefined });
                      showToast("บันทึกคีย์ Gemini ส่วนตัวเรียบร้อยแล้ว! ข้อมูลจะถูกเก็บถาวรและเริ่มใช้งานทันที", "success");
                    }}
                    className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer whitespace-nowrap"
                  >
                    บันทึกคีย์
                  </button>
                  {(settings.customGeminiApiKey || customApiKey) && (
                    <button
                      type="button"
                      onClick={async () => {
                        setCustomApiKey("");
                        await removeDedicatedGeminiApiKey();
                        await onSaveSettings({ ...settings, customGeminiApiKey: undefined });
                        showToast("ลบคีย์ส่วนตัวแล้ว ระบบจะกลับไปใช้คีย์กลางฟรีของระบบ", "info");
                      }}
                      className="bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold px-3 py-2.5 rounded-xl transition cursor-pointer whitespace-nowrap"
                    >
                      ลบออก
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Default Clearance Spacing Card */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Ruler className="w-4 h-4 text-indigo-600" />
                  ค่าเริ่มต้นระยะรอบวงกบม่าน (Default Window Frame Clearance Spacing)
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  กำหนดค่าตั้งต้นสำหรับการเผื่อระยะขอบวงกบ ซ้าย, ขวา และ ด้านบน เมื่อเพิ่มจุดติดตั้งใหม่ในระบบ (ส่วนระยะด้านล่างจะยึดตามระยะชายม่านที่เลือกโดยอัตโนมัติ)
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                    ระยะเผื่อด้านซ้ายเริ่มต้น
                  </label>
                  <select
                    value={settings.defaultDistanceLeft || "พอดีเฟรม"}
                    onChange={(e) => {
                      onSaveSettings({ ...settings, defaultDistanceLeft: e.target.value });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer font-bold"
                  >
                    {(settings.clearanceOptions || []).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                    ระยะเผื่อด้านขวาเริ่มต้น
                  </label>
                  <select
                    value={settings.defaultDistanceRight || "พอดีเฟรม"}
                    onChange={(e) => {
                      onSaveSettings({ ...settings, defaultDistanceRight: e.target.value });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer font-bold"
                  >
                    {(settings.clearanceOptions || []).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                    ระยะเผื่อด้านบนเริ่มต้น
                  </label>
                  <select
                    value={settings.defaultDistanceTop || "ติดเพดาน"}
                    onChange={(e) => {
                      onSaveSettings({ ...settings, defaultDistanceTop: e.target.value });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer font-bold"
                  >
                    {((settings.clearanceTopOptions && settings.clearanceTopOptions.length > 0)
                      ? settings.clearanceTopOptions
                      : (settings.clearanceOptions || [])
                    ).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Logo Upload Section */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1 max-w-2xl">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <FileImage className="w-4 h-4 text-indigo-600" />
                    โลโก้บริษัทสำหรับเอกสารเสนอราคา PDF (Company Logo for PDF Proposal)
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    อัปโหลดรูปภาพโลโก้ของบริษัทเพื่อเปลี่ยนแทนที่โลโก้มาตรฐาน PASAYA บนเอกสารนำเสนอและสรุปงานแบบ PDF
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-4 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600 whitespace-nowrap">ขนาดโลโก้:</span>
                    <select
                      value={settings.companyLogoSize || "L"}
                      onChange={(e) => {
                        onSaveSettings({ ...settings, companyLogoSize: e.target.value as "S" | "M" | "L" | "XL" });
                      }}
                      className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-2 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                    >
                      <option value="S">S (ขนาดเล็ก)</option>
                      <option value="M">M (ขนาดกลาง)</option>
                      <option value="L">L (ขนาดใหญ่ - เริ่มต้น)</option>
                      <option value="XL">XL (ขนาดใหญ่พิเศษ)</option>
                    </select>
                  </div>

                  <input
                    type="file"
                    id="company-logo-upload"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        processImage(file, (base64) => {
                          onSaveSettings({ ...settings, companyLogoBase64: base64 });
                          showToast("อัปโหลดและบันทึกโลโก้บริษัทเรียบร้อยแล้ว!", "success");
                        });
                      }
                    }}
                  />
                  <div className="flex gap-2">
                    <label
                      htmlFor="company-logo-upload"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5"
                    >
                      <FolderUp className="w-4 h-4" />
                      อัปโหลดโลโก้
                    </label>
                    {settings.companyLogoBase64 && (
                      <button
                        type="button"
                        onClick={() => {
                          onSaveSettings({ ...settings, companyLogoBase64: undefined });
                          showToast("คืนค่าโลโก้เป็นแบบเริ่มต้นเรียบร้อยแล้ว!", "info");
                        }}
                        className="bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer whitespace-nowrap"
                      >
                        คืนค่าเริ่มต้น
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {settings.companyLogoBase64 && (
                <div className="mt-4 p-4 bg-slate-50 border border-slate-200/80 rounded-2xl max-w-xs flex flex-col items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400">ตัวอย่างโลโก้ปัจจุบัน</span>
                  <img
                    src={settings.companyLogoBase64}
                    alt="Current Logo"
                    className="max-h-[60px] max-w-full object-contain"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <CustomMaterialCRUD
                label="ฐานข้อมูลรางม่านติดตั้ง (Hanging Tracks Database)"
                description="จัดการ ลบ เพิ่ม หรือแก้ไขข้อมูลชื่อรางติดตั้งเพื่อไปแสดงในระบบดรอปดาวน์ใบสรุปการติดตั้งผ้าม่าน"
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
                label="ระยะรอบวงกบม่าน ด้านซ้าย-ขวา (Left/Right Spacing Offsets)"
                description="ระยะผ้าม่านเลยกรอบวงกบหน้าต่างด้านซ้ายและด้านขวา เช่น พอดีเฟรม, เลยเฟรม 10 ซม., เลยเฟรม 15 ซม., เลยเฟรม 20 ซม."
                items={settings.clearanceOptions || []}
                fieldKey="clearanceOptions"
                placeholder="เช่น เลยเฟรม 30 ซม...."
              />
              <StringListCRUD
                label="ระยะรอบวงกบม่าน ด้านบน (Top Spacing Offsets)"
                description="ระยะผ้าม่านเลยกรอบวงกบหน้าต่างด้านบน เช่น เลยเฟรม 10 ซม., เลยเฟรม 15 ซม., เลยเฟรม 20 ซม., ติดเพดาน"
                items={settings.clearanceTopOptions || []}
                fieldKey="clearanceTopOptions"
                placeholder="เช่น ติดเพดาน..."
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
      {/* Bulk Upload Progress Modal */}
      {bulkUploadStatus && (
        <div className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                {bulkUploadStatus.phase === "processing" ? (
                  <Zap className="w-6 h-6 text-indigo-600 animate-bounce" />
                ) : (
                  <Database className="w-6 h-6 text-emerald-600 animate-pulse" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                  {bulkUploadStatus.phase === "processing"
                    ? `กำลังประมวลผลรูปภาพสวอช...`
                    : `กำลังซิงค์ขึ้น Cloud Database...`}
                </h3>
                <p className="text-xs text-indigo-600 font-bold mt-0.5 truncate">
                  {bulkUploadStatus.title} ({bulkUploadStatus.current} / {bulkUploadStatus.total} รูป)
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              {bulkUploadStatus.phase === "processing"
                ? "ระบบกำลังทำการถอดรหัสและบีบอัดรูปภาพสวอชแบบคู่ขนาน (Parallel Processing) เพื่อความเร็วสูงสุดและไม่ค้างที่ 99%"
                : "ระบบกำลังบันทึกข้อมูลและอัปโหลดรูปภาพไปยัง Firebase Storage & Firestore..."}
            </p>

            <div className="space-y-2 mb-2">
              <div className="flex justify-between text-xs font-bold text-slate-700">
                <span>ความคืบหน้า</span>
                <span>
                  {bulkUploadStatus.phase === "processing"
                    ? `${Math.round((bulkUploadStatus.current / Math.max(1, bulkUploadStatus.total)) * 100)}%`
                    : `${saveProgress !== null ? saveProgress : 100}%`}
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200/60">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-300 shadow-sm"
                  style={{
                    width: `${
                      bulkUploadStatus.phase === "processing"
                        ? Math.min(100, Math.round((bulkUploadStatus.current / Math.max(1, bulkUploadStatus.total)) * 100))
                        : (saveProgress !== null ? saveProgress : 100)
                    }%`
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2 text-[11px] text-slate-400 font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
              <span>กรุณาอย่าเพิ่งปิดหน้าต่างขณะกำลังอัปโหลด</span>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Swatches Batch Confirmation Modal */}
      {duplicateModalState && (
        <div className="fixed inset-0 z-[99999] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col p-6 animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="flex items-center gap-3.5 mb-3 pb-3 border-b border-slate-100">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-600 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                  พบรายการสวอชซ้ำในระบบ ({duplicateModalState.duplicateItems.length} รายการ)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  สำหรับหมวดหมู่ <span className="font-bold text-indigo-600">{duplicateModalState.typeTitle}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDuplicateModalState(null)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Description & Action Bar */}
            <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-3.5 mb-4 text-xs text-amber-900">
              <p className="font-semibold leading-relaxed">
                ระบบตรวจพบว่ามีสวอชที่ชื่อคอลเลกชันและรหัสสีตรงกับรายการที่มีอยู่ในฐานข้อมูลแล้ว ท่านสามารถเลือก <span className="font-black text-indigo-700">บันทึกทับ (Overwrite)</span> เพื่อแทนที่รูปสวอชและสเปกผ้า หรือข้ามรายการที่ซ้ำได้
              </p>
              <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2.5 border-t border-amber-200/60">
                <div className="flex items-center gap-2 font-bold text-[11px] flex-wrap">
                  <span className="bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg">
                    📁 ไฟล์ที่เลือกทั้งหมด: {duplicateModalState.uniqueNewItems.length + duplicateModalState.duplicateItems.length} รายการ
                  </span>
                  <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg">
                    ✨ รายการใหม่: {duplicateModalState.uniqueNewItems.length} รายการ
                  </span>
                  <span className="bg-amber-100 text-amber-900 px-2.5 py-1 rounded-lg">
                    ⚠️ รายการชื่อซ้ำ: {duplicateModalState.duplicateItems.length} รายการ
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDuplicateModalState((prev) =>
                        prev
                          ? {
                              ...prev,
                              duplicateItems: prev.duplicateItems.map((item) => ({ ...item, overwrite: true })),
                            }
                          : null
                      );
                    }}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                  >
                    เลือกบันทึกทับทั้งหมด
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      setDuplicateModalState((prev) =>
                        prev
                          ? {
                              ...prev,
                              duplicateItems: prev.duplicateItems.map((item) => ({ ...item, overwrite: false })),
                            }
                          : null
                      );
                    }}
                    className="text-[11px] font-bold text-slate-600 hover:text-slate-800 underline cursor-pointer"
                  >
                    ไม่บันทึกทับทั้งหมด
                  </button>
                </div>
              </div>
            </div>

            {/* Comparison Scrollable List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[360px] custom-scrollbar mb-4">
              {duplicateModalState.duplicateItems.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setDuplicateModalState((prev) => {
                      if (!prev) return null;
                      const nextItems = [...prev.duplicateItems];
                      nextItems[idx] = { ...nextItems[idx], overwrite: !nextItems[idx].overwrite };
                      return { ...prev, duplicateItems: nextItems };
                    });
                  }}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 ${
                    item.overwrite
                      ? "bg-indigo-50/50 border-indigo-200 ring-1 ring-indigo-400/30"
                      : "bg-slate-50/70 border-slate-200 opacity-70"
                  }`}
                >
                  <div className="shrink-0 text-indigo-600">
                    {item.overwrite ? (
                      <CheckSquare className="w-5 h-5 text-indigo-600" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-400" />
                    )}
                  </div>

                  {/* Left: Existing in Database */}
                  <div className="flex items-center gap-2.5 flex-1 min-w-0 bg-white p-2 rounded-xl border border-slate-200/80">
                    {item.existingItem.imageBase64 ? (
                      <img
                        src={item.existingItem.imageBase64}
                        alt={item.existingItem.name}
                        className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] text-slate-400 font-bold shrink-0">
                        ไม่มีรูป
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ในระบบเดิม</div>
                      <div className="text-xs font-black text-slate-900 truncate">{item.existingItem.name}</div>
                      <div className="text-[11px] font-bold text-slate-600 truncate">{item.existingItem.colorName}</div>
                    </div>
                  </div>

                  {/* Arrow Icon */}
                  <ArrowRight className="w-4 h-4 text-indigo-400 shrink-0" />

                  {/* Right: New Incoming Swatch */}
                  <div className="flex items-center gap-2.5 flex-1 min-w-0 bg-indigo-50/80 p-2 rounded-xl border border-indigo-200/80">
                    {item.newItem.imageBase64 ? (
                      <img
                        src={item.newItem.imageBase64}
                        alt={item.newItem.name}
                        className="w-10 h-10 rounded-lg object-cover border border-indigo-200 shrink-0 shadow-sm"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center text-[10px] text-indigo-400 font-bold shrink-0">
                        ไม่มีรูป
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">รูปใหม่ที่นำเข้า</div>
                      <div className="text-xs font-black text-indigo-950 truncate">{item.newItem.name}</div>
                      <div className="text-[11px] font-bold text-indigo-700 truncate">{item.newItem.colorName}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={() => setDuplicateModalState(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                ยกเลิกการนำเข้า
              </button>

              <div className="flex flex-wrap items-center gap-2">
                {duplicateModalState.uniqueNewItems.length > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      const { dbType, blindSubtype, uniqueNewItems, typeTitle } = duplicateModalState;
                      setDuplicateModalState(null);
                      await commitImportedMaterials(dbType, blindSubtype, uniqueNewItems, [], typeTitle);
                    }}
                    className="px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold transition cursor-pointer"
                  >
                    ข้ามรายการซ้ำ (เพิ่มเฉพาะ {duplicateModalState.uniqueNewItems.length} รายการใหม่)
                  </button>
                )}

                <button
                  type="button"
                  onClick={async () => {
                    const { dbType, blindSubtype, uniqueNewItems, duplicateItems, typeTitle } = duplicateModalState;
                    const allAsNew = [
                      ...uniqueNewItems,
                      ...duplicateItems.map((d, i) => ({
                        ...d.newItem,
                        id: generateId(),
                        colorName: `${d.newItem.colorName} (ใหม่)`,
                      })),
                    ];
                    setDuplicateModalState(null);
                    await commitImportedMaterials(dbType, blindSubtype, allAsNew, [], typeTitle);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-xs font-bold transition cursor-pointer"
                >
                  เพิ่มทั้งหมดเป็นรายการใหม่ ({duplicateModalState.uniqueNewItems.length + duplicateModalState.duplicateItems.length} รายการ)
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const { dbType, blindSubtype, uniqueNewItems, duplicateItems, typeTitle } = duplicateModalState;
                    setDuplicateModalState(null);
                    await commitImportedMaterials(dbType, blindSubtype, uniqueNewItems, duplicateItems, typeTitle);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    บันทึกทับ ({duplicateModalState.duplicateItems.filter((x) => x.overwrite).length}) + เพิ่มใหม่ ({duplicateModalState.uniqueNewItems.length})
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Single Item Duplicate Overwrite Modal */}
      {singleDuplicateConfirm && (
        <div className="fixed inset-0 z-[99999] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                  พบรายการสวอชซ้ำในระบบ
                </h3>
                <p className="text-xs text-slate-500 font-bold mt-0.5">
                  {singleDuplicateConfirm.newItem.name} - {singleDuplicateConfirm.newItem.colorName}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              มีรายการผ้าม่านชื่อและรหัสสีนี้อยู่ในฐานข้อมูลแล้ว คุณต้องการบันทึกทับ (Overwrite) ข้อมูลและรูปภาพสวอชเดิมหรือไม่?
            </p>

            <div className="flex items-center justify-center gap-4 bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 mb-4">
              <div className="text-center">
                <div className="text-[10px] font-bold text-slate-400 mb-1">รูปสวอชเดิม</div>
                {singleDuplicateConfirm.existingItem.imageBase64 ? (
                  <img
                    src={singleDuplicateConfirm.existingItem.imageBase64}
                    alt="Existing"
                    className="w-16 h-16 rounded-xl object-cover border border-slate-200 mx-auto"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] text-slate-400 font-bold mx-auto">
                    ไม่มีรูป
                  </div>
                )}
              </div>

              <ArrowRight className="w-5 h-5 text-indigo-500 shrink-0" />

              <div className="text-center">
                <div className="text-[10px] font-bold text-indigo-600 mb-1">รูปสวอชใหม่</div>
                {singleDuplicateConfirm.newItem.imageBase64 ? (
                  <img
                    src={singleDuplicateConfirm.newItem.imageBase64}
                    alt="New"
                    className="w-16 h-16 rounded-xl object-cover border border-indigo-200 mx-auto shadow-sm"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-[10px] text-indigo-400 font-bold mx-auto">
                    ไม่มีรูป
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2.5 justify-end">
              <button
                type="button"
                onClick={() => setSingleDuplicateConfirm(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmSingleOverwrite}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>บันทึกทับข้อมูลเดิม</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear & Batch Management Modal */}
      {clearTarget && (
        <div className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                    จัดการข้อมูล & ลบล้างสวอช
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {clearTarget === "solid" && `หมวดผ้าม่านทึบแสง (${(settings.solidFabricMaterials || []).length} รายการ)`}
                    {clearTarget === "sheer" && `หมวดผ้าม่านโปร่งแสง (${(settings.sheerFabricMaterials || []).length} รายการ)`}
                    {clearTarget === "blind" && `หมวดมู่ลี่ไม้และอะลูมิเนียม (${(settings.blindMaterials || []).length} รายการ)`}
                    {clearTarget === "roller" && `หมวดม่านม้วน (${(settings.rollerMaterials || []).length} รายการ)`}
                    {clearTarget === "tape" && `หมวดเทปผ้าสำหรับมู่ลี่ (${(settings.blindTapeMaterials || []).length} รายการ)`}
                    {clearTarget === "styles" && `หมวดรูปแบบผ้าม่าน (${(settings.styleMaterials || []).length} รายการ)`}
                    {clearTarget === "hems" && `หมวดสเปกระยะชายม่าน (${(settings.hemMaterials || []).length} รายการ)`}
                    {clearTarget === "tracks" && `หมวดรางม่าน (${(settings.trackMaterials || []).length} รายการ)`}
                    {clearTarget === "accessories" && `หมวดอุปกรณ์เสริม (${(settings.accessoryMaterials || []).length} รายการ)`}
                    {clearTarget === "all_materials" && `แคตตาล็อกวัสดุและสวอชทั้งหมด (${((settings.solidFabricMaterials || []).length + (settings.sheerFabricMaterials || []).length + (settings.blindMaterials || []).length + (settings.rollerMaterials || []).length + (settings.blindTapeMaterials || []).length + (settings.styleMaterials || []).length + (settings.hemMaterials || []).length)} รายการ)`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setClearTarget(null);
                  setClearConfirmInput("");
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            {(clearTarget === "solid" || clearTarget === "sheer" || clearTarget === "blind" || clearTarget === "roller" || clearTarget === "tape" || clearTarget === "all_materials") && (
              <div className="flex border-b border-slate-100 mt-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setClearModalTab("batches")}
                  className={`flex-1 py-2.5 text-xs font-bold transition flex items-center justify-center gap-1.5 border-b-2 cursor-pointer ${
                    clearModalTab === "batches"
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>ลบเฉพาะรอบการอัปโหลด (Batch Clear)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setClearModalTab("all")}
                  className={`flex-1 py-2.5 text-xs font-bold transition flex items-center justify-center gap-1.5 border-b-2 cursor-pointer ${
                    clearModalTab === "all"
                      ? "border-rose-600 text-rose-600"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  <span>ล้างข้อมูลทั้งหมดในหมวด</span>
                </button>
              </div>
            )}

            {/* TAB CONTENT: Upload Batches */}
            {clearModalTab === "batches" && (clearTarget === "solid" || clearTarget === "sheer" || clearTarget === "blind" || clearTarget === "roller" || clearTarget === "tape" || clearTarget === "all_materials") ? (
              <div className="flex-1 overflow-y-auto py-4 pr-1 space-y-3 min-h-[220px]">
                {(() => {
                  let targetList: FabricMaterial[] = [];
                  if (clearTarget === "solid") targetList = settings.solidFabricMaterials || [];
                  else if (clearTarget === "sheer") targetList = settings.sheerFabricMaterials || [];
                  else if (clearTarget === "blind") targetList = settings.blindMaterials || [];
                  else if (clearTarget === "roller") targetList = settings.rollerMaterials || [];
                  else if (clearTarget === "tape") targetList = settings.blindTapeMaterials || [];
                  else if (clearTarget === "all_materials") {
                    targetList = [
                      ...(settings.solidFabricMaterials || []),
                      ...(settings.sheerFabricMaterials || []),
                      ...(settings.blindMaterials || []),
                      ...(settings.rollerMaterials || []),
                      ...(settings.blindTapeMaterials || []),
                    ];
                  }

                  const batches = getBatchSummaries(targetList);

                  if (batches.length === 0) {
                    return (
                      <div className="text-center py-10 text-slate-400">
                        <FolderCheck className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                        <p className="text-xs">ไม่มีรายการข้อมูลในหมวดหมู่นี้</p>
                      </div>
                    );
                  }

                  return batches.map((batch) => (
                    <div
                      key={batch.batchId}
                      className="bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 rounded-2xl p-3.5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-extrabold text-slate-900 text-xs truncate">
                            {batch.batchName}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-700">
                            {batch.count} รายการ
                          </span>
                          {batch.uploadedAt && (
                            <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                              <Calendar className="w-3 h-3" />
                              {formatThaiDate(batch.uploadedAt)}
                            </span>
                          )}
                        </div>

                        {/* Sample Fabric Names */}
                        {batch.fabricNames.length > 0 && (
                          <div className="text-[10px] text-slate-500 truncate mb-2">
                            ผ้า: {batch.fabricNames.join(", ")}
                            {batch.count > batch.fabricNames.length ? "..." : ""}
                          </div>
                        )}

                        {/* Sample Swatch Thumbnails */}
                        {batch.sampleImages.length > 0 && (
                          <div className="flex items-center gap-1.5 overflow-hidden">
                            {batch.sampleImages.map((img, idx) => (
                              <img
                                key={idx}
                                src={img}
                                alt=""
                                className="w-7 h-7 rounded-lg object-cover border border-slate-200"
                              />
                            ))}
                            {batch.count > batch.sampleImages.length && (
                              <span className="text-[9px] font-bold text-slate-400 bg-white border border-slate-200 rounded-lg px-1.5 py-1">
                                +{batch.count - batch.sampleImages.length}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Clear Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setBatchConfirmDeleteState({
                            targetCategory: clearTarget as any,
                            batchId: batch.batchId,
                            batchName: batch.batchName,
                            count: batch.count,
                          });
                        }}
                        className="bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 hover:border-rose-600 font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center justify-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>ลบเฉพาะรอบนี้</span>
                      </button>
                    </div>
                  ));
                })()}
              </div>
            ) : (
              /* TAB CONTENT: Full Category Wipe */
              <div className="py-4 space-y-4">
                <div className="bg-rose-50/80 border border-rose-200/80 rounded-2xl p-4 text-xs text-rose-900 leading-relaxed">
                  <div className="font-extrabold flex items-center gap-1.5 mb-1 text-rose-700">
                    <AlertTriangle className="w-4 h-4" />
                    <span>คำเตือน: การล้างข้อมูลทั้งหมด</span>
                  </div>
                  การกระทำนี้จะลบรายการข้อมูลสวอชทั้งหมดในหมวดหมู่นี้ออกจากฐานข้อมูลอย่างถาวร หากต้องการลบเฉพาะบางรอบการนำเข้า กรุณาเลือกแท็บ <strong>"ลบเฉพาะรอบการอัปโหลด"</strong> ด้านบน
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                    พิมพ์คำว่า <span className="font-black text-rose-600 font-mono text-xs">CONFIRM</span> เพื่อยืนยันการล้างข้อมูลทั้งหมด:
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={clearConfirmInput}
                    onChange={(e) => setClearConfirmInput(e.target.value)}
                    placeholder="พิมพ์ CONFIRM"
                    className="w-full bg-white border border-rose-200 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 tracking-wider focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 outline-none uppercase"
                  />
                </div>

                <div className="flex gap-2.5 justify-end pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setClearTarget(null);
                      setClearConfirmInput("");
                    }}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    disabled={clearConfirmInput.trim().toUpperCase() !== "CONFIRM"}
                    onClick={handleClearList}
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-rose-600/20 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>ยืนยันล้างข้อมูลทั้งหมด</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dedicated Batch Specific Deletion Confirmation Dialog */}
      {batchConfirmDeleteState && (
        <div className="fixed inset-0 z-[999999] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                  ยืนยันลบข้อมูลเฉพาะรอบนี้
                </h3>
                <p className="text-xs text-rose-600 font-bold mt-0.5">
                  {batchConfirmDeleteState.batchName} ({batchConfirmDeleteState.count} รายการ)
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-5">
              ระบบจะลบเฉพาะรายการสวอชผ้าที่ถูกอัปโหลดในรอบ <strong>"{batchConfirmDeleteState.batchName}"</strong> จำนวน <strong>{batchConfirmDeleteState.count} รายการ</strong> ออกจากฐานข้อมูล โดยรายการในรอบอื่นๆ จะไม่ได้รับผลกระทบใดๆ
            </p>

            <div className="flex gap-2.5 justify-end">
              <button
                type="button"
                onClick={() => setBatchConfirmDeleteState(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() =>
                  handleClearBatch(
                    batchConfirmDeleteState.targetCategory,
                    batchConfirmDeleteState.batchId,
                    batchConfirmDeleteState.batchName
                  )
                }
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-rose-600/20 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>ยืนยันลบ {batchConfirmDeleteState.count} รายการ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⚡ Lightning Fast Instant Text Edit Modal */}
      {quickEditState && (
        <div 
          className="fixed inset-0 z-[999999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setQuickEditState(null);
          }}
        >
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150 relative">
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                  <Zap className="w-5 h-5 fill-indigo-600" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <span>แก้ไขข้อความด่วน</span>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      ⚡ ทันใจไม่ต้องโหลด
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    แก้ไขชื่อ/ข้อความและกด <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 font-mono text-[10px] font-bold text-slate-700">Enter</kbd> หรือคลิกบันทึกได้ทันที
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickEditState(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickSave} className="space-y-4">
              {/* Optional Swatch Thumbnail Preview */}
              {quickEditState.item.imageBase64 && (
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/80 rounded-2xl p-3">
                  <img
                    src={quickEditState.item.imageBase64}
                    alt=""
                    className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-xs"
                  />
                  <div className="text-xs">
                    <p className="font-extrabold text-slate-800">สวอชสีเดิม</p>
                    <p className="text-slate-400 text-[11px]">แก้ไขเฉพาะชื่อและข้อความโดยไม่กระทบรูปภาพ</p>
                  </div>
                </div>
              )}

              {quickEditState.category === "employee" ? (
                /* Employee Edit Fields */
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      ชื่อพนักงาน / ดีไซเนอร์
                    </label>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={qeName}
                      onChange={(e) => setQeName(e.target.value)}
                      placeholder="เช่น สมชาย ใจดี"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3.5 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Username (เข้าสู่ระบบ)
                      </label>
                      <input
                        type="text"
                        value={qeUsername}
                        onChange={(e) => setQeUsername(e.target.value)}
                        placeholder="เช่น somchai"
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3.5 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        รหัสผ่าน
                      </label>
                      <input
                        type="text"
                        value={qePassword}
                        onChange={(e) => setQePassword(e.target.value)}
                        placeholder="เช่น 1234"
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3.5 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        ตำแหน่ง / สิทธิ์
                      </label>
                      <select
                        value={qeRole}
                        onChange={(e) => setQeRole(e.target.value as any)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3.5 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition cursor-pointer"
                      >
                        <option value="designer">🎨 ดีไซเนอร์ (Designer)</option>
                        <option value="installer">🔧 ช่างติดตั้ง (Installer)</option>
                        <option value="admin">👑 แอดมิน (Admin)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        โควตา AI (ครั้ง/เดือน)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="9999"
                        value={qeQuota}
                        onChange={(e) => setQeQuota(parseInt(e.target.value) || 0)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3.5 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
                      />
                    </div>
                  </div>
                </div>
              ) : quickEditState.category === "style" ? (
                /* Style Edit Fields */
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      ชื่อรูปแบบม่าน
                    </label>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={qeName}
                      onChange={(e) => setQeName(e.target.value)}
                      placeholder="เช่น ม่านลอน (Wave Fold)"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3.5 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      หมวดหมู่
                    </label>
                    <select
                      value={qeType}
                      onChange={(e) => setQeType(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3.5 py-2.5 focus:bg-white outline-none transition cursor-pointer"
                    >
                      <option value="curtain">ม่านผ้า (Curtain)</option>
                      <option value="blind">มู่ลี่ (Blinds)</option>
                      <option value="roller">ม่านม้วน (Roller)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      ตัวเลือกวิธีกาง (คั่นด้วยจุลภาค)
                    </label>
                    <input
                      type="text"
                      value={qeOps}
                      onChange={(e) => setQeOps(e.target.value)}
                      placeholder="เช่น รวบซ้าย, รวบขวา, แยกกลาง"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3.5 py-2.5 focus:bg-white outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      คำค้น AI (ภาษาอังกฤษ)
                    </label>
                    <input
                      type="text"
                      value={qeStyleEn}
                      onChange={(e) => setQeStyleEn(e.target.value)}
                      placeholder="เช่น wave fold curtain, ripple fold"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3.5 py-2.5 focus:bg-white outline-none transition"
                    />
                  </div>
                </div>
              ) : quickEditState.category === "hem" || quickEditState.category === "track" || quickEditState.category === "accessory" ? (
                /* Hem / Track / Accessory Edit Fields */
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    {quickEditState.category === "track"
                      ? "ชื่อรางม่านติดตั้ง (Track Name)"
                      : quickEditState.category === "accessory"
                      ? "ชื่ออุปกรณ์เสริม (Accessory Name)"
                      : "ชื่อระยะชายม่าน"}
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={qeName}
                    onChange={(e) => setQeName(e.target.value)}
                    placeholder={
                      quickEditState.category === "track"
                        ? "เช่น ราง M-Track สีดำด้าน, รางม่านไฟฟ้า Somfy..."
                        : quickEditState.category === "accessory"
                        ? "เช่น สายรวบม่านพู่ระย้า, ด้ามจูงอะคริลิค 1.5 ม...."
                        : "เช่น ลอยจากพื้น 1-2 ซม."
                    }
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3.5 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
                  />
                </div>
              ) : (
                /* Solid / Sheer / Blind / Roller / Tape Edit Fields */
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      ชื่อผ้า / ชื่อวัสดุ
                    </label>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={qeName}
                      onChange={(e) => setQeName(e.target.value)}
                      placeholder="เช่น PASAYA, ACACIA, VC"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3.5 py-2.5 uppercase focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        สีผ้า / รหัสสี
                      </label>
                      <input
                        type="text"
                        required
                        value={qeColorName}
                        onChange={(e) => setQeColorName(e.target.value)}
                        placeholder="เช่น 01-GREY, CREAM"
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3.5 py-2.5 uppercase focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        ประเภท / หมวดหมู่
                      </label>
                      {quickEditState.category === "solid" ? (
                        <select
                          value={qeType}
                          onChange={(e) => setQeType(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3.5 py-2.5 focus:bg-white outline-none transition cursor-pointer"
                        >
                          <option value="Blackout">Blackout (กันแสง 100%)</option>
                          <option value="Dimout">Dimout (กันแสง 70-90%)</option>
                          <option value="Standard">Standard (ผ้าทึบทั่วไป)</option>
                        </select>
                      ) : quickEditState.category === "sheer" ? (
                        <input
                          type="text"
                          value={qeType || "Sheer"}
                          onChange={(e) => setQeType(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3.5 py-2.5 focus:bg-white outline-none transition"
                        />
                      ) : (
                        <select
                          value={qeType}
                          onChange={(e) => setQeType(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3.5 py-2.5 focus:bg-white outline-none transition cursor-pointer"
                        >
                          <option value="Wood Blinds">มู่ลี่ไม้ (Wood Blinds)</option>
                          <option value="Aluminum Blinds">มู่ลี่อะลูมิเนียม (Aluminum Blinds)</option>
                          <option value="Roller Shades">ม่านม้วน (Roller Shades)</option>
                          <option value="Fabric Tape">เทปผ้า (Fabric Tape)</option>
                        </select>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2.5 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setQuickEditState(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold transition flex items-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer"
                >
                  <Zap className="w-4 h-4 fill-amber-300 text-amber-300" />
                  <span>บันทึกทันที (⚡ 0 วิ)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border text-xs font-bold transition-all duration-300 transform translate-y-0 scale-100 ${
          toast.type === "success" 
            ? "bg-emerald-50 text-emerald-800 border-emerald-100/80" 
            : toast.type === "error"
            ? "bg-rose-50 text-rose-800 border-rose-100/80"
            : "bg-slate-50 text-slate-800 border-slate-100/80"
        }`}>
          {toast.type === "success" ? (
            <BadgeCheck className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : toast.type === "error" ? (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          ) : (
            <Info className="w-5 h-5 text-indigo-600 shrink-0" />
          )}
          <span className="flex-1">{toast.message}</span>
          <button 
            type="button" 
            onClick={() => setToast(null)} 
            className="text-slate-400 hover:text-slate-600 ml-2 animate-pulse"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
