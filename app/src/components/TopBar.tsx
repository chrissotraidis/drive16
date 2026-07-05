import { ChevronDown, Download, Save, Settings } from "lucide-react";
import drive16Mark from "../assets/brand/drive16-mark.png";

export function TopBar({
  buildLabel,
  buildState,
  exportBusy,
  menuOpen,
  projectName,
  saveBusy,
  onExport,
  onOpenSettings,
  onSave,
  onToggleMenu,
}: {
  buildLabel: string;
  buildState: string;
  exportBusy: boolean;
  menuOpen: boolean;
  projectName: string;
  saveBusy: boolean;
  onExport: () => void;
  onOpenSettings: () => void;
  onSave: () => void;
  onToggleMenu: () => void;
}) {
  return (
    <header className="top-bar">
      <div className="brand-cluster">
        <img className="brand-mark" src={drive16Mark} alt="" aria-hidden="true" />
        <strong className="brand-name">Drive16</strong>
        <button
          className="project-name"
          type="button"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close project menu" : "Open project menu"}
          data-testid="project-menu-toggle"
          onClick={onToggleMenu}
        >
          <span>{projectName}</span>
          <ChevronDown size={14} />
        </button>
      </div>

      <div className="build-status" data-testid="run-status">
        <span className={`status-dot ${buildState}`} aria-hidden="true" />
        <span>{buildLabel}</span>
      </div>

      <nav className="top-actions" aria-label="Project actions">
        <button type="button" data-testid="save-project" onClick={onSave} disabled={saveBusy}>
          <Save size={15} />
          {saveBusy ? "Saving" : "Save"}
        </button>
        <button type="button" data-testid="export-rom" onClick={onExport} disabled={exportBusy}>
          <Download size={15} />
          {exportBusy ? "Exporting" : "Export"}
        </button>
        <button
          className="icon-button"
          type="button"
          aria-label="Settings"
          data-testid="agent-settings-open"
          onClick={onOpenSettings}
        >
          <Settings size={17} />
        </button>
      </nav>
    </header>
  );
}
