# Feature pendiente: servicio obligatorio en consultas sin cita

> **Estado:** propuesta, pendiente de decisión. No implementada.
> **Fecha:** 2026-09-30.

## Problema

Una consulta que **no viene de una cita** (urgencia, atención no prevista, jornada de vacunación en un parque) puede quedar sin el servicio de la visita. El médico abre la consulta directamente en el Content Manager, atiende a los pacientes que van llegando y se olvida de indicar qué servicio prestó. Esa consulta llega a Facturación sin nada que cobrar.

Las consultas que vienen de la agenda no tienen este problema: el servicio se elige al reservar (modal "Reservar cita"), llega a la consulta como línea aplicada y el médico lo corrige en el panel "Atención" si hace falta.

### Por qué no basta con el panel

- En una consulta sin cita no hay nada que "cerrar": no existe una cita que pase a "Atendida". Si la obligación está solo en el botón "Finalizar atención" y el médico no lo pulsa, la consulta queda sin servicio igual.
- El panel lateral solo funciona con la consulta ya guardada (antes no tiene `documentId`), así que no sirve como único control en la creación.

El único momento seguro para exigir el servicio es **al guardar la consulta**.

## Opciones consideradas

| Opción | Qué hace | Por qué sí / por qué no |
| --- | --- | --- |
| **1. Obligatorio al guardar (recomendada)** | Regla del servidor: una consulta sin cita no se guarda sin un servicio aplicado. | No se puede olvidar. Dos clics más por paciente. |
| 2. Obligatorio solo en el panel | El selector sale vacío y "Finalizar atención" exige elegir. | No protege del olvido si no se pulsa Finalizar. La única red es la etiqueta "Sin cargo de consulta" en Facturación. |
| 3. "Atender sin cita" desde la agenda | Crea una cita interna (mascota + servicio) y abre la consulta desde ella. | Más trabajo, y en una jornada con pacientes seguidos choca con la regla de no solapar citas del mismo profesional. |

**Recomendación: opción 1 + el atajo "consulta anterior".**

## Cómo funcionaría (opción 1 + atajo)

### Flujo del médico en una jornada de vacunación

1. **Abre una consulta nueva:** Content Manager → Consulta → Crear una entrada. Elige la mascota y escribe el motivo y lo que necesite de la historia.
2. **Indica el servicio,** de una de dos maneras:
   - **Desde el panel lateral "Atención",** que saldría también antes de guardar: *"Consulta sin cita · Servicio de la visita"*, con el selector **vacío** y, si ese día ya registró otra consulta sin cita, el atajo **"Usar el de la consulta anterior: Aplicación de vacuna"**. Al pulsarlo, o al elegir en el selector, el panel añade la tarjeta **Servicio** en "Servicios y productos" del formulario. No guarda todavía.
   - **A mano,** añadiendo la tarjeta "Servicio" en "Servicios y productos".
3. **Guarda:**
   - **Con servicio:** se guarda y el panel muestra *"Atendida · Aplicación de vacuna"* con **Guardar servicio** para corregirlo.
   - **Sin servicio:** no se guarda y sale el aviso *"Indica el servicio de la visita (tarjeta Servicio en Servicios y productos)"*. Lo escrito sigue en el formulario.
4. **Siguiente paciente:** consulta nueva; el atajo ofrece otra vez el mismo servicio con un clic.
5. **Facturación:** cada consulta aparece en Pendientes de cobro con su servicio, y Recepción decide si se cobra (una cortesía va con descuento del 100 % en el renglón).

### Reglas del servidor (`src/validations/clinical.ts`)

- **A qué consultas aplica:** solo a las que no tienen `appointment`. Las de la agenda no cambian.
- **Qué cuenta como servicio:** una línea `clinical.service-line` con `state: 'applied'`. Un servicio `recommended` no cuenta, y un producto tampoco. En una jornada lo normal es "Aplicación de vacuna" (servicio) más el producto de la vacuna.
- **Cuándo se comprueba:** al crear y en cada guardado. Tampoco se puede quitar el último servicio aplicado de una consulta sin cita.
- **Dónde:** en el middleware del Document Service, como el resto de reglas del proyecto, para que no se pueda saltar desde el formulario ni desde un script.

### El atajo "consulta anterior"

- **Qué propone:** el servicio de visita de la última consulta sin cita del **mismo médico** (`vet` = la cuenta del panel) en **el mismo día**, en la zona horaria de Clínica.
- **Nunca rellena solo:** el médico tiene que pulsarlo. Si no hay consulta anterior ese día, no aparece.
- Necesita un endpoint nuevo en el plugin de agenda, por ejemplo `GET /veterinaria-agenda/consultations/last-walk-in-service`, con el permiso `agenda.finalizar`.

### Cambios en el panel "Atención" para consultas sin cita

- **Sale antes de guardar**, con el selector y el atajo. Hoy, sin `documentId`, solo pide guardar primero.
- **Sin "Finalizar atención":** una consulta sin cita queda atendida al guardarla con su servicio. Quedan "Guardar servicio" para corregir y la etiqueta "Atendida".

## Efectos a tener en cuenta

- **Consultas antiguas sin cita y sin servicio:** se abren normal, pero al volver a guardarlas se pedirá el servicio.
- **Scripts:** `demo-clinica.js`, `demo-data.js`, `smoke-validations.js` y las pruebas que creen consultas sin cita tendrán que indicar su servicio. Conviene añadir a `smoke-validations.js` la aserción de que una consulta sin cita y sin servicio se rechaza.
- **Documento de modelo:** añadir la regla a la tabla de reglas de `api::clinical.consultation` en `strapi-veterinaria-prompt.md` (sección de validaciones) y a CLAUDE.md.

## Riesgo técnico a verificar antes de empezar

El panel tendría que **escribir en el formulario antes de guardar**: añadir una tarjeta a la dynamic zone `lines` con la API interna del formulario del Content Manager (`useForm` de `@strapi/strapi/admin`, `onChange('lines', …)`). Hay que comprobar:

- **La forma de una tarjeta nueva:** `__component`, clave temporal, y la relación `service` en formato `connect` con lo que el selector necesita para pintarla.
- **Que el formulario la acepte y la guarde** como si el usuario la hubiera añadido a mano.

Si resulta frágil, se descarta el atajo desde el panel y el médico añade la tarjeta a mano. La regla del servidor funciona igual, así que el olvido queda cubierto en cualquier caso.

## Contexto: lo que ya existe (2026-09-30)

- **Reservar cita:** el modal pide el servicio (preseleccionado el "Servicio de consulta por defecto" de Clínica) y `abrirConsulta` lo copia como línea aplicada.
- **Panel "Atención":** en consultas guardadas muestra siempre el "Servicio de la visita" (la primera línea `service-line` `applied`), permite corregirlo y cerrar la atención. Con cita, finalizar cierra la cita; sin cita, finalizar registra el servicio.
- **Cierre nocturno** (`src/bootstrap/cierre-citas.ts`): cierra las citas atendidas que nadie cerró y les añade el servicio por defecto si falta.
- **Facturación:** decide si se cobra. En Pendientes de cobro marca como "Sin cargo de consulta" las consultas atendidas (o sin cita) sin ningún servicio aplicado. Hoy esa es la única red para el caso descrito aquí.
