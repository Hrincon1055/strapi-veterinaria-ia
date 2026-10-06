import type { Schema, Struct } from '@strapi/strapi';

export interface BillingDianResolution extends Struct.ComponentSchema {
  collectionName: 'components_billing_dian_resolutions';
  info: {
    description: 'Resoluci\u00F3n de facturaci\u00F3n: prefijo, rango autorizado y vigencia. Las vencidas se conservan como hist\u00F3rico.';
    displayName: 'Resoluci\u00F3n DIAN';
    icon: 'file';
  };
  attributes: {
    currentNumber: Schema.Attribute.BigInteger;
    isActive: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    prefix: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 10;
      }>;
    rangeFrom: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    rangeTo: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    resolutionDate: Schema.Attribute.Date & Schema.Attribute.Required;
    resolutionNumber: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 40;
      }>;
    technicalKey: Schema.Attribute.String &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    validFrom: Schema.Attribute.Date;
    validUntil: Schema.Attribute.Date;
  };
}

export interface BillingFiscalResponsibility extends Struct.ComponentSchema {
  collectionName: 'components_billing_fiscal_responsibilities';
  info: {
    description: 'C\u00F3digo de responsabilidad tributaria de la DIAN; va en el XML de la factura electr\u00F3nica.';
    displayName: 'Responsabilidad fiscal';
    icon: 'shield';
  };
  attributes: {
    code: Schema.Attribute.Enumeration<
      ['o_13', 'o_15', 'o_23', 'o_47', 'r_99_pn']
    > &
      Schema.Attribute.Required;
    notes: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
  };
}

export interface BillingPartySnapshot extends Struct.ComponentSchema {
  collectionName: 'components_billing_party_snapshots';
  info: {
    description: 'Copia congelada al emitir de los datos del cliente que aparecen en la factura. No se edita.';
    displayName: 'Datos del receptor';
    icon: 'user';
  };
  attributes: {
    address: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    city: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    documentNumber: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 30;
      }>;
    documentType: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 20;
      }>;
    email: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    name: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    phone: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 30;
      }>;
  };
}

export interface BillingTaxProfile extends Struct.ComponentSchema {
  collectionName: 'components_billing_tax_profiles';
  info: {
    description: 'Tratamiento de IVA de lo que se vende; lo leer\u00E1 la factura electr\u00F3nica.';
    displayName: 'Perfil tributario';
    icon: 'hashtag';
  };
  attributes: {
    ivaRate: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          max: 100;
          min: 0;
        },
        number
      >;
    ivaTreatment: Schema.Attribute.Enumeration<
      ['gravado', 'exento', 'excluido']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'gravado'>;
  };
}

export interface CashDenominationCount extends Struct.ComponentSchema {
  collectionName: 'components_cash_denomination_counts';
  info: {
    description: 'Cu\u00E1ntos billetes o monedas de una denominaci\u00F3n hay en la caja al abrir o al cerrar.';
    displayName: 'Conteo por denominaci\u00F3n';
    icon: 'hashtag';
  };
  attributes: {
    denomination: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    kind: Schema.Attribute.Enumeration<['bill', 'coin']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'bill'>;
    quantity: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
  };
}

export interface CatalogAccessoryDetails extends Struct.ComponentSchema {
  collectionName: 'components_catalog_accessory_details';
  info: {
    description: 'Material, talla y color.';
    displayName: 'Datos de juguete o accesorio';
    icon: 'puzzle';
  };
  attributes: {
    color: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 40;
      }>;
    material: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 80;
      }>;
    size: Schema.Attribute.Enumeration<['xs', 's', 'm', 'l', 'xl', 'unique']> &
      Schema.Attribute.DefaultTo<'unique'>;
  };
}

