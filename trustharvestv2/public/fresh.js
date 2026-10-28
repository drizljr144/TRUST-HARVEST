/* TrustHarvest fresh.js: freshness clock, agent mode, SMS/USSD demo, 3 languages, lite mode, offline queue.
   Loaded after app.js and uses its helpers (h, api, render, run, field, note, naira...). */

// ---------- languages (Hausa and Pidgin strings should be reviewed by native speakers) ----------
const LANGS = { en: 'English', pcm: 'Pidgin', ha: 'Hausa' };
let lang = localStorage.getItem('th_lang') || 'en';
const D = {
  en: { nav_fresh: 'Fresh', nav_market: 'Market', nav_orders: 'Orders', nav_wallet: 'Wallet', nav_insights: 'Record', nav_phone: 'Phone', nav_admin: 'Fraud',
    log: 'Log your harvest', crop: 'What did you harvest?', howmany: 'How many?', when: 'When did you harvest it?', where: 'Where do you keep it?',
    start: 'Start the freshness clock', started: 'Clock started.', left: 'days left', today: 'Today', d1: 'Yesterday', d2: '2 days ago', d3: '3 days ago',
    s_open: 'Open air', s_shade: 'Shade', s_basket: 'Basket', s_cooler: 'Cooler',
    green: 'Fresh. No rush.', amber: 'Sell soon.', red: 'Sell now or send to a processor.',
    list: 'List for sale', apply: 'Apply price tip', surplus: 'Surplus buyers', read: 'Read aloud',
    c_tomato: 'Tomatoes', c_potato: 'Potatoes', c_maize: 'Maize', c_yam: 'Yam', c_onion: 'Onions', c_pepper: 'Pepper',
    farmer: 'Which farmer is this for?', mine: 'Your produce', none: 'No produce logged yet. Log your first harvest above.', tip: 'Price tip' },
  pcm: { nav_fresh: 'Fresh', nav_market: 'Market', nav_orders: 'Orders', nav_wallet: 'Wallet', nav_insights: 'Record', nav_phone: 'Phone', nav_admin: 'Fraud',
    log: 'Write wetin you harvest', crop: 'Which crop you harvest?', howmany: 'How many?', when: 'When you harvest am?', where: 'Where you dey keep am?',
    start: 'Start di freshness clock', started: 'Clock don start.', left: 'days remain', today: 'Today', d1: 'Yesterday', d2: '2 days ago', d3: '3 days ago',
    s_open: 'Open air', s_shade: 'Shade', s_basket: 'Basket', s_cooler: 'Cooler',
    green: 'E still fresh. No rush.', amber: 'Sell am soon.', red: 'Sell am now or carry am go processor.',
    list: 'Put am for sale', apply: 'Use di price tip', surplus: 'Who go buy di extra', read: 'Read am for me',
    c_tomato: 'Tomato', c_potato: 'Irish potato', c_maize: 'Maize', c_yam: 'Yam', c_onion: 'Onion', c_pepper: 'Pepper',
    farmer: 'Which farmer be dis one for?', mine: 'Your produce', none: 'You never log any produce. Log your first harvest up.', tip: 'Price tip' },
  ha: { nav_fresh: 'Sabo', nav_market: 'Kasuwa', nav_orders: 'Oda', nav_wallet: 'Kudi', nav_insights: 'Bayanai', nav_phone: 'Waya', nav_admin: 'Zamba',
    log: 'Rubuta girbin ka', crop: 'Me ka girba?', howmany: 'Nawa?', when: 'Yaushe ka girbe shi?', where: 'A ina kake ajiye shi?',
    start: 'Fara agogon sabo', started: 'An fara agogo.', left: 'kwanaki sun rage', today: 'Yau', d1: 'Jiya', d2: 'Kwana 2 da suka wuce', d3: 'Kwana 3 da suka wuce',
    s_open: 'Waje', s_shade: 'Inuwa', s_basket: 'Kwando', s_cooler: 'Mai sanyi',
    green: 'Sabo ne. Babu gaggawa.', amber: 'Ka sayar nan ba da jimawa ba.', red: 'Ka sayar yanzu ko ka kai wurin sarrafawa.',
    list: 'Sa a kasuwa', apply: 'Yi amfani da shawarar farashi', surplus: 'Masu sayen ragowa', read: 'Karanta da murya',
    c_tomato: 'Tumatir', c_potato: 'Dankalin Turawa', c_maize: 'Masara', c_yam: 'Doya', c_onion: 'Albasa', c_pepper: 'Barkono',
    farmer: 'Wane manomi ne wannan?', mine: 'Kayan gonarka', none: 'Ba ka rubuta kayan gona ba tukuna.', tip: 'Shawarar farashi' }
};
const t = k => (D[lang] && D[lang][k]) || D.en[k] || k;
const cn = k => t('c_' + k);

