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


const IMG = [['tomato','tomatoes'],['potato','potatoes'],['maize','maize'],['corn','maize'],['yam','yam'],['onion','onions'],['pepper','pepper']];
function photoFor(crop) { const c = String(crop).toLowerCase(); const m = IMG.find(([k]) => c.includes(k)); return m ? `/images/${m[1]}.webp` : null; }
function photo(crop) {
  const box = h('div', { class: 'photo' });
  const ph = () => box.replaceChildren(h('div', { class: 'ph', 'aria-hidden': 'true' }, emojiFor(crop) || (crop || '?')[0].toUpperCase()));
  const src = photoFor(crop);
  if (!src || lite()) { ph(); return box; }
  const img = h('img', { src, alt: crop + ' for sale', loading: 'lazy' });
  img.addEventListener('error', ph);
  box.append(img); return box;
}

const SLIDES = [
  ['hero1', 'Sell it before it spoils.', 'Know how many days your harvest has left, and get paid safely.', 'A smiling tomato farmer with baskets of harvest', '50% 30%', 'before it spoils.'],
  ['hero2', 'Every day counts after harvest.', 'A freshness clock for every crate, basket and bag.', 'A man leading a donkey with a load past a warehouse', '75% 50%', 'counts'],
  ['hero3', 'Know before it wilts.', 'Alerts by SMS, in English, Pidgin or Hausa.', 'Hands gripping a wooden pestle over harvested grain', '55% 50%', 'wilts.'],
  ['hero4', 'The right storage saves the harvest.', 'See which method keeps your produce fresh longest.', 'A farmer walking through rows of vines in a greenhouse', '45% 40%', 'saves the harvest.'],
  ['hero5', 'Sell fast, at a fair price.', 'Smart price tips as your produce ages, no guesswork.', 'A trader sorting okra at an open-air market', '50% 35%', 'fair price.'],
  ['hero6', 'Less waste. More income.', 'Surplus goes to processors instead of the bin.', 'A farmer in his field holding fresh tomatoes', '45% 30%', 'More income.']
];
let slideTimer = null;
function stopSlides() { clearInterval(slideTimer); slideTimer = null; }
function slideshow() {
  stopSlides();
  let i = 0;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const slides = SLIDES.map(([f, t, s, alt, position, keyPhrase], n) => {
    const img = h('img', { src: `/images/${f}.webp`, alt, loading: n === 0 ? 'eager' : 'lazy', style: `object-position:${position}` });
    const phraseAt = t.indexOf(keyPhrase);
    const title = h('h1', {}, t.slice(0, phraseAt), h('span', { class: 'hero-highlight' }, keyPhrase), t.slice(phraseAt + keyPhrase.length));
    const actions = h('div', { class: 'hero-actions' },
      h('button', { class: 'hero-cta primary', onclick: () => goToAuth(true) }, 'Create an account'),
      h('button', { class: 'hero-cta secondary', onclick: () => goToAuth(false) }, 'Log in'));
    const proof = h('div', { class: 'hero-proof' }, 'Alerts by SMS · Works on any phone · Escrow-protected');
    const cap = h('div', { class: 'cap', 'aria-live': n === 0 ? 'polite' : 'off' }, title, h('p', {}, s), actions, proof);
    const photo = h('div', { class: 'slide-photo' },
      h('div', { class: 'slide-image' }, img),
      h('div', { class: 'slide-thumbnails', 'aria-label': 'Choose a hero photo' }, SLIDES.map(([file, , , thumbnailAlt], thumbnailIndex) => {
        const thumbnail = h('img', { src: `/images/${file}.webp`, alt: `Slide ${thumbnailIndex + 1}: ${thumbnailAlt}`, loading: 'lazy' });
        return h('button', {
          class: 'slide-thumbnail' + (thumbnailIndex === n ? ' on' : ''),
          type: 'button',
          'aria-label': `Show slide ${thumbnailIndex + 1}: ${thumbnailAlt}`,
          'aria-current': thumbnailIndex === n ? 'true' : 'false',
          disabled: n !== 0,
          onclick: () => go(thumbnailIndex, true)
        }, thumbnail);
      })),
      h('div', { class: 'hero-demo-card payment' }, h('b', {}, 'Tomatoes: about 2 days left'), h('small', {}, 'Demo')),
      h('div', { class: 'hero-demo-card trust-score' }, h('b', {}, 'Price tip: lower by 15% today'), h('small', {}, 'Demo')));
    return h('div', { class: 'slide' + (n === 0 ? ' on' : ''), 'aria-hidden': n !== 0 }, photo, cap);
  });
  const bar = h('div', { class: 'bar' });
  const dots = SLIDES.map((_, n) => h('button', { 'aria-label': 'Show slide ' + (n + 1), onclick: () => go(n, true) }));
  function go(n, manual) {
    i = (n + SLIDES.length) % SLIDES.length;
    slides.forEach((s, k) => {
      s.classList.toggle('on', k === i);
      s.setAttribute('aria-hidden', k !== i);
      s.querySelector('.cap').setAttribute('aria-live', k === i ? 'polite' : 'off');
      s.querySelectorAll('.slide-thumbnail').forEach(thumbnail => { thumbnail.disabled = k !== i; });
    });
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
    slides.forEach(slide => slide.querySelectorAll('.slide-thumbnail').forEach((thumbnail, k) => {
      const active = k === i;
      thumbnail.classList.toggle('on', active);
      thumbnail.setAttribute('aria-current', active ? 'true' : 'false');
    }));
    const nxt = new Image(); nxt.src = `/images/${SLIDES[(i + 1) % SLIDES.length][0]}.webp`;
    bar.classList.remove('run'); void bar.offsetWidth;
    if (!reduce) { bar.classList.add('run'); if (manual) start(); }
  }
  const start = () => { stopSlides(); if (!reduce) slideTimer = setInterval(() => go(i + 1), 6000); };
  const box = h('section', { class: 'slides', 'aria-roledescription': 'carousel', 'aria-label': 'TrustHarvest highlights', tabindex: '0' },
    slides, bar, h('div', { class: 'dots' }, dots));
  const mk = (cls, txt, label, d) => h('button', { class: 'arrow ' + cls, 'aria-label': label, onclick: () => go(i + d, true) }, txt);
  box.append(mk('l', '\u2039', 'Previous slide', -1), mk('r', '\u203a', 'Next slide', 1));
  box.addEventListener('mouseenter', stopSlides); box.addEventListener('mouseleave', start);
  box.addEventListener('keydown', e => { if (e.key === 'ArrowRight') go(i + 1, true); if (e.key === 'ArrowLeft') go(i - 1, true); });
  let x0 = null;
  box.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; stopSlides(); }, { passive: true });
  box.addEventListener('touchend', e => { if (x0 !== null) { const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1), true); else start(); } x0 = null; }, { passive: true });
  go(0); start();
  return box;
}
function goToAuth(create) {
  const app = $('#app');
  const toggleText = create ? 'Create an account' : 'I have an account';
  const toggle = [...app.querySelectorAll('button')].find(button => button.textContent.trim() === toggleText);
  if (toggle) toggle.click();
  app.scrollIntoView();
}

