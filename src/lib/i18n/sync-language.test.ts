import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { syncLeadPreferredLanguage } from "@/lib/i18n/sync-language";
import type { Lead } from "@/types/database";

const ORIGINAL_PATCH = process.env.STABILITY_PATCH_V1;
const LEAD_ID = "11111111-1111-1111-1111-111111111111";

function makeLead(preferredLanguage: string | null): Lead {
  return {
    id: LEAD_ID,
    user_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    assigned_user_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    workspace_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    client_name: "Test Lead",
    phone: "+351 900 000 000",
    phone_normalized: "351900000000",
    interest: "WhatsApp inquiry",
    status: "new",
    budget: null,
    preferred_area: null,
    property_type: null,
    timeline: null,
    intent_status: null,
    visit_requested: false,
    visit_datetime_text: null,
    preferred_language: preferredLanguage,
    pending_property_offer: null,
    created_at: "2026-06-14T12:00:00.000Z",
  };
}

function createLeadsUpdateMock(initialLead: Lead) {
  let updateCalled = false;
  let updatedLanguage: string | null = null;

  const supabase = {
    from(table: string) {
      assert.equal(table, "leads");

      return {
        update(payload: { preferred_language: string }) {
          updateCalled = true;
          updatedLanguage = payload.preferred_language;

          return {
            eq(_column: string, _value: string) {
              return {
                select(_columns: string) {
                  return {
                    async single() {
                      return {
                        data: {
                          ...initialLead,
                          preferred_language: payload.preferred_language,
                        },
                        error: null,
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  } as never;

  return {
    supabase,
    wasUpdated: () => updateCalled,
    updatedLanguage: () => updatedLanguage,
  };
}

describe("syncLeadPreferredLanguage persistence", () => {
  beforeEach(() => {
    process.env.STABILITY_PATCH_V1 = "true";
  });

  afterEach(() => {
    if (ORIGINAL_PATCH === undefined) {
      delete process.env.STABILITY_PATCH_V1;
    } else {
      process.env.STABILITY_PATCH_V1 = ORIGINAL_PATCH;
    }
  });

  it("persists pt for a new lead with a Portuguese greeting", async () => {
    const lead = makeLead(null);
    const mock = createLeadsUpdateMock(lead);

    const result = await syncLeadPreferredLanguage(
      mock.supabase,
      lead,
      "olá",
      []
    );

    assert.equal(mock.wasUpdated(), true);
    assert.equal(mock.updatedLanguage(), "pt");
    assert.equal(result.preferred_language, "pt");
  });

  it("persists pt for a new lead with a weak Portuguese property message", async () => {
    const lead = makeLead(null);
    const mock = createLeadsUpdateMock(lead);

    const result = await syncLeadPreferredLanguage(
      mock.supabase,
      lead,
      "casa Milano",
      []
    );

    assert.equal(mock.wasUpdated(), true);
    assert.equal(mock.updatedLanguage(), "pt");
    assert.equal(result.preferred_language, "pt");
  });

  it("persists fr for a new lead with a French message", async () => {
    const lead = makeLead(null);
    const mock = createLeadsUpdateMock(lead);

    const result = await syncLeadPreferredLanguage(
      mock.supabase,
      lead,
      "bonjour je cherche une maison à paris",
      []
    );

    assert.equal(mock.wasUpdated(), true);
    assert.equal(mock.updatedLanguage(), "fr");
    assert.equal(result.preferred_language, "fr");
  });

  it("does not persist when stored language follows sticky ambiguous rules", async () => {
    const lead = makeLead("pt");
    const mock = createLeadsUpdateMock(lead);

    const result = await syncLeadPreferredLanguage(
      mock.supabase,
      lead,
      "Apartment in Milan 800k",
      []
    );

    assert.equal(mock.wasUpdated(), false);
    assert.equal(result.preferred_language, "pt");
  });

  it("does not persist when stored language already matches", async () => {
    const lead = makeLead("pt");
    const mock = createLeadsUpdateMock(lead);

    const result = await syncLeadPreferredLanguage(
      mock.supabase,
      lead,
      "ok",
      []
    );

    assert.equal(mock.wasUpdated(), false);
    assert.equal(result.preferred_language, "pt");
  });

  it("does not treat null stored language as already-matching default pt", async () => {
    const lead = makeLead(null);
    const mock = createLeadsUpdateMock(lead);

    await syncLeadPreferredLanguage(mock.supabase, lead, "ok", []);

    assert.equal(mock.wasUpdated(), true);
    assert.equal(mock.updatedLanguage(), "pt");
  });

  it("persists supported language when stored value is unsupported", async () => {
    const lead = makeLead("de");
    const mock = createLeadsUpdateMock(lead);

    const result = await syncLeadPreferredLanguage(
      mock.supabase,
      lead,
      "olá preciso de ajuda, procuro uma casa em Milano",
      []
    );

    assert.equal(mock.wasUpdated(), true);
    assert.equal(mock.updatedLanguage(), "pt");
    assert.equal(result.preferred_language, "pt");
  });
});
