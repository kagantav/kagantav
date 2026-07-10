"use client";

import { useLayoutEffect, useRef } from "react";
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

/* three marquee lanes; each auto-scrolls, alternating direction */
const LANES = 3;
function toLanes(list: ArchiveProject[]): ArchiveProject[][] {
  const lanes: ArchiveProject[][] = Array.from({ length: LANES }, () => []);
  list.forEach((p, i) => lanes[i % LANES].push(p)); // interleave for variety
  return lanes;
}

function Card({
  p,
  n,
  dup,
}: {
  p: ArchiveProject;
  n: number;
  dup: boolean;
}) {
  const inner = (
    <>
      {p.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.shotImg} src={p.thumb} alt={p.name} loading="lazy" />
      ) : (
        <span className={styles.shotMark}>{initialsOf(p.name)}</span>
      )}
      <i className={styles.scrim} aria-hidden="true" />
      <i className={styles.sheen} aria-hidden="true" />
      <span className={styles.index}>{pad(n)}</span>
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
    </>
  );
  const style = { "--accent": p.accentColor } as React.CSSProperties;
  return p.liveUrl ? (
    <a
      href={p.liveUrl}
      target="_blank"
      rel="noreferrer"
      className={styles.card}
      style={style}
      aria-hidden={dup || undefined}
      tabIndex={dup ? -1 : undefined}
    >
      {inner}
    </a>
  ) : (
    <div
      className={styles.card}
      style={style}
      aria-hidden={dup || undefined}
    >
      {inner}
    </div>
  );
}

/**
 * References Archive — a living "wall of work": three marquee lanes of site
 * screenshots that drift horizontally (alternating directions) and pause on
 * hover. Scales to ~20 entries: just append to ARCHIVE_PROJECTS.
 */
export default function ReferencesArchive() {
  const ref = useRef<HTMLElement>(null);
  const lanes = toLanes(ARCHIVE_PROJECTS);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from("[data-ra-lane]", {
          autoAlpha: 0,
          y: 30,
          duration: 0.7,
          stagger: 0.12,
          ease: "power2.out",
          scrollTrigger: {
            trigger: root,
            start: "top bottom-=60",
            toggleActions: "play none none reverse",
          },
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

      <div className={styles.wall}>
        {lanes.map((lane, li) => (
          <div
            key={li}
            className={styles.lane}
            data-ra-lane=""
            data-dir={li % 2 === 0 ? "l" : "r"}
            style={{ "--dur": `${52 + li * 12}s` } as React.CSSProperties}
          >
            <div className={styles.track}>
              {[...lane, ...lane].map((p, k) => (
                <Card
                  key={k}
                  p={p}
                  n={ARCHIVE_PROJECTS.indexOf(p) + 1}
                  dup={k >= lane.length}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
