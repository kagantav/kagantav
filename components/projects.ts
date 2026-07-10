/**
 * Project content system for the Selected Work showcase + References Archive.
 *
 * Replace the placeholder entries with real projects as they're ready:
 *  - desktopMedia / mobileMedia: point `src` at a real preview —
 *      type "image"  → a screenshot (public/ path or remote URL)
 *      type "video"  → a short muted mp4/webm loop
 *      type "iframe" → the live site URL (only the ACTIVE project mounts it)
 *    Leave `src: null` to keep the styled placeholder screen.
 */

/**
 * TEMP — development-only placeholder so the CANLI İNCELE interaction can
 * be tested end-to-end before real client URLs exist. Replace every usage
 * with the project's real URL (or null) before launch.
 */
const DEV_PLACEHOLDER_LIVE_URL = "https://example.com";

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
  category: string;
  description: string;
  stack: string[];
  desktopMedia: ProjectMedia;
  mobileMedia: ProjectMedia;
  liveUrl: string | null;
  /**
   * false → the site sends X-Frame-Options/CSP that blocks embedding;
   * CANLI İNCELE dives and then shows the "Yeni Sekmede Aç" card
   * instead of mounting an iframe (Chrome renders an ugly error page
   * otherwise). Default: embeddable.
   */
  liveEmbed?: boolean;
  caseUrl?: string | null;
  /** gold-family accent used for the scene glow + placeholder lighting */
  accentColor: string;
  year: string;
  /** true → this site's mobile top is LIGHT, so the companion iPhone's
   *  status bar (time + radios) is drawn DARK for legibility (iOS-adaptive).
   *  Default (omit) → white status bar for dark-topped sites. */
  phoneStatusDark?: boolean;
}

