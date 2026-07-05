"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
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

const TARGET_WIDTH = 3.6; // world width of the MacBook base
/* Empirically probed (side-by-side ±90° render): the display surface
   faces the model's -Z side, so the root is turned 180° toward the
   camera and the lid opens on the negative-X side of the hinge:
   0 → closed flat, -π/2 → upright, slightly beyond → premium recline. */
/* Hinge (verified against the GLB accessors): lid-local +Z is the top
   edge, the display faces -Y. rotation.x = 0 → closed flat;
   negative X lifts the top edge and turns the display to the camera. */
const LID_CLOSED = -0.1;
const LID_OPEN = -Math.PI / 2 - 0.14; // ≈ 98° premium viewing angle

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeIO = gsap.parseEase("power2.inOut");
const easeOut = gsap.parseEase("power3.out");

const pad = (n: number) => String(n + 1).padStart(2, "0");

/* ════════════════════════════════════════════════
   Model preparation: clone per unit, black glossy screen,
   lid handle + Html anchor on the LCD surface.
   ════════════════════════════════════════════════ */

interface MacRig {
  root: THREE.Object3D;
  lid: THREE.Object3D | null;
  anchor: THREE.Group;
  screenWorld: { w: number; h: number };
  rootScale: number;
}

function useMacRig(): MacRig {
  const { scene } = useGLTF(MODEL_URL);

  return useMemo(() => {
    const root = SkeletonUtils.clone(scene);

    // normalize: scale so the base spans TARGET_WIDTH, rest on y=0, centered
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

    // black glossy display + Html anchor sized to the LCD surface
    const anchor = new THREE.Group();
    let screenWorld = { w: 3.4, h: 2.2 };

    if (lid) {
      const matsOf = (mesh: THREE.Mesh) =>
        Array.isArray(mesh.material) ? mesh.material : [mesh.material];

      // glass → truly transparent; LCD → deep glossy black (kills the
      // baked wallpaper + its emissive); track the largest LCD surface
      let lcd: THREE.Mesh | null = null;
      let bestArea = 0;
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

      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = matsOf(mesh);
        mats.forEach((mat, mi) => {
          const name = mat?.name ?? "";
          /* Every panel-sized layer stacked in the display plane (gasket,
             plastic backing, cover glass) becomes the same deep-black
             glossy surface — the premium "off" screen. */
          if (
            name === "Display glass nanotexture" ||
            name === "Plastic cover" ||
            name === "Rubber gasket"
          ) {
            if (Array.isArray(mesh.material)) mesh.material[mi] = blackPanel;
            else mesh.material = blackPanel;
          }
          if (name === "Display glass") {
            if (Array.isArray(mesh.material)) mesh.material[mi] = clearGlass;
            else mesh.material = clearGlass;
          }
          if (name === "LCD") {
            if (Array.isArray(mesh.material)) mesh.material[mi] = blackPanel;
            else mesh.material = blackPanel;
            mesh.geometry.computeBoundingBox();
            const d = new THREE.Vector3();
            mesh.geometry.boundingBox!.getSize(d);
            const sorted = [d.x, d.y, d.z].sort((a, b) => b - a);
            const area = sorted[0] * sorted[1];
            if (area > bestArea) {
              bestArea = area;
              lcd = mesh;
            }
          }
        });
      });
      if (!lcd) console.warn("[MacBook3D] LCD surface not found in model");

      if (lcd) {
        const m = lcd as THREE.Mesh;
        // premium inactive display: deep black, glassy
        m.material = new THREE.MeshPhysicalMaterial({
          color: "#020202",
          roughness: 0.16,
          metalness: 0.1,
          clearcoat: 1,
          clearcoatRoughness: 0.12,
        });

        m.geometry.computeBoundingBox();
        const bb = m.geometry.boundingBox!;
        const dims = new THREE.Vector3();
        bb.getSize(dims);
        const c = new THREE.Vector3();
        bb.getCenter(c);

        // thinnest axis = screen normal. Dimensions stay in LID-LOCAL units —
        // the anchor inherits the root scale, so don't apply it twice.
        const axes: ("x" | "y" | "z")[] = ["x", "y", "z"];
        const normalAxis = axes.reduce((a, b) => (dims[a] < dims[b] ? a : b));
        const planar = axes.filter((a) => a !== normalAxis);
        screenWorld = {
          w: Math.max(dims[planar[0]], dims[planar[1]]),
          h: Math.min(dims[planar[0]], dims[planar[1]]),
        };

        anchor.position.copy(c);
        // the display emits toward -Y in lid space (the +Y side is the shell)
        anchor.position[normalAxis] -= dims[normalAxis] / 2 + 0.0016;
        if (normalAxis === "y") anchor.rotation.x = Math.PI / 2;
        if (normalAxis === "x") anchor.rotation.y = -Math.PI / 2;
        (lcd as THREE.Mesh).parent?.add(anchor);
      } else {
        lid.add(anchor);
      }
    }

    return { root, lid, anchor, screenWorld, rootScale: s };
  }, [scene]);
}

