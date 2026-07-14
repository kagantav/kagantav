/**
 * Project content for the Selected Work showcase and the References Archive.
 *
 * Screen media per project:
 *   image  → screenshot under public/assets
 *   video  → short muted loop
 *   iframe → live site URL (only the active project ever mounts one)
 * A null `src` falls back to the styled placeholder screen.
 *
 * Copy that differs per language is stored as { tr, en } and resolved at
 * render time with the `pick` / `pickList` helpers.
 */

import type { Lang } from "./i18n";

export type Localized = { tr: string; en: string };
export type LocalizedList = { tr: string[]; en: string[] };

export const pick = (v: Localized, lang: Lang) => v[lang];
export const pickList = (v: LocalizedList, lang: Lang) => v[lang];

export type PreviewType = "image" | "video" | "iframe";

export interface ProjectMedia {
  type: PreviewType;
  src: string | null;
  /** optional poster for video previews */
  poster?: string;
}

export interface FeaturedProject {
  id: string;
  name: string;
  category: Localized;
  description: Localized;
  stack: LocalizedList;
  desktopMedia: ProjectMedia;
  mobileMedia: ProjectMedia;
  liveUrl: string | null;
  /**
   * false → the site sends X-Frame-Options/CSP that blocks embedding, so the
   * live-preview path must fall back to opening in a new tab instead of
   * mounting an iframe (Chrome renders an error page otherwise).
   */
  liveEmbed?: boolean;
  caseUrl?: string | null;
  /** gold-family accent used for the scene glow + placeholder lighting */
  accentColor: string;
  year: string;
  /** true → hide the companion iPhone for this project (desktop-only vitrine) */
  noMobile?: boolean;
}

