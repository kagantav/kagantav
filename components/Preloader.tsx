"use client";

import { useEffect, useState } from "react";
import { useProgress } from "@react-three/drei";
import { scrollBridge } from "./scrollBridge";
import { useLang } from "./i18n";
import styles from "./Preloader.module.css";

/**
 * Holds the curtain until the hero's 3D scene has actually finished loading,
 * so the first thing a visitor sees is the finished composition rather than a
 * half-built one. Driven by drei's real loader progress — not a fixed timer —
 * with a short floor so it never flashes on a fast connection, and a ceiling so
 * a stalled asset can never trap anyone behind it.
 */
const MIN_MS = 900;
const MAX_MS = 10000;

export default function Preloader() {
  const { active, progress } = useProgress();
  const { lang } = useLang();
  const [done, setDone] = useState(false);
  const [shown, setShown] = useState(false);

  /* floor + ceiling */
  useEffect(() => {
    const floor = window.setTimeout(() => setShown(true), MIN_MS);
    const ceiling = window.setTimeout(() => setDone(true), MAX_MS);
    return () => {
      window.clearTimeout(floor);
      window.clearTimeout(ceiling);
    };
  }, []);

  useEffect(() => {
    if (shown && !active && progress >= 100) setDone(true);
  }, [shown, active, progress]);

  /* nothing may scroll underneath the curtain */
  useEffect(() => {
    if (done) {
      scrollBridge.lenis?.start();
      return;
    }
    scrollBridge.lenis?.stop();
    window.scrollTo(0, 0);
  }, [done]);

  const pct = Math.min(100, Math.round(progress));

  return (
    <div className={`${styles.wrap} ${done ? styles.gone : ""}`} aria-hidden={done}>
      <div className={styles.inner}>
        <p className={styles.name}>KAĞAN TAV</p>
        <div className={styles.track}>
          <span className={styles.fill} style={{ transform: `scaleX(${pct / 100})` }} />
        </div>
        <p className={styles.pct}>
          {lang === "tr" ? "Yükleniyor" : "Loading"} · {pct}%
        </p>
      </div>
    </div>
  );
}
