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

/* ------------------------------------------------------------------------
 * Navigation glyphs, exported from the Figma workspace nav (949:2230). These
 * keep the source artwork's 20×20 grid rather than the 24×24 grid above, so
 * the vector data below is the design's, unaltered.
 * --------------------------------------------------------------------- */

const nav = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 0.9375,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const NavSearchIcon = ({ size = 20, className }: IconProps) => (
  <svg {...nav(size)} className={className}>
    <path d="M8.75 15C12.2017 15 15 12.2017 15 8.75C15 5.29822 12.2017 2.5 8.75 2.5C5.29822 2.5 2.5 5.29822 2.5 8.75C2.5 12.2017 5.29822 15 8.75 15Z" />
    <path d="M13.1696 13.1696L17.5 17.5" />
  </svg>
);

export const HistoryIcon = ({ size = 20, className }: IconProps) => (
  <svg {...nav(size)} className={className}>
    <g transform="translate(2.031 2.656)">
      <path d="M7.96876 3.59375V7.34375L11.0938 9.21875" />
      <path d="M3.59376 5.46875H0.468765V2.34375" />
      <path d="M3.25001 12.3441C4.23281 13.2714 5.46708 13.8886 6.7986 14.1185C8.13018 14.3484 9.49993 14.1808 10.7368 13.6367C11.9737 13.0926 13.0228 12.196 13.753 11.0591C14.4832 9.92217 14.8622 8.59516 14.8426 7.24408C14.823 5.893 14.4058 4.5776 13.6428 3.4623C12.8799 2.347 11.8053 1.48124 10.5533 0.97319C9.3011 0.465148 7.9271 0.33734 6.60276 0.605748C5.27841 0.874148 4.06254 1.52686 3.10705 2.48233C2.18751 3.41358 1.42814 4.29171 0.468765 5.46905" />
    </g>
  </svg>
);

export const AudioIcon = ({ size = 20, className }: IconProps) => (
  <svg {...nav(size)} className={className}>
    <g transform="translate(1.406 1.406)">
      <path d="M12.6562 13.5938C13.8644 13.5938 14.8438 12.6144 14.8438 11.4062C14.8438 10.1981 13.8644 9.21875 12.6562 9.21875C11.4481 9.21875 10.4688 10.1981 10.4688 11.4062C10.4688 12.6144 11.4481 13.5938 12.6562 13.5938Z" />
      <path d="M2.65625 16.0938C3.86437 16.0938 4.84375 15.1144 4.84375 13.9062C4.84375 12.6981 3.86437 11.7188 2.65625 11.7188C1.44813 11.7188 0.46875 12.6981 0.46875 13.9062C0.46875 15.1144 1.44813 16.0938 2.65625 16.0938Z" />
      <path d="M14.8438 4.21875L4.84375 6.71875" />
      <path d="M4.84375 13.9062V2.96875L14.8438 0.468754V11.4062" />
    </g>
  </svg>
);

export const HelpIcon = ({ size = 20, className }: IconProps) => (
  <svg {...nav(size)} className={className}>
    <path
      d="M10 14.8437C10.4315 14.8437 10.7812 14.494 10.7812 14.0625C10.7812 13.631 10.4315 13.2812 10 13.2812C9.5685 13.2812 9.21875 13.631 9.21875 14.0625C9.21875 14.494 9.5685 14.8437 10 14.8437Z"
      fill="currentColor"
      stroke="none"
    />
    <path d="M10 11.25V10.625C11.3805 10.625 12.5 9.64533 12.5 8.4375C12.5 7.22968 11.3805 6.25 10 6.25C8.6195 6.25 7.5 7.22968 7.5 8.4375V8.75" />
    <path d="M10 17.5C14.1422 17.5 17.5 14.1422 17.5 10C17.5 5.85787 14.1422 2.5 10 2.5C5.85787 2.5 2.5 5.85787 2.5 10C2.5 14.1422 5.85787 17.5 10 17.5Z" />
  </svg>
);

export const ChevronDownIcon = ({ size = 12, className }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M9.75 4.5L6 8.25L2.25 4.5" />
  </svg>
);

export const MinusIcon = ({ size = 15, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M5 12h14" />
  </svg>
);

export const PlusIcon = ({ size = 15, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
);

export const TrashIcon = ({ size = 15, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 7h16" />
    <path d="M9 7V4h6v3" />
    <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </svg>
);
