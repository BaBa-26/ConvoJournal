"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import type { Attachment } from "@/types";
import AttachRow from "./AttachRow";

// Typed capture. Two first-class exits (design-system / new capability):
//   "save as-is"  → a plain entry, no parsing, no extraction
//   "make sense of it" → the analyse → review flow
// Also the recovery surface after an analysis failure (§7.3): the parent prefills
// the transcript and shows a banner — the user's words are never lost.

export default function WritingPhase({
  onAnalyze,
  onSavePlain,
  onCancel,
  getSuggestions,
  initialText = "",
  banner,
  savingPlain = false,
  attachments,
  onAttachmentsChange,
}: {
  onAnalyze: (text: string) => void;
  onSavePlain: (text: string) => void;
  onCancel: () => void;
  getSuggestions: (text: string, cursor: number) => string[];
  initialText?: string;
  /** Optional error/notice line rendered above the editor (analysis failure recovery). */
  banner?: string | null;
  savingPlain?: boolean;
  attachments: Attachment[];
  onAttachmentsChange: (next: Attachment[]) => void;
}) {
  const [text, setText] = useState(initialText);
  const [cursor, setCursor] = useState(initialText.length);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const suggestions = useMemo(
    () => (text.length >= 2 ? getSuggestions(text, cursor) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text, cursor]
  );

  const updateCursor = (e: React.SyntheticEvent<HTMLTextAreaElement>) =>
    setCursor((e.target as HTMLTextAreaElement).selectionStart ?? 0);

  const insertSuggestion = useCallback(
    (word: string) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const pos = cursor;
      const val = ta.value;
      let wordStart = pos;
      while (wordStart > 0 && !/\s/.test(val[wordStart - 1])) wordStart--;
      const newText = val.slice(0, wordStart) + word + " " + val.slice(pos);
      const newCursor = wordStart + word.length + 1;
      setText(newText);
      setCursor(newCursor);
      requestAnimationFrame(() => {
        ta.selectionStart = newCursor;
        ta.selectionEnd = newCursor;
        ta.focus();
      });
    },
    [cursor]
  );

  const hasText = Boolean(text.trim());

  return (
    <div className="flex flex-col flex-1 gap-4 animate-fade-in">
      <div className="text-center">
        <p className="text-label font-mono uppercase text-parchment-600">
          {format(new Date(), "EEEE, MMMM d")}
        </p>
        <p className="font-display italic text-voice-sm text-parchment-300 mt-2">
          how are you feeling today?
        </p>
      </div>

      {banner && (
        <div className="banner-error" role="alert">
          <span className="flex-1">{banner}</span>
        </div>
      )}

      {/* Suggestion strip */}
      <div className="min-h-[36px] flex items-center">
        {suggestions.length > 0 ? (
          <div data-no-swipe className="flex gap-2 overflow-x-auto w-full pb-0.5 scrollbar-none">
            {suggestions.map((s) => (
              <button
                key={s}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertSuggestion(s);
                }}
                className="chip"
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          <p className="font-mono text-label text-parchment-800 tracking-widest">
            suggestions appear as you type
          </p>
        )}
      </div>

      <div className="card flex-1 flex flex-col">
        <textarea
          ref={textareaRef}
          className="flex-1 w-full min-h-[180px] bg-transparent font-mono text-body-lg
                     text-parchment-300 placeholder-parchment-800 resize-none
                     focus:outline-none"
          placeholder={"just start writing…\n\nyesterday i finished…\ntoday i need to…\nfeeling pretty…"}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            updateCursor(e);
          }}
          onSelect={updateCursor}
          onClick={updateCursor}
          onKeyUp={updateCursor}
          autoFocus
        />
        <p aria-hidden className="text-right font-mono text-label text-parchment-800 mt-2">
          {text.length > 0 ? `${text.length} chars` : ""}
        </p>
      </div>

      {/* Attachments — photos and files ride along with the entry */}
      <AttachRow attachments={attachments} onChange={onAttachmentsChange} />

      {/* Clearance so the sticky action bar (floating 4.75rem up on mobile) can never
          overlap the attach row when the phase fits the viewport without scrolling. */}
      <div aria-hidden className="h-16 md:h-0 flex-shrink-0 -mt-2" />

      {/* Exits — plain save is first-class, analysis is the primary act */}
      <div className="action-bar items-center">
        <button onClick={onCancel} className="btn-quiet flex-shrink-0" aria-label="Back">
          ←
        </button>
        <button
          onClick={() => hasText && onSavePlain(text.trim())}
          disabled={!hasText || savingPlain}
          className="btn-ghost flex-1"
        >
          {savingPlain ? "Saving…" : "Save as-is"}
        </button>
        <button
          onClick={() => hasText && onAnalyze(text.trim())}
          disabled={!hasText}
          className="btn-primary flex-1"
        >
          Make sense of it
        </button>
      </div>
    </div>
  );
}
