# Tarea: implementar el modelo de datos de una veterinaria en Strapi 5

Eres un desarrollador senior de Strapi 5 (TypeScript o JavaScript, PostgreSQL). Implementa **exactamente** el modelo descrito en este documento dentro de un proyecto Strapi 5 existente. No inventes entidades, campos ni relaciones que no estén aquí. Si algo no está especificado, elige la opción más simple y nativa de Strapi y déjalo anotado en un comentario `// DECISIÓN:`.

---

## 1. Decisiones cerradas (no reabrir)

1. **Sin multi-tenant.** No crear organizaciones, membresías, dominios, planes SaaS ni ningún campo `organization`/`tenant`. Se hará en otra iteración.
2. **Roles y permisos 100 % nativos de Strapi.**
   - Clientes (dueños de mascotas): plugin `users-permissions`, rol `client`. Es el único rol de la API.
   - Staff (Recepción, Veterinario, Administrador de clínica): cuentas del panel (`admin::user`) con el RBAC nativo del admin.
   - No crear tablas `roles`, `permissions`, `role_permission`, `model_role`, `oauth_users`, `auth_contacts` ni `refresh_tokens`.
   - Login social: solo providers nativos de `users-permissions` (no crear providers personalizados).
   - Refresh tokens: si la versión de Strapi instalada trae gestión de sesiones nativa en `users-permissions`, activarla según la documentación oficial; si no, usar el JWT nativo. No crear tablas propias de sesión.
3. **El staff (veterinarios, recepción, administración) trabaja en el panel admin**, no en una app propia. Toda relación con un miembro del staff (`vet`, `responsible`, `staff`, `author`, `verifiedBy`) apunta a `admin::user`. Las relaciones de "quién lo hizo" que pueden ser de un cliente o del staff (`appointment.bookedBy`, `signed-document-event.performedBy`) apuntan a `api::identity.profile`, que tienen los dos. `plugin::users-permissions.user` queda solo para clientes. *(Revisado 2026-09-28: antes el staff usaba users-permissions; se migró con `migrate-staff-to-admin.js`.)*
4. **Draft & Publish desactivado** en todos los content types (`"draftAndPublish": false`).
5. **Sin soft delete genérico.** Solo existe `archivedAt` (datetime) en: `profile`, `customer`, `pet`, `consultation`, `signed-document`, `invoice`. Los catálogos usan `isActive`. El resto se borra físicamente.
6. **Sin campos de auditoría manuales.** `createdAt`/`updatedAt` los gestiona Strapi. No añadir `created_at`, `updated_at`, `deleted_at`.
7. **Media Library nativa** para todos los archivos (no guardar URLs de archivos propios en campos string).
8. **No existe `medical_history`.** Las consultas, vacunas y alergias se relacionan directamente con la mascota.
9. Documentos de identidad aceptados: `cc`, `ce`, `ti`, `passport`, `nit`, `ppt`.
10. Esterilización: `intact`, `sterilized`, `unknown` (no existe `castrated`).
11. El caso de viaje admite el estado `cancelled`.

## 2. Convenciones

| Elemento | Convención | Ejemplo |
| --- | --- | --- |
| UID | `api::<dominio>.<singular>` (varios content types por carpeta de API) | `api::clinical.consultation` |
| singularName / pluralName | kebab-case en inglés, distintos entre sí | `pet-vaccination` / `pet-vaccinations` |
| collectionName | snake_case plural | `pet_vaccinations` |
| Atributos | camelCase | `nextDueOn` |
| Fechas | sufijo `On` = `date`; sufijo `At` = `datetime` | `appliedOn`, `signedAt` |
| Enumeraciones | snake_case en minúscula | `in_progress` |
| Montos | `integer` en pesos colombianos, sin decimales | `basePrice` |
| Estados | el atributo se llama `state`, nunca `status` | `state` |

Nombres reservados de Strapi 5 que **no** se pueden usar como atributo: `id`, `documentId`, `status`, `locale`, `localizations`, `publishedAt`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `meta`, y cualquier nombre que empiece por `strapi` o `__`.

## 3. Estructura de carpetas

```
src/
  api/
    shared/content-types/{country,contact,verification-code}/schema.json
    identity/content-types/profile/schema.json
    customer/content-types/{customer,customer-note}/schema.json
    pet/content-types/{pet,species,breed}/schema.json
    clinical/content-types/{consultation,vaccine,pet-vaccination,allergy,prescription}/schema.json
    scheduling/content-types/{appointment,service-category,service,clinic-room,staff-schedule,schedule-exception}/schema.json
    billing/content-types/{plan,plan-benefit,subscription,benefit-usage,invoice,invoice-item}/schema.json
    travel/content-types/travel-case/schema.json
    documents/content-types/{signed-document,signed-document-signer,signed-document-event}/schema.json
    marketing/content-types/{campaign,campaign-metric}/schema.json
    notification/content-types/{notification,notification-recipient,notification-delivery}/schema.json
    clinic/content-types/clinic/schema.json          ← single type
    catalog/content-types/{product,product-category,supplier}/schema.json
    hospitalization/content-types/{cage,hospitalization,treatment-order,evolution-entry,medication-administration}/schema.json
    cash/content-types/{cash-register,cash-session,payment,cash-movement}/schema.json
  components/
    clinic/opening-hours.json
    shared/address.json
    customer/consents.json
    billing/{dian-resolution,fiscal-responsibility,tax-profile}.json
    clinical/{attachment,service-line,product-line}.json
    clinical/{anamnesis,physical-exam,lab-result,imaging,diagnosis,procedure,treatment-plan,medication}.json
    clinical/prescription-item.json
    scheduling/{appointment-service,work-shift}.json
    catalog/{medication-details,vaccine-details,food-details,accessory-details,sanitary-registration,active-ingredient}.json
    travel/{health-certificate,rabies-titer,microchip-check,antiparasitic,import-permit,crate,other-requirement}.json
    marketing/{rule-species,rule-last-visit,rule-subscription,rule-vaccination-due,rule-city,rule-referral}.json
    documents/document-file.json
    hospitalization/cage-stay.json
    cash/denomination-count.json
  extensions/users-permissions/content-types/user/schema.json
  index.(ts|js)            ← middlewares de validación (sección 8)
database/migrations/        ← índices (sección 9)
```

Cada content type necesita además sus archivos estándar de `controllers`, `routes` y `services` generados con las factorías de Strapi (`factories.createCoreController`, `createCoreRouter`, `createCoreService`). Total: **48 content types (uno de ellos single type), 43 componentes, 1 extensión**.

## 4. Orden de implementación

1. Componentes.
2. Catálogos: `country`, `species`, `breed`, `service-category`, `service`, `clinic-room`, `vaccine`, `plan`, `plan-benefit`, `product-category`, `supplier`, `product`.
3. Personas: `profile`, extensión de `user`, `contact`, `verification-code`, `customer`, `customer-note`.
4. Mascotas y clínica: `pet`, `appointment`, `consultation`, `pet-vaccination`, `allergy`.
5. Facturación: `subscription`, `benefit-usage`, `invoice`, `invoice-item`.
6. Viajes, documentos, marketing, notificaciones, hospitalización (`cage`, `hospitalization`, `treatment-order`, `evolution-entry`, `medication-administration`), caja (`cash-register`, `cash-session`, `payment`, `cash-movement`).
7. Middlewares de validación, migración de índices, roles y permisos, seed de catálogos.
8. Arrancar Strapi y verificar los criterios de aceptación (sección 11).

Las relaciones bidireccionales deben declararse en **ambos** lados con `inversedBy` / `mappedBy` coincidentes, tal como aparecen abajo.

---

## 5. Componentes

### `src/components/shared/address.json`
```json
{
  "collectionName": "components_shared_addresses",
  "info": { "displayName": "Dirección", "icon": "pinMap" },
  "options": {},
  "attributes": {
    "addressType": { "type": "enumeration", "enum": ["home", "work"], "default": "home", "required": true },
    "addressLine": { "type": "string", "required": true, "maxLength": 255 },
    "city": { "type": "string", "required": true, "maxLength": 100 },
    "region": { "type": "string", "maxLength": 100 },
    "country": { "type": "relation", "relation": "manyToOne", "target": "api::shared.country" },
    "postalCode": { "type": "string", "maxLength": 20 },
    "reference": { "type": "string", "maxLength": 255 },
    "isPrimary": { "type": "boolean", "default": false }
  }
}
```

### `src/components/customer/consents.json`
```json
{
  "collectionName": "components_customer_consents",
  "info": { "displayName": "Consentimientos", "icon": "shield" },
  "options": {},
  "attributes": {
    "marketing": { "type": "boolean", "default": false, "required": true },
    "sms": { "type": "boolean", "default": false, "required": true },
    "email": { "type": "boolean", "default": false, "required": true },
    "dataProcessing": { "type": "boolean", "default": false, "required": true },
    "lastChangedAt": { "type": "datetime" }
  }
}
```

### `src/components/clinical/attachment.json`
```json
{
  "collectionName": "components_clinical_attachments",
  "info": {
    "displayName": "Adjunto",
    "icon": "attachment"
  },
  "options": {},
  "attributes": {
    "file": {
      "type": "media",
      "multiple": false,
      "required": true,
      "allowedTypes": [
        "images",
        "files"
      ]
    },
    "attachmentKind": {
      "type": "enumeration",
      "enum": [
        "lab_result",
        "x_ray",
        "ultrasound",
        "photo",
        "other"
      ],
      "default": "other"
    },
    "description": {
      "type": "string",
      "maxLength": 255
    }
  }
}
```

### `src/components/scheduling/appointment-service.json`
```json
{
  "collectionName": "components_scheduling_appointment_services",
  "info": { "displayName": "Servicio de la cita", "icon": "clock" },
  "options": {},
  "attributes": {
    "service": { "type": "relation", "relation": "manyToOne", "target": "api::scheduling.service" },
    "durationMinutes": { "type": "integer", "min": 5 },
    "price": { "type": "integer", "min": 0 }
  }
}
```

### `src/components/travel/health-certificate.json`

Certificado de exportación emitido por la autoridad sanitaria.
```json
{
  "collectionName": "components_travel_health_certificates",
  "info": {
    "displayName": "Certificado zoosanitario",
    "icon": "shield",
    "description": "Certificado de exportación emitido por la autoridad sanitaria."
  },
  "options": {},
  "attributes": {
    "issuingAuthority": {
      "type": "string",
      "default": "ICA",
      "maxLength": 120
    },
    "certificateNumber": {
      "type": "string",
      "maxLength": 60
    },
    "issuedOn": {
      "type": "date"
    },
    "validUntil": {
      "type": "date"
    },
    "isCompleted": {
      "type": "boolean",
      "default": false
    },
    "document": {
      "type": "media",
      "multiple": false,
      "allowedTypes": [
        "images",
        "files"
      ]
    },
    "verifiedBy": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "admin::user"
    },
    "verifiedAt": {
      "type": "datetime"
    }
  }
}
```

### `src/components/travel/rabies-titer.json`

Titulación de anticuerpos antirrábicos. Muchos destinos exigen un mínimo de 0,5 UI/ml.
```json
{
  "collectionName": "components_travel_rabies_titers",
  "info": {
    "displayName": "Titulación antirrábica",
    "icon": "seed",
    "description": "Titulación de anticuerpos antirrábicos. Muchos destinos exigen un mínimo de 0,5 UI/ml."
  },
  "options": {},
  "attributes": {
    "laboratory": {
      "type": "string",
      "maxLength": 150
    },
    "sampleTakenOn": {
      "type": "date"
    },
    "resultIuMl": {
      "type": "decimal",
      "min": 0
    },
    "thresholdIuMl": {
      "type": "decimal",
      "min": 0,
      "default": 0.5
    },
    "validUntil": {
      "type": "date"
    },
    "isCompleted": {
      "type": "boolean",
      "default": false
    },
    "document": {
      "type": "media",
      "multiple": false,
      "allowedTypes": [
        "images",
        "files"
      ]
    },
    "verifiedBy": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "admin::user"
    },
    "verifiedAt": {
      "type": "datetime"
    }
  }
}
```

### `src/components/travel/microchip-check.json`

Lectura del microchip y comprobación de la norma ISO.
```json
{
  "collectionName": "components_travel_microchip_checks",
  "info": {
    "displayName": "Verificación de microchip",
    "icon": "hashtag",
    "description": "Lectura del microchip y comprobación de la norma ISO."
  },
  "options": {},
  "attributes": {
    "microchipNumber": {
      "type": "string",
      "maxLength": 20
    },
    "implantedOn": {
      "type": "date"
    },
    "isoCompliant": {
      "type": "boolean",
      "default": true
    },
    "isCompleted": {
      "type": "boolean",
      "default": false
    },
    "document": {
      "type": "media",
      "multiple": false,
      "allowedTypes": [
        "images",
        "files"
      ]
    },
    "verifiedBy": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "admin::user"
    },
    "verifiedAt": {
      "type": "datetime"
    }
  }
}
```

### `src/components/travel/antiparasitic.json`

Desparasitación exigida por el destino, con su ventana de tiempo antes del vuelo.
```json
{
  "collectionName": "components_travel_antiparasitics",
  "info": {
    "displayName": "Tratamiento antiparasitario",
    "icon": "plus",
    "description": "Desparasitación exigida por el destino, con su ventana de tiempo antes del vuelo."
  },
  "options": {},
  "attributes": {
    "drug": {
      "type": "string",
      "maxLength": 150
    },
    "administeredAt": {
      "type": "datetime"
    },
    "windowHoursBeforeFlight": {
      "type": "integer",
      "min": 0,
      "max": 720
    },
    "isCompleted": {
      "type": "boolean",
      "default": false
    },
    "document": {
      "type": "media",
      "multiple": false,
      "allowedTypes": [
        "images",
        "files"
      ]
    },
    "verifiedBy": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "admin::user"
    },
    "verifiedAt": {
      "type": "datetime"
    }
  }
}
```

### `src/components/travel/import-permit.json`

Autorización del país de destino.
```json
{
  "collectionName": "components_travel_import_permits",
  "info": {
    "displayName": "Permiso de importación",
    "icon": "gate",
    "description": "Autorización del país de destino."
  },
  "options": {},
  "attributes": {
    "permitNumber": {
      "type": "string",
      "maxLength": 60
    },
    "authority": {
      "type": "string",
      "maxLength": 150
    },
    "expiresOn": {
      "type": "date"
    },
    "isCompleted": {
      "type": "boolean",
      "default": false
    },
    "document": {
      "type": "media",
      "multiple": false,
      "allowedTypes": [
        "images",
        "files"
      ]
    },
    "verifiedBy": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "admin::user"
    },
    "verifiedAt": {
      "type": "datetime"
    }
  }
}
```

### `src/components/travel/crate.json`

Contenedor de viaje y su conformidad con la norma IATA.
```json
{
  "collectionName": "components_travel_crates",
  "info": {
    "displayName": "Guacal de transporte",
    "icon": "archive",
    "description": "Contenedor de viaje y su conformidad con la norma IATA."
  },
  "options": {},
  "attributes": {
    "lengthCm": {
      "type": "integer",
      "min": 1
    },
    "widthCm": {
      "type": "integer",
      "min": 1
    },
    "heightCm": {
      "type": "integer",
      "min": 1
    },
    "iataCompliant": {
      "type": "boolean",
      "default": false
    },
    "isCompleted": {
      "type": "boolean",
      "default": false
    },
    "document": {
      "type": "media",
      "multiple": false,
      "allowedTypes": [
        "images",
        "files"
      ]
    },
    "verifiedBy": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "admin::user"
    },
    "verifiedAt": {
      "type": "datetime"
    }
  }
}
```

### `src/components/travel/other-requirement.json`

Escape para exigencias del destino que no encajan en los tipos anteriores.
```json
{
  "collectionName": "components_travel_other_requirements",
  "info": {
    "displayName": "Otro requisito",
    "icon": "question",
    "description": "Escape para exigencias del destino que no encajan en los tipos anteriores."
  },
  "options": {},
  "attributes": {
    "requirementName": {
      "type": "string",
      "required": true,
      "maxLength": 150
    },
    "notes": {
      "type": "text"
    },
    "isCompleted": {
      "type": "boolean",
      "default": false
    },
    "document": {
      "type": "media",
      "multiple": false,
      "allowedTypes": [
        "images",
        "files"
      ]
    },
    "verifiedBy": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "admin::user"
    },
    "verifiedAt": {
      "type": "datetime"
    }
  }
}
```

### `src/components/documents/document-file.json`
```json
{
  "collectionName": "components_documents_document_files",
  "info": { "displayName": "Archivo del documento", "icon": "file" },
  "options": {},
  "attributes": {
    "fileKind": { "type": "enumeration", "enum": ["draft_pdf", "final_signed_pdf", "attachment"], "required": true },
    "file": { "type": "media", "multiple": false, "required": true, "allowedTypes": ["files", "images"] },
    "sha256": { "type": "string", "required": true, "regex": "^[a-f0-9]{64}$" }
  }
}
```

---

## 5.1 Secciones clínicas (dynamic zone de `consultation.sections`)

Siete componentes componen la historia clínica, más `clinical.medication`, que no va suelto en la zona sino anidado y repetible dentro de `clinical.treatment-plan`.

El orden de la zona lo decide quien escribe la consulta; el orden de abajo es el clínico habitual. Una visita de estética usa tres secciones y una cirugía las siete: esa es justamente la razón de la zona frente a campos fijos.

### `src/components/clinical/anamnesis.json`

Entrevista clínica: antecedentes, síntomas y evolución referidos por quien trae al paciente.
```json
{
  "collectionName": "components_clinical_anamneses",
  "info": {
    "displayName": "Anamnesis",
    "icon": "discuss",
    "description": "Entrevista clínica: antecedentes, síntomas y evolución referidos por quien trae al paciente."
  },
  "options": {},
  "attributes": {
    "history": {
      "type": "blocks",
      "required": true
    },
    "evolutionDays": {
      "type": "integer",
      "min": 0
    },
    "reportedBy": {
      "type": "enumeration",
      "enum": [
        "owner",
        "caretaker",
        "referring_vet",
        "other"
      ],
      "default": "owner"
    }
  }
}
```

### `src/components/clinical/physical-exam.json`

