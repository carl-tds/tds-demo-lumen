// Prisma client singleton with lazy instantiation.
//
// Prisma 7 requires a driver adapter to be supplied to the constructor at
// runtime. We don't want to construct the client at module-evaluation time
// because Next.js collects page data at build time, which loads all API
// route modules — at that point DATABASE_URL may be a placeholder and we
// have no real adapter wired in yet (the adapter is added in LD01b once
// `@prisma/adapter-pg` is installed alongside Postmark/Slack work).
//
// The lazy proxy below ensures the client is only constructed when a query
// is actually executed (i.e. inside a request handler), and the singleton
// pattern stops Next.js dev hot reloads from exhausting Postgres connections.

import { PrismaClient } from "@prisma/client";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

let cached: PrismaClient | undefined = global.prismaGlobal;

function getClient(): PrismaClient {
  if (cached) return cached;
  // In Prisma 7, the adapter is the source of truth for the connection.
  // For LD01a we construct without an adapter — this means Vercel/Neon will
  // need the adapter wired in before the API can actually read/write.
  // Tracking: TODO LD01b — install @prisma/adapter-pg + pg, wire it here.
  cached = new PrismaClient();
  if (process.env.NODE_ENV !== "production") {
    global.prismaGlobal = cached;
  }
  return cached;
}

// A Proxy lets us return a stable export that defers construction until first
// property access. Tests replace this whole module via vi.mock, so the proxy
// is bypassed there.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export default prisma;
