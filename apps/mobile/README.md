# ChuFlow phone app

The ChuFlow app for iPhone and Android, built with Expo (SDK 58). It uses the same API as the
website and covers the jobs people do on their phones:

- **Home** – today's numbers for your scope, shortcuts, what needs you, recent guests.
- **Guests** – search everyone in your scope, register a first-timer, open a profile with
  one-tap Call, WhatsApp, Text and Email.
- **Follow-up** – your call list; log how it went in two taps (outcome, how you reached them,
  note, reminder).
- **Attendance** – a door counter (tap +, hold for +10). With no signal the count is kept on the
  phone and sent automatically when it is back online.
- **Approvals** – approve or reject attendance reports and expenses.
- **More** – phone alerts, Face ID / fingerprint App lock, links to the website, sign out.

The raised orange **New** button opens quick actions allowed for the signed-in role. Follow-up
is available from Home and More; children-only staff see a smaller navigation bar.

This folder is deliberately **not** an npm workspace of the repo, so the website (Amplify) and
API (Render) builds never install React Native.

## Try it on your phone

1. Install **Expo Go** from the App Store or Google Play.
2. On this computer:

   ```bash
   cd apps/mobile
   npm install
   npx expo start
   ```

3. Scan the QR code it prints (iPhone: with the Camera app; Android: from inside Expo Go). Your
   phone and computer must be on the same Wi‑Fi; if they aren't, use `npx expo start --tunnel`.
4. Sign in with your normal ChuFlow email and password.

By default the app talks to the live API (`https://api.chuflow.com/api`). To point it at a local
API, start it with `EXPO_PUBLIC_API_URL=http://<your-computer-ip>:4000/api npx expo start`.

## Alerts

Phone alerts are sent by the API through Expo's push service when a first-timer registers, a
follow-up is assigned, or a report needs approval. Expo Go on Android can't receive them, so they
need an installed ChuFlow build (Expo Go on iPhone can). The website's own browser alerts are
unaffected.

## Checks

```bash
npx tsc --noEmit
npx expo lint
node scripts/check-messages.mjs
node --test test/update-policy.test.cjs
```

## App updates

Installed builds from 1.0.1 include Expo Updates. Startup checks download compatible fixes in
the background. **More → App updates** also supports checking manually and confirming a restart;
the app never reloads an active session automatically. Expo Go and the web preview cannot apply OTA.

The Android internal APK uses the `preview` channel. TestFlight uses `production`. Runtime
fingerprints separate incompatible native builds, even when they share a version number.
Adding native dependencies, changing permissions or other native configuration needs a new build.

From this folder, set `EXPO_PUBLIC_API_URL=https://api.chuflow.com/api` and
`EXPO_PUBLIC_WEB_URL=https://chuflow.com` in the publishing environment, then:

```bash
eas update --channel preview --environment preview --platform all --message "Describe the update"
# Check the preview on an installed compatible build before releasing to TestFlight users.
eas update --channel production --environment production --platform all --message "Describe the update"
```

Confirm that the published runtime matches the intended build's runtime in EAS. Keep the prior
working update available for rollback. Before publishing, run the checks above and export all platforms.

For a new native release, build Android with `--profile preview` and iOS with `--profile production`.
After the artifacts are available, update `apps/web/public/mobile-release.json` with the real version,
build number and Android artifact URL, then deploy the website. The app reads this uncached public
manifest to offer a new APK or open TestFlight. Do not announce a native version before it is available.