export interface CatalogActiveIngredient extends Struct.ComponentSchema {
  collectionName: 'components_catalog_active_ingredients';
  info: {
    description: 'Principio activo y su concentraci\u00F3n.';
    displayName: 'Principio activo';
    icon: 'layer';
  };
  attributes: {
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 120;
      }>;
    strength: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    strengthUnit: Schema.Attribute.Enumeration<
      ['mg', 'mcg', 'g', 'ui', 'mg_ml', 'mcg_ml', 'ui_ml', 'percent']
    >;
  };
}

export interface CatalogFoodDetails extends Struct.ComponentSchema {
  collectionName: 'components_catalog_food_details';
  info: {
    description: 'Tipo de alimento, etapa de vida, peso neto y registro ICA.';
    displayName: 'Datos de alimento';
    icon: 'restaurant';
  };
  attributes: {
    foodType: Schema.Attribute.Enumeration<
      ['dry', 'wet', 'treat', 'supplement', 'therapeutic_diet']
    > &
      Schema.Attribute.Required;
    lifeStage: Schema.Attribute.Enumeration<
      ['puppy_kitten', 'adult', 'senior', 'all_stages']
    > &
      Schema.Attribute.DefaultTo<'all_stages'>;
    netWeightGrams: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    registration: Schema.Attribute.Component<
      'catalog.sanitary-registration',
      false
    >;
    requiresPrescription: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
  };
}

export interface CatalogMedicationDetails extends Struct.ComponentSchema {
  collectionName: 'components_catalog_medication_details';
  info: {
    description: 'Registro, principios activos, forma farmac\u00E9utica y condiciones de venta.';
    displayName: 'Datos de medicamento';
    icon: 'doctor';
  };
  attributes: {
    activeIngredients: Schema.Attribute.Component<
      'catalog.active-ingredient',
      true
    >;
    atcVetCode: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 20;
      }>;
    cumCode: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 30;
      }>;
    isControlled: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    laboratory: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    pharmaceuticalForm: Schema.Attribute.Enumeration<
      [
        'tablet',
        'capsule',
        'oral_suspension',
        'oral_solution',
        'injectable',
        'ointment',
        'cream',
        'drops',
        'spray',
        'pour_on',
        'collar',
        'shampoo',
        'powder',
        'other',
      ]
    > &
      Schema.Attribute.Required;
    registration: Schema.Attribute.Component<
      'catalog.sanitary-registration',
      false
    >;
    requiresPrescription: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    route: Schema.Attribute.Enumeration<
      ['oral', 'sc', 'im', 'iv', 'topical', 'otic', 'ophthalmic', 'other']
    > &
      Schema.Attribute.DefaultTo<'oral'>;
    storage: Schema.Attribute.Enumeration<
      ['ambient', 'refrigerated', 'frozen']
    > &
      Schema.Attribute.DefaultTo<'ambient'>;
  };
}

export interface CatalogSanitaryRegistration extends Struct.ComponentSchema {
  collectionName: 'components_catalog_sanitary_registrations';
  info: {
    description: 'Registro ICA (uso veterinario) o INVIMA (uso humano) que autoriza la venta.';
    displayName: 'Registro sanitario';
    icon: 'file';
  };
  attributes: {
    authority: Schema.Attribute.Enumeration<['ica', 'invima', 'other']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'ica'>;
    expiresOn: Schema.Attribute.Date;
    holder: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    number: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 60;
      }>;
  };
}

export interface CatalogVaccineDetails extends Struct.ComponentSchema {
  collectionName: 'components_catalog_vaccine_details';
  info: {
    description: 'Vacuna cl\u00EDnica que contiene este producto, registro y cadena de fr\u00EDo.';
    displayName: 'Datos de vacuna';
    icon: 'shield';
  };
  attributes: {
    dosesPerUnit: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      > &
      Schema.Attribute.DefaultTo<1>;
    laboratory: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    registration: Schema.Attribute.Component<
      'catalog.sanitary-registration',
      false
    >;
    route: Schema.Attribute.Enumeration<
      ['sc', 'im', 'intranasal', 'oral', 'other']
    > &
      Schema.Attribute.DefaultTo<'sc'>;
    storage: Schema.Attribute.Enumeration<
      ['ambient', 'refrigerated', 'frozen']
    > &
      Schema.Attribute.DefaultTo<'refrigerated'>;
    vaccine: Schema.Attribute.Relation<'manyToOne', 'api::clinical.vaccine'>;
  };
}

