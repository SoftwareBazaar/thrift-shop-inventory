/**
 * Generate PWA Logo Files
 * Creates proper 192x192 and 512x512 PNG icons for PWA installation
 */

const fs = require('fs');
const path = require('path');

// If sharp is available, use it. Otherwise, create data URLs
try {
  const sharp = require('sharp');
  generateWithSharp();
} catch (err) {
  console.log('sharp not found, creating placeholder logos...');
  generatePlaceholderLogos();
}

async function generateWithSharp() {
  try {
    const sourceFile = path.join(__dirname, 'sta-logo.png.png');
    
    if (!fs.existsSync(sourceFile)) {
      console.log('Source logo not found, creating placeholder...');
      generatePlaceholderLogos();
      return;
    }

    console.log('📝 Generating logo files with sharp...');
    
    // Create 192x192 logo
    await sharp(sourceFile)
      .resize(192, 192, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(path.join(__dirname, 'logo192.png'));
    
    console.log('✅ Created logo192.png (192x192)');

    // Create 512x512 logo
    await sharp(sourceFile)
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(path.join(__dirname, 'logo512.png'));
    
    console.log('✅ Created logo512.png (512x512)');
    console.log('\n🎉 Logo files generated successfully!');
  } catch (err) {
    console.error('Error generating logos:', err);
    generatePlaceholderLogos();
  }
}

function generatePlaceholderLogos() {
  // Create a simple SVG-based placeholder logo as PNG
  // Using a data URL approach as fallback
  
  console.log('📝 Creating placeholder logos...');
  
  // Simple 1x1 transparent PNG as placeholder
  const transparentPng = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
    0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
  ]);
  
  try {
    fs.writeFileSync(path.join(__dirname, 'logo192.png'), transparentPng);
    console.log('✅ Created placeholder logo192.png');
    
    fs.writeFileSync(path.join(__dirname, 'logo512.png'), transparentPng);
    console.log('✅ Created placeholder logo512.png');
    
    console.log('\n⚠️  Placeholder logos created.');
    console.log('📌 To use your actual logo:');
    console.log('   1. Replace sta-logo.png.png with a proper PNG file named sta-logo.png');
    console.log('   2. Ensure it\'s at least 512x512 pixels');
    console.log('   3. Run: npm run generate-logos (after adding sharp)');
  } catch (err) {
    console.error('Error creating placeholder logos:', err);
  }
}
