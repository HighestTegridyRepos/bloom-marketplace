# SiamClones — Project Instructions

## What This Is

A peer-to-peer marketplace for cannabis clones, seeds, and buds targeting
the Thai market. Connects verified growers with buyers across all 77
provinces of Thailand. Two portals: a buyer marketplace and a seller
dashboard. AI chatbot powered by Gemini. Payments via PromptPay QR and
Cash on Delivery.

Built by Austin. Lives at siamclones.com.

## The Core Architecture

Vite build step compiles JSX at build time. Two separate React apps
(buyer + seller) share common code via `src/shared/`. Vercel auto-detects
Vite and runs `npm run build` on deploy.

Hash-based routing (`#home`, `#products`, `#cart`, etc.) with History API
for the buyer SPA. The seller portal uses screen-based state management.

## Tech Stack

- **Frontend**: React 19 with Vite build (JSX compiled at build time)
- **Build**: Vite 6 with `@vitejs/plugin-react`, multi-page config (buyer + seller)
- **Routing**: Hash-based (`#home`, `#products`, `#vendors`, `#cart`, `#checkout`, etc.)
- **Backend / DB**: Supabase (PostgreSQL, Auth, Storage, Edge Functions, Row Level Security)
- **Hosting**: Vercel — auto-deploy from GitHub main branch, auto-detects Vite
- **Serverless API**: Vercel Functions (`api/chat.js`) — CommonJS `module.exports` pattern
- **AI Chatbot**: Gemini 2.5 Flash via Google Generative AI REST API
- **i18n**: Bilingual EN/TH with `useLanguage` hook and `t()` function, localStorage persistence
- **Payments**: PromptPay QR code generation + Cash on Delivery (COD)
- **PWA**: Service worker (`public/sw.js`), `manifest.json`, offline fallback
- **Security**: CSP headers (no unsafe-eval needed), X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy via `vercel.json`

## File Structure

```
bloom-marketplace/
├── index.html              Buyer marketplace shell (meta, styles, #root)
├── seller.html             Seller portal shell (meta, styles, #root)
├── vite.config.js          Multi-page Vite config
├── package.json            React, Supabase, QR as npm deps; Vite as dev dep
├── src/
│   ├── buyer/
│   │   ├── main.jsx        Entry point → renders App
│   │   ├── App.jsx         Router, cart state, page rendering
│   │   ├── components/
│   │   │   ├── Navbar.jsx, Hero.jsx, ProductCard.jsx, ProductsPage.jsx
│   │   │   ├── ProductDetail.jsx, CartPage.jsx, CheckoutPage.jsx
│   │   │   ├── OrderConfirmation.jsx, VendorsPage.jsx, HowItWorks.jsx
│   │   │   ├── AboutPage.jsx, ContactPage.jsx, NotFoundPage.jsx
│   │   │   ├── Footer.jsx, Toast.jsx, ShareButtons.jsx, Accordion.jsx
│   │   │   ├── RestockAlert.jsx, PromptPayQR.jsx, ErrorBoundary.jsx
│   │   ├── hooks/
│   │   │   ├── useLanguage.js, useDebounce.js
│   │   ├── lib/
│   │   │   ├── translations.js, priceUnits.js, analytics.js, share.js
│   ├── seller/
│   │   ├── main.jsx        Entry point → renders App
│   │   ├── App.jsx         Auth state, screen routing
│   │   ├── components/
│   │   │   ├── AuthScreen.jsx, ProfileSetup.jsx, CreateListing.jsx
│   │   │   ├── Dashboard.jsx, ImageUpload.jsx, ListingCard.jsx
│   │   │   ├── ErrorBoundary.jsx
│   │   │   ├── ui/ (Spinner, Button, Input, Select, Card, Alert, ChipSelect, ConfirmModal)
│   │   ├── hooks/
│   │   │   ├── useLanguage.js
│   │   ├── lib/
│   │   │   ├── translations.js, utils.js, priceUnits.js
│   ├── shared/
│   │   ├── supabase.js     Supabase client init
│   │   ├── theme.js        Colors, shadows
│   │   ├── hooks/
│   │   │   └── useIsMobile.js
│   │   ├── components/
│   │   │   └── Confetti.jsx
├── public/
│   ├── chatbot.js          Floating chat widget (IIFE, zero deps)
│   ├── sw.js               Service worker v8
│   ├── payment-qr.png, icon-512.png, robots.txt, sitemap.xml
├── api/
│   └── chat.js             Vercel serverless: Gemini API, rate limiting, CORS
├── vercel.json             Vercel config: maxDuration, security headers
├── manifest.json           PWA manifest
├── supabase-setup.sql      Full DB schema, RLS policies, indexes
├── supabase/
│   └── functions/
│       └── notify-order/
│           └── index.ts    Edge Function for order email notifications
├── favicon.svg, icon-192.png
└── .gitignore
```

## Development

