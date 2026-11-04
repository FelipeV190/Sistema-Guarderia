/* ============================================================
   utils.js - Utilidades transversales (formato, fechas, edades)
   Expone el objeto global U
   ============================================================ */
(function (global) {
  'use strict';

  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
    'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  var U = {

    /* ---------- Identificadores ---------- */
    uid: function (prefijo) {
      return (prefijo || 'id') + '-' + Date.now().toString(36) +
        Math.random().toString(36).slice(2, 7);
    },

    /* ---------- Fechas ---------- */

    // Partes de una fecha 'YYYY-MM-DD' sin pasar por Date (evita desfases UTC)
    partes: function (iso) {
      if (!iso) return null;
      var m = String(iso).slice(0, 10).split('-');
      if (m.length !== 3) return null;
      return { y: +m[0], m: +m[1], d: +m[2] };
    },

    hoy: function () {
      var d = new Date();
      return d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate());
    },

    ahora: function () {
      var d = new Date();
      return U.hoy() + 'T' + U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()) +
        ':' + U.pad(d.getSeconds());
    },

    pad: function (n) { return (n < 10 ? '0' : '') + n; },

    // '2024-03-15' -> '15 mar 2024'
    fmtFecha: function (iso) {
      var p = U.partes(iso);
      if (!p) return '--';
      return p.d + ' ' + MESES_CORTO[p.m - 1] + ' ' + p.y;
    },

    // '2024-03-15T09:41:02' -> '15 mar 2024, 09:41'
    fmtFechaHora: function (iso) {
      if (!iso) return '--';
      var base = U.fmtFecha(iso);
      var hora = String(iso).slice(11, 16);
      return hora ? base + ', ' + hora : base;
    },

    fmtFechaLarga: function (iso) {
      var p = U.partes(iso);
      if (!p) return '--';
      return p.d + ' de ' + MESES[p.m - 1] + ' de ' + p.y;
    },

    /* ---------- Periodos 'YYYY-MM' ---------- */

    periodoActual: function () { return U.hoy().slice(0, 7); },

    periodoDe: function (iso) { return String(iso || '').slice(0, 7); },

    // '2026-10' -> 'Octubre 2026'
    fmtPeriodo: function (periodo) {
      if (!periodo) return '--';
      var p = String(periodo).split('-');
      var mes = MESES[+p[1] - 1] || '';
      return mes.charAt(0).toUpperCase() + mes.slice(1) + ' ' + p[0];
    },

    addMeses: function (periodo, n) {
      var p = String(periodo).split('-');
      var total = (+p[0]) * 12 + (+p[1] - 1) + n;
      return Math.floor(total / 12) + '-' + U.pad((total % 12) + 1);
    },

    difMeses: function (desde, hasta) {
      var a = String(desde).split('-'), b = String(hasta).split('-');
      return ((+b[0]) * 12 + (+b[1])) - ((+a[0]) * 12 + (+a[1]));
    },

    // Lista inclusiva de periodos entre dos 'YYYY-MM'
    periodosEntre: function (desde, hasta) {
      var out = [], n = U.difMeses(desde, hasta);
      if (n < 0) return out;
      for (var i = 0; i <= n; i++) out.push(U.addMeses(desde, i));
      return out;
    },

    /* ---------- Edades ---------- */

    // Edad en meses cumplidos a la fecha de referencia (por defecto, hoy)
    mesesEdad: function (fechaNac, ref) {
      var n = U.partes(fechaNac), r = U.partes(ref || U.hoy());
      if (!n || !r) return null;
      var meses = (r.y - n.y) * 12 + (r.m - n.m);
      if (r.d < n.d) meses -= 1;          // aun no cumple el mes
      return meses < 0 ? 0 : meses;
    },

    // 31 -> '2 anos 7 meses'
    edadTexto: function (meses) {
      if (meses === null || meses === undefined) return '--';
      var a = Math.floor(meses / 12), m = meses % 12;
      var partes = [];
      if (a > 0) partes.push(a + (a === 1 ? ' año' : ' años'));
      if (m > 0 || a === 0) partes.push(m + (m === 1 ? ' mes' : ' meses'));
      return partes.join(' ');
    },

    // Rango de grupo en meses -> texto legible
    rangoTexto: function (min, max) {
      var f = function (m) {
        if (m % 12 === 0 && m >= 12) return (m / 12) + (m === 12 ? ' año' : ' años');
        return m + ' m';
      };
      return f(min) + ' a ' + f(max);
    },

    /* ---------- Dinero ---------- */

    money: function (valor) {
      var n = Math.round(Number(valor) || 0);
      var signo = n < 0 ? '-' : '';
      var s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      return signo + '$ ' + s;
    },

    /* ---------- Texto ---------- */

    esc: function (s) {
      return String(s === null || s === undefined ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    iniciales: function (nombre) {
      var p = String(nombre || '?').trim().split(/\s+/);
      return ((p[0] || '')[0] || '?').toUpperCase() +
        ((p[1] || '')[0] || '').toUpperCase();
    },

    // Normaliza para busquedas: minusculas y sin acentos
    norm: function (s) {
      return String(s || '').toLowerCase()
        .replace(/[áàäâ]/g, 'a')
        .replace(/[éèëê]/g, 'e')
        .replace(/[íìïî]/g, 'i')
        .replace(/[óòöô]/g, 'o')
        .replace(/[úùüû]/g, 'u')
        .replace(/ñ/g, 'n');
    },

    soloDigitos: function (s) { return String(s || '').replace(/\D+/g, ''); },

    /* ---------- Validaciones reutilizables ---------- */

    // RF-07: documento de identidad valido (6 a 12 digitos)
    documentoValido: function (doc) {
      var d = U.soloDigitos(doc);
      return d.length >= 6 && d.length <= 12;
    },

    emailValido: function (e) { return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(e || '').trim()); },

    telefonoValido: function (t) {
      var d = U.soloDigitos(t);
      return d.length >= 7 && d.length <= 15;
    },

    noVacio: function (s) { return String(s === null || s === undefined ? '' : s).trim().length > 0; },

    /* ---------- Varios ---------- */

    clone: function (o) { return JSON.parse(JSON.stringify(o)); },

    debounce: function (fn, ms) {
      var t;
      return function () {
        var args = arguments, self = this;
        clearTimeout(t);
        t = setTimeout(function () { fn.apply(self, args); }, ms || 220);
      };
    },

    sortBy: function (arr, fn) {
      return arr.slice().sort(function (a, b) {
        var x = fn(a), y = fn(b);
        return x < y ? -1 : x > y ? 1 : 0;
      });
    },

    sum: function (arr, fn) {
      return arr.reduce(function (acc, it) { return acc + (fn ? fn(it) : it); }, 0);
    }
  };

  global.U = U;
})(window);
