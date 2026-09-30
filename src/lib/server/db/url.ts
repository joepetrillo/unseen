// Neon's URLs (managed by the Vercel integration, so we can't edit them) use
// `sslmode=require`. pg treats that as verify-full today, but pg v9 switches to
// libpq's meaning: encrypted but the server's certificate is never checked.
// Pinning verify-full keeps certificate checks when pg upgrades.
export function withVerifiedTls(connectionString: string): string {
  const url = new URL(connectionString);
  url.searchParams.set("sslmode", "verify-full");
  return url.toString();
}
