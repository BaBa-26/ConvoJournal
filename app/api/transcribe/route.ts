import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { toFile } from "openai";

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

// Public endpoint — no auth required (enables try-mode)
// Rate limiting is handled by middleware (5 req/min per IP)
export async function POST(req: NextRequest) {
  // Check Content-Length before parsing the entire body
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

    // Enforce size after parsing (catches missing Content-Length header)
    if (audioBlob.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 25 MB)" }, { status: 413 });
    }

    // Strict MIME type allowlist — reject unknown types (no silent fallback)
    const mimeType = audioBlob.type?.toLowerCase() ?? "";
    const ext = ALLOWED_MIME[mimeType];
    if (!ext) {
      return NextResponse.json(
        { error: `Unsupported audio format: ${mimeType || "unknown"}` },
        { status: 415 }
      );
    }

    const arrayBuffer = await audioBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const file = await toFile(buffer, `recording.${ext}`, { type: mimeType });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      response_format: "text",
    });

    return NextResponse.json({ text: transcription });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[transcribe]", error);
    return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
  }
}