export const FEATURED_PROJECTS: FeaturedProject[] = [
  {
    id: "miyavhav",
    name: "MiyavHav",
    category: { tr: "E-Ticaret — Pet Shop", en: "E-Commerce — Pet Shop" },
    description: {
      tr: "Kedi ve köpek sahipleri için premium pet ürünleri mağazası. Sezonluk koleksiyonlar, avantajlı paketler ve animasyonlu, akıcı bir alışveriş deneyimi sunuyor.",
      en: "A premium pet products store for cat and dog owners. Seasonal collections, bundle deals and a smooth, animated shopping experience.",
    },
    stack: {
      tr: ["Shopify", "E-Ticaret", "UI/UX", "SEO"],
      en: ["Shopify", "E-Commerce", "UI/UX", "SEO"],
    },
    desktopMedia: { type: "video", src: "/assets/projects/miyavhav/desktop.mp4" },
    // ?v=2 → cache-bust the 2x re-capture (same filename would serve stale)
    mobileMedia: { type: "video", src: "/assets/projects/miyavhav/mobile.mp4?v=2" },
    // site sends X-Frame-Options: DENY → embedded preview disabled
    liveUrl: "https://miyavhavtr.com",
    liveEmbed: false,
    caseUrl: null,
    accentColor: "#d8a94f",
    year: "2026",
  },
  {
    id: "derunstudio",
    name: "Derun Studio",
    category: {
      tr: "İç Mimari — Tasarım Stüdyosu",
      en: "Interior Design — Studio",
    },
    description: {
      tr: "İç mimari ve wellbeing odaklı bir tasarım stüdyosunun tanıtım sitesi. Mekânı iyileştiren, doğaya ve insana dokunan bütüncül bir marka deneyimi.",
      en: "Showcase site for an interior design and wellbeing studio. A holistic brand experience built around improving the spaces people live in.",
    },
    stack: {
      tr: ["Web Tasarım", "UI/UX", "SEO"],
      en: ["Web Design", "UI/UX", "SEO"],
    },
    desktopMedia: { type: "image", src: "/assets/projects/derunstudio/desktop.jpg" },
    mobileMedia: { type: "image", src: "/assets/projects/derunstudio/mobile.jpg" },
    liveUrl: "https://derunstudio.com",
    liveEmbed: false,
    accentColor: "#6fb3a4",
    year: "2025",
  },
  {
    id: "dr-cem-akman",
    name: "Dr. Cem Akman",
    category: {
      tr: "Medikal Estetik — Hekim",
      en: "Medical Aesthetics — Clinic",
    },
    description: {
      tr: "Uzm. Dr. Cem Akman'ın medikal estetik kliniği için kurumsal tanıtım sitesi. Uygulama vitrini, online randevu akışı ve güven veren, ferah bir hasta deneyimi.",
      en: "Corporate site for Dr. Cem Akman's medical aesthetics clinic. Treatment showcase, an online booking flow and a calm, reassuring patient experience.",
    },
    stack: {
      tr: ["Web Tasarım", "SEO", "Randevu Sistemi"],
      en: ["Web Design", "SEO", "Booking System"],
    },
    desktopMedia: { type: "image", src: "/assets/projects/dr-cem-akman/desktop.jpg" },
    mobileMedia: { type: "image", src: "/assets/projects/dr-cem-akman/mobile.jpg" },
    // X-Frame-Options: SAMEORIGIN → embedded preview disabled
    liveUrl: "https://drcemakman.com",
    liveEmbed: false,
    accentColor: "#d8a94f",
    year: "2025",
  },
  {
    id: "bilitro-com",
    name: "Bilitro",
    category: { tr: "Yazılım & Medya", en: "Software & Media" },
    description: {
      tr: "Marka, dijital medya ve yazılım çözümleri sunan Bilitro'nun kurumsal tanıtım sitesi. Sade ve güçlü bir dijital vitrin.",
      en: "Corporate site for Bilitro, a brand, digital media and software company. A clean, confident digital storefront.",
    },
    stack: {
      tr: ["Web Tasarım", "UI/UX", "İçerik"],
      en: ["Web Design", "UI/UX", "Content"],
    },
    desktopMedia: { type: "image", src: "/assets/projects/bilitro-com/desktop.jpg" },
    mobileMedia: { type: "image", src: "/assets/projects/bilitro-com/mobile.jpg" },
    liveUrl: "https://bilitro.com",
    liveEmbed: false,
    accentColor: "#e8c06a",
    year: "2025",
  },
  {
    id: "ngequipments",
    name: "NG Equipments",
    category: {
      tr: "Endüstriyel — İş Makinesi",
      en: "Industrial — Heavy Equipment",
    },
    description: {
      tr: "İş makinesi ataşmanları üreten NG Group'un çok dilli kurumsal sitesi. En güçlü yanı, yönetici panelinden yönetilen gömülü dil sistemi: sayfadaki tüm statik ve dinamik metinler, firma sahiplerince istenen her dilde eklenip düzenlenebiliyor.",
      en: "Multi-language corporate site for NG Group, a manufacturer of heavy equipment attachments. Its strongest feature is the built-in language system driven from the admin panel: every static and dynamic string on the page can be added and edited by the owners in any language they need.",
    },
    stack: {
      tr: ["Çok Dilli (i18n)", "Yönetici Paneli", "Kurumsal Site", "SEO"],
      en: ["Multi-language (i18n)", "Admin Panel", "Corporate Site", "SEO"],
    },
    // ?v=2 → cache-bust the re-capture that now includes the site header
    desktopMedia: { type: "image", src: "/assets/projects/ngequipments/desktop.jpg?v=2" },
    mobileMedia: { type: "image", src: "/assets/projects/ngequipments/mobile.jpg" },
    // desktop-only vitrine — the companion phone is hidden
    noMobile: true,
    liveUrl: "https://ngequipments.com",
    liveEmbed: false,
    accentColor: "#c98f3a",
    year: "2025",
  },
  {
    id: "cpa-fahrdienst",
    name: "Cappadocia Fahrdienst",
    category: {
      tr: "Lüks Transfer — İsviçre",
      en: "Luxury Transfer — Switzerland",
    },
    description: {
      tr: "Havaalanı transferi ve VIP ulaşım hizmeti veren İsviçre merkezli Cappadocia Fahrdienst için kurumsal tanıtım ve online rezervasyon sitesi.",
      en: "Corporate site and online booking platform for Cappadocia Fahrdienst, a Switzerland-based airport transfer and VIP transport service.",
    },
    stack: {
      tr: ["Web Tasarım", "SEO", "Rezervasyon"],
      en: ["Web Design", "SEO", "Reservations"],
    },
    desktopMedia: { type: "image", src: "/assets/projects/cpa-fahrdienst/desktop.jpg" },
    mobileMedia: { type: "image", src: "/assets/projects/cpa-fahrdienst/mobile.jpg" },
    liveUrl: "https://cpafahrdienst.ch",
    liveEmbed: false,
    accentColor: "#e0a63a",
    year: "2025",
  },
];

