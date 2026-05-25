/**
 * Generate PWA Logo Files with proper resizing
 * Creates proper 192x192 and 512x512 PNG icons for PWA installation
 * 
 * Note: Sharp is optional. If not available, uses pre-generated logos.
 */

const fs = require('fs');
const path = require('path');

async function generateLogos() {
  try {
    // Try to load sharp, but don't fail if it's not available
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

    console.log('🖼️  Resizing logo to proper PWA dimensions...');
    
    // Create 192x192 logo - properly sized and optimized
    await sharp(sourceFile)
      .resize(192, 192, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png({ quality: 80, compressionLevel: 9 })
      .toFile(path.join(__dirname, 'logo192.png'));
    
    console.log('✅ Created logo192.png (192x192 px, optimized)');

    // Create 512x512 logo - properly sized and optimized
    await sharp(sourceFile)
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png({ quality: 80, compressionLevel: 9 })
      .toFile(path.join(__dirname, 'logo512.png'));
    
    console.log('✅ Created logo512.png (512x512 px, optimized)');

    // Also create a favicon version
    await sharp(sourceFile)
      .resize(64, 64, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png({ quality: 85, compressionLevel: 9 })
      .toFile(path.join(__dirname, 'favicon-logo.png'));
    
    console.log('✅ Created favicon-logo.png (64x64 px)');
    
    console.log('\n🎉 All logos generated successfully!');
    console.log('📌 Logos are now optimized and ready for PWA installation');
    
  } catch (err) {
    console.error('❌ Error generating logos:', err.message);
    console.log('📌 Using pre-generated logos from repository instead');
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  generateLogos().catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });
}

module.exports = generateLogos;
