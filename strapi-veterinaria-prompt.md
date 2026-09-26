# Tarea: implementar el modelo de datos de una veterinaria en Strapi 5

Eres un desarrollador senior de Strapi 5 (TypeScript o JavaScript, PostgreSQL). Implementa **exactamente** el modelo descrito en este documento dentro de un proyecto Strapi 5 existente. No inventes entidades, campos ni relaciones que no estén aquí. Si algo no está especificado, elige la opción más simple y nativa de Strapi y déjalo anotado en un comentario `// DECISIÓN:`.

---

## 1. Decisiones cerradas (no reabrir)

1. **Sin multi-tenant.** No crear organizaciones, membresías, dominios, planes SaaS ni ningún campo `organization`/`tenant`. Se hará en otra iteración.
2. **Roles y permisos 100 % nativos de Strapi.**
   - Usuarios de la app (staff y clientes): plugin `users-permissions`, un rol por usuario.
   - Usuarios del panel admin: RBAC nativo del admin.
   - No crear tablas `roles`, `permissions`, `role_permission`, `model_role`, `oauth_users`, `auth_contacts` ni `refresh_tokens`.
   - Login social: solo providers nativos de `users-permissions` (no crear providers personalizados).
   - Refresh tokens: si la versión de Strapi instalada trae gestión de sesiones nativa en `users-permissions`, activarla según la documentación oficial; si no, usar el JWT nativo. No crear tablas propias de sesión.
3. **El staff (veterinarios, recepción) trabaja en una app propia**, no en el panel admin. Toda relación con "usuario" apunta a `plugin::users-permissions.user`. El panel admin solo se usa para configurar catálogos.
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
    clinical/content-types/{consultation,vaccine,pet-vaccination,allergy}/schema.json
    scheduling/content-types/{appointment,service-category,service,clinic-room}/schema.json
    billing/content-types/{plan,plan-benefit,subscription,benefit-usage,invoice}/schema.json
    travel/content-types/travel-case/schema.json
    documents/content-types/{signed-document,signed-document-signer,signed-document-event}/schema.json
    marketing/content-types/{campaign,campaign-metric}/schema.json
    notification/content-types/{notification,notification-recipient,notification-delivery}/schema.json
    clinic/content-types/clinic/schema.json          ← single type
  components/
    clinic/opening-hours.json
    shared/address.json
    customer/consents.json
    billing/{dian-resolution,fiscal-responsibility}.json
    clinical/attachment.json
    clinical/{anamnesis,physical-exam,lab-result,imaging,diagnosis,procedure,treatment-plan,medication}.json
    scheduling/{appointment-service,consultation-service}.json
    travel/{health-certificate,rabies-titer,microchip-check,antiparasitic,import-permit,crate,other-requirement}.json
    marketing/{rule-species,rule-last-visit,rule-subscription,rule-vaccination-due,rule-city,rule-referral}.json
    documents/document-file.json
  extensions/users-permissions/content-types/user/schema.json
  index.(ts|js)            ← middlewares de validación (sección 8)
