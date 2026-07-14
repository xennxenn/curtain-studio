import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for base64 image transfers
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Shared lazy initializer for Gemini Client
  let aiClient: GoogleGenAI | null = null;
  function getGeminiClient(customApiKey?: string) {
    if (customApiKey && customApiKey.trim().length > 10) {
      return new GoogleGenAI({
        apiKey: customApiKey.trim(),
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
    if (!aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not configured in environment secrets.");
      }
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
    return aiClient;
  }

  // API endpoints
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // AI Curtain preview generator
  app.post("/api/gemini/preview-curtain", async (req: express.Request, res: express.Response) => {
    try {
      const { 
        roomImage, 
        fabricImage, 
        sheerImage,
        style, 
        pattern, 
        color, 
        track, 
        accessories, 
        notes,
        isDoubleLayer,
        layer1Style,
        layer2Style,
        solidFabricType,
        sheerFabricType,
        isBlind,
        isRoller,
        solidFabricName,
        sheerFabricName,
        customGeminiApiKey
      } = req.body;

      if (!roomImage) {
        return res.status(400).json({ success: false, message: "กรุณาอัปโหลดรูปภาพห้องก่อน" });
      }

      // Lazy check and initialize Gemini Client
      let ai;
      try {
        ai = getGeminiClient(customGeminiApiKey);
      } catch (authError: any) {
        return res.status(500).json({
          success: false,
          message: "ไม่พบ API Key สำหรับใช้บริการ AI กรุณากำหนดค่าในแถบ Settings > Secrets ในเมนูหลัก",
        });
      }

      // Parse room image base64 data
      const roomMatches = roomImage.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!roomMatches) {
        return res.status(400).json({ success: false, message: "ฟอร์แมตรูปภาพห้องไม่ถูกต้อง" });
      }
      const roomMime = roomMatches[1];
      const roomData = roomMatches[2];

      // Prepare Prompt based on product category
      let promptText = "";

      if (isBlind) {
        promptText = `Please overlay realistic, professionally styled blinds (horizontal slats, wood or faux-wood blinds) onto the window(s) of this room.
Maintain the exact structure of the room, including the walls, flooring, ceiling, furniture, window frame outlines, lighting sources, shadows, and overall perspective.
Do not modify or alter any of these surrounding elements. Only overlay or replace the window glass areas or pre-existing curtains with the new blinds setup.

Blinds Details:
- Category: Venetian Blinds / Wood Blinds / มู่ลี่
- Slat Material & Color: ${solidFabricName || "Wood or Faux-Wood slats"}
- Slat Style: ${style || "Horizontal Slats"}
- Cotton Decorative Tape (เทปผ้า): ${sheerFabricName ? `Elegant vertical cloth tape bands colored: ${sheerFabricName}` : "No decorative tape (standard ladder strings)"}
- Notes/Instructions: ${notes || "None"}

CRITICAL AI INSTRUCTION FOR BLINDS (มู่ลี่):
1. Render realistic horizontal slats fitted perfectly inside or covering the window frames.
2. The blinds should be fully closed (or tilted to let some daylight filter between slats naturally).
3. If cotton decorative tape is specified, render clean, straight vertical fabric bands of the designated color/hue spacing evenly across the slats from top to bottom.
4. Ensure materials have accurate textures (e.g., real wood grain or smooth matte finishes).`;
      } else if (isRoller) {
        promptText = `Please overlay realistic, professionally styled roller shades (ม่านม้วน) onto the window(s) of this room.
Maintain the exact structure of the room, including the walls, flooring, ceiling, furniture, window frame outlines, lighting sources, shadows, and overall perspective.
Do not modify or alter any of these surrounding elements. Only overlay or replace the window glass areas or pre-existing curtains with the new roller shade setup.

Roller Shade Details:
- Category: Roller Shades / ม่านม้วน
- Roller Fabric & Color: ${solidFabricName || "Matte solid fabric"}
- Fabric Density: ${solidFabricType || "Dimout / Blackout"}
- Notes/Instructions: ${notes || "None"}

CRITICAL AI INSTRUCTION FOR ROLLER SHADES (ม่านม้วน):
1. Render a clean, perfectly smooth, tensioned flat sheet of fabric suspended from a compact roller tube at the top of the window frames.
2. The roller shade should cover the window pane neatly, ending with a straight bottom hem bar.
3. Keep the appearance minimalist, modern, and perfectly clean with zero organic hanging folds or drapes.`;
      } else {
        promptText = `Please overlay realistic, professionally styled curtains onto the window(s) of this room.
Maintain the exact structure of the room, including the walls, flooring, ceiling, furniture, window frame outlines, lighting sources, shadows, and overall perspective.
Do not modify or alter any of these surrounding elements. Only overlay or replace the window glass areas or pre-existing curtains with the new curtain setup.

Curtain Details:
- Style/Type: ${style || "Standard Pleated Curtains"}
- Material color or hue: ${color || "Matching the room tone"}
- Pattern/Fabric style: ${pattern || "Solid matching color"}
- Solid Fabric Specification: ${solidFabricName || "Not specified"}
- Sheer Fabric Specification: ${sheerFabricName || "Not specified"}
- Hanging Track/Rod setup: ${track || "Hidden track or standard rod"}
- Accessories: ${accessories || "None"}
- Additional instructions: ${notes || "None"}`;

        if (isDoubleLayer) {
          promptText += `
- Layers Configuration: Double Layer setup (2-layered curtains).
- Inner Layer (Sheer): ${sheerFabricName || "Sheer curtain"} (Fabric Type: ${sheerFabricType || "Sheer"}).
- Outer Layer (Solid): ${solidFabricName || "Solid curtain"} (Fabric Type: ${solidFabricType || "Blackout"}).

CRITICAL AI INSTRUCTION FOR 2-LAYER CONFIGURATION:
Because this is a 2-layered curtain setup, you MUST follow these placement rules:
1. The sheer curtain (inner layer) must be completely CLOSED (drawn fully across the window pane), allowing light to pass softly through.
2. The solid/opaque curtain (outer layer) must be draped or gathered according to the user's specified usage:
   - If the solid curtain style/notes indicate Left Gather ("รวบซ้าย"), drape and stack the solid curtain tightly to the LEFT side of the window.
   - If the solid curtain style/notes indicate Right Gather ("รวบขวา"), drape and stack the solid curtain tightly to the RIGHT side of the window.
   - If the solid curtain style/notes indicate Center Split ("แยกกลาง"), split the solid curtain and stack the panels neatly on BOTH the left and right sides of the window.
   This arrangement must beautifully expose the closed sheer curtain layer in the uncovered portions of the window. Let light simulate accurately through the sheer curtain based on its fabric type (e.g., Blackout, Dimout, Sheer).`;
        } else {
          promptText += `\n- Layers Configuration: Single Layer setup (Solid curtain only: ${solidFabricName || "Solid fabric"}).`;
        }

        promptText += `\n\nEnsure the curtain folds look organic and hang naturally from the track/rod. The rendering must look like a high-end, realistic interior design mockup matching the specified fabric colors, patterns, styles, and names exactly.`;
      }

      const contentsParts: any[] = [
        {
          inlineData: {
            mimeType: roomMime,
            data: roomData,
          },
        }
      ];

      // Optional fabric pattern image
      if (fabricImage) {
        const fabricMatches = fabricImage.match(/^data:(image\/\w+);base64,(.+)$/);
        if (fabricMatches) {
          const fabricMime = fabricMatches[1];
          const fabricData = fabricMatches[2];
          contentsParts.push({
            inlineData: {
              mimeType: fabricMime,
              data: fabricData,
            },
          });
          promptText += `\n\nCRITICAL REQUIREMENT: Use the fabric swatch image (solid fabric sample) as reference for the solid curtain's color, pattern, texture, and style.`;
        }
      }

      // Optional sheer pattern image
      if (sheerImage) {
        const sheerMatches = sheerImage.match(/^data:(image\/\w+);base64,(.+)$/);
        if (sheerMatches) {
          const sheerMime = sheerMatches[1];
          const sheerData = sheerMatches[2];
          contentsParts.push({
            inlineData: {
              mimeType: sheerMime,
              data: sheerData,
            },
          });
          promptText += `\n\nCRITICAL REQUIREMENT: Use the sheer fabric swatch image as reference for the inner sheer curtain's color, translucency, texture, and lace pattern.`;
        }
      }

      // Add the prompt text part at the end
      contentsParts.push({ text: promptText });

      console.log("Calling Gemini API with style:", style, "color:", color, "pattern:", pattern, "double layer:", isDoubleLayer);

      // Call the AI model for image editing tasks (gemini-3.1-flash-lite-image)
      const apiResponse = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-image",
        contents: { parts: contentsParts },
      });

      // Find the image part in candidates
      let base64Result: string | null = null;
      let mimeTypeResult: string = "image/png";

      const candidate = apiResponse.candidates?.[0];
      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData) {
            base64Result = part.inlineData.data;
            mimeTypeResult = part.inlineData.mimeType || "image/png";
            break;
          }
        }
      }

      if (!base64Result) {
        console.error("Gemini API did not return any image data.", JSON.stringify(apiResponse));
        return res.status(500).json({
          success: false,
          message: "ระบบ AI ไม่ได้ส่งรูปภาพจำลองกลับมา กรุณาลองอัปเดตรายละเอียดและลองอีกครั้ง",
        });
      }

      let descriptionText = `ภาพจำลองการติดตั้งผ้าม่านแบบ ${style} สี ${color} สร้างโดยระบบ AI อัจฉริยะ`;
      if (isBlind) {
        descriptionText = `ภาพจำลองการติดตั้งมู่ลี่แบบ ${style} สี/สเปก ${solidFabricName} ${sheerFabricName ? `พร้อมเทปผ้าตกแต่งสี ${sheerFabricName}` : ""} สร้างโดยระบบ AI อัจฉริยะ`;
      } else if (isRoller) {
        descriptionText = `ภาพจำลองการติดตั้งม่านม้วนแบบ ${style} สี/สเปก ${solidFabricName} สร้างโดยระบบ AI อัจฉริยะ`;
      }

      res.json({
        success: true,
        imageUrl: `data:${mimeTypeResult};base64,${base64Result}`,
        description: descriptionText
      });

    } catch (error: any) {
      console.error("Error calling Gemini API:", error);
      const errMsg = error.message || String(error);
      let friendlyMsg = "เกิดข้อผิดพลาดจากระบบประมวลผลรูปภาพ AI: " + errMsg;
      
      if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("Quota")) {
        friendlyMsg = "ระบบแจ้งเตือน: คุณใช้งานโควต้าโมเดลประมวลผลรูปภาพ AI ฟรีเกินกำหนดแล้ว (429 Quota Exceeded) กรุณาเข้าไปที่เมนู Settings หรือติดต่อผู้ดูแลระบบเพื่อเปิดใช้แผนบริการชำระเงิน (Paid Model Flow) หรือลองจำลองรูปภาพใหม่อีกครั้งในภายหลัง";
      }
      
      res.status(500).json({
        success: false,
        message: friendlyMsg,
      });
    }
  });

  // Serve static assets / Vite setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
  });
}

startServer();
