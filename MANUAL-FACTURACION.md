# Manual de facturación

Paso a paso para cobrar en el sistema los servicios y productos de la clínica: desde lo que el veterinario registra en la consulta hasta la factura emitida, su PDF, el pago y la anulación.

Todo se hace en el panel (`/admin`). Cada persona entra con su propio correo y contraseña. Para registrar primero al cliente y su mascota, ver `MANUAL-CLIENTES-MASCOTAS.md`.

---

## Antes de empezar

### El recorrido completo

```
1. Catálogo con precio e IVA          (Administración, una vez por servicio o producto)
2. Consulta con servicios y productos (Veterinario)
3. Borrador con lo que se cobra       (Recepción)
4. Ajustes: descuentos, más conceptos (Recepción)
5. Emitir: recibe el número DIAN      (Recepción)
6. PDF y pago                         (Recepción)
7. Anular si hubo un error            (Administración)
```

### Tres ideas que conviene tener claras

- **Lo que se cobra sale de la consulta.** Cada servicio o producto registrado en la consulta es un *concepto* que queda **pendiente de cobro** hasta que entra en una factura.
- **Una factura empieza como borrador:** sin número y editable. **Emitir** le da el número de la resolución DIAN (ej.: `FE131`) y la congela; si después hay un error, se **anula**.
- **Nada se cobra dos veces.** Un concepto que ya está en una factura no se puede poner en otra.

### Quién puede hacer qué

| Acción | Recepción | Veterinario | Administración |
| --- | :---: | :---: | :---: |
| Ver pendientes, facturas y PDF | ✔ | ✔ | ✔ |
| Crear y ajustar borradores | ✔ | — | ✔ |
| Cambiar el precio de un concepto | ✔ | — | ✔ |
| Emitir y registrar pagos | ✔ | — | ✔ |
| Anular facturas | — | — | ✔ |
| Crear servicios y productos en el catálogo | — | — | ✔ |

Si a alguien le falta un botón de este manual, es que su rol no tiene ese permiso (se ajusta en **Ajustes → Roles**).

### Cómo leer las tablas de campos

Cada tarea empieza con una tabla de los campos que verás en esa pantalla:

| Columna | Qué indica |
| --- | --- |
| **Campo** | El nombre tal como aparece en pantalla |
| **Descripción** | Para qué sirve y cómo se llena |
| **Obligatorio** | **Sí** — sin él no se puede guardar. **Para facturar** — se puede guardar sin él, pero entonces no se puede cobrar. **No** — opcional. **Automático** — lo llena el sistema; no lo toques. **Solo lectura** — se ve pero no se cambia |
| **Ejemplo** | Un valor válido |

---

## Tarea 1 — Dejar listo un servicio en el catálogo (Administración)

Sin precio y sin IVA, un servicio **no se puede facturar**. Se hace una sola vez por servicio.

### Campos del servicio

| Campo | Descripción | Obligatorio | Ejemplo |
| --- | --- | :---: | --- |
| Nombre | Nombre del servicio, como saldrá en la factura. No se repite dentro de la misma categoría. Máximo 120 caracteres | **Sí** | `Consulta general` |
| Categoría | Grupo al que pertenece (Consulta, Vacunación, Estética, Cirugía, Laboratorio…) | **Sí** | `Consulta` |
| Descripción | Explicación del servicio | No | `Valoración general del paciente` |
| Duración por defecto (min) | Minutos que ocupa en la agenda. Mínimo 5 | **Sí** | `30` |
| Precio base | Valor en pesos **sin IVA** y sin puntos | **Para facturar** | `60000` |
| Moneda | Moneda del precio | No (queda `COP`) | `COP` |
| Impuestos → Tratamiento de IVA | `gravado`, `exento` o `excluido` | **Para facturar** | `gravado` |
| Impuestos → Tarifa de IVA (%) | Si es gravado: `19` o `5`. Si es exento o excluido: `0` (el sistema la pone en 0) | **Para facturar** si es gravado | `19` |
| Color | Color con el que se pinta en la agenda | No | `#2F80ED` |
| Activo | Si está desmarcado, no se ofrece en la venta directa | No (queda activo) | ✔ |

### Paso a paso

