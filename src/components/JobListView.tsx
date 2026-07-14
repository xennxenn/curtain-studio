import React, { useState } from "react";
import { Search, Calendar, Phone, MapPin, Eye, FileDown, Trash2, FolderOpen, AlertCircle } from "lucide-react";
import { Job, WindowItem, Employee } from "../types";

interface JobListViewProps {
  jobs: Job[];
  allWindows: WindowItem[];
  employees: Employee[];
  onEditJob: (job: Job) => void;
  onDeleteJob: (id: string) => void;
  onExportPDF: (job: Job) => void;
  isExporting: boolean;
}

export const JobListView: React.FC<JobListViewProps> = ({
  jobs,
  allWindows,
  employees,
  onEditJob,
  onDeleteJob,
  onExportPDF,
  isExporting,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredJobs = jobs.filter((job) =>
    job.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.phone.includes(searchQuery) ||
    job.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getWindowCountForJob = (jobId: string) => {
    return allWindows.filter((w) => w.jobId === jobId).length;
  };

  const getDesignerName = (employeeId: string) => {
    return employees.find((e) => e.id === employeeId)?.name || "ไม่ระบุดีไซเนอร์";
  };

  if (jobs.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200 shadow-sm max-w-4xl mx-auto p-8 animate-fade-in">
        <div className="bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-100">
          <FolderOpen className="w-8 h-8 text-indigo-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">ยังไม่มีโครงการติดตั้ง</h3>
        <p className="text-slate-400 text-sm mt-1 max-w-sm mx-auto">
          เริ่มต้นสร้างใบเสนอราคาและการติดตั้งจำลองผ้าม่านด้วย AI แผงแรกของคุณตอนนี้
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Search Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อลูกค้า, เบอร์โทร..."
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl pl-10 pr-4 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
          />
        </div>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          ค้นพบทั้งหมด: {filteredJobs.length} / {jobs.length} รายการ
        </span>
      </div>

      {filteredJobs.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100 p-8 max-w-xl mx-auto">
          <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-slate-700">ไม่พบข้อมูลที่ตรงกับการค้นหา</h4>
          <p className="text-xs text-slate-400 mt-1">กรุณาลองป้อนข้อความค้นหาอื่นๆ</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredJobs.map((job) => {
            const windowCount = getWindowCountForJob(job.id);
            const designerName = getDesignerName(job.employeeId);

            return (
              <div
                key={job.id}
                className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden hover:shadow-xl hover:shadow-slate-200/30 hover:border-slate-300/80 transition-all duration-300 flex flex-col justify-between"
              >
                {/* Job Metadata */}
                <div className="p-5 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-extrabold text-slate-800 text-lg leading-tight truncate max-w-[180px]">
                        {job.customerName}
                      </h3>
                      <div className="flex items-center text-xs text-slate-400 mt-1.5 font-medium">
                        <Calendar className="w-3.5 h-3.5 mr-1" />
                        {new Date(job.createdAt).toLocaleDateString("th-TH")}
                      </div>
                    </div>
                    <span className="bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-bold px-3 py-1 rounded-full shrink-0">
                      {windowCount} หน้าต่าง / จุด
                    </span>
                  </div>

                  <div className="space-y-2 border-t border-slate-50 pt-3.5 text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-mono">{job.phone || "ไม่ระบุเบอร์โทร"}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2 leading-relaxed">
                        {job.address || "ไม่ระบุสถานที่ติดตั้ง"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer buttons */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                  <button
                    onClick={() => onEditJob(job)}
                    className="flex-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-xs py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-4 h-4" />
                    <span>แก้ไข / ดูงาน</span>
                  </button>

                  <button
                    onClick={() => onExportPDF(job)}
                    disabled={isExporting}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10 disabled:opacity-50 cursor-pointer"
                  >
                    <FileDown className="w-4 h-4" />
                    <span>Export PDF</span>
                  </button>

                  <button
                    onClick={() => {
                      if (confirm("คุณแน่ใจหรือไม่ว่าต้องการลบงานติดตั้งของลูกค้ารายนี้?")) {
                        onDeleteJob(job.id);
                      }
                    }}
                    className="p-2.5 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-xl text-slate-400 hover:text-rose-600 transition-all cursor-pointer"
                    title="ลบโครงการ"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
