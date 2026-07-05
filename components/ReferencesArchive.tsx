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
          References Archive
        </p>
        <h2 className={styles.title}>More builds & collaborations.</h2>
        <p className={styles.sub}>
          A growing archive of production work — sites, platforms and products
          shipped for clients across industries.
        </p>
      </header>

      <div className={styles.grid}>
        {ARCHIVE_PROJECTS.map((p, i) => {
          const inner = (
            <>
              <div
                className={styles.thumb}
                style={{ "--accent": p.accentColor } as React.CSSProperties}
              >
                <span className={styles.thumbIndex}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className={styles.thumbMark}>
                  {p.name
                    .split(" ")
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join("")}
                </span>
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
                  <span>{p.category}</span>
                  <i />
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
            >
              {inner}
            </a>
          ) : (
            <div key={p.id} className={styles.card} data-ra-card="">
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}
