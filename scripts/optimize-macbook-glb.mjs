/**
 * Rebuilds the MacBook GLB for the web.
 *
 * The source export is a 26.5 MB Blender dump whose textures expand to ~231 MB
 * of VRAM once uploaded — more than a mobile browser's entire WebGL budget, so
 * the laptop stuttered and the archive canvas below it could not be created at
 * all. GPU cost is driven by RESOLUTION (textures are decompressed on upload),
 * not by file size, so the fix is to right-size each map.
 *
 * Sizes below are chosen per map from how much real detail it carries — a
 * 4320² base colour that compresses to 48 KB is a flat surface and looks
 * identical at 1024², while the brushed-aluminium normal keeps 2048².
 * Geometry is left untouched (no decimation) so the silhouette is unchanged.
 *
 *   node scripts/optimize-macbook-glb.mjs
 */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, draco, prune, textureCompress } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "public/assets/macbook-ultra-concept/source/MacBook Ultra.glb";
const OUT = "public/assets/macbook-ultra-concept/source/MacBook Ultra.opt.glb";

/** max dimension per texture name — anything not listed keeps its size */
const LIMITS = [
  [/anodized/i, 2048], // brushed-metal normal: the only map with fine detail
  [/ultra color/i, 1024],
  [/keyboard/i, 1024],
  [/wallpaper/i, 1024],
];

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "draco3d.encoder": await draco3d.createEncoderModule(),
    "draco3d.decoder": await draco3d.createDecoderModule(),
  });

const doc = await io.read(SRC);
const before = readFileSync(SRC).byteLength;

let vram = 0;
for (const tex of doc.getRoot().listTextures()) {
  const name = tex.getName() ?? "";
  const size = tex.getSize();
  if (!size) continue;
  const [w, h] = size;
  const rule = LIMITS.find(([re]) => re.test(name));
  const cap = rule ? rule[1] : Math.max(w, h);
  const scale = Math.min(1, cap / Math.max(w, h));
  const nw = Math.max(1, Math.round(w * scale));
  const nh = Math.max(1, Math.round(h * scale));

  if (scale < 1) {
    const img = await sharp(Buffer.from(tex.getImage()))
      .resize(nw, nh, { fit: "fill" })
      .toBuffer();
    tex.setImage(new Uint8Array(img));
  }
  // 4 bytes/px + ~33% for the mip chain
  vram += nw * nh * 4 * 1.33;
  console.log(
    `  ${name.padEnd(26)} ${String(w).padStart(4)}x${h}  ->  ${nw}x${nh}`
  );
}

await doc.transform(
  dedup(),
  prune(),
  textureCompress({ encoder: sharp, targetFormat: "webp", quality: 92 }),
  draco()
);

await io.write(OUT, doc);
const after = readFileSync(OUT).byteLength;
const mb = (n) => (n / 1048576).toFixed(2) + " MB";
console.log(`\n  file : ${mb(before)}  ->  ${mb(after)}`);
console.log(`  vram : ~231 MB  ->  ~${(vram / 1048576).toFixed(0)} MB (estimate)`);
