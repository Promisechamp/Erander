import CategoryWorkspacePanel from "../../../shared/category-workspaces/CategoryWorkspacePanel";

export default function HomeTaskManagement({ errand, sensitiveAccessAllowed = false }) {
  return <CategoryWorkspacePanel errand={errand} role="erander" sensitiveAccessAllowed={sensitiveAccessAllowed} />;
}
