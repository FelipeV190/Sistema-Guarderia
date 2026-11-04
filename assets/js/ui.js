/* ============================================================
   ui.js - Componentes de interfaz reutilizables
   Incluye los estados vacíos y los mensajes explicativos
   exigidos por RNF-03 y el panel de "Acceso denegado" (RF-15).
   Expone el objeto global UI
   ============================================================ */
(function (global) {
  'use strict';

  var UI = {

    /* ---------- Utilidades de DOM ---------- */

    $: function (sel, raiz) { return (raiz || document).querySelector(sel); },
    $$: function (sel, raiz) {
      return Array.prototype.slice.call((raiz || document).querySelectorAll(sel));
    },

    el: function (html) {
      var d = document.createElement('div');
      d.innerHTML = String(html).trim();
      return d.firstElementChild;
    },

    montar: function (html) {
      var main = UI.$('#vista');
      main.innerHTML = html;
      main.scrollTop = 0;
      window.scrollTo(0, 0);
      return main;
    },

    /* ---------- Avisos ---------- */

    toast: function (mensaje, tipo) {
      var stack = UI.$('#toasts');
      var t = UI.el('<div class="toast toast--' + (tipo || 'ok') + '" role="status">' +
        U.esc(mensaje) + '</div>');
      stack.appendChild(t);
      setTimeout(function () {
        t.style.opacity = '0';
        t.style.transition = 'opacity .25s';
        setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 260);
      }, 4200);
    },

    alerta: function (tipo, html, icono) {
      var iconos = { info: 'i', ok: '✓', warn: '!', danger: '✕' };
      return '<div class="alert alert--' + tipo + '">' +
        '<span class="alert__icon">' + (icono || iconos[tipo] || 'i') + '</span>' +
        '<div>' + html + '</div></div>';
    },

    /* RNF-03: nunca una pantalla vacía sin explicación */
    vacio: function (opts) {
      return '<div class="empty">' +
        '<div class="empty__icon">' + (opts.icono || '\u{1F4C4}') + '</div>' +
        '<div class="empty__title">' + U.esc(opts.titulo) + '</div>' +
        '<p class="empty__text">' + U.esc(opts.texto || '') + '</p>' +
        (opts.accion || '') + '</div>';
    },

    /* RF-15 / RNF-01: resultado de un acceso no autorizado */
    accesoDenegado: function (err, usuario) {
      var sinSesion = !usuario;
      return '<div class="card">' +
        '<div class="empty">' +
        '<div class="empty__icon">\u{1F512}</div>' +
        '<div class="empty__title">Acceso denegado</div>' +
        '<p class="empty__text">' + U.esc(err && err.message ? err.message :
          'No tiene autorización para consultar esta información.') + '</p>' +
        (usuario ? '<p class="empty__text small">Sesión actual: <strong>' + U.esc(usuario.nombre) +
          '</strong> (' + U.esc(usuario.rol) + ').</p>' : '') +
        '<div class="btn-row" style="justify-content:center">' +
        (sinSesion
          ? '<a class="btn btn--primary" href="#/login">Iniciar sesión</a>'
          : '<a class="btn" href="#/panel">Volver al inicio</a>' +
            '<button class="btn btn--ghost" data-accion="cerrar-sesion">Cerrar sesión</button>') +
        '</div></div></div>';
    },

    /* ---------- Encabezado de página ---------- */

    pageHead: function (opts) {
      return '<div class="page-head">' +
        '<div class="page-head__text">' +
        '<h1>' + U.esc(opts.titulo) + '</h1>' +
        (opts.desc ? '<p>' + opts.desc + '</p>' : '') +
        '</div>' +
        (opts.acciones ? '<div class="page-head__actions">' + opts.acciones + '</div>' : '') +
        '</div>';
    },

    /* ---------- Badges ---------- */

    badgeEstado: function (estado) {
      var clase = estado === ESTADOS.ACTIVA ? 'ok'
        : estado === ESTADOS.PENDIENTE ? 'warn'
          : estado === ESTADOS.RECHAZADA ? 'danger' : '';
      return '<span class="badge' + (clase ? ' badge--' + clase : '') + '">' +
        U.esc(estado) + '</span>';
    },

    badgeRol: function (rol) {
      var clase = rol === ROLES.ADMIN ? 'brand'
        : rol === ROLES.DOCENTE ? 'info'
          : rol === ROLES.ADMINISTRATIVO ? 'accent' : '';
      return '<span class="badge' + (clase ? ' badge--' + clase : '') + '">' + U.esc(rol) + '</span>';
    },

    badgeSaldo: function (saldo) {
      if (saldo > 0) return '<span class="badge badge--danger">Debe ' + U.money(saldo) + '</span>';
      if (saldo < 0) return '<span class="badge badge--info">A favor ' + U.money(-saldo) + '</span>';
      return '<span class="badge badge--ok">Al día</span>';
    },

    /* ---------- Tarjetas e indicadores ---------- */

    stat: function (label, valor, pie, chico) {
      return '<div class="stat">' +
        '<div class="stat__label">' + U.esc(label) + '</div>' +
        '<div class="stat__value' + (chico ? ' stat__value--sm' : '') + '">' + valor + '</div>' +
        (pie ? '<div class="stat__foot">' + pie + '</div>' : '') +
        '</div>';
    },

    barra: function (usado, total) {
      var pct = total > 0 ? Math.min(100, Math.round(usado * 100 / total)) : 0;
      return '<div class="bar" title="' + usado + ' de ' + total + '">' +
        '<div class="bar__fill' + (pct >= 100 ? ' bar__fill--full' : '') +
        '" style="width:' + pct + '%"></div></div>';
    },

    /* ---------- Tablas ---------- */

    tabla: function (opts) {
      if (!opts.filas.length) return UI.vacio(opts.vacio || { titulo: 'Sin datos' });
      var ths = opts.columnas.map(function (c) {
        return '<th' + (c.num ? ' class="num"' : '') + '>' + U.esc(c.titulo) + '</th>';
      }).join('');
      return '<div class="table-wrap"><table class="data">' +
        '<thead><tr>' + ths + '</tr></thead><tbody>' + opts.filas.join('') +
        '</tbody></table></div>';
    },

    /* ---------- Formularios ---------- */

    campo: function (opts) {
      var id = opts.id || opts.name;
      return '<div class="field">' +
        '<label for="' + id + '">' + U.esc(opts.label) +
        (opts.requerido ? ' <span class="field__req" title="Obligatorio">*</span>' : '') +
        '</label>' + opts.control +
        (opts.ayuda ? '<div class="field__help">' + opts.ayuda + '</div>' : '') +
        '<p class="field__error" data-error-for="' + U.esc(opts.name) + '" hidden></p>' +
        '</div>';
    },

    input: function (name, opts) {
      opts = opts || {};
      return '<input type="' + (opts.tipo || 'text') + '" id="' + U.esc(opts.id || name) +
        '" name="' + U.esc(name) + '" value="' + U.esc(opts.valor === undefined ? '' : opts.valor) + '"' +
        (opts.placeholder ? ' placeholder="' + U.esc(opts.placeholder) + '"' : '') +
        (opts.min !== undefined ? ' min="' + opts.min + '"' : '') +
        (opts.max !== undefined ? ' max="' + opts.max + '"' : '') +
        (opts.step !== undefined ? ' step="' + opts.step + '"' : '') +
        (opts.autocomplete ? ' autocomplete="' + opts.autocomplete + '"' : '') +
        (opts.readonly ? ' readonly' : '') + '>';
    },

    select: function (name, opciones, valor, opts) {
      opts = opts || {};
      var html = '<select id="' + U.esc(opts.id || name) + '" name="' + U.esc(name) + '">';
      if (opts.vacio !== false) {
        html += '<option value="">' + U.esc(opts.vacio || '-- Seleccione --') + '</option>';
      }
      opciones.forEach(function (o) {
        var v = (o.valor !== undefined) ? o.valor : o;
        var t = (o.texto !== undefined) ? o.texto : o;
        html += '<option value="' + U.esc(v) + '"' +
          (String(v) === String(valor) ? ' selected' : '') +
          (o.deshabilitado ? ' disabled' : '') + '>' + U.esc(t) + '</option>';
      });
      return html + '</select>';
    },

    textarea: function (name, valor, placeholder) {
      return '<textarea id="' + U.esc(name) + '" name="' + U.esc(name) + '"' +
        (placeholder ? ' placeholder="' + U.esc(placeholder) + '"' : '') + '>' +
        U.esc(valor || '') + '</textarea>';
    },

    /* Lee un formulario como objeto plano name -> valor */
    leerForm: function (form) {
      var out = {};
      UI.$$('input, select, textarea', form).forEach(function (c) {
        if (!c.name) return;
        if (c.type === 'checkbox') out[c.name] = c.checked;
        else out[c.name] = c.value.trim();
      });
      return out;
    },

    limpiarErrores: function (form) {
      UI.$$('[data-error-for]', form).forEach(function (p) {
        p.hidden = true; p.textContent = '';
      });
      UI.$$('[aria-invalid]', form).forEach(function (c) { c.removeAttribute('aria-invalid'); });
      var caja = UI.$('[data-resumen-errores]', form);
      if (caja) { caja.hidden = true; caja.innerHTML = ''; }
    },

    /* Pinta los errores devueltos por las validaciones de dominio */
    pintarErrores: function (form, errores) {
      UI.limpiarErrores(form);
      var sueltos = [];
      Object.keys(errores).forEach(function (campo) {
        var p = UI.$('[data-error-for="' + campo + '"]', form);
        var control = form.elements[campo];
        if (control && control.setAttribute) control.setAttribute('aria-invalid', 'true');
        if (p) { p.textContent = errores[campo]; p.hidden = false; }
        else sueltos.push(errores[campo]);
      });
      var caja = UI.$('[data-resumen-errores]', form);
      if (caja) {
        var total = Object.keys(errores).length;
        caja.innerHTML = UI.alerta('danger',
          '<strong>No se pudo guardar: ' + total + (total === 1 ? ' campo requiere' : ' campos requieren') +
          ' corrección.</strong>' +
          (sueltos.length ? '<ul style="margin:.4rem 0 0 1rem;padding:0">' +
            sueltos.map(function (s) { return '<li>' + U.esc(s) + '</li>'; }).join('') + '</ul>' : ''));
        caja.hidden = false;
      }
      var primero = UI.$('[aria-invalid="true"]', form);
      if (primero && primero.focus) primero.focus();
    },

    /* ---------- Modal ---------- */

    cerrarModal: function () {
      var m = UI.$('#modal');
      m.innerHTML = '';
      m.hidden = true;
    },

    modal: function (opts) {
      var cont = UI.$('#modal');
      cont.hidden = false;
      cont.innerHTML =
        '<div class="modal-backdrop" data-cerrar-modal>' +
        '<div class="modal" role="dialog" aria-modal="true" aria-label="' + U.esc(opts.titulo) + '">' +
        '<div class="modal__head"><h2>' + U.esc(opts.titulo) + '</h2></div>' +
        '<div class="modal__body">' + opts.cuerpo + '</div>' +
        '<div class="modal__foot">' +
        '<button class="btn" data-cerrar-modal>' + U.esc(opts.textoCancelar || 'Cancelar') + '</button>' +
        (opts.textoOk ? '<button class="btn ' + (opts.claseOk || 'btn--primary') +
          '" data-modal-ok>' + U.esc(opts.textoOk) + '</button>' : '') +
        '</div></div></div>';

      UI.$$('[data-cerrar-modal]', cont).forEach(function (b) {
        b.addEventListener('click', function (ev) {
          if (ev.target === b) UI.cerrarModal();
        });
      });
      var ok = UI.$('[data-modal-ok]', cont);
      if (ok) {
        ok.addEventListener('click', function () {
          var cerrar = true;
          if (opts.onOk) cerrar = opts.onOk(UI.$('.modal', cont)) !== false;
          if (cerrar) UI.cerrarModal();
        });
      }
      var foco = UI.$('input, select, textarea, [data-modal-ok]', cont);
      if (foco && foco.focus) foco.focus();
      return cont;
    },

    confirmar: function (opts) {
      UI.modal({
        titulo: opts.titulo,
        cuerpo: '<p>' + opts.mensaje + '</p>' + (opts.extra || ''),
        textoOk: opts.textoOk || 'Confirmar',
        claseOk: opts.claseOk || 'btn--primary',
        onOk: opts.onOk
      });
    },

    /* Algunos contenedores (vistas previas en iframe) bloquean la impresión */
    imprimir: function () {
      try {
        window.print();
      } catch (e) {
        UI.toast('Su navegador bloqueó el diálogo de impresión. Use Ctrl+P para guardar el comprobante.', 'warn');
      }
    }
  };

  global.UI = UI;
})(window);
