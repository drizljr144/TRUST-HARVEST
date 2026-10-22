// TrustHarvest MVP: escrow marketplace for farm produce. Payments are SIMULATED.
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');

const SECRET = process.env.JWT_SECRET || require('crypto').randomBytes(32).toString('hex');
const DB_FILE = path.join(__dirname, 'data.json');
let db = fs.existsSync(DB_FILE)
  ? JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))
  : { users: [], listings: [], orders: [], audit: [], seq: 1 };
const save = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
const id = () => db.seq++;
const clean = (s, max = 80) => String(s || '').replace(/[<>]/g, '').trim().slice(0, max);
const log = (orderId, actor, from, to) => {
  db.audit.push({ at: new Date().toISOString(), orderId, actor, from, to });
};
const trust = u => Math.max(0, Math.min(100, 50 + u.trades * 10 - u.disputes * 15 - u.cancels * 5));
const pub = u => ({ id: u.id, name: u.name, role: u.role, verified: u.verified, wallet: u.wallet, trust: trust(u) });

function seed() {
  if (db.users.length) return;
  const mk = (name, phone, role, wallet, verified, trades) => db.users.push({
    id: id(), name, phone, role, pass: bcrypt.hashSync('pass1234', 8),
    verified, wallet, trades, disputes: 0, cancels: 0
  });
  mk('Admin', '0800000000', 'admin', 0, true, 0);
  mk('Musa Danjuma', '0803000001', 'farmer', 0, true, 4);
  mk('Ngozi Eze', '0803000002', 'farmer', 0, false, 0);
  mk('Chidi Foods Ltd', '0803000003', 'buyer', 500000, true, 2);
  const f1 = db.users[1].id, f2 = db.users[2].id;
  const ls = (farmer, crop, qty, unit, price, loc) =>
    db.listings.push({ id: id(), farmer, crop, qty, unit, price, loc, open: true });
  ls(f1, 'Tomatoes', 40, 'baskets', 18000, 'Jos North');
  ls(f1, 'Irish potatoes', 25, 'bags', 32000, 'Bokkos');
  ls(f2, 'Yam tubers', 100, 'tubers', 2500, 'Barkin Ladi');
  save();
}
seed();

const app = express();
app.use(express.json({ limit: '10kb' }));
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'" });
  next();
});
app.use('/api', rateLimit({ windowMs: 60000, max: 120 }));
app.use('/api/login', rateLimit({ windowMs: 60000, max: 10 }));
app.use(express.static(path.join(__dirname, 'public')));

const auth = (req, res, next) => {
  try {
    const t = (req.headers.authorization || '').replace('Bearer ', '');
    req.user = db.users.find(u => u.id === jwt.verify(t, SECRET).id);
    if (!req.user) throw 0;
    next();
  } catch { res.status(401).json({ error: 'Please log in again.' }); }
};
const sign = u => jwt.sign({ id: u.id }, SECRET, { expiresIn: '2h' });
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });

app.post('/api/register', (req, res) => {
  const name = clean(req.body.name), phone = clean(req.body.phone, 15);
  const role = req.body.role === 'farmer' ? 'farmer' : 'buyer';
  if (!name || !/^\d{10,15}$/.test(phone)) return bad(res, 'Enter your name and a phone number with digits only.');
  if (String(req.body.password || '').length < 8) return bad(res, 'Password needs at least 8 characters.');
  if (db.users.some(u => u.phone === phone)) return bad(res, 'That phone number is already registered.');
  const u = { id: id(), name, phone, role, pass: bcrypt.hashSync(req.body.password, 10),
    verified: false, wallet: 0, trades: 0, disputes: 0, cancels: 0 };
  db.users.push(u); save();
  res.json({ token: sign(u), user: pub(u) });
});

app.post('/api/login', (req, res) => {
  const u = db.users.find(x => x.phone === clean(req.body.phone, 15));
  if (!u || !bcrypt.compareSync(String(req.body.password || ''), u.pass)) return bad(res, 'Wrong phone number or password.', 401);
  res.json({ token: sign(u), user: pub(u) });
});

app.get('/api/me', auth, (req, res) => res.json(pub(req.user)));

// Demo KYC: in production this would call an ID verification provider (e.g. NIN/BVN lookup).
app.post('/api/verify', auth, (req, res) => { req.user.verified = true; save(); res.json(pub(req.user)); });

// Simulated top-up: in production this would be a Paystack/Flutterwave checkout.
app.post('/api/wallet/topup', auth, (req, res) => {
  const amt = Number(req.body.amount);
  if (!Number.isFinite(amt) || amt <= 0 || amt > 1000000) return bad(res, 'Enter an amount between 1 and 1,000,000.');
  req.user.wallet += Math.round(amt); save(); res.json(pub(req.user));
});

const view = l => {
  const f = db.users.find(u => u.id === l.farmer);
  return { ...l, farmerName: f.name, farmerVerified: f.verified, farmerTrust: trust(f) };
};
app.get('/api/listings', auth, (req, res) => res.json(db.listings.filter(l => l.open).map(view)));

