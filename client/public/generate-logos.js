/**
 * Generate the full PWA icon set from the brand logo (sta-logo.png.png):
 *   - logo192.png / logo512.png        regular app icons (purpose: any)
 *   - maskable192.png / maskable512.png Android adaptive icons (safe-zone padded)
 *   - apple-touch-icon.png             iOS home-screen icon (180x180, opaque)
 *   - favicon-16/32/48.png + favicon.ico (real ICO container)
 *
 * Run with: npm run generate-logos
 * Note: Sharp is optional. If not available, the pre-generated icons in the
 * repository are used as-is.
 */

const fs = require('fs');
const path = require('path');

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

/** Build a valid .ico file from PNG buffers (PNG-compressed ICO entries). */
function buildIco(entries) {
  // entries: [{ size, buffer }]
  const count = entries.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);

  const dirSize = 16 * count;
  let offset = 6 + dirSize;
  const dirs = [];
  for (const { size, buffer } of entries) {
    const dir = Buffer.alloc(16);
    dir.writeUInt8(size >= 256 ? 0 : size, 0); // width
    dir.writeUInt8(size >= 256 ? 0 : size, 1); // height
    dir.writeUInt8(0, 2);  // palette colors
    dir.writeUInt8(0, 3);  // reserved
    dir.writeUInt16LE(1, 4);  // color planes
    dir.writeUInt16LE(32, 6); // bits per pixel
    dir.writeUInt32LE(buffer.length, 8);
    dir.writeUInt32LE(offset, 12);
    dirs.push(dir);
    offset += buffer.length;
  }
  return Buffer.concat([header, ...dirs, ...entries.map(e => e.buffer)]);
}

async function generateLogos() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.log('⚠️  Sharp not available - skipping logo generation');
    console.log('📌 Pre-generated logos are already in the repository');
    return;
  }

  const sourceFile = path.join(__dirname, 'sta-logo.png.png');
  if (!fs.existsSync(sourceFile)) {
    console.error('❌ Source logo not found:', sourceFile);
    console.log('📌 Using pre-generated logos from repository');
    return;
  }

  try {
    console.log('🖼️  Generating PWA icon set from brand logo...');

    // Regular icons (purpose: any) - logo fills the canvas, white background
    for (const size of [192, 512]) {
      await sharp(sourceFile)
        .resize(size, size, { fit: 'contain', background: WHITE })
        .png({ quality: 80, compressionLevel: 9, palette: true })
        .toFile(path.join(__dirname, `logo${size}.png`));
      console.log(`✅ logo${size}.png`);
    }

    // Maskable icons - Android crops to a circle keeping the inner 80%,
    // so render the logo at ~62% of the canvas with white padding.
    for (const size of [192, 512]) {
      const inner = Math.round(size * 0.62);
      const pad = Math.round((size - inner) / 2);
      const logo = await sharp(sourceFile)
        .resize(inner, inner, { fit: 'contain', background: WHITE })
        .png()
        .toBuffer();
      await sharp({
        create: { width: size, height: size, channels: 4, background: WHITE }
      })
        .composite([{ input: logo, top: pad, left: pad }])
        .png({ quality: 80, compressionLevel: 9, palette: true })
        .toFile(path.join(__dirname, `maskable${size}.png`));
      console.log(`✅ maskable${size}.png`);
    }

    // iOS home-screen icon - MUST be fully opaque (iOS shows transparency as black)
    {
      const inner = Math.round(180 * 0.84);
      const pad = Math.round((180 - inner) / 2);
      const logo = await sharp(sourceFile)
        .resize(inner, inner, { fit: 'contain', background: WHITE })
        .flatten({ background: WHITE })
        .png()
        .toBuffer();
      await sharp({
        create: { width: 180, height: 180, channels: 3, background: WHITE }
      })
        .composite([{ input: logo, top: pad, left: pad }])
        .png({ quality: 80, compressionLevel: 9, palette: true })
        .toFile(path.join(__dirname, 'apple-touch-icon.png'));
      console.log('✅ apple-touch-icon.png (180x180, opaque)');
    }

    // Favicons - small PNGs plus a real .ico container
    const icoEntries = [];
    for (const size of [16, 32, 48]) {
      const buffer = await sharp(sourceFile)
        .resize(size, size, { fit: 'contain', background: WHITE })
        .png({ quality: 80, compressionLevel: 9, palette: true })
        .toBuffer();
      fs.writeFileSync(path.join(__dirname, `favicon-${size}.png`), buffer);
      icoEntries.push({ size, buffer });
      console.log(`✅ favicon-${size}.png`);
    }
    fs.writeFileSync(path.join(__dirname, 'favicon.ico'), buildIco(icoEntries));
    console.log('✅ favicon.ico (real multi-size ICO)');

    console.log('\n🎉 All icons generated successfully!');
  } catch (err) {
    console.error('❌ Error generating logos:', err.message);
    console.log('📌 Using pre-generated logos from repository instead');
  }
}

if (require.main === module) {
  generateLogos().catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });
}

module.exports = generateLogos;
