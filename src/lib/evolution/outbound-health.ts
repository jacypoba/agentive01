export type OutboundHealthEntry = {
  at: string;
  kind: "text" | "image" | "link" | "media";
  success: boolean;
  phoneDigits?: string;
  destinationNumber?: string;
  rawPhoneInput?: string;
  endpoint?: string;
  status?: number;
  reason?: string;
  mediaUrl?: string;
  responseBody?: string;
  evolutionMessageId?: string;
  deliveryKey?: string;
  deliveryStatus?: string;
};

type OutboundHealthState = {
  lastSuccess: OutboundHealthEntry | null;
  lastFailure: OutboundHealthEntry | null;
  recentFailures: OutboundHealthEntry[];
};

const MAX_RECENT_FAILURES = 20;

const state: OutboundHealthState = {
  lastSuccess: null,
  lastFailure: null,
  recentFailures: [],
};

export function recordOutboundSuccess(
  entry: Omit<OutboundHealthEntry, "at" | "success">
) {
  const record: OutboundHealthEntry = {
    ...entry,
    at: new Date().toISOString(),
    success: true,
  };
  state.lastSuccess = record;
}

export function recordOutboundFailure(
  entry: Omit<OutboundHealthEntry, "at" | "success">
) {
  const record: OutboundHealthEntry = {
    ...entry,
    at: new Date().toISOString(),
    success: false,
  };
  state.lastFailure = record;
  state.recentFailures = [record, ...state.recentFailures].slice(
    0,
    MAX_RECENT_FAILURES
  );
}

export function updateLastOutboundDeliveryStatus(input: {
  evolutionMessageId?: string | null;
  deliveryKey?: string | null;
  deliveryStatus: string;
}) {
  const patch = {
    deliveryStatus: input.deliveryStatus,
    evolutionMessageId: input.evolutionMessageId ?? undefined,
    deliveryKey: input.deliveryKey ?? undefined,
  };

  if (state.lastSuccess) {
    state.lastSuccess = { ...state.lastSuccess, ...patch };
  }

  if (
    state.lastFailure &&
    input.evolutionMessageId &&
    state.lastFailure.evolutionMessageId === input.evolutionMessageId
  ) {
    state.lastFailure = { ...state.lastFailure, ...patch };
  }
}

export function getOutboundHealthSnapshot(): OutboundHealthState {
  return {
    lastSuccess: state.lastSuccess,
    lastFailure: state.lastFailure,
    recentFailures: [...state.recentFailures],
  };
}
