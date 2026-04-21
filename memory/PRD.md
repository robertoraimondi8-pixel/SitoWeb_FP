# FantaPronostic — Product Requirements Document

## Original Problem Statement
Build a premium landing page for **fantapronostic.com** to promote the FantaPronostic mobile app (React Native / Expo). The site must communicate the product as a serious competitive football predictions platform between friends, NOT a betting site. Must drive app downloads and league creation.

**User preferred language**: Italiano (agents must respond in Italian).

**User context**:
- Owns domain `fantapronostic.com` on Squarespace
- Has a working mobile app (Expo) at `/app/frontend`
- Has working FastAPI backend at `/app/backend`
- Wants deploy via Vercel (simplest) + DNS on Squarespace

---

## Architecture

```
/app
├── backend/              # FastAPI (mobile app API, untouched in this session)
├── frontend/             # Expo React Native mobile app (untouched)
├── landing/              # NEW — Vite + React + TypeScript landing page
│   ├── src/
│   │   ├── components/   # Header, LanguageSwitcher
│   │   ├── sections/     # Hero, Marquee, ValueSection, HowItWorks, GameModes, TrustSection, PrivateLeagues, Markets, Rules, FAQ, Newsletter, Contact, FinalCTA, Footer
│   │   ├── i18n/         # IT/EN/ES translations
│   │   └── lib/cn.ts
│   ├── public/           # brand-icon.png, brand-logo-full.png, app-screen-predictions.jpg, app-screen-leaderboard.jpg, stadium.png
│   └── package.json
└── memory/
    └── PRD.md            # this file
```

**Supervisor**: `/etc/supervisor/conf.d/supervisord_landing.conf` runs `yarn dev` on port 3000 inside `/app/landing`. Original `expo` program stopped (mobile preview no longer needed in this pod per user's decision).

---

## Brand Identity

- **Primary Blue**: `#1E4FD8` (royal)
- **Primary Orange (CTA)**: `#F58220`
- **Yellow accent**: `#FFC107` (from logo ball)
- **Bg base**: `#FFFFFF`
- **Soft bg**: `#F6F9FE`
- **Ink (text)**: `#0B1833`
- Typography: Clash Display (display) + Manrope (body)

---

## What's been implemented (2026-04-21)

### Landing sections (in order)
1. **Header** — logo, nav (Come Funziona, Modalità, Leghe Private, Regolamento, FAQ), language switcher (IT/EN/ES), orange "Scarica l'App" CTA
2. **Hero** — "Il modo più **competitivo** di vivere il calcio." + real app screenshot in phone frame (visible on mobile + desktop)
3. **Marquee** — scrolling competitions (Serie A, Premier, La Liga, CL, EL, Bundesliga, Ligue 1, Coppa Italia, Mondiali, Europei)
4. **Value section** — "Più coinvolgente del fantacalcio. Più semplice di quanto pensi."
5. **How It Works** — "Inizia in meno di un minuto" + 3 steps (01/02/03 orange)
6. **Game Modes** — Tutti Contro Tutti / Modalità Campionato / Tornei. Clean cards, no icons/tags, 3 colored top bars
7. **Trust Section** — "Competizione trasparente. Regole chiare." + 6 feature bullets (2 with pulsing LIVE badge)
8. **Private Leagues** — 4 feature cards + CTA (no phone mockup, centered layout)
9. **Markets** — "Quattro mercati. Un solo obiettivo: vincere." (1X2, GG/NG, O/U, Risultato Esatto)
10. **Rules** — accordion 5 items
11. **FAQ** — accordion 6 items
12. **Newsletter** — deep blue section, orange CTA, App Store + Play Store badges (Coming Soon)
13. **Contact** — form (name/email/message) + email placeholder
14. **Final CTA** — "Pronto a iniziare?" + Scarica l'App
15. **Footer** — logo, tagline, 3 columns (Prodotto/Azienda/Legale), social icons, tricolore strip, Made in Italy

### i18n
- 3 languages fully translated: **Italiano** (default), **English**, **Español**
- Language detection via localStorage + browser
- Switcher in header (compact) + optional non-compact

### Real app screenshots integrated
- `/app-screen-predictions.jpg` — hero phone mockup (match predictions view)
- Previously `/app-screen-leaderboard.jpg` used in PrivateLeagues, now removed per user request

---

## Ready to deploy (pending user action)

**Deploy strategy**: Vercel (landing) + Squarespace DNS → fantapronostic.com
- Root Directory on Vercel: `landing`
- Framework: Vite
- Build: `yarn build` → `dist`

**Post-deploy auto-update workflow**: user clicks "Save to GitHub" in Emergent → Vercel auto-deploys within 1-2 min.

---

## Backlog (P0/P1/P2)

### Mobile app (carried over from previous session — DO NOT FORGET)
- **P0**: Fix Google OAuth `androidClientId`/`iosClientId` in `login.tsx`; update old flow in `index.tsx`
- **P0**: Fix logout crash in `profile.tsx` — replace `setTimeout` with `InteractionManager.runAfterInteractions`
- **P1**: Execute retroactive trophy backfill via `/api/admin/recalculate-trophies`
- **P2**: League/Tournament Champion trophies logic
- **P2**: Re-enable Championship Winner Predictions
- **P2**: Stripe payments

### Landing page (new items)
- **P1 (after Vercel deploy)**: Connect newsletter form to real backend (SendGrid/Resend) so emails are captured
- **P1 (after Vercel deploy)**: **Web signup integrated with mobile app** — POST to `/api/auth/register` so a user who registers on the site automatically has an app account with same credentials
- **P2**: Replace App Store / Play Store "Coming Soon" with real links when app is published
- **P2**: Add real social media links (Instagram/Twitter/YouTube) in footer when provided
- **P2**: Customer testimonials section (3 quotes) — high-converting addition for sports/social apps
- **P3**: Add legal pages (Privacy, Terms, Cookies) — currently placeholders

---

## Credentials / Config

- **Backend preview URL**: `https://fanta-auth-fix.preview.emergentagent.com`
- **Landing preview**: same URL (port 3000)
- **Test admin**: `admin@fantapronostic.com` / `admin123`
- **Test user**: `test@fantapronostic.com` / `Test1234!`

## Known NOT WORKING / MOCKED
- Newsletter form: **UI only** — submit shows success state, does NOT send to any backend yet. MOCKED.
- Contact form: **UI only** — same as above. MOCKED.
- App Store / Google Play badges: placeholder `cursor-not-allowed`, no real links yet.

Everything else on the landing is fully real HTML/CSS/React with real copy.