```bash
npm run dev      # Start Vite dev server (hot reload)
npm run build    # Production build → dist/
npm run preview  # Preview production build locally
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
| `GEMINI_API_KEY` | Vercel Environment Variables | Google Generative AI key for chatbot. Already set. Do NOT change unless rotating. Model `gemini-2.5-flash` stable through June 2026. |

The Supabase anon key is in `src/shared/supabase.js` (public by design,
protected by Row Level Security). Not a secret.

## Supabase Schema

Project: `bqglrepbhjxmbgggdqal` in Supabase.

Key tables (all have RLS policies):
- `listings` — id, seller_id, title, description, price, price_unit, category (clones/seeds/buds), images (JSONB), quantity_available, is_available, growing_method, location
- `orders` — id, seller_id, items (JSONB), total, customer_name, customer_phone, address, district, province, postal_code, payment_method, payment_proof_url, status, delivery_notes
- `profiles` — id (FK to auth.users), display_name, farm_name, location, phone, promptpay_id, avatar_url

Storage buckets:
- `payment-proofs` — Customer payment proof uploads
- `listing-images` — Product listing images
- `avatars` — Seller profile avatars

## Key Design Decisions

### Vite build step — JSX compiled at build time
Migrated from Babel Standalone (3MB in-browser compiler) to Vite. Benefits:
no more unsafe-eval in CSP, 2-4s faster page load, ~217KB gzipped total
bundle (was 3MB+ with Babel). Vercel auto-detects Vite and runs the build.

### Hash routing instead of file-based routing
Buyer SPA uses hash-based routing. Hash changes (`#products`, `#cart`,
`#checkout`) trigger React state updates. The `renderPage()` switch in
`src/buyer/App.jsx` handles routing. Invalid hashes show a 404 page.

### Price units are category-aware with legacy fallbacks
`getPriceUnitLabel(priceUnit, t, category)` in `src/buyer/lib/priceUnits.js`
handles both new listings (explicit `price_unit` field) and legacy listings
(`null` price_unit, falls back based on category).

### CORS restricted to production domains
`api/chat.js` checks the Origin header against an allowlist:
`siamclones.com`, `www.siamclones.com`, `bloom-marketplace.vercel.app`.

### Service worker: network-only for HTML, SWR for assets
HTML pages always fetch from network. Static assets use SWR. SW v8 uses
`skipWaiting()` + `clients.claim()` + force-navigate on activate.

### Product card images use 4:3 aspect ratio
Uses `aspectRatio: '4 / 3'` with `objectFit: 'cover'` so images fill the
full card width without white gaps.

## Chatbot Architecture

Two pieces:
1. `public/chatbot.js` — Self-contained IIFE widget injected via `<script>` tag
   on both pages. Zero dependencies. NOT processed by Vite.
2. `api/chat.js` — Vercel serverless function. Receives `{messages: [...]}`,
   forwards to Gemini 2.5 Flash with inlined system prompt, returns `{text: "..."}`.
   Rate limited to 20 req/min per IP.

## What's Done

### Security
- XSS fixed (React state-based rendering, no innerHTML)
- Supabase RLS on all tables
- CORS restricted to production domains
- Rate limiting on chatbot API (20/min/IP)
- Input sanitization on checkout fields
- CSP (no unsafe-eval) + security headers via `vercel.json`
- Atomic order placement via `place_order_atomic` RPC (prevents overselling)

### Features
- Full bilingual EN/TH (150+ translation keys, both portals)
- 404 page for invalid hash routes (bilingual)
- Double-submit prevention on checkout
- Chatbot safety-block handling with friendly fallback messages
- PromptPay QR code generation (EMVCo-compliant)
- Product card images: 4:3 aspect ratio, full-width
- Order cancellation, search, CSV export on seller portal
- Drag-and-drop proof upload for PromptPay
- Price filter cross-validation
- Service worker auto-update with controllerchange reload

### SEO
- Schema.org (WebSite, Organization, Store)
- Open Graph + Twitter Card meta tags
- robots.txt + sitemap.xml
- Google site verification

## Dangerous Patterns to Avoid

- **NEVER** add `type: module` to vercel.json or convert api/chat.js to ESM — Vercel serverless functions use CommonJS
- **NEVER** use `require()` in api/chat.js to import local files — Vercel bundling won't resolve them
- **NEVER** add a `runtime` field to vercel.json — this caused a Vercel build failure previously
- **NEVER** set `Access-Control-Allow-Origin: *` on the chatbot API — use the allowlist in api/chat.js
- **NEVER** process chatbot.js through Vite — it's a standalone IIFE in `public/`
- **NEVER** move `api/` directory — Vercel requires it at the project root

## Deployment

GitHub repo: `TegridyRepoRanch/bloom-marketplace` (main branch)
Vercel auto-deploys on push. Runs `npm run build` (Vite), deploys `dist/`.

After pushing:
1. Check Vercel dashboard for "Ready" status
2. Hard refresh the site once to pick up new SW
3. Test buyer flow: home → products → add to cart → checkout
4. Test seller portal: login → dashboard → listings → orders
5. Test chatbot: open bubble → ask question → verify response

## Testing Checklist (Quick)

- [ ] Homepage loads, zero console errors
- [ ] Products page: cards have full-width images, search works
- [ ] Add to cart → cart page → checkout form validates
- [ ] Language toggle EN↔TH works everywhere
- [ ] 404 page shows for `#nonexistent`
- [ ] Chatbot responds in English and Thai
- [ ] `GET /api/chat` returns `{status: "ok", configured: true}`
- [ ] Seller portal: dashboard, listings, orders, analytics load
- [ ] Security headers present (check with fetch HEAD)
