const { randomUUID } = require('node:crypto');

function createGameMetadata(manifest) {
  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    apiVersion: manifest.apiVersion,
    players: manifest.players,
    modes: manifest.modes || [],
    description: manifest.description || ''
  };
}

function createActionEnvelope({ matchId, playerId, type, payload }) {
  return {
    requestId: randomUUID(),
    matchId,
    playerId,
    type,
    payload,
    createdAt: new Date().toISOString()
  };
}

function assertManifest(manifest) {
  const required = ['id', 'name', 'version', 'apiVersion', 'players'];
  for (const field of required) {
    if (!manifest || manifest[field] === undefined) throw new Error(`Manifest incompleto: ${field}`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.id)) throw new Error('ID gioco non valido');
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error('Versione gioco non valida');
  if (!manifest.players.min || !manifest.players.max || manifest.players.min > manifest.players.max) {
    throw new Error('Configurazione giocatori non valida');
  }
  return true;
}

module.exports = { createGameMetadata, createActionEnvelope, assertManifest };
