"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ARCHIVE_PROJECTS } from "./projects";
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

/**
 * References Archive — an image-forward gallery of shipped work. Each card is
 * the site screenshot itself; project info sits on a scrim over it and lifts
 * on hover. Scales to ~20 entries: just append to ARCHIVE_PROJECTS.
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
            y: 40,
            duration: 0.7,
            delay: (i % 3) * 0.09,
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

      <div className={styles.grid}>
        {ARCHIVE_PROJECTS.map((p, i) => {
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
                  <span className={styles.shotMark}>{initialsOf(p.name)}</span>
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
                <p className={styles.stack}>{p.stack.join(" · ")}</p>
              </div>
            </>
          );

          const cls = styles.card;
          const style = { "--accent": p.accentColor } as React.CSSProperties;

          return p.liveUrl ? (
            <a
              key={p.id}
              href={p.liveUrl}
              target="_blank"
              rel="noreferrer"
              className={cls}
              data-ra-card=""
              style={style}
            >
              {inner}
            </a>
          ) : (
            <div key={p.id} className={cls} data-ra-card="" style={style}>
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}
