import { useId } from "react";

export function TacticalPlayRoute({
  points,
  step,
  defending,
}: {
  points: { left: number; top: number }[];
  step: number;
  defending: boolean;
}) {
  const arrow = `route-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <g className="fc-play-route" fill="none" stroke="#edcf84" strokeWidth=".4">
      <defs>
        <marker
          id={arrow}
          markerWidth="5"
          markerHeight="5"
          refX="4"
          refY="2.5"
          orient="auto"
        >
          <path d="M0 0L5 2.5L0 5Z" fill="#edcf84" stroke="none" />
        </marker>
      </defs>
      {points.slice(1).map((to, index) => {
        const from = points[index];
        if (from.left === to.left && from.top === to.top) return null;
        return (
          <path
            key={index}
            d={`M${from.left} ${from.top}L${to.left} ${to.top}`}
            opacity={index < step ? 1 : 0.22}
            strokeDasharray={defending ? "1.2 1" : undefined}
            markerEnd={`url(#${arrow})`}
          />
        );
      })}
    </g>
  );
}
