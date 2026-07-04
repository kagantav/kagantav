"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { rigScroll } from "./rigScrollBus";

/* ════════════════════════════════════════════════════════════════
   Pose tables — hero (p=0) → mid (p=0.5) → about (p=1).
   Two independent top-level groups:
     CORE  = platform + glass + portrait + badge   (stays large)
     CARDS = the three floating cards              (own travel/scale)
   ════════════════════════════════════════════════════════════════ */

type Pose = { pos: number[]; rot: number[]; scale: number };
type Triple = { hero: Pose; mid: Pose; about: Pose };

const CAM = {
  hero: { pos: [0.25, 0.05, 7.4], look: [0, 0.08, 0] },
  mid: { pos: [-0.3, 0.14, 6.65], look: [0, -0.02, 0] },
  about: { pos: [0.15, 0.05, 7.6], look: [0, 0.04, 0] },
};

const CORE: Triple = {
  hero: { pos: [1.72, -0.12, 0], rot: [0, -0.1, 0], scale: 1 },
  mid: { pos: [0.1, -0.26, -0.45], rot: [0.025, 0.16, -0.012], scale: 0.9 },
  about: { pos: [-2.05, -0.16, -0.3], rot: [0, 0.1, 0], scale: 0.97 },
};

const CARDSG: Triple = {
  hero: { pos: [1.72, -0.12, 0], rot: [0, -0.1, 0], scale: 1 },
  mid: { pos: [0.12, -0.24, -0.4], rot: [0.02, 0.14, -0.01], scale: 0.93 },
  about: { pos: [-0.2, -0.12, -0.1], rot: [0, 0.04, 0], scale: 0.97 },
};

const GLASS: Triple = {
  hero: { pos: [0.1, 0.32, -0.45], rot: [0.01, -0.12, 0], scale: 1 },
  mid: { pos: [0.3, 0.28, -0.78], rot: [-0.005, 0.03, 0.004], scale: 1 },
  about: { pos: [-0.08, 0.32, -0.34], rot: [-0.02, 0.15, 0], scale: 1 },
};

const PORTRAIT: Triple = {
  hero: { pos: [0, 0.34, 0.1], rot: [0, -0.026, 0], scale: 1 },
  mid: { pos: [0.05, 0.28, 0.1], rot: [-0.017, 0.035, 0], scale: 1.02 },
  about: { pos: [-0.03, 0.34, 0.1], rot: [0.008, 0.017, 0], scale: 0.99 },
};

/* CARDS-local poses. About: one readable vertical column (the CardsGroup
   itself sits at ~50vw), stack → expertise → focus top-to-bottom. */
const STACK: Triple = {
  hero: { pos: [-1.35, 0.45, 0.45], rot: [0.02, 0.22, -0.035], scale: 1 },
  mid: { pos: [-1.7, 0.75, 0.9], rot: [0.02, -0.07, -0.02], scale: 1.02 },
  about: { pos: [0, 1.42, 0.2], rot: [0.01, -0.06, -0.015], scale: 0.8 },
};

const EXPERTISE: Triple = {
  hero: { pos: [1.25, 0.78, 0.65], rot: [-0.02, -0.24, 0.025], scale: 1 },
  mid: { pos: [1.35, 0.92, 1.0], rot: [-0.02, -0.05, 0.014], scale: 1.03 },
  about: { pos: [0.06, 0, 0.32], rot: [0, -0.015, 0], scale: 0.82 },
};

const FOCUS: Triple = {
  hero: { pos: [1.15, -0.5, 1.35], rot: [0.02, -0.2, 0.04], scale: 1 },
  mid: { pos: [1.5, -0.7, 1.75], rot: [0.03, -0.03, 0.065], scale: 1.05 },
  about: { pos: [0.02, -1.4, 0.44], rot: [0.01, 0.05, 0.015], scale: 0.78 },
};

const BADGE: Triple = {
  hero: { pos: [-0.15, -1.06, 2.0], rot: [0, -0.08, 0], scale: 1 },
  mid: { pos: [-0.05, -0.9, 2.2], rot: [0, 0.05, 0], scale: 1.03 },
  about: { pos: [0.3, -1.12, 1.7], rot: [0, -0.04, 0], scale: 0.95 },
};

