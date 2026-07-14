"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type RecorderState = "idle" | "recording" | "transcribing";

interface UseRecorderReturn {
  state: RecorderState;
  elapsed: number;           // seconds
  transcript: string;
  error: string | null;
  startRecording: () => Promise<boolean>; // resolves false when the mic couldn't start
  stopRecording: () => void;
  /** Abandon the take: stops the mic and discards audio without transcribing. */
  cancelRecording: () => void;
  reset: () => void;
  /** Live input level 0…1, written every animation frame while recording (no re-renders —
      consumers like Waveform/RecordButton read it in their own rAF loop). */
  levelRef: React.MutableRefObject<number>;
}

function getSupportedMimeType(): string {
  const types = [
    "audio/mp4",
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ];
  return types.find((t) => {
    try { return MediaRecorder.isTypeSupported(t); }
    catch { return false; }
  }) ?? "";
}

export function useRecorder(): UseRecorderReturn {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live input level (design-system §6.6): an AnalyserNode reads the stream and writes
  // RMS into a ref every frame. Native port swaps this for AVAudioRecorder/AudioRecord
  // peaks — the consumer contract is just `level: 0…1`.
  const levelRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const levelRafRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  const stopLevelMeter = useCallback(() => {
    if (levelRafRef.current !== null) cancelAnimationFrame(levelRafRef.current);
    levelRafRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    levelRef.current = 0;
  }, []);

  const startLevelMeter = useCallback((stream: MediaStream) => {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        // RMS with a little gain so normal speech reads mid-range; smoothed for calm.
        const rms = Math.min(1, Math.sqrt(sum / buf.length) * 3.2);
        levelRef.current = levelRef.current * 0.7 + rms * 0.3;
        levelRafRef.current = requestAnimationFrame(tick);
      };
      levelRafRef.current = requestAnimationFrame(tick);
    } catch {
      // Level metering is progressive enhancement — recording works without it.
    }
  }, []);

  // Clean up timer + meter on unmount
  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopLevelMeter();
    },
    [stopLevelMeter]
  );

  const startRecording = useCallback(async (): Promise<boolean> => {
    setError(null);
    setTranscript("");
    setElapsed(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });

      chunksRef.current = [];
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        stopLevelMeter();

        // Cancelled take — drop the audio, no transcription.
        if (cancelledRef.current) {
          cancelledRef.current = false;
          chunksRef.current = [];
          setState("idle");
          return;
        }

        setState("transcribing");

        try {
          const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
          const ext = (mimeType || "audio/webm").split("/")[1].split(";")[0];
          const formData = new FormData();
          formData.append("audio", blob, `recording.${ext}`);

          const res = await fetch("/api/transcribe", { method: "POST", body: formData });
          if (!res.ok) throw new Error("Transcription failed");
          const { text } = await res.json();
          setTranscript(text ?? "");
        } catch {
          setError("Could not transcribe audio. Please try again.");
          setTranscript("");
        } finally {
          setState("idle");
        }
      };

      recorder.start(250);
      startLevelMeter(stream);
      setState("recording");

      // Elapsed timer
      timerRef.current = setInterval(() => {
        setElapsed((s) => s + 1);
      }, 1000);
      return true;
    } catch {
      setError("Microphone access denied. Please allow microphone access and try again.");
      setState("idle");
      return false;
    }
  }, [startLevelMeter, stopLevelMeter]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === "recording") {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [state]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === "recording") {
      cancelledRef.current = true;
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [state]);

  const reset = useCallback(() => {
    setTranscript("");
    setError(null);
    setElapsed(0);
    setState("idle");
  }, []);

  return { state, elapsed, transcript, error, startRecording, stopRecording, cancelRecording, reset, levelRef };
}
