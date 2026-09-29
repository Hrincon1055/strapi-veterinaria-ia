import type { Schema, Struct } from '@strapi/strapi';

export interface AdminApiToken extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_api_tokens';
  info: {
    description: '';
    displayName: 'Api Token';
    name: 'Api Token';
    pluralName: 'api-tokens';
    singularName: 'api-token';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    accessKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    adminPermissions: Schema.Attribute.Relation<
      'oneToMany',
      'admin::permission'
    >;
    adminUserOwner: Schema.Attribute.Relation<'manyToOne', 'admin::user'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Schema.Attribute.DefaultTo<''>;
    encryptedKey: Schema.Attribute.Text &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    expiresAt: Schema.Attribute.DateTime;
    kind: Schema.Attribute.Enumeration<['content-api', 'admin']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'content-api'>;
    lastUsedAt: Schema.Attribute.DateTime;
    lifespan: Schema.Attribute.BigInteger;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::api-token'> &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'admin::api-token-permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    type: Schema.Attribute.Enumeration<['read-only', 'full-access', 'custom']> &
      Schema.Attribute.DefaultTo<'read-only'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminApiTokenPermission extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_api_token_permissions';
  info: {
    description: '';
    displayName: 'API Token Permission';
    name: 'API Token Permission';
    pluralName: 'api-token-permissions';
    singularName: 'api-token-permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::api-token-permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    token: Schema.Attribute.Relation<'manyToOne', 'admin::api-token'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminPermission extends Struct.CollectionTypeSchema {
  collectionName: 'admin_permissions';
  info: {
    description: '';
    displayName: 'Permission';
    name: 'Permission';
    pluralName: 'permissions';
    singularName: 'permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    actionParameters: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    apiToken: Schema.Attribute.Relation<'manyToOne', 'admin::api-token'>;
    conditions: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<[]>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::permission'> &
      Schema.Attribute.Private;
    properties: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Relation<'manyToOne', 'admin::role'>;
    subject: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminRole extends Struct.CollectionTypeSchema {
  collectionName: 'admin_roles';
  info: {
    description: '';
    displayName: 'Role';
    name: 'Role';
    pluralName: 'roles';
    singularName: 'role';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::role'> &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<'oneToMany', 'admin::permission'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    users: Schema.Attribute.Relation<'manyToMany', 'admin::user'>;
  };
}

export interface AdminSession extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_sessions';
  info: {
    description: 'Session Manager storage';
    displayName: 'Session';
    name: 'Session';
    pluralName: 'sessions';
    singularName: 'session';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
    i18n: {
      localized: false;
    };
  };
  attributes: {
    absoluteExpiresAt: Schema.Attribute.DateTime & Schema.Attribute.Private;
    childId: Schema.Attribute.String & Schema.Attribute.Private;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    deviceId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
    expiresAt: Schema.Attribute.DateTime &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::session'> &
      Schema.Attribute.Private;
    metadata: Schema.Attribute.JSON & Schema.Attribute.Private;
    origin: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    sessionId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique;
    status: Schema.Attribute.String & Schema.Attribute.Private;
    type: Schema.Attribute.String & Schema.Attribute.Private;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    userId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
  };
}

export interface AdminTransferToken extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_transfer_tokens';
  info: {
    description: '';
    displayName: 'Transfer Token';
    name: 'Transfer Token';
    pluralName: 'transfer-tokens';
    singularName: 'transfer-token';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    accessKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Schema.Attribute.DefaultTo<''>;
    expiresAt: Schema.Attribute.DateTime;
    lastUsedAt: Schema.Attribute.DateTime;
    lifespan: Schema.Attribute.BigInteger;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token-permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminTransferTokenPermission
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_transfer_token_permissions';
  info: {
    description: '';
    displayName: 'Transfer Token Permission';
    name: 'Transfer Token Permission';
    pluralName: 'transfer-token-permissions';
    singularName: 'transfer-token-permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token-permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    token: Schema.Attribute.Relation<'manyToOne', 'admin::transfer-token'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminUser extends Struct.CollectionTypeSchema {
  collectionName: 'admin_users';
  info: {
    description: '';
    displayName: 'User';
    name: 'User';
    pluralName: 'users';
    singularName: 'user';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    apiTokens: Schema.Attribute.Relation<'oneToMany', 'admin::api-token'> &
      Schema.Attribute.Private;
    blocked: Schema.Attribute.Boolean &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<false>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.Email &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    firstname: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    isActive: Schema.Attribute.Boolean &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<false>;
    lastname: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::user'> &
      Schema.Attribute.Private;
    password: Schema.Attribute.Password &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    preferedLanguage: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    registrationToken: Schema.Attribute.String & Schema.Attribute.Private;
    resetPasswordToken: Schema.Attribute.String & Schema.Attribute.Private;
    resetPasswordTokenExpiresAt: Schema.Attribute.DateTime &
      Schema.Attribute.Private;
    roles: Schema.Attribute.Relation<'manyToMany', 'admin::role'> &
      Schema.Attribute.Private;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    username: Schema.Attribute.String;
  };
}

export interface ApiBillingBenefitUsage extends Struct.CollectionTypeSchema {
  collectionName: 'benefit_usages';
  info: {
    displayName: 'Uso de beneficio';
    pluralName: 'benefit-usages';
    singularName: 'benefit-usage';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    benefit: Schema.Attribute.Relation<
      'manyToOne',
      'api::billing.plan-benefit'
    >;
    consultation: Schema.Attribute.Relation<
      'manyToOne',
      'api::clinical.consultation'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::billing.benefit-usage'
    > &
      Schema.Attribute.Private;
    notes: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    publishedAt: Schema.Attribute.DateTime;
    subscription: Schema.Attribute.Relation<
      'manyToOne',
      'api::billing.subscription'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    usedAt: Schema.Attribute.DateTime & Schema.Attribute.Required;
  };
}

export interface ApiBillingInvoice extends Struct.CollectionTypeSchema {
  collectionName: 'invoices';
  info: {
    description: 'Cabecera de la factura. Los conceptos cobrados son sus renglones (invoice-item); el emisor y la numeraci\u00F3n salen de Cl\u00EDnica.';
    displayName: 'Factura';
    pluralName: 'invoices';
    singularName: 'invoice';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    amount: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    archivedAt: Schema.Attribute.DateTime;
    buyer: Schema.Attribute.Component<'billing.party-snapshot', false>;
    correctsInvoice: Schema.Attribute.Relation<
      'manyToOne',
      'api::billing.invoice'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    currency: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'COP'>;
    customer: Schema.Attribute.Relation<'manyToOne', 'api::customer.customer'>;
    dataicoInvoiceId: Schema.Attribute.String & Schema.Attribute.Unique;
    dianState: Schema.Attribute.String;
    discountTotal: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    documentKind: Schema.Attribute.Enumeration<['invoice', 'credit_note']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'invoice'>;
    dueOn: Schema.Attribute.Date;
    fullNumber: Schema.Attribute.String &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 30;
      }>;
    issuedAt: Schema.Attribute.DateTime;
    issuerSnapshot: Schema.Attribute.JSON;
    items: Schema.Attribute.Relation<'oneToMany', 'api::billing.invoice-item'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::billing.invoice'
    > &
      Schema.Attribute.Private;
    notes: Schema.Attribute.Text;
    number: Schema.Attribute.BigInteger;
    paymentState: Schema.Attribute.Enumeration<['unpaid', 'partial', 'paid']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'unpaid'>;
    pdfUrl: Schema.Attribute.String;
    prefix: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 10;
      }>;
    publishedAt: Schema.Attribute.DateTime;
    resolutionDate: Schema.Attribute.Date;
    resolutionNumber: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 40;
      }>;
    resolutionRangeFrom: Schema.Attribute.BigInteger;
    resolutionRangeTo: Schema.Attribute.BigInteger;
    resolutionValidUntil: Schema.Attribute.Date;
    searchLabel: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    state: Schema.Attribute.Enumeration<
      ['draft', 'issued', 'voided', 'dian_error']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'draft'>;
    subscription: Schema.Attribute.Relation<
      'manyToOne',
      'api::billing.subscription'
    >;
    subtotal: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    taxTotal: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    voidedAt: Schema.Attribute.DateTime;
    voidReason: Schema.Attribute.Text;
    xmlUrl: Schema.Attribute.String;
  };
}

