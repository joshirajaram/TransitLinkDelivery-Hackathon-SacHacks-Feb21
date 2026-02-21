# 🔑 Google OAuth Setup Guide

This guide will walk you through setting up Google Sign-In for the TransitLink Delivery app.

## Why Google OAuth?

- **Secure**: No need to manage passwords
- **Convenient**: One-click sign-in for users
- **UC Davis Students**: Most students already have Google accounts
- **Auto-registration**: New users are automatically created on first sign-in

## Setup Steps

### 1️⃣ Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name: `TransitLink Delivery` (or any name)
4. Click "Create"

### 2️⃣ Enable Google+ API (if required)

1. In the sidebar, go to **APIs & Services** → **Library**
2. Search for "Google+ API"
3. Click "Enable" (if not already enabled)

### 3️⃣ Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
3. If prompted, configure OAuth consent screen:
   - User Type: **External** (for testing)
   - App name: `TransitLink Delivery`
   - User support email: Your email
   - Developer contact: Your email
   - Click **"Save and Continue"** through the steps
4. Back at Create OAuth client ID:
   - Application type: **Web application**
   - Name: `TransitLink Web Client`
   - **Authorized JavaScript origins**:
     - `http://localhost:5173`
     - `http://localhost:8000` (for backend testing)
   - **Authorized redirect URIs**: (leave empty for now)
   - Click **"Create"**
5. Copy your **Client ID** (looks like: `123456789.apps.googleusercontent.com`)

### 4️⃣ Configure Backend

1. Copy backend `.env.example` to `.env`:
   ```bash
   cd backend
   cp .env.example .env
   ```

2. Edit `backend/.env`:
   ```env
   SECRET_KEY=your-secret-key-here  # Generate with: python -c "import secrets; print(secrets.token_hex(32))"
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret  # Optional, not needed for ID token verification
   ```

3. Generate a secure secret key:
   ```bash
   python -c "import secrets; print(secrets.token_hex(32))"
   ```

### 5️⃣ Configure Frontend

1. Copy frontend `.env.example` to `.env`:
   ```bash
   cd frontend
   cp .env.example .env
   ```

2. Edit `frontend/.env`:
   ```env
   VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   VITE_API_URL=http://localhost:8000
   ```

### 6️⃣ Install Dependencies

Backend:
```bash
cd backend
pip install -r requirements.txt
```

This installs:
- `authlib` - OAuth library
- `itsdangerous` - Secure token generation

### 7️⃣ Test It Out

1. Start backend:
   ```bash
   cd backend
   uvicorn app.main:app --reload
   ```

2. Start frontend (in new terminal):
   ```bash
   cd frontend
   npm run dev
   ```

3. Open http://localhost:5173

4. You should see:
   - Google Sign-In button at the top
   - Traditional email/password form below
   - No more "Demo Accounts" section

5. Click **"Sign in with Google"**:
   - Choose your Google account
   - First time: You'll be asked to consent
   - App will:
     - Verify your Google token
     - Create user account (if new)
     - Assign STUDENT role (default)
     - Return JWT token
     - Log you in!

## 🎓 For UC Davis Students

By default, **any Google account** can sign in (for demo purposes).

To restrict to UC Davis emails only:

1. Edit `backend/app/auth.py`
2. Find the `get_or_create_google_user` function
3. Uncomment these lines:
   ```python
   if not email.endswith("@ucdavis.edu"):
       raise HTTPException(
           status_code=status.HTTP_403_FORBIDDEN,
           detail="Only UC Davis email addresses are allowed"
       )
   ```

## 🔐 How It Works

### Frontend Flow

1. User clicks "Sign in with Google"
2. Google Sign-In popup appears
3. User selects account and consents
4. Google returns ID token to frontend
5. Frontend sends token to backend at `POST /auth/google`

### Backend Flow

1. Receives Google ID token
2. Verifies token with Google's tokeninfo endpoint
3. Checks if user exists in database
4. If new user:
   - Creates user account
   - Assigns default STUDENT role
   - Email must be verified
5. If existing user:
   - Retrieves user from database
6. Creates JWT token with user info
7. Returns JWT token + user data to frontend
8. Frontend stores token in localStorage
9. All subsequent API calls include JWT token in Authorization header

## 🚀 Production Deployment

For production (e.g., deploying to Heroku, AWS, etc.):

1. Update Authorized JavaScript origins in Google Console:
   - Add your production domain: `https://yourdomain.com`

2. Update `.env` files with production URLs:
   ```env
   # Backend .env
   GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/google/callback
   
   # Frontend .env
   VITE_API_URL=https://api.yourdomain.com
   VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   ```

3. Use strong SECRET_KEY in production

4. Enable HTTPS only

## 🛠️ Troubleshooting

### "Invalid Google token" error
- Check that GOOGLE_CLIENT_ID is set correctly in backend `.env`
- Make sure frontend is using the same client ID
- Verify http://localhost:5173 is in Authorized JavaScript origins

### Google button doesn't appear
- Check browser console for errors
- Ensure VITE_GOOGLE_CLIENT_ID is set in frontend `.env`
- Restart frontend dev server after changing .env
- Check that Google Sign-In script loaded (view page source)

### "Email not verified" error
- Google account must have verified email
- Sign in to Google and verify your email address

### "Only UC Davis emails allowed" error
- You enabled UC Davis restriction
- Sign in with @ucdavis.edu email
- Or remove the restriction in `auth.py`

### User created but can't access restaurant features
- New users default to STUDENT role
- For testing restaurant features:
  - Manually update user role in database
  - Or use the demo login (email/password) for pre-existing restaurant owner

## 📝 Testing with Multiple Accounts

Google Sign-In makes it easy to test different users:

1. Sign in with your personal Gmail → STUDENT role
2. Sign in with UC Davis email → STUDENT role
3. Sign out and sign in with different account → New user created

To test different roles:
- Use email/password login for demo accounts (student, owner, steward)
- Or manually update user roles in database after Google sign-in

## 🔄 Migrating from Demo Accounts

Demo accounts (student@ucdavis.edu, owner@tacomadavis.com, etc.) still exist in the database and can be accessed via email/password login. This is useful for:
- Testing without Google OAuth setup
- Demo presentations
- Development

To completely disable demo login:
1. Remove `POST /auth/login` endpoint from `main.py`
2. Remove email/password form from `Login.tsx`
3. Keep only Google Sign-In button

## 🎯 Summary

✅ One-click sign-in with Google
✅ No password management needed
✅ Automatic user registration
✅ Secure JWT token authentication
✅ Works with any Google account (or restrict to UC Davis)
✅ Demo accounts still available for testing

Need help? Check logs in browser console and backend terminal!
