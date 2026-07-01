# Showroom App

React + Vite + Tailwind + Supabase + Capacitor

## Setup

### 1. Clone and install
```bash
git clone <your-repo>
cd showroom-app
npm install
```

### 2. Supabase setup
- Create a new project at supabase.com
- Go to SQL Editor → paste and run `supabase-schema.sql`
- Go to Storage → create two buckets:
  - `car-images` (public)
  - `documents` (private)

### 3. Environment variables
```bash
cp .env.example .env.local
# Fill in your Supabase URL and anon key from Project Settings → API
```

### 4. Run locally
```bash
npm run dev
```

## Mobile (Capacitor)

```bash
npm run build
npm run cap:add:android   # first time only
npm run cap:add:ios       # first time only (Mac + Xcode required)
npm run cap:sync
npm run cap:open:android  # opens Android Studio
npm run cap:open:ios      # opens Xcode
```

## Project Structure

```
src/
  context/        → AuthContext (session, role, signIn, signOut)
  components/
    auth/         → ProtectedRoute
  pages/
    Login.jsx
    staff/        → StaffDashboard + all staff modules
    customer/     → CustomerDashboard + customer modules
  lib/
    supabase.js   → Supabase client
```

## Build Order
1. ✅ Project setup + schema (done)
2. ✅ Auth + roles (done)
3. ⬜ Customer database CRUD
4. ⬜ Inventory management
5. ⬜ Quotation generation (PDF)
6. ⬜ Invoice generation (PDF, GST)
7. ⬜ Payment tracking / ledger
8. ⬜ WhatsApp reminder integration
9. ⬜ Email sync (Gmail OAuth)
10. ⬜ Customer portal view
11. ⬜ Capacitor build + store deployment
```
