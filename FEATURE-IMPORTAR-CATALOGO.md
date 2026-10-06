# Feature pendiente: importar productos y servicios desde un archivo

> **Estado:** propuesta, pendiente de dos decisiones (ver al final). No implementada.
> **Fecha:** 2026-10-06.

## Problema

El catálogo comercial (`api::catalog.product`) y el de servicios (`api::scheduling.service`) solo se pueden llenar de uno en uno. Una clínica que arranca tiene cientos de productos en una hoja de cálculo o en el sistema anterior, y cargarlos a mano en el Content Manager no es viable. Quien mantiene el catálogo (Administrador de clínica) debería poder subir un archivo desde el panel.

## Qué hay hoy (verificado el 2026-10-06)

| Vía | ¿Existe? | Por qué no sirve |
| --- | --- | --- |
| Plugin CSV en el panel | No | `strapi-csv-import-export` se desinstaló (daba errores; era un 0.0.6 de terceros). |
| Content Manager | Sí | Crea registros de uno en uno. No tiene carga masiva. |
| `strapi import` (CLI) | Sí | No lee CSV ni Excel, solo el `.tar.gz` de `strapi export`. Funciona como restauración: **borra** los datos existentes de los tipos que importa. Escribe por debajo del Document Service, así que **se salta** `validations/catalog.ts` (IVA, bloque `details`) y no rellena `searchLabel`. |
| API REST (`POST /api/products`) | Sí | Un registro por petición. Exige un token de API con escritura; ningún rol de users-permissions la tiene (`bootstrap/roles.ts` solo da lectura del catálogo). Sirve para un script de desarrollador, no para el usuario final. |

Los únicos que cargan catálogo son los scripts de demo (`demo-productos.js`, `demo-clinica.js`), con los datos escritos en el código.

## Por qué un CSV "plano" no basta

Lo que una importación genérica no resuelve con este modelo:

- **Relaciones por nombre.** `category` (`product-category` / `service-category`, ambas con `name` único), `preferredSupplier`, `targetSpecies` (manyToMany) y, en vacunas, `details.vaccine` → `api::clinical.vaccine`. El archivo trae nombres, no `documentId`, y hay que resolverlos.
- **Impuesto en un componente.** `tax.ivaTreatment` + `tax.ivaRate`; gravado exige 5 o 19, y exento o excluido quedan en 0 (`validarImpuesto`).
- **Dynamic zone `details`.** Un solo bloque, que debe corresponder al `productType` (`DETALLE_POR_TIPO`). Es obligatorio en `medication` (requiere `pharmaceuticalForm`) y en `vaccine` (requiere la vacuna clínica). Además tiene componentes anidados: `registration` (registro sanitario) y `activeIngredients` (repetible).
- **Enums en inglés.** `medication`, `tablet`, `vial`, `refrigerated`… El usuario escribirá "Medicamento", "Tableta", "Refrigerado". Hace falta una tabla de traducción por enum.
- **Clave para actualizar sin duplicar.** El producto tiene `sku` único (y `barcode` único). **El servicio no tiene ninguna clave única**: hay que decidir cómo se reconoce una fila ya existente.
- **Excel en español** guarda los CSV con `;` como separador y a menudo en Latin-1/Windows-1252, y un importador ingenuo rompe las tildes y la ñ.
- **Campos que no se importan.** `searchLabel` (lo calcula `validations/labels.ts`), `image` (media; queda para el panel) y `referenceCost` (`private`, pero se puede importar: es escritura, no lectura).

## Propuesta

Un cuarto plugin local, **`src/plugins/veterinaria-catalogo/`**, con la misma arquitectura que `veterinaria-facturacion`: `domain/` + `infrastructure/` + `application/` + `presentation/` en el panel, y el servidor en CommonJS (`strapi-server.js`). Recuerda que el código del plugin va en `.js` y que `strapi-admin.js` es ESM con `export default` (ver CLAUDE.md).

### Flujo en el panel (menú "Importar catálogo")

1. **Elegir qué se importa**: productos o servicios.
2. **Descargar la plantilla**: columnas en español, una hoja de instrucciones y listas desplegables para tipo, unidad de venta, IVA, forma farmacéutica, vía, almacenamiento, etc. La plantilla se genera desde los esquemas, así que un valor nuevo de un enum aparece solo.
3. **Subir el archivo** → **vista previa con validación fila por fila, sin escribir nada.** Por ejemplo:
   - "Fila 14: un medicamento necesita forma farmacéutica".
   - "Fila 22: la categoría 'Biologicos' no existe. ¿Quiso decir 'Biológicos'?"
   - "Fila 30: gravado necesita tarifa 5 o 19".

   Resumen: N nuevos, M actualizados, K con errores.
