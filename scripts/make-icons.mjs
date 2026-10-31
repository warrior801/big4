// Builds the PWA icons in public/ from icon-source.png.
// Run once when the icon changes:  npm i --no-save sharp && npm run icons
// sharp stays out of package.json so Hostinger's build never has to install it.
import sharp from 'sharp';

const SRC = 'icon-source.png';
const BG = '#14161a'; // sampled from the icon's own dark tile

// The source is a rounded dark tile on solid white corners. Cut the corners out with a
// rounded-rectangle mask, so they're transparent instead of white.
const S = 1024;
const roundMask = Buffer.from(
  `<svg width="${S}" height="${S}"><rect x="20" y="20" width="${S - 40}" height="${S - 40}" rx="210" ry="210" fill="#fff"/></svg>`,
);
const tile = await sharp(SRC)
  .ensureAlpha()
  .composite([{ input: roundMask, blend: 'dest-in' }])
  .png()
  .toBuffer();

// Desktop and Android "any" icons: the rounded tile, transparent corners.
async function rounded(size, out) {
  await sharp(tile).resize(size, size).png().toFile(out);
}

// iPhone and maskable icons need a solid square (iOS paints transparency black and rounds
// its own corners; Android crops maskable icons to the middle 80%).
async function square(size, platePct, out) {
  const art = await sharp(tile).resize(Math.round(size * platePct), Math.round(size * platePct)).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: art, gravity: 'center' }])
    .flatten({ background: BG })
    .png()
    .toFile(out);
}

await rounded(512, 'public/icon-512.png');
await rounded(192, 'public/icon-192.png');
await rounded(64, 'public/favicon.png');
await square(512, 0.86, 'public/icon-maskable-512.png');
await square(180, 1, 'public/apple-touch-icon.png');
console.log('icons written to public/');
