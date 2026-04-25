import { NextRequest, NextResponse } from "next/server";
import * as googleTTS from "google-tts-api";

export async function GET(req: NextRequest) {
  const text = req.nextUrl.searchParams.get("text");
  if (!text) return NextResponse.json({ error: "No text provided" }, { status: 400 });
  return handleTts(text);
}

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    return handleTts(text);
  } catch (error) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

async function handleTts(text: string) {
  try {
    // 1. Get the base64 audio string from Google TTS
    const base64Audio = await googleTTS.getAudioBase64(text, {
      lang: "en",
      slow: false,
      host: "https://translate.google.com",
    });

    // 2. Convert base64 string to a binary Buffer
    const audioBuffer = Buffer.from(base64Audio, "base64");

    // 3. Return as standard MP3 audio stream
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
