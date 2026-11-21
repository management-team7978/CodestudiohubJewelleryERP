# CodeStudioHub Jewellery ERP

Gold / karigar / order / loss / billing / GST ERP for jewellery manufacturers (built for Shakti Gold quotation CSH/QT/2026/1117-02).
Stack: Next.js 15 (App Router) · TypeScript · Tailwind · SQLite (better-sqlite3) · Recharts. Runs on a local rack server — no cloud needed.

## Run
```bash
npm install
npm run build && npm start        # http://localhost:3100  (npm run dev for development)
npm test                          # gold maths & GST unit tests
```
First start creates `data/erp.db` with demo data. Demo logins: `admin@erp.local / Admin@123` (Super Admin), `accounts@erp.local / Accounts@123`.
**Before go-live:** change both passwords, set `ERP_SECRET` (long random string), `NEXT_PUBLIC_SHOW_DEMO=0` at build time, `ERP_HTTPS=1` if served over HTTPS, and delete `data/erp.db` once to start with only your own data (or remove the demo rows).

## What is inside
| Area | Where |
|---|---|
| Dashboard, first-time tour, setup checklist, per-page "How to use" | `/`, `/guide` |
| Touch → Fine gold, give back fine, purchases | `/gold` |
| Multi-touch melting calculator (alloy / pure gold advice, melting loss) | `/melting` |
| Gold & cash ledgers (party / karigar / department / store) | `/ledger` |
| Orders with custom department flow & live tracking | `/orders`, `/jewels`, `/departments` |
| Metal transfer with receiver confirmation, karigar balances | `/transfers`, `/karigars` |
| Loss booking (shift-end & weighing), analytics graphs, CSV | `/loss` |
| Gold bill · Cash bill · GST invoice, receipts (cash/UPI/bank/gold) | `/billing` |
| GST: GSTR-1 / e-Invoice / e-Way JSON, **direct e-Invoice API push**, manual IRN | `/gst` |
| Roles & permissions, IP allow-list, lockout, audit log | `/users`, `/audit` |
| Backup (UI + `scripts/backup.mjs` for cron) | `/backup` |
| Designs with name+mobile watermark, access control, view log | `/designs` |
| WhatsApp agent webhook (owner & business owners) | `/api/whatsapp` |

## Direct e-Invoice upload — what the client must provide
GSP/ASP provider account + API base URL · Client ID & Secret · e-Invoice portal API username/password · GSTIN. Enter them in **GST & e-Invoice → Portal settings**, choose *Direct API*, start in *Sandbox*. We send the NIC e-Invoice v1.1 payload and read `Irn/AckNo/AckDt/SignedQRCode` from the reply. Each provider differs slightly in auth/path/headers — adjust *Auth path* / *Generate-IRN path* (and `lib/gst.ts` `pushEInvoice` if the provider needs a different shape). In *Manual JSON* mode nothing is sent anywhere.

## Not in this web build (needs separate work / accounts)
* Native Android/iOS apps (OS-level screenshot blocking, recording detection, front-camera proctoring). The web app is installable (PWA manifest) and has watermark + blur/PrintScreen deterrents + logging only.
* WhatsApp Business API credentials, DLT/SMS OTP, GSP subscription, store accounts — client-side purchases.
* Automatic off-server backup copy, CI/CD pipeline, third-party security test report.

## Mobile app (Business Owner) — `mobile/`
Expo (SDK 58) + Expo Router. Mobile OTP login (approved B2B parties only) → Designs (watermarked, screenshot/recording protected, front-camera proctoring), Orders with live department tracking, Ledger, Bills, Chat, "Place order" from a design.
```bash
cd mobile && npm install
EXPO_PUBLIC_API_URL=http://<server-ip>:3100 npx expo start --dev-client   # needs a development build (ML Kit is native)
eas build --profile development --platform android   # or ios
```
Server: set `ERP_DEV_OTP=1` only for testing (returns the OTP in the API reply). In production set **Settings → SMS webhook** (`sms_webhook` setting: your DLT SMS gateway URL that accepts `{mobile, message}`).
Protection: Android blocks screenshots & recording (`FLAG_SECURE`); iOS shows blank in recordings, reports screenshots; app-switcher blur; watermark `Name · Mobile`; camera check every 3 s (no face / 2+ faces → design hidden, snapshot + device saved, admin can Block user in Designs). Another phone's camera pointed at the screen cannot be detected — the watermark traces the viewer.
**Needs real-device testing before release** (camera/ML Kit/FLAG_SECURE could not be run here). Store publishing needs your Play/App Store accounts.
Database changes: schema uses CREATE TABLE IF NOT EXISTS in lib/db.ts and runs on every start, so a deploy applies new tables automatically.
