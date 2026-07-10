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

/* companion iPhone — real 3D model beside the hero laptop. Its website
   pixels come from a crisp DOM overlay (native dpr); the GLB gives real
   volume + lighting + scroll-driven turn. */
const PHONE_MODEL_URL = "/assets/iphone/iphone_16_-_free.glb";
const PHONE_WIDTH = 0.76; // world units — a companion beside the mac
const PHONE_SCREEN_MESH = "Object_18"; // flat display plane in this GLB
const PHONE_SCREEN_INSET = 0.95; // overlay sits WITHIN the display, no bezel bleed
/* front-right of the hero, LOW so it stands beside the keyboard and never
   covers the laptop's screen (the DOM overlays would otherwise fight) */
const PHONE_POS = { x: 2.05, y: 0.18, z: 2.15 };
const N = FEATURED_PROJECTS.length;
const TRANSITIONS = N - 1;

const TARGET_WIDTH = 3.6;
/* Hinge (verified against GLB accessors): 0 = closed flat over the deck,
   negative X opens the display toward the camera. */
const LID_CLOSED = -0.1;
const LID_OPEN = -Math.PI / 2 - 0.14;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
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
/** THE canonical settled pose — the single source for "on stage".
 *  rx tips the WHOLE unit forward (lid angle untouched) so the camera
 *  looks slightly down onto the deck and the keyboard reads clearly. */
const P_SHOW = { x: 0, y: 0.05, z: 0, ry: 0.08, rx: 0.13, rz: 0, s: 1 };

export interface UnitPose {
  x: number;
  y: number;
  z: number;
  ry: number;
  rx: number;
  rz: number;
  s: number;
  opacity: number;
  lidT: number;
  presence: number;
}

/**
 * ONE continuous pose function of signed project distance.
 *
 *   d = absoluteProjectPosition − projectIndex
 *   absoluteProjectPosition = smoothGlobalProgress · (N − 1)
 *
 *   d ≤ −1   hidden-left pose        (opacity 0)
 *   −1<d<0   continuous incoming curve
 *   d = 0    canonical settled pose  (P_SHOW, by construction)
 *   0<d<1    continuous outgoing curve
 *   d ≥ 1    hidden-right pose       (opacity 0)
 *
 * There is NO separate settled branch: the same formulas that animate the
 * approach evaluate to exactly P_SHOW at d = 0 (every arc/settle term is
 * zero at both ends), so no visual-state handoff can ever produce a jump.
 * A unit's project assignment may only change while |d| ≥ 1 (invisible).
 */
/* DÖNEN VİTRİN (r22): units live on an invisible turntable. Scroll
   rotates the ring; the unit at angle 0 faces the camera and IS P_SHOW
   by construction (sin0=0, cos0=1 → every ring term vanishes at d=0),
   so the overlay quad, live dive and boundary assertion are untouched.
   Neighbours stay on stage as dark graphite silhouettes (shade, not
   opacity) — the showcase-archive look approved in the lab. */
/* ELLIPTICAL turntable: wide horizontally so two units are never side-by-side
   at the close, low Work-section camera. At the transition midpoint the two
   active units sit at ±30° → x-separation = RING_RX (6.6), well clear of the
   3.6-wide device. Depth (RZ) sinks the flanks back so the front unit reads
   as the single hero. */
const RING_RX = 6.6;
const RING_RZ = 5.2;
const RING_STEP = (Math.PI * 2) / N;

function poseFromDistance(d: number): UnitPose {
  /* +d: the OUTGOING unit exits stage-right (behind the editorial text
     panel, exactly like the old choreography) and the INCOMING arrives
     from the open stage-left. Also matches the camera's left drift. */
  const a = d * RING_STEP; // 0 = front/settled
  const front = Math.cos(a);
  const w = clamp01((front - 0.1) / 0.9);
  const w2 = w * w;
  const w3 = w2 * w;
  return {
    x: Math.sin(a) * RING_RX + P_SHOW.x,
    y: P_SHOW.y,
    z: (front - 1) * RING_RZ + P_SHOW.z,
    ry: a + P_SHOW.ry,
    rx: P_SHOW.rx,
    rz: P_SHOW.rz,
    /* neighbours a touch smaller so the hero dominates; front = full */
    s: P_SHOW.s * (0.8 + 0.2 * w2),
    /* editorial, not carousel: the hero is solid, flanks drop to faint
       ghosts (rest ≈0.2) so the scene reads as ONE device, not a rack.
       The incoming/outgoing pair still ramps up as it rotates to front. */
    opacity: smoother(clamp01((front - 0.3) / 0.7)),
    lidT: 0.16 + 0.84 * easeOut(clamp01((front - 0.45) / 0.5)),
    presence: w3,
  };
}

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
  /** 1 = full colour, 0 = pitch-black silhouette (opaque, not glassy) */
  setShade: (v: number) => void;
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
        /* the GLB ships materials with real transmission — three runs an
           extra full-scene transmission pass for them EVERY frame, and
           that pass corrupts clear-color state under nested renders
           (mirror floor). Dark stage needs no true refraction: kill it.
           Leave opacity alone — forcing translucency here made bodies
           see-through so the mirror bled over them. */
        const ph = cloned as THREE.MeshPhysicalMaterial;
        if (ph.transmission !== undefined && ph.transmission > 0) {
          ph.transmission = 0;
        }
        if (Array.isArray(mesh.material)) mesh.material[mi] = cloned;
        else mesh.material = cloned;
      });
    });

    // collect every material for the whole-device fade (shared black/glass
    // panels included — they're created per-rig above)
    const seen = new Set<THREE.Material>();
    const colorMats: { m: THREE.Material & { color?: THREE.Color }; base: THREE.Color }[] = [];
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(
        (m) => {
          if (!m || seen.has(m)) return;
          seen.add(m);
          fadeMats.push(m);
          const cm = m as THREE.Material & { color?: THREE.Color };
          if (cm.color) colorMats.push({ m: cm, base: cm.color.clone() });
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

    const setShade = (v: number) => {
      const t = clamp01(v);
      for (const { m, base } of colorMats) m.color!.copy(base).multiplyScalar(t);
    };

    return { root, lid, anchor, screenWorld, fadeMats, setOpacity, setShade };
  }, [scene]);
}

/* ════════════════════════════════════════════════
   Screen content — texture plane on the LCD (alignment-proven).
   Opacity is frame-driven, synced to the lid opening.
   ════════════════════════════════════════════════ */

