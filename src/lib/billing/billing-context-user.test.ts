import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveBillingContextUserId } from "@/lib/billing/billing-context-user";

const workspaceId = "ws-11111111-1111-1111-1111-111111111111";
const ownerId = "owner-0000-0000-0000-000000000001";
const creatorId = "creator-0000-0000-0000-000000000002";

function createSupabaseStub(responses: {
  owner?: { user_id: string } | null;
  workspace?: { created_by: string } | null;
  ownerError?: { message: string };
}) {
  return {
    from(table: string) {
      const api = {
        select() {
          return api;
        },
        eq(column: string, value: string) {
          if (table === "workspace_members" && column === "workspace_id") {
            assert.equal(value, workspaceId);
          }
          return api;
        },
        order() {
          return api;
        },
        limit() {
          return api;
        },
        async maybeSingle() {
          if (table === "workspace_members") {
            if (responses.ownerError) {
              return { data: null, error: responses.ownerError };
            }
            return { data: responses.owner ?? null, error: null };
          }

          if (table === "workspaces") {
            return { data: responses.workspace ?? null, error: null };
          }

          return { data: null, error: null };
        },
      };

      return api;
    },
  } as never;
}

describe("resolveBillingContextUserId", () => {
  it("prefers workspace owner over workspace creator", async () => {
    const userId = await resolveBillingContextUserId(
      createSupabaseStub({
        owner: { user_id: ownerId },
        workspace: { created_by: creatorId },
      }),
      workspaceId
    );

    assert.equal(userId, ownerId);
  });

  it("falls back to workspace created_by when no owner row exists", async () => {
    const userId = await resolveBillingContextUserId(
      createSupabaseStub({
        owner: null,
        workspace: { created_by: creatorId },
      }),
      workspaceId
    );

    assert.equal(userId, creatorId);
  });

  it("throws when no billing context user can be resolved", async () => {
    await assert.rejects(
      () =>
        resolveBillingContextUserId(
          createSupabaseStub({ owner: null, workspace: null }),
          workspaceId
        ),
      /No billing context user/
    );
  });
});