export interface ClinicOpeningHours extends Struct.ComponentSchema {
  collectionName: 'components_clinic_opening_hours';
  info: {
    description: 'Franja de atenci\u00F3n de un d\u00EDa. Alimenta el portal y la agenda en l\u00EDnea.';
    displayName: 'Horario de atenci\u00F3n';
    icon: 'clock';
  };
  attributes: {
    closesAt: Schema.Attribute.Time;
    dayOfWeek: Schema.Attribute.Enumeration<
      [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
      ]
    > &
      Schema.Attribute.Required;
    isClosed: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    notes: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 120;
      }>;
    opensAt: Schema.Attribute.Time;
  };
}

export interface ClinicalAnamnesis extends Struct.ComponentSchema {
  collectionName: 'components_clinical_anamneses';
  info: {
    description: 'Entrevista cl\u00EDnica: antecedentes, s\u00EDntomas y evoluci\u00F3n referidos por quien trae al paciente.';
    displayName: 'Anamnesis';
    icon: 'discuss';
  };
  attributes: {
    evolutionDays: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    history: Schema.Attribute.Blocks & Schema.Attribute.Required;
    reportedBy: Schema.Attribute.Enumeration<
      ['owner', 'caretaker', 'referring_vet', 'other']
    > &
      Schema.Attribute.DefaultTo<'owner'>;
  };
}

export interface ClinicalAttachment extends Struct.ComponentSchema {
  collectionName: 'components_clinical_attachments';
  info: {
    displayName: 'Adjunto';
    icon: 'attachment';
  };
  attributes: {
    attachmentKind: Schema.Attribute.Enumeration<
      ['lab_result', 'x_ray', 'ultrasound', 'photo', 'other']
    > &
      Schema.Attribute.DefaultTo<'other'>;
    description: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    file: Schema.Attribute.Media<'images' | 'files'> &
      Schema.Attribute.Required;
  };
}

export interface ClinicalDiagnosis extends Struct.ComponentSchema {
  collectionName: 'components_clinical_diagnoses';
  info: {
    description: 'Conclusi\u00F3n cl\u00EDnica del veterinario.';
    displayName: 'Diagn\u00F3stico';
    icon: 'lightbulb';
  };
  attributes: {
    condition: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    details: Schema.Attribute.Blocks;
    diagnosisKind: Schema.Attribute.Enumeration<
      ['presumptive', 'definitive', 'differential', 'ruled_out']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'presumptive'>;
    isPrimary: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
  };
}

export interface ClinicalImaging extends Struct.ComponentSchema {
  collectionName: 'components_clinical_imagings';
  info: {
    description: 'Estudio de imagen y sus hallazgos.';
    displayName: 'Imagen diagn\u00F3stica';
    icon: 'picture';
  };
  attributes: {
    bodyRegion: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 120;
      }>;
    findings: Schema.Attribute.Blocks;
    images: Schema.Attribute.Media<'images' | 'files', true>;
    modality: Schema.Attribute.Enumeration<
      ['xray', 'ultrasound', 'ct', 'mri', 'endoscopy', 'other']
    > &
      Schema.Attribute.Required;
  };
}

export interface ClinicalLabResult extends Struct.ComponentSchema {
  collectionName: 'components_clinical_lab_results';
  info: {
    description: 'Resultado de una prueba de laboratorio.';
    displayName: 'Laboratorio';
    icon: 'chartCircle';
  };
  attributes: {
    findings: Schema.Attribute.Blocks;
    isAbnormal: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    laboratory: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 120;
      }>;
    panel: Schema.Attribute.Enumeration<
      [
        'hemogram',
        'biochemistry',
        'urinalysis',
        'coprology',
        'cytology',
        'serology',
        'other',
      ]
    > &
      Schema.Attribute.Required;
    report: Schema.Attribute.Media<'files' | 'images'>;
    sampleTakenOn: Schema.Attribute.Date;
  };
}