/* Placeholder screens are drawn + GPU-uploaded exactly once per project
   and reused every time a slot is recycled — creating them during a
   boundary crossing cost a visible frame on mid GPUs. */
const placeholderCache = new Map<string, THREE.CanvasTexture>();
function getPlaceholderTexture(project: FeaturedProject, idx: number) {
  let t = placeholderCache.get(project.id);
  if (!t) {
    t = makePlaceholderTexture(project, idx);
    placeholderCache.set(project.id, t);
  }
  return t;
}

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

/* Screen fit — the GLB's "screen" mesh spans the ENTIRE lid face, so
   content mapped to it touches the aluminum edge and reads as a
   sticker. The actual display opening is an inset of that glass: the
   glossy-black panel underneath shows through the remaining ring as a
   real bezel. Shared by the 3D plane AND the DOM overlay quad. */
export const SCREEN_INSET = 0.96;
const SCREEN_Y_BIAS = 0; // × screen height, + = up
/** macOS menu bar + Safari toolbar height as a fraction of the screen
 *  (40px + 62px of a 1040px-tall source — keep in sync with the DOM
 *  overlay chrome in SelectedWork.module.css) */
export const CHROME_FRAC = 102 / 1040;

/* Rounded-corner alpha mask for the display: the MacBook's screen has
   rounded top corners, and a rectangular texture pokes past them on
   light content. Cached once; used as alphaMap by every screen. */
let screenMask: THREE.CanvasTexture | null = null;
function getScreenMask() {
  if (screenMask) return screenMask;
  const W = 512;
  const H = 334;
  const r = Math.round(H * 0.038);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#fff";
  g.beginPath();
  g.roundRect(0, 0, W, H, r);
  g.fill();
  screenMask = new THREE.CanvasTexture(c);
  return screenMask;
}

/* partial masks for the split screen: the chrome strip owns the top
   corners, the site viewport owns the bottom corners */
const partialMasks = new Map<string, THREE.CanvasTexture>();
function getPartialMask(which: "top" | "bottom") {
  let t = partialMasks.get(which);
  if (t) return t;
  const W = 512;
  /* real proportions: full screen 1040 tall, chrome 102, viewport 938;
     corner radius 40px of real scale */
  const H = which === "top" ? Math.round((512 * 102) / 1600) : Math.round((512 * 938) / 1600);
  const r = Math.round((40 / 1600) * 512);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#fff";
  g.beginPath();
  g.roundRect(0, 0, W, H, which === "top" ? [r, r, 0, 0] : [0, 0, r, r]);
  g.fill();
  t = new THREE.CanvasTexture(c);
  partialMasks.set(which, t);
  return t;
}

/* macOS + Safari chrome for the 3D screen texture — the same design as
   the DOM overlay's CSS chrome, drawn to canvas so the menu/toolbar are
   visible WHILE THE LAPTOP TRAVELS too. Cached per hostname. */
const chromeCache = new Map<string, THREE.CanvasTexture>();
function getChromeTexture(host: string) {
  let t = chromeCache.get(host);
  if (t) return t;
  const W = 1600;
  const H = 102;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;

  /* menu bar */
  g.fillStyle = "#f4f2ef";
  g.fillRect(0, 0, W, 40);
  g.fillStyle = "rgba(0,0,0,0.08)";
  g.fillRect(0, 39, W, 1);
  g.fillStyle = "#1d1d1f";
  /* apple silhouette (simplified) */
  g.beginPath();
  g.arc(36, 22, 8, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(40, 11, 4, 2.6, -0.6, 0, Math.PI * 2);
  g.fill();
  g.font = "700 17px Arial";
  g.fillText("Safari", 58, 27);
  g.font = "500 16px Arial";
  const items = ["File", "Edit", "View", "History", "Bookmarks", "Window", "Help"];
  let x = 128;
  for (const it of items) {
    g.fillText(it, x, 27);
    x += g.measureText(it).width + 24;
  }
  /* right cluster */
  g.textAlign = "right";
  g.fillText("Paz 14:32", W - 26, 27);
  g.fillRect(W - 148, 15, 24, 12);
  g.fillRect(W - 122, 18, 3, 6);
  g.textAlign = "left";
  /* notch */
  g.fillStyle = "#000";
  g.beginPath();
  g.roundRect(W / 2 - 98, 0, 196, 30, [0, 0, 14, 14]);
  g.fill();

  /* safari toolbar */
  g.fillStyle = "#ece9e4";
  g.fillRect(0, 40, W, 62);
  g.fillStyle = "rgba(0,0,0,0.12)";
  g.fillRect(0, 101, W, 1);
  const dots: [string, number][] = [["#ff5f57", 40], ["#febc2e", 70], ["#28c840", 100]];
  for (const [col, dx] of dots) {
    g.fillStyle = col;
    g.beginPath();
    g.arc(dx, 71, 9, 0, Math.PI * 2);
    g.fill();
  }
  /* back / forward arrows */
  g.strokeStyle = "#4a4a4d";
  g.lineWidth = 2.4;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.beginPath();
  g.moveTo(152, 62);
  g.lineTo(142, 71);
  g.lineTo(152, 80);
  g.stroke();
  g.globalAlpha = 0.35;
  g.beginPath();
  g.moveTo(180, 62);
  g.lineTo(190, 71);
  g.lineTo(180, 80);
  g.stroke();
  g.globalAlpha = 1;
  /* url pill */
  const pw = 640;
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.roundRect(W / 2 - pw / 2, 51, pw, 40, 11);
  g.fill();
  g.strokeStyle = "rgba(0,0,0,0.07)";
  g.lineWidth = 1.5;
  g.stroke();
  g.fillStyle = "#333";
  g.font = "500 17px Arial";
  g.textAlign = "center";
  const label = "  " + host;
  g.fillText(label, W / 2 + 6, 77);
  /* padlock */
  const lockX = W / 2 - g.measureText(label).width / 2 - 6;
  g.fillStyle = "#7a7a7e";
  g.beginPath();
  g.roundRect(lockX - 12, 68, 12, 9, 2);
  g.fill();
  g.strokeStyle = "#7a7a7e";
  g.lineWidth = 1.8;
  g.beginPath();
  g.arc(lockX - 6, 68, 3.6, Math.PI, 0);
  g.stroke();
  g.textAlign = "left";

  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  chromeCache.set(host, t);
  return t;
}

/* Glass overlay — subtle edge vignette + a faint diagonal sheen, baked
   into one texture and clipped by the same rounded rect. This is what
   sells "a real display" instead of a flat texture: the panel picks up
   a whisper of ambient reflection and darkens toward the bezel. */
let screenGlass: THREE.CanvasTexture | null = null;
function getScreenGlass() {
  if (screenGlass) return screenGlass;
  const W = 1024;
  const H = 668;
  const r = Math.round(H * 0.038);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, W, H);
  g.beginPath();
  g.roundRect(0, 0, W, H, r);
  g.clip();
  /* edge vignette */
  const vg = g.createRadialGradient(
    W / 2, H / 2, H * 0.42,
    W / 2, H / 2, H * 0.95
  );
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.30)");
  g.fillStyle = vg;
  g.fillRect(0, 0, W, H);
  /* diagonal sheen sweeping from the upper-left */
  const sh = g.createLinearGradient(0, 0, W * 0.9, H);
  sh.addColorStop(0, "rgba(255,255,255,0.10)");
  sh.addColorStop(0.22, "rgba(255,255,255,0.035)");
  sh.addColorStop(0.45, "rgba(255,255,255,0)");
  sh.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = sh;
  g.fillRect(0, 0, W, H);
  /* opaque bezel-black caps on the bottom corners: they round the video
     plane below without an alphaMap (VideoTexture + alphaMap renders
     black in three — the top corners are rounded by the chrome strip's
     own mask, which is a CanvasTexture and unaffected) */
  g.fillStyle = "#050403";
  const cr = Math.round(H * 0.038);
  g.beginPath();
  g.moveTo(0, H);
  g.lineTo(cr, H);
  g.arc(cr, H - cr, cr, Math.PI / 2, Math.PI);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(W, H);
  g.lineTo(W, H - cr);
  g.arc(W - cr, H - cr, cr, 0, Math.PI / 2);
  g.closePath();
  g.fill();
  screenGlass = new THREE.CanvasTexture(c);
  screenGlass.colorSpace = THREE.SRGBColorSpace;
  return screenGlass;
}

