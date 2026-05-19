# Password Change Fix - Support All Hash Types

## Issue Fixed
Users were getting "Incorrect current password" error when trying to change passwords.

## Root Cause
- **Old passwords** stored as `derivePasswordHash` (SHA-256 of `username|password`)
- **Server** was only checking with `bcrypt.compare()`
- Mismatch = verification failed even with correct password

## Solution
Updated both password change endpoints to try **both** verification methods:

1. **Try bcrypt first** (for newer server-hashed passwords)
2. **Fallback to derivePasswordHash** (for client-hashed passwords)
3. **Accept password if either matches**

### Files Changed
- [`server/routes/auth.js`](file:///C:/Users/.User/Desktop/Classified/My%20library%20%202/Thrift%20Shop/server/routes/auth.js) - Main auth routes
- [`api/auth/change-password.js`](file:///C:/Users/.User/Desktop/Classified/My%20library%20%202/Thrift%20Shop/api/auth/change-password.js) - Serverless API

## Now Working
✅ Users with bcrypt passwords can change passwords  
✅ Users with derived passwords can change passwords  
✅ New passwords stored as bcrypt (more secure)  
✅ All sessions invalidated on password change  

## About the 1-Minute Delay

The ~1 minute delay for session invalidation on other devices is **expected behavior** because:

1. **Sessions are deleted immediately** in the database ✅
2. **Other devices don't know yet** - they're not constantly checking
3. **When they make their next API request** (within ~1 minute) they get 401 and logout

**This is actually good:**
- Saves battery (not constantly polling)
- Reduces server load
- Normal for token-based auth systems

**If you need instant logout**, you'd need:
- WebSocket connections (real-time push)
- Server-Sent Events
- Polling every few seconds (expensive)

For password security, 1-minute is acceptable - the old password is **already rejected** at login.
