"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <title>Something went wrong | RestroFlow</title>
        <style>{`
          * { box-sizing: border-box; }
          body { margin: 0; }
          button, a { font: inherit; }
          button:focus-visible, a:focus-visible {
            outline: 3px solid #24745b;
            outline-offset: 3px;
          }
          @media (max-width: 480px) {
            .error-actions { flex-direction: column; }
          }
        `}</style>
        <main
          style={{
            alignItems: "center",
            background: "#fbfaf7",
            color: "#29241f",
            display: "flex",
            fontFamily:
              "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            justifyContent: "center",
            minHeight: "100vh",
            padding: 24,
          }}
        >
          <div
            role="alert"
            style={{
              background: "#ffffff",
              border: "1px solid #e4ded5",
              borderRadius: 16,
              boxShadow: "0 1px 3px rgba(41,36,31,0.08)",
              maxWidth: 512,
              padding: 32,
              width: "100%",
            }}
          >
            <p
              style={{
                color: "#24745b",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "0.16em",
                margin: 0,
                textTransform: "uppercase",
              }}
            >
              RestroFlow
            </p>
            <h1
              style={{
                fontSize: 30,
                letterSpacing: "-0.025em",
                lineHeight: 1.2,
                margin: "16px 0 0",
              }}
            >
              Something interrupted the flow.
            </h1>
            <p
              style={{ color: "#6f675f", lineHeight: 1.75, margin: "12px 0 0" }}
            >
              The application could not finish loading this view. Try again, or
              return to the overview.
            </p>
            <div
              className="error-actions"
              style={{ display: "flex", gap: 12, marginTop: 28 }}
            >
              <button
                type="button"
                onClick={retry}
                style={{
                  background: "#24745b",
                  border: 0,
                  borderRadius: 6,
                  color: "#ffffff",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  padding: "10px 16px",
                }}
              >
                Try again
              </button>
              <a
                href="/"
                style={{
                  border: "1px solid #d8d0c5",
                  borderRadius: 6,
                  color: "#29241f",
                  fontSize: 14,
                  fontWeight: 600,
                  padding: "10px 16px",
                  textAlign: "center",
                  textDecoration: "none",
                }}
              >
                Return home
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
