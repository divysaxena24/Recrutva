import { NextRequest, NextResponse } from "next/server";

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

async function handleTts(text: string, voiceId: string = "en-US-natalie") {
  try {
    const response = await fetch("https://global.api.murf.ai/v1/speech/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.NEXT_MURF_API || "",
      },
      body: JSON.stringify({
        voiceId,
        text,
        model: "FALCON",
        sampleRate: 24000,
        format: "MP3",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Murf API Error:", errorText);
      return NextResponse.json({ error: "Failed to stream TTS" }, { status: response.status });
    }

    // Proxy the stream back to the client
    return new NextResponse(response.body, {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (error) {
    console.error("TTS Stream Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
