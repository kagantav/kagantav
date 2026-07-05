"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { FEATURED_PROJECTS, type FeaturedProject, type ProjectMedia } from "./projects";
import styles from "./SelectedWork.module.css";

import macbookFrame from "@/public/assets/macbook.png";
import iphoneFrame from "@/public/assets/iphone.png";

gsap.registerPlugin(ScrollTrigger);

const N = FEATURED_PROJECTS.length;
const pad = (n: number) => String(n + 1).padStart(2, "0");

/* ════════════════════════════════════════════════
   Screen media — image / video / iframe (active-only) / placeholder
   ════════════════════════════════════════════════ */

function ScreenMedia({
  media,
  project,
  variant,
  isActive,
}: {
  media: ProjectMedia;
  project: FeaturedProject;
  variant: "desktop" | "mobile";
  isActive: boolean;
}) {
  // live embeds mount ONLY while their project is active
  if (media.type === "iframe" && media.src) {
    return isActive ? (
      <iframe
        src={media.src}
        title={`${project.name} live preview`}
        className={styles.mediaFill}
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

  /* styled placeholder until real previews are wired in */
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
   Selected Work — pinned cinematic showcase
   ════════════════════════════════════════════════ */

export default function SelectedWork() {
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const transRef = useRef<gsap.core.Timeline | null>(null);

  /* pause videos on inactive screens, play the active ones */
  useEffect(() => {
    const root = sectionRef.current;
    if (!root) return;
    root
      .querySelectorAll<HTMLVideoElement>("[data-sw-shot] video")
      .forEach((v) => {
        const layer = v.closest<HTMLElement>("[data-sw-shot]");
        if (!layer) return;
        if (Number(layer.dataset.idx) === active) {
          v.play().catch(() => {});
        } else {
          v.pause();
        }
      });
  }, [active]);

  useLayoutEffect(() => {
    const root = sectionRef.current;
    if (!root) return;

    const ctx = gsap.context(() => {
      const shots = (idx: number) =>
        root.querySelectorAll(`[data-sw-shot][data-idx="${idx}"]`);
      const textBits = root.querySelectorAll("[data-sw-textbit]");
      const glow = root.querySelector("[data-sw-glow]");
      const counter = root.querySelector("[data-sw-count]");
      const progBar = root.querySelector("[data-sw-prog]");

      // resting state: only project 0 visible
      for (let i = 1; i < N; i++) gsap.set(shots(i), { autoAlpha: 0 });

      const switchTo = (idx: number, dir: 1 | -1) => {
        const prev = activeRef.current;
        if (idx === prev) return;
        activeRef.current = idx;
        setActive(idx);

        transRef.current?.kill();
        const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
        transRef.current = tl;

        tl.to(
          shots(prev),
          { autoAlpha: 0, y: -16 * dir, scale: 0.985, duration: 0.35, ease: "power1.in" },
          0
        );
        tl.fromTo(
          shots(idx),
          { autoAlpha: 0, y: 26 * dir, scale: 1.015 },
          { autoAlpha: 1, y: 0, scale: 1, duration: 0.5 },
          0.16
        );
        tl.fromTo(
          textBits,
          { autoAlpha: 0, y: 16 * dir },
          { autoAlpha: 1, y: 0, stagger: 0.05, duration: 0.4 },
          0.2
        );
        if (counter) {
          tl.fromTo(
            counter,
            { yPercent: 40 * dir, autoAlpha: 0 },
            { yPercent: 0, autoAlpha: 1, duration: 0.35 },
            0.16
          );
        }
        if (glow) {
          tl.to(
            glow,
            { "--accent": FEATURED_PROJECTS[idx].accentColor, duration: 0.6, ease: "sine.inOut" },
            0
          );
        }
      };

      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const setProg = progBar
          ? gsap.quickSetter(progBar, "scaleX")
          : null;
        const stage = root.querySelector("[data-sw-stage]");
        const devices = root.querySelector("[data-sw-devices]");

        ScrollTrigger.create({
          trigger: stage,
          start: "top top",
          end: "+=520%",
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate(self) {
            if (setProg) setProg(self.progress);
            // one scroll segment per project
            const idx = Math.min(N - 1, Math.floor(self.progress * N));
            if (idx !== activeRef.current)
              switchTo(idx, self.direction >= 0 ? 1 : -1);
            // devices drift gently across the whole journey
            if (devices)
              gsap.set(devices, {
                rotationY: -5 + self.progress * 4,
                rotationX: 1.6 - self.progress * 1.2,
              });
          },
        });

        // idle float — devices breathe on separate clocks
        gsap.to("[data-sw-mac]", {
          y: -7,
          duration: 3.8,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        });
        gsap.to("[data-sw-phone]", {
          y: -11,
          duration: 3.0,
          delay: 0.6,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        });

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

      // pointer parallax — desktop with a cursor
      mm.add(
        "(min-width: 1024px) and (hover: hover) and (prefers-reduced-motion: no-preference)",
        () => {
          const devices = root.querySelector<HTMLElement>("[data-sw-devices]");
          const phone = root.querySelector<HTMLElement>("[data-sw-phone]");
          if (!devices || !phone) return;
          // scroll owns the device rotations — the pointer only nudges
          // translation, so the two systems never fight over a property
          const dy = gsap.quickTo(devices, "y", { duration: 1, ease: "power3.out" });
          const px = gsap.quickTo(phone, "x", { duration: 1.1, ease: "power3.out" });
          const onMove = (e: PointerEvent) => {
            const ny = e.clientY / window.innerHeight - 0.5;
            const nx = e.clientX / window.innerWidth - 0.5;
            dy(ny * -10);
            px(nx * 14);
          };
          window.addEventListener("pointermove", onMove, { passive: true });
          return () => window.removeEventListener("pointermove", onMove);
        }
      );
    }, root);

    return () => ctx.revert();
  }, []);

  const p = FEATURED_PROJECTS[active];

  return (
    <section id="work" ref={sectionRef} className={styles.section}>
      {/* ── bridge from About: a gold thread pulls the eye down ── */}
      <div className={styles.bridge} data-sw-bridge>
        <span className={styles.bridgeLine} data-sw-bridgeline />
        <p className={styles.bridgeEyebrow}>
          <span />
          Selected Work
          <span />
        </p>
        <h2 className={styles.bridgeTitle}>Projects that ship, scale and sell.</h2>
      </div>

      {/* ── pinned showcase stage ── */}
      <div className={styles.stage} data-sw-stage>
        <div
          className={styles.glow}
          data-sw-glow
          style={{ "--accent": FEATURED_PROJECTS[0].accentColor } as React.CSSProperties}
          aria-hidden="true"
        />

        <div className={styles.devices3d}>
          <div className={styles.devices} data-sw-devices>
            {/* MacBook — screen content under the transparent frame PNG */}
            <div className={styles.macWrap} data-sw-mac>
              <div className={styles.macScreen}>
                {FEATURED_PROJECTS.map((proj, i) => (
                  <div
                    key={proj.id}
                    className={styles.shot}
                    data-sw-shot=""
                    data-idx={i}
                  >
                    <ScreenMedia
                      media={proj.desktopMedia}
                      project={proj}
                      variant="desktop"
                      isActive={i === active}
                    />
                  </div>
                ))}
              </div>
              <Image
                src={macbookFrame}
                alt=""
                fill
                sizes="(max-width: 1023px) 92vw, 56vw"
                className={styles.frameImg}
                priority={false}
              />
            </div>

            {/* iPhone — companion mobile preview, closer to the viewer */}
            <div className={styles.phoneWrap} data-sw-phone>
              <div className={styles.phoneScreen}>
                {FEATURED_PROJECTS.map((proj, i) => (
                  <div
                    key={proj.id}
                    className={styles.shot}
                    data-sw-shot=""
                    data-idx={i}
                  >
                    <ScreenMedia
                      media={proj.mobileMedia}
                      project={proj}
                      variant="mobile"
                      isActive={i === active}
                    />
                  </div>
                ))}
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

        {/* ── right content panel ── */}
        <div className={styles.panel}>
          <div className={styles.counterRow}>
            <span className={styles.counterActive} data-sw-count>
              {pad(active)}
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
    </section>
  );
}
