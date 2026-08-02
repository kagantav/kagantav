"use client";

import { useEffect } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * Re-measures every ScrollTrigger whenever the DOCUMENT HEIGHT changes.
 *
 * The heavy sections mount in stages: the mobile/desktop split resolves a
 * frame after hydration, the showcase's pinned stage adds its spacer when its
 * canvas warms up, and each step stretches the document by thousands of
 * pixels. Any trigger created before a stretch keeps scroll positions from
 * the shorter document — which is how the contact closer ended up fading in
 * over the laptops and staying dark at the real end of the page. A single
 * post-mount refresh cannot fix this reliably, because the stretches keep
 * happening after any one moment you pick.
 *
 * Watching the body's height and refreshing (debounced) after it settles
 * heals every case at once, including ones we have not met yet — late fonts,
 * late media, late pins. Height is compared, not blindly trusted from resize
 * events, so scrolling (which fires no body resize) never triggers this.
 */
export default function LayoutRefresh() {
  useEffect(() => {
    let lastH = document.body.scrollHeight;
    let t: number | undefined;

    const ro = new ResizeObserver(() => {
      const h = document.body.scrollHeight;
      if (h === lastH) return;
      lastH = h;
      window.clearTimeout(t);
      /* debounce: several sections mount within the same second — measure
         once, after the layout has settled */
      t = window.setTimeout(() => ScrollTrigger.refresh(), 220);
    });
    ro.observe(document.body);

    return () => {
      window.clearTimeout(t);
      ro.disconnect();
    };
  }, []);

  return null;
}
