# Manual de facturación

Cómo se cobran en el sistema los servicios y productos de la clínica: desde lo que el veterinario registra en la consulta hasta la factura emitida, su PDF, el pago y la anulación.

Todo se hace en el panel de administración (`/admin`), en el menú **Facturación**. Cada persona entra con su propio correo y contraseña.

---

## 1. Lo esencial en un minuto

```
Consulta  →  Servicios y productos  →  Pendientes de cobro  →  Borrador  →  Emitir  →  PDF / Pago
(veterinario)   (lo aplicado o entregado)      (recepción elige)    (se ajusta)  (recibe número DIAN)
```

- **Lo que se cobra sale de la consulta.** Cada servicio o producto que el veterinario registra en la consulta es un *concepto*: queda pendiente de cobro hasta que entra en una factura.
- **Una factura empieza siendo un borrador.** Mientras es borrador se puede cambiar todo; no tiene número.
- **Emitir le da el número** de la resolución DIAN (por ejemplo `FE131`) y la congela: ya no se edita ni se borra. Si hubo un error, se anula.
- **Nada se cobra dos veces.** Un concepto que ya está en una factura no se puede poner en otra, aunque dos personas lo intenten a la vez.

---

## 2. Quién puede hacer qué

| Acción | Recepción | Veterinario | Administración |
| --- | :---: | :---: | :---: |
| Ver pendientes de cobro, facturas y PDF | ✔ | ✔ | ✔ |
| Crear y ajustar borradores (descuentos, conceptos, observaciones) | ✔ | — | ✔ |
| Cambiar el precio de un concepto en el borrador | ✔ | — | ✔ |
| Emitir facturas y registrar pagos | ✔ | — | ✔ |
| Anular facturas emitidas | — | — | ✔ |
| Crear y editar servicios y productos del catálogo | — | — | ✔ |
| Cambiar los datos de la clínica y las resoluciones DIAN | — | — | ✔ |

Si a alguien le falta un botón que aparece en este manual, es porque su rol no tiene ese permiso. Los permisos se ajustan en **Ajustes → Roles**.

---

## 3. Antes de facturar: el catálogo

El sistema toma **el precio y el IVA del catálogo**. Un servicio o producto sin precio o sin IVA definido **no se puede facturar**: el sistema lo avisa en lugar de inventar un valor.

### Servicios

**Content Manager → Servicio.** Campos que usa la facturación:

| Campo | Qué poner |
| --- | --- |
| Precio base | Valor en pesos, sin IVA. Ej.: `60000` |
| Impuestos → Tratamiento de IVA | `gravado`, `exento` o `excluido` |
| Impuestos → Tarifa de IVA (%) | `19` o `5` si es gravado; `0` si es exento o excluido |

Los servicios de la clínica están **gravados al 19 %**.

### Productos

**Content Manager → Producto.** Medicamentos, vacunas, alimentos, juguetes, accesorios, higiene e insumos están todos aquí; los distingue el **Tipo de producto**.

| Campo | Qué poner |
| --- | --- |
| Precio de venta (antes de IVA) | Valor en pesos. Ej.: `42000` |
| Impuestos | Igual que en servicios |
| Unidad de venta | Cómo se vende: unidad, caja, frasco, vial, bolsa, tableta, dosis, ml, g, kg. Sale en la factura |

Los medicamentos y las vacunas exigen además sus **Datos específicos del tipo** (forma farmacéutica, vacuna clínica…).

> **Cambiar un precio no cambia las facturas ya hechas.** Cada concepto guarda el precio y el IVA que tenía el catálogo en el momento de añadirlo al borrador.

---

## 4. En la consulta: registrar lo que se cobra (veterinario)

En la ficha de la consulta, sección **Servicios y productos**, se añade una tarjeta por cada cosa:

- **Servicio** — consulta, vacunación, baño, cirugía, laboratorio…
- **Producto** — lo que se aplicó o se entregó.

Cada tarjeta lleva el servicio o producto, la **cantidad** (admite decimales: media tableta, 2,5 ml) y el **estado**. El estado decide si se cobra:

| Estado en el formulario | Significa | ¿Se cobra? |
| --- | --- | :---: |
| `applied` | Aplicado: se prestó el servicio o se usó el producto en la clínica | Sí |
| `dispensed` | Entregado: el producto se lo lleva el cliente (solo productos) | Sí |
| `recommended` | Recomendado: un consejo, no se prestó ni se entregó | No |