/**
 * All screen videos derive their playhead from the SHARED settle epoch
 * (swScroll.mediaEpoch): every arrival starts the presentation from its
 * first frame, and the laptop + phone stay in the same loop phase no
 * matter when each element starts playing.
 */
export function syncVideoPhase(v: HTMLVideoElement) {
  const apply = () => {
    if (v.duration && isFinite(v.duration))
      v.currentTime =
        ((performance.now() - swScroll.mediaEpoch) / 1000) % v.duration;
  };
  if (v.readyState >= 1) apply();
  else v.addEventListener("loadedmetadata", apply, { once: true });
}

/* object-fit: cover / top for a WebGL texture: crop the overflowing axis so
   the media fills the plane WITHOUT stretching, anchored to the TOP (browser
   viewports read top-down). Matches the DOM overlay's object-fit:cover so the
   soft WebGL screen and the crisp DOM overlay frame the site identically —
   the old fixed-fraction crop stretched the site vertically ("aşağı genişleme"
   during the incoming laptop's approach, before the DOM overlay took over). */
function applyCoverCropTop(
  t: THREE.Texture,
  mediaW: number,
  mediaH: number,
  planeAspect: number
) {
  if (!mediaW || !mediaH || !isFinite(planeAspect)) return;
  const mediaAspect = mediaW / mediaH;
  if (mediaAspect > planeAspect) {
    // media wider than the plane → crop the sides, keep full height, centered
    const r = planeAspect / mediaAspect;
    t.repeat.set(r, 1);
    t.offset.set((1 - r) / 2, 0);
  } else {
    // media taller than the plane → crop the bottom, keep full width, top-anchored
    const r = mediaAspect / planeAspect;
    t.repeat.set(1, r);
    t.offset.set(0, 1 - r); // flipY: V=1 is the image top → show [1-r, 1]
  }
  t.needsUpdate = true;
}

