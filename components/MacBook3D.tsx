"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
} from "react";
import * as THREE from "three";
import { Canvas, createPortal, useFrame, useThree } from "@react-three/fiber";
import {
  useGLTF,
  ContactShadows,
  Environment,
  Lightformer,
} from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import gsap from "gsap";
import { swScroll } from "./swScrollBus";
import { FEATURED_PROJECTS, type FeaturedProject } from "./projects";
import styles from "./SelectedWork.module.css";

const MODEL_URL = "/assets/macbook-ultra-concept/source/MacBook Ultra.glb";
const N = FEATURED_PROJECTS.length;
const TRANSITIONS = N - 1;

const TARGET_WIDTH = 3.6;
/* Hinge (verified against GLB accessors): 0 = closed flat over the deck,
   negative X opens the display toward the camera. */
const LID_CLOSED = -0.1;
const LID_OPEN = -Math.PI / 2 - 0.14;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
/** smootherstep — zero 1st AND 2nd derivative at both ends */
const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const bump = (t: number) => Math.sin(Math.PI * clamp01(t));
const easeIO = gsap.parseEase("power2.inOut");
const easeOut = gsap.parseEase("power3.out");

const pad = (n: number) => String(n + 1).padStart(2, "0");

/* segment helper: which transition k, and local progress within it */
function seg(p: number) {
  const f = Math.min(p * TRANSITIONS, TRANSITIONS - 1e-5);
  const k = Math.max(0, Math.floor(f));
  return { k, lt: f - k };
}

/* ════════════════════════════════════════════════
   Cinematic pose keys (world units around the showcase center)
   ════════════════════════════════════════════════ */
const P_IN0 = { x: -5.1, y: -0.15, z: -1.8, ry: -0.55, rx: -0.05, rz: -0.025, s: 0.79 };
const P_SHOW = { x: 0, y: 0, z: 0, ry: 0.08, rx: -0.025, rz: 0, s: 1 };
const P_OUT1 = { x: 5.6, y: 0.1, z: -2.2, ry: 0.55, rx: 0.06, rz: 0.025, s: 0.77 };

/* ════════════════════════════════════════════════
   Model rig — per-unit clone with independently fadable materials
   ════════════════════════════════════════════════ */

interface MacRig {
  root: THREE.Object3D;
  lid: THREE.Object3D | null;
  anchor: THREE.Group;
  screenWorld: { w: number; h: number };
  fadeMats: THREE.Material[];
  setOpacity: (v: number) => void;
}

