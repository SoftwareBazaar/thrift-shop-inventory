const supabase = require('../../lib/supabase');

// For development: simulate email sending by logging to console
// In production: use Resend, SendGrid, or other email service

function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendEmailInDevelopment(email, code, username) {
    console.log('\n====================================');
    console.log('📧 VERIFICATION EMAIL (Development Mode)');
    console.log('====================================');
    console.log(`To: ${email}`);
    console.log(`Subject: Password Reset Code`);
    console.log('------------------------------------');
    console.log(`Hello ${username},`);
    console.log('');
    console.log(`Your verification code is: ${code}`);
    console.log('');
    console.log('This code will expire in 5 minutes.');
    console.log('====================================\n');
}

module.exports = async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        const { username, email } = req.body || {};

        if (!username || !email) {
            return res.status(400).json({ message: 'Username and email are required' });
        }

        // Verify user exists and email matches
        const { data: userRecord, error: fetchError } = await supabase
            .from('users')
            .select('user_id, username, email, full_name')
            .eq('username', username)
            .single();

        if (fetchError || !userRecord) {
            return res.status(404).json({ message: 'User not found' });
        }

        const storedEmail = (userRecord.email || '').trim().toLowerCase();
        const providedEmail = email.trim().toLowerCase();

        if (storedEmail !== providedEmail) {
            return res.status(400).json({ message: 'Email does not match our records' });
        }

        // Check rate limiting - max 3 codes per email per hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { data: recentCodes } = await supabase
            .from('verification_codes')
            .select('id')
            .eq('email', providedEmail)
            .eq('purpose', 'password_reset')
            .gte('created_at', oneHourAgo);

        if (recentCodes && recentCodes.length >= 3) {
            return res.status(429).json({
                message: 'Too many verification requests. Please try again in an hour.'
            });
        }

        // Generate verification code
        const code = generateVerificationCode();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        // Store code in database
        const { error: insertError } = await supabase
            .from('verification_codes')
            .insert({
                email: providedEmail,
                code: code,
                purpose: 'password_reset',
                user_id: userRecord.user_id,
                expires_at: expiresAt.toISOString()
            });

        if (insertError) {
            console.error('Failed to store verification code:', insertError);
            return res.status(500).json({ message: 'Failed to generate verification code' });
        }

        // Send email using Resend
        try {
            // Check if Resend is configured
            if (!process.env.RESEND_API_KEY) {
                console.error('⚠️ RESEND_API_KEY not configured. Please add it to your .env file.');
                console.log(`📧 [DEV FALLBACK] Code for ${providedEmail}: ${code}`);
                return res.status(500).json({
                    message: 'Email service not configured. Please contact support.'
                });
            }

            const { Resend } = require('resend');
            const resend = new Resend(process.env.RESEND_API_KEY);

            await resend.emails.send({
                from: 'Street Thrift Apparel <onboarding@resend.dev>', // Use verified domain in production
                to: [providedEmail],
                subject: 'Password Reset Code - Street Thrift Apparel',
                html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Password Reset Request</h2>
            <p>Hello ${userRecord.full_name || username},</p>
            <p>You requested to reset your password for Street Thrift Apparel.</p>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <p style="margin: 0; color: #6b7280; font-size: 14px;">Your verification code is:</p>
              <h1 style="margin: 10px 0; color: #1f2937; letter-spacing: 8px; font-size: 36px;">${code}</h1>
            </div>
            <p style="color: #6b7280; font-size: 14px;">
              This code will expire in <strong>5 minutes</strong>.
            </p>
            <p style="color: #6b7280; font-size: 14px;">
              If you didn't request this, you can safely ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #9ca3af; font-size: 12px;">
              Street Thrift Apparel - Professional Inventory Management
            </p>
          </div>
        `
            });

            console.log(`✅ Verification email sent to ${providedEmail}`);

            return res.json({
                success: true,
                message: 'Verification code sent to your email'
            });

        } catch (emailError) {
            console.error('Failed to send email:', emailError);

            // Log code to console as fallback (only in development)
            if (process.env.NODE_ENV === 'development') {
                console.log(`📧 [FALLBACK] Code for ${providedEmail}: ${code}`);
            }

            return res.status(500).json({
                message: 'Failed to send verification email. Please try again or contact support.'
            });
        }
    } catch (error) {
        console.error('Send verification email error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};
