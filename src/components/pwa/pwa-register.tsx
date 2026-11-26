"use client";

import * as React from "react";

export function PwaRegister() {
  React.useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
      } catch {
        // Ignore service worker registration errors in unsupported contexts
      }
    };

    void register();
  }, []);

  return null;
}
