"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
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
 * References Archive — an editorial index of shipped work. Each project is a
 * typographic row; hovering one floats its screenshot next to the cursor.
 * Scales to ~20 entries: just append to ARCHIVE_PROJECTS in projects.ts.
 */
export default function ReferencesArchive() {
  const ref = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(-1);

  /* cursor-follow preview: a single transform-only element, eased in a rAF
     loop (never written per-mousemove) so it glides smoothly */
  const target = useRef({ x: 0, y: 0 });
  const pos = useRef({ x: 0, y: 0, seeded: false });
  const onMove = useCallback((e: React.MouseEvent) => {
    target.current.x = e.clientX;
    target.current.y = e.clientY;
    if (!pos.current.seeded) {
      pos.current.x = e.clientX;
      pos.current.y = e.clientY;
      pos.current.seeded = true;
    }
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const t = target.current;
      const p = pos.current;
      p.x += (t.x - p.x) * 0.16;
      p.y += (t.y - p.y) * 0.16;
      const el = previewRef.current;
      if (el) {
        const tilt = Math.max(-7, Math.min(7, (t.x - p.x) * 0.25));
        el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) translate(-50%, -50%) rotate(${tilt}deg)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* rows stagger in on scroll */
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.utils.toArray<HTMLElement>("[data-ra-row]").forEach((el, i) => {
          gsap.from(el, {
            autoAlpha: 0,
            y: 26,
            duration: 0.6,
            delay: (i % 6) * 0.05,
            ease: "power2.out",
            scrollTrigger: {
              trigger: el,
              start: "top bottom-=10",
              toggleActions: "play none none reverse",
            },
          });
        });
      });
    }, root);
    return () => ctx.revert();
  }, []);

  const activeAccent =
    active >= 0 ? ARCHIVE_PROJECTS[active].accentColor : "#d8a94f";

  return (
    <section
      id="references"
      ref={ref}
      className={styles.section}
      onMouseMove={onMove}
    >
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

      <ul
        className={styles.index}
        data-active={active >= 0 ? "" : undefined}
        onMouseLeave={() => setActive(-1)}
      >
        {ARCHIVE_PROJECTS.map((p, i) => {
          const inner = (
            <>
              <span className={styles.num}>{pad(i + 1)}</span>
              <span className={styles.main}>
                <span className={styles.name}>{p.name}</span>
                <span className={styles.meta}>
                  {p.category} · {p.year}
                </span>
              </span>
              <span className={styles.stack}>{p.stack.join(" · ")}</span>
              <span className={styles.thumbMini} aria-hidden="true">
                {p.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumb} alt="" loading="lazy" />
                ) : (
                  <span>{initialsOf(p.name)}</span>
                )}
              </span>
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
            </>
          );
          const common = {
            className: styles.row,
            onMouseEnter: () => setActive(i),
          };
          return (
            <li
              key={p.id}
              data-ra-row=""
              style={{ "--accent": p.accentColor } as React.CSSProperties}
            >
              {p.liveUrl ? (
                <a href={p.liveUrl} target="_blank" rel="noreferrer" {...common}>
                  {inner}
                </a>
              ) : (
                <div {...common}>{inner}</div>
              )}
            </li>
          );
        })}
      </ul>

      {/* floating cursor preview (desktop hover only) */}
      <div
        ref={previewRef}
        className={styles.preview}
        data-show={active >= 0 ? "" : undefined}
        style={{ "--accent": activeAccent } as React.CSSProperties}
        aria-hidden="true"
      >
        {ARCHIVE_PROJECTS.map((p, i) =>
          p.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p.id}
              src={p.thumb}
              alt=""
              className={styles.previewImg}
              data-on={active === i ? "" : undefined}
              loading="lazy"
            />
          ) : (
            <span
              key={p.id}
              className={styles.previewMark}
              data-on={active === i ? "" : undefined}
            >
              {initialsOf(p.name)}
            </span>
          )
        )}
      </div>
    </section>
  );
}
