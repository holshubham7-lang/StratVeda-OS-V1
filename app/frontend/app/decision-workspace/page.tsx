import { DecisionWorkspaceChat } from "./decision-workspace-chat";
import { WorkspaceAccessGate } from "../../components/workspace-access-gate";

export default function DecisionWorkspacePage() {
  return (
    <WorkspaceAccessGate>
      <DecisionWorkspaceChat />
    </WorkspaceAccessGate>
  );
}
