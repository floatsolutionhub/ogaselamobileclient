# Ogasela

An ad-listing marketplace mobile app built with Expo, Expo Router, and NativeWind (Tailwind CSS), wired to the real `Ogasela.API` backend.

## Stack

- **Expo SDK 57** + **Expo Router** (file-based navigation, form-sheet modals, guest-friendly protected tabs)
- **NativeWind v4** + **Tailwind CSS** for styling
- **Formik** + **Yup** for forms and validation
- **moment** for relative/human-friendly time formatting
- **lucide-react-native** for icons
- **react-native-toast-message** for toasts
- **expo-secure-store** for the access/refresh token pair
- **expo-image-picker** for listing/verification photo selection
- **expo-web-browser** for hosted payment-gateway checkout
- **@microsoft/signalr** for live message delivery
- **react-native-reanimated** for the animated splash screen
- **Poppins** (via `@expo-google-fonts/poppins`) as the app-wide font

## Getting started

```bash
npm install
npm run ios      # or npm run android / npm run web
```

Copy `.env.example` to `.env` to customize:

```
EXPO_PUBLIC_AUTO_LOGOUT_MINUTES=15
EXPO_PUBLIC_GOOGLE_CLIENT_ID=
EXPO_PUBLIC_FACEBOOK_APP_ID=
EXPO_PUBLIC_API_URL=http://localhost:8080/api/v1
```

`EXPO_PUBLIC_API_URL` must point at a running `Ogasela.API` instance, including the `/api/v1` prefix. `localhost` works for the iOS simulator and Expo web; an Android emulator can't resolve the host machine's `localhost` - use `http://10.0.2.2:8080/api/v1` there instead. Point it at a real deployed URL for device/production builds.

## App structure

```
app/
  _layout.tsx              root providers (fonts, Auth/Favourites/Location, Toast) + modal Stack.Screen config
  index.tsx                 animated splash screen, redirects to Home
  search.tsx                 full-screen search + results (real /search)
  (modals)/                  sign-in, sign-in-phone (phone+password), sign-up (2 steps, collects a
                              business name since every account registers as a Seller), verify-otp
                              (password-reset step), forgot-password, location-picker (real
                              states/cities), conversation (a single chat thread) — plus terms/privacy
  (app)/                     tab group — Home, Favourites, Post, Messages, Profile.
                              Home is guest-accessible; the other 4 tabs open the
                              sign-in sheet for guests (see (app)/_layout.tsx)
src/
  components/                 shared UI: buttons, cards, listing/category cards, form fields, logo
  context/                    AuthContext (real tokens + auto-logout), FavouritesContext (local-only,
                                see below), LocationContext (persists the user's chosen browsing city/state)
  data/                       mock categories/listings/locations - unused by the app now (kept in case
                                anything still references them), superseded by src/services + the real API
  services/                   one file per Ogasela.API controller - auth, me, listings, search,
                                messaging, verification, wallet, categories, promotionPlans, reviews,
                                notifications, ai, geo, adIntegrations
  lib/                        apiClient (fetch wrapper, JWT auth header, auto-refresh-on-401),
                                messagingHub (SignalR live message push)
  hooks/useProtectedRoute.ts  safety-net auth guard for protected tab screens
  utils/validation.ts         Yup schemas
  theme/colors.ts              brand color tokens shared with Tailwind config
```

## What's real vs. what's intentionally out of scope

Authentication, listings (browse/search/post/publish), messaging (REST + live SignalR push), seller
verification, wallet funding, reviews, notifications, and Nigeria state/city location picking are all
wired to the real backend - see `src/services/`, one file per `Ogasela.Api` controller.

A few things were deliberately left as-is rather than over-built in this pass:

- **Favourites stay local-only** (`AsyncStorage`, via `FavouritesContext`) - there's no backend Favorites
  domain. This is a reasonable v1 product choice, not a gap; revisit if server-synced favourites (e.g.
  across devices) become a requirement.
- **Google / Facebook sign-in buttons are still placeholders** that show an informational toast. Wire
  them up with `expo-auth-session` once you have real OAuth client IDs in `.env`.
- **Ad boosting (Facebook/TikTok) has a full service (`src/services/adIntegrations.ts`) but no UI.** The
  backend's OAuth `callback` route doesn't redirect back into the app (no deep link), so a native
  `connect` flow can't reliably detect completion the way a normal web OAuth redirect would. Needs a
  backend change (a deep-link redirect at the end of the callback) before it's worth building the UI.
  Everything else on that controller (promote/pause/resume/end/ad-performance) is a plain JSON API and
  works fine from mobile once you get there.
- **Push notifications**: `me.setPushToken()` exists and the backend can store/deliver via FCM, but no
  screen calls `expo-notifications`' device-token retrieval or requests notification permission yet -
  this needs a physical device (or a real dev-client build) to verify, which wasn't available in the
  environment this was built in.
- **Post a listing has no promotion-plan picker** - it creates a Draft with `promotionPlanId: null`.
  `listings.update()` can attach a plan later; add a plan-choice step to `post.tsx` (using
  `promotionPlans.getPromotionPlans()`) when you want sellers to pick one at creation time.
- **Profile's "Security & privacy" / "Notifications" / "Help & support" menu items** show a "Coming
  soon" toast rather than doing nothing - real destinations (e.g. a notification-preferences screen
  backed by `notifications.updatePreferences()`) are a natural next step.

## Auth flow (real, not mocked)

Registration is a single `POST /auth/register` call - every account registers as a Seller (a
`businessName` field was added to sign-up step 2 for this reason; the backend requires a
`SellerProfile` to exist before anyone can post a listing, and there's no later "upgrade to seller"
endpoint). There is no passwordless OTP login - `sign-in-phone` is phone+password through the same
`/auth/login` endpoint `sign-in` (email+password) uses. `otp/request`/`otp/verify` back the
password-reset flow only (`forgot-password` → `verify-otp`, now repurposed to collect a new password
alongside the code → real sign-in with the new password) - there's no email reset-link flow.

Tokens (access + refresh) are stored via `expo-secure-store`; a 401 from any API call triggers one
silent refresh-and-retry (`src/lib/apiClient.ts` + `AuthContext`) before falling back to logging the
user out.

- **App icons**: `assets/icon.png`, `assets/splash-icon.png`, `assets/android-icon-foreground.png` and `assets/favicon.png` were generated from `assets/ogasela-icon.png` (340×340) via `sips`, so they're a little soft at large sizes. Re-export a 1024×1024 master and regenerate these if you have one. `assets/android-icon-monochrome.png` still needs proper single-color artwork for Android 13+ themed icons.
- **Auto logout**: configurable via `EXPO_PUBLIC_AUTO_LOGOUT_MINUTES`. Implemented in `AuthContext` — logs the user out after that many minutes of no interaction (touch) or time spent backgrounded.
