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
  interactive,
}: {
  project: FeaturedProject;
  refs: PairRefs;
  hiddenAtRest: boolean;
  settled: boolean;
  interactive: boolean;
}) {
  return (
    <div
      ref={refs.pair}
      className={`${styles.pair} ${hiddenAtRest ? styles.pairResting : ""}`}
    >
      {/* iPhone — companion device; the MacBook is the 3D model behind */}
      <div ref={refs.phone} className={styles.phoneWrap}>
        <div className={styles.phoneFloat} data-sw-float="phone">
          <div className={styles.phoneScreen}>
            <ScreenMedia
              media={project.mobileMedia}
              project={project}
              variant="mobile"
              settled={settled}
              interactive={interactive}
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
  /* which project (if any) is settled — gates iframe mounting */
  const [settled, setSettled] = useState<number>(0);
  /* explicit user opt-in for live iframe interaction */
  const [interactIdx, setInteractIdx] = useState<number | null>(null);

  const kRef = useRef(0);
  const textIdxRef = useRef(0);
  const settledRef = useRef(0);

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
      const strip = root.querySelector<HTMLElement>("[data-sw-countstrip]");
      const progFill = root.querySelector<HTMLElement>("[data-sw-prog]");
      const devices = root.querySelector<HTMLElement>("[data-sw-devices]");
      const textBits = Array.from(
        root.querySelectorAll<HTMLElement>("[data-sw-textbit]")
      );

      const easeIO = gsap.parseEase("power2.inOut");
      const easeOut = gsap.parseEase("power3.out");
      const bump = (t: number) => Math.sin(Math.PI * t);

      const apply = (self: ScrollTrigger) => {
        const p = self.progress;
        swScroll.progress = p; // the 3D MacBooks read this every frame
        if (progFill) gsap.set(progFill, { scaleX: p });

        const f = Math.min(p * TRANSITIONS, TRANSITIONS - 1e-5);
        const kk = Math.max(0, Math.floor(f));
        const lt = f - kk;

        if (kk !== kRef.current) {
          kRef.current = kk;
          setK(kk);
          setInteractIdx(null);
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
        const tr = clamp01((lt - 0.15) / 0.7); // 15%–85% transition window

        /* ── outgoing: drifts right, tilts away, recedes, fades late ── */
        const to = easeIO(tr);
        const outFade = tr < 0.72 ? 1 : 1 - (tr - 0.72) / 0.28;
        const outBlur = tr > 0.82 ? ((tr - 0.82) / 0.18) * 3 : 0;
        gsap.set(outPair, {
          x: 42 * vw * to,
          z: -150 * to, // recedes backward — real 3D depth sorts the pairs
          rotationY: 10 * to,
          rotationX: 2 * to,
          scale: 1 - 0.18 * to,
          autoAlpha: outFade,
          filter: outBlur > 0.05 ? `blur(${outBlur.toFixed(2)}px)` : "none",
        });
        gsap.set(outPhone, {
          x: 7 * vw * to,
          y: -22 * bump(to),
          rotationY: 4 * to,
          rotationZ: 2 * to,
          scale: 1 + 0.06 * bump(to),
        });

        /* ── incoming: sweeps in from stage-left, straightens, settles ── */
        const ti2 = easeOut(tr);
        const inFade = clamp01(tr / 0.3);
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
        const phT = easeOut(clamp01((tr - 0.1) / 0.9)); // phone arrives late
        gsap.set(inPhone, {
          x: -9 * vw * (1 - phT),
          y: 0,
          rotationY: -4 * (1 - phT),
          rotationZ: -2 * (1 - phT),
          scale: 1 + 0.04 * (1 - phT),
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
          gsap.set(glow, { x: -12 * vw * bump(to), opacity: 1 - 0.25 * bump(to) });
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
          onUpdate: apply,
          onRefresh: apply,
        });

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
              interactive={interactIdx === aIdx}
            />
            <DevicePair
              project={FEATURED_PROJECTS[bIdx]}
              refs={{ pair: pairBRef, phone: phoneBRef }}
              hiddenAtRest
              settled={settled === bIdx}
              interactive={interactIdx === bIdx}
            />
          </div>
        </div>

        {/* ── right content panel ── */}
        <div className={styles.panel}>
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
            {p.desktopMedia.type === "iframe" && p.desktopMedia.src && (
              <button
                className={styles.btnGhost}
                onClick={() => setInteractIdx(textIdx)}
              >
                Live Preview
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

      {/* live iframe preview — mounts ONLY while open, one at a time */}
      {interactIdx !== null &&
        FEATURED_PROJECTS[interactIdx]?.desktopMedia.type === "iframe" &&
        FEATURED_PROJECTS[interactIdx].desktopMedia.src && (
          <div
            className={styles.liveModal}
            role="dialog"
            aria-label={`${FEATURED_PROJECTS[interactIdx].name} live preview`}
          >
            <button
              className={styles.liveModalBackdrop}
              aria-label="Close preview"
              onClick={() => setInteractIdx(null)}
            />
            <div className={styles.liveModalFrame}>
              <header>
                <span>{FEATURED_PROJECTS[interactIdx].name}</span>
                <button onClick={() => setInteractIdx(null)}>Close ✕</button>
              </header>
              <iframe
                src={FEATURED_PROJECTS[interactIdx].desktopMedia.src!}
                title={`${FEATURED_PROJECTS[interactIdx].name} live preview`}
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
            </div>
          </div>
        )}
    </section>
  );
}
