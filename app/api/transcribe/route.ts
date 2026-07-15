import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasUsedAnonymousTry } from "@/lib/entitlements";

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

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Public endpoint — no auth required (enables try-mode)
// Rate limiting is handled by middleware (5 req/min per IP)
export async function POST(req: NextRequest) {
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 25 MB)" }, { status: 413 });
  }

  // Anonymous farming guard — the cookie itself is burned by /api/analyze (the
  // perceived-value action that completes "one earned run"), not here.
  const session = await getServerSession(authOptions);
  if (!session?.user?.id && hasUsedAnonymousTry()) {
    return NextResponse.json(
      { error: "signin_required", message: "Sign in to keep going." },
      { status: 401 }
    );
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
    const file = new File([arrayBuffer], `recording.${ext}`, { type: mimeType });

    const transcription = await groq.audio.transcriptions.create({
      file,
      model: "whisper-large-v3-turbo",
      response_format: "json",
    });

    return NextResponse.json({ text: transcription.text });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[transcribe]", error);
    return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
  }
}