export const FEATURED_PROJECTS: FeaturedProject[] = [
  {
    id: "miyavhav",
    name: "MiyavHav",
    category: "E-Ticaret — Pet Shop",
    description:
      "Kedi ve köpek sahipleri için premium pet ürünleri mağazası — sezonluk koleksiyonlar, avantajlı paketler ve animasyonlu, akıcı bir alışveriş deneyimi.",
    // Shopify doğrulandı (cdn/shop varlıkları); kalanını Kağan teyit edecek
    stack: ["Shopify", "E-Ticaret", "UI/UX", "SEO"],
    desktopMedia: { type: "video", src: "/assets/projects/miyavhav/desktop.mp4" },
    // ?v=2 → cache-bust the 2x re-capture (same filename would serve stale)
    mobileMedia: { type: "video", src: "/assets/projects/miyavhav/mobile.mp4?v=2" },
    // site X-Frame-Options: DENY gönderiyor → gömülü önizleme kapalı
    liveUrl: "https://miyavhavtr.com",
    liveEmbed: false,
    caseUrl: null,
    accentColor: "#d8a94f",
    year: "2026",
  },
  {
    id: "bilitro3d",
    name: "Bilitro 3D",
    category: "Kurumsal — 3D Stüdyo",
    description:
      "3D modelleme, CGI animasyon ve anamorfik LED ekran içerikleri üreten stüdyonun tanıtım sitesi — sinematik hero videoları ve teknoloji odaklı bir portfolyo deneyimi.",
    // TODO(kağan): gerçek stack'i teyit et
    stack: ["3D / CGI", "Animasyon", "UI/UX", "SEO"],
    desktopMedia: { type: "video", src: "/assets/projects/bilitro3d/desktop.mp4" },
    // ?v=2 → cache-bust the 2x re-capture (same filename would serve stale)
    mobileMedia: { type: "video", src: "/assets/projects/bilitro3d/mobile.mp4?v=2" },
    // X-Frame-Options: SAMEORIGIN → gömülü önizleme kapalı
    liveUrl: "https://bilitro3d.com",
    liveEmbed: false,
    accentColor: "#e8c06a",
    year: "2026",
  },
  {
    id: "dr-cem-akman",
    name: "Dr. Cem Akman",
    category: "Medikal Estetik — Hekim",
    description:
      "Uzm. Dr. Cem Akman'ın medikal estetik kliniği için kurumsal tanıtım sitesi — uygulama vitrini, online randevu akışı ve güven veren, ferah bir hasta deneyimi.",
    // TODO(kağan): gerçek stack'i teyit et
    stack: ["Web Tasarım", "SEO", "Randevu Sistemi"],
    desktopMedia: { type: "image", src: "/assets/projects/dr-cem-akman/desktop.jpg" },
    mobileMedia: { type: "image", src: "/assets/projects/dr-cem-akman/mobile.jpg" },
    // X-Frame-Options: SAMEORIGIN → gömülü önizleme kapalı
    liveUrl: "https://drcemakman.com",
    liveEmbed: false,
    accentColor: "#d8a94f",
    year: "2025",
    phoneStatusDark: true, // white mobile header → dark status bar
  },
  {
    id: "derunstudio",
    name: "Derun Studio",
    category: "İç Mimari — Tasarım Stüdyosu",
    description:
      "İç mimari ve wellbeing odaklı bir tasarım stüdyosunun tanıtım sitesi — mekânı iyileştiren, doğaya ve insana dokunan bütüncül bir marka deneyimi.",
    // TODO(kağan): stack teyit
    stack: ["Web Tasarım", "UI/UX", "SEO"],
    desktopMedia: { type: "image", src: "/assets/projects/derunstudio/desktop.jpg" },
    mobileMedia: { type: "image", src: "/assets/projects/derunstudio/mobile.jpg" },
    liveUrl: "https://derunstudio.com",
    liveEmbed: false,
    accentColor: "#6fb3a4",
    year: "2025",
  },
  {
    id: "ngequipments",
    name: "NG Equipments",
    category: "Endüstriyel — İş Makinesi",
    description:
      "İş makinesi ataşmanları üreten NG Group'un kurumsal sitesi — güçlü sahne görselleri, ürün vitrini ve endüstriyel, güven veren bir marka dili.",
    // TODO(kağan): stack teyit
    stack: ["Kurumsal Site", "Katalog", "SEO"],
    desktopMedia: { type: "image", src: "/assets/projects/ngequipments/desktop.jpg" },
    mobileMedia: { type: "image", src: "/assets/projects/ngequipments/mobile.jpg" },
    liveUrl: "https://ngequipments.com",
    liveEmbed: false,
    accentColor: "#c98f3a",
    year: "2025",
    phoneStatusDark: true, // light industrial top bar → dark status bar
  },
  {
    id: "goatmedia",
    name: "Goat Media",
    category: "Dijital Ajans — Dubai",
    description:
      "Dubai merkezli bir dijital ajansın tanıtım sitesi — marka, sosyal medya ve prodüksiyon hizmetleri için modern, hareketli bir vitrin.",
    // TODO(kağan): stack teyit
    stack: ["Web Tasarım", "Motion", "SEO"],
    desktopMedia: { type: "image", src: "/assets/projects/goatmedia/desktop.jpg" },
    mobileMedia: { type: "image", src: "/assets/projects/goatmedia/mobile.jpg" },
    liveUrl: "https://goatmediadxb.com",
    liveEmbed: false,
    accentColor: "#8f9bd6",
    year: "2025",
  },
];

/* ── References Archive — grows toward ~20 entries ── */

export interface ArchiveProject {
  id: string;
  name: string;
  category: string;
  year: string;
  stack: string[];
  liveUrl: string | null;
  accentColor: string;
  /** screenshot thumbnail under /assets/archive; null → styled fallback */
  thumb: string | null;
}

/* Kağan'ın çalıştığı işlerin tam arşivi. Stack'ler kaba tahmin — TODO teyit.
   thumb = /assets/archive/<id>.jpg (erişilemeyen 2 site null → placeholder). */
