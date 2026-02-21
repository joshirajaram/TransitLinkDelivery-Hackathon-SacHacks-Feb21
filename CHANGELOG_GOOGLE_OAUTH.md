# 🔄 Authentication Update - Google OAuth Added!

## Summary of Changes

The authentication system has been upgraded to support **Google Sign-In**, and demo accounts have been removed from the UI (but still work for testing via direct email/password login).

---

## 🆕 What's New

### Google OAuth Integration
- **One-click sign-in** with Google accounts
- **Automatic user registration** on first sign-in
- **Secure token verification** via Google's API
- **Works with any Google account** (or can be restricted to UC Davis emails only)

### UI Changes
- **Google Sign-In button** prominently displayed on login page
- **Removed "Demo Accounts" section** from login UI
- **Cleaner login experience** focused on production authentication
- **Setup instructions** shown when Google Client ID not configured

---

## 📁 Files Modified

### Backend

1. **`backend/requirements.txt`**
   - Added `authlib` - OAuth library for Google authentication
   - Added `itsdangerous` - Secure token generation

2. **`backend/app/auth.py`**
   - Added `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` from environment variables
   - New function: `verify_google_token()` - Validates Google ID tokens
   - New function: `get_or_create_google_user()` - Creates/retrieves users from Google sign-in

3. **`backend/app/main.py`**
   - **Removed**: `GET /auth/demo-users` endpoint
   - **Added**: `POST /auth/google` endpoint for Google OAuth authentication
   - Updated imports to include Google OAuth functions
   - Added `GoogleAuthRequest` Pydantic model

4. **`backend/.env.example`** (new file)
   - Template for environment variables
   - Includes Google OAuth configuration
   - Secret key generation instructions

### Frontend

5. **`frontend/src/Login.tsx`**
   - **Removed**: Demo accounts section ("Show Demo Accounts" button and quick login cards)
   - **Added**: Google Sign-In button that loads Google's JavaScript library
   - **Added**: Setup instructions when Google Client ID not configured
   - New `useEffect` hook to initialize Google Sign-In
   - New `handleGoogleSignIn()` callback function
   - Updated styling for Google button container

6. **`frontend/src/api.ts`**
   - **Removed**: `getDemoUsers()` function (no longer needed)
   - **Added**: `googleAuth(token: string)` function to send Google ID token to backend

7. **`frontend/.env.example`**
   - Added `VITE_GOOGLE_CLIENT_ID` configuration
   - Added comments with setup instructions

### Documentation

8. **`GOOGLE_OAUTH_SETUP.md`** (new file)
   - Complete step-by-step setup guide
   - How to create Google Cloud project
   - How to get OAuth credentials
   - Configuration instructions
   - Troubleshooting section
   - Production deployment guide

9. **`AUTH_IMPLEMENTATION.md`** (needs update)
   - Should be updated to reflect Google OAuth addition

---

## 🔑 How Google OAuth Works

### User Flow

1. User opens login page
2. Sees **"Sign in with Google"** button (if configured)
3. Clicks button → Google popup appears
4. User selects Google account and consents
5. Google returns ID token to frontend
6. Frontend sends token to backend `POST /auth/google`
7. Backend verifies token with Google
8. Backend creates/retrieves user in database
9. Backend returns JWT token
10. User is logged in!

### Technical Flow

```
Frontend                          Backend                        Google
   |                                 |                              |
   |  1. Click "Sign in with Google" |                              |
   |-------------------------------->|                              |
   |                                 |                              |
   |  2. Google Sign-In popup        |                              |
   |<--------------------------------|                              |
   |                                 |                              |
   |  3. User selects account        |                              |
   |-------------------------------->|----------------------------->|
   |                                 |  4. Return ID token          |
   |<--------------------------------|<-----------------------------|
   |                                 |                              |
   |  5. POST /auth/google {token}   |                              |
   |-------------------------------->|                              |
   |                                 |  6. Verify token             |
   |                                 |----------------------------->|
   |                                 |  7. Token valid, user info   |
   |                                 |<-----------------------------|
   |                                 |  8. Get/create user in DB    |
   |                                 |  9. Generate JWT token       |
   |  10. Return {access_token, user}|                              |
   |<--------------------------------|                              |
   |  11. Save token, login user     |                              |
```

---

## 🧪 Testing Instructions

### Without Google OAuth (Demo Mode)

If you don't set up Google OAuth, the system still works:

1. Login page shows: *"⚙️ To enable Google Sign-In, add your Google Client ID to .env"*
2. Users can still login with **email/password** (demo accounts still work)
3. Demo accounts:
   - `student@ucdavis.edu` (any password)
   - `owner@tacomadavis.com` (any password)
   - `steward@ucdavis.edu` (any password)

### With Google OAuth (Production Mode)

Follow [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md) to configure:

