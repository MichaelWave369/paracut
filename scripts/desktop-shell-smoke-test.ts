import {
  buildDesktopCommandList,
  canSaveDesktopProject,
  createDesktopSampleShellState,
  getDesktopShellProjectSummary,
  markDesktopShellDirty,
  setActiveDesktopPanel,
} from "../apps/desktop/src/index";

function expectEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, received ${String(actual)}.`);
  }
}

function expectTrue(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const state = createDesktopSampleShellState();
const summary = getDesktopShellProjectSummary(state);

if (!summary) throw new Error("Desktop shell should expose a project summary");

expectEqual(state.app_name, "ParaCut", "Desktop app name should match");
expectEqual(state.shell_version, "0.5.0", "Desktop shell version should match");
expectEqual(state.active_panel, "timeline", "Desktop shell should start on timeline panel");
expectEqual(state.dirty, false, "Loaded sample shell should be clean");
expectEqual(canSaveDesktopProject(state), false, "In-memory sample project should not be save-ready without a folder");

expectEqual(summary.project_id, "desktop_sample_project", "Desktop sample project ID should match");
expectEqual(summary.media_assets, 1, "Desktop summary should count media assets");
expectEqual(summary.tracks, 2, "Desktop summary should count tracks");
expectEqual(summary.clips, 1, "Desktop summary should count clips");
expectEqual(summary.render_jobs, 1, "Desktop summary should count render jobs");
expectEqual(summary.duration_seconds, 12, "Desktop summary should count timeline duration");
expectEqual(summary.receipts, 7, "Desktop sample project should include render-plan receipt lifecycle");

const commands = buildDesktopCommandList(state);
const openCommand = commands.find((command) => command.command_id === "project.open");
const saveCommand = commands.find((command) => command.command_id === "project.save");
const importCommand = commands.find((command) => command.command_id === "media.import");
const receiptsCommand = commands.find((command) => command.command_id === "receipts.view");

if (!openCommand) throw new Error("Desktop command list missing project.open");
if (!saveCommand) throw new Error("Desktop command list missing project.save");
if (!importCommand) throw new Error("Desktop command list missing media.import");
if (!receiptsCommand) throw new Error("Desktop command list missing receipts.view");

expectEqual(openCommand.enabled, true, "Open project command should always be enabled");
expectEqual(saveCommand.enabled, false, "Save command should be disabled without a folder");
expectEqual(importCommand.enabled, true, "Import media command should be enabled with a project");
expectEqual(receiptsCommand.enabled, true, "Receipt viewer command should be enabled with a project");
expectTrue(Boolean(saveCommand.reason), "Disabled save command should explain why");

const receiptPanelState = setActiveDesktopPanel(state, "receipts");
expectEqual(receiptPanelState.active_panel, "receipts", "Desktop shell should switch panels");

const dirtyState = markDesktopShellDirty(receiptPanelState, "Smoke test marked project dirty.");
expectEqual(dirtyState.dirty, true, "Dirty state should mark the project as changed");
expectEqual(dirtyState.status_message, "Smoke test marked project dirty.", "Dirty state should preserve status message");

console.log("ParaCut desktop shell smoke test passed.");
