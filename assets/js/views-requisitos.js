/* ============================================================
   views-requisitos.js - Trazabilidad requerimiento -> código
   y panel de pruebas de seguridad (RNF-01, RF-15)
   ============================================================ */
(function (global) {
  'use strict';

  var Vistas = global.Vistas = global.Vistas || {};

  var RF = [
    ['RF-01', 'Muestra al docente la lista de niños de su guardería/grupo con nombre, apellido y edad.', 'HU-01',
      'views-ninos.js › Vistas.ninos', 'Ingrese como laura@guarderia.co y abra "Niños".'],
    ['RF-02', 'Restringe la consulta de niños al grupo o guardería del docente autenticado.', 'HU-01',
      'domain.js › ninosVisibles() / puedeVerNino()', 'Como Laura, abra la ficha de un niño de otro grupo cambiando el # de la URL: devuelve Acceso denegado.'],
    ['RF-03', 'Si no existen niños registrados, muestra un mensaje indicándolo.', 'HU-01',
      'views-ninos.js › estado vacío (UI.vacio)', 'Ingrese como sofia@guarderia.co (docente sin grupo) y abra "Niños".'],
    ['RF-04', 'Permite registrar la matrícula con nombre completo, fecha de nacimiento, entre 1 y 3 acudientes y contacto de emergencia.', 'HU-02',
      'views-matriculas.js › Vistas.matriculaForm', 'Administrador › Matrículas › Nueva matrícula.'],
    ['RF-05', 'Exige información médica relevante (alergias, condiciones) antes de completar la matrícula.', 'HU-02',
      'domain.js › validarMatricula() (medEps, medAlergias, medCondiciones)', 'Intente guardar la matrícula con los campos médicos vacíos.'],
    ['RF-06', 'Solo un usuario con rol Administrador puede aprobar o rechazar una matrícula.', 'HU-02',
      'auth.js › PERMISOS + domain.js › cambiarEstado()', 'Ingrese como Personal Administrativo: los botones Aprobar/Rechazar no existen y el dominio rechaza la operación.'],
    ['RF-07', 'No permite matricular a un niño sin al menos un acudiente con documento de identidad válido.', 'HU-02',
      'utils.js › documentoValido() + validarMatricula()', 'Registre una matrícula con documento de 3 dígitos.'],
    ['RF-08', 'Cada matrícula mantiene un estado (Activa, Pendiente, Retirada) con la fecha de cada cambio.', 'HU-02',
      'domain.js › cambiarEstado() (historial) ', 'Apruebe una matrícula y revise el historial en la ficha del niño.'],
    ['RF-09', 'Permite registrar un pago de matrícula o mensualidad indicando alumno, período, fecha, valor y medio de pago.', 'HU-03',
      'views-pagos.js › Vistas.pagoForm + domain.js › validarPago()', 'Ingrese como pagos@guarderia.co › Pagos › Registrar pago.'],
    ['RF-10', 'Al guardar un pago, actualiza el saldo pendiente del alumno.', 'HU-03',
      'domain.js › cargosDe() / estadoCuenta()', 'Registre un pago y observe el saldo en el comprobante y en el estado de cuenta.'],
    ['RF-11', 'Permite consultar el comprobante y el historial de pagos por alumno y período.', 'HU-03',
      'views-pagos.js › Vistas.comprobante / bloqueEstadoCuenta', 'Pagos › filtre por período › abra un comprobante e imprímalo.'],
    ['RF-12', 'Un usuario sin permiso administrativo no puede gestionar pagos.', 'HU-03',
      'auth.js › exigir("pagos.gestionar")', 'Como Docente, abra manualmente #/pagos/nuevo: devuelve Acceso denegado.'],
    ['RF-13', 'Exige autenticación antes de mostrar información del menor o su estado de cuenta.', 'HU-04',
      'app.js › router + auth.js › actual()', 'Cierre sesión y abra #/portal directamente.'],
    ['RF-14', 'El acudiente solo consulta los menores vinculados a su propia cuenta.', 'HU-04',
      'domain.js › esAcudienteDe() / puedeVerNino()', 'Como ana@mail.com, intente abrir la ficha de un niño ajeno (#/ninos/nin-003).'],
    ['RF-15', 'Una sesión inválida o un acceso no autorizado no muestra información privada y devuelve acceso denegado.', 'HU-04',
      'auth.js › actual() (expiración) + ui.js › accesoDenegado()', 'Use el botón "Invalidar mi sesión" de esta página.'],
    ['RF-16', 'Permite crear grupos definidos por edad mínima, edad máxima y capacidad máxima.', 'HU-05',
      'views-grupos.js › dialogoGrupo + domain.js › validarGrupo()', 'Cree un grupo con edad mínima 24 y máxima 12: el sistema lo rechaza.'],
    ['RF-17', 'Clasifica automáticamente a cada niño en el grupo cuyo rango de edad corresponde a su fecha de nacimiento.', 'HU-05',
      'domain.js › grupoSugerido() / reclasificar()', 'En Nueva matrícula ingrese una fecha de nacimiento y observe el grupo sugerido.'],
    ['RF-18', 'Permite asignar uno o más docentes a un grupo; cada docente pertenece exactamente a un grupo.', 'HU-06',
      'domain.js › asignarDocente()', 'Docentes › reasigne a Laura: su grupo anterior se reemplaza y su lista de niños cambia.']
  ];

  var RNF = [
    ['RNF-01', 'Seguridad', 'Autenticación y autorización basada en roles, validando permisos en cada operación.',
      'auth.js › PERMISOS / exigir() — las vistas ocultan la acción y el dominio la vuelve a validar.'],
    ['RNF-02', 'Confiabilidad', 'Todo cambio de estado de matrícula queda registrado con fecha, con historial auditable.',
      'domain.js › cambiarEstado() (historial del niño) + store.js › log() (bitácora global).'],
    ['RNF-03', 'Usabilidad', 'Mensajes claros ante escenarios sin datos, en lugar de pantallas vacías.',
      'ui.js › vacio() usado en todas las listas (niños, matrículas, pagos, grupos, portal).']
  ];

  Vistas.requisitos = function () {
    var u = Auth.exigir('requisitos');
    var permisos = Auth.permisosDe(u.rol);

    UI.montar(
      UI.pageHead({
        titulo: 'Requerimientos y trazabilidad',
        desc: 'Relación entre cada requerimiento del documento de la entrega y el lugar del ' +
          'sistema donde quedó implementado, con la forma de verificarlo.'
      }) +

      '<div class="card">' +
      '<h2>Su sesión</h2>' +
      '<dl class="dl" style="margin-top:.7rem">' +
      '<dt>Usuario</dt><dd>' + U.esc(u.nombre) + ' · ' + U.esc(u.email) + '</dd>' +
      '<dt>Rol</dt><dd>' + UI.badgeRol(u.rol) + '</dd>' +
      '<dt>Guardería</dt><dd>' + U.esc((Dominio.guarderia(u.guarderiaId) || {}).nombre || '--') + '</dd>' +
      (u.rol === ROLES.DOCENTE
        ? '<dt>Grupo asignado</dt><dd>' + U.esc(Dominio.nombreGrupo(u.grupoId)) + '</dd>' : '') +
      '<dt>Permisos efectivos</dt><dd>' + permisos.map(function (p) {
        return '<span class="badge badge--brand mono" style="margin:0 .2rem .2rem 0">' + U.esc(p) + '</span>';
      }).join('') + '</dd>' +
      '<dt>Inactividad</dt><dd>' + (Auth.minutosInactivo() || 0).toFixed(1) +
      ' min de ' + Auth.TIMEOUT_MIN + ' permitidos</dd>' +
      '</dl></div>' +

      '<div class="card">' +
      '<h2>Pruebas de seguridad</h2>' +
      '<p class="muted small">Ejecute aquí los escenarios negativos de HU-04 y RNF-01.</p>' +
      '<div class="btn-row">' +
      '<button class="btn btn--danger" id="btn-invalidar">Invalidar mi sesión (RF-15)</button>' +
      '<button class="btn" id="btn-sin-permiso">Intentar una operación sin permiso (RF-12)</button>' +
      '<button class="btn" id="btn-nino-ajeno">Intentar ver un niño ajeno (RF-02 / RF-14)</button>' +
      '<button class="btn btn--ghost" id="btn-reset">Restablecer datos de demostración</button>' +
      '</div>' +
      '<div id="resultado-prueba" style="margin-top:1rem"></div>' +
      '</div>' +

      '<div class="card card--flush"><div class="card__head">' +
      '<h2>Requerimientos funcionales</h2><span class="badge badge--ok">18 / 18 implementados</span></div>' +
      UI.tabla({
        columnas: [{ titulo: 'Código' }, { titulo: 'Requerimiento' }, { titulo: 'HU' },
          { titulo: 'Dónde está implementado' }, { titulo: 'Cómo verificarlo' }],
        filas: RF.map(function (r) {
          return '<tr><td><span class="tag-rf">' + r[0] + '</span></td>' +
            '<td class="small">' + U.esc(r[1]) + '</td>' +
            '<td class="nowrap small">' + U.esc(r[2]) + '</td>' +
            '<td class="small mono">' + U.esc(r[3]) + '</td>' +
            '<td class="small muted">' + U.esc(r[4]) + '</td></tr>';
        })
      }) + '</div>' +

      '<div class="card card--flush"><div class="card__head"><h2>Requerimientos no funcionales</h2></div>' +
      UI.tabla({
        columnas: [{ titulo: 'Código' }, { titulo: 'Categoría' }, { titulo: 'Descripción' }, { titulo: 'Implementación' }],
        filas: RNF.map(function (r) {
          return '<tr><td><span class="tag-rf">' + r[0] + '</span></td>' +
            '<td class="nowrap">' + U.esc(r[1]) + '</td>' +
            '<td class="small">' + U.esc(r[2]) + '</td>' +
            '<td class="small mono">' + U.esc(r[3]) + '</td></tr>';
        })
      }) + '</div>' +

      '<div class="card">' +
      '<h2>Matriz de permisos por rol (RNF-01)</h2>' +
      '<div class="table-wrap" style="margin-top:.7rem">' + matrizPermisos() + '</div>' +
      '</div>'
    );

    var res = UI.$('#resultado-prueba');

    UI.$('#btn-invalidar').addEventListener('click', function () {
      Auth.invalidarSesion();
      UI.toast('Sesión marcada como inválida. Se solicitará autenticación de nuevo.', 'warn');
      App.ir('#/panel');
    });

    UI.$('#btn-sin-permiso').addEventListener('click', function () {
      try {
        Auth.exigir('pagos.gestionar');
        Dominio.validarPago({});
        res.innerHTML = UI.alerta('ok', '<strong>Operación permitida.</strong> Su rol (' +
          U.esc(u.rol) + ') tiene el permiso <span class="mono">pagos.gestionar</span>, ' +
          'por eso el sistema la autoriza. Repita la prueba con un usuario Docente o Acudiente.');
      } catch (err) {
        res.innerHTML = UI.alerta('danger', '<strong>Acceso denegado (correcto).</strong> ' +
          U.esc(err.message) + ' El intento quedó registrado en la bitácora de auditoría.');
      }
    });

    UI.$('#btn-nino-ajeno').addEventListener('click', function () {
      var ajeno = Store.all('ninos').filter(function (n) {
        return !Dominio.puedeVerNino(u, n);
      })[0];
      if (!ajeno) {
        res.innerHTML = UI.alerta('info', 'Su rol (' + U.esc(u.rol) +
          ') tiene visibilidad sobre todos los niños de su guardería, así que no hay un caso ' +
          'ajeno que probar. Repita la prueba como Docente o Acudiente.');
        return;
      }
      try {
        Dominio.exigirVerNino(u, ajeno);
        res.innerHTML = UI.alerta('warn', 'El sistema permitió el acceso (no esperado).');
      } catch (err) {
        res.innerHTML = UI.alerta('danger', '<strong>Acceso denegado (correcto).</strong> ' +
          'Se intentó consultar la ficha de <span class="mono">' + U.esc(ajeno.id) + '</span>: ' +
          U.esc(err.message));
      }
    });

    UI.$('#btn-reset').addEventListener('click', function () {
      UI.confirmar({
        titulo: 'Restablecer datos',
        mensaje: 'Se eliminarán los cambios realizados y se recargarán los datos de demostración. ' +
          '¿Desea continuar?',
        textoOk: 'Restablecer', claseOk: 'btn--danger',
        onOk: function () {
          Store.reset();
          Auth.logout('reset');
          UI.cerrarModal();
          UI.toast('Datos de demostración restablecidos.', 'ok');
          App.ir('#/login');
          return true;
        }
      });
    });
  };

  function matrizPermisos() {
    var roles = [ROLES.ADMIN, ROLES.DOCENTE, ROLES.ADMINISTRATIVO, ROLES.ACUDIENTE];
    var todos = {};
    roles.forEach(function (r) {
      Auth.permisosDe(r).forEach(function (p) { todos[p] = true; });
    });
    var lista = Object.keys(todos).sort();

    return '<table class="data"><thead><tr><th>Permiso</th>' +
      roles.map(function (r) { return '<th>' + U.esc(r) + '</th>'; }).join('') +
      '</tr></thead><tbody>' +
      lista.map(function (p) {
        return '<tr><td class="mono small">' + U.esc(p) + '</td>' +
          roles.map(function (r) {
            var tiene = Auth.permisosDe(r).indexOf(p) !== -1;
            return '<td>' + (tiene
              ? '<span class="badge badge--ok">sí</span>'
              : '<span class="badge">no</span>') + '</td>';
          }).join('') + '</tr>';
      }).join('') + '</tbody></table>';
  }
})(window);
