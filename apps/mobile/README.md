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
```
