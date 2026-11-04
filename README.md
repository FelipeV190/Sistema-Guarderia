# Proyecto_FIS
Repositorio del Proyecto de Fundamentos de Ingeniería de Software

Integrantes: 
Sarahy Michelle Silva Pinto 
Luis Felipe Velasquez Muñoz 
Beiker Romario Jaramillo Giraldo 
Mateo Galindo Bravo

---

## Sistema de gestión para guarderías

Implementación de los requerimientos y las historias de usuario de `docs/EntregaFIS.pdf`.
Aplicación web en HTML, CSS y JavaScript puro: **se abre con doble clic en `index.html`**,
sin servidor ni instalación.

- Manual, trazabilidad de los 18 requerimientos funcionales y decisiones de diseño:
  **[SISTEMA.md](SISTEMA.md)**
- Dentro de la aplicación: menú **Requerimientos** (trazabilidad en vivo y pruebas de seguridad).

### Usuarios de prueba

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@guarderia.co` | `admin123` |
| Docente | `laura@guarderia.co` | `docente123` |
| Personal Administrativo | `pagos@guarderia.co` | `pagos123` |
| Acudiente | `ana@mail.com` | `acudiente123` |

En la pantalla de ingreso se puede hacer clic sobre cualquier usuario de prueba para
autocompletar las credenciales.

### Módulos

| Historia | Módulo |
|---|---|
| HU-01 | Lista de niños y ficha, restringida al grupo del docente |
| HU-02 | Matrículas: registro, edición, aprobación y historial de estados |
| HU-03 | Pagos: registro, saldos, estado de cuenta y comprobante imprimible |
| HU-04 | Portal del acudiente con acceso autenticado y limitado a sus menores |
| HU-05 | Grupos etarios con capacidad y clasificación automática por edad |
| HU-06 | Asignación de docentes a grupos |

### Pruebas

```bash
npm test          # 77 pruebas de reglas de negocio
npm install       # solo para la suite de interfaz (jsdom)
npm run test:ui   # 62 pruebas de interfaz
```