> Los estados aparecen en inglés en el formulario de la consulta; en las pantallas de Facturación se muestran en español.

**La consulta en sí también se cobra:** es la tarjeta del servicio **Consulta general**. Cuando la consulta se abre desde la **Agenda** (botón *Atender y crear consulta*), los servicios agendados en la cita ya vienen como tarjetas `applied`: si algo no se hizo, se quita o se pasa a `recommended`.

**Hay que guardar la consulta.** Lo que no está guardado no aparece en Facturación.

---

## 5. Facturar una consulta (recepción)

### Tres formas de llegar

1. **Facturación → pestaña *Pendientes de cobro*.** Lista las consultas que tienen algo por cobrar, con la fecha, la mascota, el cliente, cuántos conceptos faltan y un valor estimado. Se puede filtrar por fechas. Pulsa la fila o **Facturar**.
2. **Desde la ficha de la consulta:** en el lateral derecho, el recuadro **Facturación** resume su estado; el botón **Facturar** lleva a la misma pantalla.
3. **Desde la Agenda:** al abrir una cita que ya tiene consulta, botón **Facturar**.

### La pantalla de la consulta

Muestra cada servicio y producto con su situación:

| Cobro | Qué quiere decir |
| --- | --- |
| **Pendiente** | Se puede cobrar. Tiene casilla para marcarlo |
| **Facturada** | Ya está en una factura; el enlace lleva a ella |
| **No facturable** | No se cobra, y dice por qué (p. ej. está `recommended`) |

Si una línea pendiente dice *sin precio de venta* o *sin perfil tributario (IVA)*, hay que corregir el catálogo (ver el apartado 3) antes de poder cobrarla.

Al entrar, vienen marcadas todas las pendientes que se pueden cobrar. Desmarca lo que no quieras cobrar ahora y pulsa **Crear borrador con N concepto(s)**. Lo que no marques sigue pendiente para otra factura.

### Ejemplo

Consulta de Kira con:

| Concepto | Cantidad | Estado | Precio | IVA |
| --- | --- | --- | --- | --- |
| Consulta general | 1 | `applied` | $ 60.000 | 19 % |
| Meloxicam suspensión oral | 2 | `dispensed` | $ 42.000 | excluido |
| Nobivac Rabies | 1 | `recommended` | $ 38.000 | excluido |

La pantalla muestra dos pendientes y Nobivac como *No facturable (estado "recommended")*. El borrador queda así:

| Concepto | Subtotal | IVA | Total |
| --- | ---: | ---: | ---: |
| Consulta general (1) | $ 60.000 | $ 11.400 | $ 71.400 |
| Meloxicam (2 × $ 42.000) | $ 84.000 | $ 0 | $ 84.000 |
| **Total** | **$ 144.000** | **$ 11.400** | **$ 155.400** |

---

## 6. Ajustar el borrador

En la pantalla de la factura, mientras es **borrador**:

- **Descuento por concepto.** Se escribe en la columna *Descuento* (en pesos); al salir del campo se recalcula todo. El IVA se calcula sobre el valor ya descontado.
  *Ejemplo:* descuento de $ 6.000 en la consulta → base $ 54.000, IVA $ 10.260, total $ 64.260.
- **Cortesía:** se factura con descuento del 100 %. Así queda constancia de que se prestó y no se cobró.
- **Cambiar el precio** (columna *V. unitario*): solo quien puede emitir facturas. Úsalo para excepciones; lo normal es corregir el catálogo.
- **Cantidad:** en los conceptos que vienen de una consulta no se cambia aquí, porque la manda la consulta. En la venta directa sí.
- **Añadir conceptos** (botón del mismo nombre), con dos pestañas:
  - *Del catálogo* — buscar un servicio o producto y **Añadir**.
  - *De otras consultas del cliente* — si el cliente tiene otra consulta con cosas pendientes (por ejemplo, de su otra mascota), se elige la consulta, se marcan los conceptos y se añaden. **Una factura puede cubrir varias consultas del mismo cliente.**
- **Quitar un concepto** (icono de papelera): vuelve a quedar pendiente.
- **Observaciones:** texto libre que sale en el PDF (p. ej. "Control en 8 días"). Botón *Guardar observaciones*.
- **Vista previa:** abre el PDF con la marca de agua **BORRADOR**. No tiene validez.
- **Eliminar borrador:** lo borra y todos sus conceptos vuelven a pendientes.

---

## 7. Venta directa (sin consulta)

Para vender algo sin que haya consulta: una bolsa de alimento, un collar, un juguete, un baño.

