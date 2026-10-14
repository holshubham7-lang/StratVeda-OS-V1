import { DecisionCenterDashboard } from "../../components/decision-center-dashboard";
import { WorkspaceAccessGate } from "../../components/workspace-access-gate";

export default function DecisionCenterPage() {
  return (
    <WorkspaceAccessGate>
      <DecisionCenterDashboard />
    </WorkspaceAccessGate>
  );
}
