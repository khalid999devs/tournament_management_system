"use client";

// Replaces the root layout when it fails, so it carries its own document and
// minimal styling.
export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "#071127",
          color: "#f6f1e6",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <title>Something went wrong | NDCAK Indoor Games</title>
        <main style={{ maxWidth: 520 }} role="alert">
          <p
            style={{
              margin: "0 0 12px",
              color: "#e4c27a",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            NDCAK Indoor Games
          </p>
          <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.1 }}>
            The site could not load.
          </h1>
          <p style={{ color: "#a8b0c5", lineHeight: 1.7 }}>
            It is usually a brief connection problem. Try again in a moment.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              minHeight: 48,
              padding: "0 22px",
              border: 0,
              borderRadius: 3,
              background: "#e4c27a",
              color: "#071127",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
