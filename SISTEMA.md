# Sistema de gestión para guarderías

Implementación funcional de los requerimientos y las historias de usuario definidas en
`docs/EntregaFIS.pdf` y `docs/Diagrama contexto solución.pdf`.

Aplicación web de una sola página en **HTML, CSS y JavaScript puro**: no requiere
servidor, compilación ni dependencias. Los datos se guardan en el `localStorage` del
navegador, por lo que cada evaluador puede trabajar con su propia copia de los datos.

---

## 1. Cómo ejecutarlo

| Forma | Pasos |
|---|---|
| Local | Abrir `index.html` con doble clic (Chrome, Edge o Firefox). |
| Servidor local | `python -m http.server` en la raíz y abrir `http://localhost:8000`. |
| GitHub Pages | Settings → Pages → Branch `main` / carpeta `/root`. El sitio queda publicado sobre **HTTPS**, como exige HU-04 AC4. |

Para volver a los datos originales: botón **Restablecer datos de demostración** en la pantalla de ingreso.

### Usuarios de prueba

En la pantalla de ingreso se puede hacer clic sobre cualquiera para autocompletar.

| Rol | Correo | Contraseña | Para evidenciar |
|---|---|---|---|
| Administrador | `admin@guarderia.co` | `admin123` | Matrículas, aprobaciones, grupos, docentes, auditoría |
| Docente (grupo Caminadores) | `laura@guarderia.co` | `docente123` | RF-01, RF-02: solo ve su grupo |
| Docente sin grupo | `sofia@guarderia.co` | `docente123` | RF-03: mensaje cuando no hay niños disponibles |
| Personal Administrativo | `pagos@guarderia.co` | `pagos123` | HU-03: pagos, saldos y comprobantes |
| Acudiente (2 hijos) | `ana@mail.com` | `acudiente123` | HU-04: portal restringido a sus menores |
| Administrador de otra guardería | `admin2@guarderia.co` | `admin123` | RF-02: aislamiento entre guarderías |

> Las contraseñas están en claro **solo** porque es una maqueta que corre por completo en
> el navegador. En producción deben almacenarse con hash (bcrypt/argon2) en el servidor y
> viajar siempre sobre HTTPS/TLS.

---

## 2. Actores y alcance de la información

| Actor | Qué puede hacer | Qué nunca ve |
|---|---|---|
| **Administrador** | Registrar, editar, aprobar y rechazar matrículas; crear grupos; asignar docentes; consultar pagos y auditoría | Niños de otra guardería |
| **Docente** | Consultar la lista y la ficha de los niños de **su** grupo | Pagos, matrículas, niños de otros grupos |
| **Personal Administrativo** | Registrar y consultar pagos, saldos y comprobantes; consultar matrículas | Aprobar o rechazar matrículas; administrar grupos |
| **Acudiente** | Consultar la ficha y el estado de cuenta de los menores vinculados a su cuenta | Cualquier otro menor y cualquier módulo administrativo |

La autorización se aplica en **dos capas**: la interfaz no ofrece la acción y, además, la
capa de dominio la vuelve a validar (`Auth.exigir`), de modo que manipular la URL no
permite saltarse el control.

---

## 3. Estructura del proyecto

```
index.html                  Página única: marco, contenedores y carga de scripts
assets/css/styles.css       Hoja de estilos (tema claro y oscuro, impresión)
assets/js/
  utils.js                  Fechas, edades en meses, dinero, validaciones de formato
  seed.js                   Datos de demostración (2 guarderías, 9 niños, 44 pagos)
  store.js                  Persistencia en localStorage + bitácora de auditoría
  auth.js                   Sesión, expiración y matriz de permisos por rol
  domain.js                 Reglas de negocio: RF-01 a RF-18
  ui.js                     Componentes: tablas, formularios, estados vacíos, modales
  views-login.js            Autenticación
  views-panel.js            Panel por rol + bitácora de auditoría
  views-ninos.js            HU-01: lista de niños y ficha
  views-matriculas.js       HU-02: formulario, listado y cambios de estado
  views-grupos.js           HU-05 y HU-06: grupos etarios y docentes
  views-pagos.js            HU-03: pagos, estado de cuenta y comprobante
  views-portal.js           HU-04: portal del acudiente
  app.js                    Enrutador por hash y control de acceso de cada ruta
pruebas/
  pruebas-dominio.js        77 pruebas de reglas de negocio (solo Node)
  pruebas-interfaz.js       62 pruebas de interfaz (Node + jsdom)
docs/                       Documento de requerimientos y diagrama de contexto
```

