"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  FEATURED_PROJECTS,
  type FeaturedProject,
  type ProjectMedia,
} from "./projects";
import styles from "./SelectedWork.module.css";
import MacBook3D, { syncVideoPhase } from "./MacBook3D";
import { invalidate } from "@react-three/fiber";
import { swScroll } from "./swScrollBus";
import { scrollBridge } from "./scrollBridge";

import iphoneFrame from "@/public/assets/iphone.png";

gsap.registerPlugin(ScrollTrigger);

const N = FEATURED_PROJECTS.length;
const TRANSITIONS = N - 1;

/* Per-project SCENE accent — drives the CSS stage's key light, floor grid
   tint and glass-panel border. Kept out of projects.ts so the data
   structure is untouched; falls back to each project's gold accentColor.
   Editorial, not neon: a restrained tint over the black-gold base. */
const SCENE_ACCENT: Record<string, string> = {
  miyavhav: "#e8823c", // warm orange
  derunstudio: "#6fb3a4", // sage teal (interior / wellbeing)
  "dr-cem-akman": "#d98a9e", // soft rose (medical-aesthetic)
  "bilitro-com": "#d8a94f", // Bilitro gold
  ngequipments: "#c98f3a", // industrial amber
  "cpa-fahrdienst": "#e0a63a", // transfer amber / gold
};
const sceneAccentOf = (i: number) =>
  SCENE_ACCENT[FEATURED_PROJECTS[i]?.id] ??
  FEATURED_PROJECTS[i]?.accentColor ??
  "#d8a94f";
/** smootherstep — zero 1st AND 2nd derivative at both ends */
const smooth5 = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/* source-rect size of the DOM screen overlay (matches the capture
   ratio); matrix3d maps this rect onto the projected 3D screen quad */
const OV_W = 1600;
const OV_H = 1040;

/* ── 4-point perspective mapping (projective transform) ──
   Maps the (0,0)-(w,0)-(w,h)-(0,h) rect onto an arbitrary quad.
   Classic adjugate method; returns a CSS matrix3d() string. */
type Nine = number[];
function adj3(m: Nine): Nine {
  return [
    m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4],
    m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5],
    m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3],
  ];
}
function mul3(a: Nine, b: Nine): Nine {
  const r = new Array(9).fill(0);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return r;
}
function mulV3(m: Nine, v: number[]): number[] {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}
function basisToPoints(
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number
): Nine {
  const m: Nine = [x1, x2, x3, y1, y2, y3, 1, 1, 1];
  const v = mulV3(adj3(m), [x4, y4, 1]);
  return mul3(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]);
}
/** corners: TL, TR, BR, BL in destination pixels */
function quadMatrix3d(
  w: number, h: number,
  x0: number, y0: number, x1: number, y1: number,
  x2: number, y2: number, x3: number, y3: number
): string {
  const src = basisToPoints(0, 0, w, 0, 0, h, w, h);
  const dst = basisToPoints(x0, y0, x1, y1, x3, y3, x2, y2);
  const t = mul3(dst, adj3(src));
  if (!t[8]) return "";
  for (let i = 0; i < 9; i++) t[i] /= t[8];
  const m = [
    t[0], t[3], 0, t[6],
    t[1], t[4], 0, t[7],
    0, 0, 1, 0,
    t[2], t[5], 0, t[8],
  ];
  return `matrix3d(${m.join(",")})`;
}

/** bumped with every motion-fix round — printed to the console and shown
 *  in the ?swdebug HUD so there is never any doubt WHICH code is running
 *  in the browser being tested */
const BUILD_TAG = "r52-archive-spacegallery-10.07";
const pad = (n: number) => String(n + 1).padStart(2, "0");
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/* ════════════════════════════════════════════════
   Screen media — image / video / iframe / placeholder.
   Live iframes mount only once their device pair has SETTLED; while the
   devices travel, a poster/placeholder shows instead.
   ════════════════════════════════════════════════ */

function ScreenMedia({
  media,
  project,
  variant,
  settled,
  interactive,
}: {
  media: ProjectMedia;
  project: FeaturedProject;
  variant: "desktop" | "mobile";
  settled: boolean;
  interactive: boolean;
}) {
  if (media.type === "iframe" && media.src) {
    return settled ? (
      <iframe
        src={media.src}
        title={`${project.name} live preview`}
        className={`${styles.mediaFill} ${interactive ? styles.iframeLive : ""}`}
        loading="lazy"
        sandbox="allow-scripts allow-same-origin"
      />
    ) : (
      <div className={styles.iframeResting} aria-hidden="true" />
    );
  }

  if (media.type === "video" && media.src) {
    return (
      <video
        className={styles.mediaFill}
        src={media.src}
        poster={media.poster}
        muted
        loop
        playsInline
        preload="metadata"
      />
    );
  }

  if (media.type === "image" && media.src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={styles.mediaFill} src={media.src} alt="" loading="lazy" />;
  }

  return (
    <div
      className={variant === "desktop" ? styles.phDesktop : styles.phMobile}
      style={{ "--accent": project.accentColor } as React.CSSProperties}
    >
      {variant === "desktop" && (
        <div className={styles.phChrome}>
          <i />
          <i />
          <i />
          <span>{project.id}.com</span>
        </div>
      )}
      <div className={styles.phBody}>
        <span className={styles.phIndex}>
          {pad(FEATURED_PROJECTS.indexOf(project))}
        </span>
        <span className={styles.phName}>{project.name}</span>
        <span className={styles.phCat}>{project.category}</span>
      </div>
      <div className={styles.phRule} />
    </div>
  );
}

