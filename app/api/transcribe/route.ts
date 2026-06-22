import { NextRequest, NextResponse } from "next/server";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

const ALLOWED_MIME: Record<string, string> = {
  "audio/mp4":  "mp4",
  "audio/mpeg": "mp3",
  "audio/ogg":  "ogg",
  "audio/wav":  "wav",
  "audio/m4a":  "m4a",
  "audio/webm": "webm",
  "audio/webm;codecs=opus": "webm",
};

const WHISPER_SERVICE_URL = process.env.WHISPER_SERVICE_URL ?? "http://localhost:8000";

// Public endpoint — no auth required (enables try-mode)
// Rate limiting is handled by middleware (5 req/min per IP)
export async function POST(req: NextRequest) {
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 25 MB)" }, { status: 413 });
  }

  try {
    const formData = await req.formData();
    const audioBlob = formData.get("audio") as File | null;

    if (!audioBlob) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    if (audioBlob.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 25 MB)" }, { status: 413 });
    }

    const mimeType = audioBlob.type?.toLowerCase() ?? "";
    const ext = ALLOWED_MIME[mimeType];
    if (!ext) {
      return NextResponse.json(
        { error: `Unsupported audio format: ${mimeType || "unknown"}` },
        { status: 415 }
      );
    }

    const arrayBuffer = await audioBlob.arrayBuffer();
    const outForm = new FormData();
    outForm.append(
      "audio",
      new Blob([arrayBuffer], { type: mimeType }),
      `recording.${ext}`
    );

    const upstream = await fetch(`${WHISPER_SERVICE_URL}/transcribe`, {
      method: "POST",
      body: outForm,
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "unknown error");
      if (process.env.NODE_ENV !== "production") {
        console.error("[transcribe] whisper-service error:", upstream.status, detail);
      }
      return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
    }

    const { text } = await upstream.json();
    return NextResponse.json({ text });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[transcribe]", error);
    return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
  }
}
