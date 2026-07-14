"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./ContactSection.module.css";

gsap.registerPlugin(ScrollTrigger);

const EMAIL = "kagantav1@gmail.com";
/* profil URL'i Türkçe "ğ" içeriyor → yüzde-kodlu hâli her tarayıcı/mailde
   sorunsuz açılır. Paylaşım linkindeki utm_* takip parametreleri atıldı. */
const LINKEDIN_URL = "https://www.linkedin.com/in/ka%C4%9Fan-tav-52b072221";

export default function ContactSection() {
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      /* The closer is a FIXED stage — it never slides in from below. It sits
         (invisible) over the archive's dark tail and is only revealed while
         this section overlaps the viewport; then the copy DIVES in in place,
         zooming down from oversized+blurred to settled. Because the archive
         already faded the screen to this exact colour, the handoff is
         imperceptible — the screen "turns to the colour" then the text arrives. */
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.set(stageRef.current, { autoAlpha: 0 });
        gsap.set(contentRef.current, { transformOrigin: "50% 42%" });

        ScrollTrigger.create({
          trigger: el,
          start: "top bottom",
          end: "bottom top",
          onToggle: (self) =>
            gsap.to(stageRef.current, {
              autoAlpha: self.isActive ? 1 : 0,
              duration: 0.25,
              overwrite: true,
            }),
        });

        gsap.fromTo(
          glowRef.current,
          { opacity: 0, scale: 1.3 },
          {
            opacity: 1,
            scale: 1,
            ease: "none",
            scrollTrigger: { trigger: el, start: "top bottom", end: "top 42%", scrub: 0.7 },
          }
        );
        gsap.fromTo(
          contentRef.current,
          { scale: 1.6, opacity: 0, filter: "blur(9px)" },
          {
            scale: 1,
            opacity: 1,
            filter: "blur(0px)",
            ease: "power2.out",
            scrollTrigger: { trigger: el, start: "top bottom", end: "top 20%", scrub: 0.7 },
          }
        );
      });

      /* reduced motion: no dive, just show it */
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set([stageRef.current, glowRef.current, contentRef.current], {
          autoAlpha: 1,
          opacity: 1,
          scale: 1,
          filter: "none",
        });
      });
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section id="contact" ref={rootRef} className={styles.contact}>
      <div ref={stageRef} className={styles.stage}>
        <div ref={glowRef} className={styles.glow} aria-hidden="true" />
        <div className={styles.grain} aria-hidden="true" />

        <div ref={contentRef} className={styles.inner}>
          <p className={styles.thanks}>İzlediğin için teşekkürler</p>

          <h2 className={styles.headline}>Birlikte çalışalım.</h2>

          <p className={styles.lede}>
            Açık bir pozisyon, yeni bir ekip ya da sadece bir merhaba. Her türlü
            ulaş, en kısa sürede dönerim.
          </p>

          <div className={styles.actions}>
            <a href={`mailto:${EMAIL}`} className={styles.primary}>
              E-posta Gönder
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
            Yeni fırsatlara açık · Ankara, Türkiye
          </p>
        </div>

        <footer className={styles.foot}>
          <span>© 2026 Kağan Tav</span>
          <span className={styles.footRole}>Full Stack Web &amp; Mobil Developer</span>
          <a href="#home" className={styles.top}>
            Başa dön
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
