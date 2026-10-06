# Módulos del sistema veterinario

Estado al 2026-10-06. El backend tiene 48 content types en 15 dominios de `src/api/`, 43 componentes y 5 plugins propios del panel.

## Módulos que existen

**Estado:** ✅ funciona de punta a punta · 🟡 tiene modelo y reglas, pero le falta el proceso o la integración · ⚪ solo tiene el modelo (CRUD).

| # | Módulo | Qué hace | Estado |
|---|---|---|---|
| 1 | **Identidad y portal** (`identity`, `shared`) | Guarda el perfil de cada persona, sus contactos y los países. El cliente se registra en el portal o reclama la ficha que le abrieron en mostrador con un código de verificación. La policy `is-owner` hace que cada cliente vea solo lo suyo. | 🟡 El código se genera, pero solo sale por el log: no hay proveedor de SMS ni de correo. |
| 2 | **Clientes** (`customer`) | Ficha del propietario, sus consentimientos y notas internas del personal. | ✅ |
| 3 | **Mascotas** (`pet`) | Mascota, especie y raza. Comprueba que la raza sea de esa especie y que las fechas sean válidas. Con `?historia=true` devuelve la historia completa en una sola petición. | ✅ |
| 4 | **Historia clínica** (`clinical` + plugin `veterinaria-historia`) | La consulta tiene secciones: anamnesis, examen físico, laboratorio, imágenes, diagnóstico, procedimiento y plan de tratamiento. Además hay alergias, el catálogo de vacunas y el carné de vacunación. Se puede buscar dentro de las secciones, y el plugin genera una historia imprimible por propietario. Cada medicamento del plan puede enlazarse a un producto del catálogo y llevar la cantidad a dispensar. | ✅ |
| 5 | **Agenda** (`scheduling` + plugin `veterinaria-agenda`) | Servicios, consultorios, horario semanal de cada profesional y sus excepciones (ausencias o turnos extra). Calcula los huecos libres con `/availability`, pinta la rejilla semanal y permite reservar volviendo a comprobar el hueco. Al terminar, "Finalizar atención" cierra la cita, y un proceso nocturno cierra las que quedaron abiertas. | ✅ |
| 6 | **Catálogo comercial** (`catalog`) | Todo lo vendible que no es un servicio: medicamentos, vacunas, alimentos, accesorios, higiene e insumos. Cada producto lleva datos propios según su tipo, su perfil tributario y su proveedor. | ✅ |
| 7 | **Servicios y productos de la consulta** (`consultation.lines`) | Registra lo que se aplicó, se entregó o se recomendó en cada consulta. Esas líneas son las que después se facturan. | ✅ |
| 8 | **Facturación** (`billing` + plugin `veterinaria-facturacion`) | Muestra lo pendiente de cobro, crea el borrador desde las consultas, aplica descuentos y cambios de precio con permiso y motivo, emite con el consecutivo de la resolución DIAN, anula, registra el pago y genera el PDF. Impide cobrar dos veces la misma línea. | 🟡 No hay factura electrónica: falta la integración con DIAN/Dataico (CUFE y QR). |
| 9 | **Configuración de la clínica** (`clinic`, single type) | Datos de la veterinaria: NIT y DV validado, régimen, responsabilidades fiscales, horarios, resoluciones DIAN y servicio de consulta por defecto. | ✅ |
| 10 | **Planes y suscripciones** (`plan`, `plan-benefit`, `subscription`, `benefit-usage`) | Planes de salud con beneficios, la suscripción de cada cliente y el uso que hace de esos beneficios. | ⚪ No hay cobro recurrente, ni descuento del beneficio al facturar, ni renovación. |
| 11 | **Trámites de viaje** (`travel`) | Expediente con los requisitos del viaje: certificado sanitario, titulación antirrábica, microchip, antiparasitario, permiso de importación y guacal. | ⚪ No hay alertas de plazos ni un checklist calculado según el país. |
| 12 | **Documentos firmados** (`documents`) | Consentimientos con sus firmantes y un registro de eventos. | ⚪ No hay un flujo de firma real: ni OTP, ni firma electrónica, ni PDF generado. |
| 13 | **Notificaciones** (`notification`) | Notificación, sus destinatarios y cada envío. | ⚪ No se envía nada: no hay canal de correo, SMS ni WhatsApp. |
| 14 | **Marketing** (`campaign`, `campaign-metric`) | Campañas con reglas de segmentación que el servidor traduce para obtener el público. | 🟡 Calcula el público, pero no envía (depende del módulo 13). |
| 15 | **Hospitalización** (`hospitalization` + plugin `veterinaria-hospitalizacion`) | Ingreso en una jaula, órdenes de tratamiento con productos del catálogo, hoja de evolución por hora (signos y tomas dadas u omitidas, con las atrasadas a la vista), traslados y alta con resumen imprimible. Se factura sola: cada día de estancia y cada toma dada salen en pendientes de cobro. El cliente ve en el portal el estado y el alta. Solo se activa si la clínica hospitaliza. Rol nuevo: Auxiliar de hospitalización. | ✅ |
| 16 | **Caja y punto de venta** (`cash` + plugin `veterinaria-caja`) | Punto de venta en una pestaña aparte: abrir y cerrar turno con base y arqueo por billetes y monedas, vender el catálogo a consumidor final o a un cliente, cobrar lo pendiente de consultas y hospitalizaciones, abonos, anticipos (saldo a favor), devoluciones, ingresos, retiros y gastos de efectivo, cartera por antigüedad y supervisión de turnos. Cobrar emite la factura y registra cada pago con su medio (efectivo con cambio, tarjeta, transferencia/Nequi/Daviplata, saldo a favor). Rol nuevo: Caja. | ✅ |
| 17 | **Fórmula médica** (`clinical.prescription` + plugin `veterinaria-historia`) | Receta imprimible en A5 emitida desde el plan de tratamiento de la consulta (panel lateral "Fórmula médica"): se eligen los medicamentos, sale con consecutivo `RX-000123`, datos del propietario y del paciente, pauta, cantidad en cifras y en letras, indicaciones, próximo control y la firma con la tarjeta profesional del veterinario (guardada en su perfil). Guarda una copia al emitir, así que reimprimir saca lo mismo; no se edita, se anula con motivo. La emiten Veterinario y Administrador de clínica; anular la de otra persona es de la administración. Avisa cuando un medicamento es de control especial. | 🟡 No sustituye al recetario oficial del FNE para medicamentos de control especial, ni se envía al cliente: no está en el portal ni sale por correo (depende del módulo 13). |
| — | **Transversales** | Archivado (`archivedAt`), relaciones obligatorias, `searchLabel` en cascada, roles del panel, panel en español, protección del plugin de calendario y documentación OpenAPI. | ✅ |