function ScreenPlane({
  rig,
  project,
  idx,
  settled,
  matRef,
  glassRef,
  chromeRef,
}: {
  rig: MacRig;
  project: FeaturedProject;
  idx: number;
  settled: boolean;
  matRef: MutableRefObject<THREE.MeshBasicMaterial | null>;
  glassRef: MutableRefObject<THREE.MeshBasicMaterial | null>;
  chromeRef: MutableRefObject<THREE.MeshBasicMaterial | null>;
}) {
  const hasRealMedia = !!project.desktopMedia.src;
  const host = useMemo(() => {
    try {
      return project.liveUrl
        ? new URL(project.liveUrl).hostname.replace(/^www\./, "")
        : "localhost";
    } catch {
      return "localhost";
    }
  }, [project]);

  const tex = useMemo(() => {
    const m = project.desktopMedia;
    /* raw texture; the aspect-correct cover crop (matching the DOM overlay's
       object-fit:cover/top) is applied in the effect below once the media's
       natural dimensions and the screen-plane aspect are both known */
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
      v.preload = "auto";
      const t = new THREE.VideoTexture(v);
      t.colorSpace = THREE.SRGBColorSpace;
      (t as THREE.VideoTexture & { __video?: HTMLVideoElement }).__video = v;
      /* debug handle — the element lives off-DOM and is otherwise
         unreachable from devtools */
      if (typeof window !== "undefined") {
        const w = window as unknown as { __swVids?: Record<string, HTMLVideoElement> };
        (w.__swVids ||= {})[project.id + ":" + idx] = v;
      }
      return t;
    }
    return getPlaceholderTexture(project, idx);
  }, [project, idx]);

  useEffect(() => {
    const v = (tex as THREE.Texture & { __video?: HTMLVideoElement }).__video;
    if (!v) return;
    if (settled) {
      const tryPlay = () => {
        syncVideoPhase(v);
        v.play().catch(() => {});
      };
      if (v.readyState >= 2) tryPlay();
      else {
        v.addEventListener("canplay", tryPlay, { once: true });
        v.load();
      }
    } else {
      v.pause();
      /* the incoming/outgoing transit frame is the presentation's
         FIRST frame, not wherever playback happened to stop */
      v.currentTime = 0;
    }
  }, [settled, tex]);

  /* Chromium does not reliably fire frame callbacks for off-DOM video
     elements, so the VideoTexture never marked itself dirty — the 3D
     screen stayed black while the video was audibly "playing". Mark the
     texture dirty on every rendered frame while playing, and once per
     seek/load while paused (transit frame). */
  const texDirty = useRef(true);
  useEffect(() => {
    const v = (tex as THREE.Texture & { __video?: HTMLVideoElement }).__video;
    if (!v) return;
    const mark = () => {
      texDirty.current = true;
    };
    v.addEventListener("seeked", mark);
    v.addEventListener("loadeddata", mark);
    return () => {
      v.removeEventListener("seeked", mark);
      v.removeEventListener("loadeddata", mark);
    };
  }, [tex]);
  useFrame(() => {
    const v = (tex as THREE.Texture & { __video?: HTMLVideoElement }).__video;
    if (!v) return;
    if (v.readyState >= 2 && (!v.paused || texDirty.current)) {
      tex.needsUpdate = true;
      texDirty.current = false;
    }
  });

  const w = rig.screenWorld.w * SCREEN_INSET;
  const h = rig.screenWorld.h * SCREEN_INSET;
  const yOff = rig.screenWorld.h * SCREEN_Y_BIAS;
  const chrH = h * CHROME_FRAC;
  const vidH = h - chrH;
  const chrY = yOff + (h - chrH) / 2;
  const vidY = yOff - chrH / 2;

  /* cover-crop the site texture to the viewport plane once the media's
     natural size is known — the plane is w × vidH, so its aspect is the
     cover target. Keeps the WebGL screen framed exactly like the DOM
     overlay (no vertical stretch during the incoming laptop's approach). */
  const siteAspect = w / vidH;
  useEffect(() => {
    if (!hasRealMedia) return;
    const t = tex as THREE.Texture & { __video?: HTMLVideoElement };
    const fit = () => {
      const src = t.image as
        | (HTMLImageElement & HTMLVideoElement)
        | undefined;
      const mw = src?.videoWidth || src?.naturalWidth || src?.width || 0;
      const mh = src?.videoHeight || src?.naturalHeight || src?.height || 0;
      if (mw && mh) {
        applyCoverCropTop(t, mw, mh, siteAspect);
        return true;
      }
      return false;
    };
    if (fit()) return;
    const v = t.__video;
    if (v) {
      v.addEventListener("loadedmetadata", fit, { once: true });
      return () => v.removeEventListener("loadedmetadata", fit);
    }
    const im = t.image as HTMLImageElement | undefined;
    if (im && "addEventListener" in im) {
      im.addEventListener("load", fit, { once: true });
      return () => im.removeEventListener("load", fit);
    }
  }, [tex, siteAspect, hasRealMedia]);

  return createPortal(
    <>
      {hasRealMedia ? (
        <>
          {/* site viewport (below the chrome) */}
          <mesh position={[0, vidY, 0.0006]}>
            <planeGeometry args={[w, vidH]} />
            <meshBasicMaterial
              ref={matRef}
              map={tex}
              transparent
              opacity={0}
              toneMapped={false}
            />
          </mesh>
          {/* macOS + Safari chrome strip — visible during transit too */}
          <mesh position={[0, chrY, 0.00065]}>
            <planeGeometry args={[w, chrH]} />
            <meshBasicMaterial
              ref={chromeRef}
              map={getChromeTexture(host)}
              alphaMap={getPartialMask("top")}
              transparent
              opacity={0}
              toneMapped={false}
            />
          </mesh>
        </>
      ) : (
        /* placeholder projects draw their own faux chrome */
        <mesh position={[0, yOff, 0.0006]}>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial
            ref={matRef}
            map={tex}
            alphaMap={getScreenMask()}
            transparent
            opacity={0}
            toneMapped={false}
          />
        </mesh>
      )}
      {/* glass layer: vignette + sheen riding just above the content */}
      <mesh position={[0, yOff, 0.0012]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial
          ref={glassRef}
          map={getScreenGlass()}
          transparent
          opacity={0}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </>,
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
  unit: string;
  projectIdx: number;
  settledIdx: number;
  reg: Registry;
}) {
  const rig = useMacRig();
  const group = useRef<THREE.Group>(null);
  const rim = useRef<THREE.PointLight>(null);
  const screenMat = useRef<THREE.MeshBasicMaterial>(null);
  const glassMat = useRef<THREE.MeshBasicMaterial>(null);
  const chromeMat = useRef<THREE.MeshBasicMaterial>(null);
  const phase = projectIdx * 1.7;

  useEffect(() => {
    reg.current[unit] = { group: group.current, rig, projectIdx };
  });

  useFrame((state) => {
    const g = group.current;
    if (!g) return;

    /* ONE continuous transform source: signed distance from this unit's
       project to the damped absolute position. No role logic, no
       incoming→settled handoff — poseFromDistance(0) IS the settled
       pose, so the approach flows into it with nothing to switch. */
    const absPos = swScroll.smooth * TRANSITIONS;
    const d = absPos - projectIdx;
    const pose = poseFromDistance(d);
    let { opacity, lidT } = pose;
    const t = state.clock.elapsedTime;

    /* idle breath — only while present and calm, and NEVER during live
       mode (the frozen base scene must not drift under the dive) */
    const calm =
      d >= 0 ? 1 - clamp01((d - 0.15) / 0.2) : clamp01((d + 0.2) / 0.2);
    const tL = clamp01(swScroll.live);
    const liveGate = 1 - clamp01(tL / 0.2);
    const idle = calm * liveGate * Math.sin(t * 0.55 + phase) * 0.04;

    /* live mode: THE LAPTOP DOES NOT MOVE. The dive is camera-only; the
       only live effect here is the companion unit receding (a pure
       function of the clocked live progress → exactly reversible). */
    if (tL > 0.001 && swScroll.liveIdx !== projectIdx) {
      opacity *= 1 - easeIO(clamp01(tL / 0.22));
    }

    g.position.set(pose.x, pose.y + idle, pose.z);
    g.rotation.set(pose.rx, pose.ry, pose.rz);
    g.scale.setScalar(pose.s);
    rig.setOpacity(opacity);
    /* ring shade: the front unit lives in champagne-graphite light,
       flank units sink into shadow as opaque silhouettes */
    rig.setShade(0.09 + 0.55 * pose.presence);

    if (rig.lid)
      rig.lid.rotation.x = LID_CLOSED + (LID_OPEN - LID_CLOSED) * clamp01(lidT);

    /* screen: black until the lid is mostly open, then the preview glows
       in; dims again as the lid closes on exit */
    if (screenMat.current) {
      const lidOn = smooth(clamp01((lidT - 0.72) / 0.26));
      /* OUTGOING: the display fades on the PHONE's exact curve
         (1 - smoother((lt-0.46)/0.42)) so both screens die together;
         the lid-based curve still owns the incoming open-up moment.
         Continuous at d = 0: both branches evaluate to 1. */
      const outHold =
        d > 0 ? 1 - smoother(clamp01((d - 0.2) / 0.28)) : 0;
      const on = Math.max(lidOn, outHold);
      screenMat.current.opacity = on * opacity;
      if (glassMat.current) glassMat.current.opacity = on * opacity;
      if (chromeMat.current) chromeMat.current.opacity = on * opacity;
    }

    /* warm rim light follows presence */
    if (rim.current)
      rim.current.intensity = 3.2 * pose.presence * opacity + 0.15;
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
        glassRef={glassMat}
        chromeRef={chromeMat}
      />
    </group>
  );
}

/* ════════════════════════════════════════════════
   Companion iPhone — real 3D GLB, crisp DOM screen overlay
   ════════════════════════════════════════════════ */

interface PhoneRig {
  root: THREE.Object3D;
  anchor: THREE.Group;
  /** LOCAL display-plane dims; CameraRig recovers the world scale */
  screenWorld: { w: number; h: number };
  setOpacity: (v: number) => void;
}

function usePhoneRig(): PhoneRig {
  const { scene } = useGLTF(PHONE_MODEL_URL);

  return useMemo(() => {
    const root = SkeletonUtils.clone(scene);

    // normalize: PHONE_WIDTH wide, centered on origin
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const s = PHONE_WIDTH / size.x;
    root.scale.setScalar(s);
    const box2 = new THREE.Box3().setFromObject(root);
    const center = new THREE.Vector3();
    box2.getCenter(center);
    root.position.sub(center);

    // locate the flat display mesh (by name, with a flat-front-plane fallback)
    let screen: THREE.Mesh | null = null;
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.name === PHONE_SCREEN_MESH) screen = m;
    });
    if (!screen) {
      let best = 0;
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry.computeBoundingBox();
        const d = new THREE.Vector3();
        m.geometry.boundingBox!.getSize(d);
        const a = [d.x, d.y, d.z].sort((p, q) => p - q);
        if (a[0] <= a[2] * 0.05 && a[1] * a[2] > best) {
          best = a[1] * a[2];
          screen = m;
        }
      });
    }

    /* ONE shared graphite material for the whole body — far cheaper than
       the GLB's 40+ MeshPhysicalMaterials (fewer shader/state changes per
       frame → smoother scroll) and a clean space-black that fits the stage.
       OPAQUE on purpose: a transparent phone made of ~41 separate meshes
       self-sorts per-object (renders inside-out) AND lets the bright laptop
       bleed straight through it — both read as "the render breaks when it
       crosses the laptop". Opaque → drawn in the depth-tested opaque pass,
       so it is always coherent and correctly occludes the laptop behind it.
       The phone no longer fades/slides; the SCREEN crossfades its media on
       each project change instead. The display gets its own black material. */
    const bodyMat = new THREE.MeshStandardMaterial({
      color: "#34343a",
      metalness: 0.88,
      roughness: 0.35,
    });
    const screenMat = new THREE.MeshStandardMaterial({
      color: "#050505",
      metalness: 0.35,
      roughness: 0.34,
    });
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.material = m.name === PHONE_SCREEN_MESH ? screenMat : bodyMat;
    });

    const anchor = new THREE.Group();
    let screenWorld = { w: 0.5, h: 1 };
    if (screen) {
      const sm = screen as THREE.Mesh;
      sm.geometry.computeBoundingBox();
      const bb = sm.geometry.boundingBox!;
      const dims = new THREE.Vector3();
      bb.getSize(dims);
      const c = new THREE.Vector3();
      bb.getCenter(c);
      const axes: ("x" | "y" | "z")[] = ["x", "y", "z"];
      const normalAxis = axes.reduce((a, b) => (dims[a] < dims[b] ? a : b));
      // portrait display: keep width = x, height = y (no max/min swap)
      screenWorld = { w: dims.x, h: dims.y };
      anchor.position.copy(c);
      anchor.position[normalAxis] += dims[normalAxis] / 2 + 0.002; // toward camera
      sm.parent?.add(anchor);
    }

    const setOpacity = (v: number) => {
      // opaque body → no alpha fade; visibility only (culls during the live
      // dive, when the frozen scene is CSS-zoomed into the laptop screen)
      root.visible = clamp01(v) > 0.02;
    };

    return { root, anchor, screenWorld, setOpacity };
  }, [scene]);
}

