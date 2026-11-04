/* ============================================================
   auth.js - Autenticación, sesión y autorización por roles
   Cubre RNF-01 (autenticación y autorización basada en roles),
   RF-13 (exigir autenticación), RF-14 (alcance del acudiente)
   y RF-15 (sesión inválida -> acceso denegado).
   Expone el objeto global Auth
   ============================================================ */
(function (global) {
  'use strict';

  var KEY_SESION = 'guarderia_fis_sesion';
  var TIMEOUT_MIN = 30;           // minutos de inactividad permitidos

  /* ------------------------------------------------------------
     Matriz de permisos por rol (RNF-01).
     Cada operación del sistema se valida contra esta matriz.
     ------------------------------------------------------------ */
  var PERMISOS = {};
  PERMISOS[ROLES.ADMIN] = [
    'panel', 'ninos.ver', 'ninos.detalle', 'matricula.ver', 'matricula.crear',
    'matricula.editar', 'matricula.aprobar', 'grupos.gestionar', 'docentes.asignar',
    'pagos.ver', 'pagos.gestionar', 'auditoria', 'requisitos'
  ];
  PERMISOS[ROLES.DOCENTE] = [
    'panel', 'ninos.ver', 'ninos.detalle', 'requisitos'
  ];
  PERMISOS[ROLES.ADMINISTRATIVO] = [
    'panel', 'ninos.ver', 'ninos.detalle', 'matricula.ver',
    'pagos.ver', 'pagos.gestionar', 'requisitos'
  ];
  PERMISOS[ROLES.ACUDIENTE] = [
    'portal', 'ninos.detalle', 'requisitos'
  ];

  var ETIQUETA_PERMISO = {
    'ninos.ver': 'consultar la lista de niños',
    'ninos.detalle': 'consultar la ficha de un niño',
    'matricula.ver': 'consultar matrículas',
    'matricula.crear': 'registrar matrículas',
    'matricula.editar': 'editar matrículas',
    'matricula.aprobar': 'aprobar o rechazar matrículas',
    'grupos.gestionar': 'administrar grupos etarios',
    'docentes.asignar': 'asignar docentes a grupos',
    'pagos.ver': 'consultar pagos',
    'pagos.gestionar': 'registrar y gestionar pagos',
    'auditoria': 'consultar la bitácora de auditoría',
    'portal': 'acceder al portal del acudiente'
  };

  function leerSesion() {
    try {
      var raw = global.localStorage.getItem(KEY_SESION);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function guardarSesion(s) {
    try { global.localStorage.setItem(KEY_SESION, JSON.stringify(s)); } catch (e) { /* sesión en memoria */ }
    sesionMemoria = s;
  }

  function borrarSesion() {
    try { global.localStorage.removeItem(KEY_SESION); } catch (e) { /* noop */ }
    sesionMemoria = null;
  }

  var sesionMemoria = null;

  function sesion() { return leerSesion() || sesionMemoria; }

  function minutosDesde(iso) {
    var t = new Date(String(iso).replace(' ', 'T')).getTime();
    if (isNaN(t)) return Infinity;
    return (Date.now() - t) / 60000;
  }

  /* Error de autorización que las vistas saben renderizar */
  function AccesoDenegado(mensaje, permiso) {
    this.name = 'AccesoDenegado';
    this.codigo = 'ACCESO_DENEGADO';
    this.permiso = permiso || null;
    this.message = mensaje || 'Acceso denegado.';
  }
  AccesoDenegado.prototype = Object.create(Error.prototype);

  var Auth = {

    AccesoDenegado: AccesoDenegado,
    PERMISOS: PERMISOS,
    TIMEOUT_MIN: TIMEOUT_MIN,
    ultimoMotivo: null,          // 'credenciales' | 'expirada' | 'inactiva'

    /* ---------- Autenticación ---------- */

    login: function (email, clave) {
      var u = Store.first('usuarios', function (x) {
        return String(x.email).toLowerCase() === String(email || '').trim().toLowerCase();
      });
      if (!u || u.clave !== clave || !u.activo) {
        Auth.ultimoMotivo = 'credenciales';
        Store.log('Intento de inicio de sesión fallido', 'Correo: ' + (email || '(vacío)'), null);
        return { ok: false, mensaje: 'Correo o contraseña incorrectos.' };
      }
      guardarSesion({
        usuarioId: u.id,
        token: U.uid('tok'),
        inicio: U.ahora(),
        ultima: U.ahora()
      });
      Auth.ultimoMotivo = null;
      Store.log('Inicio de sesión', u.rol + ' - ' + u.email, u);
      return { ok: true, usuario: u };
    },

    logout: function (motivo) {
      var u = Auth.usuarioSesion();
      if (u) Store.log('Cierre de sesión', motivo || 'Solicitado por el usuario', u);
      borrarSesion();
      Auth.ultimoMotivo = motivo || null;
    },

    /* Usuario de la sesión, sin validar vigencia (uso interno) */
    usuarioSesion: function () {
      var s = sesion();
      return s ? Store.get('usuarios', s.usuarioId) : null;
    },

    /* RF-13 / RF-15: usuario autenticado con sesión vigente, o null */
    actual: function () {
      var s = sesion();
      if (!s) return null;
      if (minutosDesde(s.ultima) > TIMEOUT_MIN) {
        Auth.logout('inactiva');
        Auth.ultimoMotivo = 'inactiva';
        return null;
      }
      var u = Store.get('usuarios', s.usuarioId);
      if (!u || !u.activo) {
        Auth.logout('expirada');
        Auth.ultimoMotivo = 'expirada';
        return null;
      }
      return u;
    },

    autenticado: function () { return !!Auth.actual(); },

    /* Renueva la marca de actividad de la sesión */
    renovar: function () {
      var s = sesion();
      if (!s) return;
      s.ultima = U.ahora();
      guardarSesion(s);
    },

    /* Fuerza una sesión inválida (botón de prueba de RF-15) */
    invalidarSesion: function () {
      var s = sesion();
      if (!s) return false;
      var d = new Date(Date.now() - (TIMEOUT_MIN + 5) * 60000);
      s.ultima = d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate()) +
        'T' + U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()) + ':00';
      guardarSesion(s);
      return true;
    },

    minutosInactivo: function () {
      var s = sesion();
      return s ? minutosDesde(s.ultima) : null;
    },

    /* ---------- Autorización ---------- */

    puede: function (permiso, usuario) {
      var u = usuario || Auth.actual();
      if (!u) return false;
      var lista = PERMISOS[u.rol] || [];
      return lista.indexOf(permiso) !== -1;
    },

    /* Lanza AccesoDenegado si no hay sesión o falta el permiso */
    exigir: function (permiso) {
      var u = Auth.actual();
      if (!u) {
        throw new AccesoDenegado(
          'Su sesión no es válida o ha expirado. Vuelva a iniciar sesión para continuar.', permiso);
      }
      if (!Auth.puede(permiso, u)) {
        Store.log('Acceso denegado', 'Permiso requerido: ' + permiso, u);
        throw new AccesoDenegado(
          'Su rol (' + u.rol + ') no tiene autorización para ' +
          (ETIQUETA_PERMISO[permiso] || permiso) + '.', permiso);
      }
      return u;
    },

    etiquetaPermiso: function (p) { return ETIQUETA_PERMISO[p] || p; },

    /* Permisos del rol, para mostrarlos en la interfaz */
    permisosDe: function (rol) { return (PERMISOS[rol] || []).slice(); },

    esRol: function (rol, usuario) {
      var u = usuario || Auth.actual();
      return !!u && u.rol === rol;
    }
  };

  global.Auth = Auth;
})(window);