database/migrations/        ← índices (sección 9)
```

Cada content type necesita además sus archivos estándar de `controllers`, `routes` y `services` generados con las factorías de Strapi (`factories.createCoreController`, `createCoreRouter`, `createCoreService`). Total: **32 content types (uno de ellos single type), 30 componentes, 1 extensión**.

## 4. Orden de implementación

1. Componentes.
2. Catálogos: `country`, `species`, `breed`, `service-category`, `service`, `clinic-room`, `vaccine`, `plan`, `plan-benefit`.
3. Personas: `profile`, extensión de `user`, `contact`, `verification-code`, `customer`, `customer-note`.
4. Mascotas y clínica: `pet`, `appointment`, `consultation`, `pet-vaccination`, `allergy`.
5. Facturación: `subscription`, `benefit-usage`, `invoice`.
6. Viajes, documentos, marketing, notificaciones.
7. Middlewares de validación, migración de índices, roles y permisos, seed de catálogos.
8. Arrancar Strapi y verificar los criterios de aceptación (sección 11).

Las relaciones bidireccionales deben declararse en **ambos** lados con `inversedBy` / `mappedBy` coincidentes, tal como aparecen abajo.

---

## 5. Componentes

### `src/components/shared/address.json`
```json
{
  "collectionName": "components_shared_addresses",
  "info": { "displayName": "Address", "icon": "pinMap" },
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
  "info": { "displayName": "Consents", "icon": "shield" },
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
    "displayName": "Attachment",
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
  "info": { "displayName": "Appointment service", "icon": "clock" },
  "options": {},
  "attributes": {
    "service": { "type": "relation", "relation": "manyToOne", "target": "api::scheduling.service" },
    "durationMinutes": { "type": "integer", "min": 5 },
    "price": { "type": "integer", "min": 0 }
  }
}
```

### `src/components/scheduling/consultation-service.json`

Línea de servicio cobrada en una consulta.
Fue un content type (`api::scheduling.consultation-service`) hasta que se comprobó que nadie lo referenciaba: es una línea de detalle que solo existe dentro de su consulta, igual que `appointment-service` dentro de su cita.
```json
{
  "collectionName": "components_scheduling_consultation_services",
  "info": {
    "displayName": "Servicio prestado",
    "icon": "priceTag",
    "description": "Línea de servicio cobrada en una consulta."
  },
  "options": {},
  "attributes": {
    "service": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::scheduling.service"
    },
    "quantity": {
      "type": "integer",
      "required": true,
      "default": 1,
      "min": 1
    },
    "durationMinutes": {
      "type": "integer",
      "min": 0
    },
    "unitPrice": {
      "type": "integer",
      "required": true,
      "min": 0
    },
    "totalPrice": {
      "type": "integer",
      "min": 0
    },
    "performedBy": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "plugin::users-permissions.user"
    },
    "notes": {
      "type": "text"
    }
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
      "target": "plugin::users-permissions.user"
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
      "target": "plugin::users-permissions.user"
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
      "target": "plugin::users-permissions.user"
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
      "target": "plugin::users-permissions.user"
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
      "target": "plugin::users-permissions.user"
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
      "target": "plugin::users-permissions.user"
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
      "target": "plugin::users-permissions.user"
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
  "info": { "displayName": "Document file", "icon": "file" },
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
    "notes": {
      "type": "string",
      "maxLength": 255
    }
  }
}
```
  
_No aparece en la zona: se anida dentro de `clinical.treatment-plan`._

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

Reglas en `src/validations/clinic.ts`, todas verificadas: DV coherente con el NIT; una sola resolución activa; rango final mayor que el inicial; consecutivo dentro del rango; vigencia coherente; la resolución activa no puede estar vencida ni con el rango agotado (con aviso por log a menos de 100 números); y los horarios no pueden cerrar antes de abrir ni repetir día.

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
  "info": { "singularName": "country", "pluralName": "countries", "displayName": "Country" },
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
  "info": { "singularName": "contact", "pluralName": "contacts", "displayName": "Contact" },
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
  "info": { "singularName": "verification-code", "pluralName": "verification-codes", "displayName": "Verification code" },
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
  "info": { "singularName": "profile", "pluralName": "profiles", "displayName": "Profile" },
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
    "archivedAt": { "type": "datetime" }
  }
}
```
Un perfil representa a cualquier persona (staff o cliente).

### 7.3 Customer

#### `api::customer.customer`
```json
{
  "kind": "collectionType",
  "collectionName": "customers",
  "info": { "singularName": "customer", "pluralName": "customers", "displayName": "Customer" },
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
  "info": { "singularName": "customer-note", "pluralName": "customer-notes", "displayName": "Customer note" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "customer": { "type": "relation", "relation": "manyToOne", "target": "api::customer.customer", "inversedBy": "notes" },
    "rating": { "type": "enumeration", "enum": ["good", "regular", "bad"] },
    "body": { "type": "text", "required": true },
    "author": { "type": "relation", "relation": "manyToOne", "target": "plugin::users-permissions.user" }
  }
}
```

### 7.4 Pet

#### `api::pet.pet`
```json
{
  "kind": "collectionType",
  "collectionName": "pets",
  "info": { "singularName": "pet", "pluralName": "pets", "displayName": "Pet" },
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
    "archivedAt": { "type": "datetime" }
  }
}
```

