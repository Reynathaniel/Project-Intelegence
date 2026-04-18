# π Project Intelligence — Next.js 15 Scaffold

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env and fill Supabase credentials
cp .env.local.example .env.local
# Edit .env.local with your anon key from Supabase dashboard

# 3. Run dev server
npm run dev
```

Open http://localhost:3000 → redirects to login → sign in with Google → onboarding (create org) → dashboard.

## File Structure

```
app/
├── layout.tsx              # Root layout (fonts, meta)
├── page.tsx                # Root redirect → /dashboard or /login
├── globals.css             # Tailwind v4 + π brand tokens
├── login/page.tsx          # Google OAuth login page
├── onboarding/             # First-time org creation
├── auth/callback/route.ts  # OAuth callback handler
├── actions/auth.ts         # Server Actions (signIn, signOut)
└── dashboard/
    ├── layout.tsx           # Sidebar + UserProvider wrapper
    ├── page.tsx             # Overview (server component → client)
    ├── overview-client.tsx  # Stats, project cards, quick actions
    ├── projects/page.tsx    # CRUD projects with realtime
    ├── reports/page.tsx     # Daily intelligence logs
    ├── hse/page.tsx         # HSE stub (ready for porting)
    ├── supervisor/page.tsx  # Supervisor stub
    ├── logistics/page.tsx   # Logistics stub
    ├── qc/page.tsx          # QC stub
    ├── hr/page.tsx          # HR stub
    ├── pm/page.tsx          # PM stub
    └── settings/page.tsx    # Settings stub

components/
├── auth/user-provider.tsx   # Client-side user context
└── layout/sidebar.tsx       # Navigation sidebar with org switcher

lib/supabase/
├── client.ts               # Browser client (Client Components)
├── server.ts               # Server client (RSC / Server Actions)
└── middleware.ts            # Session refresh + route protection

middleware.ts               # Next.js middleware (auth guard)
```

## Auth Flow

1. User visits any page → middleware checks session
2. No session → redirect to `/login`
3. Click "Masuk dengan Google" → Server Action → Supabase OAuth → Google consent
4. Google redirects to `/auth/callback` → exchange code → check org membership
5. No org → redirect to `/onboarding` → create first org
6. Has org → redirect to `/dashboard`

## What's Working

- ✅ Google OAuth login/logout via Server Actions
- ✅ Session management via middleware (auto-refresh)
- ✅ Multi-tenant org creation with auto-owner trigger
- ✅ Org switcher in sidebar
- ✅ Dashboard overview with stats from Supabase
- ✅ Projects CRUD with realtime subscription
- ✅ Reports list page
- ✅ Stub pages for all role dashboards (ready for porting)

## Next Steps (porting from REY-COMMAND)

Each role dashboard stub page needs to be replaced with the actual component from the old codebase. The porting pattern is:

1. Replace `onSnapshot(collection(db, 'X'), ...)` → `supabase.from('X').select().eq(...)` + realtime channel
2. Replace `addDoc(collection(db, 'X'), data)` → `supabase.from('X').insert(data)`
3. Replace `updateDoc(doc(db, 'X', id), data)` → `supabase.from('X').update(data).eq('id', id)`
4. Replace Firebase Storage upload → `supabase.storage.from('bucket').upload(path, file)`
5. Replace Gemini AI call → `supabase.functions.invoke('extract-report', { body })`

Priority order: HSE → Supervisor → Logistics → QC → HR → PM → Settings