Constantes y hallazgos de la exploración.
```json
{
  "collectionName": "components_clinical_physical_exams",
  "info": {
    "displayName": "Exploración física",
    "icon": "doctor",
    "description": "Constantes y hallazgos de la exploración."
  },
  "options": {},
  "attributes": {
    "temperatureC": {
      "type": "decimal",
      "min": 30,
      "max": 45
    },
    "heartRateBpm": {
      "type": "integer",
      "min": 0,
      "max": 400
    },
    "respiratoryRateRpm": {
      "type": "integer",
      "min": 0,
      "max": 200
    },
    "mucousMembranes": {
      "type": "enumeration",
      "enum": [
        "normal",
        "pale",
        "congested",
        "icteric",
        "cyanotic"
      ]
    },
    "capillaryRefillSeconds": {
      "type": "decimal",
      "min": 0,
      "max": 10
    },
    "bodyConditionScore": {
      "type": "integer",
      "min": 1,
      "max": 9
    },
    "hydrationState": {
      "type": "enumeration",
      "enum": [
        "normal",
        "mild",
        "moderate",
        "severe"
      ]
    },
    "findings": {
      "type": "blocks"
    }
  }
}
```

### `src/components/clinical/lab-result.json`

Resultado de una prueba de laboratorio.
```json
{
  "collectionName": "components_clinical_lab_results",
  "info": {
    "displayName": "Laboratorio",
    "icon": "chartCircle",
    "description": "Resultado de una prueba de laboratorio."
  },
  "options": {},
  "attributes": {
    "panel": {
      "type": "enumeration",
      "enum": [
        "hemogram",
        "biochemistry",
        "urinalysis",
        "coprology",
        "cytology",
        "serology",
        "other"
      ],
      "required": true
    },
    "sampleTakenOn": {
      "type": "date"
    },
    "laboratory": {
      "type": "string",
      "maxLength": 120
    },
    "isAbnormal": {
      "type": "boolean",
      "default": false
    },
    "findings": {
      "type": "blocks"
    },
    "report": {
      "type": "media",
      "multiple": false,
      "allowedTypes": [
        "files",
        "images"
      ]
    }
  }
}
```

### `src/components/clinical/imaging.json`

Estudio de imagen y sus hallazgos.
```json
{
  "collectionName": "components_clinical_imagings",
  "info": {
    "displayName": "Imagen diagnóstica",
    "icon": "picture",
    "description": "Estudio de imagen y sus hallazgos."
  },
  "options": {},
  "attributes": {
    "modality": {
      "type": "enumeration",
      "enum": [
        "xray",
        "ultrasound",
        "ct",
        "mri",
        "endoscopy",
        "other"
      ],
      "required": true
    },
    "bodyRegion": {
      "type": "string",
      "maxLength": 120
    },
    "findings": {
      "type": "blocks"
    },
    "images": {
      "type": "media",
      "multiple": true,
      "allowedTypes": [
        "images",
        "files"
      ]
    }
  }
}
```

### `src/components/clinical/diagnosis.json`

Conclusión clínica del veterinario.
```json
{
  "collectionName": "components_clinical_diagnoses",
  "info": {
    "displayName": "Diagnóstico",
    "icon": "lightbulb",
    "description": "Conclusión clínica del veterinario."
  },
  "options": {},
  "attributes": {
    "diagnosisKind": {
      "type": "enumeration",
      "enum": [
        "presumptive",
        "definitive",
        "differential",
        "ruled_out"
      ],
      "default": "presumptive",
      "required": true
    },
    "condition": {
      "type": "string",
      "required": true,
      "maxLength": 200
    },
    "isPrimary": {
      "type": "boolean",
      "default": false
    },
    "details": {
      "type": "blocks"
    }
  }
}
```

### `src/components/clinical/procedure.json`

Procedimiento o cirugía realizada durante la consulta.
```json
{
  "collectionName": "components_clinical_procedures",
  "info": {
    "displayName": "Procedimiento",
    "icon": "scissors",
    "description": "Procedimiento o cirugía realizada durante la consulta."
  },
  "options": {},
  "attributes": {
    "procedureName": {
      "type": "string",
      "required": true,
      "maxLength": 200
    },
    "anesthesia": {
      "type": "enumeration",
      "enum": [
        "none",
        "local",
        "sedation",
        "general"
      ],
      "default": "none"
    },
    "durationMinutes": {
      "type": "integer",
      "min": 0
    },
    "findings": {
      "type": "blocks"
    },
    "complications": {
      "type": "text"
    }
  }
}
```

### `src/components/clinical/treatment-plan.json`

Indicaciones, medicación y recomendaciones.
```json
{
  "collectionName": "components_clinical_treatment_plans",
  "info": {
    "displayName": "Plan de tratamiento",
    "icon": "bulletList",
    "description": "Indicaciones, medicación y recomendaciones."
  },
  "options": {},
  "attributes": {
    "indications": {
      "type": "blocks",
      "required": true
    },
    "medications": {
      "type": "component",
      "repeatable": true,
      "component": "clinical.medication"
    },
    "recommendations": {
      "type": "blocks"
    },
    "followUpOn": {
      "type": "date"
    }
  }
}
```

### `src/components/clinical/medication.json`

Fármaco prescrito dentro de un plan de tratamiento.
```json
{
  "collectionName": "components_clinical_medications",
  "info": {
    "displayName": "Medicación",
    "icon": "plus",
    "description": "Fármaco prescrito dentro de un plan de tratamiento."
  },
  "options": {},
  "attributes": {
    "drug": {
      "type": "string",
      "required": true,
      "maxLength": 150
    },
    "dose": {
      "type": "string",
      "maxLength": 80
    },
    "route": {
      "type": "enumeration",
      "enum": [
        "oral",
        "sc",
        "im",
        "iv",
        "topical",
        "otic",
        "ophthalmic",
        "other"
      ],
      "default": "oral"
    },
    "frequencyHours": {
      "type": "integer",
      "min": 1,
      "max": 168
    },
    "durationDays": {
      "type": "integer",
      "min": 1
    },
    "product": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::catalog.product"
    },
    "quantity": {
      "type": "decimal",
      "min": 0
    },
    "notes": {
      "type": "string",
      "maxLength": 255
    }
  }
}
```
  
_No aparece en la zona: se anida dentro de `clinical.treatment-plan`._

`product` (opcional) enlaza el fármaco con un medicamento del catálogo (`productType = medication`): la fórmula médica (5.8) saca de ahí la presentación, los principios activos y si es de control especial. Sin `drug`, el servidor pone el nombre del producto. `quantity` es la cantidad total a dispensar (en unidades de venta del producto, o lo que diga `drug` si no hay producto); si llega, es mayor que 0.

---

## 5.2 Configuración de la clínica (single type)

Único `singleType` del modelo. Reúne lo que la DIAN exige del emisor en una factura electrónica y los datos operativos que consumen el portal y la app.

**Las credenciales NO van aquí.** Las claves de Dataico y el certificado de firma se quedan en el `.env`: este content type se lee por API, sale en la documentación OpenAPI y es exportable a CSV.

### `api::clinic.clinic`
```json
{
  "kind": "singleType",
  "collectionName": "clinic",
  "info": {
    "singularName": "clinic",
    "pluralName": "clinics",
    "displayName": "Clínica",
    "description": "Datos de la veterinaria: identidad, obligaciones tributarias y resoluciones de facturación DIAN."
  },
  "options": {
    "draftAndPublish": false
  },
  "attributes": {
    "legalName": {
      "type": "string",
      "required": true,
      "maxLength": 200
    },
    "tradeName": {
      "type": "string",
      "maxLength": 200
    },
    "logo": {
      "type": "media",
      "multiple": false,
      "allowedTypes": [
        "images"
      ]
    },
    "slogan": {
      "type": "string",
      "maxLength": 200
    },
    "documentType": {
      "type": "enumeration",
      "enum": [
        "nit",
        "cc",
        "ce"
      ],
      "default": "nit",
      "required": true
    },
    "documentNumber": {
      "type": "string",
      "required": true,
      "maxLength": 20
    },
    "verificationDigit": {
      "type": "string",
      "maxLength": 1,
      "regex": "^[0-9]$"
    },
    "personType": {
      "type": "enumeration",
      "enum": [
        "juridica",
        "natural"
      ],
      "default": "juridica",
      "required": true
    },
    "taxRegime": {
      "type": "enumeration",
      "enum": [
        "responsable_iva",
        "no_responsable_iva",
        "regimen_simple"
      ],
      "default": "responsable_iva",
      "required": true
    },
    "fiscalResponsibilities": {
      "type": "component",
      "repeatable": true,
      "component": "billing.fiscal-responsibility"
    },
    "ciiuCode": {
      "type": "string",
      "maxLength": 10
    },
    "merchantRegistration": {
      "type": "string",
      "maxLength": 40
    },
    "fiscalAddress": {
      "type": "component",
      "repeatable": false,
      "component": "shared.address"
    },
    "phone": {
      "type": "string",
      "maxLength": 20
    },
    "whatsapp": {
      "type": "string",
      "maxLength": 20
    },
    "email": {
      "type": "email"
    },
    "billingEmail": {
      "type": "email"
    },
    "website": {
      "type": "string",
      "maxLength": 200
    },
    "resolutions": {
      "type": "component",
      "repeatable": true,
      "component": "billing.dian-resolution"
    },
    "invoicingEnvironment": {
      "type": "enumeration",
      "enum": [
        "habilitacion",
        "produccion"
      ],
      "default": "habilitacion",
      "required": true
    },
    "defaultCurrency": {
      "type": "string",
      "default": "COP",
      "regex": "^[A-Z]{3}$"
    },
    "invoiceFooterNotes": {
      "type": "text"
    },
    "openingHours": {
      "type": "component",
      "repeatable": true,
      "component": "clinic.opening-hours"
    },
    "timezone": {
      "type": "string",
      "default": "America/Bogota",
      "maxLength": 60
    },
    "emergencyPhone": {
      "type": "string",
      "maxLength": 20
    },
    "defaultConsultationService": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::scheduling.service"
    },
    "offersHospitalization": {
      "type": "boolean",
      "default": false
    },
    "defaultHospitalizationDayService": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::scheduling.service"
    }
  }
}
```

Decisiones que conviene no revertir:

- **`resolutions` es repetible, no un bloque único.** Una resolución DIAN caduca (típicamente a los dos años) y hay que conservar las vencidas: una factura emitida en 2025 se ampara en la resolución de 2025, no en la vigente hoy. Solo una puede tener `isActive`.
- **`technicalKey` es `private`**: la clave técnica de la resolución no sale en ninguna respuesta de la API.
- **`verificationDigit` se valida contra el NIT** con el módulo 11 de la DIAN (`src/validations/clinic.ts`). Un DV mal escrito hace que la DIAN rechace todas las facturas, y el error no aparece hasta que se intenta emitir.
- **`fiscalResponsibilities` es un componente repetible** porque un contribuyente puede tener varias, y Strapi no tiene enumeración múltiple.
- **`fiscalAddress` reutiliza `shared.address`** en lugar de repetir los campos.
- **`offersHospitalization` enciende el módulo de hospitalización** (5.6, H1) y `defaultHospitalizationDayService` es el servicio con el que se cobra un día de estancia cuando la jaula no tiene el suyo (H4).
- **`defaultConsultationService` es el cargo que se propone al finalizar una atención sin servicios** (ver la regla del cargo en 7.5). Es una relación y no un nombre fijo en el código, para que renombrar el servicio en el catálogo no rompa la propuesta.

Reglas en `src/validations/clinic.ts`, todas verificadas: DV coherente con el NIT; una sola resolución activa; rango final mayor que el inicial; consecutivo dentro del rango; vigencia coherente; la resolución activa no puede estar vencida ni con el rango agotado (con aviso por log a menos de 100 números); y los horarios no pueden cerrar antes de abrir ni repetir día. Además, `currentNumber` ("último número usado") lo lleva el servidor: en una resolución ya guardada se conserva el valor almacenado aunque el formulario mande otro (así guardar Clínica mientras se factura no hace retroceder el consecutivo), y solo se acepta al crear la resolución; una resolución ya usada —con facturas emitidas que la citan, no con `currentNumber` puesto, porque una resolución puede arrancar a mitad de rango— no cambia de número, prefijo ni rango, y no se puede quitar de la lista (se desactiva).

### `src/components/billing/dian-resolution.json`

Resolución de facturación: prefijo, rango autorizado y vigencia. Las vencidas se conservan como histórico.
```json
{
  "collectionName": "components_billing_dian_resolutions",
  "info": {
    "displayName": "Resolución DIAN",
    "icon": "file",
    "description": "Resolución de facturación: prefijo, rango autorizado y vigencia. Las vencidas se conservan como histórico."
  },
  "options": {},
  "attributes": {
    "resolutionNumber": {
      "type": "string",
      "required": true,
      "maxLength": 40
    },
    "resolutionDate": {
      "type": "date",
      "required": true
    },
    "prefix": {
      "type": "string",
      "maxLength": 10
    },
    "rangeFrom": {
      "type": "biginteger",
      "required": true
    },
    "rangeTo": {
      "type": "biginteger",
      "required": true
    },
    "currentNumber": {
      "type": "biginteger"
    },
    "validFrom": {
      "type": "date"
    },
    "validUntil": {
      "type": "date"
    },
    "technicalKey": {
      "type": "string",
      "private": true,
      "maxLength": 200
    },
    "isActive": {
      "type": "boolean",
      "default": false,
      "required": true
    }
  }
}
```

### `src/components/billing/fiscal-responsibility.json`

Código de responsabilidad tributaria de la DIAN; va en el XML de la factura electrónica.
```json
{
  "collectionName": "components_billing_fiscal_responsibilities",
  "info": {
    "displayName": "Responsabilidad fiscal",
    "icon": "shield",
    "description": "Código de responsabilidad tributaria de la DIAN; va en el XML de la factura electrónica."
  },
  "options": {},
  "attributes": {
    "code": {
      "type": "enumeration",
      "enum": [
        "o_13",
        "o_15",
        "o_23",
        "o_47",
        "r_99_pn"
      ],
      "required": true
    },
    "notes": {
      "type": "string",
      "maxLength": 150
    }
  }
}
```

### `src/components/clinic/opening-hours.json`

Franja de atención de un día. Alimenta el portal y la agenda en línea.
```json
{
  "collectionName": "components_clinic_opening_hours",
  "info": {
    "displayName": "Horario de atención",
    "icon": "clock",
    "description": "Franja de atención de un día. Alimenta el portal y la agenda en línea."
  },
  "options": {},
  "attributes": {
    "dayOfWeek": {
      "type": "enumeration",
      "enum": [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday"
      ],
      "required": true
    },
    "isClosed": {
      "type": "boolean",
      "default": false
    },
    "opensAt": {
      "type": "time"
    },
    "closesAt": {
      "type": "time"
    },
    "notes": {
      "type": "string",
      "maxLength": 120
    }
  }
}
```

---

## 5.3 Catálogo comercial (productos)

Todo lo vendible que no es un servicio vive en **un solo** content type, `api::catalog.product`: medicamentos, vacunas, alimentos, juguetes, accesorios, higiene, insumos. Lo que distingue un tipo de otro es `productType` (columna filtrable, decide el comportamiento) y un bloque de datos propios en la dynamic zone `details`. Las categorías (`product-category`) son clasificación comercial libre y no cambian el comportamiento.

Añadir un tipo de producto = un valor del enum `productType` y, si tiene datos propios, un componente en `details` y una entrada en `DETALLE_POR_TIPO` (`src/validations/catalog.ts`) y en `populate-details`. La consulta y la futura facturación no cambian: solo ven "un producto".

| `productType` | bloque de `details` | obligatorio |
| --- | --- | --- |
| `medication` | `catalog.medication-details` | sí |
| `vaccine` | `catalog.vaccine-details` | sí (enlaza la vacuna clínica) |
| `food` | `catalog.food-details` | no |
| `toy`, `accessory` | `catalog.accessory-details` | no |
| `hygiene`, `supply`, `other` | ninguno | — |

Preparado para inventario sin implementarlo todavía: `tracksInventory`, `tracksBatches` (por defecto sí en medicamentos, vacunas y alimentos), `minStock`, `referenceCost` (privado) y `preferredSupplier`. Las **existencias no se guardan en el producto**: saldrán de los movimientos de entrada y salida por lote (`product-batch`, `stock-movement`, pendientes), que es lo que da lotes, vencimientos y costo real.

El perfil tributario (`billing.tax-profile`) lo comparten `product` y `service`, para que la factura trate igual cualquier concepto.

### `src/components/billing/tax-profile.json`

Tratamiento de IVA de un concepto vendible. Gravado exige tarifa 5 o 19; exento y excluido llevan tarifa 0.
```json
{
  "collectionName": "components_billing_tax_profiles",
  "info": {
    "displayName": "Perfil tributario",
    "icon": "hashtag",
    "description": "Tratamiento de IVA de lo que se vende; lo leerá la factura electrónica."
  },
  "options": {},
  "attributes": {
    "ivaTreatment": {
      "type": "enumeration",
      "enum": [
        "gravado",
        "exento",
        "excluido"
      ],
      "default": "gravado",
      "required": true
    },
    "ivaRate": {
      "type": "integer",
      "min": 0,
      "max": 100
    }
  }
}
```

### `src/components/catalog/sanitary-registration.json`

Registro que autoriza la venta: ICA para uso veterinario (medicamentos, biológicos, alimentos), INVIMA para medicamentos de uso humano.
```json
{
  "collectionName": "components_catalog_sanitary_registrations",
  "info": {
    "displayName": "Registro sanitario",
    "icon": "file",
    "description": "Registro ICA (uso veterinario) o INVIMA (uso humano) que autoriza la venta."
  },
  "options": {},
  "attributes": {
    "authority": {
      "type": "enumeration",
      "enum": [
        "ica",
        "invima",
        "other"
      ],
      "default": "ica",
      "required": true
    },
    "number": {
      "type": "string",
      "required": true,
      "maxLength": 60
    },
    "holder": {
      "type": "string",
      "maxLength": 150
    },
    "expiresOn": {
      "type": "date"
    }
  }
}
```

### `src/components/catalog/active-ingredient.json`

Principio activo y su concentración.
```json
{
  "collectionName": "components_catalog_active_ingredients",
  "info": {
    "displayName": "Principio activo",
    "icon": "layer",
    "description": "Principio activo y su concentración."
  },
  "options": {},
  "attributes": {
    "name": {
      "type": "string",
      "required": true,
      "maxLength": 120
    },
    "strength": {
      "type": "decimal",
      "min": 0
    },
    "strengthUnit": {
      "type": "enumeration",
      "enum": [
        "mg",
        "mcg",
        "g",
        "ui",
        "mg_ml",
        "mcg_ml",
        "ui_ml",
        "percent"
      ]
    }
  }
}
```

### `src/components/catalog/medication-details.json`

