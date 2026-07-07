import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

// Size-parametrised Progress mark (ring + centre dot) for the PWA manifest icons.
export function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const size = Math.min(512, Math.max(16, parseInt(searchParams.get("size") ?? "192")));
  const ring = Math.round(size * 0.62);
  const border = Math.max(2, Math.round(size * 0.085));
  const dot = Math.round(size * 0.19);

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
            width: ring,
            height: ring,
            borderRadius: ring,
            border: `${border}px solid #c8a878`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ width: dot, height: dot, borderRadius: dot, background: "#c8a878" }} />
        </div>
      </div>
    ),
    { width: size, height: size }
  );
}
