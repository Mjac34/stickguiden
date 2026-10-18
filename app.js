'use strict';
const S = window.Stick;
const KEY = 'stickguiden.v1';
const $ = (q, el = document) => el.querySelector(q);
const $$ = (q, el = document) => [...el.querySelectorAll(q)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TYPE = { cardigan: 'Cardigan', troja: 'Tröja' };
const KINDS = ['inc', 'dec', 'btn', 'split', 'rib', 'bo'];
const PART = { torso: 'Ok och kropp', arm1: 'Ärm 1', arm2: 'Ärm 2', done: 'Montering' };

let db = load();
let cur = null; // { p: projekt, g: genererat mönster }
let tab = 'now';
let formMode = null; // { mode: 'new'|'edit'|'copy', id }

function load() { try { return JSON.parse(localStorage.getItem(KEY)) || { projects: [] }; } catch { return { projects: [] }; } }
function save() { localStorage.setItem(KEY, JSON.stringify(db)); }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 2200); }
const hm = t => new Date(t).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
function when(t) {
  const d = new Date(t), now = new Date();
  const day = d.toDateString() === now.toDateString() ? 'idag' : (new Date(now - 864e5).toDateString() === d.toDateString() ? 'igår' : d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }));
  return `${day} ${hm(t)}`;
}
const fmt = n => (Math.round(n * 10) / 10).toLocaleString('sv-SE');

function show(id) {
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  window.scrollTo(0, 0);
  if (id !== 'proj') releaseWake();
}

// ---------------- Hem ----------------
function renderHome() {
  const list = $('#projList');
  const ps = [...db.projects].sort((a, b) => (b.updated || 0) - (a.updated || 0));
  if (!ps.length) { list.innerHTML = '<div class="empty">Inga projekt än.<br>Börja med att lägga upp ett nytt.</div>'; return; }
  list.innerHTML = ps.map(p => {
    const g = S.generate(p.params);
    const pct = Math.round(100 * Math.min(p.pos, g.steps.length) / g.steps.length);
    const last = p.log.length ? `Senast: ${when(p.log[p.log.length - 1].t)}` : 'Inte påbörjad';
    return `<button class="pcard" data-id="${p.id}"><h3>${esc(p.name)}</h3>
      <div class="meta">${TYPE[p.params.type]} · ${esc(p.params.size || 'egna mått')} · ${esc(p.yarn || 'garn ej angivet')}${p.needle ? ` · ${fmt(p.needle)} mm` : ''}</div>
      <div class="bar-prog"><i style="width:${pct}%"></i></div><div class="meta">${pct} % · ${last}</div></button>`;
  }).join('');
}
$('#projList').addEventListener('click', e => { const b = e.target.closest('.pcard'); if (b) openProject(b.dataset.id); });
$('#newBtn').addEventListener('click', () => openForm({ mode: 'new' }));

// ---------------- Formulär ----------------
const NUM = ['stG', 'rowG', 'chest', 'neck', 'upperArm', 'wrist', 'yoke', 'underarm', 'bodyLen', 'sleeveLen', 'neckRib', 'hemRib', 'cuffRib', 'band', 'buttons'];
const MEAS = ['chest', 'neck', 'upperArm', 'wrist', 'yoke', 'underarm', 'bodyLen', 'sleeveLen'];
const F = () => $('#pform').elements;
let formSize = 'M';

$('#sizeChips').innerHTML = S.SIZES.map(s => `<button type="button" data-size="${s}">${s}</button>`).join('');
$('#sizeChips').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  formSize = b.dataset.size;
  const pr = S.presetFor(F().type.value, formSize);
  for (const k of MEAS) F()[k].value = pr[k];
  markSize(); updatePreview();
});
function markSize() { $$('#sizeChips button').forEach(b => b.classList.toggle('on', b.dataset.size === formSize)); }

