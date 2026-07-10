"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ARCHIVE_PROJECTS, type ArchiveProject } from "./projects";
import styles from "./ReferencesArchive.module.css";

gsap.registerPlugin(ScrollTrigger);

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

const COLS = 3;
function toCols(list: ArchiveProject[]) {
  const cols: { p: ArchiveProject; i: number }[][] = Array.from(
    { length: COLS },
    () => []
  );
  list.forEach((p, i) => cols[i % COLS].push({ p, i }));
  return cols;
}

function Card({ p, i }: { p: ArchiveProject; i: number }) {
  const tiltRef = useRef<HTMLDivElement>(null);

  const onMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const el = tiltRef.current;
    if (!el) return;
    const r = e.currentTarget.getBoundingClientRect();
    const mx = (e.clientX - r.left) / r.width - 0.5;
    const my = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `rotateY(${mx * 11}deg) rotateX(${-my * 11}deg) translateZ(30px)`;
  }, []);
  const onLeave = useCallback(() => {
    const el = tiltRef.current;
    if (el) el.style.transform = "";
  }, []);

  const inner = (
    <div ref={tiltRef} className={styles.tilt} data-tilt="">
      {p.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={styles.shotImg}
          src={p.thumb}
          alt={p.name}
          loading="lazy"
        />
      ) : (
        <span className={styles.shotMark}>{initialsOf(p.name)}</span>
      )}
      <i className={styles.scrim} aria-hidden="true" />
      <i className={styles.sheen} aria-hidden="true" />
      <span className={styles.index}>{pad(i + 1)}</span>
      <div className={styles.info}>
        <span className={styles.cat}>{p.category}</span>
        <div className={styles.infoBottom}>
          <h3 className={styles.name}>{p.name}</h3>
          <svg className={styles.arrow} viewBox="0 0 14 14" aria-hidden="true">
            <path
              d="M2 12L12 2M12 2H4.5M12 2v7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );

  const style = { "--accent": p.accentColor } as React.CSSProperties;
  return p.liveUrl ? (
    <a
      href={p.liveUrl}
      target="_blank"
      rel="noreferrer"
      className={styles.card}
      data-ra-card=""
      style={style}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {inner}
    </a>
  ) : (
    <div
      className={styles.card}
      data-ra-card=""
      style={style}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {inner}
    </div>
  );
}

/**
 * References Archive — a depth gallery. Cards rise out of Z-space and stand
 * upright as you scroll to them, and tilt in 3D toward the cursor on hover —
 * echoing the hero's 3D rig. Scales to ~20 entries: append to ARCHIVE_PROJECTS.
 */
export default function ReferencesArchive() {
  const ref = useRef<HTMLElement>(null);
  const cols = toCols(ARCHIVE_PROJECTS);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.utils.toArray<HTMLElement>("[data-ra-card]").forEach((el) => {
          gsap.fromTo(
            el,
            { opacity: 0, rotationX: 32, y: 80, z: -230, transformOrigin: "center 85%" },
            {
              opacity: 1,
              rotationX: 0,
              y: 0,
              z: 0,
              ease: "none",
              scrollTrigger: {
                trigger: el,
                start: "top bottom-=30",
                end: "top center+=140",
                scrub: 0.7,
              },
            }
          );
        });
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section id="references" ref={ref} className={styles.section}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>
          <span />
          Full Archive
          <em className={styles.count}>{pad(ARCHIVE_PROJECTS.length)}</em>
        </p>
        <h2 className={styles.title}>Every site I&apos;ve shipped.</h2>
        <p className={styles.sub}>
          Öne çıkan birkaç işi yukarıda vitrine aldık — bu da geri kalanı:
          markalar, klinikler, stüdyolar ve mağazalar için baştan sona
          tasarlayıp ürettiğim canlı sitelerin arşivi.
        </p>
      </header>

      <div className={styles.grid3d}>
        {cols.map((col, ci) => (
          <div key={ci} className={styles.col} data-col={ci}>
            {col.map(({ p, i }) => (
              <Card key={p.id} p={p} i={i} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
