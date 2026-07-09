"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ARCHIVE_PROJECTS } from "./projects";
import styles from "./ReferencesArchive.module.css";

gsap.registerPlugin(ScrollTrigger);

/**
 * References Archive — the long tail of shipped work (scales to ~20 entries:
 * just append to ARCHIVE_PROJECTS in projects.ts).
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
            y: 36,
            duration: 0.65,
            delay: (i % 3) * 0.08,
            ease: "power2.out",
            scrollTrigger: {
              trigger: el,
              start: "top bottom-=24",
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
          <em className={styles.count}>{String(ARCHIVE_PROJECTS.length).padStart(2, "0")}</em>
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
          const initials = p.name
            .replace(/[^\p{L}\s]/gu, "")
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((w) => w[0])
            .join("")
            .toUpperCase();
          const inner = (
            <>
              <div className={styles.thumb}>
                {p.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className={styles.thumbImg}
                    src={p.thumb}
                    alt={p.name}
                    loading="lazy"
                  />
                ) : (
                  <span className={styles.thumbMark}>{initials}</span>
                )}
                <i className={styles.thumbScrim} aria-hidden="true" />
                <span className={styles.thumbIndex}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className={styles.thumbCat}>{p.category}</span>
                <i className={styles.thumbSheen} aria-hidden="true" />
              </div>
              <div className={styles.cardBody}>
                <div className={styles.cardTop}>
                  <h3 className={styles.cardName}>{p.name}</h3>
                  <svg className={styles.cardArrow} viewBox="0 0 14 14" aria-hidden="true">
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
                <p className={styles.cardMeta}>
                  <span>{p.year}</span>
                  <i />
                  <span>{p.stack.join(" · ")}</span>
                </p>
              </div>
            </>
          );

          return p.liveUrl ? (
            <a
              key={p.id}
              href={p.liveUrl}
              target="_blank"
              rel="noreferrer"
              className={styles.card}
              data-ra-card=""
              style={{ "--accent": p.accentColor } as React.CSSProperties}
            >
              {inner}
            </a>
          ) : (
            <div
              key={p.id}
              className={styles.card}
              data-ra-card=""
              style={{ "--accent": p.accentColor } as React.CSSProperties}
            >
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}
