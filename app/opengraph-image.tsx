import { ImageResponse } from "next/og";

// 1200×630 social share card. Mirrors the app's brand: charcoal ink background, gold
// ring-with-dot mark (same construction as app/icon.tsx), title + tagline. Uses Satori's
// default font (no custom-font fetch) to stay dependency-free, matching app/icon.tsx.
export const alt = "Progress — A quiet place for your thoughts";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0f0e0b",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 40,
        }}
      >
        {/* Progress mark: gold ring with a filled centre dot */}
        <div
          style={{
            width: 132,
            height: 132,
            borderRadius: 66,
            border: "12px solid #c8a878",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ width: 34, height: 34, borderRadius: 17, background: "#c8a878" }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 92, color: "#f0e4cc", fontStyle: "italic", letterSpacing: -1 }}>
            Progress
          </div>
          <div style={{ fontSize: 34, color: "#8a7f6b" }}>A quiet place for your thoughts</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