// ---------- lite mode, large text, voice ----------
const lite = () => { const v = localStorage.getItem('th_lite'); const c = navigator.connection;
  return v === null ? !!(c && (c.saveData || /2g/.test(c.effectiveType || ''))) : v === '1'; };
const large = () => localStorage.getItem('th_large') === '1';
function applyPrefs() {
  document.body.classList.toggle('lite', lite()); document.body.classList.toggle('large', large());
  document.documentElement.lang = lang === 'ha' ? 'ha' : 'en';
  const a = $('#litebtn'), b = $('#largebtn'); if (a) a.setAttribute('aria-pressed', String(lite())); if (b) b.setAttribute('aria-pressed', String(large()));
}
function toggleLite() { localStorage.setItem('th_lite', lite() ? '0' : '1'); applyPrefs();
  if (!token) { stopSlides(); $('#hero').replaceChildren(); } render(); }
function toggleLarge() { localStorage.setItem('th_large', large() ? '0' : '1'); applyPrefs(); }
function speak(text) { if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text); u.lang = lang === 'ha' ? 'ha' : 'en-NG'; speechSynthesis.cancel(); speechSynthesis.speak(u); }
function mountTools() {
  const hd = document.querySelector('header'); if (!hd || $('#tools')) return;
  const sel = h('select', { id: 'lang', 'aria-label': 'Language', onchange: e => { lang = e.target.value; localStorage.setItem('th_lang', lang); applyPrefs(); render(); } },
    Object.entries(LANGS).map(([k, v]) => h('option', { value: k, ...(k === lang ? { selected: 'selected' } : {}) }, v)));
  hd.insertBefore(h('div', { id: 'tools' }, sel,
    h('button', { id: 'litebtn', type: 'button', 'aria-pressed': 'false', 'aria-label': 'Lite mode', onclick: toggleLite }, '⚡ Lite'),
    h('button', { id: 'largebtn', type: 'button', 'aria-pressed': 'false', 'aria-label': 'Large text', onclick: toggleLarge }, 'A+')), $('#who'));
}

// ---------- helpers ----------
const CROPS_UI = [['tomato', '🍅'], ['potato', '🥔'], ['maize', '🌽'], ['yam', '🍠'], ['onion', '🧅'], ['pepper', '🌶️']];
const STORE_UI = [['open', '☀️'], ['shade', '🌳'], ['basket', '🧺'], ['cooler', '❄️']];
const FACE = { green: '😀', amber: '😐', red: '😟' };
const EMO = [['tomato', '🍅'], ['potato', '🥔'], ['maize', '🌽'], ['corn', '🌽'], ['yam', '🍠'], ['onion', '🧅'], ['pepper', '🌶️']];
function emojiFor(c) { const k = String(c).toLowerCase(); const m = EMO.find(([x]) => k.includes(x)); return m ? m[1] : null; }
const SELL = () => me && ['farmer', 'agent'].includes(me.role);
const redraw = () => $('#app').replaceChildren(VIEWS[tab]());
function freshChip(f) { return f ? h('span', { class: 'chip st-' + f.status }, FACE[f.status] + ' ' + f.daysLeft + ' ' + t('left')) : []; }
function pickGrid(items, cur, label, onpick) {
  return h('div', { class: 'pick', role: 'group', 'aria-label': label }, items.map(([k, e, txt]) =>
    h('button', { type: 'button', class: 'pb' + (cur === k ? ' on' : ''), 'aria-pressed': String(cur === k), onclick: () => onpick(k) },
      h('span', { class: 'em', 'aria-hidden': 'true' }, e), h('span', {}, txt))));
}

