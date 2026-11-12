/* CotizoYa - cálculos puros (sin DOM). Todo en centavos enteros. */
(function (root) {
  'use strict';

  function parseNum(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v == null ? '' : v).replace(/[$\s]/g, '').replace(/,/g, '');
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }
  // redondeo estable a entero (evita 1.005*100 = 100.49999)
  function rnd(x) { return Math.round(Number(x.toPrecision(12))); }

  function lineCents(it) {
    var q = Math.max(0, parseNum(it.qty)), p = Math.max(0, parseNum(it.price));
    return rnd(q * p * 100);
  }

  function compute(q) {
    var items = (q.items || []);
    var lines = items.map(lineCents);
    var S = lines.reduce(function (a, b) { return a + b; }, 0);
    var dv = Math.max(0, parseNum(q.discVal));
    var D = q.discType === 'amt' ? rnd(dv * 100) : rnd(S * Math.min(dv, 100) / 100);
    D = Math.min(D, S);
    var net = S - D, base, iva, total;
    if (q.ivaOn) {
      if (q.ivaIncluded) { total = net; base = rnd(net * 100 / 116); iva = total - base; }
      else { base = net; iva = rnd(base * 16 / 100); total = base + iva; }
    } else { base = net; iva = 0; total = net; }
    var av = Math.max(0, parseNum(q.advVal));
    var A = q.advType === 'amt' ? rnd(av * 100) : rnd(total * Math.min(av, 100) / 100);
    A = Math.min(A, total);
    return { lines: lines, subtotal: S, discount: D, base: base, iva: iva, total: total, advance: A, balance: total - A };
  }

  var U = ['cero', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince',
    'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiún', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
  var T = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  var C = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

  function below1000(n) { // 1..999, con apócope "un" (siempre antes de sustantivo masculino)
    if (n === 100) return 'cien';
    var out = [], c = Math.floor(n / 100), r = n % 100;
    if (c) out.push(C[c]);
    if (r) {
      if (r < 30) out.push(U[r]);
      else { var t = Math.floor(r / 10), u = r % 10; out.push(u ? T[t] + ' y ' + U[u] : T[t]); }
    }
    return out.join(' ');
  }
  function cardinal(n) { // 0 <= n < 1e12
    if (n === 0) return 'cero';
    var parts = [];
    var mm = Math.floor(n / 1e6), r = n % 1e6;
    if (mm) parts.push(mm === 1 ? 'un millón' : cardinal(mm) + ' millones');
    var th = Math.floor(r / 1000), rest = r % 1000;
    if (th) parts.push(th === 1 ? 'mil' : below1000(th) + ' mil');
    if (rest) parts.push(below1000(rest));
    return parts.join(' ');
  }
  // 1200 centavos*100 => "mil doscientos pesos 00/100 M.N."
  function totalEnLetra(cents) {
    cents = Math.max(0, Math.round(cents));
    if (cents >= 1e14) return '(monto fuera de rango)';
    var pesos = Math.floor(cents / 100), cc = cents % 100;
    var w = cardinal(pesos);
    var de = pesos > 0 && pesos % 1e6 === 0 ? ' de' : '';
    var noun = pesos === 1 ? 'peso' : 'pesos';
    return w + de + ' ' + noun + ' ' + (cc < 10 ? '0' : '') + cc + '/100 M.N.';
  }

  var fmtMXN = (typeof Intl !== 'undefined')
    ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }) : null;
  function money(cents) {
    var v = cents / 100;
    if (fmtMXN) return fmtMXN.format(v);
    return '$' + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function qtyFmt(n) {
    n = parseNum(n);
    return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)));
  }

  var api = { parseNum: parseNum, lineCents: lineCents, compute: compute, totalEnLetra: totalEnLetra, money: money, qtyFmt: qtyFmt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CF = api;
})(typeof window !== 'undefined' ? window : globalThis);
