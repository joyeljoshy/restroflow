import { ImageResponse } from "next/og";

export const alt =
  "RestroFlow — one calm command center for restaurant operations";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#0c1f19",
        color: "#fbfaf7",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        overflow: "hidden",
        padding: "64px 76px",
        position: "relative",
        width: "100%",
      }}
    >
      <div
        style={{
          background: "#1f8a67",
          borderRadius: 999,
          display: "flex",
          filter: "blur(2px)",
          height: 430,
          opacity: 0.18,
          position: "absolute",
          right: -120,
          top: -160,
          width: 430,
        }}
      />
      <div
        style={{
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 32,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          padding: "56px 60px",
          position: "relative",
          width: "100%",
        }}
      >
        <div style={{ alignItems: "center", display: "flex", gap: 20 }}>
          <div
            style={{
              alignItems: "center",
              background: "#24745b",
              borderRadius: 18,
              display: "flex",
              height: 72,
              justifyContent: "center",
              width: 72,
            }}
          >
            <svg width="52" height="52" viewBox="0 0 36 36" fill="none">
              <circle cx="18" cy="18" r="8" fill="#fbfaf7" />
              <circle cx="18" cy="18" r="4.75" fill="#24745b" />
              <path
                d="M7.5 15.25A11.1 11.1 0 0 1 23.8 7.9"
                stroke="#fbfaf7"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <path d="m23.1 5.75 3.25 3.7-4.8.65Z" fill="#fbfaf7" />
              <path
                d="M28.5 20.75A11.1 11.1 0 0 1 12.2 28.1"
                stroke="#fbfaf7"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <path d="m12.9 30.25-3.25-3.7 4.8-.65Z" fill="#fbfaf7" />
            </svg>
          </div>
          <span style={{ fontSize: 38, fontWeight: 700, letterSpacing: -1 }}>
            RestroFlow
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              color: "#5ee0ad",
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: 3,
              marginBottom: 22,
              textTransform: "uppercase",
            }}
          >
            Restaurant operations, in flow
          </div>
          <div
            style={{
              fontSize: 59,
              fontWeight: 700,
              letterSpacing: -3,
              lineHeight: 1.06,
              maxWidth: 900,
            }}
          >
            One calm command center for every busy service.
          </div>
        </div>

        <div style={{ color: "#b9c9c2", display: "flex", fontSize: 21 }}>
          Menus · Tables · Orders · Kitchen · Billing · Analytics
        </div>
      </div>
    </div>,
    size,
  );
}
