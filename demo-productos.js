'use strict';

/**
 * Catálogo de productos de muestra: un proveedor, categorías y al menos un
 * producto de cada tipo con datos propios (medicamento, vacuna, alimento,
 * juguete, accesorio) más uno de higiene, que no lleva bloque de datos.
 *
 * Lo usa `demo-clinica.js`, que carga estos productos en las consultas de
 * Kira (vacunas aplicadas, medicamentos entregados, alimento recomendado).
 * No se ejecuta suelto.
 *
 * OJO con los impuestos: el tratamiento de IVA de cada producto es un
 * ejemplo verosímil, no una asesoría tributaria. Antes de facturar, el
 * contador de la clínica debe confirmar cada uno (medicamentos y vacunas
 * veterinarias suelen ser excluidos; alimentos y accesorios, gravados).
 * Los registros ICA son ficticios.
 */

const { digitoVerificacion } = require('./demo-clinic');

const NIT_PROVEEDOR = '900456789';

const PROVEEDOR = {
  name: 'Distribuciones Veterinarias del Valle S.A.S.',
  documentType: 'nit',
  documentNumber: NIT_PROVEEDOR,
  // Calculado, no escrito: la validación del módulo 11 rechazaría uno errado.
  verificationDigit: String(digitoVerificacion(NIT_PROVEEDOR)),
  contactName: 'Andrés Cifuentes',
  phone: '+576023334455',
  email: 'pedidos@distrivetvalle.test',
  paymentTermDays: 30,
  isActive: true,
};

const CATEGORIAS = [
  { name: 'Biológicos', sortOrder: 10 },
  { name: 'Antiinflamatorios y analgésicos', sortOrder: 20 },
  { name: 'Suplementos', sortOrder: 30 },
  { name: 'Concentrados', sortOrder: 40 },
  { name: 'Accesorios', sortOrder: 50 },
  { name: 'Juguetes', sortOrder: 60 },
  { name: 'Higiene', sortOrder: 70 },
];

const EXCLUIDO = { ivaTreatment: 'excluido' };
const GRAVADO_19 = { ivaTreatment: 'gravado', ivaRate: 19 };

const registroICA = (numero) => ({ authority: 'ica', number: numero, holder: 'Titular de ejemplo' });

/** `vacuna` es el nombre de la vacuna clínica (demo-clinica.js, VACUNAS). */
const PRODUCTOS = [
  {
    name: 'Nobivac Rabies',
    productType: 'vaccine',
    categoria: 'Biológicos',
    brand: 'MSD Animal Health',
    presentation: 'Vial x 1 dosis',
    saleUnit: 'dose',
    salePrice: 38000,
    referenceCost: 21000,
    tax: EXCLUIDO,
    vacuna: 'Rabia',
    details: { __component: 'catalog.vaccine-details', registration: registroICA('ICA 0000-BV-DEMO1'), laboratory: 'MSD Animal Health', dosesPerUnit: 1, route: 'sc', storage: 'refrigerated' },
  },
  {
    name: 'Vanguard Plus 5 L4',
    productType: 'vaccine',
    categoria: 'Biológicos',
    brand: 'Zoetis',
    presentation: 'Vial x 1 dosis',
    saleUnit: 'dose',
    salePrice: 52000,
    referenceCost: 30000,
    tax: EXCLUIDO,
    vacuna: 'Polivalente DHPPi+L',
    details: { __component: 'catalog.vaccine-details', registration: registroICA('ICA 0000-BV-DEMO2'), laboratory: 'Zoetis', dosesPerUnit: 1, route: 'sc', storage: 'refrigerated' },
  },
  {
    name: 'Meloxicam suspensión oral',
    productType: 'medication',
    categoria: 'Antiinflamatorios y analgésicos',
    brand: 'Laboratorio de ejemplo',
    presentation: 'Frasco x 10 ml, 1,5 mg/ml',
    saleUnit: 'bottle',
    salePrice: 42000,
    referenceCost: 24000,
    tax: EXCLUIDO,
    details: {
      __component: 'catalog.medication-details',
      registration: registroICA('ICA 0000-MV-DEMO3'),
      activeIngredients: [{ name: 'Meloxicam', strength: 1.5, strengthUnit: 'mg_ml' }],
      pharmaceuticalForm: 'oral_suspension',
      route: 'oral',
      laboratory: 'Laboratorio de ejemplo',
      atcVetCode: 'QM01AC06',
      requiresPrescription: true,
      isControlled: false,
      storage: 'ambient',
    },
  },
  {
    name: 'Omega 3 para perros',
    productType: 'food',
    categoria: 'Suplementos',
    brand: 'Marca de ejemplo',
    presentation: 'Frasco x 30 cápsulas',
    saleUnit: 'bottle',
    salePrice: 58000,
    referenceCost: 33000,
    tax: GRAVADO_19,
    details: { __component: 'catalog.food-details', registration: registroICA('ICA 0000-AL-DEMO4'), foodType: 'supplement', lifeStage: 'all_stages', netWeightGrams: 45 },
  },
  {
    name: 'Alimento seco adulto raza grande',
    productType: 'food',
    categoria: 'Concentrados',
    brand: 'Marca de ejemplo',
    presentation: 'Bulto x 15 kg',
    saleUnit: 'bag',
    salePrice: 265000,
    referenceCost: 190000,
    tax: GRAVADO_19,
    details: { __component: 'catalog.food-details', registration: registroICA('ICA 0000-AL-DEMO5'), foodType: 'dry', lifeStage: 'adult', netWeightGrams: 15000 },
  },
  {
    name: 'Collar isabelino',
    productType: 'accessory',
    categoria: 'Accesorios',
    presentation: 'Talla L',
    saleUnit: 'unit',
    salePrice: 28000,
    referenceCost: 12000,
    tax: GRAVADO_19,
    details: { __component: 'catalog.accessory-details', material: 'Plástico flexible', size: 'l', color: 'Transparente' },
  },
  {
    name: 'Pelota de caucho macizo',
    productType: 'toy',
    categoria: 'Juguetes',
    presentation: '7 cm',
    saleUnit: 'unit',
    salePrice: 24000,
    referenceCost: 10000,
    tax: GRAVADO_19,
    // Después del cuerpo extraño de 2025: un juguete que no se desmenuza.
    details: { __component: 'catalog.accessory-details', material: 'Caucho natural macizo', size: 'l', color: 'Rojo' },
  },
  {
    name: 'Champú hidratante',
    productType: 'hygiene',
    categoria: 'Higiene',
    brand: 'Marca de ejemplo',
    presentation: 'Frasco x 250 ml',
    saleUnit: 'bottle',
    salePrice: 36000,
    referenceCost: 18000,
    tax: GRAVADO_19,
  },
];