1. Create Google Cloud project
2. Get OAuth credentials
3. Set `VITE_GOOGLE_CLIENT_ID` in frontend `.env`
4. Set `GOOGLE_CLIENT_ID` in backend `.env`
5. Restart both servers
6. Login page shows Google Sign-In button
7. Click to sign in with any Google account

---

## 🎯 Benefits

### For Users
- ✅ **Faster login** - One click instead of typing credentials
- ✅ **No password to remember** - Uses existing Google account
- ✅ **Auto-registration** - No signup form needed
- ✅ **Secure** - Leverages Google's security infrastructure

### For Developers
- ✅ **No password management** - No storing/hashing passwords
- ✅ **Verified emails** - Google ensures email is verified
- ✅ **Scalable** - Works with any number of users
- ✅ **Professional** - Uses industry-standard OAuth 2.0

### For UC Davis
- ✅ **Familiar** - Students already use Google accounts
- ✅ **Official emails** - Can restrict to @ucdavis.edu
- ✅ **Single Sign-On ready** - Easy path to UC Davis CAS integration

---

## 🔒 Security Features

### Google Token Verification
- Every ID token is verified with Google's tokeninfo endpoint
- Checks token signature, expiration, and audience (client ID)
- Rejects invalid or expired tokens

### Email Verification
- Only accounts with verified emails can sign in
- Google handles email verification process

### Role Assignment
- New users default to STUDENT role
- Can be restricted to UC Davis emails only
- Admins can manually upgrade roles in database

### JWT Token Security
- JWT tokens include user ID, email, and role
- Tokens expire after 8 hours
- Frontend auto-logs out on token expiration

---

## 🚀 Next Steps

### Optional UC Davis Email Restriction

To allow only UC Davis students:

1. Edit `backend/app/auth.py`
2. Find `get_or_create_google_user()` function
3. Uncomment these lines:
   ```python
   if not email.endswith("@ucdavis.edu"):
       raise HTTPException(
           status_code=status.HTTP_403_FORBIDDEN,
           detail="Only UC Davis email addresses are allowed"
       )
   ```

### Production Deployment

1. **Get production Google OAuth credentials**
   - Add production domain to Authorized JavaScript origins
   - Use production Client ID in `.env` files

2. **Set strong SECRET_KEY**
   - Generate: `python -c "import secrets; print(secrets.token_hex(32))"`
   - Set in backend `.env`

3. **Enable HTTPS**
   - Update all URLs to use `https://`
   - Configure CORS for production domain

4. **Optional: Remove demo login**
   - Delete `POST /auth/login` endpoint from `main.py`
   - Remove email/password form from `Login.tsx`

---

## 📊 Comparison: Before vs After

| Feature | Before | After |
|---------|--------|-------|
| **Login Methods** | Demo email/password only | Google OAuth + email/password |
| **Demo Accounts UI** | Visible "Show Demo Accounts" button | Hidden (still work via direct login) |
| **User Registration** | Manual database seeding | Automatic on Google sign-in |
| **Password Management** | Demo mode (any password) | Not needed (Google handles it) |
| **Email Verification** | Not required | Required by Google |
| **Setup Complexity** | Zero setup | Requires Google Cloud project |
| **Production Ready** | Demo only | Production ready with Google OAuth |

---

## 🐛 Known Issues / TO-DOs

1. **Google Client ID not in .env**
   - Shows helpful message on login page
   - Email/password login still works
   
2. **Demo accounts still accessible**
   - Can login via email/password form
   - Useful for testing different roles
   - Can be removed for production

3. **Role management**
   - New Google users default to STUDENT
   - Manual database updates needed for other roles
   - Future: Admin UI for role management

---

## 📚 Related Documentation

- [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md) - Complete setup guide
- [AUTH_IMPLEMENTATION.md](./AUTH_IMPLEMENTATION.md) - Technical auth details
- [USER_GUIDE.md](./USER_GUIDE.md) - User workflows by role
- [QUICKSTART.md](./QUICKSTART.md) - Quick start guide

---

## 🎓 For Hackathon Demo

**Without Google OAuth setup:**
- Show the info message: "To enable Google Sign-In, add your Client ID..."
- Login with demo accounts via email/password
- Explain: "In production, users would sign in with Google"

**With Google OAuth setup:**
- Click "Sign in with Google" button
- Show instant sign-in process
- Explain: "New users are automatically registered"
- Show how it works with any Google account
- Mention: "Can be restricted to UC Davis emails only"

---

## ✅ Testing Checklist

- [ ] Backend starts without errors
- [ ] Frontend builds successfully
- [ ] Login page shows Google button (or setup message)
- [ ] Email/password login still works with demo accounts
- [ ] Demo accounts section removed from UI
- [ ] Google Sign-In button appears (if VITE_GOOGLE_CLIENT_ID set)
- [ ] Google OAuth flow completes successfully (if configured)
- [ ] New users created in database on first Google sign-in
- [ ] JWT tokens work correctly
- [ ] Role-based access control still works
- [ ] All endpoints require authentication

---

**Need help?** See [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md) for detailed setup instructions!
