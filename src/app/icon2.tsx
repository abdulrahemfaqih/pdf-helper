import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 7,
        }}
      >
        <div
          style={{
            width: 16,
            height: 20,
            backgroundColor: "#FFFFFF",
            borderRadius: 2,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: 3,
            gap: 2,
          }}
        >
          <div style={{ width: 10, height: 2, backgroundColor: "#2563EB" }} />
          <div style={{ width: 7, height: 2, backgroundColor: "#09090B" }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
