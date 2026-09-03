// 1200x630 SVG share card. Pure string, no fonts to load — system sans/mono.

const esc = (s: string) => s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c]!);

export type Tone = "win" | "loss" | "flat";

export function ogCard(opts: { title: string; sub?: string; tone?: Tone; footer?: string; badge?: string }): string {
  const tone = opts.tone ?? "flat";
  const color = tone === "win" ? "#2ebd85" : tone === "loss" ? "#f6465d" : "#8aa6f9";
  const title = esc(opts.title).slice(0, 48);
  const sub = esc(opts.sub ?? "").slice(0, 90);
  const footer = esc(opts.footer ?? "TapFlow · one-tap Event Contracts on Somnia × DreamDEX");
  const badge = esc(opts.badge ?? "SOMNIA SHANNON · DREAMDEX EVENT CONTRACTS");
  const titleSize = title.length > 22 ? 84 : 118;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="g" cx="50%" cy="0%" r="80%"><stop offset="0" stop-color="${color}" stop-opacity="0.35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>
    <linearGradient id="bar" x1="0" x2="1"><stop offset="0" stop-color="#2ebd85"/><stop offset="1" stop-color="#f6465d"/></linearGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#ffffff" stroke-opacity="0.05"/></pattern>
  </defs>
  <rect width="1200" height="630" fill="#07090f"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <rect width="1200" height="630" fill="url(#g)"/>
  <g font-family="'Space Grotesk','Manrope',Inter,system-ui,sans-serif">
    <rect x="72" y="64" rx="8" width="${badge.length * 9.6 + 32}" height="34" fill="#0847f7" fill-opacity="0.18" stroke="#0847f7" stroke-opacity="0.5"/>
    <text x="88" y="87" font-size="15" font-weight="700" letter-spacing="2" fill="#8aa6f9">${badge}</text>
    <text x="72" y="${sub ? 300 : 330}" font-size="${titleSize}" font-weight="800" fill="${color}" letter-spacing="-3">${title}</text>
    ${sub ? `<text x="72" y="372" font-size="40" font-weight="600" fill="#f8faff" font-family="'JetBrains Mono',ui-monospace,Menlo,monospace">${sub}</text>` : ""}
    <rect x="72" y="440" width="1056" height="10" rx="5" fill="url(#bar)" fill-opacity="0.9"/>
    <g transform="translate(72,520)">
      <rect width="56" height="56" rx="14" fill="#0847f7"/>
      <path d="M33 6 15 32h13l-2 18 18-26H31z" fill="#fff"/>
      <text x="72" y="26" font-size="30" font-weight="800" fill="#f8faff">TapFlow<tspan fill="#0847f7">.</tspan></text>
      <text x="72" y="52" font-size="17" fill="#a0a0a0">${footer}</text>
    </g>
  </g>
</svg>`;
}
