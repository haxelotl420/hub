const MESSAGE_TYPES = Object.freeze({
  LOBBY_UPDATED: 'lobby.updated',
  MATCH_STARTED: 'match.started',
  GAME_STATE_UPDATED: 'game.state_updated',
  NOTIFICATION_CREATED: 'notification.created',
  PRESENCE_UPDATED: 'presence.updated',
  ERROR: 'error'
});

function event(type, payload, sequence = 0) {
  return { type, sequence, payload, createdAt: new Date().toISOString() };
}

module.exports = { MESSAGE_TYPES, event };
