"use client";

import NotificationsSettings from "@/components/NotificationsSettings";

// Push notifications, per device. The control card is self-contained.
export default function NotificationsPanel() {
  return (
    <div className="space-y-4">
      <NotificationsSettings />
    </div>
  );
}
