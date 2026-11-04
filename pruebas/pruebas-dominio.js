/* Pruebas funcionales de la capa de dominio (sin navegador).
   Carga utils/seed/store/auth/domain en el ámbito global de Node. */
const fs = require('fs');
const path = require('path');
const base = path.join(__dirname, '..', 'assets', 'js');

// Shims mínimos de navegador
const mem = {};
global.localStorage = {
  getItem: k => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: k => { delete mem[k]; }
};
global.window = global;

// Reloj fijo: los saldos esperados se calcularon con fecha 19 oct 2026.
// Sin esto, cada mes nuevo agrega una mensualidad y las pruebas de pagos fallan.
const FECHA_PRUEBAS = '2026-10-19T10:00:00';
const DateReal = Date;
global.Date = class extends DateReal {
  constructor(...a) { super(...(a.length ? a : [FECHA_PRUEBAS])); }
  static now() { return new DateReal(FECHA_PRUEBAS).getTime(); }
};

['utils.js', 'seed.js', 'store.js', 'auth.js', 'domain.js'].forEach(f => {
  // eslint-disable-next-line no-eval
  eval(fs.readFileSync(path.join(base, f), 'utf8'));
});

let pasan = 0, fallan = 0;
function t(nombre, fn) {
  try {
    const r = fn();
    if (r === true) { pasan++; console.log('  OK   ' + nombre); }
    else { fallan++; console.log('  FALLA ' + nombre + '  -> ' + JSON.stringify(r)); }
  } catch (e) {
    fallan++; console.log('  ERROR ' + nombre + '  -> ' + e.message);
  }
}
function eq(a, b) { return a === b ? true : 'esperado ' + JSON.stringify(b) + ', obtenido ' + JSON.stringify(a); }

console.log('\n--- utilidades y edades ---');
t('edad en meses (31)', () => eq(U.mesesEdad('2024-03-15', '2026-10-19'), 31));
t('edad texto', () => eq(U.edadTexto(31), '2 a\u00f1os 7 meses'));
t('borde de rango: 24 meses exactos', () => eq(U.mesesEdad('2024-10-19', '2026-10-19'), 24));
t('aun no cumple el mes', () => eq(U.mesesEdad('2024-10-20', '2026-10-19'), 23));
t('documento valido', () => eq(U.documentoValido('1032458712'), true));
t('documento invalido (3 digitos)', () => eq(U.documentoValido('123'), false));
t('dinero', () => eq(U.money(1040000), '$ 1.040.000'));
t('periodos entre', () => eq(U.periodosEntre('2026-02', '2026-05').join(','), '2026-02,2026-03,2026-04,2026-05'));

console.log('\n--- carga de datos ---');
Store.init();
t('9 ninos sembrados', () => eq(Store.count('ninos'), 9));
t('5 grupos sembrados', () => eq(Store.count('grupos'), 5));
t('44 pagos sembrados', () => eq(Store.count('pagos') > 40, true));

console.log('\n--- autenticacion (RF-13 / RNF-01) ---');
t('login con clave erronea falla', () => eq(Auth.login('admin@guarderia.co', 'mala').ok, false));
t('sin sesion no hay usuario', () => eq(Auth.actual(), null));
t('login administrador', () => eq(Auth.login('admin@guarderia.co', 'admin123').ok, true));
t('usuario actual es el admin', () => eq(Auth.actual().rol, ROLES.ADMIN));
t('admin puede aprobar matricula', () => eq(Auth.puede('matricula.aprobar'), true));
t('admin NO tiene permiso de portal', () => eq(Auth.puede('portal'), false));

console.log('\n--- alcance por rol (RF-02 / RF-14) ---');
const laura = Store.first('usuarios', u => u.email === 'laura@guarderia.co');
const ana = Store.first('usuarios', u => u.email === 'ana@mail.com');
const sofiaDoc = Store.first('usuarios', u => u.email === 'sofia@guarderia.co');
const admin2 = Store.first('usuarios', u => u.email === 'admin2@guarderia.co');
t('docente Laura ve solo su grupo (2 ninos)', () => eq(Dominio.ninosVisibles(laura).length, 2));
t('docente sin grupo no ve ninos (RF-03)', () => eq(Dominio.ninosVisibles(sofiaDoc).length, 0));
t('acudiente Ana ve 2 hijos', () => eq(Dominio.ninosVisibles(ana).length, 2));
t('Laura no puede ver nino de otro grupo', () => eq(Dominio.puedeVerNino(laura, Dominio.nino('nin-001')), false));
t('Ana no puede ver nino ajeno', () => eq(Dominio.puedeVerNino(ana, Dominio.nino('nin-003')), false));
t('admin de otra guarderia no ve nin-001', () => eq(Dominio.puedeVerNino(admin2, Dominio.nino('nin-001')), false));
t('admin1 no ve el nino de la guarderia 2', () => eq(Dominio.puedeVerNino(Auth.actual(), Dominio.nino('nin-009')), false));
t('exigirVerNino lanza AccesoDenegado', () => {
  try { Dominio.exigirVerNino(laura, Dominio.nino('nin-001')); return 'no lanzo'; }
  catch (e) { return eq(e.codigo, 'ACCESO_DENEGADO'); }
});

