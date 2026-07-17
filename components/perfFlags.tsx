"use client";

import { useEffect, useState } from "react";

/**
 * TEMPORARY on-device diagnostics.
 *
 * The showcase is smooth on a desktop and unusable on an iPhone, and a dev
 * machine cannot profile the phone — every headless proxy available here
 * (swiftshader timing, CDP layout counts) has either exaggerated or missed
 * the real bottleneck. So each suspect gets a switch, and the phone itself
 * tells us which one it is.
 *
 * Round 1 (1-4) all measured the same on the phone: still frozen. That was a
 * flawed experiment — 1 only set opacity to 0, so all six MacBooks still
 * MOUNTED, cloned their materials and compiled their shaders in every run.
 * The per-frame suspects were tested; the one-time mount cost never was, and
 * "it freezes when I reach the section" points straight at mount.
 *
 *   ?perf=1  render only the front MacBook   (fill rate / overdraw)
 *   ?perf=2  pin dpr to 1                    (pixel count)
 *   ?perf=3  hide the crisp DOM overlay      (the 1600×1040 layer, dpr²)
 *   ?perf=4  1+2+3
 *   ?perf=5  MOUNT one MacBook, not six      (clone + material + shader cost)
 *   ?perf=6  MOUNT no MacBook at all         (is the model the problem?)
 *   ?perf=7  drop the hero canvas on exit    (two live WebGL contexts)
 *
 * Delete this file and its call sites once the culprit is known.
 */
export interface PerfFlags {
  on: boolean;
  soloUnit: boolean;
  lowDpr: boolean;
  noOverlay: boolean;
  oneMounted: boolean;
  noneMounted: boolean;
  dropHero: boolean;
  /** force mobile "lite" materials on (8) / off (9) regardless of viewport,
   *  so the two material tiers can be A/B'd in one viewport */
  liteOn: boolean;
  liteOff: boolean;
  raw: string;
}

const OFF: PerfFlags = {
  on: false,
  soloUnit: false,
  lowDpr: false,
  noOverlay: false,
  oneMounted: false,
  noneMounted: false,
  dropHero: false,
  liteOn: false,
  liteOff: false,
  raw: "",
};

let cached: PerfFlags | null = null;

/** Safe to call during render: on the server it always reports "off", and
 *  nothing it gates changes the server-rendered HTML. */
export function perfFlags(): PerfFlags {
  if (cached) return cached;
  if (typeof window === "undefined") return OFF;
  const raw = new URLSearchParams(window.location.search).get("perf") ?? "";
  /* 4 bundles the three per-frame switches; 5-7 are mount-level and stand
     alone, so each is tested on its own */
  const has = (n: string) => raw === n || (raw === "4" && "123".includes(n));
  cached = {
    on: raw !== "",
    soloUnit: has("1"),
    lowDpr: has("2"),
    noOverlay: has("3"),
    oneMounted: has("5"),
    noneMounted: has("6"),
    dropHero: has("7"),
    liteOn: has("8"),
    liteOff: has("9"),
    raw,
  };
  return cached;
}

const LABEL: Record<string, string> = {
  "1": "tek laptop çizilir",
  "2": "dpr 1",
  "3": "overlay kapalı",
  "4": "1+2+3",
  "5": "TEK laptop mount",
  "6": "HİÇ laptop yok",
  "7": "hero canvas atılır",
  "8": "lite materyal ZORLA",
  "9": "lite KAPALI zorla",
};

/** Live frame rate, so the report back is a number and not an impression. */
export function PerfBadge() {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const f = perfFlags();
    if (!f.on) return;

    let frames = 0;
    let lastT = -1;
    let since = performance.now();
    let raf = 0;
    let low = Infinity;

    const tick = (t: number) => {
      /* several libraries drive their own rAF; callbacks within one frame
         share a timestamp, so dedupe on it or the count is inflated */
      if (t !== lastT) {
        frames++;
        lastT = t;
      }
      const now = performance.now();
      if (now - since >= 500) {
        const fps = Math.round((frames * 1000) / (now - since));
        low = Math.min(low, fps);
        setText(`perf=${f.raw} · ${LABEL[f.raw] ?? "?"} · ${fps} fps (min ${low === Infinity ? fps : low})`);
        frames = 0;
        since = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!text) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: 8,
        bottom: 8,
        zIndex: 300,
        padding: "7px 11px",
        borderRadius: 8,
        background: "rgba(0,0,0,0.82)",
        border: "1px solid rgba(216,169,79,0.5)",
        color: "#e9b45e",
        font: "600 12px/1 ui-monospace, monospace",
        letterSpacing: "0.04em",
        pointerEvents: "none",
      }}
    >
      {text}
    </div>
  );
}
