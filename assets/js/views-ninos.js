/* ============================================================
   views-ninos.js - HU-01: consultar lista de niños y su ficha
   RF-01 (nombre, apellido y edad), RF-02 (alcance por grupo /
   guardería), RF-03 (mensaje cuando no hay niños registrados)
   ============================================================ */
(function (global) {
  'use strict';

  var Vistas = global.Vistas = global.Vistas || {};

  /* ============================================================
     Lista de niños
     ============================================================ */

  Vistas.ninos = function (ctx) {
    var u = Auth.exigir('ninos.ver');
    var ninos = Dominio.ninosVisibles(u);
    var grupos = Dominio.gruposDe(u.guarderiaId);
    var esDocente = u.rol === ROLES.DOCENTE;
    var alcance = esDocente
      ? 'Grupo ' + Dominio.nombreGrupo(u.grupoId)
      : (Dominio.guarderia(u.guarderiaId) || {}).nombre;

    /* --- Caso RF-03 / RF-02: docente sin grupo asignado --- */
    if (esDocente && !u.grupoId) {
      UI.montar(
        UI.pageHead({ titulo: 'Niños', desc: 'Consulta de los niños a su cargo.' }) +
        '<div class="card">' + UI.vacio({
          icono: '\u{1F4CB}',
          titulo: 'No tiene un grupo asignado',
          texto: 'Su consulta está restringida al grupo que le asigne el administrador. ' +
            'Mientras no tenga grupo, el sistema no muestra información de ningún niño.',
          accion: '<a class="btn" href="#/panel">Volver al inicio</a>'
        }) + '</div>'
      );
      return;
    }

    var acciones = '';
    if (Auth.puede('matricula.crear')) {
      acciones = '<a class="btn btn--primary" href="#/matriculas/nueva">Nueva matrícula</a>';
    }

    UI.montar(
      UI.pageHead({
        titulo: 'Niños de la guardería',
        desc: 'Alcance de su consulta: <strong>' + U.esc(alcance) + '</strong>. ' +
          'Se muestran nombre, apellido y edad de cada niño; seleccione una fila para ver la ficha completa.',
        acciones: acciones
      }) +

      (esDocente ? UI.alerta('info',
        'Usted solo puede consultar los niños del grupo <strong>' +
        U.esc(Dominio.nombreGrupo(u.grupoId)) + '</strong>. ' +
        'Los niños de otros grupos o de otra guardería no son visibles para su usuario.') : '') +

      '<div class="toolbar">' +
      '<input type="search" id="q" placeholder="Buscar por nombre, apellido o acudiente">' +
      (esDocente ? '' : UI.select('grupo', grupos.map(function (g) {
        return { valor: g.id, texto: g.nombre };
      }), '', { vacio: 'Todos los grupos' })) +
      UI.select('estado', [ESTADOS.ACTIVA, ESTADOS.PENDIENTE, ESTADOS.RETIRADA, ESTADOS.RECHAZADA],
        '', { vacio: 'Todos los estados' }) +
      '<span class="toolbar__spacer"></span>' +
      '<span class="badge" id="contador"></span>' +
      '</div>' +

      '<div class="card card--flush" id="tabla-ninos"></div>'
    );

    var q = UI.$('#q'), selGrupo = UI.$('[name="grupo"]'), selEstado = UI.$('[name="estado"]');

    function pintar() {
      var texto = U.norm(q.value);
      var fg = selGrupo ? selGrupo.value : '';
      var fe = selEstado.value;

      var filtrados = ninos.filter(function (n) {
        if (fg && n.grupoId !== fg) return false;
        if (fe && n.estado !== fe) return false;
        if (!texto) return true;
        var blob = U.norm(n.nombres + ' ' + n.apellidos + ' ' +
          (n.acudientes || []).map(function (a) { return a.nombre + ' ' + a.documento; }).join(' '));
        return blob.indexOf(texto) !== -1;
      });

      UI.$('#contador').textContent = filtrados.length + ' de ' + ninos.length + ' niño(s)';

      var vacio;
      if (!ninos.length) {
        /* RF-03: no hay niños registrados en el alcance del usuario */
        vacio = {
          icono: '\u{1F476}',
          titulo: 'No hay niños disponibles',
          texto: esDocente
            ? 'Todavía no hay niños registrados en el grupo ' + Dominio.nombreGrupo(u.grupoId) + '.'
            : 'Aún no se ha registrado ningún niño en esta guardería.',
          accion: Auth.puede('matricula.crear')
            ? '<a class="btn btn--primary" href="#/matriculas/nueva">Registrar el primer niño</a>' : ''
        };
      } else {
        vacio = {
          icono: '\u{1F50D}',
          titulo: 'Ningún niño coincide con el filtro',
          texto: 'Ajuste la búsqueda, el grupo o el estado para ver resultados.',
          accion: '<button class="btn" data-limpiar>Limpiar filtros</button>'
        };
      }

      UI.$('#tabla-ninos').innerHTML = UI.tabla({
        columnas: [{ titulo: 'Nombre' }, { titulo: 'Apellido' }, { titulo: 'Edad' },
          { titulo: 'Grupo' }, { titulo: 'Estado' }, { titulo: 'Acudiente principal' }],
        filas: filtrados.map(function (n) {
          var ac = (n.acudientes || [])[0];
          return '<tr class="is-clickable" data-ver="' + n.id + '" tabindex="0">' +
            '<td class="cell-main">' + U.esc(n.nombres) + '</td>' +
            '<td>' + U.esc(n.apellidos) + '</td>' +
            '<td class="nowrap">' + U.edadTexto(Dominio.edadMeses(n)) +
            '<div class="cell-sub">' + U.fmtFecha(n.fechaNacimiento) + '</div></td>' +
            '<td>' + U.esc(Dominio.nombreGrupo(n.grupoId)) + '</td>' +
            '<td>' + UI.badgeEstado(n.estado) + '</td>' +
            '<td>' + (ac ? U.esc(ac.nombre) + '<div class="cell-sub">' + U.esc(ac.parentesco) +
              ' · ' + U.esc(ac.telefono) + '</div>' : '<span class="muted">--</span>') + '</td>' +
            '</tr>';
        }),
        vacio: vacio
      });

      /* AC3: seleccionar un niño para consultar su información */
      UI.$$('[data-ver]').forEach(function (tr) {
        tr.addEventListener('click', function () { App.ir('#/ninos/' + tr.getAttribute('data-ver')); });
        tr.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            App.ir('#/ninos/' + tr.getAttribute('data-ver'));
          }
        });
      });
      var limpiar = UI.$('[data-limpiar]');
      if (limpiar) {
        limpiar.addEventListener('click', function () {
          q.value = ''; if (selGrupo) selGrupo.value = ''; selEstado.value = '';
          pintar();
        });
      }
    }

    q.addEventListener('input', U.debounce(pintar, 180));
    if (selGrupo) selGrupo.addEventListener('change', pintar);
    selEstado.addEventListener('change', pintar);
    pintar();
  };

  /* ============================================================
     Ficha del niño
     ============================================================ */

  Vistas.ninoDetalle = function (ctx) {
    var u = Auth.exigir('ninos.detalle');
    var n = Dominio.exigirVerNino(u, Dominio.nino(ctx.params[0]));

    var g = Dominio.grupo(n.grupoId);
    var meses = Dominio.edadMeses(n);
    var sug = Dominio.grupoSugerido(n.fechaNacimiento, n.guarderiaId);
    var fueraDeRango = g && !Dominio.grupoCorrespondeEdad(g, meses);
    var volver = u.rol === ROLES.ACUDIENTE ? '#/portal' : '#/ninos';

    var acciones = '<a class="btn" href="' + volver + '">Volver</a>';
    if (Auth.puede('matricula.editar')) {
      acciones += '<a class="btn" href="#/matriculas/editar/' + n.id + '">Editar matrícula</a>';
    }
    if (Auth.puede('matricula.aprobar')) {
      Dominio.transicionesPermitidas(n.estado).forEach(function (e) {
        var clase = e === ESTADOS.ACTIVA ? 'btn--ok' : e === ESTADOS.RECHAZADA ? 'btn--danger' : '';
        acciones += '<button class="btn ' + clase + '" data-estado="' + e + '">' +
          etiquetaAccion(e) + '</button>';
      });
    }

    var html = UI.pageHead({
      titulo: Dominio.nombreCompleto(n),
      desc: U.edadTexto(meses) + ' · ' + U.fmtFechaLarga(n.fechaNacimiento) + ' · ' +
        'Grupo <strong>' + U.esc(Dominio.nombreGrupo(n.grupoId)) + '</strong> · ' +
        UI.badgeEstado(n.estado),
      acciones: acciones
    });

    if (fueraDeRango && Auth.puede('matricula.editar')) {
      html += UI.alerta('warn',
        '<strong>La edad del niño ya no corresponde a su grupo.</strong> ' +
        U.esc(g.nombre) + ' cubre ' + U.rangoTexto(g.edadMinMeses, g.edadMaxMeses) +
        ' y el niño tiene ' + U.edadTexto(meses) + '. ' +
        (sug.grupo && sug.grupo.id !== g.id
          ? 'Grupo sugerido: <strong>' + U.esc(sug.grupo.nombre) + '</strong>. ' +
            '<button class="btn btn--sm" data-reclasificar>Reclasificar automáticamente</button>'
          : 'No hay otro grupo cuyo rango corresponda; ajuste los grupos.'));
    }

    html += '<div class="grid grid--2">';

    /* --- Datos generales --- */
    html += '<div class="card"><h2>Datos del niño</h2><dl class="dl" style="margin-top:.7rem">' +
      '<dt>Nombres</dt><dd>' + U.esc(n.nombres) + '</dd>' +
      '<dt>Apellidos</dt><dd>' + U.esc(n.apellidos) + '</dd>' +
      '<dt>Fecha de nacimiento</dt><dd>' + U.fmtFechaLarga(n.fechaNacimiento) + '</dd>' +
      '<dt>Edad</dt><dd>' + U.edadTexto(meses) + ' (' + meses + ' meses)</dd>' +
      (n.genero ? '<dt>Sexo</dt><dd>' + (n.genero === 'F' ? 'Femenino' : 'Masculino') + '</dd>' : '') +
      '<dt>Grupo</dt><dd>' + U.esc(Dominio.nombreGrupo(n.grupoId)) +
      (g ? ' <span class="cell-sub">(' + U.rangoTexto(g.edadMinMeses, g.edadMaxMeses) +
        (g.salon ? ' · ' + U.esc(g.salon) : '') + ')</span>' : '') + '</dd>' +
      '<dt>Docente(s)</dt><dd>' + (g && Dominio.docentesDeGrupo(g.id).length
        ? U.esc(Dominio.docentesDeGrupo(g.id).map(function (d) { return d.nombre; }).join(', '))
        : '<span class="muted">Sin docente asignado</span>') + '</dd>' +
      '<dt>Estado</dt><dd>' + UI.badgeEstado(n.estado) +
      (n.fechaIngreso ? ' <span class="cell-sub">desde ' + U.fmtFecha(n.fechaIngreso) + '</span>' : '') +
      (n.fechaRetiro ? ' <span class="cell-sub">· retiro ' + U.fmtFecha(n.fechaRetiro) + '</span>' : '') +
      '</dd>' +
      '</dl></div>';

    /* --- Información médica (RF-05) --- */
    html += '<div class="card"><div style="display:flex;gap:.5rem;align-items:center">' +
      '<h2 style="margin-right:auto">Información médica</h2></div>' +
      '<dl class="dl" style="margin-top:.7rem">' +
      '<dt>EPS</dt><dd>' + U.esc(n.medica.eps) + '</dd>' +
      '<dt>Alergias</dt><dd>' + resaltar(n.medica.alergias) + '</dd>' +
      '<dt>Condiciones especiales</dt><dd>' + resaltar(n.medica.condiciones) + '</dd>' +
      '<dt>Medicamentos</dt><dd>' + U.esc(n.medica.medicamentos || 'Ninguno') + '</dd>' +
      '<dt>Observaciones</dt><dd>' + U.esc(n.medica.observaciones || '--') + '</dd>' +
      '</dl></div>';

    /* --- Acudientes (RF-04 / RF-07) --- */
    html += '<div class="card card--flush"><div class="card__head">' +
      '<h2>Acudientes autorizados</h2>' +
      '<span class="badge">' + n.acudientes.length + ' de ' + Dominio.MAX_ACUDIENTES + '</span></div>' +
      UI.tabla({
        columnas: [{ titulo: 'Nombre' }, { titulo: 'Parentesco' }, { titulo: 'Documento' }, { titulo: 'Contacto' }],
        filas: n.acudientes.map(function (a) {
          return '<tr><td class="cell-main">' + U.esc(a.nombre) + '</td>' +
            '<td>' + U.esc(a.parentesco) + '</td>' +
            '<td class="mono nowrap">' + U.esc(a.tipoDoc + ' ' + a.documento) +
            (U.documentoValido(a.documento) ? '' : ' <span class="badge badge--danger">inválido</span>') +
            '</td>' +
            '<td class="small">' + U.esc(a.telefono) +
            (a.email ? '<div class="cell-sub">' + U.esc(a.email) + '</div>' : '') + '</td></tr>';
        }),
        vacio: { titulo: 'Sin acudientes registrados', texto: 'Toda matrícula requiere al menos un acudiente.' }
      }) +
      '<div class="card__body"><strong class="small">Contacto de emergencia:</strong> ' +
      U.esc(n.contactoEmergencia.nombre) + ' · ' + U.esc(n.contactoEmergencia.telefono) +
      (n.contactoEmergencia.parentesco ? ' (' + U.esc(n.contactoEmergencia.parentesco) + ')' : '') +
      '</div></div>';

    /* --- Historial de estados (RF-08 / RNF-02) --- */
    html += '<div class="card"><div style="display:flex;gap:.5rem;align-items:center">' +
      '<h2 style="margin-right:auto">Historial de la matrícula</h2></div>' +
      '<ul class="timeline" style="margin-top:.9rem">' +
      (n.historial || []).slice().reverse().map(function (h) {
        return '<li><div class="timeline__top">' + UI.badgeEstado(h.estado) +
          '<span class="timeline__date">' + U.fmtFechaHora(h.fecha) + '</span></div>' +
          '<div class="timeline__note">' + U.esc(h.nota || '') + '</div>' +
          '<div class="cell-sub">' + U.esc(h.usuarioNombre) + ' · ' + U.esc(h.rol) + '</div></li>';
      }).join('') + '</ul></div>';

    html += '</div>';

    /* --- Estado de cuenta (solo roles con permiso o el acudiente del niño) --- */
    if (Auth.puede('pagos.ver') || u.rol === ROLES.ACUDIENTE) {
      html += Vistas.bloqueEstadoCuenta(n, u);
    }

    UI.montar(html);

    UI.$$('[data-estado]').forEach(function (b) {
      b.addEventListener('click', function () {
        Vistas.dialogoEstado(n.id, b.getAttribute('data-estado'));
      });
    });
    var rec = UI.$('[data-reclasificar]');
    if (rec) {
      rec.addEventListener('click', function () {
        var r = Dominio.reclasificar(n.id, u);
        if (!r.ok) { UI.toast(r.mensaje, 'danger'); return; }
        UI.toast('Niño reclasificado en ' + r.grupo.nombre, 'ok');
        App.refrescar();
      });
    }
  };

  function resaltar(texto) {
    var t = String(texto || '').trim();
    if (!t || U.norm(t) === 'ninguna' || U.norm(t) === 'ninguno') {
      return '<span class="muted">Ninguna</span>';
    }
    return '<span class="badge badge--warn">' + U.esc(t) + '</span>';
  }

  function etiquetaAccion(estado) {
    if (estado === ESTADOS.ACTIVA) return 'Aprobar / activar';
    if (estado === ESTADOS.RECHAZADA) return 'Rechazar';
    if (estado === ESTADOS.RETIRADA) return 'Registrar retiro';
    if (estado === ESTADOS.PENDIENTE) return 'Volver a pendiente';
    return estado;
  }
})(window);