interface PhoneHandle {
  group: THREE.Group | null;
  rig: PhoneRig;
  projectIdx: number;
}

function Phone({
  reg,
  settledIdx,
}: {
  reg: MutableRefObject<PhoneHandle | null>;
  settledIdx: number;
}) {
  const rig = usePhoneRig();
  const group = useRef<THREE.Group>(null);

  useEffect(() => {
    reg.current = { group: group.current, rig, projectIdx: settledIdx };
  });

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const px = state.pointer.x;
    const py = state.pointer.y;
    /* scroll-driven 3D vibe — the phone turns gently as you move through the
       reel (RISE-like), plus an idle float + pointer parallax. Frozen during
       the live dive so the dived scene never drifts. */
    const liveGate = 1 - clamp01(swScroll.live / 0.2);

    /* COME-AND-GO with the reel (like the laptops): fully present when a
       project is settled; slides down + back and fades out through a
       transition; returns with the next project — whose mobile media has
       already swapped while the phone was hidden, so no visible lag. */
    /* PERSISTENT SOLID COMPANION: no come-and-go slide, no alpha. The opaque
       body stays put and always renders coherently — it can never self-sort
       inside-out or let the laptop bleed through it (both of which the old
       transparent come-and-go did every time it crossed the laptop). The
       SCREEN crossfades its media on each project change (SelectedWork),
       which reads as the phone switching projects. Only a soft idle float +
       pointer parallax for life; culled while the live dive owns the scene. */
    rig.setOpacity(liveGate);
    g.rotation.set(
      -0.05 + py * 0.05 * liveGate + Math.sin(t * 0.7) * 0.022 * liveGate,
      -0.24 + px * 0.09 * liveGate,
      Math.sin(t * 0.5) * 0.015 * liveGate
    );
    g.position.set(
      PHONE_POS.x + px * 0.05 * liveGate,
      PHONE_POS.y + Math.sin(t * 0.9 + 1.3) * 0.045 * liveGate,
      PHONE_POS.z
    );
  });

  return (
    <group ref={group} position={[PHONE_POS.x, PHONE_POS.y, PHONE_POS.z]}>
      <primitive object={rig.root} />
    </group>
  );
}

/* ════════════════════════════════════════════════
   Camera rig — smoothing, transition choreography, live dive
   ════════════════════════════════════════════════ */

