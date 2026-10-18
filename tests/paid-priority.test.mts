import { test } from "node:test";
import assert from "node:assert/strict";
import { refereePaymentCovered } from "../backend/src/domain/referee";
import { formationsFor } from "../backend/src/domain/formations";
import {
  selectXi,
  slotScore,
  type XiCandidate,
} from "../backend/src/domain/model/performance-model";

test("priority requires the full current share covered by approved funds, not a pending receipt or partial payment", () => {
  assert.equal(refereePaymentCovered({ amount: 12000, outstanding: 0 }), true);
  for (const value of [
    null,
    undefined,
    { amount: 12000, outstanding: 1 },
    { amount: 12000, outstanding: 12000 },
    { amount: 0, outstanding: 0 },
  ])
    assert.equal(refereePaymentCovered(value), false);
});

test("paid priority survives much higher unpaid ratings in every format without changing the performance score", () => {
  for (const format of [5, 7, 8, 11] as const)
    for (const formation of formationsFor(format)) {
      const paid: XiCandidate[] = formation.slots.map((slot, index) => ({
        playerId: index + 1,
        playerName: `Cubierto ${index}`,
        shirtNumber: index,
        position: slot.role,
        predictedRating: 1,
        avgRating: 1,
        selectionPriority: 1,
      }));
      const unpaid: XiCandidate[] = paid.map((row) => ({
        ...row,
        playerId: row.playerId + 100,
        playerName: "Pendiente",
        predictedRating: 10,
        avgRating: 10,
        selectionPriority: 0,
      }));
      const candidates = [...unpaid, ...paid],
        original = structuredClone(candidates),
        selection = selectXi(formation, candidates);
      assert.equal(selection.assignments.length, format);
      assert(
        selection.assignments.every(
          (row) => row.playerId !== null && row.playerId <= format,
        ),
      );
      assert.equal(
        new Set(selection.assignments.map((row) => row.playerId)).size,
        format,
      );
      const score = selection.assignments.reduce(
        (total, row) =>
          total +
          slotScore(
            formation.slots.find((slot) => slot.slotIndex === row.slotIndex)!,
            paid.find((player) => player.playerId === row.playerId)!,
          ),
        0,
      );
      assert.equal(
        selection.totalScore,
        score,
        "payment preference must not inflate a rating or sporting score",
      );
      assert.deepEqual(candidates, original);
      const normal = paid.map(
        ({ selectionPriority: _priority, ...row }) => row,
      );
      assert.deepEqual(
        selectXi(formation, normal),
        selectXi(formation, paid),
        "equal priority preserves normal selection",
      );
    }
});

test("a paid reserve striker replaces an unpaid striker and retains a natural defense, midfield and goalkeeper", () => {
  const formation = formationsFor(8)[0];
  const candidates: XiCandidate[] = formation.slots.map((slot, index) => ({
    playerId: index + 1,
    playerName: `Jugador ${index}`,
    shirtNumber: index,
    position: slot.role,
    predictedRating: 6,
    avgRating: 6,
    selectionPriority: 0,
  }));
  const paid: XiCandidate = {
    ...candidates[7],
    playerId: 9,
    playerName: "Delantero cubierto",
    selectionPriority: 1,
  };
  const selected = selectXi(formation, [...candidates, paid]);
  assert(selected.assignments.some((slot) => slot.playerId === paid.playerId));
  assert(
    !selected.assignments.some(
      (slot) => slot.playerId === candidates[7].playerId,
    ),
  );
  const byId = new Map(
    [...candidates, paid].map((player) => [player.playerId, player]),
  );
  assert(
    selected.assignments.every(
      (row) =>
        formation.slots.find((slot) => slot.slotIndex === row.slotIndex)!
          .role === byId.get(row.playerId!)!.position,
    ),
  );
});

test("the goalkeeper stays mandatory even if all outfield players have paid and the only goalkeeper has not", () => {
  const formation = formationsFor(8)[0];
  const outfield: XiCandidate[] = Array.from({ length: 9 }, (_, index) => ({
    playerId: index + 1,
    playerName: "Cubierto",
    shirtNumber: index,
    position: "MED",
    predictedRating: 10,
    avgRating: 10,
    selectionPriority: 1,
  }));
  const keeper: XiCandidate = {
    playerId: 10,
    playerName: "Portero pendiente",
    shirtNumber: 0,
    position: "POR",
    predictedRating: 1,
    avgRating: 1,
    selectionPriority: 0,
  };
  const selected = selectXi(formation, [...outfield, keeper]);
  assert.equal(
    selected.assignments.find((row) => row.slotIndex === 0)?.playerId,
    keeper.playerId,
  );
  assert.equal(
    selected.assignments.filter(
      (row) => row.playerId !== keeper.playerId && row.playerId !== null,
    ).length,
    7,
  );
  assert.equal(
    selectXi(formation, outfield).assignments.find((row) => row.slotIndex === 0)
      ?.playerId,
    null,
  );
});
