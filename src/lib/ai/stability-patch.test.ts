import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { isStabilityPatchV1Enabled } from "@/lib/ai/stability-patch";

const ORIGINAL = process.env.STABILITY_PATCH_V1;

describe("isStabilityPatchV1Enabled", () => {
  afterEach(() => {
    if (ORIGINAL === undefined) {
      delete process.env.STABILITY_PATCH_V1;
    } else {
      process.env.STABILITY_PATCH_V1 = ORIGINAL;
    }
  });

  it("is false by default", () => {
    delete process.env.STABILITY_PATCH_V1;
    assert.equal(isStabilityPatchV1Enabled(), false);
  });

  it("is true when STABILITY_PATCH_V1=true", () => {
    process.env.STABILITY_PATCH_V1 = "true";
    assert.equal(isStabilityPatchV1Enabled(), true);
  });
});
