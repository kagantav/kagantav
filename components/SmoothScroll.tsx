"use client";

import { useEffect, type ReactNode } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { scrollBridge } from "./scrollBridge";

gsap.registerPlugin(ScrollTrigger);

/**
 * Lenis smooth scrolling bridged into GSAP's ticker so ScrollTrigger
 * scrub values stay perfectly in sync with the eased scroll position.
 */
export default function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced) return;

    const lenis = new Lenis({
      /* longer glide = the liquid, inertial feel of reference sites;
         individual wheel notches melt into one continuous ease */
      duration: 1.3,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    lenis.on("scroll", ScrollTrigger.update);
    scrollBridge.lenis = lenis;

    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    /* NOTE: do NOT cap gsap.ticker.fps here — capping it also throttles
       Lenis and on a high-Hz monitor that visibly quantized wheel
       scrolling into steps (r6 regression, confirmed by frame analysis).
       The GPU-heavy 3D render is rate-limited at its own invalidation
       site instead. */

    return () => {
      scrollBridge.lenis = null;
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
