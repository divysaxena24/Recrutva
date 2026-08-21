import { NextRequest, NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";
// Import from lib directly to bypass index.js debug mode that tries to load test files
import pdf from "pdf-parse/lib/pdf-parse.js";

// Disable default body parser — we handle FormData manually
export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx"];

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx >= 0 ? filename.slice(idx).toLowerCase() : "";
}

/**
 * Extract text from a PDF buffer using pdf-parse v1.1.1.
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  const data = await pdf(buffer);
  return data.text || "";
}

/**
 * Extract text from a DOCX buffer using mammoth.
 */
async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value || "";
}

/**
 * Upload a file buffer to Cloudinary as a raw resource.
 * Uses base64 data URI to avoid upload_stream issues with raw resources.
 */
async function uploadToCloudinary(
  buffer: Buffer,
  folder: string,
  filename: string
): Promise<{ secure_url: string; public_id: string }> {
  const ext = getExtension(filename).replace(".", "") || "bin";
  const mimeType = ext === "pdf" ? "application/pdf"
    : ext === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    : ext === "doc" ? "application/msword"
    : "application/octet-stream";

  const dataUri = `data:${mimeType};base64,${buffer.toString("base64")}`;
  const publicId = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  try{
    const result = await cloudinary.uploader.upload(dataUri, {
      folder,
      resource_type: "auto",
      public_id: publicId,
    });
    return { secure_url: result.secure_url, public_id: result.public_id };
  } catch (err: unknown) {
    const cloudErr = err as { message?: string; http_code?: number; name?: string };
    console.error("Cloudinary upload error:", {
      message: cloudErr.message,
      http_code: cloudErr.http_code,
      name: cloudErr.name,
      folder,
      resource_type: "auto",
      public_id: publicId,
      format: ext,
    });
    throw err;
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file extension
    const ext = getExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text based on file type
    let resumeText = "";
    try {
      if (ext === ".pdf") {
        resumeText = await extractPdfText(buffer);
      } else if (ext === ".docx") {
        resumeText = await extractDocxText(buffer);
      } else if (ext === ".doc") {
        // .doc files — we store the file but text extraction is limited
        resumeText = `[DOC file uploaded: ${file.name}. Text extraction for legacy .doc format is not supported. Please convert to PDF or DOCX.]`;
      }
    } catch (extractError) {
      console.error("Text extraction error:", extractError);
      resumeText = `[Text extraction failed for ${file.name}. The file was uploaded successfully.]`;
    }

    // Upload to Cloudinary
    const uploadResult = await uploadToCloudinary(buffer, "recrutva/resumes", file.name);

    return NextResponse.json({
      resumeUrl: uploadResult.secure_url,
      resumeFileName: file.name,
      resumePublicId: uploadResult.public_id,
      resumeText: resumeText.trim() || "",
    });
  } catch (error) {
    console.error("Resume upload error:", error);
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 }
    );
  }
}
