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
 * Seed community giveaways displayed so users always find active contests
 * and inspiration when browsing the giveaways platform.
 */
export const SEED_GIVEAWAYS: Giveaway[] = [
  {
    id: "ga-seed-1",
    host_id: "system-host-cinephile-club",
    host_name: "CineRelay Official",
    title: "🎟️ 2x IMAX 3D Weekend Tickets — Gladiator II",
    category: "Movie Tickets",
    prize_details: "Two prime center recliner tickets at PVR INOX Forum Mall, Bengaluru. Experience the arena in full IMAX glory!",
    prize_value: 900,
    venue: "PVR INOX IMAX, Bengaluru",
    movie_title: "Gladiator II",
    tmdb_movie_id: 558449,
    end_time: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
    winners_count: 1,
    claim_instructions: "Winner will receive direct digital ticket barcode and seat confirmation via CineRelay Chat.",
    status: "active",
    winners: [],
    created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    entries_count: 48,
  },
  {
    id: "ga-seed-2",
    host_id: "user-host-rahul",
    host_name: "Rahul Sharma (@cinephile_rahul)",
    title: "🎁 ₹1,000 BookMyShow E-Gift Voucher",
    category: "Gift Cards",
    prize_details: "Unused ₹1,000 BookMyShow digital voucher valid for any cinema, theatre, or live comedy event across India.",
    prize_value: 1000,
    venue: "All Theatres Across India (BookMyShow)",
    movie_title: null,
    tmdb_movie_id: null,
    end_time: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
    winners_count: 2,
    claim_instructions: "Voucher voucher code and PIN will be messaged securely to the winner right after draw.",
    status: "active",
    winners: [],
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    entries_count: 73,
  },
  {
    id: "ga-seed-3",
    host_id: "user-host-anjali",
    host_name: "Anjali K. (@moviebuff_blr)",
    title: "🍿 2x Premium Couple Recliner Tickets — Interstellar IMAX Re-Release",
    category: "Movie Tickets",
    prize_details: "Bought tickets for Sunday night show but traveling for work. Passing on to a fellow space movie lover!",
    prize_value: 750,
    venue: "Cinepolis VIP, Hyderabad",
    movie_title: "Interstellar",
    tmdb_movie_id: 157336,
    end_time: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // Ended 4 hours ago
    winners_count: 1,
    claim_instructions: "Delivered via CineRelay chat.",
    status: "ended",
    winners: [
      {
        user_id: "winner-user-123",
        user_name: "Vikram Reddy (@vikram_r)",
        drawn_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      },
    ],
    created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    entries_count: 64,
  },
  {
    id: "ga-seed-4",
    host_id: "user-host-kunal",
    host_name: "Kunal M. (@kunal_delhi)",
    title: "🎟️ 2x Passes — Stand-up Comedy Special by Zakir Khan",
    category: "Events",
    prize_details: "2 General Entry passes for Zakir Khan Live tour at Siri Fort Auditorium. Free contest entry for comedy fans!",
    prize_value: 1500,
    venue: "Siri Fort Auditorium, New Delhi",
    movie_title: null,
    tmdb_movie_id: null,
    end_time: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(), // 6 days from now
    winners_count: 1,
    claim_instructions: "PDF passes transferred to winner directly on CineRelay.",
    status: "active",
    winners: [],
    created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    entries_count: 31,
  },
];

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
