import { useMemo } from "react";
import {
  BriefcaseBusiness,
  FileLock2,
  House,
  Package,
  ShoppingBasket,
  ClipboardList,
  ShieldAlert,
} from "lucide-react";

const CATEGORY_CONFIG = {
  shopping: {
    label: "Shopping and Groceries",
    customerTitle: "Shopping instructions",
    eranderTitle: "Shopping task instructions",
    customerDescription: "Review the requested products, shopping preferences and delivery contact information.",
    eranderDescription: "Use these details to guide shopping, confirm acceptable substitutions and complete the handover.",
    icon: ShoppingBasket,
    fields: [
      ["preferred_store", "Preferred shop or store"],
      ["allow_substitutions", "Suitable substitutions allowed?", "boolean"],
      ["substitution_instructions", "Substitution instructions"],
      ["delivery_contact_name", "Delivery contact name"],
      ["delivery_contact_phone", "Delivery contact phone"],
    ],
  },
  delivery: {
    label: "Item Pickup and Delivery",
    customerTitle: "Pickup and delivery instructions",
    eranderTitle: "Collection and delivery instructions",
    customerDescription: "Check the package, collection contact and recipient information associated with this delivery.",
    eranderDescription: "Use the collection and recipient details to coordinate the handover and delivery.",
    icon: Package,
    fields: [
      ["item_category", "Item type"],
      ["package_count", "Number of items or packages"],
      ["pickup_location_instructions", "Pickup address and directions"],
      ["pickup_contact_name", "Pickup contact name"],
      ["pickup_contact_phone", "Pickup contact phone"],
      ["recipient_name", "Recipient name"],
      ["recipient_phone", "Recipient phone"],
    ],
  },
  confidential: {
    label: "Document and Confidential Delivery",
    customerTitle: "Confidential handling instructions",
    eranderTitle: "Confidential handling requirements",
    customerDescription: "Review the authorised recipient and handling requirements recorded for this errand.",
    eranderDescription: "Follow the recorded confidentiality instructions and recipient restrictions when handling this errand.",
    icon: FileLock2,
    fields: [
      ["document_type", "Document or material type"],
      ["confidentiality_level", "Confidentiality instructions"],
      ["authorized_recipient_only", "Only the named recipient may receive it", "boolean"],
      ["recipient_name", "Authorised recipient name"],
      ["recipient_phone", "Recipient phone"],
      ["signature_required", "Signature required on delivery", "boolean"],
      ["pickup_contact", "Pickup contact and instructions"],
    ],
  },
  home_help: {
    label: "Home and Everyday Tasks",
    customerTitle: "Task requirements",
    eranderTitle: "Task execution instructions",
    customerDescription: "Review the task category, materials, expected duration and access information.",
    eranderDescription: "Use the task requirements and access instructions to understand the requested work.",
    icon: House,
    fields: [
      ["task_category", "Task category"],
      ["materials_needed", "Materials or supplies needed"],
      ["materials_provided_by", "Who provides the materials?"],
      ["expected_duration", "Expected task duration"],
      ["access_instructions", "Access instructions"],
    ],
  },
  business_support: {
    label: "Business Errands",
    customerTitle: "Business task requirements",
    eranderTitle: "Business task instructions",
    customerDescription: "Review the business task, responsible contact and procurement or approval instructions.",
    eranderDescription: "Follow the business contact, procurement and approval instructions recorded for this task.",
    icon: BriefcaseBusiness,
    fields: [
      ["business_task_category", "Business task category"],
      ["business_name", "Business or organisation name"],
      ["business_contact_name", "Business contact person"],
      ["business_contact_phone", "Business contact phone"],
      ["approval_required", "Business approval required?", "boolean"],
      ["procurement_instructions", "Procurement or spending instructions"],
    ],
  },
};

function humanizeKey(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function displayValue(value) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map((item) => String(item)).join(", ");
  if (value && typeof value === "object") return JSON.stringify(value, null, 2);
  if (value === null || value === undefined || String(value).trim() === "") return "";
  return String(value);
}

export default function CategoryWorkspacePanel({
  errand,
  role = "customer",
  sensitiveAccessAllowed = false,
}) {
  const category = String(errand?.category || "other").toLowerCase();
  const config = CATEGORY_CONFIG[category];
  const isErander = role === "erander";
  const details = errand?.category_details && typeof errand.category_details === "object" && !Array.isArray(errand.category_details)
    ? errand.category_details
    : {};
  const Icon = config?.icon || ClipboardList;
  const restrictedConfidentialView = isErander && category === "confidential" && !sensitiveAccessAllowed;

  const rows = useMemo(() => {
    const known = config?.fields || [];
    const knownKeys = new Set(known.map(([key]) => key));
    const primary = known
      .filter(([key]) => Object.prototype.hasOwnProperty.call(details, key))
      .filter(([key]) => !restrictedConfidentialView || !/(recipient_name|recipient_phone|pickup_contact|contact)/i.test(key))
      .map(([key, label, type]) => ({ key, label, value: displayValue(details[key]), type }))
      .filter((row) => row.value !== "");
    const additional = Object.entries(details)
      .filter(([key]) => !knownKeys.has(key))
      .filter(([key]) => !restrictedConfidentialView)
      .map(([key, value]) => ({ key, label: humanizeKey(key), value: displayValue(value) }))
      .filter((row) => row.value !== "");
    return [...primary, ...additional];
  }, [config, details, restrictedConfidentialView]);

  const title = config
    ? (isErander ? config.eranderTitle : config.customerTitle)
    : (isErander ? "Errand-specific instructions" : "Errand requirements");
  const description = config
    ? (isErander ? config.eranderDescription : config.customerDescription)
    : "Review the additional information recorded for this errand.";

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface-white shadow-[0_2px_12px_rgba(20,33,61,0.035)]">
      <div className="flex items-start gap-3 border-b border-line px-5 py-4 sm:px-6">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-pale text-brand">
          <Icon size={19} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-content-subtle">
            {config?.label || (category === "pickup" ? "Legacy pickup errand" : "Errand category")}
          </p>
          <h2 className="mt-1 text-base font-extrabold text-content">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-content-muted">{description}</p>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {restrictedConfidentialView ? (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm leading-6 text-amber-900">
            <ShieldAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p>Recipient identity, contact information and handover contact details are withheld until this confidential errand is assigned to you.</p>
          </div>
        ) : null}
        {rows.length ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            {rows.map((row) => (
              <div key={row.key} className="min-w-0 rounded-xl bg-surface-muted/60 p-3.5">
                <dt className="text-xs font-bold text-content-muted">{row.label}</dt>
                <dd className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-content">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="rounded-xl border border-dashed border-line-strong bg-surface-muted/40 px-4 py-6 text-center">
            <p className="text-sm font-semibold text-content-muted">No additional category details were provided.</p>
            <p className="mt-1 text-xs leading-5 text-content-subtle">Refer to the errand description and customer notes for the remaining instructions.</p>
          </div>
        )}
      </div>
    </section>
  );
}
