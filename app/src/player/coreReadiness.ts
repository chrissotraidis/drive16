import type {
  InteractiveCoreReadiness,
  InteractiveCoreStatus,
  PlayerProvider,
} from "./types";

export const interactiveCoreOverrideKey = "drive16.interactiveCoreStatusOverride";

export type InteractiveCoreStorageSummary = {
  status: string;
  detail: string;
  source: string;
  jsPath?: string | null;
  wasmPath?: string | null;
};

type DetectInteractiveCoreReadinessOptions = {
  allowDevCdn?: boolean;
  storage?: InteractiveCoreStorageSummary;
};

const streamedCoreReadiness: InteractiveCoreReadiness = {
  status: "dev-only",
  policy: "dev-cdn",
  label: "Play ready online",
  detail:
    "Interactive Play streams the Genesis Plus GX core on first use. Drive16 does not bundle that core.",
  verifyDetail: "Verify still uses local Genteel capture and does not depend on the interactive core.",
  setupAction: "Press Play ROM while online, or choose a compatible local Genesis core.",
  source: "Streamed Genesis core",
  canPlay: true,
  releaseSafe: false,
};

const readinessByOverride: Record<InteractiveCoreStatus, InteractiveCoreReadiness> = {
  available: {
    status: "available",
    policy: "user-supplied",
    label: "Play ready",
    detail: "A user-supplied interactive Genesis core is configured.",
    verifyDetail: "Verify still uses local Genteel capture.",
    setupAction: "Use Play ROM for interactive testing, or Verify for deterministic proof.",
    source: "User-supplied core",
    canPlay: true,
    releaseSafe: true,
  },
  "dev-only": streamedCoreReadiness,
  missing: {
    status: "missing",
    policy: "disabled",
    label: "Play setup needed",
    detail:
      "Play needs a user-supplied Genesis emulator core.",
    verifyDetail: "Verify still works without the Play core.",
    setupAction: "Set Up Play with a core .zip or .js + .wasm pair.",
    source: "No interactive core",
    canPlay: false,
    releaseSafe: false,
  },
  "needs-user-action": {
    status: "needs-user-action",
    policy: "user-supplied",
    label: "Play setup needed",
    detail: "Play needs a user-supplied Genesis emulator core.",
    verifyDetail: "Verify still works without the Play core.",
    setupAction: "Set Up Play with a core .zip or .js + .wasm pair.",
    source: "Waiting for user core",
    canPlay: false,
    releaseSafe: false,
  },
  unsupported: {
    status: "unsupported",
    policy: "unsupported",
    label: "Play unsupported",
    detail: "This browser environment cannot run the interactive WebAssembly core.",
    verifyDetail: "Verify still available through Genteel proof capture.",
    setupAction: "Use the desktop app or a browser with WebAssembly, fetch, Blob, and URL support.",
    source: "Browser capability check",
    canPlay: false,
    releaseSafe: false,
  },
};

export function detectInteractiveCoreReadiness({
  allowDevCdn = true,
  storage,
}: DetectInteractiveCoreReadinessOptions = {}): InteractiveCoreReadiness {
  if (typeof window === "undefined") {
    return readinessByOverride.unsupported;
  }

  const override = readStatusOverride();
  if (override) return readinessByOverride[override];

  if (storage?.status === "available") {
    return {
      ...readinessByOverride.available,
      detail: storage.detail || readinessByOverride.available.detail,
      source: storage.source || readinessByOverride.available.source,
      setupAction: storage.jsPath
        ? `Using ${storage.jsPath}${storage.wasmPath ? ` and ${storage.wasmPath}` : ""}.`
        : readinessByOverride.available.setupAction,
    };
  }

  const hasBrowserRuntime =
    typeof WebAssembly !== "undefined" &&
    typeof fetch !== "undefined" &&
    typeof Blob !== "undefined" &&
    typeof URL !== "undefined";

  if (!hasBrowserRuntime) {
    return readinessByOverride.unsupported;
  }

  if (allowDevCdn) return streamedCoreReadiness;

  return storage?.status === "missing"
    ? {
        ...readinessByOverride["needs-user-action"],
        detail: storage.detail || readinessByOverride["needs-user-action"].detail,
        source: storage.source || readinessByOverride["needs-user-action"].source,
      }
    : readinessByOverride["needs-user-action"];
}

export function playerProviderFromCoreReadiness(
  readiness: InteractiveCoreReadiness,
): PlayerProvider {
  return {
    kind: "nostalgist-retroarch",
    state: readiness.status,
    label: readiness.label,
    detail: `${readiness.detail} ${readiness.verifyDetail}`,
  };
}

export function coreLaunchFailureReadiness(detail: string): InteractiveCoreReadiness | undefined {
  if (!/core|wasm|jsdelivr|fetch|network|load/i.test(detail)) return undefined;

  return {
    ...readinessByOverride.missing,
    detail: `Interactive Play could not load the Genesis core: ${detail}`,
    source: "Launch failure",
  };
}

function readStatusOverride(): InteractiveCoreStatus | undefined {
  try {
    const stored = window.localStorage?.getItem(interactiveCoreOverrideKey);
    if (isInteractiveCoreStatus(stored)) return stored;

    const query = new URL(window.location.href).searchParams.get("core-status");
    if (isInteractiveCoreStatus(query)) return query;
  } catch {
    return undefined;
  }

  return undefined;
}

function isInteractiveCoreStatus(value: string | null): value is InteractiveCoreStatus {
  return (
    value === "available" ||
    value === "missing" ||
    value === "unsupported" ||
    value === "dev-only" ||
    value === "needs-user-action"
  );
}
