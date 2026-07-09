import {
  FolderInput,
  Gamepad2,
  Plus,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { healthIcon, shortPath, type HealthState } from "./ui";

type ProjectSummaryInfo = {
  name: string;
  projectPath: string;
  romPath: string;
  exportDirectory: string;
  romStatus: string;
  assetRoles: ProjectAssetRoleInfo[];
};

type ProjectAssetRoleInfo = {
  role: string;
  source: string;
  symbol: string;
  status: string;
  notes: string;
  previewDataUrl?: string;
};

type ActionNotice = {
  state: HealthState;
  label: string;
  detail: string;
};

type PathResult = { snapshotPath?: string; exportPath?: string; importPath?: string };

type CoreStatusInfo = {
  status: string;
  jsPath?: string;
  acceptedExtensions: string[];
};

export function ProjectMenu({
  exportResult,
  importBusy,
  importResult,
  interactiveCoreBusy,
  interactiveCoreStatus,
  projectActionNotice,
  projectSummary,
  saveResult,
  verifyBusy,
  workspacePath,
  onChooseCore,
  onClose,
  onImportRom,
  onImportTestRom,
  onNewProject,
  onOpenProject,
  onVerify,
}: {
  exportResult?: PathResult;
  importBusy: boolean;
  importResult?: PathResult;
  interactiveCoreBusy: boolean;
  interactiveCoreStatus: CoreStatusInfo;
  projectActionNotice: ActionNotice;
  projectSummary: ProjectSummaryInfo;
  saveResult?: PathResult;
  verifyBusy: boolean;
  workspacePath?: string;
  onChooseCore: () => void;
  onClose: () => void;
  onImportRom: () => void;
  onImportTestRom: () => void;
  onNewProject: () => void;
  onOpenProject: () => void;
  onVerify: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <aside
        className="project-menu"
        aria-label="Project menu"
        data-testid="project-menu"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="project-menu-header">
          <h2>Project</h2>
          <button
            className="icon-button"
            type="button"
            aria-label="Close project menu"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="project-menu-body">
          <div
            className={`menu-action-status ${projectActionNotice.state}`}
            data-testid="menu-action-status"
          >
            {healthIcon(projectActionNotice.state)}
            <span>
              <strong>{projectActionNotice.label}</strong>
              <small>{projectActionNotice.detail}</small>
            </span>
          </div>

          <div className="menu-action-list">
            <button
              type="button"
              data-testid="menu-new-project"
              title="Reset the workspace to the blank starter template"
              onClick={onNewProject}
            >
              <Plus size={16} />
              New Project
            </button>
            <button
              type="button"
              data-testid="menu-open-project"
              title="Load the most recent saved snapshot"
              onClick={onOpenProject}
            >
              <FolderInput size={16} />
              Open Last Save
            </button>
            <button
              type="button"
              data-testid="menu-import-rom"
              title="Play a Genesis ROM file from your computer (.bin, .gen, .md, .smd)"
              onClick={onImportRom}
              disabled={importBusy}
            >
              <Upload size={16} />
              {importBusy ? "Importing ROM" : "Import ROM"}
            </button>
            <button
              type="button"
              data-testid="menu-import-test-rom"
              title="Load the built-in test ROM"
              onClick={onImportTestRom}
              disabled={importBusy}
            >
              <Upload size={16} />
              Import Test ROM
            </button>
            <button
              type="button"
              data-testid="menu-choose-core"
              title="Optional: choose your own Genesis emulator core file (.zip or .js + .wasm) instead of the streamed one"
              onClick={onChooseCore}
              disabled={interactiveCoreBusy}
            >
              <Gamepad2 size={16} />
              {interactiveCoreBusy
                ? "Setting Up Play"
                : interactiveCoreStatus.status === "available"
                  ? "Replace Play Core"
                  : "Set Up Play"}
            </button>
            <button
              type="button"
              data-testid="verify-rom"
              title="Rebuild the project and check it in the emulator (needs Docker running)"
              onClick={onVerify}
              disabled={verifyBusy}
            >
              <ShieldCheck size={16} />
              {verifyBusy ? "Verifying" : "Verify"}
            </button>
          </div>

          <div className="menu-summary" data-testid="project-summary">
            <h3>Current project</h3>
            <div className="menu-meta-grid">
              <span>Workspace</span>
              <strong
                title={
                  workspacePath
                    ? `${workspacePath} — your game's code and assets live here (src/, res/, out/rom.bin)`
                    : "Created when the agent first builds"
                }
              >
                {workspacePath ? "Active workspace" : "Created on first build"}
              </strong>
              <span>ROM</span>
              <strong title={projectSummary.romPath}>
                {projectSummary.romStatus === "ready" ? "Built and ready" : "Not built yet"}
              </strong>
              <span>Saved</span>
              <strong title={saveResult?.snapshotPath ?? "Not saved yet"}>
                {saveResult?.snapshotPath ? "Snapshot ready" : "Not saved yet"}
              </strong>
              <span>Exported</span>
              <strong title={exportResult?.exportPath ?? projectSummary.exportDirectory}>
                {exportResult?.exportPath ? "Export ready" : "Not exported yet"}
              </strong>
              <span>Imported</span>
              <strong title={importResult?.importPath ?? "No imported ROM"}>
                {importResult?.importPath ? "Imported ROM ready" : "No imported ROM"}
              </strong>
              <span>Play core</span>
              <strong title={interactiveCoreStatus.jsPath ?? "Not set up"}>
                {interactiveCoreStatus.status === "available" && interactiveCoreStatus.jsPath
                  ? "Custom core ready"
                  : "Not set up"}
              </strong>
            </div>
          </div>

          <div className="menu-summary" data-testid="project-asset-roles">
            <h3>Asset roles</h3>
            <div className="asset-role-list">
              {projectSummary.assetRoles.length > 0 ? (
                projectSummary.assetRoles.slice(0, 6).map((asset) => (
                  <div className="asset-role-row" key={`${asset.role}-${asset.symbol}`}>
                    <span className={`asset-role-state ${assetHealthState(asset.status)}`}>
                      {healthIcon(assetHealthState(asset.status))}
                    </span>
                    {asset.previewDataUrl ? (
                      <img
                        className="asset-role-thumb"
                        src={asset.previewDataUrl}
                        alt=""
                        aria-hidden="true"
                      />
                    ) : (
                      <span className="asset-role-thumb asset-role-thumb-empty" aria-hidden="true" />
                    )}
                    <span>
                      <strong>{asset.role}</strong>
                      <small title={asset.notes}>
                        {asset.source} · {shortAssetSymbol(asset.symbol)}
                        {asset.status ? ` · ${asset.status}` : ""}
                      </small>
                    </span>
                  </div>
                ))
              ) : (
                <p className="asset-role-empty">
                  ASSETS.md has no role rows yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function assetHealthState(status: string): HealthState {
  const lower = status.toLowerCase();
  if (
    lower.includes("used") ||
    lower.includes("ready") ||
    lower.includes("captured") ||
    lower.includes("pass")
  ) {
    return "ready";
  }
  if (lower.includes("missing") || lower.includes("failed") || lower.includes("silent")) {
    return "missing";
  }
  return "warning";
}

function shortAssetSymbol(symbol: string) {
  return symbol.startsWith("`") && symbol.endsWith("`")
    ? shortPath(symbol.slice(1, -1))
    : shortPath(symbol);
}