/* ── References Archive ── */

export interface ArchiveProject {
  id: string;
  name: string;
  category: Localized;
  year: string;
  stack: LocalizedList;
  liveUrl: string | null;
  accentColor: string;
  /** screenshot thumbnail under /assets/archive; null → styled fallback */
  thumb: string | null;
  /** optional looping preview video (mp4) that plays as the card nears */
  video?: string;
}

/* shorthand for the stack combos that repeat across the archive */
const S = {
  webSeo: { tr: ["Web Tasarım", "SEO"], en: ["Web Design", "SEO"] },
  webUx: { tr: ["Web Tasarım", "UI/UX"], en: ["Web Design", "UI/UX"] },
  webMotion: { tr: ["Web Tasarım", "Motion"], en: ["Web Design", "Motion"] },
  webContent: { tr: ["Web Tasarım", "İçerik"], en: ["Web Design", "Content"] },
  shopUx: { tr: ["Shopify", "UI/UX"], en: ["Shopify", "UI/UX"] },
  ecomUx: { tr: ["E-Ticaret", "UI/UX"], en: ["E-Commerce", "UI/UX"] },
  ecomSeo: { tr: ["E-Ticaret", "SEO"], en: ["E-Commerce", "SEO"] },
  corpSeo: { tr: ["Kurumsal Site", "SEO"], en: ["Corporate Site", "SEO"] },
  cgi: { tr: ["3D / CGI", "Animasyon"], en: ["3D / CGI", "Animation"] },
} satisfies Record<string, LocalizedList>;

/* Full reference archive. `thumb` points at /assets/archive/<id>.jpg;
   a null thumb renders the initials placeholder instead. */
