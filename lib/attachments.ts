import type { Attachment } from "@/types";

// Attachment processing + on-device persistence (design-system §6.11).
//
// Current storage: data URLs on the entry (local/vault/demo modes) or in a small
// per-account overlay keyed by entry date (sync mode — the server has no blob store
// yet). SERVER CONTRACT, for when storage is provisioned:
//   POST /api/attachments  (multipart)  → { id, url, thumbUrl, mime, size, name }
//   entry analysis payload gains `attachmentIds: string[]`
// The Attachment shape here is deliberately identical minus dataUrl→url so the swap
// is mechanical. Native note: the picker source (camera vs library) is the platform
// sheet's concern — this module only ever sees Files.

export const MAX_ATTACHMENTS = 4;
const MAX_IMAGE_DIM = 1280;
const JPEG_QUALITY = 0.82;
const MAX_FILE_BYTES = 1_000_000; // non-image files: 1 MB cap while storage is on-device

export class AttachmentError extends Error {}

function makeId(): string {
  return `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new AttachmentError("could not read file"));
    r.readAsDataURL(file);
  });
}

// Downscale an image to fit MAX_IMAGE_DIM and re-encode as JPEG — keeps localStorage
// usage sane (~200–400 KB per photo) until real blob storage exists.
async function processImage(file: File): Promise<Attachment> {
  const dataUrl = await readAsDataUrl(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new AttachmentError("could not decode image"));
    i.src = dataUrl;
  });
  const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new AttachmentError("could not process image");
  ctx.drawImage(img, 0, 0, w, h);
  const out = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  return {
    id: makeId(),
    name: file.name,
    mime: "image/jpeg",
    size: Math.round((out.length * 3) / 4),
    kind: "image",
    dataUrl: out,
  };
}

export async function fileToAttachment(file: File): Promise<Attachment> {
  if (file.type.startsWith("image/")) return processImage(file);
  if (file.size > MAX_FILE_BYTES) {
    throw new AttachmentError("files over 1 MB need cloud storage — coming soon");
  }
  const dataUrl = await readAsDataUrl(file);
  return {
    id: makeId(),
    name: file.name,
    mime: file.type || "application/octet-stream",
    size: file.size,
    kind: "file",
    dataUrl,
  };
}

// ── Sync-mode overlay ─────────────────────────────────────────────────────────
// Remote entries live on the server, which can't hold attachments yet — so they
// persist on-device, keyed by entry date, namespaced per account (same isolation
// rule as the vault). Merged back onto fetched entries in JournalScreen.

const OVERLAY_PREFIX = "progress:attachments:v1";

function overlayKey(accountId: string | null): string {
  return accountId ? `${OVERLAY_PREFIX}:${accountId}` : OVERLAY_PREFIX;
}

type Overlay = Record<string, Attachment[]>; // date (YYYY-MM-DD) → attachments

function dateKey(dateIso: string): string {
  return dateIso.slice(0, 10);
}

function loadOverlay(accountId: string | null): Overlay {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(overlayKey(accountId));
    return raw ? (JSON.parse(raw) as Overlay) : {};
  } catch {
    return {};
  }
}

export function saveEntryAttachmentsOverlay(
  accountId: string | null,
  dateIso: string,
  attachments: Attachment[]
): void {
  if (typeof window === "undefined") return;
  try {
    const overlay = loadOverlay(accountId);
    if (attachments.length) overlay[dateKey(dateIso)] = attachments;
    else delete overlay[dateKey(dateIso)];
    window.localStorage.setItem(overlayKey(accountId), JSON.stringify(overlay));
  } catch {
    // Quota exceeded or storage unavailable — attachments are enhancement, not truth.
  }
}

export function loadEntryAttachmentsOverlay(
  accountId: string | null,
  dateIso: string
): Attachment[] {
  return loadOverlay(accountId)[dateKey(dateIso)] ?? [];
}
