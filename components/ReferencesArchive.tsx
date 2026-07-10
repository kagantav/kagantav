"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { ARCHIVE_PROJECTS, type ArchiveProject } from "./projects";
import styles from "./ReferencesArchive.module.css";

const pad = (n: number) => String(n).padStart(2, "0");
const initialsOf = (name: string) =>
  name
    .replace(/[^\p{L}\s]/gu, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

const SPACING = 12; // z gap between screens
const START_Z = 10;
const CARD_W = 6.6;
const CARD_H = (CARD_W * 10) / 16;
const EDGE_GEO = new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1));

/* a soft radial glow texture (white → transparent), built once on the client */
let _glow: THREE.CanvasTexture | null = null;
function glowTexture() {
  if (typeof document === "undefined") return null;
  if (_glow) return _glow;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(128, 128, 6, 128, 128, 128);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.5)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  _glow = new THREE.CanvasTexture(c);
  return _glow;
}

/* a placeholder texture (initials on the accent) for sites with no thumb */
function makeInitialsURL(name: string, accent: string) {
  if (typeof document === "undefined") return "";
  const c = document.createElement("canvas");
  c.width = 640;
  c.height = 400;
  const x = c.getContext("2d")!;
  x.fillStyle = "#0e0a06";
  x.fillRect(0, 0, 640, 400);
  const g = x.createLinearGradient(0, 0, 0, 400);
  g.addColorStop(0, accent);
  g.addColorStop(1, "rgba(0,0,0,0)");
  x.globalAlpha = 0.9;
  x.fillStyle = g;
  x.font = "700 150px Georgia, serif";
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText(initialsOf(name), 320, 210);
  return c.toDataURL();
}

type Item = {
  p: ArchiveProject;
  src: string;
  x: number;
  y: number;
  z: number;
  ry: number;
  rz: number;
};

function Screen({ item }: { item: Item }) {
  const tex = useLoader(THREE.TextureLoader, item.src);
  useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
  }, [tex]);
  const grp = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  const glow = glowTexture();

  useFrame((state) => {
    const g = grp.current;
    if (!g) return;
    const s = hover ? 1.14 : 1;
    g.scale.x += (s - g.scale.x) * 0.14;
    g.scale.y += (s - g.scale.y) * 0.14;
    g.position.y =
      item.y + Math.sin(state.clock.elapsedTime * 0.45 + item.z) * 0.14;
  });

  return (
    <group
      ref={grp}
      position={[item.x, item.y, item.z]}
      rotation={[0, item.ry, item.rz]}
    >
      {/* accent halo behind the panel */}
      {glow && (
        <mesh position={[0, 0, -0.12]} scale={[CARD_W * 1.75, CARD_H * 2, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={glow}
            color={item.p.accentColor}
            transparent
            opacity={hover ? 0.55 : 0.24}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      )}
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = item.p.liveUrl ? "pointer" : "default";
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "";
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (item.p.liveUrl) window.open(item.p.liveUrl, "_blank", "noreferrer");
        }}
      >
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {/* accent edge frame that lights on hover */}
      <lineSegments geometry={EDGE_GEO} scale={[CARD_W, CARD_H, 1]} position={[0, 0, 0.01]}>
        <lineBasicMaterial
          color={item.p.accentColor}
          transparent
          opacity={hover ? 1 : 0.34}
          toneMapped={false}
        />
      </lineSegments>
    </group>
  );
}

/* a distant warm glow you fly toward — "light at the end" */
function EndLight({ z }: { z: number }) {
  const glow = glowTexture();
  if (!glow) return null;
  return (
    <mesh position={[0, 0, z - 6]} scale={[46, 46, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={glow}
        color="#e8c06a"
        transparent
        opacity={0.4}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}

function Rig({
  progress,
  endZ,
}: {
  progress: React.MutableRefObject<number>;
  endZ: number;
}) {
  const { camera } = useThree();
  useFrame((state) => {
    const t = progress.current;
    const target = START_Z + (endZ - START_Z) * t;
    camera.position.z += (target - camera.position.z) * 0.09; // eased travel
    const time = state.clock.elapsedTime;
    camera.position.x = Math.sin(time * 0.19) * 0.5; // gentle sway
    camera.position.y = Math.cos(time * 0.15) * 0.34;
    camera.lookAt(0, 0, camera.position.z - 8);
    camera.rotation.z = Math.sin(time * 0.11) * 0.012; // faint roll
  });
  return null;
}

/**
 * References Archive — a 3D "space gallery". Shipped sites float as glowing
 * panels along a slow spiral; scroll flies the camera through them, out of the
 * fog and toward a warm light. Scales to ~20: just append to ARCHIVE_PROJECTS.
 */
export default function ReferencesArchive() {
  const sectionRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const [mounted, setMounted] = useState(false);
  const [inView, setInView] = useState(false);

  const items = useMemo<Item[]>(() => {
    return ARCHIVE_PROJECTS.map((p, i) => {
      const a = i * 0.68; // spiral angle
      const R = 4.5;
      const x = Math.cos(a) * R;
      const y = Math.sin(a) * R * 0.6;
      const z = -i * SPACING - 6;
      return {
        p,
        src: p.thumb ?? makeInitialsURL(p.name, p.accentColor),
        x,
        y,
        z,
        ry: -x * 0.07,
        rz: Math.sin(a) * 0.04,
      };
    });
  }, []);
  const endZ = -ARCHIVE_PROJECTS.length * SPACING - 4;

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const onScroll = () => {
      const rect = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight;
      const t = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
      progress.current = t;
      if (headRef.current)
        headRef.current.style.opacity = String(Math.max(0, 1 - t / 0.14));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setMounted(true);
        setInView(e.isIntersecting);
      },
      { rootMargin: "40% 0px 40% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section id="references" ref={sectionRef} className={styles.section}>
      <div className={styles.sticky}>
        <div ref={headRef} className={styles.head}>
          <p className={styles.eyebrow}>
            <span />
            Full Archive
            <em className={styles.count}>{pad(ARCHIVE_PROJECTS.length)}</em>
          </p>
          <h2 className={styles.title}>Every site I&apos;ve shipped.</h2>
          <p className={styles.sub}>
            Öne çıkan birkaç işi yukarıda vitrine aldık — geri kalan işlerin
            arasından süzülerek uçun; her panel canlı bir site.
          </p>
        </div>

        {mounted && (
          <Canvas
            className={styles.canvas}
            frameloop={inView ? "always" : "never"}
            dpr={[1, 1.6]}
            gl={{ antialias: true, alpha: false }}
            camera={{ position: [0, 0, START_Z], fov: 54, near: 0.1, far: 140 }}
          >
            <color attach="background" args={["#050403"]} />
            <fog attach="fog" args={["#070504", 18, 72]} />
            <Sparkles
              count={220}
              scale={[34, 22, Math.abs(endZ) + 20]}
              position={[0, 0, endZ / 2]}
              size={2.4}
              speed={0.25}
              opacity={0.5}
              color="#e8c06a"
              noise={1.2}
            />
            <EndLight z={endZ} />
            <Suspense fallback={null}>
              {items.map((it) => (
                <Screen key={it.p.id} item={it} />
              ))}
            </Suspense>
            <Rig progress={progress} endZ={endZ} />
          </Canvas>
        )}

        <div className={styles.hint} aria-hidden="true">
          <span>aşağı kaydır — aralarından uç</span>
          <i />
        </div>
      </div>
    </section>
  );
}