Datos propios de un medicamento. `cumCode` solo aplica a medicamentos de uso humano; `isControlled` marca los de control especial.
```json
{
  "collectionName": "components_catalog_medication_details",
  "info": {
    "displayName": "Datos de medicamento",
    "icon": "doctor",
    "description": "Registro, principios activos, forma farmacéutica y condiciones de venta."
  },
  "options": {},
  "attributes": {
    "registration": {
      "type": "component",
      "repeatable": false,
      "component": "catalog.sanitary-registration"
    },
    "activeIngredients": {
      "type": "component",
      "repeatable": true,
      "component": "catalog.active-ingredient"
    },
    "pharmaceuticalForm": {
      "type": "enumeration",
      "enum": [
        "tablet",
        "capsule",
        "oral_suspension",
        "oral_solution",
        "injectable",
        "ointment",
        "cream",
        "drops",
        "spray",
        "pour_on",
        "collar",
        "shampoo",
        "powder",
        "other"
      ],
      "required": true
    },
    "route": {
      "type": "enumeration",
      "enum": [
        "oral",
        "sc",
        "im",
        "iv",
        "topical",
        "otic",
        "ophthalmic",
        "other"
      ],
      "default": "oral"
    },
    "laboratory": {
      "type": "string",
      "maxLength": 150
    },
    "cumCode": {
      "type": "string",
      "maxLength": 30
    },
    "atcVetCode": {
      "type": "string",
      "maxLength": 20
    },
    "requiresPrescription": {
      "type": "boolean",
      "default": true
    },
    "isControlled": {
      "type": "boolean",
      "default": false
    },
    "storage": {
      "type": "enumeration",
      "enum": [
        "ambient",
        "refrigerated",
        "frozen"
      ],
      "default": "ambient"
    }
  }
}
```

### `src/components/catalog/vaccine-details.json`

Presentación comercial de una vacuna clínica (`api::clinical.vaccine`), que sigue siendo la que usa el carné (`pet-vaccination`).
```json
{
  "collectionName": "components_catalog_vaccine_details",
  "info": {
    "displayName": "Datos de vacuna",
    "icon": "shield",
    "description": "Vacuna clínica que contiene este producto, registro y cadena de frío."
  },
  "options": {},
  "attributes": {
    "vaccine": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::clinical.vaccine"
    },
    "registration": {
      "type": "component",
      "repeatable": false,
      "component": "catalog.sanitary-registration"
    },
    "laboratory": {
      "type": "string",
      "maxLength": 150
    },
    "dosesPerUnit": {
      "type": "integer",
      "default": 1,
      "min": 1
    },
    "route": {
      "type": "enumeration",
      "enum": [
        "sc",
        "im",
        "intranasal",
        "oral",
        "other"
      ],
      "default": "sc"
    },
    "storage": {
      "type": "enumeration",
      "enum": [
        "ambient",
        "refrigerated",
        "frozen"
      ],
      "default": "refrigerated"
    }
  }
}
```

### `src/components/catalog/food-details.json`

Datos propios de un alimento o suplemento.
```json
{
  "collectionName": "components_catalog_food_details",
  "info": {
    "displayName": "Datos de alimento",
    "icon": "restaurant",
    "description": "Tipo de alimento, etapa de vida, peso neto y registro ICA."
  },
  "options": {},
  "attributes": {
    "registration": {
      "type": "component",
      "repeatable": false,
      "component": "catalog.sanitary-registration"
    },
    "foodType": {
      "type": "enumeration",
      "enum": [
        "dry",
        "wet",
        "treat",
        "supplement",
        "therapeutic_diet"
      ],
      "required": true
    },
    "lifeStage": {
      "type": "enumeration",
      "enum": [
        "puppy_kitten",
        "adult",
        "senior",
        "all_stages"
      ],
      "default": "all_stages"
    },
    "netWeightGrams": {
      "type": "integer",
      "min": 1
    },
    "requiresPrescription": {
      "type": "boolean",
      "default": false
    }
  }
}
```

### `src/components/catalog/accessory-details.json`

Datos propios de un juguete o accesorio.
```json
{
  "collectionName": "components_catalog_accessory_details",
  "info": {
    "displayName": "Datos de juguete o accesorio",
    "icon": "puzzle",
    "description": "Material, talla y color."
  },
  "options": {},
  "attributes": {
    "material": {
      "type": "string",
      "maxLength": 80
    },
    "size": {
      "type": "enumeration",
      "enum": [
        "xs",
        "s",
        "m",
        "l",
        "xl",
        "unique"
      ],
      "default": "unique"
    },
    "color": {
      "type": "string",
      "maxLength": 40
    }
  }
}
```

## 5.4 Servicios y productos de la consulta (dynamic zone de `consultation.lines`)

Lo que el veterinario aplica, entrega o recomienda durante la consulta. Es una dynamic zone con una tarjeta por tipo, igual que la historia clínica: al pulsar "Agregar" se elige **Servicio** o **Producto**, y cada tarjeta tiene un único selector y su propia lista de estados. Así "o servicio o producto" y "entregado solo para productos" los impone el esquema, no una regla.

Sustituye al componente repetible `clinical.consultation-item` (una línea con dos selectores), migrado con `migrate-consultation-lines.js` en dos fases. Sin precio ni duración: la futura facturación convertirá en cargo las líneas `applied` y `dispensed` con el precio y el impuesto del catálogo. Sin `performedBy`: quien lo hace es el `vet` de la consulta. Añadir un tipo de línea (p. ej. un cargo libre) = otra tarjeta en la zona.

`label` lo rellena siempre el servidor con el nombre del servicio o producto, y es el main field de la tarjeta: con el bloque cerrado, el panel pinta en la cabecera el valor de un campo de texto del componente, y una relación no sirve para eso.

`lineKey` (UUID) es la identidad de la línea como concepto facturable (ver 5.5). La pone el servidor en la primera escritura y la conserva en las siguientes, emparejando por `id` del componente; una clave entrante solo se respeta si ya pertenecía a una línea de esa consulta, y un bloque duplicado en el panel recibe una nueva. Se muestra sin poder editarse. Las líneas anteriores al campo la reciben al arrancar (`src/bootstrap/backfill-line-keys.ts`).

Al abrir la consulta desde la agenda, los servicios de la cita se copian como líneas `applied` (decisión D3).

Consecuencia aceptada: los filtros de Strapi no atraviesan una dynamic zone, así que "consultas que recomendaron el producto X" necesitaría un endpoint propio, como `/consultations/search` para las secciones.

### `src/components/clinical/service-line.json`

Tarjeta Servicio: un servicio del catálogo realizado (`applied`) o recomendado (`recommended`).
```json
{
  "collectionName": "components_clinical_service_lines",
  "info": {
    "displayName": "Servicio",
    "icon": "handHeart",
    "description": "Servicio del catálogo realizado o recomendado en la consulta."
  },
  "options": {},
  "attributes": {
    "service": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::scheduling.service"
    },
    "quantity": {
      "type": "decimal",
      "required": true,
      "default": 1,
      "min": 0.01
    },
    "state": {
      "type": "enumeration",
      "enum": [
        "applied",
        "recommended"
      ],
      "default": "applied",
      "required": true
    },
    "notes": {
      "type": "text"
    },
    "label": {
      "type": "string",
      "maxLength": 255
    },
    "lineKey": {
      "type": "string",
      "maxLength": 36
    }
  }
}
```

### `src/components/clinical/product-line.json`

Tarjeta Producto: un producto del catálogo aplicado en la consulta (`applied`), entregado para llevar (`dispensed`) o recomendado (`recommended`). La cantidad es decimal (media tableta, 2,5 ml).
```json
{
  "collectionName": "components_clinical_product_lines",
  "info": {
    "displayName": "Producto",
    "icon": "shoppingCart",
    "description": "Producto del catálogo aplicado, entregado o recomendado en la consulta."
  },
  "options": {},
  "attributes": {
    "product": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::catalog.product"
    },
    "quantity": {
      "type": "decimal",
      "required": true,
      "default": 1,
      "min": 0.01
    },
    "state": {
      "type": "enumeration",
      "enum": [
        "applied",
        "dispensed",
        "recommended"
      ],
      "default": "applied",
      "required": true
    },
    "notes": {
      "type": "text"
    },
    "label": {
      "type": "string",
      "maxLength": 255
    },
    "lineKey": {
      "type": "string",
      "maxLength": 36
    }
  }
}
```

## 5.5 Facturación: diseño y decisiones

Flujo: **consulta → líneas de `consultation.lines` → elegir las facturables → borrador → emitir (consecutivo DIAN) → PDF**. Se implementa por fases; cada una actualiza este documento junto con su código, para que `verify-model-doc.js` no se desincronice.

**La línea de la consulta ES el concepto facturable.** No hay entidad "concepto" aparte. La consulta como cargo es su línea del servicio "Consulta general". Es facturable una línea de servicio `applied` y una de producto `applied` o `dispensed`; `recommended` nunca.

**Trazabilidad.** Cada línea lleva un `lineKey` (UUID) que pone y conserva el servidor. Cada renglón de factura (`api::billing.invoice-item`, colección) guarda `sourceConsultation` + `sourceLineKey` para siempre, y `lockKey` = `sourceLineKey` mientras su factura no esté anulada. Un índice único parcial sobre `lock_key` impide en base de datos que dos facturas vivas cobren la misma línea. Anular libera `lockKey`.

**Precios e impuestos** se copian (snapshot) al renglón desde el catálogo (`service.basePrice`, `product.salePrice`, `billing.tax-profile`); cambiar el catálogo no altera facturas existentes.

**Emisor = `api::clinic.clinic`.** No se duplica en el módulo. La numeración sale de la resolución activa de `clinic.resolutions`: `currentNumber` es "último número usado", lo incrementa el servidor de forma atómica al emitir y nunca puede bajar. Un borrador no consume consecutivo.

Decisiones (aprobadas 2026-09-29):

| # | Decisión |
| --- | --- |
| D1 | Una factura puede cubrir varias consultas del mismo cliente. `invoice.consultation` desaparece: la consulta la lleva cada renglón. |
| D2 | Al emitir se congelan los datos del emisor (`issuerSnapshot`) y del receptor (`buyer`): una reimpresión muestra los datos vigentes en la fecha de emisión. Se escriben una vez y no se editan. |
| D3 | Al abrir la consulta desde la cita, los servicios de la cita se copian como líneas `applied`. |
| D4 | Todas las facturas usan la resolución DIAN; no hay documento interno por ahora. |
| D5 | En borrador: descuento por renglón. El precio es el del catálogo; cambiarlo exige el permiso propio `facturacion.cambiar-precio` (solo Administrador de clínica y Super Admin) y un motivo, que queda en `invoice-item.priceOverrideReason`. Revisada 2026-09-30: antes bastaba el permiso de emitir, que tiene Recepción (D8). |
| D6 | Una cortesía se factura con descuento del 100 %; no hay marca "no cobrar" en la línea clínica. |
| D7 | El copago de los planes se pospone. |
| D8 | Recepción puede emitir. |

El PDF se genera con PDFKit bajo demanda y no se guarda en la Media Library (sus archivos son públicos por URL y el documento tiene datos personales). Servicio `api::billing.invoice-pdf` → `generar(factura)` devuelve `{ pdf, nombreArchivo }`: una factura emitida, anulada o con error DIAN se pinta con lo congelado al emitir (`issuerSnapshot`, `buyer`, resolución), así que regenerarla da siempre el mismo documento; un borrador es una vista previa con los datos actuales de Clínica y del perfil y marca de agua "BORRADOR" (la anulada lleva "ANULADA"). Lleva emisor con NIT-DV, régimen y responsabilidades; cliente; renglones con la consulta y mascota de origen; desglose de IVA por tarifa; totales; texto de la resolución DIAN y `invoiceFooterNotes`. No es la factura electrónica: la cabecera dice "Ambiente de habilitación DIAN: sin validez fiscal" o "pendiente de validación DIAN" hasta que exista la integración, que añadirá CUFE y QR al mismo generador (`src/api/billing/domain/documento-pdf.ts`).

**Plugin de panel `veterinaria-facturacion`** (`src/plugins/veterinaria-facturacion/`), misma arquitectura que la agenda. Páginas: bandeja con pendientes de cobro y listado de facturas (filtros por estado, pago, fechas y número o cliente), consulta → elegir conceptos → borrador, y detalle de factura (descuentos, precio manual solo con `cambiar-precio` y motivo (D5), añadir conceptos del catálogo o de otras consultas del cliente, observaciones, vista previa y descarga del PDF, emitir, registrar pago, anular). Además, un panel lateral "Facturación" en la ficha de la consulta del Content Manager y un botón "Facturar" en el modal de cita de la agenda. Permisos propios: `facturacion.ver`, `facturacion.preparar`, `facturacion.emitir`, `facturacion.anular`, `facturacion.cambiar-precio` (tabla de la sección 10). El plugin no tiene lógica de negocio: delega en los servicios de abajo.

**Servicio `api::billing.invoicing`** (`src/api/billing/services/invoicing.ts`). No valida por su cuenta: crea por el Document Service y las reglas de la sección 8 deciden, así que el panel, este servicio y cualquier integración aplican la misma regla.

- `estadoDeConsulta(consulta)`: cada línea como `pendiente`, `facturada` (con su factura) o `no_facturable` (con el motivo), un precio estimado con el catálogo de hoy y las facturas anuladas que la cobraron antes; resumen `sin_conceptos`, `sin_facturar`, `parcial` o `facturada`.
- `pendientes({ desde, hasta, cliente })`: consultas con algún concepto pendiente, la más reciente primero.
- `crearBorrador({ cliente?, conceptos: [{ consulta, lineKey, discountAmount? }], notas? })`: todo o nada, en una transacción. El cliente, si no se indica, es el dueño de la primera consulta.
- `crearVacia({ cliente })`, `agregarConceptos(factura, conceptos)`, `agregarDirecto(factura, { relacion, documentId, quantity })`: venta sin consulta y ampliar un borrador.
- `emitir(factura, { dueOn? })`: exige una resolución activa y vigente; sube el consecutivo con un único `UPDATE … WHERE COALESCE(current_number, range_from - 1) < range_to` dentro de la transacción que escribe la factura (dos emisiones simultáneas no toman el mismo número y, si la factura falla, el número no se pierde); `fullNumber` = prefijo + número; congela `buyer` (perfil del cliente), `issuerSnapshot` (Clínica, sin credenciales) y la resolución. Es la **única** vía para pasar una factura a emitida: la regla lo exige con un contexto (`domain/emision.ts`), así que numerar a mano desde el panel o la API se rechaza.

### `src/components/billing/party-snapshot.json`

Datos del receptor tal como salen en la factura, copiados del perfil del cliente al emitir (D2). Texto libre a propósito: es una copia, no una segunda ficha donde administrar al cliente.
```json
{
  "collectionName": "components_billing_party_snapshots",
  "info": { "displayName": "Datos del receptor", "icon": "user", "description": "Copia congelada al emitir de los datos del cliente que aparecen en la factura. No se edita." },
  "options": {},
  "attributes": {
    "name": { "type": "string", "maxLength": 200 },
    "documentType": { "type": "string", "maxLength": 20 },
    "documentNumber": { "type": "string", "maxLength": 30 },
    "address": { "type": "string", "maxLength": 255 },
    "city": { "type": "string", "maxLength": 100 },
    "email": { "type": "string", "maxLength": 255 },
    "phone": { "type": "string", "maxLength": 30 }
  }
}
```

## 5.6 Hospitalización: diseño y decisiones

Módulo opcional: **solo aplica si la clínica hospitaliza** (`clinic.offersHospitalization`). Flujo: **ingreso (mascota + jaula + veterinario responsable) → órdenes de tratamiento → hoja de evolución por hora (signos y tomas dadas u omitidas) → traslados → alta**. Dominio `src/api/hospitalization/` (cinco content types) y plugin de panel `veterinaria-hospitalizacion`.

Decisiones (aprobadas 2026-10-06):

| # | Decisión |
| --- | --- |
| H1 | Interruptor en Clínica: `offersHospitalization` (por defecto `false`). Sin él no se ingresa a nadie y la página del panel lo dice en vez de pintar un tablero vacío. |
| H2 | La jaula (`cage`) es su propio content type dentro de una sala `clinic-room` de tipo `hospitalization`. Aloja un paciente a la vez. |
| H3 | La hospitalización se factura como **origen propio**, no escribiendo líneas en `consultation.lines`: hacerlo durante días pisaría el formulario de consulta que el veterinario tiene abierto. El renglón lleva `sourceHospitalization` y `kind` `hospitalization_stay` / `hospitalization_product`. |
| H4 | Día de estancia = **día calendario iniciado** en la zona horaria de Clínica, del día del ingreso al del alta (o a hoy) incluidos. Se cobra con el `dailyService` de la jaula ocupada al final de ese día (al alta, el último), o con `clinic.defaultHospitalizationDayService` si la jaula no tiene. Sin servicio: no facturable, con el motivo. Clave del día: `<documentId>:<AAAA-MM-DD>`. |
| H5 | Cada administración `given` es un concepto facturable con su producto y su `quantity` (por defecto la `doseQuantity` de la orden). `omitted` nunca. Clave: `lineKey` UUID puesto por el servidor. |
| H6 | Una orden no puede tener dos tomas `given` con el mismo `scheduledFor`: evita la dosis doble cuando dos personas registran la misma toma. |
| H7 | El alta congela la hospitalización: después solo cambian `dischargeSummary`, `homeInstructions`, `dischargeMedications` y `followUpOn`. No hay "reabrir". Al dar el alta las órdenes activas pasan a `completed`. |
| H8 | Rol del panel nuevo **Auxiliar de hospitalización**: ve el tablero y registra signos y tomas; no prescribe, no da altas, no factura. Sin escritura en el Content Manager. |
| H9 | Las fechas de la hospitalización son **instantes reales (UTC)**, no hora de pared como las citas: casi todas son "ahora" y el Content Manager las muestra en la hora local del navegador. Día y hora de la hoja se calculan en la zona de Clínica. |

**Ciclo.** `state` `active → discharged`. El ingreso abre el primer tramo de `cageStays`; cambiar `cage` en una hospitalización activa cierra el tramo abierto y abre otro (lo hace el servidor: `cageStays` entrante se ignora). El alta exige `dischargeType` y `dischargedAt ≥ admittedAt` (por defecto, ahora), y `dischargeSummary` si es `medical`.

**Tomas programadas.** No se guardan: salen de cada orden (`startAt` + k·`frequencyHours` hasta `endAt` o el alta), con una función pura (`src/api/hospitalization/domain/tomas.ts`). Una toma está pendiente, dada, omitida o **atrasada** (más de 60 min sin registrar). Una orden `isPrn` ("si es necesario") no programa tomas: se registran cuando se dan.

