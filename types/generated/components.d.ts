import type { Schema, Struct } from '@strapi/strapi';

export interface ClinicalAttachment extends Struct.ComponentSchema {
  collectionName: 'components_clinical_attachments';
  info: {
    displayName: 'Attachment';
    icon: 'paperclip';
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
      'clinical.attachment': ClinicalAttachment;
      'customer.consents': CustomerConsents;
      'documents.document-file': DocumentsDocumentFile;
      'scheduling.appointment-service': SchedulingAppointmentService;
      'shared.address': SharedAddress;
      'travel.requirement': TravelRequirement;
    }
  }
}
