import type { Core } from '@strapi/strapi';

import actor from './actor';
import archived from './archived';
import billing from './billing';
import clinic from './clinic';
import clinical from './clinical';
import customer from './customer';
import documents from './documents';
import identity from './identity';
import labels from './labels';
import notification from './notification';
import ownership from './ownership';
import pet from './pet';
import requiredRelations from './required-relations';
import scheduling from './scheduling';
import shared from './shared';
import staffSchedule from './staff-schedule';
import travel from './travel';

/**
 * Reglas de negocio de la sección 8 del modelo.
 *
 * Viven en middlewares del Document Service porque en Strapi 5 las relaciones
 * están en tablas de enlace (`*_lnk`): cualquier regla que combine una relación
 * con otro campo no se puede expresar como restricción de base de datos.
 *
 * El orden importa: el filtro de archivados se registra primero para que las
 * lecturas que hagan las demás reglas no vean documentos archivados. `actor`
 * va antes que las relaciones obligatorias porque es quien rellena `author`.
 */
export default (strapi: Core.Strapi): void => {
  archived(strapi);
  ownership(strapi);
  labels(strapi);
  actor(strapi);
  requiredRelations(strapi);

  shared(strapi);
  identity(strapi);
  customer(strapi);
  pet(strapi);
  clinical(strapi);
  clinic(strapi);
  scheduling(strapi);
  staffSchedule(strapi);
  billing(strapi);
  travel(strapi);
  documents(strapi);
  notification(strapi);
};