function useMacRig(): MacRig {
  const { scene } = useGLTF(MODEL_URL);

  return useMemo(() => {
    const root = SkeletonUtils.clone(scene);

    // normalize: TARGET_WIDTH wide, resting on y=0, centered
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const s = TARGET_WIDTH / size.x;
    root.scale.setScalar(s);
    const box2 = new THREE.Box3().setFromObject(root);
    const center = new THREE.Vector3();
    box2.getCenter(center);
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= box2.min.y;

    const lid = root.getObjectByName("Lid") ?? null;
    const anchor = new THREE.Group();
    let screenWorld = { w: 3.4, h: 2.2 };
    const fadeMats: THREE.Material[] = [];

    const blackPanel = new THREE.MeshPhysicalMaterial({
      color: "#020202",
      roughness: 0.16,
      metalness: 0.1,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const clearGlass = new THREE.MeshPhysicalMaterial({
      color: "#0a0a0a",
      transparent: true,
      opacity: 0.06,
      roughness: 0.05,
      metalness: 0,
      depthWrite: false,
    });

    let lcd: THREE.Mesh | null = null;
    let bestArea = 0;

    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mat, mi) => {
        const name = mat?.name ?? "";
        if (
          name === "Display glass nanotexture" ||
          name === "Plastic cover" ||
          name === "Rubber gasket"
        ) {
          const m = blackPanel;
          if (Array.isArray(mesh.material)) mesh.material[mi] = m;
          else mesh.material = m;
          return;
        }
        if (name === "Display glass") {
          if (Array.isArray(mesh.material)) mesh.material[mi] = clearGlass;
          else mesh.material = clearGlass;
          return;
        }
        if (name === "LCD") {
          const m = blackPanel;
          if (Array.isArray(mesh.material)) mesh.material[mi] = m;
          else mesh.material = m;
          mesh.geometry.computeBoundingBox();
          const d = new THREE.Vector3();
          mesh.geometry.boundingBox!.getSize(d);
          const sorted = [d.x, d.y, d.z].sort((a, b) => b - a);
          if (sorted[0] * sorted[1] > bestArea) {
            bestArea = sorted[0] * sorted[1];
            lcd = mesh;
          }
          return;
        }
        // every other material: clone per unit so cross-fading two
        // MacBooks never bleeds between instances
        const cloned = mat.clone();
        if (Array.isArray(mesh.material)) mesh.material[mi] = cloned;
        else mesh.material = cloned;
      });
    });

    // collect every material for the whole-device fade (shared black/glass
    // panels included — they're created per-rig above)
    const seen = new Set<THREE.Material>();
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(
        (m) => {
          if (!m || seen.has(m)) return;
          seen.add(m);
          fadeMats.push(m);
        }
      );
    });

    if (lcd) {
      const m = lcd as THREE.Mesh;
      m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox!;
      const dims = new THREE.Vector3();
      bb.getSize(dims);
      const c = new THREE.Vector3();
      bb.getCenter(c);
      const axes: ("x" | "y" | "z")[] = ["x", "y", "z"];
      const normalAxis = axes.reduce((a, b) => (dims[a] < dims[b] ? a : b));
      const planar = axes.filter((a) => a !== normalAxis);
      screenWorld = {
        w: Math.max(dims[planar[0]], dims[planar[1]]),
        h: Math.min(dims[planar[0]], dims[planar[1]]),
      };
      anchor.position.copy(c);
      anchor.position[normalAxis] -= dims[normalAxis] / 2 + 0.0016;
      if (normalAxis === "y") anchor.rotation.x = Math.PI / 2;
      if (normalAxis === "x") anchor.rotation.y = -Math.PI / 2;
      (lcd as THREE.Mesh).parent?.add(anchor);
    } else if (lid) {
      lid.add(anchor);
    }

    /* All materials stay PERMANENTLY transparent — toggling the flag
       triggers shader recompiles mid-scroll, which reads as a frame
       hitch/snap at segment boundaries. */
    for (const m of fadeMats) m.transparent = true;

    const setOpacity = (v: number) => {
      const t = clamp01(v);
      // fully hidden units leave the render list entirely: no depth
      // punch-through, no frustum cost, safe to recycle
      root.visible = t > 0.02;
      for (const m of fadeMats) {
        if (m === clearGlass) {
          m.opacity = 0.06 * t;
          continue;
        }
        m.opacity = t;
      }
    };

    return { root, lid, anchor, screenWorld, fadeMats, setOpacity };
  }, [scene]);
}

/* ════════════════════════════════════════════════
   Screen content — texture plane on the LCD (alignment-proven).
   Opacity is frame-driven, synced to the lid opening.
   ════════════════════════════════════════════════ */

