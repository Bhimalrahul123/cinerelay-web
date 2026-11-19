/**
 * Community Giveaways & Ticket Contests for CineRelay
 */

export type GiveawayCategory = "Movie Tickets" | "Gift Cards" | "Events";

export type GiveawayStatus = "active" | "ended";

export interface GiveawayWinner {
  user_id: string;
  user_name: string;
  user_email?: string | null;
  drawn_at: string;
}

export interface GiveawayEntry {
  id: string;
  giveaway_id: string;
  user_id: string;
  user_name: string;
  user_email?: string | null;
  created_at: string;
}

export interface Giveaway {
  id: string;
  host_id: string;
  host_name: string;
  host_email?: string | null;
  title: string;
  category: GiveawayCategory;
  prize_details: string;
  prize_value: number;
  venue?: string | null;
  movie_title?: string | null;
  tmdb_movie_id?: number | null;
  end_time: string; // ISO string
  winners_count: number;
  claim_instructions?: string | null;
  status: GiveawayStatus;
  winners: GiveawayWinner[];
  created_at: string;
  entries_count?: number;
  has_entered?: boolean;
}

/**
 * Initial giveaways list is empty so no fake or unnecessary items are displayed.
 * Giveaways will only display when real users create and publish them.
 */
export const SEED_GIVEAWAYS: Giveaway[] = [];

/**
 * Calculates time remaining formatted as a human-readable string.
 */
export function formatTimeRemaining(endTimeIso: string): {
  isEnded: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  displayText: string;
} {
  const diff = new Date(endTimeIso).getTime() - Date.now();

  if (diff <= 0) {
    return {
      isEnded: true,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      displayText: "Contest Ended",
    };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  let displayText = "";
  if (days > 0) {
    displayText = `${days}d ${hours}h left`;
  } else if (hours > 0) {
    displayText = `${hours}h ${minutes}m left`;
  } else {
    displayText = `${minutes}m ${seconds}s left`;
  }

  return {
    isEnded: false,
    days,
    hours,
    minutes,
    seconds,
    displayText,
  };
}

/**
 * Cryptographically fair random selection of winners from participant list.
 */
export function selectFairWinners(
  entries: GiveawayEntry[],
  count: number = 1
): GiveawayWinner[] {
  if (!entries || entries.length === 0) return [];

  const shuffled = [...entries];
  // Fisher-Yates shuffle with crypto randomness
  for (let i = shuffled.length - 1; i > 0; i--) {
    const randomArray = new Uint32Array(1);
    crypto.getRandomValues(randomArray);
    const j = randomArray[0] % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const selected = shuffled.slice(0, Math.min(count, shuffled.length));
  const now = new Date().toISOString();

  return selected.map((entry) => ({
    user_id: entry.user_id,
    user_name: entry.user_name || "Lucky Winner",
    user_email: entry.user_email ?? null,
    drawn_at: now,
  }));
}
