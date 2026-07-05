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
import MacBook3D from "./MacBook3D";
import { swScroll } from "./swScrollBus";
import { scrollBridge } from "./scrollBridge";

import iphoneFrame from "@/public/assets/iphone.png";

gsap.registerPlugin(ScrollTrigger);

const N = FEATURED_PROJECTS.length;
const TRANSITIONS = N - 1;
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
      {/* iPhone — companion device; the MacBook is the 3D model behind */}
      <div ref={refs.phone} className={styles.phoneWrap} data-sw-phone="">
        <div className={styles.phoneFloat} data-sw-float="phone">
          <div className={styles.phoneScreen}>
            <ScreenMedia
              media={project.mobileMedia}
              project={project}
              variant="mobile"
              settled={settled}
              interactive={false}
            />
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
    setFrameState("loading");
    setLive("enter");
  };

  const exitLive = () => {
    if (live !== "on" && live !== "enter") return;
    setLive("exit");
    // let the iframe fade first, then pull the camera back out
    window.setTimeout(() => {
      swScroll.liveTarget = 0;
    }, 240);
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

  /* dev-only continuity inspector — visit with ?swdebug to enable */
  const [dbg, setDbg] = useState<{
    t: number;
    d: number;
    k: number;
    lt: number;
  } | null>(null);
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "development" ||
      !window.location.search.includes("swdebug")
    )
      return;
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
      });
    }, 120);
    return () => window.clearInterval(id);
  }, []);

  /* pair A carries even projects, pair B odd — recycled alternately */
  const aIdx = Math.min(k % 2 === 0 ? k : k + 1, N - 1);
  const bIdx = Math.min(k % 2 === 0 ? k + 1 : k, N - 1);

  /* videos play only on the settled pair */
  useEffect(() => {
    const root = sectionRef.current;
    if (!root) return;
    [
      { el: pairARef.current, idx: aIdx },
      { el: pairBRef.current, idx: bIdx },
    ].forEach(({ el, idx }) => {
      el?.querySelectorAll("video").forEach((v) =>
        idx === settled ? v.play().catch(() => {}) : v.pause()
      );
    });
  }, [settled, aIdx, bIdx]);

  useLayoutEffect(() => {
    const root = sectionRef.current;
    if (!root) return;

    const ctx = gsap.context(() => {
      const glow = root.querySelector<HTMLElement>("[data-sw-glow]");
      const panel = root.querySelector<HTMLElement>("[data-sw-panel]");
      const strip = root.querySelector<HTMLElement>("[data-sw-countstrip]");
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
      const applyVisual = (p: number) => {
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
        const tr = clamp01((lt - 0.15) / 0.8); // physical travel 15%→95%
        /* live dive: panel, companion phone + glow recede during the
           first 20% of the clocked live progress (and return during the
           final 20% of the exit) — applyVisual is their ONLY alpha
           writer, so every value is a pure function of swScroll.live and
           the exit is the mathematical reverse of the entrance */
        const liveDim = 1 - easeIO(clamp01(swScroll.live / 0.22));
        if (panel) gsap.set(panel, { autoAlpha: liveDim });

        /* ── outgoing pair: long continuous fade (45%→98% of the exit) ── */
        const to = easeIO(tr);
        const outFade = 1 - smoother(clamp01((lt - 0.5) / 0.46));
        const outBlur = lt > 0.88 ? clamp01((lt - 0.88) / 0.1) * 2.2 : 0;
        gsap.set(outPair, {
          x: 42 * vw * to,
          z: -150 * to,
          rotationY: 10 * to,
          rotationX: 2 * to,
          scale: 1 - 0.18 * to,
          autoAlpha: outFade,
          filter: outBlur > 0.05 ? `blur(${outBlur.toFixed(2)}px)` : "none",
        });
        /* outgoing iPhone: swells toward the camera, arcs right, tilts
           away and fades slightly BEFORE its MacBook */
        gsap.set(outPhone, {
          x: 9 * vw * to,
          y: -38 * bump(to),
          rotationY: 9 * to,
          rotationZ: 3.5 * to,
          scale: 1 + 0.09 * bump(to),
          autoAlpha: (1 - smoother(clamp01((lt - 0.46) / 0.42))) * liveDim,
        });

        /* ── incoming: sweeps in from stage-left, straightens, settles ── */
        const ti2 = easeOut(tr);
        const inFade = clamp01(tr / 0.32);
        gsap.set(inPair, {
          x: -44 * vw * (1 - ti2),
          y: 20 * (1 - ti2),
          z: -60 * (1 - ti2), // starts slightly back, lands at stage depth
          rotationY: -12 * (1 - ti2),
          rotationX: 1.5 * (1 - ti2),
          scale: 0.82 + 0.18 * ti2,
          autoAlpha: inFade,
          filter: "none",
        });
        /* incoming iPhone: farther left, stronger tilt, shallow arc around
           the MacBook's front edge, arrives after the MacBook */
        const ph = clamp01((tr - 0.16) / 0.84);
        const phE = easeOut(ph);
        gsap.set(inPhone, {
          x: -12 * vw * (1 - phE),
          y: 30 * (1 - phE) - 22 * bump(phE),
          rotationY: -10 * (1 - phE),
          rotationZ: -3 * (1 - phE),
          scale: 1 + 0.05 * (1 - phE),
          autoAlpha: clamp01(ph / 0.3) * liveDim,
        });

        /* ── glow hands off from the outgoing pair to the incoming ── */
        if (glow) {
          const mixT = clamp01((lt - 0.3) / 0.4);
          glow.style.setProperty(
            "--accent",
            gsap.utils.interpolate(
              FEATURED_PROJECTS[kk].accentColor,
              FEATURED_PROJECTS[Math.min(kk + 1, N - 1)].accentColor
            )(mixT)
          );
          gsap.set(glow, {
            x: -12 * vw * bump(to),
            opacity: (1 - 0.25 * bump(to)) * liveDim,
          });
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

        /* ── whole stage drifts imperceptibly across the journey ── */
        if (devices)
          gsap.set(devices, {
            rotationY: -5 + p * 4,
            rotationX: 1.6 - p * 1.2,
          });
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
        const tick = (_t: number, deltaMS: number) => {
          const dt = Math.min(deltaMS / 1000, 0.05);
          /* while live mode owns the scene the damped progress is frozen
             solid — ScrollTrigger may write `progress` all it wants, the
             base scene never sees it. applyVisual still runs so the
             live-derived fades keep updating. */
          if (!swScroll.frozen) {
            swScroll.smooth = gsap.utils.interpolate(
              swScroll.smooth,
              swScroll.progress,
              1 - Math.exp(-8 * dt)
            );
          }
          applyVisual(swScroll.smooth);
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

        return () => gsap.ticker.remove(tick);
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
      <div className={styles.stage} data-sw-stage>
        <div
          className={styles.glow}
          data-sw-glow
          style={{ "--accent": FEATURED_PROJECTS[0].accentColor } as React.CSSProperties}
          aria-hidden="true"
        />

        {/* real 3D MacBooks — full-stage canvas so they can enter/exit */}
        <MacBook3D aIdx={aIdx} bIdx={bIdx} settledIdx={settled} />

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
          hands off to a single live iframe ── */}
      {live !== "off" && (
        <div
          className={styles.liveDive}
          data-state={live}
          role="dialog"
          aria-label={`${FEATURED_PROJECTS[swScroll.liveIdx]?.name ?? ""} canlı inceleme`}
        >
          <div className={styles.liveVeil} aria-hidden="true" />

          {(live === "on" || live === "exit") && (
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
                  <a
                    href={liveSrcOf(FEATURED_PROJECTS[swScroll.liveIdx]) ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                  >
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
              ) : (
                <iframe
                  src={liveSrcOf(FEATURED_PROJECTS[swScroll.liveIdx]) ?? undefined}
                  title="Canlı önizleme"
                  onLoad={() => setFrameState("ok")}
                  data-ready={frameState === "ok"}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                />
              )}
            </div>
          )}

          <button className={styles.liveExit} onClick={exitLive}>
            Canlı İncelemeden Çık ✕
          </button>
        </div>
      )}

      {/* dev-only continuity inspector (?swdebug) */}
      {dbg && (
        <div className={styles.debugHud}>
          <span>target {dbg.t.toFixed(4)}</span>
          <span>damped {dbg.d.toFixed(4)}</span>
          <span>
            seg {dbg.k} · lt {dbg.lt.toFixed(3)}
          </span>
          <span>
            A[{dbg.k % 2 === 0 ? "OUT" : "IN"}] #{pad(aIdx)} — B[
            {dbg.k % 2 === 0 ? "IN" : "OUT"}] #{pad(bIdx)}
          </span>
        </div>
      )}
    </section>
  );
}
