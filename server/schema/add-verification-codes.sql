-- Create verification codes table for email/SMS verification
-- Used for password reset and other verification flows

CREATE TABLE IF NOT EXISTS verification_codes (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255),
  phone_number VARCHAR(20),
  code VARCHAR(6) NOT NULL,
  purpose VARCHAR(50) NOT NULL, -- 'password_reset', 'email_verification', etc.
  user_id INTEGER REFERENCES users(user_id),
  expires_at TIMESTAMP NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_verification_codes_email ON verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_verification_codes_phone ON verification_codes(phone_number);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires ON verification_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_verification_codes_user ON verification_codes(user_id);

-- Function to cleanup expired codes
CREATE OR REPLACE FUNCTION cleanup_expired_verification_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM verification_codes
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a scheduled job to run cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-verification-codes', '*/30 * * * *', 'SELECT cleanup_expired_verification_codes()');

COMMENT ON TABLE verification_codes IS 'Stores temporary verification codes for email/SMS verification';
COMMENT ON COLUMN verification_codes.code IS '6-digit verification code';
COMMENT ON COLUMN verification_codes.purpose IS 'What the code is used for (password_reset, etc)';
COMMENT ON COLUMN verification_codes.attempts IS 'Number of failed verification attempts (max 5)';
COMMENT ON COLUMN verification_codes.expires_at IS 'Code expires after 5 minutes';
