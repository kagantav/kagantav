/**
 * Tiny mutable bridge between the DOM scroll world (GSAP ScrollTrigger in
 * CinematicScene) and the WebGL world (useFrame in HeroRig3D).
 *
 * No React state on purpose: ScrollTrigger writes `progress` at scroll rate,
 * the render loop reads it every frame and damps toward it. Zero re-renders.
 */
export const rigScroll = {
  /** target scroll progress of the pinned Hero→About scene, 0..1 */
  progress: 0,
};
