import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const size = Math.min(512, Math.max(16, parseInt(searchParams.get("size") ?? "192")));

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
          color: "#c9a227",
          fontSize: Math.round(size * 0.55),
          fontStyle: "italic",
          fontWeight: 700,
        }}
      >
        P
      </div>
    ),
    { width: size, height: size }
  );
}