#### `api::pet.species`
```json
{
  "kind": "collectionType",
  "collectionName": "species",
  "info": { "singularName": "species", "pluralName": "species-list", "displayName": "Species" },
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
  "info": { "singularName": "breed", "pluralName": "breeds", "displayName": "Breed" },
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
  "info": { "singularName": "consultation", "pluralName": "consultations", "displayName": "Consultation" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "pet": { "type": "relation", "relation": "manyToOne", "target": "api::pet.pet", "inversedBy": "consultations" },
    "vet": { "type": "relation", "relation": "manyToOne", "target": "plugin::users-permissions.user" },
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
    "services": { "type": "component", "repeatable": true, "component": "scheduling.consultation-service" },
    "archivedAt": { "type": "datetime" }
  }
}
```
`nextControlOn` = fecha sugerida del próximo control (no es una cita).

**El contenido clínico va en la dynamic zone `sections`** (sección 5.1), no en campos fijos: cada visita compone las secciones que necesita. Una consulta de estética lleva tres; una cirugía lleva las siete. Sustituye a los antiguos `anamnesis`, `diagnosis` y `treatmentNotes`, que eran tres `blocks` obligados a existir aunque la visita no los usara.

Dos consecuencias operativas de esa decisión:

- **La zona no se puebla con `populate=*`.** Hay que enumerar cada componente bajo `on`, y los que llevan media o componentes anidados necesitan su propio `populate`. Si se omite, la respuesta trae `sections: []` y la consulta parece vacía. Por eso las rutas `find` y `findOne` llevan el middleware `api::clinical.populate-sections`, que lo inyecta.
- **Los filtros de Strapi no atraviesan la zona**: `filters[sections][condition]` no existe. La búsqueda dentro de la historia clínica es un endpoint propio, `GET /api/consultations/search?section=<componente>&q=<texto>`, resuelto con el query engine sobre `consultations_cmps` y la tabla del componente.

#### `api::clinical.vaccine`
```json
{
  "kind": "collectionType",
  "collectionName": "vaccines",
  "info": { "singularName": "vaccine", "pluralName": "vaccines", "displayName": "Vaccine" },
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
  "info": { "singularName": "pet-vaccination", "pluralName": "pet-vaccinations", "displayName": "Pet vaccination" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "pet": { "type": "relation", "relation": "manyToOne", "target": "api::pet.pet", "inversedBy": "vaccinations" },
    "vaccine": { "type": "relation", "relation": "manyToOne", "target": "api::clinical.vaccine" },
    "consultation": { "type": "relation", "relation": "manyToOne", "target": "api::clinical.consultation" },
    "vet": { "type": "relation", "relation": "manyToOne", "target": "plugin::users-permissions.user" },
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
  "info": { "singularName": "allergy", "pluralName": "allergies", "displayName": "Allergy" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "pet": { "type": "relation", "relation": "manyToOne", "target": "api::pet.pet", "inversedBy": "allergies" },
    "allergen": { "type": "string", "required": true, "maxLength": 150 },
    "category": { "type": "enumeration", "enum": ["food", "environmental", "medication", "parasite", "other"] },
    "reaction": { "type": "text" },
    "severity": { "type": "enumeration", "enum": ["low", "moderate", "high", "life_threatening"] },
    "diagnosedOn": { "type": "date" },
    "vet": { "type": "relation", "relation": "manyToOne", "target": "plugin::users-permissions.user" },
    "consultation": { "type": "relation", "relation": "manyToOne", "target": "api::clinical.consultation" },
    "isActive": { "type": "boolean", "default": true },
    "resolvedOn": { "type": "date" },
    "notes": { "type": "text" }
  }
}
```

### 7.6 Scheduling

