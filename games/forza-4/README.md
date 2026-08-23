# Forza 4

Modulo ufficiale di esempio per Browser Games Hub.

## Contratto

- due giocatori;
- stato server-authoritative;
- azione unica: `drop_disc`;
- colori assegnati dal runtime in base al posto;
- vittoria con quattro pedine consecutive;
- pareggio quando la plancia è piena.

La logica è in `shared/rules.js`, così può essere testata senza browser. `server/index.js` adatta la logica al Game Runtime e `client/index.js` contiene l’adapter visuale della plancia.
