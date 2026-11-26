import { ImageResponse } from "next/og";

export const alt = "PDFAlat — 10 Alat PDF Cepat Tanpa Login di Browser";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#FFFFFF",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          border: "1px solid #E4E4E7",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              backgroundColor: "#2563EB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 28,
                height: 34,
                backgroundColor: "#FFFFFF",
                borderRadius: 4,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                padding: 5,
                gap: 4,
              }}
            >
              <div style={{ width: 18, height: 3, backgroundColor: "#2563EB" }} />
              <div style={{ width: 13, height: 3, backgroundColor: "#09090B" }} />
            </div>
          </div>
          <span
            style={{
              fontSize: 34,
              fontWeight: 700,
              color: "#09090B",
              letterSpacing: "-0.02em",
            }}
          >
            PDFAlat
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 58,
              fontWeight: 700,
              color: "#09090B",
              lineHeight: 1.15,
              letterSpacing: "-0.03em",
              maxWidth: 960,
            }}
          >
            Alat PDF cepat tanpa login.
          </div>
          <div
            style={{
              fontSize: 28,
              color: "#52525B",
              lineHeight: 1.4,
              maxWidth: 900,
            }}
          >
            Gabung, pisah, kompres, konversi Word dan gambar, edit, putar, dan atur
            halaman PDF langsung di browser Anda.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid #E4E4E7",
            paddingTop: 24,
            fontSize: 22,
            color: "#52525B",
          }}
        >
          <span>100% Client-Side Processing</span>
          <span style={{ color: "#2563EB", fontWeight: 600 }}>
            Gratis • Tanpa Batas • Privasi Terjaga
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