function makePlaceholderTexture(project: FeaturedProject, idx: number) {
  const W = 1280;
  const H = 834;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;

  g.fillStyle = "#080503";
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, -H * 0.2, 40, W / 2, -H * 0.2, H);
  glow.addColorStop(0, `${project.accentColor}2e`);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);

  g.fillStyle = "rgba(216,169,79,0.10)";
  g.fillRect(0, 0, W, 64);
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.arc(40 + i * 30, 32, 7, 0, Math.PI * 2);
    g.fillStyle = "rgba(216,169,79,0.30)";
    g.fill();
  }
  g.fillStyle = "rgba(216,169,79,0.14)";
  g.beginPath();
  g.roundRect(140, 14, 360, 36, 18);
  g.fill();
  g.fillStyle = "rgba(236,228,212,0.4)";
  g.font = "500 19px Archivo, Arial, sans-serif";
  g.fillText(`${project.id}.com`, 162, 39);

  const grad = g.createLinearGradient(0, H * 0.3, 0, H * 0.62);
  grad.addColorStop(0, project.accentColor);
  grad.addColorStop(1, `${project.accentColor}55`);
  g.fillStyle = grad;
  g.font = "700 170px Archivo, Arial, sans-serif";
  g.textAlign = "center";
  g.fillText(pad(idx), W / 2, H * 0.5);

  g.fillStyle = "#ece4d4";
  g.font = "600 58px Archivo, Arial, sans-serif";
  g.fillText(project.name, W / 2, H * 0.62);
  g.fillStyle = "rgba(169,158,138,0.85)";
  g.font = "500 26px Archivo, Arial, sans-serif";
  g.fillText(project.category.toUpperCase().split("").join("  "), W / 2, H * 0.685);

  const rule = g.createLinearGradient(W * 0.2, 0, W * 0.8, 0);
  rule.addColorStop(0, "rgba(0,0,0,0)");
  rule.addColorStop(0.5, `${project.accentColor}66`);
  rule.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = rule;
  g.fillRect(W * 0.2, H * 0.86, W * 0.6, 2);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function ScreenPlane({
  rig,
  project,
  idx,
  settled,
  matRef,
}: {
  rig: MacRig;
  project: FeaturedProject;
  idx: number;
  settled: boolean;
  matRef: MutableRefObject<THREE.MeshBasicMaterial | null>;
}) {
  const tex = useMemo(() => {
    const m = project.desktopMedia;
    if (m.type === "image" && m.src) {
      const t = new THREE.TextureLoader().load(m.src);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    }
    if (m.type === "video" && m.src) {
      const v = document.createElement("video");
      v.src = m.src;
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.preload = "metadata";
      const t = new THREE.VideoTexture(v);
      t.colorSpace = THREE.SRGBColorSpace;
      (t as THREE.VideoTexture & { __video?: HTMLVideoElement }).__video = v;
      return t;
    }
    return makePlaceholderTexture(project, idx);
  }, [project, idx]);

  useEffect(() => {
    const v = (tex as THREE.Texture & { __video?: HTMLVideoElement }).__video;
    if (!v) return;
    if (settled) v.play().catch(() => {});
    else v.pause();
  }, [settled, tex]);

  return createPortal(
    <mesh position={[0, 0, 0.0006]}>
      <planeGeometry args={[rig.screenWorld.w, rig.screenWorld.h]} />
      <meshBasicMaterial
        ref={matRef}
        map={tex}
        transparent
        opacity={0}
        toneMapped={false}
      />
    </mesh>,
    rig.anchor
  );
}

/* ════════════════════════════════════════════════
   Registry shared with the camera rig
   ════════════════════════════════════════════════ */

interface UnitHandle {
  group: THREE.Group | null;
  rig: MacRig;
  projectIdx: number;
}
type Registry = MutableRefObject<Record<string, UnitHandle>>;

/* ════════════════════════════════════════════════
   One cinematic MacBook
   ════════════════════════════════════════════════ */

