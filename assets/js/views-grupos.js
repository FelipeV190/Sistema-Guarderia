/* ============================================================
   views-grupos.js
   HU-05: grupos por rango de edad y clasificación automática
          (RF-16, RF-17)
   HU-06: asignación de docentes a grupos (RF-18)
   ============================================================ */
(function (global) {
  'use strict';

  var Vistas = global.Vistas = global.Vistas || {};

  /* ============================================================
     Grupos etarios
     ============================================================ */

  Vistas.grupos = function () {
    var u = Auth.exigir('grupos.gestionar');
    var grupos = Dominio.gruposDe(u.guarderiaId);
    var ninos = Dominio.ninosVisibles(u).filter(function (n) {
      return n.estado === ESTADOS.ACTIVA || n.estado === ESTADOS.PENDIENTE;
    });

    /* Niños cuya edad ya no corresponde al grupo en el que están (RF-17) */
    var desubicados = ninos.filter(function (n) {
      var g = Dominio.grupo(n.grupoId);
      return g && !Dominio.grupoCorrespondeEdad(g, Dominio.edadMeses(n));
    });

    var html = UI.pageHead({
      titulo: 'Grupos etarios',
      desc: 'Cada grupo se define por un rango de edad en meses y una capacidad máxima. ' +
        'El sistema usa esos rangos para clasificar automáticamente a los niños según su fecha de nacimiento.',
      rf: ['RF-16', 'RF-17'],
      acciones: '<button class="btn btn--primary" id="btn-nuevo-grupo">Nuevo grupo</button>'
    });

    html += UI.alerta('info',
      'El rango se interpreta como <strong>[mínima, máxima)</strong>: un niño de 24 meses entra a ' +
      'un grupo 24&ndash;36 y ya no al grupo 12&ndash;24, de modo que los bordes nunca se solapan. ' +
      'La edad mínima debe ser menor que la máxima y no es posible superar la capacidad del grupo.');

    html += '<div class="card card--flush">' + UI.tabla({
      columnas: [{ titulo: 'Grupo' }, { titulo: 'Rango de edad' }, { titulo: 'Ocupación', num: true },
        { titulo: 'Docentes' }, { titulo: 'Acciones' }],
      filas: grupos.map(function (g) {
        var oc = Dominio.ocupacion(g.id);
        var docs = Dominio.docentesDeGrupo(g.id);
        return '<tr>' +
          '<td><div class="cell-main">' + U.esc(g.nombre) + '</div>' +
          '<div class="cell-sub">' + U.esc(g.salon || 'Sin salón asignado') + '</div></td>' +
          '<td class="nowrap">' + U.rangoTexto(g.edadMinMeses, g.edadMaxMeses) +
          '<div class="cell-sub">' + g.edadMinMeses + ' a ' + (g.edadMaxMeses - 1) + ' meses</div></td>' +
          '<td class="num nowrap">' + oc + ' / ' + g.capacidad +
          '<div style="margin-top:.3rem;min-width:90px">' + UI.barra(oc, g.capacidad) + '</div></td>' +
          '<td class="small">' + (docs.length
            ? U.esc(docs.map(function (d) { return d.nombre; }).join(', '))
            : '<span class="badge badge--warn">Sin docente</span>') + '</td>' +
          '<td><div class="btn-row">' +
          '<button class="btn btn--sm" data-editar="' + g.id + '">Editar</button>' +
          '<button class="btn btn--sm btn--danger" data-eliminar="' + g.id + '">Eliminar</button>' +
          '</div></td></tr>';
      }),
      vacio: {
        icono: '\u{1F465}', titulo: 'Todavía no hay grupos creados',
        texto: 'Cree el primer grupo indicando su rango de edad en meses y la capacidad máxima.',
        accion: '<button class="btn btn--primary" id="btn-nuevo-grupo-2">Crear grupo</button>'
      }
    }) + '</div>';

    /* Revisión de clasificación automática */
    html += '<div class="card card--flush"><div class="card__head">' +
      '<h2>Revisión de clasificación automática</h2>' + UI.rf(['RF-17']) + '</div>';

    if (!desubicados.length) {
      html += UI.vacio({
        icono: '✓', titulo: 'Todos los niños están en el grupo que corresponde a su edad',
        texto: 'El sistema comparó la fecha de nacimiento de cada niño con el rango de su grupo ' +
          'y no encontró inconsistencias.'
      });
    } else {
      html += UI.tabla({
        columnas: [{ titulo: 'Niño' }, { titulo: 'Edad' }, { titulo: 'Grupo actual' },
          { titulo: 'Grupo que corresponde' }, { titulo: '' }],
        filas: desubicados.map(function (n) {
          var sug = Dominio.grupoSugerido(n.fechaNacimiento, n.guarderiaId);
          var destino = sug.grupo
            ? U.esc(sug.grupo.nombre) + (sug.motivo === 'sin-cupo'
              ? ' <span class="badge badge--danger">sin cupo</span>' : '')
            : '<span class="muted">Ningún grupo cubre esa edad</span>';
          return '<tr><td class="cell-main">' + U.esc(Dominio.nombreCompleto(n)) + '</td>' +
            '<td class="nowrap">' + U.edadTexto(Dominio.edadMeses(n)) + '</td>' +
            '<td>' + U.esc(Dominio.nombreGrupo(n.grupoId)) + '</td>' +
            '<td>' + destino + '</td>' +
            '<td>' + (sug.grupo && sug.motivo === 'ok'
              ? '<button class="btn btn--sm btn--primary" data-reclasificar="' + n.id + '">Reclasificar</button>'
              : '') + '</td></tr>';
        })
      });
    }
    html += '</div>';

    UI.montar(html);

    function abrirNuevo() { dialogoGrupo(null, u); }
    var b1 = UI.$('#btn-nuevo-grupo'), b2 = UI.$('#btn-nuevo-grupo-2');
    if (b1) b1.addEventListener('click', abrirNuevo);
    if (b2) b2.addEventListener('click', abrirNuevo);

    UI.$$('[data-editar]').forEach(function (b) {
      b.addEventListener('click', function () {
        dialogoGrupo(Dominio.grupo(b.getAttribute('data-editar')), u);
      });
    });

    UI.$$('[data-eliminar]').forEach(function (b) {
      b.addEventListener('click', function () {
        var g = Dominio.grupo(b.getAttribute('data-eliminar'));
        UI.confirmar({
          titulo: 'Eliminar grupo',
          mensaje: '¿Eliminar el grupo <strong>' + U.esc(g.nombre) + '</strong>? Esta acción no se puede deshacer.',
          textoOk: 'Eliminar', claseOk: 'btn--danger',
          onOk: function () {
            var r = Dominio.eliminarGrupo(g.id, u);
            if (!r.ok) { UI.toast(r.mensaje, 'danger'); return true; }
            UI.toast('Grupo eliminado.', 'ok');
            UI.cerrarModal();
            App.refrescar();
            return true;
          }
        });
      });
    });

    UI.$$('[data-reclasificar]').forEach(function (b) {
      b.addEventListener('click', function () {
        var r = Dominio.reclasificar(b.getAttribute('data-reclasificar'), u);
        if (!r.ok) { UI.toast(r.mensaje, 'danger'); return; }
        UI.toast('Reclasificado en ' + r.grupo.nombre + '.', 'ok');
        App.refrescar();
      });
    });
  };

  /* Formulario de grupo en modal (RF-16) */
  function dialogoGrupo(grupo, u) {
    var editando = !!grupo;
    UI.modal({
      titulo: editando ? 'Editar grupo' : 'Nuevo grupo',
      cuerpo: '<form id="form-grupo" novalidate>' +
        '<div data-resumen-errores hidden></div>' +
        UI.campo({
          label: 'Nombre del grupo', name: 'nombre', requerido: true,
          control: UI.input('nombre', { valor: editando ? grupo.nombre : '', placeholder: 'Ej. Caminadores' })
        }) +
        '<div class="form-grid">' +
        UI.campo({
          label: 'Edad mínima (meses)', name: 'edadMinMeses', requerido: true,
          control: UI.input('edadMinMeses', { tipo: 'number', min: 0, max: 120, valor: editando ? grupo.edadMinMeses : '' })
        }) +
        UI.campo({
          label: 'Edad máxima (meses)', name: 'edadMaxMeses', requerido: true,
          control: UI.input('edadMaxMeses', { tipo: 'number', min: 1, max: 121, valor: editando ? grupo.edadMaxMeses : '' })
        }) +
        '</div>' +
        '<div class="form-grid">' +
        UI.campo({
          label: 'Capacidad máxima', name: 'capacidad', requerido: true,
          control: UI.input('capacidad', { tipo: 'number', min: 1, max: 60, valor: editando ? grupo.capacidad : '' }),
          ayuda: editando ? 'Ocupación actual: ' + Dominio.ocupacion(grupo.id) + ' niño(s).' : ''
        }) +
        UI.campo({
          label: 'Salón', name: 'salon',
          control: UI.input('salon', { valor: editando ? grupo.salon : '', placeholder: 'Ej. Salón B' })
        }) +
        '</div>' +
        '<p class="card__hint">El sistema rechaza un grupo cuya edad mínima sea mayor o igual ' +
        'a la máxima (HU-05 AC2).</p>' +
        '</form>',
      textoOk: editando ? 'Guardar' : 'Crear grupo',
      onOk: function (modal) {
        var form = UI.$('#form-grupo', modal);
        var d = UI.leerForm(form);
        d.guarderiaId = u.guarderiaId;
        var r = Dominio.guardarGrupo(d, editando ? grupo.id : null, u);
        if (!r.ok) { UI.pintarErrores(form, r.errores); return false; }
        UI.toast(editando ? 'Grupo actualizado.' : 'Grupo "' + r.grupo.nombre + '" creado.', 'ok');
        UI.cerrarModal();
        App.refrescar();
        return true;
      }
    });
  }

  /* ============================================================
     HU-06 - Asignación de docentes a grupos (RF-18)
     ============================================================ */

  Vistas.docentes = function () {
    var u = Auth.exigir('docentes.asignar');
    var docentes = Dominio.docentesDe(u.guarderiaId);
    var grupos = Dominio.gruposDe(u.guarderiaId);

    var html = UI.pageHead({
      titulo: 'Asignación de docentes',
      desc: 'Un grupo puede tener varios docentes (titular y auxiliar), pero cada docente ' +
        'pertenece exactamente a un grupo. Al reasignar un docente, su acceso a la información ' +
        'de los niños cambia de inmediato.',
      rf: ['RF-18', 'RF-02']
    });

    if (!grupos.length) {
      html += '<div class="card">' + UI.vacio({
        icono: '\u{1F465}', titulo: 'Primero cree los grupos',
        texto: 'No es posible asignar docentes si la guardería aún no tiene grupos etarios definidos.',
        accion: '<a class="btn btn--primary" href="#/grupos">Ir a grupos</a>'
      }) + '</div>';
      UI.montar(html);
      return;
    }

    html += '<div class="card card--flush"><div class="card__head"><h2>Docentes</h2>' +
      '<span class="badge">' + docentes.length + '</span></div>' +
      UI.tabla({
        columnas: [{ titulo: 'Docente' }, { titulo: 'Grupo asignado' },
          { titulo: 'Niños a cargo', num: true }, { titulo: 'Reasignar a' }],
        filas: docentes.map(function (d) {
          var aCargo = Dominio.ninosVisibles(d).length;
          return '<tr>' +
            '<td><div class="cell-main">' + U.esc(d.nombre) + '</div>' +
            '<div class="cell-sub">' + U.esc(d.email) + '</div></td>' +
            '<td>' + (d.grupoId
              ? '<span class="badge badge--brand">' + U.esc(Dominio.nombreGrupo(d.grupoId)) + '</span>'
              : '<span class="badge badge--warn">Sin grupo</span>') + '</td>' +
            '<td class="num">' + aCargo + '</td>' +
            '<td>' + UI.select('grupo-' + d.id, grupos.map(function (g) {
              var oc = Dominio.ocupacion(g.id);
              return { valor: g.id, texto: g.nombre + ' (' + oc + '/' + g.capacidad + ')' };
            }), d.grupoId || '', { vacio: 'Sin grupo', id: 'sel-' + d.id }) + '</td>' +
            '</tr>';
        }),
        vacio: {
          icono: '\u{1F469}‍\u{1F3EB}', titulo: 'No hay docentes registrados',
          texto: 'Los docentes se crean como usuarios con rol Docente en la guardería.'
        }
      }) + '</div>';

    html += '<div class="card card--flush"><div class="card__head">' +
      '<h2>Cobertura por grupo</h2>' + UI.rf(['RF-18']) + '</div>' +
      UI.tabla({
        columnas: [{ titulo: 'Grupo' }, { titulo: 'Docentes asignados' }, { titulo: 'Niños', num: true }],
        filas: grupos.map(function (g) {
          var docs = Dominio.docentesDeGrupo(g.id);
          return '<tr><td class="cell-main">' + U.esc(g.nombre) + '</td>' +
            '<td>' + (docs.length
              ? docs.map(function (d, i) {
                return '<span class="badge badge--' + (i === 0 ? 'brand' : 'info') + '">' +
                  U.esc(d.nombre) + (i === 0 ? ' · titular' : ' · auxiliar') + '</span>';
              }).join(' ')
              : '<span class="badge badge--warn">Grupo sin docente</span>') + '</td>' +
            '<td class="num">' + Dominio.ocupacion(g.id) + '</td></tr>';
        })
      }) + '</div>';

    UI.montar(html);

    docentes.forEach(function (d) {
      var sel = UI.$('#sel-' + d.id);
      if (!sel) return;
      sel.addEventListener('change', function () {
        var destino = sel.value || null;
        var r = Dominio.asignarDocente(d.id, destino, u);
        if (!r.ok) {
          UI.toast(r.mensaje, 'danger');
          sel.value = d.grupoId || '';
          return;
        }
        var msg = destino
          ? d.nombre + ' asignado(a) a ' + r.grupo.nombre +
            (r.anterior ? ' (antes: ' + r.anterior + ')' : '')
          : d.nombre + ' quedó sin grupo asignado';
        UI.toast(msg + '. Su acceso a la información de los niños se actualizó.', 'ok');
        App.refrescar();
      });
    });
  };
})(window);