1. Ve a **Content Manager → Servicio**.
2. Abre el servicio (ej.: `Consulta general`) o pulsa **Crear nueva entrada** si es nuevo.
3. Llena **Nombre**, **Categoría** y **Duración por defecto (min)** si es nuevo.
4. En **Precio base**, escribe el valor sin IVA. Ej.: `60000`.
5. En **Impuestos**, elige **Tratamiento de IVA** = `gravado` y **Tarifa de IVA (%)** = `19`.
6. Pulsa **Guardar**.

> Los servicios de la clínica van **gravados al 19 %**.

---

## Tarea 2 — Dejar listo un producto en el catálogo (Administración)

### Campos del producto

| Campo | Descripción | Obligatorio | Ejemplo |
| --- | --- | :---: | --- |
| Nombre | Nombre comercial. Máximo 150 caracteres | **Sí** | `Meloxicam suspensión oral` |
| Tipo de producto | Clase de producto (ver tabla de valores). Decide qué datos extra pide | **Sí** | `medication` |
| Categoría | Grupo comercial libre (Antiparasitarios, Concentrados…) | No | `Antiinflamatorios` |
| Marca | Laboratorio o fabricante. Máximo 100 caracteres | No | `Boehringer Ingelheim` |
| Presentación | Cómo viene. Máximo 120 caracteres. Sale en la factura junto al nombre | No | `Frasco 10 ml` |
| Unidad de venta | Cómo se vende (ver tabla). Sale en la factura | **Sí** (queda `unit`) | `bottle` |
| Código interno (SKU) | Código propio de la clínica. No se repite. Máximo 40 caracteres | No | `MEL-10ML` |
| Código de barras | No se repite. Máximo 40 caracteres | No | `7702026123456` |
| Descripción | Detalle del producto | No | — |
| Imagen | Foto del producto | No | — |
| Especies | Para qué especies es | No | `Perro`, `Gato` |
| Precio de venta (antes de IVA) | Valor en pesos, sin IVA | **Para facturar** | `42000` |
| Moneda | Moneda del precio | No (queda `COP`) | `COP` |
| Impuestos → Tratamiento de IVA | `gravado`, `exento` o `excluido` | **Para facturar** | `excluido` |
| Impuestos → Tarifa de IVA (%) | Si es gravado: `19` o `5`. Si no: `0` | **Para facturar** si es gravado | `0` |
| Costo de referencia | Lo que le cuesta a la clínica. Es privado: no sale en la factura ni en la app | No | `28000` |
| Proveedor habitual | A quién se le compra (solo lo ve Administración) | No | — |
| Controla inventario | Preparado para el control de existencias (aún no descuenta nada) | No | ✔ |
| Controla lotes y vencimientos | Igual; en medicamentos queda marcado | No | ✔ |
| Existencia mínima | Cantidad para avisar de reposición (futuro) | No | `5` |
| Datos específicos del tipo | Bloque según el tipo: forma farmacéutica y principios activos (medicamento), vacuna clínica (vacuna), datos de alimento o de accesorio | **Sí** en medicamentos y vacunas | — |
| Activo | Si está desmarcado, no se ofrece en la venta directa | No (queda activo) | ✔ |
| Etiqueta de búsqueda | Nombre, presentación y marca juntos. La escribe el sistema | Automático | `Meloxicam suspensión oral · Frasco 10 ml · Boehringer Ingelheim` |

**Valores de las listas:**

| Tipo de producto | Significa | | Unidad de venta | Significa |
| --- | --- | --- | --- | --- |
| `medication` | Medicamento | | `unit` | unidad |
| `vaccine` | Vacuna | | `box` | caja |
| `food` | Alimento | | `bottle` | frasco |
| `toy` | Juguete | | `vial` | vial |
| `accessory` | Accesorio | | `bag` | bolsa |
| `hygiene` | Higiene | | `tablet` | tableta |
| `supply` | Insumo | | `dose` | dosis |
| `other` | Otro | | `ml` / `g` / `kg` | mililitros / gramos / kilos |

### Paso a paso