**Facturación.** `api::hospitalization.hospitalization.conceptosFacturables(documentId)` devuelve los días y las tomas con su `lineKey`, y `api::billing.invoicing` los trata como los de una consulta: `estadoDeHospitalizacion`, `pendientes()` (con `origen`), `crearBorrador`/`agregarConceptos` con `{ hospitalizacion, lineKey }`. Un concepto cobrado por un renglón vivo bloquea lo que lo define: la toma no se borra ni cambia de producto, cantidad o estado; la hospitalización no se borra ni cambia de mascota, y mover `admittedAt`/`dischargedAt` o la jaula no puede hacer desaparecer ni cambiar de servicio un día cobrado.

**Portal.** El cliente ve sus hospitalizaciones (`GET /api/hospitalizations`, policy `is-owner`) con una lista blanca de campos: mascota, ingreso, estado, alta, resumen e indicaciones, medicación de alta y control. No ve órdenes, hoja de evolución ni tomas.

### `src/components/hospitalization/cage-stay.json`

Tramo de la hospitalización en una jaula. Lo escribe el servidor.
```json
{
  "collectionName": "components_hospitalization_cage_stays",
  "info": { "displayName": "Estancia en jaula", "icon": "house", "description": "Tramo de la hospitalización en una jaula. Lo escribe el servidor al ingresar y en cada traslado." },
  "options": {},
  "attributes": {
    "cage": { "type": "relation", "relation": "manyToOne", "target": "api::hospitalization.cage" },
    "fromAt": { "type": "datetime", "required": true },
    "toAt": { "type": "datetime" }
  }
}
```

## 5.7 Caja y pagos: diseño y decisiones

Punto de venta (plugin `veterinaria-caja`, se abre en una pestaña aparte) sobre el dominio `src/api/cash/`: **caja → turno (base, ventas, movimientos, arqueo) → pagos por medio**. Antes, la factura solo tenía `paymentState`, cambiado a mano.

Decisiones (aprobadas 2026-10-06):

| # | Decisión |
| --- | --- |
| C1 | Rol del panel **Caja** (nombre de la función, como Recepción). Recepción también abre caja y vende. |
| C2 | Medios: efectivo (con cambio), tarjeta débito/crédito (franquicia, últimos 4, aprobación), transferencia / Nequi / Daviplata (referencia) y saldo a favor. `other` solo para pagos migrados. |
| C3 | El POS vende el catálogo, cobra lo pendiente del cliente (consultas, hospitalizaciones) y abona a facturas emitidas. |
| C4 | Varias cajas; cierre con arqueo por denominación; un descuadre exige motivo. |
| C5 | Venta sin cliente registrado: cliente **Consumidor final** (NIT 222222222222), sembrado al arrancar. |
| C6 | Cobrar = emitir (consecutivo DIAN, D4) y registrar los pagos en una transacción; si queda saldo, la factura sale con pago parcial y pasa a cartera. |
| C7 | Movimientos del turno: ingreso de efectivo, retiro (sangría) y gasto menor. Las devoluciones son pagos de salida (C10). |
| C8 | El dinero entra solo por la caja: `paidAmount` y `paymentState` los calcula el servidor a partir de los pagos; nadie los escribe a mano. |
| C9 | Saldo a favor sin tabla propia: anticipo = pago sin factura (`purpose: advance`); usarlo = pago `credit_balance`. Saldo = anticipos − usos − devoluciones de anticipo. |
| C10 | Devolución = pago con `kind: refund`, exige el permiso `caja.devolver`. Una factura con `paidAmount > 0` no se anula sin devolver antes lo cobrado. |
| C11 | Un pago no se borra ni se edita: se reversa con motivo mientras su turno siga abierto. |
| C12 | El enlace del menú abre la ruta del POS en otra pestaña; la ruta se pinta a pantalla completa sobre el panel (misma sesión). |

**Efectivo esperado** de un turno = base + pagos en efectivo (neto de cambio) − devoluciones en efectivo + ingresos − retiros − gastos. `countedCash` sale del conteo por denominación; `difference` = contado − esperado. `totals` guarda, al cerrar, los totales por medio y por tipo.

**Cartera** = facturas emitidas con `amount − paidAmount > 0`, por cliente y por antigüedad (0–30, 31–60, 61–90, > 90 días desde `dueOn` o `issuedAt`).

Servicio `api::cash.pos`: `abrir`, `cerrar`, `catalogo`, `cliente`, `cobrar` (borrador + emisión + pagos en una transacción: si algo falla no queda factura, pago ni consecutivo consumido), `abonar`, `anticipo`, `devolver`, `reversar`, `movimiento`, `cartera`, `resumen`.

### `src/components/cash/denomination-count.json`

Cuántos billetes o monedas de una denominación hay en la caja.
```json
{
  "collectionName": "components_cash_denomination_counts",
  "info": { "displayName": "Conteo por denominación", "icon": "hashtag", "description": "Cuántos billetes o monedas de una denominación hay en la caja al abrir o al cerrar." },
  "options": {},
  "attributes": {
    "denomination": { "type": "integer", "required": true, "min": 1 },
    "kind": { "type": "enumeration", "enum": ["bill", "coin"], "default": "bill", "required": true },
    "quantity": { "type": "integer", "required": true, "default": 0, "min": 0 }
  }
}
```

## 5.8 Fórmula médica: diseño y decisiones

La receta que se entrega al propietario, emitida desde el plan de tratamiento de una consulta (panel lateral "Fórmula médica" de la consulta, plugin `veterinaria-historia`). Decisiones (aprobadas 2026-10-06):

| # | Decisión |
| --- | --- |
| F1 | La fórmula es un **documento guardado** (`api::clinical.prescription`), no una vista del plan: consecutivo propio `RX-000123` (`sequence` único, índice `ux_prescriptions_sequence`) y una **copia** de los medicamentos (`clinical.prescription-item`) y del firmante tomada al emitir. Reimprimir saca exactamente lo que se entregó aunque después cambie el plan o el perfil. |
| F2 | Emitida = congelada: no se edita ni se borra; se **anula** con motivo y se emite otra. La consulta que respalda una fórmula no se borra; con una fórmula vigente tampoco se archiva ni cambia de mascota. |
| F3 | El registro profesional vive en el **perfil**: `professionalLicense` (tarjeta profesional), `licenseIssuer` (p. ej. COMVEZCOL) y `signature` (imagen opcional; sin ella se firma a mano). Sin tarjeta no se emite. |
| F4 | Firma la **cuenta de la sesión** (`vet` → `admin::user`), no el `vet` de la consulta: el papel lleva la responsabilidad de quien la emite. |
| F5 | Permisos del panel: `formula.emitir` (Veterinario y Administrador de clínica) para emitir, reimprimir y anular las propias; `formula.anular` (Administrador de clínica) para anular las de otra persona. En el Content Manager es de solo lectura. Ningún rol de la API la lee. |
| F6 | Un medicamento de control especial (`medication-details.isControlled`) se formula igual, pero el papel avisa de que hace falta además el recetario oficial del Fondo Nacional de Estupefacientes: esta fórmula no lo sustituye. |
| F7 | Se imprime en **A5**: clínica, número, propietario, paciente (especie, raza, sexo, edad, peso), Rp/ con pauta y cantidad en cifras y en letras, indicaciones (las recomendaciones del plan, como texto), próximo control y firma con la tarjeta profesional. Una anulada se imprime con la marca "ANULADA". |

Servicio `api::clinical.prescribing`: `deConsulta` (medicamentos del plan, fórmulas emitidas y si la cuenta puede firmar), `emitir` (consecutivo y creación en una transacción, dentro de la marca `enServicioDeFormulas`), `ficha` (lo que se imprime) y `anular`.

### `src/components/clinical/prescription-item.json`

Un medicamento tal como salió en la fórmula.
```json
{
  "collectionName": "components_clinical_prescription_items",
  "info": {
    "displayName": "Medicamento formulado",
    "icon": "write",
    "description": "Copia de un medicamento del plan de tratamiento tal como salió en la fórmula médica."
  },
  "options": {},
  "attributes": {
    "drug": { "type": "string", "required": true, "maxLength": 150 },
    "presentation": { "type": "string", "maxLength": 255 },
    "activeIngredients": { "type": "string", "maxLength": 255 },
    "dose": { "type": "string", "maxLength": 80 },
    "route": {
      "type": "enumeration",
      "enum": ["oral", "sc", "im", "iv", "topical", "otic", "ophthalmic", "other"]
    },
    "frequencyHours": { "type": "integer", "min": 1, "max": 168 },
    "durationDays": { "type": "integer", "min": 1 },
    "quantity": { "type": "decimal", "min": 0 },
    "isControlled": { "type": "boolean", "default": false },
    "notes": { "type": "string", "maxLength": 255 }
  }
}
```

## 6. Extensión del usuario nativo

`src/extensions/users-permissions/content-types/user/schema.json` **reemplaza** el esquema nativo. Copia el `schema.json` del user que trae la versión instalada de `@strapi/plugin-users-permissions` (sin quitar ningún atributo nativo: `username`, `email`, `provider`, `password`, `resetPasswordToken`, `confirmationToken`, `confirmed`, `blocked`, `role`) y añade solo:

```json
"profile": {
  "type": "relation",
  "relation": "oneToOne",
  "target": "api::identity.profile",
  "inversedBy": "user"
}
```

Correspondencias con el modelo original: `users.password` → `password` nativo; `users.is_active` → `blocked` (invertido); verificación de email y reseteo de contraseña → flujos nativos.

---

## 7. Content types

### 7.1 Shared

#### `api::shared.country`
```json
{
  "kind": "collectionType",
  "collectionName": "countries",
  "info": { "singularName": "country", "pluralName": "countries", "displayName": "País" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "name": { "type": "string", "required": true, "maxLength": 100 },
    "isoCode": { "type": "string", "required": true, "unique": true, "regex": "^[A-Z]{2}$" },
    "dialCode": { "type": "string", "regex": "^\\+[0-9]{1,4}$" },
    "flag": { "type": "string", "maxLength": 16 }
  }
}
```

#### `api::shared.contact`
```json
{
  "kind": "collectionType",
  "collectionName": "contacts",
  "info": { "singularName": "contact", "pluralName": "contacts", "displayName": "Contacto" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "profile": { "type": "relation", "relation": "manyToOne", "target": "api::identity.profile", "inversedBy": "contacts" },
    "contactType": { "type": "enumeration", "enum": ["email", "email_work", "phone", "phone_emergency", "phone_whatsapp"], "required": true },
    "value": { "type": "string", "required": true, "maxLength": 255 },
    "isPrimary": { "type": "boolean", "default": false },
    "notes": { "type": "text" },
    "metadata": { "type": "json" },
    "verifiedAt": { "type": "datetime" }
  }
}
```

#### `api::shared.verification-code`
```json
{
  "kind": "collectionType",
  "collectionName": "verification_codes",
  "info": { "singularName": "verification-code", "pluralName": "verification-codes", "displayName": "Código de verificación" },
  "options": { "draftAndPublish": false },
  "pluginOptions": { "content-manager": { "visible": false } },
  "attributes": {
    "contact": { "type": "relation", "relation": "manyToOne", "target": "api::shared.contact" },
    "codeHash": { "type": "string", "required": true, "private": true },
    "purpose": { "type": "enumeration", "enum": ["email_verification", "phone_verification"], "required": true },
    "expiresAt": { "type": "datetime", "required": true },
    "usedAt": { "type": "datetime" }
  }
}
```
Solo verifica contactos del perfil. La verificación del email de login y el reseteo de contraseña son nativos de `users-permissions`. Guardar el hash del código, nunca el código plano.

### 7.2 Identity

#### `api::identity.profile`
```json
{
  "kind": "collectionType",
  "collectionName": "profiles",
  "info": { "singularName": "profile", "pluralName": "profiles", "displayName": "Perfil" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "firstName": { "type": "string", "required": true, "maxLength": 100 },
    "lastName": { "type": "string", "required": true, "maxLength": 100 },
    "documentType": { "type": "enumeration", "enum": ["cc", "ce", "ti", "passport", "nit", "ppt"], "required": true },
    "documentNumber": { "type": "string", "required": true, "maxLength": 30 },
    "occupation": { "type": "string", "maxLength": 100 },
    "birthDate": { "type": "date" },
    "gender": { "type": "enumeration", "enum": ["male", "female", "other"] },
    "country": { "type": "relation", "relation": "manyToOne", "target": "api::shared.country" },
    "photo": { "type": "media", "multiple": false, "allowedTypes": ["images"] },
    "addresses": { "type": "component", "repeatable": true, "component": "shared.address" },
    "contacts": { "type": "relation", "relation": "oneToMany", "target": "api::shared.contact", "mappedBy": "profile" },
    "user": { "type": "relation", "relation": "oneToOne", "target": "plugin::users-permissions.user", "mappedBy": "profile" },
    "customer": { "type": "relation", "relation": "oneToOne", "target": "api::customer.customer", "mappedBy": "profile" },
    "archivedAt": { "type": "datetime" },
    "searchLabel": { "type": "string", "maxLength": 255 },
    "adminUser": { "type": "relation", "relation": "oneToOne", "target": "admin::user" },
    "professionalLicense": { "type": "string", "maxLength": 40 },
    "licenseIssuer": { "type": "string", "maxLength": 120 },
    "signature": { "type": "media", "multiple": false, "allowedTypes": ["images"] }
  }
}
```
Un perfil representa a cualquier persona (staff o cliente).

`professionalLicense`, `licenseIssuer` y `signature` son el registro profesional de quien prescribe (tarjeta profesional, entidad que la expide y firma escaneada): los copia la fórmula médica al emitirse (5.8). Solo tienen sentido en el staff clínico.

Cada persona entra por una sola puerta: un cliente con `profile.user` (cuenta de
la app, users-permissions) y un miembro del staff con `profile.adminUser` (cuenta
del panel). El perfil es lo que tienen en común, y por eso las relaciones de
"quién lo hizo" que pueden ser de cualquiera de los dos (`appointment.bookedBy`,
`signed-document-event.performedBy`) apuntan al perfil.

`adminUser` es opcional: la agenda funciona sin él, porque las citas apuntan
directamente a la cuenta del panel. Lo que aporta es el nombre completo y la
ocupación, y que lo que esa persona agende quede con `bookedBy`.

### 7.3 Customer

#### `api::customer.customer`
```json
{
  "kind": "collectionType",
  "collectionName": "customers",
  "info": { "singularName": "customer", "pluralName": "customers", "displayName": "Cliente" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "profile": { "type": "relation", "relation": "oneToOne", "target": "api::identity.profile", "inversedBy": "customer" },
    "referralSource": { "type": "enumeration", "enum": ["friend", "social_media", "google", "ad", "walk_in", "other"] },
    "referralNotes": { "type": "string", "maxLength": 255 },
    "consents": { "type": "component", "repeatable": false, "component": "customer.consents", "required": true },
    "pets": { "type": "relation", "relation": "oneToMany", "target": "api::pet.pet", "mappedBy": "owner" },
    "notes": { "type": "relation", "relation": "oneToMany", "target": "api::customer.customer-note", "mappedBy": "customer" },
    "archivedAt": { "type": "datetime" }
  }
}
```
El acceso del cliente al portal se obtiene por `profile.user`. No existe relación directa cliente → usuario.

#### `api::customer.customer-note`
```json
{
  "kind": "collectionType",
  "collectionName": "customer_notes",
  "info": { "singularName": "customer-note", "pluralName": "customer-notes", "displayName": "Nota de cliente" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "customer": { "type": "relation", "relation": "manyToOne", "target": "api::customer.customer", "inversedBy": "notes" },
    "rating": { "type": "enumeration", "enum": ["good", "regular", "bad"] },
    "body": { "type": "text", "required": true },
    "author": { "type": "relation", "relation": "manyToOne", "target": "admin::user" }
  }
}
```

### 7.4 Pet

#### `api::pet.pet`
```json
{
  "kind": "collectionType",
  "collectionName": "pets",
  "info": { "singularName": "pet", "pluralName": "pets", "displayName": "Mascota" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "owner": { "type": "relation", "relation": "manyToOne", "target": "api::customer.customer", "inversedBy": "pets" },
    "name": { "type": "string", "required": true, "maxLength": 80 },
    "species": { "type": "relation", "relation": "manyToOne", "target": "api::pet.species" },
    "breed": { "type": "relation", "relation": "manyToOne", "target": "api::pet.breed" },
    "color": { "type": "string", "maxLength": 60 },
    "sex": { "type": "enumeration", "enum": ["male", "female", "unknown"], "default": "unknown" },
    "birthDate": { "type": "date" },
    "weightKg": { "type": "decimal", "min": 0 },
    "microchip": { "type": "string", "unique": true, "maxLength": 20 },
    "sterilizationState": { "type": "enumeration", "enum": ["intact", "sterilized", "unknown"], "default": "unknown" },
    "sterilizedOn": { "type": "date" },
    "photos": { "type": "media", "multiple": true, "allowedTypes": ["images"] },
    "consultations": { "type": "relation", "relation": "oneToMany", "target": "api::clinical.consultation", "mappedBy": "pet" },
    "vaccinations": { "type": "relation", "relation": "oneToMany", "target": "api::clinical.pet-vaccination", "mappedBy": "pet" },
    "allergies": { "type": "relation", "relation": "oneToMany", "target": "api::clinical.allergy", "mappedBy": "pet" },
    "hospitalizations": { "type": "relation", "relation": "oneToMany", "target": "api::hospitalization.hospitalization", "mappedBy": "pet" },
    "archivedAt": { "type": "datetime" }
  }
}
```

#### `api::pet.species`
```json
{
  "kind": "collectionType",
  "collectionName": "species",
  "info": { "singularName": "species", "pluralName": "species-list", "displayName": "Especie" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "name": { "type": "string", "required": true, "unique": true, "maxLength": 60 },
    "isActive": { "type": "boolean", "default": true },
    "breeds": { "type": "relation", "relation": "oneToMany", "target": "api::pet.breed", "mappedBy": "species" }
  }
}
```

#### `api::pet.breed`
```json
{
  "kind": "collectionType",
  "collectionName": "breeds",
  "info": { "singularName": "breed", "pluralName": "breeds", "displayName": "Raza" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "species": { "type": "relation", "relation": "manyToOne", "target": "api::pet.species", "inversedBy": "breeds" },
    "name": { "type": "string", "required": true, "maxLength": 80 },
    "isActive": { "type": "boolean", "default": true }
  }
}
```

### 7.5 Clinical

