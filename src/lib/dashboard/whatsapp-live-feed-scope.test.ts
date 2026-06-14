import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { belongsToWorkspace } from "@/lib/dashboard/whatsapp-live-feed-scope";

describe("belongsToWorkspace", () => {
  const workspaceA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const workspaceB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

  it("includes rows in the active workspace", () => {
    assert.equal(
      belongsToWorkspace({ workspace_id: workspaceA }, workspaceA),
      true
    );
  });

  it("excludes rows from another workspace", () => {
    assert.equal(
      belongsToWorkspace({ workspace_id: workspaceB }, workspaceA),
      false
    );
  });

  it("excludes rows without workspace_id", () => {
    assert.equal(belongsToWorkspace({ workspace_id: null }, workspaceA), false);
    assert.equal(belongsToWorkspace(null, workspaceA), false);
    assert.equal(belongsToWorkspace(undefined, workspaceA), false);
  });
});
