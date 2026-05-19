# Admin Content Management System Setup Guide

## Overview
This document provides complete setup instructions for the new Admin Content Management System (CMS) that allows admins to manage content, prices, EAs (Expert Advisors), and upload images with placeholder support.

## Features
- ✅ Create, Edit, and Delete content items
- ✅ Support for multiple content types (EA, Pricing, Promotion, Article, Other)
- ✅ Price management
- ✅ Image upload with drag-and-drop support
- ✅ Image placeholders for items without images
- ✅ Featured content flagging
- ✅ Content status management (Active, Inactive, Draft)
- ✅ Display order management
- ✅ Filter by type and status
- ✅ Responsive design

## Login Credentials
```
Email: neuroalgoforexedge@gmail.com
Password: RobertKe@54
```

## Setup Instructions

### 1. Database Migration
First, run the SQL migration to create the content management tables:

**Option A: Using PostgreSQL CLI**
```bash
psql -h your_db_host -U your_db_user -d your_db_name -f server/schema/add-content-management.sql
```

**Option B: Using Node.js Script**
Create a `run-content-migration.js` file:
```javascript
const pool = require('./server/config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'server/schema/add-content-management.sql'), 'utf8');
    console.log('Running content management migration...');
    await pool.query(sql);
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
```

Then run:
```bash
node run-content-migration.js
```

### 2. Server Setup
The server has been updated with:
- New content API routes at `/api/content`
- Image upload functionality (up to 10MB)
- Static file serving for uploads at `/uploads`

No additional configuration needed if you're already running the server.

### 3. Client Setup
The client has been updated with:
- New `ContentManagement` page component
- New navigation link in the admin dashboard
- Navigation available only for admin users

### 4. Verify Installation

#### Check Database Tables
```sql
-- Verify tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('content', 'content_metadata');
```

#### Test the API
```bash
# Get all content
curl -X GET http://localhost:5000/api/content \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Create new content
curl -X POST http://localhost:5000/api/content \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: multipart/form-data" \
  -F "title=Sample EA" \
  -F "content_type=ea" \
  -F "description=Expert Advisor trading system" \
  -F "price=99.99" \
  -F "status=active" \
  -F "image=@/path/to/image.jpg"
```

## Database Schema

### content Table
```sql
CREATE TABLE content (
    content_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content_type VARCHAR(50) NOT NULL,  -- 'ea', 'pricing', 'promotion', 'article', 'other'
    price DECIMAL(10,2),
    image_url VARCHAR(500),
    image_alt_text VARCHAR(200),
    status VARCHAR(20) DEFAULT 'active',  -- 'active', 'inactive', 'draft'
    featured BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(user_id),
    updated_by INTEGER REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### content_metadata Table
For storing additional custom fields:
```sql
CREATE TABLE content_metadata (
    metadata_id SERIAL PRIMARY KEY,
    content_id INTEGER REFERENCES content(content_id) ON DELETE CASCADE,
    key VARCHAR(100) NOT NULL,
    value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

### Get All Content
```
GET /api/content
Query Parameters:
  - status: 'active', 'inactive', 'draft'
  - type: 'ea', 'pricing', 'promotion', 'article', 'other'
  - featured: 'true' or 'false'

Response:
{
  "message": "Content retrieved successfully",
  "content": [ { content_id, title, description, ... } ]
}
```

### Get Single Content
```
GET /api/content/:contentId

Response:
{
  "message": "Content retrieved successfully",
  "content": { ... },
  "metadata": { key: value, ... }
}
```

### Create Content (Admin Only)
```
POST /api/content
Content-Type: multipart/form-data

Fields:
  - title (required): string
  - content_type (required): 'ea' | 'pricing' | 'promotion' | 'article' | 'other'
  - description (optional): text
  - price (optional): number
  - image (optional): file (JPEG, PNG, GIF, WebP max 10MB)
  - image_alt_text (optional): string
  - status (optional): 'active' | 'inactive' | 'draft'
  - featured (optional): boolean
  - display_order (optional): number

Response:
{
  "message": "Content created successfully",
  "content": { content_id, title, ... }
}
```

### Update Content (Admin Only)
```
PUT /api/content/:contentId
Content-Type: multipart/form-data

Same fields as Create Content
```

### Delete Content (Admin Only)
```
DELETE /api/content/:contentId

Response:
{
  "message": "Content deleted successfully"
}
```

### Add Metadata (Admin Only)
```
POST /api/content/:contentId/metadata
Content-Type: application/json

Body:
{
  "key": "string",
  "value": "string"
}

Response:
{
  "message": "Metadata added successfully",
  "metadata": { metadata_id, content_id, key, value, ... }
}
```

## Accessing the Content Management Section

1. **Login** with your admin credentials:
   - Email: neuroalgoforexedge@gmail.com
   - Password: RobertKe@54

2. **Navigate** to "Content Management" in the left sidebar (admin only)

3. **Create Content**:
   - Click "Add New Content" button
   - Fill in the form with content details
   - Upload an image (optional - placeholder will be shown if no image)
   - Set content type, price, and status
   - Click "Create Content"

4. **Edit Content**:
   - Click "Edit" button on any content card
   - Update the fields
   - Click "Update Content"

5. **Delete Content**:
   - Click "Delete" button on any content card
   - Confirm the deletion

6. **Filter Content**:
   - Use the filter dropdowns to show content by type or status
   - Filters work in real-time

## Image Upload Details

### Supported Formats
- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)

