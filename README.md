# Kağan Tav — Portföy

Kişisel portföy sitesi. Sinematik, scroll-tabanlı tek sayfa deneyim: gerçek zamanlı 3D sahneler, scroll'a bağlı kamera hareketleri ve canlı proje vitrinleri.

**Kağan Tav** — Full Stack Web & Mobil Developer · Ankara, Türkiye

## Teknolojiler

- **Next.js 15** (App Router) + **TypeScript**
- **React Three Fiber** / **three.js** + **drei** — hero rig'i, 3D MacBook vitrini ve arşiv "uzay galerisi"
- **GSAP** + **ScrollTrigger** — pinlenmiş, scrub'lı sahne koreografisi
- **Lenis** — yumuşak scroll
- **CSS Modules** — siyah/altın tasarım sistemi
- **Vercel Analytics**

## Bölümler

| Bölüm | Ne yapıyor |
|---|---|
| Hero → Hakkımda | Tek pinlenmiş sahne; kamera 3D rig içinde ilerlerken metin değişir |
| Projeler | Scroll'a bağlı cihaz karuseli (gerçek 3D MacBook + iPhone), her projenin canlı ekranı |
| Tüm Arşiv | 17 teslim edilmiş sitenin arasından uçulan 3D galeri; karta tıklayınca öne gelir |
| İletişim | Karanlığın içine dalış efektiyle açılan kapanış |

## Geliştirme

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm run start
```

## Yayına alma (Vercel)

Deploy sonrası ortam değişkenini ayarla — Open Graph / paylaşım kartlarının doğru domaini göstermesi için gerekli:

```
NEXT_PUBLIC_SITE_URL=https://<domain>
```

---

© 2026 Kağan Tav
