# Development Notes

## Project Structure

```
/app
  /src
    /components       # Reusable UI components (currently empty)
    /screens          # Main app screens
      - DashboardScreen.tsx
      - LogScreen.tsx
      - CalendarScreen.tsx
      - HistoryScreen.tsx
      - SettingsScreen.tsx
    /store            # Zustand state management
      - index.ts
    /utils            # Marquette algorithm logic
      - marquetteAlgorithm.ts
    /types            # TypeScript interfaces
      - index.ts
    /constants        # Colors, strings
      - index.ts
    /__tests__        # Unit tests (45 tests)
      - marquetteAlgorithm.test.ts
  App.tsx             # Navigation setup
  index.ts            # Entry point
  eas.json            # EAS Build configuration
```

---

## Key Algorithm Decisions

### Peak Detection & Fertile Window Closing

The Marquette Method follows this exact sequence:

1. User logs **Peak** reading → stop testing
2. Next day: **Auto-record 2nd Peak (P2)** - no test needed
3. Count **3 full days** after P2 (countdown days 1, 2, 3)
4. Day after countdown: **First infertile/safe day**

**Example:**
- CD14: Peak recorded (P)
- CD15: Auto-Peak (P2)
- CD16: Countdown day 1
- CD17: Countdown day 2
- CD18: Countdown day 3
- CD19: First safe/infertile day

### Fertility Window Opening

- **First 6 cycles**: Fertility begins on CD6 (conservative default)
- **After 6 cycles**: Fertility begins on the EARLIEST of:
  - First High reading in current cycle, OR
  - (Earliest Peak day in last 6 cycles) - 6 days
- **Conservative mode**: Always start fertility on CD6 regardless of history

### CD25 No-Peak Scenario

The Clearblue monitor can only test 20 days (CD6-CD25). After CD25, it always shows Low.

If no Peak by CD25:
1. App shows warning to reset monitor
2. Reset monitor and set to "CD4"
3. Resume testing on real CD28 (monitor's "CD6")
4. If Peak appears: apply normal Peak rules
5. If no Peak and period comes: end cycle, start fresh

---

## Technical Decisions & Bug Fixes

### Storage: AsyncStorage (not MMKV)
- MMKV is not compatible with Expo managed workflow
- Using `@react-native-async-storage/async-storage` with Zustand persist middleware
- Data persists across app restarts

### Date Picker
- Must use `<Button>` component, not `<Pressable>`
- `<Pressable>` doesn't trigger `onPress` correctly on Android in this context

### Calendar P2/Countdown Labels
- Labels (P, P2, 1, 2, 3) are calculated from `peakDay` position, not from `isAutoPeak` flag
- Logic in `getDayLabel()` function in CalendarScreen.tsx:
  ```typescript
  if (peakDay && cycleDay) {
    const daysAfterPeak = cycleDay - peakDay;
    if (daysAfterPeak === 0) return 'P';
    if (daysAfterPeak === 1) return 'P2';
    if (daysAfterPeak >= 2 && daysAfterPeak <= 4) return String(daysAfterPeak - 1);
  }
  ```

### Auto-Peak Recording
- When user logs Peak, the next day automatically gets Peak reading
- Handled in DashboardScreen.tsx via useEffect
- `isAutoPeak` flag marks auto-recorded entries

### Date Handling & Timezones (CRITICAL)
- **Problem**: `new Date(string)` parses YYYY-MM-DD as UTC, but displays in Local Time. This causes dates to shift back 1 day when viewed in Western timezones (e.g., "2025-12-02" becomes "Dec 1st 16:00 PST").
- **Solution**: We MUST avoid UTC conversions for cycle dates.
- **Implementation**:
  - `getTodayISO()`: Uses `now.getFullYear/Month/Date` (Local System Time).
  - `getCycleDay()`: Manually parses strings (`split('-')`) to create Date objects at Local 00:00:00.
  - `formatDate()`: Manually parses strings to ensure consistent display regardless of the user's timezone.
- **Rule**: Never use `new Date(isoString)` for display logic regarding cycle days.

---

## Developer & Testing Features

### Developer Tools Menu
- A "Developer Tools" section has been added to the `SettingsScreen`.
- This entire section is wrapped in a `__DEV__` flag, so it will not be present in production builds of the app.
- It contains tools for accelerating testing without waiting for real-world time to pass.

### Load Mock Cycles
- A "Load 7 Mock Cycles" button in the dev menu allows for instant testing of the post-6-cycle algorithm.
- Wipes existing data and injects 7 completed, realistic-looking cycles and 1 active cycle.
- The earliest Peak Day in the mock data is intentionally varied to allow for testing the lookback calculation (`earliest Peak - 6 days`).
- Implemented in `app/src/utils/mockData.ts` and triggered by `loadMockCycles` in the Zustand store.

### Import from CSV
- **Status**: Active (Hardcoded for Testing)
- **Goal**: Allows loading historical data from a local file to populate the app's history.
- **Implementation**:
  - A parser exists at `app/src/utils/importData.ts` that is built to handle **Tab-Separated Values (TSV)**.
  - The store action `importCyclesFromCSV` is implemented.
  - A button exists in the Developer Tools menu to trigger the import.
  - **Note**: The user's specific historical data (approx 1 year) has been hardcoded into `app/src/utils/devTools.ts` to facilitate testing via standalone APK builds without needing a file picker UI implementation yet.

---

## Running the App

### Development (with hot reload)
```bash
cd /Users/briandao/Documents/FERTILITY-APP/app
npx expo start
```
Scan QR code with Expo Go app.

### Standalone Build (no dev server needed)
```bash
npx eas build --profile preview --platform android
```
Download APK from https://expo.dev/accounts/daoster/projects/app/builds

### Run Tests
```bash
npm test
```

---

## Church-Aligned Language

All UI strings use Catholic-appropriate terminology:
- "achieve" or "postpone" pregnancy (never "prevent")
- No contraceptive terminology
- Settings includes links to:
  - Marquette University NFP resources
  - Humanae Vitae (Church teaching)

Strings are centralized in `src/constants/index.ts`.

---

## Data Model

### Cycle
```typescript
interface Cycle {
  id: string;
  startDate: string;        // ISO date (YYYY-MM-DD)
  endDate?: string;
  days: DayLog[];
  peakDay?: number;         // Cycle day of first Peak
  cycleLength?: number;
  isComplete: boolean;
}
```

### DayLog
```typescript
interface DayLog {
  date: string;             // ISO date
  cycleDay: number;
  reading: MonitorReading;  // 'low' | 'high' | 'peak' | 'none'
  notes?: string;
  isAutoPeak?: boolean;     // True if auto-recorded 2nd Peak
  isMonitorReset?: boolean; // True if monitor was reset
  intercourse?: boolean;    // True if intercourse was logged
}
```

### FertilityStatus
```typescript
type FertilityStatus = 'fertile' | 'infertile' | 'period' | 'waiting';
```

---

## Future Work

See CHECKLIST.md for detailed task tracking. Key items:
- iOS build (requires Apple Developer account)
- App icon and splash screen
- Notifications/reminders
- Cloud backup
- Additional protocols (breastfeeding, perimenopause)
- AI features (Phase 2)
