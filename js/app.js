/* CotizoYa - lógica de la app. Todo local (localStorage). Sin analítica ni terceros. */
(function () {
  'use strict';
  var CF = window.CF, $ = function (s, c) { return (c || document).querySelector(s); }, $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  // ---------- almacenamiento seguro ----------
  var mem = {};
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? (k in mem ? mem[k] : d) : JSON.parse(v); } catch (e) { return k in mem ? mem[k] : d; } },
    set: function (k, v) { mem[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* cuota/privado */ } }
  };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  // ---------- estado ----------
  var biz = store.get('cf_biz', { name: '', phone: '', email: '', logo: '' });
  var hist = store.get('cf_hist', []);
  var cat = store.get('cf_cat', []);
  var q;

  function nextFolio() { var n = (store.get('cf_folio', 0) || 0) + 1; store.set('cf_folio', n); return 'COT-' + String(n).padStart(4, '0'); }
  function blankQuote() {
    return { id: uid(), folio: nextFolio(), date: today(), validDays: 15, client: { name: '', phone: '' },
      items: [{ desc: '', qty: 1, unit: 'pza', price: '' }], ivaOn: false, ivaIncluded: false,
      discType: 'pct', discVal: '', advType: 'pct', advVal: '', notes: 'Precios en pesos mexicanos. ' };
  }
  function isEmpty(x) { return !x.client.name && !x.client.phone && x.items.every(function (i) { return !i.desc && !CF.parseNum(i.price); }); }
  function saveDraft() { store.set('cf_draft', q); }

  // ---------- UI helpers ----------
  var toastT;
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 3500); }
  function showTab(name) {
    $$('[data-tab]').forEach(function (s) { s.hidden = s.getAttribute('data-tab') !== name; });
    $$('[data-tab-btn]').forEach(function (b) { b.setAttribute('aria-current', b.getAttribute('data-tab-btn') === name ? 'page' : 'false'); });
    if (name === 'historial') renderHist();
    if (name === 'catalogo') renderCat();
    window.scrollTo(0, 0);
  }
  function openModal(id) { $('#' + id).hidden = false; }
  function closeModal(id) { $('#' + id).hidden = true; }

  // ---------- formulario de cotización ----------
  function rowHTML(it, i) {
    return '<div class="row" data-i="' + i + '">' +
      '<input class="r-desc" list="catlist" placeholder="Concepto (ej. Instalación de contacto)" aria-label="Concepto" value="' + esc(it.desc) + '">' +
      '<div class="row-nums">' +
      '<label>Cant.<input class="r-qty" inputmode="decimal" value="' + esc(it.qty) + '"></label>' +
      '<label>Unidad<input class="r-unit" list="unitlist" value="' + esc(it.unit) + '"></label>' +
      '<label>Precio $<input class="r-price" inputmode="decimal" placeholder="0.00" value="' + esc(it.price) + '"></label>' +
      '</div>' +
      '<div class="row-foot"><span class="r-amt">$0.00</span>' +
      '<button type="button" class="mini r-cat" title="Guardar en catálogo">+ Catálogo</button>' +
      '<button type="button" class="mini danger r-del" aria-label="Quitar concepto">Quitar</button></div></div>';
  }
  function renderRows() { $('#items').innerHTML = q.items.map(rowHTML).join(''); updateTotals(); }
  function fillForm() {
    $('#cl-name').value = q.client.name; $('#cl-phone').value = q.client.phone;
    $('#iva-on').checked = q.ivaOn; $('#iva-incl').value = q.ivaIncluded ? '1' : '0';
    $('#disc-type').value = q.discType; $('#disc-val').value = q.discVal;
    $('#adv-type').value = q.advType; $('#adv-val').value = q.advVal;
    $('#valid').value = q.validDays; $('#notes').value = q.notes;
    $('#folio').textContent = q.folio;
    $('#iva-opts').hidden = !q.ivaOn;
    renderRows();
  }
  function readForm() {
    q.client.name = $('#cl-name').value.trim(); q.client.phone = $('#cl-phone').value.trim();
    q.ivaOn = $('#iva-on').checked; q.ivaIncluded = $('#iva-incl').value === '1';
    q.discType = $('#disc-type').value; q.discVal = $('#disc-val').value;
    q.advType = $('#adv-type').value; q.advVal = $('#adv-val').value;
    q.validDays = $('#valid').value; q.notes = $('#notes').value;
    $$('#items .row').forEach(function (r, i) {
      q.items[i] = { desc: $('.r-desc', r).value, qty: $('.r-qty', r).value, unit: $('.r-unit', r).value, price: $('.r-price', r).value };
    });
  }
  function updateTotals() {
    var r = CF.compute(q);
    $$('#items .row').forEach(function (row, i) { $('.r-amt', row).textContent = CF.money(r.lines[i] || 0); });
    $('#iva-opts').hidden = !q.ivaOn;
    var h = [];
    function line(l, v, cls) { h.push('<div class="tl ' + (cls || '') + '"><span>' + l + '</span><span>' + v + '</span></div>'); }
    line(q.ivaOn && q.ivaIncluded ? 'Subtotal (IVA incluido)' : 'Subtotal', '<b id="t-subtotal">' + CF.money(r.subtotal) + '</b>');
    if (r.discount > 0) line('Descuento', '<b id="t-disc">-' + CF.money(r.discount) + '</b>');
    if (q.ivaOn) { line('Subtotal sin IVA', '<b id="t-base">' + CF.money(r.base) + '</b>'); line('IVA 16%', '<b id="t-iva">' + CF.money(r.iva) + '</b>'); }
    line('TOTAL', '<b id="t-total">' + CF.money(r.total) + '</b>', 'big');
    if (r.advance > 0) { line('Anticipo', '<b id="t-adv">' + CF.money(r.advance) + '</b>'); line('Saldo', '<b id="t-bal">' + CF.money(r.balance) + '</b>'); }
    $('#totals').innerHTML = h.join('');
    $('#t-letra').textContent = r.total > 0 ? '(' + CF.totalEnLetra(r.total) + ')' : '';
    saveDraft();
  }

  function validQuote() {
    readForm();
    var ok = q.items.some(function (i) { return CF.lineCents(i) > 0; });
    if (!ok) { toast('Agrega al menos un concepto con precio.'); return false; }
    if (!biz.name) toast('Tip: pon el nombre de tu negocio en la pestaña "Mi negocio".');
    return true;
  }
  function cleanQuote() { // sin renglones vacíos
    var c = JSON.parse(JSON.stringify(q));
    c.items = c.items.filter(function (i) { return i.desc || CF.lineCents(i) > 0; });
    return c;
  }
  function saveToHistory() {
    var c = cleanQuote(); c.saved = new Date().toISOString();
    var k = hist.findIndex(function (h) { return h.id === c.id; });
    if (k >= 0) hist[k] = c; else hist.unshift(c);
    store.set('cf_hist', hist);
    return c;
  }

  // ---------- PDF / WhatsApp / vista previa ----------
  function makePDF() { var c = saveToHistory(); return { doc: window.CFpdf.buildPDF(c, biz), q: c }; }
  function download(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  function summary(c) {
    var r = CF.compute(c);
    var t = '*Cotización ' + c.folio + '*' + (biz.name ? ' - ' + biz.name : '') + '\n';
    if (c.client.name) t += 'Para: ' + c.client.name + '\n';
    c.items.forEach(function (i, k) { t += '- ' + CF.qtyFmt(i.qty) + ' ' + (i.unit || '') + ' ' + (i.desc || '') + ': ' + CF.money(r.lines[k]) + '\n'; });
    t += '*Total: ' + CF.money(r.total) + '*' + (c.ivaOn ? ' (IVA incluido en el total)' : '') + '\n';
    if (r.advance > 0) t += 'Anticipo: ' + CF.money(r.advance) + ' - Saldo: ' + CF.money(r.balance) + '\n';
    var v = window.CFpdf.vigenciaTxt(c); if (v) t += 'Vigencia: hasta el ' + v + '\n';
    return t + 'Te adjunto el PDF con el detalle.';
  }
  $('#btn-pdf').onclick = function () {
    if (!validQuote()) return;
    var m = makePDF(); download(m.doc.output('blob'), window.CFpdf.fileName(m.q, biz)); toast('PDF generado y guardado en el historial.');
  };
  $('#btn-save').onclick = function () { if (!validQuote()) return; saveToHistory(); toast('Guardada en el historial.'); };
  $('#btn-wa').onclick = function () {
    if (!validQuote()) return;
    var m = makePDF(), name = window.CFpdf.fileName(m.q, biz), blob = m.doc.output('blob');
    var file; try { file = new File([blob], name, { type: 'application/pdf' }); } catch (e) { file = null; }
    var text = summary(m.q);
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'Cotización ' + m.q.folio, text: text }).catch(function (e) { if (e && e.name !== 'AbortError') toast('No se pudo compartir; usa Descargar PDF.'); });
      return;
    }
    download(blob, name);
    var digits = (m.q.client.phone || '').replace(/\D/g, '');
    if (digits.length === 10) digits = '52' + digits;
    var url = 'https://wa.me/' + (digits.length >= 11 ? digits : '') + '?text=' + encodeURIComponent(text);
    $('#wa-link').href = url; openModal('m-wa');
  };
  $('#btn-prev').onclick = function () {
    readForm(); var c = cleanQuote(), r = CF.compute(c);
    var rows = c.items.map(function (i, k) { return '<tr><td>' + esc(CF.qtyFmt(i.qty)) + ' ' + esc(i.unit) + '</td><td>' + esc(i.desc) + '</td><td class="n">' + CF.money(r.lines[k]) + '</td></tr>'; }).join('');
    var v = window.CFpdf.vigenciaTxt(c);
    $('#sheet').innerHTML = (biz.logo ? '<img class="logo" alt="Logo" src="' + esc(biz.logo) + '">' : '') +
      '<h3>' + esc(biz.name || 'Mi negocio') + '</h3><p class="muted">' + esc(biz.phone) + ' ' + esc(biz.email) + '</p>' +
      '<p><b>COTIZACIÓN ' + esc(c.folio) + '</b><br>Fecha: ' + esc(window.CFpdf.fechaLarga(c.date)) + (v ? '<br>Vigencia: hasta el ' + esc(v) : '') + '</p>' +
      '<p>Para: <b>' + esc(c.client.name || 'Cliente') + '</b></p><table>' + rows + '</table>' +
      (r.discount ? '<p class="n">Descuento: -' + CF.money(r.discount) + '</p>' : '') +
      (c.ivaOn ? '<p class="n">Subtotal sin IVA: ' + CF.money(r.base) + '<br>IVA 16%: ' + CF.money(r.iva) + '</p>' : '') +
      '<p class="n big">TOTAL: ' + CF.money(r.total) + '</p>' +
      (r.advance ? '<p class="n">Anticipo: ' + CF.money(r.advance) + ' / Saldo: ' + CF.money(r.balance) + '</p>' : '') +
      '<p class="muted">(' + esc(CF.totalEnLetra(r.total)) + ')</p>' + (c.notes.trim() ? '<p class="muted">' + esc(c.notes).replace(/\n/g, '<br>') + '</p>' : '');
    openModal('m-prev');
  };
  $('#btn-new').onclick = function () {
    readForm();
    if (!isEmpty(q) && !hist.some(function (h) { return h.id === q.id; }) && !confirm('Esta cotización no está guardada. ¿Empezar una nueva de todos modos?')) return;
    if (isEmpty(q) && !hist.some(function (h) { return h.id === q.id; })) { q.date = today(); } else q = blankQuote();
    fillForm(); window.scrollTo(0, 0);
  };

  // ---------- eventos del formulario ----------
  var form = $('#form');
  form.addEventListener('input', function (e) {
    readForm();
    if (e.target.classList.contains('r-desc')) { // autocompletar desde catálogo
      var row = e.target.closest('.row'), i = +row.dataset.i, m = cat.find(function (c) { return c.desc.toLowerCase() === e.target.value.trim().toLowerCase(); });
      if (m && !CF.parseNum(q.items[i].price)) { $('.r-unit', row).value = m.unit; $('.r-price', row).value = m.price; readForm(); }
    }
    updateTotals();
  });
  form.addEventListener('change', function () { readForm(); updateTotals(); });
  form.addEventListener('click', function (e) {
    var row = e.target.closest('.row'); if (!row) return; var i = +row.dataset.i;
    if (e.target.classList.contains('r-del')) { readForm(); q.items.splice(i, 1); if (!q.items.length) q.items.push({ desc: '', qty: 1, unit: 'pza', price: '' }); renderRows(); }
    if (e.target.classList.contains('r-cat')) {
      readForm(); var it = q.items[i];
      if (!it.desc.trim() || !CF.parseNum(it.price)) return toast('Escribe concepto y precio para guardarlo.');
      addCat(it.desc.trim(), it.unit, it.price); toast('Guardado en el catálogo.');
    }
  });
  $('#btn-add').onclick = function () { readForm(); q.items.push({ desc: '', qty: 1, unit: 'pza', price: '' }); renderRows(); var r = $$('#items .row'); $('.r-desc', r[r.length - 1]).focus(); };

  // ---------- catálogo ----------
  function addCat(desc, unit, price) {
    var k = cat.findIndex(function (c) { return c.desc.toLowerCase() === desc.toLowerCase(); });
    var e = { id: k >= 0 ? cat[k].id : uid(), desc: desc, unit: unit || 'pza', price: price };
    if (k >= 0) cat[k] = e; else cat.push(e);
    store.set('cf_cat', cat); refreshDatalist();
  }
  function refreshDatalist() { $('#catlist').innerHTML = cat.map(function (c) { return '<option value="' + esc(c.desc) + '">'; }).join(''); }
  function renderCat() {
    $('#cat-list').innerHTML = cat.length ? cat.map(function (c) {
      return '<li data-id="' + c.id + '"><div><b>' + esc(c.desc) + '</b><br><span class="muted">' + esc(c.unit) + ' - ' + CF.money(Math.round(CF.parseNum(c.price) * 100)) + '</span></div>' +
        '<div><button class="mini c-use">Usar</button> <button class="mini c-edit">Editar</button> <button class="mini danger c-del">Borrar</button></div></li>';
    }).join('') : '<li class="muted">Aún no tienes conceptos frecuentes. Agrega uno arriba o usa "+ Catálogo" en una cotización.</li>';
  }
  $('#cat-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var d = $('#c-desc').value.trim(), p = $('#c-price').value;
    if (!d || !CF.parseNum(p)) return toast('Escribe concepto y precio.');
    addCat(d, $('#c-unit').value.trim() || 'pza', p); e.target.reset(); renderCat();
  });
  $('#cat-list').addEventListener('click', function (e) {
    var li = e.target.closest('li[data-id]'); if (!li) return; var c = cat.find(function (x) { return x.id === li.dataset.id; }); if (!c) return;
    if (e.target.classList.contains('c-del')) { cat = cat.filter(function (x) { return x !== c; }); store.set('cf_cat', cat); refreshDatalist(); renderCat(); }
    if (e.target.classList.contains('c-edit')) { $('#c-desc').value = c.desc; $('#c-unit').value = c.unit; $('#c-price').value = c.price; $('#c-desc').focus(); }
    if (e.target.classList.contains('c-use')) {
      readForm(); var last = q.items[q.items.length - 1];
      var item = { desc: c.desc, qty: 1, unit: c.unit, price: c.price };
      if (last && !last.desc && !CF.parseNum(last.price)) q.items[q.items.length - 1] = item; else q.items.push(item);
      renderRows(); showTab('cotizar'); toast('Concepto agregado.');
    }
  });

  // ---------- historial ----------
  function renderHist() {
    $('#hist-list').innerHTML = hist.length ? hist.map(function (h) {
      var r = CF.compute(h);
      return '<li data-id="' + h.id + '"><div><b>' + esc(h.folio) + '</b> - ' + esc(h.client.name || 'Sin cliente') + '<br><span class="muted">' + esc(h.date) + ' - ' + CF.money(r.total) + '</span></div>' +
        '<div><button class="mini h-open">Abrir</button> <button class="mini h-dup">Duplicar</button> <button class="mini h-pdf">PDF</button> <button class="mini danger h-del">Borrar</button></div></li>';
    }).join('') : '<li class="muted">Todavía no hay cotizaciones guardadas. Se guardan solas al generar el PDF.</li>';
  }
  $('#hist-list').addEventListener('click', function (e) {
    var li = e.target.closest('li[data-id]'); if (!li) return; var h = hist.find(function (x) { return x.id === li.dataset.id; }); if (!h) return;
    var t = e.target.classList;
    if (t.contains('h-open')) { q = JSON.parse(JSON.stringify(h)); fillForm(); showTab('cotizar'); }
    if (t.contains('h-dup')) { q = JSON.parse(JSON.stringify(h)); q.id = uid(); q.folio = nextFolio(); q.date = today(); delete q.saved; fillForm(); showTab('cotizar'); toast('Duplicada como ' + q.folio + '.'); }
    if (t.contains('h-pdf')) { download(window.CFpdf.buildPDF(h, biz).output('blob'), window.CFpdf.fileName(h, biz)); }
    if (t.contains('h-del') && confirm('¿Borrar ' + h.folio + '?')) { hist = hist.filter(function (x) { return x !== h; }); store.set('cf_hist', hist); renderHist(); }
  });

  // ---------- mi negocio ----------
  function fillBiz() { $('#b-name').value = biz.name; $('#b-phone').value = biz.phone; $('#b-email').value = biz.email; showLogo(); }
  function showLogo() { var p = $('#logo-prev'); p.hidden = !biz.logo; if (biz.logo) p.src = biz.logo; $('#logo-del').hidden = !biz.logo; }
  $('#biz-form').addEventListener('input', function () {
    biz.name = $('#b-name').value.trim(); biz.phone = $('#b-phone').value.trim(); biz.email = $('#b-email').value.trim(); store.set('cf_biz', biz);
  });
  $('#b-logo').addEventListener('change', function (e) {
    var f = e.target.files[0]; if (!f) return;
    var img = new Image(), url = URL.createObjectURL(f);
    img.onload = function () {
      var s = Math.min(1, 400 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      biz.logo = c.toDataURL('image/png'); store.set('cf_biz', biz); URL.revokeObjectURL(url); showLogo(); toast('Logo guardado en este teléfono.');
    };
    img.onerror = function () { toast('No se pudo leer esa imagen.'); };
    img.src = url;
  });
  $('#logo-del').onclick = function () { biz.logo = ''; store.set('cf_biz', biz); showLogo(); };

  // ---------- navegación / modales ----------
  $$('[data-tab-btn]').forEach(function (b) { b.onclick = function () { showTab(b.getAttribute('data-tab-btn')); }; });
  $$('[data-close]').forEach(function (b) { b.onclick = function () { closeModal(b.getAttribute('data-close')); }; });
  $('#wa-link').addEventListener('click', function () { setTimeout(function () { closeModal('m-wa'); }, 300); });

  // ---------- arranque ----------
  q = store.get('cf_draft', null);
  if (!q || !q.items) q = blankQuote();
  fillBiz(); refreshDatalist(); fillForm(); showTab('cotizar');
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').catch(function () { });
  }
  window.__cf = { get q() { return q; }, get hist() { return hist; } }; // solo para pruebas
})();
