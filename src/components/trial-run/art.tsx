import type { Colour } from "@/config";
export function Hoodie({ colour = "Crimson" }: { colour?: Colour }) {
  return (
    <svg
      viewBox="0 0 280 260"
      className={`hoodie-svg ${colour === "Navy" ? "navy" : ""}`}
      role="img"
      aria-label={`${colour} Everyday Streetwear hoodie illustration`}
    >
      <ellipse cx="140" cy="233" rx="85" ry="9" fill="var(--shadow)" />
      <path className="cloth-dark" d="M108 58Q110 22 140 22Q170 22 173 58L160 84H121Z" />
      <path
        className="cloth-light"
        d="M106 56Q99 31 117 18Q139 1 162 18Q182 32 173 56L155 72H123Z"
      />
      <path className="cloth-dark" d="M119 26Q140 10 161 27L158 54L140 72L121 53Z" />
      <path
        className="cloth"
        d="M107 50L78 63L43 143L65 158L92 105L88 219Q140 232 192 219L188 105L215 158L237 143L202 63L173 50L155 73L140 79L124 72Z"
      />
      <path className="cloth-light" d="M107 51L81 64L49 140L64 149L94 91L98 63Z" opacity=".5" />
      <path
        className="cloth-dark"
        d="M46 139L68 151L62 166L39 154ZM212 152L234 139L241 154L217 166ZM88 207Q140 218 192 207L192 221Q140 233 88 221Z"
      />
      <path
        className="seam"
        d="M101 63L94 102L97 201M179 63L186 102L183 201M83 75L60 140M197 75L220 140"
      />
      <path className="cloth-light" d="M113 143H167L179 183Q140 191 101 183Z" />
      <path className="seam" d="M113 143L103 170M167 143L177 170M104 185Q140 192 177 185" />
      <path className="draw-string" d="M126 71L123 116M153 73L155 118" />
      <path className="cloth-dark" d="M121 112H125V119H121ZM153 115H157V122H153Z" />
      <path className="seam" d="M122 59L140 77L159 57" />
      <path d="M129 127H151" stroke="var(--foreground)" strokeWidth="1" opacity=".3" />
    </svg>
  );
}
export function Avatar({
  colour = "Crimson",
  hoodie = true,
}: {
  colour?: Colour;
  hoodie?: boolean;
}) {
  return (
    <svg
      className={`avatar-svg hoodie-svg ${colour === "Navy" ? "navy" : ""}`}
      viewBox="0 0 150 220"
      role="img"
      aria-label={hoodie ? `Character wearing ${colour} hoodie` : "Character wearing grey tee"}
    >
      <ellipse cx="75" cy="209" rx="39" ry="7" fill="var(--shadow)" />
      <path d="M54 147L52 191H69L76 154L82 191H99L95 147Z" fill="var(--navy-dark)" />
      <path d="M50 188H68V201H43Q40 193 50 188ZM82 188H100L108 201H82Z" fill="var(--foreground)" />
      <path
        d="M50 93L32 135L44 142L61 113M99 93L116 135L104 142L90 111"
        fill={hoodie ? "var(--cloth)" : "var(--tee)"}
        stroke={hoodie ? "var(--cloth)" : "var(--tee)"}
        strokeWidth="12"
        strokeLinecap="round"
      />
      <circle cx="37" cy="140" r="8" fill="var(--skin)" />
      <circle cx="112" cy="140" r="8" fill="var(--skin)" />
      {hoodie && <path className="cloth-dark" d="M48 87Q46 53 75 50Q104 53 102 87L90 102H58Z" />}
      <path
        d="M51 89Q75 78 99 89L100 151Q76 157 50 151Z"
        fill={hoodie ? "var(--cloth)" : "var(--tee)"}
      />
      {hoodie && (
        <>
          <path className="cloth-light" d="M62 120H88L94 140H56Z" />
          <path className="draw-string" d="M65 91L64 111M86 91L87 111" />
          <path className="cloth-dark" d="M50 145H100V154H50Z" />
        </>
      )}
      <path d="M65 73H85V91Q75 98 65 91Z" fill="var(--skin)" />
      <rect x="51" y="29" width="48" height="52" rx="21" fill="var(--skin)" />
      <path d="M50 49Q41 25 60 20Q90 8 100 33L100 50L89 34Q66 46 50 40Z" fill="var(--hair)" />
      <circle cx="64" cy="56" r="2" fill="var(--hair)" />
      <circle cx="85" cy="56" r="2" fill="var(--hair)" />
      <path
        d="M69 68Q75 72 81 68"
        fill="none"
        stroke="var(--hair)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function CoinIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className="coin-icon"
      aria-hidden="true"
    >
      <circle
        cx="10"
        cy="10"
        r="8"
        fill="currentColor"
        fillOpacity=".15"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M11.7 6.7H9.4a1.7 1.7 0 0 0 0 3.3h1.2a1.7 1.7 0 0 1 0 3.3H8.3M10 5.5v9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
