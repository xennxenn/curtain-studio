import React, { useState } from "react";
import { Layout, Lock, User, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Employee } from "../types";

interface LoginProps {
  employees: Employee[];
  onLoginSuccess: (employee: Employee) => void;
}

export const Login: React.FC<LoginProps> = ({ employees, onLoginSuccess }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || !trimmedPassword) {
      setError("กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน");
      return;
    }

    // Attempt to find matching employee
    let matchedEmployee = employees.find(
      (emp) =>
        emp.username?.toLowerCase() === trimmedUsername.toLowerCase() &&
        emp.password === trimmedPassword
    );

    // Default admin fallback if employees array is empty or has no admin yet
    if (!matchedEmployee && trimmedUsername.toLowerCase() === "t58121" && trimmedPassword === "Admin") {
      const existingAdmin = employees.find((emp) => emp.role === "admin");
      if (existingAdmin) {
        matchedEmployee = existingAdmin;
      } else {
        matchedEmployee = {
          id: "default-admin-id",
          name: "ผู้ดูแลระบบ (Admin)",
          username: "T58121",
          password: "Admin",
          role: "admin",
          aiQuota: 100,
          aiUsed: 0,
        };
      }
    }

    if (matchedEmployee) {
      onLoginSuccess(matchedEmployee);
    } else {
      setError("ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Background elegant decoration */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-rose-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="flex justify-center">
          <div className="bg-indigo-600 p-3 rounded-2xl shadow-xl shadow-indigo-600/20 flex items-center justify-center">
            <Layout className="w-8 h-8 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-2xl font-extrabold text-white tracking-tight">
          Curtain Treatment Studio
        </h2>
        <p className="mt-2 text-center text-xs text-slate-400 font-medium">
          ระบบจำลองการติดตั้งผ้าม่านอัจฉริยะด้วย AI Co-Pilot
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4">
        <div className="bg-slate-900 border border-slate-800/80 rounded-3xl py-8 px-6 shadow-2xl sm:px-10">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-white">ลงชื่อเข้าใช้งาน</h3>
            <p className="text-xs text-slate-400 mt-0.5">เข้าสู่ระบบเพื่อจัดการโครงการและออกแบบผ้าม่าน</p>
          </div>

          {error && (
            <div className="mb-5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl p-3.5 flex items-start gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                ชื่อผู้ใช้งาน (Username)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-white text-sm rounded-xl pl-10 pr-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                รหัสผ่าน (Password)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-white text-sm rounded-xl pl-10 pr-10 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold text-xs py-3.5 px-4 rounded-xl transition shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-1.5 cursor-pointer mt-2"
            >
              <span>เข้าสู่ระบบสตูดิโอ</span>
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-800/80 text-center">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
              AUTHORIZED PERSONNEL ONLY
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
