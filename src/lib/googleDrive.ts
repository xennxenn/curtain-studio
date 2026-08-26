// Google Drive Integration for Storing and Hosting Swatch Images
// Scopes: https://www.googleapis.com/auth/drive.file
import { auth } from "./firebase";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

declare global {
  interface Window {
    google?: any;
    gapi?: any;
  }
}

const DRIVE_TOKEN_KEY = "gdrive_curtain_oauth_token";
const DRIVE_TOKEN_EXPIRY_KEY = "gdrive_curtain_oauth_expiry";
const DRIVE_FOLDER_KEY = "gdrive_curtain_swatch_folder_id";
const SWATCH_FOLDER_NAME = "Curtain_Studio_Swatches";

const GOOGLE_CLIENT_ID =
  (firebaseConfig as any).oAuthClientId ||
  "372903051160-0g2be3t4q578kik19sd95mut8lltab9m.apps.googleusercontent.com";

let cachedAccessToken: string | null = null;
let cachedFolderId: string | null = null;

// Initialize and restore saved OAuth token
export function getSavedDriveToken(): string | null {
  if (cachedAccessToken) return cachedAccessToken;
  try {
    const token = localStorage.getItem(DRIVE_TOKEN_KEY);
    const expiry = localStorage.getItem(DRIVE_TOKEN_EXPIRY_KEY);
    if (token && expiry && Date.now() < parseInt(expiry, 10)) {
      cachedAccessToken = token;
      return token;
    }
  } catch {}
  return null;
}

export function saveDriveToken(token: string, expiresInSeconds: number = 3500) {
  cachedAccessToken = token;
  const expiry = Date.now() + expiresInSeconds * 1000;
  try {
    localStorage.setItem(DRIVE_TOKEN_KEY, token);
    localStorage.setItem(DRIVE_TOKEN_EXPIRY_KEY, expiry.toString());
  } catch {}
}

export function clearDriveToken() {
  cachedAccessToken = null;
  cachedFolderId = null;
  try {
    localStorage.removeItem(DRIVE_TOKEN_KEY);
    localStorage.removeItem(DRIVE_TOKEN_EXPIRY_KEY);
    localStorage.removeItem(DRIVE_FOLDER_KEY);
  } catch {}
}

export function isDriveConnected(): boolean {
  return !!getSavedDriveToken();
}

/**
 * Request OAuth Access Token from Google via Firebase Auth popup (origin-safe) or GIS
 */
export async function requestDriveAccessToken(): Promise<string> {
  const existing = getSavedDriveToken();
  if (existing) return existing;

  // 1. Preferred Primary Method: Firebase Auth popup (always works on all domains without origin_mismatch)
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope("https://www.googleapis.com/auth/drive.file");
    provider.setCustomParameters({
      prompt: "select_account",
    });

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      saveDriveToken(credential.accessToken, 3500);
      return credential.accessToken;
    }
  } catch (firebaseErr: any) {
    console.warn("Firebase Auth Drive popup fallback check:", firebaseErr?.message || firebaseErr);
    // If user cancelled, don't fallback to error out
    if (firebaseErr?.code === "auth/popup-closed-by-user" || firebaseErr?.code === "auth/cancelled-popup-request") {
      throw new Error("ผู้ใช้งานยกเลิกหน้าต่างล็อกอิน Google");
    }
  }

  // 2. Secondary fallback via GIS
  await loadGisScript();

  return new Promise((resolve, reject) => {
    try {
      const tokenClient = window.google?.accounts?.oauth2?.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: "https://www.googleapis.com/auth/drive.file",
        callback: (resp: any) => {
          if (resp && resp.access_token) {
            saveDriveToken(resp.access_token, resp.expires_in || 3500);
            resolve(resp.access_token);
          } else if (resp && resp.error) {
            reject(new Error(resp.error_description || resp.error));
          } else {
            reject(new Error("Failed to obtain Google Drive access token"));
          }
        },
        error_callback: (err: any) => {
          reject(err);
        }
      });

      if (!tokenClient) {
        throw new Error("Google Identity Services client is not available.");
      }

      tokenClient.requestAccessToken({ prompt: "" });
    } catch (err) {
      reject(err);
    }
  });
}

function loadGisScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(script);
  });
}

/**
 * Get or Create the Swatches Folder in Google Drive
 */
