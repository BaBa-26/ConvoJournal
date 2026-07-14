"use client";

import { useEffect, useRef, useState } from "react";
import type { Attachment } from "@/types";
import AttachmentTile from "@/components/ui/AttachmentTile";
import { fileToAttachment, AttachmentError, MAX_ATTACHMENTS } from "@/lib/attachments";

// The attach affordance + tile strip for capture and review surfaces.
// Web: one button → file input (images + documents). Native: the SAME button opens
// the camera/library system sheet — this component only ever receives Files, so the
// picker source is invisible to it (design-system §6.11).

interface PendingItem {
  localId: string;
  name: string;
  status: "uploading" | "failed";
  file: File;
}

export default function AttachRow({
  attachments,
  onChange,
}: {
  attachments: Attachment[];
  onChange: (next: Attachment[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  // Live view of the committed list — multiple files finish processing across
  // renders, and each completion must append to the LATEST list, not the one the
  // handler closed over (otherwise concurrent picks overwrite each other).
  const attachmentsRef = useRef(attachments);
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  const total = attachments.length + pending.length;

  const process = async (item: PendingItem) => {
    try {
      const att = await fileToAttachment(item.file);
      setPending((p) => p.filter((x) => x.localId !== item.localId));
      const next = [...attachmentsRef.current, att];
      attachmentsRef.current = next; // keep the ref current within a multi-file batch
      onChange(next);
    } catch (e) {
      if (e instanceof AttachmentError) setNotice(e.message);
      setPending((p) =>
        p.map((x) => (x.localId === item.localId ? { ...x, status: "failed" as const } : x))
      );
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setNotice(null);
    const room = MAX_ATTACHMENTS - total;
    if (room <= 0) {
      setNotice(`up to ${MAX_ATTACHMENTS} attachments per entry for now`);
      return;
    }
    const picked = Array.from(files).slice(0, room);
    if (picked.length < files.length) {
      setNotice(`up to ${MAX_ATTACHMENTS} attachments per entry for now`);
    }
    const items: PendingItem[] = picked.map((file) => ({
      localId: `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: file.name,
      status: "uploading",
      file,
    }));
    setPending((p) => [...p, ...items]);
    for (const item of items) await process(item); // sequential — no completion races
  };

  const retry = (item: PendingItem) => {
    setPending((p) =>
      p.map((x) => (x.localId === item.localId ? { ...x, status: "uploading" as const } : x))
    );
    process(item);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Attach button — paperclip, 44px */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="icon-btn"
          aria-label="Attach a photo or file"
          disabled={total >= MAX_ATTACHMENTS}
        >
          <svg
            aria-hidden
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.pdf,.txt,.md,.doc,.docx"
          multiple
          hidden
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = ""; // allow re-picking the same file
          }}
        />

        {/* Tiles */}
        {attachments.map((att) => (
          <AttachmentTile
            key={att.id}
            attachment={att}
            status="done"
            onRemove={() => onChange(attachments.filter((a) => a.id !== att.id))}
          />
        ))}
        {pending.map((item) => (
          <AttachmentTile
            key={item.localId}
            status={item.status}
            name={item.name}
            onRetry={() => retry(item)}
            onRemove={
              item.status === "failed"
                ? () => setPending((p) => p.filter((x) => x.localId !== item.localId))
                : undefined
            }
          />
        ))}
      </div>
      {notice && <p className="field-hint">{notice}</p>}
    </div>
  );
}
