import type {
  InteractiveCoreReadiness,
  InteractiveCoreStatus,
  PlayerProvider,
} from "./types";

export const interactiveCoreOverrideKey = "drive16.interactiveCoreStatusOverride";

const devCdnReadiness: InteractiveCoreReadiness = {
  status: "dev-only",
  policy: "dev-cdn",
  label: "Play ready",
  detail:
    "Interactive Play uses Nostalgist/RetroArch with a Genesis Plus GX core loaded from the dev CDN. Drive16 does not bundle that core.",
  verifyDetail: "Verify still uses local Genteel capture and does not depend on the interactive core.",
  setupAction:
    "For local development, keep internet access available for the Nostalgist core CDN. Public release still needs a user-supplied or replacement core policy.",
  source: "Nostalgist dev CDN",
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
  "dev-only": devCdnReadiness,
  missing: {
    status: "missing",
    policy: "disabled",
    label: "Play setup needed",
    detail:
      "Interactive Play does not have a configured Genesis core in this environment.",
    verifyDetail: "Verify still available through Genteel proof capture.",
    setupAction:
      "Run scripts/check-interactive-play-core.mjs, then use the local dev CDN path or a future user-supplied core flow.",
    source: "No interactive core",
    canPlay: false,
    releaseSafe: false,
  },
  "needs-user-action": {
    status: "needs-user-action",
    policy: "user-supplied",
    label: "Play setup needed",
    detail: "Interactive Play needs a user-supplied Genesis core before it can run.",
    verifyDetail: "Verify still available through Genteel proof capture.",
    setupAction: "Choose a compatible core path once the user-supplied core flow lands.",
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

export function detectInteractiveCoreReadiness(): InteractiveCoreReadiness {
  if (typeof window === "undefined") {
    return readinessByOverride.unsupported;
  }

  const override = readStatusOverride();
  if (override) return readinessByOverride[override];

  const hasBrowserRuntime =
    typeof WebAssembly !== "undefined" &&
    typeof fetch !== "undefined" &&
    typeof Blob !== "undefined" &&
    typeof URL !== "undefined";

  if (!hasBrowserRuntime) {
    return readinessByOverride.unsupported;
  }

  return devCdnReadiness;
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