export interface ClinicalMedication extends Struct.ComponentSchema {
  collectionName: 'components_clinical_medications';
  info: {
    description: 'F\u00E1rmaco prescrito dentro de un plan de tratamiento.';
    displayName: 'Medicaci\u00F3n';
    icon: 'plus';
  };
  attributes: {
    dose: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 80;
      }>;
    drug: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    durationDays: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    frequencyHours: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          max: 168;
          min: 1;
        },
        number
      >;
    notes: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    product: Schema.Attribute.Relation<'manyToOne', 'api::catalog.product'>;
    quantity: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    route: Schema.Attribute.Enumeration<
      ['oral', 'sc', 'im', 'iv', 'topical', 'otic', 'ophthalmic', 'other']
    > &
      Schema.Attribute.DefaultTo<'oral'>;
  };
}

export interface ClinicalPhysicalExam extends Struct.ComponentSchema {
  collectionName: 'components_clinical_physical_exams';
  info: {
    description: 'Constantes y hallazgos de la exploraci\u00F3n.';
    displayName: 'Exploraci\u00F3n f\u00EDsica';
    icon: 'doctor';
  };
  attributes: {
    bodyConditionScore: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          max: 9;
          min: 1;
        },
        number
      >;
    capillaryRefillSeconds: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          max: 10;
          min: 0;
        },
        number
      >;
    findings: Schema.Attribute.Blocks;
    heartRateBpm: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          max: 400;
          min: 0;
        },
        number
      >;
    hydrationState: Schema.Attribute.Enumeration<
      ['normal', 'mild', 'moderate', 'severe']
    >;
    mucousMembranes: Schema.Attribute.Enumeration<
      ['normal', 'pale', 'congested', 'icteric', 'cyanotic']
    >;
    respiratoryRateRpm: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          max: 200;
          min: 0;
        },
        number
      >;
    temperatureC: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          max: 45;
          min: 30;
        },
        number
      >;
  };
}

export interface ClinicalPrescriptionItem extends Struct.ComponentSchema {
  collectionName: 'components_clinical_prescription_items';
  info: {
    description: 'Copia de un medicamento del plan de tratamiento tal como sali\u00F3 en la f\u00F3rmula m\u00E9dica.';
    displayName: 'Medicamento formulado';
    icon: 'write';
  };
  attributes: {
    activeIngredients: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    dose: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 80;
      }>;
    drug: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    durationDays: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    frequencyHours: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          max: 168;
          min: 1;
        },
        number
      >;
    isControlled: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    notes: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    presentation: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    quantity: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    route: Schema.Attribute.Enumeration<
      ['oral', 'sc', 'im', 'iv', 'topical', 'otic', 'ophthalmic', 'other']
    >;
  };
}

export interface ClinicalProcedure extends Struct.ComponentSchema {
  collectionName: 'components_clinical_procedures';
  info: {
    description: 'Procedimiento o cirug\u00EDa realizada durante la consulta.';
    displayName: 'Procedimiento';
    icon: 'scissors';
  };
  attributes: {
    anesthesia: Schema.Attribute.Enumeration<
      ['none', 'local', 'sedation', 'general']
    > &
      Schema.Attribute.DefaultTo<'none'>;
    complications: Schema.Attribute.Text;
    durationMinutes: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    findings: Schema.Attribute.Blocks;
    procedureName: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
  };
}

