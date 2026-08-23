# Decisioni architetturali MVP

## Core e moduli

Il core possiede account, social graph, lobby, partite, notifiche e trasporto realtime. I moduli possiedono soltanto regole e visualizzazione del gioco.

## Stato autorevole

Il browser invia intenzioni. Il runtime verifica autenticazione, appartenenza, turni e regole prima di diffondere il nuovo stato.

## Trasporto

L’MVP utilizza SSE per notifiche e aggiornamenti con zero dipendenze. `packages/game-sdk/protocol.js` definisce messaggi indipendenti dal trasporto. WebSocket è il passaggio previsto quando serviranno messaggi bidirezionali ad alta frequenza.

## Production hardening

Prima del deploy pubblico sostituire la persistenza JSON con PostgreSQL, usare Argon2id per le password, aggiungere Redis per rate limit/presenza distribuita, HTTPS, backup, audit log, CSRF protection e artefatti di gioco firmati.