// ---------- offline queue ----------
const rq = () => { try { return JSON.parse(localStorage.getItem('th_queue') || '[]'); } catch { return []; } };
const wq = a => localStorage.setItem('th_queue', JSON.stringify(a));
async function sync() {
  const q = rq(); if (!q.length || !token || !navigator.onLine) return;
  const left = [];
  for (const p of q) { try { await api('/batches', 'POST', p); } catch (e) { if (e instanceof TypeError) left.push(p); } }
  wq(left); if (tab === 'fresh') render();
}
addEventListener('online', sync);

// ---------- state ----------
let FR = { crop: 'tomato', qty: 10, days: 0, storage: 'open', farmer: '' }, batches = [], rec = null, alerts = [], replies = {}, outlets = {};
let ussd = { text: '', screen: '', over: false };
const step = () => FR.qty >= 50 ? 10 : FR.qty >= 20 ? 5 : 1;

async function addBatch() {
  msg = {};
  if (me.role === 'agent' && !FR.farmer.trim()) { msg = { fr: t('farmer') }; return redraw(); }
  const p = { crop: FR.crop, qty: FR.qty, storage: FR.storage, farmer: FR.farmer, harvested: new Date(Date.now() - FR.days * 864e5).toISOString() };
  try { await api('/batches', 'POST', p); msg = { frOk: '✅ ' + t('started') }; FR.qty = 10; batches = await api('/batches'); }
  catch (e) { if (e instanceof TypeError || !navigator.onLine) { wq([...rq(), p]); msg = { frOk: '📴 Saved on this phone. It will sync when you are online.' }; } else msg = { fr: e.message }; }
  redraw();
}
async function listIt(b) { await run('fr', () => api('/batches/' + b.id + '/list', 'POST', {})); }
async function showOutlets(b) { try { outlets[b.id] = await api('/batches/' + b.id + '/outlets'); } catch (e) { msg = { fr: e.message }; } redraw(); }
const sens = v => run('fr', () => api('/sensor/demo', 'POST', { temp: v }));

function batchCard(b) {
  return h('div', { class: 'card batch st-' + b.status },
    h('div', { class: 'row' },
      h('div', { class: 'bhead' }, h('span', { class: 'em big', 'aria-hidden': 'true' }, emojiFor(b.cropName) || '🌿'),
        h('div', {}, h('b', {}, cn(b.crop) + ' · ' + b.remaining + ' ' + b.unit),
          h('div', { class: 'mute' }, t('s_' + b.storage) + (b.farmer && me.role === 'agent' ? ' · ' + b.farmer : '')))),
      h('div', { class: 'clock' }, h('span', { class: 'face', 'aria-hidden': 'true' }, FACE[b.status]), h('b', {}, b.daysLeft + ' ' + t('left')))),
    h('div', { class: 'meter', role: 'img', 'aria-label': b.pct + '%' }, h('span', { style: `width:${b.pct}%` })),
    h('p', { class: 'status' }, t(b.status)),
    b.discount ? h('p', {}, '💡 ' + t('tip') + ': ' + naira(b.suggested) + ' (−' + Math.round(b.discount * 100) + '%)' + (b.expired ? ' · processing grade' : '')) : [],
    b.sensor ? h('p', { class: 'mute' }, '📡 ' + b.sensor.temp + '°C · ' + b.sensor.humidity + '% humidity (adjusts the clock)') : [],
    h('div', { class: 'acts' },
      h('button', { onclick: () => listIt(b) }, (b.listing ? '💡 ' + t('apply') : '🛒 ' + t('list')) + ' ' + naira(b.suggested)),
      b.status !== 'green' ? h('button', { class: 'alt', onclick: () => showOutlets(b) }, '♻️ ' + t('surplus')) : [],
      h('button', { class: 'alt', 'aria-label': t('read'), title: t('read'), onclick: () => speak(`${cn(b.crop)}. ${b.daysLeft} ${t('left')}. ${t(b.status)}`) }, '🔊')),
    outlets[b.id] ? h('div', { class: 'mute' }, outlets[b.id].map(o => h('div', {}, '• ' + o.name + ' (' + o.kind + ')'))) : []);
}

