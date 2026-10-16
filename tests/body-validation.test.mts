import { test } from "node:test";
import assert from "node:assert/strict";
import { validateBody } from "../backend/src/adapters/in/rest/body-validation";
import { ValidationError } from "../backend/src/domain/errors";
import { defaultLeague } from "../backend/src/domain/standings";

test("JSON allowlists reject prototype names at every level without evaluating inherited properties", () => {
  for (const key of ["constructor", "__proto__", "toString", "valueOf"]) {
    const extra = JSON.parse(`{"${key}": {"polluted":true}}`);
    assert.throws(
      () =>
        validateBody("/auth/login", "POST", {
          email: "test@example.com",
          password: "Sample123!",
          ...extra,
        }),
      ValidationError,
    );
    const league = defaultLeague();
    assert.throws(
      () =>
        validateBody("/tournaments/1/standings", "PUT", {
          ...league,
          ...extra,
        }),
      ValidationError,
    );
    assert.throws(
      () =>
        validateBody("/tournaments/1/standings", "PUT", {
          ...league,
          rules: { ...league.rules, ...extra },
        }),
      ValidationError,
    );
    assert.throws(
      () =>
        validateBody("/tournaments/1/standings", "PUT", {
          ...league,
          results: [
            {
              id: "one",
              matchday: 1,
              home: "A",
              away: "B",
              homeGoals: 1,
              awayGoals: 0,
              status: "jugado",
              ...extra,
            },
          ],
        }),
      ValidationError,
    );
  }
  assert.equal(Object.getPrototypeOf({}).polluted, undefined);
  assert.throws(
    () =>
      validateBody(
        "/auth/login",
        "POST",
        Object.create({
          email: "inherited@example.com",
          password: "Sample123!",
        }),
      ),
    ValidationError,
  );
  assert.doesNotThrow(() =>
    validateBody("/auth/login", "POST", {
      email: "test@example.com",
      password: "Sample123!",
    }),
  );
  assert.doesNotThrow(() =>
    validateBody("/tournaments/1/standings", "PUT", defaultLeague()),
  );
});