function openForm(m) {
  formMode = m;
  const p = m.id ? db.projects.find(x => x.id === m.id) : null;
  const params = p ? p.params : S.defaults('cardigan', 'M');
  const f = F();
  f.name.value = p ? (m.mode === 'copy' ? `${p.name} – nytt garn` : p.name) : '';
  f.yarn.value = p && m.mode !== 'copy' ? p.yarn || '' : '';
  f.needle.value = p ? p.needle || '' : '';
  $$('input[name=type]').forEach(r => { r.checked = r.value === params.type; });
  for (const k of NUM) f[k].value = params[k] ?? '';
  f.buttonSide.value = params.buttonSide || 'höger';
  formSize = params.size || '';
  markSize();
  $('#formTitle').textContent = { new: 'Nytt projekt', edit: 'Ändra projekt', copy: 'Samma plagg, nytt garn' }[m.mode];
  $('#saveBtn').textContent = m.mode === 'edit' ? 'Spara ändringar' : 'Spara och börja sticka';
  show('form');
  updatePreview();
  if (m.mode === 'copy') { f.yarn.focus(); toast('Fyll i det nya garnet och stickfastheten från provlappen'); }
}

function readForm() {
  const f = F(), p = { type: f.type.value, size: formSize, buttonSide: f.buttonSide.value };
  for (const k of NUM) p[k] = parseFloat(String(f[k].value).replace(',', '.'));
  if (!(p.band >= 0)) p.band = 2.5;
  if (!(p.buttons >= 0)) p.buttons = 0;
  return p;
}
function valid(p) { return NUM.every(k => Number.isFinite(p[k])) && p.stG > 0 && p.rowG > 0 && p.chest > 0; }

function updatePreview() {
  const p = readForm();
  $$('.cardOnly').forEach(el => el.classList.toggle('hidden', p.type !== 'cardigan'));
  const box = $('#preview');
  if (!valid(p)) { box.innerHTML = '<span class="hint">Fyll i alla mått och stickfastheten så räknas mönstret ut här.</span>'; return; }
  const g = S.generate(p), c = g.counts, fi = g.finished;
  box.innerHTML = `<h3>Så här blir det</h3>
    ${g.warnings.map(w => `<div class="warn">⚠️ ${esc(w)}</div>`).join('')}
    <ul>
      <li>Lägg upp <b>${c.neckSts} m</b>, ${c.K} ökningsvarv i oket${c.n1 ? ` (${c.n1} av dem på varje varv)` : ''}.</li>
      <li>Kroppen: <b>${c.bodySts} m</b> ≈ ${fmt(fi.chest)} cm. Ärmen: <b>${c.S} m</b> ≈ ${fmt(fi.upperArm)} cm, minskas till ${c.wristSts} m.</li>
      <li>Okets djup ≈ ${fmt(fi.yoke)} cm${p.type === 'cardigan' && c.btn.length ? `, ${c.btn.length} knapphål` : ''}.</li>
      <li>Totalt <b>${c.totalRows} varv</b> att bocka av.</li>
    </ul>`;
}
$('#pform').addEventListener('input', e => {
  if (MEAS.includes(e.target.name) && formSize) { formSize = ''; markSize(); }
  if (e.target.name === 'type' && formSize) { const pr = S.presetFor(e.target.value, formSize); F().neck.value = pr.neck; }
  updatePreview();
});
$('#suggestBtn').addEventListener('click', () => {
  const g = S.gaugeFromNeedle(parseFloat(String(F().needle.value).replace(',', '.')));
  if (!g) { toast('Skriv in stickornas storlek först'); return; }
  F().stG.value = g.st; F().rowG.value = g.row; updatePreview();
  toast(`Ungefär ${g.st} m och ${g.row} varv – kontrollera med en provlapp`);
});
$('#pform').addEventListener('submit', e => {
  e.preventDefault();
  const params = readForm();
  if (!valid(params)) { toast('Något mått saknas'); return; }
  const f = F(), now = Date.now();
  let p;
  if (formMode.mode === 'edit') {
    p = db.projects.find(x => x.id === formMode.id);
    p.params = params; p.name = f.name.value.trim() || p.name; p.yarn = f.yarn.value.trim(); p.needle = parseFloat(f.needle.value) || null; p.updated = now;
    p.pos = Math.min(p.pos, S.generate(params).steps.length);
  } else {
    p = { id: now.toString(36), name: f.name.value.trim() || TYPE[params.type], yarn: f.yarn.value.trim(), needle: parseFloat(f.needle.value) || null, params, pos: 0, log: [], created: now, updated: now };
    db.projects.push(p);
  }
  save();
  openProject(p.id, true);
});

