import { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { JobListView } from "./components/JobListView";
import { JobEditorView } from "./components/JobEditorView";
import { SettingsView } from "./components/SettingsView";
import { PDFReportPreview } from "./components/PDFReportPreview";
import { Login } from "./components/Login";
import { 
  subscribeJobs, 
  subscribeWindows, 
  subscribeEmployees, 
  subscribeSettings, 
  firebaseStorage 
} from "./lib/firebaseStorage";
import { Job, WindowItem, Employee, Settings } from "./types";
import jsPDF from "jspdf";
import { toJpeg } from "html-to-image";
import { X, FileText, FileDown } from "lucide-react";

export default function App() {
  // Authentication & Session Persistence
  const [currentUser, setCurrentUser] = useState<Employee | null>(() => {
    const saved = localStorage.getItem("curtain_user");
    return saved ? JSON.parse(saved) : null;
  });

  // Global App States with LocalStorage backup for persistent navigation
  const [activeTab, setActiveTab] = useState<string>(() => {
    return localStorage.getItem("curtain_active_tab") || "jobs";
  });
  const [jobs, setJobs] = useState<Job[]>([]);
  const [windows, setWindows] = useState<WindowItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<Settings>({
    curtainStyles: [],
    patterns: [],
    tracks: [],
    accessories: [],
  });

  const [activeEmployeeId, setActiveEmployeeId] = useState<string>(() => {
    const saved = localStorage.getItem("curtain_user");
    return saved ? JSON.parse(saved).id : "";
  });
  const [editingJob, setEditingJob] = useState<Job | null>(() => {
    const saved = localStorage.getItem("curtain_editing_job");
    return saved ? JSON.parse(saved) : null;
  });
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [previewJob, setPreviewJob] = useState<Job | null>(null);

  // Sync / Load Initial Data on Mount with Real-time Firestore Snapshots
  useEffect(() => {
    const unsubscribeJobs = subscribeJobs((loadedJobs) => {
      setJobs(loadedJobs);
    });

    const unsubscribeWindows = subscribeWindows((loadedWindows) => {
      setWindows(loadedWindows);
    });

    const unsubscribeEmployees = subscribeEmployees((loadedEmployees) => {
      setEmployees(loadedEmployees);
      if (loadedEmployees.length > 0) {
        setActiveEmployeeId((prev) => {
          const savedUserStr = localStorage.getItem("curtain_user");
          const savedUser = savedUserStr ? JSON.parse(savedUserStr) : null;
          
          if (savedUser && savedUser.role !== "admin") {
            return savedUser.id;
          }
          
          if (!prev) {
            if (savedUser) {
              return savedUser.id;
            }
            return loadedEmployees[0].id;
          }
          return prev;
        });
      }
    });

    const unsubscribeSettings = subscribeSettings((loadedSettings) => {
      setSettings(loadedSettings);
    });

    return () => {
      unsubscribeJobs();
      unsubscribeWindows();
      unsubscribeEmployees();
      unsubscribeSettings();
    };
  }, []);

  // Sync editingJob with real-time updates from jobs collection
  useEffect(() => {
    if (editingJob) {
      const updatedJob = jobs.find((j) => j.id === editingJob.id);
      if (updatedJob) {
        setEditingJob(updatedJob);
        localStorage.setItem("curtain_editing_job", JSON.stringify(updatedJob));
      }
    }
  }, [jobs, editingJob?.id]);

  // Restrict access to settings for non-admins
  useEffect(() => {
    if (currentUser && currentUser.role !== "admin" && activeTab === "settings") {
      handleSetActiveTab("jobs");
    }
  }, [currentUser, activeTab]);

  // Wrapper handlers for state changes to automatically save to localStorage
  const handleSetActiveTab = (tab: string) => {
    setActiveTab(tab);
    localStorage.setItem("curtain_active_tab", tab);
  };

  const handleSetEditingJob = (job: Job | null) => {
    setEditingJob(job);
    if (job) {
      localStorage.setItem("curtain_editing_job", JSON.stringify(job));
    } else {
      localStorage.removeItem("curtain_editing_job");
    }
  };

  const handleLoginSuccess = (employee: Employee) => {
    setCurrentUser(employee);
    localStorage.setItem("curtain_user", JSON.stringify(employee));
    setActiveEmployeeId(employee.id);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("curtain_user");
    localStorage.removeItem("curtain_active_tab");
    localStorage.removeItem("curtain_editing_job");
    setActiveTab("jobs");
    setEditingJob(null);
    setActiveEmployeeId("");
  };

  // Sync states with real-time Firebase Firestore
  const handleSaveSettings = async (newSettings: Settings, onProgress?: (pct: number) => void) => {
    try {
      setSettings(newSettings);
      await firebaseStorage.saveSettings(newSettings, onProgress);
    } catch (e: any) {
      console.error("Failed to save settings to Firestore:", e);
      throw e;
    }
  };

  const handleSaveEmployee = async (employee: Employee) => {
    try {
      await firebaseStorage.saveEmployee(employee);
    } catch (e: any) {
      console.error("Failed to save employee to Firestore:", e);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    try {
      await firebaseStorage.deleteEmployee(id);
    } catch (e: any) {
      console.error("Failed to delete employee from Firestore:", e);
    }
  };

  const handleIncrementEmployeeAiUsage = async (employeeId: string) => {
    try {
      await firebaseStorage.incrementEmployeeAiUsage(employeeId);
    } catch (e: any) {
      console.error("Failed to increment employee AI usage:", e);
    }
  };

  const handleSaveJob = async (job: Job) => {
    try {
      await firebaseStorage.saveJob(job);
      handleSetEditingJob(job);
    } catch (e: any) {
      console.error("Failed to save job to Firestore:", e);
    }
  };

  const handleDeleteJob = async (id: string) => {
    try {
      const assocWindows = windows.filter((w) => w.jobId === id);
      for (const w of assocWindows) {
        await firebaseStorage.deleteWindow(w.id);
      }
      await firebaseStorage.deleteJob(id);
    } catch (e: any) {
      console.error("Failed to delete job and associated windows:", e);
    }
  };

  const handleSaveWindow = async (windowItem: WindowItem): Promise<boolean> => {
    try {
      await firebaseStorage.saveWindow(windowItem);
      return true;
    } catch (e: any) {
      console.error("Failed to save window to Firestore:", e);
      alert("บันทึกหน้าต่างไม่สำเร็จ: " + e.message);
      return false;
    }
  };

  const handleDeleteWindow = async (id: string) => {
    try {
      await firebaseStorage.deleteWindow(id);
    } catch (e: any) {
      console.error("Failed to delete window from Firestore:", e);
    }
  };

  const handleUpdateWindowMetadata = async (id: string, metadata: Partial<WindowItem>) => {
    try {
      await firebaseStorage.updateWindowMetadata(id, metadata);
    } catch (e: any) {
      console.error("Failed to update window metadata:", e);
    }
  };

  // Export proposal report containing cover and window specs pages to PDF
  const handleExportPDF = async (job: Job) => {
    setIsExporting(true);
    
    try {
      // Find the PDF container, check both the hidden template and active preview container for robust rendering
      let pdfContainer = document.getElementById(`pdf-export-${job.id}`);
      if (!pdfContainer) {
        pdfContainer = document.getElementById(`pdf-preview-${job.id}`);
      }
      
      if (!pdfContainer) {
        throw new Error("PDF Template Container not found in document.");
      }

      // Small timeout to allow the browser to fully populate elements, images and styles
      await new Promise((resolve) => setTimeout(resolve, 800));
      if (document.fonts) {
        try {
          await document.fonts.ready;
        } catch (e) {
          console.warn("Failed to wait for fonts to be ready:", e);
        }
      }

      const pdf = new jsPDF({
        orientation: "p",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      const pages = pdfContainer.querySelectorAll(".pdf-page");
      if (pages.length === 0) {
        throw new Error("ใบนำเสนอสเปกม่านไม่มีหน้าสำหรับออกรายงาน PDF");
      }

      // Keep a reference to the native, unpatched getComputedStyle to avoid recursion
      const nativeGetComputedStyle = window.getComputedStyle;

      // Mathematical conversion from OKLCH/OKLAB to RGB
      const oklchToRgb = (l: number, c: number, h: number, alpha: number = 1): string => {
        const hRad = (h * Math.PI) / 180;
        const a = c * Math.cos(hRad);
        const b = c * Math.sin(hRad);

        const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
        const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
        const s_ = l - 0.0894841775 * a - 1.2914855480 * b;

        const lLinear = l_ * l_ * l_;
        const mLinear = m_ * m_ * m_;
        const sLinear = s_ * s_ * s_;

        const r = +4.0767416621 * lLinear - 3.3077115913 * mLinear + 0.2309699292 * sLinear;
        const g = -1.2684380046 * lLinear + 2.6097574011 * mLinear - 0.3413193965 * sLinear;
        const b_channel = -0.0041960863 * lLinear - 0.7034186147 * mLinear + 1.7076147010 * sLinear;

        const gamma = (val: number) => {
          if (val <= 0.0031308) {
            return 12.92 * val;
          } else {
            return 1.055 * Math.pow(val, 1 / 2.4) - 0.055;
          }
        };

        const rSrgb = Math.min(255, Math.max(0, Math.round(gamma(r) * 255)));
        const gSrgb = Math.min(255, Math.max(0, Math.round(gamma(g) * 255)));
        const bSrgb = Math.min(255, Math.max(0, Math.round(gamma(b_channel) * 255)));

        return alpha === 1
          ? `rgb(${rSrgb}, ${gSrgb}, ${bSrgb})`
          : `rgba(${rSrgb}, ${gSrgb}, ${bSrgb}, ${alpha})`;
      };

      const oklabToRgb = (l: number, a: number, b: number, alpha: number = 1): string => {
        const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
        const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
        const s_ = l - 0.0894841775 * a - 1.2914855480 * b;

        const lLinear = l_ * l_ * l_;
        const mLinear = m_ * m_ * m_;
        const sLinear = s_ * s_ * s_;

        const r = +4.0767416621 * lLinear - 3.3077115913 * mLinear + 0.2309699292 * sLinear;
        const g = -1.2684380046 * lLinear + 2.6097574011 * mLinear - 0.3413193965 * sLinear;
        const b_channel = -0.0041960863 * lLinear - 0.7034186147 * mLinear + 1.7076147010 * sLinear;

        const gamma = (val: number) => {
          if (val <= 0.0031308) {
            return 12.92 * val;
          } else {
            return 1.055 * Math.pow(val, 1 / 2.4) - 0.055;
          }
        };

        const rSrgb = Math.min(255, Math.max(0, Math.round(gamma(r) * 255)));
        const gSrgb = Math.min(255, Math.max(0, Math.round(gamma(g) * 255)));
        const bSrgb = Math.min(255, Math.max(0, Math.round(gamma(b_channel) * 255)));

        return alpha === 1
          ? `rgb(${rSrgb}, ${gSrgb}, ${bSrgb})`
          : `rgba(${rSrgb}, ${gSrgb}, ${bSrgb}, ${alpha})`;
      };

      const parseColorExpression = (type: "oklch" | "oklab", expr: string): string | null => {
        try {
          const match = expr.match(new RegExp(`${type}\\s*\\(([^)]+)\\)`));
          if (!match) return null;
          
          const content = match[1].trim();
          const normalized = content.replace(/[\/,]/g, " ").replace(/\s+/g, " ").trim();
          const parts = normalized.split(" ");
          
          if (parts.length < 3) return null;
          
          const parsePercentOrNum = (val: string, maxVal: number = 1) => {
            if (val.endsWith("%")) {
              return (parseFloat(val) / 100) * maxVal;
            }
            return parseFloat(val);
          };
          
          const l = parsePercentOrNum(parts[0], 1);
          const c = parsePercentOrNum(parts[1], 1);
          const h = parsePercentOrNum(parts[2], 1);
          let alpha = parts[3] ? parsePercentOrNum(parts[3], 1) : 1;
          if (isNaN(alpha)) alpha = 1;
          
          if (isNaN(l) || isNaN(c) || isNaN(h)) return null;
          
          if (type === "oklch") {
            return oklchToRgb(l, c, h, alpha);
          } else {
            return oklabToRgb(l, c, h, alpha);
          }
        } catch (e) {
          return null;
        }
      };

      // Create a temporary element to resolve colors using the browser's native engine
      const tempEl = document.createElement("div");
      tempEl.style.display = "none";
      document.body.appendChild(tempEl);

      const resolutionCache = new Map<string, string>();

      const resolveColors = (cssText: string) => {
        let result = "";
        let i = 0;
        while (i < cssText.length) {
          const nextOklch = cssText.indexOf("oklch(", i);
          const nextOklab = cssText.indexOf("oklab(", i);
          
          let index = -1;
          let type = "";
          if (nextOklch !== -1 && nextOklab !== -1) {
            if (nextOklch < nextOklab) {
              index = nextOklch;
              type = "oklch";
            } else {
              index = nextOklab;
              type = "oklab";
            }
          } else if (nextOklch !== -1) {
            index = nextOklch;
            type = "oklch";
          } else if (nextOklab !== -1) {
            index = nextOklab;
            type = "oklab";
          }
          
          if (index === -1) {
            result += cssText.substring(i);
            break;
          }
          
          result += cssText.substring(i, index);
          
          let parenCount = 1;
          let j = index + type.length + 1;
          while (j < cssText.length && parenCount > 0) {
            const char = cssText[j];
            if (char === "(") {
              parenCount++;
            } else if (char === ")") {
              parenCount--;
            }
            j++;
          }
          
          const colorExpr = cssText.substring(index, j);
          
          if (resolutionCache.has(colorExpr)) {
            result += resolutionCache.get(colorExpr)!;
          } else {
            // 1. Try mathematical parser first for guaranteed correctness
            let resolved = parseColorExpression(type as "oklch" | "oklab", colorExpr);
            
            // 2. If mathematical parsing failed, try browser native resolution
            if (!resolved) {
              try {
                tempEl.style.color = "";
                tempEl.style.color = colorExpr;
                resolved = nativeGetComputedStyle(tempEl).color;
              } catch (e) {}
            }
            
            if (resolved && resolved !== "" && !resolved.includes("oklch") && !resolved.includes("oklab")) {
              resolutionCache.set(colorExpr, resolved);
              result += resolved;
            } else {
              // Extract L to estimate if it's a light or dark color
              let isLight = true;
              try {
                const firstNum = parseFloat(colorExpr.match(/[\d.]+/)?.[0] || "1");
                if (firstNum < 0.5) isLight = false;
              } catch (e) {}
              
              // Safe fallback instead of transparent gray:
              // If it's a dark color, fall back to solid black; otherwise solid white/light-gray
              const fallback = isLight ? "rgb(255,255,255)" : "rgb(0,0,0)";
              resolutionCache.set(colorExpr, fallback);
              result += fallback;
            }
          }
          
          i = j;
        }
        return result;
      };

      // Patch function to intercept and replace oklch/oklab in computed style queries
      const patchGetComputedStyle = (win: Window) => {
        const originalGetComputedStyle = win.getComputedStyle;
        win.getComputedStyle = function(elt, pseudoElt) {
          const style = originalGetComputedStyle.call(win, elt, pseudoElt);
          return new Proxy(style, {
            get(target, prop) {
              const val = target[prop as any];
              if (typeof val === "string" && (val.includes("oklch") || val.includes("oklab"))) {
                return resolveColors(val);
              }
              if (typeof val === "function") {
                if (prop === "getPropertyValue") {
                  return function(propertyName: string) {
                    const originalVal = target.getPropertyValue(propertyName);
                    if (typeof originalVal === "string" && (originalVal.includes("oklch") || originalVal.includes("oklab"))) {
                      return resolveColors(originalVal);
                    }
                    return originalVal;
                  };
                }
                return val.bind(target);
              }
              return val;
            }
          });
        };
      };

      // Extract and resolve all same-origin rules once up-front
      let consolidatedCssText = "";
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        try {
          const rules = sheet.cssRules;
          if (rules) {
            const rulesArray = Array.from(rules);
            consolidatedCssText += rulesArray.map(r => r.cssText).join("\n") + "\n";
          }
        } catch (e) {
          // Skip cross-origin stylesheets securely
        }
      }

      const resolvedCss = resolveColors(consolidatedCssText);

      // Patch the main window getComputedStyle temporarily during rendering
      patchGetComputedStyle(window);

      // Create a temporary hidden iframe to sandbox html-to-image rendering
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.left = "-9999px";
      iframe.style.top = "-9999px";
      iframe.style.width = "850px";
      iframe.style.height = "1180px";
      iframe.style.border = "none";
      iframe.style.visibility = "hidden";
      document.body.appendChild(iframe);

      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) {
          throw new Error("Could not access sandbox rendering context");
        }

        // Initialize the iframe with proper HTML structure, fonts and standard CSS with oklch resolved to standard rgb/rgba fallbacks
        iframeDoc.open();
        iframeDoc.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Sarabun:wght@300;400;500;600;700;800&display=swap');
              
              body {
                margin: 0;
                padding: 0;
                background-color: #ffffff;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              
              /* Force fallback fonts if network has glitches */
              body, text, span, div, p, td, th {
                font-family: 'Sarabun', 'Inter', 'Helvetica Neue', 'Arial', 'Tahoma', sans-serif !important;
              }
              
              ${resolvedCss}
            </style>
          </head>
          <body>
            <div id="content-root"></div>
          </body>
          </html>
        `);
        iframeDoc.close();

        // Wait a brief period for iframe setup and font loading triggers
        const iframeWin = iframe.contentWindow;
        if (iframeWin && (iframeWin as any).document.fonts) {
          try {
            await (iframeWin as any).document.fonts.ready;
          } catch (e) {
            console.warn("Sandbox fonts could not load:", e);
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 350));

        const contentRoot = iframeDoc.getElementById("content-root");
        if (!contentRoot) {
          throw new Error("Sandbox content root elements not found.");
        }

        // Render each page using sandbox-rendering html-to-image context
        for (let i = 0; i < pages.length; i++) {
          const pageElement = pages[i] as HTMLElement;
          
          // Clear previous page content
          contentRoot.innerHTML = "";
          
          // Clone the page element
          const clonedPage = pageElement.cloneNode(true) as HTMLElement;
          
          // Ensure cloned page has correct visibility layout
          clonedPage.style.display = "flex"; // Since pdf-page is flex-col
          clonedPage.style.position = "static";
          clonedPage.style.margin = "0";
          clonedPage.style.boxShadow = "none";
          clonedPage.style.borderRadius = "0";
          clonedPage.style.width = "794px";
          clonedPage.style.height = "1123px";
          
          // Clean inline styles of oklch/oklab
          const clonedStyledElements = clonedPage.querySelectorAll("[style]");
          clonedStyledElements.forEach((el) => {
            const htmlEl = el as HTMLElement;
            const styleAttr = htmlEl.getAttribute("style");
            if (styleAttr && (styleAttr.includes("oklch") || styleAttr.includes("oklab"))) {
              htmlEl.setAttribute("style", resolveColors(styleAttr));
            }
          });
          
          contentRoot.appendChild(clonedPage);
          
          // Wait for any DOM elements to layout completely
          await new Promise((resolve) => setTimeout(resolve, 150));
          
           // Render to high-definition JPEG using html-to-image
           const imgData = await toJpeg(clonedPage, {
             quality: 0.98,
             pixelRatio: 3.0, // 3.0x high definition crispness for ultra-sharp PDFs
             backgroundColor: "#ffffff",
             cacheBust: true,
             style: {
               transform: "none",
               margin: "0",
             },
           });
          
          if (i > 0) {
            pdf.addPage();
          }
          pdf.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST");
        }
      } finally {
        // Clean up the rendering iframe sandbox
        try {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        } catch (e) {}

        // Restore main window's original getComputedStyle
        window.getComputedStyle = nativeGetComputedStyle;

        // Clean up the temporary resolution element
        try {
          if (tempEl.parentNode) {
            tempEl.parentNode.removeChild(tempEl);
          }
        } catch (e) {}
      }

      // Download proposal PDF
      pdf.save(`ใบสรุปแบบติดตั้งผ้าม่าน ${job.customerName}.pdf`);
    } catch (error: any) {
      console.error("PDF export failed:", error);
      alert("การส่งออก PDF ล้มเหลว: " + (error.message || error));
    } finally {
      setIsExporting(false);
    }
  };

  if (!currentUser) {
    return <Login employees={employees} onLoginSuccess={handleLoginSuccess} />;
  }

  const visibleJobs = currentUser.role === "admin"
    ? jobs
    : jobs.filter((job) => job.employeeId === currentUser.id);

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      {/* Header tab navigation & Quota */}
      <Header
        employees={employees}
        activeEmployeeId={activeEmployeeId}
        onActiveEmployeeChange={setActiveEmployeeId}
        activeTab={activeTab}
        setActiveTab={handleSetActiveTab}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "jobs" && (
          <JobListView
            jobs={visibleJobs}
            allWindows={windows}
            employees={employees}
            onEditJob={(job) => {
              handleSetEditingJob(job);
              handleSetActiveTab("new_job");
            }}
            onDeleteJob={handleDeleteJob}
            onExportPDF={handleExportPDF}
            onPreviewPDF={setPreviewJob}
            isExporting={isExporting}
          />
        )}

        {activeTab === "new_job" && (
          <JobEditorView
            key={editingJob ? editingJob.id : "new"}
            job={editingJob}
            employees={employees}
            activeEmployeeId={activeEmployeeId}
            allWindows={windows}
            settings={settings}
            onSaveJob={handleSaveJob}
            onSaveWindow={handleSaveWindow}
            onUpdateWindowMetadata={handleUpdateWindowMetadata}
            onDeleteWindow={handleDeleteWindow}
            onIncrementEmployeeAiUsage={handleIncrementEmployeeAiUsage}
            onPreviewPDF={setPreviewJob}
            onBack={() => {
              handleSetActiveTab("jobs");
              handleSetEditingJob(null);
            }}
            currentUser={currentUser}
          />
        )}

        {activeTab === "settings" && (
          <SettingsView
            employees={employees}
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onSaveEmployee={handleSaveEmployee}
            onDeleteEmployee={handleDeleteEmployee}
            activeEmployeeId={activeEmployeeId}
          />
        )}
      </main>

      {/* Hidden Proposal templates rendered specifically for offscreen pdf-generating triggers */}
      <div className="fixed left-0 top-0 z-[-9999] pointer-events-none select-none">
        {visibleJobs.map((job) => (
          <PDFReportPreview
            key={job.id}
            job={job}
            windows={windows.filter((w) => w.jobId === job.id)}
            employees={employees}
            settings={settings}
          />
        ))}
      </div>

      {/* Modal Preview PDF Overlay */}
      {previewJob && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="p-4 md:p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
              <div>
                <h3 className="text-white text-base md:text-lg font-black flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-400" />
                  <span>ตัวอย่างรายงานการเสนอราคาติดตั้งผ้าม่าน</span>
                </h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  ลูกค้า: <span className="text-white font-semibold">{previewJob.customerName}</span> | โครงการวัดหน้างานจริง
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportPDF(previewJob)}
                  disabled={isExporting}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <FileDown className="w-4 h-4" />
                  <span>{isExporting ? "กำลังดาวน์โหลด..." : "ดาวน์โหลด PDF"}</span>
                </button>
                <button
                  onClick={() => setPreviewJob(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs p-2.5 rounded-xl transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body - Scrollable container showcasing A4 sheets */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-800 flex items-start justify-center">
              <div className="w-full max-w-[210mm] shadow-2xl mb-8">
                <PDFReportPreview
                  job={previewJob}
                  windows={windows.filter((w) => w.jobId === previewJob.id)}
                  employees={employees}
                  settings={settings}
                  isPreviewMode={true}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