1. Ve a **Content Manager → Producto**.
2. Abre el producto o pulsa **Crear nueva entrada**.
3. Llena **Nombre**, **Tipo de producto** y **Unidad de venta**.
4. En **Precio de venta (antes de IVA)**, escribe el valor.
5. En **Impuestos**, elige el tratamiento y la tarifa.
6. Si es medicamento o vacuna, pulsa **Agregar un componente** en **Datos específicos del tipo** y llena el bloque.
7. Llena los opcionales que tengas (marca, presentación, códigos, imagen…).
8. Pulsa **Guardar**.

> **Cambiar un precio no cambia las facturas ya hechas.** Cada concepto guarda el precio que tenía el catálogo cuando se añadió a la factura.

---

## Tarea 3 — Registrar en la consulta lo que se va a cobrar (Veterinario)

En la consulta, la sección **Servicios y productos** tiene dos tipos de tarjeta: **Servicio** y **Producto**.

### Campos de la tarjeta *Servicio*

| Campo | Descripción | Obligatorio | Ejemplo |
| --- | --- | :---: | --- |
| Servicio | El servicio del catálogo que se prestó o se recomienda | **Sí** | `Consulta general` |
| Cantidad | Cuántas veces. Admite decimales; mínimo 0,01 | **Sí** (queda `1`) | `1` |
| Aplicado o recomendado | `applied` = se prestó (se cobra). `recommended` = se recomienda (no se cobra) | **Sí** (queda `applied`) | `applied` |
| Notas | Observaciones de esta línea | No | `Revisión de oídos incluida` |
| Nombre (se rellena al guardar) | El nombre del servicio, para verlo con la tarjeta cerrada | Automático | `Consulta general` |
| Clave de facturación (automática) | Identifica la línea para que no se cobre dos veces | Automático | — |

### Campos de la tarjeta *Producto*

| Campo | Descripción | Obligatorio | Ejemplo |
| --- | --- | :---: | --- |
| Producto | El producto del catálogo | **Sí** | `Meloxicam suspensión oral` |
| Cantidad | Cuántas unidades de venta. Admite decimales (media tableta, 2,5 ml); mínimo 0,01 | **Sí** (queda `1`) | `2` |
| Aplicado, entregado o recomendado | `applied` = se usó en la clínica (se cobra). `dispensed` = el cliente se lo lleva (se cobra). `recommended` = se recomienda (no se cobra) | **Sí** (queda `applied`) | `dispensed` |
| Notas | Indicaciones de esta línea | No | `1 ml cada 24 h por 5 días` |
| Nombre (se rellena al guardar) | Nombre del producto con su presentación | Automático | — |
| Clave de facturación (automática) | Identifica la línea para la facturación | Automático | — |

### Paso a paso

1. Abre la consulta: desde la **Agenda** (cita → **Atender y crear consulta**) o en **Content Manager → Consulta**.
2. Baja a la sección **Servicios y productos**.
3. Pulsa **Agregar un componente** y elige **Servicio** o **Producto**.
4. En la tarjeta nueva, elige el servicio o producto, escribe la **cantidad** y elige el **estado**.
5. Repite los pasos 3 y 4 por cada cosa que se hizo o se entregó.
6. Pulsa **Guardar**.

> **La consulta en sí también se cobra:** es la tarjeta del servicio `Consulta general`. Si la consulta se abrió desde la Agenda, los servicios agendados en la cita ya vienen puestos como `applied`; quita o pasa a `recommended` lo que no se hizo.

> **Hay que guardar.** Lo que no está guardado no aparece en Facturación.

---

## Tarea 4 — Crear la factura de una consulta (Recepción)

### Campos de la pantalla de la consulta (en Facturación)

