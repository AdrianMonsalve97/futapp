import { useSearchParams } from "react-router-dom";
import type { Role } from "../types/api";
import {
  squadParams,
  squadView,
  type SquadView,
} from "../utils/squad-navigation";

export function useSquadNavigation(role: Role | undefined) {
  const [params, setParams] = useSearchParams();
  return {
    view: squadView(params.get("vista"), role),
    setView: (view: SquadView) => {
      const allowed = squadView(view, role);
      setParams((current) =>
        squadParams(current, "vista", allowed === "gallery" ? "" : allowed),
      );
    },
  };
}
