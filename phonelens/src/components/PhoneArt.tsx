/**
 * 示意图：不使用真实产品图片（版权与核验原因），固定 3:5 比例，避免布局跳动。
 */
export function PhoneArt({ id, label, empty }: { id: string; label: string; empty?: boolean }) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const body = empty ? "#e7eaef" : `hsl(${h} 30% 88%)`;
  const edge = empty ? "#cfd5de" : `hsl(${h} 25% 62%)`;
  const lens = empty ? "#cfd5de" : `hsl(${h} 20% 32%)`;
  const lenses = empty ? 0 : (h % 3) + 1;
  return (
    <svg className="phone-art" viewBox="0 0 60 100" role="img" aria-label={empty ? "未选择机型" : `${label} 示意图`}>
      <rect x="4" y="2" width="52" height="96" rx="10" fill={body} stroke={edge} strokeWidth="2" />
      {!empty && <rect x="9" y="8" width="22" height={lenses > 2 ? 30 : 22} rx="6" fill="#fff" opacity="0.6" />}
      {Array.from({ length: lenses }).map((_, i) => (
        <circle key={i} cx="20" cy={15 + i * 9} r="3.4" fill={lens} />
      ))}
      {empty && (
        <text x="30" y="56" textAnchor="middle" fontSize="16" fill="#9aa3b0">
          ?
        </text>
      )}
    </svg>
  );
}