export interface ApiBillingInvoiceItem extends Struct.CollectionTypeSchema {
  collectionName: 'invoice_items';
  info: {
    description: 'Un concepto cobrado. Si viene de una consulta, se\u00F1ala su l\u00EDnea por lineKey; lockKey impide que dos facturas vivas cobren la misma.';
    displayName: 'Rengl\u00F3n de factura';
    pluralName: 'invoice-items';
    singularName: 'invoice-item';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    discountAmount: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    invoice: Schema.Attribute.Relation<'manyToOne', 'api::billing.invoice'>;
    kind: Schema.Attribute.Enumeration<
      [
        'consultation_service',
        'consultation_product',
        'subscription',
        'direct_service',
        'direct_product',
        'custom',
      ]
    > &
      Schema.Attribute.Required;
    lineSubtotal: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    lineTax: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    lineTotal: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::billing.invoice-item'
    > &
      Schema.Attribute.Private;
    lockKey: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 36;
      }>;
    product: Schema.Attribute.Relation<'manyToOne', 'api::catalog.product'>;
    publishedAt: Schema.Attribute.DateTime;
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
    sortOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    sourceConsultation: Schema.Attribute.Relation<
      'manyToOne',
      'api::clinical.consultation'
    >;
    sourceLineKey: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 36;
      }>;
    subscription: Schema.Attribute.Relation<
      'manyToOne',
      'api::billing.subscription'
    >;
    taxRate: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          max: 100;
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    taxTreatment: Schema.Attribute.Enumeration<
      ['gravado', 'exento', 'excluido']
    >;
    unit: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 20;
      }>;
    unitCost: Schema.Attribute.Integer &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    unitPrice: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiBillingPlan extends Struct.CollectionTypeSchema {
  collectionName: 'plans';
  info: {
    displayName: 'Plan';
    pluralName: 'plans';
    singularName: 'plan';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    benefits: Schema.Attribute.Relation<
      'oneToMany',
      'api::billing.plan-benefit'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    currency: Schema.Attribute.String & Schema.Attribute.DefaultTo<'COP'>;
    description: Schema.Attribute.Text;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::billing.plan'> &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    priceMonthly: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    priceYearly: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiBillingPlanBenefit extends Struct.CollectionTypeSchema {
  collectionName: 'plan_benefits';
  info: {
    displayName: 'Beneficio del plan';
    pluralName: 'plan-benefits';
    singularName: 'plan-benefit';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    copayAmount: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::billing.plan-benefit'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 120;
      }>;
    plan: Schema.Attribute.Relation<'manyToOne', 'api::billing.plan'>;
    publishedAt: Schema.Attribute.DateTime;
    quantityPerYear: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    service: Schema.Attribute.Relation<'manyToOne', 'api::scheduling.service'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiBillingSubscription extends Struct.CollectionTypeSchema {
  collectionName: 'subscriptions';
  info: {
    displayName: 'Suscripci\u00F3n';
    pluralName: 'subscriptions';
    singularName: 'subscription';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    customer: Schema.Attribute.Relation<'manyToOne', 'api::customer.customer'>;
    endOn: Schema.Attribute.Date & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::billing.subscription'
    > &
      Schema.Attribute.Private;
    paymentMethodToken: Schema.Attribute.String & Schema.Attribute.Private;
    pet: Schema.Attribute.Relation<'manyToOne', 'api::pet.pet'>;
    plan: Schema.Attribute.Relation<'manyToOne', 'api::billing.plan'>;
    publishedAt: Schema.Attribute.DateTime;
    renewalOn: Schema.Attribute.Date;
    searchLabel: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    startOn: Schema.Attribute.Date & Schema.Attribute.Required;
    state: Schema.Attribute.Enumeration<
      ['pending_payment', 'active', 'suspended', 'cancelled', 'expired']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'pending_payment'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    usages: Schema.Attribute.Relation<
      'oneToMany',
      'api::billing.benefit-usage'
    >;
  };
}

export interface ApiCatalogProduct extends Struct.CollectionTypeSchema {
  collectionName: 'products';
  info: {
    description: 'Todo lo vendible que no es un servicio: medicamentos, vacunas, alimentos, juguetes, accesorios, higiene, insumos.';
    displayName: 'Producto';
    pluralName: 'products';
    singularName: 'product';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    barcode: Schema.Attribute.String &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 40;
      }>;
    brand: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    category: Schema.Attribute.Relation<
      'manyToOne',
      'api::catalog.product-category'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    currency: Schema.Attribute.String & Schema.Attribute.DefaultTo<'COP'>;
    description: Schema.Attribute.Text;
    details: Schema.Attribute.DynamicZone<
      [
        'catalog.medication-details',
        'catalog.vaccine-details',
        'catalog.food-details',
        'catalog.accessory-details',
      ]
    >;
    image: Schema.Attribute.Media<'images'>;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::catalog.product'
    > &
      Schema.Attribute.Private;
    minStock: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    preferredSupplier: Schema.Attribute.Relation<
      'manyToOne',
      'api::catalog.supplier'
    >;
    presentation: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 120;
      }>;
    productType: Schema.Attribute.Enumeration<
      [
        'medication',
        'vaccine',
        'food',
        'toy',
        'accessory',
        'hygiene',
        'supply',
        'other',
      ]
    > &
      Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    referenceCost: Schema.Attribute.Integer &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    salePrice: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    saleUnit: Schema.Attribute.Enumeration<
      [
        'unit',
        'box',
        'bottle',
        'vial',
        'bag',
        'tablet',
        'dose',
        'ml',
        'g',
        'kg',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'unit'>;
    searchLabel: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    sku: Schema.Attribute.String &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 40;
      }>;
    targetSpecies: Schema.Attribute.Relation<'manyToMany', 'api::pet.species'>;
    tax: Schema.Attribute.Component<'billing.tax-profile', false>;
    tracksBatches: Schema.Attribute.Boolean;
    tracksInventory: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCatalogProductCategory extends Struct.CollectionTypeSchema {
  collectionName: 'product_categories';
  info: {
    description: 'Clasificaci\u00F3n comercial libre (Antiparasitarios, Concentrados, Juguetes de cuerda\u2026). El comportamiento lo decide el tipo de producto, no la categor\u00EDa.';
    displayName: 'Categor\u00EDa de producto';
    pluralName: 'product-categories';
    singularName: 'product-category';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::catalog.product-category'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    products: Schema.Attribute.Relation<'oneToMany', 'api::catalog.product'>;
    publishedAt: Schema.Attribute.DateTime;
    sortOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCatalogSupplier extends Struct.CollectionTypeSchema {
  collectionName: 'suppliers';
  info: {
    description: 'Laboratorio, distribuidor o comercializadora a quien se le compra.';
    displayName: 'Proveedor';
    pluralName: 'suppliers';
    singularName: 'supplier';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    address: Schema.Attribute.Component<'shared.address', false>;
    contactName: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    documentNumber: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 20;
      }>;
    documentType: Schema.Attribute.Enumeration<['nit', 'cc', 'ce']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'nit'>;
    email: Schema.Attribute.Email;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::catalog.supplier'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    notes: Schema.Attribute.Text;
    paymentTermDays: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    phone: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 20;
      }>;
    products: Schema.Attribute.Relation<'oneToMany', 'api::catalog.product'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    verificationDigit: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 1;
      }>;
  };
}

export interface ApiClinicClinic extends Struct.SingleTypeSchema {
  collectionName: 'clinic';
  info: {
    description: 'Datos de la veterinaria: identidad, obligaciones tributarias y resoluciones de facturaci\u00F3n DIAN.';
    displayName: 'Cl\u00EDnica';
    pluralName: 'clinics';
    singularName: 'clinic';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    billingEmail: Schema.Attribute.Email;
    ciiuCode: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 10;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    defaultCurrency: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'COP'>;
    documentNumber: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 20;
      }>;
    documentType: Schema.Attribute.Enumeration<['nit', 'cc', 'ce']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'nit'>;
    email: Schema.Attribute.Email;
    emergencyPhone: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 20;
      }>;
    fiscalAddress: Schema.Attribute.Component<'shared.address', false>;
    fiscalResponsibilities: Schema.Attribute.Component<
      'billing.fiscal-responsibility',
      true
    >;
    invoiceFooterNotes: Schema.Attribute.Text;
    invoicingEnvironment: Schema.Attribute.Enumeration<
      ['habilitacion', 'produccion']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'habilitacion'>;
    legalName: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::clinic.clinic'
    > &
      Schema.Attribute.Private;
    logo: Schema.Attribute.Media<'images'>;
    merchantRegistration: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 40;
      }>;
    openingHours: Schema.Attribute.Component<'clinic.opening-hours', true>;
    personType: Schema.Attribute.Enumeration<['juridica', 'natural']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'juridica'>;
    phone: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 20;
      }>;
    publishedAt: Schema.Attribute.DateTime;
    resolutions: Schema.Attribute.Component<'billing.dian-resolution', true>;
    slogan: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    taxRegime: Schema.Attribute.Enumeration<
      ['responsable_iva', 'no_responsable_iva', 'regimen_simple']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'responsable_iva'>;
    timezone: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 60;
      }> &
      Schema.Attribute.DefaultTo<'America/Bogota'>;
    tradeName: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    verificationDigit: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 1;
      }>;
    website: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    whatsapp: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 20;
      }>;
  };
}