const STEPS = [['Buyer pays into escrow', 'The money leaves the buyer and is held safely. Nobody can touch it yet.'],
  ['Farmer delivers', 'The farmer marks the order delivered once the produce reaches the buyer.'],
  ['Payment is released', 'The buyer confirms and the money goes straight to the farmer\u2019s wallet.']];
function landing() {
  return h('div', {},
    h('section', { class: 'landing-section' },
      h('h2', {}, 'How TrustHarvest works'),
      h('div', { class: 'steps' }, STEPS.map(([t, d], n) => h('div', { class: 'card' }, h('b', {}, (n + 1) + '. ' + t), h('span', { class: 'mute' }, d)))),
    ),
    h('section', { class: 'landing-section' },
      h('h2', {}, 'What farmers sell here'),
      h('div', { class: 'strip' }, [['tomatoes', 'Tomatoes'], ['potatoes', 'Potatoes'], ['yam', 'Yam'], ['maize', 'Maize'], ['pepper', 'Pepper'], ['onions', 'Onions']].map(([f, n]) => {
        const d = h('div', {}, h('img', { src: `/images/${f}.webp`, alt: n, loading: 'lazy' }), h('span', {}, n));
        d.querySelector('img').addEventListener('error', () => d.remove()); return d; })),
    ),
    h('section', { class: 'landing-section' },
      h('h2', {}, 'Your days-held record'),
      h('div', { class: 'card' }, 'Every sale records how long your produce lasted and how you stored it, so you learn which storage method works best. Your trust score still grows with every completed trade.'),
      h('p', { class: 'mute' }, 'Demo: payments are simulated. Built for HackJos 2026.')));
}