#### `api::clinical.consultation`
```json
{
  "kind": "collectionType",
  "collectionName": "consultations",
  "info": { "singularName": "consultation", "pluralName": "consultations", "displayName": "Consulta" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "pet": { "type": "relation", "relation": "manyToOne", "target": "api::pet.pet", "inversedBy": "consultations" },
    "vet": { "type": "relation", "relation": "manyToOne", "target": "admin::user" },
    "appointment": { "type": "relation", "relation": "oneToOne", "target": "api::scheduling.appointment", "inversedBy": "consultation" },
    "consultedAt": { "type": "datetime" },
    "reason": { "type": "text" },
    "sections": {
      "type": "dynamiczone",
      "components": [
        "clinical.anamnesis",
        "clinical.physical-exam",
        "clinical.lab-result",
        "clinical.imaging",
        "clinical.diagnosis",
        "clinical.procedure",
        "clinical.treatment-plan"
      ]
    },
    "weightKg": { "type": "decimal", "min": 0 },
    "nextControlOn": { "type": "date" },
    "attachments": { "type": "component", "repeatable": true, "component": "clinical.attachment" },
    "lines": { "type": "dynamiczone", "components": ["clinical.service-line", "clinical.product-line"] },
    "archivedAt": { "type": "datetime" }
  }
}
```
`nextControlOn` = fecha sugerida del próximo control (no es una cita).

**La consulta atendida siempre lleva cargo; si se cobra lo decide Facturación.** Al cerrar la cita de una consulta sin ningún `service-line` `applied` se añade un servicio: en "Finalizar atención" el veterinario elige cuál (propuesto `clinic.defaultConsultationService`), y el cierre nocturno y "Marcar atendida" en la agenda añaden el de Clínica. El veterinario no decide si se cobra: no hay campo de "sin cargo" en la consulta. Recepción o la administración deciden al preparar la factura; una cortesía se factura con descuento del 100 % en el renglón, que deja traza y saca la línea de pendientes. Si Clínica no tiene servicio por defecto, el cierre nocturno cierra sin cargo y Facturación → Pendientes de cobro marca la consulta como "sin cargo de consulta".

**El contenido clínico va en la dynamic zone `sections`** (sección 5.1), no en campos fijos: cada visita compone las secciones que necesita. Una consulta de estética lleva tres; una cirugía lleva las siete. Sustituye a los antiguos `anamnesis`, `diagnosis` y `treatmentNotes`, que eran tres `blocks` obligados a existir aunque la visita no los usara.

Dos consecuencias operativas de esa decisión:

- **La zona no se puebla con `populate=*`.** Hay que enumerar cada componente bajo `on`, y los que llevan media o componentes anidados necesitan su propio `populate`. Si se omite, la respuesta trae `sections: []` y la consulta parece vacía. Por eso las rutas `find` y `findOne` llevan el middleware `api::clinical.populate-sections`, que lo inyecta.
- **Los filtros de Strapi no atraviesan la zona**: `filters[sections][condition]` no existe. La búsqueda dentro de la historia clínica es un endpoint propio, `GET /api/consultations/search?section=<componente>&q=<texto>`, resuelto con el query engine sobre `consultations_cmps` y la tabla del componente.

#### `api::clinical.vaccine`
```json
{
  "kind": "collectionType",
  "collectionName": "vaccines",
  "info": { "singularName": "vaccine", "pluralName": "vaccines", "displayName": "Vacuna" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "name": { "type": "string", "required": true, "maxLength": 120 },
    "species": { "type": "relation", "relation": "manyToOne", "target": "api::pet.species" },
    "manufacturer": { "type": "string", "maxLength": 120 },
    "isMandatory": { "type": "boolean", "default": false },
    "isActive": { "type": "boolean", "default": true }
  }
}
```

#### `api::clinical.pet-vaccination`
```json
{
  "kind": "collectionType",
  "collectionName": "pet_vaccinations",
  "info": { "singularName": "pet-vaccination", "pluralName": "pet-vaccinations", "displayName": "Vacunación" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "pet": { "type": "relation", "relation": "manyToOne", "target": "api::pet.pet", "inversedBy": "vaccinations" },
    "vaccine": { "type": "relation", "relation": "manyToOne", "target": "api::clinical.vaccine" },
    "consultation": { "type": "relation", "relation": "manyToOne", "target": "api::clinical.consultation" },
    "vet": { "type": "relation", "relation": "manyToOne", "target": "admin::user" },
    "doseNumber": { "type": "integer", "min": 1 },
    "appliedOn": { "type": "date", "required": true },
    "nextDueOn": { "type": "date" },
    "batchNumber": { "type": "string", "maxLength": 60 },
    "batchExpiresOn": { "type": "date" },
    "notes": { "type": "text" }
  }
}
```

#### `api::clinical.allergy`
```json
{
  "kind": "collectionType",
  "collectionName": "allergies",
  "info": { "singularName": "allergy", "pluralName": "allergies", "displayName": "Alergia" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "pet": { "type": "relation", "relation": "manyToOne", "target": "api::pet.pet", "inversedBy": "allergies" },
    "allergen": { "type": "string", "required": true, "maxLength": 150 },
    "category": { "type": "enumeration", "enum": ["food", "environmental", "medication", "parasite", "other"] },
    "reaction": { "type": "text" },
    "severity": { "type": "enumeration", "enum": ["low", "moderate", "high", "life_threatening"] },
    "diagnosedOn": { "type": "date" },
    "vet": { "type": "relation", "relation": "manyToOne", "target": "admin::user" },
    "consultation": { "type": "relation", "relation": "manyToOne", "target": "api::clinical.consultation" },
    "isActive": { "type": "boolean", "default": true },
    "resolvedOn": { "type": "date" },
    "notes": { "type": "text" }
  }
}
```

#### `api::clinical.prescription`
```json
{
  "kind": "collectionType",
  "collectionName": "prescriptions",
  "info": {
    "singularName": "prescription",
    "pluralName": "prescriptions",
    "displayName": "Fórmula médica",
    "description": "Receta emitida a partir del plan de tratamiento de una consulta. Congelada al emitir: se anula, no se edita."
  },
  "options": { "draftAndPublish": false },
  "attributes": {
    "sequence": { "type": "integer", "min": 1 },
    "number": { "type": "string", "maxLength": 20 },
    "state": { "type": "enumeration", "enum": ["issued", "voided"], "default": "issued", "required": true },
    "issuedAt": { "type": "datetime" },
    "consultation": { "type": "relation", "relation": "manyToOne", "target": "api::clinical.consultation" },
    "pet": { "type": "relation", "relation": "manyToOne", "target": "api::pet.pet" },
    "vet": { "type": "relation", "relation": "manyToOne", "target": "admin::user" },
    "vetName": { "type": "string", "maxLength": 200 },
    "vetLicense": { "type": "string", "maxLength": 40 },
    "vetLicenseIssuer": { "type": "string", "maxLength": 120 },
    "vetSignature": { "type": "media", "multiple": false, "allowedTypes": ["images"] },
    "items": { "type": "component", "repeatable": true, "component": "clinical.prescription-item" },
    "instructions": { "type": "text" },
    "followUpOn": { "type": "date" },
    "voidedAt": { "type": "datetime" },
    "voidReason": { "type": "string", "maxLength": 255 },
    "searchLabel": { "type": "string", "maxLength": 255 }
  }
}
```
Fórmula médica (5.8). La crea y la anula solo `api::clinical.prescribing`; `vetName`, `vetLicense`, `vetLicenseIssuer`, `vetSignature` e `items` son copias tomadas al emitir. Main field `searchLabel` (número · mascota · fecha).

### 7.6 Scheduling

#### `api::scheduling.appointment`
```json
{
  "kind": "collectionType",
  "collectionName": "appointments",
  "info": { "singularName": "appointment", "pluralName": "appointments", "displayName": "Cita" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "pet": { "type": "relation", "relation": "manyToOne", "target": "api::pet.pet" },
    "responsible": { "type": "relation", "relation": "manyToOne", "target": "admin::user" },
    "room": { "type": "relation", "relation": "manyToOne", "target": "api::scheduling.clinic-room" },
    "bookedBy": { "type": "relation", "relation": "manyToOne", "target": "api::identity.profile" },
    "startAt": { "type": "datetime", "required": true },
    "endAt": { "type": "datetime", "required": true },
    "state": { "type": "enumeration", "enum": ["draft", "scheduled", "confirmed", "arrived", "in_progress", "completed", "cancelled", "no_show"], "default": "scheduled", "required": true },
    "source": { "type": "enumeration", "enum": ["front_desk", "online", "phone", "whatsapp", "internal"], "default": "front_desk", "required": true },
    "title": { "type": "string", "maxLength": 150 },
    "notes": { "type": "text" },
    "services": { "type": "component", "repeatable": true, "component": "scheduling.appointment-service" },
    "cancelledAt": { "type": "datetime" },
    "cancelReason": { "type": "enumeration", "enum": ["client_cancelled", "clinic_cancelled", "other"] },
    "cancelNotes": { "type": "text" },
    "arrivedAt": { "type": "datetime" },
    "completedAt": { "type": "datetime" },
    "consultation": { "type": "relation", "relation": "oneToOne", "target": "api::clinical.consultation", "mappedBy": "appointment" }
  }
}
```
El cliente de la cita se obtiene por `pet.owner` (no hay relación directa).

#### `api::scheduling.service-category`
```json
{
  "kind": "collectionType",
  "collectionName": "service_categories",
  "info": { "singularName": "service-category", "pluralName": "service-categories", "displayName": "Categoría de servicio" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "name": { "type": "string", "required": true, "unique": true, "maxLength": 100 },
    "sortOrder": { "type": "integer", "default": 0 },
    "isActive": { "type": "boolean", "default": true },
    "services": { "type": "relation", "relation": "oneToMany", "target": "api::scheduling.service", "mappedBy": "category" }
  }
}
```

#### `api::scheduling.service`
```json
{
  "kind": "collectionType",
  "collectionName": "services",
  "info": { "singularName": "service", "pluralName": "services", "displayName": "Servicio" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "category": { "type": "relation", "relation": "manyToOne", "target": "api::scheduling.service-category", "inversedBy": "services" },
    "name": { "type": "string", "required": true, "maxLength": 120 },
    "description": { "type": "text" },
    "defaultDurationMinutes": { "type": "integer", "required": true, "default": 30, "min": 5 },
    "basePrice": { "type": "integer", "min": 0 },
    "currency": { "type": "string", "default": "COP", "regex": "^[A-Z]{3}$" },
    "tax": { "type": "component", "repeatable": false, "component": "billing.tax-profile" },
    "colorHex": { "type": "string", "regex": "^#[0-9A-Fa-f]{6}$" },
    "isActive": { "type": "boolean", "default": true }
  }
}
```

#### `api::scheduling.clinic-room`
```json
{
  "kind": "collectionType",
  "collectionName": "clinic_rooms",
  "info": { "singularName": "clinic-room", "pluralName": "clinic-rooms", "displayName": "Consultorio" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "name": { "type": "string", "required": true, "unique": true, "maxLength": 80 },
    "roomType": { "type": "enumeration", "enum": ["consultation", "surgery", "grooming", "imaging", "lab", "hospitalization", "other"], "default": "consultation", "required": true },
    "isActive": { "type": "boolean", "default": true }
  }
}
```

### 7.7 Billing

#### `api::billing.plan`
```json
{
  "kind": "collectionType",
  "collectionName": "plans",
  "info": { "singularName": "plan", "pluralName": "plans", "displayName": "Plan" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "name": { "type": "string", "required": true, "unique": true, "maxLength": 100 },
    "description": { "type": "text" },
    "priceMonthly": { "type": "integer", "required": true, "min": 0 },
    "priceYearly": { "type": "integer", "min": 0 },
    "currency": { "type": "string", "default": "COP", "regex": "^[A-Z]{3}$" },
    "isActive": { "type": "boolean", "default": true },
    "benefits": { "type": "relation", "relation": "oneToMany", "target": "api::billing.plan-benefit", "mappedBy": "plan" }
  }
}
```

#### `api::billing.plan-benefit`
```json
{
  "kind": "collectionType",
  "collectionName": "plan_benefits",
  "info": { "singularName": "plan-benefit", "pluralName": "plan-benefits", "displayName": "Beneficio del plan" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "plan": { "type": "relation", "relation": "manyToOne", "target": "api::billing.plan", "inversedBy": "benefits" },
    "name": { "type": "string", "required": true, "maxLength": 120 },
    "quantityPerYear": { "type": "integer", "min": 0 },
    "copayAmount": { "type": "integer", "min": 0 },
    "service": { "type": "relation", "relation": "manyToOne", "target": "api::scheduling.service" }
  }
}
```
`quantityPerYear` vacío = ilimitado.

#### `api::billing.subscription`
```json
{
  "kind": "collectionType",
  "collectionName": "subscriptions",
  "info": { "singularName": "subscription", "pluralName": "subscriptions", "displayName": "Suscripción" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "customer": { "type": "relation", "relation": "manyToOne", "target": "api::customer.customer" },
    "pet": { "type": "relation", "relation": "manyToOne", "target": "api::pet.pet" },
    "plan": { "type": "relation", "relation": "manyToOne", "target": "api::billing.plan" },
    "state": { "type": "enumeration", "enum": ["pending_payment", "active", "suspended", "cancelled", "expired"], "default": "pending_payment", "required": true },
    "startOn": { "type": "date", "required": true },
    "endOn": { "type": "date", "required": true },
    "renewalOn": { "type": "date" },
    "paymentMethodToken": { "type": "string", "private": true },
    "usages": { "type": "relation", "relation": "oneToMany", "target": "api::billing.benefit-usage", "mappedBy": "subscription" }
  }
}
```

#### `api::billing.benefit-usage`
```json
{
  "kind": "collectionType",
  "collectionName": "benefit_usages",
  "info": { "singularName": "benefit-usage", "pluralName": "benefit-usages", "displayName": "Uso de beneficio" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "subscription": { "type": "relation", "relation": "manyToOne", "target": "api::billing.subscription", "inversedBy": "usages" },
    "benefit": { "type": "relation", "relation": "manyToOne", "target": "api::billing.plan-benefit" },
    "consultation": { "type": "relation", "relation": "manyToOne", "target": "api::clinical.consultation" },
    "usedAt": { "type": "datetime", "required": true },
    "notes": { "type": "string", "maxLength": 255 }
  }
}
```

#### `api::billing.invoice`
```json
{
  "kind": "collectionType",
  "collectionName": "invoices",
  "info": {
    "singularName": "invoice",
    "pluralName": "invoices",
    "displayName": "Factura",
    "description": "Cabecera de la factura. Los conceptos cobrados son sus renglones (invoice-item); el emisor y la numeración salen de Clínica."
  },
  "options": { "draftAndPublish": false },
  "attributes": {
    "customer": { "type": "relation", "relation": "manyToOne", "target": "api::customer.customer" },
    "subscription": { "type": "relation", "relation": "manyToOne", "target": "api::billing.subscription" },
    "items": { "type": "relation", "relation": "oneToMany", "target": "api::billing.invoice-item", "mappedBy": "invoice" },

    "documentKind": { "type": "enumeration", "enum": ["invoice", "credit_note"], "default": "invoice", "required": true },
    "correctsInvoice": { "type": "relation", "relation": "manyToOne", "target": "api::billing.invoice" },
    "state": { "type": "enumeration", "enum": ["draft", "issued", "voided", "dian_error"], "default": "draft", "required": true },
    "paymentState": { "type": "enumeration", "enum": ["unpaid", "partial", "paid"], "default": "unpaid", "required": true },

    "prefix": { "type": "string", "maxLength": 10 },
    "number": { "type": "biginteger" },
    "fullNumber": { "type": "string", "unique": true, "maxLength": 30 },
    "resolutionNumber": { "type": "string", "maxLength": 40 },
    "resolutionDate": { "type": "date" },
    "resolutionRangeFrom": { "type": "biginteger" },
    "resolutionRangeTo": { "type": "biginteger" },
    "resolutionValidUntil": { "type": "date" },

    "issuedAt": { "type": "datetime" },
    "dueOn": { "type": "date" },
    "voidedAt": { "type": "datetime" },
    "voidReason": { "type": "text" },

    "buyer": { "type": "component", "repeatable": false, "component": "billing.party-snapshot" },
    "issuerSnapshot": { "type": "json" },

    "subtotal": { "type": "integer", "default": 0, "min": 0 },
    "discountTotal": { "type": "integer", "default": 0, "min": 0 },
    "taxTotal": { "type": "integer", "default": 0, "min": 0 },
    "amount": { "type": "integer", "required": true, "default": 0, "min": 0 },
    "paidAmount": { "type": "integer", "default": 0 },
    "currency": { "type": "string", "required": true, "default": "COP", "regex": "^[A-Z]{3}$" },
    "notes": { "type": "text" },

    "dataicoInvoiceId": { "type": "string", "unique": true },
    "dianState": { "type": "string" },
    "pdfUrl": { "type": "string" },
    "xmlUrl": { "type": "string" },

    "searchLabel": { "type": "string", "maxLength": 255 },
    "archivedAt": { "type": "datetime" }
  }
}
```
Cabecera. Ya no tiene `consultation` (D1): la consulta la lleva cada renglón, y así una factura cubre varias consultas del mismo cliente. `paid` salió de `state` y pasó a `paymentState`: el ciclo del documento (borrador, emitida, error DIAN, anulada) y el cobro son cosas distintas. Los totales, la numeración, la resolución, `buyer` e `issuerSnapshot` los escribe solo el servidor. `pdfUrl` y `xmlUrl` son URLs alojadas por Dataico (proveedor de facturación electrónica), por eso son texto; el PDF propio (PDFKit) se genera bajo demanda y no se guarda.

#### `api::billing.invoice-item`
```json
{
  "kind": "collectionType",
  "collectionName": "invoice_items",
  "info": {
    "singularName": "invoice-item",
    "pluralName": "invoice-items",
    "displayName": "Renglón de factura",
    "description": "Un concepto cobrado. Si viene de una consulta o de una hospitalización, señala su concepto por lineKey; lockKey impide que dos facturas vivas cobren la misma."
  },
  "options": { "draftAndPublish": false },
  "attributes": {
    "invoice": { "type": "relation", "relation": "manyToOne", "target": "api::billing.invoice", "inversedBy": "items" },
    "kind": {
      "type": "enumeration",
      "enum": ["consultation_service", "consultation_product", "subscription", "direct_service", "direct_product", "custom", "hospitalization_stay", "hospitalization_product"],
      "required": true
    },
    "service": { "type": "relation", "relation": "manyToOne", "target": "api::scheduling.service" },
    "product": { "type": "relation", "relation": "manyToOne", "target": "api::catalog.product" },
    "subscription": { "type": "relation", "relation": "manyToOne", "target": "api::billing.subscription" },
    "sourceConsultation": { "type": "relation", "relation": "manyToOne", "target": "api::clinical.consultation" },
    "sourceHospitalization": { "type": "relation", "relation": "manyToOne", "target": "api::hospitalization.hospitalization" },
    "sourceLineKey": { "type": "string", "maxLength": 36 },
    "lockKey": { "type": "string", "maxLength": 36 },

    "description": { "type": "string", "required": true, "maxLength": 255 },
    "quantity": { "type": "decimal", "required": true, "default": 1, "min": 0.01 },
    "unit": { "type": "string", "maxLength": 20 },
    "unitPrice": { "type": "integer", "min": 0 },
    "priceOverrideReason": { "type": "string", "maxLength": 255 },
    "discountAmount": { "type": "integer", "default": 0, "min": 0 },
    "taxTreatment": { "type": "enumeration", "enum": ["gravado", "exento", "excluido"] },
    "taxRate": { "type": "integer", "default": 0, "min": 0, "max": 100 },
    "lineSubtotal": { "type": "integer", "default": 0, "min": 0 },
    "lineTax": { "type": "integer", "default": 0, "min": 0 },
    "lineTotal": { "type": "integer", "default": 0, "min": 0 },
    "unitCost": { "type": "integer", "min": 0, "private": true },
    "sortOrder": { "type": "integer", "default": 0 }
  }
}
```
Colección y no componente: necesita índice único (`lock_key`), responder "¿qué factura cobra esta línea?" y, en el futuro, que un movimiento de inventario apunte a él. `kind` es el punto de extensión (`src/api/billing/domain/fuentes.ts`). Precio, impuesto, unidad, descripción y `unitCost` se copian del catálogo al crear el renglón; los importes los calcula el servidor (`src/api/billing/domain/calculo.ts`): IVA por renglón sobre la base descontada, redondeado al peso.