function CameraRig({
  reg,
  phone,
}: {
  reg: Registry;
  phone: MutableRefObject<PhoneHandle | null>;
}) {
  const { camera, viewport, gl } = useThree();
  const setDpr = useThree((s) => s.setDpr);
  /* COMPOSITOR DIVE: the camera never moves for CANLI İNCELE anymore.
     At enter we render ONE extra-crisp frame (dpr boost), compute where
     the frozen screen sits in canvas pixels, and hand those numbers to
     the DOM ticker — which zooms the static canvas with a pure CSS
     transform. CSS transforms are compositor-only, so the dive cannot
     stutter no matter how heavy the 3D scene is. */
  const zoomArmed = useRef(false);
  /* motion-based dynamic resolution for SCROLL transitions (same proven
     medicine as the dive): while the laptop travels, render at dpr 1.2
     — motion masks it and every frame fits the vsync budget, which is
     what "buttery" actually is (even cadence, not raw sharpness). The
     full 1.5 comes back only after 300ms of stillness. */
  const drs = useRef({ lo: false, calmSince: 0 });
  const tmp = useRef({
    look: new THREE.Vector3(),
    aPos: new THREE.Vector3(),
    aDir: new THREE.Vector3(),
    q: new THREE.Quaternion(),
    right: new THREE.Vector3(),
    up: new THREE.Vector3(),
    corner: new THREE.Vector3(),
  });
  /* dev-only frame-to-frame snap detector state */
  const snap = useRef({
    init: false,
    prog: 0,
    cam: new THREE.Vector3(),
    a: new THREE.Vector3(),
    b: new THREE.Vector3(),
    aq: new THREE.Quaternion(),
    bq: new THREE.Quaternion(),
  });
  /* dev boundary assertion: the single pose function must be continuous
     through d = 0 (incoming t=1 ≡ settled ≡ outgoing t=0) */
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "development" ||
      typeof window === "undefined" ||
      !window.location.search.includes("swdebug")
    )
      return;
    const a = poseFromDistance(-1e-6);
    const b = poseFromDistance(0);
    const c = poseFromDistance(1e-6);
    const keys: (keyof UnitPose)[] = [
      "x", "y", "z", "ry", "rx", "rz", "s", "lidT", "opacity",
    ];
    let max = 0;
    for (const key of keys)
      max = Math.max(max, Math.abs(a[key] - b[key]), Math.abs(c[key] - b[key]));
    const fn = max > 1e-4 ? "warn" : "log";
    console[fn](
      `[continuity] settled-boundary max pose delta ${max.toExponential(2)} (tolerance 1e-4)`
    );
  }, []);

  useFrame((_, rawDt) => {
    /* STALL-PROOF clock: cap the step at two 60fps frames. A main-thread
       stall (GC, iframe layer teardown, recorder hiccup) then PAUSES the
       dive instead of skipping ahead — when frames resume, the camera
       continues from exactly where the viewer last saw it. A time-true
       clock "owes" the stalled time and burns half the path in a couple
       of frames: that WAS the perceived exit teleport. */
    void rawDt; // live clock now advances in SelectedWork's ticker

    /* live-enter (one-time): boost dpr for a single extra-crisp frame,
       project the frozen screen into canvas pixels, publish the CSS
       zoom parameters. Both happen while everything is still static. */
    if (!zoomArmed.current && swScroll.liveTarget === 1) {
      zoomArmed.current = true;
      const active = Object.values(reg.current).find(
        (h) => h.projectIdx === swScroll.liveIdx
      );
      if (active?.rig.anchor) {
        const el = gl.domElement;
        const w = el.clientWidth || 1;
        const h = el.clientHeight || 1;
        const v = tmp.current;
        active.rig.anchor.getWorldPosition(v.aPos);
        active.rig.anchor.getWorldQuaternion(v.q);
        const proj = (p: THREE.Vector3) => {
          const c = p.clone().project(camera);
          return { x: (c.x * 0.5 + 0.5) * w, y: (1 - (c.y * 0.5 + 0.5)) * h };
        };
        const cpt = proj(v.aPos);
        const rpt = proj(
          v.aPos
            .clone()
            .add(
              new THREE.Vector3(1, 0, 0)
                .applyQuaternion(v.q)
                .multiplyScalar(active.rig.screenWorld.w / 2)
            )
        );
        const upt = proj(
          v.aPos
            .clone()
            .add(
              new THREE.Vector3(0, 1, 0)
                .applyQuaternion(v.q)
                .multiplyScalar(active.rig.screenWorld.h / 2)
            )
        );
        const halfW = Math.max(1, Math.hypot(rpt.x - cpt.x, rpt.y - cpt.y));
        const halfH = Math.max(1, Math.hypot(upt.x - cpt.x, upt.y - cpt.y));
        const fill = Math.max(w / (halfW * 2), h / (halfH * 2)) * 1.12;
        swScroll.zoom = {
          ox: cpt.x,
          oy: cpt.y,
          tx: w / 2 - cpt.x,
          ty: h / 2 - cpt.y,
          s: Math.min(fill, 6),
        };
      }
      setDpr(2);
    } else if (
      zoomArmed.current &&
      swScroll.liveTarget === 0 &&
      swScroll.live === 0
    ) {
      zoomArmed.current = false;
      setDpr(Math.min(window.devicePixelRatio || 1, 1.5));
    }

    const portrait = viewport.aspect < 1.05;
    const { lt } = seg(swScroll.smooth);

    /* scroll-transit DRS — never while live mode owns the dpr */
    if (swScroll.liveTarget === 0 && swScroll.live === 0 && !zoomArmed.current) {
      const chasing =
        Math.abs(swScroll.smooth - swScroll.progress) > 0.0006;
      const inTransit = lt > 0.16 && lt < 0.84;
      const nowMs = performance.now();
      if (chasing || inTransit) {
        drs.current.calmSince = nowMs;
        if (!drs.current.lo) {
          drs.current.lo = true;
          setDpr(1.2);
        }
      } else if (drs.current.lo && nowMs - drs.current.calmSince > 300) {
        drs.current.lo = false;
        setDpr(Math.min(window.devicePixelRatio || 1, 1.5));
      }
    }

    const phase = clamp01((lt - 0.15) / 0.85);
    const b = bump(phase);
    const amp = portrait ? 0.45 : 1;

    /* base + transition choreography: drift toward the incoming side,
       dolly in around the midpoint, look-at sweeps out → in → center */
    let px = (portrait ? 0 : 0.25) - 0.27 * amp * Math.sin(Math.PI * Math.min(phase * 1.12, 1));
    let py = (portrait ? 0.6 : 0.05) + 0.08 * amp * b;
    let pz = (portrait ? 9.2 : 7.4) - 0.32 * amp * b;
    const lookBase = portrait ? -0.68 : 0.08;
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

    /* NOTE: no live-dive camera motion anymore — the CANLI İNCELE dive
       is a compositor-level CSS zoom of the frozen canvas, driven from
       SelectedWork's ticker. The camera is scroll choreography only,
       which also means the exit lands on the scroll pose by definition. */

    camera.position.set(px, py, pz);
    tmp.current.look.set(lx, ly, lz);
    camera.lookAt(tmp.current.look);
    if ((camera as THREE.PerspectiveCamera).fov !== fov) {
      (camera as THREE.PerspectiveCamera).fov = fov;
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }

    /* project the (near-)settled unit's screen quad into canvas CSS
       pixels for the DOM screen overlay — every rendered frame, so the
       overlay tracks the idle breath exactly */
    {
      const absPos = swScroll.smooth * TRANSITIONS;
      let best: UnitHandle | null = null;
      let bestD = 1;
      for (const h of Object.values(reg.current)) {
        const d = absPos - h.projectIdx;
        if (Math.abs(d) < Math.abs(bestD)) {
          bestD = d;
          best = h;
        }
      }
      const quad = swScroll.quad;
      if (best?.rig.anchor && Math.abs(bestD) < 0.25) {
        const v = tmp.current;
        const el = gl.domElement;
        const cw = el.clientWidth || 1;
        const ch = el.clientHeight || 1;
        best.rig.anchor.updateWorldMatrix(true, false);
        best.rig.anchor.getWorldPosition(v.aPos);
        best.rig.anchor.getWorldQuaternion(v.q);
        /* world half-extents of the CONTENT plane (inset display) */
        const sw = (best.rig.screenWorld.w * SCREEN_INSET) / 2;
        const sh = (best.rig.screenWorld.h * SCREEN_INSET) / 2;
        /* NOTE: anchor axes are uniform-scaled by StageRoot — recover
           the scale from the world matrix column length */
        const scl = best.rig.anchor.matrixWorld.elements[0] ** 2 +
          best.rig.anchor.matrixWorld.elements[1] ** 2 +
          best.rig.anchor.matrixWorld.elements[2] ** 2;
        const s = Math.sqrt(scl);
        v.right.set(1, 0, 0).applyQuaternion(v.q).multiplyScalar(sw * s);
        v.up.set(0, 1, 0).applyQuaternion(v.q).multiplyScalar(sh * s);
        const proj = (sx: number, sy: number, ox: "x0" | "x1" | "x2" | "x3", oy: "y0" | "y1" | "y2" | "y3") => {
          v.corner
            .copy(v.aPos)
            .addScaledVector(v.right, sx)
            .addScaledVector(v.up, sy)
            .project(camera);
          quad[ox] = (v.corner.x * 0.5 + 0.5) * cw;
          quad[oy] = (1 - (v.corner.y * 0.5 + 0.5)) * ch;
        };
        proj(-1, 1, "x0", "y0");
        proj(1, 1, "x1", "y1");
        proj(1, -1, "x2", "y2");
        proj(-1, -1, "x3", "y3");
        quad.on = true;
        quad.idx = best.projectIdx;
        quad.d = bestD;
      } else {
        quad.on = false;
      }
    }

    /* companion phone screen quad → phoneQuad (persistent; the DOM overlay
       is matrix3d-mapped onto it every frame, exactly like the laptop) */
    {
      const pq = swScroll.phoneQuad;
      const ph = phone.current;
      if (ph?.rig.anchor && ph.group?.visible !== false) {
        const v = tmp.current;
        const el = gl.domElement;
        const cw = el.clientWidth || 1;
        const ch = el.clientHeight || 1;
        ph.rig.anchor.updateWorldMatrix(true, false);
        ph.rig.anchor.getWorldPosition(v.aPos);
        ph.rig.anchor.getWorldQuaternion(v.q);
        const sw = (ph.rig.screenWorld.w * PHONE_SCREEN_INSET) / 2;
        const sh = (ph.rig.screenWorld.h * PHONE_SCREEN_INSET) / 2;
        const pscl = Math.sqrt(
          ph.rig.anchor.matrixWorld.elements[0] ** 2 +
            ph.rig.anchor.matrixWorld.elements[1] ** 2 +
            ph.rig.anchor.matrixWorld.elements[2] ** 2
        );
        v.right.set(1, 0, 0).applyQuaternion(v.q).multiplyScalar(sw * pscl);
        v.up.set(0, 1, 0).applyQuaternion(v.q).multiplyScalar(sh * pscl);
        const pproj = (
          sx: number,
          sy: number,
          ox: "x0" | "x1" | "x2" | "x3",
          oy: "y0" | "y1" | "y2" | "y3"
        ) => {
          v.corner
            .copy(v.aPos)
            .addScaledVector(v.right, sx)
            .addScaledVector(v.up, sy)
            .project(camera);
          pq[ox] = (v.corner.x * 0.5 + 0.5) * cw;
          pq[oy] = (1 - (v.corner.y * 0.5 + 0.5)) * ch;
        };
        pproj(-1, 1, "x0", "y0");
        pproj(1, 1, "x1", "y1");
        pproj(1, -1, "x2", "y2");
        pproj(-1, -1, "x3", "y3");
        pq.on = true;
        pq.idx = ph.projectIdx;
      } else {
        pq.on = false;
      }
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
      /* only meaningful when the damped value has CONVERGED — during a
         legitimate catch-up sweep (anchor jump, fast flick) the scene is
         supposed to move fast while raw progress sits still */
      const converged = Math.abs(swScroll.smooth - swScroll.progress) < 0.004;
      if (
        s.init &&
        vel < 0.004 &&
        converged &&
        swScroll.live === 0 &&
        !swScroll.frozen
      ) {
        const camD = Math.hypot(
          px - s.cam.x,
          py - s.cam.y,
          pz - s.cam.z
        );
        if (camD > 0.025)
          console.warn(`[snap] camera moved ${camD.toFixed(4)} in one frame`);
        (["A", "B"] as const).forEach((u) => {
          const h = reg.current[u];
          if (!h?.group || !h.rig.root.visible) return;
          const prev = u === "A" ? s.a : s.b;
          const prevQ = u === "A" ? s.aq : s.bq;
          const dPos = h.group.position.distanceTo(prev);
          if (dPos > 0.025)
            console.warn(`[snap] mac ${u} moved ${dPos.toFixed(4)} in one frame`);
          const dAng = h.group.quaternion.angleTo(prevQ);
          if (dAng > 0.015)
            console.warn(
              `[snap] mac ${u} rotated ${dAng.toFixed(4)} rad in one frame`
            );
        });
      }
      s.cam.set(px, py, pz);
      if (reg.current.A?.group) {
        s.a.copy(reg.current.A.group.position);
        s.aq.copy(reg.current.A.group.quaternion);
      }
      if (reg.current.B?.group) {
        s.b.copy(reg.current.B.group.position);
        s.bq.copy(reg.current.B.group.quaternion);
      }
      s.prog = swScroll.progress;
      s.init = true;
    }
  });

  return null;
}

