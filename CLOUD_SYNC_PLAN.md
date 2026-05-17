# Cloud Sync Plan

## Summary

This document is the implementation reference for the first shared-couple version of Fidelis. `PLAN.md` remains the broad product roadmap; this file describes the v1 architecture for cloud sync, roles, security, notifications, and intentionally deferred features.

The goal is to let two separate phones, owned by spouses, see and edit the same chart data without turning the app into a complex collaboration platform or custom cryptography project.

## Current State

The app is currently local-only:

- Cycle data is stored in a Zustand store persisted to `AsyncStorage`.
- The local store owns `cycles`, `currentCycleId`, and `settings`.
- Screens read and write through `useCycleStore`.
- Algorithm utilities are deterministic and local.
- Backup/export already exists through JSON backup, CSV export, and PDF chart export.
- Daily reminders already use local Expo notifications.
- There is no authentication, remote database, shared workspace, cloud sync, roles, or server-side notification system.

This means the current app has a simple privacy property: there is no backend copy of health data. The cloud sync version changes that, so it needs a clear identity, authorization, and data-access boundary.

## V1 Goal

V1 shared sync should support:

- Two separate authenticated user accounts.
- One shared couple workspace.
- `owner` and `member` roles only.
- Firebase Auth for identity.
- Firestore for shared chart storage and realtime sync.
- One-time invite codes for spouse onboarding.
- Local-only daily reminders on each device.
- A first security layer based on Firebase Auth, Firestore Security Rules, privacy hygiene, and account/workspace controls.

V1 should not include:

- Full end-to-end encryption.
- Photo storage.
- Instructor sharing.
- Remote spouse-update push notifications.
- Viewer/admin/instructor roles.
- Server-side fertility calculations.

## Proposed Firestore Shape

```text
users/{uid}
couples/{coupleId}
couples/{coupleId}/members/{uid}
couples/{coupleId}/inviteCodes/{codeId}
couples/{coupleId}/cycles/{cycleId}
couples/{coupleId}/settings/app
```

### `users/{uid}`

Stores non-health account metadata needed by the app.

Suggested fields:

```text
uid
displayName
email
photoURL
createdAt
lastSignedInAt
activeCoupleId
```

Avoid storing chart data here. The shared chart belongs to the couple workspace.

### `couples/{coupleId}`

Represents the shared private workspace.

Suggested fields:

```text
createdAt
createdBy
updatedAt
updatedBy
deletedAt?
```

The couple document should not need sensitive chart details. Use it as the workspace root and metadata record.

### `couples/{coupleId}/members/{uid}`

Authorizes a Firebase user to access the couple workspace.

Suggested fields:

```text
uid
role: "owner" | "member"
joinedAt
invitedBy?
removedAt?
```

Security rules should treat active membership as the primary access check.

### `couples/{coupleId}/inviteCodes/{codeId}`

Stores owner-created, one-time spouse invite codes.

Suggested fields:

```text
codeHash
createdAt
createdBy
expiresAt
usedAt?
usedBy?
```

Prefer storing a hash of the invite code rather than the raw code. The app can show the raw code once to the owner when created.

### `couples/{coupleId}/cycles/{cycleId}`

Stores shared cycle records.

This should be shaped around the existing `Cycle` type, plus sync metadata:

```text
id
startDate
endDate?
days
peakDay?
cycleLength?
lutealPhaseLength?
isComplete
createdAt
createdBy
updatedAt
updatedBy
```

For v1, keep the nested `days` array unless Firestore document size or merge conflicts become a real problem. If per-day collaboration becomes painful, move to `cycles/{cycleId}/days/{date}` later.

### `couples/{coupleId}/settings/app`

Stores settings shared by both spouses.

Suggested shared fields:

```text
conservativeMode
intention
updatedAt
updatedBy
```

Reminder settings should remain local per device, because each spouse may want a different reminder time and notification permission state.

## Roles

V1 has exactly two roles.

### Owner

An `owner` can:

- View and edit shared chart data.
- Start and complete cycles.
- Edit logs, notes, bleeding, monitor readings, and intercourse entries.
- Generate spouse invite codes.
- Remove members.
- Delete the shared workspace.
- Export shared data.

The first user who creates the couple workspace becomes the initial owner.

### Member

A `member` can:

- View and edit shared chart data.
- Start and complete cycles.
- Edit logs, notes, bleeding, monitor readings, and intercourse entries.
- Export shared data.

A `member` cannot:

- Generate invite codes.
- Remove members.
- Delete the shared workspace.

### Roles Deferred From V1

Do not add these roles in v1:

- Instructor.
- Viewer.
- Admin.
- Gendered husband/wife permissions.

Instructor sharing remains handled by intentional CSV/PDF export.

## Security Posture

V1 uses Firebase's standard security model rather than full app-layer encryption.

### Required Rules

Firestore Security Rules should:

- Deny all reads and writes by default.
- Require `request.auth.uid` for every cloud data access.
- Allow couple data reads/writes only when `request.auth.uid` is an active member of that `coupleId`.
- Allow invite-code creation only for active owners.
- Allow member removal and workspace deletion only for active owners.
- Prevent members from escalating their own role to owner.
- Prevent users from accessing any other couple workspace.

Rules should be tested with both allowed and denied examples before device testing with real data.

### Privacy Hygiene

Do not write health details to:

- Analytics events.
- Crash reports.
- Console logs.
- Bug-report email templates.
- Notification payloads.
- Invite-code records.
- User profile records.

Health details include:

- Monitor readings.
- Fertility status.
- Cycle dates.
- Bleeding entries.
- Notes.
- Intercourse entries.
- Peak day or countdown status.

Exported backups, CSVs, and PDFs remain intentional user-controlled sharing paths. The app should make it clear that exported files live outside the app's access controls.

### Delete And Removal Controls

V1 should include or explicitly schedule:

- Remove spouse/member access.
- Delete shared workspace data.
- Sign out.
- Preserve local JSON backup/export.

When a member is removed, Firestore rules should immediately block future access. V1 does not promise cryptographic revocation of data already synced to that person's device.

## End-to-End Encryption Decision

Full end-to-end encryption is deferred for v1.

This is not because the data is unimportant. Cycle history, fertility timing, notes, bleeding data, and intercourse logs are sensitive. However, full E2EE adds difficult product and recovery questions:

- How does the spouse's device receive the couple encryption key?
- How does a replacement phone join?
- What happens if both phones are lost?
- Can data be recovered?
- What does member removal mean for old data already decrypted on a removed device?
- How are encrypted backups handled?
- How are photos handled later?
- How much server functionality is lost?

For v1, the better tradeoff is:

- Strong Firebase Auth and Firestore Security Rules.
- Minimal data exposure outside Firestore.
- No health data in logs, analytics, bug reports, or notifications.
- A clean repository/data-access layer so app-layer field encryption can be added later.

Future encryption should be considered first for:

- Free-text notes.
- Photos.
- Any future instructor-sharing feature.

## Notifications

V1 notifications are local reminders only.

Each device should:

- Ask for notification permission locally.
- Store its own local reminder preference and reminder time.
- Schedule its own daily reminder.
- Cancel or reschedule its own reminder when settings change.

Reminder copy should stay neutral:

```text
Fidelis
Time to log today.
```

Do not include:

- Reading values.
- Fertility status.
- Cycle day.
- Peak or countdown status.
- Spouse activity.
- Intercourse or notes.

Remote spouse-update push notifications are deferred. If added later, they should also use neutral copy such as "There is an update in your shared chart."

## Data Access Architecture

The main code architecture change is that `src/store/index.ts` should stop being the database boundary.

Recommended shape:

```text
React Native screens
  -> Zustand store / app state
    -> cycleRepository interface
      -> Firestore implementation
      -> local implementation for migration/tests
```

The repository should own:

- Subscribing to shared cycles/settings.
- Writing cycle changes to Firestore.
- Creating workspaces.
- Joining workspaces.
- Updating member records.
- Running migration from local data.

The Zustand store should own:

- Current hydrated app state.
- Loading/error state.
- Calling repository methods.
- Exposing screen-friendly actions.

Algorithm utilities should remain pure and local. Firestore should store chart data; fertility calculations can continue to happen in the app.

## Migration From Local Data

Existing users may already have real local data in `AsyncStorage`.

Migration flow:

1. User signs in.
2. App detects local cycles that have not been uploaded.
3. User creates a couple workspace or joins an existing one.
4. If creating a workspace, app offers to upload local cycles/settings.
5. Uploaded records receive `createdAt`, `createdBy`, `updatedAt`, and `updatedBy`.
6. App marks migration complete locally.
7. App subscribes to Firestore as source of truth.

Do not silently overwrite an existing cloud workspace with local data. If a signed-in user already has cloud data and local data, show a deliberate import/merge choice.

## Conflict Behavior

For v1, use last-write-wins at the record level with metadata:

```text
updatedAt
updatedBy
```

This is acceptable for a two-person app if the UI refreshes quickly and records are small.

Important cases:

- If both spouses edit the same day, the latest saved version wins.
- If both spouses edit different days in the same cycle, nested-array writes may still conflict because the whole cycle document changes.
- If this becomes annoying, move daily logs to `cycles/{cycleId}/days/{date}` in a later iteration.

## Implementation Phases

1. Add Firebase project/config and Auth providers.
   - Configure Firebase Auth.
   - Configure Google sign-in.
   - Configure Sign in with Apple for iOS.
   - Add required Expo/EAS config and native credentials.

2. Add auth/session UI.
   - Signed-out screen.
   - Sign-in buttons.
   - Session loading state.
   - Sign out.

3. Add couple workspace creation.
   - First signed-in user can create a workspace.
   - Creator becomes `owner`.
   - Store active couple ID for the user.

4. Add invite-code join flow.
   - Owner generates a short expiring code.
   - Spouse signs in and enters the code.
   - Spouse becomes `member`.
   - Code is marked used or expires.

5. Add Firestore repository layer.
   - Implement read subscriptions.
   - Implement writes for cycle actions.
   - Preserve existing screen-facing store actions where practical.

6. Migrate existing `AsyncStorage` data.
   - Detect local data.
   - Upload once after explicit user confirmation.
   - Preserve JSON backup/export.

7. Add Firestore Security Rules and tests.
   - Member-only reads/writes.
   - Owner-only invite/removal/delete.
   - Deny non-members.
   - Deny role escalation.

8. Preserve local reminder settings per device.
   - Keep notification permission and reminder time local.
   - Do not sync reminder settings through shared app settings.

## Branching, Rollout, And Rollback

Cloud sync should be built and tested away from `main`.

Recommended git flow:

```text
main
  stable local-only app and released preview builds

codex/cloud-sync-v1
  Firebase/Auth/Firestore implementation work
```

Do not merge the cloud-sync branch into `main` until:

- Existing local-only tests still pass.
- Firestore Security Rules tests pass.
- Migration has been tested with a real local backup.
- Two-device sync has been tested on a development or preview build.
- Export/backup still works.
- Local reminders still work.
- A rollback path has been verified.

### EAS Channels

The project already has `preview` and `production` EAS channels.

Use them conservatively:

- Development builds: test Firebase sign-in, native auth configuration, and local device behavior.
- Preview channel: test with real phones before anything goes to production.
- Production channel: only after the cloud-sync build has survived preview testing.

For private spouse testing, use a preview/internal build first. Do not test the first cloud migration on the only copy of real data without exporting a JSON backup first.

### Android Dogfood App

Because this project is being tested Android-first, the cloud-sync preview should install side-by-side with the current stable app instead of replacing it.

Use a separate Android package name for dogfood builds:

```text
Stable app:  com.daoster.app
Dogfood app: com.daoster.app.dogfood
```