export interface ApiClinicalAllergy extends Struct.CollectionTypeSchema {
  collectionName: 'allergies';
  info: {
    displayName: 'Alergia';
    pluralName: 'allergies';
    singularName: 'allergy';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    allergen: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    category: Schema.Attribute.Enumeration<
      ['food', 'environmental', 'medication', 'parasite', 'other']
    >;
    consultation: Schema.Attribute.Relation<
      'manyToOne',
      'api::clinical.consultation'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    diagnosedOn: Schema.Attribute.Date;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::clinical.allergy'
    > &
      Schema.Attribute.Private;
    notes: Schema.Attribute.Text;
    pet: Schema.Attribute.Relation<'manyToOne', 'api::pet.pet'>;
    publishedAt: Schema.Attribute.DateTime;
    reaction: Schema.Attribute.Text;
    resolvedOn: Schema.Attribute.Date;
    severity: Schema.Attribute.Enumeration<
      ['low', 'moderate', 'high', 'life_threatening']
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    vet: Schema.Attribute.Relation<'manyToOne', 'admin::user'>;
  };
}

export interface ApiClinicalConsultation extends Struct.CollectionTypeSchema {
  collectionName: 'consultations';
  info: {
    displayName: 'Consulta';
    pluralName: 'consultations';
    singularName: 'consultation';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    appointment: Schema.Attribute.Relation<
      'oneToOne',
      'api::scheduling.appointment'
    >;
    archivedAt: Schema.Attribute.DateTime;
    attachments: Schema.Attribute.Component<'clinical.attachment', true>;
    consultedAt: Schema.Attribute.DateTime;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    lines: Schema.Attribute.DynamicZone<
      ['clinical.service-line', 'clinical.product-line']
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::clinical.consultation'
    > &
      Schema.Attribute.Private;
    nextControlOn: Schema.Attribute.Date;
    pet: Schema.Attribute.Relation<'manyToOne', 'api::pet.pet'>;
    publishedAt: Schema.Attribute.DateTime;
    reason: Schema.Attribute.Text;
    searchLabel: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    sections: Schema.Attribute.DynamicZone<
      [
        'clinical.anamnesis',
        'clinical.physical-exam',
        'clinical.lab-result',
        'clinical.imaging',
        'clinical.diagnosis',
        'clinical.procedure',
        'clinical.treatment-plan',
      ]
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    vet: Schema.Attribute.Relation<'manyToOne', 'admin::user'>;
    weightKg: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
  };
}

