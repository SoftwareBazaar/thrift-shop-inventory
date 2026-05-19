-- Content Management System for Admin CMS

-- Content table for managing EAs, pricing, and promotional content
CREATE TABLE IF NOT EXISTS content (
    content_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('ea', 'pricing', 'promotion', 'article', 'other')),
    price DECIMAL(10,2),
    image_url VARCHAR(500),
    image_alt_text VARCHAR(200),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft')),
    featured BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    created_by INTEGER,
    updated_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Content metadata table for additional fields
CREATE TABLE IF NOT EXISTS content_metadata (
    metadata_id SERIAL PRIMARY KEY,
    content_id INTEGER,
    key VARCHAR(100) NOT NULL,
    value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_content_type ON content(content_type);
CREATE INDEX IF NOT EXISTS idx_content_status ON content(status);
CREATE INDEX IF NOT EXISTS idx_content_featured ON content(featured);
CREATE INDEX IF NOT EXISTS idx_content_order ON content(display_order);
CREATE INDEX IF NOT EXISTS idx_content_created_by ON content(created_by);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_content_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_content_timestamp ON content;
CREATE TRIGGER trigger_update_content_timestamp
    BEFORE UPDATE ON content
    FOR EACH ROW
    EXECUTE FUNCTION update_content_timestamp();