/* ════════════════════════════════════════════════
   Screen content — a texture plane on the LCD surface (the alignment-
   proven approach). Black panel at rest; the preview fades in on settle.
   image → texture, video → VideoTexture, iframe/placeholder → a
   canvas-drawn premium card (live embeds open via the panel's
   "Live Preview" modal instead of an in-screen iframe).
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

  // browser chrome
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

  // big index
  const grad = g.createLinearGradient(0, H * 0.3, 0, H * 0.62);
  grad.addColorStop(0, project.accentColor);
  grad.addColorStop(1, `${project.accentColor}55`);
  g.fillStyle = grad;
  g.font = "700 170px Archivo, Arial, sans-serif";
  g.textAlign = "center";
  g.fillText(pad(idx), W / 2, H * 0.5);

  // name + category
  g.fillStyle = "#ece4d4";
  g.font = "600 58px Archivo, Arial, sans-serif";
  g.fillText(project.name, W / 2, H * 0.62);
  g.fillStyle = "rgba(169,158,138,0.85)";
  g.font = "500 26px Archivo, Arial, sans-serif";
  const cat = project.category.toUpperCase().split("").join("  ");
  g.fillText(cat, W / 2, H * 0.685);

  // bottom rule
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
}: {
  rig: MacRig;
  project: FeaturedProject;
  idx: number;
  settled: boolean;
}) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

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

  // videos only run while their project is settled
  useEffect(() => {
    const v = (tex as THREE.Texture & { __video?: HTMLVideoElement }).__video;
    if (!v) return;
    if (settled) v.play().catch(() => {});
    else v.pause();
  }, [settled, tex]);

  // clean preview fade on the glossy black panel
  useEffect(() => {
    if (!matRef.current) return;
    gsap.to(matRef.current, {
      opacity: settled ? 1 : 0,
      duration: 0.55,
      ease: "power2.out",
    });
  }, [settled]);

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
   One 3D MacBook — pose + hinged lid, pure function of scroll
   ════════════════════════════════════════════════ */

