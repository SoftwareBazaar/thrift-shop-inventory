# 🚀 PWA Installation Quick Start

Your **Street Thrift Apparel (STA)** app is now fully configured as a Progressive Web App with installable icons!

---

## ✨ What's New

✅ **Logo Icons** - App icon displays on home screen/desktop  
✅ **Offline Support** - Works without internet connection  
✅ **Desktop App** - Installs like a native application  
✅ **Mobile Friendly** - Full screen mode on phones  
✅ **Auto Updates** - Service worker keeps app fresh  

---

## 📱 Installation Instructions for Users

### **Android Phone (Chrome Browser)**
1. Visit your app URL
2. Tap the **menu (⋮)** → **"Install app"** or **"Add to Home Screen"**
3. App icon appears on home screen instantly!

### **iPhone/iPad (Safari ONLY)**
1. Visit your app URL in **Safari** (not Chrome)
2. Tap **Share button** (⬆️ arrow) at bottom
3. Tap **"Add to Home Screen"**
4. App icon appears on home screen!

### **Windows/Mac Desktop (Chrome or Edge)**
1. Visit your app URL
2. Click **install icon** (⊕) in address bar (top right)
3. Click **"Install"** in popup
4. App opens in its own window
5. Shortcut added to Start Menu/Desktop

---

## 🎨 Logo Customization

To use your actual logo instead of the placeholder:

1. **Prepare your logo**
   - Image size: At least 512×512 pixels
   - Format: PNG with transparency
   - Name: `sta-logo.png` (single .png extension)
   - Save to: `client/public/`

2. **Generate icons** (if you install sharp):
   ```bash
   npm install sharp --save-dev
   npm run generate-logos
   ```

3. **Or manually create logos**:
   - Resize your logo to 192×192 px → save as `logo192.png`
   - Resize your logo to 512×512 px → save as `logo512.png`
   - Save both to `client/public/`

---

## 🛠️ Build & Deploy

### **Local Testing**
```bash
# Install dependencies
npm install

# Start development (service worker active)
npm start
```

### **Production Build**
```bash
# Build will auto-generate logos
npm run build
```

---

## ✅ Verification Checklist

- [ ] App logo displays on home screen after install
- [ ] Works offline (try airplane mode)
- [ ] Can open app without browser URL bar
- [ ] Background color is white, header is blue (#0284c7)
- [ ] "STA Inventory" app name shows correctly

---

## 🔧 Configuration Files

- **`manifest.json`** - App name, icons, colors, shortcuts
- **`service-worker.js`** - Offline support & caching
- **`index.html`** - PWA meta tags & icons
- **`generate-logos.js`** - Automatic logo generation script

All are pre-configured and ready to go!

---

## 🚀 Next Steps

1. **Deploy to production** (Vercel, Netlify, etc.)
2. **Share your app URL** with users
3. **Users install** using instructions above
4. **Monitor** in browser DevTools → Application → Manifest

---

## 📞 Troubleshooting

**App icon not showing?**
- Clear browser cache (DevTools → Application → Clear site data)
- Ensure logos exist: `logo192.png` and `logo512.png`
- Check manifest.json is served correctly

**Install button not appearing?**
- Must be HTTPS (not HTTP)
- Must be deployed (not localhost for some browsers)
- Service worker must be registered
- Visit site a few times before install prompt shows

**Works offline?**
- Service worker must be activated
- Check DevTools → Application → Service Workers
- Offline content cached automatically

---

Made with ❤️ for Street Thrift Apparel