### Modelo de datos

```
GUARDERIA (id, nombre, sede, nit, telefono)
GRUPO     (id, guarderiaId, nombre, edadMinMeses, edadMaxMeses, capacidad, salon)
USUARIO   (id, nombre, email, clave, rol, guarderiaId, grupoId, documento)
NINO      (id, guarderiaId, grupoId, nombres, apellidos, fechaNacimiento,
           acudientes[1..3], contactoEmergencia, medica,
           estado, fechaIngreso, fechaRetiro,
           valorMatricula, valorMensualidad, historial[])
PAGO      (id, ninoId, concepto, periodo, fecha, valor, medio, referencia,
           registradoPor)
AUDITORIA (id, fecha, accion, detalle, usuario, rol)
```

Los **cargos no se almacenan**: se derivan de la matrícula (una matrícula más una
mensualidad por cada mes entre el ingreso y hoy, o el retiro). Así el saldo pendiente
siempre es consistente: `saldo = cargos − pagos`.

---

## 4. Trazabilidad de requerimientos

| Código | Requerimiento | HU | Implementación |
|---|---|---|---|
| RF-01 | Lista de niños con nombre, apellido y edad | HU-01 | `views-ninos.js › Vistas.ninos` |
| RF-02 | Consulta restringida al grupo/guardería del docente | HU-01 | `domain.js › ninosVisibles / puedeVerNino` |
| RF-03 | Mensaje cuando no hay niños registrados | HU-01 | `ui.js › vacio` usado en la lista |
| RF-04 | Matrícula con nombre, fecha de nacimiento, 1 a 3 acudientes y contacto de emergencia | HU-02 | `views-matriculas.js › matriculaForm` |
| RF-05 | Exige información médica antes de completar la matrícula | HU-02 | `domain.js › validarMatricula` |
| RF-06 | Solo el Administrador aprueba o rechaza | HU-02 | `auth.js › PERMISOS` + `domain.js › cambiarEstado` |
| RF-07 | Al menos un acudiente con documento válido | HU-02 | `utils.js › documentoValido` |
| RF-08 | Estado de matrícula con fecha de cada cambio | HU-02 | `domain.js › cambiarEstado` (historial) |
| RF-09 | Pago con alumno, período, fecha, valor y medio | HU-03 | `views-pagos.js › pagoForm` + `validarPago` |
| RF-10 | Al guardar el pago se actualiza el saldo | HU-03 | `domain.js › cargosDe / estadoCuenta` |
| RF-11 | Comprobante e historial por alumno y período | HU-03 | `views-pagos.js › comprobante` |
| RF-12 | Sin permiso administrativo no se gestionan pagos | HU-03 | `auth.js › exigir('pagos.gestionar')` |
| RF-13 | Exige autenticación antes de mostrar datos del menor | HU-04 | `app.js › render` + `auth.js › actual` |
| RF-14 | El acudiente solo ve los menores vinculados a su cuenta | HU-04 | `domain.js › esAcudienteDe` |
| RF-15 | Sesión inválida o acceso no autorizado → acceso denegado | HU-04 | `auth.js › actual` + `ui.js › accesoDenegado` |
| RF-16 | Grupos con edad mínima, máxima y capacidad | HU-05 | `domain.js › validarGrupo` |
| RF-17 | Clasificación automática por fecha de nacimiento | HU-05 | `domain.js › grupoSugerido / reclasificar` |
| RF-18 | Varios docentes por grupo; un grupo por docente | HU-06 | `domain.js › asignarDocente` |

