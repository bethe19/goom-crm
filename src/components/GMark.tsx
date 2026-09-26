/** The Goom "G" glyph on its own; inherits `currentColor`. */
export function GMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M 74 21 A 38 38 0 1 0 88 50 L 56 50"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
