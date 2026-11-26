import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#2563EB",
          borderRadius: 36,
        }}
      >
        <div
          style={{
            width: 96,
            height: 118,
            backgroundColor: "#FFFFFF",
            borderRadius: 12,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: 18,
            gap: 12,
          }}
        >
          <div style={{ width: 60, height: 10, backgroundColor: "#2563EB", borderRadius: 4 }} />
          <div style={{ width: 42, height: 10, backgroundColor: "#09090B", borderRadius: 4 }} />
          <div style={{ width: 52, height: 10, backgroundColor: "#E4E4E7", borderRadius: 4 }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