| Campo | Descripción | Obligatorio | Ejemplo |
| --- | --- | :---: | --- |
| Resumen | Situación de cobro de toda la consulta: Sin facturar, Facturada en parte, Facturada, Sin conceptos cobrables | Solo lectura | `Sin facturar` |
| Pendientes | Cuántos conceptos faltan por cobrar | Solo lectura | `2` |
| Valor pendiente (estimado) | Lo que sumarían con los precios de hoy, IVA incluido | Solo lectura | `$ 155.400` |
| Casilla (primera columna) | Marca qué conceptos entran en esta factura. Solo aparece en los que se pueden cobrar | Al menos una | ✔ |
| Concepto | Nombre del servicio o producto, y si es servicio o producto | Solo lectura | `Consulta general · Servicio` |
| Cantidad | La registrada en la consulta | Solo lectura | `1` |
| En la consulta | Estado clínico: Aplicado, Entregado o Recomendado | Solo lectura | `Aplicado` |
| Cobro | **Pendiente** (se puede cobrar), **Facturada** (ya está en una factura) o **No facturable** (con el motivo) | Solo lectura | `Pendiente` |
| Valor estimado | Total del concepto con el catálogo de hoy. Si el catálogo está incompleto, dice qué falta | Solo lectura | `$ 71.400` |
| Factura | Enlace a la factura que lo cobra, o las anuladas que lo cobraron antes | Solo lectura | `FE129` |

### Paso a paso

1. Entra por uno de estos tres caminos:
   - **a.** Menú **Facturación** → pestaña **Pendientes de cobro** → pulsa la fila de la consulta (o **Facturar**).
   - **b.** Dentro de la consulta, en el recuadro **Facturación** del lateral derecho → **Facturar**.
   - **c.** En la **Agenda**, abre la cita → **Facturar**.
2. Revisa la columna **Cobro** de cada concepto.
3. Deja marcado lo que se cobra ahora y desmarca lo que no. Lo desmarcado sigue pendiente para otra factura.
4. Revisa el total seleccionado que aparece debajo de la tabla.
5. Pulsa **Crear borrador con N concepto(s)**.
6. Se abre el borrador. Sigue con la **Tarea 5** si hay que ajustar algo, o con la **Tarea 7** para emitir.

> Si un concepto pendiente dice *sin precio de venta* o *sin perfil tributario (IVA)*, no tiene casilla: hay que completar el catálogo (Tareas 1 y 2) y volver.

**Ejemplo.** La consulta de Kira tiene:

| Concepto | Cantidad | Estado | Precio | IVA |
| --- | --- | --- | --- | --- |
| Consulta general | 1 | `applied` | $ 60.000 | 19 % |
| Meloxicam suspensión oral | 2 | `dispensed` | $ 42.000 | excluido |
| Nobivac Rabies | 1 | `recommended` | $ 38.000 | excluido |

Aparecen dos pendientes; Nobivac sale como *No facturable (estado "recommended")*. El borrador queda así:

| Concepto | Subtotal | IVA | Total |
| --- | ---: | ---: | ---: |
| Consulta general (1) | $ 60.000 | $ 11.400 | $ 71.400 |
| Meloxicam (2 × $ 42.000) | $ 84.000 | $ 0 | $ 84.000 |
| **Total** | **$ 144.000** | **$ 11.400** | **$ 155.400** |

---

## Tarea 5 — Modificar un borrador

Mientras la factura es **borrador**, todo se puede cambiar. Se hace en la pantalla de la factura (**Facturación → pestaña Facturas →** pulsa el borrador).

### Campos de la pantalla de la factura

**Recuadro *Documento* y *Cliente*:**

| Campo | Descripción | Obligatorio | Ejemplo |
| --- | --- | :---: | --- |
| Estado | Borrador, Emitida, Error DIAN o Anulada | Solo lectura | `Borrador` |
| Creado / Emitida | Fecha de creación (borrador) o de emisión | Solo lectura | `29 sept. 2026` |
| Cliente → Nombre, Documento, Dirección, Correo | En un borrador, los datos actuales del cliente. Al emitir se congelan | Solo lectura | `María Restrepo` |

**Tabla de conceptos:**

| Campo | Descripción | Obligatorio | Ejemplo |
| --- | --- | :---: | --- |
| Concepto | Nombre, tipo y, si sale de una consulta, enlace a ella con la fecha y la mascota | Solo lectura | `Consulta general · Servicio de consulta · consulta del 29 sept. 2026 · Kira` |
| Cant. | Cantidad. **Editable solo en venta directa**; en conceptos de consulta la manda la consulta | Sí | `1` |
| V. unitario | Precio unitario sin IVA, copiado del catálogo. **Editable solo con permiso de emitir** | Sí | `60000` |
| Descuento | Descuento **en pesos** para ese concepto. Máximo, el valor del concepto | No (queda `0`) | `6000` |
| IVA | Tarifa o tratamiento copiado del catálogo | Solo lectura | `19 %` |
| Subtotal | Cantidad × precio − descuento | Automático | `$ 54.000` |
| Total | Subtotal + IVA | Automático | `$ 64.260` |
| Papelera | Quita el concepto del borrador | — | — |