// ---------------- Projekt ----------------
function openProject(id, fresh) {
  const p = db.projects.find(x => x.id === id); if (!p) return;
  cur = { p, g: S.generate(p.params) };
  $('#projTitle').textContent = p.name;
  setTab('now');
  show('proj');
  document.documentElement.style.setProperty('--hdr', $('#projHead').offsetHeight + 'px');
  if (fresh) toast('Tryck "Varv klart" efter varje varv');
  requestWake();
}
function setTab(t) {
  tab = t;
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  for (const x of ['now', 'pattern', 'log', 'info']) $('#tab-' + x).classList.toggle('hidden', x !== t);
  $('#actions').classList.toggle('hidden', t !== 'now');
  render();
  if (t === 'pattern') { const c = $('#tab-pattern .cur'); if (c) c.scrollIntoView({ block: 'center' }); }
  else window.scrollTo(0, 0);
}
$('#tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setTab(b.dataset.tab); });
function render() {
  if (!cur) return;
  ({ now: renderNow, pattern: renderPattern, log: renderLog, info: renderInfo })[tab]();
}

const rowsBetween = (steps, a, b) => { let n = 0; for (let i = a; i < b; i++) if (steps[i].kind === 'row') n++; return n; };
const stepName = (g, i) => { const st = g.steps[i], sc = g.sections[st.sec]; return st.kind === 'row' ? `varv ${st.n} i ${sc.title.toLowerCase()}` : sc.title.toLowerCase(); };
function lastDone(p, i) { for (let k = p.log.length - 1; k >= 0; k--) if (p.log[k].a === 'done' && p.log[k].i === i) return p.log[k].t; return null; }

function renderNow() {
  const { p, g } = cur, steps = g.steps, el = $('#tab-now');
  $('#undoBtn').disabled = p.pos === 0;
  if (p.pos >= steps.length) {
    $('#doneBtn').disabled = true;
    el.innerHTML = `<div class="card finished"><div class="big">🎉</div><h2>Klart!</h2><p>${esc(p.name)} är färdigstickad.</p></div>${schematic(g, p.pos)}`;
    return;
  }
  $('#doneBtn').disabled = false;
  const st = steps[p.pos], sc = g.sections[st.sec];
  const isRow = st.kind === 'row';
  $('#doneBtn').textContent = isRow ? '✓ Varv klart' : '✓ Klart';
  const hasEv = st.ev.some(k => KINDS.includes(k));
  const sideB = st.side ? `<span class="badge ${st.side === 'WS' ? 'ws' : ''}">${st.side === 'RS' ? 'Rätsidan' : 'Avigsidan'}</span>` : '';
  const notes = st.notes.map(n => `<div class="note ${/^(Ökning|Minskning) \d/.test(n) ? 'soft' : ''}">${/^Knapphål/.test(n) ? '🔘 ' : ''}${esc(n)}</div>`).join('');
  const intro = isRow && st.n === 1 && sc.intro ? `<div class="note soft">ℹ️ ${esc(sc.intro)}</div>` : (!isRow && sc.intro ? `<div class="note soft">ℹ️ ${esc(sc.intro)}</div>` : '');

  // senast / nästa inom samma del (ok+kropp eller ärm)
  const last = [], next = [];
  for (const k of KINDS) {
    for (let i = p.pos - 1; i >= 0 && steps[i].part === st.part; i--) if (steps[i].ev.includes(k)) {
      const ago = rowsBetween(steps, i + 1, p.pos), t = lastDone(p, i);
      last.push({ k, i, ago, t }); break;
    }
    for (let i = p.pos; i < steps.length && steps[i].part === st.part; i++) if (steps[i].ev.includes(k)) {
      next.push({ k, i, dist: rowsBetween(steps, p.pos, i) }); break;
    }
  }
  last.sort((a, b) => a.ago - b.ago || b.i - a.i); next.sort((a, b) => a.i - b.i);
  const lastHtml = last.length ? last.map(x => `<div class="ev"><i class="dot k-${x.k}"></i><div><b>${S.EV[x.k]}</b><span>${x.ago === 0 ? 'förra steget' : `${x.ago} varv sedan`} · ${stepName(g, x.i)}${x.t ? ` · ${when(x.t)}` : ''}</span></div></div>`).join('') : '<span class="hint">Inget ännu i den här delen.</span>';
  const nextHtml = next.length ? next.map(x => `<div class="ev"><i class="dot k-${x.k}"></i><div><b>${S.EV[x.k]}</b><span>${x.i === p.pos ? '<span class="big">nu!</span>' : `om <span class="big">${x.dist}</span> varv`} · ${stepName(g, x.i)}</span></div></div>`).join('') : '<span class="hint">Inga fler händelser i den här delen.</span>';

  const done = p.pos, total = steps.length;
  const partSteps = steps.filter(s => s.part === st.part), partIdx = partSteps.indexOf(st);
  const lastT = p.log.filter(l => l.a === 'done').pop();
  el.innerHTML = `
    <div class="card now ${hasEv ? 'event' : ''}" id="nowCard">
      <div class="where"><span>${st.part === 'torso' ? 'Ok och kropp › ' : ''}${esc(sc.title)}</span>${sideB}</div>
      <div class="rownum">${isRow ? `Varv ${st.n} <small>av ${sc.rows}</small>` : 'Att göra'}</div>
      <div class="instr">${esc(st.text)}</div>
      ${notes}${intro}
      <div class="sts">${isRow || st.ev.includes('start') ? `Efter detta: <b>${st.sts} m</b> på stickan` : ''}${lastT ? ` · Senast klart ${when(lastT.t)}` : ''}</div>
    </div>
    <div class="grid2">
      <div class="card box"><h4>Nästa</h4>${nextHtml}</div>
      <div class="card box"><h4>Senast</h4>${lastHtml}</div>
    </div>
    <div class="card">
      <div class="prog-line"><span>${esc(PART[st.part])}: ${partIdx} av ${partSteps.length}</span><span>Totalt ${Math.round(100 * done / total)} %</span></div>
      <div class="bar-prog"><i style="width:${100 * done / total}%"></i></div>
      <div class="schem">${schematic(g, p.pos)}</div>
    </div>`;
}

function markDone() {
  const { p, g } = cur;
  if (p.pos >= g.steps.length) return;
  p.log.push({ a: 'done', i: p.pos, t: Date.now() });
  p.pos++; p.updated = Date.now(); save();
  const nx = g.steps[p.pos];
  const ev = nx && nx.ev.some(k => KINDS.includes(k));
  if (navigator.vibrate) navigator.vibrate(ev ? [80, 80, 80] : 25);
  renderNow();
  const c = $('#nowCard'); if (c) { c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash'); }
  if (nx && nx.sec !== g.steps[p.pos - 1].sec) toast(`Nytt avsnitt: ${g.sections[nx.sec].title}`);
}
function undo() {
  const { p } = cur; if (p.pos <= 0) return;
  const lastL = p.log[p.log.length - 1];
  if (lastL && lastL.a === 'done' && lastL.i === p.pos - 1) p.log.pop();
  else p.log.push({ a: 'undo', i: p.pos - 1, t: Date.now() });
  p.pos--; p.updated = Date.now(); save(); renderNow(); toast('Ångrat');
}
$('#doneBtn').addEventListener('click', markDone);
$('#undoBtn').addEventListener('click', undo);
document.addEventListener('keydown', e => {
  if (!$('#proj').classList.contains('active') || tab !== 'now' || e.target.closest('input,select,textarea')) return;
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); markDone(); }
  if (e.key === 'Backspace') { e.preventDefault(); undo(); }
});

