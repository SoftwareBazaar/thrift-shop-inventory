const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const pool = require('../config/database');

const router = express.Router();

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '../uploads/content');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'content-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'));
    }
  }
});

// Get all content
router.get('/', async (req, res) => {
  try {
    const { status, type, featured } = req.query;
    let query = 'SELECT * FROM content WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = $' + (params.length + 1);
      params.push(status);
    }

    if (type) {
      query += ' AND content_type = $' + (params.length + 1);
      params.push(type);
    }

    if (featured === 'true') {
      query += ' AND featured = true';
    }

    query += ' ORDER BY display_order ASC, created_at DESC';

    const result = await pool.query(query, params);

    res.json({
      message: 'Content retrieved successfully',
      content: result.rows
    });
  } catch (error) {
    console.error('Get content error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get single content
router.get('/:contentId', async (req, res) => {
  try {
    const { contentId } = req.params;

    const result = await pool.query(
      'SELECT * FROM content WHERE content_id = $1',
      [contentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Content not found' });
    }

    // Get metadata
    const metadataResult = await pool.query(
      'SELECT key, value FROM content_metadata WHERE content_id = $1 ORDER BY key',
      [contentId]
    );

    const metadata = {};
    metadataResult.rows.forEach(row => {
      metadata[row.key] = row.value;
    });

    res.json({
      message: 'Content retrieved successfully',
      content: result.rows[0],
      metadata
    });
  } catch (error) {
    console.error('Get content by ID error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create content (Admin only)
router.post('/', authenticateToken, requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { title, description, content_type, price, image_alt_text, status, featured, display_order } = req.body;

    if (!title || !content_type) {
      return res.status(400).json({ message: 'Title and content type are required' });
    }

    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/content/${req.file.filename}`;
    }

    const result = await pool.query(
      `INSERT INTO content (title, description, content_type, price, image_url, image_alt_text, status, featured, display_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [title, description, content_type, price || null, imageUrl, image_alt_text, status || 'active', featured || false, display_order || 0, req.user.user_id]
    );

    res.status(201).json({
      message: 'Content created successfully',
      content: result.rows[0]
    });
  } catch (error) {
    console.error('Create content error:', error);
    // Clean up uploaded file if there was an error
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update content (Admin only)
router.put('/:contentId', authenticateToken, requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { contentId } = req.params;
    const { title, description, content_type, price, image_alt_text, status, featured, display_order } = req.body;

    // Check if content exists
    const contentResult = await pool.query(
      'SELECT * FROM content WHERE content_id = $1',
      [contentId]
    );

    if (contentResult.rows.length === 0) {
      if (req.file) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      }
      return res.status(404).json({ message: 'Content not found' });
    }

    const existingContent = contentResult.rows[0];
    let imageUrl = existingContent.image_url;

    // Handle image replacement
    if (req.file) {
      imageUrl = `/uploads/content/${req.file.filename}`;
      // Delete old image if it exists
      if (existingContent.image_url) {
        const oldImagePath = path.join(__dirname, '..', existingContent.image_url);
        fs.unlink(oldImagePath, (err) => {
          if (err) console.error('Error deleting old image:', err);
        });
      }
    }

    const result = await pool.query(
      `UPDATE content 
       SET title = $1, description = $2, content_type = $3, price = $4, 
           image_url = $5, image_alt_text = $6, status = $7, featured = $8, 
           display_order = $9, updated_by = $10
       WHERE content_id = $11
       RETURNING *`,
      [title || existingContent.title, description, content_type || existingContent.content_type, 
       price || null, imageUrl, image_alt_text, status || existingContent.status, 
       featured !== undefined ? featured : existingContent.featured, 
       display_order !== undefined ? display_order : existingContent.display_order,
       req.user.user_id, contentId]
    );

    res.json({
      message: 'Content updated successfully',
      content: result.rows[0]
    });
  } catch (error) {
    console.error('Update content error:', error);
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete content (Admin only)
router.delete('/:contentId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { contentId } = req.params;

    // Get content to delete image
    const result = await pool.query(
      'SELECT * FROM content WHERE content_id = $1',
      [contentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Content not found' });
    }

    const content = result.rows[0];

    // Delete image if exists
    if (content.image_url) {
      const imagePath = path.join(__dirname, '..', content.image_url);
      fs.unlink(imagePath, (err) => {
        if (err) console.error('Error deleting image:', err);
      });
    }

    // Delete metadata
    await pool.query('DELETE FROM content_metadata WHERE content_id = $1', [contentId]);

    // Delete content
    await pool.query('DELETE FROM content WHERE content_id = $1', [contentId]);

    res.json({ message: 'Content deleted successfully' });
  } catch (error) {
    console.error('Delete content error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Add metadata to content (Admin only)
router.post('/:contentId/metadata', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { contentId } = req.params;
    const { key, value } = req.body;

    if (!key || !value) {
      return res.status(400).json({ message: 'Key and value are required' });
    }

    // Check if content exists
    const contentCheck = await pool.query(
      'SELECT content_id FROM content WHERE content_id = $1',
      [contentId]
    );

    if (contentCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Content not found' });
    }

    const result = await pool.query(
      'INSERT INTO content_metadata (content_id, key, value) VALUES ($1, $2, $3) RETURNING *',
      [contentId, key, value]
    );

    res.status(201).json({
      message: 'Metadata added successfully',
      metadata: result.rows[0]
    });
  } catch (error) {
    console.error('Add metadata error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