### Size Limits
- Maximum file size: 10MB
- Images are automatically compressed on display

### Image Placeholders
- If no image is uploaded, a placeholder icon (🖼️) is shown
- Placeholders are styled to match the content card design
- Images are stored in `/server/uploads/content/` directory

### Image URLs
- Images are accessible at: `http://your-domain/uploads/content/filename`
- Alt text is required for accessibility

## Content Types

- **EA (Expert Advisor)**: Trading systems or automated tools
- **Pricing**: Price lists and rate information
- **Promotion**: Promotional offers and campaigns
- **Article**: Blog posts and educational content
- **Other**: Miscellaneous content

## Content Status

- **Active**: Published and visible
- **Inactive**: Hidden from display but kept in database
- **Draft**: Not yet published

## Featured Content

Mark content as "Featured" to highlight it in your storefront or marketing materials.

## Display Order

Set the `display_order` to control the sequence in which content appears. Lower numbers appear first.

## Troubleshooting

### Images Not Uploading
1. Check file size (must be under 10MB)
2. Verify file format is JPEG, PNG, GIF, or WebP
3. Ensure server is running and `/uploads` directory exists
4. Check server logs for detailed error messages

### Content Not Appearing
1. Verify content status is "Active"
2. Check that you're logged in as admin
3. Clear browser cache and reload
4. Check browser console for API errors

### Database Migration Failed
1. Verify PostgreSQL is running
2. Check database credentials in `.env` file
3. Ensure you have sufficient permissions
4. Check if tables already exist (safe to re-run)

## Security Considerations

- ✅ All endpoints require admin authentication (JWT token)
- ✅ File uploads are validated by file type and size
- ✅ Images are stored outside the source tree
- ✅ Automatic cleanup of failed uploads
- ✅ Activity logging (via audit trail)

## File Structure

```
project-root/
├── server/
│   ├── routes/
│   │   └── content.js          # Content API routes
│   ├── schema/
│   │   └── add-content-management.sql  # Database migration
│   ├── uploads/                # Upload directory (auto-created)
│   │   └── content/            # Content images
│   └── index.js                # Updated with content routes
├── client/
│   └── src/
│       ├── pages/
│       │   ├── ContentManagement.tsx   # CMS component
│       │   └── ContentManagement.css   # CMS styles
│       └── App.tsx             # Updated with content route
```

## Next Steps

1. ✅ Run the database migration
2. ✅ Start the server and client
3. ✅ Login with admin credentials
4. ✅ Navigate to Content Management
5. ✅ Create your first content item
6. ✅ Test image upload
7. ✅ Test filtering and editing

## Support & Help

For issues or questions:
1. Check the Troubleshooting section above
2. Review server logs for detailed error messages
3. Verify database connection
4. Check that all files were created correctly

---

**Version**: 1.0.0
**Last Updated**: 2024
**Status**: Production Ready