// Mönster
function renderPattern() {
  const { p, g } = cur;
  let html = '';
  g.sections.forEach((sc, si) => {
    html += `<div class="sec-h">${esc(sc.title)}${sc.rows ? ` · ${sc.rows} varv` : ''}</div>${sc.intro ? `<p class="sec-intro">${esc(sc.intro)}</p>` : ''}`;
    for (let i = sc.start; i < sc.end; i++) {
      const st = g.steps[i];
      const cls = ['prow', i < p.pos ? 'done' : '', i === p.pos ? 'cur' : '', st.ev.some(k => KINDS.includes(k)) ? 'hasev' : ''].join(' ');
      const dots = st.ev.filter(k => KINDS.includes(k)).map(k => `<i class="chip k-${k}">${S.EV[k]}</i>`).join('');
      html += `<div class="${cls}" data-i="${i}"><span class="n">${st.kind === 'row' ? 'v' + st.n : '•'}</span><span>${esc(st.text)}${dots}${st.notes.filter(n => /^Knapphål/.test(n)).map(n => `<span class="nt">🔘 ${esc(n)}</span>`).join('')}</span></div>`;
    }
  });
  $('#tab-pattern').innerHTML = `<p class="hint">Tryck på ett varv för att hoppa dit, t.ex. om du har glömt att bocka av.</p>${html}`;
}
$('#tab-pattern').addEventListener('click', e => {
  const r = e.target.closest('.prow'); if (!r) return;
  const i = +r.dataset.i, { p, g } = cur;
  if (i === p.pos) { setTab('now'); return; }
  if (!confirm(`Hoppa till ${stepName(g, i)}?\nAllt före det räknas som klart.`)) return;
  p.log.push({ a: 'jump', from: p.pos, i, t: Date.now() });
  p.pos = i; p.updated = Date.now(); save(); setTab('now'); toast('Hoppade till ' + stepName(g, i));
});