**Totales y observaciones:**

| Campo | Descripción | Obligatorio | Ejemplo |
| --- | --- | :---: | --- |
| Subtotal | Suma de los conceptos antes de descuentos | Automático | `$ 144.000` |
| Descuentos | Suma de los descuentos | Automático | `- $ 6.000` |
| IVA | Suma del IVA | Automático | `$ 10.260` |
| Total | Lo que paga el cliente | Automático | `$ 148.260` |
| Observaciones | Texto libre que sale en el PDF | No | `Control en 8 días` |

### 5.1 Poner un descuento a un concepto

1. En la columna **Descuento** del concepto, escribe el valor **en pesos**. Ej.: `6000`.
2. Sal del campo (Tab o clic fuera). La factura se recalcula sola.

*Ejemplo:* $ 6.000 de descuento en la consulta → base $ 54.000, IVA $ 10.260, total $ 64.260. El IVA se calcula sobre el valor ya descontado.

### 5.2 Dar un concepto de cortesía

1. En **Descuento**, escribe el valor completo del concepto (el 100 %).
2. Sal del campo.

Así queda constancia de que se prestó y no se cobró.

### 5.3 Cambiar el precio de un concepto

Solo quien puede emitir facturas. Úsalo para excepciones; lo normal es corregir el catálogo.

1. En la columna **V. unitario**, escribe el precio nuevo.
2. Sal del campo.

### 5.4 Cambiar la cantidad

- **Concepto de una consulta:** no se cambia aquí. Quita el concepto (5.7), corrige la consulta y vuelve a añadirlo (5.6).
- **Concepto de venta directa:**
  1. Escribe la cantidad nueva en la columna **Cant.**
  2. Sal del campo.

### 5.5 Añadir un producto o servicio del catálogo

**Campos de *Añadir conceptos → Del catálogo*:**

| Campo | Descripción | Obligatorio | Ejemplo |
| --- | --- | :---: | --- |
| Buscar servicio o producto | Parte del nombre. Muestra hasta 10 servicios y 10 productos activos, con su precio | No | `collar` |
| Resultado | Nombre, si es servicio o producto, precio, y si le falta algo en el catálogo | Solo lectura | `Collar isabelino · Producto · $ 28.000` |
| Añadir | Añade 1 unidad al borrador. Desactivado si al catálogo le falta precio o IVA | — | — |

1. Pulsa **Añadir conceptos**.
2. Quédate en la pestaña **Del catálogo**.
3. Escribe parte del nombre en **Buscar servicio o producto**.
4. Pulsa **Añadir** junto al que quieres.

### 5.6 Añadir conceptos de otra consulta del mismo cliente

Útil cuando el cliente trajo **dos mascotas**: una sola factura para las dos.

**Campos de *Añadir conceptos → De otras consultas del cliente*:**

| Campo | Descripción | Obligatorio | Ejemplo |
| --- | --- | :---: | --- |
| Consulta | Consultas del mismo cliente con conceptos pendientes: fecha, mascota, cuántos y cuánto | Elegir una | `2 oct. 2026 · Toby · 1 pendiente(s) · $ 45.000` |
| Casilla de cada concepto | Los conceptos pendientes de esa consulta | Al menos una | ✔ |

1. Pulsa **Añadir conceptos**.
2. Cambia a la pestaña **De otras consultas del cliente**.
3. Pulsa la consulta de la otra mascota.
4. Marca los conceptos que se cobran.
5. Pulsa **Añadir N concepto(s)**.

### 5.7 Quitar un concepto

1. Pulsa el icono de **papelera** del concepto.

El concepto vuelve a quedar pendiente de cobro.

### 5.8 Escribir observaciones

1. Escribe en el recuadro **Observaciones**.
2. Pulsa **Guardar observaciones**.

### 5.9 Ver cómo va a quedar

1. Pulsa **Vista previa**.

