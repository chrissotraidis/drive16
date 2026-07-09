import type { ReactNode } from "react";
import { Activity, AlertCircle, CheckCircle2, Circle } from "lucide-react";

export type HealthState = "ready" | "warning" | "missing";
export type ConnectionState = HealthState | "idle" | "testing" | "starting";

export const defaultComfyUiCheckpoint = "sd_xl_base_1.0.safetensors";
export const defaultComfyUiLora = "pixel-art-xl.safetensors";

export function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="section-title">
      {icon}
      <h3>{title}</h3>
    </div>
  );
}

export function healthIcon(state: HealthState) {
  if (state === "ready") return <CheckCircle2 size={15} />;
  if (state === "missing") return <AlertCircle size={15} />;
  return <Activity size={15} />;
}

export function connectionIcon(state: ConnectionState) {
  if (state === "ready") return <CheckCircle2 size={15} />;
  if (state === "missing") return <AlertCircle size={15} />;
  if (state === "testing" || state === "starting") return <Activity size={15} />;
  return <Circle size={15} />;
}

export function connectionLabel(state: ConnectionState) {
  if (state === "ready") return "Connected";
  if (state === "missing") return "Failed";
  if (state === "testing") return "Testing";
  if (state === "starting") return "Starting";
  if (state === "warning") return "Needs attention";
  return "Not tested";
}

export function shortPath(path: string) {
  const parts = path.split("/").filter(Boolean);
  if (parts.length <= 3) return path;
  return `${parts[0]}/${parts[1]}/.../${parts[parts.length - 1]}`;
}

export function formatBytes(bytes: number) {
  if (bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function shortModelLabel(model: string) {
  const clean = model.replace(/^~/, "");
  const pathParts = clean.split("/");
  const slug = pathParts[pathParts.length - 1] ?? clean;
  return slug
    .split("-")
    .filter(Boolean)
    .map((part: string) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

export function shortOllamaLabel(model: string) {
  const clean = model.trim();
  if (!clean) return "Local model";
  return clean
    .split(/[-_:/]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

export function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