function authView() {
  const reg = msg.mode === 'register';
  return h('div', {},
    h('div', { class: 'card', style: 'margin-top:16px' },
      reg ? field('Your name', 'name') : [],
      ...field('Phone number', 'phone', 'tel'),
      ...field('Password', 'pw', 'password'),
      reg ? [h('label', { for: 'role' }, 'I am a'), h('select', { id: 'role' },
        h('option', { value: 'farmer' }, 'Farmer'), h('option', { value: 'agent' }, 'Cooperative agent'), h('option', { value: 'buyer' }, 'Buyer'))] : [],
      note('auth'),
      h('div', { class: 'acts' },
        h('button', { onclick: () => run('auth', async () => {
          const r = await api(reg ? '/register' : '/login', 'POST', { name: reg ? val('name') : '',
            phone: val('phone'), password: val('pw'), role: reg ? val('role') : '' });
          token = r.token; sessionStorage.setItem('th', token); tab = ['farmer', 'agent'].includes(r.user.role) ? 'fresh' : 'market';
        }) }, reg ? 'Create account' : 'Log in'),
        h('button', { class: 'alt', onclick: () => { msg = { mode: reg ? 'login' : 'register' }; render(); } },
          reg ? 'I have an account' : 'Create an account')),
      h('p', { class: 'mute' }, 'Demo logins (password pass1234): farmer 0803000001, cooperative agent 0803000004, buyer 0803000003, admin 0800000000.')),
    landing());
}

function trustBar(t) { return h('div', { class: 'trust', title: 'Trust score ' + t }, h('span', { style: `width:${t}%` })); }
function verBadge(v) { return h('span', { class: 'badge' + (v ? '' : ' no') }, v ? 'Verified' : 'Not verified'); }

let listings = [], orders = [], flags = null, filter = 'All', q = '';
async function load() {
  if (tab === 'market') listings = await api('/listings');
  if (tab === 'orders') orders = await api('/orders');
  if (tab === 'admin') flags = await api('/fraud-flags');
  await loadFresh();
}

function marketView() {
  const out = [h('h2', {}, ['farmer', 'agent'].includes(me.role) ? 'Your produce on the market' : 'Fresh produce')];
  if (['farmer', 'agent'].includes(me.role)) out.push(h('div', { class: 'card mute' }, '🌱 List produce from the Fresh tab, so its freshness clock travels with the listing.'));
  if (!listings.length) out.push(h('p', { class: 'mute' }, 'No produce listed yet. Farmers can add some above.'));
  out.push(h('input', { type: 'search', placeholder: 'Search crops', value: q, 'aria-label': 'Search crops', oninput: e => { q = e.target.value; render(); } }));
  out.push(h('div', { class: 'chips' }, ['All', 'Tomatoes', 'Potatoes', 'Yam', 'Maize', 'Pepper', 'Onions'].map(c => h('button', { class: filter === c ? 'on' : '', onclick: () => { filter = c; render(); } }, c))));
  const shown = listings.filter(l => (filter === 'All' || l.crop.toLowerCase().includes(filter.toLowerCase().replace(/e?s$/, ''))) && l.crop.toLowerCase().includes(q.toLowerCase()));
  shown.forEach(l => out.push(h('div', { class: 'card' },
    photo(l.crop), freshChip(l.fresh),
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

const VIEWS = { market: marketView, orders: ordersView, wallet: walletView, admin: adminView };
async function render() {
  const app = $('#app'), nav = $('#nav');
  if (!token) {
    nav.hidden = true; $('#who').textContent = '';
    if (!$('#hero').firstChild && !lite()) $('#hero').replaceChildren(slideshow());
    app.replaceChildren(authView()); return;
  }
  stopSlides(); $('#hero').replaceChildren();
  try { if (!me) await refreshMe(); await load(); } catch { return; }
  $('#who').textContent = me.name;
  const tabs = tabsFor();
  nav.hidden = false;
  nav.replaceChildren(...tabs.map(([k, t]) => h('button', { class: tab === k ? 'on' : '', onclick: () => { tab = k; msg = {}; render(); } }, t)));
  const v = VIEWS[tab] || marketView;
  app.replaceChildren(v());
}
