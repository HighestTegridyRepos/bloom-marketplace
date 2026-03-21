# SiamClones — Project Instructions

## What This Is

A peer-to-peer marketplace for cannabis clones, seeds, and buds targeting
the Thai market. Connects verified growers with buyers across all 77
provinces of Thailand. Two portals: a buyer marketplace and a seller
dashboard. AI chatbot powered by Gemini. Payments via PromptPay QR only
(no cash on delivery).

Built by Austin. Lives at siamclones.com.

## The Core Architecture

Vite build step compiles JSX at build time. Two separate React 19 apps
(buyer + seller) share common code via `src/shared/`. Vercel auto-detects
Vite and runs `npm run build` on deploy. Output goes to `dist/`.

All styling is inline (no CSS files beyond the `<style>` blocks in the
HTML shells). No Tailwind, no CSS modules, no styled-components.

Hash-based routing (`#home`, `#products`, `#cart`, etc.) with History API
for the buyer SPA. The seller portal uses screen-based state management
(`screen` state: auth → setup → dashboard → create-listing).

State management is local (useState/useEffect) — no Redux, no Context
providers. Cart persists to localStorage. Language persists to localStorage.

## Tech Stack

- **Frontend**: React 19 with Vite 6 build (JSX compiled at build time via `@vitejs/plugin-react`)
- **Build**: Vite 6, multi-page config (`index.html` + `seller.html`)
- **Routing**: Hash-based (`#home`, `#products`, `#growers`, `#cart`, `#checkout`, etc.)
- **Backend / DB**: Supabase (PostgreSQL, Auth, Storage, Edge Functions, Row Level Security)
- **Hosting**: Vercel — auto-deploy from GitHub main branch, auto-detects Vite
- **Serverless API**: Vercel Functions (`api/chat.js`) — CommonJS `module.exports` pattern
- **AI Chatbot**: Gemini 2.5 Flash via Google Generative AI REST API
- **i18n**: Bilingual EN/TH with `useLanguage` hook and `t()` function, localStorage persistence (default: Thai)
- **Payments**: PromptPay QR code generation (EMVCo-compliant, built from scratch in `src/shared/qrcode.js`)
- **PWA**: Service worker v8 (`public/sw.js`), `manifest.json`, offline fallback
- **Security**: CSP headers (no unsafe-eval needed), X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy via `vercel.json`
- **Image Optimization**: Client-side resize/compress before upload (`src/shared/imageUtils.js`), lazy loading with IntersectionObserver (`OptimizedImage` component)
- **Font**: Plus Jakarta Sans (Google Fonts, preloaded)

## File Structure