export interface ClinicalProductLine extends Struct.ComponentSchema {
  collectionName: 'components_clinical_product_lines';
  info: {
    description: 'Producto del cat\u00E1logo aplicado, entregado o recomendado en la consulta.';
    displayName: 'Producto';
    icon: 'shoppingCart';
  };
  attributes: {
    label: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    lineKey: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 36;
      }>;
    notes: Schema.Attribute.Text;
    product: Schema.Attribute.Relation<'manyToOne', 'api::catalog.product'>;
    quantity: Schema.Attribute.Decimal &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0.01;
        },
        number
      > &
      Schema.Attribute.DefaultTo<1>;
    state: Schema.Attribute.Enumeration<
      ['applied', 'dispensed', 'recommended']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'applied'>;
  };
}

export interface ClinicalServiceLine extends Struct.ComponentSchema {
  collectionName: 'components_clinical_service_lines';
  info: {
    description: 'Servicio del cat\u00E1logo realizado o recomendado en la consulta.';
    displayName: 'Servicio';
    icon: 'handHeart';
  };
  attributes: {
    label: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    lineKey: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 36;
      }>;
    notes: Schema.Attribute.Text;
    quantity: Schema.Attribute.Decimal &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0.01;
        },
        number
      > &
      Schema.Attribute.DefaultTo<1>;
    service: Schema.Attribute.Relation<'manyToOne', 'api::scheduling.service'>;
    state: Schema.Attribute.Enumeration<['applied', 'recommended']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'applied'>;
  };
}

export interface ClinicalTreatmentPlan extends Struct.ComponentSchema {
  collectionName: 'components_clinical_treatment_plans';
  info: {
    description: 'Indicaciones, medicaci\u00F3n y recomendaciones.';
    displayName: 'Plan de tratamiento';
    icon: 'bulletList';
  };
  attributes: {
    followUpOn: Schema.Attribute.Date;
    indications: Schema.Attribute.Blocks & Schema.Attribute.Required;
    medications: Schema.Attribute.Component<'clinical.medication', true>;
    recommendations: Schema.Attribute.Blocks;
  };
}

export interface CustomerConsents extends Struct.ComponentSchema {
  collectionName: 'components_customer_consents';
  info: {
    displayName: 'Consentimientos';
    icon: 'shield';
  };
  attributes: {
    dataProcessing: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    email: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    lastChangedAt: Schema.Attribute.DateTime;
    marketing: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    sms: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
  };
}

