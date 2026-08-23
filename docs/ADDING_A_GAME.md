# Aggiungere un nuovo gioco

## 1. Crea la cartella

```text
games/nome-gioco/
├── game.json
├── README.md
├── client/index.js
├── server/index.js
├── shared/rules.js
├── assets/
└── tests/
```

## 2. Compila il manifest

Il manifest deve rispettare `packages/game-sdk/game-manifest.schema.json` e deve contenere:

- `id` stabile e in kebab-case;
- `version` Semantic Versioning;
- `apiVersion` del contratto;
- giocatori minimi e massimi;
- entrypoint client/server/shared;
- descrizione e media.

## 3. Implementa la logica condivisa

La logica deve esportare funzioni testabili senza browser:

```js
createInitialState(players, settings)
validateAction(state, action)
reduce(state, action)
result(state)
```

`reduce` non deve eseguire I/O. Riceve lo stato precedente e un’intenzione del giocatore e restituisce uno stato nuovo o un errore.

## 4. Implementa il runtime server

Il server importa la logica condivisa e la espone al runtime della piattaforma. Non deve gestire direttamente cookie, utenti, lobby o autorizzazioni.

## 5. Implementa il client

Il client visualizza lo stato e invia azioni. Non deve calcolare il risultato ufficiale né inviare lo stato finale.

## 6. Aggiungi test

Testare almeno:

- stato iniziale;
- azioni valide;
- azioni non valide;
- turni;
- vittoria;
- pareggio;
- riconnessione tramite serializzazione;
- configurazioni limite.

## 7. Discovery e release

Esegui:

```bash
npm run discover
npm test
```

In produzione il pacchetto dovrebbe essere firmato, avere un digest immutabile e dichiarare la compatibilità con la Game API.
