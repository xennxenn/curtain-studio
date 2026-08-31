import React, { useState } from "react";
import { Search, Calendar, Phone, MapPin, Eye, FileDown, Trash2, FolderOpen, AlertCircle, FileText, Plus, User, Layers, Sparkles } from "lucide-react";
import { Job, WindowItem, Employee } from "../types";

interface JobListViewProps {
  jobs: Job[];
  allWindows: WindowItem[];
  employees: Employee[];
  onEditJob: (job: Job) => void;
  onDeleteJob: (id: string) => void;
  onExportPDF: (job: Job) => void;
  onPreviewPDF: (job: Job) => void;
  isExporting: boolean;
}

export const JobListView: React.FC<JobListViewProps> = ({
  jobs,
  allWindows,
  employees,
  onEditJob,
  onDeleteJob,
  onExportPDF,
  onPreviewPDF,
  isExporting,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredJobs = jobs.filter((job) =>
    (job.customerName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (job.phone || "").includes(searchQuery) ||
    (job.address || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getWindowCountForJob = (jobId: string) => {
    return allWindows.filter((w) => w.jobId === jobId).length;
  };

  const getDesignerName = (employeeId: string) => {
    return employees.find((e) => e.id === employeeId)?.name || "ไม่ระบุดีไซเนอร์";
  };

  // Color generator for avatar based on name
  const getAvatarBg = (name: string) => {
    const colors = [
      "from-indigo-500 to-purple-600",
      "from-blue-500 to-cyan-600",
      "from-emerald-500 to-teal-600",
      "from-violet-500 to-indigo-600",
      "from-amber-500 to-orange-600",
      "from-rose-500 to-pink-600",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const totalWindowsCount = allWindows.length;

  if (jobs.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-3xl border border-slate-200/90 shadow-sm max-w-4xl mx-auto p-8 animate-fade-in">
        <div className="bg-gradient-to-tr from-indigo-50 to-purple-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-indigo-100/80 shadow-inner">
          <FolderOpen className="w-10 h-10 text-indigo-600" />
        </div>
        <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">ยังไม่มีโครงการติดตั้ง</h3>
        <p className="text-slate-500 text-sm mt-1.5 max-w-md mx-auto leading-relaxed">
          เริ่มต้นสร้างใบสรุปการติดตั้งผ้าม่าน ออกแบบจำลองด้วย AI และคำนวณใบเสนอราคาสำหรับลูกค้ารายแรกของคุณ
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Stats Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4.5 border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">โครงการทั้งหมด</div>
            <div className="text-2xl font-black text-slate-800 tracking-tight">{jobs.length} <span className="text-xs font-normal text-slate-400">งาน</span></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4.5 border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">จุดติดตั้งหน้าต่างรวม</div>
            <div className="text-2xl font-black text-slate-800 tracking-tight">{totalWindowsCount} <span className="text-xs font-normal text-slate-400">จุด / บาน</span></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4.5 border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <User className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">ดีไซเนอร์ในระบบ</div>
            <div className="text-2xl font-black text-slate-800 tracking-tight">{employees.length} <span className="text-xs font-normal text-slate-400">คน</span></div>
          </div>
        </div>
      </div>

      {/* Search Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อลูกค้า, เบอร์โทรศัพท์, หรือสถานที่..."
            className="w-full bg-slate-50 border border-slate-200/80 text-slate-800 text-sm rounded-xl pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition placeholder:text-slate-400 font-medium"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200/60">
            แสดง {filteredJobs.length} จาก {jobs.length} โครงการ
          </span>
        </div>
      </div>

      {filteredJobs.length === 0 ? (
        <div className="text-center py-14 bg-white rounded-2xl border border-slate-200/80 p-8 max-w-xl mx-auto shadow-xs">
          <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-700">ไม่พบโครงการที่ตรงกับคำค้นหา</h4>
          <p className="text-xs text-slate-400 mt-1">กรุณาลองป้อนชื่อลูกค้า เบอร์โทร หรือสถานที่ใหม่อีกครั้ง</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredJobs.map((job) => {
            const windowCount = getWindowCountForJob(job.id);
            const designerName = getDesignerName(job.employeeId);
            const initial = (job.customerName || "C").trim().charAt(0).toUpperCase();

            return (
              <div
                key={job.id}
                className="group bg-white rounded-2xl border border-slate-200/80 hover:border-indigo-200/80 shadow-xs hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-200 flex flex-col justify-between overflow-hidden"
              >
                {/* Job Metadata */}
                <div className="p-5 space-y-4">
                  <div className="flex items-start gap-3.5">
                    {/* Avatar Circle */}
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-tr ${getAvatarBg(job.customerName || "")} text-white font-extrabold text-lg flex items-center justify-center shadow-md shadow-indigo-500/10 shrink-0`}>
                      {initial}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-extrabold text-slate-900 text-base leading-tight truncate group-hover:text-indigo-600 transition-colors">
                          {job.customerName}
                        </h3>
                        <span className="bg-indigo-50 border border-indigo-100/80 text-indigo-600 text-[11px] font-bold px-2.5 py-0.5 rounded-full shrink-0">
                          {windowCount} จุด
                        </span>
                      </div>

                      <div className="flex items-center text-[11px] text-slate-400 mt-1 font-medium gap-2">
                        <span className="flex items-center">
                          <Calendar className="w-3 h-3 mr-1 text-slate-400" />
                          {job.createdAt ? new Date(job.createdAt).toLocaleDateString("th-TH") : "วันนี้"}
                        </span>
                        <span>•</span>
                        <span className="truncate text-slate-500 font-semibold">{designerName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-slate-100 pt-3.5 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-mono text-slate-700 font-medium">{job.phone || "ไม่ระบุเบอร์โทร"}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2 leading-relaxed text-slate-500">
                        {job.address || "ไม่ระบุสถานที่ติดตั้ง"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="p-3.5 bg-slate-50/80 border-t border-slate-100 flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => onEditJob(job)}
                      className="flex-1 bg-white hover:bg-indigo-50 hover:border-indigo-200 border border-slate-200/80 text-slate-800 hover:text-indigo-700 font-bold text-xs py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Eye className="w-3.5 h-3.5 text-indigo-600" />
                      <span>เปิดแก้ไขงาน</span>
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบโครงการของ "${job.customerName}" ?`)) {
                          onDeleteJob(job.id);
                        }
                      }}
                      className="p-2 hover:bg-rose-50 border border-transparent hover:border-rose-200/60 rounded-xl text-slate-400 hover:text-rose-600 transition-all cursor-pointer shrink-0"
                      title="ลบโครงการ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => onPreviewPDF(job)}
                      className="flex-1 bg-slate-200/70 hover:bg-slate-300/80 border border-slate-300/60 text-slate-700 font-bold text-xs py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      <span>Preview</span>
                    </button>

                    <button
                      onClick={() => onExportPDF(job)}
                      disabled={isExporting}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold text-xs py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      <span>Export PDF</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

