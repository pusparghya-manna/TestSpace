# Cache

Appwrite Databases is the **only** persistent source of truth.
In-memory structures are a short-lived process cache for hot reads.
Never rely on memory for durability across restarts or multiple Function instances.
