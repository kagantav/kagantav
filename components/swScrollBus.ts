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
};

/* expose the bus for debugging/automated verification (harmless) */
if (typeof window !== "undefined") {
  (window as unknown as { __swScroll?: typeof swScroll }).__swScroll = swScroll;
}
