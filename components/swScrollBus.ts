/**
 * Scroll + live-mode bridge for the Selected Work section.
 * ScrollTrigger writes `progress`; the R3F scene damps it into `smooth`
 * every frame (wheel-jitter proof) and also damps `live` toward
 * `liveTarget` for the "CANLI İNCELE" screen-dive. No React state.
 */
export const swScroll = {
  /** raw pinned progress from ScrollTrigger, 0..1 */
  progress: 0,
  /** frame-damped progress the 3D scene animates from */
  smooth: 0,
  /** live-mode target: 0 = showcase, 1 = inside the screen */
  liveTarget: 0,
  /** damped live-mode value written by the scene */
  live: 0,
  /** project index the live dive targets */
  liveIdx: -1,
  /**
   * true while live mode owns the scene (enter → active → exit → scroll
   * handoff). While frozen, `smooth` is never advanced — the base scene
   * stays numerically identical no matter what the scroll position does.
   */
  frozen: false,
  /**
   * Compositor-dive parameters, computed once at live-enter from the
   * frozen camera: the screen's center in canvas pixels (origin), the
   * translation that centers it, and the scale that fills the viewport.
   * The dive is a CSS transform of the (frozen) canvas — pure compositor
   * work, immune to GPU render stalls on any machine.
   */
  zoom: { ox: 0, oy: 0, tx: 0, ty: 0, s: 1 },
  /**
   * performance.now() timestamp of the moment the current project
   * settled. All screen videos take their playhead from this shared
   * epoch — each presentation STARTS FROM ITS FIRST FRAME on arrival,
   * and the laptop + phone stay in exactly the same loop phase.
   */
  mediaEpoch: 0,
  /**
   * The settled MacBook's screen quad projected to canvas CSS pixels,
   * updated every rendered frame. The DOM screen overlay (a real
   * <video>, compositor-smooth like the phone) is matrix3d-mapped onto
   * this quad — WebGL keeps rendering the same content underneath for
   * transitions and the dive, so the swap is invisible.
   */
  quad: {
    on: false,
    idx: -1,
    d: 1,
    x0: 0, y0: 0, // top-left
    x1: 0, y1: 0, // top-right
    x2: 0, y2: 0, // bottom-right
    x3: 0, y3: 0, // bottom-left
  },
  /**
   * The companion iPhone's screen quad, same idea as `quad` above: the 3D
   * phone model's display face projected to canvas CSS pixels every frame,
   * so a crisp DOM <video>/<img> overlay can be matrix3d-mapped onto it
   * (the 3D model stays soft-at-canvas-dpr; the DOM overlay is native dpr).
   */
  phoneQuad: {
    on: false,
    idx: -1,
    x0: 0, y0: 0,
    x1: 0, y1: 0,
    x2: 0, y2: 0,
    x3: 0, y3: 0,
  },
};

/* expose the bus for debugging/automated verification (harmless) */
if (typeof window !== "undefined") {
  (window as unknown as { __swScroll?: typeof swScroll }).__swScroll = swScroll;
}