The dogfood app should also use a visibly distinct app name/icon label, for example:

```text
Fidelis Dogfood
```

This protects the current local-only install and its `AsyncStorage` data while cloud sync is being tested. It also makes it obvious which app is connected to Firebase and which app is the stable fallback.

Dogfood builds should:

- Use a separate Firebase Android app registration for `com.daoster.app.dogfood`.
- Point at a development or dogfood Firebase project/environment.
- Use the EAS `preview` channel or a dedicated dogfood channel.
- Keep photo storage disabled.
- Keep remote spouse-update push notifications disabled.
- Keep local JSON backup/export enabled.

Do not require uninstalling the stable app to test cloud sync. If Android asks to replace the stable app, the dogfood build is configured incorrectly.

### Rollback Strategy

There are two rollback layers.

#### Code Rollback

If the branch goes badly before merge:

- Stop using the cloud-sync branch.
- Switch back to `main`.
- Keep using the last known-good local-only build.
- Keep using the stable `com.daoster.app` install; uninstall only the dogfood app if needed.

If cloud sync has already merged and caused problems:

- Revert the merge commit or problematic commits.
- Publish a new preview/production update from the reverted code.
- Keep the Firebase project data intact until the issue is understood.

Do not delete cloud data as a first rollback step. Code rollback and data rollback should be separate decisions.

#### App Update Rollback

If an EAS update causes problems:

- Republish the last known-good update to the affected channel, or use EAS rollback if available for that update path.
- If the issue is in native configuration, ship a new internal/preview build from the last known-good commit.

Because auth providers and native config can require a new build, do not assume every cloud-sync problem can be fixed with an over-the-air update.

### Data Safety During Testing

Before testing migration with real cycle data:

- Export a JSON backup from the current app.
- Save the backup outside the app.
- Test migration first with mock data.
- Test with a copied/imported backup before using the only live dataset.
- Prefer importing a copied backup into the dogfood app before attempting any migration path that touches the stable app.

During the first shared test:

- Use a dedicated Firebase project or clearly isolated Firebase environment for development.
- Avoid production Firestore rules until rules tests are in place.
- Keep photo storage disabled.
- Keep remote push notifications disabled.
- Keep instructor sharing disabled.

### Go/No-Go Checklist

Cloud sync is ready to merge only when:

- Both accounts can sign in on separate phones.
- Owner can invite the spouse.
- Spouse can join as member.
- Both phones see the same current cycle.
- Either phone can log a reading and the other receives it.
- Removed member loses access.
- Non-member access is denied by rules tests.
- Local JSON backup exists before migration.
- Reverting to the last local-only build has been rehearsed.

## Test Checklist

### Auth

- New user can sign in.
- Signed-out user cannot access cloud data.
- Auth session persists across app restart.
- User can sign out.

### Roles And Invites

- First workspace creator becomes owner.
- Owner can generate an invite code.
- Spouse can join with a valid invite code.
- Used invite code cannot be reused.
- Expired invite code is rejected.
- Invalid invite code is rejected.
- Member cannot generate invite codes.
- Member cannot remove another member.
- Member cannot delete the workspace.
- Member cannot promote self to owner.

### Firestore Security Rules

- Non-member cannot read couple document.
- Non-member cannot read cycles.
- Non-member cannot write cycles.
- Member can read/write only their own couple workspace.
- Member cannot access another couple workspace.
- Owner can remove member.
- Removed member loses access immediately after rules evaluate against updated membership.

### Sync

- Log created on one phone appears on the other.
- Log edited on one phone appears on the other.
- New cycle started on one phone appears on the other.
- Completed cycle history syncs.
- Settings shared between spouses sync, except local reminder settings.
- Offline edit syncs after reconnect.
- Same-day edit conflict resolves by latest `updatedAt`.

### Migration

- Existing local cycles upload once.
- Existing local `currentCycleId` is preserved.
- Existing shared settings are preserved where applicable.
- Local reminder settings remain local.
- App does not silently overwrite existing cloud data.

### Notifications