function freshView() {
  const names = [...new Set(batches.map(b => b.farmer).filter(Boolean))], q = rq();
  const out = [h('h2', {}, '🌱 ' + t('log'))];
  if (q.length) out.push(h('div', { class: 'card warnbox' }, '📴 ' + q.length + ' harvest(s) saved on this phone, waiting to sync.'));
  out.push(h('div', { class: 'card' },
    me.role === 'agent' ? [h('label', { for: 'fn' }, t('farmer')), h('input', { id: 'fn', value: FR.farmer, placeholder: 'e.g. Hauwa Musa', oninput: e => { FR.farmer = e.target.value; } }),
      h('div', { class: 'chips' }, names.map(n => h('button', { type: 'button', class: FR.farmer === n ? 'on' : '', onclick: () => { FR.farmer = n; redraw(); } }, n)))] : [],
    h('b', {}, t('crop')), pickGrid(CROPS_UI.map(([k, e]) => [k, e, cn(k)]), FR.crop, t('crop'), k => { FR.crop = k; redraw(); }),
    h('b', {}, t('howmany')),
    h('div', { class: 'stepper' }, h('button', { type: 'button', 'aria-label': 'Less', onclick: () => { FR.qty = Math.max(1, FR.qty - step()); redraw(); } }, '−'),
      h('input', { id: 'fq', type: 'number', inputmode: 'numeric', min: 1, value: FR.qty, 'aria-label': t('howmany'), oninput: e => { FR.qty = +e.target.value; } }),
      h('button', { type: 'button', 'aria-label': 'More', onclick: () => { FR.qty += step(); redraw(); } }, '+')),
    h('b', {}, t('when')), pickGrid([[0, '🌞', t('today')], [1, '🌤️', t('d1')], [2, '⛅', t('d2')], [3, '☁️', t('d3')]], FR.days, t('when'), k => { FR.days = k; redraw(); }),
    h('b', {}, t('where')), pickGrid(STORE_UI.map(([k, e]) => [k, e, t('s_' + k)]), FR.storage, t('where'), k => { FR.storage = k; redraw(); }),
    note('fr'), msg.frOk ? h('div', { class: 'ok', role: 'status' }, msg.frOk) : [],
    h('button', { class: 'bigbtn', onclick: addBatch }, '⏱️ ' + t('start'))));
  out.push(h('h2', {}, t('mine')));
  if (!batches.length) out.push(h('p', { class: 'mute' }, t('none')));
  batches.forEach(b => out.push(batchCard(b)));
  out.push(h('details', { class: 'card' }, h('summary', {}, '📡 Sensor demo'),
    h('p', { class: 'mute' }, 'A real sensor (for example an ESP32 with a temperature probe) posts readings to /api/sensor. Simulate one here and watch the clocks change:'),
    h('div', { class: 'acts' }, h('button', { class: 'alt', onclick: () => sens(38) }, '🔥 Hot room 38°C'),
      h('button', { class: 'alt', onclick: () => sens(10) }, '❄️ Cool room 10°C'), h('button', { class: 'alt', onclick: () => sens(null) }, 'Clear'))));
  return h('div', {}, out);
}

// ---------- track record ----------
const tile = (n, l) => h('div', { class: 'tile' }, h('b', {}, n), h('span', {}, l));
function barRow(r) {
  const w = Math.min(100, Math.round(r.avgDays / r.expectedLife * 100));
  return h('div', { class: 'brow' }, h('div', {}, h('b', {}, cn(r.crop)), ' · ' + t('s_' + r.storage)),
    h('div', { class: 'meter' }, h('span', { style: `width:${w}%` })), h('div', { class: 'mute' }, `${r.avgDays} days held before sale (assumed shelf life ${r.expectedLife})`));
}
function insightsView() {
  const out = [h('h2', {}, '📊 ' + t('nav_insights')), h('div', { class: 'tiles' }, tile(rec.tiles.batches, 'Batches logged'), tile(rec.tiles.sold, 'Sold'), tile(rec.tiles.atRisk, 'At risk now'))];
  const by = {}; rec.mine.forEach(r => (by[r.crop] ||= []).push(r));
  Object.entries(by).filter(([, a]) => a.length > 1).forEach(([c, a]) => { const s = [...a].sort((x, y) => y.avgDays - x.avgDays), hi = s[0], lo = s[s.length - 1];
    out.push(h('div', { class: 'card tip' }, '💡 ' + cn(c) + ': held ' + hi.avgDays + ' days before sale in ' + t('s_' + hi.storage) + ', but only ' + lo.avgDays + ' in ' + t('s_' + lo.storage) + '.')); });
  out.push(h('h2', {}, 'Your record')); rec.mine.length ? rec.mine.forEach(r => out.push(h('div', { class: 'card' }, barRow(r)))) : out.push(h('p', { class: 'mute' }, 'Sales will appear here.'));
  out.push(h('h2', {}, 'All users (anonymous)')); rec.all.forEach(r => out.push(h('div', { class: 'mute' }, `${cn(r.crop)} · ${t('s_' + r.storage)}: ${r.avgDays} days (${r.sales} sales)`)));
  return h('div', {}, out);
}