export async function getOrCreateSwatchFolder(accessToken: string): Promise<string> {
  if (cachedFolderId) return cachedFolderId;
  
  try {
    const saved = localStorage.getItem(DRIVE_FOLDER_KEY);
    if (saved && saved.length > 5) {
      cachedFolderId = saved;
      return saved;
    }
  } catch {}

  // 1. Search for existing folder
  try {
    const query = encodeURIComponent(`name = '${SWATCH_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`;

    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        cachedFolderId = data.files[0].id;
        try {
          localStorage.setItem(DRIVE_FOLDER_KEY, cachedFolderId!);
        } catch {}
        return cachedFolderId!;
      }
    }
  } catch (sErr) {
    console.warn("Notice searching Drive folder:", sErr);
  }

  // 2. Create folder if not found
  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: SWATCH_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });

  if (!createRes.ok) {
    throw new Error("Failed to create swatch folder in Google Drive");
  }

  const folderData = await createRes.json();
  cachedFolderId = folderData.id;
  try {
    localStorage.setItem(DRIVE_FOLDER_KEY, cachedFolderId!);
  } catch {}

  // Make folder publicly viewable for image reading (anyone with link can view)
  // Sub-items placed in this folder will automatically be readable
  fetch(`https://www.googleapis.com/drive/v3/files/${cachedFolderId}/permissions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      role: "reader",
      type: "anyone",
    }),
  }).catch((err) => console.warn("Could not set folder permissions:", err));

  return cachedFolderId!;
}

// Convert base64 data url directly to Blob efficiently
function base64ToBlob(base64Data: string): { blob: Blob; mimeType: string } {
  const parts = base64Data.split(",");
  const mimeMatch = parts[0]?.match(/:(.*?);/);
  const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const rawBase64 = parts[1] || base64Data;
  
  const byteCharacters = atob(rawBase64);
  const byteNumbers = new Uint8Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  return {
    blob: new Blob([byteNumbers], { type: mimeType }),
    mimeType,
  };
}

/**
 * Upload an image (base64 or Blob) to Google Drive and return public direct URL
 */
export async function uploadSwatchToDrive(
  fileName: string,
  base64Data: string,
  preloadedFolderId?: string
): Promise<string> {
  const token = getSavedDriveToken();
  if (!token) {
    // If not connected, return base64 as fallback
    return base64Data;
  }

  try {
    const folderId = preloadedFolderId || (await getOrCreateSwatchFolder(token));
    const { blob, mimeType } = base64ToBlob(base64Data);

    // Multipart upload
    const metadata = {
      name: fileName,
      mimeType: mimeType,
      parents: [folderId],
    };

    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    form.append("file", blob);

    const uploadUrl = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id";
    
    // Fast timeout controller (15s)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!uploadRes.ok) {
      if (uploadRes.status === 401) {
        clearDriveToken();
      }
      return base64Data;
    }

    const fileResult = await uploadRes.json();
    const fileId = fileResult.id;

    // Set public view permission on the uploaded file so ALL employees on ANY device can load it directly
    fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role: "reader",
        type: "anyone",
      }),
    }).catch((pErr) => console.warn("Notice setting swatch file public permissions:", pErr));

    // Direct embeddable Google Drive image URL (fast, permanent, and accessible globally)
    const directUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
    return directUrl;
  } catch (err) {
    console.warn("Upload to Google Drive failed, using base64 fallback:", err);
    return base64Data;
  }
}

/**
 * High-speed Parallel Batch Upload of Swatches to Google Drive
 */
export async function batchUploadSwatchesToDrive(
  items: { fileName: string; base64Data: string }[],
  concurrency: number = 8,
  onProgress?: (completed: number, total: number) => void
): Promise<string[]> {
  const token = getSavedDriveToken();
  if (!token || items.length === 0) {
    return items.map(i => i.base64Data);
  }

  let folderId = "";
  try {
    folderId = await getOrCreateSwatchFolder(token);
  } catch {
    return items.map(i => i.base64Data);
  }

  const results: string[] = new Array(items.length);
  let currentIndex = 0;
  let completedCount = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      const item = items[idx];
      try {
        const url = await uploadSwatchToDrive(item.fileName, item.base64Data, folderId);
        results[idx] = url;
      } catch {
        results[idx] = item.base64Data;
      }
      completedCount++;
      if (onProgress) {
        onProgress(completedCount, items.length);
      }
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * Backup entire Catalog & Database directly to Google Drive (Daily Backup)
 */
export async function backupDatabaseToDrive(payload: {
  settings?: any;
  jobs?: any[];
  windows?: any[];
  employees?: any[];
}): Promise<{ success: boolean; fileId?: string; error?: string }> {
  try {
    let token = getSavedDriveToken();
    if (!token) {
      token = await requestDriveAccessToken();
    }
    if (!token) {
      return { success: false, error: "ไม่ได้เข้าสู่ระบบ Google Drive" };
    }

    const folderId = await getOrCreateSwatchFolder(token);
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `Curtain_Studio_AutoBackup_${dateStr}.json`;

    const jsonString = JSON.stringify({
      backupDate: new Date().toISOString(),
      user: "naruecha.psy@gmail.com",
      version: "1.0",
      data: payload,
    }, null, 2);

    const blob = new Blob([jsonString], { type: "application/json" });
    const metadata = {
      name: fileName,
      mimeType: "application/json",
      parents: [folderId],
    };

    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    form.append("file", blob);

    const uploadRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      }
    );

    if (!uploadRes.ok) {
      throw new Error(`HTTP ${uploadRes.status}: ไม่สามารถอัปโหลดไฟล์สำรองข้อมูลได้`);
    }

    const resData = await uploadRes.json();
    localStorage.setItem("last_daily_gdrive_backup", new Date().toISOString());
    return { success: true, fileId: resData.id };
  } catch (err: any) {
    console.warn("Daily Google Drive backup error:", err);
    return { success: false, error: err?.message || String(err) };
  }
}

