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
- [x] Write unit tests for algorithm and backup parsing (51 tests passing)

### Data Layer
- [x] Set up Zustand store
- [x] Implement cycle storage with AsyncStorage
- [x] Implement cycle history persistence
- [x] Implement Peak day tracking per cycle

### Screens & UI
- [x] Create app navigation structure
- [x] Build Dashboard screen (cycle day, fertility status, countdown)
- [x] Build Daily Logging screen (Low/High/Peak/No Test, notes)
- [x] Add intercourse logging (Log screen & Calendar view)
- [x] Add date picker for backfilling past logs
- [x] Build Calendar View screen (color-coded monthly view)
- [x] Add P, P2, 1, 2, 3 labels on calendar
- [x] Build Cycle History screen (past cycles list)
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
- [x] **Export/Import Exact Backup (JSON)**
- [x] **Bug Report & Feedback System**
- [x] **Import Historical Cycles (Manual Entry Wizard)**
- [x] **Delete Completed Cycles from History**
- [x] Import Raw CSV (Developer Tool only)
- [x] **EAS Update (OTA) Support Configured**

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
- [x] UI/UX polish pass (Icons, Calendar visibility, Date Picker)

---

## Phase 1.5: Analytics & Insights

- [x] Average cycle length calculation (in History screen)
- [x] Average Peak day calculation (in History screen)
- [x] Luteal phase length calculation
- [ ] Cycle length trend chart
- [ ] Historical data visualization
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

*   **Beta Status:** Stabilization branch in progress after local/GitHub checkpoint.
*   **Known Issues:** Adaptive icon might be slightly cropped on some Androids (Todo). Raw CSV import is developer-oriented; JSON backup is the reliable restore path.
*   **Next Priority:** Device-test backup export/import and the daily logging flow before merging stabilization work.
