import styles from "./Header.module.css";

const NAV = [
  { label: "Home", href: "#home", active: true },
  { label: "About", href: "#about" },
  { label: "Work", href: "#work" },
  { label: "Skills", href: "#skills" },
  { label: "Contact", href: "#contact" },
];

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        {/* stylized KT mark — bare strokes, no box */}
        <a href="#home" className={styles.brand} aria-label="Kağan Tav — home">
          <svg viewBox="0 0 72 44" aria-hidden="true">
            <defs>
              <linearGradient id="kt-mark" x1="0" y1="0" x2="72" y2="44">
                <stop offset="0" stopColor="#f7e3ae" />
                <stop offset="0.45" stopColor="#d8a94f" />
                <stop offset="0.8" stopColor="#8a6427" />
                <stop offset="1" stopColor="#c99b45" />
              </linearGradient>
            </defs>
            <g
              fill="none"
              stroke="url(#kt-mark)"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* K */}
              <path d="M14 7v30" strokeWidth="3.2" />
              <path d="M14 23.5C20 21 25.5 15 28.5 7.5" strokeWidth="2.7" />
              <path d="M15 23.5c6.5 2.6 11.5 7.4 14.5 13.5" strokeWidth="2.7" />
              {/* T with swash bar */}
              <path d="M31 9.5C39 5 52 4.4 60 7.6" strokeWidth="2.6" />
              <path d="M46.5 7.2 44 37" strokeWidth="3" />
              {/* underline swash */}
              <path
                d="M12 41c16 2.6 34 2.4 48-1.4"
                strokeWidth="1.1"
                opacity="0.55"
              />
            </g>
          </svg>
        </a>

        <nav className={styles.nav} aria-label="Primary">
          {NAV.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className={item.active ? styles.linkActive : styles.link}
            >
              {item.label}
            </a>
          ))}
          <span className={styles.navHairline} aria-hidden="true" />
        </nav>

        <a href="#contact" className={styles.cta}>
          <span>Let’s Connect</span>
          <i className={styles.ctaDot} aria-hidden="true" />
        </a>
      </div>
    </header>
  );
}