Se abre el PDF con la marca de agua **BORRADOR**. No tiene validez.

### 5.10 Descartar el borrador

1. Pulsa **Eliminar borrador**.
2. Confirma con **Eliminar**.

El borrador desaparece y todos sus conceptos vuelven a pendientes.

---

## Tarea 6 — Venta directa (sin consulta)

Para vender algo sin que haya consulta: alimento, un collar, un juguete, un baño.

### Campos de *Nueva venta directa*

| Campo | Descripción | Obligatorio | Ejemplo |
| --- | --- | :---: | --- |
| Buscar cliente por nombre o documento | Parte del nombre o de la cédula. Muestra hasta 15 clientes | Elegir uno | `Restrepo` / `1017` |
| Resultado | Nombre y documento del cliente | — | `María Restrepo · CC 1017254398` |

### Paso a paso

1. Ve a **Facturación**.
2. Pulsa **Venta directa** (arriba a la derecha).
3. En **Buscar cliente por nombre o documento**, escribe el nombre o la cédula.
4. Pulsa el cliente en la lista. Se abre un borrador vacío a su nombre.
5. Pulsa **Añadir conceptos** y, en **Del catálogo**, añade cada cosa (Tarea 5.5).
6. Ajusta las cantidades si hace falta (Tarea 5.4).
7. Emite (Tarea 7).

*Ejemplo:* 1 bolsa de alimento seco adulto ($ 265.000 + IVA 19 % $ 50.350) + 1 collar isabelino ($ 28.000 + IVA 19 % $ 5.320) = **$ 348.670**.

> Si el cliente no existe todavía, créalo primero (`MANUAL-CLIENTES-MASCOTAS.md`, pasos 1 a 3; la mascota no hace falta).

---

## Tarea 7 — Emitir la factura

### Campos de la ventana *Emitir factura*

| Campo | Descripción | Obligatorio | Ejemplo |
| --- | --- | :---: | --- |
| Total | Lo que se va a facturar | Solo lectura | `$ 155.400` |
| Vencimiento (opcional) | Fecha límite de pago, para facturas a crédito. Vacío = de contado | No | `2026-10-29` |

### Paso a paso

1. Abre el borrador.
2. Revisa los conceptos, los descuentos y el total.
3. Pulsa **Emitir factura**.
4. Si la factura es a crédito, pon la fecha en **Vencimiento**. Si es de contado, déjalo vacío.
5. Pulsa **Emitir**.

Al emitir:

- Recibe el **siguiente número** de la resolución DIAN (ej.: `FE131`). Dos personas emitiendo a la vez nunca reciben el mismo.
- Se **congelan** los datos del cliente, los de la clínica y los de la resolución. Si mañana el cliente cambia de dirección, esta factura sigue con la de hoy.
- **Ya no se puede editar ni borrar.** Si algo está mal, se anula (Tarea 10) y se factura de nuevo.

> Para emitir, la clínica necesita una **resolución DIAN activa, vigente y con números disponibles** (**Content Manager → Clínica → Resoluciones DIAN**, lo configura Administración). El número de la resolución lo lleva el sistema: no hace falta tocarlo.

---

## Tarea 8 — Ver, imprimir o enviar el PDF

### Botones

| Botón | Qué hace | Cuándo aparece |
| --- | --- | --- |
| Vista previa | Abre el PDF con marca de agua BORRADOR | En borradores |
| Ver PDF | Abre el PDF en otra pestaña, para imprimir | En facturas emitidas o anuladas |
| Descargar | Guarda el archivo `Factura-FE131.pdf`, para enviarlo por correo o WhatsApp | En facturas emitidas o anuladas |

### Paso a paso

1. Abre la factura.
2. Pulsa **Ver PDF** (para imprimir) o **Descargar** (para enviar).

El PDF trae los datos de la clínica y del cliente, cada concepto con la consulta y la mascota de donde sale, el IVA por tarifa, los totales y el texto de la resolución DIAN.

> Mientras no exista la conexión con la DIAN, el PDF dice en la cabecera *"Ambiente de habilitación DIAN: sin validez fiscal"* o *"pendiente de validación DIAN"*: **todavía no es una factura electrónica validada.**

---

