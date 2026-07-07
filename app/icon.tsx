import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// The Progress mark: a gold ring with a filled centre dot (Satori draws it from
// nested divs — a bordered circle for the ring, a filled circle for the dot).
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0f0e0b",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            border: "3px solid #c8a878",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ width: 6, height: 6, borderRadius: 3, background: "#c8a878" }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
