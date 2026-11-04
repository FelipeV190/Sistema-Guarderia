/* Prueba de humo de la interfaz: carga index.html en jsdom,
   inicia sesión con cada rol y recorre todas las rutas. */
const path = require('path');
let JSDOM, VirtualConsole;
try {
  ({ JSDOM, VirtualConsole } = require('jsdom'));
} catch (e) {
  console.error('\nEsta suite necesita jsdom (solo para pruebas, no para ejecutar el sistema).');
  console.error('Instálelo con:  npm install\n');
  process.exit(2);
}

const INDEX = path.join(__dirname, '..', 'index.html').split(path.sep).join('/');
const errores = [];
let pasan = 0, fallan = 0;

const vc = new VirtualConsole();
vc.on('jsdomError', e => { if (!/Not implemented/.test(e.message)) errores.push('jsdomError: ' + e.message); });
vc.on('error', (...a) => errores.push('console.error: ' + a.join(' ')));

function t(nombre, cond, extra) {
  if (cond === true) { pasan++; console.log('  OK   ' + nombre); }
  else { fallan++; console.log('  FALLA ' + nombre + (extra ? '  -> ' + extra : '')); }
}

const esperar = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dom = await JSDOM.fromFile(INDEX, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: 'file:///' + INDEX.replace(/^\//, ''),
    pretendToBeVisual: true,
    virtualConsole: vc
  });
  const win = dom.window;
  await new Promise(r => win.addEventListener('load', r));
  await esperar(250);

  const doc = win.document;
  const vista = () => doc.getElementById('vista').innerHTML;
  const texto = () => doc.getElementById('vista').textContent;

  async function ir(hash) {
    win.location.hash = hash;
    await esperar(90);
  }

  function sinErrorDeVista(etiqueta) {
    const v = texto();
    if (/error inesperado/i.test(v)) { fallan++; console.log('  FALLA ' + etiqueta + ' -> vista con error: ' + v.slice(0, 220)); return false; }
    if (/Módulo no disponible/i.test(v)) { fallan++; console.log('  FALLA ' + etiqueta + ' -> módulo no registrado'); return false; }
    return true;
  }

  async function login(email, clave) {
    win.Auth.logout();
    await ir('#/login');
    const form = doc.getElementById('form-login');
    if (!form) throw new Error('no se renderizó el formulario de login');
    form.elements.email.value = email;
    form.elements.clave.value = clave;
    form.dispatchEvent(new win.Event('submit', { cancelable: true, bubbles: true }));
    await esperar(120);
  }

  console.log('\n--- arranque y login (RF-13) ---');
  t('muestra el formulario de login sin sesión', !!doc.getElementById('form-login'));
  t('el encabezado está oculto sin sesión', doc.getElementById('app-header').hidden === true);
  t('hay 6 usuarios de prueba', doc.querySelectorAll('.demo-user').length === 6,
    'encontrados: ' + doc.querySelectorAll('.demo-user').length);

  await ir('#/ninos');
  t('RF-13/RF-15: ruta privada sin sesión -> Acceso denegado', /Acceso denegado/.test(texto()));

  await login('admin@guarderia.co', 'claveMala');
  t('login con clave errónea no autentica', !!doc.getElementById('form-login') && /incorrect/i.test(texto()));

  console.log('\n--- rol Administrador ---');
  await login('admin@guarderia.co', 'admin123');
  t('entra al panel', /Hola, Carolina/.test(texto()) && sinErrorDeVista('panel admin'));
  t('encabezado visible con la guardería', /Mis Primeros Pasos/.test(doc.getElementById('app-header').textContent));
  t('menú del administrador completo',
    ['Inicio', 'Niños', 'Matrículas', 'Grupos', 'Docentes', 'Pagos', 'Auditoría', 'Requerimientos']
      .every(x => doc.getElementById('app-header').textContent.includes(x)));
  t('panel lista matrículas pendientes', /pendientes de aprobación/i.test(texto()));

  const rutasAdmin = [
    ['#/ninos', /Niños de la guardería/],
    ['#/ninos/nin-001', /Sofía Gómez Ramírez/],
    ['#/matriculas', /Matrículas/],
    ['#/matriculas/nueva', /Nueva matrícula/],
    ['#/matriculas/editar/nin-001', /Editar matrícula/],
    ['#/grupos', /Grupos etarios/],
    ['#/docentes', /Asignación de docentes/],
    ['#/pagos', /Historial de pagos/],
    ['#/pagos/nuevo', /Registrar pago/],
    ['#/pagos/estado/nin-001', /Estado de cuenta/],
    ['#/pagos/comprobante/pag-001-mat', /Comprobante/],
    ['#/auditoria', /Bitácora de auditoría/],
    ['#/requisitos', /Requerimientos y trazabilidad/]
  ];
  for (const [hash, re] of rutasAdmin) {
    await ir(hash);
    t('ruta ' + hash, re.test(texto()) && sinErrorDeVista(hash), texto().slice(0, 120));
  }

  console.log('\n--- vistas con datos (RF-01, RF-10, RF-17) ---');
  await ir('#/ninos');
  const filas = doc.querySelectorAll('[data-ver]').length;
  t('la lista muestra los 8 niños de la guardería', filas === 8, 'filas: ' + filas);
  t('cabeceras nombre/apellido/edad', /Nombre[\s\S]*Apellido[\s\S]*Edad/.test(vista()));
  await ir('#/pagos/estado/nin-001');
  t('RF-10: muestra el saldo 1.040.000', /1\.040\.000/.test(texto()));
  await ir('#/matriculas/nueva');
  const fn = doc.querySelector('[name="fechaNacimiento"]');
  fn.value = '2026-01-20';
  fn.dispatchEvent(new win.Event('change', { bubbles: true }));
  await esperar(60);
  t('RF-17: sugiere el grupo Bebés al digitar la fecha',
    /Grupo sugerido automáticamente/.test(texto()) && /Bebés/.test(doc.getElementById('sugerencia-grupo').textContent));
  t('RF-17: el selector queda preseleccionado',
    doc.querySelector('[name="grupoId"]').value === 'gru-1');
  t('RF-04: tres bloques de acudiente, dos ocultos',
    doc.querySelectorAll('[data-acudiente]').length === 3 &&
    doc.querySelector('[data-acudiente="1"]').hidden === true);

  console.log('\n--- validaciones del formulario (RF-04/05/07) ---');
  const formMat = doc.getElementById('form-matricula');
  formMat.dispatchEvent(new win.Event('submit', { cancelable: true, bubbles: true }));
  await esperar(60);
  t('bloquea el envío con campos vacíos', /requiere|requieren/.test(texto()));
  t('marca el campo de alergias como obligatorio',
    doc.querySelector('[data-error-for="medAlergias"]').hidden === false);
  t('exige acudiente con documento válido',
    doc.querySelector('[data-error-for="acudientes"]').hidden === false ||
    doc.querySelector('[data-error-for="acudiente0Documento"]').hidden === false);

  console.log('\n--- rol Docente (RF-01, RF-02, RF-03, RF-12) ---');
  await login('laura@guarderia.co', 'docente123');
  t('panel del docente muestra su grupo', /Caminadores/.test(texto()));
  t('menú restringido (sin Pagos ni Grupos)',
    !/Pagos|Grupos|Docentes/.test(doc.getElementById('app-header').querySelector('.app-nav').textContent));
  await ir('#/ninos');
  t('RF-02: solo ve 2 niños de su grupo', doc.querySelectorAll('[data-ver]').length === 2,
    'filas: ' + doc.querySelectorAll('[data-ver]').length);
  await ir('#/ninos/nin-001');
  t('RF-02: ficha de otro grupo -> Acceso denegado', /Acceso denegado/.test(texto()));
  await ir('#/pagos/nuevo');
  t('RF-12: docente no puede registrar pagos', /Acceso denegado/.test(texto()));
  await ir('#/matriculas');
  t('docente no accede a matrículas', /Acceso denegado/.test(texto()));

  console.log('\n--- docente sin grupo (RF-03) ---');
  await login('sofia@guarderia.co', 'docente123');
  await ir('#/ninos');
  t('RF-03: mensaje explicativo, no pantalla vacía', /No tiene un grupo asignado/.test(texto()));

  console.log('\n--- rol Personal Administrativo (HU-03) ---');
  await login('pagos@guarderia.co', 'pagos123');
  t('panel con cartera', /Cartera por cobrar/.test(texto()));
  await ir('#/pagos/nuevo');
  const formPago = doc.getElementById('form-pago');
  formPago.elements.ninoId.value = 'nin-001';
  formPago.elements.ninoId.dispatchEvent(new win.Event('change', { bubbles: true }));
  await esperar(60);
  t('muestra el estado de cuenta del alumno elegido', /períodos? en mora|período\(s\) en mora/i.test(texto()));
  doc.getElementById('btn-usar-mora').click();
  await esperar(40);
  t('autocompleta el período en mora', formPago.elements.periodo.value === '2026-09');
  formPago.dispatchEvent(new win.Event('submit', { cancelable: true, bubbles: true }));
  await esperar(120);
  t('RF-09/RF-11: redirige al comprobante', /Comprobante de pago/.test(texto()));
  t('RF-10: el comprobante informa el nuevo saldo', /Saldo del alumno a la fecha/.test(texto()));
  await ir('#/pagos/estado/nin-001');
  t('RF-10: el saldo bajó a 520.000', /520\.000/.test(texto()));
  await ir('#/matriculas');
  t('puede consultar matrículas', /Matrículas/.test(texto()) && !/Acceso denegado/.test(texto()));
  t('RF-06: no ve botones de aprobar', !/Aprobar/.test(vista()));
  await ir('#/grupos');
  t('no administra grupos', /Acceso denegado/.test(texto()));

  console.log('\n--- rol Acudiente (HU-04) ---');
  await login('ana@mail.com', 'acudiente123');
  t('entra al portal del acudiente', /Portal del acudiente/.test(texto()));
  t('RF-14: ve a sus dos hijos', /Sofía Gómez Ramírez/.test(texto()) && /Mateo Gómez Ramírez/.test(texto()));
  t('no ve niños ajenos', !/Valentina Pérez/.test(texto()));
  t('menú mínimo', !/Matrículas|Grupos|Auditoría/.test(doc.getElementById('app-header').querySelector('.app-nav').textContent));
  await ir('#/ninos/nin-001');
  t('ve la ficha de su hija', /Sofía Gómez Ramírez/.test(texto()) && !/Acceso denegado/.test(texto()));
  await ir('#/ninos/nin-003');
  t('RF-14: ficha ajena -> Acceso denegado', /Acceso denegado/.test(texto()));
  await ir('#/pagos');
  t('no accede al módulo de pagos', /Acceso denegado/.test(texto()));
  await ir('#/auditoria');
  t('no accede a la auditoría', /Acceso denegado/.test(texto()));

  console.log('\n--- sesión inválida (RF-15) ---');
  await login('admin@guarderia.co', 'admin123');
  await ir('#/requisitos');
  t('la página de requisitos lista los 18 RF', (vista().match(/tag-rf/g) || []).length > 20);
  doc.getElementById('btn-invalidar').click();
  await esperar(120);
  t('RF-15: tras invalidar la sesión se deniega el acceso',
    /Acceso denegado|Iniciar sesión/.test(texto()));

  console.log('\n--- aprobación de matrícula desde la interfaz (RF-06/RF-08) ---');
  await login('admin@guarderia.co', 'admin123');
  await ir('#/ninos/nin-004');
  const btnAprobar = Array.prototype.slice.call(doc.querySelectorAll('[data-estado]'))
    .filter(b => b.getAttribute('data-estado') === 'Activa')[0];
  t('la ficha ofrece aprobar al administrador', !!btnAprobar);
  btnAprobar.click();
  await esperar(80);
  t('abre el diálogo de aprobación', /Aprobar matrícula/.test(doc.getElementById('modal').textContent));
  doc.querySelector('[data-modal-ok]').click();
  await esperar(120);
  t('RF-08: la matrícula queda Activa con historial fechado',
    win.Dominio.nino('nin-004').estado === 'Activa' &&
    win.Dominio.nino('nin-004').historial.length === 2);
  t('la ficha refleja el nuevo estado', /Activa/.test(texto()));

  console.log('\n--- consola del navegador ---');
  t('sin errores de JavaScript', errores.length === 0, errores.slice(0, 5).join(' | '));

  console.log('\n============================');
  console.log('  pasan: ' + pasan + '   fallan: ' + fallan);
  console.log('============================\n');
  dom.window.close();
  process.exit(fallan ? 1 : 0);
})().catch(e => { console.error('ERROR FATAL: ' + e.message + '\n' + e.stack); process.exit(2); });
