import { NextRequest, NextResponse } from "next/server";
import * as googleTTS from "google-tts-api";

const MAX_TEXT_LENGTH = 1000;

export async function GET(req: NextRequest) {
  const text = req.nextUrl.searchParams.get("text");
  if (!text) return NextResponse.json({ error: "No text provided" }, { status: 400 });

  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters` },
      { status: 400 }
    );
  }

  return handleTts(text);
}

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Invalid text parameter" }, { status: 400 });
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters` },
        { status: 400 }
      );
    }

    return handleTts(text);
  } catch (error) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

async function handleTts(text: string) {
  try {
    const base64Audio = await googleTTS.getAudioBase64(text, {
      lang: "en",
      slow: false,
      host: "https://translate.google.com",
    });

    const audioBuffer = Buffer.from(base64Audio, "base64");

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.length.toString(),
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Google TTS Error:", error);
    return NextResponse.json({ error: "Failed to generate TTS" }, { status: 500 });
  }
}