| Código | Categoría | Implementación |
|---|---|---|
| RNF-01 | Seguridad | Matriz de permisos por rol validada en cada operación (`auth.js`), más control a nivel de registro (`puedeVerNino`) |
| RNF-02 | Confiabilidad | Historial fechado por matrícula + bitácora global de auditoría consultable en la aplicación |
| RNF-03 | Usabilidad | Todos los listados usan estados vacíos explicativos, nunca pantallas en blanco |

### Criterios de aceptación cubiertos

- **HU-01**: lista completa (AC1), nombre/apellido/edad (AC2), selección de un niño para ver
  su ficha (AC3), alcance por grupo y guardería (AC4), mensaje sin niños (AC5).
- **HU-02**: datos y 1–3 acudientes (AC1), información médica obligatoria (AC2), aprobación
  exclusiva del Administrador (AC3), documento válido obligatorio (AC4), estado con fecha (AC5).
- **HU-03**: selección de alumno y concepto (AC1), campos obligatorios (AC2), saldo actualizado
  (AC3), comprobante e historial (AC4), restricción por permiso (AC5).
- **HU-04**: autenticación previa (AC1), solo menores vinculados (AC2), sesión inválida con
  acceso denegado (AC3), HTTPS/TLS en el despliegue y pruebas de acceso indebido (AC4).
- **HU-05**: creación con nombre, rango y capacidad (AC1), rechazo si mínima ≥ máxima (AC2),
  sugerencia automática al digitar la fecha de nacimiento (AC3), bloqueo por capacidad (AC4).
- **HU-06**: asignación docente–grupo (AC1), un solo grupo por docente (AC2), varios docentes
  por grupo (AC3), el acceso a la información se actualiza al reasignar (AC4).

---

## 5. Pruebas

```bash
npm test          # 77 pruebas de reglas de negocio (no requiere dependencias)
npm install       # solo para la suite de interfaz (jsdom)
npm run test:ui   # 62 pruebas de interfaz: rutas, roles, formularios y accesos denegados
```

Estado actual: **77/77** y **62/62**.

Incluyen los casos límite pedidos en las historias: bordes de rango de edad (11, 12, 23 y
24 meses), capacidad máxima alcanzada, documento inválido, más de tres acudientes,
información médica vacía, pago con fecha futura o valor negativo, docente y acudiente
intentando acceder a información ajena, y sesión expirada.

---

## 6. Decisiones de diseño

1. **Edades en meses.** Los rangos de los grupos se expresan en meses porque en una
   guardería la diferencia relevante es mensual. Se interpretan como `[mínima, máxima)`,
   así un niño de 24 meses entra a Párvulos (24–36) y ya no a Caminadores (12–24): los
   bordes nunca se solapan.
2. **Estado `Rechazada`.** El documento pide los estados Activa, Pendiente y Retirada
   (RF-08), pero RF-06 exige poder *rechazar*. Se añadió `Rechazada` como cuarto estado,
   con sus transiciones controladas.
3. **El Administrador también puede registrar pagos.** RF-12 restringe los pagos a
   usuarios con permiso administrativo; tanto Personal Administrativo como Administrador
   lo tienen. Docente y Acudiente no, y es sobre ellos que se evidencia la restricción.
4. **Cargos derivados, no almacenados**, para que el saldo no pueda quedar desincronizado.
5. **Cupo ocupado por matrículas Activas y Pendientes**, de modo que una solicitud en
   trámite no pierda el cupo; un niño retirado lo libera.
6. **Expiración de sesión a los 30 minutos** de inactividad, para poder demostrar RF-15.

### Limitaciones conocidas

- Persistencia local (`localStorage`): no hay base de datos ni API; los datos no se
  comparten entre navegadores. El código está separado en capas (`store` / `domain` /
  vistas) para que sustituir `store.js` por llamadas a un backend no afecte las reglas.
- Autenticación de demostración: sin hash de contraseñas ni tokens de servidor.
- HTTPS/TLS depende del entorno de despliegue (GitHub Pages lo provee).
