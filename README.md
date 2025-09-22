# ByteVault OTP Hub

A production-ready multi-product OTP (One-Time Password) gateway system for secure authentication code retrieval from multiple email accounts and TOTP sources.

## Features

- 🔐 **Multi-Product OTP Management** - Centralized access to authentication codes across different products
- 📧 **IMAP Email Integration** - Support for Gmail, Outlook, Zoho, Proton, and custom domain mailboxes  
- 🔑 **TOTP Support** - Time-based one-time password generation with configurable algorithms
- 🛡️ **Enterprise Security** - AES-256-GCM encryption for all stored credentials
- 👥 **Role-Based Access Control** - Comprehensive admin panel with user access management
- 📊 **Analytics Dashboard** - Real-time monitoring and audit logging
- ⚡ **Rate Limiting** - Built-in protection against abuse
- 🌐 **Production Ready** - Optimized for deployment on Render Free tier

## Tech Stack

- **Backend**: Node.js 20+ + Express + TypeScript
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Encryption**: Node.js Crypto (AES-256-GCM)
- **Email Processing**: imapflow + mailparser

## Build & Run

### Development
```bash
npm install
npm run dev
```

### Production
```bash
npm run build
npm start
```

Health check endpoint: `GET /api/health` returns `{ "ok": true }`

## Deploy on Render (Free)

### Option 1: Using render.yaml (Recommended)
1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Prepare for Render deployment"
   git push origin main
   ```

2. **Connect to Render**:
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Render will automatically detect the `render.yaml` configuration

3. **Set Environment Variables**:
   Add these in Render dashboard (Environment tab):
   ```
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE=your_supabase_service_role_key
   CRYPTO_SECRET_KEY=your_32_char_secret_for_aes_encryption
   EMAIL_FETCH_LIMIT=20
   DEFAULT_OTP_REGEX=\\b\\d{6}\\b
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   TOTP_DEFAULT_ALGO=SHA1
   TOTP_DEFAULT_DIGITS=6
   TOTP_DEFAULT_PERIOD=30
   SESSION_SECRET=your_session_secret_key
   ```

### Option 2: Manual Setup
1. **Create Web Service**:
   - Build Command: `npm ci && npm run build`
   - Start Command: `npm start`
   - Environment: Node.js 20.x
   - Plan: Free

2. **Add Environment Variables** (same as above)

### Custom Domain (Optional)
- In Render dashboard: Settings → Custom Domains
- Add your domain and configure CNAME record

## UptimeRobot Setup

1. **Create New Monitor**:
   - Type: HTTP(s)
   - URL: `https://your-app-name.onrender.com/api/health`
   - Monitoring Interval: 5 minutes
   - Alert Contacts: Add your email

2. **Monitor Response**:
   - Expected response: `{"ok":true}`
   - HTTP status: 200

## Security Notes

⚠️ **Important Security Practices**:

- **Service Role Key**: Only used server-side, never exposed to client
- **AES-GCM Encryption**: All IMAP passwords and TOTP secrets encrypted at rest
- **Rate Limiting**: OTP/TOTP endpoints limited to 10 requests per minute per user
- **Environment Variables**: Never commit secrets to repository
- **Database Security**: Row Level Security (RLS) enabled on all Supabase tables

## API Endpoints

### Public
- `GET /api/health` - Health check (no auth required)

### User Endpoints (Authentication Required)
- `GET /api/my-products` - Get user's accessible products
- `POST /api/get-otp/:slug` - Fetch OTP from email for product
- `POST /api/get-totp/:slug` - Generate TOTP code for product

### Admin Endpoints (Admin Role Required)
- `GET /api/admin/*` - Admin panel management
- `POST /api/admin/*` - Product/account/user management

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `SUPABASE_URL` | ✅ | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | ✅ | Supabase anon key | `eyJ0eXAiOiJKV1QiLCJhb...` |
| `SUPABASE_SERVICE_ROLE` | ✅ | Supabase service role key | `eyJ0eXAiOiJKV1QiLCJhb...` |
| `CRYPTO_SECRET_KEY` | ✅ | 32+ char AES encryption key | `a1b2c3d4e5f6...` |
| `EMAIL_FETCH_LIMIT` | ✅ | Max emails to fetch per request | `20` |
| `DEFAULT_OTP_REGEX` | ✅ | Default OTP pattern | `\\b\\d{6}\\b` |
| `VITE_SUPABASE_URL` | ✅ | Frontend Supabase URL | Same as `SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Frontend Supabase key | Same as `SUPABASE_ANON_KEY` |
| `TOTP_DEFAULT_ALGO` | ✅ | Default TOTP algorithm | `SHA1` |
| `TOTP_DEFAULT_DIGITS` | ✅ | Default TOTP digits | `6` |
| `TOTP_DEFAULT_PERIOD` | ✅ | Default TOTP period (seconds) | `30` |
| `SESSION_SECRET` | ✅ | Express session secret | `random_secret_key` |

## Troubleshooting

### Build Issues
- Ensure all environment variables are set
- Check build logs in Render dashboard
- Verify Node.js version compatibility

### Runtime Issues
- Check health endpoint: `/api/health`
- Review application logs in Render
- Verify Supabase connection and RLS policies

### Email OTP Issues
- Verify IMAP credentials are encrypted properly
- Check rate limiting (10 requests/minute)
- Ensure email accounts have IMAP enabled

## Support

For issues related to:
- **Application**: Check logs and health endpoint
- **Render Deployment**: [Render Support](https://render.com/docs)
- **Supabase**: [Supabase Documentation](https://supabase.com/docs)

## License

MIT License - see LICENSE file for details