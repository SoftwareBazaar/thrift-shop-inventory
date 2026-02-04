const supabase = require('../../lib/supabase');
const jwt = require('jsonwebtoken');

const MAX_ATTEMPTS = 5;

module.exports = async (req, res) => {
    console.log('🔍 Verify Code API Hit:', req.url);
    console.log('📍 Method:', req.method);
    console.log('🔐 Has JWT_SECRET:', !!process.env.JWT_SECRET);
    console.log('📅 Deployed at:', new Date().toISOString());

    // Set CORS and JSON headers for all responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {

        const { email, code } = req.body || {};

        if (!email || !code) {
            return res.status(400).json({ message: 'Email and code are required' });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Find the most recent non-verified code for this email
        const { data: codeRecords, error: fetchError } = await supabase
            .from('verification_codes')
            .select('*')
            .eq('email', normalizedEmail)
            .eq('purpose', 'password_reset')
            .eq('verified', false)
            .order('created_at', { ascending: false })
            .limit(1);

        if (fetchError || !codeRecords || codeRecords.length === 0) {
            return res.status(400).json({
                message: 'No verification code found. Please request a new code.'
            });
        }

        const codeRecord = codeRecords[0];

        // Check if code has expired
        const expiresAt = new Date(codeRecord.expires_at);
        const now = new Date();

        if (now > expiresAt) {
            return res.status(400).json({
                message: 'Verification code has expired. Please request a new code.'
            });
        }

        // Check if max attempts exceeded
        if (codeRecord.attempts >= MAX_ATTEMPTS) {
            return res.status(400).json({
                message: 'Maximum verification attempts exceeded. Please request a new code.'
            });
        }

        // Verify the code
        if (codeRecord.code !== code) {
            // Increment attempts
            await supabase
                .from('verification_codes')
                .update({ attempts: codeRecord.attempts + 1 })
                .eq('id', codeRecord.id);

            const remainingAttempts = MAX_ATTEMPTS - (codeRecord.attempts + 1);

            return res.status(400).json({
                message: `Invalid verification code. ${remainingAttempts} attempts remaining.`
            });
        }

        // Code is correct! Mark as verified
        await supabase
            .from('verification_codes')
            .update({ verified: true })
            .eq('id', codeRecord.id);

        // Generate a temporary token for password reset
        // This token is valid for 10 minutes and can only be used to reset password
        const resetToken = jwt.sign(
            {
                user_id: codeRecord.user_id,
                email: normalizedEmail,
                purpose: 'password_reset'
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '10m' }
        );

        return res.json({
            success: true,
            message: 'Code verified successfully',
            resetToken: resetToken
        });

    } catch (error) {
        console.error('Verify code error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};