1. **Facturación → Venta directa** (arriba a la derecha).
2. Buscar el cliente por nombre o documento y elegirlo. Se crea un borrador vacío a su nombre.
3. **Añadir conceptos → Del catálogo**, buscar y **Añadir** cada cosa.
4. Ajustar la cantidad en la tabla si hace falta (aquí sí se puede) y emitir.

*Ejemplo:* 1 bolsa de alimento seco adulto ($ 265.000 + IVA 19 % $ 50.350) + 1 collar isabelino ($ 28.000 + IVA 19 % $ 5.320) = **$ 348.670**.

---

## 8. Emitir la factura

Botón **Emitir factura** (en borradores con al menos un concepto). Se puede indicar un **vencimiento**; si se deja vacío, la factura es de contado.

Al emitir:

- Recibe el **siguiente número** de la resolución DIAN activa (por ejemplo `FE131`). Dos personas emitiendo a la vez nunca reciben el mismo número.
- Se **congelan** los datos del cliente (nombre, documento, dirección, correo, teléfono), los de la clínica y los de la resolución. Si mañana el cliente cambia de dirección, esta factura sigue mostrando la de hoy.
- **Ya no se puede editar ni borrar.** Si algo está mal, se anula (apartado 11) y se factura de nuevo.

Para emitir, la clínica necesita una **resolución DIAN activa, vigente y con números disponibles** (Content Manager → Clínica → Resoluciones de facturación). El número de la resolución lo lleva el sistema: no hace falta tocarlo. Cuando quedan menos de 100 números conviene tramitar la siguiente resolución.

---

## 9. El PDF

- **Ver PDF** lo abre en otra pestaña; **Descargar** lo guarda como `Factura-FE131.pdf`.
- Contiene: datos de la clínica (NIT, régimen, dirección, contacto), datos del cliente, cada concepto con la consulta y mascota de donde sale, el desglose del IVA por tarifa, los totales, el texto de la resolución DIAN y la nota al pie de la clínica.
- Una factura **anulada** lleva la marca de agua **ANULADA**, con la fecha y el motivo.
- Mientras no exista la conexión con la DIAN, el PDF dice en la cabecera *"Ambiente de habilitación DIAN: sin validez fiscal"* o *"pendiente de validación DIAN"*: **todavía no es una factura electrónica validada.**

El PDF no se guarda en ningún sitio: se genera cada vez que se pide, siempre igual para una factura emitida.

---

## 10. Registrar el pago

En una factura emitida, el recuadro *Documento* tiene **Registrar pago**:

| Estado de pago | Cuándo |
| --- | --- |
| Sin pagar | Recién emitida, o a crédito |
| Pago parcial | Abonó una parte |
| Pagada | Pagó todo |

Hoy es solo una marca: el sistema aún no registra el medio de pago (efectivo, tarjeta, transferencia) ni los abonos uno a uno.

---

## 11. Anular una factura (administración)

Botón **Anular** en una factura emitida. Hay que escribir el **motivo** (por ejemplo "Se emitió a nombre de otro cliente").

- La factura **se conserva**, con su número, marcada como anulada. Los números no se reutilizan.
- Sus conceptos **vuelven a quedar pendientes**, para facturarlos otra vez si corresponde. En la pantalla de la consulta se ve la factura anulada como antecedente.
- Una factura que **ya se envió a la DIAN** no se anula así: se corrige con una **nota crédito** (todavía no disponible en el sistema).

Un **borrador** no se anula: se elimina (apartado 6).

---

## 12. Consultar facturas

**Facturación → pestaña *Facturas*.** Filtros por:

- **Buscar:** número de factura o nombre del cliente.
- **Estado:** Borrador, Emitida, Error DIAN, Anulada.
- **Pago:** Sin pagar, Pago parcial, Pagada.
- **Fechas:** de emisión (o de creación, en los borradores).

Pulsa una fila para abrir la factura.

Para saber **si una consulta ya se cobró**, basta abrir la consulta: el recuadro *Facturación* del lateral lo dice (Sin facturar, Facturada en parte, Facturada) y muestra en qué factura está.

---

## 13. Reglas que protegen la facturación

Estas reglas evitan errores de cobro. Aplican siempre, se trabaje desde Facturación o desde el Content Manager.