function MacUnit({
  unit,
  projectIdx,
  settledIdx,
  reg,
}: {
  unit: "A" | "B";
  projectIdx: number;
  settledIdx: number;
  reg: Registry;
}) {
  const rig = useMacRig();
  const group = useRef<THREE.Group>(null);
  const rim = useRef<THREE.PointLight>(null);
  const screenMat = useRef<THREE.MeshBasicMaterial>(null);
  const phase = unit === "A" ? 0 : 2.4;

  useEffect(() => {
    reg.current[unit] = { group: group.current, rig, projectIdx };
  });

  useFrame((state) => {
    const g = group.current;
    if (!g) return;

    const { k, lt } = seg(swScroll.smooth);
    const isOut = (k % 2 === 0) === (unit === "A");
    const t = state.clock.elapsedTime;

    let x: number, y: number, z: number;
    let ry: number, rx: number, rz: number, s: number;
    let opacity: number;
    let lidT: number; // 0 closed → 1 open
    let presence: number; // drives rim light + screen brightness

    if (isOut) {
      /* showcase → rotate away, curve right & back, close, LONG fade.
         Physical travel spans 15%→95% so motion never stops before the
         opacity reaches zero. */
      const tr = clamp01((lt - 0.15) / 0.8);
      const e = easeIO(tr);
      x = lerp(P_SHOW.x, P_OUT1.x, e);
      y = lerp(P_SHOW.y, P_OUT1.y, e) + 0.18 * bump(e);
      z = lerp(P_SHOW.z, P_OUT1.z, e) - 0.2 * bump(e);
      ry = lerp(P_SHOW.ry, P_OUT1.ry, easeIO(clamp01(tr * 1.12)));
      rx = lerp(P_SHOW.rx, P_OUT1.rx, e);
      rz = lerp(P_SHOW.rz, P_OUT1.rz, e);
      s = lerp(P_SHOW.s, P_OUT1.s, e);
      // continuous long fade: 1 until ~45% of the exit, zero by ~98%
      opacity = 1 - smoother(clamp01((lt - 0.5) / 0.46));
      lidT = lt < 0.15 ? 1 : 1 - 0.9 * smoother(clamp01((lt - 0.18) / 0.6));
      presence = 1 - smoother(clamp01((lt - 0.35) / 0.45));
    } else {
      /* far left & back, lid ajar → curved arrival that decelerates
         naturally: no overshoot, only a whisper of settle at the end */
      const tr = clamp01((lt - 0.15) / 0.8);
      const e = easeOut(tr); // long power3 tail = visible deceleration
      x = lerp(P_IN0.x, P_SHOW.x, e);
      y = lerp(P_IN0.y, P_SHOW.y, e) + 0.22 * bump(e);
      z = lerp(P_IN0.z, P_SHOW.z, e) - 0.15 * bump(e * 0.8);
      ry = lerp(P_IN0.ry, P_SHOW.ry, e) + 0.012 * (1 - smoother(clamp01((lt - 0.8) / 0.2)));
      rx = lerp(P_IN0.rx, P_SHOW.rx, e);
      rz = lerp(P_IN0.rz, P_SHOW.rz, e);
      s = lerp(P_IN0.s, P_SHOW.s, e);
      opacity = smoother(clamp01(tr / 0.34));
      // lid finishes opening slightly BEFORE the device fully settles
      lidT = 0.12 + 0.88 * easeOut(clamp01((lt - 0.28) / 0.5));
      presence = smoother(clamp01((lt - 0.35) / 0.45));
    }

    /* idle breath — only while present and calm */
    const calm = isOut ? 1 - clamp01((lt - 0.15) / 0.2) : clamp01((lt - 0.8) / 0.2);
    const idle = calm * Math.sin(t * 0.55 + phase) * 0.04;

    /* live-mode staging (raw clocked t, pure function → exact reverse):
       0.05–0.45  everything else melts away
       0.15–0.60  MacBook slowly straightens, lid finishes opening
       (the camera travels later — see CameraRig) */
    const tL = clamp01(swScroll.live);
    if (tL > 0.001) {
      const isLive = swScroll.liveIdx === projectIdx;
      if (isLive) {
        const mb = easeIO(clamp01((tL - 0.15) / 0.45));
        x = lerp(x, 0, mb);
        y = lerp(y, 0, mb);
        z = lerp(z, 0.35, mb);
        ry = lerp(ry, 0, mb);
        rx = lerp(rx, -0.005, mb);
        rz = lerp(rz, 0, mb);
        s = lerp(s, 1, mb);
        lidT = lerp(lidT, 1, mb);
        opacity = Math.max(opacity, mb);
      } else {
        opacity *= 1 - easeIO(clamp01((tL - 0.05) / 0.4));
      }
    }

    g.position.set(x, y + idle, z);
    g.rotation.set(rx, ry, rz);
    g.scale.setScalar(s);
    rig.setOpacity(opacity);

    if (rig.lid)
      rig.lid.rotation.x = LID_CLOSED + (LID_OPEN - LID_CLOSED) * clamp01(lidT);

    /* screen: black until the lid is mostly open, then the preview glows
       in; dims again as the lid closes on exit */
    if (screenMat.current) {
      const on = smooth(clamp01((lidT - 0.72) / 0.26));
      screenMat.current.opacity = on * opacity;
    }

    /* warm rim light follows presence */
    if (rim.current) rim.current.intensity = 3.2 * presence * opacity + 0.15;
  });

  const project = FEATURED_PROJECTS[projectIdx];

  return (
    <group ref={group}>
      <primitive object={rig.root} />
      {/* gold rim light hugging the rear edge of this unit */}
      <pointLight
        ref={rim}
        position={[-1.6, 2.2, -1.8]}
        color="#e9b45e"
        intensity={0.15}
        distance={9}
        decay={2}
      />
      <ScreenPlane
        rig={rig}
        project={project}
        idx={projectIdx}
        settled={settledIdx === projectIdx}
        matRef={screenMat}
      />
    </group>
  );
}