app.post('/api/listings', auth, (req, res) => {
  if (req.user.role !== 'farmer') return bad(res, 'Only farmers can list produce.', 403);
  const b = req.body, qty = Number(b.qty), price = Number(b.price);
  if (!clean(b.crop) || !(qty > 0) || !(price > 0)) return bad(res, 'Add the crop, quantity and price.');
  const l = { id: id(), farmer: req.user.id, crop: clean(b.crop), qty, unit: clean(b.unit, 20) || 'units',
    price: Math.round(price), loc: clean(b.loc), open: true };
  db.listings.push(l); save(); res.json(view(l));
});

const orderView = o => {
  const l = db.listings.find(x => x.id === o.listing);
  return { ...o, crop: l.crop, unit: l.unit,
    farmerName: db.users.find(u => u.id === o.farmer).name,
    buyerName: db.users.find(u => u.id === o.buyer).name };
};
app.get('/api/orders', auth, (req, res) =>
  res.json(db.orders.filter(o => o.buyer === req.user.id || o.farmer === req.user.id).map(orderView).reverse()));

app.post('/api/orders', auth, (req, res) => {
  if (req.user.role !== 'buyer') return bad(res, 'Only buyers can place orders.', 403);
  const l = db.listings.find(x => x.id === Number(req.body.listing) && x.open);
  const qty = Number(req.body.qty);
  if (!l) return bad(res, 'That listing is no longer available.', 404);
  if (!(qty > 0) || qty > l.qty) return bad(res, `Choose a quantity between 1 and ${l.qty}.`);
  const total = qty * l.price;
  if (req.user.wallet < total) return bad(res, 'Your wallet balance is too low. Add money first.');
  req.user.wallet -= total; l.qty -= qty; if (l.qty === 0) l.open = false;
  const o = { id: id(), listing: l.id, buyer: req.user.id, farmer: l.farmer, qty, total, status: 'PAID_ESCROW' };
  db.orders.push(o); log(o.id, req.user.name, '-', 'PAID_ESCROW'); save(); res.json(orderView(o));
});

const step = (o, actor, to) => { log(o.id, actor.name, o.status, to); o.status = to; };
const mine = (req, res) => {
  const o = db.orders.find(x => x.id === Number(req.params.id));
  if (!o || (o.buyer !== req.user.id && o.farmer !== req.user.id)) { bad(res, 'Order not found.', 404); return null; }
  return o;
};

app.post('/api/orders/:id/deliver', auth, (req, res) => {
  const o = mine(req, res); if (!o) return;
  if (o.farmer !== req.user.id || o.status !== 'PAID_ESCROW') return bad(res, 'Only the farmer can mark a paid order as delivered.', 403);
  step(o, req.user, 'DELIVERED'); save(); res.json(orderView(o));
});

app.post('/api/orders/:id/confirm', auth, (req, res) => {
  const o = mine(req, res); if (!o) return;
  if (o.buyer !== req.user.id || o.status !== 'DELIVERED') return bad(res, 'Only the buyer can confirm a delivered order.', 403);
  const f = db.users.find(u => u.id === o.farmer);
  f.wallet += o.total; f.trades++; req.user.trades++;
  step(o, req.user, 'RELEASED'); save(); res.json(orderView(o));
});

app.post('/api/orders/:id/dispute', auth, (req, res) => {
  const o = mine(req, res); if (!o) return;
  if (!['PAID_ESCROW', 'DELIVERED'].includes(o.status)) return bad(res, 'This order can no longer be disputed.');
  req.user.disputes++; step(o, req.user, 'DISPUTED'); save(); res.json(orderView(o));
});

// Admin resolves a dispute: funds go to the farmer or back to the buyer.
app.post('/api/orders/:id/resolve', auth, (req, res) => {
  if (req.user.role !== 'admin') return bad(res, 'Admins only.', 403);
  const o = db.orders.find(x => x.id === Number(req.params.id));
  if (!o || o.status !== 'DISPUTED') return bad(res, 'No disputed order with that id.', 404);
  const toFarmer = req.body.to === 'farmer';
  db.users.find(u => u.id === (toFarmer ? o.farmer : o.buyer)).wallet += o.total;
  step(o, req.user, toFarmer ? 'RELEASED' : 'REFUNDED'); save(); res.json(orderView(o));
});

app.get('/api/fraud-flags', auth, (req, res) => {
  if (req.user.role !== 'admin') return bad(res, 'Admins only.', 403);
  const flags = db.users.filter(u => u.disputes >= 2 || trust(u) < 30 || (!u.verified && u.wallet > 100000))
    .map(u => ({ ...pub(u), disputes: u.disputes,
      reason: u.disputes >= 2 ? 'Repeated disputes' : trust(u) < 30 ? 'Low trust score' : 'Unverified account holding a large balance' }));
  res.json({ flags, audit: db.audit.slice(-30).reverse() });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`TrustHarvest running on http://localhost:${port}`));
