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
db.batches ||= []; db.sensors ||= {};
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
  ls(f1, 'Maize', 60, 'bags', 45000, 'Riyom');
  ls(f2, 'Yam tubers', 100, 'tubers', 2500, 'Barkin Ladi');
  ls(f2, 'Onions', 30, 'bags', 38000, 'Mangu');
  ls(f2, 'Red pepper', 20, 'baskets', 22000, 'Jos South');
  save();
}
seed();

const app = express();
app.use(express.json({ limit: '10kb' }));
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'" });
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
  const role = ['farmer', 'agent'].includes(req.body.role) ? req.body.role : 'buyer';
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
  return { ...l, farmerName: f.name, farmerVerified: f.verified, farmerTrust: trust(f), fresh: freshOf(l) };
};
app.get('/api/listings', auth, (req, res) => res.json(db.listings.filter(l => l.open).map(view)));

app.post('/api/listings', auth, (req, res) => {
  if (!['farmer', 'agent'].includes(req.user.role)) return bad(res, 'Only farmers and agents can list produce.', 403);
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
  f.wallet += o.total; f.trades++; req.user.trades++; recordSale(o);
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
  const toFarmer = req.body.to === 'farmer'; if (toFarmer) recordSale(o);
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


// ---------------------------------------------------------------------------
// Freshness engine. IMPORTANT: shelf-life days and base prices below are PLACEHOLDER
// ASSUMPTIONS for the demo. Replace them with postharvest research values before real use.
// ---------------------------------------------------------------------------
const LIFE = {
  tomato: { open: 3, shade: 5, basket: 4, cooler: 10 }, potato: { open: 21, shade: 45, basket: 30, cooler: 90 },
  maize: { open: 60, shade: 120, basket: 90, cooler: 180 }, yam: { open: 45, shade: 90, basket: 60, cooler: 120 },
  onion: { open: 14, shade: 40, basket: 30, cooler: 90 }, pepper: { open: 4, shade: 7, basket: 5, cooler: 14 } };
const REF_T = { open: 30, shade: 26, basket: 28, cooler: 10 }; // assumed typical temperature (C) per storage type
const CROPS = { tomato: { name: 'Tomatoes', unit: 'baskets', price: 18000 }, potato: { name: 'Irish potatoes', unit: 'bags', price: 32000 },
  maize: { name: 'Maize', unit: 'bags', price: 45000 }, yam: { name: 'Yam tubers', unit: 'tubers', price: 2500 },
  onion: { name: 'Onions', unit: 'bags', price: 38000 }, pepper: { name: 'Red pepper', unit: 'baskets', price: 22000 } };
const OUTLETS = [ // SAMPLE DATA for the demo, not real businesses
  { name: 'Demo: Jos tomato and pepper drying hub', kind: 'Processor', crops: ['tomato', 'pepper'] },
  { name: 'Demo: Plateau food bank', kind: 'Food bank', crops: ['*'] },
  { name: 'Demo: Jos flour and chips mill', kind: 'Processor', crops: ['maize', 'yam', 'potato'] },
  { name: 'Demo: Onion drying cooperative', kind: 'Cooperative', crops: ['onion'] }];
const DAY = 864e5;

function fresh(b) {
  const s = db.sensors[b.owner + ':' + b.storage];
  let f = 1, sensor = null;
  if (s && Date.now() - s.at < DAY) { // a live sensor reading speeds up or slows down the clock
    f = Math.min(1.6, Math.max(0.6, Math.pow(2, (REF_T[b.storage] - s.temp) / 10)));
    sensor = { temp: s.temp, humidity: s.humidity };
  }
  const life = LIFE[b.crop][b.storage] * f, left = life - (Date.now() - new Date(b.harvested)) / DAY, frac = left / life;
  const status = left <= 0 || frac < 0.2 ? 'red' : frac < 0.5 ? 'amber' : 'green';
  const discount = left <= 0 ? 0.6 : status === 'red' ? 0.35 : status === 'amber' ? 0.15 : 0;
  const base = CROPS[b.crop].price;
  return { daysLeft: Math.max(0, +left.toFixed(1)), life: +life.toFixed(1), status, expired: left <= 0,
    pct: Math.max(0, Math.min(100, Math.round(frac * 100))), discount, base,
    suggested: Math.round(base * (1 - discount) / 100) * 100, sensor };
}
const remaining = b => { const l = b.listing && db.listings.find(x => x.id === b.listing);
  return l ? l.qty : b.qty - b.sales.reduce((a, x) => a + x.qty, 0); };
const bview = b => ({ ...b, ...fresh(b), cropName: CROPS[b.crop].name, remaining: remaining(b) });
function freshOf(l) {
  const b = l.batch && db.batches.find(x => x.id === l.batch); if (!b) return null;
  const f = fresh(b); return { status: f.status, daysLeft: f.daysLeft, pct: f.pct };
}
function recordSale(o) {
  const l = db.listings.find(x => x.id === o.listing), b = l && l.batch && db.batches.find(x => x.id === l.batch);
  if (b) b.sales.push({ days: +((Date.now() - new Date(b.harvested)) / DAY).toFixed(1), qty: o.qty, at: new Date().toISOString() });
}
function createBatch(owner, x) {
  const crop = String(x.crop), storage = String(x.storage), qty = Math.round(Number(x.qty));
  if (!LIFE[crop] || !REF_T[storage]) return { error: 'Choose a crop and a storage place.' };
  if (!(qty > 0 && qty <= 100000)) return { error: 'Enter how many.' };
  let d = x.harvested ? new Date(x.harvested) : new Date();
  if (isNaN(d)) return { error: 'Check the harvest date.' };
  if (d > Date.now()) d = new Date();
  if (Date.now() - d > 60 * DAY) return { error: 'Harvest date is too old.' };
  const b = { id: id(), owner, crop, qty, unit: CROPS[crop].unit, farmer: clean(x.farmer, 60), harvested: d.toISOString(), storage, listing: null, sales: [] };
  db.batches.push(b); return { b };
}
function listBatch(b, price) {
  const p = Math.round(price || fresh(b).suggested);
  let l = b.listing && db.listings.find(x => x.id === b.listing);
  if (l) { l.price = p; l.open = l.qty > 0; }
  else { l = { id: id(), farmer: b.owner, crop: CROPS[b.crop].name, qty: remaining(b), unit: b.unit, price: p, loc: 'Plateau', open: true, batch: b.id };
    db.listings.push(l); b.listing = l.id; }
  return l;
}
const outletsFor = b => OUTLETS.filter(o => o.crops.includes('*') || o.crops.includes(b.crop));
function rollup(list) {
  const g = {};
  for (const b of list) for (const s of b.sales) {
    const x = g[b.crop + '|' + b.storage] ||= { crop: b.crop, storage: b.storage, qty: 0, dq: 0, n: 0 };
    x.qty += s.qty; x.dq += s.days * s.qty; x.n++; }
  return Object.values(g).map(x => ({ crop: x.crop, cropName: CROPS[x.crop].name, storage: x.storage, sales: x.n,
    avgDays: +(x.dq / x.qty).toFixed(1), expectedLife: LIFE[x.crop][x.storage] }));
}
function seedFresh() {
  if (db.batches.length) return;
  const musa = db.users.find(u => u.phone === '0803000001'); if (!musa) return;
  if (!db.users.some(u => u.phone === '0803000004')) db.users.push({ id: id(), name: 'Amina Bello', phone: '0803000004', role: 'agent',
    pass: bcrypt.hashSync('pass1234', 8), verified: true, wallet: 0, trades: 3, disputes: 0, cancels: 0 });
  const amina = db.users.find(u => u.phone === '0803000004');
  const ago = d => new Date(Date.now() - d * DAY).toISOString();
  const add = (owner, crop, qty, d, storage, farmer, sales = []) => { db.batches.push({ id: id(), owner, crop, qty, unit: CROPS[crop].unit,
    farmer, harvested: ago(d), storage, listing: null, sales: sales.map(([days, q]) => ({ days, qty: q, at: ago(1) })) }); return db.batches[db.batches.length - 1]; };
  // sale history (demo data) so the Record tab has something to show
  add(musa.id, 'tomato', 20, 30, 'open', 'Musa Danjuma', [[2.2, 20]]); add(musa.id, 'tomato', 15, 30, 'open', 'Musa Danjuma', [[1.8, 15]]);
  add(musa.id, 'tomato', 30, 30, 'cooler', 'Musa Danjuma', [[6.8, 30]]); add(musa.id, 'tomato', 18, 30, 'shade', 'Musa Danjuma', [[4.5, 18]]);
  add(musa.id, 'pepper', 12, 30, 'shade', 'Musa Danjuma', [[5.5, 12]]); add(musa.id, 'onion', 25, 40, 'open', 'Musa Danjuma', [[9.5, 25]]);
  add(musa.id, 'onion', 20, 40, 'shade', 'Musa Danjuma', [[28, 20]]);
  // live batches
  listBatch(add(musa.id, 'tomato', 40, 2.1, 'open', 'Musa Danjuma'));
  add(musa.id, 'pepper', 20, 0.2, 'cooler', 'Musa Danjuma'); add(musa.id, 'tomato', 25, 4, 'open', 'Musa Danjuma'); add(musa.id, 'onion', 30, 1, 'shade', 'Musa Danjuma');
  add(amina.id, 'yam', 60, 10, 'shade', 'Hauwa Musa'); add(amina.id, 'tomato', 30, 2.6, 'basket', 'Danladi Gyang'); add(amina.id, 'maize', 40, 3, 'open', 'Esther Dung');
  save();
}
seedFresh();

const seller = (req, res, next) => ['farmer', 'agent'].includes(req.user.role) ? next() : bad(res, 'Farmers and agents only.', 403);
const mineBatch = (req, res) => { const b = db.batches.find(x => x.id === Number(req.params.id) && x.owner === req.user.id);
  if (!b) bad(res, 'Batch not found.', 404); return b; };

app.get('/api/batches', auth, seller, (req, res) =>
  res.json(db.batches.filter(b => b.owner === req.user.id && remaining(b) > 0).map(bview).sort((a, b) => a.pct - b.pct)));
app.post('/api/batches', auth, seller, (req, res) => {
  const r = createBatch(req.user.id, { ...req.body, farmer: req.user.role === 'agent' ? req.body.farmer : req.user.name });
  if (r.error) return bad(res, r.error); save(); res.json(bview(r.b));
});
app.post('/api/batches/:id/list', auth, seller, (req, res) => {
  const b = mineBatch(req, res); if (!b) return;
  if (remaining(b) <= 0) return bad(res, 'Nothing left to list.');
  const p = req.body.price === undefined ? undefined : Number(req.body.price);
  if (p !== undefined && !(p > 0 && p < 1e7)) return bad(res, 'Enter a valid price.');
  listBatch(b, p); save(); res.json(bview(b));
});
app.get('/api/batches/:id/outlets', auth, seller, (req, res) => { const b = mineBatch(req, res); if (b) res.json(outletsFor(b)); });

app.get('/api/track-record', auth, seller, (req, res) => {
  const mine = db.batches.filter(b => b.owner === req.user.id);
  res.json({ mine: rollup(mine), all: rollup(db.batches),
    tiles: { batches: mine.length, sold: mine.filter(b => b.sales.length).length,
      atRisk: mine.filter(b => remaining(b) > 0 && fresh(b).status === 'red').length } });
});

const alertText = b => { const f = fresh(b), n = CROPS[b.crop].name, who = b.farmer ? ` (${b.farmer})` : '';
  return f.expired ? `TrustHarvest: ${n}${who} passed its fresh window. Reply 2 for processors and food banks.`
    : `TrustHarvest: ${n}${who} has about ${f.daysLeft} day(s) left. Reply 1 to drop price ${Math.round(f.discount * 100)}% to N${f.suggested}, 2 for surplus buyers.`; };
app.get('/api/alerts', auth, seller, (req, res) => res.json(db.batches
  .filter(b => b.owner === req.user.id && remaining(b) > 0 && fresh(b).status !== 'green')
  .map(b => ({ batch: b.id, status: fresh(b).status, text: alertText(b) }))));
app.post('/api/sms/reply', auth, seller, (req, res) => {
  req.params.id = req.body.batch;
  const b = mineBatch(req, res); if (!b) return;
  const r = String(req.body.reply).trim();
  if (r === '1') { const f = fresh(b); if (!f.discount) return res.json({ text: 'No price drop needed. This batch is still fresh.' });
    const l = listBatch(b); save(); return res.json({ text: `Done. Listed at N${l.price} per ${b.unit.replace(/s$/, '')}.` }); }
  if (r === '2') return res.json({ text: outletsFor(b).map(o => `${o.name} (${o.kind})`).join('\n') });
  res.json({ text: 'Reply 1 or 2.' });
});

// Sensor input. A real device (for example an ESP32 with a temperature sensor) posts here with a device key.
const DEVKEY = Buffer.from(process.env.SENSOR_KEY || 'demo-sensor-key');
function setSensor(owner, storage, temp, humidity) { db.sensors[owner + ':' + storage] = { temp, humidity, at: Date.now() }; }
app.post('/api/sensor', (req, res) => {
  const k = Buffer.from(String(req.headers['x-device-key'] || ''));
  if (k.length !== DEVKEY.length || !require('crypto').timingSafeEqual(k, DEVKEY)) return bad(res, 'Bad device key.', 401);
  const u = db.users.find(x => x.phone === clean(req.body.phone, 15)), t = Number(req.body.temp), hu = Number(req.body.humidity);
  if (!u || !REF_T[req.body.storage] || !(t >= -10 && t <= 60) || !(hu >= 0 && hu <= 100)) return bad(res, 'Invalid reading.');
  setSensor(u.id, req.body.storage, t, hu); save(); res.json({ ok: true });
});
app.post('/api/sensor/demo', auth, seller, (req, res) => { // simulates a sensor from the browser for the demo
  if (req.body.temp === null) Object.keys(REF_T).forEach(s => delete db.sensors[req.user.id + ':' + s]);
  else { const t = Number(req.body.temp); if (!(t >= -10 && t <= 60)) return bad(res, 'Temperature out of range.');
    Object.keys(REF_T).forEach(s => setSensor(req.user.id, s, t, 60)); }
  save(); res.json({ ok: true });
});

// USSD-style menu (demo). In production a telecom or aggregator would call this with the caller's number.
app.post('/api/ussd', auth, seller, (req, res) => {
  const p = String(req.body.text || '').split('*').filter(x => x !== ''), ck = Object.keys(CROPS), sk = Object.keys(REF_T);
  const mine = db.batches.filter(b => b.owner === req.user.id && remaining(b) > 0);
  let out;
  if (!p.length) out = 'CON TrustHarvest\n1 My produce\n2 Log harvest';
  else if (p[0] === '1') out = 'END ' + (mine.length ? mine.map(b => { const f = fresh(b); return `${CROPS[b.crop].name} ${f.daysLeft}d ${f.status.toUpperCase()}`; }).join('\n') : 'No produce logged yet');
  else if (p[0] === '2') {
    if (p.length === 1) out = 'CON Crop:\n' + ck.map((k, i) => `${i + 1} ${CROPS[k].name}`).join('\n');
    else if (p.length === 2) out = 'CON How many?';
    else if (p.length === 3) out = 'CON Stored:\n' + sk.map((k, i) => `${i + 1} ${k}`).join('\n');
    else { const r = createBatch(req.user.id, { crop: ck[p[1] - 1], qty: p[2], storage: sk[p[3] - 1], farmer: req.user.name });
      if (r.error) out = 'END ' + r.error; else { save(); out = 'END Saved. Freshness clock started.'; } }
  } else out = 'END Invalid choice';
  res.json({ response: out });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`TrustHarvest running on http://localhost:${port}`));
