/* ============================================================
   views-portal.js - HU-04: consulta segura del acudiente
   RF-13 (autenticación previa), RF-14 (solo los menores
   vinculados a su cuenta), RF-15 (sesión inválida)
   ============================================================ */
(function (global) {
  'use strict';

  var Vistas = global.Vistas = global.Vistas || {};

  Vistas.portal = function () {
    var u = Auth.exigir('portal');
    var hijos = Dominio.ninosVisibles(u);

    var html = UI.pageHead({
      titulo: 'Portal del acudiente',
      desc: 'Información de los menores vinculados a su cuenta y su estado de cuenta.',
      rf: ['RF-13', 'RF-14', 'RF-15']
    });

    html += UI.alerta('info',
      '<strong>Acceso protegido.</strong> Su sesión está autenticada como ' +
      U.esc(u.nombre) + ' (documento ' + U.esc(u.documento) + '). ' +
      'El sistema solo le muestra los menores en los que usted figura como acudiente autorizado ' +
      'y cierra la sesión tras ' + Auth.TIMEOUT_MIN + ' minutos de inactividad. ' +
      'En el entorno de despliegue toda la comunicación viaja sobre HTTPS/TLS.');

    if (!hijos.length) {
      html += '<div class="card">' + UI.vacio({
        icono: '\u{1F464}',
        titulo: 'No hay menores vinculados a su cuenta',
        texto: 'Su usuario no figura como acudiente autorizado de ningún niño de la guardería. ' +
          'Si considera que es un error, comuníquese con la administración para verificar el ' +
          'documento registrado en la matrícula.',
        accion: '<button class="btn" data-accion="cerrar-sesion">Cerrar sesión</button>'
      }) + '</div>';
      UI.montar(html);
      return;
    }

    hijos.forEach(function (n) {
      var c = Dominio.estadoCuenta(n.id);
      var g = Dominio.grupo(n.grupoId);
      var docentes = g ? Dominio.docentesDeGrupo(g.id) : [];
      var proximo = c.detalle.filter(function (d) { return d.saldo > 0; })[0];

      html += '<div class="card card--flush">' +
        '<div class="card__head">' +
        '<h2>' + U.esc(Dominio.nombreCompleto(n)) + '</h2>' +
        UI.badgeEstado(n.estado) + UI.badgeSaldo(c.saldo) +
        '<a class="btn btn--sm" href="#/ninos/' + n.id + '">Ver ficha completa</a>' +
        '</div>' +
        '<div class="card__body">' +
        '<div class="grid grid--4" style="margin-bottom:1rem">' +
        UI.stat('Edad', U.edadTexto(Dominio.edadMeses(n)), U.fmtFecha(n.fechaNacimiento), true) +
        UI.stat('Grupo', U.esc(g ? g.nombre : 'Sin grupo'),
          docentes.length
            ? 'Docente: ' + U.esc(docentes.map(function (d) { return d.nombre; }).join(', '))
            : 'Sin docente asignado', true) +
        UI.stat('Saldo pendiente', U.money(c.saldo > 0 ? c.saldo : 0),
          proximo ? 'Más antiguo: ' + U.fmtPeriodo(proximo.periodo) : 'Al día', true) +
        UI.stat('Pagos realizados', c.pagos.length, U.money(c.totalPagado), true) +
        '</div>' +

        '<dl class="dl">' +
        '<dt>Alergias</dt><dd>' + U.esc(n.medica.alergias || 'Ninguna') + '</dd>' +
        '<dt>Condiciones</dt><dd>' + U.esc(n.medica.condiciones || 'Ninguna') + '</dd>' +
        '<dt>Contacto de emergencia</dt><dd>' + U.esc(n.contactoEmergencia.nombre) +
        ' · ' + U.esc(n.contactoEmergencia.telefono) + '</dd>' +
        '</dl>' +
        '</div>' +

        (c.pagos.length
          ? UI.tabla({
            columnas: [{ titulo: 'Último pago' }, { titulo: 'Concepto' }, { titulo: 'Período' },
              { titulo: 'Valor', num: true }, { titulo: '' }],
            filas: c.pagos.slice(0, 4).map(function (p) {
              return '<tr><td class="nowrap">' + U.fmtFecha(p.fecha) + '</td>' +
                '<td>' + U.esc(Dominio.etiquetaConcepto(p.concepto)) + '</td>' +
                '<td class="nowrap">' + U.fmtPeriodo(p.periodo) + '</td>' +
                '<td class="num nowrap">' + U.money(p.valor) + '</td>' +
                '<td><a class="btn btn--sm" href="#/pagos/comprobante/' + p.id + '">Comprobante</a></td></tr>';
            })
          })
          : UI.vacio({
            icono: '\u{1F9FE}', titulo: 'Sin pagos registrados',
            texto: 'Cuando la administración registre un pago, aparecerá aquí con su comprobante.'
          })) +
        '</div>';
    });

    UI.montar(html);
  };
})(window);
