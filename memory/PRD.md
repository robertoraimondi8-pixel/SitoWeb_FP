# FantaPronostic - Product Requirements Document

## Original Problem Statement
Build an admin panel and a React Native mobile app for FantaPronostic, a fantasy football prediction game. The project evolved into a major iterative UI/UX overhaul to achieve a "premium, top-tier product" feel across the entire mobile app.

## Tech Stack
- **Backend**: FastAPI + MongoDB
- **Frontend**: React Native (Expo) with Expo Router
- **3rd Party**: API-Football, Expo Push, APScheduler, expo-linear-gradient

## Design System: "Premium Balanced"
- **Background**: LinearGradient `['#F5F6F8', '#ECEFF3']` (subtle gray gradient)
- **Header backgrounds**: `#F3F4F6` (no white, no bottom borders)
- **Dark hero cards**: LinearGradient `['#1A2F4D', '#0E1A2B']` with overlay highlight
- **Card border radius**: 22px (`borderRadius.xl`)
- **Premium shadows**: Deep, diffuse (shadowOffset 6-12, shadowRadius 16-30)
- **Accent color**: `#F5A623` (orange)
- **No bottom borders on headers** - clean, modern look

## What's Been Implemented

### Core Features (Complete)
- User authentication (login, register, email verification)
- League system (create, join, manage leagues)
- Match predictions with multiple markets
- Real-time score updates via API-Football
- Rankings and leaderboard system
- Statistics dashboard with standings and fixtures
- Admin panel with user management
- Push notification infrastructure
- Multi-language support (IT/EN)

### UI/UX Overhaul (Complete - Mar 2026)
- **Home Screen**: Fully polished with LinearGradient bg, dark navy hero card, performance cards, CTA button, entry animations
- **Rankings Screen**: LinearGradient bg, gray headers, premium shadows, upgraded card styling
- **Predictions Screen**: LinearGradient bg, gray headers, premium match cards, dark navy value buttons
- **Profile Screen**: LinearGradient bg, dark navy gradient user card with white text, premium section cards
- **Statistics Screen**: LinearGradient bg, dark navy table headers and league chips, premium fixture cards
- **All Menu Screens** (8 screens): Gray headers, upgraded card radius and shadows
- **Auth Screens**: Premium shadow cards
- **Design System**: Updated `borderRadius.xl` to 22, consistent shadow properties

## Credentials
- **Admin**: admin@fantapronostic.com / admin123
- **User**: ilio@raimondi.it / password123
- **League Owner**: test@raimondi.it / password

## Pending / Backlog

### P1
- Activate Push Notifications (`PUSH_NOTIFICATIONS_ENABLED=True`)
- Integrate email service for password resets

### P2
- Achievements/Badges system
- Remove dead code ("jolly" feature)
- Championship Winner Predictions feature
- Stripe integration for National League

### Refactoring
- Extract Home Screen components (Hero Card, CTA Button, Performance Cards)
