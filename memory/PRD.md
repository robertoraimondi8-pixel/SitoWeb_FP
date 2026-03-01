# FantaPronostic - PRD & Progress

## Original Problem Statement
Build an admin panel and a React Native mobile app for FantaPronostic, a fantasy football predictions platform. The app has evolved into a premium UI/UX product with an official **Brand Color System v5**.

## Architecture
- **Backend**: FastAPI (Python) + MongoDB
- **Frontend**: Expo/React Native (TypeScript)
- **3rd Party**: API-Football, Expo Push, APScheduler, expo-linear-gradient, react-native-reanimated
- **Auth**: JWT + Google OAuth (Emergent-managed)

## Brand Color System v5 (Official)

### Primary Brand Colors
| Color | HEX | Usage |
|-------|-----|-------|
| Logo Blue | `#1F4C8F` | Card principali, elementi premium |
| Deep Blue | `#162F5C` | Gradienti basso, hover, profondita |
| Primary Orange | `#F5A623` | CTA, bottoni, punteggi |
| Dark Orange | `#E18B00` | Ombra bottoni, pressed |

### Support Colors
| Color | HEX | Usage |
|-------|-----|-------|
| Success Green | `#2ECC71` | +1.0, check verde, LIVE |
| Error Red | `#E74C3C` | Pronostico errato, alert |

### Neutral System
| Color | HEX | Usage |
|-------|-----|-------|
| Warm Background | `#F5F6F8` | Base app chiara |
| Light Gradient | `#ECEFF3` | Sfondi dinamici |
| Text Primary | `#2C3E50` | Testo su fondo chiaro |
| White Pure | `#FFFFFF` | Testo su blu |

### Official Gradients
- **Card Premium**: `['#2C5FA8', '#1F4C8F', '#162F5C']`
- **CTA**: `['#F8B13A', '#F5A623', '#E18B00']`
- **Background**: `['#F5F6F8', '#ECEFF3']`

### Radius System
- Card principali: 22
- Bottoni: 18
- Badge piccoli: 12
- Cerchi icone: 20

## What's Been Implemented

### Completed (Mar 2026 - Latest Session)
- [x] **Brand Color System v5** — Full official brand colors applied across entire app
- [x] **designSystem.ts** — Central source of truth with brandGradients export
- [x] **Tab screens**: HomeScreen, Rankings, Predictions, Statistics, Profile — all brand blue
- [x] **Sub-screens**: Live, User-Predictions, User-Detail — brand blue cards + overlap fix
- [x] **League screens**: List, Create, Join, Join-Private, Manage — brand blue
- [x] **Menu screens**: Invites, Language, Members, My-Leagues, News, Notifications, Profile-Edit, Rules — all brand blue cards with CTA gradient buttons
- [x] **Tab bar**: Deep Blue (#162F5C) background, orange active tint
- [x] **Profile**: Section cards converted to brand blue, language options styled for dark bg
- [x] **Admin screens**: Console + League admin converted from useTheme to design system
- [x] **Onboarding**: Path cards converted to brand blue
- [x] **AnimatedSweep**: On all premium dark cards across the app
- [x] **Team name overlap fix**: Robust flex constraints in predictions screens
- [x] **ThemeContext alignment**: theme/index.ts colors synced with brand v5
- [x] All `useTheme` removed except Profile (needed for dark mode toggle)

### Testing Status
- Backend iteration_63: 21/21 pass
- Backend iteration_64: 22/22 pass (post brand color system)
- Frontend: Visual changes require user testing on device

## Prioritized Backlog

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
- League Owner: test@raimondi.it / password