export const ARCHIVE_PROJECTS: ArchiveProject[] = [
  { id: "akman-ciftlik", name: "Akman Orman Çiftliği", category: { tr: "Doğa & Yaşam", en: "Nature & Living" }, year: "2025", stack: S.webSeo, liveUrl: "https://akmanormanciftligi.com", accentColor: "#7fae5a", thumb: "/assets/archive/akman-ciftlik.jpg", video: "/assets/archive/akman-ciftlik.mp4?v=5" },
  { id: "bilitro3d", name: "Bilitro 3D", category: { tr: "3D Stüdyo & CGI", en: "3D Studio & CGI" }, year: "2026", stack: S.cgi, liveUrl: "https://bilitro3d.com", accentColor: "#e8c06a", thumb: "/assets/archive/bilitro3d.jpg", video: "/assets/archive/bilitro3d.mp4?v=2" },
  { id: "deko", name: "Deko Dekorasyon", category: { tr: "İç Mekan Tasarımı", en: "Interior Design" }, year: "2025", stack: S.webSeo, liveUrl: "https://dekodekorasyon.com", accentColor: "#d8a94f", thumb: "/assets/archive/deko.jpg" },
  { id: "gia-wallpaper", name: "Gia Design Wallpaper", category: { tr: "Duvar Kağıdı & Tasarım", en: "Wallpaper & Design" }, year: "2025", stack: S.ecomUx, liveUrl: "https://giadesignwallpaper.com", accentColor: "#cf8fa6", thumb: "/assets/archive/gia-wallpaper.jpg", video: "/assets/archive/gia-wallpaper.mp4?v=4" },
  { id: "dr-bugce", name: "Op. Dr. Buğçe Ballıoğlu Güney", category: { tr: "Sağlık — Hekim", en: "Healthcare — Surgeon" }, year: "2025", stack: S.webSeo, liveUrl: "https://drbugceballiogluguney.com", accentColor: "#d98a9e", thumb: "/assets/archive/dr-bugce.jpg", video: "/assets/archive/dr-bugce.mp4?v=2" },
  { id: "imperio-racing", name: "İmperio Racing Studio", category: { tr: "Yarış Simülasyonu", en: "Racing Simulation" }, year: "2025", stack: S.webMotion, liveUrl: "https://imperioracingstudio.com", accentColor: "#d2503c", thumb: "/assets/archive/imperio-racing.jpg" },
  { id: "levelup-eryaman", name: "LevelUp Oyun Salonu", category: { tr: "Oyun & Eğlence", en: "Gaming & Entertainment" }, year: "2025", stack: S.webUx, liveUrl: "https://leveluperyaman.com", accentColor: "#8f9bd6", thumb: "/assets/archive/levelup-eryaman.jpg", video: "/assets/archive/levelup-eryaman.mp4?v=2" },
  { id: "lion-led", name: "Lion LED Lighting", category: { tr: "LED Aydınlatma", en: "LED Lighting" }, year: "2024", stack: S.webSeo, liveUrl: "https://lionledlighting.com", accentColor: "#e8c06a", thumb: null },
  { id: "medisante", name: "Özel Medisante Polikliniği", category: { tr: "Sağlık — Poliklinik", en: "Healthcare — Clinic" }, year: "2025", stack: S.webSeo, liveUrl: "https://ozelmedisantepoliklinik.com", accentColor: "#5aa89a", thumb: "/assets/archive/medisante.jpg", video: "/assets/archive/medisante.mp4?v=2" },
  { id: "pr-turkiye", name: "PR Türkiye", category: { tr: "Halkla İlişkiler", en: "Public Relations" }, year: "2024", stack: S.webContent, liveUrl: "https://prturkiye.net", accentColor: "#d8a94f", thumb: "/assets/archive/pr-turkiye.jpg" },
  { id: "royal-premium", name: "Royal Premium", category: { tr: "Gayrimenkul", en: "Real Estate" }, year: "2025", stack: S.webSeo, liveUrl: "https://royalpremium.com.tr", accentColor: "#c9a24a", thumb: "/assets/archive/royal-premium.jpg" },
  { id: "sekmen-sigorta", name: "Sekmen Sigorta", category: { tr: "Sigorta Aracılığı", en: "Insurance Brokerage" }, year: "2024", stack: S.webSeo, liveUrl: "https://sekmensigorta.com.tr", accentColor: "#5a8fb0", thumb: "/assets/archive/sekmen-sigorta.jpg" },
  { id: "soul-sante", name: "Soulsante Psikoloji", category: { tr: "Psikoloji & Danışmanlık", en: "Psychology & Counselling" }, year: "2025", stack: S.webSeo, liveUrl: "https://soulsante.com.tr", accentColor: "#9b8fd0", thumb: "/assets/archive/soul-sante.jpg" },
  { id: "efesin", name: "Efesin İnşaat & Mühendislik", category: { tr: "İnşaat & Tesis Yönetimi", en: "Construction & Facility Management" }, year: "2024", stack: S.corpSeo, liveUrl: "https://efesin.com", accentColor: "#c98f3a", thumb: "/assets/archive/efesin.jpg" },
  { id: "otovia", name: "Otovia Türkiye", category: { tr: "Otomotiv Aksesuar", en: "Automotive Accessories" }, year: "2025", stack: S.ecomSeo, liveUrl: "https://otoviaturkiye.com", accentColor: "#6a9bc0", thumb: "/assets/archive/otovia.jpg" },
  { id: "miyavhav-com", name: "MiyavHav", category: { tr: "E-Ticaret — Pet Shop", en: "E-Commerce — Pet Shop" }, year: "2024", stack: S.shopUx, liveUrl: "https://miyavhavtr.com", accentColor: "#d8a94f", thumb: "/assets/archive/miyavhav-com.jpg", video: "/assets/archive/miyavhav-com.mp4" },
  { id: "goatmedia", name: "Goat Media", category: { tr: "Dijital Ajans — Dubai", en: "Digital Agency — Dubai" }, year: "2025", stack: S.webMotion, liveUrl: "https://goatmediadxb.com", accentColor: "#8f9bd6", thumb: "/assets/archive/goatmedia.jpg" },
];
