This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## ChuFlow conventions (read before touching src/)

- **Layout.** Routes in `src/app/(app)/…` stay thin; real code lives in `src/features/<area>/` (screens, components, `types.ts`, hooks). Modal routes are listed in `src/app/(app)/_layout.tsx`; every screen sets its own translated title with `<Stack.Screen options={{ title }} />`.
- **Languages.** Four, like the website: en, fr, es, pt. Messages are `src/i18n/messages/<locale>/<part>.json`, one top-level key equal to the part name, website ICU style (`{name}`, `{count, plural, one {# guest} other {# guests}}`, `{x, select, a {…} other {…}}`). Read them with `useT('part.namespace')` from `@/i18n/provider` (`t('key', values)`, `t.has`, `t.raw`), or `translate()` outside React. Write English first, then real French, Spanish and Portuguese (no machine placeholders). `node scripts/check-messages.mjs` must pass. `common` holds shared actions, states, time, roles, statuses, tabs and area names; feature parts hold everything else.
- **Formatting.** `useAppFormat()` from `@/i18n/format` for numbers, money, dates, `shortDate`, `relativeTime`, `greeting`, `fullName`, `status` and `role`. The English-only helpers in `src/lib/format.ts` (`shortDate`, `relativeTime`, `greeting`, `statusLabel`, `fullName`, `formatNumber`, `formatMoney`) are legacy; `toLocalDate`, `isoDay`, `dialable`, `statusTone`, `branchName`, `initials` are fine.
- **Kit.** `@/components/ui` (Screen, ScreenHeader, Section, ListRow, Button, Field, Chip, Segmented, Badge, Avatar, Notice, EmptyState, ErrorState, Loading) and `@/components/kit` (StatTile, StatGrid, Meter, LiveDot, Timeline, KeyValue, SearchBar, SwitchRow, Sheet, SheetPicker, DateStepper, Banner, ActionTile). Compose these; feature-only pieces live in the feature folder. Icons come from `Icon name=…`; for a missing glyph use `Glyph d="…"` locally rather than editing `icon.tsx`.
- **Data.** `api.get/post/patch/delete` and `query()` from `@/lib/api`; `useApi<T>(path | null)` from `@/lib/use-api` (refresh, reload, setData); paging pattern as in `(tabs)/guests.tsx`. Roles: `can.*` in `src/lib/permissions.ts`. Mirror response shapes from `apps/web/src/lib/types.ts` and the API DTOs in `apps/api/src/*/dto`.
- **Platforms.** Everything runs in Expo Go and on web (`npx expo start --web`). Native-only dialogs (`Alert.alert`) need a `Platform.OS === 'web'` fallback (see `approvals.tsx`) or an inline confirm.
- **Before you finish:** `npx tsc --noEmit`, `npx expo lint`, `node scripts/check-messages.mjs`, all from `apps/mobile`.