/* ════════════════════════════════════════════════
   Camera rig — smoothing, transition choreography, live dive
   ════════════════════════════════════════════════ */

function CameraRig({ reg }: { reg: Registry }) {
  const { camera, viewport } = useThree();
  const tmp = useRef({
    look: new THREE.Vector3(),
    aPos: new THREE.Vector3(),
    aDir: new THREE.Vector3(),
    q: new THREE.Quaternion(),
  });
  /* dev-only frame-to-frame snap detector state */
  const snap = useRef({
    init: false,
    prog: 0,
    cam: new THREE.Vector3(),
    a: new THREE.Vector3(),
    b: new THREE.Vector3(),
  });

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    // swScroll.smooth is damped by SelectedWork's gsap ticker (single
    // writer). The live dive is a deterministic CLOCK, not a damp:
    // 2.4s in, 2.2s out — a pure, exactly reversible progress value.
    if (swScroll.liveTarget === 1 && swScroll.live < 1)
      swScroll.live = Math.min(1, swScroll.live + dt / 2.4);
    else if (swScroll.liveTarget === 0 && swScroll.live > 0)
      swScroll.live = Math.max(0, swScroll.live - dt / 2.2);

    const portrait = viewport.aspect < 1.05;
    const { lt } = seg(swScroll.smooth);
    const phase = clamp01((lt - 0.15) / 0.85);
    const b = bump(phase);
    const amp = portrait ? 0.45 : 1;

    /* base + transition choreography: drift toward the incoming side,
       dolly in around the midpoint, look-at sweeps out → in → center */
    let px = (portrait ? 0 : 0.25) - 0.27 * amp * Math.sin(Math.PI * Math.min(phase * 1.12, 1));
    let py = (portrait ? -0.4 : 0.05) + 0.08 * amp * b;
    let pz = (portrait ? 7.9 : 7.4) - 0.32 * amp * b;
    const lookBase = portrait ? -0.32 : 0.08;
    /* look-at sweep: briefly toward the departing screen, then across to
       the incoming one, back to center. Both terms are ZERO at phase 0
       and 1, so segment boundaries are perfectly continuous. */
    let lx =
      amp *
      (0.26 * bump(clamp01(phase / 0.55)) -
        0.48 * bump(clamp01((phase - 0.3) / 0.7)));
    let ly = lookBase - 0.05 * amp * b;
    let lz = 0;
    let fov = 34 - 2.6 * b;

    /* live dive: the camera starts travelling only after the MacBook has
       begun straightening (0.30–0.85 of the clocked live progress) — the
       viewer feels the dolly through space, and the reverse retreats
       along exactly the same path */
    const tL = clamp01(swScroll.live);
    if (tL > 0.001) {
      const cb = easeIO(clamp01((tL - 0.3) / 0.55));
      const handles = Object.values(reg.current);
      const active = handles.find((h) => h.projectIdx === swScroll.liveIdx);
      if (active?.rig.anchor && cb > 0.0001) {
        const v = tmp.current;
        active.rig.anchor.getWorldPosition(v.aPos);
        active.rig.anchor.getWorldQuaternion(v.q);
        v.aDir.set(0, 0, 1).applyQuaternion(v.q).normalize();
        const dist = portrait ? 2.1 : 1.55;
        px = lerp(px, v.aPos.x + v.aDir.x * dist, cb);
        py = lerp(py, v.aPos.y + v.aDir.y * dist, cb);
        pz = lerp(pz, v.aPos.z + v.aDir.z * dist, cb);
        lx = lerp(lx, v.aPos.x, cb);
        ly = lerp(ly, v.aPos.y, cb);
        lz = lerp(lz, v.aPos.z, cb);
        fov = lerp(fov, 30, cb);
      }
    }

    camera.position.set(px, py, pz);
    tmp.current.look.set(lx, ly, lz);
    camera.lookAt(tmp.current.look);
    if ((camera as THREE.PerspectiveCamera).fov !== fov) {
      (camera as THREE.PerspectiveCamera).fov = fov;
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }
    // NOTE: no positive useFrame priority here — that would switch R3F
    // into manual-render mode and blank the whole canvas.

    /* dev snap detector (?swdebug): flags any single-frame jump while
       scroll velocity is low — used to hunt boundary discontinuities */
    if (
      process.env.NODE_ENV === "development" &&
      typeof window !== "undefined" &&
      window.location.search.includes("swdebug")
    ) {
      const s = snap.current;
      const vel = Math.abs(swScroll.progress - s.prog);
      if (s.init && vel < 0.004 && swScroll.live === 0) {
        const camD = Math.hypot(
          px - s.cam.x,
          py - s.cam.y,
          pz - s.cam.z
        );
        if (camD > 0.05)
          console.warn(`[snap] camera moved ${camD.toFixed(3)} in one frame`);
        (["A", "B"] as const).forEach((u) => {
          const h = reg.current[u];
          if (!h?.group || !h.rig.root.visible) return;
          const prev = u === "A" ? s.a : s.b;
          const d = h.group.position.distanceTo(prev);
          if (d > 0.06)
            console.warn(`[snap] mac ${u} moved ${d.toFixed(3)} in one frame`);
        });
      }
      s.cam.set(px, py, pz);
      if (reg.current.A?.group) s.a.copy(reg.current.A.group.position);
      if (reg.current.B?.group) s.b.copy(reg.current.B.group.position);
      s.prog = swScroll.progress;
      s.init = true;
    }
  });

  return null;
}

