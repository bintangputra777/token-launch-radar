// Token Radar's dashboard. It reads window.RADAR (written beside dashboard/ by main.ts) and renders
// the ranked board, filters, a per-protocol detail drawer with the model's own inputs and the
// protocol's farm plan, and a model sandbox. No network: every byte it shows is in data.js.
//
// The pure block below (PURE-START to PURE-END) is the model's arithmetic in the page, the same
// function main.ts runs: implied value from TVL, seven-day growth, age and chain count, and the farm
// plan from category, chains, TVL and age. The page recomputes every row and checks the number
// board.json carries, so the page's code and the board's data are visibly the same arithmetic.
(function () {
  'use strict';
  /* PURE-START */
  function clampGrowth(c, m) { return Math.min(m.growth_cap, Math.max(m.growth_floor, c === null || c === undefined ? 0 : c)); }
  function impliedOf(row, model) {
    var growth = clampGrowth(row.change_7d, model);
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    var extra = Math.min(Math.max(row.chains.length - 1, 0), model.breadth_max_extra_chains);
    var breadth = 1 + extra * model.breadth_per_chain;
    return Math.max(1, Math.round(row.tvl_usd * model.base_multiple * growthMult * maturity * breadth));
  }
  function growthMultOf(row, model) { return 1 + (clampGrowth(row.change_7d, model) / 100) * model.growth_weight; }
  function maturityMultOf(row, model) {
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    return model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  }
  function breadthMultOf(row, model) {
    var extra = Math.min(Math.max(row.chains.length - 1, 0), model.breadth_max_extra_chains);
    return 1 + extra * model.breadth_per_chain;
  }
  function chainOf(p) { return p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5000000000) return 250;
    if (p.tvl_usd >= 1000000000) return 150;
    if (p.tvl_usd >= 100000000) return 100;
    return 50;
  }
  function holdDaysFor(age) { if (age === null || age === undefined) return 30; if (age < 180) return 60; if (age < 365) return 45; return 30; }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase(); var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + '\'s main pool on ' + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Stake $' + capital + ' of the chain\'s staking asset through ' + name + ' and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('perps') >= 0 || c.indexOf('basis') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('capital') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return 'Mint $' + capital + ' of the protocol\'s yield asset on ' + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    if (c.indexOf('otc') >= 0 || c.indexOf('marketplace') >= 0) return 'Complete one small trade of $' + capital + ' on ' + name + ' on ' + chain + ' and keep the receipt.';
    if (c.indexOf('farm') >= 0) return 'Deposit $' + capital + ' into ' + name + '\'s main farm on ' + chain + ' and keep the position open.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function weeklyFor(p) {
    var c = (p.category || '').toLowerCase();
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'a deposit, a borrow, a repayment or a vote';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('farm') >= 0) return 'a swap, a deposit, a withdrawal or a vote';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('perps') >= 0 || c.indexOf('basis') >= 0) return 'a trade, a deposit or a vote';
    if (c.indexOf('prediction') >= 0) return 'a market position or a vote';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('capital') >= 0) return 'a deposit, a rebalance or a vote';
    if (c.indexOf('rwa') >= 0) return 'a mint, a deposit or a vote';
    return 'a deposit, a swap or a vote';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + ' Hold the position and check the protocol\'s own page.';
    return s;
  }
  function farmSteps(p, age) {
    var chain = chainOf(p); var capital = capitalFor(p); var hold = holdDaysFor(age);
    var action = actionFor(p, capital, chain); var weekly = weeklyFor(p);
    var other = p.chains.slice(1, 3).join(' and ');
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: action, cost: '$' + capital + ' of capital and about $' + (capital >= 150 ? 8 : 4) + ' of gas', time: '15 minutes to set up' },
      { text: 'Open ' + p.name + '\'s own site and look for a points, rewards or quests page; if it has one, connect the same wallet and opt in, and read what it counts before you act.', cost: 'nothing to check', time: '10 minutes' },
      { text: 'Make one qualifying action each week, such as ' + weekly + '.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: other.length > 0 ? 'Repeat the same position on ' + other + ' as well, so the activity covers more than one chain.' : 'Keep the position on ' + chain + ' and do not split it across wallets: one wallet, one history.', cost: other.length > 0 ? 'the same capital, split across chains' : 'nothing extra', time: '15 minutes' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: 'Before you withdraw, open the protocol\'s own points or rewards page and claim only from the link it publishes; treat the position as experimental, and keep it small enough that losing it would not hurt.', cost: 'no fee to check, and never pay to claim', time: '10 minutes' }
    ].map(stepText);
  }
  /* PURE-END */

  var DATA = (typeof window !== 'undefined' && window.RADAR) || null;
  if (typeof document === 'undefined' || !DATA) return;
  var FLOOR = DATA.floor_usd;

  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function fmtPct(n) { if (n === null || n === undefined || !isFinite(n)) return 'n/a'; return (n > 0 ? '+' : '') + n.toFixed(2) + '%'; }
  function fmtAge(d) { if (d === null || d === undefined) return 'unknown'; if (d >= 365) return (d / 365).toFixed(1) + 'y'; return Math.max(0, Math.round(d)) + 'd'; }
  function fmtInt(n) { return n.toLocaleString('en-US'); }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
    });
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  var state = { q: '', category: 'all', chain: 'all', watch: false, sort: 'implied', dir: -1, tab: 'pre-token', selected: null, sandbox: null };
  var model = DATA.model;

  function currentModel() { return state.sandbox || model; }
  function rowsWithValues() {
    var m = currentModel();
    return DATA.rows.map(function (r) {
      var v = impliedOf(r, m);
      return { row: r, value: v };
    });
  }
  function filtered() {
    var q = state.q.trim().toLowerCase();
    var list = rowsWithValues().filter(function (x) {
      var r = x.row;
      if (state.watch && !r.on_watchlist) return false;
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (q && (r.name + ' ' + r.slug + ' ' + (r.category || '')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var key = state.sort;
    list.sort(function (a, b) {
      var d = 0;
      if (key === 'implied') d = a.value - b.value;
      else if (key === 'tvl') d = a.row.tvl_usd - b.row.tvl_usd;
      else if (key === 'change') d = (a.row.change_7d || 0) - (b.row.change_7d || 0);
      else if (key === 'age') d = (a.row.age_days === null ? -1 : a.row.age_days) - (b.row.age_days === null ? -1 : b.row.age_days);
      else if (key === 'name') d = a.row.name < b.row.name ? -1 : a.row.name > b.row.name ? 1 : 0;
      return d * state.dir;
    });
    return list;
  }

  function renderStats() {
    var total = DATA.rows.reduce(function (s, r) { return s + r.implied_value_usd; }, 0);
    var cats = {};
    DATA.rows.forEach(function (r) { cats[r.category || 'Uncategorised'] = (cats[r.category || 'Uncategorised'] || 0) + 1; });
    var topCat = Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; })[0];
    var chains = {};
    DATA.rows.forEach(function (r) { r.chains.forEach(function (c) { chains[c] = 1; }); });
    var stats = document.getElementById('stats');
    stats.innerHTML = '';
    var items = [
      ['Board rows', fmtInt(DATA.board_size), ''],
      ['Watchlist covered', DATA.watchlist_size + ' / ' + DATA.watchlist_size, 'gold'],
      ['Early rows below the floor', fmtInt(DATA.early_size), ''],
      ['Total implied value', fmtUsd(total), 'gold'],
      ['Top category', topCat + ' · ' + cats[topCat], ''],
      ['Chains covered', fmtInt(Object.keys(chains).length), '']
    ];
    items.forEach(function (it) {
      stats.appendChild(el('div', {}, el('dt', { text: it[0] }), el('dd', { 'class': it[2], text: it[1] })));
    });
    document.getElementById('meta').textContent =
      'Snapshot: ' + DATA.source + ' · as of ' + DATA.as_of + ' · watchlist floor ' + fmtUsd(FLOOR) +
      ' · model ' + DATA.model_version + ' · ' + DATA.live_size + ' live-token protocols kept apart.';
  }

  function fillSelects() {
    var cats = [], chains = [];
    DATA.rows.forEach(function (r) {
      if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category);
      r.chains.forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); });
    });
    cats.sort(); chains.sort();
    var cat = document.getElementById('cat'), ch = document.getElementById('chain');
    cats.forEach(function (c) { cat.appendChild(el('option', { value: c, text: c })); });
    chains.forEach(function (c) { ch.appendChild(el('option', { value: c, text: c })); });
  }

  function chainChips(r) {
    var out = [];
    r.chains.slice(0, 3).forEach(function (c) { out.push(el('span', { 'class': 'chip', text: c })); });
    if (r.chains.length > 3) out.push(el('span', { 'class': 'chip', text: '+' + (r.chains.length - 3) }));
    return out;
  }

  function renderBoard() {
    var tbody = document.getElementById('rows');
    tbody.innerHTML = '';
    var list = filtered();
    var max = list.length ? list[0].value : 1;
    document.getElementById('count').textContent =
      'Showing ' + list.length + ' of ' + DATA.board_size + ' pre-token protocols' +
      (state.sandbox ? ' — sandbox model, not board.json' : '') + '. Click a row for its farm plan.';
    list.forEach(function (x, i) {
      var r = x.row;
      var tr = el('tr', { 'class': state.selected === r.slug ? 'sel' : '', onclick: function () { openDetail(r.slug); } });
      var nameCell = el('td', {}, el('strong', { text: r.name }));
      if (r.on_watchlist) nameCell.appendChild(el('span', { 'class': 'pill', text: 'WATCHLIST' }));
      tr.appendChild(el('td', { text: String(state.sort === 'implied' && !state.sandbox ? r.rank : i + 1) }));
      tr.appendChild(nameCell);
      tr.appendChild(el('td', { text: r.category || '—' }));
      tr.appendChild(el('td', {}, chainChips(r)));
      tr.appendChild(el('td', { 'class': 'num', text: fmtUsd(r.tvl_usd) }));
      var ch = el('td', { 'class': 'num ' + ((r.change_7d || 0) >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) });
      tr.appendChild(ch);
      tr.appendChild(el('td', { 'class': 'num', text: fmtAge(r.age_days) }));
      var val = el('td', { 'class': 'num' }, document.createTextNode(fmtUsd(x.value)));
      var bar = el('span', { 'class': 'bar' }, el('i', { style: 'width:' + Math.max(2, Math.round(100 * x.value / max)) + '%' }));
      val.appendChild(bar);
      tr.appendChild(val);
      tr.appendChild(el('td', { 'class': 'flag', text: '›' }));
      tbody.appendChild(tr);
    });
    if (!list.length) tbody.appendChild(el('tr', {}, el('td', { colspan: '9', text: 'No protocols match these filters.' })));
  }

  function renderLive() {
    var tbody = document.getElementById('rows');
    tbody.innerHTML = '';
    document.getElementById('count').textContent =
      'Live tokens are the market’s own values — market cap, not an implied value. They never enter the ranked board.';
    DATA.live.forEach(function (p, i) {
      var tr = el('tr', { onclick: function () {} });
      tr.appendChild(el('td', { text: String(i + 1) }));
      tr.appendChild(el('td', {}, el('strong', { text: p.name })));
      tr.appendChild(el('td', { text: p.category || '—' }));
      tr.appendChild(el('td', {}, chainChips(p)));
      tr.appendChild(el('td', { 'class': 'num', text: fmtUsd(p.tvl_usd) }));
      tr.appendChild(el('td', { 'class': 'num ' + ((p.change_7d || 0) >= 0 ? 'pos' : 'neg'), text: fmtPct(p.change_7d) }));
      tr.appendChild(el('td', { 'class': 'num', text: '—' }));
      tr.appendChild(el('td', { 'class': 'num', text: fmtUsd(p.mcap_usd) }));
      tr.appendChild(el('td', { 'class': 'flag', text: 'live' }));
      tbody.appendChild(tr);
    });
  }

  function render() {
    document.getElementById('tab-board').setAttribute('aria-selected', state.tab === 'pre-token' ? 'true' : 'false');
    document.getElementById('tab-live').setAttribute('aria-selected', state.tab === 'live' ? 'true' : 'false');
    if (state.tab === 'live') renderLive(); else renderBoard();
  }

  function openDetail(slug) {
    var r = null;
    DATA.rows.forEach(function (x) { if (x.slug === slug) r = x; });
    if (!r) return;
    state.selected = slug;
    var m = currentModel();
    var recomputed = impliedOf(r, m);
    var match = recomputed === r.implied_value_usd;
    var d = document.getElementById('detail');
    d.innerHTML = '';
    var head = el('div', {},
      el('p', { 'class': 'kicker', text: 'RANK #' + r.rank + ' · ' + (r.category || 'UNCATEGORISED') }),
      el('h2', { text: r.name }));
    if (r.on_watchlist) head.appendChild(el('p', { 'class': 'sub' }, el('span', { 'class': 'pill', text: 'ON THE WATCHLIST' })));
    else if (r.tvl_usd >= FLOOR) head.appendChild(el('p', { 'class': 'note', text: 'Above the watchlist floor but outside the watchlist: the snapshot carries no parent-protocol field, so the house’s parent rule cannot be applied to this row from these bytes. It is ranked on its own figures like every other row.' }));
    else head.appendChild(el('p', { 'class': 'sub', text: 'Early row — below the watchlist floor.' }));
    d.appendChild(head);
    var kv = el('dl', { 'class': 'kv' });
    [['TVL', fmtUsd(r.tvl_usd)], ['7-day change', fmtPct(r.change_7d)], ['Age', fmtAge(r.age_days)],
     ['Chains', r.chains.join(', ') || '—'], ['Listed', r.listed_at || 'unknown'],
     ['Implied value', fmtUsd(r.implied_value_usd)]].forEach(function (kv2) {
      kv.appendChild(el('div', {}, el('dt', { text: kv2[0] }), el('dd', { text: kv2[1] })));
    });
    d.appendChild(kv);
    d.appendChild(el('h3', { text: 'How the value is computed' }));
    var base = Math.round(r.tvl_usd * m.base_multiple);
    var lines = 'base = TVL ' + fmtUsd(r.tvl_usd) + ' × ' + m.base_multiple + ' = ' + fmtUsd(base) +
      '\ngrowth ×' + growthMultOf(r, m).toFixed(4) + '  (7d ' + fmtPct(r.change_7d) + ', clamped ' + m.growth_floor + '…+' + m.growth_cap + '%)' +
      '\nmaturity ×' + maturityMultOf(r, m).toFixed(4) + '  (age ' + fmtAge(r.age_days) + ')' +
      '\nbreadth ×' + breadthMultOf(r, m).toFixed(4) + '  (' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's') + ')' +
      '\n= ' + fmtUsd(recomputed) + (state.sandbox ? ' (sandbox model)' : match ? ' — matches board.json' : ' — DIFFERS from board.json: ' + fmtUsd(r.implied_value_usd));
    d.appendChild(el('pre', { 'class': 'model-line', text: lines }));
    d.appendChild(el('h3', { text: 'Farm plan — 7 steps' }));
    var ol = el('ol', {});
    farmSteps(r, r.age_days).forEach(function (s) {
      var at = s.indexOf(' Cost: ');
      var action = at >= 0 ? s.slice(0, at) : s;
      var meta = at >= 0 ? s.slice(at + 1) : '';
      ol.appendChild(el('li', {}, document.createTextNode(action + ' '), el('b', { text: meta })));
    });
    d.appendChild(ol);
    d.appendChild(el('p', { 'class': 'note', text: '“Records no token” is what the snapshot says. This radar does not know whether ' + r.name + ' runs a points program or will ever issue a token — step 3 tells you how to check. Farming costs gas whether or not an airdrop comes.' }));
    document.getElementById('drawer').hidden = false;
    renderBoard();
    if (window.location.hash !== '#detail/' + slug) window.history.replaceState(null, '', '#detail/' + slug);
  }

  function closeDetail() {
    state.selected = null;
    document.getElementById('drawer').hidden = true;
    renderBoard();
    if (window.location.hash.indexOf('#detail/') === 0) window.history.replaceState(null, '', '#');
  }

  function applyHash() {
    var h = window.location.hash || '';
    if (h.indexOf('#detail/') === 0) { openDetail(h.slice(8)); return; }
    if (h.indexOf('#filter/') === 0) {
      var cat = decodeURIComponent(h.slice(8));
      state.category = cat;
      document.getElementById('cat').value = cat;
    }
    if (h === '#tab=live') state.tab = 'live';
    render();
  }

  function bind() {
    document.getElementById('q').addEventListener('input', function (e) { state.q = e.target.value; render(); });
    document.getElementById('cat').addEventListener('change', function (e) { state.category = e.target.value; render(); });
    document.getElementById('chain').addEventListener('change', function (e) { state.chain = e.target.value; render(); });
    document.getElementById('watch').addEventListener('change', function (e) { state.watch = e.target.checked; render(); });
    document.getElementById('sort').addEventListener('change', function (e) { state.sort = e.target.value; render(); });
    document.getElementById('dir').addEventListener('click', function () {
      state.dir = -state.dir;
      document.getElementById('dir').textContent = state.dir < 0 ? '↓' : '↑';
      render();
    });
    document.getElementById('tab-board').addEventListener('click', function () { state.tab = 'pre-token'; render(); });
    document.getElementById('tab-live').addEventListener('click', function () { state.tab = 'live'; render(); });
    document.getElementById('drawer-close').addEventListener('click', closeDetail);
    window.addEventListener('hashchange', applyHash);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDetail(); });
    var sb = function () {
      var b = parseFloat(document.getElementById('sb-base').value);
      var g = parseFloat(document.getElementById('sb-growth').value);
      var br = parseFloat(document.getElementById('sb-breadth').value);
      if (!isFinite(b) || !isFinite(g) || !isFinite(br)) return;
      state.sandbox = {
        base_multiple: b, growth_weight: g, growth_floor: model.growth_floor, growth_cap: model.growth_cap,
        maturity_floor: model.maturity_floor, maturity_range: model.maturity_range, maturity_days: model.maturity_days,
        unknown_age_days: model.unknown_age_days, breadth_per_chain: br, breadth_max_extra_chains: model.breadth_max_extra_chains
      };
      document.getElementById('sb-note').textContent = 'Showing sandbox model (base ' + b + ', growth weight ' + g + ', breadth ' + br + ' per chain) — board.json keeps model ' + DATA.model_version + '.';
      render();
    };
    ['sb-base', 'sb-growth', 'sb-breadth'].forEach(function (id) { document.getElementById(id).addEventListener('input', sb); });
    document.getElementById('sb-reset').addEventListener('click', function () {
      state.sandbox = null;
      document.getElementById('sb-base').value = model.base_multiple;
      document.getElementById('sb-growth').value = model.growth_weight;
      document.getElementById('sb-breadth').value = model.breadth_per_chain;
      document.getElementById('sb-note').textContent = 'Showing model ' + DATA.model_version + '.';
      render();
    });
  }

  renderStats();
  fillSelects();
  bind();
  applyHash();
  document.getElementById('board').setAttribute('aria-busy', 'false');
})();
