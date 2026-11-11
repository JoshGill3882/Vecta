import { describe, it, expect } from "vitest";

import { splitFieldErrors } from "@/src/shared/lib/field-errors";
import type { ActionFailure } from "@/src/shared/lib/result";

const FIELDS = ["title", "description", "status"] as const;

/** Builds a failed result, as an action returns it when validation fails.
 *
 * @param fieldErrors The field-keyed messages, or undefined for a failure with none.
 * @returns The failure.
 */
function failure(fieldErrors?: Record<string, string[]>): ActionFailure {
  return { ok: false, error: "Invalid input", fieldErrors };
}

describe("splitFieldErrors", () => {
  it("places an error under the field it names", () => {
    expect(splitFieldErrors(failure({ title: ["Title is required"] }), FIELDS)).toEqual({
      placed: [["title", "Title is required"]],
      remainder: null,
    });
  });

  it("places one error for each field that has one", () => {
    const { placed } = splitFieldErrors(
      failure({ title: ["Title is required"], status: ["Invalid option"] }),
      FIELDS
    );
    expect(placed).toEqual([
      ["title", "Title is required"],
      ["status", "Invalid option"],
    ]);
  });

  // A field has one message element, so a second message would have nowhere to go.
  it("places only the first message for a field", () => {
    const { placed } = splitFieldErrors(
      failure({ title: ["Title is required", "Title must be 120 characters or fewer"] }),
      FIELDS
    );
    expect(placed).toEqual([["title", "Title is required"]]);
  });

  // The failure this guards against is silence: nothing placed, nothing reported.
  describe("leaves something to report whenever an error is not placed", () => {
    it("reports the failure's own message when it names no field", () => {
      const missingId: ActionFailure = { ok: false, error: "Missing Task ID" };
      expect(splitFieldErrors(missingId, FIELDS)).toEqual({
        placed: [],
        remainder: "Missing Task ID",
      });
    });

    it("reports the failure's own message when every field's list is empty", () => {
      expect(splitFieldErrors(failure({ title: [] }), FIELDS)).toEqual({
        placed: [],
        remainder: "Invalid input",
      });
    });

    it("reports an error for a field the form does not have, with its key", () => {
      expect(splitFieldErrors(failure({ priority: ["Required"] }), FIELDS)).toEqual({
        placed: [],
        remainder: "priority: Required",
      });
    });

    it("reports every unknown field, alongside the fields it could place", () => {
      expect(
        splitFieldErrors(
          failure({ title: ["Title is required"], priority: ["Required"], owner: ["Invalid"] }),
          FIELDS
        )
      ).toEqual({
        placed: [["title", "Title is required"]],
        remainder: "priority: Required; owner: Invalid",
      });
    });
  });

  // `includes` on an array, so a key that only exists on Object.prototype cannot
  // pass as a field and be placed somewhere the form has no message element.
  it("does not mistake an inherited property name for a field", () => {
    expect(splitFieldErrors(failure({ constructor: ["Odd"] }), FIELDS)).toEqual({
      placed: [],
      remainder: "constructor: Odd",
    });
  });
});