## Tarea 9 — Registrar el pago

### Campos

| Campo | Descripción | Obligatorio | Ejemplo |
| --- | --- | :---: | --- |
| Registrar pago | **Sin pagar** (a crédito o aún no pagó), **Pago parcial** (abonó una parte) o **Pagada** (pagó todo). Se guarda al elegirlo | Sí (queda *Sin pagar*) | `Pagada` |

### Paso a paso

1. Abre la factura emitida.
2. En el recuadro **Documento**, abre **Registrar pago**.
3. Elige el estado.

Hoy es solo una marca: el sistema aún no registra el medio de pago ni cada abono.

---

## Tarea 10 — Anular una factura (Administración)

### Campos de la ventana *Anular la factura*

| Campo | Descripción | Obligatorio | Ejemplo |
| --- | --- | :---: | --- |
| Motivo | Por qué se anula. Queda guardado y sale en el PDF de la anulada | **Sí** | `Se emitió a nombre de otro cliente` |

### Paso a paso

1. Abre la factura emitida.
2. Pulsa **Anular**.
3. Escribe el **Motivo**.
4. Pulsa **Anular**.

Después de anular:

- La factura **se conserva**, con su número, marcada como anulada. Los números no se reutilizan.
- Sus conceptos **vuelven a quedar pendientes**. Para facturarlos bien, vuelve a la **Tarea 4**; en la consulta verás la anulada como antecedente.

> Un **borrador** no se anula: se elimina (Tarea 5.10). Una factura que **ya se envió a la DIAN** tampoco se anula así: requiere una **nota crédito** (todavía no disponible).

---

## Tarea 11 — Buscar facturas

### Campos (filtros de la pestaña *Facturas*)

| Campo | Descripción | Obligatorio | Ejemplo |
| --- | --- | :---: | --- |
| Buscar | Número de factura o nombre del cliente | No | `FE129` / `Restrepo` |
| Estado | Borrador, Emitida, Error DIAN, Anulada, o Todos | No | `Emitida` |
| Pago | Sin pagar, Pago parcial, Pagada, o Todos | No | `Sin pagar` |
| Desde / Hasta | Rango de fechas: de emisión, o de creación en los borradores | No | `2026-09-01` / `2026-09-30` |

**Columnas del listado:** Número (o *Borrador*), Cliente, Fecha, Estado, Pago y Total. Muestra 20 por página, con los botones **Anterior** y **Siguiente**.

### Paso a paso

1. Ve a **Facturación**.
2. Pulsa la pestaña **Facturas**.
3. Usa los filtros que necesites.
4. Pulsa la factura para abrirla.

> La pestaña **Pendientes de cobro** tiene sus propios filtros, **Consultas desde** y **Hasta**, para buscar consultas por fecha.

---

## Tarea 12 — Saber si una consulta ya se cobró

### Campos del recuadro *Facturación* (en la consulta)

| Campo | Descripción | Obligatorio | Ejemplo |
| --- | --- | :---: | --- |
| Estado | Sin conceptos cobrables, Sin facturar, Facturada en parte o Facturada | Solo lectura | `Facturada en parte` |
| Pendientes | Conceptos por cobrar | Solo lectura | `1` |
| Por cobrar (est.) | Valor estimado de lo pendiente | Solo lectura | `$ 45.000` |
| Factura | Número de cada factura que cobra conceptos de esta consulta (o *Borrador*) | Solo lectura | `FE129` |
| Facturar / Ver facturación | Lleva a la pantalla de la Tarea 4 | — | — |

### Paso a paso

1. Abre la consulta (**Content Manager → Consulta**).
2. Mira el recuadro **Facturación** del lateral derecho.

> El recuadro muestra lo **guardado**: un concepto añadido a la consulta sin guardar aún no aparece.

---

## Corregir una consulta que ya está facturada

Un concepto que está en una factura **no se puede cambiar en la consulta** (ni quitarlo, ni cambiar el servicio o producto, ni la cantidad, ni pasarlo a `recommended`). Así la historia clínica y lo cobrado nunca dicen cosas distintas. Sí se pueden cambiar sus notas.

1. **Si la factura es un borrador:** quita ese concepto del borrador (Tarea 5.7).
   **Si la factura ya está emitida:** pide a Administración que la anule (Tarea 10).
