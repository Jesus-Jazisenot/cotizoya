/* Generación de PDF en el navegador con jsPDF (vendor local, funciona offline). */
(function (root) {
  'use strict';
  var CF = root.CF;

  function fechaLarga(iso) {
    var d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function vigenciaTxt(q) {
    var n = parseInt(q.validDays, 10);
    if (!n || n < 1) return '';
    var d = new Date(q.date + 'T12:00:00'); d.setDate(d.getDate() + n);
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function buildPDF(q, biz) {
    var J = root.jspdf.jsPDF;
    var doc = new J({ unit: 'mm', format: 'a4' });
    var W = 210, M = 15, R = W - M, y = 15;
    var r = CF.compute(q);
    var ACC = [31, 94, 70];

    // Encabezado
    var textX = M;
    if (biz.logo) {
      try {
        var p = doc.getImageProperties(biz.logo);
        var h = 20, w = h * p.width / p.height; if (w > 40) { w = 40; h = w * p.height / p.width; }
        doc.addImage(biz.logo, p.fileType || 'PNG', M, y, w, h);
        textX = M + w + 5;
      } catch (e) { /* logo inválido: se omite */ }
    }
    doc.setTextColor(30); doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
    var bn = doc.splitTextToSize(biz.name || 'Mi negocio', 95);
    doc.text(bn, textX, y + 6);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90);
    var ly = y + 6 + bn.length * 6;
    if (biz.phone) { doc.text('Tel/WhatsApp: ' + biz.phone, textX, ly); ly += 5; }
    if (biz.email) { doc.text(biz.email, textX, ly); ly += 5; }

    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(ACC[0], ACC[1], ACC[2]);
    doc.text('COTIZACIÓN', R, y + 6, { align: 'right' });
    doc.setFontSize(10); doc.setTextColor(60);
    doc.text('Folio: ' + q.folio, R, y + 13, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text('Fecha: ' + fechaLarga(q.date), R, y + 18, { align: 'right' });
    var vt = vigenciaTxt(q);
    if (vt) doc.text('Vigencia: hasta el ' + vt, R, y + 23, { align: 'right' });
    y = Math.max(ly, y + 26) + 4;
    doc.setDrawColor(ACC[0], ACC[1], ACC[2]); doc.setLineWidth(0.6); doc.line(M, y, R, y); y += 7;

    // Cliente
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(120);
    doc.text('PARA', M, y); y += 5;
    doc.setFontSize(11); doc.setTextColor(30);
    doc.text(q.client.name || 'Cliente', M, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(80);
    if (q.client.phone) { doc.text('Tel: ' + q.client.phone, M, y); y += 5; }
    y += 3;

    // Tabla
    var cx = { qty: M + 2, unit: M + 20, desc: M + 42, price: R - 30, amt: R - 2 };
    function header() {
      doc.setFillColor(ACC[0], ACC[1], ACC[2]); doc.rect(M, y, R - M, 7, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255);
      doc.text('Cant.', cx.qty, y + 4.8); doc.text('Unidad', cx.unit, y + 4.8);
      doc.text('Descripción', cx.desc, y + 4.8);
      doc.text('P. unit.', cx.price, y + 4.8, { align: 'right' });
      doc.text('Importe', cx.amt, y + 4.8, { align: 'right' });
      y += 7;
    }
    header();
    doc.setFontSize(10);
    q.items.forEach(function (it, i) {
      var desc = doc.splitTextToSize(it.desc || '(sin descripción)', price_left() - cx.desc);
      var rowH = Math.max(7, desc.length * 4.6 + 2.4);
      if (y + rowH > 270) { doc.addPage(); y = 15; header(); doc.setFontSize(10); }
      if (i % 2) { doc.setFillColor(244, 247, 245); doc.rect(M, y, R - M, rowH, 'F'); }
      doc.setFont('helvetica', 'normal'); doc.setTextColor(30);
      doc.text(CF.qtyFmt(it.qty), cx.qty, y + 4.8);
      doc.text(doc.splitTextToSize(it.unit || '', 20)[0] || '', cx.unit, y + 4.8);
      doc.text(desc, cx.desc, y + 4.8);
      doc.text(CF.money(Math.round(CF.parseNum(it.price) * 100)), cx.price, y + 4.8, { align: 'right' });
      doc.text(CF.money(r.lines[i]), cx.amt, y + 4.8, { align: 'right' });
      y += rowH;
    });
    function price_left() { return cx.price - 22; }
    doc.setDrawColor(200); doc.setLineWidth(0.2); doc.line(M, y, R, y); y += 6;

    // Totales
    if (y > 225) { doc.addPage(); y = 15; }
    var lx = R - 70;
    function row(label, val, bold) {
      doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(bold ? 12 : 10);
      doc.setTextColor(bold ? 20 : 70);
      doc.text(label, lx, y); doc.text(val, R - 2, y, { align: 'right' }); y += bold ? 7 : 5.5;
    }
    var hasAdj = r.discount > 0 || q.ivaOn;
    if (hasAdj) row(q.ivaOn && q.ivaIncluded ? 'Subtotal (IVA incluido)' : 'Subtotal', CF.money(r.subtotal));
    if (r.discount > 0) row('Descuento', '-' + CF.money(r.discount));
    if (q.ivaOn) { row('Subtotal sin IVA', CF.money(r.base)); row('IVA 16%', CF.money(r.iva)); }
    doc.setDrawColor(ACC[0], ACC[1], ACC[2]); doc.setLineWidth(0.4); doc.line(lx, y - 3, R, y - 3); y += 1.5;
    row('TOTAL', CF.money(r.total), true);
    if (r.advance > 0) {
      row('Anticipo', CF.money(r.advance));
      row('Saldo por pagar', CF.money(r.balance));
    }
    y += 2;
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(80);
    var letra = doc.splitTextToSize('Total en letra: ' + cap(CF.totalEnLetra(r.total)), R - M);
    doc.text(letra, M, y); y += letra.length * 4.4 + 4;

    // Notas
    if (q.notes && q.notes.trim()) {
      var nl = doc.splitTextToSize(q.notes.trim(), R - M);
      if (y + 8 + nl.length * 4.4 > 280) { doc.addPage(); y = 15; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(120);
      doc.text('NOTAS Y CONDICIONES', M, y); y += 5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(60);
      doc.text(nl, M, y); y += nl.length * 4.4;
    }

    // Pie en todas las páginas
    var n = doc.getNumberOfPages();
    for (var i = 1; i <= n; i++) {
      doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(150);
      doc.text('Cotización ' + q.folio + ' - generada con CotizoYa', M, 290);
      doc.text('Página ' + i + ' de ' + n, R, 290, { align: 'right' });
    }
    return doc;
  }

  function fileName(q, biz) {
    var s = ((biz.name || 'Cotizacion') + '-' + q.folio).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return s + '.pdf';
  }

  root.CFpdf = { buildPDF: buildPDF, fileName: fileName, fechaLarga: fechaLarga, vigenciaTxt: vigenciaTxt };
})(window);
