import { NextRequest, NextResponse } from "next/server";
// Import from lib directly to bypass index.js debug mode that tries to load test files
import pdf from "pdf-parse/lib/pdf-parse.js";
import { rateLimitOrReject } from "@/lib/rate-limit";

// Disable default body parser — we handle FormData manually
export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx", ".txt"];

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

export async function POST(req: NextRequest) {
  try {
    // Rate limit — this endpoint is reachable by unauthenticated applicants
    const blocked = await rateLimitOrReject(
      req,
      { endpoint: "resume-upload", limit: 20, windowSeconds: 600 },
      null,
    );
    if (blocked) return blocked;

    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (contentLength > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 413 }
      );
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        { error: "Expected multipart/form-data body" },
        { status: 400 }
      );
    }

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

    // Reject empty files
    if (file.size === 0) {
      return NextResponse.json(
        { error: "File is empty" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 413 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text in-memory based on file type (no external storage)
    let resumeText = "";
    try {
      if (ext === ".pdf") {
        resumeText = await extractPdfText(buffer);
      } else if (ext === ".docx") {
        resumeText = await extractDocxText(buffer);
      } else if (ext === ".txt") {
        resumeText = buffer.toString("utf-8");
      } else if (ext === ".doc") {
        resumeText = `[DOC file uploaded: ${file.name}. Text extraction for legacy .doc format is not supported. Please convert to PDF or DOCX.]`;
      }
    } catch (extractError) {
      console.error("Text extraction error:", extractError);
      return NextResponse.json(
        { error: "Failed to parse text from resume file. Please ensure it is a valid PDF or DOCX." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      resumeUrl: null,
      resumeFileName: file.name,
      resumePublicId: null,
      resumeText: resumeText.trim() || "",
    });
  } catch (error) {
    console.error("Resume upload/parsing error:", error);
    return NextResponse.json(
      { error: "Resume parsing failed. Please try again." },
      { status: 500 }
    );
  }
}

