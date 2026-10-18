import { refereePaymentCovered } from "../../../backend/src/domain/referee";
import type { MatchRefereeView } from "../types/referee";
import { resolvePhaseFormations } from "../../../backend/src/domain/tactical-phases";
import type { PhaseFormations } from "../types/tactics";
import { assignLineupSlot, pitchSlotsFrom } from "../utils/lineup-slots";
import type { PitchSlot } from "../types/tactics";
import { useEffect, useState } from "react";

import { formationsFor, getFormat } from "../data/formations";
import { api, errorMessage } from "../services/api";
import { useFetch } from "./useFetch";
import type {
  MatchAttendance,
  AutoLineupResponse,
  LineupResponse,
  LineupSlot,
  MatchWithLineupResponse,
  PlayerListItem,
  TeamFormat,
} from "../types/api";

export interface LineupEditorProps {
  matchId: number;
  formation: string;
  phaseFormations?: PhaseFormations | null;
  lineup: LineupSlot[];
  players: PlayerListItem[];
  /** §12.7.3 — formato del partido: filtra las formaciones y fija el cupo. */
  format: TeamFormat;
  /** Se invoca tras cada escritura para que la página recargue los datos. */
  onChanged: () => void;
  publishedAt?: string | null;
  allowedFormations?: string[];
}

