# Setting Up Resend Email Service

## Step 1: Sign Up for Resend

1. Go to https://resend.com
2. Click "Start Building"
3. Sign up with your email or GitHub
4. Verify your email address

## Step 2: Get Your API Key

1. Once logged in, go to **API Keys** in the dashboard
2. Click "Create API Key"
3. Name it: "Street Thrift Apparel - Production"
4. Copy the API key (starts with `re_...`)

## Step 3: Add Domain (Optional for Testing)

For testing, Resend lets you send to **your own email** without domain verification.

For production (sending to any email):
1. Go to **Domains** in Resend dashboard
2. Click "Add Domain"
3. Enter your domain (e.g., `streetthriftapparel.com`)
4. Follow DNS setup instructions

**For now**, you can skip domain setup and just send to verified emails (your own email).

## Step 4: Add API Key to Environment

### For Local Development (.env file):
```bash
cd "c:\Users\.User\Desktop\Classified\My library  2\Thrift Shop"
```

Edit your `.env` file and add:
```
RESEND_API_KEY=re_your_actual_api_key_here
```

### For Vercel/Production:
1. Go to your Vercel dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add:
   - **Name**: `RESEND_API_KEY`
   - **Value**: `re_your_actual_api_key_here`
   - **Environment**: Production, Preview, Development

## Step 5: Install Resend Package

Run this command:
```bash
cd "c:\Users\.User\Desktop\Classified\My library  2\Thrift Shop"
npm install resend
```

## Step 6: Test Email Sending

After I update the code, test by:
1. Go to forgot password
2. Enter your username
3. Select email verification
4. **Enter YOUR real email address** (the one you signed up with on Resend)
5. Check your inbox!

## Resend Benefits

✅ **Free Tier**: 3,000 emails/month for free
✅ **Fast**: Emails arrive in seconds
✅ **Reliable**: 99.9% delivery rate
✅ **Simple**: Easy API, no complex setup
✅ **Analytics**: Track email delivery in dashboard

---

Ready? I'll update the code to use Resend once you have your API key!
