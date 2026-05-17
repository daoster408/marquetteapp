# Marquette Method Fertility Tracker - Progress Checklist

## Phase 1: MVP

### Setup
- [x] Create PLAN.md
- [x] Create CHECKLIST.md
- [x] Initialize React Native Expo project (TypeScript)
- [x] Install dependencies (AsyncStorage, zustand, react-navigation, react-native-paper)
- [x] Set up project folder structure

### Marquette Algorithm
- [x] Define TypeScript types (Cycle, DayLog, MonitorReading, etc.)
- [x] Implement fertility window opening logic (first 6 cycles)
- [x] Implement fertility window opening logic (after 6 cycles - earliest Peak lookback)
- [x] Implement Peak detection and auto-2nd-Peak logic
- [x] Implement fertile window closing (Peak + 1 + 3 days)
- [x] Implement CD25 no-Peak detection and reset flow
- [x] Implement rolling 6-cycle lookback calculation
- [x] Write unit tests for algorithm, backup parsing, and cycle-store integrity (56 tests passing)

### Data Layer
- [x] Set up Zustand store
- [x] Implement cycle storage with AsyncStorage
- [x] Implement cycle history persistence
- [x] Implement Peak day tracking per cycle
- [x] Recalculate derived cycle fields from actual logs to prevent stale Peak data
- [x] Normalize imported backup data before restoring it

### Screens & UI
- [x] Create app navigation structure
- [x] Build Dashboard screen (cycle day, fertility status, countdown)
- [x] Build Daily Logging screen (Low/High/Peak/No Test, notes)
- [x] Add intercourse logging (Log screen & Calendar view)
- [x] Add date picker for backfilling past logs
- [x] Build Calendar View screen (color-coded monthly view)
- [x] Add P, P2, 1, 2, 3 labels on calendar
- [x] Build Cycle History screen (past cycles list)
- [x] Add Trends and Marquette-style Chart views to History
- [x] Build Settings screen (conservative mode toggle)
- [x] Build New Cycle flow (start cycle, save previous)

### Alerts & UX
- [x] Implement CD25 no-Peak warning
- [x] Implement monitor reset guidance
- [x] **Inclusive Language Review ("Low Fertility" vs "Infertile")**
- [x] **Goal Selection (TTC vs TTA Modes)**
- [x] Add helpful tooltips/explanations
- [x] **Daily Testing Reminders (Local Notifications)**

### Data Management & Beta Features
- [x] Add reset all data functionality
- [x] Confirmation dialog for destructive actions
- [x] **Export Data to CSV (Wide Format for Doctors)**
- [x] **Export Marquette-style Chart to PDF**
- [x] **Export/Import Exact Backup (JSON)**
- [x] **Bug Report & Feedback System**
- [x] **Import Historical Cycles (Manual Entry Wizard)**
- [x] **Delete Completed Cycles from History**
- [x] Block invalid same-day past cycles
- [x] Import Raw CSV (Developer Tool only)
- [x] **EAS Update (OTA) Support Configured**

### Cloud Sync Dogfood V1

- [x] Create cloud-sync branch `codex/cloud-sync-v1`
- [x] Add Android side-by-side dogfood variant (`Fidelis Dogfood`, `com.daoster.app.dogfood`)
- [x] Add Firebase config placeholders via Expo public env vars
- [x] Add Firebase Auth and Firestore dependencies
- [x] Add repository/data-access boundary under `src/services/cloudSync`
- [x] Keep Zustand as the screen-facing state layer
- [x] Add signed-out, workspace setup, invite join, and migration prompt screens
- [x] Add owner/member role helpers and UI controls
- [x] Add one-time invite code creation/join flow with hashed invite records
- [x] Add dogfood tester allowlist gate for Firebase Auth/Firestore writes
- [x] Sync cycles and shared app settings through Firestore after workspace setup
- [x] Keep notification permission/reminder time local per device
- [x] Update reminder copy to neutral text only
- [x] Preserve JSON backup, CSV export, and PDF export paths
- [x] Add Firestore Security Rules denying by default
- [x] Add Jest coverage for migration, role, and invite helpers
- [x] Deploy dogfood Firestore rules and verify owner/spouse invite join on real devices
- [ ] Run Firestore Security Rules tests in Firebase Emulator Suite
- [x] Add Google Sign-In app/repository implementation behind OAuth config gate
- [ ] Configure Google Sign-In OAuth client IDs/SHA fingerprints in Firebase/EAS
- [x] Add React Native AsyncStorage-backed Firebase Auth persistence
- [ ] Device-verify Firebase Auth persistence across app restarts and OTA updates
- [x] Rename user-facing "workspace" language to "family chart"
- [x] Add optional biometric/device-passcode app lock for local chart access
- [ ] Create new dogfood Play build with native app-lock module and Google OAuth redirect scheme
- [x] Fill Firebase Console values for dogfood project/app
- [x] Device-test two-account/two-phone join and shared sync with exported backup in hand
- [ ] Device-test explicit local-to-cloud migration on a fresh dogfood workspace

