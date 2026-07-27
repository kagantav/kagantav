"use client";

import { useEffect, useState } from "react";

/**
 * `true` on phones / narrow tablets, `false` on desktop, `null` until the
 * client has measured (server render and first paint).
 *
 * The showcase and archive run heavy WebGL on desktop but swap to a light
 * DOM/CSS build on phones, where three simultaneous GL scenes are unusable.
 * That choice cannot be made on the server, so callers render a neutral
 * spacer while this is `null`; the preloader covers that first frame, so the
 * swap is never visible. The breakpoint matches the CSS `1023px` the rest of
 * the site already uses for its mobile layout.
 */
export function useIsMobile(): boolean | null {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return isMobile;
}
