'use strict';
// Räknar fram en raglan uppifrån och ner (cardigan fram och tillbaka, tröja runt) som en lista med steg.
(function () {
  const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  // Färdiga plaggmått i cm (inklusive rörelsevidd).
  const PRESETS = {
    chest:     [88, 96, 104, 112, 122, 132],
    neckCard:  [44, 46, 48, 50, 52, 54],
    neckSweat: [48, 50, 52, 54, 56, 58],
    upperArm:  [29, 31, 33, 35, 38, 41],
    wrist:     [19, 20, 21, 22, 23, 24],
    yoke:      [19, 20, 21, 22.5, 24, 25.5],
    bodyLen:   [35, 36, 37, 38, 39, 40],
    sleeveLen: [44, 45, 46, 46, 47, 47],
    underarm:  [2.5, 3, 3, 3.5, 4, 4.5],
  };
  const NEEDLE_GAUGE = [[2, 36], [2.5, 32], [3, 28], [3.5, 24], [4, 22], [4.5, 20], [5, 18], [5.5, 16], [6, 15], [7, 13], [8, 12], [10, 10], [12, 8]];

  const EV = {
    inc: 'Ökning', btn: 'Knapphål', dec: 'Minskning', split: 'Delning', rib: 'Resår', bo: 'Avmaskning', mark: 'Markörer', start: 'Start',
  };

  function presetFor(type, size) {
    const i = SIZES.indexOf(size);
    if (i < 0) return null;
    return {
      chest: PRESETS.chest[i], neck: (type === 'cardigan' ? PRESETS.neckCard : PRESETS.neckSweat)[i],
      upperArm: PRESETS.upperArm[i], wrist: PRESETS.wrist[i], yoke: PRESETS.yoke[i],
      bodyLen: PRESETS.bodyLen[i], sleeveLen: PRESETS.sleeveLen[i], underarm: PRESETS.underarm[i],
    };
  }

  function gaugeFromNeedle(mm) {
    if (!(mm > 0)) return null;
    const t = NEEDLE_GAUGE;
    let st;
    if (mm <= t[0][0]) st = t[0][1];
    else if (mm >= t[t.length - 1][0]) st = t[t.length - 1][1];
    else for (let i = 1; i < t.length; i++) if (mm <= t[i][0]) {
      const [a, sa] = t[i - 1], [b, sb] = t[i];
      st = sa + (sb - sa) * (mm - a) / (b - a); break;
    }
    st = Math.round(st);
    return { st, row: Math.round(st * 1.36) };
  }

  function defaults(type, size) {
    return Object.assign({
      type, size, stG: 22, rowG: 30, neckRib: 2.5, hemRib: 5, cuffRib: 5,
      band: 2.5, buttons: 7, buttonSide: 'höger',
    }, presetFor(type, size));
  }

  const odd = n => (n % 2 ? n : n + 1);
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

  function generate(p) {
    const card = p.type === 'cardigan';
    const s = p.stG / 10, r = p.rowG / 10;
    const warnings = [];
    const rowsFor = cm => Math.max(1, Math.round(cm * r));

    const band = card ? Math.max(3, Math.round(p.band * s)) : 0;
    let neckSts = Math.round(p.neck * s);
    if (!card && neckSts % 2) neckSts++;
    const c = Math.max(2, Math.round(p.underarm * s));
    const bodyT = Math.round(p.chest * s);
    const torsoT = bodyT - 2 * c;
    let frontT, backT;
    if (card) { frontT = Math.floor(torsoT / 4); backT = torsoT - 2 * frontT; }
    else { backT = Math.round(torsoT / 2); frontT = torsoT - backT; }
    const sleeveT = Math.round(p.upperArm * s) - c;

    const sleeve0 = Math.max(2, Math.round(neckSts * 0.14));
    const kS = Math.max(0, Math.round((sleeveT - sleeve0) / 2));
    const bodyNeck = neckSts - 2 * sleeve0;
    let kB, back0, front0;
    if (card) {
      kB = Math.floor((backT + 2 * frontT - bodyNeck) / 4);
      front0 = frontT - kB; back0 = bodyNeck - 2 * front0;
    } else {
      kB = Math.floor((backT + frontT - bodyNeck) / 4);
      back0 = backT - 2 * kB; front0 = bodyNeck - back0;
    }
    if (kB < 0) { warnings.push('Halsen är för vid jämfört med bröstvidden – minska halsvidden eller öka bröstvidden.'); kB = 0; }
    if (back0 < 2 || front0 < (card ? band + 1 : 2)) warnings.push('Halsvidden är för liten för den här bröstvidden – öka halsvidden.');
    if (sleeveT - sleeve0 < 0) warnings.push('Överarmsvidden är väldigt smal jämfört med halsen.');

    const K = Math.max(kB, kS);
    const both = Math.min(kB, kS);
    const extraKind = kB > kS ? 'body' : 'sleeve';

    let nr = rowsFor(p.neckRib); if (card && nr % 2) nr++; nr = Math.max(2, nr);
    const yokeTarget = Math.max(2, rowsFor(p.yoke) - nr - 1);
    let n1 = 0;
    if (2 * K > yokeTarget) { n1 = Math.min(K, 2 * K - yokeTarget); if (card && n1 % 2 && n1 < K) n1++; }
    const base = n1 + 2 * (K - n1);
    let extra = Math.max(0, yokeTarget - base);
    if (card && (nr + 1 + base + extra) % 2 === 1) extra += extra > 0 ? -1 : 1;
    const yokeRows = base + extra;
    if (base > yokeTarget + 1) warnings.push(`Oket blir ca ${((nr + 1 + yokeRows) / r).toFixed(1)} cm djupt (du angav ${p.yoke} cm) för att hinna med alla ökningar.`);

    let bodyRows = Math.max(2, rowsFor(p.bodyLen - p.hemRib));
    const hemRows = rowsFor(p.hemRib);
    const torsoRows = nr + 1 + yokeRows + bodyRows + hemRows;

    // Knapphål: jämnt fördelade rätsidesvarv från halsresåren till nederkantsresåren.
    const btnRows = new Set();
    if (card && p.buttons > 0) {
      const first = odd(Math.max(1, Math.round(nr / 2) - 1));
      let last = torsoRows - Math.round(hemRows / 2); if (last % 2 === 0) last--;
      const nb = Math.round(p.buttons);
      for (let i = 0; i < nb; i++) {
        let row = nb === 1 ? first : Math.round(first + (last - first) * i / (nb - 1));
        if (row % 2 === 0) row = row + 1 > last ? row - 1 : row + 1;
        btnRows.add(row);
      }
    }
    const mid = Math.ceil(band / 2);
    const btnText = p.buttonSide === 'vänster'
      ? `Knapphål i vänster framkant: sticka ${mid - 1} m, gör 1 omslag, sticka 2 m tills, sticka sedan vidare.`
      : `Knapphål i höger framkant: när ${mid + 1} m återstår av varvet, sticka 2 m tills, gör 1 omslag, sticka varvet ut.`;

    const sections = [], steps = [];
    let sec = -1, part = 'torso', torsoRow = 0, sts = 0;
    const section = (title, intro, pt) => { part = pt; sections.push({ title, intro, part: pt, start: steps.length }); sec = sections.length - 1; };
    const push = o => steps.push(Object.assign({ sec, part, notes: [], ev: [], sts }, o));
    const side = () => (card ? (torsoRow % 2 ? 'RS' : 'WS') : null);
    const torso = (text, ev, notes) => {
      torsoRow++;
      if (btnRows.has(torsoRow)) { notes = (notes || []).concat(btnText); ev = (ev || []).concat('btn'); }
      push({ kind: 'row', row: torsoRow, side: side(), text, ev: ev || [], notes: notes || [], cm: torsoRow / r });
    };
    const plainTorso = () => torso(card ? (side2() === 'RS' ? 'Sticka rätt.' : 'Sticka avigt.') : 'Sticka rätt runt.');
    const side2 = () => (card ? ((torsoRow + 1) % 2 ? 'RS' : 'WS') : null);

    // --- Hals
    sts = neckSts;
    section('Uppläggning och halsresår', card
      ? `Framkanterna (${band} m i varje sida) stickas i rätstickning hela vägen ner, alltså rätt även på avigsidan. Varv 1 är från rätsidan och börjar i vänster framkant.`
      : 'Stickas runt på rundsticka. Varvets början är vid övergången bakstycke/ärm – sätt en markör av annan färg där.', 'torso');
    push({ kind: 'task', text: card ? `Lägg upp ${neckSts} m på rundstickan.` : `Lägg upp ${neckSts} m och slut till ett varv utan att vrida maskorna.`, ev: ['start'], cm: 0 });
    for (let i = 0; i < nr; i++) {
      if (card) torso(side2() === 'RS' ? `Resår: ${band} m rätt, *1 rm, 1 am* till ${band} m återstår, ${band} m rätt.` : 'Sticka maskorna som de visar sig (framkanterna rätt).', i === 0 ? ['rib'] : []);
      else torso('Resår runt: *1 rm, 1 am*.', i === 0 ? ['rib'] : []);
    }

    // --- Ok
    const parts = card
      ? `${front0} m (vänster framstycke), markör, ${sleeve0} m (ärm), markör, ${back0} m (bakstycke), markör, ${sleeve0} m (ärm), markör, ${front0} m (höger framstycke)`
      : `${sleeve0} m (ärm), markör, ${front0} m (framstycke), markör, ${sleeve0} m (ärm), markör, ${back0} m (bakstycke) – varvets början är fjärde markören`;
    section('Ok med raglanökningar', `Öka genom att lyfta upp tråden mellan maskorna och sticka den vriden. ${plural(K, 'ökningsvarv', 'ökningsvarv')} totalt.`, 'torso');
    torso(`Sticka rätt och sätt markörer: ${parts}.`, ['mark']);
    const incText = (k, sd) => {
      const avig = sd === 'WS' ? ' (aviga ökningar)' : '';
      if (k === 'both') return `Ökningsvarv: öka 1 m på båda sidor om varje markör (+8 m)${avig}.`;
      if (k === 'body') return `Ökningsvarv: öka 1 m på kroppens sida om varje markör, inte på ärmarna (+4 m)${avig}.`;
      return `Ökningsvarv: öka 1 m på ärmens sida om varje markör, inte på kroppen (+4 m)${avig}.`;
    };
    let incDone = 0;
    const doInc = (k) => {
      incDone++; sts += k === 'both' ? 8 : 4;
      const sd = side2();
      torso(incText(k, sd), ['inc'], [`Ökning ${incDone} av ${K}.`]);
    };
    for (let i = 0; i < K; i++) {
      const k = i < both ? 'both' : extraKind;
      if (i >= n1) plainTorso();
      doInc(k);
    }
    for (let i = 0; i < extra; i++) torso((card ? (side2() === 'RS' ? 'Sticka rätt' : 'Sticka avigt') : 'Sticka rätt runt') + ' utan ökningar.');

    const sleeveSts = sleeve0 + 2 * kS;
    const backSts = back0 + 2 * kB;
    const frontSts = card ? front0 + kB : front0 + 2 * kB;
    const bodySts = (card ? 2 * frontSts : frontSts) + backSts + 2 * c;

    // --- Kropp
    sts = bodySts;
    section('Kroppen', `Kroppen har ${bodySts} m. Ärmmaskorna vilar på trådar tills kroppen är klar.`, 'torso');
    const split = card
      ? `Delningsvarv: sticka ${frontSts} m, sätt ${sleeveSts} m på en tråd (ärm), lägg upp ${c} m, sticka ${backSts} m, sätt ${sleeveSts} m på en tråd (ärm), lägg upp ${c} m, sticka ${frontSts} m. = ${bodySts} m.`
      : `Delningsvarv: sätt ${sleeveSts} m på en tråd (ärm), lägg upp ${c} m, sticka ${frontSts} m, sätt ${sleeveSts} m på en tråd (ärm), lägg upp ${c} m, sticka ${backSts} m. = ${bodySts} m.`;
    torso(split, ['split']);
    for (let i = 1; i < bodyRows; i++) plainTorso();
    section('Nederkant', card ? 'Resåren stickas mellan framkanterna.' : '', 'torso');
    for (let i = 0; i < hemRows; i++) {
      if (card) torso(side2() === 'RS' ? `Resår: ${band} m rätt, *1 rm, 1 am* till ${band} m återstår, ${band} m rätt.` : 'Sticka maskorna som de visar sig (framkanterna rätt).', i === 0 ? ['rib'] : []);
      else torso('Resår runt: *1 rm, 1 am*.', i === 0 ? ['rib'] : []);
    }
    push({ kind: 'task', text: 'Maska av löst i resår.', ev: ['bo'], cm: torsoRows / r });

    // --- Ärmar
    const pick = c + ((sleeveSts + c) % 2);
    const S = sleeveSts + pick;
    let wristSts = Math.round(p.wrist * s); if ((S - wristSts) % 2) wristSts--;
    const nDec = Math.max(0, (S - wristSts) / 2);
    const armRows = Math.max(2, rowsFor(p.sleeveLen - p.cuffRib));
    const cuffRows = rowsFor(p.cuffRib);
    const d0 = Math.min(rowsFor(4), Math.floor(armRows / 4)), d1 = Math.min(rowsFor(5), Math.floor(armRows / 4));
    const avail = armRows - d0 - d1;
    let interval = nDec > 0 ? Math.floor(avail / nDec) : 0;
    if (nDec > 0 && interval < 1) { interval = 1; warnings.push('Ärmen är för kort för alla minskningar – minskar varje varv.'); }
    const decRows = new Set();
    for (let j = 0; j < nDec; j++) decRows.add(d0 + j * interval + 1);
    const realDec = [...decRows].filter(x => x <= armRows).length;

    for (const a of [1, 2]) {
      const pt = 'arm' + a;
      sts = S;
      section(`Ärm ${a}`, `Stickas runt på strumpstickor eller kort rundsticka. Minska ${plural(realDec, 'gång', 'gånger')}, var ${interval}:e varv.`, pt);
      push({ kind: 'task', text: `Sätt tillbaka ${sleeveSts} m från tråden, plocka upp ${pick} m under ärmen och sätt en markör mitt i dem (varvets början). = ${S} m.`, ev: ['start'], cm: 0 });
      let dn = 0;
      for (let i = 1; i <= armRows; i++) {
        if (decRows.has(i)) {
          dn++; sts -= 2;
          push({ kind: 'row', row: i, side: null, text: 'Minskningsvarv: sticka 1 m, 2 m tills, sticka till 3 m återstår, 2 m tills (överdragsminskning), 1 m (−2 m).', ev: ['dec'], notes: [`Minskning ${dn} av ${realDec}.`], cm: i / r });
        } else push({ kind: 'row', row: i, side: null, text: 'Sticka rätt runt.', cm: i / r });
      }
      section(`Mudd ärm ${a}`, '', pt);
      for (let i = 1; i <= cuffRows; i++) push({ kind: 'row', row: armRows + i, side: null, text: 'Resår runt: *1 rm, 1 am*.', ev: i === 1 ? ['rib'] : [], cm: (armRows + i) / r });
      push({ kind: 'task', text: 'Maska av löst i resår.', ev: ['bo'], cm: (armRows + cuffRows) / r });
    }
    section('Montering', '', 'done');
    push({ kind: 'task', text: card ? 'Fäst alla trådar, sy i knapparna och blocka koftan.' : 'Fäst alla trådar och blocka tröjan.', cm: 0 });

    // numrering inom avsnitt
    sections.forEach((sc, i) => { sc.end = i + 1 < sections.length ? sections[i + 1].start : steps.length; sc.rows = steps.slice(sc.start, sc.end).filter(x => x.kind === 'row').length; });
    let lastSec = -1, cnt = 0;
    for (const st of steps) {
      if (st.sec !== lastSec) { lastSec = st.sec; cnt = 0; }
      if (st.kind === 'row') cnt++;
      st.n = cnt;
    }

    const finished = {
      chest: bodySts / s, neck: neckSts / s, upperArm: S / s, wrist: wristSts / s,
      yoke: (nr + 1 + yokeRows) / r, bodyLen: (bodyRows + hemRows) / r, sleeveLen: (armRows + cuffRows) / r,
    };
    return {
      steps, sections, warnings, finished,
      geo: { neckW: p.neck, chestW: p.chest, yoke: finished.yoke, body: finished.bodyLen, sleeve: finished.sleeveLen, upperArm: finished.upperArm, wrist: finished.wrist, torsoCm: torsoRows / r, armCm: (armRows + cuffRows) / r, card },
      counts: { neckSts, sleeve0, back0, front0, K, n1, sleeveSts, backSts, frontSts, bodySts, c, S, wristSts, nDec: realDec, interval, band, totalRows: steps.filter(x => x.kind === 'row').length, btn: [...btnRows].sort((a, b) => a - b) },
    };
  }

  window.Stick = { SIZES, EV, presetFor, gaugeFromNeedle, defaults, generate };
})();
