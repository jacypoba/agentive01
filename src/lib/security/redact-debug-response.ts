/** Redact secrets from debug/operational API responses. */

export function redactEndpointUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const redactedPath = parsed.pathname.replace(/\/[^/]+$/, "/[redacted]");
    return `[redacted-host]${redactedPath}`;
  } catch {
    return "[redacted-url]";
  }
}

export function redactConnectionSnapshot<T extends { endpoint?: string } | null>(
  snapshot: T
): T {
  if (!snapshot) {
    return snapshot;
  }

  return {
    ...snapshot,
    endpoint: redactEndpointUrl(snapshot.endpoint) ?? undefined,
  } as T;
}

export function redactEvolutionEnvBlock(input: {
  baseUrl?: string | null;
  instanceName?: string | null;
  hasApiKey?: boolean;
  endpoint?: string | null;
}) {
  return {
    configured: Boolean(input.baseUrl && input.hasApiKey !== false),
    hasApiKey: Boolean(input.hasApiKey),
    hasInstanceName: Boolean(input.instanceName),
    endpoint: redactEndpointUrl(input.endpoint ?? input.baseUrl ?? null),
  };
}

export function redactMetaProviderBlock(input: {
  configured?: boolean;
  phoneNumberId?: string | null;
  graphApiVersion?: string | null;
}) {
  return {
    configured: Boolean(input.configured),
    phoneNumberIdConfigured: Boolean(input.phoneNumberId),
    graphApiVersion: input.graphApiVersion ?? "v21.0",
  };
}

export function redactConnectivityBlock<
  T extends { endpoint?: string | null; responseBody?: string | null }
>(connectivity: T | null): T | null {
  if (!connectivity) {
    return connectivity;
  }

  return {
    ...connectivity,
    endpoint: connectivity.endpoint
      ? redactEndpointUrl(connectivity.endpoint)
      : connectivity.endpoint,
    responseBody: connectivity.responseBody ? "[redacted]" : connectivity.responseBody,
  };
}

export function redactSendResult<
  T extends { endpoint?: string | null; responseBody?: string | null; payload?: unknown }
>(send: T | null): T | null {
  if (!send) {
    return send;
  }

  return {
    ...send,
    endpoint: send.endpoint ? redactEndpointUrl(send.endpoint) : send.endpoint,
    responseBody: send.responseBody ? "[redacted]" : send.responseBody,
  };
}
