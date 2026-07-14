"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import { ARCHIVE_PROJECTS, pick, pickList, type ArchiveProject } from "./projects";
import { useLang } from "./i18n";
import { useContextRecovery, useNearViewport } from "./useCanvasLifecycle";
import { scrollBridge } from "./scrollBridge";
import styles from "./ReferencesArchive.module.css";

const pad = (n: number) => String(n).padStart(2, "0");
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
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

/* small rounded-corner alpha mask (client-only, built once) so the cards read
   as soft panels instead of hard rectangles */
let _roundMask: THREE.CanvasTexture | null = null;
function roundMaskTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  if (_roundMask) return _roundMask;
  const W = 660,
    H = 412,
    r = 20;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d")!;
  x.fillStyle = "#fff";
  x.beginPath();
  x.roundRect(0.5, 0.5, W - 1, H - 1, r);
  x.fill();
  _roundMask = new THREE.CanvasTexture(c);
  return _roundMask;
}

type Item = {
  p: ArchiveProject;
  src: string;
  x: number;
  y: number;
  z: number;
  ry: number;
};

function Screen({
  item,
  onOpen,
  activeIdRef,
}: {
  item: Item;
  onOpen: (p: ArchiveProject) => void;
  activeIdRef: React.MutableRefObject<string | null>;
}) {
  const tex = useLoader(THREE.TextureLoader, item.src);
  useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
  }, [tex]);
  const grp = useRef<THREE.Group>(null);
  const hover = useRef(false); // ref, not state → no re-render, useFrame owns opacity
  const baseMat = useRef<THREE.MeshBasicMaterial>(null);
  const focusT = useRef(0); // 0 = gallery slot, 1 = hero spot (eased for a soft arrival)
  const roundMask = roundMaskTexture();

  /* optional looping preview video — only some projects have one */
  const video = useMemo(() => {
    if (typeof document === "undefined" || !item.p.video) return null;
    const v = document.createElement("video");
    v.src = item.p.video;
    v.loop = true;
    v.muted = true;
    v.playsInline = true;
    /* MUST be "auto": these elements are detached (never in the DOM), and a
       detached element with preload="none" is not reliably fetched by every
       browser even once play() is called — readyState stays 0, so the poster
       never hands over and the card looks like a plain screenshot. The entry
       cost is paid for by the canvas mounting ~90vh early (the clips are
       small, 128KB-1MB) and by the narrow play corridor below. */
    v.preload = "auto";
    return v;
  }, [item.p.video]);
  const videoTex = useMemo(
    () => (video ? new THREE.VideoTexture(video) : null),
    [video]
  );
  useMemo(() => {
    if (videoTex) videoTex.colorSpace = THREE.SRGBColorSpace;
  }, [videoTex]);
  const vidMat = useRef<THREE.MeshBasicMaterial>(null);
  const forcedLoad = useRef(false); // one-shot fetch kick for stubborn browsers

  useEffect(() => {
    return () => {
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
      videoTex?.dispose();
    };
  }, [video, videoTex]);

  useFrame((state, delta) => {
    const g = grp.current;
    if (!g) return;
    const camZ = state.camera.position.z;
    const activeId = activeIdRef.current;
    const isActive = activeId === item.p.id;
    const someActive = activeId !== null;
    const t = state.clock.elapsedTime;

    // ── eased focus progress (0 = gallery slot, 1 = hero spot) ── advancing a
    // normalized value + smootherstep gives a soft ease-in-AND-out arrival (and
    // return), smoother than a plain per-frame lerp. ~0.62s, fps-independent.
    const dt = Math.min(delta, 1 / 30);
    focusT.current = THREE.MathUtils.clamp(
      focusT.current + (isActive ? 1 : -1) * (dt / 0.62),
      0,
      1
    );
    const f = focusT.current;
    const e = f * f * f * (f * (f * 6 - 15) + 10); // smootherstep

    // gallery pose ↔ hero (focus) pose. The focus composition depends on the
    // viewport orientation: landscape puts the card center-LEFT with the info
    // panel to its right; portrait (phones) centers it in the UPPER half and
    // the info becomes a bottom sheet — pushed back + scaled so the whole card
    // fits the narrow width instead of spilling off the left edge.
    // match the CSS focus breakpoint (820px) so the 3D pose and the DOM info
    // layout always agree on which composition (landscape vs portrait) is used
    const portrait =
      typeof window !== "undefined" && window.innerWidth <= 820;
    const gy = item.y + Math.sin(t * 0.5 + item.z) * 0.12;
    const gscale = hover.current && !someActive ? 1.12 : 1;
    const fx = portrait ? 0 : -1.75;
    const fy = (portrait ? 2.35 : 0.1) + Math.sin(t * 0.6) * 0.05;
    const fz = camZ - (portrait ? 13.5 : 8.6);
    const fscale = portrait ? 0.74 : 1.5;
    const fryTarget = portrait
      ? Math.sin(t * 0.45) * 0.04
      : item.ry * 0.6 + Math.sin(t * 0.45) * 0.05;
    const L = THREE.MathUtils.lerp;
    g.position.set(L(item.x, fx, e), L(gy, fy, e), L(item.z, fz, e));
    g.rotation.y = L(item.ry, fryTarget, e);
    const sc = L(gscale, fscale, e);
    g.scale.set(sc, sc, sc);

    // ── preview video (updated first so the poster can hide beneath it) ──
    // plays across the approach corridor OR while focused
    let vidVis = 0;
    if (video && vidMat.current) {
      const d = camZ - item.z;
      // narrower corridor → fewer clips decoding simultaneously (still ~2-3
      // cards of lead time so preload="none" videos are ready before arrival)
      const inCorridor = d > -3 && d < 34;
      const wantPlay = isActive || (inCorridor && !someActive);
      if (wantPlay) {
        /* belt-and-braces for browsers that don't fetch a DETACHED media
           element on their own: if nothing has loaded by the time we want it,
           kick the fetch explicitly (once) so readyState can reach HAVE_DATA
           and the video can take over from the poster */
        if (video.readyState === 0 && !forcedLoad.current) {
          forcedLoad.current = true;
          try {
            video.load();
          } catch {}
        }
        if (video.paused) {
          const pr = video.play();
          if (pr) pr.catch(() => {});
        }
      } else if (!video.paused) {
        video.pause();
      }
      // only reveal the video — and, below, hide the poster beneath it — once it
      // genuinely has a frame; until then the poster stays as the fallback so a
      // still-loading video never leaves a black card
      const hasFrame = video.readyState >= 2;
      const vidTarget = !hasFrame
        ? 0
        : isActive
          ? 0.99
          : someActive
            ? 0
            : inCorridor
              ? hover.current
                ? 0.9
                : 0.72
              : 0;
      vidMat.current.opacity += (vidTarget - vidMat.current.opacity) * 0.18;
      vidVis = vidMat.current.opacity;
    }

    // ── poster opacity ── focused = full, others dissolve into the fog; and it
    // fades out beneath the preview video so the two never ghost together
    let baseTarget = isActive ? 0.99 : someActive ? 0.045 : hover.current ? 0.9 : 0.72;
    baseTarget *= 1 - Math.min(1, vidVis / 0.6);
    if (baseMat.current)
      baseMat.current.opacity += (baseTarget - baseMat.current.opacity) * 0.16;
  });

  return (
    <group ref={grp} position={[item.x, item.y, item.z]} rotation={[0, item.ry, 0]}>
      {/* poster screenshot — also the far / loading state for video cards */}
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation();
          hover.current = true;
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          hover.current = false;
          document.body.style.cursor = "";
        }}
        onClick={(e) => {
          e.stopPropagation();
          onOpen(item.p); // fly this card forward + open its info panel
        }}
      >
        <planeGeometry args={[CARD_W, CARD_H]} />
        {/* rounded (alphaMap) + translucent; opacity is driven imperatively in
            useFrame (focus / fade), so the initial value here is just a seed */}
        <meshBasicMaterial
          ref={baseMat}
          map={tex}
          alphaMap={roundMask ?? undefined}
          transparent
          opacity={0.72}
          toneMapped={false}
        />
      </mesh>

      {/* live preview video, crossfaded in as the card nears (video cards only) */}
      {videoTex && (
        <mesh position={[0, 0, 0.012]} raycast={() => null}>
          <planeGeometry args={[CARD_W, CARD_H]} />
          <meshBasicMaterial
            ref={vidMat}
            map={videoTex}
            alphaMap={roundMask ?? undefined}
            transparent
            opacity={0}
            toneMapped={false}
          />
        </mesh>
      )}

    </group>
  );
}