export interface ApiClinicalPetVaccination extends Struct.CollectionTypeSchema {
  collectionName: 'pet_vaccinations';
  info: {
    displayName: 'Vacunaci\u00F3n';
    pluralName: 'pet-vaccinations';
    singularName: 'pet-vaccination';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    appliedOn: Schema.Attribute.Date & Schema.Attribute.Required;
    batchExpiresOn: Schema.Attribute.Date;
    batchNumber: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 60;
      }>;
    consultation: Schema.Attribute.Relation<
      'manyToOne',
      'api::clinical.consultation'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    doseNumber: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::clinical.pet-vaccination'
    > &
      Schema.Attribute.Private;
    nextDueOn: Schema.Attribute.Date;
    notes: Schema.Attribute.Text;
    pet: Schema.Attribute.Relation<'manyToOne', 'api::pet.pet'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    vaccine: Schema.Attribute.Relation<'manyToOne', 'api::clinical.vaccine'>;
    vet: Schema.Attribute.Relation<'manyToOne', 'admin::user'>;
  };
}

export interface ApiClinicalVaccine extends Struct.CollectionTypeSchema {
  collectionName: 'vaccines';
  info: {
    displayName: 'Vacuna';
    pluralName: 'vaccines';
    singularName: 'vaccine';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    isMandatory: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::clinical.vaccine'
    > &
      Schema.Attribute.Private;
    manufacturer: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 120;
      }>;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 120;
      }>;
    publishedAt: Schema.Attribute.DateTime;
    species: Schema.Attribute.Relation<'manyToOne', 'api::pet.species'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCustomerCustomer extends Struct.CollectionTypeSchema {
  collectionName: 'customers';
  info: {
    displayName: 'Cliente';
    pluralName: 'customers';
    singularName: 'customer';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    archivedAt: Schema.Attribute.DateTime;
    consents: Schema.Attribute.Component<'customer.consents', false> &
      Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::customer.customer'
    > &
      Schema.Attribute.Private;
    notes: Schema.Attribute.Relation<
      'oneToMany',
      'api::customer.customer-note'
    >;
    pets: Schema.Attribute.Relation<'oneToMany', 'api::pet.pet'>;
    profile: Schema.Attribute.Relation<'oneToOne', 'api::identity.profile'>;
    publishedAt: Schema.Attribute.DateTime;
    referralNotes: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    referralSource: Schema.Attribute.Enumeration<
      ['friend', 'social_media', 'google', 'ad', 'walk_in', 'other']
    >;
    searchLabel: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCustomerCustomerNote extends Struct.CollectionTypeSchema {
  collectionName: 'customer_notes';
  info: {
    displayName: 'Nota de cliente';
    pluralName: 'customer-notes';
    singularName: 'customer-note';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    author: Schema.Attribute.Relation<'manyToOne', 'admin::user'>;
    body: Schema.Attribute.Text & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    customer: Schema.Attribute.Relation<'manyToOne', 'api::customer.customer'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::customer.customer-note'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    rating: Schema.Attribute.Enumeration<['good', 'regular', 'bad']>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiDocumentsSignedDocument
  extends Struct.CollectionTypeSchema {
  collectionName: 'signed_documents';
  info: {
    displayName: 'Documento firmado';
    pluralName: 'signed-documents';
    singularName: 'signed-document';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    archivedAt: Schema.Attribute.DateTime;
    completedAt: Schema.Attribute.DateTime;
    consultation: Schema.Attribute.Relation<
      'manyToOne',
      'api::clinical.consultation'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    customer: Schema.Attribute.Relation<'manyToOne', 'api::customer.customer'>;
    documentRef: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    documentType: Schema.Attribute.Enumeration<
      [
        'consent',
        'contract',
        'authorization',
        'terms_and_conditions',
        'privacy_notice',
        'other',
      ]
    > &
      Schema.Attribute.Required;
    events: Schema.Attribute.Relation<
      'oneToMany',
      'api::documents.signed-document-event'
    >;
    expiresAt: Schema.Attribute.DateTime;
    files: Schema.Attribute.Component<'documents.document-file', true>;
    isSequential: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::documents.signed-document'
    > &
      Schema.Attribute.Private;
    notes: Schema.Attribute.Text;
    pet: Schema.Attribute.Relation<'manyToOne', 'api::pet.pet'>;
    publishedAt: Schema.Attribute.DateTime;
    replacedBy: Schema.Attribute.Relation<
      'oneToOne',
      'api::documents.signed-document'
    >;
    replaces: Schema.Attribute.Relation<
      'oneToOne',
      'api::documents.signed-document'
    >;
    signers: Schema.Attribute.Relation<
      'oneToMany',
      'api::documents.signed-document-signer'
    >;
    state: Schema.Attribute.Enumeration<
      [
        'draft',
        'pending_signature',
        'partially_signed',
        'signed',
        'voided',
        'expired',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'pending_signature'>;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    version: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      > &
      Schema.Attribute.DefaultTo<1>;
    voidedAt: Schema.Attribute.DateTime;
    voidReason: Schema.Attribute.Text;
  };
}

export interface ApiDocumentsSignedDocumentEvent
  extends Struct.CollectionTypeSchema {
  collectionName: 'signed_document_events';
  info: {
    displayName: 'Evento de documento firmado';
    pluralName: 'signed-document-events';
    singularName: 'signed-document-event';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    eventAt: Schema.Attribute.DateTime & Schema.Attribute.Required;
    eventType: Schema.Attribute.Enumeration<
      [
        'created',
        'sent',
        'viewed',
        'signed',
        'declined',
        'voided',
        'file_added',
      ]
    > &
      Schema.Attribute.Required;
    ip: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::documents.signed-document-event'
    > &
      Schema.Attribute.Private;
    metadata: Schema.Attribute.JSON;
    performedBy: Schema.Attribute.Relation<
      'manyToOne',
      'api::identity.profile'
    >;
    publishedAt: Schema.Attribute.DateTime;
    signedDocument: Schema.Attribute.Relation<
      'manyToOne',
      'api::documents.signed-document'
    >;
    signer: Schema.Attribute.Relation<
      'manyToOne',
      'api::documents.signed-document-signer'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    userAgent: Schema.Attribute.String;
  };
}

export interface ApiDocumentsSignedDocumentSigner
  extends Struct.CollectionTypeSchema {
  collectionName: 'signed_document_signers';
  info: {
    displayName: 'Firmante de documento';
    pluralName: 'signed-document-signers';
    singularName: 'signed-document-signer';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    evidence: Schema.Attribute.Media<'images' | 'files'>;
    evidenceHash: Schema.Attribute.String;
    isRequired: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::documents.signed-document-signer'
    > &
      Schema.Attribute.Private;
    notes: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    signatureMethod: Schema.Attribute.Enumeration<
      ['drawn', 'typed', 'click_to_sign', 'uploaded_scan', 'in_person_wet']
    >;
    signedAt: Schema.Attribute.DateTime;
    signedDocument: Schema.Attribute.Relation<
      'manyToOne',
      'api::documents.signed-document'
    >;
    signer: Schema.Attribute.Relation<'manyToOne', 'api::identity.profile'>;
    signerDocumentSnapshot: Schema.Attribute.String;
    signerIp: Schema.Attribute.String;
    signerNameSnapshot: Schema.Attribute.String;
    signerRoleSnapshot: Schema.Attribute.String;
    signerUserAgent: Schema.Attribute.String;
    signOrder: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    state: Schema.Attribute.Enumeration<
      ['pending', 'viewed', 'signed', 'declined', 'expired', 'reassigned']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'pending'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiIdentityProfile extends Struct.CollectionTypeSchema {
  collectionName: 'profiles';
  info: {
    displayName: 'Perfil';
    pluralName: 'profiles';
    singularName: 'profile';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    addresses: Schema.Attribute.Component<'shared.address', true>;
    adminUser: Schema.Attribute.Relation<'oneToOne', 'admin::user'>;
    archivedAt: Schema.Attribute.DateTime;
    birthDate: Schema.Attribute.Date;
    contacts: Schema.Attribute.Relation<'oneToMany', 'api::shared.contact'>;
    country: Schema.Attribute.Relation<'manyToOne', 'api::shared.country'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    customer: Schema.Attribute.Relation<'oneToOne', 'api::customer.customer'>;
    documentNumber: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 30;
      }>;
    documentType: Schema.Attribute.Enumeration<
      ['cc', 'ce', 'ti', 'passport', 'nit', 'ppt']
    > &
      Schema.Attribute.Required;
    firstName: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    gender: Schema.Attribute.Enumeration<['male', 'female', 'other']>;
    lastName: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::identity.profile'
    > &
      Schema.Attribute.Private;
    occupation: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    photo: Schema.Attribute.Media<'images'>;
    publishedAt: Schema.Attribute.DateTime;
    searchLabel: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    user: Schema.Attribute.Relation<
      'oneToOne',
      'plugin::users-permissions.user'
    >;
  };
}

export interface ApiMarketingCampaign extends Struct.CollectionTypeSchema {
  collectionName: 'campaigns';
  info: {
    displayName: 'Campa\u00F1a';
    pluralName: 'campaigns';
    singularName: 'campaign';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::marketing.campaign'
    > &
      Schema.Attribute.Private;
    metrics: Schema.Attribute.Relation<
      'oneToMany',
      'api::marketing.campaign-metric'
    >;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    publishedAt: Schema.Attribute.DateTime;
    segment: Schema.Attribute.DynamicZone<
      [
        'marketing.rule-species',
        'marketing.rule-last-visit',
        'marketing.rule-subscription',
        'marketing.rule-vaccination-due',
        'marketing.rule-city',
        'marketing.rule-referral',
      ]
    >;
    state: Schema.Attribute.Enumeration<
      ['draft', 'scheduled', 'running', 'finished', 'cancelled']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'draft'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiMarketingCampaignMetric
  extends Struct.CollectionTypeSchema {
  collectionName: 'campaign_metrics';
  info: {
    displayName: 'M\u00E9trica de campa\u00F1a';
    pluralName: 'campaign-metrics';
    singularName: 'campaign-metric';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    attributedSales: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    campaign: Schema.Attribute.Relation<'manyToOne', 'api::marketing.campaign'>;
    clicks: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    conversions: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    emailsSent: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::marketing.campaign-metric'
    > &
      Schema.Attribute.Private;
    opens: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    publishedAt: Schema.Attribute.DateTime;
    searchLabel: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiNotificationNotification
  extends Struct.CollectionTypeSchema {
  collectionName: 'notifications';
  info: {
    displayName: 'Notificaci\u00F3n';
    pluralName: 'notifications';
    singularName: 'notification';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    body: Schema.Attribute.Text & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    dedupeKey: Schema.Attribute.String & Schema.Attribute.Unique;
    eventType: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::notification.notification'
    > &
      Schema.Attribute.Private;
    payload: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    recipients: Schema.Attribute.Relation<
      'oneToMany',
      'api::notification.notification-recipient'
    >;
    subjectDocumentId: Schema.Attribute.String;
    subjectType: Schema.Attribute.Enumeration<
      ['appointment', 'vaccination', 'invoice', 'subscription']
    >;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiNotificationNotificationDelivery
  extends Struct.CollectionTypeSchema {
  collectionName: 'notification_deliveries';
  info: {
    displayName: 'Env\u00EDo de notificaci\u00F3n';
    pluralName: 'notification-deliveries';
    singularName: 'notification-delivery';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
  };
  attributes: {
    attemptCount: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    channel: Schema.Attribute.Enumeration<
      ['in_app', 'email', 'sms', 'push', 'whatsapp']
    > &
      Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    idempotencyKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    lastErrorAt: Schema.Attribute.DateTime;
    lastErrorCode: Schema.Attribute.String;
    lastErrorMessage: Schema.Attribute.Text;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::notification.notification-delivery'
    > &
      Schema.Attribute.Private;
    lockedAt: Schema.Attribute.DateTime & Schema.Attribute.Private;
    lockedBy: Schema.Attribute.String & Schema.Attribute.Private;
    lockExpiresAt: Schema.Attribute.DateTime & Schema.Attribute.Private;
    maxAttempts: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      > &
      Schema.Attribute.DefaultTo<8>;
    nextAttemptAt: Schema.Attribute.DateTime & Schema.Attribute.Required;
    providerMessageId: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    recipient: Schema.Attribute.Relation<
      'manyToOne',
      'api::notification.notification-recipient'
    >;
    scheduledAt: Schema.Attribute.DateTime & Schema.Attribute.Required;
    sentAt: Schema.Attribute.DateTime;
    state: Schema.Attribute.Enumeration<
      [
        'pending',
        'processing',
        'sent',
        'failed_retry',
        'failed_final',
        'cancelled',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'pending'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiNotificationNotificationRecipient
  extends Struct.CollectionTypeSchema {
  collectionName: 'notification_recipients';
  info: {
    displayName: 'Destinatario de notificaci\u00F3n';
    pluralName: 'notification-recipients';
    singularName: 'notification-recipient';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    archivedAt: Schema.Attribute.DateTime;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    deliveries: Schema.Attribute.Relation<
      'oneToMany',
      'api::notification.notification-delivery'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::notification.notification-recipient'
    > &
      Schema.Attribute.Private;
    notification: Schema.Attribute.Relation<
      'manyToOne',
      'api::notification.notification'
    >;
    publishedAt: Schema.Attribute.DateTime;
    readAt: Schema.Attribute.DateTime;
    recipient: Schema.Attribute.Relation<'manyToOne', 'api::identity.profile'>;
    searchLabel: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiPetBreed extends Struct.CollectionTypeSchema {
  collectionName: 'breeds';
  info: {
    displayName: 'Raza';
    pluralName: 'breeds';
    singularName: 'breed';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::pet.breed'> &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 80;
      }>;
    publishedAt: Schema.Attribute.DateTime;
    searchLabel: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    species: Schema.Attribute.Relation<'manyToOne', 'api::pet.species'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiPetPet extends Struct.CollectionTypeSchema {
  collectionName: 'pets';
  info: {
    displayName: 'Mascota';
    pluralName: 'pets';
    singularName: 'pet';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    allergies: Schema.Attribute.Relation<'oneToMany', 'api::clinical.allergy'>;
    archivedAt: Schema.Attribute.DateTime;
    birthDate: Schema.Attribute.Date;
    breed: Schema.Attribute.Relation<'manyToOne', 'api::pet.breed'>;
    color: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 60;
      }>;
    consultations: Schema.Attribute.Relation<
      'oneToMany',
      'api::clinical.consultation'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::pet.pet'> &
      Schema.Attribute.Private;
    microchip: Schema.Attribute.String &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 20;
      }>;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 80;
      }>;
    owner: Schema.Attribute.Relation<'manyToOne', 'api::customer.customer'>;
    photos: Schema.Attribute.Media<'images', true>;
    publishedAt: Schema.Attribute.DateTime;
    searchLabel: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    sex: Schema.Attribute.Enumeration<['male', 'female', 'unknown']> &
      Schema.Attribute.DefaultTo<'unknown'>;
    species: Schema.Attribute.Relation<'manyToOne', 'api::pet.species'>;
    sterilizationState: Schema.Attribute.Enumeration<
      ['intact', 'sterilized', 'unknown']
    > &
      Schema.Attribute.DefaultTo<'unknown'>;
    sterilizedOn: Schema.Attribute.Date;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    vaccinations: Schema.Attribute.Relation<
      'oneToMany',
      'api::clinical.pet-vaccination'
    >;
    weightKg: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
  };
}

export interface ApiPetSpecies extends Struct.CollectionTypeSchema {
  collectionName: 'species';
  info: {
    displayName: 'Especie';
    pluralName: 'species-list';
    singularName: 'species';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    breeds: Schema.Attribute.Relation<'oneToMany', 'api::pet.breed'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::pet.species'> &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 60;
      }>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSchedulingAppointment extends Struct.CollectionTypeSchema {
  collectionName: 'appointments';
  info: {
    displayName: 'Cita';
    pluralName: 'appointments';
    singularName: 'appointment';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    arrivedAt: Schema.Attribute.DateTime;
    bookedBy: Schema.Attribute.Relation<'manyToOne', 'api::identity.profile'>;
    cancelledAt: Schema.Attribute.DateTime;
    cancelNotes: Schema.Attribute.Text;
    cancelReason: Schema.Attribute.Enumeration<
      ['client_cancelled', 'clinic_cancelled', 'other']
    >;
    completedAt: Schema.Attribute.DateTime;
    consultation: Schema.Attribute.Relation<
      'oneToOne',
      'api::clinical.consultation'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    endAt: Schema.Attribute.DateTime & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::scheduling.appointment'
    > &
      Schema.Attribute.Private;
    notes: Schema.Attribute.Text;
    pet: Schema.Attribute.Relation<'manyToOne', 'api::pet.pet'>;
    publishedAt: Schema.Attribute.DateTime;
    responsible: Schema.Attribute.Relation<'manyToOne', 'admin::user'>;
    room: Schema.Attribute.Relation<'manyToOne', 'api::scheduling.clinic-room'>;
    services: Schema.Attribute.Component<
      'scheduling.appointment-service',
      true
    >;
    source: Schema.Attribute.Enumeration<
      ['front_desk', 'online', 'phone', 'whatsapp', 'internal']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'front_desk'>;
    startAt: Schema.Attribute.DateTime & Schema.Attribute.Required;
    state: Schema.Attribute.Enumeration<
      [
        'draft',
        'scheduled',
        'confirmed',
        'arrived',
        'in_progress',
        'completed',
        'cancelled',
        'no_show',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'scheduled'>;
    title: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSchedulingClinicRoom extends Struct.CollectionTypeSchema {
  collectionName: 'clinic_rooms';
  info: {
    displayName: 'Consultorio';
    pluralName: 'clinic-rooms';
    singularName: 'clinic-room';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::scheduling.clinic-room'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 80;
      }>;
    publishedAt: Schema.Attribute.DateTime;
    roomType: Schema.Attribute.Enumeration<
      ['consultation', 'surgery', 'grooming', 'imaging', 'lab', 'other']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'consultation'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSchedulingScheduleException
  extends Struct.CollectionTypeSchema {
  collectionName: 'schedule_exceptions';
  info: {
    description: 'Rompe el horario semanal en unas fechas concretas: una ausencia que quita disponibilidad, o un turno extra que la a\u00F1ade.';
    displayName: 'Excepci\u00F3n de horario';
    pluralName: 'schedule-exceptions';
    singularName: 'schedule-exception';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    exceptionKind: Schema.Attribute.Enumeration<['absence', 'extra_shift']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'absence'>;
    fromDate: Schema.Attribute.Date & Schema.Attribute.Required;
    fromTime: Schema.Attribute.Time;
    isAllDay: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::scheduling.schedule-exception'
    > &
      Schema.Attribute.Private;
    notes: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    reason: Schema.Attribute.Enumeration<
      ['vacation', 'sick_leave', 'training', 'holiday', 'personal', 'other']
    >;
    room: Schema.Attribute.Relation<'manyToOne', 'api::scheduling.clinic-room'>;
    searchLabel: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    staff: Schema.Attribute.Relation<'manyToOne', 'admin::user'>;
    toDate: Schema.Attribute.Date & Schema.Attribute.Required;
    toTime: Schema.Attribute.Time;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSchedulingService extends Struct.CollectionTypeSchema {
  collectionName: 'services';
  info: {
    displayName: 'Servicio';
    pluralName: 'services';
    singularName: 'service';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    basePrice: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    category: Schema.Attribute.Relation<
      'manyToOne',
      'api::scheduling.service-category'
    >;
    colorHex: Schema.Attribute.String &
      Schema.Attribute.CustomField<'plugin::color-picker.color'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    currency: Schema.Attribute.String & Schema.Attribute.DefaultTo<'COP'>;
    defaultDurationMinutes: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 5;
        },
        number
      > &
      Schema.Attribute.DefaultTo<30>;
    description: Schema.Attribute.Text;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::scheduling.service'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 120;
      }>;
    publishedAt: Schema.Attribute.DateTime;
    tax: Schema.Attribute.Component<'billing.tax-profile', false>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSchedulingServiceCategory
  extends Struct.CollectionTypeSchema {
  collectionName: 'service_categories';
  info: {
    displayName: 'Categor\u00EDa de servicio';
    pluralName: 'service-categories';
    singularName: 'service-category';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::scheduling.service-category'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    publishedAt: Schema.Attribute.DateTime;
    services: Schema.Attribute.Relation<'oneToMany', 'api::scheduling.service'>;
    sortOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSchedulingStaffSchedule
  extends Struct.CollectionTypeSchema {
  collectionName: 'staff_schedules';
  info: {
    description: 'Horario semanal de un profesional: qu\u00E9 d\u00EDas atiende, en qu\u00E9 franjas, en qu\u00E9 consultorio y cu\u00E1ntos minutos por paciente.';
    displayName: 'Horario de atenci\u00F3n';
    pluralName: 'staff-schedules';
    singularName: 'staff-schedule';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    isActive: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::scheduling.staff-schedule'
    > &
      Schema.Attribute.Private;
    notes: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    room: Schema.Attribute.Relation<'manyToOne', 'api::scheduling.clinic-room'>;
    searchLabel: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    shifts: Schema.Attribute.Component<'scheduling.work-shift', true>;
    slotMinutes: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          max: 480;
          min: 5;
        },
        number
      > &
      Schema.Attribute.DefaultTo<30>;
    staff: Schema.Attribute.Relation<'manyToOne', 'admin::user'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    validFrom: Schema.Attribute.Date & Schema.Attribute.Required;
    validUntil: Schema.Attribute.Date;
  };
}

export interface ApiSharedContact extends Struct.CollectionTypeSchema {
  collectionName: 'contacts';
  info: {
    displayName: 'Contacto';
    pluralName: 'contacts';
    singularName: 'contact';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    contactType: Schema.Attribute.Enumeration<
      ['email', 'email_work', 'phone', 'phone_emergency', 'phone_whatsapp']
    > &
      Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    isPrimary: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::shared.contact'
    > &
      Schema.Attribute.Private;
    metadata: Schema.Attribute.JSON;
    notes: Schema.Attribute.Text;
    profile: Schema.Attribute.Relation<'manyToOne', 'api::identity.profile'>;
    publishedAt: Schema.Attribute.DateTime;
    searchLabel: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    value: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    verifiedAt: Schema.Attribute.DateTime;
  };
}

export interface ApiSharedCountry extends Struct.CollectionTypeSchema {
  collectionName: 'countries';
  info: {
    displayName: 'Pa\u00EDs';
    pluralName: 'countries';
    singularName: 'country';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    dialCode: Schema.Attribute.String;
    flag: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 16;
      }>;
    isoCode: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::shared.country'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSharedVerificationCode extends Struct.CollectionTypeSchema {
  collectionName: 'verification_codes';
  info: {
    displayName: 'C\u00F3digo de verificaci\u00F3n';
    pluralName: 'verification-codes';
    singularName: 'verification-code';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
  };
  attributes: {
    codeHash: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
    contact: Schema.Attribute.Relation<'manyToOne', 'api::shared.contact'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    expiresAt: Schema.Attribute.DateTime & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::shared.verification-code'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    purpose: Schema.Attribute.Enumeration<
      ['email_verification', 'phone_verification']
    > &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    usedAt: Schema.Attribute.DateTime;
  };
}

export interface ApiTravelTravelCase extends Struct.CollectionTypeSchema {
  collectionName: 'travel_cases';
  info: {
    displayName: 'Tr\u00E1mite de viaje';
    pluralName: 'travel-cases';
    singularName: 'travel-case';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    airline: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    destinationCountry: Schema.Attribute.Relation<
      'manyToOne',
      'api::shared.country'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::travel.travel-case'
    > &
      Schema.Attribute.Private;
    pet: Schema.Attribute.Relation<'manyToOne', 'api::pet.pet'>;
    publishedAt: Schema.Attribute.DateTime;
    requirements: Schema.Attribute.DynamicZone<
      [
        'travel.health-certificate',
        'travel.rabies-titer',
        'travel.microchip-check',
        'travel.antiparasitic',
        'travel.import-permit',
        'travel.crate',
        'travel.other-requirement',
      ]
    >;
    state: Schema.Attribute.Enumeration<
      [
        'initiated',
        'docs_collected',
        'vet_check_passed',
        'ready_to_fly',
        'completed',
        'cancelled',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'initiated'>;
    travelOn: Schema.Attribute.Date & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginContentReleasesRelease
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_releases';
  info: {
    displayName: 'Release';
    pluralName: 'releases';
    singularName: 'release';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    actions: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release-action'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    releasedAt: Schema.Attribute.DateTime;
    scheduledAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<
      ['ready', 'blocked', 'failed', 'done', 'empty']
    > &
      Schema.Attribute.Required;
    timezone: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginContentReleasesReleaseAction
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_release_actions';
  info: {
    displayName: 'Release Action';
    pluralName: 'release-actions';
    singularName: 'release-action';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    contentType: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    entryDocumentId: Schema.Attribute.String;
    isEntryValid: Schema.Attribute.Boolean;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release-action'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    release: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::content-releases.release'
    >;
    type: Schema.Attribute.Enumeration<['publish', 'unpublish']> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginI18NLocale extends Struct.CollectionTypeSchema {
  collectionName: 'i18n_locale';
  info: {
    collectionName: 'locales';
    description: '';
    displayName: 'Locale';
    pluralName: 'locales';
    singularName: 'locale';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    code: Schema.Attribute.String & Schema.Attribute.Unique;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::i18n.locale'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.SetMinMax<
        {
          max: 50;
          min: 1;
        },
        number
      >;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginReviewWorkflowsWorkflow
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_workflows';
  info: {
    description: '';
    displayName: 'Workflow';
    name: 'Workflow';
    pluralName: 'workflows';
    singularName: 'workflow';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    contentTypes: Schema.Attribute.JSON &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'[]'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    publishedAt: Schema.Attribute.DateTime;
    stageRequiredToPublish: Schema.Attribute.Relation<
      'oneToOne',
      'plugin::review-workflows.workflow-stage'
    >;
    stages: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow-stage'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginReviewWorkflowsWorkflowStage
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_workflows_stages';
  info: {
    description: '';
    displayName: 'Stages';
    name: 'Workflow Stage';
    pluralName: 'workflow-stages';
    singularName: 'workflow-stage';
  };
  options: {
    draftAndPublish: false;
    version: '1.1.0';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    color: Schema.Attribute.String & Schema.Attribute.DefaultTo<'#4945FF'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow-stage'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    permissions: Schema.Attribute.Relation<'manyToMany', 'admin::permission'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workflow: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::review-workflows.workflow'
    >;
  };
}

export interface PluginUploadFile extends Struct.CollectionTypeSchema {
  collectionName: 'files';
  info: {
    description: '';
    displayName: 'File';
    pluralName: 'files';
    singularName: 'file';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    alternativeText: Schema.Attribute.Text;
    caption: Schema.Attribute.Text;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    ext: Schema.Attribute.String;
    focalPoint: Schema.Attribute.JSON;
    folder: Schema.Attribute.Relation<'manyToOne', 'plugin::upload.folder'> &
      Schema.Attribute.Private;
    folderPath: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    formats: Schema.Attribute.JSON;
    hash: Schema.Attribute.String & Schema.Attribute.Required;
    height: Schema.Attribute.Integer;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::upload.file'
    > &
      Schema.Attribute.Private;
    mime: Schema.Attribute.String & Schema.Attribute.Required;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    previewUrl: Schema.Attribute.Text;
    provider: Schema.Attribute.String & Schema.Attribute.Required;
    provider_metadata: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    related: Schema.Attribute.Relation<'morphToMany'>;
    size: Schema.Attribute.Decimal & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    url: Schema.Attribute.Text & Schema.Attribute.Required;
    width: Schema.Attribute.Integer;
  };
}

export interface PluginUploadFolder extends Struct.CollectionTypeSchema {
  collectionName: 'upload_folders';
  info: {
    displayName: 'Folder';
    pluralName: 'folders';
    singularName: 'folder';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    children: Schema.Attribute.Relation<'oneToMany', 'plugin::upload.folder'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    files: Schema.Attribute.Relation<'oneToMany', 'plugin::upload.file'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::upload.folder'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    parent: Schema.Attribute.Relation<'manyToOne', 'plugin::upload.folder'>;
    path: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    pathId: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginUsersPermissionsPermission
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_permissions';
  info: {
    description: '';
    displayName: 'Permission';
    name: 'permission';
    pluralName: 'permissions';
    singularName: 'permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginUsersPermissionsRole
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_roles';
  info: {
    description: '';
    displayName: 'Role';
    name: 'role';
    pluralName: 'roles';
    singularName: 'role';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.role'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    type: Schema.Attribute.String & Schema.Attribute.Unique;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    users: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.user'
    >;
  };
}

export interface PluginUsersPermissionsUser
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_users';
  info: {
    description: '';
    displayName: 'Usuario';
    name: 'user';
    pluralName: 'users';
    singularName: 'user';
  };
  options: {
    draftAndPublish: false;
    timestamps: true;
  };
  attributes: {
    blocked: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    confirmationToken: Schema.Attribute.String & Schema.Attribute.Private;
    confirmed: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.Email &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.user'
    > &
      Schema.Attribute.Private;
    password: Schema.Attribute.Password &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    profile: Schema.Attribute.Relation<'oneToOne', 'api::identity.profile'>;
    provider: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    resetPasswordToken: Schema.Attribute.String & Schema.Attribute.Private;
    role: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    username: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
  };
}

declare module '@strapi/strapi' {
  export namespace Public {
    export interface ContentTypeSchemas {
      'admin::api-token': AdminApiToken;
      'admin::api-token-permission': AdminApiTokenPermission;
      'admin::permission': AdminPermission;
      'admin::role': AdminRole;
      'admin::session': AdminSession;
      'admin::transfer-token': AdminTransferToken;
      'admin::transfer-token-permission': AdminTransferTokenPermission;
      'admin::user': AdminUser;
      'api::billing.benefit-usage': ApiBillingBenefitUsage;
      'api::billing.invoice': ApiBillingInvoice;
      'api::billing.invoice-item': ApiBillingInvoiceItem;
      'api::billing.plan': ApiBillingPlan;
      'api::billing.plan-benefit': ApiBillingPlanBenefit;
      'api::billing.subscription': ApiBillingSubscription;
      'api::catalog.product': ApiCatalogProduct;
      'api::catalog.product-category': ApiCatalogProductCategory;
      'api::catalog.supplier': ApiCatalogSupplier;
      'api::clinic.clinic': ApiClinicClinic;
      'api::clinical.allergy': ApiClinicalAllergy;
      'api::clinical.consultation': ApiClinicalConsultation;
      'api::clinical.pet-vaccination': ApiClinicalPetVaccination;
      'api::clinical.vaccine': ApiClinicalVaccine;
      'api::customer.customer': ApiCustomerCustomer;
      'api::customer.customer-note': ApiCustomerCustomerNote;
      'api::documents.signed-document': ApiDocumentsSignedDocument;
      'api::documents.signed-document-event': ApiDocumentsSignedDocumentEvent;
      'api::documents.signed-document-signer': ApiDocumentsSignedDocumentSigner;
      'api::identity.profile': ApiIdentityProfile;
      'api::marketing.campaign': ApiMarketingCampaign;
      'api::marketing.campaign-metric': ApiMarketingCampaignMetric;
      'api::notification.notification': ApiNotificationNotification;
      'api::notification.notification-delivery': ApiNotificationNotificationDelivery;
      'api::notification.notification-recipient': ApiNotificationNotificationRecipient;
      'api::pet.breed': ApiPetBreed;
      'api::pet.pet': ApiPetPet;
      'api::pet.species': ApiPetSpecies;
      'api::scheduling.appointment': ApiSchedulingAppointment;
      'api::scheduling.clinic-room': ApiSchedulingClinicRoom;
      'api::scheduling.schedule-exception': ApiSchedulingScheduleException;
      'api::scheduling.service': ApiSchedulingService;
      'api::scheduling.service-category': ApiSchedulingServiceCategory;
      'api::scheduling.staff-schedule': ApiSchedulingStaffSchedule;
      'api::shared.contact': ApiSharedContact;
      'api::shared.country': ApiSharedCountry;
      'api::shared.verification-code': ApiSharedVerificationCode;
      'api::travel.travel-case': ApiTravelTravelCase;
      'plugin::content-releases.release': PluginContentReleasesRelease;
      'plugin::content-releases.release-action': PluginContentReleasesReleaseAction;
      'plugin::i18n.locale': PluginI18NLocale;
      'plugin::review-workflows.workflow': PluginReviewWorkflowsWorkflow;
      'plugin::review-workflows.workflow-stage': PluginReviewWorkflowsWorkflowStage;
      'plugin::upload.file': PluginUploadFile;
      'plugin::upload.folder': PluginUploadFolder;
      'plugin::users-permissions.permission': PluginUsersPermissionsPermission;
      'plugin::users-permissions.role': PluginUsersPermissionsRole;
      'plugin::users-permissions.user': PluginUsersPermissionsUser;
    }
  }
}
