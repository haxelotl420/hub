# Database

L’MVP usa `data/store.json` per essere avviabile senza installare servizi. `schema.sql` è lo schema PostgreSQL di riferimento per il passaggio a una persistenza production.

Quando si effettua la migrazione:

1. applicare lo schema in un database vuoto;
2. sostituire gli accessi a `store` nei moduli server con repository SQL;
3. usare transazioni per amicizie, ingresso lobby e avvio match;
4. salvare solamente snapshot/eventi utili, non ogni messaggio di presenza.