/* ════════════════════════════════════════════════
   One MacBook + iPhone pair. Two of these alternate on stage; the
   exited pair is recycled for the next project.
   ════════════════════════════════════════════════ */

interface PairRefs {
  pair: RefObject<HTMLDivElement | null>;
  phone: RefObject<HTMLDivElement | null>;
}

function DevicePair({
  project,
  refs,
  hiddenAtRest,
  settled,
}: {
  project: FeaturedProject;
  refs: PairRefs;
  hiddenAtRest: boolean;
  settled: boolean;
}) {
  return (
    <div
      ref={refs.pair}
      className={`${styles.pair} ${hiddenAtRest ? styles.pairResting : ""}`}
    >
      {/* iPhone — companion device; the MacBook is the 3D model behind.
          Kept mounted even when hidden (noMobile) so applyVisual's ref
          guard stays satisfied; CSS just display:none's it. */}
      <div
        ref={refs.phone}
        className={`${styles.phoneWrap} ${project.noMobile ? styles.phoneHidden : ""}`}
        data-sw-phone=""
      >
        <div className={styles.phoneFloat} data-sw-float="phone">
          <div className={styles.phoneScreen}>
            {/* the mobile site fills the whole glass — no status bar */}
            <div className={styles.phoneSite}>
              <ScreenMedia
                media={project.mobileMedia}
                project={project}
                variant="mobile"
                settled={settled}
                interactive={false}
              />
            </div>
          </div>
          <Image
            src={iphoneFrame}
            alt=""
            fill
            sizes="(max-width: 1023px) 30vw, 13vw"
            className={styles.frameImg}
          />
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   Selected Work — scroll-driven device-pair carousel.

   Scroll progress is divided into N-1 transition units. During unit k the
   pair holding project k exits stage-right while the other pair, already
   loaded with project k+1, enters from stage-left. Everything is a pure
   function of scroll progress — fully reversible, no snapping.
   ════════════════════════════════════════════════ */

export default function SelectedWork() {
  const sectionRef = useRef<HTMLElement>(null);

  const pairARef = useRef<HTMLDivElement>(null);
  const phoneARef = useRef<HTMLDivElement>(null);
  const pairBRef = useRef<HTMLDivElement>(null);
  const phoneBRef = useRef<HTMLDivElement>(null);

  /* which transition unit we're in — drives pair→project assignment */
  const [k, setK] = useState(0);
  /* which project the right panel shows */
  const [textIdx, setTextIdx] = useState(0);
  /* which project (if any) is settled — gates video playback + live mode */
  const [settled, setSettled] = useState<number>(0);

  /* ── CANLI İNCELE (screen-dive live mode) ── */
  const [live, setLive] = useState<"off" | "enter" | "on" | "exit">("off");
  const [frameState, setFrameState] = useState<"loading" | "ok" | "fail">(
    "loading"
  );
  const liveBtnRef = useRef<HTMLButtonElement>(null);
  const screenOvRef = useRef<HTMLDivElement>(null);
  const screenOvVideoRef = useRef<HTMLVideoElement>(null);
  const savedScrollY = useRef(0);
  /** scroll progress frozen at live-enter; restored verbatim at exit */
  const frozenProg = useRef(0);

  const kRef = useRef(0);
  const textIdxRef = useRef(0);
  const settledRef = useRef(0);

  const liveSrcOf = (proj?: FeaturedProject) =>
    proj
      ? proj.desktopMedia.type === "iframe" && proj.desktopMedia.src
        ? proj.desktopMedia.src
        : proj.liveUrl
      : null;

  /* Scroll lock WITHOUT layout shift: `overflow: hidden` removes the
     scrollbar, which resizes the canvas and shifts the whole stage —
     that was the visible "teleport left" after exiting live mode.
     Instead we swallow every scroll input while leaving layout alone. */
  const scrollLockRef = useRef<(() => void) | null>(null);
  const lockScroll = () => {
    if (scrollLockRef.current) return;
    const block = (e: Event) => e.preventDefault();
    const keys = new Set([
      "ArrowUp",
      "ArrowDown",
      "PageUp",
      "PageDown",
      "Home",
      "End",
      " ",
    ]);
    const blockKeys = (e: KeyboardEvent) => {
      if (keys.has(e.key)) e.preventDefault();
    };
    window.addEventListener("wheel", block, { passive: false });
    window.addEventListener("touchmove", block, { passive: false });
    window.addEventListener("keydown", blockKeys);
    scrollLockRef.current = () => {
      window.removeEventListener("wheel", block);
      window.removeEventListener("touchmove", block);
      window.removeEventListener("keydown", blockKeys);
      scrollLockRef.current = null;
    };
  };
  const unlockScroll = () => scrollLockRef.current?.();

  const enterLive = (idx: number) => {
    if (live !== "off" || settled !== idx) return;
    const src = liveSrcOf(FEATURED_PROJECTS[idx]);
    if (!src) return;
    /* FREEZE the complete base scene: store the exact scroll state, pin
       target and damped progress to it, and stop Lenis so no residual
       inertia can move anything while live mode owns the camera. From
       here every visible change is a pure function of swScroll.live. */
    savedScrollY.current = window.scrollY;
    frozenProg.current = swScroll.smooth;
    swScroll.progress = frozenProg.current;
    swScroll.frozen = true;
    scrollBridge.lenis?.stop();
    swScroll.liveIdx = idx;
    swScroll.liveTarget = 1;
    lockScroll();
    // frameState is NOT reset here — the overlay iframe pre-loaded while
    // the project was settled, so a ready frame crossfades in instantly
    setLive("enter");
  };

  const exitLive = () => {
    if (live !== "on" && live !== "enter") return;
    setLive("exit");
    // brief head start for the iframe fade — the camera then pulls back
    // behind it while it is still dissolving (depth, no dead pause)
    window.setTimeout(() => {
      swScroll.liveTarget = 0;
    }, 120);
  };

  /* enter: hand off to the DOM iframe once the display fills the view;
     exit: pure reverse of the same clocked progress. Scroll control is
     handed back ONLY after liveProgress is exactly 0 AND the frozen
     scroll state has been restored and resynced for two full frames. */
  const finishingRef = useRef(false);
  useEffect(() => {
    if (live === "enter") {
      const id = window.setInterval(() => {
        if (swScroll.live > 0.8) setLive("on");
      }, 60);
      return () => window.clearInterval(id);
    }
    if (live === "exit") {
      finishingRef.current = false;
      const id = window.setInterval(() => {
        if (finishingRef.current || swScroll.live > 0.001) return;
        finishingRef.current = true;
        swScroll.live = 0;
        /* scroll handoff: kill any residual Lenis inertia target, put
           the browser scroll back exactly where it froze, resync
           ScrollTrigger (update — NOT refresh, layout never changed),
           then wait two rAF cycles with the scene still frozen before
           unlocking. Nothing can move during those frames. */
        scrollBridge.lenis?.scrollTo(savedScrollY.current, {
          immediate: true,
          force: true,
        });
        window.scrollTo(0, savedScrollY.current);
        swScroll.progress = frozenProg.current;
        swScroll.smooth = frozenProg.current;
        ScrollTrigger.update();
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            swScroll.frozen = false;
            swScroll.liveIdx = -1;
            scrollBridge.lenis?.start();
            unlockScroll();
            setLive("off");
            liveBtnRef.current?.focus();
          })
        );
      }, 60);
      return () => window.clearInterval(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  /* Escape closes live mode; safety-restore scroll lock on unmount */
  useEffect(() => {
    if (live === "off") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") exitLive();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  useEffect(
    () => () => {
      scrollLockRef.current?.();
      swScroll.liveTarget = 0;
      swScroll.live = 0;
      swScroll.liveIdx = -1;
      swScroll.frozen = false;
      scrollBridge.lenis?.start();
    },
    []
  );

  /* CSP / X-Frame-Options fallback: if the site never loads, say so */
  useEffect(() => {
    if (live !== "on" || frameState !== "loading") return;
    const t = window.setTimeout(
      () => setFrameState((f) => (f === "loading" ? "fail" : f)),
      6000
    );
    return () => window.clearTimeout(t);
  }, [live, frameState]);

  /* continuity inspector — visit with ?swdebug to enable (works in prod
     too so real-machine recordings carry the numbers with them) */
  const [dbg, setDbg] = useState<{
    t: number;
    d: number;
    k: number;
    lt: number;
    fps: number;
    live: number;
    fz: boolean;
  } | null>(null);
  useEffect(() => {
    console.info(`[KT] Selected Work build ${BUILD_TAG}`);
    if (!window.location.search.includes("swdebug")) return;
    /* rolling fps counter — frame drops are the prime suspect for any
       perceived stutter, so the HUD must show them */
    let frames = 0;
    let last = performance.now();
    let fps = 0;
    let raf = 0;
    const loop = () => {
      frames++;
      const now = performance.now();
      if (now - last >= 500) {
        fps = Math.round((frames * 1000) / (now - last));
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const id = window.setInterval(() => {
      const f = Math.min(
        swScroll.smooth * TRANSITIONS,
        TRANSITIONS - 1e-5
      );
      const kk = Math.max(0, Math.floor(f));
      setDbg({
        t: swScroll.progress,
        d: swScroll.smooth,
        k: kk,
        lt: f - kk,
        fps,
        live: swScroll.live,
        fz: swScroll.frozen,
      });
    }, 120);
    return () => {
      window.clearInterval(id);
      cancelAnimationFrame(raf);
    };
  }, []);

  /* pair A carries even projects, pair B odd — recycled alternately */
  const aIdx = Math.min(k % 2 === 0 ? k : k + 1, N - 1);
  const bIdx = Math.min(k % 2 === 0 ? k + 1 : k, N - 1);

  /* the live-overlay iframe pre-loads for whichever project is settled,
     so the CANLI İNCELE dive never pays a mount/network hitch. It keeps
     the LAST settled project through transitions (settled = -1) so the
     iframe is never unmounted/remounted mid-scroll. */
  const [overlayProj, setOverlayProj] = useState(0);
  const overlayProjRef = useRef(0);
  useEffect(() => {
    if (settled >= 0) {
      setOverlayProj(settled);
      overlayProjRef.current = settled;
      /* new settle = new media epoch: every screen starts its clip
         from the FIRST frame, all devices share the same phase */
      swScroll.mediaEpoch = performance.now();
    }
  }, [settled]);
  const overlayIdx = swScroll.liveIdx >= 0 ? swScroll.liveIdx : overlayProj;
  const overlayEmbeddable =
    FEATURED_PROJECTS[overlayIdx]?.liveEmbed !== false;
  const overlaySrc = overlayEmbeddable
    ? liveSrcOf(FEATURED_PROJECTS[overlayIdx])
    : null;
  const overlayHref = liveSrcOf(FEATURED_PROJECTS[overlayIdx]);

  /* a different project (or none) settled → the iframe src changes and
     must load again before it may crossfade in. Projects that forbid
     embedding go straight to the "Yeni Sekmede Aç" card. */
  useEffect(() => {
    setFrameState(overlayEmbeddable ? "loading" : "fail");
  }, [overlaySrc, overlayEmbeddable]);

  /* the overlay iframe must be created AFTER hydration: if it were in the
     server HTML, example.com would finish loading before React attaches
     onLoad and the ready state would never flip */
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  /* videos play only on the settled pair */
  useEffect(() => {
    const root = sectionRef.current;
    if (!root) return;
    [
      { el: pairARef.current, idx: aIdx },
      { el: pairBRef.current, idx: bIdx },
    ].forEach(({ el, idx }) => {
      el?.querySelectorAll("video").forEach((v) => {
        if (idx === settled) {
          /* shared settle-epoch phase — starts from the first frame and
             keeps the phone in sync with the laptop's screens */
          syncVideoPhase(v);
          v.play().catch(() => {});
        } else {
          v.pause();
          v.currentTime = 0;
        }
      });
    });
  }, [settled, aIdx, bIdx]);

  useLayoutEffect(() => {
    const root = sectionRef.current;
    if (!root) return;

    const ctx = gsap.context(() => {
      const glow = root.querySelector<HTMLElement>("[data-sw-glow]");
      const stage = root.querySelector<HTMLElement>("[data-sw-stage]");
      const panel = root.querySelector<HTMLElement>("[data-sw-panel]");
      const strip = root.querySelector<HTMLElement>("[data-sw-countstrip]");
      const canvasWrap = root.querySelector<HTMLElement>(
        `.${styles.macCanvas}`
      );
      const progFill = root.querySelector<HTMLElement>("[data-sw-prog]");
      const devices = root.querySelector<HTMLElement>("[data-sw-devices]");
      const textBits = Array.from(
        root.querySelectorAll<HTMLElement>("[data-sw-textbit]")
      );

      const easeIO = gsap.parseEase("power2.inOut");
      const easeOut = gsap.parseEase("power3.out");
      const bump = (t: number) => Math.sin(Math.PI * t);

      /* every visual (DOM phones, text, glow, counter AND the 3D scene)
         derives from ONE damped progress value — raw ScrollTrigger
         progress is only ever a target */
      let lastP = NaN;
      let lastLive = NaN;
      let zoomOn = false;
      const glowMix: { k: number; fn: ((t: number) => string) | null } = {
        k: -1,
        fn: null,
      };
      const sceneMix: { k: number; fn: ((t: number) => string) | null } = {
        k: -1,
        fn: null,
      };
      const applyVisual = (p: number) => {
        /* parked and no live activity → nothing below would change;
           skip every DOM write so the main thread stays idle */
        if (
          Math.abs(p - lastP) < 1e-5 &&
          Math.abs(swScroll.live - lastLive) < 1e-5
        )
          return;
        lastP = p;
        lastLive = swScroll.live;

        if (progFill) gsap.set(progFill, { scaleX: p });

        const f = Math.min(p * TRANSITIONS, TRANSITIONS - 1e-5);
        const kk = Math.max(0, Math.floor(f));
        const lt = f - kk;

        if (kk !== kRef.current) {
          kRef.current = kk;
          setK(kk);
        }
        const ti = lt < 0.55 ? kk : kk + 1;
        if (ti !== textIdxRef.current) {
          textIdxRef.current = ti;
          setTextIdx(ti);
        }
        const st = lt < 0.15 ? kk : lt > 0.85 ? kk + 1 : -1;
        if (st !== settledRef.current) {
          settledRef.current = st;
          setSettled(st);
        }

        const outPair = kk % 2 === 0 ? pairARef.current : pairBRef.current;
        const outPhone = kk % 2 === 0 ? phoneARef.current : phoneBRef.current;
        const inPair = kk % 2 === 0 ? pairBRef.current : pairARef.current;
        const inPhone = kk % 2 === 0 ? phoneBRef.current : phoneARef.current;
        if (!outPair || !inPair || !outPhone || !inPhone) return;

        const vw = window.innerWidth / 100;
        const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
        /* staggered: outgoing owns the first half, incoming the second
           (windows mirror poseFromDistance exactly) */
        const trOut = clamp01((lt - 0.06) / 0.5);
        const trIn = clamp01((lt - 0.42) / 0.48);
        /* live dive: panel, companion phone + glow recede during the
           first 20% of the clocked live progress (and return during the
           final 20% of the exit) — applyVisual is their ONLY alpha
           writer, so every value is a pure function of swScroll.live and
           the exit is the mathematical reverse of the entrance */
        const liveDim = 1 - easeIO(clamp01(swScroll.live / 0.22));
        if (panel) gsap.set(panel, { autoAlpha: liveDim });

        /* ── COMPOSITOR DIVE: the 3D canvas is a frozen image during
           live mode; zooming it with a CSS transform is pure compositor
           work and physically cannot stutter, on any GPU. The exit runs
           the identical curve backward to a bit-exact identity. ── */
        const zt = easeIO(clamp01((swScroll.live - 0.1) / 0.72));
        if (canvasWrap) {
          if (zt > 0.0001) {
            zoomOn = true;
            gsap.set(canvasWrap, {
              transformOrigin: `${swScroll.zoom.ox}px ${swScroll.zoom.oy}px`,
              x: swScroll.zoom.tx * zt,
              y: swScroll.zoom.ty * zt,
              scale: 1 + (swScroll.zoom.s - 1) * zt,
            });
          } else if (zoomOn) {
            zoomOn = false;
            gsap.set(canvasWrap, { clearProps: "transform,transformOrigin" });
          }
        }

        /* ── outgoing pair: leaves and fully fades in the FIRST half.
           NOTE: no DOM blur — animating a CSS filter re-rasterizes the
           layer every frame for an element that is already ~invisible
           at that point, and it visibly cost frames on mid GPUs. ── */
        const to = easeIO(trOut);
        const outFade = 1 - smoother(clamp01((lt - 0.22) / 0.3));
        gsap.set(outPair, {
          x: 42 * vw * to,
          z: -150 * to,
          rotationY: 10 * to,
          rotationX: 2 * to,
          scale: 1 - 0.18 * to,
          autoAlpha: outFade,
        });
        /* outgoing iPhone: swells toward the camera, arcs right, tilts
           away and dies together with its MacBook's display */
        gsap.set(outPhone, {
          x: 9 * vw * to,
          y: -38 * bump(to),
          rotationY: 9 * to,
          rotationZ: 3.5 * to,
          scale: 1 + 0.09 * bump(to),
          autoAlpha: (1 - smoother(clamp01((lt - 0.2) / 0.28))) * liveDim,
        });

        /* ── incoming: enters from stage-left in the SECOND half ── */
        const ti2 = easeOut(trIn);
        const inFade = clamp01(trIn / 0.3);
        gsap.set(inPair, {
          x: -44 * vw * (1 - ti2),
          y: 20 * (1 - ti2),
          z: -60 * (1 - ti2), // starts slightly back, lands at stage depth
          rotationY: -12 * (1 - ti2),
          rotationX: 1.5 * (1 - ti2),
          scale: 0.82 + 0.18 * ti2,
          autoAlpha: inFade,
        });
        /* incoming iPhone: farther left, stronger tilt, shallow arc around
           the MacBook's front edge, arrives after the MacBook */
        const ph = clamp01((trIn - 0.12) / 0.88);
        const phE = easeOut(ph);
        gsap.set(inPhone, {
          x: -12 * vw * (1 - phE),
          y: 30 * (1 - phE) - 22 * bump(phE),
          rotationY: -10 * (1 - phE),
          rotationZ: -3 * (1 - phE),
          scale: 1 + 0.05 * (1 - phE),
          autoAlpha: clamp01(ph / 0.3) * liveDim,
        });

        /* ── glow hands off from the outgoing pair to the incoming ──
           (interpolator cached per segment — building it every tick
           allocated garbage all through the transition) */
        if (glow) {
          const mixT = clamp01((lt - 0.3) / 0.4);
          if (glowMix.k !== kk) {
            glowMix.k = kk;
            glowMix.fn = gsap.utils.interpolate(
              FEATURED_PROJECTS[kk].accentColor,
              FEATURED_PROJECTS[Math.min(kk + 1, N - 1)].accentColor
            );
          }
          glow.style.setProperty("--accent", glowMix.fn!(mixT));
          gsap.set(glow, {
            x: -12 * vw * bump(to),
            opacity: (1 - 0.25 * bump(to)) * liveDim,
          });
        }

        /* ── scene accent: the whole CSS stage (floor grid, ambient key
           light, glass-panel border) shifts colour across the transition.
           Same segment-cached interpolator pattern as the glow. ── */
        if (stage) {
          const mixT = clamp01((lt - 0.28) / 0.44);
          if (sceneMix.k !== kk) {
            sceneMix.k = kk;
            sceneMix.fn = gsap.utils.interpolate(
              sceneAccentOf(kk),
              sceneAccentOf(Math.min(kk + 1, N - 1))
            );
          }
          stage.style.setProperty("--scene", sceneMix.fn!(mixT));
        }

        /* ── counter rolls vertically: 01 exits up, 02 enters from below ── */
        if (strip) {
          const roll = easeIO(clamp01((lt - 0.4) / 0.3));
          gsap.set(strip, { yPercent: (-(kk + roll) * 100) / N });
        }

        /* ── right panel copy: staggered out, staggered back in ── */
        textBits.forEach((el, i) => {
          const outR = easeIO(clamp01((lt - 0.26 - i * 0.028) / 0.16));
          const inR = easeOut(clamp01((lt - 0.56 - i * 0.038) / 0.2));
          const before = lt < 0.55;
          gsap.set(el, {
            autoAlpha: before ? 1 - outR : inR,
            y: before ? -14 * outR : 16 * (1 - inR),
          });
        });

        /* r32: the device group used to hold a -5deg/1.6deg 3D tilt, but a
           3D-transformed (preserve-3d) subtree rasterises its DOM screen
           content at reduced resolution → the soft phone. Keep it flat so
           the phone renders crisp at native dpr. */
        if (devices) gsap.set(devices, { rotationY: 0, rotationX: 0 });
      };

      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const stage = root.querySelector("[data-sw-stage]");

        ScrollTrigger.create({
          trigger: stage,
          start: "top top",
          end: "+=520%",
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate(self) {
            swScroll.progress = self.progress;
          },
          onRefresh(self) {
            swScroll.progress = self.progress;
          },
        });

        /* single damped-progress writer: absorbs uneven wheel input and
           keeps DOM + 3D perfectly in sync (runs even while the canvas
           is still loading the model) */
        /* only render the 3D scene while the section is anywhere near
           the viewport — an off-screen WebGL loop is pure GPU waste */
        const visRef = { current: true };
        const io = new IntersectionObserver(
          ([e]) => {
            visRef.current = e.isIntersecting;
          },
          { rootMargin: "30% 0px" }
        );
        io.observe(root);
        let lastInvalidate = 0;

        const tick = (_t: number, deltaMS: number) => {
          /* cap at two 60fps frames: after a main-thread stall the damp
             glides on from where it froze instead of closing the gap in
             a few giant steps ("the laptop covers too much distance") */
          const dt = Math.min(deltaMS / 1000, 1 / 30);

          /* live-dive clock lives HERE (not in useFrame): the 3D canvas
             stops rendering entirely during the dive, so the clock must
             run on the always-on ticker. ~2.2s in; the exit glides
             faster through the flat zones of the zoom curve. */
          if (swScroll.liveTarget === 1 && swScroll.live < 1)
            swScroll.live = Math.min(1, swScroll.live + dt / 2.2);
          else if (swScroll.liveTarget === 0 && swScroll.live > 0) {
            const L = swScroll.live;
            const zoneA = smooth5(clamp01((L - 0.74) / 0.24));
            const zoneB = 1 - smooth5(clamp01((L - 0.04) / 0.26));
            const speed = 1 + 1.7 * Math.max(zoneA, zoneB);
            swScroll.live = Math.max(0, L - (dt * speed) / 1.9);
          }
          /* while live mode owns the scene the damped progress is frozen
             solid — ScrollTrigger may write `progress` all it wants, the
             base scene never sees it. applyVisual still runs so the
             live-derived fades keep updating. */
          if (!swScroll.frozen) {
            /* λ7: slightly softer spring than before — tight tracking
               transmits every wheel-notch ripple straight into the
               laptop's motion; a touch more float absorbs them without
               feeling detached at settle */
            swScroll.smooth = gsap.utils.interpolate(
              swScroll.smooth,
              swScroll.progress,
              1 - Math.exp(-7 * dt)
            );
          }
          applyVisual(swScroll.smooth);
          /* drive the demand-mode 3D canvas at ~120-133Hz max — the
             ticker itself stays at native refresh (Lenis + DOM writes
             are cheap; only the WebGL render needed rate-limiting).
             During the ENTIRE live dive the canvas is a frozen image
             being zoomed by the compositor — zero renders. A couple of
             frames still flow at the very start (crisp dpr-boosted
             capture) and at the very end (dpr restore). */
          /* 8.2ms gate: on a 240Hz display this locks renders to every
             SECOND vsync exactly (clean 120Hz cadence) — a fractional
             rate like 133Hz alternates 1-and-2 vsync intervals and that
             irregularity IS the perceived judder. ≤120Hz displays tick
             at ≥8.33ms, so nothing changes there.
             DURING LIVE the canvas must keep rendering (fully pausing
             left a cleared buffer after the dpr-boost resize → black
             screen behind the zoom), but the scene is frozen and its
             video runs at 24fps — 30Hz is plenty. The CSS zoom itself
             is compositor-borne and stays at native refresh. */
          const now = performance.now();
          const gateMs = swScroll.live > 0.02 ? 33 : 8.2;
          if (visRef.current && now - lastInvalidate >= gateMs) {
            lastInvalidate = now;
            invalidate();
          }

          /* ── DOM screen overlay: a REAL <video>, matrix3d-mapped onto
             the projected 3D screen quad. The compositor plays it (same
             smoothness as the phone); the WebGL texture keeps rendering
             identical, phase-synced content underneath, so fading this
             in/out around the settled state is invisible. ── */
          const ov = screenOvRef.current;
          if (ov) {
            const q = swScroll.quad;
            /* the pose is EXACTLY P_SHOW across the whole settle band
               (physical travel starts at |d| = 0.15), so the overlay can
               stay up until just before motion begins */
            const settleFade =
              q.on && q.idx === overlayProjRef.current
                ? 1 - clamp01((Math.abs(q.d) - 0.11) / 0.035)
                : 0;
            const a = settleFade * (1 - clamp01(swScroll.live / 0.08));
            const vid = screenOvVideoRef.current;
            if (a > 0.001) {
              ov.style.opacity = String(a);
              ov.style.transform = quadMatrix3d(
                OV_W, OV_H,
                q.x0, q.y0, q.x1, q.y1, q.x2, q.y2, q.x3, q.y3
              );
              if (vid && vid.paused && a > 0.5) {
                syncVideoPhase(vid);
                vid.play().catch(() => {});
              }
            } else {
              ov.style.opacity = "0";
              if (vid && !vid.paused) vid.pause();
            }
          }

          /* the companion iPhone is the flat DOM device (.phoneWrap, driven
             by applyVisual) again — no projected-quad overlay to maintain */
        };
        gsap.ticker.add(tick);
        applyVisual(0);

        // idle float on the inner wrappers — never fights the scrub
        gsap.utils
          .toArray<HTMLElement>('[data-sw-float="mac"]')
          .forEach((el, i) =>
            gsap.to(el, {
              y: -7,
              duration: 3.8 + i * 0.4,
              ease: "sine.inOut",
              yoyo: true,
              repeat: -1,
            })
          );
        gsap.utils
          .toArray<HTMLElement>('[data-sw-float="phone"]')
          .forEach((el, i) =>
            gsap.to(el, {
              y: -11,
              duration: 3.0 + i * 0.5,
              delay: 0.6,
              ease: "sine.inOut",
              yoyo: true,
              repeat: -1,
            })
          );

        // bridge line grows in as the section arrives
        gsap.from("[data-sw-bridgeline]", {
          scaleY: 0,
          transformOrigin: "top center",
          ease: "none",
          scrollTrigger: {
            trigger: "[data-sw-bridge]",
            start: "top 92%",
            end: "top 40%",
            scrub: true,
          },
        });

        return () => {
          gsap.ticker.remove(tick);
          io.disconnect();
        };
      });

      // pointer parallax on the float wrappers (cursor devices only)
      mm.add(
        "(min-width: 1024px) and (hover: hover) and (prefers-reduced-motion: no-preference)",
        () => {
          const phones = gsap.utils.toArray<HTMLElement>(
            '[data-sw-float="phone"]'
          );
          const macs = gsap.utils.toArray<HTMLElement>('[data-sw-float="mac"]');
          const pTo = phones.map((el) =>
            gsap.quickTo(el, "x", { duration: 1.1, ease: "power3.out" })
          );
          const mTo = macs.map((el) =>
            gsap.quickTo(el, "x", { duration: 1.3, ease: "power3.out" })
          );
          const onMove = (e: PointerEvent) => {
            const nx = e.clientX / window.innerWidth - 0.5;
            pTo.forEach((fn) => fn(nx * 16));
            mTo.forEach((fn) => fn(nx * 7));
          };
          window.addEventListener("pointermove", onMove, { passive: true });
          return () => window.removeEventListener("pointermove", onMove);
        }
      );
    }, root);

    return () => ctx.revert();
  }, []);

  const p = FEATURED_PROJECTS[textIdx];

  return (
    <section id="work" ref={sectionRef} className={styles.section}>
      {/* ── bridge from About ── */}
      <div className={styles.bridge} data-sw-bridge>
        <span className={styles.bridgeLine} data-sw-bridgeline />
        <p className={styles.bridgeEyebrow}>
          <span />
          Selected Work
          <span />
        </p>
        <h2 className={styles.bridgeTitle}>Projects that ship, scale and sell.</h2>
      </div>

      {/* ── pinned carousel stage ── */}
      <div
        className={styles.stage}
        data-sw-stage
        style={{ "--scene": SCENE_ACCENT[FEATURED_PROJECTS[0].id] } as React.CSSProperties}
      >
        {/* CSS-driven cinematic stage (no bg image): floor grid, coloured
            ambient key light, grounding shadow, film grain. Colour tracks
            the active project via --scene. */}
        <div className={styles.grid} aria-hidden="true" />
        <div className={styles.ambient} data-sw-ambient aria-hidden="true" />
        <div className={styles.floorShadow} aria-hidden="true" />
        <div className={styles.noise} aria-hidden="true" />
        <div
          className={styles.glow}
          data-sw-glow
          style={{ "--accent": FEATURED_PROJECTS[0].accentColor } as React.CSSProperties}
          aria-hidden="true"
        />

        {/* real 3D MacBooks — full-stage canvas so they can enter/exit */}
        <MacBook3D aIdx={aIdx} bIdx={bIdx} settledIdx={settled} />

        {/* DOM screen overlay — the settled MacBook's display as a real
            <video> inside a macOS + Safari chrome, perspective-mapped
            onto the 3D screen quad */}
        <div className={styles.screenOvHost} aria-hidden="true">
          <div ref={screenOvRef} className={styles.screenOv}>
            {/* macOS menu bar with notch */}
            <div className={styles.macMenuBar}>
              <span className={styles.macApple}>
                <svg viewBox="0 0 814 1000">
                  <path d="M788 341c-6 4-107 62-107 187 0 145 127 197 131 198-1 3-20 71-67 140-42 61-86 122-153 122s-84-39-161-39c-75 0-102 40-163 40s-104-56-153-125C58 785 13 664 13 549c0-185 120-283 238-283 63 0 115 41 155 41 38 0 97-44 169-44 27 0 125 3 189 95zM554 172c31-37 53-88 53-139 0-7-1-14-2-20-50 2-110 34-146 76-28 32-55 83-55 135 0 8 2 16 2 18 3 1 8 2 13 2 45 0 102-30 135-72z" />
                </svg>
              </span>
              <span className={styles.macMenuApp}>Safari</span>
              <span>File</span>
              <span>Edit</span>
              <span>View</span>
              <span>History</span>
              <span>Bookmarks</span>
              <span>Window</span>
              <span>Help</span>
              <i className={styles.macNotch} />
              <span className={styles.macMenuRight}>
                <svg className={styles.macWifi} viewBox="0 0 24 24">
                  <path d="M12 19.5 3.3 10.6a12.3 12.3 0 0 1 17.4 0Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                </svg>
                <svg className={styles.macBattery} viewBox="0 0 30 14">
                  <rect x="1" y="1.5" width="24" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="1.4" />
                  <rect x="3" y="3.5" width="17" height="7" rx="1.6" fill="currentColor" />
                  <path d="M27 5v4c1.4-.3 2.2-1 2.2-2S28.4 5.3 27 5Z" fill="currentColor" />
                </svg>
                <span>Paz 14:32</span>
              </span>
            </div>
            {/* Safari toolbar */}
            <div className={styles.safariBar}>
              <span className={styles.trafficLights}>
                <i />
                <i />
                <i />
              </span>
              <svg className={styles.safariNav} viewBox="0 0 24 24">
                <path d="M14.5 5 8 12l6.5 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <svg className={`${styles.safariNav} ${styles.safariNavDim}`} viewBox="0 0 24 24">
                <path d="M9.5 5 16 12l-6.5 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className={styles.safariUrl}>
                <svg viewBox="0 0 16 16">
                  <rect x="3.4" y="7" width="9.2" height="6.4" rx="1.6" fill="currentColor" />
                  <path d="M5.4 7V5.2a2.6 2.6 0 0 1 5.2 0V7" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                {(() => {
                  const u = FEATURED_PROJECTS[overlayProj]?.liveUrl;
                  try {
                    return u ? new URL(u).hostname.replace(/^www\./, "") : "localhost";
                  } catch {
                    return "localhost";
                  }
                })()}
              </span>
              <svg className={styles.safariNav} viewBox="0 0 24 24">
                <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 12v7h14v-7" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <svg className={styles.safariNav} viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            {/* the site itself */}
            <div className={styles.screenOvViewport}>
              {(() => {
                const m = FEATURED_PROJECTS[overlayProj]?.desktopMedia;
                if (m?.type === "video" && m.src)
                  return (
                    <video
                      ref={screenOvVideoRef}
                      src={m.src}
                      muted
                      loop
                      playsInline
                      preload="auto"
                    />
                  );
                if (m?.type === "image" && m.src)
                  // eslint-disable-next-line @next/next/no-img-element
                  return <img src={m.src} alt="" />;
                return null;
              })()}
            </div>
            <i className={styles.screenOvGlass} />
          </div>
        </div>

        {/* companion iPhone — flat DOM device (iphone.png frame + mobile
            media), positioned by applyVisual on the laptop's lower-right */}
        <div className={styles.devices3d}>
          <div className={styles.devices} data-sw-devices>
            <DevicePair
              project={FEATURED_PROJECTS[aIdx]}
              refs={{ pair: pairARef, phone: phoneARef }}
              hiddenAtRest={false}
              settled={settled === aIdx}
            />
            <DevicePair
              project={FEATURED_PROJECTS[bIdx]}
              refs={{ pair: pairBRef, phone: phoneBRef }}
              hiddenAtRest
              settled={settled === bIdx}
            />
          </div>
        </div>

        {/* ── right content panel ── */}
        <div className={styles.panel} data-sw-panel>
          <div className={styles.counterRow}>
            <span className={styles.counterWin} aria-hidden="true">
              <span className={styles.counterStrip} data-sw-countstrip>
                {FEATURED_PROJECTS.map((_, i) => (
                  <span key={i}>{pad(i)}</span>
                ))}
              </span>
            </span>
            <span className={styles.counterTotal}>/ {pad(N - 1)}</span>
          </div>

          <h3 className={styles.title} data-sw-textbit>
            {p.name}
          </h3>
          <p className={styles.category} data-sw-textbit>
            {p.category} — {p.year}
          </p>
          <p className={styles.desc} data-sw-textbit>
            {p.description}
          </p>

          <ul className={styles.stack} data-sw-textbit>
            {p.stack.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>

          <div className={styles.actions} data-sw-textbit>
            {p.liveUrl ? (
              <a href={p.liveUrl} target="_blank" rel="noreferrer" className={styles.btnLive}>
                View Live
                <svg viewBox="0 0 14 14" aria-hidden="true">
                  <path
                    d="M2 12L12 2M12 2H4.5M12 2v7.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            ) : (
              <span className={`${styles.btnLive} ${styles.btnDisabled}`}>
                Coming Soon
              </span>
            )}
            {liveSrcOf(p) && (
              <button
                ref={liveBtnRef}
                className={styles.btnLive}
                disabled={settled !== textIdx || live !== "off"}
                onClick={() => enterLive(textIdx)}
              >
                Canlı İncele
                <i className={styles.liveDot} aria-hidden="true" />
              </button>
            )}
            {p.caseUrl && (
              <a href={p.caseUrl} className={styles.btnGhost}>
                View Case
              </a>
            )}
          </div>

          <div className={styles.progress} aria-hidden="true">
            <span className={styles.progressFill} data-sw-prog />
          </div>
        </div>
      </div>

      {/* ── CANLI İNCELE overlay: the camera dives into the display in 3D;
          once the screen fills the viewport this fixed layer blends in and
          hands off to a single live iframe.
          PERFORMANCE: the overlay stays PERMANENTLY mounted and the iframe
          pre-loads as soon as its project settles — entering/leaving live
          mode only flips data-state, so no React commit, iframe creation or
          network load can ever hitch a frame of the camera dive. */}
      <div
        className={styles.liveDive}
        data-state={live}
        role="dialog"
        aria-hidden={live === "off"}
        aria-label={`${FEATURED_PROJECTS[overlayIdx]?.name ?? ""} canlı inceleme`}
      >
        <div className={styles.liveVeil} aria-hidden="true" />

        <div className={styles.liveFrame}>
          {frameState === "loading" && (
            <div className={styles.liveLoading}>
              <i />
              <span>Canlı önizleme yükleniyor…</span>
            </div>
          )}
          {frameState === "fail" ? (
            <div className={styles.liveFallback}>
              <p>
                Bu site gömülü önizlemeye izin vermiyor
                <br />
                (X-Frame-Options / CSP).
              </p>
              <a href={overlayHref ?? "#"} target="_blank" rel="noreferrer">
                Yeni Sekmede Aç
                <svg viewBox="0 0 14 14" aria-hidden="true">
                  <path
                    d="M2 12L12 2M12 2H4.5M12 2v7.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            </div>
          ) : overlaySrc && hydrated ? (
            <iframe
              src={overlaySrc}
              title="Canlı önizleme"
              onLoad={() => setFrameState("ok")}
              data-ready={frameState === "ok"}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          ) : null}
        </div>

        <button className={styles.liveExit} onClick={exitLive} tabIndex={live === "off" ? -1 : 0}>
          Canlı İncelemeden Çık ✕
        </button>
      </div>

      {/* dev-only continuity inspector (?swdebug) */}
      {dbg && (
        <div className={styles.debugHud}>
          <span>{BUILD_TAG}</span>
          <span>fps {dbg.fps}</span>
          <span>target {dbg.t.toFixed(4)}</span>
          <span>damped {dbg.d.toFixed(4)}</span>
          <span>
            seg {dbg.k} · lt {dbg.lt.toFixed(3)}
          </span>
          <span>
            live {dbg.live.toFixed(3)} {dbg.fz ? "FROZEN" : ""}
          </span>
          <span>
            A #{pad(aIdx)} — B #{pad(bIdx)}
          </span>
        </div>
      )}
    </section>
  );
}
