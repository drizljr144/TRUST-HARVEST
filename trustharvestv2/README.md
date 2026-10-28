# TrustHarvest: sell it before it spoils

A freshness clock, price tips and safe payment for farmers and cooperative agents.
Payments, identity checks, SMS and USSD are **simulated** in this prototype.

## Run
    npm install
    npm start        # http://localhost:3000
Delete `data.json` to reset the demo data.

## Demo logins (password: pass1234)
- Farmer 0803000001 (Musa) | Cooperative agent 0803000004 (Amina) | Buyer 0803000003 | Admin 0800000000

## What is in it
- **Freshness clock**: log crop, amount, harvest day and storage with big icon buttons. Green, amber or red shows days left.
- **Price tips and surplus routing**: suggested discount as produce ages; red batches show processors and food banks (sample data).
- **Days-held record** (Record tab): how long produce was held before sale, by crop and storage method.
- **Agent mode**: a cooperative agent logs batches on behalf of named farmers.
- **SMS and USSD demo** (Phone tab): alerts with "Reply 1 / 2" and a USSD-style menu.
- **Sensor input**: `POST /api/sensor` with header `x-device-key` (env `SENSOR_KEY`, default `demo-sensor-key`) and body
  `{"phone":"0803000001","storage":"cooler","temp":9,"humidity":70}`. A hot room shortens the clock, a cool room extends it.
  The Fresh tab has a one-tap simulator.
- **Accessibility**: English, Pidgin and Hausa (have native speakers review Hausa and Pidgin), read-aloud button, large text,
  **Lite mode** (no photos or slideshow; turns on automatically when the browser reports data saver or 2G), offline queue for new
  batches, and an offline app shell (service worker).
- **Escrow marketplace**: buyers pay into escrow, farmers are paid on confirmed delivery, disputes and fraud flags, audit log.

## Honest limits (say these in the pitch)
- Shelf-life days and base prices in `server.js` are **placeholder assumptions**. Replace them with postharvest research values.
- Real SMS needs a provider (for example Africa's Talking); USSD needs a telecom partner; payments need a licensed provider.
- Processors listed are sample data, not real businesses.

## Security
bcrypt, JWT with 2h expiry, rate limiting (stricter on login), input validation, security headers and CSP, server-side order
state checks, device-key check for sensors (timing-safe), audit log.