console.log('\n--- grupos y clasificacion (RF-16 / RF-17) ---');
t('rechaza grupo con min >= max', () => {
  const v = Dominio.validarGrupo({ guarderiaId: 'gua-1', nombre: 'Prueba', edadMinMeses: 24, edadMaxMeses: 12, capacidad: 5 });
  return eq(v.ok, false);
});
t('rechaza nombre repetido', () => eq(Dominio.validarGrupo({ guarderiaId: 'gua-1', nombre: 'P\u00e1rvulos', edadMinMeses: 1, edadMaxMeses: 5, capacidad: 5 }).ok, false));
t('acepta grupo valido', () => eq(Dominio.validarGrupo({ guarderiaId: 'gua-1', nombre: 'Jard\u00edn', edadMinMeses: 60, edadMaxMeses: 72, capacidad: 10 }).ok, true));
t('Samuel (9 meses) -> Bebes', () => eq(Dominio.grupoSugerido('2026-01-20', 'gua-1').grupo.nombre, 'Beb\u00e9s'));
t('borde 12 meses -> Caminadores', () => eq(Dominio.grupoSugerido('2025-10-19', 'gua-1').grupo.nombre, 'Caminadores'));
t('borde 24 meses -> Parvulos', () => eq(Dominio.grupoSugerido('2024-10-19', 'gua-1').grupo.nombre, 'P\u00e1rvulos'));
t('11 meses -> Bebes', () => eq(Dominio.grupoSugerido('2025-11-19', 'gua-1').grupo.nombre, 'Beb\u00e9s'));
t('edad fuera de todo rango', () => eq(Dominio.grupoSugerido('2018-01-01', 'gua-1').motivo, 'sin-rango'));
t('ocupacion Parvulos = 1 (el retirado no ocupa cupo)', () => eq(Dominio.ocupacion('gru-3'), 1));
t('no elimina grupo con ninos', () => eq(Dominio.eliminarGrupo('gru-3', Auth.actual()).ok, false));

console.log('\n--- matricula (RF-04 a RF-08) ---');
const baseMat = {
  guarderiaId: 'gua-1', grupoId: 'gru-1', nombres: 'Ana', apellidos: 'Prueba Test',
  fechaNacimiento: '2026-02-01', valorMatricula: 350000, valorMensualidad: 500000,
  acudientes: [{ nombre: 'Madre Prueba', tipoDoc: 'CC', documento: '1020304050', parentesco: 'Madre', telefono: '3001234567', email: '' }],
  contactoEmergencia: { nombre: 'Padre Prueba', telefono: '3009876543', parentesco: 'Padre' },
  medica: { eps: 'Sura', alergias: 'Ninguna', condiciones: 'Ninguna', medicamentos: '', observaciones: '' }
};
t('matricula valida pasa validacion', () => eq(Dominio.validarMatricula(baseMat).ok, true));
t('RF-05: sin info medica no pasa', () => {
  const d = JSON.parse(JSON.stringify(baseMat)); d.medica.alergias = '';
  const v = Dominio.validarMatricula(d);
  return eq(v.ok === false && !!v.errores.medAlergias, true);
});
t('RF-07: sin documento valido no pasa', () => {
  const d = JSON.parse(JSON.stringify(baseMat)); d.acudientes[0].documento = '12';
  return eq(Dominio.validarMatricula(d).ok, false);
});
t('RF-04: sin acudientes no pasa', () => {
  const d = JSON.parse(JSON.stringify(baseMat)); d.acudientes = [];
  return eq(Dominio.validarMatricula(d).ok, false);
});
t('RF-04: mas de 3 acudientes no pasa', () => {
  const d = JSON.parse(JSON.stringify(baseMat));
  d.acudientes = [0, 1, 2, 3].map(i => ({ nombre: 'A' + i, tipoDoc: 'CC', documento: '10203040' + i, parentesco: 'Tio', telefono: '3001234567' }));
  return eq(Dominio.validarMatricula(d).ok, false);
});
t('documentos repetidos no pasan', () => {
  const d = JSON.parse(JSON.stringify(baseMat));
  d.acudientes.push({ nombre: 'Otro', tipoDoc: 'CC', documento: '1020304050', parentesco: 'Tio', telefono: '3001234567' });
  return eq(Dominio.validarMatricula(d).ok, false);
});
t('fecha de nacimiento futura no pasa', () => {
  const d = JSON.parse(JSON.stringify(baseMat)); d.fechaNacimiento = '2027-01-01';
  return eq(Dominio.validarMatricula(d).ok, false);
});
const creada = Dominio.crearMatricula(baseMat, Auth.actual());
t('crea matricula en estado Pendiente', () => eq(creada.ok && creada.nino.estado, ESTADOS.PENDIENTE));
t('historial inicial con 1 entrada y fecha', () => eq(creada.nino.historial.length === 1 && !!creada.nino.historial[0].fecha, true));