export interface DocumentsDocumentFile extends Struct.ComponentSchema {
  collectionName: 'components_documents_document_files';
  info: {
    displayName: 'Archivo del documento';
    icon: 'file';
  };
  attributes: {
    file: Schema.Attribute.Media<'files' | 'images'> &
      Schema.Attribute.Required;
    fileKind: Schema.Attribute.Enumeration<
      ['draft_pdf', 'final_signed_pdf', 'attachment']
    > &
      Schema.Attribute.Required;
    sha256: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface HospitalizationCageStay extends Struct.ComponentSchema {
  collectionName: 'components_hospitalization_cage_stays';
  info: {
    description: 'Tramo de la hospitalizaci\u00F3n en una jaula. Lo escribe el servidor al ingresar y en cada traslado.';
    displayName: 'Estancia en jaula';
    icon: 'house';
  };
  attributes: {
    cage: Schema.Attribute.Relation<'manyToOne', 'api::hospitalization.cage'>;
    fromAt: Schema.Attribute.DateTime & Schema.Attribute.Required;
    toAt: Schema.Attribute.DateTime;
  };
}

export interface MarketingRuleCity extends Struct.ComponentSchema {
  collectionName: 'components_marketing_rule_cities';
  info: {
    description: 'Ciudad de la direcci\u00F3n del cliente.';
    displayName: 'Ciudad';
    icon: 'pinMap';
  };
  attributes: {
    city: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
  };
}

export interface MarketingRuleLastVisit extends Struct.ComponentSchema {
  collectionName: 'components_marketing_rule_last_visits';
  info: {
    description: 'Filtra por cu\u00E1ndo fue la \u00FAltima consulta de sus mascotas.';
    displayName: '\u00DAltima visita';
    icon: 'clock';
  };
  attributes: {
    fecha: Schema.Attribute.Date & Schema.Attribute.Required;
    operador: Schema.Attribute.Enumeration<
      ['sin_visita_desde', 'con_visita_desde']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'sin_visita_desde'>;
  };
}

export interface MarketingRuleReferral extends Struct.ComponentSchema {
  collectionName: 'components_marketing_rule_referrals';
  info: {
    description: 'Origen por el que lleg\u00F3 el cliente.';
    displayName: 'C\u00F3mo nos conoci\u00F3';
    icon: 'discuss';
  };
  attributes: {
    referralSource: Schema.Attribute.Enumeration<
      ['friend', 'social_media', 'google', 'ad', 'walk_in', 'other']
    > &
      Schema.Attribute.Required;
  };
}

export interface MarketingRuleSpecies extends Struct.ComponentSchema {
  collectionName: 'components_marketing_rule_species';
  info: {
    description: 'El cliente tiene al menos una mascota de la especie indicada.';
    displayName: 'Tiene mascota de especie';
    icon: 'paint';
  };
  attributes: {
    species: Schema.Attribute.Relation<'manyToOne', 'api::pet.species'>;
  };
}

export interface MarketingRuleSubscription extends Struct.ComponentSchema {
  collectionName: 'components_marketing_rule_subscriptions';
  info: {
    description: 'Filtra por si tiene suscripci\u00F3n y en qu\u00E9 estado.';
    displayName: 'Suscripci\u00F3n';
    icon: 'priceTag';
  };
  attributes: {
    estado: Schema.Attribute.Enumeration<
      [
        'active',
        'pending_payment',
        'suspended',
        'cancelled',
        'expired',
        'sin_suscripcion',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'active'>;
    plan: Schema.Attribute.Relation<'manyToOne', 'api::billing.plan'>;
  };
}

export interface MarketingRuleVaccinationDue extends Struct.ComponentSchema {
  collectionName: 'components_marketing_rule_vaccination_dues';
  info: {
    description: 'Alguna mascota tiene un refuerzo que vence antes de la fecha indicada.';
    displayName: 'Vacuna por vencer';
    icon: 'bell';
  };
  attributes: {
    vaccine: Schema.Attribute.Relation<'manyToOne', 'api::clinical.vaccine'>;
    vencePara: Schema.Attribute.Date & Schema.Attribute.Required;
  };
}

export interface SchedulingAppointmentService extends Struct.ComponentSchema {
  collectionName: 'components_scheduling_appointment_services';
  info: {
    displayName: 'Servicio de la cita';
    icon: 'clock';
  };
  attributes: {
    durationMinutes: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 5;
        },
        number
      >;
    price: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    service: Schema.Attribute.Relation<'manyToOne', 'api::scheduling.service'>;
  };
}

export interface SchedulingWorkShift extends Struct.ComponentSchema {
  collectionName: 'components_scheduling_work_shifts';
  info: {
    description: 'Un tramo de atenci\u00F3n de un d\u00EDa de la semana. Se repite todas las semanas mientras el horario est\u00E9 vigente.';
    displayName: 'Franja de trabajo';
    icon: 'calendar';
  };
  attributes: {
    dayOfWeek: Schema.Attribute.Enumeration<
      [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
      ]
    > &
      Schema.Attribute.Required;
    endsAt: Schema.Attribute.Time & Schema.Attribute.Required;
    room: Schema.Attribute.Relation<'manyToOne', 'api::scheduling.clinic-room'>;
    slotMinutes: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          max: 480;
          min: 5;
        },
        number
      >;
    startsAt: Schema.Attribute.Time & Schema.Attribute.Required;
  };
}

export interface SharedAddress extends Struct.ComponentSchema {
  collectionName: 'components_shared_addresses';
  info: {
    displayName: 'Direcci\u00F3n';
    icon: 'pinMap';
  };
  attributes: {
    addressLine: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    addressType: Schema.Attribute.Enumeration<['home', 'work']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'home'>;
    city: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    country: Schema.Attribute.Relation<'manyToOne', 'api::shared.country'>;
    isPrimary: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    postalCode: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 20;
      }>;
    reference: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    region: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
  };
}

