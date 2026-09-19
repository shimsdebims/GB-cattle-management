# GB Dairy Cattle Management

A mobile app for running a dairy farm: track the herd, record daily milk yield,
log feeding and expenses, and see monthly income per cow.

Built for a farm in Burundi, so all money is in **Burundian Francs (BIF / FBu)**
and milk income is **calculated** from recorded production rather than typed in
by hand.

## Stack

- **App** — React Native via Expo (SDK 53), TypeScript, React Navigation
- **API** — Node.js, Express, Mongoose
- **Database** — MongoDB Atlas
- **Tests** — Jest + Supertest against an in-memory MongoDB

## Repository layout

```
cattle-management-mobile/        the Expo app
├── screens/                     one file per screen
├── services/                    API client, offline queue
├── hooks/  components/  utils/  constants/  types/
└── backend-mongo/               the Express API
    ├── routes/                  one file per resource
    ├── models/                  Mongoose schemas
    ├── middleware/              validation + response helpers
    ├── constants/domain.js      the shared vocabulary (see below)
    ├── scripts/                 seed, connection check, smoke test
    └── tests/                   83 tests, no external database needed
```

## Getting started

You need Node 18+ and a MongoDB Atlas cluster (the free tier is fine).

### 1. Start the API

```bash
cd cattle-management-mobile/backend-mongo
npm install
cp .env.example .env
```

Open `.env` and set `MONGODB_URI` to your Atlas connection string. Include a
database name before the `?`, otherwise Mongoose quietly uses one called `test`:

```
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/cattle-management?retryWrites=true&w=majority
```

Then verify and start:

```bash
npm run check      # confirms the connection, prints no credentials
npm run populate   # optional: seed ~20 cows and ~900 milk records
npm run dev        # http://localhost:8080
```

### 2. Start the app

```bash
cd cattle-management-mobile
npm install
npx expo start
```

Press `i` for the iOS simulator, `a` for Android, or scan the QR code with
Expo Go on a phone.

**You normally do not need to configure the API URL.** The app reads the host
from the Expo dev server, so it finds `http://<your-machine-ip>:8080/api` on its
own. Phone and computer must be on the same network.

To point it somewhere else, set `EXPO_PUBLIC_API_URL` in
`cattle-management-mobile/.env` — see `.env.example`.

## How the app is organised

Seven tabs:

- **Dashboard** — herd, production and financial totals for the last 30 days
- **Cattle** — searchable herd list, filter by status; tap for full detail
- **Milk** — daily yield per cow
- **Feeding** — feed type, quantity and cost
- **Financial** — milk income per cow, expenses, other revenue, net profit
- **Monthly** — cow × day yield grid, mirroring the farm's spreadsheet
- **Analytics** — not built yet; links to the reports above

## Domain rules worth knowing

These are deliberate and enforced by the API:

- **Milk income is derived, never entered.** Revenue = litres recorded × the
  price per litre in Settings. Recording milk as manual revenue would
  double-count it, so `Milk Sales` is not an accepted revenue source.
- **One milk record per cow per calendar day.** Enforced by a unique index, so
  double entry is rejected rather than silently doubling a day's total.
- **Dates are calendar dates** (`YYYY-MM-DD`), stored at UTC midnight. Sending a
  full timestamp from a UTC+2 phone would shift the day backwards.
- **Expense amounts can be derived** from quantity × cost per unit. When both
  are given, the derived value wins so the total can't contradict the line item.

## The shared vocabulary

Breeds, statuses, health states, feed types, expense categories and revenue
sources are defined **once** and mirrored in two files:

- `backend-mongo/constants/domain.js` — used by the schemas, validators, routes
  and seeder
- `types/domain.ts` — used by the app's pickers and its TypeScript union types

If you change one, change the other. This is what stops a dropdown from
offering a value the API will reject.

## Offline behaviour

The app is offline-first. Writes hit a local cache immediately and queue a
durable operation; the queue replays in order when the connection returns,
mapping temporary IDs onto the IDs the server assigns. The badge in the header
shows connection and queue state, and Settings lists anything that failed.

## Commands

From `cattle-management-mobile/backend-mongo`:

- `npm run dev` — start with auto-reload
- `npm start` — start for production
- `npm run check` — verify the database connection
- `npm run populate` — reset and seed sample data
- `npm test` — 83 tests on an in-memory MongoDB, no setup required
- `npm run smoke` — boot the real API and assert 28 behaviours end to end

From `cattle-management-mobile`:

- `npx expo start` — run the app
- `npx tsc --noEmit` — typecheck

## Deployment

`backend-mongo/render.yaml` deploys the API to [Render](https://render.com).
Set `MONGODB_URI` in the Render dashboard rather than committing it. Then point
the app at the deployed URL with `EXPO_PUBLIC_API_URL`.

For the app itself, `eas build --platform android --profile preview` produces an
installable APK.

## Not built yet

- Analytics charts (the data is already exposed by the API)
- Authentication — the API is currently open, which is fine on a private
  network but must be addressed before wider distribution
