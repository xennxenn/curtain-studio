import React, { useState } from "react";
import { Save, Plus, ArrowLeft, BadgeCheck, FileText, ShoppingBag, PlusCircle } from "lucide-react";
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
  onSaveWindow: (window: WindowItem) => Promise<boolean>;
  onDeleteWindow: (id: string) => void;
  onIncrementEmployeeAiUsage: (id: string) => void;
  onBack: () => void;
}

export const JobEditorView: React.FC<JobEditorViewProps> = ({
  job,
  employees,
  activeEmployeeId,
  allWindows,
  settings,
  onSaveJob,
  onSaveWindow,
  onDeleteWindow,
  onIncrementEmployeeAiUsage,
  onBack,
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

  // Filter windows related to this job ID
  const jobWindows = savedJob ? allWindows.filter((w) => w.jobId === savedJob.id) : [];

  const handleSaveJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName.trim()) {
      alert("กรุณากรอกชื่อลูกค้า");
      return;
    }
    onSaveJob(formData);
    setSavedJob(formData);
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
          <span>{job ? "รายละเอียดงานติดตั้งผ้าม่าน" : "สร้างใบเสนอราคา / งานใหม่"}</span>
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
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition cursor-pointer"
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
          <div className="flex justify-between items-center bg-slate-950 text-white px-6 py-4 rounded-2xl shadow-md">
            <div>
              <h3 className="text-base font-extrabold flex items-center gap-1.5">
                <ShoppingBag className="w-5 h-5 text-indigo-400" />
                <span>จุดติดตั้งหน้าต่างทั้งหมด ({jobWindows.length} จุด)</span>
              </h3>
            </div>
          </div>

          {/* Render individual Saved Window cards */}
          <div className="space-y-8">
            {jobWindows.map((win, idx) => (
              <WindowEditor
                key={win.id}
                winData={win}
                index={idx + 1}
                jobId={savedJob.id}
                settings={settings}
                onSave={onSaveWindow}
                onDelete={() => onDeleteWindow(win.id)}
                incrementEmployeeAiUsage={() => onIncrementEmployeeAiUsage(formData.employeeId)}
                activeEmployeeQuotaExceeded={activeEmployeeQuotaExceeded}
              />
            ))}

            {/* Always show one fresh form at the bottom for adding new window */}
            <WindowEditor
              isNew={true}
              index={jobWindows.length + 1}
              jobId={savedJob.id}
              settings={settings}
              onSave={onSaveWindow}
              incrementEmployeeAiUsage={() => onIncrementEmployeeAiUsage(formData.employeeId)}
              activeEmployeeQuotaExceeded={activeEmployeeQuotaExceeded}
            />
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
