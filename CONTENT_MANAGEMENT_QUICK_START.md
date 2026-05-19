# Admin Content Management - Quick Start

## 🚀 Fast Setup (5 Minutes)

### Step 1: Run Database Migration
```bash
# Option 1: Using psql directly
psql -h localhost -U postgres -d thrift_shop -f server/schema/add-content-management.sql

# Option 2: Using Node.js
node -e "
const pool = require('./server/config/database');
const fs = require('fs');
pool.query(fs.readFileSync('server/schema/add-content-management.sql', 'utf8'))
  .then(() => { console.log('✅ Migration done'); process.exit(0); })
  .catch(e => { console.error('❌ Error:', e); process.exit(1); });
"
```

### Step 2: Start Your Server (if not running)
```bash
npm run server
# or
npm run dev
```

### Step 3: Login & Access CMS
1. Go to http://localhost:3000
2. Login with:
   - **Email**: neuroalgoforexedge@gmail.com
   - **Password**: RobertKe@54
3. Click **"Content Management"** in the left sidebar

---

## 📝 Create Your First Content Item

1. Click **"+ Add New Content"**
2. Fill in the form:
   - **Title**: "My Awesome EA"
   - **Type**: Select "Expert Advisor"
   - **Description**: "A great trading system"
   - **Price**: 99.99 (optional)
   - **Image**: Upload a JPEG/PNG (optional - placeholder shown if not provided)
   - **Status**: Keep as "Active"
3. Click **"Create Content"**

---

## 📊 Content Types Available

| Type | Use For | Example |
|------|---------|---------|
| **EA** | Trading Systems | forex-robot-v2.jpg |
| **Pricing** | Price Lists | pricing-2024.jpg |
| **Promotion** | Special Offers | summer-sale.jpg |
| **Article** | Blog/Articles | learn-trading.jpg |
| **Other** | Misc Content | testimonial.jpg |

---

## 🎨 Features

### Image Upload
- **Accepted**: JPEG, PNG, GIF, WebP
- **Max Size**: 10MB
- **Optional**: Shows placeholder if not provided
- **Placeholder**: 🖼️ icon shown automatically

### Filtering
- Filter by **Type** (EA, Pricing, etc.)
- Filter by **Status** (Active, Inactive, Draft)
- Combine multiple filters

### Content Management
- ✅ Create new content
- ✅ Edit existing content
- ✅ Delete content (with confirmation)
- ✅ Upload/replace images
- ✅ Set featured flag
- ✅ Control display order
- ✅ Set status (Active/Inactive/Draft)

---

## 📂 File Locations

**Backend Files Created:**
```
server/routes/content.js                 # API routes
server/schema/add-content-management.sql # Database migration
server/uploads/content/                  # Image storage (auto-created)
```

**Frontend Files Created:**
```
client/src/pages/ContentManagement.tsx   # Main component
client/src/pages/ContentManagement.css   # Styles
```

**Configuration Updated:**
```
server/index.js                          # Added content routes
client/src/App.tsx                       # Added route & import
client/src/components/Layout.tsx         # Added nav link
```

---

## 🔍 API Endpoints

All endpoints require **Admin** access with JWT token.

### List Content
```bash
curl -X GET http://localhost:5000/api/content \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Create Content
```bash
curl -X POST http://localhost:5000/api/content \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "title=Test" \
  -F "content_type=ea" \
  -F "price=99.99" \
  -F "image=@image.jpg"
```

### Update Content
```bash
curl -X PUT http://localhost:5000/api/content/1 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "title=Updated" \
  -F "price=149.99"
```

### Delete Content
```bash
curl -X DELETE http://localhost:5000/api/content/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## ⚠️ Troubleshooting

### "Cannot POST /api/content"
- Check server is running
- Verify content.js route is registered in server/index.js

### Image upload fails
- Check file is under 10MB
- Verify format is JPEG/PNG/GIF/WebP
- Check `/server/uploads/content/` directory exists

### Navigation link not showing
- Verify you're logged in as admin
- Check user role is 'admin'
- Clear browser cache

### Database migration error
- Ensure PostgreSQL is running
- Check .env database credentials
- Verify you have CREATE TABLE permissions

---

## ✅ Checklist

- [ ] Database migration ran successfully
- [ ] Server is running on port 5000
- [ ] Client is running on port 3000
- [ ] Login works with provided credentials
- [ ] "Content Management" appears in sidebar
- [ ] Can create content item
- [ ] Can upload image
- [ ] Can edit content
- [ ] Can delete content
- [ ] Image placeholder shows for items without images

---

## 🎯 Next: Advanced Features

Want to add more features?

1. **Bulk Import**: CSV upload for multiple items
2. **Image Gallery**: Grid view of all images
3. **SEO Fields**: Meta title, description for each item
4. **Scheduling**: Schedule content to publish/unpublish on dates
5. **Versioning**: Keep history of content changes
6. **Comments**: Admin notes/comments on content

---

**Ready to go!** 🚀

Your admin CMS is now ready to use. Start creating content!
