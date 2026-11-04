/* ============================================================
   domain.js - Reglas de negocio del sistema de guarderías
   Implementa RF-01 a RF-18. Ninguna vista escribe directamente
   en Store: todo cambio de estado pasa por estas funciones para
   que quede validado y auditado (RNF-02).
   Expone el objeto global Dominio
   ============================================================ */
(function (global) {
  'use strict';

  var Dominio = {

    /* ============================================================
       Consultas básicas
       ============================================================ */

    guarderia: function (id) { return Store.get('guarderias', id); },

    grupo: function (id) { return id ? Store.get('grupos', id) : null; },

    gruposDe: function (guarderiaId) {
      return U.sortBy(
        Store.where('grupos', function (g) { return g.guarderiaId === guarderiaId; }),
        function (g) { return g.edadMinMeses; }
      );
    },

    nino: function (id) { return Store.get('ninos', id); },

    nombreCompleto: function (n) {
      return n ? (n.nombres + ' ' + n.apellidos) : '--';
    },

    edadMeses: function (n) { return n ? U.mesesEdad(n.fechaNacimiento) : null; },

    nombreGrupo: function (grupoId) {
      var g = Dominio.grupo(grupoId);
      return g ? g.nombre : 'Sin grupo';
    },

    /* ============================================================
       Alcance de la información por rol
       RF-02 (docente limitado a su grupo/guardería)
       RF-14 (acudiente limitado a sus menores vinculados)
       ============================================================ */

    ninosVisibles: function (usuario) {
      if (!usuario) return [];
      var todos = Store.all('ninos');

      if (usuario.rol === ROLES.ACUDIENTE) {
        return U.sortBy(todos.filter(function (n) {
          return Dominio.esAcudienteDe(usuario, n);
        }), Dominio.nombreCompleto);
      }

      var deSuGuarderia = todos.filter(function (n) {
        return n.guarderiaId === usuario.guarderiaId;
      });

      if (usuario.rol === ROLES.DOCENTE) {
        if (!usuario.grupoId) return [];       // docente sin grupo asignado
        return U.sortBy(deSuGuarderia.filter(function (n) {
          return n.grupoId === usuario.grupoId && n.estado !== ESTADOS.RECHAZADA;
        }), Dominio.nombreCompleto);
      }

      return U.sortBy(deSuGuarderia, Dominio.nombreCompleto);
    },

    esAcudienteDe: function (usuario, nino) {
      if (!usuario || !nino || usuario.rol !== ROLES.ACUDIENTE) return false;
      var doc = U.soloDigitos(usuario.documento);
      return (nino.acudientes || []).some(function (a) {
        return U.soloDigitos(a.documento) === doc ||
          (a.email && usuario.email &&
            a.email.toLowerCase() === usuario.email.toLowerCase());
      });
    },

    /* Autorización a nivel de registro: ¿este usuario puede ver a este niño? */
    puedeVerNino: function (usuario, nino) {
      if (!usuario || !nino) return false;
      if (usuario.rol === ROLES.ACUDIENTE) return Dominio.esAcudienteDe(usuario, nino);
      if (nino.guarderiaId !== usuario.guarderiaId) return false;
      if (usuario.rol === ROLES.DOCENTE) return !!usuario.grupoId && nino.grupoId === usuario.grupoId;
      return true;
    },

    /* Igual que el anterior, pero lanza AccesoDenegado con el motivo */
    exigirVerNino: function (usuario, nino) {
      if (!nino) throw new Auth.AccesoDenegado('El niño solicitado no existe o no está disponible.');
      if (!Dominio.puedeVerNino(usuario, nino)) {
        Store.log('Acceso denegado a ficha de niño', 'Niño: ' + nino.id, usuario);
        var msg = usuario.rol === ROLES.ACUDIENTE
          ? 'Solo puede consultar la información de los menores vinculados a su cuenta.'
          : usuario.rol === ROLES.DOCENTE
            ? 'Solo puede consultar los niños del grupo que tiene asignado.'
            : 'Este niño no pertenece a su guardería.';
        throw new Auth.AccesoDenegado(msg);
      }
      return nino;
    },

    /* ============================================================
       HU-05 - Grupos etarios
       RF-16 (crear grupos con rango y capacidad)
       RF-17 (clasificación automática por fecha de nacimiento)
       ============================================================ */

    /* Niños que ocupan cupo: matrícula activa o pendiente */
    ocupacion: function (grupoId) {
      return Store.count('ninos', function (n) {
        return n.grupoId === grupoId &&
          (n.estado === ESTADOS.ACTIVA || n.estado === ESTADOS.PENDIENTE);
      });
    },

    cupoDisponible: function (grupoId) {
      var g = Dominio.grupo(grupoId);
      if (!g) return 0;
      return Math.max(0, g.capacidad - Dominio.ocupacion(grupoId));
    },

    /* Rango semiabierto [min, max): un niño de 24 meses entra a Párvulos
       (24-36) y ya no a Caminadores (12-24). Así los bordes no se solapan. */
    grupoCorrespondeEdad: function (grupo, meses) {
      return meses >= grupo.edadMinMeses && meses < grupo.edadMaxMeses;
    },

    /* RF-17: devuelve el grupo sugerido para una fecha de nacimiento */
    grupoSugerido: function (fechaNacimiento, guarderiaId) {
      var meses = U.mesesEdad(fechaNacimiento);
      if (meses === null) return { grupo: null, motivo: 'sin-fecha', meses: null };

      var candidatos = Dominio.gruposDe(guarderiaId).filter(function (g) {
        return Dominio.grupoCorrespondeEdad(g, meses);
      });
      if (!candidatos.length) return { grupo: null, motivo: 'sin-rango', meses: meses };

      var conCupo = candidatos.filter(function (g) { return Dominio.cupoDisponible(g.id) > 0; });
      if (!conCupo.length) return { grupo: candidatos[0], motivo: 'sin-cupo', meses: meses };

      return { grupo: conCupo[0], motivo: 'ok', meses: meses };
    },

    /* RF-16 + AC2/AC4 de HU-05 */
    validarGrupo: function (data, idExistente) {
      var e = {};
      var min = Number(data.edadMinMeses);
      var max = Number(data.edadMaxMeses);
      var cap = Number(data.capacidad);

      if (!U.noVacio(data.nombre)) e.nombre = 'El nombre del grupo es obligatorio.';
      else {
        var repetido = Store.first('grupos', function (g) {
          return g.guarderiaId === data.guarderiaId && g.id !== idExistente &&
            U.norm(g.nombre) === U.norm(data.nombre);
        });
        if (repetido) e.nombre = 'Ya existe un grupo con ese nombre en la guardería.';
      }

      if (isNaN(min) || min < 0) e.edadMinMeses = 'Indique la edad mínima en meses (0 o más).';
      if (isNaN(max) || max <= 0) e.edadMaxMeses = 'Indique la edad máxima en meses.';
      if (!e.edadMinMeses && !e.edadMaxMeses && min >= max) {
        e.edadMinMeses = 'La edad mínima debe ser menor que la edad máxima.';
        e.edadMaxMeses = 'La edad máxima debe ser mayor que la edad mínima.';
      }
      if (isNaN(cap) || cap < 1) e.capacidad = 'La capacidad máxima debe ser al menos 1.';

      if (idExistente && !e.capacidad) {
        var ocupados = Dominio.ocupacion(idExistente);
        if (cap < ocupados) {
          e.capacidad = 'El grupo ya tiene ' + ocupados +
            ' niños; la capacidad no puede ser menor.';
        }
      }

      return { ok: Object.keys(e).length === 0, errores: e };
    },

    guardarGrupo: function (data, idExistente, usuario) {
      Auth.exigir('grupos.gestionar');
      var v = Dominio.validarGrupo(data, idExistente);
      if (!v.ok) return { ok: false, errores: v.errores };

      var limpio = {
        guarderiaId: data.guarderiaId,
        nombre: String(data.nombre).trim(),
        edadMinMeses: Number(data.edadMinMeses),
        edadMaxMeses: Number(data.edadMaxMeses),
        capacidad: Number(data.capacidad),
        salon: String(data.salon || '').trim()
      };

      var grupo;
      if (idExistente) {
        grupo = Store.update('grupos', idExistente, limpio);
        Store.log('Grupo actualizado', grupo.nombre + ' (' +
          U.rangoTexto(grupo.edadMinMeses, grupo.edadMaxMeses) + ', cap. ' + grupo.capacidad + ')', usuario);
      } else {
        limpio.id = U.uid('gru');
        limpio.creadoEn = U.ahora();
        grupo = Store.insert('grupos', limpio);
        Store.log('Grupo creado', grupo.nombre + ' (' +
          U.rangoTexto(grupo.edadMinMeses, grupo.edadMaxMeses) + ', cap. ' + grupo.capacidad + ')', usuario);
      }
      return { ok: true, grupo: grupo };
    },

    eliminarGrupo: function (grupoId, usuario) {
      Auth.exigir('grupos.gestionar');
      var g = Dominio.grupo(grupoId);
      if (!g) return { ok: false, mensaje: 'El grupo no existe.' };
      if (Store.count('ninos', function (n) { return n.grupoId === grupoId; }) > 0) {
        return { ok: false, mensaje: 'No se puede eliminar: el grupo tiene niños asociados.' };
      }
      var docentes = Dominio.docentesDeGrupo(grupoId);
      if (docentes.length) {
        return { ok: false, mensaje: 'No se puede eliminar: hay ' + docentes.length + ' docente(s) asignado(s).' };
      }
      Store.remove('grupos', grupoId);
      Store.log('Grupo eliminado', g.nombre, usuario);
      return { ok: true };
    },

    /* Reclasifica un niño en el grupo que corresponde a su edad (RF-17) */
    reclasificar: function (ninoId, usuario) {
      Auth.exigir('matricula.editar');
      var n = Dominio.nino(ninoId);
      if (!n) return { ok: false, mensaje: 'El niño no existe.' };
      var sug = Dominio.grupoSugerido(n.fechaNacimiento, n.guarderiaId);
      if (!sug.grupo) {
        return { ok: false, mensaje: 'No hay un grupo cuyo rango de edad corresponda (' +
          U.edadTexto(sug.meses) + '). Cree o ajuste un grupo.' };
      }
      if (sug.grupo.id === n.grupoId) {
        return { ok: true, sinCambios: true, grupo: sug.grupo };
      }
      if (sug.motivo === 'sin-cupo') {
        return { ok: false, mensaje: 'El grupo ' + sug.grupo.nombre + ' ya alcanzó su capacidad máxima.' };
      }
      var anterior = Dominio.nombreGrupo(n.grupoId);
      Store.update('ninos', ninoId, { grupoId: sug.grupo.id });
      Store.log('Reclasificación de grupo',
        Dominio.nombreCompleto(n) + ': ' + anterior + ' -> ' + sug.grupo.nombre +
        ' (edad ' + U.edadTexto(sug.meses) + ')', usuario);
      return { ok: true, grupo: sug.grupo, anterior: anterior };
    },

    /* ============================================================
       HU-02 - Matrícula
       RF-04 (datos mínimos y 1 a 3 acudientes), RF-05 (info médica),
       RF-06 (solo Administrador aprueba), RF-07 (documento válido),
       RF-08 (estado con fecha de cambio)
       ============================================================ */

    MAX_ACUDIENTES: 3,

    validarMatricula: function (data, idExistente) {
      var e = {};
      var avisos = [];

      if (!U.noVacio(data.nombres)) e.nombres = 'Los nombres son obligatorios.';
      if (!U.noVacio(data.apellidos)) e.apellidos = 'Los apellidos son obligatorios.';

      if (!U.noVacio(data.fechaNacimiento)) {
        e.fechaNacimiento = 'La fecha de nacimiento es obligatoria.';
      } else if (data.fechaNacimiento > U.hoy()) {
        e.fechaNacimiento = 'La fecha de nacimiento no puede ser futura.';
      }

      /* --- Acudientes: entre 1 y 3 (RF-04) --- */
      var acs = (data.acudientes || []).filter(function (a) {
        return U.noVacio(a.nombre) || U.noVacio(a.documento);
      });
      if (acs.length < 1) {
        e.acudientes = 'Debe registrar al menos un acudiente autorizado.';
      } else if (acs.length > Dominio.MAX_ACUDIENTES) {
        e.acudientes = 'No se permiten más de ' + Dominio.MAX_ACUDIENTES + ' acudientes autorizados.';
      } else {
        /* RF-07: al menos un acudiente con documento de identidad válido */
        var conDocumento = acs.filter(function (a) { return U.documentoValido(a.documento); });
        if (!conDocumento.length) {
          e.acudientes = 'Al menos un acudiente debe tener un documento de identidad válido ' +
            '(entre 6 y 12 dígitos).';
        }
        var docs = {};
        acs.forEach(function (a, i) {
          var d = U.soloDigitos(a.documento);
          if (!U.noVacio(a.nombre)) e['acudiente' + i + 'Nombre'] = 'Nombre obligatorio.';
          if (!U.noVacio(a.parentesco)) e['acudiente' + i + 'Parentesco'] = 'Indique el parentesco.';
          if (!U.telefonoValido(a.telefono)) e['acudiente' + i + 'Telefono'] = 'Teléfono inválido.';
          if (d && docs[d]) e['acudiente' + i + 'Documento'] = 'Documento repetido entre acudientes.';
          if (d && !U.documentoValido(d)) e['acudiente' + i + 'Documento'] = 'Documento inválido (6 a 12 dígitos).';
          if (d) docs[d] = true;
          if (U.noVacio(a.email) && !U.emailValido(a.email)) {
            e['acudiente' + i + 'Email'] = 'Correo inválido.';
          }
        });
      }

      /* --- Contacto de emergencia (RF-04) --- */
      var ce = data.contactoEmergencia || {};
      if (!U.noVacio(ce.nombre)) e.emergenciaNombre = 'El contacto de emergencia es obligatorio.';
      if (!U.telefonoValido(ce.telefono)) e.emergenciaTelefono = 'Teléfono de emergencia inválido.';

      /* --- Información médica obligatoria (RF-05) --- */
      var med = data.medica || {};
      if (!U.noVacio(med.eps)) e.medEps = 'Indique la EPS o entidad de salud.';
      if (!U.noVacio(med.alergias)) {
        e.medAlergias = 'Campo obligatorio. Escriba "Ninguna" si no aplica.';
      }
      if (!U.noVacio(med.condiciones)) {
        e.medCondiciones = 'Campo obligatorio. Escriba "Ninguna" si no aplica.';
      }

      /* --- Grupo y cupo (AC4 de HU-05) --- */
      if (!U.noVacio(data.grupoId)) {
        e.grupoId = 'Seleccione el grupo del niño.';
      } else {
        var g = Dominio.grupo(data.grupoId);
        if (!g) e.grupoId = 'El grupo seleccionado no existe.';
        else {
          var ocupados = Dominio.ocupacion(data.grupoId);
          var yaEstaba = idExistente ? (Dominio.nino(idExistente) || {}).grupoId === data.grupoId : false;
          if (!yaEstaba && ocupados >= g.capacidad) {
            e.grupoId = 'El grupo ' + g.nombre + ' ya alcanzó su capacidad máxima (' +
              g.capacidad + ').';
          }
          var meses = U.mesesEdad(data.fechaNacimiento);
          if (meses !== null && !Dominio.grupoCorrespondeEdad(g, meses)) {
            avisos.push('La edad del niño (' + U.edadTexto(meses) + ') no corresponde al rango del grupo ' +
              g.nombre + ' (' + U.rangoTexto(g.edadMinMeses, g.edadMaxMeses) + ').');
          }
        }
      }

      /* --- Valores --- */
      if (isNaN(Number(data.valorMatricula)) || Number(data.valorMatricula) < 0) {
        e.valorMatricula = 'Valor de matrícula inválido.';
      }
      if (isNaN(Number(data.valorMensualidad)) || Number(data.valorMensualidad) <= 0) {
        e.valorMensualidad = 'Valor de mensualidad inválido.';
      }

      return { ok: Object.keys(e).length === 0, errores: e, avisos: avisos };
    },

    normalizarMatricula: function (data) {
      return {
        guarderiaId: data.guarderiaId,
        grupoId: data.grupoId,
        nombres: String(data.nombres).trim(),
        apellidos: String(data.apellidos).trim(),
        genero: data.genero || '',
        fechaNacimiento: data.fechaNacimiento,
        acudientes: (data.acudientes || []).filter(function (a) {
          return U.noVacio(a.nombre) || U.noVacio(a.documento);
        }).map(function (a) {
          return {
            nombre: String(a.nombre).trim(),
            tipoDoc: a.tipoDoc || 'CC',
            documento: U.soloDigitos(a.documento),
            parentesco: String(a.parentesco || '').trim(),
            telefono: String(a.telefono || '').trim(),
            email: String(a.email || '').trim()
          };
        }),
        contactoEmergencia: {
          nombre: String((data.contactoEmergencia || {}).nombre || '').trim(),
          telefono: String((data.contactoEmergencia || {}).telefono || '').trim(),
          parentesco: String((data.contactoEmergencia || {}).parentesco || '').trim()
        },
        medica: {
          eps: String((data.medica || {}).eps || '').trim(),
          alergias: String((data.medica || {}).alergias || '').trim(),
          condiciones: String((data.medica || {}).condiciones || '').trim(),
          medicamentos: String((data.medica || {}).medicamentos || '').trim(),
          observaciones: String((data.medica || {}).observaciones || '').trim()
        },
        valorMatricula: Number(data.valorMatricula),
        valorMensualidad: Number(data.valorMensualidad)
      };
    },

    crearMatricula: function (data, usuario) {
      Auth.exigir('matricula.crear');
      var v = Dominio.validarMatricula(data, null);
      if (!v.ok) return { ok: false, errores: v.errores, avisos: v.avisos };

      var limpio = Dominio.normalizarMatricula(data);
      limpio.id = U.uid('nin');
      limpio.estado = ESTADOS.PENDIENTE;
      limpio.fechaIngreso = null;
      limpio.fechaRetiro = null;
      limpio.creadoEn = U.ahora();
      limpio.historial = [{
        estado: ESTADOS.PENDIENTE,
        fecha: U.ahora(),
        usuarioNombre: usuario.nombre,
        rol: usuario.rol,
        nota: 'Solicitud de matrícula registrada'
      }];

      var nino = Store.insert('ninos', limpio);
      Store.log('Matrícula registrada',
        Dominio.nombreCompleto(nino) + ' - estado ' + ESTADOS.PENDIENTE, usuario);
      return { ok: true, nino: nino, avisos: v.avisos };
    },

    actualizarMatricula: function (id, data, usuario) {
      Auth.exigir('matricula.editar');
      var actual = Dominio.nino(id);
      if (!actual) return { ok: false, mensaje: 'La matrícula no existe.' };
      var v = Dominio.validarMatricula(data, id);
      if (!v.ok) return { ok: false, errores: v.errores, avisos: v.avisos };

      var limpio = Dominio.normalizarMatricula(data);
      var cambioGrupo = limpio.grupoId !== actual.grupoId;
      var nino = Store.update('ninos', id, limpio);
      Store.log('Matrícula actualizada',
        Dominio.nombreCompleto(nino) + (cambioGrupo
          ? ' - grupo: ' + Dominio.nombreGrupo(actual.grupoId) + ' -> ' + Dominio.nombreGrupo(limpio.grupoId)
          : ''), usuario);
      return { ok: true, nino: nino, avisos: v.avisos };
    },

    transicionesPermitidas: function (estado) {
      switch (estado) {
        case ESTADOS.PENDIENTE: return [ESTADOS.ACTIVA, ESTADOS.RECHAZADA];
        case ESTADOS.ACTIVA: return [ESTADOS.RETIRADA];
        case ESTADOS.RETIRADA: return [ESTADOS.ACTIVA];
        case ESTADOS.RECHAZADA: return [ESTADOS.PENDIENTE];
        default: return [];
      }
    },

    /* RF-06 + RF-08 + RNF-02: cambio de estado auditado con fecha */
    cambiarEstado: function (ninoId, nuevoEstado, nota, usuario) {
      /* Aprobar o rechazar solo lo puede hacer un Administrador */
      if (nuevoEstado === ESTADOS.ACTIVA || nuevoEstado === ESTADOS.RECHAZADA) {
        Auth.exigir('matricula.aprobar');
      } else {
        Auth.exigir('matricula.editar');
      }

      var n = Dominio.nino(ninoId);
      if (!n) return { ok: false, mensaje: 'La matrícula no existe.' };
      if (n.estado === nuevoEstado) {
        return { ok: false, mensaje: 'La matrícula ya se encuentra en estado ' + nuevoEstado + '.' };
      }
      if (Dominio.transicionesPermitidas(n.estado).indexOf(nuevoEstado) === -1) {
        return { ok: false, mensaje: 'Transición no permitida: ' + n.estado + ' -> ' + nuevoEstado + '.' };
      }
      if (nuevoEstado === ESTADOS.ACTIVA) {
        var g = Dominio.grupo(n.grupoId);
        if (!g) return { ok: false, mensaje: 'Asigne un grupo antes de activar la matrícula.' };
        var ocupados = Store.count('ninos', function (x) {
          return x.grupoId === n.grupoId && x.id !== n.id && x.estado === ESTADOS.ACTIVA;
        });
        if (ocupados >= g.capacidad) {
          return { ok: false, mensaje: 'El grupo ' + g.nombre + ' alcanzó su capacidad máxima (' +
            g.capacidad + '). No es posible activar la matrícula.' };
        }
      }

      var patch = { estado: nuevoEstado };
      if (nuevoEstado === ESTADOS.ACTIVA && !n.fechaIngreso) patch.fechaIngreso = U.hoy();
      if (nuevoEstado === ESTADOS.ACTIVA) patch.fechaRetiro = null;
      if (nuevoEstado === ESTADOS.RETIRADA) patch.fechaRetiro = U.hoy();

      var hist = (n.historial || []).slice();
      hist.push({
        estado: nuevoEstado,
        fecha: U.ahora(),
        usuarioNombre: usuario.nombre,
        rol: usuario.rol,
        nota: U.noVacio(nota) ? String(nota).trim() : Dominio.notaPorDefecto(nuevoEstado)
      });
      patch.historial = hist;

      var nino = Store.update('ninos', ninoId, patch);
      Store.log('Cambio de estado de matrícula',
        Dominio.nombreCompleto(nino) + ': ' + n.estado + ' -> ' + nuevoEstado, usuario);
      return { ok: true, nino: nino };
    },

    notaPorDefecto: function (estado) {
      switch (estado) {
        case ESTADOS.ACTIVA: return 'Matrícula aprobada';
        case ESTADOS.RECHAZADA: return 'Matrícula rechazada';
        case ESTADOS.RETIRADA: return 'Niño retirado de la guardería';
        default: return 'Cambio de estado';
      }
    },

    /* ============================================================
       HU-06 - Asignación de docentes
       RF-18: un grupo puede tener varios docentes, pero cada
       docente pertenece exactamente a un grupo.
       ============================================================ */

    docentesDe: function (guarderiaId) {
      return U.sortBy(Store.where('usuarios', function (u) {
        return u.rol === ROLES.DOCENTE && u.guarderiaId === guarderiaId;
      }), function (u) { return U.norm(u.nombre); });
    },

    docentesDeGrupo: function (grupoId) {
      return Store.where('usuarios', function (u) {
        return u.rol === ROLES.DOCENTE && u.grupoId === grupoId;
      });
    },

    asignarDocente: function (docenteId, grupoId, usuario) {
      Auth.exigir('docentes.asignar');
      var d = Store.get('usuarios', docenteId);
      if (!d || d.rol !== ROLES.DOCENTE) return { ok: false, mensaje: 'El docente no existe.' };

      if (!grupoId) {   // quitar asignación
        var previo = Dominio.nombreGrupo(d.grupoId);
        Store.update('usuarios', docenteId, { grupoId: null });
        Store.log('Docente sin grupo', d.nombre + ' retirado de ' + previo, usuario);
        return { ok: true, docente: Store.get('usuarios', docenteId), anterior: previo };
      }

      var g = Dominio.grupo(grupoId);
      if (!g) return { ok: false, mensaje: 'El grupo no existe.' };
      if (g.guarderiaId !== d.guarderiaId) {
        return { ok: false, mensaje: 'El docente y el grupo pertenecen a guarderías distintas.' };
      }
      if (d.grupoId === grupoId) {
        return { ok: false, mensaje: d.nombre + ' ya está asignado a ' + g.nombre + '.' };
      }

      var anterior = d.grupoId ? Dominio.nombreGrupo(d.grupoId) : null;
      /* AC2: al asignar un grupo nuevo se reemplaza el anterior, de modo
         que el docente nunca queda con dos grupos a la vez. */
      Store.update('usuarios', docenteId, { grupoId: grupoId });
      Store.log('Asignación docente-grupo',
        d.nombre + ': ' + (anterior || 'sin grupo') + ' -> ' + g.nombre, usuario);
      return { ok: true, docente: Store.get('usuarios', docenteId), grupo: g, anterior: anterior };
    },

    /* ============================================================
       HU-03 - Pagos y estado de cuenta
       RF-09 (registro), RF-10 (actualiza saldo), RF-11 (historial y
       comprobante), RF-12 (restricción por permiso)
       ============================================================ */

    /* Cargos esperados de un niño: matrícula (una vez) + una
       mensualidad por cada mes desde su ingreso hasta hoy o su retiro. */
    cargosDe: function (nino) {
      if (!nino || !nino.fechaIngreso) return [];
      if (nino.estado === ESTADOS.PENDIENTE || nino.estado === ESTADOS.RECHAZADA) return [];

      var desde = U.periodoDe(nino.fechaIngreso);
      var tope = U.periodoActual();
      if (nino.fechaRetiro) {
        var pr = U.periodoDe(nino.fechaRetiro);
        if (U.difMeses(pr, tope) > 0) tope = pr;
      }

      var cargos = [{
        concepto: 'Matricula',
        periodo: desde,
        valor: Number(nino.valorMatricula) || 0,
        descripcion: 'Matrícula ' + U.fmtPeriodo(desde)
      }];

      U.periodosEntre(desde, tope).forEach(function (p) {
        cargos.push({
          concepto: 'Mensualidad',
          periodo: p,
          valor: Number(nino.valorMensualidad) || 0,
          descripcion: 'Mensualidad ' + U.fmtPeriodo(p)
        });
      });
      return cargos;
    },

    pagosDe: function (ninoId, periodo) {
      var lista = Store.where('pagos', function (p) {
        return p.ninoId === ninoId && (!periodo || p.periodo === periodo);
      });
      return U.sortBy(lista, function (p) { return p.fecha + p.id; }).reverse();
    },

    pago: function (id) { return Store.get('pagos', id); },

    /* RF-10: saldo pendiente = cargos - pagos */
    estadoCuenta: function (ninoId) {
      var nino = Dominio.nino(ninoId);
      var cargos = Dominio.cargosDe(nino);
      var pagos = Dominio.pagosDe(ninoId);

      var totalCargado = U.sum(cargos, function (c) { return c.valor; });
      var totalPagado = U.sum(pagos, function (p) { return Number(p.valor) || 0; });

      /* Detalle por periodo + concepto */
      var mapa = {};
      cargos.forEach(function (c) {
        var k = c.periodo + '|' + c.concepto;
        mapa[k] = mapa[k] || { periodo: c.periodo, concepto: c.concepto, cargado: 0, pagado: 0 };
        mapa[k].cargado += c.valor;
      });
      pagos.forEach(function (p) {
        var k = p.periodo + '|' + p.concepto;
        mapa[k] = mapa[k] || { periodo: p.periodo, concepto: p.concepto, cargado: 0, pagado: 0 };
        mapa[k].pagado += Number(p.valor) || 0;
      });
      var detalle = U.sortBy(Object.keys(mapa).map(function (k) {
        var it = mapa[k];
        it.saldo = it.cargado - it.pagado;
        return it;
      }), function (it) { return it.periodo + (it.concepto === 'Matricula' ? '0' : '1'); });

      var saldo = totalCargado - totalPagado;
      return {
        nino: nino,
        cargos: cargos,
        pagos: pagos,
        detalle: detalle,
        totalCargado: totalCargado,
        totalPagado: totalPagado,
        saldo: saldo,
        alDia: saldo <= 0,
        mesesEnMora: detalle.filter(function (d) { return d.saldo > 0; }).length
      };
    },

    /* RF-09 */
    validarPago: function (data) {
      var e = {};
      var avisos = [];

      if (!U.noVacio(data.ninoId)) e.ninoId = 'Seleccione el alumno.';
      else {
        var n = Dominio.nino(data.ninoId);
        if (!n) e.ninoId = 'El alumno no existe.';
        else if (n.estado === ESTADOS.PENDIENTE || n.estado === ESTADOS.RECHAZADA) {
          e.ninoId = 'No se pueden registrar pagos de una matrícula en estado ' + n.estado + '.';
        }
      }
      if (Seed.CONCEPTOS.indexOf(data.concepto) === -1) e.concepto = 'Seleccione el concepto.';
      if (!/^\d{4}-\d{2}$/.test(String(data.periodo || ''))) e.periodo = 'Indique el período (mes y año).';
      if (!U.noVacio(data.fecha)) e.fecha = 'Indique la fecha del pago.';
      else if (data.fecha > U.hoy()) e.fecha = 'La fecha del pago no puede ser futura.';
      if (isNaN(Number(data.valor)) || Number(data.valor) <= 0) e.valor = 'El valor debe ser mayor que cero.';
      if (Seed.MEDIOS_PAGO.indexOf(data.medio) === -1) e.medio = 'Seleccione el medio de pago.';

      if (Object.keys(e).length === 0) {
        var cuenta = Dominio.estadoCuenta(data.ninoId);
        var linea = cuenta.detalle.filter(function (d) {
          return d.periodo === data.periodo && d.concepto === data.concepto;
        })[0];
        var pendiente = linea ? linea.saldo : 0;
        if (!linea) {
          avisos.push('No hay un cargo de ' + Dominio.etiquetaConcepto(data.concepto) + ' para ' +
            U.fmtPeriodo(data.periodo) + '. El pago quedará como saldo a favor.');
        } else if (Number(data.valor) > pendiente && pendiente > 0) {
          avisos.push('El valor supera el saldo pendiente de ese período (' + U.money(pendiente) + ').');
        } else if (pendiente <= 0) {
          avisos.push('Ese período ya está cancelado; el pago quedará como saldo a favor.');
        }
      }
      return { ok: Object.keys(e).length === 0, errores: e, avisos: avisos };
    },

    /* RF-09 + RF-10 + RF-12 */
    registrarPago: function (data, usuario) {
      Auth.exigir('pagos.gestionar');
      var v = Dominio.validarPago(data);
      if (!v.ok) return { ok: false, errores: v.errores, avisos: v.avisos };

      var nino = Dominio.nino(data.ninoId);
      if (nino.guarderiaId !== usuario.guarderiaId) {
        throw new Auth.AccesoDenegado('El alumno no pertenece a su guardería.');
      }

      var pago = Store.insert('pagos', {
        id: U.uid('pag'),
        ninoId: data.ninoId,
        concepto: data.concepto,
        periodo: data.periodo,
        fecha: data.fecha,
        valor: Number(data.valor),
        medio: data.medio,
        referencia: U.noVacio(data.referencia) ? String(data.referencia).trim()
          : 'REC-' + U.soloDigitos(U.ahora()).slice(-8),
        nota: String(data.nota || '').trim(),
        registradoPorId: usuario.id,
        registradoPorNombre: usuario.nombre,
        creadoEn: U.ahora()
      });

      var cuenta = Dominio.estadoCuenta(data.ninoId);   // saldo ya actualizado (RF-10)
      Store.log('Pago registrado',
        Dominio.nombreCompleto(nino) + ' - ' + Dominio.etiquetaConcepto(pago.concepto) + ' ' +
        U.fmtPeriodo(pago.periodo) + ' por ' + U.money(pago.valor) +
        ' (saldo: ' + U.money(cuenta.saldo) + ')', usuario);

      return { ok: true, pago: pago, cuenta: cuenta, avisos: v.avisos };
    },

    anularPago: function (pagoId, usuario) {
      Auth.exigir('pagos.gestionar');
      var p = Dominio.pago(pagoId);
      if (!p) return { ok: false, mensaje: 'El pago no existe.' };
      var nino = Dominio.nino(p.ninoId);
      Store.remove('pagos', pagoId);
      Store.log('Pago anulado',
        (nino ? Dominio.nombreCompleto(nino) : p.ninoId) + ' - ' + p.referencia +
        ' por ' + U.money(p.valor), usuario);
      return { ok: true };
    },

    etiquetaConcepto: function (c) { return c === 'Matricula' ? 'Matrícula' : c; },

    /* Cartera: estado de cuenta de todos los niños visibles */
    cartera: function (usuario) {
      return Dominio.ninosVisibles(usuario)
        .filter(function (n) { return n.estado === ESTADOS.ACTIVA || n.estado === ESTADOS.RETIRADA; })
        .map(function (n) {
          var c = Dominio.estadoCuenta(n.id);
          return { nino: n, saldo: c.saldo, totalPagado: c.totalPagado, mesesEnMora: c.mesesEnMora };
        });
    },

    /* ============================================================
       Indicadores para el panel
       ============================================================ */
    resumen: function (usuario) {
      var ninos = Dominio.ninosVisibles(usuario);
      var activos = ninos.filter(function (n) { return n.estado === ESTADOS.ACTIVA; });
      var pendientes = ninos.filter(function (n) { return n.estado === ESTADOS.PENDIENTE; });
      var grupos = Dominio.gruposDe(usuario.guarderiaId);
      var cartera = (usuario.rol === ROLES.ACUDIENTE) ? [] : Dominio.cartera(usuario);
      return {
        ninos: ninos,
        total: ninos.length,
        activos: activos.length,
        pendientes: pendientes.length,
        grupos: grupos,
        cupoTotal: U.sum(grupos, function (g) { return g.capacidad; }),
        ocupacionTotal: U.sum(grupos, function (g) { return Dominio.ocupacion(g.id); }),
        docentes: Dominio.docentesDe(usuario.guarderiaId),
        saldoPorCobrar: U.sum(cartera.filter(function (c) { return c.saldo > 0; }),
          function (c) { return c.saldo; }),
        enMora: cartera.filter(function (c) { return c.saldo > 0; }).length,
        recaudadoMes: U.sum(Store.where('pagos', function (p) {
          var n = Dominio.nino(p.ninoId);
          return n && n.guarderiaId === usuario.guarderiaId &&
            U.periodoDe(p.fecha) === U.periodoActual();
        }), function (p) { return Number(p.valor) || 0; })
      };
    }
  };

  global.Dominio = Dominio;
})(window);
