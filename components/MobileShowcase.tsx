"use client";

import { useEffect, useRef, type RefObject } from "react";
import Image from "next/image";
import { FEATURED_PROJECTS, pick, pickList } from "./projects";
import { useLang } from "./i18n";
import styles from "./MobileShowcase.module.css";

import macFrame from "@/public/assets/macbook.png";
import iphoneFrame from "@/public/assets/iphone.png";

const pad = (n: number) => String(n + 1).padStart(2, "0");

/**
 * The phone build of the Selected Work showcase: the same premium device
 * mockups (macbook.png + iphone.png) and the same project media, composed in
 * plain DOM/CSS — no WebGL. Three simultaneous GL scenes made the section
 * unusable on phones; this version has nothing to compile and nothing to
 * rasterise beyond the videos themselves. Desktop keeps the full 3D stage.
 */

/** play a card's videos only while it is on screen; pause the rest */
function useAutoplay(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const v = e.target as HTMLVideoElement;
          if (e.isIntersecting) {
            /* a detached/never-fetched source reports readyState 0 — nudge
               the fetch before play so the first play() cannot no-op */
            if (v.readyState === 0) v.load();
            v.play().catch(() => {});
          } else {
            v.pause();
          }
        });
      },
      { rootMargin: "20% 0px", threshold: 0.15 }
    );
    el.querySelectorAll("video").forEach((v) => io.observe(v));
    return () => io.disconnect();
  }, [root]);
}

/** reveal cards as they enter the viewport (CSS-only motion) */
function useReveal(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add(styles.in);
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );
    el.querySelectorAll("[data-reveal]").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [root]);
}

export default function MobileShowcase() {
  const { lang, t } = useLang();
  const rootRef = useRef<HTMLElement>(null);
  useAutoplay(rootRef);
  useReveal(rootRef);

  return (
    <section id="work" ref={rootRef} className={styles.section}>
      <header className={styles.head} data-reveal>
        <p className={styles.eyebrow}>
          <span />
          {t.work.eyebrow}
        </p>
        <h2 className={styles.title}>{t.work.title}</h2>
      </header>

      {FEATURED_PROJECTS.map((p, i) => (
        <article key={p.id} className={styles.card} data-reveal>
          {/* ── device composition: MacBook + companion iPhone ── */}
          <div className={styles.deviceStage}>
            <div className={styles.glow} style={{ "--accent": p.accentColor } as React.CSSProperties} />
            <div className={styles.mac}>
              {/* screen opening measured from macbook.png alpha */}
              <div className={styles.macScreen}>
                {p.desktopMedia.type === "video" && p.desktopMedia.src ? (
                  <video
                    src={p.desktopMedia.src}
                    poster={p.desktopMedia.poster}
                    muted
                    loop
                    playsInline
                    preload="metadata"
                  />
                ) : p.desktopMedia.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.desktopMedia.src} alt="" loading="lazy" />
                ) : (
                  <div className={styles.screenFallback}>
                    <span>{pad(i)}</span>
                    {p.name}
                  </div>
                )}
              </div>
              <Image src={macFrame} alt="" className={styles.macFrame} sizes="92vw" priority={i === 0} />
            </div>

            {!p.noMobile && (
              <div className={styles.phone}>
                <div className={styles.phoneScreen}>
                  {p.mobileMedia.type === "video" && p.mobileMedia.src ? (
                    <video
                      src={p.mobileMedia.src}
                      muted
                      loop
                      playsInline
                      preload="metadata"
                    />
                  ) : p.mobileMedia.src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.mobileMedia.src} alt="" loading="lazy" />
                  ) : null}
                </div>
                <Image src={iphoneFrame} alt="" className={styles.phoneFrame} sizes="30vw" />
              </div>
            )}
          </div>

          {/* ── info panel ── */}
          <div className={styles.panel}>
            <p className={styles.counter}>
              <em>{pad(i)}</em> / {pad(FEATURED_PROJECTS.length - 1)}
            </p>
            <h3 className={styles.name}>{p.name}</h3>
            <p className={styles.cat}>
              {pick(p.category, lang).toUpperCase()} · {p.year}
            </p>
            <p className={styles.desc}>{pick(p.description, lang)}</p>
            <ul className={styles.chips}>
              {pickList(p.stack, lang).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            {p.liveUrl ? (
              <a className={styles.visit} href={p.liveUrl} target="_blank" rel="noreferrer">
                {t.work.visit}
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
              <span className={styles.soon}>{t.work.soon}</span>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}