function Rig({
  progress,
  endZ,
  activeIdRef,
}: {
  progress: React.MutableRefObject<number>;
  endZ: number;
  activeIdRef: React.MutableRefObject<string | null>;
}) {
  const { camera } = useThree();
  const heldZ = useRef<number | null>(null);
  useFrame(() => {
    // while a card is being inspected, freeze the fly-through where it stands
    if (activeIdRef.current !== null) {
      if (heldZ.current === null) heldZ.current = camera.position.z;
      camera.position.set(0, 0, heldZ.current);
      camera.lookAt(0, 0, heldZ.current - 8);
      return;
    }
    heldZ.current = null;
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
  const { lang, t } = useLang();
  const sectionRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  /* scroll-scrubbed background video (behind the 3D gallery) */
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoDur = useRef(0); // known only after loadedmetadata
  const videoTime = useRef(0); // eased playhead we seek toward
  const blackoutRef = useRef<HTMLDivElement>(null); // fades the scene to black at the end
  const [inView, setInView] = useState(false);
  /* only hold a WebGL context while the gallery is near the viewport, and
     drop the dpr a notch if the device can't keep the fly-through smooth */
  const near = useNearViewport(sectionRef);
  const { key: glKey, onCreated } = useContextRecovery();
  const [dpr, setDpr] = useState(1.6);
  /* the inspected project (null = none). `active` drives the DOM; the ref
     mirror lets the R3F frame loop read it without re-rendering the cards. */
  const [active, setActive] = useState<ArchiveProject | null>(null);
  const activeIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeIdRef.current = active?.id ?? null;
  }, [active]);

  /* while inspecting: lock scroll (freeze the fly-through) + Escape to close */
  useEffect(() => {
    if (!active) return;
    scrollBridge.lenis?.stop();
    // hide the section header (title/sub) while inspecting so it doesn't clutter
    // the focus view — restored to its scroll-appropriate opacity on close
    if (headRef.current) headRef.current.style.opacity = "0";
    // hide the global fixed header (logo + hamburger) so its controls don't
    // collide with the focus close / info (see Header.module.css)
    document.body.classList.add("inspecting");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      scrollBridge.lenis?.start();
      document.body.classList.remove("inspecting");
      if (headRef.current)
        headRef.current.style.opacity = String(
          Math.max(0, 1 - progress.current / 0.14)
        );
    };
  }, [active]);

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
      // fade the whole cosmic scene to the contact section's own colour over
      // the last stretch of the fly-through, reaching solid early and HOLDING
      // — so when the sticky finally unpins it's already an unbroken dark
      // surface that reads as one continuous plane with the closer below (no
      // "section scrolling away" seam)
      if (blackoutRef.current)
        blackoutRef.current.style.opacity = String(
          clamp01((t - 0.7) / 0.24)
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

  /* background video: learn its duration, then seat the playhead at the
     CURRENT scroll progress (no frame-0 flash on a mid-section reload) and
     fade it in. Under reduced motion the scrub loop never starts, so we
     just hold one still, aesthetic mid-frame. */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const seat = () => {
      if (!Number.isFinite(v.duration) || v.duration <= 0) return;
      videoDur.current = v.duration;
      const reduce =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const t = reduce
        ? (v.duration - 0.05) * 0.5
        : clamp01(progress.current) * (v.duration - 0.05);
      videoTime.current = t;
      try {
        v.currentTime = t;
      } catch {}
      v.dataset.ready = "1"; // CSS fades it up
    };
    if (v.readyState >= 1) seat();
    else v.addEventListener("loadedmetadata", seat, { once: true });
    return () => v.removeEventListener("loadedmetadata", seat);
  }, []);

  /* very smooth scroll scrub: only runs while the section is in view. Each
     frame we ease the playhead toward progress·duration and *seek* only past
     a small threshold. The video is re-encoded all-intra (every frame a
     keyframe) so those seeks are instant — the motion is buttery even on
     fast flicks. rAF is fully torn down on exit / unmount. */
  useEffect(() => {
    if (!inView) return;
    const v = videoRef.current;
    if (!v) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return; // reduced motion → hold the static frame seated above
    let raf = 0;
    let prev = 0;
    const loop = (now: number) => {
      const dt = prev ? Math.min((now - prev) / 1000, 1 / 30) : 1 / 60;
      prev = now;
      const dur = videoDur.current;
      if (dur > 0) {
        const target = clamp01(progress.current) * (dur - 0.05);
        // ~0.22 per 60fps-frame, made refresh-rate independent
        const k = 1 - Math.pow(1 - 0.22, dt * 60);
        videoTime.current += (target - videoTime.current) * k;
        if (Math.abs(videoTime.current - v.currentTime) > 0.008)
          v.currentTime = videoTime.current;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [inView]);

  /* mount the canvas only near the section; render only while visible */
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setInView(e.isIntersecting),
      // mount ~90% of a viewport BEFORE the section arrives so the one-time
      // texture upload + WebGL context spike lands while the previous section
      // is still on screen, not at the moment of entry
      { rootMargin: "40% 0px 90% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section id="references" ref={sectionRef} className={styles.section}>
      <div className={styles.sticky}>
        {/* scroll-scrubbed background video — sits behind the 3D gallery
            (canvas is transparent). Never plays; time is driven by scroll. */}
        <div className={styles.videoBg} aria-hidden="true">
          <video
            ref={videoRef}
            className={styles.videoBgEl}
            src="/assets/works-section-bg-scrub.mp4?v=3"
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            tabIndex={-1}
          />
          <i className={styles.videoBgVeil} />
        </div>

        <div ref={headRef} className={styles.head}>
          <p className={styles.eyebrow}>
            <span />
            {t.archive.eyebrow}
            <em className={styles.count}>{pad(ARCHIVE_PROJECTS.length)}</em>
          </p>
          <h2 className={styles.title}>{t.archive.title}</h2>
        </div>

        {near && (
          <Canvas
            key={glKey}
            className={styles.canvas}
            frameloop={inView ? "always" : "never"}
            dpr={dpr}
            onCreated={onCreated}
            gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
            camera={{ position: [0, 0, START_Z], fov: 52, near: 0.1, far: 130 }}
          >
            <PerformanceMonitor
              onDecline={() => setDpr(1)}
              onIncline={() => setDpr(1.6)}
            />
            {/* transparent clear so the scroll-scrubbed video shows through;
                fog still fades distant cards into the dark cosmic backdrop */}
            <fog attach="fog" args={["#050403", 16, 66]} />
            <Suspense fallback={null}>
              {items.map((it) => (
                <Screen
                  key={it.p.id}
                  item={it}
                  onOpen={setActive}
                  activeIdRef={activeIdRef}
                />
              ))}
            </Suspense>
            <Rig progress={progress} endZ={endZ} activeIdRef={activeIdRef} />
          </Canvas>
        )}

        {/* scroll-driven fade to pure black at the end of the fly-through */}
        <div ref={blackoutRef} className={styles.blackout} aria-hidden="true" />
      </div>

      {/* ── inspect: the clicked card flies FORWARD in the 3D scene; this DOM
          layer only carries the info + a click-to-dismiss catcher, the floating
          card itself is the visual (centre-left of the screen) ── */}
      {active && (
        <div
          className={styles.focus}
          style={{ "--accent": active.accentColor } as React.CSSProperties}
        >
          {/* transparent catcher — click anywhere but the panel to dismiss */}
          <div
            className={styles.focusCatcher}
            onClick={() => setActive(null)}
            aria-hidden="true"
          />
          <div className={styles.focusScrim} aria-hidden="true" />

          {/* HUD corner brackets */}
          <span className={`${styles.hud} ${styles.hudTL}`} aria-hidden="true" />
          <span className={`${styles.hud} ${styles.hudTR}`} aria-hidden="true" />
          <span className={`${styles.hud} ${styles.hudBL}`} aria-hidden="true" />
          <span className={`${styles.hud} ${styles.hudBR}`} aria-hidden="true" />

          <button
            className={styles.focusClose}
            onClick={() => setActive(null)}
            aria-label={t.archive.close}
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>

          {/* right-side editorial info */}
          <div className={styles.focusInfo}>
            <span className={styles.focusIndex} aria-hidden="true">
              {String(ARCHIVE_PROJECTS.indexOf(active) + 1).padStart(2, "0")}
            </span>
            <p className={styles.inspectEyebrow}>
              <span />
              {pick(active.category, lang)}
            </p>
            <h3 className={styles.inspectName}>{active.name}</h3>
            <div className={styles.inspectMeta}>
              <span className={styles.inspectYear}>{active.year}</span>
              {active.liveUrl && (
                <span className={styles.inspectLive}>
                  <i />
                  {t.archive.live}
                </span>
              )}
            </div>
            <div className={styles.inspectStack}>
              {pickList(active.stack, lang).map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>
            {active.liveUrl && (
              <a
                className={styles.inspectBtn}
                href={active.liveUrl}
                target="_blank"
                rel="noreferrer"
              >
                {t.archive.visit}
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path
                    d="M7 17L17 7M9 7h8v8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
