"use client";

import { Reorder, useDragControls } from "framer-motion";
import type { WidgetKey } from "@/types";

// Reorderable / hideable vertical stack of widgets. When `editing`, each widget gets a
// drag handle + hide/show toggle; otherwise it renders the widgets in order, skipping hidden
// ones. Shared by the Today layouts (inline edit) and the Settings live-preview studio.
export default function EditableWidgetStack({
  order,
  hidden,
  editing,
  render,
  onReorder,
  onCommit,
  onToggleHidden,
  className = "flex flex-col gap-4",
}: {
  order: WidgetKey[];
  hidden: WidgetKey[];
  editing: boolean;
  render: Record<WidgetKey, React.ReactNode>;
  onReorder: (next: WidgetKey[]) => void;
  onCommit: () => void;
  onToggleHidden: (key: WidgetKey) => void;
  className?: string;
}) {
  return (
    <Reorder.Group axis="y" values={order} onReorder={onReorder} className={className}>
      {order.map((key) => {
        const isHidden = hidden.includes(key);
        if (isHidden && !editing) return null;
        return (
          <ReorderableWidget
            key={key}
            widgetKey={key}
            editing={editing}
            hidden={isHidden}
            onCommit={onCommit}
            onToggleHidden={() => onToggleHidden(key)}
          >
            {render[key]}
          </ReorderableWidget>
        );
      })}
    </Reorder.Group>
  );
}

function ReorderableWidget({
  widgetKey,
  editing,
  hidden,
  onCommit,
  onToggleHidden,
  children,
}: {
  widgetKey: WidgetKey;
  editing: boolean;
  hidden: boolean;
  onCommit: () => void;
  onToggleHidden: () => void;
  children: React.ReactNode;
}) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={widgetKey}
      dragListener={false}
      dragControls={dragControls}
      onDragEnd={onCommit}
      className={hidden ? "opacity-40" : ""}
    >
      {editing && (
        <div className="flex items-center justify-between mb-1.5 px-1">
          <span
            onPointerDown={(e) => dragControls.start(e)}
            className="cursor-grab active:cursor-grabbing text-muted-foreground text-lg leading-none select-none touch-none"
            title="Drag to reorder"
          >
            ⠿
          </span>
          <button
            onClick={onToggleHidden}
            className="font-mono text-[8px] uppercase tracking-[0.1em] text-muted-foreground border border-border rounded-md px-2 py-1"
          >
            {hidden ? "show" : "hide"}
          </button>
        </div>
      )}
      {children}
    </Reorder.Item>
  );
}
