import CategoryWorkspacePanel from "../../../shared/category-workspaces/CategoryWorkspacePanel";

export default function DeliveryManagement({ errand, sensitiveAccessAllowed = false }) {
  return <CategoryWorkspacePanel errand={errand} role="erander" sensitiveAccessAllowed={sensitiveAccessAllowed} />;
}
