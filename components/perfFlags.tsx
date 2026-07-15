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
 *   ?perf=1  render only the front MacBook   (suspect: fill rate / overdraw)
 *   ?perf=2  pin dpr to 1                    (suspect: pixel count)
 *   ?perf=3  hide the crisp DOM overlay      (suspect: the 1600×1040 layer,
 *                                             which costs dpr² to rasterise)
 *   ?perf=4  all three at once               (sanity: does anything help?)
 *
 * Delete this file and its call sites once the culprit is known.
 */
export interface PerfFlags {
  on: boolean;
  soloUnit: boolean;
  lowDpr: boolean;
  noOverlay: boolean;
  raw: string;
}

const OFF: PerfFlags = {
  on: false,
  soloUnit: false,
  lowDpr: false,
  noOverlay: false,
  raw: "",
};

let cached: PerfFlags | null = null;

/** Safe to call during render: on the server it always reports "off", and
 *  nothing it gates changes the server-rendered HTML. */
export function perfFlags(): PerfFlags {
  if (cached) return cached;
  if (typeof window === "undefined") return OFF;
  const raw = new URLSearchParams(window.location.search).get("perf") ?? "";
  const has = (n: string) => raw === n || raw === "4";
  cached = {
    on: raw !== "",
    soloUnit: has("1"),
    lowDpr: has("2"),
    noOverlay: has("3"),
    raw,
  };
  return cached;
}

const LABEL: Record<string, string> = {
  "1": "tek laptop",
  "2": "dpr 1",
  "3": "overlay kapalı",
  "4": "hepsi",
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