// ---------- SMS and USSD demo ----------
async function smsReply(a, r) { try { const x = await api('/sms/reply', 'POST', { batch: a.batch, reply: r }); (replies[a.batch] ||= []).push('You: ' + r, 'TrustHarvest: ' + x.text); } catch (e) { msg = { ph: e.message }; } redraw(); }
async function ussdCall(text) { const r = await api('/ussd', 'POST', { text }); ussd.screen = r.response.replace(/^(CON|END) /, ''); ussd.over = r.response.startsWith('END'); }
async function ussdStart() { ussd = { text: '', screen: '', over: false }; await ussdCall(''); }
async function ussdAnswer() { const a = ($('#ua').value || '').trim(); if (!a) return; ussd.text = ussd.text ? ussd.text + '*' + a : a; await ussdCall(ussd.text); redraw(); }
function phoneView() {
  return h('div', {}, h('h2', {}, '📱 SMS and USSD (demo)'),
    h('p', { class: 'mute' }, 'Farmers on basic phones get alerts by SMS and can reply with a number. No real messages are sent in this demo.'),
    h('div', { class: 'phone' }, h('div', { class: 'ptop' }, '💬 SMS · TrustHarvest'),
      alerts.length ? alerts.map(a => h('div', {}, h('div', { class: 'bubble in' }, a.text),
        (replies[a.batch] || []).map((x, i) => h('div', { class: 'bubble ' + (i % 2 ? 'in' : 'out') }, x)),
        h('div', { class: 'acts' }, h('button', { class: 'alt', onclick: () => smsReply(a, '1') }, 'Reply 1'), h('button', { class: 'alt', onclick: () => smsReply(a, '2') }, 'Reply 2'))))
        : h('div', { class: 'bubble in' }, 'No alerts. All your produce is fresh.'), note('ph')),
    h('div', { class: 'phone' }, h('div', { class: 'ptop' }, '☎️ USSD · dial *123# (demo code)'),
      h('pre', { class: 'screen' }, ussd.screen),
      ussd.over ? h('button', { onclick: async () => { await ussdStart(); redraw(); } }, 'Dial again')
        : h('div', { class: 'stepper' }, h('input', { id: 'ua', inputmode: 'numeric', 'aria-label': 'Your answer', onkeydown: e => { if (e.key === 'Enter') ussdAnswer(); } }), h('button', { onclick: ussdAnswer }, 'Send'))));
}

// ---------- wiring into app.js ----------
function tabsFor() {
  const T = (k, i) => [k, i + ' ' + t('nav_' + k)];
  if (me.role === 'admin') return [T('market', '🛒'), T('orders', '📦'), T('wallet', '👛'), T('admin', '🛡️')];
  if (SELL()) return [T('fresh', '🌱'), T('market', '🛒'), T('orders', '📦'), T('insights', '📊'), T('phone', '📱'), T('wallet', '👛')];
  return [T('market', '🛒'), T('orders', '📦'), T('wallet', '👛')];
}
Object.assign(VIEWS, { fresh: freshView, insights: insightsView, phone: phoneView });
async function loadFresh() {
  if (!SELL()) return;
  if (tab === 'fresh') batches = await api('/batches');
  if (tab === 'insights') rec = await api('/track-record');
  if (tab === 'phone') { alerts = await api('/alerts'); if (!ussd.screen) await ussdStart(); }
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
(async () => {
  if (token) { try { await refreshMe(); if (SELL()) tab = 'fresh'; } catch { /* logged out by api() */ } }
  mountTools(); applyPrefs(); sync(); render();
})();
