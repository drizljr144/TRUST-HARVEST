# TrustHarvest MVP
Escrow marketplace for farm produce. Payments and ID verification are simulated.

## Run
    npm install
    npm start        # http://localhost:3000

## Demo logins (password: pass1234)
- Farmer: 0803000001 (Musa, verified)
- Buyer:  0803000003 (Chidi Foods, wallet ₦500,000)
- Admin:  0800000000 (fraud flags, audit log, dispute resolution)

## 3-minute demo
1. Log in as the buyer, buy 5 baskets of tomatoes with escrow. Funds leave the wallet and are held.
2. Log in as the farmer (new tab/private window), open Orders, tap Mark as delivered.
3. Back as the buyer, tap Confirm delivery. Funds release and trust scores rise.
4. Repeat, but tap Report a problem. Log in as admin to resolve and open the Fraud tab and audit log.

## Security notes
bcrypt password hashing, JWT with 2h expiry, rate limiting (stricter on login), input sanitisation,
CSP and security headers, escrow state-machine checks on the server, audit log of every status change.
## Next steps
Real payments (Paystack/Flutterwave), NIN/BVN verification, SMS/USSD access, swap JSON file for PostgreSQL.
