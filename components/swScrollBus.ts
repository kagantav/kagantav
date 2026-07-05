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
};
