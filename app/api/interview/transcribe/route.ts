import { NextRequest, NextResponse } from "next/server";
import { groq, AI_MODELS } from "@/lib/ai";
import { rateLimitOrReject } from "@/lib/rate-limit";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB (Groq Whisper limit)
const ALLOWED_MIME_TYPES = [
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/mp3",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/flac",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
];

export async function POST(req: NextRequest) {
  try {
    // Reject oversized bodies up front (Content-Length) with a clean 413.
    // req.formData() itself fails to parse bodies at/above ~10MB in the Next
    // node runtime, so we must reject before parsing to return 413, not 400.
    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (contentLength > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `Audio file too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
        },
        { status: 413 }
      );
    }

    // Reject non-multipart requests with a clean 400 instead of crashing
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        { success: false, error: "Expected multipart/form-data body" },
        { status: 400 }
      );
    }

    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { success: false, error: "No audio file provided" },
        { status: 400 }
      );
    }

    // Validate file size
    if (audioFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `Audio file too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
        },
        { status: 413 }
      );
    }

    // Validate file is not empty
    if (audioFile.size === 0) {
      return NextResponse.json({ success: false, error: "Audio file is empty" }, { status: 400 });
    }

    // Validate MIME type
    const fileExtension = audioFile.name.split(".").pop()?.toLowerCase();
    const isValidMime = ALLOWED_MIME_TYPES.some(
      (type) => audioFile.type === type || audioFile.type.startsWith("audio/")
    );
    const isValidExtension = ["webm", "mp3", "mp4", "mpeg", "wav", "ogg", "flac", "m4a"].includes(
      fileExtension || ""
    );

    if (!isValidMime && !isValidExtension) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported audio format: ${audioFile.type || fileExtension}. Use webm, mp3, wav, ogg, or flac.`,
        },
        { status: 400 }
      );
    }

    // Rate limit — BEFORE the expensive Groq Whisper call
    // Transcription is high-volume (every speech segment), so we allow more requests
    const blocked = await rateLimitOrReject(
      req,
      { endpoint: "interview-transcribe", limit: 30, windowSeconds: 600 },
      null, // No user ID — transcript is called during candidate interview
    );
    if (blocked) return blocked;

    // Convert File to a Buffer for the Groq SDK
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create a File-like object that Groq SDK accepts
    const file = new File([buffer], audioFile.name || "recording.webm", {
      type: audioFile.type || "audio/webm",
    });

    // Transcribe using Groq Whisper
    const transcription = await groq.audio.transcriptions.create({
      model: AI_MODELS.stt,
      file: file,
      language: "en",
      response_format: "json",
    });

    const text = transcription.text?.trim() || "";

    if (!text) {
      return NextResponse.json({
        success: true,
        text: "",
        message: "No speech detected in the audio",
      });
    }

    return NextResponse.json({
      success: true,
      text: text,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Whisper STT Error:", {
      feature: "interview-transcription",
      model: AI_MODELS.stt,
      error: message,
    });
    return NextResponse.json(
      { success: false, error: "Failed to transcribe audio. Please try again." },
      { status: 500 }
    );
  }
}
