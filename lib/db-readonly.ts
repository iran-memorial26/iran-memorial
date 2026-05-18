import { PrismaClient } from "@prisma/client";

// Separate Prisma client wired to a Postgres role with only SELECT grants.
// Used by every public, unauthenticated read path (MCP routes, dump,
// SSR pages where appropriate). If a future commit accidentally calls a
// write method through this client, Postgres rejects with
// "permission denied for table …" instead of silently mutating data.
//
// Falls back to DATABASE_URL when DATABASE_URL_READONLY is unset, so local
// dev without role setup keeps working. Production must set the readonly URL.

// At build time both vars are undefined and PrismaClient's explicit
// datasources arg rejects undefined. Pass it only when we actually have a
// URL; otherwise let PrismaClient resolve DATABASE_URL from env at runtime
// (matches the writable client's default behaviour and keeps build green).
const url = process.env.DATABASE_URL_READONLY || process.env.DATABASE_URL;

const globalForReadOnly = globalThis as unknown as {
  prismaReadOnly: PrismaClient | undefined;
};

export const prismaReadOnly =
  globalForReadOnly.prismaReadOnly ??
  new PrismaClient(url ? { datasources: { db: { url } } } : undefined);

if (process.env.NODE_ENV !== "production") {
  globalForReadOnly.prismaReadOnly = prismaReadOnly;
}
