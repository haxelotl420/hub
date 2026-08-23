# Battaglia Navale

Il modulo supporta:

- modalità `classic` con flotta standard condivisa;
- modalità `plus` con deck a budget;
- mappe da 10×10 fino a 50×50;
- ostacoli casuali Plus che impediscono il piazzamento;
- ostacoli non esposti nella mappa avversaria;
- 12 tipi di nave tra piccole, medie e grandi;
- massimo due navi piccole e una grande in Plus;
- poteri lineari, a croce e a rosa con carica a turni;
- fase pregame per posizionare, sostituire, rimuovere e confermare le navi.
- drag-and-drop: in Classica dal catalogo direttamente al tabellone; in Plus dal catalogo al deck e, dopo la conferma di entrambi, dal deck al proprio tabellone;
- in partita il tabellone nemico è a sinistra e il proprio è a destra.

La validazione del deck, delle coordinate, degli ostacoli e degli attacchi è server-authoritative in `shared/rules.js`.
