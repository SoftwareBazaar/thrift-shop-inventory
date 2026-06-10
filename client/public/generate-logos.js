/**
 * Generate the full PWA icon set from the brand logo (sta-logo.png.png):
 *   - icon-192.png / icon-512.png               regular app icons (purpose: any)
 *   - icon-maskable-192.png / icon-maskable-512.png  Android adaptive icons
 *   - apple-touch-icon.png                      iOS home-screen icon (180x180)
 *   - favicon-16/32/48.png + favicon.ico        browser tab icons (real ICO)
 *
 * Every icon is flattened onto an opaque white background. Transparent icons
 * render as BLACK squares in the Windows taskbar/jumplist, so no icon may
 * contain an alpha channel.
 *
 * Run with: npm run generate-logos
 * Note: Sharp is optional. If not available, the pre-generated icons in the
 * repository are used as-is.
 */

const fs = require('fs');
const path = require('path');

const WHITE = { r: 255, g: 255, b: 255 };

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

  /**
   * Render the logo at `scale` of a size x size canvas, fully opaque white
   * background (alpha channel removed).
   */
  const renderIcon = async (size, scale = 1) => {
    const inner = Math.round(size * scale);
    const pad = Math.round((size - inner) / 2);
    const logo = await sharp(sourceFile)
      .resize(inner, inner, { fit: 'contain', background: { ...WHITE, alpha: 1 } })
      .flatten({ background: WHITE })
      .png()
      .toBuffer();
    return sharp({
      create: { width: size, height: size, channels: 3, background: WHITE }
    })
      .composite([{ input: logo, top: pad, left: pad }])
      .flatten({ background: WHITE })
      .png({ quality: 80, compressionLevel: 9, palette: true })
      .toBuffer();
  };

  try {
    console.log('🖼️  Generating PWA icon set from brand logo (opaque)...');

    // Regular icons (purpose: any)
    for (const size of [192, 512]) {
      fs.writeFileSync(path.join(__dirname, `icon-${size}.png`), await renderIcon(size, 0.94));
      console.log(`✅ icon-${size}.png`);
    }

    // Maskable icons - Android crops to a circle keeping the inner 80%,
    // so render the logo at ~62% of the canvas with white padding.
    for (const size of [192, 512]) {
      fs.writeFileSync(path.join(__dirname, `icon-maskable-${size}.png`), await renderIcon(size, 0.62));
      console.log(`✅ icon-maskable-${size}.png`);
    }

    // iOS home-screen icon
    fs.writeFileSync(path.join(__dirname, 'apple-touch-icon.png'), await renderIcon(180, 0.84));
    console.log('✅ apple-touch-icon.png (180x180, opaque)');

    // Favicons - small PNGs plus a real .ico container
    const icoEntries = [];
    for (const size of [16, 32, 48]) {
      const buffer = await renderIcon(size, 1);
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
