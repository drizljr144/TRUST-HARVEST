const $ = s => document.querySelector(s);
const naira = n => '₦' + Number(n).toLocaleString('en-NG');
let token = sessionStorage.getItem('th'), me = null, tab = 'market', msg = {};

function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'class') e.className = v;
    else e.setAttribute(k, v);
  }
  kids.flat().forEach(c => e.append(c instanceof Node ? c : document.createTextNode(c ?? '')));
  return e;
}
async function api(path, method = 'GET', body) {
  const r = await fetch('/api' + path, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  const j = await r.json();
  if (r.status === 401 && token) { logout(); }
  if (!r.ok) throw new Error(j.error || 'Something went wrong.');
  return j;
}
function logout() { token = null; me = null; sessionStorage.removeItem('th'); render(); }
function field(label, id, type = 'text', val = '') {
  return [h('label', { for: id }, label), h('input', { id, type, value: val, autocomplete: 'off' })];
}
const val = id => $('#' + id).value;
const note = (k, cls = 'err') => h('div', { class: cls, role: 'status' }, msg[k] || '');
async function run(k, fn) {
  try { msg = {}; await fn(); await refreshMe(); } catch (e) { msg = { [k]: e.message }; }
  render();
}
async function refreshMe() { if (token) me = await api('/me'); }

function authView() {
  const reg = msg.mode === 'register';
  return h('div', {},
    h('div', { class: 'hero' }, h('h1', {}, 'Sell produce. Get paid. Every time.'),
      h('p', {}, 'Buyer money is held safely until delivery is confirmed.')),
    h('div', { class: 'card' },
      reg ? field('Your name', 'name') : [],
      ...field('Phone number', 'phone', 'tel'),
      ...field('Password', 'pw', 'password'),
      reg ? [h('label', { for: 'role' }, 'I am a'), h('select', { id: 'role' },
        h('option', { value: 'farmer' }, 'Farmer'), h('option', { value: 'buyer' }, 'Buyer'))] : [],
      note('auth'),
      h('div', { class: 'acts' },
        h('button', { onclick: () => run('auth', async () => {
          const r = await api(reg ? '/register' : '/login', 'POST', { name: reg ? val('name') : '',
            phone: val('phone'), password: val('pw'), role: reg ? val('role') : '' });
          token = r.token; sessionStorage.setItem('th', token); tab = 'market';
        }) }, reg ? 'Create account' : 'Log in'),
        h('button', { class: 'alt', onclick: () => { msg = { mode: reg ? 'login' : 'register' }; render(); } },
          reg ? 'I have an account' : 'Create an account')),
      h('p', { class: 'mute' }, 'Demo logins (password pass1234): farmer 0803000001, buyer 0803000003. Admin 0800000000 uses admin password pass1234.')));
}

function trustBar(t) { return h('div', { class: 'trust', title: 'Trust score ' + t }, h('span', { style: `width:${t}%` })); }
function verBadge(v) { return h('span', { class: 'badge' + (v ? '' : ' no') }, v ? 'Verified' : 'Not verified'); }

let listings = [], orders = [], flags = null;
async function load() {
  if (tab === 'market') listings = await api('/listings');
  if (tab === 'orders') orders = await api('/orders');
  if (tab === 'admin') flags = await api('/fraud-flags');
}

function marketView() {
  const out = [h('h2', {}, me.role === 'farmer' ? 'Your produce on the market' : 'Fresh produce')];
  if (me.role === 'farmer') out.push(h('div', { class: 'card' },
    h('b', {}, 'List new produce'),
    ...field('Crop', 'crop'), ...field('Quantity', 'qty', 'number'), ...field('Unit (baskets, bags...)', 'unit'),
    ...field('Price per unit (₦)', 'price', 'number'), ...field('Location', 'loc'), note('list'),
    h('button', { onclick: () => run('list', async () => {
      await api('/listings', 'POST', { crop: val('crop'), qty: val('qty'), unit: val('unit'), price: val('price'), loc: val('loc') });
      listings = await api('/listings');
    }) }, 'List produce')));
  if (!listings.length) out.push(h('p', { class: 'mute' }, 'No produce listed yet. Farmers can add some above.'));
  listings.forEach(l => out.push(h('div', { class: 'card' },
    h('div', { class: 'row' }, h('div', {}, h('b', {}, l.crop), h('div', { class: 'mute' }, `${l.qty} ${l.unit} left · ${l.loc || 'Plateau'}`)),
      h('div', { class: 'price' }, naira(l.price) + ' / ' + l.unit)),
    h('div', { class: 'row', style: 'margin-top:8px' }, h('span', {}, l.farmerName + ' '), verBadge(l.farmerVerified)),
    trustBar(l.farmerTrust),
    me.role === 'buyer' ? h('div', { class: 'acts' },
      h('input', { id: 'q' + l.id, type: 'number', min: 1, max: l.qty, value: 1, style: 'width:90px;margin:0', 'aria-label': 'Quantity' }),
      h('button', { onclick: () => run('buy', async () => {
        await api('/orders', 'POST', { listing: l.id, qty: val('q' + l.id) }); tab = 'orders';
      }) }, 'Buy with escrow')) : [])));
  out.push(note('buy'));
  return h('div', {}, out);
}

const STAGES = [['PAID_ESCROW', 'Paid'], ['DELIVERED', 'Delivered'], ['RELEASED', 'Released']];
function ordersView() {
  const out = [h('h2', {}, 'Your orders')];
  if (!orders.length) out.push(h('p', { class: 'mute' }, 'No orders yet. Buy produce from the Market tab.'));
  orders.forEach(o => {
    const idx = STAGES.findIndex(s => s[0] === o.status);
    const odd = ['DISPUTED', 'REFUNDED'].includes(o.status);
    const act = (label, path, cls = '') => h('button', { class: cls, onclick: () => run('ord', async () => {
      await api(`/orders/${o.id}/${path}`, 'POST'); orders = await api('/orders'); }) }, label);
    out.push(h('div', { class: 'card' },
      h('div', { class: 'row' }, h('div', {}, h('b', {}, `${o.qty} ${o.unit} ${o.crop}`),
        h('div', { class: 'mute' }, `${o.farmerName} → ${o.buyerName}`)), h('div', { class: 'price' }, naira(o.total))),
      odd ? h('p', { class: 'err' }, o.status === 'DISPUTED' ? 'Disputed. Funds are held until an admin decides.' : 'Refunded to the buyer.')
        : h('div', { class: 'track' }, STAGES.map((s, i) => h('div', { class: i <= idx ? 'done' : '' }, s[1]))),
      h('div', { class: 'acts' },
        me.id === o.farmer && o.status === 'PAID_ESCROW' ? act('Mark as delivered', 'deliver') : [],
        me.id === o.buyer && o.status === 'DELIVERED' ? act('Confirm delivery, release payment', 'confirm') : [],
        ['PAID_ESCROW', 'DELIVERED'].includes(o.status) ? act('Report a problem', 'dispute', 'warn') : [],
        me.role === 'admin' && o.status === 'DISPUTED' ? [act('Pay farmer', 'resolve'), act('Refund buyer', 'resolve', 'alt')] : [])));
  });
  out.push(note('ord'));
  return h('div', {}, out);
}

function walletView() {
  return h('div', {},
    h('h2', {}, 'Wallet and profile'),
    h('div', { class: 'card' }, h('div', { class: 'mute' }, 'Balance'), h('div', { class: 'big' }, naira(me.wallet)),
      ...field('Add money (demo, no real charge)', 'amt', 'number', '50000'), note('wal'),
      h('button', { onclick: () => run('wal', () => api('/wallet/topup', 'POST', { amount: val('amt') })) }, 'Add money')),
    h('div', { class: 'card' }, h('b', {}, me.name + ' '), verBadge(me.verified),
      h('div', { class: 'mute' }, 'Trust score ' + me.trust + ' out of 100. It grows with every completed trade.'),
      trustBar(me.trust),
      me.verified ? [] : h('div', { class: 'acts' }, h('button', { class: 'alt', onclick: () => run('ver', () => api('/verify', 'POST')) }, 'Verify my account (demo)'))),
    h('button', { class: 'alt', onclick: logout }, 'Log out'));
}

function adminView() {
  const out = [h('h2', {}, 'Fraud flags')];
  if (!flags.flags.length) out.push(h('p', { class: 'mute' }, 'No accounts flagged right now.'));
  flags.flags.forEach(f => out.push(h('div', { class: 'card' }, h('b', {}, f.name), h('div', { class: 'err' }, f.reason),
    h('div', { class: 'mute' }, `Trust ${f.trust} · ${f.disputes} disputes · wallet ${naira(f.wallet)}`))));
  out.push(h('h2', {}, 'Audit log'));
  flags.audit.forEach(a => out.push(h('div', { class: 'mute' }, `${new Date(a.at).toLocaleTimeString()} · order ${a.orderId}: ${a.from} to ${a.to} by ${a.actor}`)));
  return h('div', {}, out);
}

async function render() {
  const app = $('#app'), nav = $('#nav');
  if (!token) { nav.hidden = true; $('#who').textContent = ''; app.replaceChildren(authView()); return; }
  try { if (!me) await refreshMe(); await load(); } catch { return; }
  $('#who').textContent = me.name;
  const tabs = [['market', 'Market'], ['orders', 'Orders'], ['wallet', 'Wallet'], ...(me.role === 'admin' ? [['admin', 'Fraud']] : [])];
  nav.hidden = false;
  nav.replaceChildren(...tabs.map(([k, t]) => h('button', { class: tab === k ? 'on' : '', onclick: () => { tab = k; msg = {}; render(); } }, t)));
  const v = { market: marketView, orders: ordersView, wallet: walletView, admin: adminView }[tab];
  app.replaceChildren(v());
}
render();