### 7.8 Travel

#### `api::travel.travel-case`
```json
{
  "kind": "collectionType",
  "collectionName": "travel_cases",
  "info": { "singularName": "travel-case", "pluralName": "travel-cases", "displayName": "Trámite de viaje" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "pet": { "type": "relation", "relation": "manyToOne", "target": "api::pet.pet" },
    "destinationCountry": { "type": "relation", "relation": "manyToOne", "target": "api::shared.country" },
    "airline": { "type": "string", "maxLength": 100 },
    "travelOn": { "type": "date", "required": true },
    "state": { "type": "enumeration", "enum": ["initiated", "docs_collected", "vet_check_passed", "ready_to_fly", "completed", "cancelled"], "default": "initiated", "required": true },
    "requirements": {
      "type": "dynamiczone",
      "components": [
        "travel.health-certificate",
        "travel.rabies-titer",
        "travel.microchip-check",
        "travel.antiparasitic",
        "travel.import-permit",
        "travel.crate",
        "travel.other-requirement"
      ]
    }
  }
}
```

### 7.9 Documents

#### `api::documents.signed-document`
```json
{
  "kind": "collectionType",
  "collectionName": "signed_documents",
  "info": { "singularName": "signed-document", "pluralName": "signed-documents", "displayName": "Documento firmado" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "consultation": { "type": "relation", "relation": "manyToOne", "target": "api::clinical.consultation" },
    "customer": { "type": "relation", "relation": "manyToOne", "target": "api::customer.customer" },
    "pet": { "type": "relation", "relation": "manyToOne", "target": "api::pet.pet" },
    "documentType": { "type": "enumeration", "enum": ["consent", "contract", "authorization", "terms_and_conditions", "privacy_notice", "other"], "required": true },
    "title": { "type": "string", "required": true, "maxLength": 200 },
    "documentRef": { "type": "string", "maxLength": 100 },
    "state": { "type": "enumeration", "enum": ["draft", "pending_signature", "partially_signed", "signed", "voided", "expired"], "default": "pending_signature", "required": true },
    "isSequential": { "type": "boolean", "default": false, "required": true },
    "expiresAt": { "type": "datetime" },
    "completedAt": { "type": "datetime" },
    "voidedAt": { "type": "datetime" },
    "voidReason": { "type": "text" },
    "version": { "type": "integer", "default": 1, "min": 1, "required": true },
    "replacedBy": { "type": "relation", "relation": "oneToOne", "target": "api::documents.signed-document", "inversedBy": "replaces" },
    "replaces": { "type": "relation", "relation": "oneToOne", "target": "api::documents.signed-document", "mappedBy": "replacedBy" },
    "files": { "type": "component", "repeatable": true, "component": "documents.document-file" },
    "signers": { "type": "relation", "relation": "oneToMany", "target": "api::documents.signed-document-signer", "mappedBy": "signedDocument" },
    "events": { "type": "relation", "relation": "oneToMany", "target": "api::documents.signed-document-event", "mappedBy": "signedDocument" },
    "notes": { "type": "text" },
    "archivedAt": { "type": "datetime" }
  }
}
```

#### `api::documents.signed-document-signer`
```json
{
  "kind": "collectionType",
  "collectionName": "signed_document_signers",
  "info": { "singularName": "signed-document-signer", "pluralName": "signed-document-signers", "displayName": "Firmante de documento" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "signedDocument": { "type": "relation", "relation": "manyToOne", "target": "api::documents.signed-document", "inversedBy": "signers" },
    "signer": { "type": "relation", "relation": "manyToOne", "target": "api::identity.profile" },
    "signOrder": { "type": "integer", "min": 1 },
    "isRequired": { "type": "boolean", "default": true, "required": true },
    "signerRoleSnapshot": { "type": "string" },
    "signerNameSnapshot": { "type": "string" },
    "signerDocumentSnapshot": { "type": "string" },
    "state": { "type": "enumeration", "enum": ["pending", "viewed", "signed", "declined", "expired", "reassigned"], "default": "pending", "required": true },
    "signatureMethod": { "type": "enumeration", "enum": ["drawn", "typed", "click_to_sign", "uploaded_scan", "in_person_wet"] },
    "signedAt": { "type": "datetime" },
    "signerIp": { "type": "string" },
    "signerUserAgent": { "type": "string" },
    "evidence": { "type": "media", "multiple": false, "allowedTypes": ["images", "files"] },
    "evidenceHash": { "type": "string" },
    "notes": { "type": "text" }
  }
}
```
El firmante apunta a `profile` porque tanto staff como clientes tienen perfil.

#### `api::documents.signed-document-event`
```json
{
  "kind": "collectionType",
  "collectionName": "signed_document_events",
  "info": { "singularName": "signed-document-event", "pluralName": "signed-document-events", "displayName": "Evento de documento firmado" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "signedDocument": { "type": "relation", "relation": "manyToOne", "target": "api::documents.signed-document", "inversedBy": "events" },
    "signer": { "type": "relation", "relation": "manyToOne", "target": "api::documents.signed-document-signer" },
    "performedBy": { "type": "relation", "relation": "manyToOne", "target": "api::identity.profile" },
    "eventType": { "type": "enumeration", "enum": ["created", "sent", "viewed", "signed", "declined", "voided", "file_added"], "required": true },
    "eventAt": { "type": "datetime", "required": true },
    "ip": { "type": "string" },
    "userAgent": { "type": "string" },
    "metadata": { "type": "json" }
  }
}
```
Registro de auditoría: solo `create`. Ningún rol tiene `update` ni `delete`.

### 7.10 Marketing

#### `api::marketing.campaign`
```json
{
  "kind": "collectionType",
  "collectionName": "campaigns",
  "info": { "singularName": "campaign", "pluralName": "campaigns", "displayName": "Campaña" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "name": { "type": "string", "required": true, "maxLength": 150 },
    "segment": {
      "type": "dynamiczone",
      "components": [
        "marketing.rule-species",
        "marketing.rule-last-visit",
        "marketing.rule-subscription",
        "marketing.rule-vaccination-due",
        "marketing.rule-city",
        "marketing.rule-referral"
      ]
    },
    "state": { "type": "enumeration", "enum": ["draft", "scheduled", "running", "finished", "cancelled"], "default": "draft", "required": true },
    "metrics": { "type": "relation", "relation": "oneToMany", "target": "api::marketing.campaign-metric", "mappedBy": "campaign" }
  }
}
```

#### `api::marketing.campaign-metric`
```json
{
  "kind": "collectionType",
  "collectionName": "campaign_metrics",
  "info": { "singularName": "campaign-metric", "pluralName": "campaign-metrics", "displayName": "Métrica de campaña" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "campaign": { "type": "relation", "relation": "manyToOne", "target": "api::marketing.campaign", "inversedBy": "metrics" },
    "emailsSent": { "type": "integer", "default": 0, "min": 0 },
    "opens": { "type": "integer", "default": 0, "min": 0 },
    "clicks": { "type": "integer", "default": 0, "min": 0 },
    "conversions": { "type": "integer", "default": 0, "min": 0 },
    "attributedSales": { "type": "integer", "default": 0, "min": 0 }
  }
}
```
Cada fila es una foto de métricas; su momento es el `createdAt` nativo.

### 7.11 Notification

#### `api::notification.notification`
```json
{
  "kind": "collectionType",
  "collectionName": "notifications",
  "info": { "singularName": "notification", "pluralName": "notifications", "displayName": "Notificación" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "eventType": { "type": "string", "required": true, "maxLength": 100 },
    "subjectType": { "type": "enumeration", "enum": ["appointment", "vaccination", "invoice", "subscription"] },
    "subjectDocumentId": { "type": "string" },
    "title": { "type": "string", "required": true, "maxLength": 200 },
    "body": { "type": "text", "required": true },
    "payload": { "type": "json" },
    "dedupeKey": { "type": "string", "unique": true },
    "recipients": { "type": "relation", "relation": "oneToMany", "target": "api::notification.notification-recipient", "mappedBy": "notification" }
  }
}
```
`subjectDocumentId` es el `documentId` de la entidad referida (referencia suelta, no relación).

#### `api::notification.notification-recipient`
```json
{
  "kind": "collectionType",
  "collectionName": "notification_recipients",
  "info": { "singularName": "notification-recipient", "pluralName": "notification-recipients", "displayName": "Destinatario de notificación" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "notification": { "type": "relation", "relation": "manyToOne", "target": "api::notification.notification", "inversedBy": "recipients" },
    "recipient": { "type": "relation", "relation": "manyToOne", "target": "api::identity.profile" },
    "readAt": { "type": "datetime" },
    "archivedAt": { "type": "datetime" },
    "deliveries": { "type": "relation", "relation": "oneToMany", "target": "api::notification.notification-delivery", "mappedBy": "recipient" }
  }
}
```

#### `api::notification.notification-delivery`
```json
{
  "kind": "collectionType",
  "collectionName": "notification_deliveries",
  "info": { "singularName": "notification-delivery", "pluralName": "notification-deliveries", "displayName": "Envío de notificación" },
  "options": { "draftAndPublish": false },
  "pluginOptions": { "content-manager": { "visible": false } },
  "attributes": {
    "recipient": { "type": "relation", "relation": "manyToOne", "target": "api::notification.notification-recipient", "inversedBy": "deliveries" },
    "channel": { "type": "enumeration", "enum": ["in_app", "email", "sms", "push", "whatsapp"], "required": true },
    "scheduledAt": { "type": "datetime", "required": true },
    "nextAttemptAt": { "type": "datetime", "required": true },
    "attemptCount": { "type": "integer", "default": 0, "min": 0, "required": true },
    "maxAttempts": { "type": "integer", "default": 8, "min": 1, "required": true },
    "state": { "type": "enumeration", "enum": ["pending", "processing", "sent", "failed_retry", "failed_final", "cancelled"], "default": "pending", "required": true },
    "lockedAt": { "type": "datetime", "private": true },
    "lockedBy": { "type": "string", "private": true },
    "lockExpiresAt": { "type": "datetime", "private": true },
    "idempotencyKey": { "type": "string", "required": true, "unique": true },
    "sentAt": { "type": "datetime" },
    "providerMessageId": { "type": "string" },
    "lastErrorCode": { "type": "string" },
    "lastErrorMessage": { "type": "text" },
    "lastErrorAt": { "type": "datetime" }
  }
}
```
Es una cola de trabajo. El worker la consume con `strapi.db.connection` usando `SELECT … FOR UPDATE SKIP LOCKED`, no con el Document Service.

---

### 7.12 Catalog

#### `api::catalog.product`

Ver sección 5.3. Main field `searchLabel` (nombre · presentación · marca). La API lo sirve con `?tipo=` y `?categoria=`, y rellena `details` con `populate-details`.
```json
{
  "kind": "collectionType",
  "collectionName": "products",
  "info": {
    "singularName": "product",
    "pluralName": "products",
    "displayName": "Producto",
    "description": "Todo lo vendible que no es un servicio: medicamentos, vacunas, alimentos, juguetes, accesorios, higiene, insumos."
  },
  "options": {
    "draftAndPublish": false
  },
  "attributes": {
    "name": {
      "type": "string",
      "required": true,
      "maxLength": 150
    },
    "productType": {
      "type": "enumeration",
      "enum": [
        "medication",
        "vaccine",
        "food",
        "toy",
        "accessory",
        "hygiene",
        "supply",
        "other"
      ],
      "required": true
    },
    "category": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::catalog.product-category",
      "inversedBy": "products"
    },
    "brand": {
      "type": "string",
      "maxLength": 100
    },
    "presentation": {
      "type": "string",
      "maxLength": 120
    },
    "saleUnit": {
      "type": "enumeration",
      "enum": [
        "unit",
        "box",
        "bottle",
        "vial",
        "bag",
        "tablet",
        "dose",
        "ml",
        "g",
        "kg"
      ],
      "default": "unit",
      "required": true
    },
    "sku": {
      "type": "string",
      "unique": true,
      "maxLength": 40
    },
    "barcode": {
      "type": "string",
      "unique": true,
      "maxLength": 40
    },
    "description": {
      "type": "text"
    },
    "image": {
      "type": "media",
      "multiple": false,
      "allowedTypes": [
        "images"
      ]
    },
    "targetSpecies": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::pet.species"
    },
    "salePrice": {
      "type": "integer",
      "min": 0
    },
    "currency": {
      "type": "string",
      "default": "COP",
      "regex": "^[A-Z]{3}$"
    },
    "tax": {
      "type": "component",
      "repeatable": false,
      "component": "billing.tax-profile"
    },
    "referenceCost": {
      "type": "integer",
      "min": 0,
      "private": true
    },
    "preferredSupplier": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::catalog.supplier",
      "inversedBy": "products"
    },
    "tracksInventory": {
      "type": "boolean",
      "default": true
    },
    "tracksBatches": {
      "type": "boolean"
    },
    "minStock": {
      "type": "integer",
      "min": 0
    },
    "details": {
      "type": "dynamiczone",
      "components": [
        "catalog.medication-details",
        "catalog.vaccine-details",
        "catalog.food-details",
        "catalog.accessory-details"
      ]
    },
    "searchLabel": {
      "type": "string",
      "maxLength": 255
    },
    "isActive": {
      "type": "boolean",
      "default": true
    }
  }
}
```

#### `api::catalog.product-category`

Clasificación comercial libre (Antiparasitarios, Concentrados…).
```json
{
  "kind": "collectionType",
  "collectionName": "product_categories",
  "info": {
    "singularName": "product-category",
    "pluralName": "product-categories",
    "displayName": "Categoría de producto",
    "description": "Clasificación comercial libre (Antiparasitarios, Concentrados, Juguetes de cuerda…). El comportamiento lo decide el tipo de producto, no la categoría."
  },
  "options": {
    "draftAndPublish": false
  },
  "attributes": {
    "name": {
      "type": "string",
      "required": true,
      "unique": true,
      "maxLength": 100
    },
    "description": {
      "type": "text"
    },
    "sortOrder": {
      "type": "integer",
      "default": 0
    },
    "isActive": {
      "type": "boolean",
      "default": true
    },
    "products": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::catalog.product",
      "mappedBy": "category"
    }
  }
}
```

#### `api::catalog.supplier`

Proveedor. El dígito de verificación del NIT se valida con el módulo 11 de la DIAN, igual que el de la clínica.
```json
{
  "kind": "collectionType",
  "collectionName": "suppliers",
  "info": {
    "singularName": "supplier",
    "pluralName": "suppliers",
    "displayName": "Proveedor",
    "description": "Laboratorio, distribuidor o comercializadora a quien se le compra."
  },
  "options": {
    "draftAndPublish": false
  },
  "attributes": {
    "name": {
      "type": "string",
      "required": true,
      "maxLength": 200
    },
    "documentType": {
      "type": "enumeration",
      "enum": [
        "nit",
        "cc",
        "ce"
      ],
      "default": "nit",
      "required": true
    },
    "documentNumber": {
      "type": "string",
      "required": true,
      "maxLength": 20
    },
    "verificationDigit": {
      "type": "string",
      "maxLength": 1,
      "regex": "^[0-9]$"
    },
    "contactName": {
      "type": "string",
      "maxLength": 150
    },
    "phone": {
      "type": "string",
      "maxLength": 20
    },
    "email": {
      "type": "email"
    },
    "address": {
      "type": "component",
      "repeatable": false,
      "component": "shared.address"
    },
    "paymentTermDays": {
      "type": "integer",
      "min": 0
    },
    "notes": {
      "type": "text"
    },
    "isActive": {
      "type": "boolean",
      "default": true
    },
    "products": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::catalog.product",
      "mappedBy": "preferredSupplier"
    }
  }
}
```

### 7.13 Hospitalization

Ver sección 5.6. Todo el dominio es del staff salvo `hospitalization`, que el cliente lee con una lista blanca de campos.

#### `api::hospitalization.cage`

Catálogo: lo mantiene la administración. Main field `name`. `dailyService` es lo que se cobra por día en esta jaula (H4).
```json
{
  "kind": "collectionType",
  "collectionName": "cages",
  "info": {
    "singularName": "cage",
    "pluralName": "cages",
    "displayName": "Jaula",
    "description": "Puesto de hospitalización dentro de una sala de tipo hospitalización. Aloja un paciente a la vez."
  },
  "options": { "draftAndPublish": false },
  "attributes": {
    "name": { "type": "string", "required": true, "unique": true, "maxLength": 80 },
    "room": { "type": "relation", "relation": "manyToOne", "target": "api::scheduling.clinic-room" },
    "size": { "type": "enumeration", "enum": ["small", "medium", "large", "xlarge"], "default": "medium", "required": true },
    "cageType": { "type": "enumeration", "enum": ["standard", "isolation", "icu", "oxygen"], "default": "standard", "required": true },
    "dailyService": { "type": "relation", "relation": "manyToOne", "target": "api::scheduling.service" },
    "sortOrder": { "type": "integer", "default": 0 },
    "isActive": { "type": "boolean", "default": true },
    "notes": { "type": "text" }
  }
}
```

#### `api::hospitalization.hospitalization`

