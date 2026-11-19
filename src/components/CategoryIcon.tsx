export function CategoryIcon({
  category,
  className = "h-4 w-4",
}: {
  category: string;
  className?: string;
}) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (category) {
    case "Movies":
    case "Movie Tickets":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="15" rx="2" />
          <path d="M3 10h18M8 5l-3 5M15 5l-3 5M21 5l-3 5" />
          <path d="m10 13 5 3-5 3z" fill="currentColor" stroke="none" />
        </svg>
      );

    case "Events":
      return (
        <svg {...common}>
          <path d="M4 7a2 2 0 0 0 0 4v2a2 2 0 0 0 0 4h16v-4a2 2 0 0 1 0-4V5H4z" />
          <path d="M9 8v1M9 12v1M9 16v1M13 9h3M13 13h3M13 17h3" />
        </svg>
      );

    case "Gift Cards":
    case "Giveaways":
    case "Giveaway":
      return (
        <svg {...common}>
          <rect x="3" y="10" width="18" height="11" rx="2" />
          <path d="M2 7h20v4H2zM12 7v14" />
          <path d="M12 7H8.5a2.5 2.5 0 1 1 2.5-2.5V7ZM12 7h3.5a2.5 2.5 0 1 0-2.5-2.5V7Z" />
        </svg>
      );

    case "Trains":
      return (
        <svg {...common}>
          <rect x="5" y="2.5" width="14" height="16" rx="4" />
          <path d="M8 7h8M8 12h.01M16 12h.01M8 18.5l-3 3M16 18.5l3 3M8 15h8" />
        </svg>
      );

    case "Buses":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="16" rx="3" />
          <path d="M3 12h18M7 7h3M14 7h3M7 19v2M17 19v2" />
          <circle cx="7" cy="15.5" r="1" />
          <circle cx="17" cy="15.5" r="1" />
        </svg>
      );

    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v10M7 12h10" />
        </svg>
      );
  }
}

export default CategoryIcon;