#### `api::scheduling.appointment`
```json
{
  "kind": "collectionType",
  "collectionName": "appointments",
  "info": { "singularName": "appointment", "pluralName": "appointments", "displayName": "Appointment" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "pet": { "type": "relation", "relation": "manyToOne", "target": "api::pet.pet" },
    "responsible": { "type": "relation", "relation": "manyToOne", "target": "plugin::users-permissions.user" },
    "room": { "type": "relation", "relation": "manyToOne", "target": "api::scheduling.clinic-room" },
    "bookedBy": { "type": "relation", "relation": "manyToOne", "target": "plugin::users-permissions.user" },
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
  "info": { "singularName": "service-category", "pluralName": "service-categories", "displayName": "Service category" },
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
  "info": { "singularName": "service", "pluralName": "services", "displayName": "Service" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "category": { "type": "relation", "relation": "manyToOne", "target": "api::scheduling.service-category", "inversedBy": "services" },
    "name": { "type": "string", "required": true, "maxLength": 120 },
    "description": { "type": "text" },
    "defaultDurationMinutes": { "type": "integer", "required": true, "default": 30, "min": 5 },
    "basePrice": { "type": "integer", "min": 0 },
    "currency": { "type": "string", "default": "COP", "regex": "^[A-Z]{3}$" },
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
  "info": { "singularName": "clinic-room", "pluralName": "clinic-rooms", "displayName": "Clinic room" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "name": { "type": "string", "required": true, "unique": true, "maxLength": 80 },
    "roomType": { "type": "enumeration", "enum": ["consultation", "surgery", "grooming", "imaging", "lab", "other"], "default": "consultation", "required": true },
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
  "info": { "singularName": "plan-benefit", "pluralName": "plan-benefits", "displayName": "Plan benefit" },
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
  "info": { "singularName": "subscription", "pluralName": "subscriptions", "displayName": "Subscription" },
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
  "info": { "singularName": "benefit-usage", "pluralName": "benefit-usages", "displayName": "Benefit usage" },
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
  "info": { "singularName": "invoice", "pluralName": "invoices", "displayName": "Invoice" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "customer": { "type": "relation", "relation": "manyToOne", "target": "api::customer.customer" },
    "subscription": { "type": "relation", "relation": "manyToOne", "target": "api::billing.subscription" },
    "consultation": { "type": "relation", "relation": "manyToOne", "target": "api::clinical.consultation" },
    "amount": { "type": "integer", "required": true, "min": 0 },
    "currency": { "type": "string", "required": true, "default": "COP", "regex": "^[A-Z]{3}$" },
    "state": { "type": "enumeration", "enum": ["draft", "issued", "paid", "voided", "dian_error"], "default": "draft", "required": true },
    "dataicoInvoiceId": { "type": "string", "unique": true },
    "dianState": { "type": "string" },
    "pdfUrl": { "type": "string" },
    "xmlUrl": { "type": "string" },
    "archivedAt": { "type": "datetime" }
  }
}
```
`pdfUrl` y `xmlUrl` son URLs alojadas por Dataico (proveedor de facturación electrónica), por eso son texto.

### 7.8 Travel

