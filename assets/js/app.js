/* ============================================================
   app.js - Arranque, enrutador por hash y marco de la aplicación
   El enrutador es el primer control de acceso: exige sesión
   válida (RF-13) y permiso de rol antes de invocar una vista
   (RNF-01); cualquier fallo se resuelve como "Acceso denegado"
   (RF-15).
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------- Tabla de rutas ---------- */
  var RUTAS = [
    { patron: 'login', vista: 'login', publica: true },
    { patron: 'panel', vista: 'panel', permiso: 'panel' },
    { patron: 'ninos', vista: 'ninos', permiso: 'ninos.ver' },
    { patron: 'ninos/:id', vista: 'ninoDetalle', permiso: 'ninos.detalle' },
    { patron: 'matriculas', vista: 'matriculas', permiso: 'matricula.ver' },
    { patron: 'matriculas/nueva', vista: 'matriculaForm', permiso: 'matricula.crear' },
    { patron: 'matriculas/editar/:id', vista: 'matriculaForm', permiso: 'matricula.editar' },
    { patron: 'grupos', vista: 'grupos', permiso: 'grupos.gestionar' },
    { patron: 'docentes', vista: 'docentes', permiso: 'docentes.asignar' },
    { patron: 'pagos', vista: 'pagos', permiso: 'pagos.ver' },
    { patron: 'pagos/nuevo', vista: 'pagoForm', permiso: 'pagos.gestionar' },
    { patron: 'pagos/nuevo/:id', vista: 'pagoForm', permiso: 'pagos.gestionar' },
    { patron: 'pagos/estado/:id', vista: 'estadoCuenta', permiso: 'pagos.ver' },
    /* El comprobante lo puede ver el acudiente del niño: la vista aplica
       su propio control de acceso a nivel de registro (RF-14). */
    { patron: 'pagos/comprobante/:id', vista: 'comprobante' },
    { patron: 'portal', vista: 'portal', permiso: 'portal' },
    { patron: 'auditoria', vista: 'auditoria', permiso: 'auditoria' }
  ];

  /* ---------- Menú por rol ---------- */
  var MENU = [
    { href: '#/panel', texto: 'Inicio', permiso: 'panel' },
    { href: '#/portal', texto: 'Mis hijos', permiso: 'portal' },
    { href: '#/ninos', texto: 'Niños', permiso: 'ninos.ver' },
    { href: '#/matriculas', texto: 'Matrículas', permiso: 'matricula.ver' },
    { href: '#/grupos', texto: 'Grupos', permiso: 'grupos.gestionar' },
    { href: '#/docentes', texto: 'Docentes', permiso: 'docentes.asignar' },
    { href: '#/pagos', texto: 'Pagos', permiso: 'pagos.ver' },
    { href: '#/auditoria', texto: 'Auditoría', permiso: 'auditoria' }
  ];

  function parseHash() {
    var hash = (global.location.hash || '').replace(/^#\/?/, '').replace(/\/+$/, '');
    var partes = hash ? hash.split('/') : [];
    for (var i = 0; i < RUTAS.length; i++) {
      var seg = RUTAS[i].patron.split('/');
      if (seg.length !== partes.length) continue;
      var params = [], ok = true;
      for (var j = 0; j < seg.length; j++) {
        if (seg[j].charAt(0) === ':') params.push(decodeURIComponent(partes[j]));
        else if (seg[j] !== partes[j]) { ok = false; break; }
      }
      if (ok) return { def: RUTAS[i], params: params };
    }
    return null;
  }

  function inicio(usuario) {
    return usuario && usuario.rol === ROLES.ACUDIENTE ? '#/portal' : '#/panel';
  }

  /* ---------- Marco (encabezado y menú) ---------- */

  function pintarMarco(usuario) {
    var header = UI.$('#app-header');
    var footer = UI.$('#app-footer');

    if (!usuario) {
      header.hidden = true;
      footer.hidden = true;
      return;
    }
    header.hidden = false;
    footer.hidden = false;

    var gua = Dominio.guarderia(usuario.guarderiaId);
    var activo = (global.location.hash || '#/panel').split('/').slice(0, 2).join('/');

    header.innerHTML =
      '<div class="app-header__bar">' +
      '<div class="brand">' +
      '<div class="brand__mark">\u{1F9F8}</div>' +
      '<div><div class="brand__name">' + U.esc(gua ? gua.nombre : 'Sistema de guardería') + '</div>' +
      '<div class="brand__sub">Sistema de gestión · Proyecto FIS</div></div>' +
      '</div>' +
      '<div class="userchip">' +
      '<div class="userchip__avatar">' + U.esc(U.iniciales(usuario.nombre)) + '</div>' +
      '<div class="userchip__meta"><div class="userchip__name">' + U.esc(usuario.nombre) + '</div>' +
      '<div class="userchip__role">' + U.esc(usuario.rol) +
      (usuario.rol === ROLES.DOCENTE && usuario.grupoId
        ? ' · ' + U.esc(Dominio.nombreGrupo(usuario.grupoId)) : '') +
      '</div></div>' +
      '<button class="btn btn--sm" data-accion="cerrar-sesion">Salir</button>' +
      '</div></div>' +
      '<nav class="app-nav"><div class="app-nav__inner">' +
      MENU.filter(function (m) { return Auth.puede(m.permiso, usuario); }).map(function (m) {
        return '<a href="' + m.href + '"' +
          (m.href.indexOf(activo) === 0 ? ' class="is-active"' : '') + '>' + U.esc(m.texto) + '</a>';
      }).join('') +
      '</div></nav>';

    footer.innerHTML = 'Sistema de gestión para guarderías · Proyecto de Fundamentos de Ingeniería ' +
      'de Software, Pontificia Universidad Javeriana · Los datos se almacenan ' +
      (Store.soloMemoria() ? 'en memoria (su navegador bloquea el almacenamiento local)'
        : 'localmente en este navegador');
  }

  /* ---------- Render ---------- */

  function render() {
    var ruta = parseHash();
    var usuario = Auth.actual();          // valida vigencia de la sesión (RF-13 / RF-15)

    /* Sin sesión válida */
    if (!usuario) {
      pintarMarco(null);
      if (!ruta || ruta.def.publica) {
        Vistas.login();
      } else {
        /* RF-15: la ruta privada no muestra información, devuelve acceso denegado */
        UI.montar(UI.accesoDenegado({
          message: 'Su sesión no es válida o ha expirado. Por seguridad no se muestra ' +
            'información de los menores sin una sesión activa.'
        }, null));
      }
      return;
    }

    Auth.renovar();

    if (!ruta || ruta.def.publica) {
      global.location.replace('#' + inicio(usuario).slice(1));
      return;
    }

    pintarMarco(usuario);

    /* Autorización de la ruta (RNF-01) */
    if (ruta.def.permiso && !Auth.puede(ruta.def.permiso, usuario)) {
      Store.log('Acceso denegado a ruta', global.location.hash, usuario);
      UI.montar(UI.accesoDenegado({
        message: 'Su rol (' + usuario.rol + ') no tiene autorización para ' +
          Auth.etiquetaPermiso(ruta.def.permiso) + '.'
      }, usuario));
      return;
    }

    var vista = Vistas[ruta.def.vista];
    if (typeof vista !== 'function') {
      UI.montar('<div class="card">' + UI.vacio({
        icono: '\u{1F6A7}', titulo: 'Módulo no disponible',
        texto: 'La vista "' + ruta.def.vista + '" no está registrada.',
        accion: '<a class="btn" href="' + inicio(usuario) + '">Volver al inicio</a>'
      }) + '</div>');
      return;
    }

    try {
      vista({ usuario: usuario, params: ruta.params });
    } catch (err) {
      if (err && err.codigo === 'ACCESO_DENEGADO') {
        UI.montar(UI.accesoDenegado(err, usuario));
      } else {
        if (global.console) global.console.error(err);
        UI.montar('<div class="card">' +
          UI.alerta('danger', '<strong>Ocurrió un error inesperado.</strong><br>' +
            U.esc(err && err.message ? err.message : String(err))) +
          '<div class="btn-row"><a class="btn" href="' + inicio(usuario) + '">Volver al inicio</a>' +
          '<button class="btn btn--ghost" data-accion="cerrar-sesion">Cerrar sesión</button></div></div>');
      }
    }
  }

  /* ---------- API pública ---------- */

  var App = {
    ir: function (hash) {
      if (global.location.hash === hash) render();
      else global.location.hash = hash;
    },
    refrescar: render,
    render: render,

    iniciar: function () {
      Store.init();

      global.addEventListener('hashchange', function () {
        UI.cerrarModal();
        render();
      });

      /* Acciones globales */
      document.addEventListener('click', function (ev) {
        var btn = ev.target.closest ? ev.target.closest('[data-accion="cerrar-sesion"]') : null;
        if (btn) {
          ev.preventDefault();
          Auth.logout();
          UI.toast('Sesión cerrada.', 'ok');
          App.ir('#/login');
        }
      });

      document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape') UI.cerrarModal();
      });

      render();
    }
  };

  global.App = App;
  document.addEventListener('DOMContentLoaded', App.iniciar);
})(window);