- Each device can enable local reminders.
- Each device can choose its own reminder time.
- Turning reminders off cancels local scheduled notifications.
- Reminder text contains no health details.

### Backup And Export

- JSON backup export still works.
- JSON backup import still works or has a clear cloud-aware flow.
- CSV export still works.
- PDF chart export still works.

## Deferred Features

These are intentionally not part of v1:

- Photo capture/storage.
- App-layer encryption or full E2EE.
- Instructor accounts.
- Instructor sharing portal.
- Viewer-only role.
- Admin role.
- Remote spouse-update push notifications.
- Server-side reminders.
- Server-side fertility calculations.

## Assumptions

- Firebase is the chosen backend.
- Firestore is the shared chart database.
- Firebase Auth is the identity provider.
- Google/Apple sign-in is the preferred auth direction.
- Apple sign-in is required for iOS if Google sign-in is offered there.
- One-time invite code is the spouse invite mechanism.
- V1 uses local reminders only.
- V1 security is based on Firebase Auth, Firestore Security Rules, privacy hygiene, and user-controlled export/delete/remove flows.

## Dogfood V1 Implementation Notes

Implemented on branch `codex/cloud-sync-v1`.

### Android Dogfood Build

- `app.config.js` now resolves the stable app as:
  - Name: `Fidelis`
  - Android package: `com.daoster.app`
- `APP_VARIANT=dogfood` resolves the dogfood app as:
  - Name: `Fidelis Dogfood`
  - Android package: `com.daoster.app.dogfood`
- `eas.json` includes a `dogfood` profile using `APP_VARIANT=dogfood`, APK output, and the `dogfood` EAS channel.
- `app.config.js` sets a dogfood native URL scheme of `com.daoster.app.dogfood` for OAuth redirects. This requires a new dogfood build before Google Sign-In can be tested on-device.
- `expo-local-authentication` is included for optional device biometric/passcode app lock. This is a native module and requires a new dogfood build; do not rely on OTA alone for this feature.
- Verified with `npx expo config --json` and `APP_VARIANT=dogfood npx expo config --json`; the dogfood package does not replace `com.daoster.app`.

### Firebase Configuration

Firebase config is read from Expo public env vars into `extra.firebase`:

```text
EXPO_PUBLIC_FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
EXPO_PUBLIC_FIREBASE_APP_ID
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
EXPO_PUBLIC_DOGFOOD_ALLOWED_EMAILS
```

`EXPO_PUBLIC_DOGFOOD_ALLOWED_EMAILS` is an optional comma-separated belt-and-suspenders client-side dogfood allowlist. Firestore remains the server-side enforcement layer and always requires either `dogfoodAllowedEmails` or `dogfoodAllowedUsers` docs.

Manual Firebase Console setup still required:

