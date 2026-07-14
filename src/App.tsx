import { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { JobListView } from "./components/JobListView";
import { JobEditorView } from "./components/JobEditorView";
import { SettingsView } from "./components/SettingsView";
import { PDFReportPreview } from "./components/PDFReportPreview";
import { storage } from "./lib/storage";
import { Job, WindowItem, Employee, Settings } from "./types";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function App() {
  // Global App States
  const [activeTab, setActiveTab] = useState<string>("jobs");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [windows, setWindows] = useState<WindowItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<Settings>({
    curtainStyles: [],
    patterns: [],
    tracks: [],
    accessories: [],
  });

  const [activeEmployeeId, setActiveEmployeeId] = useState<string>("");
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Sync / Load Initial Data on Mount
  useEffect(() => {
    const loadedJobs = storage.getJobs();
    const loadedWindows = storage.getWindows();
    const loadedEmployees = storage.getEmployees();
    const loadedSettings = storage.getSettings();

    setJobs(loadedJobs);
    setWindows(loadedWindows);
    setEmployees(loadedEmployees);
    setSettings(loadedSettings);

    if (loadedEmployees.length > 0) {
      setActiveEmployeeId(loadedEmployees[0].id);
    }
  }, []);

  // Sync states with localStorage
  const handleSaveSettings = (newSettings: Settings) => {
    setSettings(newSettings);
    storage.saveSettings(newSettings);
  };

  const handleSaveEmployee = (employee: Employee) => {
    storage.saveEmployee(employee);
    setEmployees(storage.getEmployees());
  };

  const handleDeleteEmployee = (id: string) => {
    storage.deleteEmployee(id);
    setEmployees(storage.getEmployees());
  };

  const handleIncrementEmployeeAiUsage = (employeeId: string) => {
    storage.incrementEmployeeAiUsage(employeeId);
    setEmployees(storage.getEmployees());
  };

  const handleSaveJob = (job: Job) => {
    storage.saveJob(job);
    setJobs(storage.getJobs());
    setEditingJob(job);
  };

  const handleDeleteJob = (id: string) => {
    storage.deleteJob(id);
    setJobs(storage.getJobs());
    setWindows(storage.getWindows());
  };

  const handleSaveWindow = async (windowItem: WindowItem): Promise<boolean> => {
    try {
      storage.saveWindow(windowItem);
      setWindows(storage.getWindows());
      return true;
    } catch (e: any) {
      console.error("Failed to save window:", e);
      alert("บันทึกหน้าต่างไม่สำเร็จ: " + e.message);
      return false;
    }
  };

  const handleDeleteWindow = (id: string) => {
    storage.deleteWindow(id);
    setWindows(storage.getWindows());
  };

  // Export proposal report containing cover and window specs pages to PDF
  const handleExportPDF = async (job: Job) => {
    setIsExporting(true);
    try {
      // Small timeout to allow the browser to fully populate hidden PDF elements with images
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const pdfContainer = document.getElementById(`pdf-export-${job.id}`);
      if (!pdfContainer) {
        throw new Error("PDF Template Container not found in document.");
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

      for (let i = 0; i < pages.length; i++) {
        const pageElement = pages[i] as HTMLElement;
        const canvas = await html2canvas(pageElement, {
          scale: 1.5, // optimal compromise for high crispness and low file size
          useCORS: true,
          logging: false,
        });

        // Convert the page canvas to heavily-compressed JPEG in PDF format (saves MBs of bandwidth)
        const imgData = canvas.toDataURL("image/jpeg", 0.75);

        if (i > 0) {
          pdf.addPage();
        }
        pdf.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST");
      }

      // Download proposal PDF
      const formattedName = job.customerName.trim().replace(/\s+/g, "_");
      pdf.save(`Proposal_Curtains_${formattedName}.pdf`);
    } catch (error: any) {
      console.error("PDF export failed:", error);
      alert("การส่งออก PDF ล้มเหลว: " + (error.message || error));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans">
      {/* Header tab navigation & Quota */}
      <Header
        employees={employees}
        activeEmployeeId={activeEmployeeId}
        onActiveEmployeeChange={setActiveEmployeeId}
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab === "new_job") {
            setEditingJob(null);
          }
        }}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "jobs" && (
          <JobListView
            jobs={jobs}
            allWindows={windows}
            employees={employees}
            onEditJob={(job) => {
              setEditingJob(job);
              setActiveTab("new_job");
            }}
            onDeleteJob={handleDeleteJob}
            onExportPDF={handleExportPDF}
            isExporting={isExporting}
          />
        )}

        {activeTab === "new_job" && (
          <JobEditorView
            job={editingJob}
            employees={employees}
            activeEmployeeId={activeEmployeeId}
            allWindows={windows}
            settings={settings}
            onSaveJob={handleSaveJob}
            onSaveWindow={handleSaveWindow}
            onDeleteWindow={handleDeleteWindow}
            onIncrementEmployeeAiUsage={handleIncrementEmployeeAiUsage}
            onBack={() => {
              setActiveTab("jobs");
              setEditingJob(null);
            }}
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
      <div className="absolute left-[-9999px] top-0 pointer-events-none select-none">
        {jobs.map((job) => (
          <PDFReportPreview
            key={job.id}
            job={job}
            windows={windows.filter((w) => w.jobId === job.id)}
            employees={employees}
          />
        ))}
      </div>
    </div>
  );
}
