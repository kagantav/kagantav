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
    mobileMedia: { type: "video", src: "/assets/projects/miyavhav/mobile.mp4" },
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
    mobileMedia: { type: "video", src: "/assets/projects/bilitro3d/mobile.mp4" },
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
  },
  {
    id: "vanta-studio",
    name: "Vanta Studio",
    category: "Agency Portfolio",
    description:
      "Award-style agency site with WebGL scenes, editorial typography and a CMS the team actually enjoys using.",
    stack: ["Next.js", "Three.js", "GSAP", "Sanity"],
    desktopMedia: { type: "image", src: null },
    mobileMedia: { type: "image", src: null },
    liveUrl: DEV_PLACEHOLDER_LIVE_URL, // TEMP dev-only
    accentColor: "#f0d9a8",
    year: "2025",
  },
  {
    id: "helios-saas",
    name: "Helios Analytics",
    category: "SaaS Platform",
    description:
      "Multi-tenant analytics suite — role-based dashboards, exportable reports and an onboarding flow that converts.",
    stack: ["React", "Node.js", "ClickHouse", "Docker"],
    desktopMedia: { type: "image", src: null },
    mobileMedia: { type: "image", src: null },
    liveUrl: DEV_PLACEHOLDER_LIVE_URL, // TEMP dev-only
    accentColor: "#b97f2e",
    year: "2025",
  },
  {
    id: "lumen-estate",
    name: "Lumen Estate",
    category: "Real Estate Experience",
    description:
      "Luxury property showcase with map-driven search, virtual tours and lead automation for a boutique agency.",
    stack: ["Next.js", "Mapbox", "Prisma", "PostgreSQL"],
    desktopMedia: { type: "image", src: null },
    mobileMedia: { type: "image", src: null },
    liveUrl: DEV_PLACEHOLDER_LIVE_URL, // TEMP dev-only
    accentColor: "#dfa855",
    year: "2024",
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
}

export const ARCHIVE_PROJECTS: ArchiveProject[] = [
  { id: "kron-logistics", name: "Kron Logistics", category: "Corporate Site", year: "2026", stack: ["Next.js", "Tailwind"], liveUrl: null, accentColor: "#d8a94f" },
  { id: "mira-clinic", name: "Mira Clinic", category: "Healthcare", year: "2026", stack: ["React", "Node.js"], liveUrl: null, accentColor: "#e8c06a" },
  { id: "forge-gym", name: "Forge Athletics", category: "Fitness Platform", year: "2025", stack: ["Next.js", "Supabase"], liveUrl: null, accentColor: "#c98f3a" },
  { id: "sable-hotel", name: "Sable Hotels", category: "Hospitality", year: "2025", stack: ["Next.js", "Sanity"], liveUrl: null, accentColor: "#f0d9a8" },
  { id: "pulse-events", name: "Pulse Events", category: "Ticketing", year: "2025", stack: ["React", "Stripe"], liveUrl: null, accentColor: "#b97f2e" },
  { id: "orbit-agency", name: "Orbit Agency", category: "Marketing Site", year: "2025", stack: ["Astro", "GSAP"], liveUrl: null, accentColor: "#dfa855" },
  { id: "cedar-legal", name: "Cedar & Co. Legal", category: "Law Firm", year: "2024", stack: ["Next.js", "Payload"], liveUrl: null, accentColor: "#d8a94f" },
  { id: "nova-edu", name: "Nova Academy", category: "E-Learning", year: "2024", stack: ["React", "PostgreSQL"], liveUrl: null, accentColor: "#e8c06a" },
  { id: "terra-agro", name: "Terra Agro", category: "Corporate Site", year: "2024", stack: ["Next.js", "Strapi"], liveUrl: null, accentColor: "#c98f3a" },
  { id: "quartz-jewelry", name: "Quartz Jewelry", category: "E-Commerce", year: "2024", stack: ["Shopify", "Hydrogen"], liveUrl: null, accentColor: "#f0d9a8" },
];