4. **Importar**: solo se habilita sin errores. Todo va en **una transacción** (`strapi.db.transaction`, igual que `crearBorrador` en facturación): o entra todo, o nada.
5. **Resultado**: totales y enlace a la lista filtrada.

### Servidor

- `POST /veterinaria-catalogo/plantilla/:tipo`: descarga la plantilla (como Blob, igual que el PDF de facturación).
- `POST /veterinaria-catalogo/importar/:tipo?simular=true`: valida y devuelve la vista previa. Con `simular=false`, escribe.
- **Escribe por el Document Service**, nunca con `strapi.db.query`: así corren `validations/catalog.ts`, `labels.ts` y el resto de middlewares, y no hay que duplicar ninguna regla. La simulación puede ejecutar la importación real dentro de una transacción y hacer rollback, lo que garantiza que la vista previa y la escritura validan exactamente lo mismo. Hay que comprobarlo con SQLite.
- Los errores de `ValidationError` se capturan por fila y se devuelven con el número de fila y la columna.
- **Crear o actualizar**: por `sku` en productos (fila sin `sku` = siempre crea, avisando) y según la decisión 2 en servicios. `details` y `tax` se reemplazan enteros al actualizar.
- Permiso **`plugin::veterinaria-catalogo.catalogo.importar`**, registrado con `actionProvider.registerMany` y asignado a Administrador de clínica en `admin-roles.ts` con `addPermissions` (nunca `assignPermissions`). Política propia en las rutas, como `tiene-permiso` de facturación.
- Límite de tamaño razonable (p. ej. 5 000 filas) y rechazo explícito de lo que no sea .xlsx/.csv.

### Columnas de la plantilla

**Productos**: SKU, Código de barras, Nombre*, Tipo*, Categoría, Marca, Presentación, Unidad de venta*, Descripción, Especies (separadas por coma), Precio de venta, Moneda, Tratamiento IVA, Tarifa IVA, Costo de referencia, Proveedor (NIT o nombre), Controla inventario, Controla lotes, Stock mínimo, Activo.

Datos específicos, que solo se rellenan según el tipo:

- **Medicamento**: Forma farmacéutica*, Vía, Laboratorio, Código CUM, Código ATCvet, Requiere fórmula, Controlado, Almacenamiento, Registro (entidad, número, titular, vence), Principios activos (formato `nombre concentración unidad; …`, p. ej. `Meloxicam 1.5 mg_ml`).
- **Vacuna**: Vacuna clínica*, Laboratorio, Dosis por unidad, Vía, Almacenamiento, Registro.
- **Alimento**: Tipo de alimento*, Etapa de vida, Peso neto (g), Requiere fórmula, Registro.
- **Juguete o accesorio**: Material, Talla, Color.

**Servicios**: [Código], Nombre*, Categoría, Descripción, Duración (min)*, Precio base, Moneda, Tratamiento IVA, Tarifa IVA, Color, Activo.

(* = obligatorio.)

### Dependencias

- Leer y escribir .xlsx: `exceljs` (permite validación de datos, es decir listas desplegables, en la plantilla). Para CSV, detectar el separador (`;` / `,`) y la codificación (UTF-8 con o sin BOM, o Windows-1252).

### Qué tocar además del plugin

- `config/plugins.ts`: registrar el plugin.
- `src/bootstrap/admin-roles.ts`: el permiso para Administrador de clínica.
- Si se añade `service.code` (decisión 2): el esquema, `npx strapi ts:generate-types`, `etiquetas-es.json`, la sección del servicio en `strapi-veterinaria-prompt.md` y `node verify-model-doc.js`.
- `smoke-validations.js`: casos de importación (fila inválida que no deja nada escrito, actualización por SKU, enum en español traducido).
- CLAUDE.md: una entrada como la de los otros plugins locales.

### Fuera de alcance (por ahora)

- Imágenes de producto: se suben después en el panel.
- Existencias: no se guardan en el producto. El stock inicial llegará con los movimientos por lote.
- Exportar el catálogo a Excel. Es fácil de añadir con la misma plantilla, pero **solo catálogos**: nunca tablas con datos personales (la misma decisión que se tomó con el plugin CSV).
- Importar proveedores, categorías o vacunas clínicas. Si una categoría no existe, la fila da error (no se crea sola, para evitar "Biologicos" y "Biológicos" duplicadas). Se puede reconsiderar.

## Decisiones pendientes

1. **Formato del archivo**: .xlsx, CSV o ambos. **Recomendado: .xlsx** (listas desplegables, sin problemas de `;` ni de tildes), y CSV como alternativa de solo lectura.
2. **Clave del servicio**:
   - **(a)** Actualizar por nombre: sin cambiar el esquema, pero renombrar un servicio en el archivo crearía uno nuevo.
   - **(b)** Añadir `code` (string, único, opcional): más robusto, pero hay que tocar el esquema y el documento de modelo.

   **Recomendado: (b).**
