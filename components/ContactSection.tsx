"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { useLang } from "./i18n";
import styles from "./ContactSection.module.css";

const EMAIL = "kagantav1@gmail.com";
/* profil URL'i Türkçe "ğ" içeriyor → yüzde-kodlu hâli her tarayıcı/mailde
   sorunsuz açılır. Paylaşım linkindeki utm_* takip parametreleri atıldı. */
const LINKEDIN_URL = "https://www.linkedin.com/in/ka%C4%9Fan-tav-52b072221";

export default function ContactSection() {
  const { t } = useLang();
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = rootRef.current;
    const stage = stageRef.current;
    const glow = glowRef.current;
    const content = contentRef.current;
    if (!el || !stage || !glow || !content) return;

    /* The closer is a FIXED stage — it never slides in from below. It sits
       (invisible) over the archive's dark tail and is only revealed while
       this section overlaps the viewport; then the copy DIVES in in place,
       zooming down from oversized+blurred to settled. Because the archive
       already faded the screen to this exact colour, the handoff is
       imperceptible — the screen "turns to the colour" then the text arrives.

       Deliberately NOT ScrollTrigger-driven. This section sits below two
       pinned sections that mount a beat after hydration, and ScrollTrigger's
       refresh measures it with pins reverted — its tentative start then falls
       INSIDE the showcase pin's scroll span, so that pin's ~4700px distance
       is never added and no amount of refreshing fixes it (verified live:
       start stuck at the un-offset value). The closer then faded in over the
       laptops and stayed dark at the real end of the page. A live
       getBoundingClientRect during scroll always reflects the true, pinned
       layout, so driving the dive directly from it is immune to when the
       sections above mount, grow or pin. */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set([stage, glow, content], {
        autoAlpha: 1,
        opacity: 1,
        scale: 1,
        filter: "none",
      });
      return;
    }

    gsap.set(stage, { autoAlpha: 0 });
    gsap.set(content, { transformOrigin: "50% 42%" });

    const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
    const easeOut = gsap.parseEase("power2.out");
    let shown = false;
    let raf = 0;

    const tick = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;

      /* reveal only while the section overlaps the viewport. The 4px inset
         matters: at first paint the document is still short (the heavy
         sections mount a beat later) and this section sits EXACTLY at the
         fold — a fractional-pixel rounding below vh must not flash the
         fixed stage over the whole site. */
      const overlaps = r.top < vh - 4 && r.bottom > 4;
      if (overlaps !== shown) {
        shown = overlaps;
        gsap.to(stage, { autoAlpha: overlaps ? 1 : 0, duration: 0.25, overwrite: true });
      }
      if (!overlaps) return;

      /* the dive: same curves as the old scrubbed tweens
         (top bottom → top 42% for the glow, top bottom → top 20% for the
         copy; Lenis already smooths the scroll, so no extra lag needed) */
      const pGlow = clamp01((vh - r.top) / (vh - 0.42 * vh));
      const pCopy = easeOut(clamp01((vh - r.top) / (vh - 0.2 * vh)));
      gsap.set(glow, { opacity: pGlow, scale: 1.3 - 0.3 * pGlow });
      gsap.set(content, {
        scale: 1.6 - 0.6 * pCopy,
        opacity: pCopy,
        filter: `blur(${(9 * (1 - pCopy)).toFixed(2)}px)`,
      });
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    /* the sections above mount and pin AFTER this effect, each time moving
       this section thousands of pixels down. No scroll event fires for
       that — so a stale verdict from the short document would stick until
       the user scrolls. Re-evaluate whenever the layout itself changes. */
    const ro = new ResizeObserver(onScroll);
    ro.observe(document.body);
    tick();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section id="contact" ref={rootRef} className={styles.contact}>
      <div ref={stageRef} className={styles.stage}>
        <div ref={glowRef} className={styles.glow} aria-hidden="true" />
        <div className={styles.grain} aria-hidden="true" />

        <div ref={contentRef} className={styles.inner}>
          <p className={styles.thanks}>{t.contact.thanks}</p>

          <h2 className={styles.headline}>{t.contact.headline}</h2>

          <p className={styles.lede}>{t.contact.lede}</p>

          <div className={styles.actions}>
            <a href={`mailto:${EMAIL}`} className={styles.primary}>
              {t.contact.primary}
              <svg viewBox="0 0 14 14" aria-hidden="true">
                <path
                  d="M2 12L12 2M12 2H4.5M12 2v7.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>

            <a
              href={LINKEDIN_URL}
              target="_blank"
              rel="noreferrer"
              className={styles.secondary}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
              </svg>
              LinkedIn
            </a>
          </div>

          <a href={`mailto:${EMAIL}`} className={styles.email}>
            {EMAIL}
          </a>

          <p className={styles.status}>
            <i className={styles.dot} aria-hidden="true" />
            {t.contact.status}
          </p>
        </div>

        <footer className={styles.foot}>
          <span>© 2026 Kağan Tav</span>
          <span className={styles.footRole}>{t.contact.role}</span>
          <a href="#home" className={styles.top}>
            {t.contact.top}
            <svg viewBox="0 0 14 14" aria-hidden="true">
              <path
                d="M7 12V2M7 2L2.5 6.5M7 2l4.5 4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </footer>
      </div>
    </section>
  );
}
