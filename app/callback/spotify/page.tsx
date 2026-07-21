"use client";

import { useEffect, useState } from "react";

/**
 * OAuth popup landing page. Relays the authorization code back to the opener
 * (the canvas) via postMessage, then closes itself.
 */
export default function SpotifyCallback() {
  const [message, setMessage] = useState("Finishing Spotify sign-in…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");

    if (window.opener) {
      (window.opener as Window).postMessage(
        { type: "omni-spotify-auth", code, error },
        window.location.origin
      );
      setMessage("Connected — you can close this window.");
      window.close();
    } else {
      setMessage(
        error
          ? `Spotify authorization failed: ${error}`
          : "This window can be closed."
      );
    }
  }, []);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        fontSize: 14,
        color: "var(--ink-dim)",
      }}
    >
      {message}
    </div>
  );
}
