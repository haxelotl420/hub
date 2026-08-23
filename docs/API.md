# API MVP

## Autenticazione

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/me
```

## Social

```text
GET  /api/friends
POST /api/friends/request
POST /api/friends/requests/:id/accept
GET  /api/notifications
POST /api/notifications/read-all
```

## Games e lobby

```text
GET  /api/games
GET  /api/lobbies
POST /api/lobbies
GET  /api/lobbies/:id
POST /api/lobbies/:id/join
POST /api/lobbies/:id/start
POST /api/matches/:id/action
GET  /api/events
```

Tutte le route tranne discovery, health e autenticazione richiedono la sessione `HttpOnly`.
