export function assertSafeProductionEnv(): void {
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) return;

  if (process.env.ALLOW_DEV_AUTH_BYPASS === "true") {
    throw new Error("[config] ALLOW_DEV_AUTH_BYPASS must be disabled in production");
  }

  if (process.env.AI_CALLBACK_SIMULATION === "true") {
    throw new Error("[config] AI_CALLBACK_SIMULATION must be disabled in production");
  }

  const databaseUrl = process.env.DATABASE_URL || "";
  const lowerUrl = databaseUrl.toLowerCase();
  if (
    lowerUrl.includes("sqlite") ||
    lowerUrl.startsWith("file:") ||
    lowerUrl.includes("file:./")
  ) {
    throw new Error("[config] SQLite is not allowed in production");
  }
}
