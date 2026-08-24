import React, { useState, useRef, useEffect } from "react";
import { 
  Plus, Trash2, MousePointer, HelpCircle, RefreshCw, Layers, 
  Ruler, Sliders, FileText, CheckCircle2, Layout, Maximize2 
} from "lucide-react";
import { CurtainArea, Settings } from "../types";
import { generateId } from "../lib/storage";
import { 
  SOLID_FABRICS, SHEER_FABRICS, HEM_STYLES, CURTAIN_STYLES, 
  USAGE_TYPES, TRACK_TYPES, HANGING_TYPES, DISTANCE_OPTIONS 
} from "../lib/constants";

interface CurtainAreaDrawerProps {
  preImageBase64: string;
  areas: CurtainArea[];
  onAreasChange: (areas: CurtainArea[]) => void;
  activeAreaId: string | null;
  onActiveAreaChange: (id: string | null) => void;
  defaultWidth: string;
  defaultHeight: string;
  parentSolidFabricName: string;
  parentSheerFabricName: string;
  isDoubleLayer: boolean;
  parentStyle: string;
  parentHemStyleText: string;
  parentLayer1Style: string;
  parentLayer2Style: string;
  parentTrack1Style: string;
  parentTrack2Style: string;
  parentMountingType: string;
  parentHangingType: string;
  parentDistanceLeft: string;
  parentDistanceRight: string;
  parentDistanceTop: string;
  parentDistanceBottom: string;
  parentAccessories: string;
  settings: Settings;
}

