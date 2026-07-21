interface IconProps {
  size?: number;
  className?: string;
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const PlayIcon = ({ size = 15, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none" />
  </svg>
);

export const PauseIcon = ({ size = 15, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
    <rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
  </svg>
);

export const RootsIcon = ({ size = 15, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M19 12H5" />
    <path d="M11 6l-6 6 6 6" />
  </svg>
);

export const BranchesIcon = ({ size = 15, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M5 12h14" />
    <path d="M13 6l6 6-6 6" />
  </svg>
);

export const TracksIcon = ({ size = 15, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M9 18V5l11-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="17" cy="16" r="3" />
  </svg>
);

export const ExternalIcon = ({ size = 15, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <path d="M15 3h6v6" />
    <path d="M10 14L21 3" />
  </svg>
);

export const CloseIcon = ({ size = 15, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M18 6L6 18" />
    <path d="M6 6l12 12" />
  </svg>
);

export const SearchIcon = ({ size = 15, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </svg>
);

export const PlaylistIcon = ({ size = 15, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M3 6h13" />
    <path d="M3 12h13" />
    <path d="M3 18h7" />
    <path d="M19 14v-4l3 2z" fill="currentColor" stroke="none" />
    <circle cx="17" cy="17" r="0.5" fill="none" stroke="none" />
  </svg>
);

export const CheckIcon = ({ size = 15, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

export const SparkleIcon = ({ size = 15, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z" />
  </svg>
);

export const FitIcon = ({ size = 15, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
    <path d="M16 3h3a2 2 0 0 1 2 2v3" />
    <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
  </svg>
);