```
bloom-marketplace/
├── index.html              Buyer marketplace shell (meta tags, SEO, styles, #root)
├── seller.html             Seller portal shell (noindex, styles, #root)
├── vite.config.js          Multi-page Vite config (buyer + seller entry points)
├── package.json            React 19, Supabase JS, Vite 6
├── src/
│   ├── buyer/
│   │   ├── main.jsx        Entry point → ErrorBoundary → App
│   │   ├── App.jsx         Router (renderPage switch), cart state, History API, deep links
│   │   ├── components/
│   │   │   ├── Navbar.jsx          Fixed nav, scroll-aware bg, hamburger menu, cart badge
│   │   │   ├── Hero.jsx            Full-bleed hero with parallax blobs, trust bar
│   │   │   ├── ProductsPage.jsx    Category tabs, search, price/sort/province filters, Supabase fetch
│   │   │   ├── ProductCard.jsx     Grid card (4:3 images), stock badge, verified badge
│   │   │   ├── ProductDetail.jsx   Image gallery, quantity selector, add-to-cart, share, delivery FAQ
│   │   │   ├── CartPage.jsx        Cart items, quantity controls, total
│   │   │   ├── CheckoutPage.jsx    2-step: delivery form → PromptPay QR + proof upload (~860 lines)
│   │   │   ├── OrderConfirmation.jsx  Success page with confetti + share buttons
│   │   │   ├── VendorsPage.jsx     Vendor directory (fetches active profiles)
│   │   │   ├── HowItWorks.jsx      4-step flow + FAQ accordion + restock alert
│   │   │   ├── AboutPage.jsx       Mission statement, brand values
│   │   │   ├── ContactPage.jsx     Contact form → inserts to `leads` table
│   │   │   ├── NotFoundPage.jsx    Bilingual 404
│   │   │   ├── Footer.jsx          Branding, copyright
│   │   │   ├── Toast.jsx           Slide-in notification (top-right)
│   │   │   ├── ShareButtons.jsx    Native Share API, LINE, WhatsApp, copy link
│   │   │   ├── Accordion.jsx       Reusable collapsible Q&A
│   │   │   ├── RestockAlert.jsx    Lead capture (email/LINE) → `leads` table
│   │   │   ├── PromptPayQR.jsx     Dynamic EMVCo QR generation with CRC-16
│   │   │   └── ErrorBoundary.jsx   Class component, catches render errors
│   │   ├── hooks/
│   │   │   ├── useLanguage.js      Lang state + t() translator + toggle (EN/TH)
│   │   │   └── useDebounce.js      Debounce hook for search input
│   │   └── lib/
│   │       ├── translations.js     200+ bilingual translation keys
│   │       ├── priceUnits.js       getPriceUnitLabel() with category-smart fallbacks
│   │       ├── analytics.js        Lightweight event tracker (localStorage + dataLayer)
│   │       └── share.js            Share URL builder with UTM params
│   ├── seller/
│   │   ├── main.jsx        Entry point → ErrorBoundary → App
│   │   ├── App.jsx         Auth flow: check session → load profile → route to screen
│   │   ├── components/
│   │   │   ├── AuthScreen.jsx      Sign in/up, password strength indicator
│   │   │   ├── ProfileSetup.jsx    3-step wizard (basics → operation → contact), avatar upload
│   │   │   ├── CreateListing.jsx   Category-aware form, image upload, validation
│   │   │   ├── Dashboard.jsx       3 tabs (Listings/Orders/Analytics), stats, CSV export (~1050 lines)
│   │   │   ├── ImageUpload.jsx     Multi-image upload, client-side optimization, drag reorder
│   │   │   ├── ListingCard.jsx     Listing row: thumbnail, price, actions (edit/hide/delete)
│   │   │   ├── ErrorBoundary.jsx   Class component error boundary
│   │   │   └── ui/
│   │   │       ├── Button.jsx      Variants: primary, secondary, ghost, success
│   │   │       ├── Input.jsx       Label, icon, error state, textarea support
│   │   │       ├── Select.jsx      Custom dropdown arrow
│   │   │       ├── Card.jsx        Hover-lift card wrapper
│   │   │       ├── Alert.jsx       Fixed top-right notification
│   │   │       ├── ChipSelect.jsx  Multi-select toggle chips
│   │   │       ├── ConfirmModal.jsx Overlay confirm/cancel dialog
│   │   │       └── Spinner.jsx     CSS spin animation
│   │   ├── hooks/
│   │   │   └── useLanguage.js      Same pattern as buyer (separate copy)
│   │   └── lib/
│   │       ├── translations.js     150+ seller-specific translation keys
│   │       ├── priceUnits.js       CATEGORIES, PRICE_UNITS_ALL, GROWING_METHODS, CERTIFICATIONS, FARM_SIZES
│   │       └── utils.js            sanitize() for XSS, exportToCSV()
│   └── shared/
│       ├── supabase.js             createClient() with anon key (public, RLS-protected)
│       ├── theme.js                Color palette + shadow constants
│       ├── imageUtils.js           optimizeImage(), generateBlurPlaceholder(), getTransformedUrl()
│       ├── qrcode.js               QR code generator library (large, ~80K tokens, do NOT edit)
│       ├── hooks/
│       │   └── useIsMobile.js      Responsive hook (<=768px), debounced resize listener
│       └── components/
│           ├── OptimizedImage.jsx   Lazy load + skeleton + fade-in + retry + error fallback
│           └── Confetti.jsx         50-piece celebration animation
├── public/
│   ├── chatbot.js          Floating chat widget (IIFE, zero deps, NOT processed by Vite)
│   ├── sw.js               Service worker v8: network-only HTML, SWR assets, force-reload on activate
│   ├── QRCODE.jpg          Static PromptPay QR image
│   ├── payment-qr.png      Static PromptPay QR (alternate)
│   ├── icon-512.png        PWA icon
│   ├── robots.txt          Allow all, points to sitemap
│   └── sitemap.xml         Declares / and /seller.html
├── api/
│   └── chat.js             Vercel serverless: Gemini 2.5 Flash, rate limit 20/min/IP, CORS allowlist
├── vercel.json             Security headers + maxDuration 30s for chat function
├── manifest.json           PWA manifest (standalone, portrait, green theme)
├── supabase-setup.sql      Schema additions: notification fields, rate limiting triggers, webhook
├── supabase/
│   └── functions/
│       └── notify-order/
│           └── index.ts    Edge Function: email (Resend), LINE Notify, Discord webhook
├── favicon.svg
├── icon-192.png
└── .gitignore              node_modules, dist, .DS_Store
```