### Build & Deployment
- [x] Set up EAS Build
- [x] Create standalone Android APK (preview build)
- [ ] iOS build (requires Apple Developer account)
- [x] App icon and splash screen
- [ ] Refine adaptive icon (prevent cropping)

### Testing & Polish
- [ ] Test full cycle flow (CD1 through fertile window close)
- [x] Test no-Peak scenario (CD25 reset)
- [x] Test 6-cycle lookback after first 6 cycles
- [x] **Fix Date/Timezone bugs (LogScreen & CalendarScreen)**
- [x] **Fix Intercourse Logging persistence bug**
- [x] **Fix monitor reset recording on wrong selected date**
- [x] **Fix stale Peak data after editing a Peak log**
- [x] UI/UX polish pass (Icons, Calendar visibility, Date Picker)

---

## Phase 1.5: Analytics & Insights

- [x] Average cycle length calculation (in History screen)
- [x] Average Peak day calculation (in History screen)
- [x] Luteal phase length calculation
- [x] Cycle length trend chart
- [x] Historical data visualization
- [ ] **Implement smart reset warning (based on first actual test day)**
- [ ] Analytics screen UI

---

## Phase 2: AI Features

- [ ] Research on-device ML options (TensorFlow Lite)
- [ ] Define AI feature boundaries (what AI does/doesn't do)
- [ ] Implement chart interpretation helper
- [ ] Implement anomaly detection (flag irregular patterns)
- [ ] Implement personalized education system
- [ ] Add disclaimers and guardrails
- [ ] Test AI features thoroughly

---

## Phase 3: Future Features

- [ ] Cloud sync infrastructure (Supabase/Firebase)
- [ ] User accounts/authentication
- [ ] Couples sharing feature
- [ ] Instructor connectivity
- [ ] **Implement photo storage for daily logs (Test sticks)**
- [ ] Breastfeeding protocol
- [ ] Perimenopause protocol
- [ ] Transition off hormones protocol
- [ ] Mucus cross-check option
- [ ] Chart export/print functionality

---

## Notes

*   **Beta Status:** Stabilization, backup, history, PDF export, and cycle data integrity fixes are merged to `main` and published to the `preview` OTA channel.
*   **Cloud Dogfood Status:** Cloud sync v1 is implemented on `codex/cloud-sync-v1` for Android dogfood builds only. Stable `com.daoster.app` remains configured as the default package.
*   **Known Issues:** Adaptive icon might be slightly cropped on some Androids (Todo). Raw CSV import is developer-oriented; JSON backup is the reliable restore path. Google Sign-In still needs Firebase Console OAuth client IDs/SHA setup before the button enables. Auth persistence now uses React Native AsyncStorage and needs device verification through app restarts/OTA reloads. App lock uses a native Expo module, so it needs a new dogfood build and should not be shipped by OTA alone.
*   **Dogfood Access:** Hardened dogfood builds now require approved testers in Firestore `dogfoodAllowedUsers/{firebase-auth-uid}` or `dogfoodAllowedEmails/{exact-auth-email}` docs with `enabled: true`; `EXPO_PUBLIC_DOGFOOD_ALLOWED_EMAILS` can also be set as an extra client-side gate.
*   **Dogfood Language:** Backend/data model names stay stable for now (`couples`, workspace-oriented repository names); user-facing copy now says "family chart."
*   **Google OAuth Setup:** Use Firebase project `fidelis-dogfood`, Android app id `1:1054762540951:android:e70c43a2b8f9cb852b2ed2`, and package `com.daoster.app.dogfood`. Add the Play App signing SHA-1/SHA-256 fingerprints, enable Google Auth, then set `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in the EAS `preview` environment.
*   **Next Priority:** Create a new dogfood Play build for the native redirect scheme and app-lock module, device-verify Google Sign-In/app lock/auth persistence, then add emulator rules tests for invite/owner/member paths.
