// Prisma client singleton with lazy instantiation.
//
// Prisma 7 requires a driver adapter to be supplied to the constructor at
// runtime. We construct lazily through a Proxy because Next.js collects
// page data at build time (importing route modules), and at that point
// DATABASE_URL is typically a placeholder. Construction happens on first
// property access — i.e. inside an actual request handler at runtime.
//
// Tests bypass this module entirely via `vi.mock('@/lib/db', ...)`, so the
// real adapter is never spun up under vitest.

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

let cached: PrismaClient | undefined = global.prismaGlobal;

function getClient(): PrismaClient {
  if (cached) return cached;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Required for Prisma client construction at request time.",
    );
  }

  const adapter = new PrismaPg({ connectionString });
  cached = new PrismaClient({ adapter });

  if (process.env.NODE_ENV !== "production") {
    global.prismaGlobal = cached;
  }
  return cached;
}

// A Proxy returns a stable export that defers construction until first
// property access. Tests replace this whole module via vi.mock, so the
// proxy is bypassed there.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export default prisma;