## Development

```bash
npm install          # Install dependencies
npm run dev          # Start Vite dev server with hot reload
npm run build        # Production build → dist/
npm run preview      # Preview production build locally
```

## Live URLs

| Resource | URL |
|---|---|
| Buyer Marketplace | https://siamclones.com |
| Seller Portal | https://siamclones.com/seller.html |
| Chatbot API Health | https://siamclones.com/api/chat (GET) |
| Vercel Dashboard | vercel.com/austins-projects-7e45e08e/bloom-marketplace |
| GitHub Repo | github.com/TegridyRepoRanch/bloom-marketplace |
| Supabase Project | bqglrepbhjxmbgggdqal.supabase.co |

## Environment Variables

| Variable | Where | What |
|---|---|---|
| `GEMINI_API_KEY` | Vercel Environment Variables | Google Generative AI key for chatbot. Already set. Do NOT change unless rotating. Model `gemini-2.5-flash`. |
| `RESEND_API_KEY` | Supabase Edge Function Secrets | For order notification emails (free tier: 100/day). May not be deployed yet. |
| `FROM_EMAIL` | Supabase Edge Function Secrets | Verified sender email for Resend. |
| `DISCORD_WEBHOOK_URL` | Supabase Edge Function Secrets | Optional. For ops channel order alerts. |
| `NOTIFY_WEBHOOK_SECRET` | Supabase Edge Function Secrets | Optional. Shared secret for Edge Function auth. |

The Supabase anon key is in `src/shared/supabase.js` (public by design,
protected by Row Level Security). Not a secret.

## Supabase Schema

Project: `bqglrepbhjxmbgggdqal` in Supabase.

Key tables (all have RLS policies):
- `listings` — id, seller_id, title, description, price, price_unit, category (clones/seeds/buds), images (JSONB), quantity_available, is_available, growing_method, location
- `orders` — id, seller_id, items (JSONB), total, customer_name, customer_phone, address, district, province, postal_code, payment_method (promptpay), payment_proof_url, status (pending/confirmed/shipped/delivered/cancelled), delivery_notes
- `profiles` — user_id (FK to auth.users), display_name, farm_name, location, phone, promptpay_id, avatar_url, bio, farm_size, years_experience, growing_methods, certifications, website_url, notification_email, line_notify_token, is_active
- `leads` — contact info from restock alerts and contact form submissions

Rate limiting triggers (defined in `supabase-setup.sql`):
- Max 10 orders per hour per customer phone
- Max 20 total listings per vendor, max 5 new listings per hour

Atomic order placement via `place_order_atomic` RPC (validates stock + decrements inventory in one transaction).

Storage buckets:
- `images` — Listing images and seller avatars (path: `listings/{filename}`)
- `payment-proofs` — Customer payment proof uploads (path: `proofs/{filename}`)

## Buyer App Data Flow

1. `ProductsPage` fetches listings from Supabase with profiles JOIN, filters client-side
2. User selects product → `ProductDetail` page (gallery, quantity, add-to-cart)
3. Cart managed in `App.jsx` state, persisted to localStorage
4. `CheckoutPage` step 1: delivery form with real-time validation (Thai phone, postal code)
5. `CheckoutPage` step 2: PromptPay QR display → user pays → uploads screenshot
6. Image optimized client-side → uploaded to `payment-proofs` bucket (3 retries, exponential backoff)
7. `place_order_atomic` RPC called (atomic stock check + decrement + order insert)
8. `OrderConfirmation` page with confetti

Deep link support: `?listing=UUID` loads directly into product detail.

## Seller App Flow

1. `AuthScreen` — email/password sign in or sign up (Supabase Auth)
2. `ProfileSetup` — 3-step wizard: basics (name, farm, location, photo) → operation (size, experience, methods, certifications) → contact (bio, phone, PromptPay ID, LINE, website)
3. `Dashboard` — 3 tabs:
   - **Listings**: view all, edit, toggle availability, delete (with image cleanup from storage)
   - **Orders**: search by name/phone/ID, filter by status, confirm/ship/deliver/cancel orders
   - **Analytics**: revenue, order count, average order value, 7-day daily trend, top 3 products, status breakdown
4. `CreateListing` — category-aware form (clones/seeds/buds each have different price units), multi-image upload with client-side optimization, growing method selector
5. CSV export available for both listings and orders

## Key Design Decisions

### Vite build — JSX compiled at build time
Migrated from Babel Standalone (3MB in-browser compiler) to Vite. Benefits:
no more `unsafe-eval` in CSP, 2-4s faster page load, proper code splitting.
Vercel auto-detects Vite and runs `npm run build`.

