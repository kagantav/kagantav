import sharp from "sharp";

const dir = "c:/xampp/htdocs/portfoyfable/public/assets/";
const files = [
  "portrait.png",
  "glass-frame.png",
  "stack-card.png",
  "expertise-card.png",
  "focus-card.png",
  "open-to-work.png",
  "background-photo.png",
];

for (const f of files) {
  const img = sharp(dir + f);
  const meta = await img.metadata();
  const { data, info } = await img
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  let transparent = 0,
    semi = 0,
    opaque = 0;
  for (let i = 3; i < data.length; i += channels) {
    const a = data[i];
    if (a === 0) transparent++;
    else if (a < 255) semi++;
    else opaque++;
  }
  const px = (x, y) => {
    const i = (y * width + x) * channels;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };
  console.log(
    `${f}: ${width}x${height} hasAlpha=${meta.hasAlpha} | transparent=${(
      (transparent / (width * height)) * 100
    ).toFixed(1)}% semi=${((semi / (width * height)) * 100).toFixed(1)}% opaque=${(
      (opaque / (width * height)) * 100
    ).toFixed(1)}%`
  );
  console.log(
    `   corners TL=${px(2, 2)} TR=${px(width - 3, 2)} BL=${px(
      2,
      height - 3
    )} BR=${px(width - 3, height - 3)} | mid-top=${px(
      Math.floor(width / 2),
      2
    )} sample(40,40)=${px(40, 40)} sample(80,40)=${px(80, 40)}`
  );
}
