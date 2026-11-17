import CategoryWorkspacePanel from "../shared/category-workspaces/CategoryWorkspacePanel";
import ShoppingManagement from "./category-workspaces/shopping/ShoppingManagement";
import DeliveryManagement from "./category-workspaces/delivery/DeliveryManagement";
import ConfidentialManagement from "./category-workspaces/confidential/ConfidentialManagement";
import HomeTaskManagement from "./category-workspaces/home-help/HomeTaskManagement";
import BusinessErrandManagement from "./category-workspaces/business/BusinessErrandManagement";

const WORKSPACES = {
  shopping: ShoppingManagement,
  delivery: DeliveryManagement,
  confidential: ConfidentialManagement,
  home_help: HomeTaskManagement,
  business_support: BusinessErrandManagement,
};

export default function CustomerCategoryWorkspace({ errand }) {
  const Workspace = WORKSPACES[String(errand?.category || "").toLowerCase()];
  return Workspace
    ? <Workspace errand={errand} />
    : <CategoryWorkspacePanel errand={errand} role="customer" />;
}