// Logg
function renderLog() {
  const { p, g } = cur;
  if (!p.log.length) { $('#tab-log').innerHTML = '<div class="empty">Loggen fylls på när du bockar av varv.</div>'; return; }
  const today = new Date().toDateString();
  const doneToday = p.log.filter(l => l.a === 'done' && new Date(l.t).toDateString() === today && g.steps[l.i] && g.steps[l.i].kind === 'row').length;
  let html = `<div class="card">Idag: <b>${doneToday} varv</b> · Totalt: <b>${p.pos} av ${g.steps.length} steg</b></div>`;
  let day = '';
  for (const l of [...p.log].reverse().slice(0, 600)) {
    const d = new Date(l.t).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
    if (d !== day) { day = d; html += `<div class="lday">${d}</div>`; }
    const st = g.steps[l.i];
    let txt;
    if (!st) txt = 'Okänt steg';
    else if (l.a === 'done') txt = `${esc(g.sections[st.sec].title)} – ${st.kind === 'row' ? 'varv ' + st.n : esc(st.text)}` + st.ev.filter(k => KINDS.includes(k)).map(k => `<i class="chip k-${k}">${S.EV[k]}</i>`).join('');
    else if (l.a === 'undo') txt = `<i>Ångrade ${esc(stepName(g, l.i))}</i>`;
    else txt = `<i>Hoppade till ${esc(stepName(g, l.i))}</i>`;
    html += `<div class="lrow"><span class="t">${hm(l.t)}</span><span>${txt}</span></div>`;
  }
  $('#tab-log').innerHTML = html;
}

