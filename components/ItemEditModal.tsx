"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import type { Task, Reminder } from "@/types";
import Modal from "@/components/Modal";

// Priority colours — shared with the schedule/task rows.
export const PRIORITY_COLORS: Record<string, string> = {
  high:   "#c87a6a",
  medium: "#c8a860",
  low:    "#7a9a7a",
};

// The shape the modal hands back on save. `date`/`time` are form strings; the caller
// composes them into the appropriate ISO date for a task (due date) or reminder (event date).
export interface NewItem {
  type: "task" | "reminder";
  title: string;
  date: string;
  time: string;
  priority: string;
  description: string;
}

// A bottom-sheet form used to create *and* edit tasks/reminders. In edit mode the
// type toggle is locked (a task and a reminder live in different tables). `lockType`
// pins the toggle when the host screen only deals in one kind (e.g. the Tasks screen).
export default function ItemEditModal({
  defaultDate, editItem, lockType, onSave, onClose,
}: {
  defaultDate: Date;
  editItem?: { kind: "task" | "reminder"; data: Task | Reminder } | null;
  lockType?: "task" | "reminder";
  onSave: (item: NewItem, editId?: string) => Promise<void>;
  onClose: () => void;
}) {
  const isEdit = !!editItem;
  const typeLocked = isEdit || !!lockType;

  // Derive initial values from the item being edited (if any).
  const initial = (() => {
    if (!editItem) return null;
    if (editItem.kind === "task") {
      const t = editItem.data as Task;
      return {
        type: "task" as const,
        title: t.title,
        // Leave the date blank for undated tasks so editing doesn't silently stamp one on.
        date: t.dueDate ? format(parseISO(t.dueDate), "yyyy-MM-dd") : "",
        time: "09:00",
        priority: t.priority,
        description: t.description ?? "",
      };
    }
    const r = editItem.data as Reminder;
    return {
      type: "reminder" as const,
      title: r.title,
      date: format(parseISO(r.eventDate), "yyyy-MM-dd"),
      time: format(parseISO(r.eventDate), "HH:mm"),
      priority: "medium",
      description: r.description ?? "",
    };
  })();

  const [type,        setType]        = useState<"task" | "reminder">(initial?.type ?? lockType ?? "task");
  const [title,       setTitle]       = useState(initial?.title ?? "");
  const [date,        setDate]        = useState(initial?.date ?? format(defaultDate, "yyyy-MM-dd"));
  const [time,        setTime]        = useState(initial?.time ?? "09:00");
  const [priority,    setPriority]    = useState(initial?.priority ?? "medium");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [saving,      setSaving]      = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    // A reminder must be pinned to a moment; a task's due date is optional.
    if (type === "reminder" && !date) return;
    setSaving(true);
    try {
      await onSave(
        { type, title: title.trim(), date, time, priority, description: description.trim() },
        editItem?.data.id,
      );
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} align="sheet">
      <div className="relative w-full max-w-[430px] bg-ink-900 border-t border-ink-700
                      rounded-t-2xl p-5 space-y-4 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-parchment-600">
            {isEdit ? "Edit " + type : format(new Date((date || format(defaultDate, "yyyy-MM-dd")) + "T12:00:00"), "EEEE, MMM d")}
          </p>
          <button
            onClick={onClose}
            className="text-parchment-700 hover:text-parchment-500 font-mono text-sm
                       w-7 h-7 flex items-center justify-center focus:outline-none"
          >
            ✕
          </button>
        </div>

        {/* Type toggle — locked when editing or when the host screen pins the type */}
        <div className="flex gap-2">
          {(["task", "reminder"] as const).map((t) => (
            <button
              key={t}
              onClick={() => !typeLocked && setType(t)}
              disabled={typeLocked && type !== t}
              className={`flex-1 py-2 rounded-lg font-mono text-[11px] uppercase tracking-wider
                          border transition-all focus:outline-none
                          ${typeLocked ? "cursor-default" : ""}
                          ${type === t
                            ? "bg-gold/10 border-gold/40 text-parchment-200"
                            : `border-ink-700 text-parchment-700 ${typeLocked ? "opacity-30" : "hover:border-ink-600"}`}`}
            >
              {t === "task" ? "◈ task" : "◎ reminder"}
            </button>
          ))}
        </div>

        {/* Title */}
        <input
          type="text"
          placeholder={type === "task" ? "What needs doing?" : "What to remember?"}
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="input w-full"
          autoFocus
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
        />

        {/* Date + Time */}
        <div className="flex gap-2">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="input flex-1"
          />
          {type === "reminder" && (
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="input w-28"
            />
          )}
        </div>
        {type === "task" && (
          <p className="font-mono text-[9px] text-parchment-800 -mt-2 tracking-wide">
            leave the date blank for an anytime task
          </p>
        )}

        {/* Priority — tasks only */}
        {type === "task" && (
          <div className="flex gap-2">
            {(["high", "medium", "low"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`flex-1 py-1.5 rounded-lg font-mono text-[10px] uppercase tracking-wider
                            border transition-all focus:outline-none`}
                style={priority === p
                  ? { borderColor: PRIORITY_COLORS[p] + "80", color: PRIORITY_COLORS[p], background: PRIORITY_COLORS[p] + "12" }
                  : { borderColor: "#302d29", color: "#6a5a4a" }}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Notes */}
        <textarea
          placeholder="Notes (optional)"
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={2}
          className="textarea w-full"
        />

        <button
          onClick={handleSubmit}
          disabled={!title.trim() || (type === "reminder" && !date) || saving}
          className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : isEdit ? "Save changes" : `Add ${type}`}
        </button>
      </div>
    </Modal>
  );
}
