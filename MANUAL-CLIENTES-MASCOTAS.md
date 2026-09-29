# Manual: crear un cliente y su mascota

Paso a paso para registrar en el panel a un cliente nuevo y a su mascota, tal como llega al mostrador.

Lo hace **Recepción** (también Veterinario y Administración). Se trabaja en el panel (`/admin`), menú **Content Manager** (en español, *Gestor de contenido*).

---

## Antes de empezar

### En qué orden se crea

Un cliente se registra en **cuatro partes**, y el orden importa porque cada una se engancha a la anterior:

```
1. Perfil        la persona: nombre y documento
2. Contactos     su teléfono y su correo
3. Cliente       la ficha de cliente de esa persona
4. Mascota       la mascota, con el cliente como propietario
```

El panel no deja crear una parte "desde dentro" de otra: primero se guarda el perfil, luego se crea el cliente y se elige ese perfil, y así sucesivamente.

> **Antes de crear, busca.** En *Perfil*, escribe el número de documento en el buscador de la lista. Si la persona ya existe, no la crees de nuevo: el sistema no deja dos perfiles con el mismo documento.

### Cómo leer las tablas de campos

Cada paso empieza con una tabla de **todos** los campos que verás en pantalla:

| Columna | Qué indica |
| --- | --- |
| **Campo** | El nombre tal como aparece en el formulario |
| **Descripción** | Para qué sirve y cómo se llena |
| **Obligatorio** | **Sí** — sin él no se puede guardar. **No** — opcional. **Automático** — lo llena el sistema; no lo toques |
| **Ejemplo** | Un valor válido |

> Algunas listas desplegables muestran sus opciones **en inglés** (`cc`, `phone`, `male`…). Cada paso trae la traducción.

---

## Paso 1 — Crear el perfil (la persona)

### Campos del perfil

| Campo | Descripción | Obligatorio | Ejemplo |
| --- | --- | :---: | --- |
| Nombres | Nombre o nombres de la persona. Máximo 100 caracteres | **Sí** | `María` |
| Apellidos | Apellido o apellidos. Máximo 100 caracteres | **Sí** | `Restrepo Gómez` |
| Tipo de documento | Clase de documento de identidad (ver tabla de valores) | **Sí** | `cc` |
| Número de documento | Número sin puntos ni espacios. No puede repetirse con otro perfil del mismo tipo de documento. Máximo 30 caracteres | **Sí** | `1017254398` |
| Ocupación | A qué se dedica | No | `Docente` |
| Fecha de nacimiento | Fecha de nacimiento de la persona | No | `1985-03-14` |
| Género | Ver tabla de valores | No | `female` |
| País | País de origen o de residencia | No | `Colombia` |
| Foto | Foto de la persona | No | — |
| Direcciones | Una o varias direcciones (ver la tabla siguiente). La marcada como principal sale en las facturas | No, pero recomendado | — |
| Contactos | Muestra los teléfonos y correos de la persona. **No se llenan aquí:** se crean en el Paso 2 | Automático | — |
| Cliente | Muestra su ficha de cliente cuando exista. **Se enlaza en el Paso 3** | Automático | — |
| Usuario de la app | Cuenta de la persona en la app. **La crea el cliente al registrarse** (apartado 6) | Automático | — |
| Usuario del panel | Solo para el personal de la clínica. **Déjalo vacío** en un cliente | No usar | — |
| Archivado el | Fecha en que se dio de baja. **Déjalo vacío** al crear (ver "Borrar o dar de baja") | No | — |
| Etiqueta de búsqueda | Nombre y documento juntos, para buscar a la persona en los selectores. La escribe el sistema al guardar | Automático | `María Restrepo · CC 1017254398` |

**Campos de cada dirección** (dentro de *Direcciones*):

| Campo | Descripción | Obligatorio | Ejemplo |
| --- | --- | :---: | --- |
| Tipo de dirección | `home` (casa) o `work` (trabajo) | **Sí** | `home` |
| Dirección | Calle, número, apartamento. Máximo 255 caracteres | **Sí** | `Calle 10 #43-12, apto 502` |
| Ciudad | Ciudad o municipio | **Sí** | `Medellín` |
| Departamento | Departamento o región | No | `Antioquia` |
| País | País de la dirección | No | `Colombia` |
| Código postal | Código postal | No | `050021` |
| Referencia | Indicaciones para llegar | No | `Frente al parque` |
| Principal | La que se usa en facturas y avisos. **Solo una** por persona | No | ✔ |