function MacUnit({
  unit,
  projectIdx,
  settledIdx,
}: {
  unit: "A" | "B";
  projectIdx: number;
  settledIdx: number;
}) {
  const rig = useMacRig();
  const group = useRef<THREE.Group>(null);
  const { viewport } = useThree();
  const phase = unit === "A" ? 0 : 2.4;

  useFrame((state) => {
    const g = group.current;
    if (!g || !rig.root) return;

    const p = swScroll.progress;
    const f = Math.min(p * TRANSITIONS, TRANSITIONS - 1e-5);
    const k = Math.max(0, Math.floor(f));
    const lt = f - k;
    const isOut = (k % 2 === 0) === (unit === "A");
    const tr = clamp01((lt - 0.15) / 0.7);
    const vw = viewport.width;
    const t = state.clock.elapsedTime;

    let x: number;
    let y: number;
    let z: number;
    let rotY: number;
    let rotZ: number;
    let scl: number;
    let openT: number;

    if (isOut) {
      /* centered showcase → exits stage-right, receding, lid closing */
      const to = easeIO(tr);
      x = vw * 0.68 * to;
      y = 0.12 * to;
      z = -1.6 * to;
      rotY = -0.22 * to;
      rotZ = -0.02 * to;
      scl = 1 - 0.16 * to;
      openT =
        lt < 0.15 ? 1 : 1 - 0.9 * easeIO(clamp01((lt - 0.15) / 0.62));
    } else {
      /* parked off-stage left, lid ajar → sweeps in, opens, settles */
      const ti = easeOut(tr);
      x = -vw * 0.72 * (1 - ti);
      y = 0.3 * (1 - ti);
      z = -1.1 * (1 - ti);
      rotY = 0.3 * (1 - ti);
      rotZ = 0.015 * (1 - ti);
      scl = 0.84 + 0.16 * ti;
      openT = 0.2 + 0.8 * easeOut(clamp01((lt - 0.42) / 0.5));
    }

    // gentle idle breath, calmer while traveling
    const travel = isOut ? easeIO(tr) : 1 - easeOut(tr);
    const idle = (1 - 0.7 * travel) * Math.sin(t * 0.55 + phase) * 0.045;

    g.position.set(x, y + idle, z);
    g.rotation.set(0, rotY, rotZ);
    g.scale.setScalar(scl);

    if (rig.lid) {
      rig.lid.rotation.x = LID_CLOSED + (LID_OPEN - LID_CLOSED) * clamp01(openT);
    }
  });

  const project = FEATURED_PROJECTS[projectIdx];
  const settled = settledIdx === projectIdx;

  return (
    <group ref={group}>
      <primitive object={rig.root} />
      <ScreenPlane
        rig={rig}
        project={project}
        idx={projectIdx}
        settled={settled}
      />
    </group>
  );
}

/* Positions the showcase: under the left column on desktop stages,
   centered in the upper area on portrait/mobile stages. */
function StageRoot({ children }: { children: React.ReactNode }) {
  const { viewport } = useThree();
  const portrait = viewport.aspect < 1.05;
  return (
    <group
      position={
        portrait ? [0, 0.78, 0] : [-viewport.width * 0.16, -0.95, 0]
      }
      scale={portrait ? 0.5 : 1}
    >
      {children}
    </group>
  );
}

/* ════════════════════════════════════════════════
   Canvas shell — lights, warm env reflections, contact shadow
   ════════════════════════════════════════════════ */

export default function MacBook3D({
  aIdx,
  bIdx,
  settledIdx,
}: {
  aIdx: number;
  bIdx: number;
  settledIdx: number;
}) {
  return (
    <Canvas
      className={styles.macCanvas}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ fov: 30, near: 0.1, far: 60, position: [0, 1.7, 9.4] }}
      onCreated={({ camera }) => camera.lookAt(0, 0.85, 0)}
    >
      <Suspense fallback={null}>
        {/* restrained black/gold lighting */}
        <ambientLight intensity={0.5} color="#fff0da" />
        <directionalLight position={[5, 7, 5]} intensity={1.35} color="#ffe6b8" />
        <directionalLight position={[-6, 3, 2]} intensity={0.4} color="#d8a94f" />

        {/* local light-studio for metallic reflections — no network fetch */}
        <Environment resolution={64}>
          <Lightformer
            intensity={1.6}
            color="#f3d791"
            position={[4, 4, 4]}
            scale={[7, 3, 1]}
          />
          <Lightformer
            intensity={0.8}
            color="#fff6e6"
            position={[-5, 6, -3]}
            scale={[9, 3, 1]}
          />
          <Lightformer
            intensity={1}
            color="#b97f2e"
            position={[0, -3, 6]}
            scale={[12, 2, 1]}
          />
        </Environment>

        <StageRoot>
          <MacUnit unit="A" projectIdx={aIdx} settledIdx={settledIdx} />
          <MacUnit unit="B" projectIdx={bIdx} settledIdx={settledIdx} />
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
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload(MODEL_URL);
