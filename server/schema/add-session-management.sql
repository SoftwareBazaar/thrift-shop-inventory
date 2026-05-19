-- Migration: Add Session Management for Password Change Security
-- This script adds session tracking and password versioning to invalidate
-- all active sessions when a user changes their password

-- Add password_version column to users table
-- This stores a hash/timestamp that changes whenever the password changes
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_version VARCHAR(64);

-- Initialize password_version for existing users (using their current password_hash as initial version)
UPDATE users 
SET password_version = LEFT(MD5(password_hash || created_date::text), 32)
WHERE password_version IS NULL;

-- Create sessions table to track active login sessions
CREATE TABLE IF NOT EXISTS sessions (
    session_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    password_version VARCHAR(64) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient session lookups
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_password_version ON sessions(password_version);

-- Create a function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM sessions WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create a function to invalidate all sessions for a user (called on password change)
CREATE OR REPLACE FUNCTION invalidate_user_sessions(p_user_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM sessions WHERE user_id = p_user_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create a function to update password_version when password changes
CREATE OR REPLACE FUNCTION update_password_version()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update password_version if password_hash actually changed
    IF NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN
        NEW.password_version := LEFT(MD5(NEW.password_hash || NOW()::text), 32);
        
        -- Invalidate all existing sessions for this user
        PERFORM invalidate_user_sessions(NEW.user_id);
        
        -- Log the password change
        INSERT INTO activity_log (user_id, action, table_name, record_id, old_values, new_values)
        VALUES (
            NEW.user_id,
            'PASSWORD_CHANGE',
            'users',
            NEW.user_id,
            jsonb_build_object('password_version', OLD.password_version),
            jsonb_build_object('password_version', NEW.password_version)
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update password_version on password change
DROP TRIGGER IF EXISTS trigger_update_password_version ON users;
CREATE TRIGGER trigger_update_password_version
    BEFORE UPDATE ON users
    FOR EACH ROW
    WHEN (OLD.password_hash IS DISTINCT FROM NEW.password_hash)
    EXECUTE FUNCTION update_password_version();

-- Optional: Clean up any existing expired sessions
SELECT cleanup_expired_sessions();

COMMENT ON TABLE sessions IS 'Tracks active user login sessions for security and session invalidation on password changes';
COMMENT ON COLUMN users.password_version IS 'Version identifier that changes with each password change, used to invalidate old sessions';