export interface TravelAntiparasitic extends Struct.ComponentSchema {
  collectionName: 'components_travel_antiparasitics';
  info: {
    description: 'Desparasitaci\u00F3n exigida por el destino, con su ventana de tiempo antes del vuelo.';
    displayName: 'Tratamiento antiparasitario';
    icon: 'plus';
  };
  attributes: {
    administeredAt: Schema.Attribute.DateTime;
    document: Schema.Attribute.Media<'images' | 'files'>;
    drug: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    isCompleted: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    verifiedAt: Schema.Attribute.DateTime;
    verifiedBy: Schema.Attribute.Relation<'manyToOne', 'admin::user'>;
    windowHoursBeforeFlight: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          max: 720;
          min: 0;
        },
        number
      >;
  };
}

export interface TravelCrate extends Struct.ComponentSchema {
  collectionName: 'components_travel_crates';
  info: {
    description: 'Contenedor de viaje y su conformidad con la norma IATA.';
    displayName: 'Guacal de transporte';
    icon: 'archive';
  };
  attributes: {
    document: Schema.Attribute.Media<'images' | 'files'>;
    heightCm: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    iataCompliant: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    isCompleted: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    lengthCm: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    verifiedAt: Schema.Attribute.DateTime;
    verifiedBy: Schema.Attribute.Relation<'manyToOne', 'admin::user'>;
    widthCm: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
  };
}

export interface TravelHealthCertificate extends Struct.ComponentSchema {
  collectionName: 'components_travel_health_certificates';
  info: {
    description: 'Certificado de exportaci\u00F3n emitido por la autoridad sanitaria.';
    displayName: 'Certificado zoosanitario';
    icon: 'shield';
  };
  attributes: {
    certificateNumber: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 60;
      }>;
    document: Schema.Attribute.Media<'images' | 'files'>;
    isCompleted: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    issuedOn: Schema.Attribute.Date;
    issuingAuthority: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 120;
      }> &
      Schema.Attribute.DefaultTo<'ICA'>;
    validUntil: Schema.Attribute.Date;
    verifiedAt: Schema.Attribute.DateTime;
    verifiedBy: Schema.Attribute.Relation<'manyToOne', 'admin::user'>;
  };
}

export interface TravelImportPermit extends Struct.ComponentSchema {
  collectionName: 'components_travel_import_permits';
  info: {
    description: 'Autorizaci\u00F3n del pa\u00EDs de destino.';
    displayName: 'Permiso de importaci\u00F3n';
    icon: 'gate';
  };
  attributes: {
    authority: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    document: Schema.Attribute.Media<'images' | 'files'>;
    expiresOn: Schema.Attribute.Date;
    isCompleted: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    permitNumber: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 60;
      }>;
    verifiedAt: Schema.Attribute.DateTime;
    verifiedBy: Schema.Attribute.Relation<'manyToOne', 'admin::user'>;
  };
}

export interface TravelMicrochipCheck extends Struct.ComponentSchema {
  collectionName: 'components_travel_microchip_checks';
  info: {
    description: 'Lectura del microchip y comprobaci\u00F3n de la norma ISO.';
    displayName: 'Verificaci\u00F3n de microchip';
    icon: 'hashtag';
  };
  attributes: {
    document: Schema.Attribute.Media<'images' | 'files'>;
    implantedOn: Schema.Attribute.Date;
    isCompleted: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    isoCompliant: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    microchipNumber: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 20;
      }>;
    verifiedAt: Schema.Attribute.DateTime;
    verifiedBy: Schema.Attribute.Relation<'manyToOne', 'admin::user'>;
  };
}

