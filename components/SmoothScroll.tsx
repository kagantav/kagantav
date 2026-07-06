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
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    lenis.on("scroll", ScrollTrigger.update);
    scrollBridge.lenis = lenis;

    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    /* cap the shared ticker: on 144/240Hz monitors an uncapped ticker
       multiplies every per-frame cost (style writes, Lenis, 3D
       invalidation) past what the GPU can sustain — 120Hz is visually
       indistinguishable and keeps frame pacing even. No-op at ≤120Hz. */
    gsap.ticker.fps(120);

    return () => {
      scrollBridge.lenis = null;
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
