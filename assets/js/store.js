/* ============================================================
   store.js - Capa de persistencia (localStorage)
   Toda escritura pasa por aqui, de modo que cualquier cambio de
   estado quede registrado y sea auditable (RNF-02).
   Expone el objeto global Store
   ============================================================ */
(function (global) {
  'use strict';

  var KEY = 'guarderia_fis_v1';
  var state = null;
  var memoriaSolo = false;   // true si el navegador bloquea localStorage

  function leerDisco() {
    try {
      var raw = global.localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      memoriaSolo = true;
      return null;
    }
  }

  function escribirDisco() {
    if (memoriaSolo) return;
    try {
      global.localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      memoriaSolo = true;
    }
  }

  var Store = {

    /* ---------- Ciclo de vida ---------- */

    init: function () {
      var disco = leerDisco();
      if (disco && disco.version === global.Seed.VERSION) {
        state = disco;
      } else {
        state = global.Seed.build();
        escribirDisco();
      }
      return state;
    },

    reset: function () {
      state = global.Seed.build();
      escribirDisco();
      return state;
    },

    soloMemoria: function () { return memoriaSolo; },

    /* ---------- Lectura (devuelve copias) ---------- */

    all: function (col) {
      return U.clone(state[col] || []);
    },

    get: function (col, id) {
      var arr = state[col] || [];
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].id === id) return U.clone(arr[i]);
      }
      return null;
    },

    where: function (col, pred) {
      return Store.all(col).filter(pred);
    },

    first: function (col, pred) {
      var r = Store.where(col, pred);
      return r.length ? r[0] : null;
    },

    count: function (col, pred) {
      return pred ? Store.where(col, pred).length : (state[col] || []).length;
    },

    /* ---------- Escritura ---------- */

    insert: function (col, obj) {
      if (!state[col]) state[col] = [];
      if (!obj.id) obj.id = U.uid(col.slice(0, 3));
      state[col].push(U.clone(obj));
      escribirDisco();
      return U.clone(obj);
    },

    update: function (col, id, patch) {
      var arr = state[col] || [];
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].id === id) {
          Object.keys(patch).forEach(function (k) { arr[i][k] = U.clone(patch[k]); });
          escribirDisco();
          return U.clone(arr[i]);
        }
      }
      return null;
    },

    remove: function (col, id) {
      var arr = state[col] || [];
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].id === id) {
          arr.splice(i, 1);
          escribirDisco();
          return true;
        }
      }
      return false;
    },

    /* ---------- Auditoria (RNF-02) ---------- */

    log: function (accion, detalle, usuario) {
      var reg = {
        id: U.uid('log'),
        fecha: U.ahora(),
        accion: accion,
        detalle: detalle || '',
        usuarioId: usuario ? usuario.id : null,
        usuarioNombre: usuario ? usuario.nombre : 'sistema',
        rol: usuario ? usuario.rol : 'sistema'
      };
      if (!state.auditoria) state.auditoria = [];
      state.auditoria.unshift(reg);
      if (state.auditoria.length > 400) state.auditoria.length = 400;
      escribirDisco();
      return reg;
    },

    /* ---------- Respaldo ---------- */

    exportar: function () { return JSON.stringify(state, null, 2); },

    importar: function (json) {
      var obj = JSON.parse(json);
      if (!obj || !obj.version) throw new Error('El archivo no corresponde a un respaldo valido.');
      state = obj;
      escribirDisco();
      return true;
    }
  };

  global.Store = Store;
})(window);
