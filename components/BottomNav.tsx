"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Icon shapes from the design: circle=Today, r-square=Journal, square=Calendar, diamond=Goals
const tabs = [
  { href: "/",         shape: "circle",   label: "Today"    },
  { href: "/journal",  shape: "r-square", label: "Journal"  },
  { href: "/schedule", shape: "square",   label: "Calendar" },
  { href: "/tasks",    shape: "diamond",  label: "Goals"    },
];

function TabIcon({ shape, active }: { shape: string; active: boolean }) {
  const common: React.CSSProperties = {
    display: "inline-block",
    flexShrink: 0,
    transition: "all 0.2s ease",
    background: active ? "#c8a878" : "transparent",
    border: active ? "none" : "1.6px solid #4a3c2e",
  };

  if (shape === "circle") {
    return <span style={{ ...common, width: 17, height: 17, borderRadius: "50%" }} />;
  }
  if (shape === "r-square") {
    return <span style={{ ...common, width: 17, height: 17, borderRadius: 4 }} />;
  }
  if (shape === "square") {
    return <span style={{ ...common, width: 17, height: 17, borderRadius: 2 }} />;
  }
  // diamond — rotated square
  return (
    <span style={{ ...common, width: 13, height: 13, borderRadius: 2, transform: "rotate(45deg)" }} />
  );
}

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden sticky bottom-0 z-50 bg-ink-950/95 backdrop-blur-sm border-t border-ink-700 pb-safe">
      <div className="flex">
        {tabs.map(({ href, shape, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`
                flex-1 flex flex-col items-center justify-center
                min-h-[56px] gap-[6px] transition-colors duration-200
                ${active
                  ? "text-parchment-200"
                  : "text-parchment-700 hover:text-parchment-600"}
              `}
            >
              <TabIcon shape={shape} active={active} />
              <span
                className={`text-[9px] font-mono uppercase tracking-widest ${
                  active ? "text-parchment-400" : "text-parchment-700"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
