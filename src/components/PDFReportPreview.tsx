import React from "react";
import { Job, WindowItem, Employee } from "../types";
import { Ruler, Sparkles, MapPin, Phone, Calendar, User, FileText } from "lucide-react";

interface PDFReportPreviewProps {
  job: Job;
  windows: WindowItem[];
  employees: Employee[];
}

export const PDFReportPreview: React.FC<PDFReportPreviewProps> = ({
  job,
  windows,
  employees,
}) => {
  const designer = employees.find((e) => e.id === job.employeeId);

  return (
    <div
      id={`pdf-export-${job.id}`}
      className="hidden-pdf-preview absolute left-[-9999px] top-0 bg-white text-slate-900 font-sans"
      style={{
        width: "210mm", // Standard A4 width in mm
        boxSizing: "border-box",
      }}
    >
      {/* ================= PAGE 1: COVER PAGE ================= */}
      <div
        className="pdf-page bg-slate-950 text-white flex flex-col justify-between"
        style={{
          width: "210mm",
          height: "297mm",
          padding: "25mm 20mm 20mm 20mm",
          boxSizing: "border-box",
          pageBreakAfter: "always",
        }}
      >
        {/* Top brand accent */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-6">
          <div className="flex items-center space-x-3">
            {/* Elegant PASAYA inspired box logo */}
            <div className="flex border border-white p-1 px-2.5 items-center justify-center font-mono uppercase shrink-0 text-center flex-col w-[70px] h-[45px] bg-black">
              <div className="font-extrabold text-[13px] tracking-widest text-white">PASAYA</div>
              <div className="text-[6px] tracking-widest text-slate-400 scale-90">CURTAIN</div>
              <div className="text-[6px] tracking-widest text-slate-400 scale-90">CENTER</div>
            </div>
            <div>
              <span className="font-extrabold text-base tracking-wider text-indigo-400">
                CURTAIN TREATMENT STUDIO
              </span>
              <p className="text-[10px] uppercase text-slate-400 tracking-widest mt-0.5">
                AI Powered Drapery Simulations & Specs
              </p>
            </div>
          </div>
          <span className="text-xs text-slate-400 font-bold tracking-wider font-mono">
            PROPOSAL NO. #{job.id.substring(0, 8).toUpperCase()}
          </span>
        </div>

        {/* Central visual cover details */}
        <div className="my-auto text-center py-10">
          <span className="bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-widest inline-block mb-6">
            Smart Curtain Proposal
          </span>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight text-white mb-4">
            ใบนำเสนอสเปกและภาพจำลองผ้าม่าน
          </h1>
          <p className="text-slate-400 text-sm max-w-lg mx-auto leading-relaxed">
            เอกสารสรุปรายละเอียดการเลือกดีไซน์ผ้าม่านสเปกมาตรฐานพร้อมภาพตัวอย่างการติดตั้งจริงด้วยระบบจำลองภาพปัญญาประดิษฐ์ (AI Studio Build)
          </p>

          <div className="w-24 h-1 bg-indigo-500 mx-auto rounded-full mt-8"></div>
        </div>

        {/* Customer Information Block */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl">
          <h3 className="text-indigo-400 font-bold uppercase tracking-wider text-xs mb-4 pb-2 border-b border-slate-800 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <span>ข้อมูลลูกค้าและสถานที่ติดตั้ง</span>
          </h3>

          <div className="grid grid-cols-2 gap-6 text-sm">
            <div className="space-y-4">
              <div className="flex flex-col">
                <span className="text-slate-400 text-xs uppercase font-semibold">ชื่อผู้ติดต่อ</span>
                <span className="font-bold text-white text-base mt-0.5">{job.customerName}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-slate-400 text-xs uppercase font-semibold">เบอร์โทรศัพท์</span>
                <span className="text-slate-200 mt-0.5 font-medium flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {job.phone || "ไม่ระบุ"}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col">
                <span className="text-slate-400 text-xs uppercase font-semibold">สถานที่ติดตั้ง</span>
                <span className="text-slate-200 mt-0.5 leading-relaxed font-medium">
                  {job.address || "ไม่ระบุสถานที่"}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-slate-400 text-xs uppercase font-semibold">วันที่ประเมินหน้างาน</span>
                <span className="text-slate-200 mt-0.5 font-medium flex items-center gap-1.5 font-mono">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {new Date(job.createdAt).toLocaleDateString("th-TH", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4 text-indigo-400" />
              <span>ดีไซเนอร์ที่ดูแล:</span>
              <span className="font-bold text-slate-200">{designer?.name || "พนักงานดีไซเนอร์"}</span>
            </div>
            <span className="font-medium text-slate-500 font-mono">Curtain Installation Previewer Platform</span>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-slate-500 text-[10px] uppercase tracking-wider font-mono">
          © 2026 PASAYA Curtain Center partner program. All mockups generated via AI are previews only.
        </div>
      </div>

      {/* ================= INDIVIDUAL WINDOW SPECIFICATIONS PAGES ================= */}
      {windows.map((win, idx) => (
        <div
          key={win.id}
          className="pdf-page bg-white text-slate-900 flex flex-col justify-between"
          style={{
            width: "210mm",
            height: "297mm",
            padding: "10mm 15mm 10mm 15mm",
            boxSizing: "border-box",
            pageBreakAfter: "always",
          }}
        >
          {/* Header to match screenshot perfectly */}
          <div className="flex justify-between items-center border-b-2 border-slate-900 pb-3 mb-4">
            <div className="flex items-center gap-4">
              {/* Box logo as seen in screenshot */}
              <div className="flex border border-slate-900 p-1 px-2.5 items-center justify-center font-mono uppercase shrink-0 text-center flex-col w-[60px] h-[40px] bg-white">
                <div className="font-black text-[12px] tracking-wider text-black">PASAYA</div>
                <div className="text-[5px] tracking-widest text-slate-500 scale-90 leading-none">CURTAIN</div>
                <div className="text-[5px] tracking-widest text-slate-500 scale-90 leading-none">CENTER</div>
              </div>

              <div>
                <h2 className="text-[15px] font-black text-slate-900 tracking-tight leading-snug">
                  แบบสรุปงานติดตั้งผ้าม่าน
                </h2>
                <p className="text-[10px] text-slate-600 font-medium">
                  รายละเอียดการติดตั้งและภาพตัวอย่าง
                </p>
              </div>
            </div>

            <div className="text-right text-[11px] font-bold text-slate-900 leading-normal space-y-0.5">
              <div>ห้อง:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{win.roomName || "ห้องนอน"}</div>
              <div>บานที่:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{win.windowCode || `W${idx + 1}`}</div>
            </div>
          </div>

          {/* Room photos "Before" and "After" column grids */}
          <div className="grid grid-cols-2 gap-4 mb-3">
            {/* Before installation container */}
            <div className="border border-black flex flex-col h-[290px] bg-white">
              <div className="border-b border-black py-1 px-3 text-center text-[10px] font-black bg-slate-100 uppercase tracking-wider text-black">
                ภาพหน้างานเดิม (ก่อนติดตั้ง)
              </div>
              <div className="flex-1 p-2 flex items-center justify-center overflow-hidden bg-white relative">
                {win.preImageBase64 ? (
                  <div className="relative max-w-full max-h-[250px] flex items-center justify-center">
                    <img
                      src={win.preImageBase64}
                      alt="Before installation"
                      className="max-w-full max-h-[250px] object-contain"
                    />
                    {win.areas && win.areas.length > 0 && (
                      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {win.areas.map((area) => {
                          if (!area.points || area.points.length < 2) return null;
                          const pointsStr = area.points.map((p) => `${p.x},${p.y}`).join(" ");
                          return (
                            <g key={area.id}>
                              <polygon
                                points={pointsStr}
                                fill={area.colorCode ? `${area.colorCode}22` : "rgba(99, 102, 241, 0.15)"}
                                stroke={area.colorCode || "#6366f1"}
                                strokeWidth="1.5"
                              />
                              {(() => {
                                let xs = 0, ys = 0;
                                area.points.forEach((p) => { xs += p.x; ys += p.y; });
                                const cx = xs / area.points.length;
                                const cy = ys / area.points.length;
                                return (
                                  <g>
                                    <rect
                                      x={cx - 10}
                                      y={cy - 2.5}
                                      width={20}
                                      height={5}
                                      rx={1}
                                      fill="rgba(0,0,0,0.7)"
                                    />
                                    <text
                                      x={cx}
                                      y={cy + 1}
                                      fill="#ffffff"
                                      fontSize="2.5"
                                      fontWeight="bold"
                                      textAnchor="middle"
                                    >
                                      {area.name}
                                    </text>
                                  </g>
                                );
                              })()}
                            </g>
                          );
                        })}
                      </svg>
                    )}
                  </div>
                ) : (
                  <div className="text-center p-4 text-slate-300">
                    <ImageIconPlaceholder className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <span className="text-[10px] italic font-medium">ยังไม่ได้รับการอัปโหลดภาพห้องเดิม</span>
                  </div>
                )}
              </div>
            </div>

            {/* After installation container */}
            <div className="border border-black flex flex-col h-[290px] bg-white">
              <div className="border-b border-black py-1 px-3 text-center text-[10px] font-black bg-slate-100 uppercase tracking-wider text-black">
                ภาพหน้างานตัวอย่าง (หลังติดตั้ง)
              </div>
              <div className="flex-1 p-2 flex items-center justify-center overflow-hidden bg-white relative">
                {win.aiPreviewBase64 ? (
                  <div className="relative max-w-full max-h-[250px] flex items-center justify-center">
                    <img
                      src={win.aiPreviewBase64}
                      alt="After installation mockup"
                      className="max-w-full max-h-[250px] object-contain"
                    />
                    {win.areas && win.areas.length > 0 && (
                      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {win.areas.map((area) => {
                          if (!area.points || area.points.length < 2) return null;
                          const pointsStr = area.points.map((p) => `${p.x},${p.y}`).join(" ");
                          return (
                            <g key={area.id}>
                              <polygon
                                points={pointsStr}
                                fill={area.colorCode ? `${area.colorCode}11` : "rgba(99, 102, 241, 0.1)"}
                                stroke={area.colorCode || "#6366f1"}
                                strokeWidth="1"
                                strokeDasharray="1,1"
                              />
                              {(() => {
                                let xs = 0, ys = 0;
                                area.points.forEach((p) => { xs += p.x; ys += p.y; });
                                const cx = xs / area.points.length;
                                const cy = ys / area.points.length;
                                return (
                                  <g>
                                    <rect
                                      x={cx - 10}
                                      y={cy - 2.5}
                                      width={20}
                                      height={5}
                                      rx={1}
                                      fill="rgba(0,0,0,0.6)"
                                    />
                                    <text
                                      x={cx}
                                      y={cy + 1}
                                      fill="#ffffff"
                                      fontSize="2.5"
                                      fontWeight="bold"
                                      textAnchor="middle"
                                    >
                                      {area.name}
                                    </text>
                                  </g>
                                );
                              })()}
                            </g>
                          );
                        })}
                      </svg>
                    )}
                  </div>
                ) : (
                  <div className="text-center p-4 text-slate-300">
                    <Sparkles className="w-12 h-12 mx-auto mb-2 opacity-50 text-indigo-300" />
                    <span className="text-[10px] italic font-medium">ยังไม่ได้รับการจำลองภาพติดตั้ง</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Specifications header */}
          <div>
            <h3 className="text-[11px] font-black text-black uppercase tracking-wider mb-1">
              รายละเอียดข้อกำหนด (Specifications)
            </h3>

            {/* Swatch Table Row Grid with 4 Swatch columns */}
            <div className="border border-black bg-white">
              <div className="grid grid-cols-4 bg-slate-100 text-center text-[9px] font-black divide-x divide-black border-b border-black text-black">
                <div className="py-1">รูปแบบผ้าม่าน</div>
                <div className="py-1">ผ้าม่านทึบ</div>
                <div className="py-1">ผ้าม่านโปร่ง</div>
                <div className="py-1">ระยะชายม่าน</div>
              </div>
              <div className="grid grid-cols-4 divide-x divide-black h-[125px] bg-white">
                {/* 1. รูปแบบผ้าม่าน swatch */}
                <div className="flex flex-col items-center justify-between p-1 h-full">
                  <div className="flex-1 flex items-center justify-center overflow-hidden w-full">
                    {win.styleImageBase64 ? (
                      <img src={win.styleImageBase64} alt="Style design" className="max-w-full max-h-[85px] object-contain" />
                    ) : (
                      <div className="w-full h-full bg-slate-50 flex flex-col items-center justify-center p-1 text-[8px] text-slate-400">
                        <div className="flex gap-0.5 items-end justify-center h-10 w-16">
                          <div className="w-1.5 h-8 bg-slate-300 rounded-t shadow-sm"></div>
                          <div className="w-1.5 h-6 bg-slate-200 rounded-t shadow-sm"></div>
                          <div className="w-1.5 h-8 bg-slate-300 rounded-t shadow-sm"></div>
                          <div className="w-1.5 h-6 bg-slate-200 rounded-t shadow-sm"></div>
                          <div className="w-1.5 h-8 bg-slate-300 rounded-t shadow-sm"></div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="text-center text-[9px] font-bold text-black border-t border-black w-full py-0.5 truncate bg-slate-50/50">
                    {win.style || "ม่านจีบ"}
                  </div>
                </div>

                {/* 2. ผ้าม่านทึบ swatch */}
                <div className="flex flex-col items-center justify-between p-1 h-full">
                  <div className="flex-1 flex items-center justify-center overflow-hidden w-full">
                    {win.fabricImageBase64 ? (
                      <img src={win.fabricImageBase64} alt="Solid fabric swatch" className="max-w-full max-h-[85px] object-cover rounded" />
                    ) : (
                      <div className="w-12 h-12 bg-slate-100 border border-slate-200 rounded flex items-center justify-center text-[8px] font-bold text-slate-400">
                        ผ้าทึบ
                      </div>
                    )}
                  </div>
                  <div className="text-center text-[9px] font-bold text-black border-t border-black w-full py-0.5 truncate bg-slate-50/50">
                    {win.solidFabricName || "CITADEL / LONDON GRAY"}
                  </div>
                </div>

                {/* 3. ผ้าม่านโปร่ง swatch */}
                <div className="flex flex-col items-center justify-between p-1 h-full">
                  <div className="flex-1 flex items-center justify-center overflow-hidden w-full">
                    {win.isDoubleLayer && win.sheerImageBase64 ? (
                      <img src={win.sheerImageBase64} alt="Sheer fabric swatch" className="max-w-full max-h-[85px] object-cover rounded" />
                    ) : (
                      <div className="w-12 h-12 bg-slate-50 border border-slate-200 rounded flex items-center justify-center text-[8px] font-bold text-slate-400">
                        {win.isDoubleLayer ? "ผ้าโปร่ง" : "ไม่มี (Single Layer)"}
                      </div>
                    )}
                  </div>
                  <div className="text-center text-[9px] font-bold text-black border-t border-black w-full py-0.5 truncate bg-slate-50/50">
                    {win.isDoubleLayer ? (win.sheerFabricName || "AFFINITY / WHITE") : "ไม่ได้ติดตั้งม่านโปร่ง"}
                  </div>
                </div>

                {/* 4. ระยะชายม่าน swatch */}
                <div className="flex flex-col items-center justify-between p-1 h-full">
                  <div className="flex-1 flex items-center justify-center overflow-hidden w-full">
                    {win.hemImageBase64 ? (
                      <img src={win.hemImageBase64} alt="Hem style swatch" className="max-w-full max-h-[85px] object-cover rounded" />
                    ) : (
                      <div className="w-full h-full flex flex-col justify-end p-1 items-center">
                        <div className="w-10 h-[2px] bg-indigo-500 mb-0.5"></div>
                        <div className="w-10 h-[6px] bg-slate-200 border-t border-slate-400"></div>
                      </div>
                    )}
                  </div>
                  <div className="text-center text-[9px] font-bold text-black border-t border-black w-full py-0.5 truncate bg-slate-50/50">
                    {win.hemStyleText || "พอดีพื้น"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Specs Details Grid Section / Curtain Areas Table Breakdown */}
          {win.areas && win.areas.length > 0 ? (
            <div className="border border-black text-[8.5px] text-black bg-white overflow-hidden">
              <div className="bg-slate-100 font-black text-[9px] py-1 px-3 border-b border-black tracking-wider uppercase text-black">
                ตารางสรุปสเปกแยกตามพื้นที่ผ้าม่าน (Curtain Areas Specification Breakdown)
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-black text-[8px] font-bold text-slate-700 divide-x divide-black">
                    <th className="px-2 py-1 text-black">ชื่อพื้นที่</th>
                    <th className="px-2 py-1 text-black">ขนาด (กxส ซม.)</th>
                    <th className="px-2 py-1 text-black">รูปแบบม่าน</th>
                    <th className="px-2 py-1 text-black">การใช้งาน</th>
                    <th className="px-2 py-1 text-black">ผ้าหลัก</th>
                    <th className="px-2 py-1 text-black">ผ้าโปร่ง</th>
                    <th className="px-2 py-1 text-black">รางม่าน / อุปกรณ์เสริม</th>
                    <th className="px-2 py-1 text-black">ระยะชาย / หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black">
                  {win.areas.map((area) => (
                    <tr key={area.id} className="divide-x divide-black text-[8px] leading-snug">
                      <td className="px-2 py-1 font-bold">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-block w-2.5 h-2.5 rounded shrink-0 border border-slate-400" style={{ backgroundColor: "#6366f1" }} />
                          <span className="text-black">{area.name}</span>
                        </div>
                      </td>
                      <td className="px-2 py-1 font-bold text-black">{area.width || win.width || "-"} x {area.height || win.height || "-"}</td>
                      <td className="px-2 py-1 text-black">{area.style || "-"}</td>
                      <td className="px-2 py-1 text-black">{area.usageType || "-"}</td>
                      <td className="px-2 py-1 font-semibold text-black">
                        {area.solidFabricName ? `${area.solidFabricName} / ${area.solidFabricColor}` : "-"}
                      </td>
                      <td className="px-2 py-1 text-black">
                        {area.sheerFabricName ? `${area.sheerFabricName} / ${area.sheerFabricColor}` : "-"}
                      </td>
                      <td className="px-2 py-1 text-black">
                        <div>ราง: {area.trackType || "-"}</div>
                      </td>
                      <td className="px-2 py-1 text-black">
                        <div>{area.hemStyleText || "-"}</div>
                        {area.notes && <div className="text-[7px] text-slate-500 italic font-medium">โน้ต: {area.notes}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="border border-black grid grid-cols-2 divide-x divide-black text-[10px] leading-relaxed text-black bg-white">
              {/* Left Column info */}
              <div className="p-3.5 space-y-2 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="grid grid-cols-12 gap-1 items-baseline">
                    <span className="col-span-3 font-extrabold text-[11px] text-black">บานที่ {idx + 1}:</span>
                    <span className="col-span-9 font-medium">
                      กว้าง <span className="font-bold">{win.width || "250"}</span> ซม.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;สูง <span className="font-bold">{win.height || "280"}</span> ซม.
                    </span>
                  </div>

                  <div className="grid grid-cols-12 gap-1">
                    <span className="col-span-3 font-bold text-slate-800">ชั้นที่ 1:</span>
                    <span className="col-span-9 font-medium text-slate-900">{win.layer1Style || "ม่านจีบ (แยกกลาง)"}</span>
                  </div>

                  <div className="grid grid-cols-12 gap-1">
                    <span className="col-span-3 font-bold text-slate-800">ชั้นที่ 2:</span>
                    <span className="col-span-9 font-medium text-slate-900">{win.isDoubleLayer ? (win.layer2Style || "ม่านจีบ (แยกกลาง)") : "ไม่ได้ติดตั้งม่านชั้นที่ 2 (ม่านโปร่ง)"}</span>
                  </div>
                </div>

                {/* Window notes section */}
                <div className="border-t border-dashed border-slate-300 pt-2 mt-2 flex-1 flex flex-col justify-start">
                  <div className="font-bold text-slate-800 mb-0.5">หมายเหตุ:</div>
                  <div className="text-[9.5px] text-slate-600 whitespace-pre-wrap leading-relaxed italic">
                    {win.notes || "ไม่มีหมายเหตุพิเศษสำหรับบานติดตั้งนี้"}
                  </div>
                </div>
              </div>

              {/* Right Column info */}
              <div className="p-3.5 space-y-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-slate-800">รางม่าน:</span>
                    <span className="font-semibold text-slate-900 text-right">{win.track || "ม่านจีบ"}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-slate-800">การยึดติด:</span>
                    <span className="font-semibold text-slate-900 text-right">{win.mountingType || "ติดเพดาน"}</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-slate-300 pt-1.5 grid grid-cols-2 gap-x-4 gap-y-1">
                  <div className="flex justify-between items-baseline col-span-2">
                    <span className="font-bold text-slate-800">ชั้นที่ 1:</span>
                    <span className="font-semibold text-slate-900 text-right">{win.track1Style || "รางม่านจีบ"}</span>
                  </div>
                  <div className="flex justify-between items-baseline col-span-2">
                    <span className="font-bold text-slate-800">การแขวน:</span>
                    <span className="font-semibold text-slate-900 text-right">{win.hangingType || "หัวผ้าม่านแขวนปิดรางม่าน"}</span>
                  </div>
                  <div className="flex justify-between items-baseline col-span-2">
                    <span className="font-bold text-slate-800">ชั้นที่ 2:</span>
                    <span className="font-semibold text-slate-900 text-right">{win.isDoubleLayer ? (win.track2Style || "รางม่านจีบ") : "ไม่ได้ติดตั้ง"}</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-slate-300 pt-1.5">
                  <span className="font-bold text-slate-800">อุปกรณ์เสริม:</span>
                  <div className="font-semibold text-slate-900 pl-2 leading-tight">
                    {win.accessories || "ไม่มี"}
                  </div>
                </div>

                <div className="border-t border-dashed border-slate-300 pt-1.5">
                  <div className="font-bold text-slate-800 mb-0.5">ระยะม่าน:</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[9.5px] pl-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">ด้านซ้าย:</span>
                      <span className="font-bold text-slate-800">{win.distanceLeft || "พอดีเฟรม"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">ด้านขวา:</span>
                      <span className="font-bold text-slate-800">{win.distanceRight || "พอดีเฟรม"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">ด้านบน:</span>
                      <span className="font-bold text-slate-800">{win.distanceTop || "ติดเพดาน"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">ด้านล่าง:</span>
                      <span className="font-bold text-slate-800">{win.distanceBottom || "พอดีพื้น"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer containing pagination */}
          <div className="flex justify-between items-center text-[9px] text-slate-400 border-t border-slate-100 pt-1.5 mt-2">
            <span>
              ใบเสนอราคาจุดติดตั้งที่ {idx + 1} จาก {windows.length} จุด
            </span>
            <span className="font-extrabold uppercase text-slate-500 tracking-wider">
              PASAYA Curtain Center Partner Proposal
            </span>
            <span className="font-bold font-mono">Page {idx + 2}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

// Simple visual fallback icon
const ImageIconPlaceholder = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);
