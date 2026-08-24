import React from "react";
import { Layout, Users, Sparkles, UserCheck, LogOut } from "lucide-react";
import { Employee } from "../types";

interface HeaderProps {
  employees: Employee[];
  activeEmployeeId: string;
  onActiveEmployeeChange: (id: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: Employee | null;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  employees,
  activeEmployeeId,
  onActiveEmployeeChange,
  activeTab,
  setActiveTab,
  currentUser,
  onLogout,
}) => {
  const activeEmployee = employees.find((e) => e.id === activeEmployeeId);
  const isAdmin = currentUser?.role === "admin";

  return (
    <header className="bg-slate-900 text-white shadow-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-4 gap-4">
          {/* Logo Brand */}
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center">
              <Layout className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                Curtain Treatment Studio
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                ระบบจำลองการติดตั้งผ้าม่านอัจฉริยะด้วย AI
              </p>
            </div>
          </div>

          {/* Employee & Quota Selector & Logout */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-800 border border-slate-700/60 rounded-xl px-3 py-2 flex items-center space-x-3">
              <div className="bg-indigo-500/10 p-1 rounded-lg">
                <UserCheck className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  พนักงานผู้ใช้งาน (Designer)
                </span>
                {isAdmin ? (
                  <select
                    value={activeEmployeeId}
                    onChange={(e) => onActiveEmployeeChange(e.target.value)}
                    className="bg-transparent border-none text-sm font-semibold text-white focus:outline-none focus:ring-0 p-0 pr-6 cursor-pointer"
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id} className="bg-slate-800 text-white">
                        {emp.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm font-semibold text-white mt-0.5">
                    {currentUser?.name || activeEmployee?.name || "ไม่ทราบชื่อ"}
                  </span>
                )}
              </div>
            </div>

            {/* Quota display */}
            {activeEmployee && (
              <div className="bg-slate-800 border border-slate-700/60 rounded-xl px-4 py-2 flex flex-col justify-center min-w-[120px]">
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 mb-1">
                  <span>AI PROPOSAL QUOTA</span>
                  <span className="text-indigo-400 font-mono">
                    {activeEmployee.aiUsed}/{activeEmployee.aiQuota}
                  </span>
                </div>
                <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      activeEmployee.aiUsed >= activeEmployee.aiQuota
                        ? "bg-rose-500"
                        : activeEmployee.aiUsed > activeEmployee.aiQuota * 0.8
                        ? "bg-amber-500"
                        : "bg-indigo-500"
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        (activeEmployee.aiUsed / activeEmployee.aiQuota) * 100
                      )}%`,
                    }}
                  ></div>
                </div>
              </div>
            )}

            {/* Logout button */}
            <button
              onClick={onLogout}
              className="bg-slate-800 hover:bg-rose-950 hover:text-rose-200 border border-slate-700/60 rounded-xl px-3 py-2.5 flex items-center gap-1.5 transition text-xs font-bold cursor-pointer"
              title="ออกจากระบบ"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span className="hidden sm:inline">ออกจากระบบ</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="border-t border-slate-800 bg-slate-900/60 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab("jobs")}
              className={`py-3.5 px-1 border-b-2 font-medium text-sm transition-all flex items-center gap-2 ${
                activeTab === "jobs"
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
              }`}
            >
              <Layout className="w-4 h-4" />
              <span>โครงการทั้งหมด</span>
            </button>

            <button
              onClick={() => setActiveTab("new_job")}
              className={`py-3.5 px-1 border-b-2 font-medium text-sm transition-all flex items-center gap-2 ${
                activeTab === "new_job"
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>สร้างใบสรุปการติดตั้งผ้าม่านใหม่</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => setActiveTab("settings")}
                className={`py-3.5 px-1 border-b-2 font-medium text-sm transition-all flex items-center gap-2 ${
                  activeTab === "settings"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
                }`}
              >
                <Users className="w-4 h-4" />
                <span>ตั้งค่าระบบและสเปกผ้า</span>
              </button>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};
