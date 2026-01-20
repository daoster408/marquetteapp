# Marquette Method Fertility Tracker - Project Plan

## Overview
A Catholic-aligned fertility tracking app implementing the Marquette Method of Natural Family Planning. Built with React Native for cross-platform (iOS/Android) support.

---

## Tech Stack
- **Framework**: React Native + Expo (TypeScript)
- **Storage**: AsyncStorage (local only for MVP)
- **State Management**: Zustand with persist middleware
- **Navigation**: React Navigation (bottom tabs + stack)
- **UI Library**: React Native Paper
- **Build**: EAS Build (Expo Application Services)

---

## Phase 1: MVP

### Marquette Algorithm (Regular Cycles)

#### Cycle Start
- CD1: User presses "New Cycle" button (saves previous cycle to history)
- CD1-5: Period days

#### Fertility Window Opening
- **First 6 cycles**: Fertility begins on CD6
- **After 6 cycles**: Fertility begins on the EARLIEST of:
  - First High reading, OR
  - (Earliest Peak in last 6 cycles) - 6 days
- **Optional setting**: "Conservative mode" (always start fertility on CD6)

#### Testing
- Begin testing on CD6 (or when monitor prompts)
- Record daily: Low / High / Peak / No Test

#### Peak & Fertile Window Closing
1. On Peak reading: Stop testing
2. Next day: Auto-record as 2nd Peak (no test needed)
3. Count 3 full days (72 hours) after 2nd Peak
4. Following day: Fertile window CLOSED (first safe day)

**Example:**
- CD14: Peak recorded → stop testing
- CD15: Auto-record Peak (2nd Peak)
- CD16, 17, 18: Count 3 days (abstain if postponing)
- CD19: First infertile/safe day

#### No Peak by CD25
- Monitor can only test 20 days (CD6-CD25)
- After CD25: Monitor always shows Low regardless of hormones
- App alerts user to reset monitor
- Reset monitor and set to "CD4" (minimizes wait time)
- Resume testing on real CD28 (monitor's "CD6")
- If Peak appears: Apply normal Peak rules
- If no Peak and period comes: End cycle, start fresh

### MVP Features
1. **Cycle Management** - Start new cycle, save/view history
2. **Daily Logging** - Monitor readings (Low/High/Peak/No Test), optional notes, intercourse
3. **Dashboard** - Current cycle day, fertility status, countdown to fertile window end
4. **Calendar View** - Color-coded monthly view (green=infertile, red/orange=fertile, blue=period)
5. **Cycle History** - Past cycles list, Peak days recorded
6. **Alerts** - CD25 no-Peak warning, reset guidance
7. **Settings** - Conservative mode toggle

### Data Model Requirements
- Track Peak day for every cycle
- Rolling 6-cycle lookback for earliest Peak calculation
- Preserve all cycle history for viewing

---

## Phase 1.5: Analytics & Insights

Cycle analytics to help users understand their patterns:
- Average cycle length (with trend chart)
- Average Peak day
- Luteal phase length (Peak to period)
- Cycle length variation over time
- Visual charts/graphs of historical data

No AI - just data visualization from user's own history.

---

## Phase 2: AI Features

**Guiding Principle**: AI educates and flags. Algorithm determines. Instructors advise.

| Feature | AI Does | AI Does NOT Do |
|---------|---------|----------------|
| Chart Interpretation | Explain trends, what patterns mean | Determine fertility status |
| Anomaly Detection | Flag irregular patterns, suggest doctor/instructor | Diagnose conditions |
| Personalized Education | Teach biology, adapt to user level | Give situation-specific advice |

### Technical Approach
- On-device ML (TensorFlow Lite) for pattern detection - data stays private
- Optional: Claude API for educational content (with strict guardrails)
- Clear disclaimers: "Not medical advice. Consult your instructor."

### Explicit Exclusions
- No AI-based fertility determinations
- No spiritual direction from AI
- No replacement for certified Marquette instructors

---

## Phase 3: Future Features

- Cloud sync / user accounts
- Couples data sharing
- Instructor connectivity / chart sharing
- Breastfeeding protocol
- Perimenopause protocol
- Transition off hormones protocol
- Cervical mucus cross-check option
- Export/print charts

---

## Catholic Alignment (All Phases)

- Language: "achieve" or "postpone" pregnancy (never "prevent")
- No contraceptive terminology
- Respectful of marriage and family
- Links to official Marquette University resources
- Links to Church teaching resources

---

## Project Structure

```
/src
  /components     # Reusable UI components
  /screens        # Main app screens
  /store          # Zustand state management
  /utils          # Marquette algorithm logic (deterministic)
  /types          # TypeScript interfaces
  /constants      # Colors, Church-aligned strings
  /hooks          # Custom React hooks
```
