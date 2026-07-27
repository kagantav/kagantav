"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ARCHIVE_PROJECTS, pick, pickList, type ArchiveProject } from "./projects";
import { useLang } from "./i18n";
import { scrollBridge } from "./scrollBridge";
import styles from "./MobileArchive.module.css";

import macFrame from "@/public/assets/macbook.png";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The phone build of the Full Archive: a clean gallery over the same 17
 * entries, no WebGL. Every card paints its thumbnail IMMEDIATELY (it is the
 * card's background, not a video poster), and the preview video only fades in
 * over it once it can actually play — so "the videos sometimes never show up"
 * cannot happen here: worst case the card simply stays a sharp screenshot.
 * Desktop keeps the 3D fly-through.
 */

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

function Card({
  p,
  index,
  onOpen,
}: {
  p: ArchiveProject;
  index: number;
  onOpen: (p: ArchiveProject) => void;
}) {
  const { lang } = useLang();
  const vidRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  /* fetch + play the loop only while the card is on screen */
  useEffect(() => {
    const v = vidRef.current;
    if (!v) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          if (v.readyState === 0) v.load();
          v.play().catch(() => {});
        } else {
          v.pause();
        }
      },
      { rootMargin: "25% 0px", threshold: 0.1 }
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  return (
    <button className={styles.card} onClick={() => onOpen(p)} data-reveal>
      <span className={styles.media} style={{ "--accent": p.accentColor } as React.CSSProperties}>
        {p.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.thumb} alt="" loading="lazy" />
        ) : (
          <span className={styles.fallback}>{initials(p.name)}</span>
        )}
        {p.video && (
          <video
            ref={vidRef}
            src={p.video}
            muted
            loop
            playsInline
            preload="none"
            className={playing ? styles.vidOn : ""}
            onPlaying={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        )}
        <span className={styles.num}>{pad(index + 1)}</span>
      </span>
      <span className={styles.meta}>
        <span className={styles.cardName}>{p.name}</span>
        <span className={styles.cardCat}>
          {pick(p.category, lang)} · {p.year}
        </span>
      </span>
    </button>
  );
}

export default function MobileArchive() {
  const { lang, t } = useLang();
  const rootRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState<ArchiveProject | null>(null);

  /* card reveal on scroll */
  useEffect(() => {
    const el = rootRef.current;
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
      { rootMargin: "0px 0px -6% 0px", threshold: 0.1 }
    );
    el.querySelectorAll("[data-reveal]").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  /* focus view owns the screen: hide the lang toggle (same convention as the
     desktop inspect view) and stop the smooth scroller underneath */
  useEffect(() => {
    if (!active) return;
    document.body.classList.add("inspecting");
    scrollBridge.lenis?.stop();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("inspecting");
      scrollBridge.lenis?.start();
      window.removeEventListener("keydown", onKey);
    };
  }, [active]);

  return (
    <section id="references" ref={rootRef} className={styles.section}>
      <header className={styles.head} data-reveal>
        <p className={styles.eyebrow}>
          <span />
          {t.archive.eyebrow}
          <em className={styles.count}>{pad(ARCHIVE_PROJECTS.length)}</em>
        </p>
        <h2 className={styles.title}>{t.archive.title}</h2>
      </header>

      <div className={styles.grid}>
        {ARCHIVE_PROJECTS.map((p, i) => (
          <Card key={p.id} p={p} index={i} onOpen={setActive} />
        ))}
      </div>

      {/* ── focus view: the tapped site presented on the gold MacBook, the
          same staging as the showcase, over an accent-tinted spotlight ── */}
      {active && (
        <div
          className={styles.focus}
          role="dialog"
          aria-label={active.name}
          style={{ "--accent": active.accentColor } as React.CSSProperties}
          onClick={(e) => {
            /* tapping the dark stage (not the content) closes */
            if (e.target === e.currentTarget) setActive(null);
          }}
        >
          <div className={styles.focusGlow} aria-hidden="true" />
          <button
            className={styles.focusClose}
            onClick={() => setActive(null)}
            aria-label={t.archive.close}
          >
            ✕
          </button>

          <div className={styles.focusInner}>
            <div className={styles.focusMac}>
              <div className={styles.focusMacScreen}>
                {active.video ? (
                  <video src={active.video} muted loop playsInline autoPlay poster={active.thumb ?? undefined} />
                ) : active.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={active.thumb} alt="" />
                ) : (
                  <span className={styles.fallback}>{initials(active.name)}</span>
                )}
              </div>
              <Image src={macFrame} alt="" className={styles.focusMacFrame} sizes="94vw" />
            </div>

            <div className={styles.focusBody}>
              <p className={styles.focusNum}>
                <em>{pad(ARCHIVE_PROJECTS.indexOf(active) + 1)}</em> / {pad(ARCHIVE_PROJECTS.length)}
              </p>
              <h3 className={styles.focusName}>{active.name}</h3>
              <p className={styles.focusCat}>
                {pick(active.category, lang).toUpperCase()} · {active.year}
              </p>
              <ul className={styles.chips}>
                {pickList(active.stack, lang).map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              {active.liveUrl && (
                <a href={active.liveUrl} target="_blank" rel="noreferrer" className={styles.focusVisit}>
                  {t.archive.visit}
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
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