Main field `searchLabel` (mascota · dueño · jaula · fecha de ingreso). `admittedBy` y `dischargedBy` los pone el servidor con la cuenta del panel; `cageStays` también (traslados).
```json
{
  "kind": "collectionType",
  "collectionName": "hospitalizations",
  "info": {
    "singularName": "hospitalization",
    "pluralName": "hospitalizations",
    "displayName": "Hospitalización",
    "description": "Ingreso de una mascota: jaula, veterinario responsable, traslados y alta. La hoja de evolución cuelga de aquí."
  },
  "options": { "draftAndPublish": false },
  "attributes": {
    "pet": { "type": "relation", "relation": "manyToOne", "target": "api::pet.pet", "inversedBy": "hospitalizations" },
    "cage": { "type": "relation", "relation": "manyToOne", "target": "api::hospitalization.cage" },
    "responsibleVet": { "type": "relation", "relation": "manyToOne", "target": "admin::user" },
    "admittedBy": { "type": "relation", "relation": "manyToOne", "target": "admin::user" },
    "consultation": { "type": "relation", "relation": "manyToOne", "target": "api::clinical.consultation" },
    "admittedAt": { "type": "datetime", "required": true },
    "reason": { "type": "text", "required": true },
    "admissionNotes": { "type": "blocks" },
    "state": { "type": "enumeration", "enum": ["active", "discharged"], "default": "active", "required": true },
    "dischargeType": { "type": "enumeration", "enum": ["medical", "voluntary", "transfer", "deceased"] },
    "dischargedAt": { "type": "datetime" },
    "dischargedBy": { "type": "relation", "relation": "manyToOne", "target": "admin::user" },
    "dischargeSummary": { "type": "blocks" },
    "homeInstructions": { "type": "blocks" },
    "dischargeMedications": { "type": "component", "repeatable": true, "component": "clinical.medication" },
    "followUpOn": { "type": "date" },
    "cageStays": { "type": "component", "repeatable": true, "component": "hospitalization.cage-stay" },
    "searchLabel": { "type": "string", "maxLength": 255 }
  }
}
```

#### `api::hospitalization.treatment-order`

Main field `searchLabel` (producto · dosis · frecuencia — mascota). `prescribedBy` lo pone el servidor. `doseQuantity` son unidades de venta del producto por toma: es lo que se factura. Una orden `isPrn` no lleva frecuencia.
```json
{
  "kind": "collectionType",
  "collectionName": "treatment_orders",
  "info": {
    "singularName": "treatment-order",
    "pluralName": "treatment-orders",
    "displayName": "Orden de tratamiento",
    "description": "Lo que el veterinario prescribe durante la hospitalización: producto del catálogo, dosis, vía y cada cuántas horas. De aquí salen las tomas de la hoja."
  },
  "options": { "draftAndPublish": false },
  "attributes": {
    "hospitalization": { "type": "relation", "relation": "manyToOne", "target": "api::hospitalization.hospitalization" },
    "product": { "type": "relation", "relation": "manyToOne", "target": "api::catalog.product" },
    "dose": { "type": "string", "maxLength": 80 },
    "doseQuantity": { "type": "decimal", "required": true, "default": 1, "min": 0.01 },
    "route": {
      "type": "enumeration",
      "enum": ["oral", "sc", "im", "iv", "topical", "otic", "ophthalmic", "other"],
      "default": "oral",
      "required": true
    },
    "frequencyHours": { "type": "integer", "min": 1, "max": 168 },
    "isPrn": { "type": "boolean", "default": false },
    "startAt": { "type": "datetime", "required": true },
    "endAt": { "type": "datetime" },
    "state": { "type": "enumeration", "enum": ["active", "suspended", "completed"], "default": "active", "required": true },
    "prescribedBy": { "type": "relation", "relation": "manyToOne", "target": "admin::user" },
    "notes": { "type": "text" },
    "searchLabel": { "type": "string", "maxLength": 255 }
  }
}
```

#### `api::hospitalization.evolution-entry`

Mismos rangos y valores que `clinical.physical-exam`, más dolor (0–10), estado mental, apetito y eliminaciones. `recordedBy` lo pone el servidor.
```json
{
  "kind": "collectionType",
  "collectionName": "evolution_entries",
  "info": {
    "singularName": "evolution-entry",
    "pluralName": "evolution-entries",
    "displayName": "Registro de evolución",
    "description": "Una toma de signos y observaciones de un paciente hospitalizado, a una hora concreta."
  },
  "options": { "draftAndPublish": false },
  "attributes": {
    "hospitalization": { "type": "relation", "relation": "manyToOne", "target": "api::hospitalization.hospitalization" },
    "recordedAt": { "type": "datetime", "required": true },
    "recordedBy": { "type": "relation", "relation": "manyToOne", "target": "admin::user" },
    "temperatureC": { "type": "decimal", "min": 30, "max": 45 },
    "heartRateBpm": { "type": "integer", "min": 0, "max": 400 },
    "respiratoryRateRpm": { "type": "integer", "min": 0, "max": 200 },
    "mucousMembranes": { "type": "enumeration", "enum": ["normal", "pale", "congested", "icteric", "cyanotic"] },
    "capillaryRefillSeconds": { "type": "decimal", "min": 0, "max": 10 },
    "hydrationState": { "type": "enumeration", "enum": ["normal", "mild", "moderate", "severe"] },
    "weightKg": { "type": "decimal", "min": 0 },
    "painScore": { "type": "integer", "min": 0, "max": 10 },
    "mentation": { "type": "enumeration", "enum": ["alert", "depressed", "obtunded", "stuporous", "comatose"] },
    "appetite": { "type": "enumeration", "enum": ["normal", "reduced", "none"] },
    "urinated": { "type": "boolean" },
    "defecated": { "type": "boolean" },
    "vomited": { "type": "boolean" },
    "notes": { "type": "text" }
  }
}
```

#### `api::hospitalization.medication-administration`

`product` sale de la orden si la hay; `administeredBy` y `lineKey` los pone el servidor. `scheduledFor` es la toma programada que cubre (vacío en una dosis única o una orden `isPrn`).
```json
{
  "kind": "collectionType",
  "collectionName": "medication_administrations",
  "info": {
    "singularName": "medication-administration",
    "pluralName": "medication-administrations",
    "displayName": "Administración",
    "description": "Una toma dada u omitida de una orden de tratamiento (o una dosis única). Si se dio, es un concepto facturable: lineKey."
  },
  "options": { "draftAndPublish": false },
  "attributes": {
    "hospitalization": { "type": "relation", "relation": "manyToOne", "target": "api::hospitalization.hospitalization" },
    "order": { "type": "relation", "relation": "manyToOne", "target": "api::hospitalization.treatment-order" },
    "product": { "type": "relation", "relation": "manyToOne", "target": "api::catalog.product" },
    "scheduledFor": { "type": "datetime" },
    "administeredAt": { "type": "datetime", "required": true },
    "state": { "type": "enumeration", "enum": ["given", "omitted"], "default": "given", "required": true },
    "omissionReason": { "type": "string", "maxLength": 255 },
    "quantity": { "type": "decimal", "required": true, "default": 1, "min": 0.01 },
    "administeredBy": { "type": "relation", "relation": "manyToOne", "target": "admin::user" },
    "notes": { "type": "text" },
    "lineKey": { "type": "string", "maxLength": 36 }
  }
}
```

### 7.14 Cash

Ver sección 5.7. Lo usa el staff desde el punto de venta; el cliente solo lee sus pagos.

#### `api::cash.cash-register`

Catálogo de la administración. Main field `name`. `operators` vacía = la abre cualquiera con `caja.operar`.
```json
{
  "kind": "collectionType",
  "collectionName": "cash_registers",
  "info": {
    "singularName": "cash-register",
    "pluralName": "cash-registers",
    "displayName": "Caja",
    "description": "Caja física del punto de venta. Cada apertura es un turno; operators limita quién puede abrirla."
  },
  "options": { "draftAndPublish": false },
  "attributes": {
    "name": { "type": "string", "required": true, "unique": true, "maxLength": 80 },
    "location": { "type": "string", "maxLength": 120 },
    "defaultOpeningFloat": { "type": "integer", "default": 0, "min": 0 },
    "operators": { "type": "relation", "relation": "manyToMany", "target": "admin::user" },
    "isActive": { "type": "boolean", "default": true }
  }
}
```

#### `api::cash.cash-session`

Main field `searchLabel` (caja · apertura · responsable). `responsible`, `closedBy`, `countedCash`, `expectedCash`, `difference` y `totals` los pone el servidor.
```json
{
  "kind": "collectionType",
  "collectionName": "cash_sessions",
  "info": {
    "singularName": "cash-session",
    "pluralName": "cash-sessions",
    "displayName": "Turno de caja",
    "description": "Desde que se abre la caja con su base hasta el arqueo de cierre. Esperado, contado y descuadre los calcula el servidor."
  },
  "options": { "draftAndPublish": false },
  "attributes": {
    "register": { "type": "relation", "relation": "manyToOne", "target": "api::cash.cash-register" },
    "responsible": { "type": "relation", "relation": "manyToOne", "target": "admin::user" },
    "openedAt": { "type": "datetime" },
    "openingFloat": { "type": "integer", "default": 0, "min": 0 },
    "openingCount": { "type": "component", "repeatable": true, "component": "cash.denomination-count" },
    "state": { "type": "enumeration", "enum": ["open", "closed"], "default": "open", "required": true },
    "closedAt": { "type": "datetime" },
    "closedBy": { "type": "relation", "relation": "manyToOne", "target": "admin::user" },
    "closingCount": { "type": "component", "repeatable": true, "component": "cash.denomination-count" },
    "countedCash": { "type": "integer", "min": 0 },
    "expectedCash": { "type": "integer" },
    "difference": { "type": "integer" },
    "differenceReason": { "type": "text" },
    "totals": { "type": "json" },
    "notes": { "type": "text" },
    "searchLabel": { "type": "string", "maxLength": 255 }
  }
}
```

#### `api::cash.payment`

Main field `searchLabel` (factura o "Anticipo" · medio · valor). `receivedBy`, `changeAmount` y `paidAt` los pone el servidor.
```json
{
  "kind": "collectionType",
  "collectionName": "payments",
  "info": {
    "singularName": "payment",
    "pluralName": "payments",
    "displayName": "Pago",
    "description": "Dinero que entra (pago o anticipo) o sale (devolución) por una caja, con su medio. No se borra ni se edita: se reversa."
  },
  "options": { "draftAndPublish": false },
  "attributes": {
    "kind": { "type": "enumeration", "enum": ["payment", "refund"], "default": "payment", "required": true },
    "purpose": { "type": "enumeration", "enum": ["invoice", "advance"], "default": "invoice", "required": true },
    "invoice": { "type": "relation", "relation": "manyToOne", "target": "api::billing.invoice" },
    "customer": { "type": "relation", "relation": "manyToOne", "target": "api::customer.customer" },
    "session": { "type": "relation", "relation": "manyToOne", "target": "api::cash.cash-session" },
    "method": { "type": "enumeration", "enum": ["cash", "card", "transfer", "credit_balance", "other"], "required": true },
    "amount": { "type": "integer", "required": true, "min": 1 },
    "receivedAmount": { "type": "integer", "min": 0 },
    "changeAmount": { "type": "integer", "default": 0, "min": 0 },
    "cardType": { "type": "enumeration", "enum": ["debit", "credit"] },
    "cardBrand": { "type": "string", "maxLength": 30 },
    "cardLast4": { "type": "string", "maxLength": 4, "regex": "^[0-9]{4}$" },
    "authorizationCode": { "type": "string", "maxLength": 30 },
    "transferChannel": { "type": "enumeration", "enum": ["bank", "nequi", "daviplata", "other"] },
    "reference": { "type": "string", "maxLength": 60 },
    "paidAt": { "type": "datetime" },
    "receivedBy": { "type": "relation", "relation": "manyToOne", "target": "admin::user" },
    "state": { "type": "enumeration", "enum": ["posted", "reversed"], "default": "posted", "required": true },
    "reversalReason": { "type": "text" },
    "reversedAt": { "type": "datetime" },
    "notes": { "type": "text" },
    "searchLabel": { "type": "string", "maxLength": 255 }
  }
}
```

#### `api::cash.cash-movement`

`performedBy` y `occurredAt` los pone el servidor.
```json
{
  "kind": "collectionType",
  "collectionName": "cash_movements",
  "info": {
    "singularName": "cash-movement",
    "pluralName": "cash-movements",
    "displayName": "Movimiento de caja",
    "description": "Efectivo que entra o sale de la caja sin ser una venta: sencillo, retiro (sangría) o gasto menor."
  },
  "options": { "draftAndPublish": false },
  "attributes": {
    "session": { "type": "relation", "relation": "manyToOne", "target": "api::cash.cash-session" },
    "kind": { "type": "enumeration", "enum": ["cash_in", "withdrawal", "expense"], "required": true },
    "amount": { "type": "integer", "required": true, "min": 1 },
    "concept": { "type": "string", "maxLength": 200 },
    "reference": { "type": "string", "maxLength": 60 },
    "receipt": { "type": "media", "multiple": false, "allowedTypes": ["images", "files"] },
    "performedBy": { "type": "relation", "relation": "manyToOne", "target": "admin::user" },
    "occurredAt": { "type": "datetime" }
  }
}
```

## 8. Validaciones de negocio (middleware del Document Service)

En Strapi 5 las relaciones viven en tablas de enlace (`*_lnk`), por lo que **ninguna regla que combine una relación con otro campo puede ser un índice de base de datos**. Implementa estas reglas en `src/index.(ts|js)` → `register()` con `strapi.documents.use(...)`, lanzando `errors.ValidationError` de `@strapi/utils`. Aplican a las acciones `create` y `update` salvo que se indique otra cosa.

Patrón de referencia:

```js
const { errors } = require('@strapi/utils');

module.exports = {
  register({ strapi }) {
    strapi.documents.use(async (ctx, next) => {
      if (ctx.uid === 'api::shared.contact' && ['create', 'update'].includes(ctx.action)) {
        const { profile, contactType, value } = ctx.params.data ?? {};
        const dup = await strapi.documents('api::shared.contact').findFirst({
          filters: {
            profile: { documentId: profile },
            contactType,
            value,
            documentId: { $ne: ctx.params.documentId },
          },
        });
        if (dup) throw new errors.ValidationError('El contacto ya existe para este perfil');
      }
      return next();
    });
  },
};
```

Organiza las reglas en un archivo por dominio (`src/validations/<dominio>.js`) y regístralas desde `register()`. En `update`, combina los datos entrantes con la entrada actual antes de validar.

### Relaciones obligatorias (Strapi no admite `required` en relaciones)

| UID | Relaciones obligatorias |
| --- | --- |
| `api::shared.contact` | `profile` |
| `api::shared.verification-code` | `contact` |
| `api::customer.customer` | `profile` |
| `api::customer.customer-note` | `customer`, `author` (asignar la cuenta del panel autenticada en un middleware del Document Service) |
| `api::pet.pet` | `owner`, `species` |
| `api::pet.breed` | `species` |
| `api::clinical.consultation` | `pet`, `vet` |
| `api::clinical.vaccine` | `species` |
| `api::clinical.pet-vaccination` | `pet`, `vaccine` |
| `api::clinical.allergy` | `pet` |
| `api::clinical.prescription` | `consultation`, `pet`, `vet` (las pone el servicio de fórmulas) |
| `api::scheduling.appointment` | `pet`, `responsible` |
| `api::scheduling.service` | `category` |
| componente `clinical.service-line` / `clinical.product-line` | `service` / `product` (la pertenencia a la consulta es estructural) |
| `api::billing.plan-benefit` | `plan` |
| `api::billing.subscription` | `customer`, `pet`, `plan` |
| `api::billing.benefit-usage` | `subscription`, `benefit` |
| `api::billing.invoice` | `customer` |
| `api::billing.invoice-item` | `invoice` |
| `api::travel.travel-case` | `pet`, `destinationCountry` |
| `api::documents.signed-document-signer` | `signedDocument`, `signer` |
| `api::documents.signed-document-event` | `signedDocument` |
| `api::marketing.campaign-metric` | `campaign` |
| `api::notification.notification-recipient` | `notification`, `recipient` |
| `api::notification.notification-delivery` | `recipient` |
| componente `scheduling.appointment-service` | `service` |
| `api::hospitalization.cage` | `room` |
| `api::hospitalization.hospitalization` | `pet`, `cage`, `responsibleVet` |
| `api::hospitalization.treatment-order` | `hospitalization`, `product` |
| `api::hospitalization.evolution-entry` | `hospitalization` |
| `api::hospitalization.medication-administration` | `hospitalization`, `product` (se copia de la orden si la hay) |
| componente `hospitalization.cage-stay` | `cage` (lo escribe el servidor) |
| `api::cash.cash-session` | `register` |
| `api::cash.payment` | `customer`, `session` (salvo los migrados, `method: other`) |
| `api::cash.cash-movement` | `session` |

### Unicidad compuesta

| UID | Regla |
| --- | --- |
| `api::shared.contact` | `(profile, contactType, value)` único |
| `api::shared.contact` | máximo un `isPrimary = true` por `(profile, contactType)` |
| `api::shared.verification-code` | un solo código con `usedAt` nulo por `(contact, purpose)`; al crear uno nuevo, marcar el anterior como usado dentro de la misma transacción |
| `api::pet.breed` | `(species, name)` único |
| `api::scheduling.service` | `(category, name)` único |
| `api::clinical.vaccine` | `(species, name)` único |
| `api::catalog.supplier` | `(documentType, documentNumber)` único |
| `api::catalog.product` | `sku` y `barcode` únicos (en el esquema) |
| `api::documents.signed-document` | `version` única por el mismo destinatario (`consultation`, `customer` o `pet`) |
| `api::documents.signed-document-signer` | `(signedDocument, signer)` único |
| `api::notification.notification-recipient` | `(notification, recipient)` único |
| `api::notification.notification-delivery` | `(recipient, channel)` único |
| componente `scheduling.appointment-service` | sin `service` repetido dentro de la misma cita |
| componente `shared.address` | máximo un `isPrimary = true` por perfil |
| componente `documents.document-file` | máximo un `final_signed_pdf` por documento |
| `api::hospitalization.hospitalization` | una sola `active` por mascota y una sola `active` por jaula |
| `api::hospitalization.medication-administration` | como mucho una `given` por `(order, scheduledFor)` (H6) |
| `api::cash.cash-session` | como mucho un turno `open` por caja y por responsable |

### Reglas condicionales

