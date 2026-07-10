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

/* editorial rhythm: how many cards per row + which split template, cycled.
   A = big+small, B = triple, C = small+big, D = equal pair. */
const ROW_PATTERN = [2, 3, 2, 2] as const;
const ROW_CLASS = ["rowA", "rowB", "rowC", "rowD"] as const;

type Row = { items: ArchiveProject[]; cls: string; start: number };
function buildRows(list: ArchiveProject[]): Row[] {
  const rows: Row[] = [];
  let i = 0;
  let c = 0;
  while (i < list.length) {
    const count = Math.min(
      ROW_PATTERN[c % ROW_PATTERN.length],
      list.length - i
    ); // clamp last row
    rows.push({
      items: list.slice(i, i + count),
      cls: styles[ROW_CLASS[c % ROW_CLASS.length]],
      start: i,
    });
    i += count;
    c++;
  }
  return rows;
}

/**
 * References Archive — an editorial, asymmetric gallery of shipped work. The
 * screenshot is the card; rows alternate splits/heights for rhythm.
 * Scales to ~20 entries: just append to ARCHIVE_PROJECTS.
 */
export default function ReferencesArchive() {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.utils.toArray<HTMLElement>("[data-ra-card]").forEach((el, i) => {
          gsap.from(el, {
            autoAlpha: 0,
            y: 42,
            duration: 0.7,
            delay: (i % 3) * 0.08,
            ease: "power2.out",
            scrollTrigger: {
              trigger: el,
              start: "top bottom-=40",
              toggleActions: "play none none reverse",
            },
          });
        });
      });
    }, root);
    return () => ctx.revert();
  }, []);

  const rows = buildRows(ARCHIVE_PROJECTS);

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

      <div className={styles.rows}>
        {rows.map((row, ri) => (
          <div key={ri} className={`${styles.row} ${row.cls}`}>
            {row.items.map((p, j) => {
              const i = row.start + j;
              const inner = (
                <>
                  <div className={styles.shot}>
                    {p.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className={styles.shotImg}
                        src={p.thumb}
                        alt={p.name}
                        loading="lazy"
                      />
                    ) : (
                      <span className={styles.shotMark}>
                        {initialsOf(p.name)}
                      </span>
                    )}
                    <i className={styles.scrim} aria-hidden="true" />
                    <i className={styles.sheen} aria-hidden="true" />
                    <span className={styles.index}>{pad(i + 1)}</span>
                  </div>

                  <div className={styles.info}>
                    <div className={styles.infoTop}>
                      <span className={styles.cat}>{p.category}</span>
                      <span className={styles.year}>{p.year}</span>
                    </div>
                    <div className={styles.infoBottom}>
                      <h3 className={styles.name}>{p.name}</h3>
                      <svg
                        className={styles.arrow}
                        viewBox="0 0 14 14"
                        aria-hidden="true"
                      >
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
                    <p className={styles.stack}>{p.stack.join(" · ")}</p>
                  </div>
                </>
              );
              const style = { "--accent": p.accentColor } as React.CSSProperties;
              return p.liveUrl ? (
                <a
                  key={p.id}
                  href={p.liveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.card}
                  data-ra-card=""
                  style={style}
                >
                  {inner}
                </a>
              ) : (
                <div
                  key={p.id}
                  className={styles.card}
                  data-ra-card=""
                  style={style}
                >
                  {inner}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
