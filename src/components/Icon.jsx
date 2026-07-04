const PATHS = {
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M6 6l1 15h10l1-15" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </>
  ),
  upload: (
    <>
      <path d="M12 3v12" />
      <path d="M7 8l5-5 5 5" />
      <path d="M5 21h14" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </>
  ),
  play: <path d="M8 5v14l11-7z" />,
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 6v6h-6" />
      <path d="M4 18v-6h6" />
      <path d="M18 9a7 7 0 0 0-12-3l-2 2" />
      <path d="M6 15a7 7 0 0 0 12 3l2-2" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  list: (
    <>
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 10.7l6.8-4.4" />
      <path d="M8.6 13.3l6.8 4.4" />
    </>
  ),
  chevron: <path d="M9 18l6-6-6-6" />,
  // Cricket stumps + ball — brand mark. Uses currentColor so it recolors with the palette.
  logo: (
    <>
      <path d="M8 8v12" />
      <path d="M12 8v12" />
      <path d="M16 8v12" />
      <path d="M7.5 8h9" />
      <circle cx="19" cy="5.5" r="2.5" />
    </>
  ),
}

export default function Icon({ name, label, size = 16, className = '' }) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
    >
      {label && <title>{label}</title>}
      {PATHS[name]}
    </svg>
  )
}