### All inline styles, no CSS framework
Every component uses React inline style objects. Global CSS is only in the
HTML shell `<style>` blocks (animations, scrollbars, media queries). This
means no className-based styling libraries — keep all styles inline.

### Buyer and seller have separate translation + hook copies
`useLanguage` and `translations.js` exist in both `src/buyer/` and
`src/seller/` (not shared). They share the same pattern but have different
translation keys. This is intentional — keeps the bundles independent.

### Hash routing instead of file-based routing
Buyer SPA uses hash-based routing. Hash changes (`#products`, `#cart`,
`#checkout`) trigger React state updates. The `renderPage()` switch in
`src/buyer/App.jsx` handles routing. Invalid hashes show a 404 page.

### Price units are category-aware with legacy fallbacks
`getPriceUnitLabel(priceUnit, t, category)` handles both new listings
(explicit `price_unit` field) and legacy listings (`null` price_unit,
falls back based on category: clones→per_clone, seeds→per_seed,
buds→per_gram).

### CORS restricted to production domains
`api/chat.js` checks the Origin header against an allowlist:
`siamclones.com`, `www.siamclones.com`, `bloom-marketplace.vercel.app`.

### Service worker: network-only for HTML, SWR for assets
HTML pages always fetch from network (prevents stale white screens).
Static assets use stale-while-revalidate. SW v8 uses force-navigate
on activate to refresh all open tabs.

### Client-side image optimization before upload
`optimizeImage()` in `src/shared/imageUtils.js` resizes to max 1200×1200
(or 1200×1600 for payment proofs), compresses to WebP/JPEG quality 0.82.
Falls back to original file if anything fails. HEIC/HEIF files skipped.
Critical path: payment proof uploads MUST succeed — function never throws.

### OptimizedImage component for all product images
Lazy loading via IntersectionObserver (200px root margin), skeleton shimmer,
fade-in on load, auto-retry on error (2 retries with cache bust), emoji
fallback on final failure.

### Product card images use 4:3 aspect ratio
Uses `aspectRatio: '4 / 3'` with `objectFit: 'cover'` so images fill the
full card width without white gaps.

### QR code library is large — do not edit
`src/shared/qrcode.js` is an ~80K token QR code generator. It works. Do
not modify or reformat it.

## Chatbot Architecture

Two pieces:
1. `public/chatbot.js` — Self-contained IIFE widget. Zero dependencies.
   NOT processed by Vite (lives in `public/`). Handles UI, message history,
   suggested questions, mobile fullscreen below 640px. Reads language from
   localStorage (`siamclones_lang`). Has its own markdown-lite renderer
   with XSS-safe link handling (protocol allowlist). Injected via `<script>`
   tag on both HTML pages.

2. `api/chat.js` — Vercel serverless function. Receives `{messages: [...], lang}`,
   forwards to Gemini 2.5 Flash with inlined system prompt, returns `{text: "..."}`.
   Rate limited to 20 req/min per IP. Safety block responses return friendly
   fallback messages. Request body capped at 50KB, messages capped at last 20.

## Notification System (Edge Function)

`supabase/functions/notify-order/index.ts` — Deno-based Edge Function.
Triggered by database webhook (via pg_net) when new order is inserted.
Sends notifications via three channels:
- **Email**: Resend API (HTML email with order details + CTA to seller dashboard)
- **LINE Notify**: Thai messaging alert to vendor's LINE account
- **Discord**: Rich embed to ops webhook channel

⚠️ Known issues:
- JWT verification decodes token without signature check (noted in code as TODO)
- pg_net extension may not be enabled on Supabase project (trigger fails silently)
- No retry/dead-letter queue for failed notifications
- Secrets may not all be configured — channels silently skip if missing

## What's Done

### Security
- XSS prevention (React rendering, `sanitize()` utility, no innerHTML except chatbot markdown)
- Supabase RLS on all tables
- CORS restricted to production domains on chatbot API
- Rate limiting: chatbot API (20/min/IP), orders (10/hr/phone), listings (20 total, 5/hr)
- Input sanitization on all forms (checkout, contact, profile)
- CSP headers (no unsafe-eval) + full security header suite via `vercel.json`
- Atomic order placement via `place_order_atomic` RPC (prevents overselling)
- Double-submit prevention on checkout (loading flag blocks concurrent submissions)
- Payment proof upload with 3 retries + exponential backoff

