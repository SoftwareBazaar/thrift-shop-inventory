# Email Verification Setup & Testing Guide

## ✅ What's Been Implemented

### Backend
1. **Database Schema**: `server/schema/add-verification-codes.sql`
   - Stores 6-digit codes with expiration (5 minutes)
   - Rate limiting (max 3 codes per hour)
   - Brute force protection (max 5 attempts)

2. **API Endpoints**:
   - `POST /api/auth/send-verification-email` - Sends code to user's email
   - `POST /api/auth/verify-code` - Verifies the code and returns reset token

### Frontend
3. **Login.tsx Updates**:
   - New "verify-code" step in forgot password flow
   - 6-digit code input with auto-formatting
   - 30-second countdown timer before resend
   - Resend code button with rate limiting

---

## 🚀 Setup Instructions

### Step 1: Run Database Migration

Run this SQL in your **Supabase SQL Editor**:

```sql
-- Create verification codes table
CREATE TABLE IF NOT EXISTS verification_codes (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255),
  phone_number VARCHAR(20),
  code VARCHAR(6) NOT NULL,
  purpose VARCHAR(50) NOT NULL,
  user_id INTEGER REFERENCES users(user_id),
  expires_at TIMESTAMP NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_codes_email ON verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_verification_codes_phone ON verification_codes(phone_number);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires ON verification_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_verification_codes_user ON verification_codes(user_id);
```

Or run the file:
```bash
# Copy the SQL file contents and run in Supabase
```

---

## 🧪 Testing in Development Mode

The system is currently in **development mode** which means:
- ✅ No email service required
- ✅ Codes are shown in the server console/logs
- ✅ Codes are also returned in the API response for easy testing
- ✅ Perfect for testing without costs

### Test Flow:

1. **Start the App**
   ```bash
   npm start  # or your dev command
   ```

2. **Open Login Page**
   - Click "Forgot password?"

3. **Enter Username**
   - Username: `kelvin` (or `manuel`, `admin`)
   - Click "Continue"

4. **Select Email Verification**
   - Click "Verify with email address"

5. **Enter Email**
   - Email: `kelvin@example.com`
   - Click "Continue"
   - Watch the **server console** - you'll see:
     ```
     ====================================
     📧 VERIFICATION EMAIL (Development Mode)
     ====================================
     To: kelvin@example.com
     Subject: Password Reset Code
     ------------------------------------
     Hello Kelvin,
     
     Your verification code is: 123456
     
     This code will expire in 5 minutes.
     ====================================
     ```

6. **Enter the Code**
   - Type the 6-digit code from the console
   - The UI will auto-format it
   - Click "Verify Code"

7. **Set New Password**
   - Enter new password (must meet requirements)
   - Confirm password
   - Click "Update Password"

8. **Login with New Password** ✅

---

## 🎯 Expected Behavior

### ✅ Success Cases

1. **Code Sent**: "Verification code sent! Check your email"
2. **In Dev Mode**: Yellow banner shows `[DEV MODE] Your code is: 123456`
3. **Code Correct**: "Code verified! Set your new password."
4. **Password Reset**: "Password updated successfully"
5. **30s Countdown**: "Resend code in 29s... 28s..." (disabled button)
6. **Resend Enabled**: After 30s, "Resend code" button becomes active

### ❌ Error Cases

1. **Wrong Code**: "Invalid verification code. 4 attempts remaining."
2. **Code Expired**: "Verification code has expired. Please request a new code."
3. **Too Many Attempts**: "Maximum verification attempts exceeded."
4. **Rate Limited**: "Too many verification requests. Please try again in an hour."

---

## 📊 Testing Scenarios

### Scenario 1: Happy Path
- Request code → Enter correct code → Reset password → Login ✅

### Scenario 2: Wrong Code
- Request code → Enter wrong code → See error with attempts remaining
- Enter correct code → Continue ✅

### Scenario 3: Code Expiration
- Request code → Wait 6 minutes → Enter code → See expiration error
- Request new code → Enter within 5 minutes → Continue ✅

### Scenario 4: Resend Code
- Request code → Wait for countdown (30s) → Click "Resend code"
- New code sent → Enter new code → Continue ✅

### Scenario 5: Rate Limiting
- Request code 3 times → Try 4th time → See rate limit error
- Wait 1 hour OR manually delete from database → Try again ✅

---

## 🔧 Troubleshooting

### Issue: "No verification code found"
**Solution:** Request a new code - the previous one may have expired or been used

### Issue: Codes not appearing in console
**Solution:** Make sure your server is running and check the terminal output

### Issue: "User not found" when requesting code
**Solution:** Ensure the username and email match what's in the database

### Issue: Timer not working
**Solution:** Refresh the page and try again - the timer starts when code is sent

---

## 🚀 Production Setup (Optional - For Later)

When ready to send real emails, you can use **Resend** (free tier: 100 emails/day):

### 1. Sign up for Resend
- Go to https://resend.com
- Sign up for free account
- Get API key

### 2. Install Resend
```bash
npm install resend
```

### 3. Add to `.env`
```
RESEND_API_KEY=re_xxxxxxxxxx
NODE_ENV=production
```

### 4. Update `send-verification-email.js`
Uncomment the Resend section at the bottom of the file (lines ~105-115)

---

## 📝 Current Limitations

1. **Phone SMS**: Not yet implemented (only email verification works)
2. **Email Service**: Currently in dev mode (console logs only)
3. **Code Cleanup**: Expired codes stay in database (can be cleaned manually)

To clean expired codes manually:
```sql
DELETE FROM verification_codes WHERE expires_at < NOW();
```

---

## ✨ Features Implemented

✅ 6-digit verification codes
✅ 5-minute expiration
✅ Rate limiting (3 codes/hour)
✅ Brute force protection (5 attempts)
✅ Countdown timer (30s before resend)
✅ Development mode (console logs)
✅ Production-ready structure (just add email service)
✅ Clean UI with auto-formatting
✅ Error handling and validation
✅ Resend functionality

---

##commit & Push

```bash
cd "c:\Users\.User\Desktop\Classified\My library  2\Thrift Shop"

git add server/schema/add-verification-codes.sql
git add api/auth/send-verification-email.js
git add api/auth/verify-code.js
git add client/src/pages/Login.tsx

git commit -m "Add email verification for password reset

FEATURES:
- Add 6-digit email verification code system
- Create verification_codes database table
- Implement send-verification-email endpoint
- Implement verify-code endpoint
- Add code input UI with countdown timer
- Add resend functionality with 30s cooldown

SECURITY:
- Rate limiting: max 3 codes per hour
- Brute force protection: max 5 verification attempts
- Code expiration: 5 minutes
- One-time use tokens

DEV MODE:
- Codes shown in server console for testing
- No email service required
- Easy testing without costs"

git push
```

---

**Ready to test!** 🎉