/* ════════════════════════════════════════════════
   Stage placement + canvas shell
   ════════════════════════════════════════════════ */

function StageRoot({ children }: { children: React.ReactNode }) {
  const { viewport } = useThree();
  const portrait = viewport.aspect < 1.05;
  return (
    <group
      position={portrait ? [0, 0.78, 0] : [-viewport.width * 0.16, -0.95, 0]}
      scale={portrait ? 0.5 : 1}
    >
      {children}
    </group>
  );
}

export default function MacBook3D({
  aIdx,
  bIdx,
  settledIdx,
}: {
  aIdx: number;
  bIdx: number;
  settledIdx: number;
}) {
  const reg = useRef<Record<string, UnitHandle>>({});

  return (
    <Canvas
      className={styles.macCanvas}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ fov: 34, near: 0.1, far: 60, position: [0.25, 0.05, 7.4] }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.5} color="#fff0da" />
        <directionalLight position={[5, 7, 5]} intensity={1.2} color="#ffe6b8" />
        <directionalLight position={[-6, 3, 2]} intensity={0.4} color="#d8a94f" />

        <Environment resolution={64}>
          <Lightformer intensity={1.6} color="#f3d791" position={[4, 4, 4]} scale={[7, 3, 1]} />
          <Lightformer intensity={0.8} color="#fff6e6" position={[-5, 6, -3]} scale={[9, 3, 1]} />
          <Lightformer intensity={1} color="#b97f2e" position={[0, -3, 6]} scale={[12, 2, 1]} />
        </Environment>

        <StageRoot>
          <MacUnit unit="A" projectIdx={aIdx} settledIdx={settledIdx} reg={reg} />
          <MacUnit unit="B" projectIdx={bIdx} settledIdx={settledIdx} reg={reg} />
          <ContactShadows
            position={[0, 0.005, 0]}
            opacity={0.55}
            scale={13}
            blur={2.6}
            far={3.2}
            resolution={512}
            color="#000000"
          />
        </StageRoot>

        <CameraRig reg={reg} />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload(MODEL_URL);
