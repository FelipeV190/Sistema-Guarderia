/* ============================================================
   views-matriculas.js - HU-02: gestión de matrícula
   RF-04 (datos y 1 a 3 acudientes), RF-05 (información médica),
   RF-06 (solo Administrador aprueba/rechaza), RF-07 (documento
   válido), RF-08 (estado con fecha de cambio)
   ============================================================ */
(function (global) {
  'use strict';

  var Vistas = global.Vistas = global.Vistas || {};
  var TIPOS_DOC = ['CC', 'CE', 'TI', 'PA', 'PEP'];

  /* ============================================================
     Listado de matrículas
     ============================================================ */

  Vistas.matriculas = function () {
    var u = Auth.exigir('matricula.ver');
    var ninos = Dominio.ninosVisibles(u);
    var puedeCrear = Auth.puede('matricula.crear');

    UI.montar(
      UI.pageHead({
        titulo: 'Matrículas',
        desc: 'Registro, consulta y actualización de la matrícula de cada niño: datos personales, ' +
          'acudientes autorizados, información médica y estado de la matrícula.',
        acciones: puedeCrear
          ? '<a class="btn btn--primary" href="#/matriculas/nueva">Nueva matrícula</a>' : ''
      }) +
      '<div class="grid grid--4" style="margin-bottom:1.1rem">' +
      [ESTADOS.ACTIVA, ESTADOS.PENDIENTE, ESTADOS.RETIRADA, ESTADOS.RECHAZADA].map(function (e) {
        return UI.stat(e, ninos.filter(function (n) { return n.estado === e; }).length);
      }).join('') +
      '</div>' +
      '<div class="toolbar">' +
      '<input type="search" id="q" placeholder="Buscar niño o acudiente">' +
      UI.select('estado', [ESTADOS.ACTIVA, ESTADOS.PENDIENTE, ESTADOS.RETIRADA, ESTADOS.RECHAZADA],
        '', { vacio: 'Todos los estados' }) +
      '<span class="toolbar__spacer"></span>' +
      '<span class="badge" id="contador"></span>' +
      '</div>' +
      '<div class="card card--flush" id="tabla"></div>'
    );

    var q = UI.$('#q'), selEstado = UI.$('[name="estado"]');

    function pintar() {
      var texto = U.norm(q.value), fe = selEstado.value;
      var lista = ninos.filter(function (n) {
        if (fe && n.estado !== fe) return false;
        if (!texto) return true;
        return U.norm(n.nombres + ' ' + n.apellidos + ' ' +
          n.acudientes.map(function (a) { return a.nombre + ' ' + a.documento; }).join(' '))
          .indexOf(texto) !== -1;
      });
      UI.$('#contador').textContent = lista.length + ' de ' + ninos.length + ' matrícula(s)';

      UI.$('#tabla').innerHTML = UI.tabla({
        columnas: [{ titulo: 'Niño' }, { titulo: 'Edad' }, { titulo: 'Grupo' },
          { titulo: 'Acudientes' }, { titulo: 'Estado' }, { titulo: 'Último cambio' }, { titulo: 'Acciones' }],
        filas: lista.map(function (n) {
          var ultimo = (n.historial || [])[n.historial.length - 1];
          var acc = '<a class="btn btn--sm" href="#/ninos/' + n.id + '">Ficha</a>';
          if (Auth.puede('matricula.editar')) {
            acc += ' <a class="btn btn--sm" href="#/matriculas/editar/' + n.id + '">Editar</a>';
          }
          if (Auth.puede('matricula.aprobar') && n.estado === ESTADOS.PENDIENTE) {
            acc += ' <button class="btn btn--sm btn--ok" data-estado="' + ESTADOS.ACTIVA +
              '" data-nino="' + n.id + '">Aprobar</button>' +
              ' <button class="btn btn--sm btn--danger" data-estado="' + ESTADOS.RECHAZADA +
              '" data-nino="' + n.id + '">Rechazar</button>';
          }
          return '<tr><td><div class="cell-main">' + U.esc(Dominio.nombreCompleto(n)) + '</div>' +
            '<div class="cell-sub">' + U.fmtFecha(n.fechaNacimiento) + '</div></td>' +
            '<td class="nowrap">' + U.edadTexto(Dominio.edadMeses(n)) + '</td>' +
            '<td>' + U.esc(Dominio.nombreGrupo(n.grupoId)) + '</td>' +
            '<td class="small">' + U.esc(n.acudientes.map(function (a) { return a.nombre; }).join(', ')) + '</td>' +
            '<td>' + UI.badgeEstado(n.estado) + '</td>' +
            '<td class="small nowrap">' + (ultimo ? U.fmtFechaHora(ultimo.fecha) : '--') + '</td>' +
            '<td><div class="btn-row">' + acc + '</div></td></tr>';
        }),
        vacio: !ninos.length ? {
          icono: '\u{1F4DD}', titulo: 'No hay matrículas registradas',
          texto: 'Registre la primera matrícula para comenzar a gestionar la guardería.',
          accion: puedeCrear ? '<a class="btn btn--primary" href="#/matriculas/nueva">Nueva matrícula</a>' : ''
        } : {
          icono: '\u{1F50D}', titulo: 'Ninguna matrícula coincide con el filtro',
          texto: 'Ajuste la búsqueda o el estado seleccionado.'
        }
      });

      UI.$$('[data-estado]').forEach(function (b) {
        b.addEventListener('click', function () {
          Vistas.dialogoEstado(b.getAttribute('data-nino'), b.getAttribute('data-estado'));
        });
      });
    }

    q.addEventListener('input', U.debounce(pintar, 180));
    selEstado.addEventListener('change', pintar);
    pintar();
  };

  /* ============================================================
     Formulario de matrícula (crear / editar)
     ============================================================ */

  Vistas.matriculaForm = function (ctx) {
    var editando = !!ctx.params[0];
    var u = Auth.exigir(editando ? 'matricula.editar' : 'matricula.crear');
    var n = editando ? Dominio.nino(ctx.params[0]) : null;

    if (editando && !n) {
      UI.montar('<div class="card">' + UI.vacio({
        icono: '\u{1F50E}', titulo: 'Matrícula no encontrada',
        texto: 'El registro solicitado no existe o fue eliminado.',
        accion: '<a class="btn" href="#/matriculas">Volver al listado</a>'
      }) + '</div>');
      return;
    }
    if (editando && n.guarderiaId !== u.guarderiaId) {
      throw new Auth.AccesoDenegado('Esta matrícula pertenece a otra guardería.');
    }

    var grupos = Dominio.gruposDe(u.guarderiaId);
    if (!grupos.length) {
      UI.montar(UI.pageHead({ titulo: 'Nueva matrícula' }) +
        '<div class="card">' + UI.vacio({
          icono: '\u{1F465}', titulo: 'Primero cree los grupos etarios',
          texto: 'Para matricular un niño el sistema necesita al menos un grupo con rango de edad ' +
            'y capacidad definidos, pues la clasificación es automática.',
          accion: '<a class="btn btn--primary" href="#/grupos">Crear grupos</a>'
        }) + '</div>');
      return;
    }

    var acs = (n && n.acudientes.length ? n.acudientes : [{}]).slice(0, 3);
    var med = (n && n.medica) || {};
    var ce = (n && n.contactoEmergencia) || {};

    UI.montar(
      UI.pageHead({
        titulo: editando ? 'Editar matrícula' : 'Nueva matrícula',
        desc: editando
          ? 'Actualice la información de ' + U.esc(Dominio.nombreCompleto(n)) +
            '. El estado de la matrícula se cambia desde la ficha del niño.'
          : 'Registre los datos del niño, entre 1 y 3 acudientes autorizados, el contacto de ' +
            'emergencia y la información médica relevante. Todos los campos marcados con * son obligatorios.',
        acciones: '<a class="btn" href="' + (editando ? '#/ninos/' + n.id : '#/matriculas') + '">Cancelar</a>'
      }) +

      '<form id="form-matricula" novalidate>' +
      '<div data-resumen-errores hidden></div>' +

      /* ---- Datos del niño ---- */
      '<div class="card">' +
      '<div class="form-section__title">1. Datos del niño</div>' +
      '<p class="form-section__desc">La fecha de nacimiento determina el grupo etario sugerido ' +
      'automáticamente.</p>' +
      '<div class="form-grid">' +
      UI.campo({
        label: 'Nombres', name: 'nombres', requerido: true,
        control: UI.input('nombres', { valor: n ? n.nombres : '', placeholder: 'Ej. María José' })
      }) +
      UI.campo({
        label: 'Apellidos', name: 'apellidos', requerido: true,
        control: UI.input('apellidos', { valor: n ? n.apellidos : '', placeholder: 'Ej. Gómez Ramírez' })
      }) +
      UI.campo({
        label: 'Fecha de nacimiento', name: 'fechaNacimiento', requerido: true,
        control: UI.input('fechaNacimiento', { tipo: 'date', valor: n ? n.fechaNacimiento : '', max: U.hoy() }),
        ayuda: '<span id="edad-calculada">--</span>'
      }) +
      UI.campo({
        label: 'Sexo', name: 'genero',
        control: UI.select('genero', [{ valor: 'F', texto: 'Femenino' }, { valor: 'M', texto: 'Masculino' }],
          n ? n.genero : '', { vacio: 'Sin especificar' })
      }) +
      UI.campo({
        label: 'Grupo', name: 'grupoId', requerido: true,
        control: UI.select('grupoId', grupos.map(function (g) {
          var libre = Dominio.cupoDisponible(g.id);
          return {
            valor: g.id,
            texto: g.nombre + ' (' + U.rangoTexto(g.edadMinMeses, g.edadMaxMeses) + ') · ' +
              (libre > 0 ? libre + ' cupo(s) libre(s)' : 'SIN CUPO'),
            deshabilitado: libre <= 0 && (!n || n.grupoId !== g.id)
          };
        }), n ? n.grupoId : '', { vacio: '-- Seleccione o use la sugerencia --' }),
        ayuda: '<span id="sugerencia-grupo" class="muted">Ingrese la fecha de nacimiento para ver la sugerencia.</span>'
      }) +
      UI.campo({
        label: 'Valor matrícula', name: 'valorMatricula', requerido: true,
        control: UI.input('valorMatricula', { tipo: 'number', min: 0, step: 1000, valor: n ? n.valorMatricula : 350000 })
      }) +
      UI.campo({
        label: 'Valor mensualidad', name: 'valorMensualidad', requerido: true,
        control: UI.input('valorMensualidad', { tipo: 'number', min: 0, step: 1000, valor: n ? n.valorMensualidad : 520000 })
      }) +
      '</div></div>' +

      /* ---- Acudientes ---- */
      '<div class="card">' +
      '<div class="form-section__title">2. Acudientes autorizados</div>' +
      '<p class="form-section__desc">Mínimo 1, máximo 3. Al menos uno debe tener documento de ' +
      'identidad válido (6 a 12 dígitos).</p>' +
      '<p class="field__error" data-error-for="acudientes" hidden></p>' +
      '<div id="acudientes">' +
      [0, 1, 2].map(function (i) { return bloqueAcudiente(i, acs[i], i >= acs.length); }).join('') +
      '</div>' +
      '<div class="btn-row">' +
      '<button type="button" class="btn btn--sm" id="btn-add-acudiente">+ Agregar acudiente</button>' +
      '<span class="card__hint" id="conteo-acudientes"></span>' +
      '</div></div>' +

      /* ---- Contacto de emergencia ---- */
      '<div class="card">' +
      '<div class="form-section__title">3. Contacto de emergencia</div>' +
      '<p class="form-section__desc">Persona a contactar si no es posible ubicar a los acudientes.</p>' +
      '<div class="form-grid">' +
      UI.campo({
        label: 'Nombre completo', name: 'emergenciaNombre', requerido: true,
        control: UI.input('emergenciaNombre', { valor: ce.nombre || '' })
      }) +
      UI.campo({
        label: 'Teléfono', name: 'emergenciaTelefono', requerido: true,
        control: UI.input('emergenciaTelefono', { valor: ce.telefono || '', placeholder: '3001234567' })
      }) +
      UI.campo({
        label: 'Parentesco', name: 'emergenciaParentesco',
        control: UI.input('emergenciaParentesco', { valor: ce.parentesco || '', placeholder: 'Ej. Abuela' })
      }) +
      '</div></div>' +

      /* ---- Información médica ---- */
      '<div class="card">' +
      '<div class="form-section__title">4. Información médica relevante ' +
      '</div>' +
      '<p class="form-section__desc">Obligatoria para completar la matrícula. Si no aplica, ' +
      'escriba "Ninguna" de forma explícita: el sistema no acepta campos médicos en blanco.</p>' +
      '<div class="form-grid">' +
      UI.campo({
        label: 'EPS / entidad de salud', name: 'medEps', requerido: true,
        control: UI.input('medEps', { valor: med.eps || '' })
      }) +
      UI.campo({
        label: 'Alergias', name: 'medAlergias', requerido: true,
        control: UI.input('medAlergias', { valor: med.alergias || '', placeholder: 'Ninguna' })
      }) +
      UI.campo({
        label: 'Condiciones especiales', name: 'medCondiciones', requerido: true,
        control: UI.input('medCondiciones', { valor: med.condiciones || '', placeholder: 'Ninguna' })
      }) +
      UI.campo({
        label: 'Medicamentos', name: 'medMedicamentos',
        control: UI.input('medMedicamentos', { valor: med.medicamentos || '', placeholder: 'Ninguno' })
      }) +
      '</div>' +
      UI.campo({
        label: 'Observaciones', name: 'medObservaciones',
        control: UI.textarea('medObservaciones', med.observaciones || '',
          'Cuidados especiales, rutinas, restricciones alimentarias...')
      }) +
      '</div>' +

      '<div class="card"><div class="btn-row">' +
      '<button class="btn btn--primary" type="submit">' +
      (editando ? 'Guardar cambios' : 'Registrar matrícula') + '</button>' +
      '<a class="btn" href="' + (editando ? '#/ninos/' + n.id : '#/matriculas') + '">Cancelar</a>' +
      '<span class="card__hint">' + (editando
        ? 'El cambio queda registrado en la bitácora de auditoría.'
        : 'La matrícula se crea en estado Pendiente; solo un Administrador puede aprobarla.') +
      '</span>' +
      '</div></div>' +
      '</form>'
    );

    var form = UI.$('#form-matricula');
    var fecha = form.elements.fechaNacimiento;
    var selGrupo = form.elements.grupoId;

    /* --- RF-17: sugerencia automática de grupo --- */
    function sugerir(forzar) {
      var sugEl = UI.$('#sugerencia-grupo');
      var edadEl = UI.$('#edad-calculada');
      if (!fecha.value) {
        edadEl.textContent = '--';
        sugEl.className = 'muted';
        sugEl.textContent = 'Ingrese la fecha de nacimiento para ver la sugerencia.';
        return;
      }
      var meses = U.mesesEdad(fecha.value);
      edadEl.textContent = 'Edad: ' + U.edadTexto(meses) + ' (' + meses + ' meses)';
      var sug = Dominio.grupoSugerido(fecha.value, u.guarderiaId);

      if (sug.motivo === 'sin-rango') {
        sugEl.className = 'field__error';
        sugEl.textContent = 'Ningún grupo cubre ' + U.edadTexto(meses) + '. Ajuste los grupos etarios.';
        return;
      }
      if (sug.motivo === 'sin-cupo') {
        sugEl.className = 'field__error';
        sugEl.textContent = 'El grupo ' + sug.grupo.nombre + ' corresponde a esa edad pero ya ' +
          'alcanzó su capacidad máxima.';
        return;
      }
      sugEl.className = 'muted';
      sugEl.innerHTML = 'Grupo sugerido automáticamente: <strong>' + U.esc(sug.grupo.nombre) +
        '</strong> (' + U.rangoTexto(sug.grupo.edadMinMeses, sug.grupo.edadMaxMeses) + ')';
      if (forzar || !selGrupo.value) selGrupo.value = sug.grupo.id;
    }

    fecha.addEventListener('change', function () { sugerir(true); });
    sugerir(false);

    /* --- Acudientes dinámicos (máximo 3) --- */
    function refrescarAcudientes() {
      var visibles = UI.$$('[data-acudiente]').filter(function (b) { return !b.hidden; });
      UI.$('#conteo-acudientes').textContent = visibles.length + ' de 3 acudientes';
      UI.$('#btn-add-acudiente').disabled = visibles.length >= 3;
      UI.$$('[data-quitar-acudiente]').forEach(function (b) {
        b.hidden = visibles.length <= 1;
      });
    }
    UI.$('#btn-add-acudiente').addEventListener('click', function () {
      var oculto = UI.$$('[data-acudiente]').filter(function (b) { return b.hidden; })[0];
      if (!oculto) return;
      oculto.hidden = false;
      refrescarAcudientes();
      var primero = UI.$('input', oculto);
      if (primero) primero.focus();
    });
    UI.$$('[data-quitar-acudiente]').forEach(function (b) {
      b.addEventListener('click', function () {
        var caja = UI.$('[data-acudiente="' + b.getAttribute('data-quitar-acudiente') + '"]');
        UI.$$('input, select', caja).forEach(function (c) {
          if (c.tagName === 'SELECT') c.value = 'CC'; else c.value = '';
        });
        caja.hidden = true;
        refrescarAcudientes();
      });
    });
    refrescarAcudientes();

    /* --- Envío --- */
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var d = UI.leerForm(form);
      var data = {
        guarderiaId: u.guarderiaId,
        grupoId: d.grupoId,
        nombres: d.nombres,
        apellidos: d.apellidos,
        genero: d.genero,
        fechaNacimiento: d.fechaNacimiento,
        valorMatricula: d.valorMatricula,
        valorMensualidad: d.valorMensualidad,
        acudientes: [0, 1, 2].map(function (i) {
          return {
            nombre: d['acudiente' + i + 'Nombre'],
            tipoDoc: d['acudiente' + i + 'TipoDoc'],
            documento: d['acudiente' + i + 'Documento'],
            parentesco: d['acudiente' + i + 'Parentesco'],
            telefono: d['acudiente' + i + 'Telefono'],
            email: d['acudiente' + i + 'Email']
          };
        }).filter(function (a, i) {
          var caja = UI.$('[data-acudiente="' + i + '"]');
          return caja && !caja.hidden;
        }),
        contactoEmergencia: {
          nombre: d.emergenciaNombre, telefono: d.emergenciaTelefono, parentesco: d.emergenciaParentesco
        },
        medica: {
          eps: d.medEps, alergias: d.medAlergias, condiciones: d.medCondiciones,
          medicamentos: d.medMedicamentos, observaciones: d.medObservaciones
        }
      };

      var r = editando
        ? Dominio.actualizarMatricula(n.id, data, u)
        : Dominio.crearMatricula(data, u);

      if (!r.ok) {
        if (r.errores) UI.pintarErrores(form, r.errores);
        else UI.toast(r.mensaje, 'danger');
        return;
      }
      (r.avisos || []).forEach(function (a) { UI.toast(a, 'warn'); });
      UI.toast(editando ? 'Matrícula actualizada.' : 'Matrícula registrada en estado Pendiente.', 'ok');
      App.ir('#/ninos/' + r.nino.id);
    });
  };

  function bloqueAcudiente(i, a, oculto) {
    a = a || {};
    return '<fieldset data-acudiente="' + i + '"' + (oculto ? ' hidden' : '') + '>' +
      '<legend>Acudiente ' + (i + 1) + (i === 0 ? ' (principal)' : ' (opcional)') + '</legend>' +
      '<div class="form-grid">' +
      UI.campo({
        label: 'Nombre completo', name: 'acudiente' + i + 'Nombre', requerido: i === 0,
        control: UI.input('acudiente' + i + 'Nombre', { valor: a.nombre || '' })
      }) +
      UI.campo({
        label: 'Tipo de documento', name: 'acudiente' + i + 'TipoDoc',
        control: UI.select('acudiente' + i + 'TipoDoc', TIPOS_DOC, a.tipoDoc || 'CC', { vacio: false })
      }) +
      UI.campo({
        label: 'Número de documento', name: 'acudiente' + i + 'Documento', requerido: i === 0,
        control: UI.input('acudiente' + i + 'Documento', { valor: a.documento || '', placeholder: '1032458712' })
      }) +
      UI.campo({
        label: 'Parentesco', name: 'acudiente' + i + 'Parentesco', requerido: i === 0,
        control: UI.input('acudiente' + i + 'Parentesco', { valor: a.parentesco || '', placeholder: 'Madre, padre, tío...' })
      }) +
      UI.campo({
        label: 'Teléfono', name: 'acudiente' + i + 'Telefono', requerido: i === 0,
        control: UI.input('acudiente' + i + 'Telefono', { valor: a.telefono || '' })
      }) +
      UI.campo({
        label: 'Correo electrónico', name: 'acudiente' + i + 'Email',
        control: UI.input('acudiente' + i + 'Email', { tipo: 'email', valor: a.email || '' }),
        ayuda: i === 0 ? 'Se usa para vincular la cuenta del acudiente.' : ''
      }) +
      '</div>' +
      '<button type="button" class="btn btn--sm btn--ghost" data-quitar-acudiente="' + i + '"' +
      (i === 0 ? ' hidden' : '') + '>Quitar este acudiente</button>' +
      '</fieldset>';
  }

  /* ============================================================
     Diálogo de cambio de estado (RF-06 / RF-08)
     ============================================================ */

  Vistas.dialogoEstado = function (ninoId, estado) {
    var u = Auth.actual();
    var n = Dominio.nino(ninoId);
    if (!n) { UI.toast('La matrícula no existe.', 'danger'); return; }

    /* RF-06: la interfaz no ofrece la acción, y el dominio la vuelve a validar */
    if ((estado === ESTADOS.ACTIVA || estado === ESTADOS.RECHAZADA) && !Auth.puede('matricula.aprobar')) {
      UI.modal({
        titulo: 'Acceso denegado',
        cuerpo: UI.alerta('danger', 'Solo un usuario con rol <strong>Administrador</strong> puede ' +
          'aprobar o rechazar una matrícula. Su rol actual es ' + U.esc(u.rol) + '.'),
        textoCancelar: 'Entendido'
      });
      return;
    }

    var g = Dominio.grupo(n.grupoId);
    var aviso = '';
    if (estado === ESTADOS.ACTIVA && g) {
      var activos = Store.count('ninos', function (x) {
        return x.grupoId === g.id && x.id !== n.id && x.estado === ESTADOS.ACTIVA;
      });
      aviso = activos >= g.capacidad
        ? UI.alerta('danger', 'El grupo <strong>' + U.esc(g.nombre) + '</strong> ya tiene ' +
          activos + ' de ' + g.capacidad + ' cupos ocupados. No será posible activar la matrícula.')
        : UI.alerta('info', 'Al activar, el grupo <strong>' + U.esc(g.nombre) + '</strong> quedará con ' +
          (activos + 1) + ' de ' + g.capacidad + ' cupos ocupados.');
    }

    UI.modal({
      titulo: etiquetaDialogo(estado),
      cuerpo: '<p>' + U.esc(Dominio.nombreCompleto(n)) + ' · ' +
        U.edadTexto(Dominio.edadMeses(n)) + ' · grupo ' + U.esc(Dominio.nombreGrupo(n.grupoId)) + '</p>' +
        aviso +
        '<div class="field"><label for="nota-estado">Nota / justificación</label>' +
        '<textarea id="nota-estado" placeholder="' + U.esc(Dominio.notaPorDefecto(estado)) + '"></textarea>' +
        '<div class="field__help">Queda registrada con fecha y hora en el historial de la ' +
        'matrícula.</div></div>',
      textoOk: etiquetaDialogo(estado),
      claseOk: estado === ESTADOS.RECHAZADA || estado === ESTADOS.RETIRADA ? 'btn--danger' : 'btn--primary',
      onOk: function (modal) {
        var nota = UI.$('#nota-estado', modal).value;
        var r;
        try {
          r = Dominio.cambiarEstado(ninoId, estado, nota, u);
        } catch (err) {
          UI.toast(err.message, 'danger');
          return true;
        }
        if (!r.ok) { UI.toast(r.mensaje, 'danger'); return false; }
        UI.toast('Matrícula de ' + Dominio.nombreCompleto(r.nino) + ': estado ' + estado + '.', 'ok');
        UI.cerrarModal();
        App.refrescar();
        return true;
      }
    });
  };

  function etiquetaDialogo(estado) {
    if (estado === ESTADOS.ACTIVA) return 'Aprobar matrícula';
    if (estado === ESTADOS.RECHAZADA) return 'Rechazar matrícula';
    if (estado === ESTADOS.RETIRADA) return 'Registrar retiro';
    if (estado === ESTADOS.PENDIENTE) return 'Devolver a pendiente';
    return 'Cambiar estado';
  }
})(window);
