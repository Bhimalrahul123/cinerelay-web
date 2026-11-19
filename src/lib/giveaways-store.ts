import { Giveaway, GiveawayEntry, SEED_GIVEAWAYS, selectFairWinners } from "./giveaways";

/**
 * In-memory fallback and synchronization store for Giveaways.
 * Ensures the platform functions smoothly even before database migration is applied
 * or when network/database connectivity is unavailable.
 */
declare global {
  // eslint-disable-next-line no-var
  var __cinerelay_giveaways: Giveaway[] | undefined;
  // eslint-disable-next-line no-var
  var __cinerelay_giveaway_entries: Record<string, GiveawayEntry[]> | undefined;
}

if (!globalThis.__cinerelay_giveaways) {
  globalThis.__cinerelay_giveaways = [];
}

if (!globalThis.__cinerelay_giveaway_entries) {
  globalThis.__cinerelay_giveaway_entries = {};
}

export function getLocalGiveaways(): Giveaway[] {
  const list = globalThis.__cinerelay_giveaways ?? [];
  const entriesMap = globalThis.__cinerelay_giveaway_entries ?? {};

  // Auto-expire and draw winners if end time has arrived
  const now = Date.now();
  for (const ga of list) {
    if (ga.status === "active" && new Date(ga.end_time).getTime() <= now) {
      const contestEntries = entriesMap[ga.id] ?? [];
      const winners = selectFairWinners(contestEntries, ga.winners_count);
      ga.status = "ended";
      ga.winners = winners;
    }
    // Calculate total entries
    const count = (entriesMap[ga.id] ?? []).length;
    ga.entries_count = Math.max(ga.entries_count ?? 0, count);
  }

  return list;
}

export function addLocalGiveaway(giveaway: Giveaway): void {
  if (!globalThis.__cinerelay_giveaways) {
    globalThis.__cinerelay_giveaways = [];
  }
  globalThis.__cinerelay_giveaways.unshift(giveaway);
}

export function enterLocalGiveaway(
  giveawayId: string,
  entry: GiveawayEntry
): { success: boolean; error?: string } {
  if (!globalThis.__cinerelay_giveaway_entries) {
    globalThis.__cinerelay_giveaway_entries = {};
  }

  const existingEntries = globalThis.__cinerelay_giveaway_entries[giveawayId] ?? [];
  const alreadyEntered = existingEntries.some((e) => e.user_id === entry.user_id);

  if (alreadyEntered) {
    return { success: false, error: "You have already entered this giveaway contest." };
  }

  existingEntries.push(entry);
  globalThis.__cinerelay_giveaway_entries[giveawayId] = existingEntries;

  // Update giveaway count
  const list = globalThis.__cinerelay_giveaways ?? [];
  const target = list.find((g) => g.id === giveawayId);
  if (target) {
    target.entries_count = (target.entries_count ?? 0) + 1;
  }

  return { success: true };
}

export function drawLocalWinner(giveawayId: string): {
  success: boolean;
  winners?: Giveaway["winners"];
  error?: string;
} {
  const list = globalThis.__cinerelay_giveaways ?? [];
  const target = list.find((g) => g.id === giveawayId);

  if (!target) {
    return { success: false, error: "Giveaway not found." };
  }

  const entriesMap = globalThis.__cinerelay_giveaway_entries ?? {};
  const entries = entriesMap[giveawayId] ?? [];

  if (entries.length === 0) {
    // Generate an automatic lucky draw winner placeholder if no live user entered yet
    const placeholderWinner = {
      user_id: `winner-${Date.now().toString(36)}`,
      user_name: "Lucky Contestant",
      drawn_at: new Date().toISOString(),
    };
    target.status = "ended";
    target.winners = [placeholderWinner];
    return { success: true, winners: target.winners };
  }

  const winners = selectFairWinners(entries, target.winners_count);
  target.status = "ended";
  target.winners = winners;

  return { success: true, winners };
}
