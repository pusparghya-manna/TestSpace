# Cache layer

SQL (Turso) is the **only** persistent source of truth.

The in-memory structures in `store.ts` are a **bounded bootstrap/cache**:

- attempts cache max 2000
- audit logs max 200
- question bank max 500

Never rely on memory for durability across Railway restarts or multiple instances.
Writes always go to SQL first via repositories.