#### `api::travel.travel-case`
```json
{
  "kind": "collectionType",
  "collectionName": "travel_cases",
  "info": { "singularName": "travel-case", "pluralName": "travel-cases", "displayName": "Travel case" },
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
  "info": { "singularName": "signed-document", "pluralName": "signed-documents", "displayName": "Signed document" },
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
  "info": { "singularName": "signed-document-signer", "pluralName": "signed-document-signers", "displayName": "Signed document signer" },
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
  "info": { "singularName": "signed-document-event", "pluralName": "signed-document-events", "displayName": "Signed document event" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "signedDocument": { "type": "relation", "relation": "manyToOne", "target": "api::documents.signed-document", "inversedBy": "events" },
    "signer": { "type": "relation", "relation": "manyToOne", "target": "api::documents.signed-document-signer" },
    "performedBy": { "type": "relation", "relation": "manyToOne", "target": "plugin::users-permissions.user" },
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
  "info": { "singularName": "campaign", "pluralName": "campaigns", "displayName": "Campaign" },
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
  "info": { "singularName": "campaign-metric", "pluralName": "campaign-metrics", "displayName": "Campaign metric" },
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
  "info": { "singularName": "notification", "pluralName": "notifications", "displayName": "Notification" },
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
  "info": { "singularName": "notification-recipient", "pluralName": "notification-recipients", "displayName": "Notification recipient" },
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
  "info": { "singularName": "notification-delivery", "pluralName": "notification-deliveries", "displayName": "Notification delivery" },
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
| `api::customer.customer-note` | `customer`, `author` (asignar el usuario autenticado en el controlador) |
| `api::pet.pet` | `owner`, `species` |
| `api::pet.breed` | `species` |
| `api::clinical.consultation` | `pet`, `vet` |
| `api::clinical.vaccine` | `species` |
| `api::clinical.pet-vaccination` | `pet`, `vaccine` |
| `api::clinical.allergy` | `pet` |
| `api::scheduling.appointment` | `pet`, `responsible` |
| `api::scheduling.service` | `category` |
| componente `scheduling.consultation-service` | `service` (la pertenencia a la consulta es estructural) |
| `api::billing.plan-benefit` | `plan` |
| `api::billing.subscription` | `customer`, `pet`, `plan` |
| `api::billing.benefit-usage` | `subscription`, `benefit` |
| `api::billing.invoice` | `customer` |
| `api::travel.travel-case` | `pet`, `destinationCountry` |
| `api::documents.signed-document-signer` | `signedDocument`, `signer` |
| `api::documents.signed-document-event` | `signedDocument` |
| `api::marketing.campaign-metric` | `campaign` |
| `api::notification.notification-recipient` | `notification`, `recipient` |
| `api::notification.notification-delivery` | `recipient` |
| componente `scheduling.appointment-service` | `service` |

### Unicidad compuesta

| UID | Regla |
| --- | --- |
| `api::shared.contact` | `(profile, contactType, value)` único |
| `api::shared.contact` | máximo un `isPrimary = true` por `(profile, contactType)` |
| `api::shared.verification-code` | un solo código con `usedAt` nulo por `(contact, purpose)`; al crear uno nuevo, marcar el anterior como usado dentro de la misma transacción |
| `api::pet.breed` | `(species, name)` único |
| `api::scheduling.service` | `(category, name)` único |
| `api::clinical.vaccine` | `(species, name)` único |
| `api::documents.signed-document` | `version` única por el mismo destinatario (`consultation`, `customer` o `pet`) |
| `api::documents.signed-document-signer` | `(signedDocument, signer)` único |
| `api::notification.notification-recipient` | `(notification, recipient)` único |
| `api::notification.notification-delivery` | `(recipient, channel)` único |
| componente `scheduling.appointment-service` | sin `service` repetido dentro de la misma cita |
| componente `shared.address` | máximo un `isPrimary = true` por perfil |
| componente `documents.document-file` | máximo un `final_signed_pdf` por documento |

### Reglas condicionales

| UID | Regla |
| --- | --- |
| `api::shared.contact` | `value` debe ser email válido si `contactType` es `email`/`email_work`; teléfono E.164 (`^\+[1-9][0-9]{7,14}$`) en los demás |
| `api::pet.pet` | `breed.species` = `species`; `birthDate` no futura; `sterilizedOn` solo si `sterilizationState = sterilized` |
| `api::clinical.consultation` | si falta `consultedAt`, asignar la fecha actual; `nextControlOn` posterior a `consultedAt`; si llega `weightKg`, actualizar `pet.weightKg` |
| `api::clinical.pet-vaccination` | `vaccine.species` = `pet.species`; `appliedOn` no futura; `nextDueOn` > `appliedOn` |
| `api::clinical.allergy` | `resolvedOn` obligatorio si `isActive = false` |
| `api::scheduling.appointment` | `endAt` > `startAt`; si `state = cancelled` exigir `cancelledAt` y `cancelReason`; fijar `arrivedAt`/`completedAt` al pasar a `arrived`/`completed`; asignar `bookedBy` con el usuario autenticado al crear |
| `api::scheduling.appointment` | sin solapamiento para el mismo `responsible` ni la misma `room` entre citas en estados `scheduled`, `confirmed`, `arrived`, `in_progress` |
| `api::scheduling.appointment` | en cada línea de `services`, si faltan `durationMinutes`/`price`, copiar `service.defaultDurationMinutes`/`service.basePrice` |
| componente `scheduling.consultation-service` | `totalPrice = quantity × unitPrice` (calculado en el middleware de `consultation`, ignora el valor enviado) |
| `api::billing.subscription` | `endOn` > `startOn`; `pet.owner` = `customer` |
| `api::billing.benefit-usage` | la suscripción debe estar `active`; `benefit.plan` = `subscription.plan`; no superar `quantityPerYear` en el año de vigencia |
| `api::billing.invoice` | exactamente uno de `subscription` o `consultation`; si `state` ≠ `draft`, rechazar cualquier `update` salvo cambios de `state`, `dianState`, `pdfUrl`, `xmlUrl` |
| `api::travel.travel-case` | cada requisito con `isCompleted = true` exige `verifiedBy`; asignar `verifiedAt` al completarlo |
| `api::documents.signed-document` | exactamente uno de `consultation`, `customer`, `pet`; `voidedAt` y `voidReason` obligatorios si `state = voided`; si `state = signed`, solo se permite pasar a `voided` |
| `api::documents.signed-document-signer` | `signOrder` obligatorio si el documento es secuencial; `signatureMethod` y `signedAt` obligatorios si `state = signed` |
| `api::documents.signed-document-event` | rechazar `update` y `delete` |
| `api::customer.customer` | actualizar `consents.lastChangedAt` cuando cambie cualquier consentimiento |
| `api::marketing.campaign` | al resolver el segmento, incluir solo clientes con `consents.marketing = true` |

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
  },
};
```

