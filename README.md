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

## Operations

### Login

Login ships **off** so installed apps keep working. To switch it on:

1. In Render, set `AUTH_SECRET` (32+ random characters), `ADMIN_USERNAME` and
   `ADMIN_PASSWORD`. The owner account is created on the next boot.
2. Ship the app versions that have the login screen (Android update, web deploy).
3. Set `AUTH_REQUIRED=true` in Render.

Reset a password (logs out every device):
`npm run create-user -- <username> <new-password>` with `MONGODB_URI` set.

### Backups

`.github/workflows/backup.yml` exports every collection nightly at 03:15
Bujumbura time, encrypted with AES-256-GCM, kept 90 days as a workflow artifact.

1. Add the repository secrets `MONGODB_URI` and `BACKUP_PASSPHRASE` (16+
   characters, kept in a password manager: backups are useless without it).
2. Run the workflow once by hand (Actions → Nightly backup → Run workflow).
3. Test a restore into an empty scratch database:

```bash
RESTORE_URI=<scratch db> BACKUP_PASSPHRASE=… npm run restore -- gb-backup-….json.enc          # dry run
RESTORE_URI=<scratch db> BACKUP_PASSPHRASE=… npm run restore -- gb-backup-….json.enc --apply
```

`restore` never reads `MONGODB_URI` and refuses a non-empty target unless
`--replace` is given.

### CI

`.github/workflows/ci.yml` runs the API tests, the app typecheck and the web
build on every push and pull request. `npm run test:unit` runs the tests that
need no database.

## Domain rules worth knowing

These are deliberate and enforced by the API:

- **Milk income is derived, never entered.** Revenue = litres recorded × the
  price per litre in Settings. Recording milk as manual revenue would
  double-count it, so `Milk Sales` is not an accepted revenue source.
- **Milk is valued at the price in force that day.** The price has a history
  (Settings → price, with a start date). Each record stores its day's price, so
  a price change never revalues past income.
- **Animals with records are archived, never deleted.** Selling records the
  date, price and buyer, books the sale as income linked to the animal, and
  moves it to the Archive. Delete works only for an animal with no records.
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
- Roles beyond a single owner (the user model has a `role` field ready)