/* ── Mobile (<1024px) pose tables: portrait-format framing.
   Hero: rig centered under the copy, large. About: core rig left,
   card column right, upper half — the About copy (DOM) sits below. ── */
const M_CAM = {
  hero: { pos: [0, -0.4, 7.9], look: [0, -0.32, 0] },
  mid: { pos: [0, -0.1, 8.7], look: [0, 0, 0] },
  about: { pos: [0, -0.05, 8.4], look: [0, 0, 0] },
};

const M_CORE: Triple = {
  hero: { pos: [0, -1.32, 0], rot: [0, -0.06, 0], scale: 0.78 },
  mid: { pos: [0, -0.4, -0.3], rot: [0.02, 0.1, -0.01], scale: 0.66 },
  /* final: he stands alone, big and centered — portrait + glass +
     platform + badge fill the frame; the cards hand off to the DOM
     column that scrolls in right below the pinned stage */
  about: { pos: [0, -0.12, 0], rot: [0, 0.05, 0], scale: 0.66 },
};

const M_CARDSG: Triple = {
  hero: { pos: [0, -1.32, 0], rot: [0, -0.06, 0], scale: 0.66 },
  mid: { pos: [0, -0.35, -0.25], rot: [0.01, 0.08, 0], scale: 0.56 },
  /* cards sink below the frame during the second half of the journey */
  about: { pos: [0, -5.2, -0.2], rot: [0, 0, 0], scale: 0.55 },
};

/* pointer parallax amplitude per layer (world units, sign = direction) */
const PARALLAX = {
  portrait: 0.015,
  glass: -0.05,
  stack: -0.1,
  expertise: 0.12,
  focus: 0.13,
  badge: 0.16,
};

/* idle float: [amplitude, frequency, phase] */
const IDLE = {
  stack: [0.045, 0.55, 0],
  expertise: [0.05, 0.42, 1.7],
  focus: [0.055, 0.62, 3.4],
  badge: [0.028, 0.5, 5.1],
  glass: [0.014, 0.3, 2.2],
} as const;

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** two-segment eased interpolation through hero → mid → about */
function tri(a: number, b: number, c: number, p: number) {
  return p < 0.5
    ? a + (b - a) * smooth(p / 0.5)
    : b + (c - b) * smooth((p - 0.5) / 0.5);
}
/** 0 at the ends of the journey, 1 at its midpoint */
const midBump = (p: number) => 4 * p * (1 - p);

function applyPose(
  obj: THREE.Object3D,
  t: Triple,
  p: number,
  dx = 0,
  dy = 0,
  dz = 0
) {
  obj.position.set(
    tri(t.hero.pos[0], t.mid.pos[0], t.about.pos[0], p) + dx,
    tri(t.hero.pos[1], t.mid.pos[1], t.about.pos[1], p) + dy,
    tri(t.hero.pos[2], t.mid.pos[2], t.about.pos[2], p) + dz
  );
  obj.rotation.set(
    tri(t.hero.rot[0], t.mid.rot[0], t.about.rot[0], p),
    tri(t.hero.rot[1], t.mid.rot[1], t.about.rot[1], p),
    tri(t.hero.rot[2], t.mid.rot[2], t.about.rot[2], p)
  );
  const s = tri(t.hero.scale, t.mid.scale, t.about.scale, p);
  obj.scale.setScalar(s);
}

/* ════════════════════════════════════════════════════════════════
   Textured plane helper
   All planes: transparent, no depth writes — stacking is controlled
   purely by renderOrder (painter's algorithm), which is what lets the
   platform's front rim strip re-draw on top of the portrait.
   ════════════════════════════════════════════════════════════════ */

/* Shared vertical alpha gradient: opaque until ~87% down the plane, then a
   soft dissolve — used to melt the portrait's crop line into the platform. */
let _fadeTex: THREE.CanvasTexture | null = null;
function getFadeTexture() {
  if (_fadeTex) return _fadeTex;
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 4, 512);
  const grad = g.createLinearGradient(0, 512 * 0.87, 0, 512 * 0.985);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.55, "rgba(120,120,120,1)");
  grad.addColorStop(1, "rgba(0,0,0,1)");
  g.fillStyle = grad;
  g.fillRect(0, Math.floor(512 * 0.87), 4, 512);
  _fadeTex = new THREE.CanvasTexture(c);
  return _fadeTex;
}

