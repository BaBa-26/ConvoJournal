"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import type { Task, Reminder, Goal, GoalPeriod } from "@/types";
import Modal from "@/components/Modal";

// Priority colours — shared with the schedule/task rows.
export const PRIORITY_COLORS: Record<string, string> = {
  high:   "#c87a6a",
  medium: "#c8a860",
  low:    "#7a9a7a",
};

export type ItemKind = "task" | "reminder" | "goal";

// The shape the modal hands back on save. `date`/`time` are form strings; the caller
// composes them into the appropriate ISO date for a task (due date) or reminder (event
// date). Goal fields (unit/target/period/step) are only meaningful when type === "goal".
export interface NewItem {
  type: ItemKind;
  title: string;
  date: string;
  time: string;
  priority: string;
  description: string;
  unit: string;
  target: number;
  period: GoalPeriod;
  step: number;
}

// A bottom-sheet form used to create *and* edit tasks/reminders/goals. In edit mode the
// type toggle is UNLOCKED, so an item can be converted between the three kinds — the host
// re-homes the row (create in the target table, delete the source). `lockType` still pins
// the toggle when *creating* from a screen that only deals in one kind.
export default function ItemEditModal({
  defaultDate, editItem, lockType, onSave, onClose,
}: {
  defaultDate: Date;
  editItem?: { kind: ItemKind; data: Task | Reminder | Goal } | null;
  lockType?: ItemKind;
  onSave: (item: NewItem, editId?: string) => Promise<void>;
  onClose: () => void;
}) {
  const isEdit = !!editItem;
  // Lock the toggle only when creating with a pinned type; editing always allows conversion.
  const typeLocked = !isEdit && !!lockType;

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
    if (editItem.kind === "reminder") {
      const r = editItem.data as Reminder;
      return {
        type: "reminder" as const,
        title: r.title,
        date: format(parseISO(r.eventDate), "yyyy-MM-dd"),
        time: format(parseISO(r.eventDate), "HH:mm"),
        priority: "medium",
        description: r.description ?? "",
      };
    }
    const g = editItem.data as Goal;
    return {
      type: "goal" as const,
      title: g.title,
      date: "",
      time: "09:00",
      priority: "medium",
      description: "",
      unit: g.unit,
      target: g.target,
      period: g.period,
      step: g.step,
    };
  })();

  const [type,        setType]        = useState<ItemKind>(initial?.type ?? lockType ?? "task");
  const [title,       setTitle]       = useState(initial?.title ?? "");
  const [date,        setDate]        = useState(initial?.date ?? format(defaultDate, "yyyy-MM-dd"));
  const [time,        setTime]        = useState(initial?.time ?? "09:00");
  const [priority,    setPriority]    = useState(initial?.priority ?? "medium");
  const [description, setDescription] = useState(initial?.description ?? "");
  // Goal fields
  const [unit,   setUnit]   = useState((initial as { unit?: string })?.unit ?? "days");
  const [target, setTarget] = useState(String((initial as { target?: number })?.target ?? 7));
  const [period, setPeriod] = useState<GoalPeriod>((initial as { period?: GoalPeriod })?.period ?? "week");
  const [step,   setStep]   = useState(String((initial as { step?: number })?.step ?? 1));
  const [saving, setSaving] = useState(false);

  const targetNum = parseInt(target, 10);
  const goalValid = type !== "goal" || (!isNaN(targetNum) && targetNum >= 1);
  const canSave = !!title.trim() && !(type === "reminder" && !date) && goalValid && !saving;

  const handleSubmit = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave(
        {
          type, title: title.trim(), date, time, priority, description: description.trim(),
          unit: unit.trim() || "times",
          target: Math.max(1, isNaN(targetNum) ? 1 : targetNum),
          period,
          step: Math.max(1, parseInt(step, 10) || 1),
        },
        editItem?.data.id,
      );
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const TYPE_META: Record<ItemKind, string> = { task: "◈ task", reminder: "◎ reminder", goal: "◇ goal" };

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

        {/* Type toggle — three kinds; unlocked in edit mode so items can be converted */}
        <div className="flex gap-2">
          {(["task", "reminder", "goal"] as const).map((t) => (
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
              {TYPE_META[t]}
            </button>
          ))}
        </div>
        {isEdit && type !== initial?.type && (
          <p className="font-mono text-[9px] text-gold/80 -mt-2 tracking-wide">
            converting {initial?.type} → {type}; it’ll move to the {type} list
          </p>
        )}

        {/* Title */}
        <input
          type="text"
          placeholder={type === "task" ? "What needs doing?" : type === "reminder" ? "What to remember?" : "What are you building toward?"}
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="input w-full"
          autoFocus
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
        />

        {/* Task / reminder: date (+ time for reminders) */}
        {type !== "goal" && (
          <>
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
          </>
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

        {/* Goal fields — target / unit / period / step */}
        {type === "goal" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="number" min={1}
                value={target}
                onChange={e => setTarget(e.target.value)}
                className="input w-24"
                placeholder="7"
                aria-label="Target"
              />
              <input
                value={unit}
                onChange={e => setUnit(e.target.value)}
                className="input flex-1"
                placeholder="unit (days, pages…)"
                aria-label="Unit"
              />
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <select
                  value={period}
                  onChange={e => setPeriod(e.target.value as GoalPeriod)}
                  className="input appearance-none pr-8 cursor-pointer w-full"
                  aria-label="Period"
                >
                  <option value="week">Per week</option>
                  <option value="month">Per month</option>
                  <option value="ongoing">Ongoing</option>
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-parchment-700 pointer-events-none text-xs">▾</span>
              </div>
              <input
                type="number" min={1}
                value={step}
                onChange={e => setStep(e.target.value)}
                className="input w-24"
                placeholder="step +1"
                aria-label="Step"
                title="Default + amount"
              />
            </div>
          </div>
        )}

        {/* Notes — not for goals */}
        {type !== "goal" && (
          <textarea
            placeholder="Notes (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            className="textarea w-full"
          />
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSave}
          className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : isEdit ? (type !== initial?.type ? `Convert to ${type}` : "Save changes") : `Add ${type}`}
        </button>
      </div>
    </Modal>
  );
}