async function asegurar(d, uid, filtros, datos) {
  const encontrado = await d(uid).findFirst({ filters: filtros });
  if (encontrado) return encontrado;
  return d(uid).create({ data: datos });
}

/** Crea proveedor, categorías y productos si faltan. Devuelve { nombre: producto }. */
async function crearCatalogo(app) {
  const d = (uid) => app.documents(uid);

  const proveedor = await asegurar(
    d,
    'api::catalog.supplier',
    { documentType: PROVEEDOR.documentType, documentNumber: PROVEEDOR.documentNumber },
    PROVEEDOR
  );

  const categorias = {};
  for (const c of CATEGORIAS) {
    categorias[c.name] = await asegurar(d, 'api::catalog.product-category', { name: c.name }, { ...c, isActive: true });
  }

  const perro = await d('api::pet.species').findFirst({ filters: { name: 'Perro' } });

  const productos = {};
  for (const { categoria, vacuna, details, ...p } of PRODUCTOS) {
    const existente = await d('api::catalog.product').findFirst({ filters: { name: p.name } });
    if (existente) {
      productos[p.name] = existente;
      continue;
    }

    let bloque = details;
    if (vacuna) {
      const clinica = await d('api::clinical.vaccine').findFirst({ filters: { name: vacuna } });
      if (!clinica) throw new Error(`Falta la vacuna clínica "${vacuna}"`);
      bloque = { ...details, vaccine: clinica.documentId };
    }

    productos[p.name] = await d('api::catalog.product').create({
      data: {
        ...p,
        currency: 'COP',
        category: categorias[categoria].documentId,
        preferredSupplier: proveedor.documentId,
        ...(perro ? { targetSpecies: [perro.documentId] } : {}),
        ...(bloque ? { details: [bloque] } : {}),
        isActive: true,
      },
    });
  }

  return productos;
}

/** Borra lo que crea este módulo. */
async function borrarCatalogo(app) {
  const d = (uid) => app.documents(uid);
  let n = 0;

  for (const p of PRODUCTOS) {
    for (const r of await d('api::catalog.product').findMany({ filters: { name: p.name } })) {
      await d('api::catalog.product').delete({ documentId: r.documentId });
      n++;
    }
  }
  for (const c of CATEGORIAS) {
    for (const r of await d('api::catalog.product-category').findMany({ filters: { name: c.name } })) {
      await d('api::catalog.product-category').delete({ documentId: r.documentId });
      n++;
    }
  }
  for (const r of await d('api::catalog.supplier').findMany({ filters: { documentNumber: NIT_PROVEEDOR } })) {
    await d('api::catalog.supplier').delete({ documentId: r.documentId });
    n++;
  }

  return n;
}

module.exports = { crearCatalogo, borrarCatalogo, PRODUCTOS };
