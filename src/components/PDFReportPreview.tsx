import React from "react";
import { Job, WindowItem, Employee, Settings } from "../types";
import { MapPin, Phone, Calendar, User, FileText, CheckCircle2 } from "lucide-react";
import { getSolidFabricSwatch, getSheerFabricSwatch } from "../lib/fabricUtils";

interface FittedImageProps {
  src: string;
  alt: string;
}

const FittedImage: React.FC<FittedImageProps> = ({ src, alt }) => {
  const [isPortrait, setIsPortrait] = React.useState(false);

  React.useEffect(() => {
    if (!src) return;
    const img = new Image();
    img.src = src;
    img.onload = () => {
      setIsPortrait(img.naturalHeight > img.naturalWidth);
    };
  }, [src]);

  return (
    <img
      src={src}
      alt={alt}
      crossOrigin="anonymous"
      referrerPolicy="no-referrer"
      className={`absolute inset-0 w-full h-full ${
        isPortrait ? "object-contain bg-slate-50" : "object-cover"
      }`}
    />
  );
};

interface PDFReportPreviewProps {
  job: Job;
  windows: WindowItem[];
  employees: Employee[];
  settings?: Settings;
  isPreviewMode?: boolean;
}

const getLogoSize = (size?: "S" | "M" | "L" | "XL") => {
  const finalSize = size || "L";
  switch (finalSize) {
    case "S":
      return { width: "80px", height: "36px" };
    case "M":
      return { width: "110px", height: "50px" };
    case "XL":
      return { width: "180px", height: "82px" };
    case "L":
    default:
      return { width: "145px", height: "66px" };
  }
};