2. Abre la consulta y corrige el concepto.
3. Pulsa **Guardar**.
4. Vuelve a facturar lo corregido (Tarea 4, o Tarea 5.6 para añadirlo a un borrador).

Tampoco se puede **borrar, archivar ni cambiar de mascota** una consulta que tiene conceptos en una factura viva.

---

## Mensajes que pueden aparecer

| Mensaje | Qué pasa | Qué hacer |
| --- | --- | --- |
| "…ya se está cobrando en la factura FE…" (o "…en un borrador") | Ese concepto ya está en otra factura | Abre esa factura. Si es un borrador olvidado, quítalo de ahí |
| "…no tiene precio de venta en el catálogo…" | Al servicio o producto le falta el precio | Administración lo completa (Tareas 1 y 2) |
| "…no tiene perfil tributario (IVA) en el catálogo…" | Le falta el IVA | Administración completa *Impuestos* (Tareas 1 y 2) |
| "Un concepto gravado con IVA necesita una tarifa válida (5 o 19 %)" | En el catálogo, un gravado con otra tarifa | Pon `19` o `5` en *Tarifa de IVA (%)* |
| "…está en estado "recommended" y no es facturable" | Se intentó cobrar algo recomendado | Si sí se hizo o entregó, cámbialo en la consulta a `applied` o `dispensed` |
| "Esa consulta es de una mascota de otro cliente" | Se mezclaron consultas de clientes distintos | Haz una factura para cada cliente |
| "La línea … se está cobrando en … Quítala del borrador o anula la factura antes de cambiarla" | Se intentó modificar en la consulta algo ya facturado | Sigue *Corregir una consulta que ya está facturada* |
| "El descuento (…) supera el valor del renglón (…)" | Descuento mayor que el valor | Máximo, el 100 % del concepto |
| "Cambiar el precio de catálogo requiere el permiso de emitir facturas" | Tu rol no puede cambiar precios | Pídeselo a quien emite, o usa un descuento |
| "No hay una resolución DIAN activa en Clínica" | Falta la resolución o ninguna está activa | Administración la carga o la activa en Clínica |
| "La resolución … venció el …" / "…agotó su rango autorizado…" | La resolución ya no sirve | Administración carga la nueva resolución de la DIAN y la activa |
| "Para anular una factura hay que indicar el motivo" | Falta el motivo | Escríbelo en la ventana de anulación |
| "…ya se envió a la DIAN: no se anula, se corrige con una nota crédito" | La DIAN ya la tiene | Requiere nota crédito (aún no disponible) |

---

## Preguntas frecuentes

**¿Puedo cobrar solo una parte de lo que tiene la consulta?**
Sí. En la Tarea 4, marca solo lo que se cobra ahora; el resto queda pendiente.

**El cliente trajo dos mascotas. ¿Una factura o dos?**
Como prefiera. Para una sola: crea el borrador desde una consulta y añade la otra con la Tarea 5.6.

**Algo no se cobra (cortesía, garantía).**
Factúralo con descuento del 100 % (Tarea 5.2). No lo pongas como `recommended` si sí se hizo: la historia clínica debe decir la verdad.

**¿Por qué el valor en *Pendientes de cobro* dice "estimado"?**
Se calcula con el catálogo de hoy. El precio definitivo se fija al crear el borrador.

**Cambié la dirección del cliente y la factura sigue con la vieja.**
Si está emitida, es lo correcto: muestra los datos del día en que se emitió. Un borrador toma siempre los datos actuales.

**¿El veterinario puede facturar?**
Puede ver lo que se cobró de sus consultas y los PDF, pero no crear ni emitir facturas.

---

## Lo que todavía no hace

- **Factura electrónica DIAN:** los PDF aún no están validados por la DIAN (no llevan CUFE ni código QR).
- **Notas crédito** para corregir una factura ya enviada a la DIAN.
- **Medios de pago y abonos:** solo se marca Sin pagar / Pago parcial / Pagada.
- **Inventario:** vender un producto no descuenta existencias ni lotes.
- **Copagos de los planes de suscripción.**
- **Reportes de ventas** (por período, por servicio, por veterinario).