// Info
function renderInfo() {
  const { p, g } = cur, pr = p.params, c = g.counts, fi = g.finished;
  const row = (a, b, x) => `<tr><td>${a}</td><td>${b}</td><td>${x}</td></tr>`;
  $('#tab-info').innerHTML = `
    ${g.warnings.map(w => `<div class="warn">⚠️ ${esc(w)}</div>`).join('')}
    <div class="card"><table class="kv">
      <tr><td>Plagg</td><td>${TYPE[pr.type]} · ${esc(pr.size || 'egna mått')}</td></tr>
      <tr><td>Garn</td><td>${esc(p.yarn || '–')}</td></tr>
      <tr><td>Stickor</td><td>${p.needle ? fmt(p.needle) + ' mm' : '–'}</td></tr>
      <tr><td>Stickfasthet</td><td>${fmt(pr.stG)} m × ${fmt(pr.rowG)} v / 10 cm</td></tr>
    </table></div>
    <div class="card"><table class="kv">
      <tr><td><b>Mått (cm)</b></td><td style="text-align:right"><b>angivet</b></td><td><b>blir</b></td></tr>
      ${row('Bröstvidd', fmt(pr.chest), fmt(fi.chest))}${row('Halsvidd', fmt(pr.neck), fmt(fi.neck))}${row('Överarm', fmt(pr.upperArm), fmt(fi.upperArm))}
      ${row('Handled', fmt(pr.wrist), fmt(fi.wrist))}${row('Okets djup', fmt(pr.yoke), fmt(fi.yoke))}${row('Kroppslängd från ärmhålan', fmt(pr.bodyLen), fmt(fi.bodyLen))}${row('Ärmlängd från ärmhålan', fmt(pr.sleeveLen), fmt(fi.sleeveLen))}
    </table></div>
    <div class="card"><table class="kv">
      <tr><td>Uppläggning</td><td>${c.neckSts} m</td></tr>
      <tr><td>Fördelning vid markörerna</td><td>${pr.type === 'cardigan' ? `${c.front0} / ${c.sleeve0} / ${c.back0} / ${c.sleeve0} / ${c.front0}` : `${c.sleeve0} / ${c.front0} / ${c.sleeve0} / ${c.back0}`}</td></tr>
      <tr><td>Ökningsvarv i oket</td><td>${c.K}${c.n1 ? ` (${c.n1} på varje varv, resten varannat)` : ' (varannat varv)'}</td></tr>
      <tr><td>Kroppen</td><td>${c.bodySts} m</td></tr>
      <tr><td>Ärmen</td><td>${c.S} m → ${c.wristSts} m (${c.nDec} minskningar, var ${c.interval}:e varv)</td></tr>
      ${pr.type === 'cardigan' ? `<tr><td>Framkant</td><td>${c.band} m rätstickning</td></tr><tr><td>Knapphål</td><td>${c.btn.length} st, ${esc(pr.buttonSide)} framkant</td></tr>` : ''}
    </table></div>
    <div class="btnrow">
      <button class="btn" id="copyBtn">🧶 Samma plagg, nytt garn</button>
      <button class="btn" id="editBtn">✏️ Ändra mått</button>
      <button class="btn danger" id="delBtn">🗑 Ta bort</button>
    </div>
    ${pr.type === 'troja' ? '<p class="tip">Tröjan har ingen förhöjning bak i nacken – vill du ha det kan du sticka några vändvarv över bakstycket innan oket.</p>' : ''}`;
  $('#copyBtn').onclick = () => openForm({ mode: 'copy', id: p.id });
  $('#editBtn').onclick = () => { if (p.pos === 0 || confirm('Om du ändrar måtten räknas mönstret om. Du står kvar på samma steg i listan – kontrollera att det stämmer efteråt.')) openForm({ mode: 'edit', id: p.id }); };
  $('#delBtn').onclick = () => { if (confirm(`Ta bort "${p.name}" och all dess logg?`)) { db.projects = db.projects.filter(x => x !== p); save(); cur = null; goHome(); } };
}

