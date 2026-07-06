import {
  Download,
  FolderInput,
  Gamepad2,
  Plus,
  Save,
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
  exportBusy,
  exportResult,
  importBusy,
  importResult,
  interactiveCoreBusy,
  interactiveCoreStatus,
  projectActionNotice,
  projectSummary,
  saveBusy,
  saveResult,
  verifyBusy,
  workspacePath,
  onChooseCore,
  onClose,
  onExportRom,
  onImportRom,
  onImportTestRom,
  onNewProject,
  onOpenProject,
  onSaveProject,
  onVerify,
}: {
  exportBusy: boolean;
  exportResult?: PathResult;
  importBusy: boolean;
  importResult?: PathResult;
  interactiveCoreBusy: boolean;
  interactiveCoreStatus: CoreStatusInfo;
  projectActionNotice: ActionNotice;
  projectSummary: ProjectSummaryInfo;
  saveBusy: boolean;
  saveResult?: PathResult;
  verifyBusy: boolean;
  workspacePath?: string;
  onChooseCore: () => void;
  onClose: () => void;
  onExportRom: () => void;
  onImportRom: () => void;
  onImportTestRom: () => void;
  onNewProject: () => void;
  onOpenProject: () => void;
  onSaveProject: () => void;
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
              data-testid="menu-save-project"
              title="Copy the current project into a timestamped snapshot"
              onClick={onSaveProject}
              disabled={saveBusy}
            >
              <Save size={16} />
              {saveBusy ? "Saving Project" : "Save Project"}
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
              data-testid="menu-export-rom"
              title="Copy the current ROM to artifacts/phase3/exports so you can share it"
              onClick={onExportRom}
              disabled={exportBusy}
            >
              <Download size={16} />
              {exportBusy ? "Exporting ROM" : "Export ROM"}
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
                {workspacePath ? shortPath(workspacePath) : "Not created yet"}
              </strong>
              <span>Template</span>
              <strong title={projectSummary.projectPath}>
                {shortPath(projectSummary.projectPath)}
              </strong>
              <span>ROM</span>
              <strong title={projectSummary.romPath}>{shortPath(projectSummary.romPath)}</strong>
              <span>Saved</span>
              <strong title={saveResult?.snapshotPath ?? "Not saved yet"}>
                {saveResult?.snapshotPath ? shortPath(saveResult.snapshotPath) : "Not saved yet"}
              </strong>
              <span>Exported</span>
              <strong title={exportResult?.exportPath ?? projectSummary.exportDirectory}>
                {exportResult?.exportPath
                  ? shortPath(exportResult.exportPath)
                  : shortPath(projectSummary.exportDirectory)}
              </strong>
              <span>Imported</span>
              <strong title={importResult?.importPath ?? "No imported ROM"}>
                {importResult?.importPath ? shortPath(importResult.importPath) : "Not imported yet"}
              </strong>
              <span>Play core</span>
              <strong title={interactiveCoreStatus.jsPath ?? "Not set up"}>
                {interactiveCoreStatus.status === "available" && interactiveCoreStatus.jsPath
                  ? shortPath(interactiveCoreStatus.jsPath)
                  : "Not set up"}
              </strong>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
