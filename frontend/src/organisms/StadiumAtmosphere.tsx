/** Decorative motion shares the app's pause and reduced-motion preferences. */
export function StadiumAtmosphere() {
  return <div className="stadium-atmosphere" aria-hidden="true">
    <div className="stadium-beam beam-one"/><div className="stadium-beam beam-two"/>
    <svg className="stadium-play" viewBox="0 0 600 320">
      <path className="stadium-route" d="M40 260 Q170 260 250 170 T520 55" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="6 10"/>
      {[ [40,260],[250,170],[520,55] ].map(([x,y],i)=><g key={i} className="stadium-player" style={{animationDelay:`${i*1.4}s`}}><circle cx={x} cy={y} r="14" fill="none" stroke="currentColor"/><circle cx={x} cy={y} r="4" fill="currentColor"/></g>)}
      <circle className="stadium-ball" r="5" fill="white"/>
    </svg>
    <div className="stadium-grain"/>
  </div>;
}
