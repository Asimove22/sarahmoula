export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="48" stroke="#006233" strokeWidth="3.5" fill="white"/>
      {/* Water */}
      <ellipse cx="50" cy="63" rx="34" ry="5" fill="#2D3F5E" opacity="0.6"/>
      {/* Left hill */}
      <path d="M16 62 Q24 48 34 56 L16 62Z" fill="#1A4D2E"/>
      {/* Right hill */}
      <path d="M84 62 Q76 48 66 56 L84 62Z" fill="#1A4D2E"/>
      {/* Bridge deck */}
      <rect x="18" y="56" width="64" height="4" rx="1" fill="#006233"/>
      {/* Left tower */}
      <rect x="31" y="36" width="5" height="22" rx="1" fill="#006233"/>
      {/* Right tower */}
      <rect x="64" y="36" width="5" height="22" rx="1" fill="#006233"/>
      {/* Arch */}
      <path d="M19 58 Q50 38 81 58" stroke="#004d28" strokeWidth="2" fill="none"/>
      {/* Left cables */}
      <line x1="33" y1="37" x2="21" y2="57" stroke="#006233" strokeWidth="1"/>
      <line x1="33" y1="37" x2="28" y2="57" stroke="#006233" strokeWidth="1"/>
      <line x1="33" y1="37" x2="39" y2="57" stroke="#006233" strokeWidth="1"/>
      {/* Right cables */}
      <line x1="66" y1="37" x2="79" y2="57" stroke="#006233" strokeWidth="1"/>
      <line x1="66" y1="37" x2="72" y2="57" stroke="#006233" strokeWidth="1"/>
      <line x1="66" y1="37" x2="61" y2="57" stroke="#006233" strokeWidth="1"/>
      {/* Text */}
      <text x="50" y="80" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="12" fill="#2D3F5E">DzBridge</text>
    </svg>
  )
}