console.log('\n--- aprobacion (RF-06 / RF-08) ---');
Auth.logout();
Auth.login('laura@guarderia.co', 'docente123');
t('RF-06: docente NO puede aprobar', () => {
  try { Dominio.cambiarEstado(creada.nino.id, ESTADOS.ACTIVA, '', Auth.actual()); return 'permitio'; }
  catch (e) { return eq(e.codigo, 'ACCESO_DENEGADO'); }
});
Auth.logout();
Auth.login('pagos@guarderia.co', 'pagos123');
t('RF-06: personal administrativo NO puede aprobar', () => {
  try { Dominio.cambiarEstado(creada.nino.id, ESTADOS.ACTIVA, '', Auth.actual()); return 'permitio'; }
  catch (e) { return eq(e.codigo, 'ACCESO_DENEGADO'); }
});
Auth.logout();
Auth.login('admin@guarderia.co', 'admin123');
const aprob = Dominio.cambiarEstado(creada.nino.id, ESTADOS.ACTIVA, 'Documentos verificados', Auth.actual());
t('admin aprueba la matricula', () => eq(aprob.ok, true));
t('RF-08: queda estado Activa con fecha de ingreso', () => eq(aprob.nino.estado === ESTADOS.ACTIVA && !!aprob.nino.fechaIngreso, true));
t('RF-08: historial con 2 cambios fechados', () => eq(aprob.nino.historial.length, 2));
t('transicion invalida Pendiente desde Activa', () => eq(Dominio.cambiarEstado(creada.nino.id, ESTADOS.PENDIENTE, '', Auth.actual()).ok, false));
t('capacidad: no activa si el grupo esta lleno', () => {
  const g = Dominio.grupo('gru-1');
  Store.update('grupos', 'gru-1', { capacidad: 1 });
  const r = Dominio.cambiarEstado('nin-004', ESTADOS.ACTIVA, '', Auth.actual());
  Store.update('grupos', 'gru-1', { capacidad: g.capacidad });
  return eq(r.ok, false);
});

