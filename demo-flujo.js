'use strict';

/**
 * Recorre por HTTP el flujo del portal del cliente contra el servidor en
 * marcha, con los datos de `demo-data.js`. No usa atajos internos: hace las
 * mismas peticiones que haría la app móvil.
 *
 *   node demo-data.js && npm run develop   (en otra terminal)
 *   node demo-flujo.js
 *
 * Se usa 127.0.0.1 y no localhost: el fetch de Node resuelve localhost por
 * IPv6 (::1) y Strapi escucha en IPv4.
 */

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:1337';
const PASSWORD = 'Demo12345';

const post = async (ruta, cuerpo, jwt) => {
  const res = await fetch(`${BASE}${ruta}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    body: JSON.stringify(cuerpo),
  });
  let respuesta = null;
  try {
    respuesta = await res.json();
  } catch {
    /* sin cuerpo */
  }
  return { status: res.status, cuerpo: respuesta };
};

const api = async (ruta, jwt) => {
  const res = await fetch(`${BASE}${ruta}`, {
    headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
  });
  let cuerpo = null;
  try {
    cuerpo = await res.json();
  } catch {
    /* respuesta sin cuerpo */
  }
  return { status: res.status, cuerpo };
};

const login = async (identifier) => {
  const res = await fetch(`${BASE}/api/auth/local`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password: PASSWORD }),
  });
  const cuerpo = await res.json();
  return { status: res.status, jwt: cuerpo.jwt, cuerpo };
};

const nombres = (r) => (r.cuerpo?.data ?? []).map((p) => p.name).sort().join(', ') || '(ninguna)';

(async () => {
  console.log(`\n### 1. Sin iniciar sesión (rol Public)\n`);
  const anon = await api('/api/pets');
  console.log(`   GET /api/pets            -> HTTP ${anon.status}  ${anon.cuerpo?.error?.message ?? ''}`);
  const cat = await api('/api/species-list');
  console.log(`   GET /api/species-list    -> HTTP ${cat.status}  ${cat.cuerpo?.data?.length ?? 0} especies (catálogo público)`);

  console.log(`\n### 2. María inicia sesión en la app\n`);
  const maria = await login('maria.restrepo');
  console.log(`   POST /api/auth/local     -> HTTP ${maria.status}  jwt: ${maria.jwt ? maria.jwt.slice(0, 24) + '…' : 'NO RECIBIDO'}`);
  if (!maria.jwt) {
    console.log('   ', JSON.stringify(maria.cuerpo));
    process.exit(1);
  }

  const susMascotas = await api('/api/pets?populate[species]=true&populate[breed]=true', maria.jwt);
  console.log(`   GET /api/pets            -> HTTP ${susMascotas.status}  ve: ${nombres(susMascotas)}`);
  for (const p of susMascotas.cuerpo?.data ?? []) {
    console.log(`        ${p.name.padEnd(7)} ${p.species?.name ?? '?'}/${p.breed?.name ?? '?'}  ${p.weightKg} kg  chip ${p.microchip ?? '—'}`);
  }

  console.log(`\n### 3. Carlos inicia sesión\n`);
  const carlos = await login('carlos.betancur');
  const suyas = await api('/api/pets', carlos.jwt);
  console.log(`   GET /api/pets            -> HTTP ${suyas.status}  ve: ${nombres(suyas)}`);

  console.log(`\n### 4. Aislamiento entre clientes\n`);
  const roccoId = suyas.cuerpo?.data?.[0]?.documentId;
  const intruso = await api(`/api/pets/${roccoId}`, maria.jwt);
  console.log(`   María pide la mascota de Carlos:`);
  console.log(`   GET /api/pets/${roccoId} -> HTTP ${intruso.status}  ${intruso.status === 200 ? '¡FUGA DE DATOS!' : 'bloqueado por la policy is-owner'}`);

  const propia = susMascotas.cuerpo?.data?.[0]?.documentId;
  const suya = await api(`/api/pets/${propia}`, maria.jwt);
  console.log(`   María pide su propia mascota:`);
  console.log(`   GET /api/pets/${propia} -> HTTP ${suya.status}  ${suya.cuerpo?.data?.name ?? ''}`);

  console.log(`\n### 5. Luz es clienta de mostrador: todavía no puede entrar\n`);
  const luz = await login('luz.ramirez');
  console.log(`   POST /api/auth/local     -> HTTP ${luz.status}  ${luz.cuerpo?.error?.message ?? ''}`);

  console.log(`\n### 6. Luz reclama su cuenta (su ficha ya existe)\n`);

  const registroDirecto = await post('/api/portal/register', {
    firstName: 'Luz', lastName: 'Ramírez', documentType: 'ce', documentNumber: '402219',
    email: 'atacante@example.com', password: 'Portal12345', consents: { dataProcessing: true },
  });
  console.log(`   Intento de registrarse con su documento (sería apropiarse de la ficha):`);
  console.log(`   POST /portal/register        -> HTTP ${registroDirecto.status}  ${registroDirecto.cuerpo?.error?.message ?? ''}`);

  const inicio = await post('/api/portal/claim/start', { documentType: 'ce', documentNumber: '402219' });
  console.log(`\n   POST /portal/claim/start     -> HTTP ${inicio.status}  código enviado a ${inicio.cuerpo?.destino}`);
  const codigo = inicio.cuerpo?.codigoDesarrollo;
  console.log(`   (en desarrollo el código se devuelve: ${codigo})`);

  const malo = await post('/api/portal/claim/complete', {
    documentType: 'ce', documentNumber: '402219', code: 'XXXXXXXX', password: 'Portal12345',
  });
  console.log(`   Con un código equivocado      -> HTTP ${malo.status}  ${malo.cuerpo?.error?.message ?? ''}`);

  const fin = await post('/api/portal/claim/complete', {
    documentType: 'ce', documentNumber: '402219', code: codigo,
    username: 'luz.ramirez', password: 'Portal12345',
  });
  console.log(`   Con el código correcto        -> HTTP ${fin.status}  cuenta: ${fin.cuerpo?.user?.username ?? fin.cuerpo?.error?.message}`);

  console.log(`\n### 7. Luz entra y ve SUS mascotas de siempre\n`);
  const luzOk = await fetch(`${BASE}/api/auth/local`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'luz.ramirez', password: 'Portal12345' }),
  }).then((r) => r.json());
  const suyas2 = await api('/api/pets', luzOk.jwt);
  console.log(`   GET /api/pets            -> HTTP ${suyas2.status}  ve: ${nombres(suyas2)}`);
  console.log(`   Son las mismas fichas que recepción creó en mostrador, no duplicados.`);

  const reintento = await post('/api/portal/claim/start', { documentType: 'ce', documentNumber: '402219' });
  console.log(`\n   Reclamar otra vez, ya con cuenta:`);
  console.log(`   POST /portal/claim/start     -> HTTP ${reintento.status}  destino: ${reintento.cuerpo?.destino}  (respuesta neutra, no confirma nada)`);

  console.log(`\n### 8. Alta de alguien a quien la clínica no conoce\n`);
  const alta = await post('/api/portal/register', {
    firstName: 'Ana', lastName: 'Nueva',
    documentType: 'cc', documentNumber: '1099887766',
    email: 'ana.nueva@example.com', phone: '+573009998877',
    username: 'ana.nueva', password: 'Portal12345',
    consents: { dataProcessing: true, marketing: true, email: true, sms: false },
  });
  console.log(`   POST /portal/register        -> HTTP ${alta.status}  ${alta.cuerpo?.user?.username ?? alta.cuerpo?.error?.message}`);

  if (alta.cuerpo?.jwt) {
    const nuevas = await api('/api/pets', alta.cuerpo.jwt);
    console.log(`   GET /api/pets                -> HTTP ${nuevas.status}  ve: ${nombres(nuevas)}  (aún no tiene mascotas)`);
    console.log(`   Se le crearon profile + customer + contactos: ya puede agendar una cita.`);
  }

  const sinConsentimiento = await post('/api/portal/register', {
    firstName: 'Otro', lastName: 'Sin Consentimiento',
    documentType: 'cc', documentNumber: '1000000001',
    email: 'otro@example.com', password: 'Portal12345',
    consents: { marketing: true },
  });
  console.log(`\n   Sin aceptar el tratamiento de datos:`);
  console.log(`   POST /portal/register        -> HTTP ${sinConsentimiento.status}  ${sinConsentimiento.cuerpo?.error?.message ?? ''}`);

  console.log(`\nPara volver a empezar:  node demo-data.js --reset && node demo-data.js\n`);
})().catch((e) => {
  console.error('\nno se pudo completar el flujo:', e.message);
  console.error('¿está el servidor en marcha en ' + BASE + '?');
  process.exit(1);
});