/* Draw + upload every placeholder screen texture during scene init so a
   slot recycle mid-scroll never triggers a first-use canvas draw or GPU
   upload (both cost a visible frame on mid GPUs). */
function TextureWarmup() {
  const { gl } = useThree();
  useEffect(() => {
    FEATURED_PROJECTS.forEach((p, i) => {
      if (!p.desktopMedia.src) gl.initTexture(getPlaceholderTexture(p, i));
    });
  }, [gl]);
  return null;
}

/* ════════════════════════════════════════════════
   Stage placement + canvas shell
   ════════════════════════════════════════════════ */

/* soft radial texture for the light pool / ground seat — built once */
function makeRadialTexture(stops: [number, string][]) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(128, 128, 4, 128, 128, 128);
  for (const [o, col] of stops) grad.addColorStop(o, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* CINEMATIC VOID STAGE (r24): the mirror made laptops look half-sunk in a
   dark pool. Replaced with a warm spotlight pool on infinite black — the
   hero sits in the light, no reflection, no hard floor edge, nothing to
   intersect. Revert to the mirror with:
     git checkout backup-r23-mirror-floor -- components/MacBook3D.tsx  */
function StageFloor() {
  const pool = useMemo(
    () =>
      makeRadialTexture([
        [0, "rgba(255,216,150,0.55)"],
        [0.38, "rgba(232,176,96,0.17)"],
        [1, "rgba(232,176,96,0)"],
      ]),
    []
  );
  const seat = useMemo(
    () =>
      makeRadialTexture([
        [0, "rgba(48,38,24,0.42)"],
        [0.5, "rgba(26,20,13,0.14)"],
        [1, "rgba(20,15,9,0)"],
      ]),
    []
  );
  return (
    <group>
      {/* wide, faint seat — hints at a ground plane in the void, no edge */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.05, -1]} renderOrder={-3}>
        <planeGeometry args={[30, 22]} />
        <meshBasicMaterial
          map={seat}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          fog={false}
        />
      </mesh>
      {/* warm spotlight pool marking the active stage spot */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.03, 0.3]} renderOrder={-2}>
        <planeGeometry args={[12, 8.5]} />
        <meshBasicMaterial
          map={pool}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          fog={false}
        />
      </mesh>
    </group>
  );
}

