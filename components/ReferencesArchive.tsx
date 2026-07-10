"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
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
/* one shared unit-quad edge geometry for every card's accent frame */
const EDGE_GEO = new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1));

/* a placeholder texture (initials on the accent) for sites with no thumb.
   client-only (uses canvas); on the server the Canvas isn't rendered anyway */
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
};

function Screen({ item }: { item: Item }) {
  const tex = useLoader(THREE.TextureLoader, item.src);
  useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
  }, [tex]);
  const grp = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);

  useFrame((state) => {
    const g = grp.current;
    if (!g) return;
    const s = hover ? 1.12 : 1;
    g.scale.x += (s - g.scale.x) * 0.16;
    g.scale.y += (s - g.scale.y) * 0.16;
    g.scale.z += (s - g.scale.z) * 0.16;
    // gentle idle drift
    g.position.y =
      item.y + Math.sin(state.clock.elapsedTime * 0.5 + item.z) * 0.12;
  });

  return (
    <group ref={grp} position={[item.x, item.y, item.z]} rotation={[0, item.ry, 0]}>
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
      <lineSegments geometry={EDGE_GEO} scale={[CARD_W, CARD_H, 1]}>
        <lineBasicMaterial
          color={item.p.accentColor}
          transparent
          opacity={hover ? 0.95 : 0.28}
          toneMapped={false}
        />
      </lineSegments>
    </group>
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
  useFrame(() => {
    const t = progress.current;
    const z = START_Z + (endZ - START_Z) * t;
    camera.position.set(0, 0, z);
    camera.lookAt(0, 0, z - 8);
  });
  return null;
}

/**
 * References Archive — a 3D "space gallery". Every shipped site floats as a
 * panel in depth; scrolling flies the camera forward through them, out of the
 * fog. Scales to ~20 entries: just append to ARCHIVE_PROJECTS.
 */
export default function ReferencesArchive() {
  const sectionRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const [mounted, setMounted] = useState(false);
  const [inView, setInView] = useState(false);

  const items = useMemo<Item[]>(() => {
    return ARCHIVE_PROJECTS.map((p, i) => {
      const side = i % 2 === 0 ? 1 : -1;
      const x = side * (2.5 + (i % 3) * 0.9);
      const y = ((i % 3) - 1) * 2.3;
      const z = -i * SPACING - 6;
      return {
        p,
        src: p.thumb ?? makeInitialsURL(p.name, p.accentColor),
        x,
        y,
        z,
        ry: -side * 0.3,
      };
    });
  }, []);
  const endZ = -ARCHIVE_PROJECTS.length * SPACING - 4;

  /* scroll → progress (0 = entering, 1 = flown through) + header fade */
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const onScroll = () => {
      const rect = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight;
      const t = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
      progress.current = t;
      if (headRef.current)
        headRef.current.style.opacity = String(
          Math.max(0, 1 - t / 0.14)
        );
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  /* mount the canvas only near the section; render only while visible */
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
            camera={{ position: [0, 0, START_Z], fov: 52, near: 0.1, far: 130 }}
          >
            <color attach="background" args={["#050403"]} />
            <fog attach="fog" args={["#050403", 16, 66]} />
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
