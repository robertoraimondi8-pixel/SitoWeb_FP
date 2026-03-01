# FantaPronostic - PRD & Progress

## Original Problem Statement
Build an admin panel and a React Native mobile app for FantaPronostic, a fantasy football predictions platform. The app has evolved into a premium UI/UX product with a "Premium Balanced" design system featuring light gray backgrounds, dark navy cards, orange accents, and animated visual effects.

## Architecture
- **Backend**: FastAPI (Python) + MongoDB
- **Frontend**: Expo/React Native (TypeScript)
- **3rd Party**: API-Football, Expo Push, APScheduler, expo-linear-gradient, react-native-reanimated
- **Auth**: JWT + Google OAuth (Emergent-managed)

## Design System
- Light gray background (#F5F6F8 → #ECEFF3 gradient)
- Dark navy cards (#14263D, #1A2F4D → #0E1A2B gradients)
- Orange accent (#F5A623) borders on all cards
- AnimatedSweep component on all dark navy cards
- White text on dark cards, dark text on gray headers
- Tab bar: dark navy (#0E1A2B) background

## What's Been Implemented

### Completed (Mar 2026)
- [x] HomeScreen with premium dark navy theme, AnimatedSweep, white sweep effect
- [x] Rankings screen with dark theme + AnimatedSweep
- [x] Predictions screen with dark navy match cards + AnimatedSweep + fixed text colors
- [x] Statistics screen with dark theme elements + AnimatedSweep import
- [x] Profile screen with dark user card + AnimatedSweep
- [x] Live screen rewritten with dark navy theme + AnimatedSweep + overlap fix
- [x] User Predictions screen rewritten with dark navy theme + AnimatedSweep + overlap fix
- [x] User Detail screen rewritten with dark navy theme
- [x] League List screen rewritten with dark navy theme
- [x] League Create/Join/Join-Private screens converted to design system
- [x] League Manage screen converted to design system
- [x] Admin Console screens converted to design system
- [x] Onboarding screen converted with dark navy path cards
- [x] Auth Callback screen converted to design system
- [x] Tab bar converted to dark navy (#0E1A2B) with orange active tint
- [x] Team name overlap bug fix (flex: 1 + flexShrink: 1 on teamCol, fixed width scoreCol)
- [x] All `useTheme` references removed except Profile (needed for dark mode toggle)

### Testing Status
- Backend: 21/21 API tests pass (iteration_63)
- Frontend: Visual changes require user testing on device

## Prioritized Backlog

### P0 (Critical)
- None currently

### P1 (High)
- [ ] Activate Push Notifications (PUSH_NOTIFICATIONS_ENABLED=True)
- [ ] Integrate email service for password resets

### P2 (Medium)
- [ ] Design and implement "Achievements/Badges" system
- [ ] Remove dead code related to "jolly" feature
- [ ] Implement "Championship Winner Predictions" feature
- [ ] Integrate Stripe for joining the National League

### P3 (Low)
- [ ] Componentize large files (rankings.tsx, HomeScreen.tsx)
- [ ] File cleanup/deduplication

## Credentials
- Admin: admin@fantapronostic.com / admin123
- User: ilio@raimondi.it / password123