- Create/register a Firebase Android app for package `com.daoster.app.dogfood`.
- Enable Firestore.
- Enable Firebase Auth. Email/password is implemented for dogfood. Google Sign-In app code is implemented but the UI remains disabled until OAuth client IDs are supplied.
- Before publishing the hardened dogfood rules, create Firestore allowlist documents for each approved tester. Prefer `dogfoodAllowedUsers/{firebase-auth-uid}` with `{ enabled: true }`; `dogfoodAllowedEmails/{exact-auth-email}` with `{ enabled: true }` is also supported. Include the owner and spouse.
- Deploy `firestore.rules`.
- Add SHA-1/SHA-256 fingerprints required by Google Sign-In. For Play-installed dogfood builds, use the Google Play Console App signing certificate fingerprints for package `com.daoster.app.dogfood`; keeping the EAS upload-key fingerprints registered too is useful for direct/internal builds.
- Enable the Google provider in Firebase Auth.
- Create or locate the Android OAuth client for package `com.daoster.app.dogfood` and the Web OAuth client for the Firebase project.
- Set `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in the dogfood EAS environment, then rebuild dogfood so the native scheme and env config are present.

### Product Language

Use "family chart" in user-facing copy instead of "workspace." "Workspace" remains acceptable in backend/data-access code and this technical plan when referring to the Firestore authorization container. The UI should feel like a shared chart for a married couple, not a work collaboration tool.

Preferred copy direction:

- "Create workspace" -> "Start your family chart"
- "Join workspace" -> "Join your family chart"
- "Workspace members" -> "Family members"
- "Delete workspace" -> "Delete family chart"
- "Shared workspace" -> "Shared family chart"

### Implemented App Behavior

- Firebase Auth + Firestore repository layer added under `src/services/cloudSync`.
- Firebase Auth is initialized with React Native AsyncStorage persistence instead of the default browser persistence path.
- Google Sign-In is wired through `expo-auth-session` and Firebase `GoogleAuthProvider`, but remains config-gated until OAuth client IDs are available.
- Optional App Lock is available in Settings > Privacy. It uses the device lock screen, fingerprint, or face unlock before showing local/cloud chart screens. The setting is local to each device and is not written to Firestore shared settings.
- Zustand remains the screen-facing state layer.
- Firestore becomes the source of truth after sign-in and workspace setup.
- Shared settings sync only `conservativeMode` and `intention`; notification permission, reminder time, and App Lock remain local.
- Owner/member roles are represented in `couples/{coupleId}/members/{uid}`.
- Owners can create one-time invite codes, remove members, and delete a workspace. Workspace deletion removes cycles, invite codes, and shared settings, marks members removed, and marks the couple document deleted.
- Members can read/write shared cycle data and shared app settings but cannot invite/remove/delete.
- Invite code records store `codeHash`, not the raw code. The raw code is shown once in Settings after creation.
- Migration prompts before uploading local cycle data and blocks automatic upload when the workspace already has cloud cycles.
- JSON backup, CSV export, and PDF export continue to read from the Zustand screen-facing state.
- Daily reminder notification copy is neutral: `Fidelis` / `Time to log today.`
- Console logging of backup/export/notification errors was removed to avoid accidental sensitive data leakage.
- Real-device dogfood onboarding was verified after deploying a rules fix that lets an allowlisted invitee read only their own pending member document during the invite transaction.

### Security Rules

Added:

- `firebase.json`
- `firestore.rules`
- `firestore.indexes.json`

Rules deny by default and enforce:

- Auth required for app data.
- Active members only for couple, cycle, and shared settings access.
- Owners only for invite creation, member removal, and workspace deletion.
- Member role cannot be changed through member updates.
- Join flow can create only the joining user's `member` record as `member`, tied to a same-batch invite-code use.
- User profile documents are restricted to non-health account metadata fields.
- New dogfood user/profile/workspace/member writes require `dogfoodAllowedUsers/{request.auth.uid}` or `dogfoodAllowedEmails/{request.auth.token.email}` with `enabled: true`, so Play crawlers or leaked builds cannot create usable cloud workspaces or join invites unless explicitly allowlisted.
- Invitees may read only `couples/{coupleId}/members/{request.auth.uid}` before joining so the client transaction can safely check whether the account is already a member. They cannot list members or read other member documents until active membership exists.

### Known Limitations / Follow-Up

- Google Sign-In still requires Firebase Console/OAuth setup and a new dogfood build before device testing. The downloaded `google-services.json` did not include OAuth client entries.
- App Lock requires a fresh dogfood build containing `expo-local-authentication`; existing Play/APK installs cannot receive this native module by OTA alone.
- Auth persistence now uses React Native AsyncStorage. Device-verify that sign-in survives app restarts and OTA reloads.
- User-facing "workspace" copy has been replaced with "family chart"; backend collection names and repository concepts remain stable unless a later migration justifies renaming them.
- Firestore rules tests were not run against the emulator in this pass. Exact next step: install/run Firebase Emulator Suite, then add `@firebase/rules-unit-testing` cases for owner/member/non-member allow/deny paths using `firestore.rules`.
- Full E2EE, photo storage, instructor sharing, complex roles, server reminders, and remote push remain deferred.
