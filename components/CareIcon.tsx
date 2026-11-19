export default function CareIcon({
  kind = 'heart',
}: {
  kind?: 'heart' | 'people' | 'medical' | 'sun' | 'home' | 'leaf'
}) {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === 'heart' && (
        <path d="M16 27 4.5 15.5A7.2 7.2 0 0 1 16 7a7.2 7.2 0 0 1 11.5 8.5L16 27Z M8 16h5l2-4 3 8 2-4h4" />
      )}
      {kind === 'people' && (
        <>
          <circle cx="11" cy="8" r="3" />
          <circle cx="23" cy="10" r="3" />
          <path d="M4 28V18a7 7 0 0 1 14 0v10M20 28V18a5 5 0 0 1 8 4v6M10 21v7" />
        </>
      )}
      {kind === 'medical' && (
        <>
          <rect x="4" y="4" width="24" height="24" rx="6" />
          <path d="M13 9h6v4h4v6h-4v4h-6v-4H9v-6h4Z" />
        </>
      )}
      {kind === 'sun' && (
        <>
          <circle cx="16" cy="16" r="6" />
          <path d="M16 2v3m0 22v3M2 16h3m22 0h3M6 6l2 2m16 16 2 2M6 26l2-2M24 8l2-2" />
        </>
      )}
      {kind === 'home' && (
        <path d="m3 14 13-11 13 11M6 12v16h20V12M12 28V18h8v10" />
      )}
      {kind === 'leaf' && (
        <>
          <path d="M26 4C12 3 3 10 7 21c10 6 21-2 19-17Z M5 28 23 9M12 20l-1-6m6 1 6 1" />
        </>
      )}
    </svg>
  )
}