La regla de unicidad de `profiles` por documento también debe validarse en el middleware para devolver un error legible antes de llegar a la base de datos.

---

## 10. Roles y permisos (nativos)

Crea los roles de `users-permissions` en `bootstrap()` si no existen, y asigna permisos con el servicio nativo del plugin. No crear tablas ni lógica de RBAC propia.

| Rol (users-permissions) | Permisos |
| --- | --- |
| Public | `find`/`findOne` de `country`, `species`, `breed`, `service-category`, `service`, `plan`, `plan-benefit`; `register`/`callback` nativos |
| Cliente (`Authenticated` renombrado o rol `client` por defecto al registrarse) | `find`/`findOne` de sus propios `pet`, `appointment`, `consultation`, `pet-vaccination`, `allergy`, `subscription`, `invoice`, `signed-document`, `notification-recipient`; `create` de `appointment` (source `online`); `update` de su `profile`, `contact` y `notification-recipient.readAt` |
| Recepción (`receptionist`) | CRUD de `profile`, `contact`, `customer`, `customer-note`, `pet`, `appointment`, `subscription`, `invoice`, `travel-case`; lectura de catálogos y de `consultation` |
| Veterinario (`veterinarian`) | todo lo de Recepción + CRUD de `consultation`, `consultation-service`, `pet-vaccination`, `allergy`, `signed-document`, `signed-document-signer`; `create` de `signed-document-event` |
| Administrador de clínica (`clinic_admin`) | todo lo anterior + CRUD de catálogos (`service-category`, `service`, `clinic-room`, `vaccine`, `species`, `breed`, `plan`, `plan-benefit`), `campaign`, `campaign-metric`, `notification` |

Reglas:

- "Sus propios" = filtrado por propietario con una **policy** nativa de Strapi (`src/policies/is-owner.js`) aplicada en las rutas del rol Cliente. La cadena de propiedad es `user → profile → customer → pets`.
- `verification-code`, `notification-delivery` y `signed-document-event` (salvo `create`) no se exponen a ningún rol de la API; los usa solo el backend.
- El panel admin usa el RBAC nativo del admin (Super Admin, Editor, Author) solo para configurar catálogos.
- Un usuario tiene un único rol (limitación nativa aceptada).

---

## 11. Criterios de aceptación

- [ ] Strapi arranca sin errores y el Content-Type Builder muestra 32 content types y 30 componentes.
- [ ] Ningún atributo se llama `status`, `locale`, `meta` ni otro nombre reservado.
- [ ] Todas las relaciones bidireccionales aparecen en ambos lados y los `inversedBy`/`mappedBy` coinciden.
- [ ] Ningún content type tiene Draft & Publish activado.
- [ ] No existe ninguna tabla, campo ni referencia a organizaciones o multi-tenant.
- [ ] No existen tablas propias de roles, permisos, OAuth ni refresh tokens.
- [ ] La migración de índices se ejecuta y los índices existen en PostgreSQL.
- [ ] Cada regla de la sección 8 tiene al menos una prueba (Jest) que demuestra que rechaza el caso inválido.
- [ ] Los roles de la sección 10 existen tras el primer arranque y un Cliente no puede leer mascotas de otro cliente.
- [ ] Seed idempotente en `bootstrap()` de `country` (ISO 3166-1), `species` (perro, gato) y `service-category` iniciales.

## 12. Qué NO hacer

- No crear `medical_history`, `medias`, `addresses` (tabla), `auth_contacts`, `oauth_users`, `refresh_tokens`, `roles`, `permissions`, `role_permission`, `model_role`, `clinical_attachments`, `appointment_services`, `travel_checklists`, `signed_document_files`: todas se sustituyen por componentes o funciones nativas.
- No añadir campos `*_id` para relaciones: usar atributos `relation`.
- No añadir `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`.
- No usar relaciones polimórficas (`morphToMany`, etc.).
- No activar i18n.
- No cambiar nombres de atributos ni valores de enumeraciones definidos aquí.
