import type { ReactNode } from "react";
import { Icon, type IconName } from "../atoms/Icon";

interface ClubPageIntroProps {
  icon: IconName;
  eyebrow: string;
  title: string;
  children: ReactNode;
}

export function ClubPageIntro({
  icon,
  eyebrow,
  title,
  children,
}: ClubPageIntroProps) {
  return (
    <div className="club-route-heading">
      <Icon name={icon} />
      <div>
        <small>{eyebrow}</small>
        <h1>{title}</h1>
        <p>{children}</p>
      </div>
    </div>
  );
}
