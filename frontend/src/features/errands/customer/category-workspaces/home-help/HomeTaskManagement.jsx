import CategoryWorkspacePanel from "../../../shared/category-workspaces/CategoryWorkspacePanel";

export default function HomeTaskManagement({ errand }) {
  return <CategoryWorkspacePanel errand={errand} role="customer" />;
}