export interface TravelOtherRequirement extends Struct.ComponentSchema {
  collectionName: 'components_travel_other_requirements';
  info: {
    description: 'Escape para exigencias del destino que no encajan en los tipos anteriores.';
    displayName: 'Otro requisito';
    icon: 'question';
  };
  attributes: {
    document: Schema.Attribute.Media<'images' | 'files'>;
    isCompleted: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    notes: Schema.Attribute.Text;
    requirementName: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    verifiedAt: Schema.Attribute.DateTime;
    verifiedBy: Schema.Attribute.Relation<'manyToOne', 'admin::user'>;
  };
}

export interface TravelRabiesTiter extends Struct.ComponentSchema {
  collectionName: 'components_travel_rabies_titers';
  info: {
    description: 'Titulaci\u00F3n de anticuerpos antirr\u00E1bicos. Muchos destinos exigen un m\u00EDnimo de 0,5 UI/ml.';
    displayName: 'Titulaci\u00F3n antirr\u00E1bica';
    icon: 'seed';
  };
  attributes: {
    document: Schema.Attribute.Media<'images' | 'files'>;
    isCompleted: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    laboratory: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    resultIuMl: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    sampleTakenOn: Schema.Attribute.Date;
    thresholdIuMl: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0.5>;
    validUntil: Schema.Attribute.Date;
    verifiedAt: Schema.Attribute.DateTime;
    verifiedBy: Schema.Attribute.Relation<'manyToOne', 'admin::user'>;
  };
}

declare module '@strapi/strapi' {
  export namespace Public {
    export interface ComponentSchemas {
      'billing.dian-resolution': BillingDianResolution;
      'billing.fiscal-responsibility': BillingFiscalResponsibility;
      'billing.party-snapshot': BillingPartySnapshot;
      'billing.tax-profile': BillingTaxProfile;
      'cash.denomination-count': CashDenominationCount;
      'catalog.accessory-details': CatalogAccessoryDetails;
      'catalog.active-ingredient': CatalogActiveIngredient;
      'catalog.food-details': CatalogFoodDetails;
      'catalog.medication-details': CatalogMedicationDetails;
      'catalog.sanitary-registration': CatalogSanitaryRegistration;
      'catalog.vaccine-details': CatalogVaccineDetails;
      'clinic.opening-hours': ClinicOpeningHours;
      'clinical.anamnesis': ClinicalAnamnesis;
      'clinical.attachment': ClinicalAttachment;
      'clinical.diagnosis': ClinicalDiagnosis;
      'clinical.imaging': ClinicalImaging;
      'clinical.lab-result': ClinicalLabResult;
      'clinical.medication': ClinicalMedication;
      'clinical.physical-exam': ClinicalPhysicalExam;
      'clinical.prescription-item': ClinicalPrescriptionItem;
      'clinical.procedure': ClinicalProcedure;
      'clinical.product-line': ClinicalProductLine;
      'clinical.service-line': ClinicalServiceLine;
      'clinical.treatment-plan': ClinicalTreatmentPlan;
      'customer.consents': CustomerConsents;
      'documents.document-file': DocumentsDocumentFile;
      'hospitalization.cage-stay': HospitalizationCageStay;
      'marketing.rule-city': MarketingRuleCity;
      'marketing.rule-last-visit': MarketingRuleLastVisit;
      'marketing.rule-referral': MarketingRuleReferral;
      'marketing.rule-species': MarketingRuleSpecies;
      'marketing.rule-subscription': MarketingRuleSubscription;
      'marketing.rule-vaccination-due': MarketingRuleVaccinationDue;
      'scheduling.appointment-service': SchedulingAppointmentService;
      'scheduling.work-shift': SchedulingWorkShift;
      'shared.address': SharedAddress;
      'travel.antiparasitic': TravelAntiparasitic;
      'travel.crate': TravelCrate;
      'travel.health-certificate': TravelHealthCertificate;
      'travel.import-permit': TravelImportPermit;
      'travel.microchip-check': TravelMicrochipCheck;
      'travel.other-requirement': TravelOtherRequirement;
      'travel.rabies-titer': TravelRabiesTiter;
    }
  }
}
