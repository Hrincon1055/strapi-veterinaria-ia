'use strict';

const puedeVerAgenda = require('./puede-ver-agenda');
const puedeAgendar = require('./puede-agendar');
const puedeFinalizar = require('./puede-finalizar');

module.exports = {
  'puede-ver-agenda': puedeVerAgenda,
  'puede-agendar': puedeAgendar,
  'puede-finalizar': puedeFinalizar,
};