**Valores de las listas:**

| Tipo de documento | Significa | | Género | Significa |
| --- | --- | --- | --- | --- |
| `cc` | Cédula de ciudadanía | | `male` | Masculino |
| `ce` | Cédula de extranjería | | `female` | Femenino |
| `ti` | Tarjeta de identidad | | `other` | Otro |
| `passport` | Pasaporte | | | |
| `nit` | NIT (empresas) | | | |
| `ppt` | Permiso por Protección Temporal | | | |

### Paso a paso

1. Ve a **Content Manager → Perfil**.
2. Busca el documento en la lista para confirmar que la persona no existe.
3. Pulsa **Crear nueva entrada**.
4. Llena **Nombres**, **Apellidos**, **Tipo de documento** y **Número de documento**.
5. Llena los opcionales que tengas (fecha de nacimiento, género, país, ocupación, foto).
6. En **Direcciones**, pulsa **Agregar una entrada** y llena la dirección. Marca **Principal** si es la que va en las facturas.
7. Pulsa **Guardar**.

---

## Paso 2 — Crear sus contactos (teléfono y correo)

Cada teléfono o correo es un registro aparte. Crea uno por cada dato.

### Campos del contacto

| Campo | Descripción | Obligatorio | Ejemplo |
| --- | --- | :---: | --- |
| Perfil | La persona a la que pertenece el dato. Se busca por nombre o documento | **Sí** | `María Restrepo · CC 1017254398` |
| Tipo de contacto | Qué clase de dato es (ver tabla de valores) | **Sí** | `phone_whatsapp` |
| Valor | El teléfono o el correo. **Teléfono:** con prefijo del país, sin espacios ni guiones. **Correo:** dirección completa. Máximo 255 caracteres | **Sí** | `+573014785512` / `maria.restrepo@example.com` |
| Principal | El dato que se usa primero para ese tipo. **Solo uno principal por tipo** en cada persona | No | ✔ |
| Notas | Aclaraciones | No | `Llamar después de las 5 p. m.` |
| Metadatos | Uso técnico del sistema. **No lo llenes** | No usar | — |
| Verificado el | Fecha en que el cliente confirmó el dato con un código. La pone el sistema | Automático | — |
| Etiqueta de búsqueda | Dato, tipo y persona juntos. La escribe el sistema | Automático | `+573014785512 · phone — María Restrepo` |

**Valores de *Tipo de contacto*:**

| En la lista | Significa |
| --- | --- |
| `phone` | Teléfono |
| `phone_whatsapp` | WhatsApp |
| `phone_emergency` | Teléfono de emergencia |
| `email` | Correo personal |
| `email_work` | Correo del trabajo |

> El mismo dato no se puede registrar dos veces para la misma persona.

### Paso a paso

1. Ve a **Content Manager → Contacto**.
2. Pulsa **Crear nueva entrada**.
3. En **Perfil**, escribe el nombre o el documento de la persona y elígela.
4. Elige el **Tipo de contacto**.
5. Escribe el **Valor** (teléfono con `+57`, o el correo).
6. Si es el dato principal de ese tipo, marca **Principal**.
7. Pulsa **Guardar**.
8. Para el siguiente dato (por ejemplo, el correo después del celular), vuelve al paso 2.

> Registra bien el teléfono y el correo: ahí envía el sistema el código cuando el cliente activa su cuenta en la app (apartado 6), y salen en sus facturas.

---

## Paso 3 — Crear la ficha de cliente

### Campos del cliente

