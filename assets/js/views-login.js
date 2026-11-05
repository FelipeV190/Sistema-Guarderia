/* ============================================================
   views-login.js - Pantalla de autenticación
   RF-13 (exigir autenticación), RNF-01 (roles),
   HU-04 AC3 (sesión inválida -> acceso denegado)
   ============================================================ */
(function (global) {
  'use strict';

  var Vistas = global.Vistas = global.Vistas || {};

  var DEMO = [
    { email: 'admin@guarderia.co', clave: 'admin123', nota: 'Aprueba matrículas, grupos y docentes' },
    { email: 'laura@guarderia.co', clave: 'docente123', nota: 'Ve solo su grupo asignado' },
    { email: 'pagos@guarderia.co', clave: 'pagos123', nota: 'Registra y consulta pagos' },
    { email: 'ana@mail.com', clave: 'acudiente123', nota: 'Ve solo a sus hijos' },
    { email: 'sofia@guarderia.co', clave: 'docente123', nota: 'Docente sin grupo asignado' },
    { email: 'admin2@guarderia.co', clave: 'admin123', nota: 'Otra guardería (no ve la primera)' }
  ];

  Vistas.login = function () {
    var motivo = Auth.ultimoMotivo;
    var avisoSesion = '';
    if (motivo === 'inactiva') {
      avisoSesion = UI.alerta('warn', '<strong>Su sesión expiró por inactividad.</strong> ' +
        'Por seguridad la información del menor no se muestra sin una sesión válida.');
    } else if (motivo === 'expirada') {
      avisoSesion = UI.alerta('danger', '<strong>Sesión inválida.</strong> ' +
        'Vuelva a autenticarse para continuar.');
    }

    var demoHtml = DEMO.map(function (d) {
      var u = Store.first('usuarios', function (x) { return x.email === d.email; });
      if (!u) return '';
      return '<button type="button" class="demo-user" data-email="' + U.esc(d.email) +
        '" data-clave="' + U.esc(d.clave) + '">' +
        '<span class="userchip__avatar">' + U.esc(U.iniciales(u.nombre)) + '</span>' +
        '<span><span class="demo-user__role">' + U.esc(u.rol) + '</span><br>' +
        '<span class="demo-user__mail">' + U.esc(d.email) + ' · ' + U.esc(d.nota) + '</span></span>' +
        '</button>';
    }).join('');

    UI.montar(
      '<div class="login"><div class="login__box">' +

      '<aside class="login__aside">' +
      '<h1>Sistema de gestión para guarderías</h1>' +
      '<p>Centraliza la administración de niños, matrículas, pagos, personal y acudientes ' +
      'en un flujo digital, seguro y trazable.</p>' +
      '<ul class="login__features">' +
      '<li>Matrículas con aprobación y trazabilidad de estados</li>' +
      '<li>Clasificación automática por grupo etario</li>' +
      '<li>Pagos, saldos y comprobantes por alumno</li>' +
      '<li>Portal del acudiente con acceso restringido</li>' +
      '</ul>' +
      '<div class="login__deco" aria-hidden="true">\u{1F9F8} \u{1F388} ⭐ \u{1F308} \u{1F9E9}</div>' +
      '<p class="small" style="margin-top:1.4rem;opacity:.8">Proyecto de Fundamentos de ' +
      'Ingeniería de Software · Pontificia Universidad Javeriana</p>' +
      '</aside>' +

      '<div class="login__form">' +
      '<h2>Iniciar sesión</h2>' +
      '<p class="muted small">El acceso a la información de los menores requiere autenticación ' +
      'y autorización por rol.</p>' +
      avisoSesion +
      '<form id="form-login" novalidate>' +
      '<div data-resumen-errores hidden></div>' +
      UI.campo({
        label: 'Correo institucional o personal', name: 'email', requerido: true,
        control: UI.input('email', { tipo: 'email', placeholder: 'usuario@guarderia.co', autocomplete: 'username' })
      }) +
      UI.campo({
        label: 'Contraseña', name: 'clave', requerido: true,
        control: UI.input('clave', { tipo: 'password', placeholder: '••••••••', autocomplete: 'current-password' })
      }) +
      '<button class="btn btn--primary btn--block" type="submit">Ingresar</button>' +
      '</form>' +

      '<div class="login__demo">' +
      '<h3>Usuarios de prueba (clic para autocompletar)</h3>' +
      demoHtml +
      '<p class="card__hint" style="margin-top:.6rem">Maqueta académica: los datos se guardan en ' +
      'el navegador (localStorage) y las contraseñas son de demostración. En producción el acceso ' +
      'se sirve sobre HTTPS/TLS y las credenciales se almacenan con hash en el servidor.</p>' +
      '<button type="button" class="btn btn--ghost btn--sm" id="btn-reset" style="margin-top:.6rem">' +
      'Restablecer datos de demostración</button>' +
      '</div>' +

      '</div></div></div>'
    );

    var form = UI.$('#form-login');

    UI.$$('.demo-user').forEach(function (b) {
      b.addEventListener('click', function () {
        form.elements.email.value = b.getAttribute('data-email');
        form.elements.clave.value = b.getAttribute('data-clave');
        form.elements.clave.focus();
      });
    });

    UI.$('#btn-reset').addEventListener('click', function () {
      UI.confirmar({
        titulo: 'Restablecer datos',
        mensaje: 'Se eliminarán los cambios realizados y se recargarán los datos de demostración. ' +
          '¿Desea continuar?',
        textoOk: 'Restablecer', claseOk: 'btn--danger',
        onOk: function () {
          Store.reset();
          UI.cerrarModal();
          UI.toast('Datos de demostración restablecidos.', 'ok');
          Vistas.login();
          return true;
        }
      });
    });

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var d = UI.leerForm(form);
      var errores = {};
      if (!U.noVacio(d.email)) errores.email = 'Ingrese su correo.';
      else if (!U.emailValido(d.email)) errores.email = 'El correo no tiene un formato válido.';
      if (!U.noVacio(d.clave)) errores.clave = 'Ingrese su contraseña.';
      if (Object.keys(errores).length) { UI.pintarErrores(form, errores); return; }

      var r = Auth.login(d.email, d.clave);
      if (!r.ok) {
        UI.limpiarErrores(form);
        var caja = UI.$('[data-resumen-errores]', form);
        caja.innerHTML = UI.alerta('danger', '<strong>' + U.esc(r.mensaje) + '</strong><br>' +
          'Verifique sus credenciales. Puede usar uno de los usuarios de prueba.');
        caja.hidden = false;
        form.elements.clave.value = '';
        form.elements.clave.focus();
        return;
      }
      UI.toast('Bienvenido(a), ' + r.usuario.nombre, 'ok');
      App.ir(r.usuario.rol === ROLES.ACUDIENTE ? '#/portal' : '#/panel');
    });
  };
})(window);
