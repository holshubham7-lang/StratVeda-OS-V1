import { DecisionCenterDashboard } from "../../components/decision-center-dashboard";
import { SessionRequired } from "../../components/session-required";

export default function ChatPage() {
  return (
    <SessionRequired>
      <DecisionCenterDashboard showChatPanel />
    </SessionRequired>
  );
}
