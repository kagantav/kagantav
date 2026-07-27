"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Lang = "tr" | "en";

export const LANGS: Lang[] = ["tr", "en"];
const STORAGE_KEY = "kt-lang";
const DEFAULT_LANG: Lang = "tr";

/* ────────────────────────────────────────────────
   Every string the site renders lives here, so adding or editing copy in
   either language is a single-file change. `Copy` forces both languages to
   stay in sync — a missing key is a type error, not a silent fallback.
   ──────────────────────────────────────────────── */

export interface MetaRow {
  label: string;
  value: string;
  gold?: boolean;
}

export interface Copy {
  hero: {
    badge: string;
    role: string;
    meta: string[];
    lede: string;
    ctaWork: string;
    ctaCv: string;
    /** language-matched CV file under /public */
    cvHref: string;
  };
  about: {
    eyebrow: string;
    title: string;
    lede: string;
    meta: MetaRow[];
  };
  work: {
    eyebrow: string;
    title: string;
    visit: string;
    soon: string;
    details: string;
    livePreview: string;
    /** decorative macOS menu bar on the 3D laptop's screen */
    menu: string[];
  };
  archive: {
    eyebrow: string;
    title: string;
    live: string;
    visit: string;
    close: string;
  };
  contact: {
    thanks: string;
    headline: string;
    lede: string;
    primary: string;
    status: string;
    role: string;
    top: string;
  };
  langLabel: string;
}

export const COPY: Record<Lang, Copy> = {
  tr: {
    hero: {
      badge: "Yeni fırsatlara açığım",
      role: "Full Stack Web & Mobil Developer",
      meta: ["Web", "Mobil", "Dijital Ürünler"],
      lede: "Modern web teknolojileriyle kurumsal siteler, yönetim panelleri ve iş uygulamaları geliştiriyorum. Temiz kod, akıcı arayüzler ve uçtan uca teslim önceliğim.",
      ctaWork: "Projelerimi Gör",
      ctaCv: "CV Görüntüle",
      cvHref: "/KAGANTAV-CV.pdf",
    },
    about: {
      eyebrow: "Hakkımda",
      title: "Kurumsal web çözümlerini uçtan uca geliştiriyorum.",
      lede: "Ben Kağan. Web tarafında React, Next.js, PHP ve C#/.NET, mobil tarafta React Native ile çalışan bir Full Stack Web & Mobil Developer’ım. Kurumsal web siteleri, yönetim panelleri ve mobil uygulamalar geliştiriyorum; analizden veritabanı kurgusuna, yayına almadan bakıma kadar süreci uçtan uca yürütürüm. Yapay zeka araçlarını geliştirme akışıma etkin biçimde entegre ederek daha hızlı ve daha sağlam iş çıkarıyorum. Teslim odaklı, problem çözmeyi seven ve yeni teknolojilere hızla adapte olan bir yazılım geliştiricisiyim.",
      meta: [
        { label: "Konum", value: "Ankara, Türkiye" },
        { label: "Deneyim", value: "2+ yıl · 50+ teslim edilmiş proje" },
        {
          label: "Ana stack",
          value:
            "HTML · CSS · React · Next.js · PHP · C#/.NET · SQL · Supabase · React Native",
        },
        { label: "Yaklaşım", value: "AI destekli geliştirme · uçtan uca teslim" },
        { label: "Durum", value: "Yeni fırsatlara açık", gold: true },
      ],
    },
    work: {
      eyebrow: "Seçili Projeler",
      title: "Yayına giren, ölçeklenen ve iş getiren projeler.",
      visit: "Siteyi İncele",
      soon: "Çok Yakında",
      details: "Detaylar",
      livePreview: "canlı önizleme",
      menu: [
        "Dosya",
        "Düzen",
        "Görünüm",
        "Geçmiş",
        "Yer İmleri",
        "Pencere",
        "Yardım",
      ],
    },
    archive: {
      eyebrow: "Tüm Arşiv",
      title: "Teslim ettiğim tüm siteler.",
      live: "canlı site",
      visit: "Websiteyi İncele",
      close: "Kapat",
    },
    contact: {
      thanks: "İzlediğin için teşekkürler",
      headline: "Birlikte çalışalım.",
      lede: "Açık bir pozisyon, yeni bir ekip ya da sadece bir merhaba. Her türlü ulaş, en kısa sürede dönerim.",
      primary: "E-posta Gönder",
      status: "Yeni fırsatlara açık · Ankara, Türkiye",
      role: "Full Stack Web & Mobil Developer",
      top: "Başa dön",
    },
    langLabel: "Dil",
  },

  en: {
    hero: {
      badge: "Open to new opportunities",
      role: "Full Stack Web & Mobile Developer",
      meta: ["Web", "Mobile", "Digital Products"],
      lede: "I build corporate websites, admin panels and business applications with modern web technologies. Clean code, fluid interfaces and end-to-end delivery come first.",
      ctaWork: "View My Work",
      ctaCv: "View CV",
      cvHref: "/KAGANTAV-CV-EN.pdf",
    },
    about: {
      eyebrow: "About Me",
      title: "I build corporate web solutions end to end.",
      lede: "I’m Kağan, a Full Stack Web & Mobile Developer working with React, Next.js, PHP and C#/.NET on the web side and React Native on mobile. I build corporate websites, admin panels and mobile apps, and I run the whole process end to end: analysis, database design, development, deployment and maintenance. I integrate AI tools deeply into my workflow to ship faster without giving up quality. Delivery-focused, I enjoy solving problems and adapt quickly to new technologies.",
      meta: [
        { label: "Location", value: "Ankara, Türkiye" },
        { label: "Experience", value: "2+ years · 50+ projects delivered" },
        {
          label: "Core stack",
          value:
            "HTML · CSS · React · Next.js · PHP · C#/.NET · SQL · Supabase · React Native",
        },
        {
          label: "Approach",
          value: "AI-assisted development · end-to-end delivery",
        },
        { label: "Status", value: "Open to new opportunities", gold: true },
      ],
    },
    work: {
      eyebrow: "Selected Work",
      title: "Projects that ship, scale and deliver.",
      visit: "Visit Site",
      soon: "Coming Soon",
      details: "Details",
      livePreview: "live preview",
      menu: [
        "File",
        "Edit",
        "View",
        "History",
        "Bookmarks",
        "Window",
        "Help",
      ],
    },
    archive: {
      eyebrow: "Full Archive",
      title: "Every site I’ve shipped.",
      live: "live site",
      visit: "Visit Website",
      close: "Close",
    },
    contact: {
      thanks: "Thanks for watching",
      headline: "Let’s work together.",
      lede: "An open position, a new team, or just a hello. Reach out any time and I’ll get back to you shortly.",
      primary: "Send Email",
      status: "Open to new opportunities · Ankara, Türkiye",
      role: "Full Stack Web & Mobile Developer",
      top: "Back to top",
    },
    langLabel: "Language",
  },
};

/* ── context ── */

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Copy;
}

const Ctx = createContext<LangCtx>({
  lang: DEFAULT_LANG,
  setLang: () => {},
  t: COPY[DEFAULT_LANG],
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  /* restore the saved choice after hydration (the server always renders the
     default language, so reading storage during render would mismatch) */
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "tr" || saved === "en") setLangState(saved);
  }, []);

  /* keep <html lang> honest for screen readers and translation tools */
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {}
  }, []);

  return (
    <Ctx.Provider value={{ lang, setLang, t: COPY[lang] }}>
      {children}
    </Ctx.Provider>
  );
}

export const useLang = () => useContext(Ctx);
