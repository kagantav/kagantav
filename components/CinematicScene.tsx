"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import HeroRig3D from "./HeroRig3D";
import { rigScroll } from "./rigScrollBus";
import styles from "./CinematicScene.module.css";

gsap.registerPlugin(ScrollTrigger);

const ABOUT_META = [
  { label: "Location", value: "İstanbul, Türkiye" },
  { label: "Experience", value: "5+ years shipping web & mobile" },
  { label: "Core stack", value: "React · Next.js · Node · PostgreSQL" },
  { label: "Status", value: "Open to select projects", gold: true },
];

/**
 * One pinned, scrubbed scene: Hero ⟶ About.
 *
 * The rig itself is a real-time three.js scene (HeroRig3D) on a transparent
 * canvas between the background video and the DOM copy. This component owns
 * the pin, feeds scroll progress to the 3D world via rigScrollBus, and
 * choreographs the DOM copy + overlay layers with a scrubbed GSAP timeline.
 */
export default function CinematicScene() {
  const sceneRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      /* ── Desktop: pinned stage, camera-driven 3D travel ── */
      mm.add(
        "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
        () => {
          const vw = (n: number) => () => (window.innerWidth * n) / 100;

          gsap.set("[data-about-item]", { autoAlpha: 0, x: 76 });
          gsap.set("[data-veil-right]", { opacity: 0 });

          const tl = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              trigger: scene,
              start: "top top",
              end: "+=240%",
              scrub: 1.2,
              pin: "[data-stage]",
              anticipatePin: 1,
              invalidateOnRefresh: true,
              onUpdate(self) {
                rigScroll.progress = self.progress;
              },
            },
          });

          // hero copy retires to the LEFT in a staggered sequence
          tl.to("[data-cue]", { autoAlpha: 0, duration: 0.04 }, 0);
          tl.to(
            "[data-hero-item]",
            {
              x: -70,
              autoAlpha: 0,
              stagger: 0.032,
              duration: 0.2,
              ease: "power1.in",
            },
            0.02
          );

          // atmosphere deepens; amber glow follows the rig across the stage
          tl.to(
            "[data-video]",
            { filter: "brightness(0.62) saturate(0.9)", duration: 0.55 },
            0.08
          );
          tl.to("[data-veil-right]", { opacity: 1, duration: 0.28 }, 0.5);
          tl.to(
            "[data-amber]",
            { x: vw(-11), duration: 0.34, ease: "power1.inOut" },
            0.1
          );
          tl.to(
            "[data-amber]",
            { x: vw(-44), opacity: 0.5, duration: 0.36, ease: "power2.out" },
            0.44
          );

          // About copy arrives once the rig is already heading left
          tl.to(
            "[data-about-item]",
            {
              autoAlpha: 1,
              x: 0,
              stagger: 0.05,
              duration: 0.26,
              ease: "power2.out",
            },
            0.66
          );

          // settle beat before unpinning
          tl.to({}, { duration: 0.08 });

          return () => {
            rigScroll.progress = 0;
          };
        }
      );

      /* ── Compact: no pin, graceful reveals ── */
      mm.add(
        "(max-width: 1023px) and (prefers-reduced-motion: no-preference)",
        () => {
          gsap.from("[data-rig]", {
            autoAlpha: 0,
            y: 46,
            duration: 1,
            ease: "power2.out",
            scrollTrigger: {
              trigger: "[data-rig]",
              start: "top 82%",
              toggleActions: "play none none reverse",
            },
          });

          gsap.from("[data-about-item]", {
            autoAlpha: 0,
            y: 34,
            stagger: 0.09,
            duration: 0.7,
            ease: "power2.out",
            scrollTrigger: {
              trigger: "[data-about]",
              start: "top 78%",
              toggleActions: "play none none reverse",
            },
          });
        }
      );
    }, scene);

    return () => ctx.revert();
  }, []);

  return (
    <section id="home" ref={sceneRef} className={styles.scene}>
      <div className={styles.stage} data-stage>
        {/* ── Backdrop: ambient video + layered premium overlays ── */}
        <div className={styles.backdrop} aria-hidden="true">
          <video
            className={styles.video}
            data-video
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster="/assets/background-photo.png"
          >
            <source src="/assets/background-video2.mp4" type="video/mp4" />
          </video>

          {/* L1 — subtle overall dim */}
          <div className={styles.dim} />
          {/* L2 — left gradient behind hero copy */}
          <div className={styles.veilLeft} />
          {/* L3 — calms bright verticals near the upper center */}
          <div className={styles.topGlare} />
          {/* L4 — warm amber pool that travels with the rig */}
          <div className={styles.amberFollow} data-amber />
          {/* about-side readability, arrives with the About chapter */}
          <div className={styles.veilRight} data-veil-right />
          {/* L5 — edge vignette + grain */}
          <div className={styles.vignette} />
          <div className={styles.grain} />
        </div>

        {/* ── The 3D rig — transparent canvas above video, below copy ── */}
        <div className={styles.canvasWrap} data-rig>
          <HeroRig3D />
        </div>

        {/* ── Hero copy ── */}
        <div className={styles.heroContent} data-hero-copy>
          <p className={styles.badge} data-hero-item>
            <span className={styles.badgeDot} />
            Available for new projects
          </p>

          <h1 className={styles.name} data-hero-item>
            Kağan Tav
          </h1>

          <p className={styles.role} data-hero-item>
            Full-Stack Developer
          </p>

          <p className={styles.meta} data-hero-item>
            Web <i>•</i> Mobile <i>•</i> Digital Products
          </p>

          <p className={styles.lede} data-hero-item>
            I design and build scalable digital experiences with clean code,
            intuitive interfaces and modern technologies.
          </p>

          <div className={styles.ctaRow} data-hero-item>
            <a href="#work" className={styles.ctaPrimary}>
              View Work
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
            <a href="#" className={styles.ctaGhost}>
              Download CV
              <svg viewBox="0 0 14 14" aria-hidden="true">
                <path
                  d="M7 1.5v8m0 0L3.8 6.3M7 9.5l3.2-3.2M2 12.5h10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </div>
        </div>

        {/* ── About ── */}
        <div id="about" className={styles.aboutContent} data-about>
          <p className={styles.eyebrow} data-about-item>
            <span />
            About Me
          </p>

          <h2 className={styles.aboutTitle} data-about-item>
            Building premium digital products, end to end.
          </h2>

          <p className={styles.aboutLede} data-about-item>
            I’m Kağan — a full-stack developer focused on refined,
            high-performance software. From system architecture to the final
            pixel, I obsess over the details that make a product feel
            effortless, fast and quietly expensive.
          </p>

          <ul className={styles.aboutMeta}>
            {ABOUT_META.map((row) => (
              <li key={row.label} data-about-item>
                <span className={styles.metaLabel}>{row.label}</span>
                <span
                  className={row.gold ? styles.metaValueGold : styles.metaValue}
                >
                  {row.gold && <i className={styles.metaDot} />}
                  {row.value}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Scroll cue ── */}
        <div className={styles.cue} data-cue aria-hidden="true">
          <span className={styles.cueLabel}>Scroll</span>
          <span className={styles.cueTrack}>
            <span className={styles.cueThumb} />
          </span>
        </div>
      </div>
    </section>
  );
}