/* Alpha ramp for the deck reflection: the mirrored mesh flips V, so the
   canvas BOTTOM (v=0) is the seam — opaque there, gone ~14% later. */
let _reflFadeTex: THREE.CanvasTexture | null = null;
function getReflectionFadeTexture() {
  if (_reflFadeTex) return _reflFadeTex;
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000000";
  g.fillRect(0, 0, 4, 512);
  const grad = g.createLinearGradient(0, 512, 0, 512 * 0.86);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(1, "rgba(0,0,0,1)");
  g.fillStyle = grad;
  g.fillRect(0, Math.floor(512 * 0.84), 4, 512);
  _reflFadeTex = new THREE.CanvasTexture(c);
  return _reflFadeTex;
}

/* Faint mirrored copy of the portrait on the smoked-glass deck. */
function PortraitReflection() {
  const tex = useTexture("/assets/portrait.png");
  const fade = useMemo(() => getReflectionFadeTexture(), []);
  const aspect =
    (tex.image as HTMLImageElement).width /
    (tex.image as HTMLImageElement).height;
  const H = 3.1;
  return (
    <mesh
      position={[0.02, -H - 0.015, -0.02]}
      scale={[1, -1, 1]}
      renderOrder={2.2}
    >
      <planeGeometry args={[H * aspect, H]} />
      <meshBasicMaterial
        map={tex}
        alphaMap={fade}
        transparent
        depthWrite={false}
        opacity={0.16}
        color="#cdbba0"
        toneMapped={false}
      />
    </mesh>
  );
}

function AssetPlane({
  url,
  height,
  renderOrder,
  opacity = 1,
  color,
  additive = false,
  fadeBottom = false,
  meshRef,
}: {
  url: string;
  height: number;
  renderOrder: number;
  opacity?: number;
  color?: string;
  additive?: boolean;
  fadeBottom?: boolean;
  meshRef?: React.Ref<THREE.Mesh>;
}) {
  const tex = useTexture(url);
  useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
  }, [tex]);
  const fadeTex = useMemo(
    () => (fadeBottom ? getFadeTexture() : null),
    [fadeBottom]
  );
  const aspect =
    (tex.image as HTMLImageElement).width /
    (tex.image as HTMLImageElement).height;

  return (
    <mesh ref={meshRef} renderOrder={renderOrder}>
      <planeGeometry args={[height * aspect, height]} />
      <meshBasicMaterial
        map={tex}
        alphaMap={fadeTex ?? undefined}
        transparent
        alphaTest={0.02}
        depthWrite={false}
        opacity={opacity}
        color={color ?? "#ffffff"}
        blending={additive ? THREE.AdditiveBlending : THREE.NormalBlending}
        toneMapped={false}
      />
    </mesh>
  );
}

/* ════════════════════════════════════════════════════════════════
   Production platform — platform.png used twice:
   the full art behind the portrait, and its bottom rim strip re-drawn
   in front so the person visually sits inside the disc.
   ════════════════════════════════════════════════════════════════ */

const PLAT_W = 3.9; // world width of the platform art
const PLAT_SPLIT = 0.55; // bottom fraction re-drawn in front of the portrait