// ---------------- Skiss ----------------
function schematic(g, pos) {
  const G = g.geo, steps = g.steps;
  const W = G.chestW / 2, nW = G.neckW * 0.32, Y = G.yoke, L = G.body, SL = G.sleeve, ua = G.upperArm / 2, wr = G.wrist / 2;
  const th = 38 * Math.PI / 180;
  const pt = (x, y) => [x, y];
  const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
  const lerp = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  const P = a => a.map(v => v.map(n => n.toFixed(2)).join(',')).join(' ');
  const arms = [-1, 1].map(sg => {
    const U = pt(sg * W / 2, Y), N = pt(sg * nW / 2, 0);
    const d = [sg * Math.sin(th), Math.cos(th)], n = [sg * Math.cos(th), -Math.sin(th)];
    const Pt = add(U, n, ua), A = add(U, d, SL), Ao = add(A, n, wr);
    return { U, N, Pt, A, Ao };
  });
  // nuvarande position
  const st = steps[Math.min(pos, steps.length - 1)];
  const finished = pos >= steps.length;
  const partDone = pt => finished || steps.findIndex(s => s.part === pt) < pos && !steps.slice(pos).some(s => s.part === pt);
  const torsoCm = finished || partDone('torso') ? G.torsoCm : (st.part === 'torso' ? (pos > 0 && steps[pos - 1].part === 'torso' ? steps[pos - 1].cm : 0) : 0);
  const armF = a => { const pt = 'arm' + a; if (partDone(pt)) return 1; if (st.part !== pt) return 0; const prev = steps[pos - 1]; return prev && prev.part === pt ? prev.cm / G.armCm : 0; };
  const torsoPolys = [P([arms[0].N, arms[1].N, arms[1].U, arms[0].U]), P([[-W / 2, Y], [W / 2, Y], [W / 2, Y + L], [-W / 2, Y + L]])];
  const capPolys = arms.map(a => P([a.N, a.Pt, a.U]));
  const lowPolys = arms.map(a => P([a.Pt, a.Ao, a.A, a.U]));
  const xs = arms.flatMap(a => [a.Pt[0], a.Ao[0], a.A[0]]).concat([-W / 2, W / 2]);
  const ys = arms.flatMap(a => [a.Pt[1], a.Ao[1], a.A[1]]).concat([0, Y + L]);
  const pad = 3, minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad, minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;
  const sw = 0.35;
  let fills = `<clipPath id="tclip"><rect x="${minX}" y="${minY}" width="${maxX - minX}" height="${(torsoCm - minY).toFixed(2)}"/></clipPath>`;
  fills += `<g clip-path="url(#tclip)" fill="#d77fa6">${torsoPolys.concat(capPolys).map(q => `<polygon points="${q}"/>`).join('')}</g>`;
  arms.forEach((a, k) => {
    const f = armF(k + 1);
    if (f > 0) fills += `<polygon fill="#d77fa6" points="${P([a.Pt, lerp(a.Pt, a.Ao, f), lerp(a.U, a.A, f), a.U])}"/>`;
  });
  let marks = '';
  if (G.card) {
    marks += `<line x1="0" y1="0" x2="0" y2="${Y + L}" stroke="#7b2d52" stroke-width="${sw}" stroke-dasharray="1 .8"/>`;
    const bx = (cur && cur.p.params.buttonSide === 'vänster') ? 1.3 : -1.3;
    const r = cur ? cur.p.params.rowG / 10 : 3;
    g.counts.btn.forEach(row => { marks += `<circle cx="${bx}" cy="${(row / r).toFixed(2)}" r=".7" fill="#f9a825" stroke="#7a5200" stroke-width=".15"/>`; });
  }
  marks += `<line x1="${-W / 2}" y1="${Y}" x2="${W / 2}" y2="${Y}" stroke="#e53935" stroke-width="${sw * .6}" stroke-dasharray=".6 .6"/>`;
  let here = '';
  if (!finished) {
    if (st.part === 'torso') {
      const y = torsoCm, half = y < Y ? nW / 2 + (W / 2 - nW / 2) * (y / Y) + (ua * 0.8) * (y / Y) : W / 2;
      here = `<line x1="${-half - 1.5}" y1="${y}" x2="${half + 1.5}" y2="${y}" stroke="#c2185b" stroke-width="${sw * 2}"/><text x="${half + 2}" y="${y + 1}" font-size="3" fill="#c2185b" font-weight="700">du är här</text>`;
    } else if (st.part.startsWith('arm')) {
      const a = arms[st.part === 'arm1' ? 0 : 1], f = armF(st.part === 'arm1' ? 1 : 2);
      const p1 = lerp(a.U, a.A, f), p2 = lerp(a.Pt, a.Ao, f);
      here = `<line x1="${p1[0]}" y1="${p1[1]}" x2="${p2[0]}" y2="${p2[1]}" stroke="#c2185b" stroke-width="${sw * 2.2}"/><circle cx="${p1[0]}" cy="${p1[1]}" r="1" fill="#c2185b"/>`;
    }
  }
  const outline = torsoPolys.concat(capPolys, lowPolys).map(q => `<polygon points="${q}" fill="none" stroke="#6d4c41" stroke-width="${sw}" stroke-linejoin="round"/>`).join('');
  const lbl = arms.map((a, k) => { const m = lerp(lerp(a.U, a.A, .6), lerp(a.Pt, a.Ao, .6), .5); return `<text x="${m[0]}" y="${m[1]}" font-size="3.2" text-anchor="middle" fill="#6d4c41">${k + 1}</text>`; }).join('');
  return `<svg viewBox="${minX.toFixed(1)} ${minY.toFixed(1)} ${(maxX - minX).toFixed(1)} ${(maxY - minY).toFixed(1)}" role="img" aria-label="Skiss över plagget med hur långt du har kommit">
    ${torsoPolys.concat(capPolys, lowPolys).map(q => `<polygon points="${q}" fill="#fff3f6"/>`).join('')}${fills}${outline}${marks}${lbl}${here}</svg>`;
}

// ---------------- Skärm tänd ----------------
let wake = null, wantWake = localStorage.getItem(KEY + '.wake') !== '0';
async function requestWake() {
  $('#wakeBtn').classList.toggle('on', wantWake);
  if (!wantWake || !('wakeLock' in navigator) || wake) return;
  try { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } catch { wake = null; }
}
function releaseWake() { if (wake) { wake.release().catch(() => {}); wake = null; } }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && $('#proj').classList.contains('active')) requestWake(); });
$('#wakeBtn').addEventListener('click', () => {
  wantWake = !wantWake; localStorage.setItem(KEY + '.wake', wantWake ? '1' : '0');
  if (wantWake) { requestWake(); toast('Skärmen hålls tänd medan projektet är öppet'); } else { releaseWake(); $('#wakeBtn').classList.remove('on'); toast('Skärmen får släckas som vanligt'); }
});

// ---------------- Navigering ----------------
function goHome() { renderHome(); show('home'); }
$$('[data-back]').forEach(b => b.addEventListener('click', () => {
  if ($('#form').classList.contains('active') && formMode && formMode.mode === 'edit') openProject(formMode.id);
  else goHome();
}));

renderHome();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
