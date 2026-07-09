import webpush from "web-push";
import { prismaAdmin } from "./prisma";

// VAPID = the keypair that proves a push came from *your* server. Configured lazily so the app
// still boots if the keys aren't set yet (push just no-ops until they are).
let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:hello@progress.app";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string; // where tapping the notification goes
  tag?: string; // notifications sharing a tag replace each other
}

// Send a payload to every device a user has enabled push on. Returns how many were delivered.
// Dead subscriptions (expired / unsubscribed) are pruned automatically.
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!ensureConfigured()) {
    console.error("[webpush] VAPID keys not set — skipping push");
    return 0;
  }
  const subs = await prismaAdmin.pushSubscription.findMany({ where: { userId } });
  let sent = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload)
        );
        sent++;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        // 404 (gone) / 410 (unsubscribed) → the subscription is dead; remove it.
        if (status === 404 || status === 410) {
          await prismaAdmin.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        } else {
          console.error("[webpush] send failed", status ?? err);
        }
      }
    })
  );

  return sent;
}
