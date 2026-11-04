/* ============================================================
   views-pagos.js - HU-03: registro de pagos y estado de cuenta
   RF-09 (registro con alumno, período, fecha, valor y medio),
   RF-10 (actualización del saldo), RF-11 (comprobante e historial),
   RF-12 (restringido a usuarios con permiso administrativo)
   ============================================================ */
(function (global) {
  'use strict';

  var Vistas = global.Vistas = global.Vistas || {};

  /* ============================================================
     Listado de pagos y cartera
     ============================================================ */

  Vistas.pagos = function () {
    var u = Auth.exigir('pagos.ver');
    var ninos = Dominio.ninosVisibles(u);
    var porId = {};
    ninos.forEach(function (n) { porId[n.id] = n; });

    var pagos = U.sortBy(Store.where('pagos', function (p) { return !!porId[p.ninoId]; }),
      function (p) { return p.fecha + p.id; }).reverse();

    var cartera = U.sortBy(Dominio.cartera(u), function (c) { return -c.saldo; });
    var saldoTotal = U.sum(cartera.filter(function (c) { return c.saldo > 0; }), function (c) { return c.saldo; });
    var recaudadoMes = U.sum(pagos.filter(function (p) {
      return U.periodoDe(p.fecha) === U.periodoActual();
    }), function (p) { return Number(p.valor) || 0; });

    UI.montar(
      UI.pageHead({
        titulo: 'Pagos',
        desc: 'Registro de pagos de matrícula y mensualidad, saldos por alumno y comprobantes.',
        acciones: Auth.puede('pagos.gestionar')
          ? '<a class="btn btn--primary" href="#/pagos/nuevo">Registrar pago</a>'
          : '<span class="badge badge--warn">Su rol solo permite consultar</span>'
      }) +

      '<div class="grid grid--4" style="margin-bottom:1.1rem">' +
      UI.stat('Recaudado en ' + U.fmtPeriodo(U.periodoActual()), U.money(recaudadoMes), '', true) +
      UI.stat('Cartera por cobrar', U.money(saldoTotal), '', true) +
      UI.stat('Pagos registrados', pagos.length, 'histórico de la guardería') +
      UI.stat('Alumnos en mora', cartera.filter(function (c) { return c.saldo > 0; }).length,
        'de ' + cartera.length + ' con matrícula') +
      '</div>' +

      '<div class="card card--flush"><div class="card__head"><h2>Estado de cuenta por alumno</h2>' +
      '</div>' +
      UI.tabla({
        columnas: [{ titulo: 'Alumno' }, { titulo: 'Grupo' }, { titulo: 'Pagado', num: true },
          { titulo: 'Saldo', num: true }, { titulo: '' }],
        filas: cartera.map(function (c) {
          return '<tr><td><div class="cell-main">' + U.esc(Dominio.nombreCompleto(c.nino)) + '</div>' +
            '<div class="cell-sub">' + UI.badgeEstado(c.nino.estado) + '</div></td>' +
            '<td>' + U.esc(Dominio.nombreGrupo(c.nino.grupoId)) + '</td>' +
            '<td class="num nowrap">' + U.money(c.totalPagado) + '</td>' +
            '<td class="num nowrap">' + UI.badgeSaldo(c.saldo) + '</td>' +
            '<td><div class="btn-row">' +
            '<a class="btn btn--sm" href="#/pagos/estado/' + c.nino.id + '">Detalle</a>' +
            (Auth.puede('pagos.gestionar')
              ? '<a class="btn btn--sm btn--primary" href="#/pagos/nuevo/' + c.nino.id + '">Registrar pago</a>'
              : '') +
            '</div></td></tr>';
        }),
        vacio: {
          icono: '\u{1F4B3}', titulo: 'Todavía no hay alumnos con matrícula activa',
          texto: 'Los pagos se registran sobre matrículas activas o retiradas; las pendientes ' +
            'de aprobación no generan cargos.'
        }
      }) + '</div>' +

      '<div class="card card--flush"><div class="card__head"><h2>Historial de pagos</h2>' +
      '</div>' +
      '<div class="card__body toolbar" style="margin:0">' +
      '<input type="search" id="q" placeholder="Buscar alumno o referencia">' +
      UI.select('concepto', Seed.CONCEPTOS.map(function (c) {
        return { valor: c, texto: Dominio.etiquetaConcepto(c) };
      }), '', { vacio: 'Todos los conceptos' }) +
      '<input type="month" id="periodo" aria-label="Período">' +
      '<span class="toolbar__spacer"></span><span class="badge" id="contador"></span>' +
      '</div>' +
      '<div id="tabla-pagos"></div></div>'
    );

    var q = UI.$('#q'), selConcepto = UI.$('[name="concepto"]'), inPeriodo = UI.$('#periodo');

    function pintar() {
      var texto = U.norm(q.value), fc = selConcepto.value, fp = inPeriodo.value;
      var lista = pagos.filter(function (p) {
        if (fc && p.concepto !== fc) return false;
        if (fp && p.periodo !== fp) return false;
        if (!texto) return true;
        var n = porId[p.ninoId];
        return U.norm(Dominio.nombreCompleto(n) + ' ' + p.referencia + ' ' + p.medio).indexOf(texto) !== -1;
      });
      UI.$('#contador').textContent = lista.length + ' de ' + pagos.length + ' pago(s)';
      UI.$('#tabla-pagos').innerHTML = UI.tabla({
        columnas: [{ titulo: 'Fecha' }, { titulo: 'Alumno' }, { titulo: 'Concepto' },
          { titulo: 'Período' }, { titulo: 'Medio' }, { titulo: 'Valor', num: true }, { titulo: '' }],
        filas: lista.map(function (p) {
          var n = porId[p.ninoId];
          return '<tr><td class="nowrap">' + U.fmtFecha(p.fecha) + '</td>' +
            '<td class="cell-main">' + U.esc(Dominio.nombreCompleto(n)) + '</td>' +
            '<td>' + U.esc(Dominio.etiquetaConcepto(p.concepto)) + '</td>' +
            '<td class="nowrap">' + U.fmtPeriodo(p.periodo) + '</td>' +
            '<td class="small">' + U.esc(p.medio) +
            '<div class="cell-sub mono">' + U.esc(p.referencia) + '</div></td>' +
            '<td class="num nowrap">' + U.money(p.valor) + '</td>' +
            '<td><a class="btn btn--sm" href="#/pagos/comprobante/' + p.id + '">Comprobante</a></td></tr>';
        }),
        vacio: !pagos.length ? {
          icono: '\u{1F9FE}', titulo: 'Aún no se han registrado pagos',
          texto: 'Registre el primer pago de matrícula o mensualidad para construir el historial.',
          accion: Auth.puede('pagos.gestionar')
            ? '<a class="btn btn--primary" href="#/pagos/nuevo">Registrar pago</a>' : ''
        } : {
          icono: '\u{1F50D}', titulo: 'Ningún pago coincide con el filtro',
          texto: 'Pruebe con otro período, concepto o término de búsqueda.'
        }
      });
    }

    q.addEventListener('input', U.debounce(pintar, 180));
    selConcepto.addEventListener('change', pintar);
    inPeriodo.addEventListener('change', pintar);
    pintar();
  };

  /* ============================================================
     Registro de un pago (RF-09 / RF-10 / RF-12)
     ============================================================ */

  Vistas.pagoForm = function (ctx) {
    var u = Auth.exigir('pagos.gestionar');
    var preId = ctx.params[0] || '';
    var elegibles = Dominio.ninosVisibles(u).filter(function (n) {
      return n.estado === ESTADOS.ACTIVA || n.estado === ESTADOS.RETIRADA;
    });

    if (!elegibles.length) {
      UI.montar(UI.pageHead({ titulo: 'Registrar pago' }) + '<div class="card">' + UI.vacio({
        icono: '\u{1F4B3}', titulo: 'No hay alumnos con matrícula activa',
        texto: 'Solo se registran pagos de alumnos cuya matrícula fue aprobada. ' +
          'Pida al administrador que apruebe las matrículas pendientes.',
        accion: '<a class="btn" href="#/pagos">Volver a pagos</a>'
      }) + '</div>');
      return;
    }

    UI.montar(
      UI.pageHead({
        titulo: 'Registrar pago',
        desc: 'Seleccione el alumno e indique concepto, período, fecha, valor y medio de pago. ' +
          'Al guardar, el saldo del alumno se actualiza automáticamente.',
        acciones: '<a class="btn" href="#/pagos">Cancelar</a>'
      }) +
      '<div class="grid grid--2">' +
      '<form class="card" id="form-pago" novalidate>' +
      '<div data-resumen-errores hidden></div>' +
      UI.campo({
        label: 'Alumno', name: 'ninoId', requerido: true,
        control: UI.select('ninoId', elegibles.map(function (n) {
          return { valor: n.id, texto: Dominio.nombreCompleto(n) + ' · ' + Dominio.nombreGrupo(n.grupoId) };
        }), preId, { vacio: '-- Seleccione el alumno --' })
      }) +
      '<div class="form-grid">' +
      UI.campo({
        label: 'Concepto', name: 'concepto', requerido: true,
        control: UI.select('concepto', Seed.CONCEPTOS.map(function (c) {
          return { valor: c, texto: Dominio.etiquetaConcepto(c) };
        }), 'Mensualidad', { vacio: false })
      }) +
      UI.campo({
        label: 'Período', name: 'periodo', requerido: true,
        control: UI.input('periodo', { tipo: 'month', valor: U.periodoActual() }),
        ayuda: 'Mes al que corresponde el pago.'
      }) +
      UI.campo({
        label: 'Fecha del pago', name: 'fecha', requerido: true,
        control: UI.input('fecha', { tipo: 'date', valor: U.hoy(), max: U.hoy() })
      }) +
      UI.campo({
        label: 'Valor', name: 'valor', requerido: true,
        control: UI.input('valor', { tipo: 'number', min: 0, step: 1000, valor: '' })
      }) +
      UI.campo({
        label: 'Medio de pago', name: 'medio', requerido: true,
        control: UI.select('medio', Seed.MEDIOS_PAGO, 'Transferencia', { vacio: false })
      }) +
      UI.campo({
        label: 'Referencia / recibo', name: 'referencia',
        control: UI.input('referencia', { placeholder: 'Se genera automáticamente si lo deja vacío' })
      }) +
      '</div>' +
      UI.campo({
        label: 'Observaciones', name: 'nota',
        control: UI.textarea('nota', '', 'Opcional')
      }) +
      '<div class="btn-row"><button class="btn btn--primary" type="submit">Guardar pago</button>' +
      '<a class="btn" href="#/pagos">Cancelar</a></div>' +
      '</form>' +
      '<div id="panel-cuenta"></div>' +
      '</div>'
    );

    var form = UI.$('#form-pago');
    var selNino = form.elements.ninoId, selConcepto = form.elements.concepto;
    var inPeriodo = form.elements.periodo, inValor = form.elements.valor;

    function refrescarPanel() {
      var panel = UI.$('#panel-cuenta');
      if (!selNino.value) {
        panel.innerHTML = '<div class="card">' + UI.vacio({
          icono: '\u{1F464}', titulo: 'Seleccione un alumno',
          texto: 'Al elegir el alumno se muestra su saldo pendiente y el período más antiguo en mora.'
        }) + '</div>';
        return;
      }
      var c = Dominio.estadoCuenta(selNino.value);
      var mora = c.detalle.filter(function (d) { return d.saldo > 0; });

      panel.innerHTML = '<div class="card">' +
        '<h2>' + U.esc(Dominio.nombreCompleto(c.nino)) + '</h2>' +
        '<p class="muted small">Grupo ' + U.esc(Dominio.nombreGrupo(c.nino.grupoId)) +
        ' · mensualidad ' + U.money(c.nino.valorMensualidad) + '</p>' +
        '<div class="grid grid--3" style="margin:.8rem 0">' +
        UI.stat('Cargado', U.money(c.totalCargado), '', true) +
        UI.stat('Pagado', U.money(c.totalPagado), '', true) +
        UI.stat('Saldo', U.money(c.saldo), c.alDia ? 'Al día' : c.mesesEnMora + ' período(s) en mora', true) +
        '</div>' +
        (mora.length
          ? UI.tabla({
            columnas: [{ titulo: 'Período pendiente' }, { titulo: 'Concepto' }, { titulo: 'Saldo', num: true }],
            filas: mora.map(function (d) {
              return '<tr><td>' + U.fmtPeriodo(d.periodo) + '</td>' +
                '<td>' + U.esc(Dominio.etiquetaConcepto(d.concepto)) + '</td>' +
                '<td class="num nowrap">' + U.money(d.saldo) + '</td></tr>';
            })
          }) + '<div class="btn-row" style="margin-top:.7rem">' +
            '<button type="button" class="btn btn--sm" id="btn-usar-mora">Usar el período más antiguo en mora</button>' +
            '</div>'
          : UI.alerta('ok', 'Este alumno está al día. Un nuevo pago quedará como saldo a favor.')) +
        '</div>';

      var btn = UI.$('#btn-usar-mora');
      if (btn) {
        btn.addEventListener('click', function () {
          var d = mora[0];
          selConcepto.value = d.concepto;
          inPeriodo.value = d.periodo;
          inValor.value = d.saldo;
          UI.toast('Datos del período ' + U.fmtPeriodo(d.periodo) + ' cargados en el formulario.', 'ok');
        });
      }
    }

    function sugerirValor() {
      if (!selNino.value) return;
      var n = Dominio.nino(selNino.value);
      if (!inValor.value) {
        inValor.value = selConcepto.value === 'Matricula' ? n.valorMatricula : n.valorMensualidad;
      }
    }

    selNino.addEventListener('change', function () { inValor.value = ''; refrescarPanel(); sugerirValor(); });
    selConcepto.addEventListener('change', function () { inValor.value = ''; sugerirValor(); });
    refrescarPanel();
    sugerirValor();

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var d = UI.leerForm(form);
      var r = Dominio.registrarPago(d, u);
      if (!r.ok) {
        if (r.errores) UI.pintarErrores(form, r.errores);
        else UI.toast(r.mensaje, 'danger');
        return;
      }
      (r.avisos || []).forEach(function (a) { UI.toast(a, 'warn'); });
      UI.toast('Pago registrado. Nuevo saldo: ' + U.money(r.cuenta.saldo) + '.', 'ok');
      App.ir('#/pagos/comprobante/' + r.pago.id);
    });
  };

  /* ============================================================
     Estado de cuenta de un alumno (RF-10 / RF-11)
     ============================================================ */

  Vistas.estadoCuenta = function (ctx) {
    var u = Auth.exigir('pagos.ver');
    var n = Dominio.exigirVerNino(u, Dominio.nino(ctx.params[0]));

    UI.montar(
      UI.pageHead({
        titulo: 'Estado de cuenta',
        desc: U.esc(Dominio.nombreCompleto(n)) + ' · grupo ' +
          U.esc(Dominio.nombreGrupo(n.grupoId)) + ' · ' + UI.badgeEstado(n.estado),
        acciones: '<a class="btn" href="#/pagos">Volver</a>' +
          (Auth.puede('pagos.gestionar')
            ? '<a class="btn btn--primary" href="#/pagos/nuevo/' + n.id + '">Registrar pago</a>' : '')
      }) +
      Vistas.bloqueEstadoCuenta(n, u)
    );
  };

  /* Bloque reutilizable: ficha del niño, portal del acudiente y estado de cuenta */
  Vistas.bloqueEstadoCuenta = function (n, u) {
    var c = Dominio.estadoCuenta(n.id);

    if (!c.cargos.length) {
      return '<div class="card card--flush"><div class="card__head">' +
        '<h2>Estado de cuenta</h2></div>' +
        UI.vacio({
          icono: '\u{1F4C4}',
          titulo: 'Sin cargos generados',
          texto: n.estado === ESTADOS.PENDIENTE
            ? 'La matrícula está pendiente de aprobación: el sistema genera los cargos de ' +
              'matrícula y mensualidad cuando el administrador la aprueba.'
            : 'Esta matrícula no tiene cargos asociados.'
        }) + '</div>';
    }

    var html = '<div class="grid grid--4" style="margin-bottom:1.1rem">' +
      UI.stat('Total cargado', U.money(c.totalCargado), 'matrícula + mensualidades', true) +
      UI.stat('Total pagado', U.money(c.totalPagado), c.pagos.length + ' pago(s)', true) +
      UI.stat('Saldo', U.money(c.saldo), UI.badgeSaldo(c.saldo), true) +
      UI.stat('Períodos en mora', c.mesesEnMora, c.alDia ? 'Sin deuda' : 'Requieren pago') +
      '</div>';

    html += '<div class="card card--flush"><div class="card__head">' +
      '<h2>Detalle por período</h2></div>' +
      UI.tabla({
        columnas: [{ titulo: 'Período' }, { titulo: 'Concepto' }, { titulo: 'Cargado', num: true },
          { titulo: 'Pagado', num: true }, { titulo: 'Saldo', num: true }],
        filas: c.detalle.map(function (d) {
          return '<tr><td class="nowrap">' + U.fmtPeriodo(d.periodo) + '</td>' +
            '<td>' + U.esc(Dominio.etiquetaConcepto(d.concepto)) + '</td>' +
            '<td class="num nowrap">' + U.money(d.cargado) + '</td>' +
            '<td class="num nowrap">' + U.money(d.pagado) + '</td>' +
            '<td class="num nowrap">' + (d.saldo > 0
              ? '<span class="badge badge--danger">' + U.money(d.saldo) + '</span>'
              : '<span class="badge badge--ok">Pagado</span>') + '</td></tr>';
        })
      }) + '</div>';

    html += '<div class="card card--flush"><div class="card__head">' +
      '<h2>Historial de pagos</h2></div>' +
      UI.tabla({
        columnas: [{ titulo: 'Fecha' }, { titulo: 'Concepto' }, { titulo: 'Período' },
          { titulo: 'Medio' }, { titulo: 'Valor', num: true }, { titulo: '' }],
        filas: c.pagos.map(function (p) {
          return '<tr><td class="nowrap">' + U.fmtFecha(p.fecha) + '</td>' +
            '<td>' + U.esc(Dominio.etiquetaConcepto(p.concepto)) + '</td>' +
            '<td class="nowrap">' + U.fmtPeriodo(p.periodo) + '</td>' +
            '<td class="small">' + U.esc(p.medio) + '<div class="cell-sub mono">' +
            U.esc(p.referencia) + '</div></td>' +
            '<td class="num nowrap">' + U.money(p.valor) + '</td>' +
            '<td><a class="btn btn--sm" href="#/pagos/comprobante/' + p.id + '">Comprobante</a></td></tr>';
        }),
        vacio: {
          icono: '\u{1F9FE}', titulo: 'Sin pagos registrados',
          texto: 'Todavía no se ha registrado ningún pago para este alumno.'
        }
      }) + '</div>';

    return html;
  };

  /* ============================================================
     Comprobante de pago (RF-11)
     ============================================================ */

  Vistas.comprobante = function (ctx) {
    var u = Auth.actual();
    if (!u) throw new Auth.AccesoDenegado('Su sesión no es válida o ha expirado.');

    var p = Dominio.pago(ctx.params[0]);
    if (!p) {
      UI.montar('<div class="card">' + UI.vacio({
        icono: '\u{1F50E}', titulo: 'Comprobante no encontrado',
        texto: 'El pago solicitado no existe o fue anulado.',
        accion: '<a class="btn" href="#/pagos">Volver a pagos</a>'
      }) + '</div>');
      return;
    }

    var n = Dominio.exigirVerNino(u, Dominio.nino(p.ninoId));
    if (u.rol !== ROLES.ACUDIENTE) Auth.exigir('pagos.ver');

    var gua = Dominio.guarderia(n.guarderiaId);
    var cuenta = Dominio.estadoCuenta(n.id);
    var volver = u.rol === ROLES.ACUDIENTE ? '#/portal' : '#/pagos';

    UI.montar(
      '<div class="page-head no-print"><div class="page-head__text">' +
      '<h1>Comprobante de pago</h1></div>' +
      '<div class="page-head__actions">' +
      '<a class="btn" href="' + volver + '">Volver</a>' +
      '<button class="btn btn--primary" id="btn-imprimir">Imprimir / guardar PDF</button>' +
      (Auth.puede('pagos.gestionar')
        ? '<button class="btn btn--danger" id="btn-anular">Anular pago</button>' : '') +
      '</div></div>' +

      '<div class="card receipt">' +
      '<div class="receipt__head">' +
      '<div><h2>' + U.esc(gua ? gua.nombre : 'Guardería') + '</h2>' +
      '<div class="small muted">' + U.esc(gua ? gua.sede : '') + '<br>NIT ' +
      U.esc(gua ? gua.nit : '--') + ' · Tel. ' + U.esc(gua ? gua.telefono : '--') + '</div></div>' +
      '<div style="text-align:right"><div class="badge badge--brand">Comprobante</div>' +
      '<div class="receipt__num">' + U.esc(p.referencia) + '</div>' +
      '<div class="small muted">' + U.fmtFechaLarga(p.fecha) + '</div></div>' +
      '</div>' +

      '<dl class="dl">' +
      '<dt>Alumno</dt><dd>' + U.esc(Dominio.nombreCompleto(n)) + '</dd>' +
      '<dt>Grupo</dt><dd>' + U.esc(Dominio.nombreGrupo(n.grupoId)) + '</dd>' +
      '<dt>Acudiente</dt><dd>' + U.esc((n.acudientes[0] || {}).nombre || '--') + '</dd>' +
      '<dt>Concepto</dt><dd>' + U.esc(Dominio.etiquetaConcepto(p.concepto)) + '</dd>' +
      '<dt>Período</dt><dd>' + U.fmtPeriodo(p.periodo) + '</dd>' +
      '<dt>Medio de pago</dt><dd>' + U.esc(p.medio) + '</dd>' +
      '<dt>Fecha de pago</dt><dd>' + U.fmtFechaLarga(p.fecha) + '</dd>' +
      '<dt>Registrado por</dt><dd>' + U.esc(p.registradoPorNombre) + '</dd>' +
      (p.nota ? '<dt>Observaciones</dt><dd>' + U.esc(p.nota) + '</dd>' : '') +
      '</dl>' +

      '<div class="receipt__total"><span>Valor pagado</span><span>' + U.money(p.valor) + '</span></div>' +
      '<p class="small muted" style="margin-top:.8rem">Saldo del alumno a la fecha: <strong>' +
      U.money(cuenta.saldo) + '</strong>' +
      (cuenta.saldo > 0 ? ' (' + cuenta.mesesEnMora + ' período(s) pendiente(s))' : ' — al día') +
      '.<br>Documento generado por el sistema de gestión de la guardería.</p>' +
      '</div>'
    );

    UI.$('#btn-imprimir').addEventListener('click', UI.imprimir);
    var anular = UI.$('#btn-anular');
    if (anular) {
      anular.addEventListener('click', function () {
        UI.confirmar({
          titulo: 'Anular pago',
          mensaje: '¿Anular el pago <strong>' + U.esc(p.referencia) + '</strong> por ' +
            U.money(p.valor) + '? El saldo del alumno se recalculará.',
          textoOk: 'Anular', claseOk: 'btn--danger',
          onOk: function () {
            var r = Dominio.anularPago(p.id, u);
            if (!r.ok) { UI.toast(r.mensaje, 'danger'); return true; }
            UI.cerrarModal();
            UI.toast('Pago anulado.', 'ok');
            App.ir('#/pagos/estado/' + n.id);
            return true;
          }
        });
      });
    }
  };
})(window);
