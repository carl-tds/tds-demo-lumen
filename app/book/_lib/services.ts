// LD01a: hardcoded for the demo. Will move to a seeded `services` table in a follow-up task.
//
// The `id` values match the cuid format the server expects:
//   /^c[a-z0-9]{20,30}$/
// Length used here: 25 (a 'c' + 24 lowercase alphanumerics) — same shape as
// Prisma's default cuid output, so when we move to the DB the ids can stay.

export interface ServiceOption {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
}

export const SERVICES: readonly ServiceOption[] = [
  {
    id: "clx0000000lumencheckup0001",
    name: "Routine check-up",
    description: "20-minute exam with one of our dentists.",
    durationMinutes: 30,
  },
  {
    id: "clx0000000lumenhygiene0002",
    name: "Hygienist visit",
    description: "Professional clean and polish with a hygienist.",
    durationMinutes: 30,
  },
  {
    id: "clx0000000lumenwhitenng003",
    name: "Teeth whitening consultation",
    description: "Quick chat about whitening options and pricing.",
    durationMinutes: 30,
  },
  {
    id: "clx0000000lumenemergncy004",
    name: "Emergency appointment",
    description: "Same-week slot for pain or trauma.",
    durationMinutes: 30,
  },
  {
    id: "clx0000000lumeninvslgn005",
    name: "Invisalign consultation",
    description: "Talk through clear-aligner treatment with our orthodontist.",
    durationMinutes: 30,
  },
] as const;

export function findServiceById(id: string): ServiceOption | undefined {
  return SERVICES.find((s) => s.id === id);
}
