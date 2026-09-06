/**
 * Legacy Turso blob migration — disabled.
 * TestSpace uses Appwrite Databases exclusively.
 */
export async function ensureSchema(): Promise<void> {
  // no-op: schema is ensured by appwriteClient.ensureAppwriteSchema via initDb()
}

export async function runBlobMigration(): Promise<void> {
  // no-op
}
