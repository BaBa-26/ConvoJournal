"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CheckSquare, Bell } from "lucide-react";

const tabs = [
  { href: "/", label: "Journal", icon: BookOpen },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/reminders", label: "Reminders", icon: Bell },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 bg-white border-t border-stone-200 pb-safe">
      <div className="flex">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center py-3 gap-1 text-xs font-medium transition-colors duration-150
                ${active ? "text-journal-600" : "text-stone-400 hover:text-stone-600"}`}
            >
              <Icon className={`w-5 h-5 ${active ? "stroke-journal-600" : ""}`} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
