"use client";

import { LANGS, useLang } from "./i18n";
import styles from "./LangToggle.module.css";

export default function LangToggle() {
  const { lang, setLang, t } = useLang();

  return (
    <div
      className={styles.wrap}
      role="group"
      aria-label={t.langLabel}
      data-lang-toggle
    >
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          className={l === lang ? styles.active : styles.btn}
          aria-pressed={l === lang}
          onClick={() => setLang(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
      {/* sliding gold pill behind the active label */}
      <span
        className={styles.pill}
        style={{ transform: `translateX(${LANGS.indexOf(lang) * 100}%)` }}
        aria-hidden="true"
      />
    </div>
  );
}