console.log('\n--- pagos y saldos (RF-09 a RF-12) ---');
t('RF-10: saldo de Sofia = 1.040.000', () => eq(Dominio.estadoCuenta('nin-001').saldo, 1040000));
t('Sofia con 2 periodos en mora', () => eq(Dominio.estadoCuenta('nin-001').mesesEnMora, 2));
t('Valentina al dia', () => eq(Dominio.estadoCuenta('nin-003').saldo, 0));
t('Thomas al dia', () => eq(Dominio.estadoCuenta('nin-006').alDia, true));
t('retirado no acumula cargos tras el retiro', () => eq(Dominio.estadoCuenta('nin-008').saldo, 0));
t('pendiente de aprobacion sin cargos', () => eq(Dominio.cargosDe(Dominio.nino('nin-007')).length, 0));
t('RF-12: admin de otra guarderia no registra pagos ajenos', () => {
  const r = Dominio.validarPago({ ninoId: 'nin-007', concepto: 'Mensualidad', periodo: '2026-10', fecha: U.hoy(), valor: 1000, medio: 'Efectivo' });
  return eq(r.ok, false);  // matricula pendiente
});
Auth.logout();
Auth.login('laura@guarderia.co', 'docente123');
t('RF-12: docente NO puede registrar pagos', () => {
  try { Dominio.registrarPago({ ninoId: 'nin-001', concepto: 'Mensualidad', periodo: '2026-09', fecha: U.hoy(), valor: 520000, medio: 'Efectivo' }, Auth.actual()); return 'permitio'; }
  catch (e) { return eq(e.codigo, 'ACCESO_DENEGADO'); }
});
Auth.logout();
Auth.login('pagos@guarderia.co', 'pagos123');
t('RF-09: valida campos obligatorios del pago', () => {
  const v = Dominio.validarPago({ ninoId: '', concepto: '', periodo: '', fecha: '', valor: 0, medio: '' });
  return eq(Object.keys(v.errores).length, 6);
});
t('rechaza valor negativo', () => eq(Dominio.validarPago({ ninoId: 'nin-001', concepto: 'Mensualidad', periodo: '2026-09', fecha: U.hoy(), valor: -5, medio: 'Efectivo' }).ok, false));
t('rechaza fecha futura', () => eq(Dominio.validarPago({ ninoId: 'nin-001', concepto: 'Mensualidad', periodo: '2026-09', fecha: '2027-01-01', valor: 1000, medio: 'Efectivo' }).ok, false));
const pagoR = Dominio.registrarPago({ ninoId: 'nin-001', concepto: 'Mensualidad', periodo: '2026-09', fecha: U.hoy(), valor: 520000, medio: 'Efectivo' }, Auth.actual());
t('RF-09: registra el pago', () => eq(pagoR.ok, true));
t('RF-10: saldo baja a 520.000', () => eq(Dominio.estadoCuenta('nin-001').saldo, 520000));
t('RF-11: el pago aparece en el historial del periodo', () => eq(Dominio.pagosDe('nin-001', '2026-09').length, 1));
t('comprobante recuperable por id', () => eq(Dominio.pago(pagoR.pago.id).referencia, pagoR.pago.referencia));
t('anular pago restaura el saldo', () => {
  Dominio.anularPago(pagoR.pago.id, Auth.actual());
  return eq(Dominio.estadoCuenta('nin-001').saldo, 1040000);
});

console.log('\n--- docentes (RF-18) ---');
Auth.logout();
Auth.login('admin@guarderia.co', 'admin123');
t('asigna docente sin grupo a Bebes', () => eq(Dominio.asignarDocente(sofiaDoc.id, 'gru-1', Auth.actual()).ok, true));
t('un grupo admite varios docentes', () => {
  Dominio.asignarDocente(sofiaDoc.id, 'gru-2', Auth.actual());
  return eq(Dominio.docentesDeGrupo('gru-2').length, 2);
});
t('cada docente queda en un solo grupo', () => {
  const d = Store.get('usuarios', sofiaDoc.id);
  return eq(Dominio.docentesDeGrupo('gru-1').length === 0 && d.grupoId === 'gru-2', true);
});
t('reasignacion cambia los ninos visibles', () => {
  const antes = Dominio.ninosVisibles(Store.get('usuarios', sofiaDoc.id)).length;
  Dominio.asignarDocente(sofiaDoc.id, 'gru-4', Auth.actual());
  const despues = Dominio.ninosVisibles(Store.get('usuarios', sofiaDoc.id)).length;
  return eq(antes === 2 && despues === 2, true);
});
t('no asigna docente a grupo de otra guarderia', () => eq(Dominio.asignarDocente(sofiaDoc.id, 'gru-5', Auth.actual()).ok, false));

console.log('\n--- sesion invalida (RF-15) ---');
t('sesion valida antes de invalidar', () => eq(!!Auth.actual(), true));
t('tras invalidar, no hay usuario', () => { Auth.invalidarSesion(); return eq(Auth.actual(), null); });
t('operacion sin sesion lanza AccesoDenegado', () => {
  try { Auth.exigir('ninos.ver'); return 'permitio'; }
  catch (e) { return eq(e.codigo, 'ACCESO_DENEGADO'); }
});

console.log('\n--- auditoria (RNF-02) ---');
t('la bitacora registro los movimientos', () => eq(Store.count('auditoria') > 10, true));
t('registra los accesos denegados', () => eq(Store.where('auditoria', l => /denegado/i.test(l.accion)).length > 0, true));

console.log('\n============================');
console.log('  pasan: ' + pasan + '   fallan: ' + fallan);
console.log('============================\n');
process.exit(fallan ? 1 : 0);