function PlatformPNG({
  groupRef,
  glowMatRef,
}: {
  groupRef: React.Ref<THREE.Group>;
  glowMatRef: React.Ref<THREE.MeshBasicMaterial>;
}) {
  const tex = useTexture("/assets/platform.png");
  const H = useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const img = tex.image as HTMLImageElement;
    return PLAT_W * (img.height / img.width);
  }, [tex]);

  // bottom-strip UV crop, perfectly aligned with the full copy
  const frontTex = useMemo(() => {
    const t = tex.clone();
    t.repeat.set(1, PLAT_SPLIT);
    t.offset.set(0, 0);
    t.needsUpdate = true;
    return t;
  }, [tex]);

  const { glowTex, darkTex } = useMemo(() => {
    const make = (stops: [number, string][]) => {
      const c = document.createElement("canvas");
      c.width = c.height = 256;
      const g = c.getContext("2d")!;
      const grad = g.createRadialGradient(128, 128, 6, 128, 128, 128);
      for (const [o, col] of stops) grad.addColorStop(o, col);
      g.fillStyle = grad;
      g.fillRect(0, 0, 256, 256);
      return new THREE.CanvasTexture(c);
    };
    return {
      glowTex: make([
        [0, "rgba(222,165,66,0.8)"],
        [0.45, "rgba(190,130,45,0.28)"],
        [1, "rgba(190,130,45,0)"],
      ]),
      darkTex: make([
        [0, "rgba(0,0,0,0.9)"],
        [0.55, "rgba(0,0,0,0.42)"],
        [1, "rgba(0,0,0,0)"],
      ]),
    };
  }, []);

  return (
    <group ref={groupRef} position={[0, -1.15, 0]}>
      {/* gentle amber wash behind/beneath the disc */}
      <mesh position={[0, -0.14, -0.12]} renderOrder={0.5}>
        <planeGeometry args={[PLAT_W * 1.3, H * 2.2]} />
        <meshBasicMaterial
          ref={glowMatRef}
          map={glowTex}
          transparent
          depthWrite={false}
          opacity={0.32}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* full platform art — behind the portrait */}
      <mesh renderOrder={1}>
        <planeGeometry args={[PLAT_W, H]} />
        <meshBasicMaterial
          map={tex}
          transparent
          alphaTest={0.02}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* occlusion pool where the body meets the bowl — grounds him */}
      <mesh position={[0, 0.09, 0.04]} renderOrder={3.5}>
        <planeGeometry args={[1.75, 0.6]} />
        <meshBasicMaterial
          map={darkTex}
          transparent
          depthWrite={false}
          opacity={0.5}
          toneMapped={false}
        />
      </mesh>

      {/* warm catch-light at the seam, in front of the portrait */}
      <mesh position={[0, -0.02, 0.05]} renderOrder={4.6}>
        <planeGeometry args={[2.35, 0.72]} />
        <meshBasicMaterial
          map={glowTex}
          transparent
          depthWrite={false}
          opacity={0.34}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* bottom rim strip — re-drawn in front, hides the portrait crop */}
      <mesh position={[0, (-H * (1 - PLAT_SPLIT)) / 2, 0.02]} renderOrder={5}>
        <planeGeometry args={[PLAT_W, H * PLAT_SPLIT]} />
        <meshBasicMaterial
          map={frontTex}
          transparent
          alphaTest={0.02}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/* ════════════════════════════════════════════════════════════════
   The rig scene
   ════════════════════════════════════════════════════════════════ */