function StageRoot({ children }: { children: React.ReactNode }) {
  const { viewport } = useThree();
  const portrait = viewport.aspect < 1.05;
  return (
    <group
      position={portrait ? [0, -0.1, 0] : [-viewport.width * 0.19, -0.95, 0]}
      scale={portrait ? 0.62 : 1}
    >
      {children}
      {!portrait && <StageFloor />}
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
  const phone = useRef<PhoneHandle | null>(null);
  /* r22: units are fixed to their projects on the ring — the old A/B
     slot-recycling props are kept in the signature so SelectedWork
     stays untouched, but they no longer drive anything */
  void aIdx;
  void bIdx;

  return (
    <Canvas
      className={styles.macCanvas}
      /* demand-driven: SelectedWork's ticker invalidates at a capped,
         even rate — on 144/240Hz monitors an uncapped loop overwhelms
         the GPU (shadow pass + PBR at native refresh) and the resulting
         submit stalls read as scroll micro-stutter */
      frameloop="demand"
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ fov: 34, near: 0.1, far: 60, position: [0.25, 0.05, 7.4] }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.5} color="#fff0da" />
        <directionalLight position={[5, 7, 5]} intensity={1.2} color="#ffe6b8" />
        <directionalLight position={[-6, 3, 2]} intensity={0.4} color="#d8a94f" />
        {/* altın kontra: gölgedeki kanat ünitelerinin kenarını çizer */}
        <directionalLight position={[-6, 2.4, -3]} intensity={0.8} color="#e8b96a" />

        <Environment resolution={64}>
          <Lightformer intensity={1.6} color="#f3d791" position={[4, 4, 4]} scale={[7, 3, 1]} />
          <Lightformer intensity={0.8} color="#fff6e6" position={[-5, 6, -3]} scale={[9, 3, 1]} />
          <Lightformer intensity={1} color="#b97f2e" position={[0, -3, 6]} scale={[12, 2, 1]} />
        </Environment>

        <StageRoot>
          {/* DÖNER VİTRİN: her projenin kendi ünitesi halkada sabit —
              slot geri dönüşümü yok; arkaya dönenler görünmez olur
              (opacity→0 → render listesinden çıkar), sahnede tipik
              olarak ön + iki kanat kalır */}
          {FEATURED_PROJECTS.map((_, i) => (
            <MacUnit
              key={i}
              unit={String(i)}
              projectIdx={i}
              settledIdx={settledIdx}
              reg={reg}
            />
          ))}
          {/* frames={1}: the shadow is baked ONCE — re-rendering the
              scene's depth EVERY frame was the single biggest per-frame
              GPU cost. A soft static pool under the stage center is
              visually identical for a dark hovering-laptop scene. */}
          {/* tight pool under the CENTRE hero only (scale 6.5 → radius
              ~3.25): the flanks now live at ±6.6, well outside it, so the
              contact shadow can no longer bleed onto an adjacent device.
              renderOrder -1 keeps it behind every laptop in the draw. */}
          <ContactShadows
            frames={1}
            position={[0, 0.004, 0]}
            opacity={0.5}
            scale={6.5}
            blur={3}
            far={2.6}
            resolution={256}
            color="#000000"
            renderOrder={-1}
          />
          {/* the companion iPhone is a flat DOM element (iphone.png frame +
              mobile media) rendered by SelectedWork, NOT a 3D model — the
              WebGL phone had unfixable DOM-overlay occlusion/sorting issues */}
        </StageRoot>

        <CameraRig reg={reg} phone={phone} />
        <TextureWarmup />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload(MODEL_URL);