| Campo | Descripción | Obligatorio | Ejemplo |
| --- | --- | :---: | --- |
| Perfil | La persona que es cliente. Se busca por nombre o documento. Una persona tiene una sola ficha de cliente | **Sí** | `María Restrepo · CC 1017254398` |
| Consentimientos | Autorizaciones del cliente (ver la tabla siguiente) | **Sí** | — |
| Cómo nos conoció | Por qué medio llegó a la clínica (ver tabla de valores) | No | `friend` |
| Detalle de cómo nos conoció | Más información sobre cómo llegó. Máximo 255 caracteres | No | `La refirió la señora Gómez` |
| Mascotas | Muestra sus mascotas. **No se llenan aquí:** se enlazan en el Paso 4 | Automático | — |
| Notas | Notas internas sobre el cliente (se crean en *Nota de cliente*) | Automático | — |
| Archivado el | Fecha de baja. **Déjalo vacío** al crear | No | — |
| Etiqueta de búsqueda | Nombre y documento, para buscarlo. La escribe el sistema | Automático | `María Restrepo · CC 1017254398` |

**Campos de *Consentimientos*** (hay que responder **Sí** o **No** en los cuatro):

| Campo | Descripción | Obligatorio | Ejemplo |
| --- | --- | :---: | --- |
| Tratamiento de datos | Autoriza el tratamiento de sus datos personales (ley de protección de datos) | **Sí** | Sí |
| Marketing | Acepta recibir promociones y campañas | **Sí** | No |
| SMS | Acepta mensajes de texto | **Sí** | Sí |
| Correo electrónico | Acepta mensajes por correo | **Sí** | Sí |
| Último cambio | Fecha del último cambio de estas autorizaciones | Automático | — |

**Valores de *Cómo nos conoció*:**

| En la lista | Significa |
| --- | --- |
| `friend` | Recomendación de un conocido |
| `social_media` | Redes sociales |
| `google` | Búsqueda en Google |
| `ad` | Publicidad |
| `walk_in` | Pasó por la clínica |
| `other` | Otro |

### Paso a paso

1. Ve a **Content Manager → Cliente**.
2. Pulsa **Crear nueva entrada**.
3. En **Perfil**, busca a la persona por nombre o documento y elígela.
4. En **Consentimientos**, responde **Sí** o **No** en los cuatro.
5. Si quieres, elige **Cómo nos conoció** y escribe el detalle.
6. Pulsa **Guardar**.

---

## Paso 4 — Crear la mascota

### Campos de la mascota

| Campo | Descripción | Obligatorio | Ejemplo |
| --- | --- | :---: | --- |
| Nombre | Nombre de la mascota. Máximo 80 caracteres | **Sí** | `Kira` |
| Propietario | El cliente dueño de la mascota. Se busca por nombre o documento | **Sí** | `María Restrepo · CC 1017254398` |
| Especie | Perro, gato… | **Sí** | `Perro` |
| Raza | Debe ser de la especie elegida. Si no existe, se deja vacía (ver nota) | No | `Labrador` |
| Sexo | Ver tabla de valores. Si no se indica, queda `unknown` | No | `female` |
| Fecha de nacimiento | No puede ser futura. Si no se sabe exacta, una aproximada | No | `2021-06-01` |
| Color | Color o pelaje. Máximo 60 caracteres | No | `Dorado` |
| Peso (kg) | Peso actual, con decimales. Se actualiza solo cada vez que el veterinario pesa a la mascota en consulta | No | `26.8` |
| Microchip | Número del microchip. No puede repetirse con otra mascota. Máximo 20 caracteres | No | `985112003456789` |
| Esterilización | Ver tabla de valores. Si no se indica, queda `unknown` | No | `sterilized` |
| Esterilizado el | Fecha de la esterilización. **Solo si Esterilización es `sterilized`** | No | `2022-02-10` |
| Fotos | Fotos de la mascota | No | — |
| Consultas | Muestra su historia clínica. Se llena al atenderla | Automático | — |
| Vacunas aplicadas | Muestra su carné de vacunas. Se llena al vacunarla | Automático | — |
| Alergias | Muestra sus alergias. Las registra el veterinario | Automático | — |
| Archivado el | Fecha de baja (por ejemplo, si falleció). **Déjalo vacío** al crear | No | — |
| Etiqueta de búsqueda | Nombre, raza y dueño juntos. La escribe el sistema | Automático | `Kira · Labrador — María Restrepo` |

**Valores de las listas:**

| Sexo | Significa | | Esterilización | Significa |
| --- | --- | --- | --- | --- |
| `male` | Macho | | `intact` | Sin esterilizar |
| `female` | Hembra | | `sterilized` | Esterilizado/a |
| `unknown` | Sin determinar | | `unknown` | No se sabe |

