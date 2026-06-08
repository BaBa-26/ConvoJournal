"use client";

import { useState, useRef, useCallback } from "react";
import { Mic, Square, Loader2 } from "lucide-react";

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
}

type RecordingState = "idle" | "recording" | "transcribing";

export default function VoiceRecorder({ onTranscription, disabled }: VoiceRecorderProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const getSupportedMimeType = () => {
    const types = [
      "audio/mp4",
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
    ];
    return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
  };

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, {
          type: mimeType || "audio/webm",
        });
        await transcribe(blob, mimeType || "audio/webm");
      };

      recorder.start(250);
      setState("recording");
    } catch (err) {
      setError("Microphone access denied. Please allow microphone access.");
      setState("idle");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === "recording") {
      setState("transcribing");
      mediaRecorderRef.current.stop();
    }
  }, [state]);

  const transcribe = async (blob: Blob, mimeType: string) => {
    try {
      const formData = new FormData();
      formData.append("audio", blob, `recording.${mimeType.split("/")[1].split(";")[0]}`);

      const res = await fetch("/api/transcribe", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Transcription failed");

      const { text } = await res.json();
      if (text) onTranscription(text);
    } catch {
      setError("Transcription failed. Please try again.");
    } finally {
      setState("idle");
    }
  };

  const handlePress = () => {
    if (disabled) return;
    if (state === "idle") startRecording();
    else if (state === "recording") stopRecording();
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handlePress}
        disabled={disabled || state === "transcribing"}
        className={`
          w-16 h-16 rounded-full flex items-center justify-center
          shadow-lg transition-all duration-200 active:scale-95
          ${state === "recording"
            ? "bg-red-500 animate-pulse shadow-red-200"
            : state === "transcribing"
            ? "bg-stone-300 cursor-not-allowed"
            : "bg-journal-500 hover:bg-journal-600 shadow-journal-200"
          }
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
        aria-label={state === "recording" ? "Stop recording" : "Start recording"}
      >
        {state === "transcribing" ? (
          <Loader2 className="w-7 h-7 text-stone-500 animate-spin" />
        ) : state === "recording" ? (
          <Square className="w-6 h-6 text-white fill-white" />
        ) : (
          <Mic className="w-7 h-7 text-white" />
        )}
      </button>
      <span className="text-xs text-stone-500">
        {state === "recording"
          ? "Tap to stop"
          : state === "transcribing"
          ? "Transcribing..."
          : "Tap to speak"}
      </span>
      {error && (
        <p className="text-xs text-red-500 text-center max-w-[200px]">{error}</p>
      )}
    </div>
  );
}
