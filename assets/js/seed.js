/* ============================================================
   seed.js - Datos iniciales de demostración
   Incluye dos guarderías para poder evidenciar RF-02: ningún
   usuario ve información de una guardería distinta a la suya.
   Nota: los valores de los enumerados (estados y conceptos) se
   mantienen sin acentos porque son claves de datos; el texto
   visible se acentúa en la interfaz.
   Expone el objeto global Seed
   ============================================================ */
(function (global) {
  'use strict';

  var ROLES = {
    ADMIN: 'Administrador',
    DOCENTE: 'Docente',
    ADMINISTRATIVO: 'Personal Administrativo',
    ACUDIENTE: 'Acudiente'
  };

  var ESTADOS = {
    PENDIENTE: 'Pendiente',
    ACTIVA: 'Activa',
    RETIRADA: 'Retirada',
    RECHAZADA: 'Rechazada'
  };

  var MEDIOS_PAGO = ['Efectivo', 'Transferencia', 'Tarjeta débito', 'Tarjeta crédito', 'PSE'];
  var CONCEPTOS = ['Matricula', 'Mensualidad'];

  /* Genera un pago por cada período del rango (inclusive) */
  function pagosMensualidad(ninoId, desde, hasta, valor, medio, cajero) {
    return U.periodosEntre(desde, hasta).map(function (periodo, i) {
      var dia = '-0' + ((i % 5) + 3);
      return {
        id: 'pag-' + ninoId.slice(-3) + '-' + periodo,
        ninoId: ninoId,
        concepto: 'Mensualidad',
        periodo: periodo,
        fecha: periodo + dia,
        valor: valor,
        medio: medio,
        referencia: 'REF-' + periodo.replace('-', '') + '-' + ninoId.slice(-3),
        nota: '',
        registradoPorId: cajero.id,
        registradoPorNombre: cajero.nombre,
        creadoEn: periodo + dia + 'T09:' + U.pad(10 + (i % 40)) + ':00'
      };
    });
  }

  function pagoMatricula(ninoId, fecha, valor, medio, cajero) {
    return {
      id: 'pag-' + ninoId.slice(-3) + '-mat',
      ninoId: ninoId,
      concepto: 'Matricula',
      periodo: fecha.slice(0, 7),
      fecha: fecha,
      valor: valor,
      medio: medio,
      referencia: 'MAT-' + ninoId.slice(-3),
      nota: 'Pago único de matrícula',
      registradoPorId: cajero.id,
      registradoPorNombre: cajero.nombre,
      creadoEn: fecha + 'T08:30:00'
    };
  }

  var Seed = {

    VERSION: 'fis-1.0.0',
    ROLES: ROLES,
    ESTADOS: ESTADOS,
    MEDIOS_PAGO: MEDIOS_PAGO,
    CONCEPTOS: CONCEPTOS,

    build: function () {

      /* ---------- Guarderías ---------- */
      var guarderias = [
        {
          id: 'gua-1', nombre: 'Guardería Mis Primeros Pasos', sede: 'Chapinero, Bogotá',
          nit: '900.123.456-7', telefono: '6013456789'
        },
        {
          id: 'gua-2', nombre: 'Guardería Pequeños Genios', sede: 'Suba, Bogotá',
          nit: '900.987.654-3', telefono: '6017654321'
        }
      ];

      /* ---------- Grupos etarios (HU-05) ---------- */
      var grupos = [
        { id: 'gru-1', guarderiaId: 'gua-1', nombre: 'Bebés', edadMinMeses: 0, edadMaxMeses: 12, capacidad: 8, salon: 'Salón A', creadoEn: '2025-12-01T08:00:00' },
        { id: 'gru-2', guarderiaId: 'gua-1', nombre: 'Caminadores', edadMinMeses: 12, edadMaxMeses: 24, capacidad: 10, salon: 'Salón B', creadoEn: '2025-12-01T08:05:00' },
        { id: 'gru-3', guarderiaId: 'gua-1', nombre: 'Párvulos', edadMinMeses: 24, edadMaxMeses: 36, capacidad: 12, salon: 'Salón C', creadoEn: '2025-12-01T08:10:00' },
        { id: 'gru-4', guarderiaId: 'gua-1', nombre: 'Prejardín', edadMinMeses: 36, edadMaxMeses: 60, capacidad: 15, salon: 'Salón D', creadoEn: '2025-12-01T08:15:00' },
        { id: 'gru-5', guarderiaId: 'gua-2', nombre: 'Exploradores', edadMinMeses: 0, edadMaxMeses: 24, capacidad: 10, salon: 'Salón 1', creadoEn: '2025-12-02T08:00:00' }
      ];

      /* ---------- Usuarios y roles (RNF-01) ----------
         DEMO: la contraseña se guarda en claro porque esta es una maqueta
         funcional que corre 100% en el navegador. En producción debe
         almacenarse como hash (bcrypt/argon2) en el servidor y viajar
         siempre sobre HTTPS/TLS (HU-04 AC4).                           */
      var usuarios = [
        {
          id: 'usu-adm', nombre: 'Carolina Restrepo', email: 'admin@guarderia.co',
          clave: 'admin123', rol: ROLES.ADMIN, guarderiaId: 'gua-1',
          grupoId: null, documento: '52987412', telefono: '3101234567', activo: true
        },
        {
          id: 'usu-doc1', nombre: 'Laura Méndez', email: 'laura@guarderia.co',
          clave: 'docente123', rol: ROLES.DOCENTE, guarderiaId: 'gua-1',
          grupoId: 'gru-2', documento: '1018445521', telefono: '3119876543', activo: true
        },
        {
          id: 'usu-doc2', nombre: 'Diego Torres', email: 'diego@guarderia.co',
          clave: 'docente123', rol: ROLES.DOCENTE, guarderiaId: 'gua-1',
          grupoId: 'gru-3', documento: '79884412', telefono: '3127654321', activo: true
        },
        {
          id: 'usu-doc3', nombre: 'Natalia Cruz', email: 'natalia@guarderia.co',
          clave: 'docente123', rol: ROLES.DOCENTE, guarderiaId: 'gua-1',
          grupoId: 'gru-4', documento: '1032556677', telefono: '3134455667', activo: true
        },
        {
          id: 'usu-doc4', nombre: 'Sofía Arango', email: 'sofia@guarderia.co',
          clave: 'docente123', rol: ROLES.DOCENTE, guarderiaId: 'gua-1',
          grupoId: null, documento: '1020334455', telefono: '3145566778', activo: true
        },
        {
          id: 'usu-pag', nombre: 'Marta Ruiz', email: 'pagos@guarderia.co',
          clave: 'pagos123', rol: ROLES.ADMINISTRATIVO, guarderiaId: 'gua-1',
          grupoId: null, documento: '41223344', telefono: '3156677889', activo: true
        },
        {
          id: 'usu-acu1', nombre: 'Ana María Gómez', email: 'ana@mail.com',
          clave: 'acudiente123', rol: ROLES.ACUDIENTE, guarderiaId: 'gua-1',
          grupoId: null, documento: '1032458712', telefono: '3001112233', activo: true
        },
        {
          id: 'usu-acu2', nombre: 'Jorge Pérez Salas', email: 'jorge@mail.com',
          clave: 'acudiente123', rol: ROLES.ACUDIENTE, guarderiaId: 'gua-1',
          grupoId: null, documento: '79456123', telefono: '3002223344', activo: true
        },
        {
          id: 'usu-adm2', nombre: 'Héctor Lozano', email: 'admin2@guarderia.co',
          clave: 'admin123', rol: ROLES.ADMIN, guarderiaId: 'gua-2',
          grupoId: null, documento: '80112233', telefono: '3167788990', activo: true
        }
      ];

      var cajero = usuarios[5];            // Marta Ruiz - Personal Administrativo

      /* ---------- Niños y matrículas (HU-02) ---------- */
      var ninos = [
        {
          id: 'nin-001', guarderiaId: 'gua-1', grupoId: 'gru-3',
          nombres: 'Sofía', apellidos: 'Gómez Ramírez', genero: 'F',
          fechaNacimiento: '2024-03-15',
          acudientes: [
            { nombre: 'Ana María Gómez', tipoDoc: 'CC', documento: '1032458712', parentesco: 'Madre', telefono: '3001112233', email: 'ana@mail.com' },
            { nombre: 'Carlos Ramírez Díaz', tipoDoc: 'CC', documento: '80234119', parentesco: 'Padre', telefono: '3004445566', email: 'carlos@mail.com' }
          ],
          contactoEmergencia: { nombre: 'Luz Marina Díaz', telefono: '3007778899', parentesco: 'Abuela' },
          medica: {
            eps: 'Sanitas', alergias: 'Alergia al maní', condiciones: 'Ninguna',
            medicamentos: 'Ninguno', observaciones: 'Usa inhalador solo en caso de crisis'
          },
          estado: ESTADOS.ACTIVA, fechaIngreso: '2026-02-03', fechaRetiro: null,
          valorMatricula: 350000, valorMensualidad: 520000,
          historial: [
            { estado: ESTADOS.PENDIENTE, fecha: '2026-01-28T09:12:00', usuarioNombre: 'Carolina Restrepo', rol: ROLES.ADMIN, nota: 'Solicitud de matrícula registrada' },
            { estado: ESTADOS.ACTIVA, fecha: '2026-02-03T10:02:00', usuarioNombre: 'Carolina Restrepo', rol: ROLES.ADMIN, nota: 'Matrícula aprobada: documentación completa' }
          ],
          creadoEn: '2026-01-28T09:12:00'
        },
        {
          id: 'nin-002', guarderiaId: 'gua-1', grupoId: 'gru-2',
          nombres: 'Mateo', apellidos: 'Gómez Ramírez', genero: 'M',
          fechaNacimiento: '2025-06-02',
          acudientes: [
            { nombre: 'Ana María Gómez', tipoDoc: 'CC', documento: '1032458712', parentesco: 'Madre', telefono: '3001112233', email: 'ana@mail.com' },
            { nombre: 'Carlos Ramírez Díaz', tipoDoc: 'CC', documento: '80234119', parentesco: 'Padre', telefono: '3004445566', email: 'carlos@mail.com' }
          ],
          contactoEmergencia: { nombre: 'Luz Marina Díaz', telefono: '3007778899', parentesco: 'Abuela' },
          medica: {
            eps: 'Sanitas', alergias: 'Ninguna', condiciones: 'Ninguna',
            medicamentos: 'Ninguno', observaciones: ''
          },
          estado: ESTADOS.ACTIVA, fechaIngreso: '2026-02-03', fechaRetiro: null,
          valorMatricula: 350000, valorMensualidad: 480000,
          historial: [
            { estado: ESTADOS.PENDIENTE, fecha: '2026-01-28T09:20:00', usuarioNombre: 'Carolina Restrepo', rol: ROLES.ADMIN, nota: 'Solicitud de matrícula registrada (hermano de Sofía)' },
            { estado: ESTADOS.ACTIVA, fecha: '2026-02-03T10:05:00', usuarioNombre: 'Carolina Restrepo', rol: ROLES.ADMIN, nota: 'Matrícula aprobada' }
          ],
          creadoEn: '2026-01-28T09:20:00'
        },
        {
          id: 'nin-003', guarderiaId: 'gua-1', grupoId: 'gru-4',
          nombres: 'Valentina', apellidos: 'Pérez López', genero: 'F',
          fechaNacimiento: '2022-09-10',
          acudientes: [
            { nombre: 'Jorge Pérez Salas', tipoDoc: 'CC', documento: '79456123', parentesco: 'Padre', telefono: '3002223344', email: 'jorge@mail.com' },
            { nombre: 'Diana López Mejía', tipoDoc: 'CC', documento: '52998877', parentesco: 'Madre', telefono: '3005556677', email: 'diana@mail.com' },
            { nombre: 'Rosa Salas Peña', tipoDoc: 'CC', documento: '41556677', parentesco: 'Abuela', telefono: '3008889900', email: '' }
          ],
          contactoEmergencia: { nombre: 'Rosa Salas Peña', telefono: '3008889900', parentesco: 'Abuela' },
          medica: {
            eps: 'Compensar', alergias: 'Penicilina', condiciones: 'Asma leve',
            medicamentos: 'Salbutamol', observaciones: 'Evitar actividad física intensa'
          },
          estado: ESTADOS.ACTIVA, fechaIngreso: '2026-03-02', fechaRetiro: null,
          valorMatricula: 350000, valorMensualidad: 540000,
          historial: [
            { estado: ESTADOS.PENDIENTE, fecha: '2026-02-24T11:00:00', usuarioNombre: 'Carolina Restrepo', rol: ROLES.ADMIN, nota: 'Solicitud de matrícula registrada' },
            { estado: ESTADOS.ACTIVA, fecha: '2026-03-02T08:45:00', usuarioNombre: 'Carolina Restrepo', rol: ROLES.ADMIN, nota: 'Matrícula aprobada' }
          ],
          creadoEn: '2026-02-24T11:00:00'
        },
        {
          id: 'nin-004', guarderiaId: 'gua-1', grupoId: 'gru-1',
          nombres: 'Samuel', apellidos: 'Díaz Mora', genero: 'M',
          fechaNacimiento: '2026-01-20',
          acudientes: [
            { nombre: 'Paula Mora Vega', tipoDoc: 'CC', documento: '1020998877', parentesco: 'Madre', telefono: '3011234567', email: 'paula@mail.com' }
          ],
          contactoEmergencia: { nombre: 'Andrés Díaz Luna', telefono: '3019876543', parentesco: 'Padre' },
          medica: {
            eps: 'Nueva EPS', alergias: 'Ninguna', condiciones: 'Reflujo',
            medicamentos: 'Ninguno', observaciones: 'Alimentación cada 3 horas'
          },
          estado: ESTADOS.PENDIENTE, fechaIngreso: null, fechaRetiro: null,
          valorMatricula: 350000, valorMensualidad: 560000,
          historial: [
            { estado: ESTADOS.PENDIENTE, fecha: '2026-10-05T14:10:00', usuarioNombre: 'Carolina Restrepo', rol: ROLES.ADMIN, nota: 'Solicitud de matrícula registrada, pendiente de aprobación' }
          ],
          creadoEn: '2026-10-05T14:10:00'
        },
        {
          id: 'nin-005', guarderiaId: 'gua-1', grupoId: 'gru-2',
          nombres: 'Isabella', apellidos: 'Quintero Ruiz', genero: 'F',
          fechaNacimiento: '2024-11-05',
          acudientes: [
            { nombre: 'Camila Ruiz Ortiz', tipoDoc: 'CC', documento: '1013445566', parentesco: 'Madre', telefono: '3021234567', email: 'camila@mail.com' },
            { nombre: 'Felipe Quintero Soto', tipoDoc: 'CC', documento: '80556677', parentesco: 'Padre', telefono: '3029876543', email: 'felipe@mail.com' }
          ],
          contactoEmergencia: { nombre: 'Felipe Quintero Soto', telefono: '3029876543', parentesco: 'Padre' },
          medica: {
            eps: 'Sura', alergias: 'Intolerancia a la lactosa', condiciones: 'Ninguna',
            medicamentos: 'Ninguno', observaciones: 'Dieta sin lactosa'
          },
          estado: ESTADOS.ACTIVA, fechaIngreso: '2026-04-01', fechaRetiro: null,
          valorMatricula: 350000, valorMensualidad: 480000,
          historial: [
            { estado: ESTADOS.PENDIENTE, fecha: '2026-03-25T10:30:00', usuarioNombre: 'Carolina Restrepo', rol: ROLES.ADMIN, nota: 'Solicitud de matrícula registrada' },
            { estado: ESTADOS.ACTIVA, fecha: '2026-04-01T09:00:00', usuarioNombre: 'Carolina Restrepo', rol: ROLES.ADMIN, nota: 'Matrícula aprobada' }
          ],
          creadoEn: '2026-03-25T10:30:00'
        },
        {
          id: 'nin-006', guarderiaId: 'gua-1', grupoId: 'gru-4',
          nombres: 'Thomas', apellidos: 'Beltrán Ávila', genero: 'M',
          fechaNacimiento: '2023-07-18',
          acudientes: [
            { nombre: 'Mónica Ávila Prada', tipoDoc: 'CC', documento: '52334455', parentesco: 'Madre', telefono: '3031234567', email: 'monica@mail.com' }
          ],
          contactoEmergencia: { nombre: 'Hernán Beltrán Ríos', telefono: '3039876543', parentesco: 'Padre' },
          medica: {
            eps: 'Famisanar', alergias: 'Ninguna', condiciones: 'Ninguna',
            medicamentos: 'Ninguno', observaciones: ''
          },
          estado: ESTADOS.ACTIVA, fechaIngreso: '2026-01-15', fechaRetiro: null,
          valorMatricula: 350000, valorMensualidad: 540000,
          historial: [
            { estado: ESTADOS.PENDIENTE, fecha: '2026-01-08T08:00:00', usuarioNombre: 'Carolina Restrepo', rol: ROLES.ADMIN, nota: 'Solicitud de matrícula registrada' },
            { estado: ESTADOS.ACTIVA, fecha: '2026-01-15T08:20:00', usuarioNombre: 'Carolina Restrepo', rol: ROLES.ADMIN, nota: 'Matrícula aprobada' }
          ],
          creadoEn: '2026-01-08T08:00:00'
        },
        {
          id: 'nin-007', guarderiaId: 'gua-1', grupoId: 'gru-1',
          nombres: 'Emma', apellidos: 'Salazar Nieto', genero: 'F',
          fechaNacimiento: '2025-12-01',
          acudientes: [
            { nombre: 'Laura Nieto Rangel', tipoDoc: 'CC', documento: '1026778899', parentesco: 'Madre', telefono: '3041234567', email: 'lauran@mail.com' },
            { nombre: 'Julián Salazar Cano', tipoDoc: 'CE', documento: '456789012', parentesco: 'Padre', telefono: '3049876543', email: 'julian@mail.com' }
          ],
          contactoEmergencia: { nombre: 'Julián Salazar Cano', telefono: '3049876543', parentesco: 'Padre' },
          medica: {
            eps: 'Salud Total', alergias: 'Ninguna', condiciones: 'Dermatitis atópica',
            medicamentos: 'Crema hidratante', observaciones: 'Aplicar crema después de la siesta'
          },
          estado: ESTADOS.PENDIENTE, fechaIngreso: null, fechaRetiro: null,
          valorMatricula: 350000, valorMensualidad: 560000,
          historial: [
            { estado: ESTADOS.PENDIENTE, fecha: '2026-10-12T16:40:00', usuarioNombre: 'Carolina Restrepo', rol: ROLES.ADMIN, nota: 'Solicitud de matrícula registrada, pendiente de aprobación' }
          ],
          creadoEn: '2026-10-12T16:40:00'
        },
        {
          id: 'nin-008', guarderiaId: 'gua-1', grupoId: 'gru-3',
          nombres: 'Lucas', apellidos: 'Herrera Pinto', genero: 'M',
          fechaNacimiento: '2024-02-02',
          acudientes: [
            { nombre: 'Sandra Pinto Medina', tipoDoc: 'CC', documento: '52667788', parentesco: 'Madre', telefono: '3051234567', email: 'sandra@mail.com' }
          ],
          contactoEmergencia: { nombre: 'Óscar Herrera Gil', telefono: '3059876543', parentesco: 'Padre' },
          medica: {
            eps: 'Sanitas', alergias: 'Ninguna', condiciones: 'Ninguna',
            medicamentos: 'Ninguno', observaciones: ''
          },
          estado: ESTADOS.RETIRADA, fechaIngreso: '2026-02-01', fechaRetiro: '2026-07-20',
          valorMatricula: 350000, valorMensualidad: 520000,
          historial: [
            { estado: ESTADOS.PENDIENTE, fecha: '2026-01-26T09:00:00', usuarioNombre: 'Carolina Restrepo', rol: ROLES.ADMIN, nota: 'Solicitud de matrícula registrada' },
            { estado: ESTADOS.ACTIVA, fecha: '2026-02-01T09:30:00', usuarioNombre: 'Carolina Restrepo', rol: ROLES.ADMIN, nota: 'Matrícula aprobada' },
            { estado: ESTADOS.RETIRADA, fecha: '2026-07-20T15:00:00', usuarioNombre: 'Carolina Restrepo', rol: ROLES.ADMIN, nota: 'Retiro voluntario por traslado de ciudad' }
          ],
          creadoEn: '2026-01-26T09:00:00'
        },
        {
          id: 'nin-009', guarderiaId: 'gua-2', grupoId: 'gru-5',
          nombres: 'Daniel', apellidos: 'Osorio Vega', genero: 'M',
          fechaNacimiento: '2025-05-05',
          acudientes: [
            { nombre: 'Claudia Vega Rojas', tipoDoc: 'CC', documento: '1015667788', parentesco: 'Madre', telefono: '3061234567', email: 'claudia@mail.com' }
          ],
          contactoEmergencia: { nombre: 'Mario Osorio León', telefono: '3069876543', parentesco: 'Padre' },
          medica: {
            eps: 'Sura', alergias: 'Ninguna', condiciones: 'Ninguna',
            medicamentos: 'Ninguno', observaciones: ''
          },
          estado: ESTADOS.ACTIVA, fechaIngreso: '2026-05-04', fechaRetiro: null,
          valorMatricula: 300000, valorMensualidad: 450000,
          historial: [
            { estado: ESTADOS.PENDIENTE, fecha: '2026-04-28T10:00:00', usuarioNombre: 'Héctor Lozano', rol: ROLES.ADMIN, nota: 'Solicitud de matrícula registrada' },
            { estado: ESTADOS.ACTIVA, fecha: '2026-05-04T10:15:00', usuarioNombre: 'Héctor Lozano', rol: ROLES.ADMIN, nota: 'Matrícula aprobada' }
          ],
          creadoEn: '2026-04-28T10:00:00'
        }
      ];

      /* ---------- Pagos (HU-03) ----------
         Se dejan casos variados a propósito: alumnos al día, alumnos con
         uno o dos períodos en mora y un alumno retirado.               */
      var pagos = []
        /* Sofía: matrícula + febrero a agosto (septiembre y octubre pendientes) */
        .concat([pagoMatricula('nin-001', '2026-02-03', 350000, 'Transferencia', cajero)])
        .concat(pagosMensualidad('nin-001', '2026-02', '2026-08', 520000, 'Transferencia', cajero))
        /* Mateo: matrícula + febrero a septiembre (octubre pendiente) */
        .concat([pagoMatricula('nin-002', '2026-02-03', 350000, 'Transferencia', cajero)])
        .concat(pagosMensualidad('nin-002', '2026-02', '2026-09', 480000, 'Transferencia', cajero))
        /* Valentina: al día */
        .concat([pagoMatricula('nin-003', '2026-03-02', 350000, 'PSE', cajero)])
        .concat(pagosMensualidad('nin-003', '2026-03', '2026-10', 540000, 'PSE', cajero))
        /* Isabella: matrícula + abril a agosto (dos períodos en mora) */
        .concat([pagoMatricula('nin-005', '2026-04-01', 350000, 'Efectivo', cajero)])
        .concat(pagosMensualidad('nin-005', '2026-04', '2026-08', 480000, 'Efectivo', cajero))
        /* Thomas: al día */
        .concat([pagoMatricula('nin-006', '2026-01-15', 350000, 'Tarjeta débito', cajero)])
        .concat(pagosMensualidad('nin-006', '2026-01', '2026-10', 540000, 'Tarjeta débito', cajero))
        /* Lucas (retirado): pagos hasta el mes de su retiro */
        .concat([pagoMatricula('nin-008', '2026-02-01', 350000, 'Efectivo', cajero)])
        .concat(pagosMensualidad('nin-008', '2026-02', '2026-07', 520000, 'Efectivo', cajero))
        /* Daniel (segunda guardería) */
        .concat([pagoMatricula('nin-009', '2026-05-04', 300000, 'PSE', cajero)])
        .concat(pagosMensualidad('nin-009', '2026-05', '2026-10', 450000, 'PSE', cajero));

      /* ---------- Bitácora inicial (RNF-02) ---------- */
      var auditoria = [{
        id: U.uid('log'),
        fecha: U.ahora(),
        accion: 'Carga de datos de demostración',
        detalle: ninos.length + ' niños, ' + grupos.length + ' grupos, ' + usuarios.length +
          ' usuarios y ' + pagos.length + ' pagos iniciales',
        usuarioId: null,
        usuarioNombre: 'sistema',
        rol: 'sistema'
      }];

      return {
        version: Seed.VERSION,
        creadoEn: U.ahora(),
        guarderias: guarderias,
        grupos: grupos,
        usuarios: usuarios,
        ninos: ninos,
        pagos: pagos,
        auditoria: auditoria
      };
    }
  };

  global.Seed = Seed;
  global.ROLES = ROLES;
  global.ESTADOS = ESTADOS;
})(window);