## Módulos que faltarían

Ordenados por lo que se considera más urgente:

1. **Inventario (lotes y movimientos).** Faltan `product-batch` y `stock-movement`: entradas de compra, salidas por venta o por uso en consulta, ajustes, vencimientos y costo real. El documento de modelo ya lo deja previsto, y el producto tiene `tracksInventory`, `tracksBatches`, `minStock` y `referenceCost` esperando. Sin esto no hay control de existencias ni alerta de vencimientos.
2. **Facturación electrónica DIAN.** Enviar la factura a Dataico, recibir el CUFE y el estado, poner el QR en el PDF y manejar notas crédito, que hoy solo pueden anular. Sin esto, las facturas no tienen validez fiscal.
3. **Canal de envío de notificaciones.** Un proveedor de correo, SMS o WhatsApp detrás de `notification-delivery`, con reintentos y el estado de cada envío. Destrabaría varias cosas a la vez: los códigos del portal, los recordatorios de cita y de vacunas y el envío de campañas.
4. **Recordatorios automáticos.** Procesos programados para avisar de la próxima vacuna (`nextDueOn`), de la cita de mañana, de controles pendientes y de suscripciones por vencer. Los datos ya existen; falta el proceso que los revisa y avisa.
5. **Compras a proveedores.** Órdenes de compra y su recepción, que alimentarían el inventario. El proveedor ya existe y solo lo ve el Administrador de clínica.
6. **Reportes e indicadores.** Ingresos por servicio y por profesional, ocupación de la agenda, inasistencias, productos más vendidos y clientes inactivos.
7. **Portal del cliente (frontend).** El backend ya tiene registro, reclamación, huecos libres y la historia propia, pero no hay ninguna aplicación que lo use: solo existe `demo-flujo.js`.
8. **Pruebas automatizadas.** No hay Jest; `smoke-validations.js` es lo único que comprueba las reglas por ahora.

## Resumen

La parte operativa central ya funciona: clientes, mascotas, historia clínica con fórmula médica, agenda, catálogo, hospitalización, facturación interna y caja. Lo que queda son sobre todo integraciones externas (DIAN y canales de envío) y el inventario. Se recomienda empezar por **inventario** o por **DIAN**: el primero porque el modelo ya está preparado para él, y el segundo porque sin él la facturación no tiene valor legal.
