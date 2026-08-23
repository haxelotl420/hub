# Browser Games Hub

MVP funzionante di una piattaforma multiplayer modulare. L'applicazione include:

- registrazione, login e sessioni server-side;
- profilo e presenza online;
- richieste di amicizia e notifiche;
- Games Hub con discovery dei manifest;
- lobby pubbliche/private e inviti;
- realtime tramite Server-Sent Events per l'MVP;
- Forza 4, Tris e Battaglia Navale server-authoritative;
- Battaglia Navale Classica e Plus, deck personalizzabile e mappe 10×10–50×50;
- Game SDK, test della logica e schema PostgreSQL di riferimento.

## Avvio rapido

Richiede Node.js 20 o superiore e non richiede dipendenze esterne per il prototipo.

```bash
npm start
```

Aprire [http://localhost:3000](http://localhost:3000).

Per lo sviluppo con riavvio automatico:

```bash
npm run dev
```

Per i test:

```bash
npm test
```

Per verificare i giochi installati:

```bash
npm run discover
```

## Nota architetturale

Il progetto è volutamente un modular monolith per l'MVP. I dati demo vengono salvati in `data/store.json`; la directory è ignorata da Git. Per una versione production, usare PostgreSQL e Redis seguendo `database/schema.sql`.

Il realtime MVP usa SSE per rimanere privo di dipendenze. Il contratto dei messaggi è in `packages/game-sdk/protocol.js`; sostituire il trasporto con WebSocket non richiede cambiare la logica dei giochi.

## Struttura

```text
apps/server       API, sessioni, lobby, runtime giochi e SSE
apps/web          interfaccia web responsive
games/forza-4     modulo completo di esempio
packages/game-sdk contratto comune dei giochi
database          schema SQL e note di produzione
docs              guida per aggiungere nuovi giochi
scripts           strumenti di discovery e validazione
```