function RigScene({
  compact,
  wide,
  reduced,
}: {
  compact: boolean;
  wide: boolean;
  reduced: boolean;
}) {
  const { camera } = useThree();

  const core = useRef<THREE.Group>(null);
  const cardsGrp = useRef<THREE.Group>(null);
  const plat = useRef<THREE.Group>(null);
  const glass = useRef<THREE.Group>(null);
  const portrait = useRef<THREE.Group>(null);
  const stack = useRef<THREE.Group>(null);
  const expertise = useRef<THREE.Group>(null);
  const focus = useRef<THREE.Group>(null);
  const badge = useRef<THREE.Group>(null);
  const glowMat = useRef<THREE.MeshBasicMaterial>(null);
  const rimMesh = useRef<THREE.Mesh>(null);

  const state = useRef({
    p: 0,
    pointerX: 0,
    pointerY: 0,
    pointerAmp: 1,
    look: new THREE.Vector3(0, 0.08, 0),
  });

  useEffect(() => {
    if (reduced) return;
    const onMove = (e: PointerEvent) => {
      state.current.pointerX = e.clientX / window.innerWidth - 0.5;
      state.current.pointerY = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduced]);

  useFrame((_, rawDelta) => {
    const s = state.current;
    const delta = Math.min(rawDelta, 0.05);
    const t = performance.now() / 1000;

    /* damp progress toward the ScrollTrigger target */
    const target = rigScroll.progress;
    s.p = THREE.MathUtils.damp(s.p, target, 5.5, delta);
    const p = clamp01(s.p);

    /* pose tables: portrait-format framing on compact screens */
    const TCAM = compact ? M_CAM : CAM;
    const TCORE = compact ? M_CORE : CORE;
    const TCARDS = compact ? M_CARDSG : CARDSG;

    /* pointer influence eases out while the scroll is moving fast */
    const activity = clamp01(Math.abs(target - s.p) * 16);
    s.pointerAmp = THREE.MathUtils.damp(
      s.pointerAmp,
      reduced ? 0 : 1 - activity * 0.88,
      3,
      delta
    );
    const px = s.pointerX * s.pointerAmp;
    const py = s.pointerY * s.pointerAmp;
    const idleAmp = reduced ? 0 : 1 - activity * 0.85;

    /* ── camera ── */
    camera.position.set(
      tri(TCAM.hero.pos[0], TCAM.mid.pos[0], TCAM.about.pos[0], p) + px * 0.06,
      tri(TCAM.hero.pos[1], TCAM.mid.pos[1], TCAM.about.pos[1], p) - py * 0.04,
      tri(TCAM.hero.pos[2], TCAM.mid.pos[2], TCAM.about.pos[2], p)
    );
    s.look.set(
      tri(TCAM.hero.look[0], TCAM.mid.look[0], TCAM.about.look[0], p) +
        px * 0.1,
      tri(TCAM.hero.look[1], TCAM.mid.look[1], TCAM.about.look[1], p) -
        py * 0.07,
      0
    );
    camera.lookAt(s.look);

    /* ── the two master groups, independently scaled ──
       On wide desktops the hero pose is boosted so the rig dominates the
       frame; the boost eases away by the midpoint of the journey. */
    const boost = wide ? 1 + 0.13 * (1 - smooth(clamp01(p / 0.5))) : 1;
    if (core.current) {
      applyPose(core.current, TCORE, p);
      core.current.scale.multiplyScalar(boost);
    }
    if (cardsGrp.current) {
      applyPose(cardsGrp.current, TCARDS, p);
      cardsGrp.current.scale.multiplyScalar(boost);
    }

    /* ── core children ── */
    const idle = (k: keyof typeof IDLE) =>
      Math.sin(t * IDLE[k][1] * Math.PI * 2 * 0.32 + IDLE[k][2]) *
      IDLE[k][0] *
      idleAmp;

    if (glass.current)
      applyPose(glass.current, GLASS, p, px * PARALLAX.glass, idle("glass"));

    if (portrait.current) {
      applyPose(
        portrait.current,
        PORTRAIT,
        p,
        px * PARALLAX.portrait,
        (reduced ? 0 : Math.sin(t * 0.5) * 0.006) - py * 0.006
      );
      // restrained billboard: cancel most of the core yaw so he faces camera
      if (core.current) {
        const counter = -core.current.rotation.y * 0.55;
        portrait.current.rotation.y += THREE.MathUtils.clamp(
          counter,
          -0.052,
          0.052
        );
      }
      const breathe = 1 + (reduced ? 0 : Math.sin(t * 0.42) * 0.004);
      portrait.current.scale.multiplyScalar(breathe);
    }

    if (badge.current) {
      applyPose(badge.current, BADGE, p, px * PARALLAX.badge, idle("badge"));
      const bb = 1 + (reduced ? 0 : Math.sin(t * 0.9 + 1.2) * 0.008);
      badge.current.scale.multiplyScalar(bb);
    }

    /* ── platform: restrained image motion, never enough to read flat ── */
    const bump = midBump(p);
    if (plat.current) {
      plat.current.rotation.x = tri(0, 0.015, 0.006, p) + py * 0.006;
      plat.current.rotation.y = tri(0, 0.028, -0.018, p) + px * 0.008;
      plat.current.rotation.z = tri(0, -0.009, 0.005, p) + px * 0.005;
      plat.current.position.z = tri(0, 0.06, 0.03, p);
      const pb = 1 + (reduced ? 0 : Math.sin(t * 0.55) * 0.004);
      plat.current.scale.setScalar(pb);
    }
    if (glowMat.current) {
      const pulse = reduced ? 0 : Math.sin(t * 0.8) * 0.03;
      glowMat.current.opacity = 0.32 + bump * 0.26 + pulse * idleAmp;
    }
    if (rimMesh.current) {
      const m = rimMesh.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.3 + bump * 0.4;
    }

    /* ── cards: staggered settle — stack, then expertise, then focus ── */
    const pStack = clamp01(p / 0.91);
    const pExp = clamp01((p - 0.045) / 0.91);
    const pFocus = clamp01((p - 0.09) / 0.91);
    if (stack.current)
      applyPose(stack.current, STACK, pStack, px * PARALLAX.stack, idle("stack"));
    if (expertise.current)
      applyPose(
        expertise.current,
        EXPERTISE,
        pExp,
        px * PARALLAX.expertise,
        idle("expertise")
      );
    if (focus.current)
      applyPose(focus.current, FOCUS, pFocus, px * PARALLAX.focus, idle("focus"));
  });

  return (
    <>
      {/* ══ CORE: platform + glass + portrait + badge ══ */}
      <group ref={core}>
        <PlatformPNG groupRef={plat} glowMatRef={glowMat} />

        {/* glass frame — object behind the person; its lower edge dissolves
            into the platform bowl so it never visibly pierces the disc while
            drifting during the scroll travel */}
        <group ref={glass}>
          <AssetPlane
            url="/assets/glass-frame.png"
            height={3.62}
            renderOrder={2}
            opacity={0.96}
            fadeBottom
          />
        </group>

        {/* portrait cluster: deck reflection → cast shadow → warm rim →
            the person (all fading at the bottom so he melts into the disc) */}
        <group ref={portrait}>
          <PortraitReflection />
          <group position={[-0.2, -0.11, -0.07]}>
            <AssetPlane
              url="/assets/portrait.png"
              height={3.1}
              renderOrder={2.5}
              color="#000000"
              opacity={0.26}
              fadeBottom
            />
          </group>
          <group position={[0.02, 0.005, -0.03]} scale={1.025}>
            <AssetPlane
              url="/assets/portrait.png"
              height={3.1}
              renderOrder={3}
              color="#d8a94f"
              opacity={0.32}
              additive
              fadeBottom
              meshRef={rimMesh}
            />
          </group>
          <AssetPlane
            url="/assets/portrait.png"
            height={3.1}
            renderOrder={4}
            fadeBottom
          />
        </group>

        {/* open-to-work badge — stays with the core, over the front rim */}
        <group ref={badge}>
          <AssetPlane
            url="/assets/open-to-work.png"
            height={0.52}
            renderOrder={6}
          />
        </group>
      </group>

      {/* ══ CARDS: independent group, keeps its own (larger) scale ══ */}
      <group ref={cardsGrp}>
        <group ref={stack}>
          <AssetPlane
            url="/assets/stack-card.png"
            height={1.58}
            renderOrder={7}
          />
        </group>
        <group ref={expertise}>
          <AssetPlane
            url="/assets/expertise-card.png"
            height={1.6}
            renderOrder={7.2}
          />
        </group>
        <group ref={focus}>
          <AssetPlane
            url="/assets/focus-card.png"
            height={1.56}
            renderOrder={7.4}
          />
        </group>
      </group>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════
   Canvas shell
   ════════════════════════════════════════════════════════════════ */

export default function HeroRig3D() {
  const [compact, setCompact] = useState(false);
  const [wide, setWide] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mqCompact = window.matchMedia("(max-width: 1023.98px)");
    const mqWide = window.matchMedia("(min-width: 1280px)");
    const mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setCompact(mqCompact.matches);
      setWide(mqWide.matches);
      setReduced(mqReduce.matches);
    };
    sync();
    mqCompact.addEventListener("change", sync);
    mqWide.addEventListener("change", sync);
    mqReduce.addEventListener("change", sync);
    return () => {
      mqCompact.removeEventListener("change", sync);
      mqWide.removeEventListener("change", sync);
      mqReduce.removeEventListener("change", sync);
    };
  }, []);

  return (
    <Canvas
      flat
      dpr={[1, 1.75]}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      }}
      camera={{ fov: 36, near: 0.1, far: 100, position: [0.25, 0.05, 7.4] }}
      style={{ pointerEvents: "none" }}
    >
      <Suspense fallback={null}>
        <RigScene compact={compact} wide={wide} reduced={reduced} />
      </Suspense>
    </Canvas>
  );
}
