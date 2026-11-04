/* ============================================================
   views-panel.js - Panel de inicio por rol y bitácora de auditoría
   RNF-02 (historial auditable), RNF-03 (mensajes explicativos)
   ============================================================ */
(function (global) {
  'use strict';

  var Vistas = global.Vistas = global.Vistas || {};

  Vistas.panel = function (ctx) {
    var u = Auth.exigir('panel');
    var gua = Dominio.guarderia(u.guarderiaId);
    var r = Dominio.resumen(u);

    var html = UI.pageHead({
      titulo: 'Hola, ' + u.nombre.split(' ')[0],
      desc: U.esc(u.rol) + ' · ' + U.esc(gua ? gua.nombre : 'Sin guardería') +
        (gua ? ' · ' + U.esc(gua.sede) : '')
    });

    if (u.rol === ROLES.DOCENTE) html += panelDocente(u, r);
    else if (u.rol === ROLES.ADMINISTRATIVO) html += panelAdministrativo(u, r);
    else html += panelAdmin(u, r);

    UI.montar(html);
    enlazarAcciones(ctx);
  };

  /* ---------- Panel del Administrador ---------- */

  function panelAdmin(u, r) {
    var pendientes = r.ninos.filter(function (n) { return n.estado === ESTADOS.PENDIENTE; });
    var sinGrupo = r.docentes.filter(function (d) { return !d.grupoId; });

    var html = '<div class="grid grid--4" style="margin-bottom:1.1rem">' +
      UI.stat('Niños con matrícula activa', r.activos,
        'de ' + r.total + ' registrados en la guardería') +
      UI.stat('Matrículas pendientes', r.pendientes,
        r.pendientes ? 'Requieren su aprobación' : 'Nada por aprobar') +
      UI.stat('Ocupación de cupos', r.ocupacionTotal + ' / ' + r.cupoTotal,
        UI.barra(r.ocupacionTotal, r.cupoTotal)) +
      UI.stat('Cartera por cobrar', U.money(r.saldoPorCobrar),
        r.enMora + ' alumno(s) con saldo pendiente', true) +
      '</div>';

    /* Matrículas pendientes de aprobación (RF-06) */
    html += '<div class="card card--flush"><div class="card__head">' +
      '<h2>Matrículas pendientes de aprobación</h2>' + UI.rf(['RF-06', 'RF-08']) +
      '<a class="btn btn--sm" href="#/matriculas">Ver todas</a></div>';

    if (!pendientes.length) {
      html += UI.vacio({
        icono: '✓',
        titulo: 'No hay matrículas pendientes',
        texto: 'Todas las solicitudes de matrícula de ' +
          (Dominio.guarderia(u.guarderiaId) || {}).nombre + ' ya fueron aprobadas o rechazadas.',
        accion: '<a class="btn btn--primary" href="#/matriculas/nueva">Registrar nueva matrícula</a>'
      });
    } else {
      html += UI.tabla({
        columnas: [{ titulo: 'Niño' }, { titulo: 'Edad' }, { titulo: 'Grupo propuesto' },
          { titulo: 'Solicitud' }, { titulo: 'Acciones' }],
        filas: pendientes.map(function (n) {
          var g = Dominio.grupo(n.grupoId);
          var cupo = g ? Dominio.cupoDisponible(g.id) : 0;
          return '<tr>' +
            '<td><div class="cell-main">' + U.esc(Dominio.nombreCompleto(n)) + '</div>' +
            '<div class="cell-sub">' + (n.acudientes.length) + ' acudiente(s) · ' +
            U.esc(n.medica.eps) + '</div></td>' +
            '<td class="nowrap">' + U.edadTexto(Dominio.edadMeses(n)) + '</td>' +
            '<td>' + U.esc(g ? g.nombre : 'Sin grupo') +
            (g ? '<div class="cell-sub">' + cupo + ' cupo(s) libre(s)</div>' : '') + '</td>' +
            '<td class="nowrap">' + U.fmtFecha(n.creadoEn) + '</td>' +
            '<td><div class="btn-row">' +
            '<button class="btn btn--sm btn--ok" data-aprobar="' + n.id + '">Aprobar</button>' +
            '<button class="btn btn--sm btn--danger" data-rechazar="' + n.id + '">Rechazar</button>' +
            '<a class="btn btn--sm" href="#/ninos/' + n.id + '">Ficha</a>' +
            '</div></td></tr>';
        })
      });
    }
    html += '</div>';

    /* Ocupación por grupo + docentes (HU-05 / HU-06) */
    html += '<div class="grid grid--2">';

    html += '<div class="card card--flush"><div class="card__head"><h2>Grupos y ocupación</h2>' +
      UI.rf(['RF-16']) + '<a class="btn btn--sm" href="#/grupos">Administrar</a></div>' +
      UI.tabla({
        columnas: [{ titulo: 'Grupo' }, { titulo: 'Rango de edad' }, { titulo: 'Cupos', num: true }],
        filas: r.grupos.map(function (g) {
          var oc = Dominio.ocupacion(g.id);
          var docs = Dominio.docentesDeGrupo(g.id);
          return '<tr><td><div class="cell-main">' + U.esc(g.nombre) + '</div>' +
            '<div class="cell-sub">' + (docs.length
              ? U.esc(docs.map(function (d) { return d.nombre; }).join(', '))
              : 'Sin docente asignado') + '</div></td>' +
            '<td class="nowrap">' + U.rangoTexto(g.edadMinMeses, g.edadMaxMeses) + '</td>' +
            '<td class="num nowrap">' + oc + ' / ' + g.capacidad +
            '<div style="margin-top:.3rem">' + UI.barra(oc, g.capacidad) + '</div></td></tr>';
        }),
        vacio: {
          icono: '\u{1F465}', titulo: 'Aún no hay grupos creados',
          texto: 'Cree los grupos por rango de edad para poder clasificar a los niños.',
          accion: '<a class="btn btn--primary" href="#/grupos">Crear grupo</a>'
        }
      }) + '</div>';

    html += '<div class="card"><div style="display:flex;gap:.6rem;align-items:center;margin-bottom:.8rem">' +
      '<h2 style="margin-right:auto">Equipo docente</h2>' + UI.rf(['RF-18']) + '</div>' +
      (sinGrupo.length
        ? UI.alerta('warn', '<strong>' + sinGrupo.length + ' docente(s) sin grupo asignado.</strong> ' +
          'Un docente sin grupo no puede consultar niños (RF-02). ' +
          '<a href="#/docentes">Asignar ahora</a>.')
        : UI.alerta('ok', 'Todos los docentes tienen un grupo asignado.')) +
      '<dl class="dl">' + r.docentes.map(function (d) {
        return '<dt>' + U.esc(d.nombre) + '</dt><dd>' +
          (d.grupoId ? U.esc(Dominio.nombreGrupo(d.grupoId)) +
            ' <span class="cell-sub">(' + Dominio.ninosVisibles(d).length + ' niños)</span>'
            : '<span class="badge badge--warn">Sin grupo</span>') + '</dd>';
      }).join('') + '</dl>' +
      '<div class="btn-row" style="margin-top:.9rem">' +
      '<a class="btn btn--sm" href="#/docentes">Asignar docentes</a>' +
      '<a class="btn btn--sm" href="#/auditoria">Ver auditoría</a>' +
      '</div></div>';

    html += '</div>';
    return html;
  }

  /* ---------- Panel del Docente (HU-01) ---------- */

  function panelDocente(u, r) {
    var g = Dominio.grupo(u.grupoId);

    if (!g) {
      return '<div class="card">' + UI.vacio({
        icono: '\u{1F4CB}',
        titulo: 'Todavía no tiene un grupo asignado',
        texto: 'Su consulta de niños está restringida al grupo que le asigne el administrador ' +
          '(RF-02 / RF-18). Solicite la asignación para ver la lista de niños a su cargo.',
        accion: '<a class="btn" href="#/requisitos">Ver cómo funciona el sistema</a>'
      }) + '</div>';
    }

    var compa = Dominio.docentesDeGrupo(g.id).filter(function (d) { return d.id !== u.id; });

    return '<div class="grid grid--3" style="margin-bottom:1.1rem">' +
      UI.stat('Su grupo', U.esc(g.nombre),
        U.rangoTexto(g.edadMinMeses, g.edadMaxMeses) + ' · ' + U.esc(g.salon || 'sin salón')) +
      UI.stat('Niños a su cargo', r.activos,
        r.total + ' en total (incluye pendientes)') +
      UI.stat('Cupos del grupo', Dominio.ocupacion(g.id) + ' / ' + g.capacidad,
        UI.barra(Dominio.ocupacion(g.id), g.capacidad)) +
      '</div>' +

      '<div class="card">' +
      UI.alerta('info', 'Como docente usted ve <strong>únicamente</strong> los niños del grupo ' +
        U.esc(g.nombre) + ' de su guardería. ' + UI.rf(['RF-01', 'RF-02'])) +
      (compa.length
        ? '<p class="small muted">Comparte el grupo con: ' +
          U.esc(compa.map(function (d) { return d.nombre; }).join(', ')) + '.</p>'
        : '') +
      '<div class="btn-row"><a class="btn btn--primary" href="#/ninos">Consultar lista de niños</a>' +
      '<a class="btn" href="#/requisitos">Requerimientos cubiertos</a></div>' +
      '</div>';
  }

  /* ---------- Panel del Personal Administrativo (HU-03) ---------- */

  function panelAdministrativo(u, r) {
    var cartera = U.sortBy(Dominio.cartera(u), function (c) { return -c.saldo; });
    var enMora = cartera.filter(function (c) { return c.saldo > 0; });

    return '<div class="grid grid--4" style="margin-bottom:1.1rem">' +
      UI.stat('Recaudado en ' + U.fmtPeriodo(U.periodoActual()), U.money(r.recaudadoMes), '', true) +
      UI.stat('Cartera por cobrar', U.money(r.saldoPorCobrar), '', true) +
      UI.stat('Alumnos en mora', enMora.length, 'de ' + cartera.length + ' con matrícula activa') +
      UI.stat('Pagos registrados', Store.count('pagos'), 'histórico total') +
      '</div>' +

      '<div class="card card--flush"><div class="card__head"><h2>Alumnos con saldo pendiente</h2>' +
      UI.rf(['RF-10']) +
      '<a class="btn btn--sm btn--primary" href="#/pagos/nuevo">Registrar pago</a></div>' +
      UI.tabla({
        columnas: [{ titulo: 'Alumno' }, { titulo: 'Grupo' }, { titulo: 'Períodos en mora', num: true },
          { titulo: 'Saldo', num: true }, { titulo: '' }],
        filas: enMora.map(function (c) {
          return '<tr><td><div class="cell-main">' + U.esc(Dominio.nombreCompleto(c.nino)) + '</div>' +
            '<div class="cell-sub">' + UI.badgeEstado(c.nino.estado) + '</div></td>' +
            '<td>' + U.esc(Dominio.nombreGrupo(c.nino.grupoId)) + '</td>' +
            '<td class="num">' + c.mesesEnMora + '</td>' +
            '<td class="num nowrap">' + U.money(c.saldo) + '</td>' +
            '<td><a class="btn btn--sm" href="#/pagos/estado/' + c.nino.id + '">Estado de cuenta</a></td>' +
            '</tr>';
        }),
        vacio: {
          icono: '✓', titulo: 'Toda la cartera está al día',
          texto: 'Ningún alumno con matrícula activa presenta saldo pendiente en este momento.',
          accion: '<a class="btn btn--primary" href="#/pagos/nuevo">Registrar un pago</a>'
        }
      }) + '</div>';
  }

  /* ---------- Acciones del panel ---------- */

  function enlazarAcciones(ctx) {
    UI.$$('[data-aprobar]').forEach(function (b) {
      b.addEventListener('click', function () {
        Vistas.dialogoEstado(b.getAttribute('data-aprobar'), ESTADOS.ACTIVA);
      });
    });
    UI.$$('[data-rechazar]').forEach(function (b) {
      b.addEventListener('click', function () {
        Vistas.dialogoEstado(b.getAttribute('data-rechazar'), ESTADOS.RECHAZADA);
      });
    });
  }

  /* ============================================================
     Bitácora de auditoría (RNF-02)
     ============================================================ */

  Vistas.auditoria = function () {
    Auth.exigir('auditoria');
    var registros = Store.all('auditoria');

    UI.montar(
      UI.pageHead({
        titulo: 'Bitácora de auditoría',
        desc: 'Registro con fecha de cada operación sensible del sistema: cambios de estado de ' +
          'matrícula, pagos, asignaciones y accesos denegados.',
        rf: ['RNF-02']
      }) +
      '<div class="card card--flush">' +
      UI.tabla({
        columnas: [{ titulo: 'Fecha' }, { titulo: 'Acción' }, { titulo: 'Detalle' }, { titulo: 'Usuario' }],
        filas: registros.map(function (l) {
          return '<tr><td class="nowrap mono small">' + U.fmtFechaHora(l.fecha) + '</td>' +
            '<td><div class="cell-main">' + U.esc(l.accion) + '</div></td>' +
            '<td class="small">' + U.esc(l.detalle) + '</td>' +
            '<td class="small nowrap">' + U.esc(l.usuarioNombre) +
            '<div class="cell-sub">' + U.esc(l.rol) + '</div></td></tr>';
        }),
        vacio: { icono: '\u{1F4D3}', titulo: 'Sin movimientos registrados', texto: 'Aún no se han ejecutado operaciones auditables.' }
      }) +
      '</div>'
    );
  };
})(window);