### Paso a paso

1. Ve a **Content Manager → Mascota**.
2. Pulsa **Crear nueva entrada**.
3. Escribe el **Nombre**.
4. En **Propietario**, busca al cliente por nombre o documento y elígelo.
5. Elige la **Especie** y, si la sabes, la **Raza**.
6. Llena lo que tengas del resto (sexo, fecha de nacimiento, color, peso, microchip, esterilización, fotos).
7. Pulsa **Guardar**.
8. Si el cliente tiene más mascotas, vuelve al paso 2 eligiendo el mismo propietario.

> **¿No aparece la raza?** Recepción solo puede elegir razas que ya existen. Pídele a Administración que la cree en **Content Manager → Raza** (con su especie), o deja la raza vacía por ahora.

---

## Paso 5 — Comprobar que quedó bien

1. Ve a **Content Manager → Cliente** y abre la ficha que creaste.
2. Revisa que en **Mascotas** aparezcan todas sus mascotas.
3. Si falta alguna, abre esa mascota y revisa que su **Propietario** sea este cliente.

A partir de aquí ya se le pueden **agendar citas** (menú **Agenda**), **abrir consultas** y **facturar** (ver `MANUAL-FACTURACION.md`).

---

## 6. Si el cliente quiere usar la app

El cliente activa su cuenta **él mismo, desde la app**. Recepción no le crea usuario ni contraseña.

1. El cliente abre la app y elige registrarse con su tipo y número de documento.
2. Como su ficha ya existe, la app no crea otra: le ofrece **reclamar** su ficha.
3. El sistema le envía un **código** al teléfono o correo que la clínica tiene en sus contactos (Paso 2). Nunca a uno que él escriba en ese momento: así nadie puede apropiarse de una ficha ajena conociendo solo una cédula.
4. El cliente escribe el código y elige su contraseña.
5. Desde ese momento ve en la app sus mascotas, citas, historia clínica y facturas, y en su perfil aparece el **Usuario de la app**.

Si el código no le llega, lo más probable es que su contacto esté mal registrado: revisa el Paso 2.

---

## Mensajes que pueden aparecer al guardar

| Mensaje | Qué pasa | Qué hacer |
| --- | --- | --- |
| "Ya existe un perfil con el documento CC …" | Esa persona ya está registrada | Búscala en *Perfil* y usa la que existe |
| "… no es un teléfono en formato E.164 (ejemplo: +573001234567)" | Falta el prefijo del país o hay espacios o guiones | Escríbelo como `+57` seguido del número, todo junto |
| "… no es un correo electrónico válido" | El correo está mal escrito | Revísalo (falta la `@`, hay espacios…) |
| "Ese contacto ya existe para este perfil" | Ese mismo dato ya está registrado | No hace falta crearlo otra vez |
| "Ya hay un contacto principal de tipo … en este perfil" | Ya hay otro principal de ese tipo | Desmarca *Principal* en uno de los dos |
| "Solo puede haber una dirección principal por perfil" | Hay dos direcciones marcadas como principal | Deja marcada solo una |
| "El campo "profile" es obligatorio …" / "El campo "owner" es obligatorio …" / "El campo "species" es obligatorio …" | Falta elegir el perfil, el propietario o la especie | Elígelo en su selector |
| "La raza seleccionada no pertenece a la especie de la mascota" | La raza es de otra especie | Cambia la raza o la especie |
| "La fecha de nacimiento no puede ser futura" | La fecha es posterior a hoy | Corrige la fecha |
| "Solo se puede indicar la fecha de esterilización si el estado es "sterilized"" | Hay fecha de esterilización pero el estado no lo dice | Pon *Esterilización* en `sterilized`, o borra la fecha |

---

## Borrar o dar de baja

- **Una mascota que murió o un cliente que se fue no se borran:** se **archivan**, para no perder su historia clínica ni sus facturas.
  1. Abre la ficha (Mascota, Cliente o Perfil).
  2. En **Archivado el**, pon la fecha de hoy.
  3. Pulsa **Guardar**. Desde ese momento deja de aparecer en las listas y en los selectores.
- Si creaste algo por error y todavía no tiene citas, consultas ni facturas, sí se puede borrar desde su ficha (botón de los tres puntos → **Eliminar**).
