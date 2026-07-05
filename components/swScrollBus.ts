/**
 * Scroll bridge for the Selected Work section — same pattern as
 * rigScrollBus: ScrollTrigger writes, the R3F MacBook scene reads
 * every frame. No React state, no re-renders.
 */
export const swScroll = {
  /** pinned Selected Work progress, 0..1 */
  progress: 0,
};
