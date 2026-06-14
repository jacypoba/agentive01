import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildLeadAssignmentFields } from "@/lib/leads/assignment";

describe("buildLeadAssignmentFields", () => {
  it("sets user_id and assigned_user_id to the same provenance user", () => {
    const fields = buildLeadAssignmentFields("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

    assert.deepEqual(fields, {
      user_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      assigned_user_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    });
  });
});
