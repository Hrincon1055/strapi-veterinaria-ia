import type { Schema, Struct } from '@strapi/strapi';

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
    displayName: 'Attachment';
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
    displayName: 'Consents';
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
    displayName: 'Document file';
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

export interface SchedulingAppointmentService extends Struct.ComponentSchema {
  collectionName: 'components_scheduling_appointment_services';
  info: {
    displayName: 'Appointment service';
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

export interface SharedAddress extends Struct.ComponentSchema {
  collectionName: 'components_shared_addresses';
  info: {
    displayName: 'Address';
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

export interface TravelRequirement extends Struct.ComponentSchema {
  collectionName: 'components_travel_requirements';
  info: {
    displayName: 'Requirement';
    icon: 'check';
  };
  attributes: {
    document: Schema.Attribute.Media<'images' | 'files'>;
    isCompleted: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    requirementName: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    verifiedAt: Schema.Attribute.DateTime;
    verifiedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
  };
}

declare module '@strapi/strapi' {
  export namespace Public {
    export interface ComponentSchemas {
      'clinical.anamnesis': ClinicalAnamnesis;
      'clinical.attachment': ClinicalAttachment;
      'clinical.diagnosis': ClinicalDiagnosis;
      'clinical.imaging': ClinicalImaging;
      'clinical.lab-result': ClinicalLabResult;
      'clinical.medication': ClinicalMedication;
      'clinical.physical-exam': ClinicalPhysicalExam;
      'clinical.procedure': ClinicalProcedure;
      'clinical.treatment-plan': ClinicalTreatmentPlan;
      'customer.consents': CustomerConsents;
      'documents.document-file': DocumentsDocumentFile;
      'scheduling.appointment-service': SchedulingAppointmentService;
      'shared.address': SharedAddress;
      'travel.requirement': TravelRequirement;
    }
  }
}