export const PDFReportPreview: React.FC<PDFReportPreviewProps> = ({
  job,
  windows: rawWindows,
  employees,
  settings = {} as Settings,
  isPreviewMode = false,
}) => {
  const windows = (rawWindows || [])
    .filter((w) => !w.isHidden)
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  const designer = employees.find((e) => e.id === job.employeeId);
  const logoSize = getLogoSize(settings.companyLogoSize);

  return (
    <div
      id={isPreviewMode ? `pdf-preview-${job.id}` : `pdf-export-${job.id}`}
      className={`${
        isPreviewMode
          ? "mx-auto flex flex-col gap-12 p-8 bg-slate-100/40 rounded-[40px] border border-slate-200/50"
          : "hidden-pdf-preview fixed left-0 top-0 z-[-9999]"
      } text-black font-sans`}
      style={{
        width: isPreviewMode ? "858px" : "794px",
        boxSizing: "border-box",
      }}
    >
      {/* ================= PAGE 1: COVER PAGE ================= */}
      {isPreviewMode && (
        <div className="w-[794px] mx-auto mb-3 flex justify-between items-center text-xs font-black text-slate-500 px-4 shrink-0">
          <span className="bg-slate-200/60 backdrop-blur text-slate-700 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider">
            หน้า 1: หน้าปกเสนอราคา (Cover Page)
          </span>
          <span className="text-[10px] text-slate-400">ขนาดมาตรฐาน A4</span>
        </div>
      )}
      <div
        className={`pdf-page flex flex-col justify-between text-black ${
          isPreviewMode
            ? "rounded-[32px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.08)] border border-slate-200/80 bg-white"
            : "bg-white"
        }`}
        style={{
          width: "794px",
          height: "1123px",
          padding: "60px",
          boxSizing: "border-box",
          pageBreakAfter: "always",
        }}
      >
        {/* Top brand accent */}
        <div className="flex justify-between items-center border-b border-black/10 pb-5">
          <div className="flex items-center gap-2">
            {settings.companyLogoBase64 ? (
              <img
                src={settings.companyLogoBase64}
                alt="Company Logo"
                crossOrigin="anonymous"
                referrerPolicy="no-referrer"
                style={{ width: "auto", height: "auto", maxWidth: logoSize.width, maxHeight: logoSize.height, objectFit: "contain" }}
                className="shrink-0"
              />
            ) : (
              /* Glass-inspired logo badge (Solid dark contrasting backdrop) */
              <div 
                style={{ width: logoSize.width, height: logoSize.height }}
                className="flex border border-black/15 p-1 px-3 items-center justify-center font-mono uppercase shrink-0 text-center flex-col rounded-xl bg-gradient-to-br from-black to-neutral-900 shadow-sm"
              >
                <div className="font-extrabold text-[11px] tracking-widest text-white leading-none">PASAYA</div>
                <div className="text-[4px] tracking-widest text-neutral-300 scale-90 mt-0.5">CURTAIN</div>
                <div className="text-[4px] tracking-widest text-neutral-300 scale-90">CENTER</div>
              </div>
            )}
            <div>
              <span className="font-black text-base tracking-wider text-black block">
                PASAYA Curtain Center
              </span>
              <p className="text-[10px] text-black tracking-wider mt-0.5 font-extrabold uppercase">
                แบบสรุปงานติดตั้งผ้าม่าน
              </p>
            </div>
          </div>
        </div>

        {/* Central visual cover details - perfectly centered vertically in the flex space */}
        <div className="flex-1 flex flex-col justify-center items-center py-4 text-center">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight text-black mb-6">
            ใบสรุปแบบติดตั้งผ้าม่าน<br />
            <span className="text-3xl md:text-4xl font-black text-black mt-3 block">{job.customerName}</span>
          </h1>
          <p className="text-black text-sm max-w-lg mx-auto leading-relaxed font-bold">
            เอกสารสรุปรายละเอียดการเลือกดีไซน์ผ้าม่านสเปกมาตรฐานพร้อมภาพตัวอย่าง<br />
            การติดตั้งจริงด้วยระบบจำลองภาพปัญญาประดิษฐ์
          </p>

          <div className="w-24 h-1.5 bg-black mx-auto rounded-full mt-6 shadow-sm"></div>
        </div>

        {/* Information, Terms & Signature section - Grouped with unified gap-4 spacing */}
        <div className="flex flex-col gap-4 w-full mb-4">
          {/* Customer Information Block - Liquid Glass Aesthetic */}
          <div 
            className="border border-black/10 p-4.5 rounded-[24px] shadow-sm bg-white"
          >
            <h3 className="text-black font-black uppercase tracking-wider text-[11px] mb-2 pb-2 border-b border-black/10 flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-black" />
              <span>ข้อมูลลูกค้าและสถานที่ติดตั้ง</span>
            </h3>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-3">
                <div className="flex flex-col">
                  <span className="text-black text-[10px] uppercase font-extrabold">ชื่อผู้ติดต่อ</span>
                  <span className="font-extrabold text-black text-sm mt-0.5">{job.customerName}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-black text-[10px] uppercase font-extrabold">เบอร์โทรศัพท์</span>
                  <span className="text-black mt-0.5 font-black flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-black" />
                    {job.phone || "ไม่ระบุ"}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-col">
                  <span className="text-black text-[10px] uppercase font-extrabold">สถานที่ติดตั้ง</span>
                  <span className="text-black mt-0.5 leading-relaxed font-black text-xs">
                    {job.address || "ไม่ระบุสถานที่"}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-black text-[10px] uppercase font-extrabold">วันที่ประเมินหน้างาน</span>
                  <span className="text-black mt-0.5 font-black flex items-center gap-1.5 font-mono">
                    <Calendar className="w-3 h-3 text-black" />
                    {new Date(job.createdAt).toLocaleDateString("th-TH", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-black/10 flex items-center justify-between text-[10px] text-black">
              <div className="flex items-center space-x-1.5">
                <User className="w-3.5 h-3.5 text-black" />
                <span className="font-bold">พนักงานที่ดูแล:</span>
                <span className="font-extrabold text-black">{designer?.name || "พนักงานดีไซเนอร์"}</span>
              </div>
              <span className="font-black font-mono text-black">PASAYA Curtain Center Team</span>
            </div>
          </div>

          {/* Terms and Conditions Note Block - Light shadow, clean white bg, black text */}
          <div className="border border-black/10 p-4.5 rounded-[24px] shadow-sm bg-white text-left">
            <h4 className="text-[10px] font-black text-black underline mb-1">
              หมายเหตุเงื่อนไข :
            </h4>
            <p className="text-[8.5px] font-black text-black leading-relaxed mb-0.5">
              กรณีมีการเปลี่ยนแปลงรายละเอียดจากที่ตกลงไว้ในใบสรุปงานติดตั้งผ้าม่านนี้ ผู้สั่งซื้อยินยอมที่จะชำระเงินเพิ่มในส่วนของ
            </p>
            <ul className="text-[8px] font-bold text-black leading-relaxed space-y-0.5 pl-3 mb-1.5 list-none">
              <li>(A) ค่าแก้ไขผ้าม่านและอุปกรณ์ เช่น ความสูง ความกว้างของผ้าม่าน รางม่าน ที่เกิดจากหน้างานเปลี่ยนแปลง บิ้วท์อินเพิ่มเติม ฯลฯ</li>
              <li>(B) ค่าติดตั้งรางละ 200 บาท</li>
              <li>(C) ค่าเดินทาง 1,500 บาท ใน กทม. (ต่างจังหวัดคิดตามระยะทาง)</li>
              <li>(D) สีสินค้าจริงอาจแตกต่างจากภาพแสดงผลเล็กน้อย เนื่องจากข้อจำกัดด้านการถ่ายภาพและหน้าจอแสดงผล</li>
            </ul>
            <p className="text-[8px] font-bold text-black leading-relaxed">
              การเลื่อนคิวงานติตตั้ง ขอความกรุณาลูกค้าแจ้งพนักงานขายก่อนวันติดตั้ง อย่างน้อย 5 วันทำการ ถ้าน้อยกว่า 5 วัน จะมีค่าดำเนินการ 3,000 บาท / ครั้ง
            </p>
            <p className="text-[8px] font-bold text-black leading-relaxed mt-0.5">
              บริษัทฯ จะรับผิดชอบดำเนินการแก้ไขงาน ในกรณีที่ความผิดพลาดเกิดจากบริษัทฯ เท่านั้น
            </p>
          </div>

          {/* Customer Confirmation & Signature Block */}
          <div 
            className="border border-black/10 p-4.5 rounded-[24px] shadow-sm text-center w-full bg-white"
          >
            <p className="text-[10px] font-black text-black">
              ยืนยันข้อมูลตามเอกสารแบบสรุปงานติดตั้งผ้าม่าน
            </p>
            <div className="flex flex-col items-center justify-center mt-6">
              <div className="text-black font-mono text-xs leading-none tracking-wide">
                ......................................................................
              </div>
              <span className="text-[8.5px] font-extrabold text-black uppercase tracking-wider mt-1.5">
                ลายเซ็นลูกค้า (Customer Signature)
              </span>
              <div className="text-black font-mono text-xs leading-none mt-3">
                วันที่ (Date): ............ / ............ / ............
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-black text-[10px] uppercase tracking-wider font-mono font-black pt-4 border-t border-black/10">
          © 2026 PASAYA Curtain Center partner program. All mockups generated via AI are previews only.
        </div>
      </div>

      {/* ================= DETAILED WINDOW PAGES ================= */}
      {windows.map((win, idx) => (
        <React.Fragment key={win.id}>
          {isPreviewMode && (
            <div className="w-[794px] mx-auto mb-3 mt-8 flex justify-between items-center text-xs font-black text-slate-500 px-4 shrink-0">
              <span className="bg-slate-200/60 backdrop-blur text-slate-700 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider">
                หน้า {idx + 2}: ข้อมูลติดตั้งบาน {win.windowCode || `W${idx + 1}`} ({win.roomName})
              </span>
              <span className="text-[10px] text-slate-400">ขนาดมาตรฐาน A4</span>
            </div>
          )}
          <div
            className={`pdf-page flex flex-col justify-start gap-y-3 text-black ${
              isPreviewMode
                ? "rounded-[32px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.08)] border border-slate-200/80 bg-white"
                : "bg-white"
            }`}
            style={{
              width: "794px",
              height: "1123px",
              padding: "60px",
              boxSizing: "border-box",
              pageBreakAfter: "always",
            }}
          >
            {/* Header styled as sleek glass header */}
            <div className="flex justify-between items-center border-b border-black/10 pb-3 mb-1 shrink-0">
              <div className="flex items-center gap-2">
                {settings.companyLogoBase64 ? (
                  <img
                    src={settings.companyLogoBase64}
                    alt="Company Logo"
                    crossOrigin="anonymous"
                    referrerPolicy="no-referrer"
                    style={{ width: "auto", height: "auto", maxWidth: logoSize.width, maxHeight: logoSize.height, objectFit: "contain" }}
                    className="shrink-0"
                  />
                ) : (
                  <div 
                    style={{ width: logoSize.width, height: logoSize.height }}
                    className="flex border border-black/15 p-1 px-2.5 items-center justify-center font-mono uppercase shrink-0 text-center flex-col rounded-xl bg-gradient-to-br from-black to-neutral-900 shadow-sm"
                  >
                    <div className="font-black text-[11px] tracking-wider text-white leading-none">PASAYA</div>
                    <div className="text-[4px] tracking-widest text-neutral-300 scale-90 mt-0.5">CURTAIN</div>
                    <div className="text-[4px] tracking-widest text-neutral-300 scale-90">CENTER</div>
                  </div>
                )}

                <div>
                  <h2 className="font-black text-sm tracking-wide text-black leading-tight uppercase">
                    แบบสรุปงานติดตั้งผ้าม่าน
                  </h2>
                  <p className="text-[10px] text-black font-extrabold leading-none mt-1">
                    รายละเอียดข้อมูลการผ้าม่านและการติดตั้ง
                  </p>
                </div>
              </div>

            {/* Room information details */}
            <div 
              className="text-[10px] font-extrabold text-black grid grid-cols-[55px_1fr] gap-y-0.5 border border-black/10 p-2.5 rounded-2xl min-w-[150px] shrink-0 shadow-sm bg-white"
            >
              <div className="text-black text-left">ห้อง</div>
              <div className="text-black text-left font-black">: {win.roomName || "ห้องนอน"}</div>
              <div className="text-black text-left">บานที่</div>
              <div className="text-black text-left font-black">: {win.windowCode || `W${idx + 1}`}</div>
            </div>
          </div>

          {/* Room photos "Before" and "After" column grids */}
          <div className="grid grid-cols-2 gap-4 mb-1 shrink-0">
            {/* Before installation container */}
            <div className="rounded-[24px] overflow-hidden flex flex-col h-[290px] bg-white border border-black/10 shadow-sm">
              <div 
                className="py-2 px-3 text-center text-[11px] font-black uppercase tracking-wider shrink-0 border-b border-black/10 text-black bg-white"
              >
                ภาพหน้างานเดิม (ก่อนติดตั้ง)
              </div>
              <div className="flex-1 w-full h-full relative overflow-hidden bg-slate-50 flex items-center justify-center">
                {win.preImageBase64 ? (
                  <FittedImage
                    src={win.preImageBase64}
                    alt="Before installation"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-4">
                    <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center mb-2">
                      <FileText className="w-6 h-6 text-slate-400" />
                    </div>
                    <span className="text-[11px] text-slate-400 font-extrabold">ไม่มีรูปภาพหน้างานเดิม</span>
                  </div>
                )}
              </div>
            </div>

            {/* After installation container */}
            <div className="rounded-[24px] overflow-hidden flex flex-col h-[290px] bg-white border border-black/10 shadow-sm">
              <div 
                className="py-2 px-3 text-center text-[11px] font-black uppercase tracking-wider shrink-0 border-b border-black/10 text-black bg-white"
              >
                ภาพหน้างานตัวอย่าง (หลังติดตั้ง)
              </div>
              <div className="flex-1 w-full h-full relative overflow-hidden bg-slate-50 flex items-center justify-center">
                {win.aiPreviewBase64 ? (
                  <FittedImage
                    src={win.aiPreviewBase64}
                    alt="After installation"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-4">
                    <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center mb-2">
                      <FileText className="w-6 h-6 text-slate-400" />
                    </div>
                    <span className="text-[11px] text-slate-400 font-extrabold">ไม่มีภาพจำลองหลังติดตั้ง</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Specifications header */}
          <div className="shrink-0">
            <h3 className="text-[11px] font-black text-black uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-black" />
              <span>รายละเอียดข้อกำหนด (SPECIFICATIONS)</span>
            </h3>

            {/* Swatch Table Row Grid with 4 Swatch columns - Exact Square (1:1) aspect ratio, full bleed */}
            <div className="border border-black/15 rounded-2xl overflow-hidden bg-white shadow-sm mb-1">
              <div 
                className="grid grid-cols-4 text-center text-[9px] font-black divide-x divide-black/10 border-b border-black/10 text-black bg-white"
              >
                <div className="py-1.5">รูปแบบผ้าม่าน</div>
                <div className="py-1.5">ผ้าม่านทึบ</div>
                <div className="py-1.5">ผ้าม่านโปร่ง</div>
                <div className="py-1.5">ระยะชายม่าน</div>
              </div>
              <div className="grid grid-cols-4 divide-x divide-black/10 bg-white">
                {/* 1. รูปแบบผ้าม่าน swatch */}
                <div className="flex flex-col items-center justify-start p-2.5 pb-4 bg-white">
                  <div className="w-20 h-20 aspect-square rounded-2xl overflow-hidden border border-black/10 bg-slate-50 relative shrink-0 shadow-sm">
                    {win.styleImageBase64 ? (
                      <img
                        src={win.styleImageBase64}
                        alt="Style design"
                        crossOrigin="anonymous"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover absolute inset-0"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center p-1 text-[8px] text-black/50 absolute inset-0">
                        <div className="flex gap-0.5 items-end justify-center h-8 w-12">
                          <div className="w-1.5 h-6 bg-black/40 rounded-t"></div>
                          <div className="w-1.5 h-4 bg-black/25 rounded-t"></div>
                          <div className="w-1.5 h-6 bg-black/40 rounded-t"></div>
                          <div className="w-1.5 h-4 bg-black/25 rounded-t"></div>
                          <div className="w-1.5 h-6 bg-black/40 rounded-t"></div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="text-center text-[9px] font-black text-black w-full mt-2 px-1 break-words leading-tight shrink-0">
                    {win.isDoubleLayer && win.sheerStyle && win.style !== win.sheerStyle
                      ? `${win.style} / ${win.sheerStyle}`
                      : win.style || "ม่านจีบ"}
                  </div>
                </div>

                {/* 2. ผ้าม่านทึบ swatch */}
                <div className="flex flex-col items-center justify-start p-2.5 pb-4 bg-white">
                  <div className="w-20 h-20 aspect-square rounded-2xl overflow-hidden border border-black/10 bg-slate-50 relative shrink-0 shadow-sm">
                    {(() => {
                      const solidSwatch = getSolidFabricSwatch(win.solidFabricName, settings, win.fabricImageBase64);
                      return solidSwatch ? (
                        <img
                          src={solidSwatch}
                          alt="Solid fabric swatch"
                          crossOrigin="anonymous"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover absolute inset-0"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-100 flex items-center justify-center text-[8px] font-black text-black/50 absolute inset-0 text-center p-1">
                          ผ้าทึบ
                        </div>
                      );
                    })()}
                  </div>
                  <div className="text-center text-[9px] font-black text-black w-full mt-2 px-1 break-words leading-tight shrink-0">
                    {win.solidFabricName || "CITADEL / LONDON GRAY"}
                  </div>
                </div>

                {/* 3. ผ้าม่านโปร่ง swatch */}
                <div className="flex flex-col items-center justify-start p-2.5 pb-4 bg-white">
                  <div className="w-20 h-20 aspect-square rounded-2xl overflow-hidden border border-black/10 bg-slate-50 relative shrink-0 shadow-sm">
                    {(() => {
                      const sheerSwatch = getSheerFabricSwatch(win.sheerFabricName, settings, win.sheerImageBase64);
                      return win.isDoubleLayer && sheerSwatch ? (
                        <img
                          src={sheerSwatch}
                          alt="Sheer fabric swatch"
                          crossOrigin="anonymous"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover absolute inset-0"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-100 flex items-center justify-center text-[8px] font-black text-black/50 absolute inset-0 text-center p-1 leading-tight">
                          {win.isDoubleLayer ? "ผ้าโปร่ง" : "ไม่มี\n(ชั้นเดียว)"}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="text-center text-[9px] font-black text-black w-full mt-2 px-1 break-words leading-tight shrink-0">
                    {win.isDoubleLayer ? (win.sheerFabricName || "AFFINITY / WHITE") : "ไม่ได้ติดตั้งม่านโปร่ง"}
                  </div>
                </div>

                {/* 4. ระยะชายม่าน swatch */}
                <div className="flex flex-col items-center justify-start p-2.5 pb-4 bg-white">
                  <div className="w-20 h-20 aspect-square rounded-2xl overflow-hidden border border-black/10 bg-slate-50 relative shrink-0 shadow-sm">
                    {win.hemImageBase64 ? (
                      <img
                        src={win.hemImageBase64}
                        alt="Hem style swatch"
                        crossOrigin="anonymous"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover absolute inset-0"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col justify-end p-2 items-center absolute inset-0 bg-slate-100">
                        <div className="w-10 h-[2px] bg-black/40 mb-1"></div>
                        <div className="w-10 h-[8px] bg-black/15 border-t border-black/30"></div>
                      </div>
                    )}
                  </div>
                  <div className="text-center text-[9px] font-black text-black w-full mt-2 px-1 break-words leading-tight shrink-0">
                    {win.hemStyleText || "พอดีพื้น"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Specs Details / Curtain Areas Split Tables Section */}
          <div className="flex-1 flex flex-col justify-start gap-y-2 min-h-0 overflow-hidden">
            {win.areas && win.areas.length > 0 ? (
              <>
                {/* Table 1: Specs Breakdown - Specific columns & split rows if double-layered */}
                <div className="border border-black/10 rounded-2xl overflow-hidden text-[9px] text-black bg-white shadow-sm shrink-0">
                  <div 
                    className="font-black text-[10px] py-1.5 px-3 border-b border-black/10 tracking-wider uppercase text-black bg-white"
                  >
                    ตารางสรุปขนาดพื้นที่ผ้าม่านและรายการผ้า
                  </div>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr 
                        className="border-b border-black/10 text-[8.5px] font-black divide-x divide-black/10 text-black bg-white"
                      >
                        <th className="px-2 py-1 text-black font-black text-center w-[25%] align-middle">ชื่อพื้นที่</th>
                        <th className="px-2 py-1 text-black font-black text-center w-[20%] align-middle">ขนาด (กว้าง x สูง)</th>
                        <th className="px-2 py-1 text-black font-black text-center w-[35%] align-middle">รูปแบบม่าน</th>
                        <th className="px-2 py-1 text-black font-black text-center w-[20%] align-middle">การใช้งาน</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/10">
                      {win.areas.flatMap((area) => {
                        const rows = [];

                        const styleValSolid = area.style || win.style || "-";
                        const fabricValSolid = area.solidFabricName || win.solidFabricName || "-";
                        const colorValSolid = area.solidFabricColor || win.color || "-";
                        const combinedTextSolid = `${styleValSolid}, ${fabricValSolid}, ${colorValSolid}`;

                        // 1. Solid Curtain Row
                        rows.push(
                          <tr key={`${area.id}-solid`} className="divide-x divide-black/10 text-[8px] leading-snug">
                            <td className="px-2 py-2 font-bold text-left align-middle" style={{ verticalAlign: "middle", lineHeight: "1" }}>
                              <span className="inline-block w-2 h-2 rounded-full border border-black/20 mr-1.5 align-middle" style={{ backgroundColor: area.colorCode || "#000000" }} />
                              <span className="align-middle text-black font-black">{area.name} (ม่านทึบ)</span>
                            </td>
                            <td className="px-2 py-2 font-black text-black font-mono text-center align-middle" style={{ verticalAlign: "middle", lineHeight: "1" }}>
                              {area.width || win.width || "-"} x {area.height || win.height || "-"} ซม.
                            </td>
                            <td className="px-2 py-2 text-center font-black text-black align-middle" style={{ verticalAlign: "middle", lineHeight: "1.1" }}>
                              {combinedTextSolid}
                            </td>
                            <td className="px-2 py-2 font-black text-black text-center align-middle" style={{ verticalAlign: "middle", lineHeight: "1" }}>
                              {area.usageType || "-"}
                            </td>
                          </tr>
                        );

                        // 2. Sheer Curtain Row (if double layer is active)
                        if (win.isDoubleLayer) {
                          const styleValSheer = area.style || win.style || "-";
                          const fabricValSheer = area.sheerFabricName || win.sheerFabricName || "-";
                          const colorValSheer = area.sheerFabricColor || "-";
                          const combinedTextSheer = `${styleValSheer}, ${fabricValSheer}, ${colorValSheer}`;

                          rows.push(
                            <tr key={`${area.id}-sheer`} className="divide-x divide-black/10 text-[8px] leading-snug">
                              <td className="px-2 py-2 font-bold text-left align-middle" style={{ verticalAlign: "middle", lineHeight: "1" }}>
                                <span className="inline-block w-2 h-2 rounded-full border border-black/20 mr-1.5 align-middle" style={{ backgroundColor: area.colorCode || "#000000" }} />
                                <span className="align-middle text-black font-black">{area.name} (ม่านโปร่ง)</span>
                              </td>
                              <td className="px-2 py-2 font-black text-black font-mono text-center align-middle" style={{ verticalAlign: "middle", lineHeight: "1" }}>
                                {area.width || win.width || "-"} x {area.height || win.height || "-"} ซม.
                              </td>
                              <td className="px-2 py-2 text-center font-black text-black align-middle" style={{ verticalAlign: "middle", lineHeight: "1.1" }}>
                                {combinedTextSheer}
                              </td>
                              <td className="px-2 py-2 font-black text-black text-center align-middle" style={{ verticalAlign: "middle", lineHeight: "1" }}>
                                {area.usageType || "-"}
                              </td>
                            </tr>
                          );
                        }

                        return rows;
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Table 2: Tracks & Accessories - Specific columns & split rows if double-layered */}
                <div className="border border-black/10 rounded-2xl overflow-hidden text-[9px] text-black bg-white shadow-sm shrink-0">
                  <div 
                    className="font-black text-[10px] py-1.5 px-3 border-b border-black/10 tracking-wider uppercase text-black bg-white"
                  >
                    ตารางสรุปรางม่านและอุปกรณ์เสริม
                  </div>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr 
                        className="border-b border-black/10 text-[8.5px] font-black divide-x divide-black/10 text-black bg-white"
                      >
                        <th className="px-2 py-1 text-black font-black text-center w-[25%] align-middle">ชื่อพื้นที่</th>
                        <th className="px-2 py-1 text-black font-black text-center w-[25%] align-middle">รางม่าน</th>
                        <th className="px-2 py-1 text-black font-black text-center w-[30%] align-middle">ระยะเผื่อรอบวงกบ (Clearance Offsets)</th>
                        <th className="px-2 py-1 text-black font-black text-center w-[20%] align-middle">อุปกรณ์เสริม</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/10">
                      {win.areas.flatMap((area) => {
                        const rows = [];

                        // 1. Solid track row
                        rows.push(
                          <tr key={`${area.id}-track-solid`} className="divide-x divide-black/10 text-[8px] leading-snug">
                            <td className="px-2 py-2 font-bold text-left align-middle" style={{ verticalAlign: "middle", lineHeight: "1" }}>
                              <span className="inline-block w-2 h-2 rounded-full border border-black/20 mr-1.5 align-middle" style={{ backgroundColor: area.colorCode || "#000000" }} />
                              <span className="align-middle text-black font-black">{area.name} (ม่านทึบ)</span>
                            </td>
                            <td className="px-2 py-2 text-center align-middle" style={{ verticalAlign: "middle", lineHeight: "1.1" }}>
                              <div className="font-black text-black leading-none">
                                {win.track1Style || win.track || "-"}
                              </div>
                              <div className="text-[7.5px] text-black/85 font-extrabold mt-0.5 leading-none">
                                {win.mountingType || "ติดผนัง"} / {win.hangingType || "ปิดราง"}
                              </div>
                            </td>
                            <td className="px-2 py-1 font-black text-black font-mono text-[7.5px] align-middle w-[30%]" style={{ verticalAlign: "middle" }}>
                              <table className="w-full" style={{ border: "none", background: "transparent", borderCollapse: "collapse", margin: 0, padding: 0 }}>
                                <tbody>
                                  <tr style={{ border: "none" }}>
                                    <td style={{ border: "none", padding: "1px 0", textAlign: "left", width: "50%", color: "black" }}>ซ้าย: {area.distanceLeft || "0"}</td>
                                    <td style={{ border: "none", padding: "1px 0", textAlign: "left", width: "50%", color: "black" }}>ขวา: {area.distanceRight || "0"}</td>
                                  </tr>
                                  <tr style={{ border: "none" }}>
                                    <td style={{ border: "none", padding: "1px 0", textAlign: "left", color: "black" }}>บน: {area.distanceTop || "0"}</td>
                                    <td style={{ border: "none", padding: "1px 0", textAlign: "left", color: "black" }}>ล่าง: {area.distanceBottom || "0"}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </td>
                            <td className="px-2 py-2 font-black text-black text-center align-middle" style={{ verticalAlign: "middle", lineHeight: "1.1" }}>
                              {win.accessories || "ไม่มี"}
                            </td>
                          </tr>
                        );

                        // 2. Sheer track row
                        if (win.isDoubleLayer) {
                          rows.push(
                            <tr key={`${area.id}-track-sheer`} className="divide-x divide-black/10 text-[8px] leading-snug">
                              <td className="px-2 py-2 font-bold text-left align-middle" style={{ verticalAlign: "middle", lineHeight: "1" }}>
                                <span className="inline-block w-2 h-2 rounded-full border border-black/20 mr-1.5 align-middle" style={{ backgroundColor: area.colorCode || "#000000" }} />
                                <span className="align-middle text-black font-black">{area.name} (ม่านโปร่ง)</span>
                              </td>
                              <td className="px-2 py-2 text-center align-middle" style={{ verticalAlign: "middle", lineHeight: "1.1" }}>
                                <div className="font-black text-black leading-none">
                                  {win.track2Style || win.track || "-"}
                                </div>
                                <div className="text-[7.5px] text-black/85 font-extrabold mt-0.5 leading-none">
                                  {win.mountingType || "ติดผนัง"} / {win.hangingType || "ปิดราง"}
                                </div>
                              </td>
                              <td className="px-2 py-1 font-black text-black font-mono text-[7.5px] align-middle w-[30%]" style={{ verticalAlign: "middle" }}>
                                <table className="w-full" style={{ border: "none", background: "transparent", borderCollapse: "collapse", margin: 0, padding: 0 }}>
                                  <tbody>
                                    <tr style={{ border: "none" }}>
                                      <td style={{ border: "none", padding: "1px 0", textAlign: "left", width: "50%", color: "black" }}>ซ้าย: {area.distanceLeft || "0"}</td>
                                      <td style={{ border: "none", padding: "1px 0", textAlign: "left", width: "50%", color: "black" }}>ขวา: {area.distanceRight || "0"}</td>
                                    </tr>
                                    <tr style={{ border: "none" }}>
                                      <td style={{ border: "none", padding: "1px 0", textAlign: "left", color: "black" }}>บน: {area.distanceTop || "0"}</td>
                                      <td style={{ border: "none", padding: "1px 0", textAlign: "left", color: "black" }}>ล่าง: {area.distanceBottom || "0"}</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </td>
                              <td className="px-2 py-2 font-black text-black text-center align-middle" style={{ verticalAlign: "middle", lineHeight: "1.1" }}>
                                {win.accessories || "ไม่มี"}
                              </td>
                            </tr>
                          );
                        }

                        return rows;
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Notes Block - Only showing Notes, no hem styles */}
                <div className="border border-black/10 rounded-2xl overflow-hidden text-[9px] text-black bg-white shadow-sm shrink-0">
                  <div 
                    className="font-black text-[10px] py-1.5 px-3 border-b border-black/10 tracking-wider uppercase text-black bg-white"
                  >
                    หมายเหตุเพิ่มเติม
                  </div>
                  <div className="p-2.5 text-[8.5px] font-bold text-black whitespace-pre-wrap leading-relaxed">
                    {win.notes || "ไม่มีหมายเหตุพิเศษสำหรับหน้างานบานนี้"}
                  </div>
                </div>
              </>
            ) : (
              /* Fallback Card Spec Grid layout */
              <div className="border border-black/10 rounded-2xl overflow-hidden grid grid-cols-2 divide-x divide-black/10 text-[10px] leading-relaxed text-black bg-white shadow-sm shrink-0">
                {/* Left Column info */}
                <div className="p-4 space-y-2.5 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-1 items-baseline">
                      <span className="col-span-3 font-black text-[11px] text-black">บานที่ {idx + 1}:</span>
                      <span className="col-span-9 font-black text-black">
                        กว้าง <span className="font-black text-black font-mono text-sm">{win.width || "250"}</span> ซม.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;สูง <span className="font-black text-black font-mono text-sm">{win.height || "280"}</span> ซม.
                      </span>
                    </div>

                    <div className="grid grid-cols-12 gap-1">
                      <span className="col-span-3 font-black text-black/60">ชั้นที่ 1:</span>
                      <span className="col-span-9 font-black text-black">{win.layer1Style || "ม่านจีบ (แยกกลาง)"}</span>
                    </div>

                    <div className="grid grid-cols-12 gap-1">
                      <span className="col-span-3 font-black text-black/60">ชั้นที่ 2:</span>
                      <span className="col-span-9 font-black text-black">{win.isDoubleLayer ? (win.layer2Style || "ม่านจีบ (แยกกลาง)") : "ไม่ได้ติดตั้งม่านชั้นที่ 2 (ม่านโปร่ง)"}</span>
                    </div>
                  </div>

                  {/* Window notes section */}
                  <div className="border-t border-dashed border-black/10 pt-2.5 mt-2.5 flex-1 flex flex-col justify-start">
                    <div className="font-black text-black mb-0.5">หมายเหตุเพิ่มเติม:</div>
                    <div className="text-[9px] text-black whitespace-pre-wrap leading-relaxed font-bold">
                      {win.notes || "ไม่มีหมายเหตุพิเศษสำหรับบานติดตั้งนี้"}
                    </div>
                  </div>
                </div>

                {/* Right Column info */}
                <div className="p-4 space-y-2.5">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div className="flex justify-between items-baseline">
                      <span className="font-black text-black/60">รางม่าน:</span>
                      <span className="font-black text-black text-right">{win.track || "ม่านจีบ"}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="font-black text-black/60">การยึดติด:</span>
                      <span className="font-black text-black text-right">{win.mountingType || "ติดเพดาน"}</span>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-black/10 pt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                    <div className="flex justify-between items-baseline col-span-2">
                      <span className="font-black text-black/60">ชั้นที่ 1:</span>
                      <span className="font-black text-black text-right">{win.track1Style || "รางม่านจีบ"}</span>
                    </div>
                    <div className="flex justify-between items-baseline col-span-2">
                      <span className="font-black text-black/60">การแขวน:</span>
                      <span className="font-black text-black text-right">{win.hangingType || "หัวผ้าม่านแขวนปิดรางม่าน"}</span>
                    </div>
                    <div className="flex justify-between items-baseline col-span-2">
                      <span className="font-black text-black/60">ชั้นที่ 2:</span>
                      <span className="font-black text-black text-right">{win.isDoubleLayer ? (win.track2Style || "รางม่านจีบ") : "ไม่ได้ติดตั้ง"}</span>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-black/10 pt-2">
                    <span className="font-black text-black/60">อุปกรณ์เสริม:</span>
                    <div className="font-black text-black pl-2 leading-tight">
                      {win.accessories || "ไม่มี"}
                    </div>
                  </div>

                  <div className="border-t border-dashed border-black/10 pt-2">
                    <div className="font-black text-black/60 mb-0.5">ระยะม่าน:</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[9px] pl-2 font-mono">
                      <div className="flex justify-between">
                        <span className="text-black/50 font-bold">ด้านซ้าย:</span>
                        <span className="font-black text-black">{win.distanceLeft || "พอดีเฟรม"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-black/50 font-bold">ด้านขวา:</span>
                        <span className="font-black text-black">{win.distanceRight || "พอดีเฟรม"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-black/50 font-bold">ด้านบน:</span>
                        <span className="font-black text-black">{win.distanceTop || "ติดเพดาน"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-black/50 font-bold">ด้านล่าง:</span>
                        <span className="font-black text-black">{win.distanceBottom || "พอดีพื้น"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer containing page number */}
          <div className="mt-auto pt-1.5 border-t border-black/10 flex justify-end items-center text-[9px] text-black/60 font-black shrink-0">
            <span className="font-black font-mono">หน้า {idx + 2}</span>
          </div>
        </div>
        </React.Fragment>
      ))}
    </div>
  );
};