### Features
- Full bilingual EN/TH (200+ buyer keys, 150+ seller keys)
- 404 page for invalid hash routes (bilingual)
- Chatbot with safety-block handling and friendly fallback messages
- PromptPay QR code generation (EMVCo-compliant with CRC-16)
- Product images: 4:3 aspect ratio, lazy loading, skeleton shimmer, retry on error
- Client-side image optimization (resize + compress before upload)
- Order management: confirm, ship, deliver, cancel
- Search + filter orders by name/phone/ID and status
- CSV export for listings and orders
- Drag-and-drop payment proof upload
- Price filter cross-validation (min ≤ max with red border)
- Province filter dynamically built from listing data
- Vendor directory page
- Lead capture (restock alerts + contact form → `leads` table)
- 3-step seller profile wizard with growing methods, certifications, farm details
- Seller analytics: revenue, order count, avg order value, 7-day trend, top products
- Share buttons: native Share API, LINE, WhatsApp, copy link with UTM
- Password strength indicator on seller signup
- Service worker auto-update with controllerchange reload
- PWA with manifest, icons, offline fallback
- Deep link support (`?listing=UUID`)
- Accessibility: skip-to-content link, focus-visible outlines, ARIA roles, keyboard nav, prefers-reduced-motion

### SEO
- Schema.org (WebSite, Organization, Store) — JSON-LD in index.html
- Open Graph + Twitter Card meta tags (both pages)
- robots.txt + sitemap.xml
- Google site verification
- Canonical URLs
- Seller portal has `noindex, nofollow`

## What Still Needs Work

- **Notify-order Edge Function**: May not be deployed. pg_net extension may not be enabled. JWT verification is placeholder. Needs end-to-end testing.
- **Supabase Image Transforms**: Not enabled on project (paid add-on). `getTransformedUrl()` and `buildSrcSet()` in imageUtils.js are no-ops. Product images served at full resolution.
- **Analytics**: localStorage-only event tracking. No GA4, Plausible, or equivalent connected. `dataLayer.push()` calls exist but no GTM script loaded.
- **Sitemap dates**: `lastmod` is static (2026-03-15), not auto-generated on deploy.
- **Seller useLanguage duplication**: Buyer and seller each have their own copy of `useLanguage.js` — identical pattern, different translation files. Could be shared but works fine as-is.
- **Dashboard size**: `Dashboard.jsx` is ~1050 lines. Works but could be split into sub-tab components.
- **No automated tests**: No unit tests, integration tests, or E2E tests.
- **No error reporting**: Errors are caught by ErrorBoundary but not reported to any service (Sentry, etc).

## Dangerous Patterns to Avoid

- **NEVER** add `type: module` to vercel.json or convert `api/chat.js` to ESM — Vercel serverless functions use CommonJS
- **NEVER** use `require()` in `api/chat.js` to import local files — Vercel bundling won't resolve them
- **NEVER** add a `runtime` field to vercel.json — this caused a Vercel build failure previously
- **NEVER** set `Access-Control-Allow-Origin: *` on the chatbot API — use the allowlist in `api/chat.js`
- **NEVER** process `chatbot.js` through Vite — it's a standalone IIFE in `public/`, not a module
- **NEVER** move the `api/` directory — Vercel requires it at the project root
- **NEVER** edit `src/shared/qrcode.js` — it's a large vendored QR library, not our code
- **NEVER** use className-based CSS — all component styling is inline React style objects
- **NEVER** add CSS files or CSS framework imports — keep the existing inline style pattern
- **NEVER** introduce state management libraries (Redux, Zustand) — app uses local state only

## Deployment

GitHub repo: `TegridyRepoRanch/bloom-marketplace` (main branch)
Vercel auto-deploys on push. Runs `npm run build` (Vite), deploys `dist/` + `api/` + `public/`.

After pushing:
1. Check Vercel dashboard for "Ready" status
2. Hard refresh the site once to pick up new SW
3. Test buyer flow: home → products → add to cart → checkout
4. Test seller portal: login → dashboard → listings → orders
5. Test chatbot: open bubble → ask question → verify response

## Testing Checklist (Quick)

- [ ] `npm run build` succeeds with no errors
- [ ] Homepage loads, zero console errors
- [ ] Products page: cards have full-width images, search works
- [ ] Category tabs filter correctly (clones/seeds/buds)
- [ ] Add to cart → cart page → checkout form validates
- [ ] Language toggle EN↔TH works everywhere
- [ ] 404 page shows for `#nonexistent`
- [ ] Chatbot responds in English and Thai
- [ ] `GET /api/chat` returns `{status: "ok", configured: true}`
- [ ] Seller portal: sign up → profile setup → create listing → dashboard
- [ ] Seller dashboard: listings, orders, analytics tabs all load
- [ ] Image upload optimizes and displays correctly
- [ ] Security headers present (check with `curl -I`)
