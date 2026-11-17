import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Home,
  ShieldCheck,
  ShoppingBag,
  Truck,
} from "lucide-react";

import Modal from "@/components/Modal";
import ShoppingErrandForm from "./ShoppingErrandForm";
import PickupDeliveryErrandForm from "./PickupDeliveryErrandForm";
import DocumentDeliveryErrandForm from "./DocumentDeliveryErrandForm";
import HomeTaskErrandForm from "./HomeTaskErrandForm";

const CREATION_CATEGORIES = [
  {
    value: "shopping",
    label: "Shopping and Groceries",
    description: "Buy groceries, household supplies, personal items and other products.",
  },
  {
    value: "delivery",
    label: "Item Pickup and Delivery",
    description: "Arrange collection and delivery of packages, purchases and personal belongings.",
  },
  {
    value: "confidential",
    label: "Document and Confidential Pickup and Delivery",
    description: "Collect and deliver documents, confidential files and sensitive materials.",
  },
  {
    value: "home_help",
    label: "Home and Everyday Tasks",
    description: "Get help with practical home-related and everyday personal tasks.",
  },
];

const CATEGORY_ICONS = {
  shopping: ShoppingBag,
  delivery: Truck,
  confidential: ShieldCheck,
  home_help: Home,
};

const FORM_COMPONENTS = {
  shopping: ShoppingErrandForm,
  delivery: PickupDeliveryErrandForm,
  confidential: DocumentDeliveryErrandForm,
  home_help: HomeTaskErrandForm,
};

const cardClass = [
  "group flex min-h-[88px] w-full items-center gap-4 rounded-2xl border border-line",
  "bg-surface-white p-4 text-left transition hover:border-brand-navy hover:bg-brand-pale/40",
  "hover:shadow-erander-card focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy",
].join(" ");

/**
 * First step: select an individual-customer errand type.
 * Business Errands are created separately from the business portal.
 * Second step: mount that type's dedicated form component.
 */
export default function CreateErrandModal({
  isOpen = true,
  onClose,
  onSubmit,
  submitting = false,
}) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [step, setStep] = useState("selection");

  const FormComponent = useMemo(
    () => (selectedCategory ? FORM_COMPONENTS[selectedCategory.value] : null),
    [selectedCategory]
  );

  function selectCategory(category) {
    setSelectedCategory(category);
    setStep("form");
  }

  function returnToSelection() {
    if (submitting) return;
    setStep("selection");
    setSelectedCategory(null);
  }

  function closeModal() {
    if (submitting) return;
    if (step === "form") {
      returnToSelection();
      return;
    }
    onClose?.();
  }

  return (
    <>
      <Modal
        isOpen={isOpen && step === "selection"}
        onClose={closeModal}
        title="What would you like to get done?"
       // subtitle="Choose an errand type"
        //description="Select the type of errand you need help with. We’ll open a form designed for that type."
        icon={ArrowRight}
        size="sm"
        position="center"
       // resizable={false}
        sizeStorageKey="user.createErrandType"
      >
        <section
          aria-label="Choose an errand type"
          className="grid gap-3"
        >
          {CREATION_CATEGORIES.map((category) => {
            const Icon = CATEGORY_ICONS[category.value] || category.icon;

            return (
              <button
                key={category.value}
                type="button"
                className={cardClass}
                onClick={() => selectCategory(category)}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-pale text-brand-navy transition group-hover:bg-brand-green">
                  <Icon size={22} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-extrabold text-content">
                    {category.label}
                  </span>
                  <span className="mt-0.5 block text-sm leading-5 text-content-muted">
                    {category.description}
                  </span>
                </span>
                <ArrowRight
                  size={18}
                  className="shrink-0 text-content-subtle transition group-hover:translate-x-0.5 group-hover:text-brand-navy"
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </section>
      </Modal>

      <Modal
        isOpen={isOpen && step === "form" && Boolean(FormComponent)}
        onClose={closeModal}
        dismissible={!submitting}
        loading={submitting}
        title={selectedCategory?.label || "Create errand"}
        subtitle="Errand details"
        //description={selectedCategory?.description || "Provide the information for your errand."}
        icon={selectedCategory ? CATEGORY_ICONS[selectedCategory.value] : undefined}
        size="sm"
        position="center"
        resizable={false}
        showHandle={false}
        sizeStorageKey="user.createErrandForm"
        bodyClassName="!p-3 sm:!p-5 lg:!p-7"
      >
        {FormComponent ? (
          <div>
            <button
              type="button"
              onClick={returnToSelection}
              disabled={submitting}
              className="mb-4 inline-flex min-h-10 items-center gap-2 bg-surface-muted rounded-full px-3 py-2 text-sm font-bold text-content-muted transition hover:bg-surface-muted hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy disabled:opacity-50"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Choose a different errand type
            </button>
            <FormComponent
              mode="create"
              initialValues={{ form: { category: selectedCategory.value }, items: [] }}
              onSubmit={onSubmit}
              onCancel={returnToSelection}
              backLabel="Choose a different errand type"
            />
          </div>
        ) : null}
      </Modal>
    </>
  );
}
