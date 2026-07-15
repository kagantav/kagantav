"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";

/**
 * Is `ref` within `margin` of the viewport?
 *
 * The page runs three independent WebGL scenes (hero rig, MacBook showcase,
 * archive gallery). Keeping all three alive at once exhausts a mobile
 * browser's WebGL budget — the archive canvas simply fails to come up. Gating
 * each canvas's MOUNT on this hook means only the scenes near the viewport
 * hold a context; everything else is released. Nothing visible changes: a
 * scene is only torn down once it is well off-screen.
 *
 * The margin is deliberately generous so the canvas is always warm before it
 * scrolls into view.
 */
export function useNearViewport(
  ref: RefObject<HTMLElement | null>,
  margin: string = "120% 0px 120% 0px"
) {
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), {
      rootMargin: margin,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin]);

  return near;
}

/**
 * Recovers a canvas from `webglcontextlost`.
 *
 * Under memory pressure mobile Safari drops WebGL contexts. Nothing listens
 * for that by default, so the canvas stays permanently blank — which is what
 * made the archive look like it "never opened". Calling preventDefault() lets
 * the browser hand the context back, and bumping `key` remounts the React tree
 * so every buffer/texture is re-uploaded cleanly.
 *
 * Spread `bind` onto <Canvas onCreated>, and use `key` as the Canvas key.
 */
export function useContextRecovery() {
  const [key, setKey] = useState(0);

  const onCreated = useCallback(
    ({
      gl,
    }: {
      gl: {
        domElement: HTMLCanvasElement;
        debug: { checkShaderErrors: boolean };
      };
    }) => {
      /* three checks every shader for compile/link errors by default, which
         means a getProgramInfoLog call per program. That call is a hard sync
         point: it blocks the CPU until the driver has finished compiling, so
         the MacBook's 22 programs compile strictly one after another instead
         of in parallel. It cost 8% of the profile here and far more on a
         phone driver, where it reads as the section freezing on arrival.
         three's own docs recommend turning this off in production. Errors
         still surface in development. */
      if (process.env.NODE_ENV === "production") {
        gl.debug.checkShaderErrors = false;
      }

      const canvas = gl.domElement;
      const lost = (e: Event) => {
        e.preventDefault(); // without this the context is gone for good
      };
      const restored = () => setKey((k) => k + 1);
      canvas.addEventListener("webglcontextlost", lost);
      canvas.addEventListener("webglcontextrestored", restored);
    },
    []
  );

  return { key, onCreated };
}