type Busy = "formation" | "suggest" | "save" | "publish" | null;
const POSITION_ORDER: Record<string, number> = {
  POR: 0,
  DEF: 1,
  MED: 2,
  DEL: 3,
};
export function useLineupEditor({
  matchId,
  formation,
  lineup,
  players,
  format,
  onChanged,
  allowedFormations,
  phaseFormations: savedPhases,
}: LineupEditorProps) {
  const attendance = useFetch<MatchAttendance[]>(
    `/api/matches/${matchId}/attendance`,
    [lineup],
  );
  const referee = useFetch<MatchRefereeView>(
    `/api/matches/${matchId}/referee`,
    [lineup],
  );
  const isMatchDay = referee.data?.isMatchDay === true;
  useEffect(() => {
    if (!isMatchDay) return;
    const refresh = () => {
      if (document.visibilityState === "visible") {
        attendance.reload();
        referee.reload();
      }
    };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [isMatchDay, attendance.reload, referee.reload]);
  const [slots, setSlots] = useState<PitchSlot[]>(() =>
    pitchSlotsFrom(formation, lineup, format),
  );
  const [formationKey, setFormationKey] = useState(formation);
  const [phaseFormations, setPhaseFormations] = useState(() =>
    resolvePhaseFormations(formation, format, savedPhases, allowedFormations),
  );
  const phaseSignature = JSON.stringify(savedPhases);
  useEffect(() => {
    setPhaseFormations(
      resolvePhaseFormations(formation, format, savedPhases, allowedFormations),
    );
  }, [matchId, phaseSignature, format, JSON.stringify(allowedFormations)]);
  const [pendingSlot, setPendingSlot] = useState<PitchSlot | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [bench, setBench] = useState<NonNullable<AutoLineupResponse["bench"]>>(
    [],
  );

  const profile = getFormat(format);
  const formationOptions = formationsFor(format).filter(
    (item) => !allowedFormations || allowedFormations.includes(item.key),
  );
  const playersOnPitch = profile.playersOnPitch;

  // Sincroniza cuando el padre recarga (tras cada guardado).
  useEffect(() => {
    setSlots(pitchSlotsFrom(formation, lineup, format));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineup]);

  useEffect(() => {
    setFormationKey(formation);
  }, [formation]);

  useEffect(() => {
    if (!pendingSlot) return;
    setSelectedPlayerId(
      pendingSlot.playerId ? String(pendingSlot.playerId) : "",
    );
  }, [pendingSlot]);

  const filled = slots.filter((slot) => slot.playerId).length;

  const sortedPlayers = players
    .filter(
      (item) =>
        item.user.active &&
        attendance.data?.some(
          (row) => row.playerId === item.player.id && row.eligible,
        ),
    )
    .sort((a, b) => {
      const priority =
        Number(
          refereePaymentCovered(
            attendance.data?.find((row) => row.playerId === b.player.id)
              ?.referee,
          ),
        ) -
        Number(
          refereePaymentCovered(
            attendance.data?.find((row) => row.playerId === a.player.id)
              ?.referee,
          ),
        );
      if (priority !== 0) return priority;
      const byPos =
        (POSITION_ORDER[a.player.position] ?? 9) -
        (POSITION_ORDER[b.player.position] ?? 9);
      if (byPos !== 0) return byPos;
      const byNumber =
        (a.player.shirtNumber ?? 99) - (b.player.shirtNumber ?? 99);
      if (byNumber !== 0) return byNumber;
      return a.user.fullName.localeCompare(b.user.fullName, "es");
    });

  const changeFormation = async (key: string) => {
    if (key === formationKey) return;
    setBusy("formation");
    setError(null);
    setNotice(null);
    try {
      const res = await api<MatchWithLineupResponse>(
        `/api/matches/${matchId}/formation`,
        {
          method: "PUT",
          json: { formation: key },
        },
      );
      setFormationKey(res.match.formation);
      setSlots(pitchSlotsFrom(res.match.formation, res.lineup, format));
      setNotice(
        `Formación ${key}: se conservaron los jugadores que siguen en pie. Revisá y guardá.`,
      );
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const suggestXi = async (compare = false) => {
    setBusy("suggest");
    setError(null);
    setNotice(null);
    try {
      const res = await api<AutoLineupResponse>(
        `/api/matches/${matchId}/lineup/auto`,
        {
          method: "POST",
          json: compare ? {} : { formation: formationKey },
        },
      );
      const key = res.formation ?? formationKey;
      setFormationKey(key);
      setSlots(pitchSlotsFrom(key, res.lineup, format));
      setBench(res.bench ?? []);
      setNotice(res.explanation);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const save = async (publish = false) => {
    setBusy(publish ? "publish" : "save");
    setError(null);
    setNotice(null);
    try {
      const payload = {
        phaseFormations,
        slots: slots.map((slot) => ({
          slotIndex: slot.slotIndex,
          playerId: slot.playerId ?? null,
          x: slot.x,
          y: slot.y,
          role: slot.role,
          label: slot.label,
        })),
      };
      if (formationKey !== formation)
        await api(`/api/matches/${matchId}/formation`, {
          method: "PUT",
          json: { formation: formationKey },
        });
      await api<LineupResponse>(`/api/matches/${matchId}/lineup`, {
        method: "PUT",
        json: payload,
      });
      if (publish)
        await api(`/api/matches/${matchId}/lineup/publish`, { method: "POST" });
      setNotice(
        publish
          ? "Alineación publicada. Los jugadores ya pueden consultar sus posiciones."
          : "Borrador guardado. Publícalo cuando esté listo para el equipo.",
      );
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const assignPlayer = () => {
    if (!pendingSlot) return;
    const playerId = selectedPlayerId ? Number(selectedPlayerId) : null;
    const found = playerId
      ? players.find((item) => item.player.id === playerId)
      : undefined;
    if (
      playerId !== null &&
      !sortedPlayers.some((item) => item.player.id === playerId)
    ) {
      setError(
        "Este jugador ya no está habilitado para el inicial. Actualiza la convocatoria.",
      );
      setPendingSlot(null);
      return;
    }
    setSlots((prev) =>
      assignLineupSlot(
        prev,
        pendingSlot.slotIndex,
        found
          ? {
              playerId: found.player.id,
              playerName: found.user.fullName,
              shirtNumber: found.player.shirtNumber,
              avatarUrl: found.user.avatarUrl,
              playerPosition: found.player.position,
            }
          : null,
      ),
    );
    setPendingSlot(null);
  };

  const openSlot = (slot: PitchSlot) => {
    setPendingSlot(slot);
    attendance.reload();
  };
  return {
    phaseFormations,
    changePhaseFormation: (phase: "ataque" | "repliegue", key: string) => {
      if (busy !== null) return;
      setPhaseFormations((previous) => ({ ...previous, [phase]: key }));
      setNotice(
        "Sistema de fase modificado. Guarda el borrador o publica para compartirlo.",
      );
    },
    openSlot,
    attendance,
    slots: slots.map((slot) => ({
      ...slot,
      refereePaymentPending:
        slot.playerId != null &&
        attendance.data?.some(
          (row) =>
            row.playerId === slot.playerId &&
            (row.referee?.outstanding ?? 0) > 0,
        ) === true,
    })),
    matchdayRoster: referee.data?.isMatchDay
      ? (attendance.data
          ?.filter((row) => row.status === "confirmado")
          .sort(
            (a, b) =>
              Number(refereePaymentCovered(b.referee)) -
                Number(refereePaymentCovered(a.referee)) ||
              a.playerName.localeCompare(b.playerName, "es"),
          ) ?? [])
      : null,
    attendanceOnlyUntil: referee.data?.attendanceOnlyUntil,
    refereeError: referee.error,
    formationKey,
    pendingSlot,
    setPendingSlot,
    selectedPlayerId,
    setSelectedPlayerId,
    busy,
    error,
    setError,
    notice,
    setNotice,
    bench,
    profile,
    formationOptions,
    playersOnPitch,
    filled,
    sortedPlayers,
    changeFormation,
    suggestXi,
    save,
    assignPlayer,
  };
}
