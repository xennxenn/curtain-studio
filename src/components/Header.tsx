import React, { useState, useEffect } from "react";
import { Layout, Users, Sparkles, UserCheck, LogOut, Wifi, Radio } from "lucide-react";
import { Employee } from "../types";
import { realtimeSync, RealtimeConnectionState } from "../lib/realtimeSync";

interface HeaderProps {
  employees: Employee[];
  activeEmployeeId: string;
  onActiveEmployeeChange: (id: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: Employee | null;
  onLogout: () => void;
  jobsCount?: number;
  materialsCount?: number;
  onForceSync?: () => void;
  isSyncing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  employees,
  activeEmployeeId,
  onActiveEmployeeChange,
  activeTab,
  setActiveTab,
  currentUser,
  onLogout,
  jobsCount = 0,
  materialsCount = 0,
  onForceSync,
  isSyncing = false,
}) => {
  const activeEmployee = employees.find((e) => e.id === activeEmployeeId);
  const isAdmin = currentUser?.role === "admin";

  const [realtimeState, setRealtimeState] = useState<{
    state: RealtimeConnectionState;
    activeClients: number;
  }>({
    state: "connecting",
    activeClients: 1,
  });

  useEffect(() => {
    const unsub = realtimeSync.subscribeStatus((st) => {
      setRealtimeState({
        state: st.state,
        activeClients: st.activeClients,
      });
    });
    return unsub;
  }, []);

  const isConnected = realtimeState.state === "connected";

  return (
    <header className="bg-slate-900/95 backdrop-blur-xl text-white shadow-2xl sticky top-0 z-50 border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-3.5 gap-3.5">
          {/* Logo Brand */}
          <div className="flex items-center space-x-3.5">
            <div className="relative group cursor-pointer" onClick={() => setActiveTab("jobs")}>
              <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl blur opacity-60 group-hover:opacity-100 transition duration-300"></div>
              <div className="relative bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-center">
                <Layout className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                  Curtain Treatment Studio
                </h1>
                <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  AI Pro
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                ระบบจำลองผ้าม่านอัจฉริยะ • ซิงค์ข้อมูลอัตโนมัติ Realtime
              </p>
            </div>
          </div>

          {/* Controls: Employee, Quota, Realtime Status, Logout */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Realtime Central WebSocket Broadcast Sync Badge */}
            <div className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition-all ${
              isConnected 
                ? "bg-slate-800/90 border-emerald-500/30 text-emerald-300 shadow-sm shadow-emerald-950/40" 
                : "bg-slate-800/90 border-amber-500/30 text-amber-300"
            }`}>
              <span className="relative flex h-2.5 w-2.5">
                {isConnected ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </>
                ) : (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                  </>
                )}
              </span>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold leading-tight">
                    {isConnected ? "⚡ Realtime Auto-Sync" : "🔄 กำลังเชื่อมต่อ Realtime"}
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                    isConnected ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  }`}>
                    {realtimeState.activeClients} จอ
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">
                  {materialsCount} วัสดุ • {jobsCount} งาน
                </span>
              </div>
              {onForceSync && (
                <button
                  onClick={onForceSync}
                  disabled={isSyncing}
                  className="ml-1 p-1 hover:bg-slate-700/80 rounded-lg text-slate-300 hover:text-white transition cursor-pointer disabled:opacity-50"
                  title="ซิงค์ฐานข้อมูลกลางทันที"
                >
                  <svg className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-indigo-400" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
            </div>

            {/* Employee Selector */}
            <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl px-3 py-1.5 flex items-center space-x-2.5">
              <div className="bg-indigo-500/20 p-1.5 rounded-lg border border-indigo-500/30">
                <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400">
                  Designer
                </span>
                {isAdmin ? (
                  <select
                    value={activeEmployeeId}
                    onChange={(e) => onActiveEmployeeChange(e.target.value)}
                    className="bg-transparent border-none text-xs font-bold text-white focus:outline-none focus:ring-0 p-0 pr-5 cursor-pointer"
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id} className="bg-slate-900 text-white">
                        {emp.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs font-bold text-white">
                    {currentUser?.name || activeEmployee?.name || "ไม่ทราบชื่อ"}
                  </span>
                )}
              </div>
            </div>

            {/* Quota display */}
            {activeEmployee && (
              <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl px-3 py-1.5 flex flex-col justify-center min-w-[110px]">
                <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 mb-1">
                  <span>AI QUOTA</span>
                  <span className="text-indigo-300 font-mono">
                    {activeEmployee.aiUsed}/{activeEmployee.aiQuota}
                  </span>
                </div>
                <div className="w-full bg-slate-700/80 h-1.5 rounded-full overflow-hidden">
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
              className="bg-slate-800/80 hover:bg-rose-950/60 hover:text-rose-200 border border-slate-700/70 hover:border-rose-800/50 rounded-xl px-2.5 py-2 flex items-center gap-1.5 transition text-xs font-bold cursor-pointer"
              title="ออกจากระบบ"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline text-xs">ออก</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="border-t border-slate-800/60 bg-slate-950/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-2 py-1.5" aria-label="Tabs">
            <button
              onClick={() => setActiveTab("jobs")}
              className={`py-2 px-3.5 rounded-xl font-semibold text-xs md:text-sm transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "jobs"
                  ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Layout className="w-4 h-4" />
              <span>โครงการทั้งหมด</span>
            </button>

            <button
              onClick={() => setActiveTab("new_job")}
              className={`py-2 px-3.5 rounded-xl font-semibold text-xs md:text-sm transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "new_job"
                  ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>สร้างใบสรุปการติดตั้งผ้าม่านใหม่</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => setActiveTab("settings")}
                className={`py-2 px-3.5 rounded-xl font-semibold text-xs md:text-sm transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === "settings"
                    ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
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