- **Un concepto que está en una factura no se puede cambiar en la consulta:** ni quitarlo, ni cambiarle el servicio o producto, ni la cantidad, ni pasarlo a `recommended`. Sí se pueden cambiar sus notas, o pasar un producto de `dispensed` a `applied`. Para corregirlo: quítalo del borrador o anula la factura, y entonces se libera.
- **Una consulta cobrada no se borra, no se archiva y no cambia de mascota** mientras su factura siga viva.
- **Una factura emitida no se edita ni se borra;** se anula.
- **Un borrador con conceptos no se archiva** (seguiría reteniéndolos sin que nadie lo viera): se elimina.

### Mensajes que pueden aparecer

| Mensaje | Qué pasa | Qué hacer |
| --- | --- | --- |
| "…ya se está cobrando en la factura FE…" (o "…en un borrador") | Ese concepto ya está en otra factura | Abre esa factura. Si es un borrador olvidado, quítalo de ahí |
| "…no tiene precio de venta en el catálogo…" | Al servicio o producto le falta el precio | Administración completa el precio en el catálogo |
| "…no tiene perfil tributario (IVA) en el catálogo…" | Le falta el IVA | Administración completa *Impuestos* en el catálogo |
| "…está en estado "recommended" y no es facturable" | Se intentó cobrar algo recomendado | Si sí se prestó o entregó, cámbialo en la consulta a `applied` o `dispensed` |
| "Esa consulta es de una mascota de otro cliente" | Se mezclaron consultas de clientes distintos | Una factura es de un solo cliente: haz otra para el otro |
| "La línea … se está cobrando en … Quítala del borrador o anula la factura antes de cambiarla" | Se intentó modificar en la consulta algo ya facturado | Quita el concepto del borrador (o anula la factura) y vuelve a editar la consulta |
| "El descuento (…) supera el valor del renglón (…)" | Descuento mayor que el valor | Máximo, el 100 % del concepto |
| "Cambiar el precio de catálogo requiere el permiso de emitir facturas" | Tu rol no puede cambiar precios | Pídeselo a quien emite, o usa un descuento |
| "No hay una resolución DIAN activa en Clínica" | Falta la resolución o ninguna está marcada como activa | Administración la carga o la activa en Clínica |
| "La resolución … venció el …" / "…agotó su rango autorizado…" | La resolución ya no sirve para facturar | Administración carga la nueva resolución de la DIAN y la marca como activa |
| "Para anular una factura hay que indicar el motivo" | Falta el motivo | Escríbelo en la ventana de anulación |
| "…ya se envió a la DIAN: no se anula, se corrige con una nota crédito" | La DIAN ya la tiene | Requiere nota crédito (aún no disponible) |

---

## 14. Preguntas frecuentes

**¿Puedo cobrar solo una parte de lo que tiene la consulta?**
Sí. Marca solo lo que se cobra ahora; el resto queda pendiente para otra factura.

**El cliente trajo dos mascotas. ¿Una factura o dos?**
Una, si quieres: crea el borrador desde una consulta y añade la otra con *Añadir conceptos → De otras consultas del cliente*.

**Algo no se cobra (cortesía, garantía).**
Factúralo con descuento del 100 %. No lo dejes como `recommended` si sí se prestó: la historia clínica debe decir la verdad.

**Me equivoqué en el borrador.**
Todo se corrige mientras es borrador: descuentos, conceptos, observaciones. O elimínalo y empieza de nuevo; los conceptos vuelven a pendientes.

**Me equivoqué y ya la emití.**
Administración la anula con el motivo; los conceptos vuelven a pendientes y se factura de nuevo con el número siguiente.

**¿Por qué el valor en *Pendientes de cobro* dice "estimado"?**
Se calcula con el catálogo de hoy. El precio definitivo se fija al crear el borrador.

**Cambié la dirección del cliente y la factura sigue mostrando la vieja.**
Si está emitida, es lo correcto: una factura muestra los datos del día en que se emitió. Un borrador toma siempre los datos actuales.

**¿El veterinario puede facturar?**
Con su rol, puede ver lo que se cobró de sus consultas y los PDF, pero no crear ni emitir facturas.

---

## 15. Lo que todavía no hace

- **Factura electrónica DIAN:** los PDF aún no están validados por la DIAN (no llevan CUFE ni código QR).
- **Notas crédito** para corregir una factura ya enviada a la DIAN.
- **Medios de pago y abonos:** solo se marca Sin pagar / Pago parcial / Pagada.
- **Inventario:** vender un producto no descuenta existencias ni lotes.
- **Copagos de los planes de suscripción:** los beneficios de un plan no se aplican solos al facturar.
- **Reportes de ventas** (por período, por servicio, por veterinario).
