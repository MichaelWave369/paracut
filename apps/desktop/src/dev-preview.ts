import {
  buildDesktopCommandList,
  createDesktopSampleShellState,
  getDesktopShellProjectSummary,
} from "./index";

const state = createDesktopSampleShellState();
const summary = getDesktopShellProjectSummary(state);

console.log("ParaCut desktop shell preview");
console.log(JSON.stringify({
  active_panel: state.active_panel,
  dirty: state.dirty,
  status_message: state.status_message,
  summary,
  commands: buildDesktopCommandList(state),
}, null, 2));
