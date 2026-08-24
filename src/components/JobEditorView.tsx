import React, { useState } from "react";
import { Save, Plus, ArrowLeft, ArrowRight, Eye, EyeOff, BadgeCheck, FileText, ShoppingBag, PlusCircle } from "lucide-react";
import { Job, WindowItem, Employee, Settings } from "../types";
import { WindowEditor } from "./WindowEditor";
import { generateId } from "../lib/storage";

interface JobEditorViewProps {
  job: Job | null;
  employees: Employee[];
  activeEmployeeId: string;
  allWindows: WindowItem[];
  settings: Settings;
  onSaveJob: (job: Job) => void;
  onSaveWindow: (window: WindowItem, isSilent?: boolean) => Promise<boolean>;
  onUpdateWindowMetadata?: (id: string, metadata: Partial<WindowItem>) => Promise<void>;
  onDeleteWindow: (id: string) => void;
  onIncrementEmployeeAiUsage: (id: string) => void;
  onBack: () => void;
  onPreviewPDF?: (job: Job) => void;
  currentUser?: Employee | null;
}

export const JobEditorView: React.FC<JobEditorViewProps> = ({
  job,
  employees,
  activeEmployeeId,
  allWindows,
  settings,
  onSaveJob,
  onSaveWindow,
  onUpdateWindowMetadata,
  onDeleteWindow,
  onIncrementEmployeeAiUsage,
  onBack,
  onPreviewPDF,
  currentUser,
}) => {
  const [formData, setFormData] = useState<Job>(
    job || {
      id: generateId(),
      customerName: "",
      phone: "",
      address: "",
      notes: "",
      employeeId: activeEmployeeId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
  );

  const [savedJob, setSavedJob] = useState<Job | null>(job);

  // Filter windows related to this job ID, sorted by orderIndex ascending
  const jobWindows = savedJob 
    ? allWindows
        .filter((w) => w.jobId === savedJob.id)
        .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
    : [];

  // Active window tab state: defaults to first window's ID if exists, otherwise "new"
  const [activeWindowId, setActiveWindowId] = useState<string>(() => {
    return jobWindows.length > 0 ? jobWindows[0].id : "new";
  });

  const handleSaveWindowWrapper = async (windowItem: WindowItem, isSilent = false): Promise<boolean> => {
    const isAddingNew = !allWindows.some(w => w.id === windowItem.id);
    const success = await onSaveWindow(windowItem, isSilent);
    if (success && !isSilent) {
      if (isAddingNew) {
        alert(`🎉 สำเร็จ: เพิ่มจุดติดตั้งใหม่ "${windowItem.roomName}" (บานรหัส ${windowItem.windowCode}) เรียบร้อยแล้ว!`);
        setActiveWindowId(windowItem.id);
      } else {
        alert(`🎉 สำเร็จ: บันทึกข้อมูลการเปลี่ยนแปลงสำหรับ "${windowItem.roomName}" (บานรหัส ${windowItem.windowCode}) เรียบร้อยแล้ว`);
      }
    }
    return success;
  };

  const handleDeleteWindowWrapper = (id: string) => {
    onDeleteWindow(id);
    const remaining = jobWindows.filter((w) => w.id !== id);
    if (remaining.length > 0) {
      setActiveWindowId(remaining[0].id);
    } else {
      setActiveWindowId("new");
    }
  };

  const handleMoveWindow = async (win: WindowItem, direction: number) => {
    const idx = jobWindows.findIndex((w) => w.id === win.id);
    if (idx === -1) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= jobWindows.length) return;

    const targetWin = jobWindows[targetIdx];

    // Create shallow copy of jobWindows array to manipulate indices
    const updatedWindows = [...jobWindows];
    // Swap positions in local array
    updatedWindows[idx] = targetWin;
    updatedWindows[targetIdx] = win;

    // Normalize orderIndex sequentially for all windows of this job to guarantee strict sequencing
    for (let i = 0; i < updatedWindows.length; i++) {
      updatedWindows[i] = { ...updatedWindows[i], orderIndex: i };
    }

    try {
      if (onUpdateWindowMetadata) {
        // Fast metadata-only updates
        await onUpdateWindowMetadata(updatedWindows[idx].id, { orderIndex: idx });
        await onUpdateWindowMetadata(updatedWindows[targetIdx].id, { orderIndex: targetIdx });
      } else {
        // Save changes to both swapped windows in firestore (fallback)
        await onSaveWindow(updatedWindows[idx], true);
        await onSaveWindow(updatedWindows[targetIdx], true);
      }
    } catch (err) {
      console.error("Failed to reorder windows:", err);
    }
  };

  const handleToggleHide = async (win: WindowItem) => {
    const nextHidden = !win.isHidden;
    try {
      if (onUpdateWindowMetadata) {
        await onUpdateWindowMetadata(win.id, { isHidden: nextHidden });
      } else {
        await onSaveWindow({ ...win, isHidden: nextHidden }, true);
      }
    } catch (err) {
      console.error("Failed to toggle window visibility:", err);
    }
  };

  const handleSaveJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName.trim()) {
      alert("กรุณากรอกชื่อลูกค้า");
      return;
    }
    onSaveJob(formData);
    setSavedJob(formData);
    alert("🎉 สำเร็จ: บันทึกข้อมูลลูกค้า/โครงการเรียบร้อยแล้ว!");
  };

  const activeEmployee = employees.find((e) => e.id === formData.employeeId);
  const activeEmployeeQuotaExceeded = activeEmployee
    ? activeEmployee.aiUsed >= activeEmployee.aiQuota
    : false;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      {/* Back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
      >
        <ArrowLeft className="w-4.5 h-4.5" />
        <span>ย้อนกลับไปหน้าโครงการ</span>
      </button>

      {/* Main Customer details card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 md:p-8 shadow-sm">
        <h2 className="text-2xl font-black text-slate-900 mb-1 flex items-center gap-2">
          <FileText className="w-6 h-6 text-indigo-500" />
          <span>{job ? "รายละเอียดงานติดตั้งผ้าม่าน" : "สร้างใบสรุปการติดตั้งผ้าม่าน / งานใหม่"}</span>
        </h2>
        <p className="text-xs text-slate-400 mb-6 mt-0">
          กรอกรายละเอียดข้อมูลลูกค้าเพื่อระบุจุดติดตั้งแต่ละบานและสร้างสเปกสำหรับจำลอง AI
        </p>

        <form onSubmit={handleSaveJob} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                ชื่อลูกค้า / ชื่อผู้ติดต่อ <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                placeholder="เช่น คุณณัฐพล มั่งคั่ง"
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                เบอร์โทรศัพท์ลูกค้า
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="เช่น 089-123-4567"
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                ดีไซเนอร์ที่ดูแลโปรเจกต์นี้ <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                disabled={currentUser?.role !== "admin"}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
              >
                <option value="">- เลือกดีไซเนอร์ผู้รับผิดชอบ -</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                หมายเหตุเพิ่มเติม / ข้อตกลงพิเศษ
              </label>
              <input
                type="text"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="เช่น ลูกค้าขอติดตั้งรางโค้ง, นัดวัดหน้างานวันที่..."
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                ที่อยู่สถานที่ติดตั้งม่านหน้างานจริง
              </label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="เช่น โครงการบ้านแสนสิริ ซอย 5 ถนนรัชดาภิเษก แขวงดินแดง เขตดินแดง กรุงเทพฯ"
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition h-20 resize-none"
              ></textarea>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl px-8 py-3.5 shadow-lg shadow-emerald-600/10 transition flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4.5 h-4.5" />
              <span>{savedJob ? "บันทึกการเปลี่ยนแปลงลูกค้า" : "เริ่มระบุรายละเอียดหน้าต่าง"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Windows Details Sections: Only visible once Customer Job is saved */}
      {savedJob ? (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-slate-950 text-white px-6 py-4 rounded-3xl shadow-lg border border-slate-800">
            <div>
              <h3 className="text-base font-extrabold flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-indigo-400" />
                <span>จุดติดตั้งหน้าต่างทั้งหมด ({jobWindows.length} จุด)</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">ระบุสเปก, สลับรูปสวอช และเจนรูป AI ในบานติดตั้งด้านล่าง</p>
            </div>
            {onPreviewPDF && (
              <button
                type="button"
                onClick={() => onPreviewPDF(formData)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/10 shrink-0 self-stretch sm:self-auto justify-center"
              >
                <FileText className="w-4 h-4" />
                <span>👁️ พรีวิวใบเสนอราคา PDF</span>
              </button>
            )}
          </div>

          {/* Tabs/Grid navigation for easy window switching without scrolling */}
          <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-3 flex flex-wrap gap-2 items-center">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider pl-2 mr-1">
              เลือกบานติดตั้ง:
            </span>
            {jobWindows.map((win, idx) => {
              const isActive = activeWindowId === win.id;
              const isHidden = !!win.isHidden;
              return (
                <button
                  key={win.id}
                  type="button"
                  onClick={() => setActiveWindowId(win.id)}
                  className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? isHidden
                        ? "bg-slate-800 border-slate-800 text-slate-300 shadow-md shadow-slate-900/10 opacity-90"
                        : "bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-900/10"
                      : isHidden
                        ? "bg-slate-50 border-slate-200/50 text-slate-400 border-dashed opacity-60 hover:opacity-100"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span className={`text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-mono font-bold shrink-0 ${
                    isActive ? "bg-slate-700 text-white" : "bg-indigo-50 text-indigo-700"
                  }`}>
                    {win.windowCode || `W${idx + 1}`}
                  </span>
                  <span className={isHidden ? "line-through flex items-center gap-1 text-[11px]" : ""}>
                    <span>{win.roomName || `ห้องนอน (${idx + 1})`}</span>
                    {isHidden && <EyeOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setActiveWindowId("new")}
              className={`px-4 py-2 text-xs font-bold rounded-xl border border-dashed transition-all flex items-center gap-1.5 cursor-pointer ${
                activeWindowId === "new"
                  ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/10"
                  : "bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100"
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>เพิ่มจุดติดตั้งใหม่</span>
            </button>
          </div>

          {/* Active Window sequencing and visibility action controls */}
          {(() => {
            const activeWin = jobWindows.find((w) => w.id === activeWindowId);
            if (!activeWin) return null;
            const idx = jobWindows.findIndex((w) => w.id === activeWindowId);
            return (
              <div className="flex flex-wrap items-center gap-2 bg-slate-100/85 border border-slate-200/50 rounded-2xl p-3 text-xs shadow-sm">
                <span className="font-extrabold text-slate-500 pl-1 mr-1">ลำดับ / ซ่อนแสดงบานนี้:</span>
                
                {/* Move Up/Left */}
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => handleMoveWindow(activeWin, -1)}
                  className="bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-700 font-extrabold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer shadow-sm"
                  title="เลื่อนไปทางซ้าย"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>เลื่อนซ้าย</span>
                </button>

                {/* Move Down/Right */}
                <button
                  type="button"
                  disabled={idx === jobWindows.length - 1}
                  onClick={() => handleMoveWindow(activeWin, 1)}
                  className="bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-700 font-extrabold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer shadow-sm"
                  title="เลื่อนไปทางขวา"
                >
                  <span>เลื่อนขวา</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <div className="h-4 w-px bg-slate-300 mx-1.5"></div>

                {/* Hide / Unhide Toggle */}
                <button
                  type="button"
                  onClick={() => handleToggleHide(activeWin)}
                  className={`font-black px-4 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border shadow-sm ${
                    activeWin.isHidden
                      ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                  title={activeWin.isHidden ? "เลิกซ่อนจุดนี้ ให้แสดงในเอกสารรายงาน PDF" : "ซ่อนจุดติดตั้งนี้จากใบเสนอราคาและ PDF รายงาน"}
                >
                  {activeWin.isHidden ? (
                    <>
                      <Eye className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                      <span>เลิกซ่อนบานนี้</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                      <span>ซ่อนบานนี้จาก PDF</span>
                    </>
                  )}
                </button>
                
                {activeWin.isHidden && (
                  <span className="text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-100/60 px-3 py-1 rounded-full animate-pulse ml-auto">
                    ⚠️ บานนี้ถูกซ่อนอยู่ จะไม่รวมอยู่ในรายงาน/ใบเสนอราคา PDF สรุปของโครงการ
                  </span>
                )}
              </div>
            );
          })()}

          {/* Render active window only */}
          <div className="space-y-8">
            {activeWindowId === "new" ? (
              <WindowEditor
                isNew={true}
                index={jobWindows.length + 1}
                jobId={savedJob.id}
                settings={settings}
                onSave={handleSaveWindowWrapper}
                incrementEmployeeAiUsage={() => onIncrementEmployeeAiUsage(formData.employeeId)}
                activeEmployeeQuotaExceeded={activeEmployeeQuotaExceeded}
              />
            ) : (
              (() => {
                const activeWin = jobWindows.find((w) => w.id === activeWindowId);
                if (!activeWin) return null;
                const idx = jobWindows.findIndex((w) => w.id === activeWindowId);
                return (
                  <WindowEditor
                    key={activeWin.id}
                    winData={activeWin}
                    index={idx + 1}
                    jobId={savedJob.id}
                    settings={settings}
                    onSave={handleSaveWindowWrapper}
                    onDelete={() => handleDeleteWindowWrapper(activeWin.id)}
                    incrementEmployeeAiUsage={() => onIncrementEmployeeAiUsage(formData.employeeId)}
                    activeEmployeeQuotaExceeded={activeEmployeeQuotaExceeded}
                  />
                );
              })()
            )}
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 text-center py-10 rounded-2xl max-w-lg mx-auto">
          <PlusCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 font-bold text-sm">ยังไม่สามารถระบุสเปกบานม่านได้</p>
          <p className="text-xs text-slate-400 mt-1 px-4">
            กรุณากดปุ่ม <strong>"เริ่มระบุรายละเอียดหน้าต่าง"</strong> เพื่อสร้างฐานงานและบันทึกข้อมูลด้านบนก่อน
          </p>
        </div>
      )}
    </div>
  );
};