| UID | Regla |
| --- | --- |
| `api::shared.contact` | `value` debe ser email válido si `contactType` es `email`/`email_work`; teléfono E.164 (`^\+[1-9][0-9]{7,14}$`) en los demás |
| `api::pet.pet` | `breed.species` = `species`; `birthDate` no futura; `sterilizedOn` solo si `sterilizationState = sterilized` |
| `api::clinical.consultation` | si falta `consultedAt`, asignar la fecha actual; `nextControlOn` posterior a `consultedAt`; si llega `weightKg`, actualizar `pet.weightKg`; cada línea de `lines` lleva `lineKey` (5.4); una línea cobrada por un renglón vivo no se quita, no cambia de servicio/producto ni de cantidad y no deja de ser facturable (sus notas sí cambian); una consulta con renglones vivos no se borra, no se archiva y no cambia de mascota; una consulta con fórmulas médicas no se borra, y con una vigente no se archiva ni cambia de mascota; en `clinical.medication`, `product` (si lo hay) es un medicamento del catálogo, activo si cambia, `drug` por defecto el nombre del producto y `quantity` > 0 |
| `api::clinical.pet-vaccination` | `vaccine.species` = `pet.species`; `appliedOn` no futura; `nextDueOn` > `appliedOn` |
| `api::clinical.allergy` | `resolvedOn` obligatorio si `isActive = false` |
| `api::clinical.prescription` | solo se crea dentro del servicio de fórmulas (consecutivo, copia del firmante con tarjeta profesional, al menos un medicamento); emitida no se edita: lo único admitido es `issued → voided` con `voidReason`, también dentro del servicio (`voidedAt` lo pone él); no se borra; la escritura que solo trae `searchLabel` pasa |
| `api::scheduling.appointment` | `endAt` > `startAt`; si `state = cancelled` exigir `cancelledAt` y `cancelReason`; fijar `arrivedAt`/`completedAt` al pasar a `arrived`/`completed`; asignar `bookedBy` con el perfil de quien está autenticado (cliente o staff) al crear |
| `api::scheduling.appointment` | sin solapamiento para el mismo `responsible` ni la misma `room` entre citas en estados `scheduled`, `confirmed`, `arrived`, `in_progress` |
| `api::scheduling.appointment` | en cada línea de `services`, si faltan `durationMinutes`/`price`, copiar `service.defaultDurationMinutes`/`service.basePrice` |
| zona `consultation.lines` | cada tarjeta exige su `service` o `product`; `label` = nombre del servicio o `searchLabel` del producto, puesto por el servidor (ignora el valor enviado); un bloque existente conserva su relación aunque el panel la envíe como diferencia vacía (`{ connect: [], disconnect: [] }`) |
| `api::catalog.product` | como mucho un bloque en `details`, y del componente que corresponde a `productType`; obligatorio para `medication` y `vaccine`; `catalog.vaccine-details.vaccine` obligatorio; si no se indica `tracksBatches` al crear, `true` para `medication`/`vaccine`/`food` |
| `api::catalog.product`, `api::scheduling.service` | `tax`: `gravado` exige `ivaRate` 5 o 19; `exento`/`excluido` fijan `ivaRate = 0` |
| `api::catalog.supplier` | si `documentType = nit`, `verificationDigit` debe cuadrar con el módulo 11 de la DIAN |
| `api::billing.subscription` | `endOn` > `startOn`; `pet.owner` = `customer` |
| `api::billing.benefit-usage` | la suscripción debe estar `active`; `benefit.plan` = `subscription.plan`; no superar `quantityPerYear` en el año de vigencia |
| `api::billing.invoice` | nace en `draft`; transiciones `draft → issued/dian_error`, `issued ↔ dian_error`, `issued/dian_error → voided` (con `voidReason`); fuera de borrador solo cambian `state`, `paymentState`, `dianState`, `pdfUrl`, `xmlUrl`, `dataicoInvoiceId`, `voidedAt`, `voidReason`, `searchLabel`, `archivedAt` (se compara con lo guardado: reenviar el formulario sin cambios no cuenta); numeración, resolución, `buyer`, `issuerSnapshot` e `issuedAt` solo en el paso de emisión, y ese paso solo dentro del servicio de emisión; no se emite sin renglones; solo se borra un borrador (y con él sus renglones); anular pone `lockKey = null` en sus renglones; una emitida con `dataicoInvoiceId` (ya enviada a la DIAN) no se anula, requiere nota crédito; `paymentState` y `paidAmount` los calcula el servidor a partir de los pagos (`api::cash.payment`) y no se escriben a mano; con `paidAmount > 0` no se anula (antes, la devolución); archivar solo anuladas o borradores sin renglones; la suscripción, si la hay, es del mismo cliente; notas crédito aún no admitidas |
| `api::billing.invoice-item` | solo en una factura en borrador (en una anulada solo se admite liberar `lockKey`); no cambia de factura; la relación coincide con `kind`; en `hospitalization_*`: el concepto `sourceLineKey` (día o toma) existe en `sourceHospitalization`, es de ese tipo, es facturable, la mascota es del cliente y ninguna otra factura viva lo cobra; su servicio/producto y cantidad salen del concepto; en `consultation_*`: la línea `sourceLineKey` existe en `sourceConsultation`, es de la tarjeta que corresponde, es facturable (`applied`/`dispensed`), su mascota es del cliente de la factura, la consulta no está archivada y ninguna otra factura viva la cobra; su servicio/producto y cantidad salen de la línea; el catálogo debe tener precio y perfil tributario; un precio distinto del catálogo (o de lo guardado) solo entra por `api::billing.invoicing.cambiarPrecio` y con `priceOverrideReason` (D5), también desde el Content Manager; gravado lleva tarifa 5 o 19; el descuento no supera el bruto |
| `api::travel.travel-case` | cada requisito con `isCompleted = true` exige `verifiedBy`; asignar `verifiedAt` al completarlo |
| `api::documents.signed-document` | exactamente uno de `consultation`, `customer`, `pet`; `voidedAt` y `voidReason` obligatorios si `state = voided`; si `state = signed`, solo se permite pasar a `voided` |
| `api::documents.signed-document-signer` | `signOrder` obligatorio si el documento es secuencial; `signatureMethod` y `signedAt` obligatorios si `state = signed` |
| `api::documents.signed-document-event` | rechazar `update` y `delete` |
| `api::customer.customer` | actualizar `consents.lastChangedAt` cuando cambie cualquier consentimiento |
| `api::marketing.campaign` | al resolver el segmento, incluir solo clientes con `consents.marketing = true` |
| `api::hospitalization.cage` | la sala (`room`) es de tipo `hospitalization`; no se desactiva una jaula ocupada |
| `api::hospitalization.hospitalization` | crear exige `clinic.offersHospitalization`; nace `active` (por defecto `admittedAt` = ahora); mascota no archivada; jaula activa y libre; `admittedBy`/`dischargedBy` = cuenta del panel autenticada; `cageStays` lo escribe el servidor (abre un tramo al ingresar y otro en cada cambio de `cage`); `discharged` exige `dischargeType`, `dischargedAt ≥ admittedAt` (por defecto ahora) y, si es `medical`, `dischargeSummary`; `discharged → active` no se admite; tras el alta solo cambian `dischargeSummary`, `homeInstructions`, `dischargeMedications`, `followUpOn` y `searchLabel` (comparado con lo guardado); al dar el alta las órdenes `active` pasan a `completed` con `endAt` = alta; con conceptos en una factura viva no se borra ni cambia de mascota, y `admittedAt`/`dischargedAt`/la jaula no pueden quitar un día cobrado ni cambiar su servicio |
| `api::hospitalization.treatment-order` | solo en una hospitalización `active` (crear); producto activo de tipo `medication`, `vaccine` o `supply`; `frequencyHours` obligatorio salvo `isPrn`; `startAt` (por defecto ahora) dentro de la estancia; `endAt > startAt`; `prescribedBy` = cuenta del panel; `suspended`/`completed` fijan `endAt` si falta; una orden con tomas no se borra (se suspende) |
| `api::hospitalization.evolution-entry` | `recordedAt` (por defecto ahora) dentro de la estancia y no futuro (5 min de tolerancia); `recordedBy` = cuenta del panel |
| `api::cash.cash-register` | no se desactiva ni se borra con un turno abierto; con turnos, no se borra |
| `api::cash.cash-session` | abrir: caja activa, responsable = cuenta del panel (o el indicado si no hay sesión), autorizado en `operators` si la lista no está vacía, `openingFloat` ≥ 0 (por defecto `defaultOpeningFloat`), nace `open`; cerrar: exige `closingCount`, calcula `countedCash`, `expectedCash`, `difference` y `totals`, y si `difference ≠ 0` exige `differenceReason`; `closed → open` no se admite; un turno cerrado no cambia; no se borra un turno con pagos o movimientos |
| `api::cash.payment` | turno `open` (salvo `method: other`, solo para migración); `amount` > 0; `purpose: invoice` exige factura emitida (o con error DIAN), del mismo cliente; `purpose: advance` no lleva factura; un pago no supera el saldo de la factura; efectivo: `receivedAmount ≥ amount`, `changeAmount` = diferencia; tarjeta: `cardType`, `cardLast4` (4 dígitos) y `authorizationCode`; transferencia: `transferChannel` y `reference`; `credit_balance`: saldo a favor suficiente y no sirve para un anticipo; devolución (`refund`): permiso `caja.devolver` en una sesión del panel, no supera lo cobrado neto de la factura (o el saldo a favor si es de anticipo), y en efectivo no supera el efectivo esperado del turno; tras escribir, recalcula `paidAmount`/`paymentState` de la factura; no se edita salvo para reversar (`posted → reversed` con `reversalReason`, turno aún abierto); no se borra |
| `api::cash.cash-movement` | turno `open`; `expense` exige `concept`; un retiro o gasto no deja negativo el efectivo esperado; no se edita ni se borra con el turno cerrado |
| `api::hospitalization.medication-administration` | `administeredAt` (por defecto ahora) dentro de la estancia y no futuro (5 min de tolerancia); la orden es de la misma hospitalización y su producto manda; sin orden, producto obligatorio; `quantity` por defecto la `doseQuantity` de la orden; `omitted` exige `omissionReason`; H6; `administeredBy` = cuenta del panel; `lineKey` lo pone el servidor; cobrada por un renglón vivo: no se borra ni cambia de producto, cantidad o estado |

### Filtro de archivados

Registra un middleware que, en `findMany`, `findFirst` y `findOne` de `profile`, `customer`, `pet`, `consultation`, `signed-document` e `invoice`, añada `archivedAt: { $null: true }` salvo que la consulta filtre explícitamente por `archivedAt`. "Eliminar" en la app debe ser `update` con `archivedAt = now`.

---

## 9. Índices (migración)

Crea `database/migrations/2026.09.26T00.00.00.business-indexes.js`. Strapi la ejecuta al arrancar.

```js
module.exports = {
  async up(knex) {
    await knex.raw(`CREATE UNIQUE INDEX IF NOT EXISTS ux_profiles_document
      ON profiles (document_type, document_number) WHERE archived_at IS NULL`);
    await knex.raw(`CREATE UNIQUE INDEX IF NOT EXISTS ux_pets_microchip
      ON pets (microchip) WHERE microchip IS NOT NULL AND archived_at IS NULL`);
    await knex.raw(`CREATE UNIQUE INDEX IF NOT EXISTS ux_invoices_dataico
      ON invoices (dataico_invoice_id) WHERE dataico_invoice_id IS NOT NULL`);
    await knex.raw(`CREATE UNIQUE INDEX IF NOT EXISTS ux_invoice_items_lock
      ON invoice_items (lock_key) WHERE lock_key IS NOT NULL`);
    await knex.raw(`CREATE UNIQUE INDEX IF NOT EXISTS ux_invoices_full_number
      ON invoices (full_number) WHERE full_number IS NOT NULL`);
    await knex.raw(`CREATE UNIQUE INDEX IF NOT EXISTS ux_prescriptions_sequence
      ON prescriptions (sequence) WHERE sequence IS NOT NULL`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_invoices_issued_at
      ON invoices (issued_at, state)`);
    await knex.raw(`CREATE UNIQUE INDEX IF NOT EXISTS ux_notifications_dedupe
      ON notifications (dedupe_key) WHERE dedupe_key IS NOT NULL`);
    await knex.raw(`CREATE UNIQUE INDEX IF NOT EXISTS ux_deliveries_idempotency
      ON notification_deliveries (idempotency_key)`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_deliveries_queue
      ON notification_deliveries (state, next_attempt_at)`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_deliveries_lock
      ON notification_deliveries (locked_by, lock_expires_at)`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_appointments_start
      ON appointments (start_at, state)`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_signed_documents_state_expiry
      ON signed_documents (state, expires_at)`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_notifications_event
      ON notifications (event_type, created_at)`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_hospitalizations_state
      ON hospitalizations (state, admitted_at)`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_med_admin_scheduled
      ON medication_administrations (scheduled_for)`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_evolution_recorded
      ON evolution_entries (recorded_at)`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_payments_state
      ON payments (state, paid_at)`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_cash_sessions_state
      ON cash_sessions (state, opened_at)`);
  },
};
```

La regla de unicidad de `profiles` por documento también debe validarse en el middleware para devolver un error legible antes de llegar a la base de datos.

---

## 10. Roles y permisos (nativos)

Dos sistemas nativos, cada uno para un tipo de persona. No crear tablas ni lógica de RBAC propia. Los roles se crean en `bootstrap()` si no existen y solo se les **añaden** los permisos que falten.

**API (`users-permissions`) — clientes.**

| Rol (users-permissions) | Permisos |
| --- | --- |
| Public | `find`/`findOne` de `country`, `species`, `breed`, `service-category`, `service`, `plan`, `plan-benefit`, `product-category`, `product` (sin `referenceCost`, que es privado); `register`/`callback` nativos |
| Cliente (`Authenticated` renombrado o rol `client` por defecto al registrarse) | `find`/`findOne` de sus propios `pet`, `appointment`, `consultation`, `pet-vaccination`, `allergy`, `hospitalization` (lista blanca de campos, 5.6), `subscription`, `invoice`, `invoice-item`, `payment`, `signed-document`, `notification-recipient`; `create` de `appointment` (source `online`); `update` de su `profile`, `contact` y `notification-recipient.readAt` |

**Panel (RBAC del admin) — staff.** Permisos del Content Manager (`read`/`create`/`update`/`delete`) sobre cada content type, más los propios de la agenda, la facturación, la hospitalización y la caja.

| Rol del panel | Permisos |
| --- | --- |
| Recepción | CRUD de `profile`, `contact`, `customer`, `customer-note`, `pet`, `appointment`, `subscription`, `invoice`, `invoice-item`, `travel-case`, `staff-schedule`, `schedule-exception`; lectura de catálogos (incluidos `product` y `product-category`), `consultation`, `clinic` y cuentas de la app; agenda: ver todas y agendar; facturación: ver, preparar borradores y emitir (incluye registrar pagos; no cambia precios); lectura de `hospitalization` y `cage`; hospitalización: ver; caja: operar (abrir y cerrar su turno, vender, cobrar, abonos, anticipos, movimientos); lectura de `payment`, `cash-session`, `cash-movement`, `cash-register` |
| Veterinario | todo lo de Recepción (salvo agendar) + CRUD de `consultation`, `pet-vaccination`, `allergy`, `signed-document`, `signed-document-signer`; lectura y `create` de `signed-document-event`; agenda: ver la propia; facturación: solo ver (no prepara, emite ni anula); CRUD de `hospitalization`, `treatment-order`, `evolution-entry`, `medication-administration`; hospitalización: ver, registrar y prescribir (ingreso, órdenes, traslado, alta); lectura de `prescription`; fórmula médica: emitir, reimprimir y anular las propias |
| Caja | lectura de `customer`, `profile`, `contact`, `pet`, catálogos, `invoice`, `invoice-item`, `payment`, `cash-session`, `cash-movement`, `cash-register`, `clinic`; `create` de `profile`, `contact` y `customer` (factura a nombre del comprador); facturación: ver; caja: operar |
| Auxiliar de hospitalización | lectura de `hospitalization`, `treatment-order`, `cage`, `pet` y `allergy`; hospitalización: ver, registrar signos y tomas (no prescribe, no da altas) |
| Administrador de clínica | todo lo anterior + CRUD de catálogos (`service-category`, `service`, `clinic-room`, `cage`, `vaccine`, `species`, `breed`, `plan`, `plan-benefit`, `country`, `product-category`, `product`) y de `supplier` (solo este rol), `campaign`, `campaign-metric`, `notification` y `update` de `clinic`; agenda: ver todas y agendar; facturación: todo, incluidos anular y cambiar precios; hospitalización: todo; caja: todo (operar, devolver, supervisar) y CRUD de `cash-register`; fórmula médica: emitir y anular también las de otra persona |

Los tres llevan además `admin::users.read` (sin él, los selectores de `vet`, `responsible`… muestran el documentId en vez del correo) y la biblioteca de medios.

Reglas:

- "Sus propios" = filtrado por propietario con una **policy** nativa de Strapi (`src/policies/is-owner.js`) aplicada en las rutas del rol Cliente. La cadena de propiedad es `user → profile → customer → pets`.
- `verification-code`, `notification-delivery` y `signed-document-event` (salvo `create`) no se exponen a ningún rol de la API; los usa solo el backend.
- Las relaciones hacia `admin::user` no salen por la API a ningún rol de `users-permissions` (el saneado exige `admin::user.find`, que no existe ahí); solo a un token de API de acceso total.
- Un usuario tiene un único rol (limitación nativa aceptada).

---

## 11. Criterios de aceptación

- [ ] Strapi arranca sin errores y el Content-Type Builder muestra 48 content types y 43 componentes.
- [ ] Ningún atributo se llama `status`, `locale`, `meta` ni otro nombre reservado.
- [ ] Todas las relaciones bidireccionales aparecen en ambos lados y los `inversedBy`/`mappedBy` coinciden.
- [ ] Ningún content type tiene Draft & Publish activado.
- [ ] No existe ninguna tabla, campo ni referencia a organizaciones o multi-tenant.
- [ ] No existen tablas propias de roles, permisos, OAuth ni refresh tokens.
- [ ] La migración de índices se ejecuta y los índices existen en PostgreSQL.
- [ ] Cada regla de la sección 8 tiene al menos una prueba (Jest) que demuestra que rechaza el caso inválido.
- [ ] Los roles de la sección 10 (de la API y del panel) existen tras el primer arranque y un Cliente no puede leer mascotas de otro cliente.
- [ ] Seed idempotente en `bootstrap()` de `country` (ISO 3166-1), `species` (perro, gato) y `service-category` iniciales.

## 12. Qué NO hacer

- No crear `medical_history`, `medias`, `addresses` (tabla), `auth_contacts`, `oauth_users`, `refresh_tokens`, `roles`, `permissions`, `role_permission`, `model_role`, `clinical_attachments`, `appointment_services`, `travel_checklists`, `signed_document_files`: todas se sustituyen por componentes o funciones nativas.
- No añadir campos `*_id` para relaciones: usar atributos `relation`.
- No añadir `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`.
- No usar relaciones polimórficas (`morphToMany`, etc.).
- No activar i18n.
- No cambiar nombres de atributos ni valores de enumeraciones definidos aquí.