export const ARCHIVE_PROJECTS: ArchiveProject[] = [
  { id: "akman-ciftlik", name: "Akman Orman Çiftliği", category: "Doğa & Yaşam", year: "2025", stack: ["Web Tasarım", "SEO"], liveUrl: "https://akmanormanciftligi.com", accentColor: "#7fae5a", thumb: "/assets/archive/akman-ciftlik.jpg" },
  { id: "bilitro-com", name: "Bilitro", category: "Yazılım & Medya", year: "2025", stack: ["Web Tasarım", "UI/UX"], liveUrl: "https://bilitro.com", accentColor: "#e8c06a", thumb: "/assets/archive/bilitro-com.jpg" },
  { id: "cpa-fahrdienst", name: "Cappadocia Fahrdienst", category: "Lüks Transfer", year: "2025", stack: ["Web Tasarım", "SEO"], liveUrl: "https://cpafahrdienst.ch", accentColor: "#c9a24a", thumb: "/assets/archive/cpa-fahrdienst.jpg" },
  { id: "deko", name: "Deko Dekorasyon", category: "İç Mekan Tasarımı", year: "2025", stack: ["Web Tasarım", "SEO"], liveUrl: "https://dekodekorasyon.com", accentColor: "#d8a94f", thumb: "/assets/archive/deko.jpg" },
  { id: "gia-wallpaper", name: "Gia Design Wallpaper", category: "Duvar Kağıdı & Tasarım", year: "2025", stack: ["E-Ticaret", "UI/UX"], liveUrl: "https://giadesignwallpaper.com", accentColor: "#cf8fa6", thumb: "/assets/archive/gia-wallpaper.jpg" },
  { id: "dr-bugce", name: "Op. Dr. Buğçe Ballıoğlu Güney", category: "Sağlık — Hekim", year: "2025", stack: ["Web Tasarım", "SEO"], liveUrl: "https://drbugceballiogluguney.com", accentColor: "#d98a9e", thumb: "/assets/archive/dr-bugce.jpg" },
  { id: "imperio-racing", name: "İmperio Racing Studio", category: "Yarış Simülasyonu", year: "2025", stack: ["Web Tasarım", "Motion"], liveUrl: "https://imperioracingstudio.com", accentColor: "#d2503c", thumb: "/assets/archive/imperio-racing.jpg" },
  { id: "levelup-eryaman", name: "LevelUp Oyun Salonu", category: "Oyun & Eğlence", year: "2025", stack: ["Web Tasarım", "UI/UX"], liveUrl: "https://leveluperyaman.com", accentColor: "#8f9bd6", thumb: "/assets/archive/levelup-eryaman.jpg" },
  { id: "lion-led", name: "Lion LED Lighting", category: "LED Aydınlatma", year: "2024", stack: ["Web Tasarım", "SEO"], liveUrl: "https://lionledlighting.com", accentColor: "#e8c06a", thumb: null },
  { id: "medisante", name: "Özel Medisante Polikliniği", category: "Sağlık — Poliklinik", year: "2025", stack: ["Web Tasarım", "SEO"], liveUrl: "https://ozelmedisantepoliklinik.com", accentColor: "#5aa89a", thumb: "/assets/archive/medisante.jpg" },
  { id: "pr-turkiye", name: "PR Türkiye", category: "Halkla İlişkiler", year: "2024", stack: ["Web Tasarım", "İçerik"], liveUrl: "https://prturkiye.net", accentColor: "#d8a94f", thumb: "/assets/archive/pr-turkiye.jpg" },
  { id: "royal-premium", name: "Royal Premium", category: "Gayrimenkul", year: "2025", stack: ["Web Tasarım", "SEO"], liveUrl: "https://royalpremium.com.tr", accentColor: "#c9a24a", thumb: "/assets/archive/royal-premium.jpg" },
  { id: "sekmen-sigorta", name: "Sekmen Sigorta", category: "Sigorta Aracılığı", year: "2024", stack: ["Web Tasarım", "SEO"], liveUrl: "https://sekmensigorta.com.tr", accentColor: "#5a8fb0", thumb: "/assets/archive/sekmen-sigorta.jpg" },
  { id: "soul-sante", name: "Soulsante Psikoloji", category: "Psikoloji & Danışmanlık", year: "2025", stack: ["Web Tasarım", "SEO"], liveUrl: "https://soulsante.com.tr", accentColor: "#9b8fd0", thumb: "/assets/archive/soul-sante.jpg" },
  { id: "efesin", name: "Efesin İnşaat & Mühendislik", category: "İnşaat & Tesis Yönetimi", year: "2024", stack: ["Kurumsal Site", "SEO"], liveUrl: "https://efesin.com", accentColor: "#c98f3a", thumb: "/assets/archive/efesin.jpg" },
  { id: "otovia", name: "Otovia Türkiye", category: "Otomotiv Aksesuar", year: "2025", stack: ["E-Ticaret", "SEO"], liveUrl: "https://otoviaturkiye.com", accentColor: "#6a9bc0", thumb: "/assets/archive/otovia.jpg" },
  { id: "miyavhav-com", name: "MiyavHav", category: "E-Ticaret — Pet Shop", year: "2024", stack: ["Shopify", "UI/UX"], liveUrl: "https://miyavhav.com", accentColor: "#d8a94f", thumb: null },
];