export const CurtainAreaDrawer: React.FC<CurtainAreaDrawerProps> = ({
  preImageBase64,
  areas,
  onAreasChange,
  activeAreaId,
  onActiveAreaChange,
  defaultWidth,
  defaultHeight,
  parentSolidFabricName,
  parentSheerFabricName,
  isDoubleLayer,
  parentStyle,
  parentHemStyleText,
  parentLayer1Style,
  parentLayer2Style,
  parentTrack1Style,
  parentTrack2Style,
  parentMountingType,
  parentHangingType,
  parentDistanceLeft,
  parentDistanceRight,
  parentDistanceTop,
  parentDistanceBottom,
  parentAccessories,
  settings,
}) => {

  const curtainStyles = settings.styleMaterials?.map((s) => s.name) || CURTAIN_STYLES;
  const hemStyles = settings.hemMaterials?.map((h) => h.name) || HEM_STYLES;
  const usageTypes = settings.usageTypes || USAGE_TYPES;
  const trackTypes = settings.trackMaterials?.map((t) => t.name) || TRACK_TYPES;
  const hangingTypes = settings.hangingTypes || HANGING_TYPES;
  const distanceOptions = settings.clearanceOptions || DISTANCE_OPTIONS;

  const containerRef = useRef<HTMLDivElement>(null);
  const [drawingPoints, setDrawingPoints] = useState<{ x: number; y: number }[]>([]);
  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(false);
  const [draggedNode, setDraggedNode] = useState<{ areaId: string; ptIdx: number } | null>(null);
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null);

  // Colors for different polygon areas to make them visually distinct
  const areaColors = [
    { fill: "rgba(99, 102, 241, 0.25)", stroke: "#6366f1", border: "border-indigo-500", text: "text-indigo-600", bg: "bg-indigo-50" }, // Indigo
    { fill: "rgba(16, 185, 129, 0.25)", stroke: "#10b981", border: "border-emerald-500", text: "text-emerald-600", bg: "bg-emerald-50" }, // Emerald
    { fill: "rgba(244, 63, 94, 0.25)", stroke: "#f43f5e", border: "border-rose-500", text: "text-rose-600", bg: "bg-rose-50" }, // Rose
    { fill: "rgba(245, 158, 11, 0.25)", stroke: "#f59e0b", border: "border-amber-500", text: "text-amber-600", bg: "bg-amber-50" }, // Amber
    { fill: "rgba(168, 85, 247, 0.25)", stroke: "#a855f7", border: "border-purple-500", text: "text-purple-600", bg: "bg-purple-50" }, // Purple
  ];

  const getAreaColor = (idx: number) => {
    return areaColors[idx % areaColors.length];
  };

  // Convert click client coordinates to percentages relative to container
  const getRelativeCoords = (clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    return { x, y };
  };

  // Add click handler to draw nodes
  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDrawingMode) return;
    
    const { x, y } = getRelativeCoords(e.clientX, e.clientY);

    // If clicking close to the starting point, close the polygon
    if (drawingPoints.length >= 3) {
      const startPt = drawingPoints[0];
      const dx = x - startPt.x;
      const dy = y - startPt.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 6) { // Increased distance threshold since first point is extra large
        finalizeDrawing();
        return;
      }
    }

    setDrawingPoints((prev) => [...prev, { x, y }]);
  };

  // Double click handler to automatically close the path
  const handleCanvasDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDrawingMode) return;
    e.preventDefault();
    e.stopPropagation();
    
    if (drawingPoints.length >= 3) {
      finalizeDrawing();
    }
  };

  // Close path and add to areas list
  const finalizeDrawing = () => {
    if (drawingPoints.length < 3) {
      alert("กรุณาคลิกอย่างน้อย 3 จุดเพื่อสร้างขอบเขตพื้นที่ผ้าม่าน");
      return;
    }

    let parsedSolidName = "";
    let parsedSolidColor = "";
    if (parentSolidFabricName) {
      const parts = parentSolidFabricName.split(" / ");
      parsedSolidName = parts[0] || "";
      parsedSolidColor = parts[1] || "";
    }

    let parsedSheerName = "";
    let parsedSheerColor = "";
    if (parentSheerFabricName) {
      const parts = parentSheerFabricName.split(" / ");
      parsedSheerName = parts[0] || "";
      parsedSheerColor = parts[1] || "";
    }

    const newArea: CurtainArea = {
      id: generateId(),
      name: `พื้นที่ผ้าม่าน ${areas.length + 1}`,
      points: [...drawingPoints],
      isClosed: true,
      width: defaultWidth || "250",
      height: defaultHeight || "280",
      style: parentStyle || curtainStyles[0] || "",
      pattern: "สีพื้นเรียบหรู (Elegant Solid)",
      solidFabricName: parsedSolidName,
      solidFabricColor: parsedSolidColor,
      sheerFabricName: parsedSheerName,
      sheerFabricColor: parsedSheerColor,
      hemStyleText: parentHemStyleText || hemStyles[0] || "",
      usageType: parentLayer1Style || usageTypes[0] || "",
      distanceLeft: parentDistanceLeft || distanceOptions[0] || "",
      distanceRight: parentDistanceRight || distanceOptions[0] || "",
      distanceTop: parentDistanceTop || distanceOptions[4] || "", // default to parent/ceiling
      distanceBottom: parentDistanceBottom || distanceOptions[5] || "", // default to parent/floor
      hangingType: parentHangingType || hangingTypes[0] || "",
      trackType: parentTrack1Style || trackTypes[0] || "",
      notes: "",
      layerDisplayType: isDoubleLayer ? "ทั้งหมด" : "ม่านทึบ",
    };

    const updated = [...areas, newArea];
    onAreasChange(updated);
    setDrawingPoints([]);
    setHoverPoint(null);
    setIsDrawingMode(false);
    onActiveAreaChange(newArea.id);
  };

  // Start dragging a node/handle
  const handleStartDrag = (e: React.MouseEvent, areaId: string, ptIdx: number) => {
    e.stopPropagation();
    e.preventDefault();
    onActiveAreaChange(areaId);
    setDraggedNode({ areaId, ptIdx });
  };

  // Mouse move over SVGSVGElement to update node coordinate
  const handleCanvasMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const { x, y } = getRelativeCoords(e.clientX, e.clientY);
    
    if (draggedNode) {
      const updatedAreas = areas.map((area) => {
        if (area.id === draggedNode.areaId) {
          const updatedPoints = [...area.points];
          updatedPoints[draggedNode.ptIdx] = { x, y };
          return { ...area, points: updatedPoints };
        }
        return area;
      });
      
      onAreasChange(updatedAreas);
    } else if (isDrawingMode && drawingPoints.length > 0) {
      setHoverPoint({ x, y });
    }
  };

  // Release dragging state
  const handleCanvasMouseUp = () => {
    setDraggedNode(null);
  };

  // Delete a curtain area
  const handleDeleteArea = (id: string) => {
    if (confirm("คุณต้องการลบพื้นที่ผ้าม่านที่วาดนี้ออกใช่หรือไม่?")) {
      const filtered = areas.filter((a) => a.id !== id);
      onAreasChange(filtered);
      if (activeAreaId === id) {
        onActiveAreaChange(filtered.length > 0 ? filtered[0].id : null);
      }
    }
  };

  // Edit fields on the currently selected area
  const handleUpdateActiveArea = (fields: Partial<CurtainArea>) => {
    if (!activeAreaId) return;
    const updated = areas.map((area) => {
      if (area.id === activeAreaId) {
        return { ...area, ...fields };
      }
      return area;
    });
    onAreasChange(updated);
  };

  useEffect(() => {
    let parsedSolidName = "";
    let parsedSolidColor = "";
    if (parentSolidFabricName) {
      const parts = parentSolidFabricName.split(" / ");
      parsedSolidName = parts[0] || "";
      parsedSolidColor = parts[1] || "";
    }

    let parsedSheerName = "";
    let parsedSheerColor = "";
    if (parentSheerFabricName) {
      const parts = parentSheerFabricName.split(" / ");
      parsedSheerName = parts[0] || "";
      parsedSheerColor = parts[1] || "";
    }

    let changed = false;
    const updatedAreas = areas.map((area) => {
      let areaSolidName = area.solidFabricName;
      let areaSolidColor = area.solidFabricColor;
      let areaSheerName = area.sheerFabricName;
      let areaSheerColor = area.sheerFabricColor;

      const displayType = area.layerDisplayType || (isDoubleLayer ? "ทั้งหมด" : "ม่านทึบ");

      if (displayType === "ม่านทึบ") {
        areaSolidName = parsedSolidName;
        areaSolidColor = parsedSolidColor;
        areaSheerName = "";
        areaSheerColor = "";
      } else if (displayType === "ม่านโปร่ง") {
        areaSolidName = "";
        areaSolidColor = "";
        areaSheerName = parsedSheerName;
        areaSheerColor = parsedSheerColor;
      } else { // "ทั้งหมด"
        areaSolidName = parsedSolidName;
        areaSolidColor = parsedSolidColor;
        areaSheerName = parsedSheerName;
        areaSheerColor = parsedSheerColor;
      }

      const styleVal = parentStyle || area.style;
      const hemVal = parentHemStyleText || area.hemStyleText;
      const usageVal = parentLayer1Style || area.usageType;
      const trackVal = parentTrack1Style || area.trackType;
      const hangingVal = parentHangingType || area.hangingType;
      const distL = parentDistanceLeft || area.distanceLeft;
      const distR = parentDistanceRight || area.distanceRight;
      const distT = parentDistanceTop || area.distanceTop;
      const distB = parentDistanceBottom || area.distanceBottom;

      if (
        area.solidFabricName !== areaSolidName ||
        area.solidFabricColor !== areaSolidColor ||
        area.sheerFabricName !== areaSheerName ||
        area.sheerFabricColor !== areaSheerColor ||
        area.layerDisplayType !== displayType ||
        area.style !== styleVal ||
        area.hemStyleText !== hemVal ||
        area.usageType !== usageVal ||
        area.trackType !== trackVal ||
        area.hangingType !== hangingVal ||
        area.distanceLeft !== distL ||
        area.distanceRight !== distR ||
        area.distanceTop !== distT ||
        area.distanceBottom !== distB
      ) {
        changed = true;
        return {
          ...area,
          solidFabricName: areaSolidName,
          solidFabricColor: areaSolidColor,
          sheerFabricName: areaSheerName,
          sheerFabricColor: areaSheerColor,
          layerDisplayType: displayType,
          style: styleVal,
          hemStyleText: hemVal,
          usageType: usageVal,
          trackType: trackVal,
          hangingType: hangingVal,
          distanceLeft: distL,
          distanceRight: distR,
          distanceTop: distT,
          distanceBottom: distB,
        };
      }
      return area;
    });

    if (changed) {
      onAreasChange(updatedAreas);
    }
  }, [
    parentSolidFabricName,
    parentSheerFabricName,
    isDoubleLayer,
    parentStyle,
    parentHemStyleText,
    parentLayer1Style,
    parentLayer2Style,
    parentTrack1Style,
    parentTrack2Style,
    parentMountingType,
    parentHangingType,
    parentDistanceLeft,
    parentDistanceRight,
    parentDistanceTop,
    parentDistanceBottom,
  ]);

  const activeArea = areas.find((a) => a.id === activeAreaId);
  const activeAreaIdx = areas.findIndex((a) => a.id === activeAreaId);

  // Clear current drawing draft points
  const handleCancelDrawing = () => {
    setDrawingPoints([]);
    setHoverPoint(null);
    setIsDrawingMode(false);
  };

  return (
    <div className="space-y-6">
      {/* Visual Workspace Row */}
      <div className="bg-slate-900 rounded-3xl p-5 md:p-6 border border-slate-800 text-white space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h5 className="text-sm font-bold tracking-wider uppercase text-indigo-400 flex items-center gap-1.5">
              <Layout className="w-4.5 h-4.5" />
              <span>เครื่องมือจำลองวาดและระบุพื้นที่ผ้าม่าน ({areas.length} จุดวาด)</span>
            </h5>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
              คลิกเพื่อระบุพิกัดสี่มุมหรือขอบเขตติดตั้งรอบกระจก ดับเบิ้ลคลิกเพื่อปิดเส้น ขยับปรับตำแหน่งภายหลังได้อย่างอิสระ
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isDrawingMode ? (
              <button
                type="button"
                onClick={() => {
                  setIsDrawingMode(true);
                  setDrawingPoints([]);
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/15 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>วาดพื้นที่ผ้าม่านเพิ่ม +</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={finalizeDrawing}
                  disabled={drawingPoints.length < 3}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white text-xs font-black px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>เสร็จสิ้นการวาด ({drawingPoints.length} จุด)</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancelDrawing}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-3 py-2.5 rounded-xl transition cursor-pointer"
                >
                  ยกเลิก
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Canvas & Before Image Container */}
        <div className="relative border border-slate-800 rounded-2xl overflow-hidden bg-black/40 flex items-center justify-center select-none shadow-inner">
          {/* Background image */}
          <div ref={containerRef} className="relative max-w-full max-h-[500px]">
            <img
              src={preImageBase64}
              alt="Room Before installation editor"
              className="max-h-[500px] object-contain pointer-events-none select-none rounded-xl"
              onLoad={() => {
                // Ensure SVG coordinates recalculate beautifully if container size responds
              }}
            />

            {/* Interactive SVG Overlay layer */}
            <svg
              className="absolute inset-0 w-full h-full cursor-crosshair overflow-visible"
              onClick={handleCanvasClick}
              onDoubleClick={handleCanvasDoubleClick}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              style={{ pointerEvents: "auto" }}
            >
              {/* background grid when in drawing mode */}
              {isDrawingMode && (
                <g opacity="0.12">
                  {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((percent) => (
                    <g key={percent}>
                      <line x1={`${percent}%`} y1="0%" x2={`${percent}%`} y2="100%" stroke="#ffffff" strokeWidth="0.5" />
                      <line x1="0%" y1={`${percent}%`} x2="100%" y2={`${percent}%`} stroke="#ffffff" strokeWidth="0.5" />
                    </g>
                  ))}
                </g>
              )}

              {/* Drawing guide lines (Horizontal and Vertical crosshairs) */}
              {isDrawingMode && hoverPoint && (
                <g opacity="0.4">
                  <line
                    x1="0%"
                    y1={`${hoverPoint.y}%`}
                    x2="100%"
                    y2={`${hoverPoint.y}%`}
                    stroke="#818cf8"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <line
                    x1={`${hoverPoint.x}%`}
                    y1="0%"
                    x2={`${hoverPoint.x}%`}
                    y2="100%"
                    stroke="#818cf8"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                </g>
              )}

              {/* Render Saved Closed Polygons */}
              {areas.map((area, areaIdx) => {
                const colors = getAreaColor(areaIdx);
                const isSelected = activeAreaId === area.id;
                
                // Construct points list for polygon SVG representation
                const pointsString = area.points.map((p) => `${p.x}%,${p.y}%`).join(" ");

                return (
                  <g key={area.id} className="group">
                    {/* Nested SVG to render scaled polygon using unitless viewBox coordinates */}
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
                      {/* Render Polygon area */}
                      <polygon
                        points={area.points.map((p) => `${p.x},${p.y}`).join(" ")}
                        fill={isSelected ? colors.fill : colors.fill.replace("0.25", "0.1")}
                        stroke={colors.stroke}
                        strokeWidth={isSelected ? 4.5 : 2.5}
                        strokeOpacity={isSelected ? 1.0 : 0.75}
                        vectorEffect="non-scaling-stroke"
                        className="transition-all duration-200 cursor-pointer pointer-events-auto"
                        onClick={(e) => {
                          e.stopPropagation();
                          onActiveAreaChange(area.id);
                        }}
                      />

                      {/* Poly lines connects nodes */}
                      <polyline
                        points={area.points.map((p) => `${p.x},${p.y}`).join(" ")}
                        fill="none"
                        stroke={colors.stroke}
                        strokeWidth={isSelected ? 4.5 : 2.5}
                        strokeOpacity={isSelected ? 1.0 : 0.75}
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>

                    {/* Area Badge Label inside center of coordinates */}
                    {area.points.length > 0 && (
                      <foreignObject
                        x={`${area.points[0].x}%`}
                        y={`${area.points[0].y - 4}%`}
                        width="100"
                        height="30"
                        className="overflow-visible pointer-events-none"
                      >
                        <div 
                          className={`text-[9px] font-black px-1.5 py-0.5 rounded shadow text-white tracking-tight flex items-center justify-center shrink-0 w-max`}
                          style={{ backgroundColor: colors.stroke }}
                        >
                          {area.name}
                        </div>
                      </foreignObject>
                    )}

                    {/* Interactive Handles for dragging nodes (only if selected) */}
                    {isSelected && area.points.map((pt, ptIdx) => (
                      <circle
                        key={ptIdx}
                        cx={`${pt.x}%`}
                        cy={`${pt.y}%`}
                        r={6}
                        className="fill-white stroke-slate-900 stroke-2 cursor-move hover:fill-amber-400 hover:scale-125 transition-all"
                        onMouseDown={(e) => handleStartDrag(e, area.id, ptIdx)}
                      />
                    ))}
                  </g>
                );
              })}

              {/* Render Active Drawing Line Draft (Draft state) */}
              {isDrawingMode && drawingPoints.length > 0 && (
                <g>
                  {/* Connect draft points with lines */}
                  {drawingPoints.map((pt, idx) => {
                    if (idx === 0) return null;
                    const prevPt = drawingPoints[idx - 1];
                    return (
                      <line
                        key={idx}
                        x1={`${prevPt.x}%`}
                        y1={`${prevPt.y}%`}
                        x2={`${pt.x}%`}
                        y2={`${pt.y}%`}
                        stroke="#f43f5e"
                        strokeWidth="2"
                        strokeDasharray="4 3"
                      />
                    );
                  })}

                  {/* Draw dashed line from last point to active cursor hover point */}
                  {hoverPoint && (
                    <line
                      x1={`${drawingPoints[drawingPoints.length - 1].x}%`}
                      y1={`${drawingPoints[drawingPoints.length - 1].y}%`}
                      x2={`${hoverPoint.x}%`}
                      y2={`${hoverPoint.y}%`}
                      stroke="#f43f5e"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                      opacity="0.8"
                    />
                  )}

                  {/* Draw nodes as circular draft nodes */}
                  {drawingPoints.map((pt, idx) => {
                    const isFirstPoint = idx === 0;
                    return (
                      <circle
                        key={idx}
                        cx={`${pt.x}%`}
                        cy={`${pt.y}%`}
                        r={isFirstPoint ? 14 : 5}
                        className={isFirstPoint 
                          ? "fill-rose-500 stroke-white stroke-2 cursor-pointer hover:scale-110 transition-transform shadow-lg" 
                          : "fill-rose-400 stroke-white"}
                        onClick={(e) => {
                          if (isFirstPoint && drawingPoints.length >= 3) {
                            e.stopPropagation();
                            finalizeDrawing();
                          }
                        }}
                      />
                    );
                  })}

                  {/* Visual helper ring for the large first point */}
                  {drawingPoints.length >= 3 && (
                    <circle
                      cx={`${drawingPoints[0].x}%`}
                      cy={`${drawingPoints[0].y}%`}
                      r={20}
                      className="fill-none stroke-rose-500/50 stroke-1 stroke-dasharray animate-pulse pointer-events-none"
                    />
                  )}
                </g>
              )}
            </svg>
          </div>
        </div>

        {/* Guide helper info text */}
        <div className="text-[11px] text-slate-400 bg-slate-950/40 p-3 rounded-xl border border-slate-800 flex items-start gap-2">
          <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold text-slate-200">คู่มือวาดติดตั้ง:</span>
            <p>
              1. กดปุ่ม <strong>"วาดพื้นที่ผ้าม่านเพิ่ม +"</strong> สีม่วงขวาบน เพื่อเริ่มวาดพื้นที่ผ้าม่านช่องแรก <br />
              2. คลิกเม้าส์ลงบนรูปถ่าย เพื่อกำหนดจุดพิกัดรอบวงกบหน้าต่างทีละมุมจนครบเส้นล้อมรอบ <br />
              3. สิ้นสุดการวาดโดยการ <strong>ดับเบิ้ลคลิก (Double-Click)</strong> หรือคลิกซ้ำที่ <strong>จุดวงกลมแรกสีแดงที่กระพริบ</strong> <br />
              4. เมื่อเส้นปิดเรียบร้อยแล้ว คุณสามารถขยับเลื่อนขยายจัดพิกัดทุกมุมได้ง่ายๆ โดยการคลิกเม้าส์ค้างไว้ที่พิกัดแล้วลากขยับปรับตำแหน่ง
            </p>
          </div>
        </div>

        {/* Drawn Areas List Cards */}
        {areas.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-2">
            {areas.map((area, idx) => {
              const colors = getAreaColor(idx);
              const isSelected = activeAreaId === area.id;

              return (
                <div
                  key={area.id}
                  onClick={() => onActiveAreaChange(area.id)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-1.5 ${
                    isSelected
                      ? `bg-slate-800 ${colors.border} border-2`
                      : "bg-slate-950/50 border-slate-800 hover:bg-slate-800/30"
                  }`}
                >
                  <div className="min-w-0 flex items-center gap-1.5">
                    <div 
                      className="w-3 h-3 rounded-full shrink-0" 
                      style={{ backgroundColor: colors.stroke }}
                    ></div>
                    <span className="text-xs font-extrabold text-white truncate">
                      {area.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteArea(area.id);
                    }}
                    className="text-slate-500 hover:text-rose-400 p-1 rounded-md transition"
                    title="ลบพื้นที่วาดนี้"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Area Specifications Fields Card (Only rendered when there's an active selected area) */}
      {activeArea ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 md:p-8 shadow-sm space-y-6 animate-fade-in">
          {/* Active Area Settings Title Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-4">
            <div className="flex items-center gap-3">
              <div 
                className="w-4 h-4 rounded-full shrink-0 shadow" 
                style={{ backgroundColor: getAreaColor(activeAreaIdx).stroke }}
              ></div>
              <div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={activeArea.name}
                    onChange={(e) => handleUpdateActiveArea({ name: e.target.value })}
                    className="font-black text-slate-800 text-lg bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-indigo-500/20 outline-none w-48 font-sans"
                    placeholder="ชื่อพื้นที่ผ้าม่าน"
                  />
                  <span className="text-xs text-slate-400 font-normal">(แก้ไขชื่อพื้นที่นี้ได้)</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  กำหนดสเปกเนื้อผ้า รูปแบบ ชายผ้า และขนาดติดตั้งของบริเวณพื้นที่นี้โดยเฉพาะ (แยกอิสระ)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleDeleteArea(activeArea.id)}
              className="text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>ลบพื้นที่ "{activeArea.name}"</span>
            </button>
          </div>

          <div className="flex flex-col gap-6">
            {/* Dimensions Sub-card */}
            <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
              <h6 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                <Ruler className="w-4 h-4 text-indigo-500" />
                <span>ขนาดพื้นที่ติดตั้งเฉพาะจุดวาดนี้ (Area Dimensions)</span>
              </h6>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    ความกว้างรวม (ซม.)
                  </label>
                  <input
                    type="text"
                    value={activeArea.width}
                    onChange={(e) => handleUpdateActiveArea({ width: e.target.value })}
                    className="w-full bg-white border border-slate-200 text-slate-800 text-sm rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/20 outline-none transition font-bold"
                    placeholder="เช่น 250"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    ความสูงรวม (ซม.)
                  </label>
                  <input
                    type="text"
                    value={activeArea.height}
                    onChange={(e) => handleUpdateActiveArea({ height: e.target.value })}
                    className="w-full bg-white border border-slate-200 text-slate-800 text-sm rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/20 outline-none transition font-bold"
                    placeholder="เช่น 280"
                  />
                </div>
              </div>
            </div>

            {/* Display Layer Selection (สเปกและสวอชวัสดุจากระบบตั้งค่าฐานข้อมูลกลาง) */}
            <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
              <h6 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <Layout className="w-4 h-4 text-emerald-500" />
                <span>ระดับการแสดงผลเนื้อผ้าและสปริงบอร์ดสวอชวัสดุ (Fabric Layers Filter)</span>
              </h6>

              <div className="flex flex-col gap-4">
                {/* Select dropdown: ทั้งหมด, ม่านทึบ, ม่านโปร่ง */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    เลือกรูปแบบชั้นม่านในพื้นที่นี้ (Layer Filter)
                  </label>
                  <select
                    value={activeArea.layerDisplayType || (isDoubleLayer ? "ทั้งหมด" : "ม่านทึบ")}
                    onChange={(e) => {
                      const val = e.target.value as "ทั้งหมด" | "ม่านทึบ" | "ม่านโปร่ง";
                      let sName = "";
                      let sColor = "";
                      let shName = "";
                      let shColor = "";

                      let parsedSolidName = "";
                      let parsedSolidColor = "";
                      if (parentSolidFabricName) {
                        const parts = parentSolidFabricName.split(" / ");
                        parsedSolidName = parts[0] || "";
                        parsedSolidColor = parts[1] || "";
                      }

                      let parsedSheerName = "";
                      let parsedSheerColor = "";
                      if (parentSheerFabricName) {
                        const parts = parentSheerFabricName.split(" / ");
                        parsedSheerName = parts[0] || "";
                        parsedSheerColor = parts[1] || "";
                      }

                      if (val === "ม่านทึบ") {
                        sName = parsedSolidName;
                        sColor = parsedSolidColor;
                      } else if (val === "ม่านโปร่ง") {
                        shName = parsedSheerName;
                        shColor = parsedSheerColor;
                      } else {
                        sName = parsedSolidName;
                        sColor = parsedSolidColor;
                        shName = parsedSheerName;
                        shColor = parsedSheerColor;
                      }

                      handleUpdateActiveArea({
                        layerDisplayType: val,
                        solidFabricName: sName,
                        solidFabricColor: sColor,
                        sheerFabricName: shName,
                        sheerFabricColor: shColor,
                      });
                    }}
                    className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer font-bold text-indigo-600"
                  >
                    <option value="ทั้งหมด">ทั้งหมด (ม่านทึบแสง + ม่านโปร่งแสง)</option>
                    <option value="ม่านทึบ">ม่านทึบแสงอย่างเดียว (Solid Only)</option>
                    <option value="ม่านโปร่ง">ม่านโปร่งแสงอย่างเดียว (Sheer Only)</option>
                  </select>
                </div>

                {/* Spliced Auto specs showing synced central database values */}
                <div className="bg-white p-4 rounded-xl border border-slate-200/60 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    วัสดุสวอชจากระบบฐานข้อมูลกลาง (ซิงค์อัตโนมัติ)
                  </span>
                  <div className="text-xs text-slate-700 space-y-2">
                    {((activeArea.layerDisplayType || (isDoubleLayer ? "ทั้งหมด" : "ม่านทึบ")) === "ทั้งหมด" || (activeArea.layerDisplayType || (isDoubleLayer ? "ทั้งหมด" : "ม่านทึบ")) === "ม่านทึบ") && (
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-slate-800 shrink-0 border border-slate-200"></span>
                        <span className="font-bold text-slate-900 w-24">ผ้าม่านทึบ (Solid):</span>
                        <span className="text-slate-600 font-medium bg-slate-100 px-2 py-0.5 rounded text-[11px]">{parentSolidFabricName || "ตามการตั้งค่ากลาง"}</span>
                      </div>
                    )}
                    {((activeArea.layerDisplayType || (isDoubleLayer ? "ทั้งหมด" : "ม่านทึบ")) === "ทั้งหมด" || (activeArea.layerDisplayType || (isDoubleLayer ? "ทั้งหมด" : "ม่านทึบ")) === "ม่านโปร่ง") && (
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-indigo-200 shrink-0 border border-slate-200"></span>
                        <span className="font-bold text-slate-900 w-24">ผ้าม่านโปร่ง (Sheer):</span>
                        <span className="text-slate-600 font-medium bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          {isDoubleLayer ? (parentSheerFabricName || "ตามการตั้งค่ากลาง") : "ไม่ได้เปิดใช้ชั้นโปร่ง"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Central Database Specifications Display - Vertical Stack */}
            <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
              <h6 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <Sliders className="w-4 h-4 text-indigo-500" />
                <span>ข้อกำหนดและการติดตั้ง (Synchronized Specifications)</span>
              </h6>

              <div className="bg-white rounded-xl border border-slate-200/60 overflow-hidden divide-y divide-slate-100 p-1 text-xs">
                {/* Visual spec grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-0.5">รูปแบบผ้าม่าน (Curtain Style)</span>
                    <span className="font-extrabold text-slate-800">{parentStyle || "ตามค่ามาตรฐาน"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-0.5">ระยะชายม่าน (Hem Style)</span>
                    <span className="font-extrabold text-indigo-600">{parentHemStyleText || "พอดีพื้น"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-0.5">การติดตั้งรางม่าน (Mounting)</span>
                    <span className="font-extrabold text-slate-800">{parentMountingType || "ไม่ระบุ"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-0.5">การแขวนม่าน (Hanging Type)</span>
                    <span className="font-extrabold text-slate-800">{parentHangingType || "ไม่ระบุ"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 bg-slate-50/40">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-0.5">ชั้นที่ 1 (Solid Layer Spec)</span>
                    <div className="text-[11px] font-semibold text-slate-700 space-y-0.5">
                      <div><span className="text-slate-400 font-bold">ใช้งาน:</span> {parentLayer1Style || "ไม่ระบุ"}</div>
                      <div><span className="text-slate-400 font-bold">ราง:</span> {parentTrack1Style || "ไม่ระบุ"}</div>
                    </div>
                  </div>
                  {isDoubleLayer && (
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-0.5">ชั้นที่ 2 (Sheer Layer Spec)</span>
                      <div className="text-[11px] font-semibold text-slate-700 space-y-0.5">
                        <div><span className="text-slate-400 font-bold">ใช้งาน:</span> {parentLayer2Style || "ไม่ระบุ"}</div>
                        <div><span className="text-slate-400 font-bold">ราง:</span> {parentTrack2Style || "ไม่ระบุ"}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Clearances read-only summary */}
                <div className="p-3.5 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">ระยะเผื่อรอบวงกบ (Clearance Offsets)</span>
                  <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="text-[9px] font-bold text-slate-400 block uppercase mb-0.5">ซ้าย</span>
                      <span className="font-extrabold text-slate-700">{parentDistanceLeft || "0"}</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="text-[9px] font-bold text-slate-400 block uppercase mb-0.5">ขวา</span>
                      <span className="font-extrabold text-slate-700">{parentDistanceRight || "0"}</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="text-[9px] font-bold text-slate-400 block uppercase mb-0.5">บน</span>
                      <span className="font-extrabold text-slate-700">{parentDistanceTop || "0"}</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="text-[9px] font-bold text-slate-400 block uppercase mb-0.5">ล่าง</span>
                      <span className="font-extrabold text-slate-700">{parentDistanceBottom || "พอดีพื้น"}</span>
                    </div>
                  </div>
                </div>

                {parentAccessories && (
                  <div className="p-3.5 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">อุปกรณ์เสริม (Accessories)</span>
                    <span className="text-xs font-black text-slate-700 max-w-xs truncate" title={parentAccessories}>
                      {parentAccessories}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Custom Notes specific to this area */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-400" />
                <span>หมายเหตุคำชี้แจงสำหรับบานนี้โดยเฉพาะ (Specific notes / installation instruction)</span>
              </label>
              <textarea
                value={activeArea.notes}
                onChange={(e) => handleUpdateActiveArea({ notes: e.target.value })}
                placeholder="เช่น พื้นที่ผ้าม่านบริเวณบานประตูสไลด์ข้าง ตึกสูงลมพัดแรงเป็นพิเศษ แนะนำให้ปิดกั้นรางและติดแม่เหล็กถ่วงชาย"
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition h-20 resize-none"
              ></textarea>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 text-center py-6 rounded-2xl max-w-md mx-auto">
          <HelpCircle className="w-8 h-8 text-indigo-300 mx-auto mb-2 animate-bounce" />
          <p className="text-slate-600 font-bold text-xs">ยังไม่มีพื้นที่ผ้าม่านที่ถูกเลือก</p>
          <p className="text-[11px] text-slate-400 mt-0.5 px-6 leading-normal">
            กรุณากดปุ่ม <strong>"วาดพื้นที่ผ้าม่านเพิ่ม +"</strong> ด้านบน หรือคลิกเลือกการ์ดพื้นที่เพื่อแก้ไขรายละเอียดข้อกำหนดแยกต่างหาก
          </p>
        </div>
      )}
    </div>
  );
};
