import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Home,
  Info,
  LoaderCircle,
  MapPin,
  Minus,
  Package,
  Plus,
  Save,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  UserRound,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

import Modal from "@/components/Modal";
import Select from "@/components/Select";
import { getMyAddresses } from "@/services/profiles/profilesApi";

/* -------------------------------------------------------------------------- */
/*                                  CONSTANTS                                 */
/* -------------------------------------------------------------------------- */

export const CATEGORIES = [
  {
    value: "home_help",
    label: "Home and everyday tasks",
    description: "Everyday tasks that need an extra hand.",
    icon: Home,
  },
];


export const CREATION_CATEGORIES = [
  {
    value: "home_help",
    label: "Home and Everyday Tasks",
    description: "Get help with practical home-related and everyday personal tasks.",
    icon: Home,
    formHint: "Explain the task, where it needs to happen, any materials required and the expected result.",
  },
];


const CATEGORY_DETAIL_FIELDS = {
  home_help: [
    { name: "task_category", label: "Task category", placeholder: "e.g. home assistance, queueing, laundry-related task" },
    { name: "materials_needed", label: "Materials or supplies needed", placeholder: "List any materials required", multiline: true },
    { name: "materials_provided_by", label: "Who will provide the materials?", placeholder: "Customer, erander, or to be agreed" },
    { name: "expected_duration", label: "Expected task duration", placeholder: "e.g. 2 hours" },
    { name: "access_instructions", label: "Access instructions", placeholder: "Gate, floor, entry or arrival instructions", multiline: true },
  ],
};

const MAX_OFFERS = 100;

const LOCATION_TYPE_OPTIONS = [
  { value: "residential", label: "Home / Residential" },
  { value: "business", label: "Business / Office" },
  { value: "public", label: "Public location" },
  { value: "other", label: "Other" },
];

export const EMPTY_FORM = {
  title: "",
  category: "",
  description: "",
  estimated_total: "",
  customer_notes: "",
  scheduled_for: "",
  expires_at: "",
  max_erander_offers: "5",
};

export const EMPTY_ITEM = {
  item_name: "",
  quantity: "1",
  estimated_unit_price: "",
  description: "",
  customer_notes: "",
};

const EMPTY_ADDRESS = {
  label: "Home",
  location_type: "residential",
  country: "Nigeria",
  state: "",
  city: "",
  street: "",
  home_address: "",
  landmark: "",
};

const inputClass = [
  "w-full rounded-2xl border border-line bg-surface-white",
  "px-4 py-3 text-sm text-content outline-none",
  "transition duration-200 placeholder:text-content-subtle",
  "focus:border-brand-navy focus:ring-2 focus:ring-brand-pale",
  "aria-[invalid=true]:border-rose-400",
  "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-content-muted",
].join(" ");

const labelClass = "mb-2 block text-sm font-bold text-content";

const primaryButtonClass = [
  "inline-flex min-h-12 items-center justify-center gap-2",
  "rounded-full bg-brand-green px-7 py-3 text-sm font-extrabold",
  "text-brand-navy transition hover:brightness-95",
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2",
  "disabled:cursor-not-allowed disabled:opacity-60",
].join(" ");

const secondaryButtonClass = [
  "inline-flex min-h-12 items-center justify-center gap-2",
  "rounded-full border border-line bg-surface-white",
  "px-6 py-3 text-sm font-bold text-content-muted",
  "transition hover:bg-surface-muted hover:text-content",
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy",
  "disabled:cursor-not-allowed disabled:opacity-50",
].join(" ");

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

export function toLocalInput(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function getLocalDateTimeMinimum() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function toIsoDateTime(value) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

const CURRENCY_LOCALES = {
  USD: "en-US",
  NGN: "en-NG",
  GBP: "en-GB",
  EUR: "de-DE",
};

const CURRENCY_SYMBOLS = {
  USD: "$",
  NGN: "₦",
  GBP: "£",
  EUR: "€",
};

function getCurrencySymbol(currency) {
  const code = String(currency || "").trim().toUpperCase();
  return CURRENCY_SYMBOLS[code] || CURRENCY_SYMBOLS.USD;
}

function formatCurrency(value, currency = "USD") {
  const code = String(currency || "").trim().toUpperCase();
  const locale = CURRENCY_LOCALES[code] || "en-US";
  const amount = Number(value || 0);

  return amount.toLocaleString(locale, {
    style: "currency",
    currency: CURRENCY_LOCALES[code] ? code : "USD",
    maximumFractionDigits: 2,
  });
}

/**
 * Sanitises a raw input value into a whole number string between 1 and 100.
 * - Strips anything that isn't an integer digit (so `2.8` → `2`, `99.9` → `99`)
 * - Clamps anything above `MAX_OFFERS` to `MAX_OFFERS`
 * - Returns `""` for empty input so the user can clear the field
 */
function sanitizeMaxOffers(rawValue) {
  const integerPart = String(rawValue ?? "")
    .split(/[.,]/)[0]
    .replace(/\D/g, "");

  if (integerPart === "") return "";

  const parsed = parseInt(integerPart, 10);
  const clamped = Math.min(MAX_OFFERS, Math.max(1, parsed));

  return String(clamped);
}

function formatDateTime(value) {
  if (!value) return "Flexible";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";

  return date.toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function extractAddresses(response) {
  const candidates = [
    response?.data?.addresses,
    response?.data?.data?.addresses,
    response?.addresses,
    response?.data,
  ];

  return candidates.find(Array.isArray) || [];
}

const getAddressId = (address) => address?.id ?? address?.address_id ?? "";
const getAddressLabel = (address) =>
  address?.label || address?.name || "Saved address";

function getAddressDescription(address) {
  return [
    address?.home_address,
    address?.street,
    address?.landmark,
    address?.city,
    address?.state,
    address?.country,
  ]
    .filter(Boolean)
    .join(", ");
}

const isDefaultAddress = (address) =>
  address?.is_default === true ||
  address?.isDefault === true ||
  address?.is_default === "true";

/* Turns a stored errand location into the shape this form shows. */
export function getCurrentDestination(record) {
  const snapshot = record?.location_snapshot || record?.location || null;

  if (!snapshot) return null;

  if (typeof snapshot === "string") {
    return { label: "Current destination", description: snapshot };
  }

  const description =
    getAddressDescription(snapshot) ||
    snapshot.address ||
    snapshot.formatted_address ||
    snapshot.full_address ||
    snapshot.description ||
    "";

  if (!description && !snapshot.label) return null;

  return {
    label: snapshot.label || "Current destination",
    description,
  };
}

/* -------------------------------------------------------------------------- */
/*                               SMALL COMPONENTS                             */
/* -------------------------------------------------------------------------- */

function FieldError({ children }) {
  if (!children) return null;

  return (
    <p
      className="mt-1.5 text-xs font-semibold text-rose-600"
      role="alert"
      data-field-error=""
    >
      {children}
    </p>
  );
}

function FormField({ label, required = false, hint, error, htmlFor, children }) {
  return (
    <div className="min-w-0">
      {label ? (
        <label htmlFor={htmlFor} className={labelClass}>
          {label}
          {required ? (
            <>
              <span className="ml-1 text-rose-500" aria-hidden="true">
                *
              </span>
              <span className="sr-only"> (required)</span>
            </>
          ) : null}
        </label>
      ) : null}

      {children}

      {hint && !error ? (
        <p className="mt-1.5 text-xs leading-5 text-content-muted">{hint}</p>
      ) : null}

      <FieldError>{error}</FieldError>
    </div>
  );
}

/** Each part of the form is its own card with a step number. */
function FormSection({ id, step, done, title, description, children }) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-24 rounded-3xl border border-line bg-surface-white p-5 sm:p-7"
    >
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden="true"
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold transition ${
            done
              ? "bg-brand-green text-brand-navy"
              : "bg-surface-muted text-content-muted"
          }`}
        >
          {done ? <Check size={15} strokeWidth={3} /> : step}
        </span>

        <div className="min-w-0">
          <h2
            id={`${id}-title`}
            className="text-lg font-extrabold tracking-tight text-content"
          >
            {title}
          </h2>

          {description ? (
            <p className="mt-0.5 max-w-xl text-sm leading-6 text-content-muted">
              {description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-6">{children}</div>
    </section>
  );
}

function Callout({ icon: Icon = Info, tone = "brand", children }) {
  const tones = {
    brand: "border-brand-green bg-brand-pale text-success-dark",
    amber: "border-amber-400 bg-amber-50 text-amber-900",
  };

  return (
    <p
      className={`flex items-start gap-3 rounded-r-2xl border-l-4 py-3 pl-4 pr-3 text-sm leading-6 ${tones[tone]}`}
    >
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

function SummaryRow({ label, children }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <dt className="shrink-0 text-sm text-content-muted">{label}</dt>
      <dd className="min-w-0 text-sm font-semibold text-content sm:max-w-[70%] sm:text-right">
        {children}
      </dd>
    </div>
  );
}

function ChoiceTile({ selected, onClick, title, description }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={[
        "rounded-2xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy",
        selected
          ? "border-brand-navy bg-brand-pale"
          : "border-line bg-surface-white hover:border-line-strong",
      ].join(" ")}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm font-extrabold text-content">{title}</span>
        {selected ? (
          <CheckCircle2
            size={18}
            className="shrink-0 text-success-dark"
            aria-hidden="true"
          />
        ) : null}
      </span>

      <span className="mt-1 block text-xs leading-5 text-content-muted">
        {description}
      </span>
    </button>
  );
}

function Tile({ label, value, tone = "default" }) {
  return (
    <div className="min-w-0 rounded-2xl bg-surface-muted/60 px-4 py-3">
      <dt className="truncate text-xs font-semibold text-content-muted">{label}</dt>
      <dd
        className={`mt-1 truncate text-base font-extrabold tabular-nums ${
          tone === "good" ? "text-success-dark" : "text-content"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  MAIN FORM                                 */
/* -------------------------------------------------------------------------- */

export default function HomeTaskErrandForm({
  mode = "create",
  initialValues,
  currentDestination = null,
  errandMeta = null,
  editable = true,
  lockedMessage = "",
  onSubmit,
  onCancel,
  backLabel = "Back",
}) {
  const fixedCategory = "home_help";
  const { user } = useAuth();
  const isEdit = mode === "edit";

  const currency =
    user?.user_metadata?.preferred_currency ||
    user?.preferred_currency ||
    "USD";

  const currencySymbol = getCurrencySymbol(currency);

  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    ...(initialValues?.form || {}),
    ...(fixedCategory ? { category: fixedCategory } : {}),
  }));

  const [items, setItems] = useState(() =>
    Array.isArray(initialValues?.items)
      ? initialValues.items.map((item) => ({ ...EMPTY_ITEM, ...item }))
      : []
  );
  const [categoryDetails, setCategoryDetails] = useState(() => ({
    ...(initialValues?.form?.category_details || initialValues?.category_details || {}),
  }));

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const [addresses, setAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [addressesError, setAddressesError] = useState("");

  const [destinationMode, setDestinationMode] = useState(
    currentDestination ? "current" : "saved"
  );
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [newAddress, setNewAddress] = useState({ ...EMPTY_ADDRESS });
  const [saveAddress, setSaveAddress] = useState(true);
  const [makeDefaultAddress, setMakeDefaultAddress] = useState(false);

  const initialSchedule = initialValues?.form?.scheduled_for || "";
  const initialExpiry = initialValues?.form?.expires_at || "";

  const locked = !editable || submitting;
  const isShopping = form.category === "shopping";

  const selectedCategory =
    CREATION_CATEGORIES.find((category) => category.value === form.category) ||
    CATEGORIES.find((category) => category.value === form.category);

  const selectedAddress = addresses.find(
    (address) => String(getAddressId(address)) === String(selectedAddressId)
  );

  const estimatedTotal = Number(form.estimated_total);

  const totalIsValid =
    form.estimated_total.trim() !== "" &&
    Number.isFinite(estimatedTotal) &&
    estimatedTotal > 0;

  const itemSubtotal = items.reduce((total, item) => {
    const quantity = Number(item.quantity);
    const price = Number(item.estimated_unit_price);

    if (
      !Number.isFinite(quantity) ||
      !Number.isFinite(price) ||
      quantity <= 0 ||
      price < 0
    )
      return total;

    return total + quantity * price;
  }, 0);

  /* ------------------------- Load saved addresses ------------------------- */

  useEffect(() => {
    let active = true;

    async function loadAddresses() {
      setAddressesLoading(true);
      setAddressesError("");

      try {
        const response = await getMyAddresses();
        const loaded = extractAddresses(response);

        if (!active) return;

        setAddresses(loaded);

        if (loaded.length > 0) {
          const defaultAddress = loaded.find(isDefaultAddress);
          setSelectedAddressId(
            String(getAddressId(defaultAddress || loaded[0]) || "")
          );
        }

        if (!currentDestination) {
          setDestinationMode(loaded.length > 0 ? "saved" : "new");
        }
      } catch (error) {
        if (!active) return;

        setAddresses([]);
        if (!currentDestination) setDestinationMode("new");

        setAddressesError(
          error?.message ||
            "We couldn't load your saved addresses. You can enter a new destination below."
        );
      } finally {
        if (active) setAddressesLoading(false);
      }
    }

    loadAddresses();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------ Field updates ------------------------------ */

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "", form: "" }));
  }

  function updateCategoryDetail(name, value) {
    setCategoryDetails((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [`category_${name}`]: "", form: "" }));
  }

  function handleCategoryChange(value) {
    updateField("category", value);
    setCategoryDetails({});

    if (value !== "shopping") {
      setItems([]);
      setErrors((current) => ({ ...current, items: "" }));
    }
  }

  function updateItem(index, name, value) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [name]: value } : item
      )
    );

    setErrors((current) => ({ ...current, items: "", form: "" }));
  }

  function addItem() {
    if (items.length >= 50) {
      toast.error("You can add up to 50 shopping items.");
      return;
    }

    setItems((current) => [...current, { ...EMPTY_ITEM }]);
  }

  function removeItem(index) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setErrors((current) => ({ ...current, items: "", form: "" }));
  }

  function updateAddressField(name, value) {
    setNewAddress((current) => ({ ...current, [name]: value }));

    setErrors((current) => ({
      ...current,
      [`address_${name}`]: "",
      destination: "",
      form: "",
    }));
  }

  function chooseDestinationMode(nextMode) {
    setDestinationMode(nextMode);
    setErrors((current) => ({ ...current, destination: "", form: "" }));
  }

  /* -------------------------------- Validation -------------------------------- */

  function validateDestination(nextErrors) {
    if (destinationMode === "current") return;

    if (destinationMode === "saved") {
      if (addressesLoading) {
        nextErrors.destination =
          "Please wait while your saved addresses finish loading.";
      } else if (!selectedAddressId) {
        nextErrors.destination =
          "Choose a saved destination or enter a new address.";
      } else if (!selectedAddress) {
        nextErrors.destination =
          "That saved address is no longer available. Choose another address.";
      }

      return;
    }

    const requiredAddressFields = [
      ["label", "Enter a label for this address."],
      ["country", "Enter the country."],
      ["state", "Enter the state."],
      ["city", "Enter the city."],
      ["home_address", "Enter the house number and address."],
    ];

    for (const [field, message] of requiredAddressFields) {
      if (!String(newAddress[field] || "").trim()) {
        nextErrors[`address_${field}`] = message;
      }
    }

    const limits = [
      ["label", 80, "The address label cannot exceed 80 characters."],
      ["country", 100, "The country cannot exceed 100 characters."],
      ["state", 100, "The state cannot exceed 100 characters."],
      ["city", 100, "The city cannot exceed 100 characters."],
      ["street", 200, "The street cannot exceed 200 characters."],
      ["home_address", 300, "The house address cannot exceed 300 characters."],
      ["landmark", 200, "The landmark cannot exceed 200 characters."],
    ];

    for (const [field, max, message] of limits) {
      if (String(newAddress[field] || "").trim().length > max) {
        nextErrors[`address_${field}`] = message;
      }
    }

    if (
      !LOCATION_TYPE_OPTIONS.some(
        (option) => option.value === newAddress.location_type
      )
    ) {
      nextErrors.address_location_type = "Choose a valid location type.";
    }

    if (makeDefaultAddress && !saveAddress) {
      nextErrors.destination =
        "To make this your default address, enable saving the address first.";
    }
  }

  function validateForm() {
    const nextErrors = {};

    if (form.title.trim().length < 5) {
      nextErrors.title = "Enter a title with at least 5 characters.";
    } else if (form.title.trim().length > 120) {
      nextErrors.title = "The title cannot exceed 120 characters.";
    }

    if (!form.category) nextErrors.category = "Select an errand category.";

    if (form.description.trim().length < 20) {
      nextErrors.description =
        "Describe what you need in at least 20 characters.";
    } else if (form.description.trim().length > 5000) {
      nextErrors.description = "The description cannot exceed 5,000 characters.";
    }

    if (!totalIsValid) {
      nextErrors.estimated_total = `Enter an estimated budget greater than ${currencySymbol}0.`;
    } else if (estimatedTotal > 1000000000) {
      nextErrors.estimated_total = `The estimated budget cannot exceed ${currencySymbol}1,000,000,000.`;
    }

    if (form.customer_notes.trim().length > 2000) {
      nextErrors.customer_notes =
        "Additional instructions cannot exceed 2,000 characters.";
    }

    const categoryFields = CATEGORY_DETAIL_FIELDS[form.category] || [];
    for (const field of categoryFields) {
      const value = categoryDetails[field.name];
      if (typeof value === "string" && value.trim().length > 1000) {
        nextErrors[`category_${field.name}`] = `${field.label} cannot exceed 1,000 characters.`;
      }
    }
    if (form.category === "delivery" && categoryDetails.package_count) {
      const packageCount = Number(categoryDetails.package_count);
      if (!Number.isInteger(packageCount) || packageCount < 1 || packageCount > 10000) {
        nextErrors.category_package_count = "Enter a whole number between 1 and 10,000.";
      }
    }

    if (form.max_erander_offers.trim() === "") {
      nextErrors.max_erander_offers =
        "Enter how many offers you want to receive.";
    } else {
      const maxOffers = Number(form.max_erander_offers);

      if (
        !Number.isInteger(maxOffers) ||
        maxOffers < 1 ||
        maxOffers > MAX_OFFERS
      ) {
        nextErrors.max_erander_offers = `Enter a whole number between 1 and ${MAX_OFFERS}.`;
      }
    }

    if (form.scheduled_for) {
      const scheduledDate = new Date(form.scheduled_for);
      const unchanged = isEdit && form.scheduled_for === initialSchedule;

      if (
        Number.isNaN(scheduledDate.getTime()) ||
        (!unchanged && scheduledDate.getTime() <= Date.now())
      ) {
        nextErrors.scheduled_for = "Choose a future date and time.";
      }
    }

    if (form.expires_at) {
      const expiryDate = new Date(form.expires_at);
      const unchanged = isEdit && form.expires_at === initialExpiry;

      if (
        Number.isNaN(expiryDate.getTime()) ||
        (!unchanged && expiryDate.getTime() <= Date.now())
      ) {
        nextErrors.expires_at = "The expiry time must be in the future.";
      } else if (
        form.scheduled_for &&
        expiryDate <= new Date(form.scheduled_for)
      ) {
        nextErrors.expires_at =
          "The request must expire after its scheduled time.";
      }
    }

    validateDestination(nextErrors);

    if (isShopping) {
      if (items.length === 0) {
        nextErrors.items = "Add at least one item to your shopping list.";
      }

      const invalidItem = items.some((item) => {
        const quantity = Number(item.quantity);
        const price = Number(item.estimated_unit_price);

        return (
          !item.item_name.trim() ||
          item.item_name.trim().length > 200 ||
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          quantity > 10000 ||
          String(item.estimated_unit_price).trim() === "" ||
          !Number.isFinite(price) ||
          price < 0 ||
          price > 1000000000 ||
          item.description.trim().length > 1000 ||
          item.customer_notes.trim().length > 1000
        );
      });

      if (invalidItem) {
        nextErrors.items = `Complete each item name, quantity and estimated unit price. Prices may be ${currencySymbol}0 if unknown.`;
      }

      if (totalIsValid && itemSubtotal > estimatedTotal) {
        nextErrors.estimated_total =
          "Your shopping items exceed the total budget. Increase the budget or adjust the item prices.";
      }
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  function scrollToFirstError() {
    window.requestAnimationFrame(() => {
      document
        .querySelector('[aria-invalid="true"], [data-field-error]')
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function handleReview(event) {
    event?.preventDefault();

    if (submitting || !editable) return;

    if (!validateForm()) {
      toast.error("Please correct the highlighted fields.");
      scrollToFirstError();
      return;
    }

    setReviewing(true);
  }

  /* --------------------------------- Submit --------------------------------- */

  function buildDestinationPayload() {
    if (destinationMode === "current") return undefined;

    if (destinationMode === "saved") return { address_id: selectedAddressId };

    return {
      address: {
        label: newAddress.label.trim(),
        location_type: newAddress.location_type,
        country: newAddress.country.trim(),
        state: newAddress.state.trim(),
        city: newAddress.city.trim(),
        street: newAddress.street.trim(),
        home_address: newAddress.home_address.trim(),
        landmark: newAddress.landmark.trim(),
      },
      save_address: saveAddress,
      make_default: saveAddress && makeDefaultAddress,
    };
  }

  async function handleSubmit() {
    if (submitting || !editable) return;

    if (!validateForm()) {
      setReviewing(false);
      toast.error("Please correct the highlighted fields.");
      scrollToFirstError();
      return;
    }

    const destination = buildDestinationPayload();

    const payload = {
      title: form.title.trim(),
      category: form.category,
      category_details: Object.fromEntries(
        Object.entries(categoryDetails).filter(([, value]) =>
          typeof value === "boolean" ? value : String(value ?? "").trim() !== ""
        )
      ),
      description: form.description.trim(),
      currency_code: currency,
      estimated_total: estimatedTotal,
      max_erander_offers: Number(form.max_erander_offers),
      scheduled_for: toIsoDateTime(form.scheduled_for),
      expires_at: toIsoDateTime(form.expires_at),
      customer_notes: form.customer_notes.trim() || null,
      ...(destination ? { destination } : {}),
      items: isShopping
        ? items.map((item, index) => ({
            item_name: item.item_name.trim(),
            quantity: Number(item.quantity),
            unit: "item",
            estimated_unit_price: Number(item.estimated_unit_price),
            pricing_type: "flexible",
            description: item.description.trim() || null,
            customer_notes: item.customer_notes.trim() || null,
            sort_order: index,
          }))
        : [],
    };

    setSubmitting(true);

    try {
      await onSubmit(payload);
    } catch (error) {
      const message =
        error?.message ||
        (isEdit
          ? "We couldn't save your changes. Please try again."
          : "We couldn't submit your errand. Please try again.");

      toast.error(message);
      setErrors((current) => ({ ...current, form: message }));
    } finally {
      setSubmitting(false);
    }
  }

  function closeReview() {
    if (submitting) return;
    setReviewing(false);
  }

  /* ------------------------------- Progress ------------------------------- */

  const checklist = useMemo(() => {
    const detailsDone =
      form.title.trim().length >= 5 &&
      Boolean(form.category) &&
      form.description.trim().length >= 20;

    const destinationDone =
      destinationMode === "current"
        ? true
        : destinationMode === "saved"
          ? Boolean(selectedAddress)
          : ["label", "country", "state", "city", "home_address"].every(
              (field) => String(newAddress[field] || "").trim()
            );

    const itemsDone =
      items.length > 0 &&
      items.every(
        (item) =>
          item.item_name.trim() &&
          Number.isInteger(Number(item.quantity)) &&
          Number(item.quantity) >= 1 &&
          String(item.estimated_unit_price).trim() !== "" &&
          Number(item.estimated_unit_price) >= 0
      );

    const entries = [
      { id: "errand-details", label: "Errand details", done: detailsDone },
      { id: "errand-destination", label: "Destination", done: destinationDone },
      ...(isShopping
        ? [{ id: "errand-items", label: "Shopping list", done: itemsDone }]
        : []),
      { id: "errand-budget", label: "Estimated budget", done: totalIsValid },
    ];

    const completed = entries.filter((entry) => entry.done).length;

    return {
      entries,
      completed,
      percent: Math.round((completed / entries.length) * 100),
      done: Object.fromEntries(entries.map((entry) => [entry.id, entry.done])),
    };
  }, [
    form.title,
    form.category,
    form.description,
    destinationMode,
    selectedAddress,
    newAddress,
    items,
    isShopping,
    totalIsValid,
  ]);

  function scrollToSection(id) {
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const destinationSummary =
    destinationMode === "current"
      ? currentDestination
      : destinationMode === "saved"
        ? selectedAddress
          ? {
              label: getAddressLabel(selectedAddress),
              description: getAddressDescription(selectedAddress),
            }
          : null
        : {
            label: newAddress.label,
            description: getAddressDescription(newAddress),
          };

  const budgetUsage =
    totalIsValid && itemSubtotal > 0
      ? Math.min(100, (itemSubtotal / estimatedTotal) * 100)
      : 0;

  const submitLabel = isEdit ? "Review changes" : "Review request";

  // Section numbers shift when the shopping list is shown.
  const stepOf = {
    details: 1,
    destination: 2,
    items: 3,
    budget: isShopping ? 4 : 3,
    schedule: isShopping ? 5 : 4,
    notes: isShopping ? 6 : 5,
  };

  /* --------------------------------- Render --------------------------------- */

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 px-0 pb-6 sm:px-2 lg:py-8">
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-semibold text-content-muted transition hover:text-brand-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
      >
        <ArrowLeft size={17} aria-hidden="true" />
        {backLabel}
      </button>

      {/* Header */}
      <header className="rounded-3xl border border-line bg-surface-white p-5 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-brand-pale px-3 py-1 text-xs font-extrabold text-success-dark">
            {isEdit
              ? errandMeta?.reference_code
                ? `Ref ${errandMeta.reference_code}`
                : "Editing errand"
              : "New errand"}
          </span>

          {isEdit && errandMeta?.statusLabel ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1 text-xs font-bold text-content-muted">
              <Clock3 size={13} aria-hidden="true" />
              {errandMeta.statusLabel}
            </span>
          ) : null}
        </div>

        <h1 className="mt-4 max-w-3xl text-2xl font-extrabold leading-tight tracking-tight text-brand-navy sm:text-4xl">
          {isEdit ? "Edit your errand" : selectedCategory?.label || "What do you need help with?"}
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-content-muted sm:text-base">
          {isEdit
            ? "Update the request, then review your changes before saving."
            : selectedCategory?.formHint || "Describe your errand, set an estimated budget and give eranders enough information to send you good offers."}
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile
            label="Estimated budget"
            value={
              totalIsValid
                ? formatCurrency(estimatedTotal, currency)
                : "Not set yet"
            }
            tone={totalIsValid ? "good" : "default"}
          />
          <Tile
            label="Shopping items"
            value={isShopping ? items.length : "Not needed"}
          />
          <Tile label="Preferred time" value={formatDateTime(form.scheduled_for)} />
          <Tile
            label="Offers you will see"
            value={`Up to ${form.max_erander_offers || "—"}`}
          />
        </dl>
      </header>

      {!editable ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-r-2xl border-l-4 border-amber-400 bg-amber-50 p-4 sm:p-5"
        >
          <AlertCircle
            size={20}
            className="mt-0.5 shrink-0 text-amber-700"
            aria-hidden="true"
          />

          <div>
            <h2 className="font-extrabold text-amber-950">
              This errand can no longer be edited
            </h2>
            <p className="mt-1 text-sm leading-6 text-amber-900">
              {lockedMessage ||
                "Requests can only be edited before they are funded. The details below are shown for reference."}
            </p>
          </div>
        </div>
      ) : null}

      <form onSubmit={handleReview} noValidate>
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          {/* Sections */}
          <div className="min-w-0">
            <fieldset disabled={locked} className="m-0 min-w-0 space-y-5 border-0 p-0">
              <legend className="sr-only">Errand request</legend>

              {/* Details */}
              <FormSection
                id="errand-details"
                step={stepOf.details}
                done={checklist.done["errand-details"]}
                title="Errand details"
                description="Start with the essentials so the right eranders understand your request."
              >
                <div className="space-y-6">
                  <FormField
                    label="Errand title"
                    required
                    htmlFor="errand-title"
                    error={errors.title}
                    hint="Keep it clear and specific, for example Buy groceries from the local market."
                  >
                    <input
                      id="errand-title"
                      type="text"
                      value={form.title}
                      onChange={(event) => updateField("title", event.target.value)}
                      maxLength={120}
                      placeholder="What do you need done?"
                      className={inputClass}
                      aria-invalid={Boolean(errors.title)}
                    />
                    <p className="mt-1 text-right text-xs tabular-nums text-content-subtle">
                      {form.title.length}/120
                    </p>
                  </FormField>

                  {!fixedCategory ? (
                  <div>
                    <p className={labelClass} id="category-label">
                      Category
                      <span className="ml-1 text-rose-500" aria-hidden="true">
                        *
                      </span>
                      <span className="sr-only"> (required)</span>
                    </p>

                    <div
                      role="radiogroup"
                      aria-labelledby="category-label"
                      className="grid gap-3 sm:grid-cols-2"
                    >
                      {CATEGORIES.map((category) => {
                        const Icon = category.icon;
                        const selected = form.category === category.value;

                        return (
                          <button
                            key={category.value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => handleCategoryChange(category.value)}
                            className={[
                              "flex items-start gap-3 rounded-2xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy",
                              selected
                                ? "border-brand-navy bg-brand-pale"
                                : "border-line bg-surface-white hover:border-line-strong",
                            ].join(" ")}
                          >
                            <span
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                                selected
                                  ? "bg-brand-navy text-brand-mint"
                                  : "bg-surface-muted text-content-muted"
                              }`}
                            >
                              <Icon size={17} aria-hidden="true" />
                            </span>

                            <span className="min-w-0">
                              <span className="block text-sm font-extrabold text-content">
                                {category.label}
                              </span>
                              <span className="mt-0.5 block text-xs leading-5 text-content-muted">
                                {category.description}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <FieldError>{errors.category}</FieldError>
                  </div>
                  ) : (
                    <Callout icon={selectedCategory?.icon || Info}>
                      {selectedCategory?.formHint || selectedCategory?.description}
                    </Callout>
                  )}

                  <FormField
                    label="Description"
                    required
                    htmlFor="errand-description"
                    error={errors.description}
                    hint="Describe what needs to be done and include any important requirements."
                  >
                    <textarea
                      id="errand-description"
                      value={form.description}
                      onChange={(event) =>
                        updateField("description", event.target.value)
                      }
                      rows={5}
                      maxLength={5000}
                      placeholder={
                        form.category === "shopping"
                          ? "List what you need, quantities, preferred brands or acceptable alternatives..."
                          : form.category === "delivery"
                            ? "Describe the item, collection requirements and delivery instructions..."
                            : form.category === "pickup"
                              ? "Describe the document or material, authorized recipient and confidentiality requirements..."
                              : form.category === "home_help"
                                ? "Describe the task, expected result, materials and any access instructions..."
                                : form.category === "business_support"
                                  ? "Describe the business task, contacts, procurement needs and approval instructions..."
                                  : "Describe your errand in detail..."
                      }
                      className={`${inputClass} min-h-32 resize-y`}
                      aria-invalid={Boolean(errors.description)}
                    />
                    <p className="mt-1 text-right text-xs tabular-nums text-content-subtle">
                      {form.description.length}/5000
                    </p>
                  </FormField>

                  {fixedCategory && (CATEGORY_DETAIL_FIELDS[form.category] || []).length > 0 ? (
                    <div className="rounded-2xl border border-line bg-surface-muted/30 p-4 sm:p-5">
                      <div className="mb-4">
                        <h3 className="text-sm font-extrabold text-content">{selectedCategory?.label} details</h3>
                        <p className="mt-1 text-xs leading-5 text-content-muted">These details help the erander understand the specific requirements for this errand.</p>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        {(CATEGORY_DETAIL_FIELDS[form.category] || [])
                          .filter((field) => !field.dependsOn || categoryDetails[field.dependsOn] === true)
                          .map((field) => (
                            <div key={field.name} className={field.multiline ? "sm:col-span-2" : ""}>
                              {field.type === "checkbox" ? (
                                <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface-white px-4 py-3">
                                  <input
                                    type="checkbox"
                                    checked={categoryDetails[field.name] === true}
                                    onChange={(event) => updateCategoryDetail(field.name, event.target.checked)}
                                    className="h-4 w-4 rounded accent-emerald-600"
                                  />
                                  <span className="text-sm font-semibold text-content">{field.label}</span>
                                </label>
                              ) : (
                                <FormField
                                  label={field.label}
                                  htmlFor={`category-detail-${field.name}`}
                                  error={errors[`category_${field.name}`]}
                                >
                                  {field.multiline ? (
                                    <textarea
                                      id={`category-detail-${field.name}`}
                                      rows={3}
                                      maxLength={1000}
                                      value={categoryDetails[field.name] || ""}
                                      onChange={(event) => updateCategoryDetail(field.name, event.target.value)}
                                      placeholder={field.placeholder}
                                      className={`${inputClass} min-h-24 resize-y`}
                                      aria-invalid={Boolean(errors[`category_${field.name}`])}
                                    />
                                  ) : (
                                    <input
                                      id={`category-detail-${field.name}`}
                                      type="text"
                                      maxLength={1000}
                                      value={categoryDetails[field.name] || ""}
                                      onChange={(event) => updateCategoryDetail(field.name, event.target.value)}
                                      placeholder={field.placeholder}
                                      className={inputClass}
                                      aria-invalid={Boolean(errors[`category_${field.name}`])}
                                    />
                                  )}
                                </FormField>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </FormSection>

              {/* Destination */}
              <FormSection
                id="errand-destination"
                step={stepOf.destination}
                done={checklist.done["errand-destination"]}
                title="Destination address"
                description="Tell your erander where the errand should be completed or delivered."
              >
                <Callout icon={MapPin}>
                  Choose the destination carefully. The address stays with this
                  errand so the erander knows exactly where the task takes place.
                </Callout>

                {addressesLoading ? (
                  <div
                    className="mt-6 flex items-center gap-3 rounded-2xl bg-surface-muted/60 p-5 text-sm text-content-muted"
                    role="status"
                  >
                    <LoaderCircle
                      size={18}
                      className="animate-spin text-success"
                      aria-hidden="true"
                    />
                    Loading your saved addresses...
                  </div>
                ) : (
                  <>
                    {addressesError ? (
                      <div className="mt-5">
                        <Callout icon={AlertCircle} tone="amber">
                          {addressesError}
                        </Callout>
                      </div>
                    ) : null}

                    <div
                      className={`mt-6 grid gap-3 ${
                        currentDestination && addresses.length > 0
                          ? "sm:grid-cols-3"
                          : "sm:grid-cols-2"
                      }`}
                    >
                      {currentDestination ? (
                        <ChoiceTile
                          selected={destinationMode === "current"}
                          onClick={() => chooseDestinationMode("current")}
                          title="Keep current destination"
                          description="Leave the destination as it is."
                        />
                      ) : null}

                      {addresses.length > 0 ? (
                        <ChoiceTile
                          selected={destinationMode === "saved"}
                          onClick={() => chooseDestinationMode("saved")}
                          title="Use a saved address"
                          description="Pick one saved to your profile."
                        />
                      ) : null}

                      <ChoiceTile
                        selected={destinationMode === "new"}
                        onClick={() => chooseDestinationMode("new")}
                        title="Enter a new address"
                        description="Provide a destination for this request."
                      />
                    </div>

                    {destinationMode === "current" && currentDestination ? (
                      <div className="mt-5 rounded-2xl bg-surface-muted/60 p-4">
                        <p className="text-sm font-extrabold text-content">
                          {currentDestination.label}
                        </p>
                        <p className="mt-1 break-words text-sm leading-6 text-content-muted">
                          {currentDestination.description ||
                            "Address details unavailable"}
                        </p>
                      </div>
                    ) : null}

                    {destinationMode === "saved" && addresses.length > 0 ? (
                      <ul
                        className="mt-5 max-h-80 divide-y divide-line-soft overflow-y-auto rounded-2xl border border-line"
                        role="radiogroup"
                        aria-label="Saved addresses"
                      >
                        {addresses.map((address) => {
                          const addressId = String(getAddressId(address));
                          const selected = addressId === String(selectedAddressId);

                          return (
                            <li key={addressId}>
                              <label
                                className={[
                                  "flex cursor-pointer items-start gap-3 p-4 transition",
                                  selected
                                    ? "bg-brand-pale"
                                    : "bg-surface-white hover:bg-surface-muted/60",
                                ].join(" ")}
                              >
                                <input
                                  type="radio"
                                  name="destination-address"
                                  value={addressId}
                                  checked={selected}
                                  onChange={() => {
                                    setSelectedAddressId(addressId);
                                    setErrors((current) => ({
                                      ...current,
                                      destination: "",
                                      form: "",
                                    }));
                                  }}
                                  className="mt-1 h-4 w-4 accent-emerald-600"
                                />

                                <span className="min-w-0 flex-1">
                                  <span className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-extrabold text-content">
                                      {getAddressLabel(address)}
                                    </span>

                                    {isDefaultAddress(address) ? (
                                      <span className="rounded-full bg-surface-white px-2 py-0.5 text-xs font-bold text-success-dark ring-1 ring-inset ring-line">
                                        Default
                                      </span>
                                    ) : null}
                                  </span>

                                  <span className="mt-1 block break-words text-xs leading-5 text-content-muted">
                                    {getAddressDescription(address)}
                                  </span>
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}

                    {destinationMode === "new" ? (
                      <div className="mt-6 rounded-2xl bg-surface-muted/50 p-4 sm:p-6">
                        <h3 className="text-base font-extrabold text-content">
                          New destination
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-content-muted">
                          Enter a complete address so your erander can find the
                          right place.
                        </p>

                        <div className="mt-5 grid gap-5 sm:grid-cols-2">
                          <FormField
                            label="Address label"
                            required
                            htmlFor="address-label"
                            error={errors.address_label}
                            hint="For example Home, Office or Shop."
                          >
                            <input
                              id="address-label"
                              value={newAddress.label}
                              onChange={(event) =>
                                updateAddressField("label", event.target.value)
                              }
                              maxLength={80}
                              placeholder="Home"
                              className={inputClass}
                              aria-invalid={Boolean(errors.address_label)}
                            />
                          </FormField>

                          <FormField
                            label="Location type"
                            required
                            error={errors.address_location_type}
                          >
                            <Select
                              options={LOCATION_TYPE_OPTIONS}
                              value={newAddress.location_type}
                              onChange={(value) =>
                                updateAddressField(
                                  "location_type",
                                  Array.isArray(value)
                                    ? String(value[0] ?? "residential")
                                    : String(value ?? "residential")
                                )
                              }
                              placeholder="Choose location type"
                              aria-label="Location type"
                              aria-invalid={Boolean(errors.address_location_type)}
                            />
                          </FormField>

                          <FormField
                            label="Country"
                            required
                            htmlFor="address-country"
                            error={errors.address_country}
                          >
                            <input
                              id="address-country"
                              value={newAddress.country}
                              onChange={(event) =>
                                updateAddressField("country", event.target.value)
                              }
                              maxLength={100}
                              placeholder="Nigeria"
                              className={inputClass}
                              aria-invalid={Boolean(errors.address_country)}
                            />
                          </FormField>

                          <FormField
                            label="State"
                            required
                            htmlFor="address-state"
                            error={errors.address_state}
                          >
                            <input
                              id="address-state"
                              value={newAddress.state}
                              onChange={(event) =>
                                updateAddressField("state", event.target.value)
                              }
                              maxLength={100}
                              placeholder="e.g. Rivers"
                              className={inputClass}
                              aria-invalid={Boolean(errors.address_state)}
                            />
                          </FormField>

                          <FormField
                            label="City or town"
                            required
                            htmlFor="address-city"
                            error={errors.address_city}
                          >
                            <input
                              id="address-city"
                              value={newAddress.city}
                              onChange={(event) =>
                                updateAddressField("city", event.target.value)
                              }
                              maxLength={100}
                              placeholder="e.g. Port Harcourt"
                              className={inputClass}
                              aria-invalid={Boolean(errors.address_city)}
                            />
                          </FormField>

                          <FormField
                            label="Street or road"
                            htmlFor="address-street"
                            error={errors.address_street}
                          >
                            <input
                              id="address-street"
                              value={newAddress.street}
                              onChange={(event) =>
                                updateAddressField("street", event.target.value)
                              }
                              maxLength={200}
                              placeholder="Street or road name"
                              className={inputClass}
                              aria-invalid={Boolean(errors.address_street)}
                            />
                          </FormField>

                          <div className="sm:col-span-2">
                            <FormField
                              label="House number and address"
                              required
                              htmlFor="address-home"
                              error={errors.address_home_address}
                              hint="The specific building, house number, estate or unit."
                            >
                              <input
                                id="address-home"
                                value={newAddress.home_address}
                                onChange={(event) =>
                                  updateAddressField(
                                    "home_address",
                                    event.target.value
                                  )
                                }
                                maxLength={300}
                                placeholder="e.g. 12 Example Street, Rumuola"
                                className={inputClass}
                                aria-invalid={Boolean(errors.address_home_address)}
                              />
                            </FormField>
                          </div>

                          <div className="sm:col-span-2">
                            <FormField
                              label="Nearby landmark"
                              htmlFor="address-landmark"
                              error={errors.address_landmark}
                              hint="Optional. A nearby shop, junction or school."
                            >
                              <input
                                id="address-landmark"
                                value={newAddress.landmark}
                                onChange={(event) =>
                                  updateAddressField("landmark", event.target.value)
                                }
                                maxLength={200}
                                placeholder="e.g. Near the main junction"
                                className={inputClass}
                                aria-invalid={Boolean(errors.address_landmark)}
                              />
                            </FormField>
                          </div>
                        </div>

                        <div className="mt-6 space-y-3 border-t border-line pt-5">
                          <label className="flex cursor-pointer items-start gap-3">
                            <input
                              type="checkbox"
                              checked={saveAddress}
                              onChange={(event) => {
                                const checked = event.target.checked;

                                setSaveAddress(checked);
                                if (!checked) setMakeDefaultAddress(false);

                                setErrors((current) => ({
                                  ...current,
                                  destination: "",
                                  form: "",
                                }));
                              }}
                              className="mt-1 h-4 w-4 rounded accent-emerald-600"
                            />

                            <span>
                              <span className="block text-sm font-bold text-content">
                                Save this address to my profile
                              </span>
                              <span className="mt-0.5 block text-xs leading-5 text-content-muted">
                                Reuse it for future errands.
                              </span>
                            </span>
                          </label>

                          {saveAddress ? (
                            <label className="ml-7 flex cursor-pointer items-start gap-3">
                              <input
                                type="checkbox"
                                checked={makeDefaultAddress}
                                onChange={(event) => {
                                  setMakeDefaultAddress(event.target.checked);
                                  setErrors((current) => ({
                                    ...current,
                                    destination: "",
                                    form: "",
                                  }));
                                }}
                                className="mt-1 h-4 w-4 rounded accent-emerald-600"
                              />

                              <span>
                                <span className="block text-sm font-bold text-content">
                                  Make this my default address
                                </span>
                                <span className="mt-0.5 block text-xs leading-5 text-content-muted">
                                  Preselect it for future requests.
                                </span>
                              </span>
                            </label>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </>
                )}

                <FieldError>{errors.destination}</FieldError>
              </FormSection>

              {/* Shopping items */}
              {isShopping ? (
                <FormSection
                  id="errand-items"
                  step={stepOf.items}
                  done={checklist.done["errand-items"]}
                  title="Shopping list"
                  description="List the items you need and their estimated prices."
                >
                  <Callout icon={ShoppingBag}>
                    Item prices are estimates. They do not authorise spending above
                    your approved budget, and material changes should be approved
                    first.
                  </Callout>

                  {items.length > 0 ? (
                    <ul className="mt-5 space-y-3">
                      {items.map((item, index) => (
                        <li
                          key={index}
                          className="rounded-2xl border border-line bg-surface-white p-4 sm:p-5"
                        >
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <h3 className="flex min-w-0 items-center gap-2.5 text-sm font-extrabold text-content">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[11px] font-extrabold text-content-muted">
                                {index + 1}
                              </span>
                              <span className="truncate">
                                {item.item_name.trim() || `Item ${index + 1}`}
                              </span>
                            </h3>

                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              aria-label={`Remove item ${index + 1}`}
                              className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-rose-600 transition hover:bg-rose-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                            >
                              <Minus size={14} aria-hidden="true" />
                              Remove
                            </button>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                              label="Item name"
                              required
                              htmlFor={`item-name-${index}`}
                            >
                              <input
                                id={`item-name-${index}`}
                                value={item.item_name}
                                onChange={(event) =>
                                  updateItem(index, "item_name", event.target.value)
                                }
                                maxLength={200}
                                placeholder="e.g. Rice, bread or cooking oil"
                                className={inputClass}
                                aria-invalid={Boolean(
                                  errors.items && !item.item_name.trim()
                                )}
                              />
                            </FormField>

                            <FormField
                              label="Item description"
                              htmlFor={`item-description-${index}`}
                              hint="Optional brand, size, colour or specification."
                            >
                              <input
                                id={`item-description-${index}`}
                                value={item.description}
                                onChange={(event) =>
                                  updateItem(index, "description", event.target.value)
                                }
                                maxLength={1000}
                                placeholder="e.g. 5kg bag, preferred brand"
                                className={inputClass}
                              />
                            </FormField>

                            <FormField
                              label="Quantity"
                              required
                              htmlFor={`item-quantity-${index}`}
                            >
                              <input
                                id={`item-quantity-${index}`}
                                type="number"
                                min="1"
                                max="10000"
                                step="1"
                                value={item.quantity}
                                onChange={(event) =>
                                  updateItem(index, "quantity", event.target.value)
                                }
                                className={inputClass}
                                aria-invalid={Boolean(
                                  errors.items &&
                                    (!Number.isInteger(Number(item.quantity)) ||
                                      Number(item.quantity) < 1 ||
                                      Number(item.quantity) > 10000)
                                )}
                              />
                            </FormField>

                            <FormField
                              label={`Estimated unit price (${currencySymbol})`}
                              required
                              htmlFor={`item-price-${index}`}
                              hint="Enter 0 if you don't know the price yet."
                            >
                              <div className="relative">
                                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-sm font-bold text-content-subtle">
                                  {currencySymbol}
                                </span>

                                <input
                                  id={`item-price-${index}`}
                                  type="number"
                                  min="0"
                                  max="1000000000"
                                  step="0.01"
                                  value={item.estimated_unit_price}
                                  onChange={(event) =>
                                    updateItem(
                                      index,
                                      "estimated_unit_price",
                                      event.target.value
                                    )
                                  }
                                  placeholder="0.00"
                                  className={`${inputClass} pl-9`}
                                  aria-invalid={Boolean(
                                    errors.items &&
                                      (String(item.estimated_unit_price).trim() ===
                                        "" ||
                                        !Number.isFinite(
                                          Number(item.estimated_unit_price)
                                        ) ||
                                        Number(item.estimated_unit_price) < 0)
                                  )}
                                />
                              </div>
                            </FormField>

                            <div className="sm:col-span-2">
                              <FormField
                                label="Notes for the erander"
                                htmlFor={`item-notes-${index}`}
                                hint="Optional. Anything the erander should know about this item."
                              >
                                <input
                                  id={`item-notes-${index}`}
                                  value={item.customer_notes}
                                  onChange={(event) =>
                                    updateItem(
                                      index,
                                      "customer_notes",
                                      event.target.value
                                    )
                                  }
                                  maxLength={1000}
                                  placeholder="e.g. Pick the freshest ones"
                                  className={inputClass}
                                />
                              </FormField>
                            </div>
                          </div>

                          <p className="mt-4 flex items-baseline justify-between gap-4 rounded-xl bg-surface-muted/60 px-4 py-2.5 text-sm">
                            <span className="text-content-muted">
                              Estimated line total
                            </span>
                            <span className="font-extrabold tabular-nums text-content">
                              {formatCurrency(
                                Math.max(0, Number(item.quantity) || 0) *
                                  Math.max(
                                    0,
                                    Number(item.estimated_unit_price) || 0
                                  ),
                                currency
                              )}
                            </span>
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <FieldError>{errors.items}</FieldError>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={addItem}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-dashed border-brand-navy bg-brand-pale px-5 py-3 text-sm font-extrabold text-brand-navy transition hover:bg-surface-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
                    >
                      <Plus size={17} aria-hidden="true" />
                      Add shopping item
                    </button>

                    <p className="text-sm text-content-muted">
                      Items add up to{" "}
                      <span className="ml-1 text-lg font-extrabold tabular-nums text-content">
                        {formatCurrency(itemSubtotal, currency)}
                      </span>
                    </p>
                  </div>
                </FormSection>
              ) : null}

              {/* Budget */}
              <FormSection
                id="errand-budget"
                step={stepOf.budget}
                done={checklist.done["errand-budget"]}
                title="Estimated budget"
                description="Set the total amount you expect to spend on this errand."
              >
                <FormField
                  label={`Total estimated budget (${currencySymbol})`}
                  required
                  htmlFor="estimated-budget"
                  error={errors.estimated_total}
                  hint="Any service fees or other charges are shown separately."
                >
                  <div className="relative sm:max-w-sm">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-sm font-extrabold text-content-muted">
                      {currencySymbol}
                    </span>

                    <input
                      id="estimated-budget"
                      type="number"
                      min="0.01"
                      max="1000000000"
                      step="0.01"
                      value={form.estimated_total}
                      onChange={(event) =>
                        updateField("estimated_total", event.target.value)
                      }
                      placeholder="e.g. 15000"
                      className={`${inputClass} pl-9`}
                      aria-invalid={Boolean(errors.estimated_total)}
                    />
                  </div>
                </FormField>

                {isShopping && itemSubtotal > 0 ? (
                  <button
                    type="button"
                    onClick={() =>
                      updateField("estimated_total", String(itemSubtotal))
                    }
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3.5 py-2 text-xs font-bold text-content-muted transition hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
                  >
                    <ClipboardList size={13} aria-hidden="true" />
                    Use items total ({formatCurrency(itemSubtotal, currency)})
                  </button>
                ) : null}

                {isShopping && totalIsValid && itemSubtotal > 0 ? (
                  <div className="mt-5 sm:max-w-sm">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-content-muted">Shopping list uses</span>
                      <span className="font-bold tabular-nums text-content">
                        {budgetUsage.toFixed(0)}% of budget
                      </span>
                    </div>

                    <div
                      className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-muted"
                      role="progressbar"
                      aria-label="Share of budget used by shopping list"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(budgetUsage)}
                    >
                      <div
                        className={`h-full rounded-full transition-[width] duration-500 ${
                          itemSubtotal > estimatedTotal
                            ? "bg-rose-500"
                            : "bg-brand-green"
                        }`}
                        style={{ width: `${budgetUsage}%` }}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="mt-5">
                  <Callout icon={Info} tone="amber">
                    This is an estimate, not a payment. Funding and payment
                    authorisation are handled separately, and no extra spending
                    should happen without approval.
                  </Callout>
                </div>
              </FormSection>

              {/* Schedule */}
              <FormSection
                id="errand-schedule"
                step={stepOf.schedule}
                done={false}
                title="Schedule and offers"
                description="Choose when you need the errand done and how many offers you want to receive."
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <FormField
                    label="Preferred date and time"
                    htmlFor="scheduled-for"
                    error={errors.scheduled_for}
                    hint="Optional. Leave empty if your timing is flexible."
                  >
                    <div className="relative">
                      <CalendarClock
                        size={17}
                        className="pointer-events-none absolute left-3.5 top-3.5 text-content-subtle"
                        aria-hidden="true"
                      />
                      <input
                        id="scheduled-for"
                        type="datetime-local"
                        min={getLocalDateTimeMinimum()}
                        value={form.scheduled_for}
                        onChange={(event) =>
                          updateField("scheduled_for", event.target.value)
                        }
                        className={`${inputClass} pl-10`}
                        aria-invalid={Boolean(errors.scheduled_for)}
                      />
                    </div>
                  </FormField>

                  <FormField
                    label="Request expiry"
                    htmlFor="expires-at"
                    error={errors.expires_at}
                    hint="Optional. If blank, the default expiry applies."
                  >
                    <div className="relative">
                      <Clock3
                        size={17}
                        className="pointer-events-none absolute left-3.5 top-3.5 text-content-subtle"
                        aria-hidden="true"
                      />
                      <input
                        id="expires-at"
                        type="datetime-local"
                        min={getLocalDateTimeMinimum()}
                        value={form.expires_at}
                        onChange={(event) =>
                          updateField("expires_at", event.target.value)
                        }
                        className={`${inputClass} pl-10`}
                        aria-invalid={Boolean(errors.expires_at)}
                      />
                    </div>
                  </FormField>
                </div>

                <div className="mt-5 sm:max-w-xs">
                  <FormField
                    label="Maximum number of offers"
                    required
                    htmlFor="max-offers"
                    error={errors.max_erander_offers}
                    hint={`Choose how many eranders may send an offer, between 1 and ${MAX_OFFERS}. Whole numbers only.`}
                  >
                    <div className="relative">
                      <input
                        id="max-offers"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="off"
                        value={form.max_erander_offers}
                        onChange={(event) =>
                          updateField(
                            "max_erander_offers",
                            sanitizeMaxOffers(event.target.value)
                          )
                        }
                        onPaste={(event) => {
                          // Replace paste content with the sanitised value
                          // so pasted `2.8` or `150` never appears in the field.
                          event.preventDefault();
                          updateField(
                            "max_erander_offers",
                            sanitizeMaxOffers(
                              window.clipboardData?.getData("text") ??
                                event.clipboardData?.getData("text") ??
                                ""
                            )
                          );
                        }}
                        placeholder="e.g. 5"
                        maxLength={3}
                        className={inputClass}
                        aria-invalid={Boolean(errors.max_erander_offers)}
                      />
                    </div>
                  </FormField>
                </div>
              </FormSection>

              {/* Notes */}
              <FormSection
                id="errand-notes"
                step={stepOf.notes}
                done={false}
                title="Additional instructions"
                description="Share helpful details that make the errand easier to complete."
              >
                <FormField
                  label="Instructions for the erander"
                  htmlFor="customer-notes"
                  error={errors.customer_notes}
                  hint="Optional. Never include passwords, PINs or other sensitive information."
                >
                  <textarea
                    id="customer-notes"
                    rows={4}
                    maxLength={2000}
                    value={form.customer_notes}
                    onChange={(event) =>
                      updateField("customer_notes", event.target.value)
                    }
                    placeholder="Any additional instructions..."
                    className={`${inputClass} min-h-28 resize-y`}
                    aria-invalid={Boolean(errors.customer_notes)}
                  />
                  <p className="mt-1 text-right text-xs tabular-nums text-content-subtle">
                    {form.customer_notes.length}/2000
                  </p>
                </FormField>
              </FormSection>
            </fieldset>

            {errors.form ? (
              <div
                role="alert"
                className="mt-5 rounded-r-2xl border-l-4 border-rose-500 bg-rose-50 p-4 text-sm font-medium text-rose-900"
              >
                {errors.form}
              </div>
            ) : null}

            {/* Mobile and tablet action bar */}
            <div className="sticky bottom-3 z-10 mt-6 flex flex-col-reverse gap-3 rounded-3xl border border-line bg-surface-white/95 p-3 shadow-[0_16px_45px_rgba(9,20,38,0.14)] backdrop-blur sm:flex-row sm:items-center sm:justify-between xl:hidden">
              <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                className={secondaryButtonClass}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting || addressesLoading || !editable}
                className={primaryButtonClass}
              >
                {submitLabel}
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Live summary rail */}
          <aside className="min-w-0 space-y-5 xl:sticky xl:top-6">
            <section
              aria-label="Request progress"
              className="rounded-3xl border border-line bg-surface-white p-5 sm:p-6"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-base font-extrabold tracking-tight text-content">
                  Your request
                </h2>
                <p className="text-sm font-bold tabular-nums text-content-muted">
                  {checklist.completed} of {checklist.entries.length} ready
                </p>
              </div>

              <div
                className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-muted"
                role="progressbar"
                aria-label="Request completion"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={checklist.percent}
              >
                <div
                  className="h-full rounded-full bg-brand-green transition-[width] duration-500"
                  style={{ width: `${checklist.percent}%` }}
                />
              </div>

              <ul className="mt-3 divide-y divide-line-soft">
                {checklist.entries.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => scrollToSection(entry.id)}
                      className="flex w-full items-center gap-3 py-3 text-left text-sm font-semibold text-content transition hover:text-success-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                          entry.done
                            ? "bg-brand-green text-brand-navy"
                            : "border-2 border-dashed border-line-strong"
                        }`}
                        aria-hidden="true"
                      >
                        {entry.done ? <Check size={13} strokeWidth={3} /> : null}
                      </span>

                      <span className="flex-1">{entry.label}</span>

                      <span className="text-xs font-medium text-content-muted">
                        {entry.done ? "Ready" : "To do"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section
              aria-label="Summary"
              className="rounded-3xl border border-line bg-surface-white p-5 sm:p-6"
            >
              <h2 className="text-base font-extrabold tracking-tight text-content">
                At a glance
              </h2>

              <dl className="mt-3 divide-y divide-line-soft border-y border-line-soft">
                <div className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                  <dt className="text-content-muted">Category</dt>
                  <dd className="text-right font-semibold text-content">
                    {selectedCategory?.label || "Not chosen"}
                  </dd>
                </div>

                <div className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                  <dt className="text-content-muted">Destination</dt>
                  <dd className="min-w-0 truncate text-right font-semibold text-content">
                    {destinationSummary?.label || "Not chosen"}
                  </dd>
                </div>

                {isShopping ? (
                  <div className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                    <dt className="text-content-muted">Items subtotal</dt>
                    <dd className="font-semibold tabular-nums text-content">
                      {formatCurrency(itemSubtotal, currency)}
                    </dd>
                  </div>
                ) : null}

                <div className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                  <dt className="text-content-muted">Max offers</dt>
                  <dd className="font-semibold tabular-nums text-content">
                    {form.max_erander_offers || "—"}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex items-baseline justify-between gap-3">
                <p className="font-bold text-content">Estimated budget</p>
                <p className="text-2xl font-extrabold tracking-tight tabular-nums text-content">
                  {totalIsValid ? formatCurrency(estimatedTotal, currency) : "—"}
                </p>
              </div>

              <div className="mt-5 hidden flex-col gap-3 xl:flex">
                <button
                  type="submit"
                  disabled={submitting || addressesLoading || !editable}
                  className={`${primaryButtonClass} w-full`}
                >
                  {submitLabel}
                  <ArrowRight size={17} aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={onCancel}
                  disabled={submitting}
                  className={`${secondaryButtonClass} w-full`}
                >
                  Cancel
                </button>
              </div>
            </section>

            <section
              aria-label="Good to know"
              className="rounded-r-3xl border-l-4 border-brand-green bg-brand-pale p-5 sm:p-6"
            >
              <h2 className="flex items-center gap-2 font-extrabold text-brand-navy">
                <ShieldCheck size={18} aria-hidden="true" />
                Good to know
              </h2>

              <p className="mt-2 text-sm leading-6 text-success-dark">
                {isEdit
                  ? "You can edit a request until it is funded. After that, the agreed terms are locked."
                  : "You will review everything before it is submitted, and no payment is taken on this form."}
              </p>
            </section>
          </aside>
        </div>
      </form>

      {/* Review modal */}
      <Modal
        isOpen={reviewing}
        onClose={closeReview}
        dismissible={!submitting}
        loading={submitting}
        icon={ClipboardList}
        title={isEdit ? "Review your changes" : "Review your request"}
        subtitle={isEdit ? "Before saving" : "Before submitting"}
        description={
          isEdit
            ? "Check the details below before saving."
            : "Check the details below before submitting."
        }
        size="lg"
        position="bottom"
        sizeStorageKey="user.errandReview"
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={submitting}
              onClick={closeReview}
              className={secondaryButtonClass}
            >
              Go back and edit
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className={primaryButtonClass}
            >
              {submitting ? (
                <>
                  <LoaderCircle
                    size={16}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                  {isEdit ? "Saving..." : "Submitting..."}
                </>
              ) : isEdit ? (
                <>
                  <Save size={16} aria-hidden="true" />
                  Save changes
                </>
              ) : (
                <>
                  Submit request
                  <ArrowRight size={16} aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        }
      >
        <div className="space-y-5 pb-1">
          <div className="rounded-3xl border border-l-4 border-line border-l-success bg-surface-white p-5">
            <p className="text-xs font-semibold text-content-muted">
              Estimated total budget
            </p>
            <p className="mt-1 break-words text-3xl font-extrabold tracking-tight tabular-nums text-content sm:text-4xl">
              {formatCurrency(estimatedTotal, currency)}
            </p>
            <p className="mt-2 text-xs leading-5 text-content-muted">
              An estimate only. It does not authorise payment.
            </p>
          </div>

          <dl className="divide-y divide-line-soft border-y border-line-soft">
            <SummaryRow label="Title">{form.title}</SummaryRow>

            <SummaryRow label="Category">
              {selectedCategory?.label || "Not selected"}
            </SummaryRow>

            <SummaryRow label="Description">
              <span className="whitespace-pre-wrap break-words font-medium leading-6">
                {form.description}
              </span>
            </SummaryRow>

            <SummaryRow label="Destination">
              {destinationSummary ? (
                <div>
                  <p className="font-extrabold">{destinationSummary.label}</p>
                  <p className="mt-1 break-words font-medium leading-6 text-content-muted">
                    {destinationSummary.description}
                  </p>

                  {destinationMode === "current" ? (
                    <p className="mt-2 text-xs font-semibold text-content-muted">
                      The destination stays as it is.
                    </p>
                  ) : null}

                  {destinationMode === "new" && saveAddress ? (
                    <p className="mt-2 text-xs font-bold text-success-dark">
                      This address will be saved to your profile.
                      {makeDefaultAddress
                        ? " It will also become your default address."
                        : ""}
                    </p>
                  ) : null}

                  {destinationMode === "new" && !saveAddress ? (
                    <p className="mt-2 text-xs font-semibold text-content-muted">
                      This address will be used for this errand only.
                    </p>
                  ) : null}
                </div>
              ) : (
                "No destination selected"
              )}
            </SummaryRow>

            {isShopping ? (
              <SummaryRow label="Shopping items">
                <ul className="space-y-2">
                  {items.map((item, index) => (
                    <li
                      key={index}
                      className="flex justify-between gap-4 sm:justify-end"
                    >
                      <span className="min-w-0 break-words font-medium text-content-muted">
                        {item.quantity} × {item.item_name}
                      </span>
                      <span className="shrink-0 font-bold tabular-nums text-content">
                        {formatCurrency(
                          Number(item.quantity) *
                            Number(item.estimated_unit_price),
                          currency
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </SummaryRow>
            ) : null}

            {Object.entries(categoryDetails).some(([, value]) => value !== "" && value !== null && value !== undefined && value !== false) ? (
              <SummaryRow label="Specific requirements">
                <dl className="space-y-2">
                  {Object.entries(categoryDetails)
                    .filter(([, value]) => value !== "" && value !== null && value !== undefined && value !== false)
                    .map(([key, value]) => (
                      <div key={key}>
                        <dt className="text-xs font-semibold capitalize text-content-muted">{key.replaceAll("_", " ")}</dt>
                        <dd className="whitespace-pre-wrap break-words font-medium">{typeof value === "boolean" ? "Yes" : value}</dd>
                      </div>
                    ))}
                </dl>
              </SummaryRow>
            ) : null}

            <SummaryRow label="Maximum offers">{form.max_erander_offers}</SummaryRow>

            <SummaryRow label="Preferred schedule">
              {formatDateTime(form.scheduled_for)}
            </SummaryRow>

            {form.expires_at ? (
              <SummaryRow label="Request expiry">
                {formatDateTime(form.expires_at)}
              </SummaryRow>
            ) : null}

            {form.customer_notes.trim() ? (
              <SummaryRow label="Additional instructions">
                <span className="whitespace-pre-wrap break-words font-medium leading-6">
                  {form.customer_notes}
                </span>
              </SummaryRow>
            ) : null}
          </dl>

          <Callout icon={Wallet}>
            {isEdit
              ? "Saving these changes does not authorise a payment. Funding is handled separately."
              : "Submitting this request does not itself authorise a payment. Review any funding terms separately before authorising them."}
          </Callout>

          {errors.form ? (
            <p
              role="alert"
              className="rounded-r-2xl border-l-4 border-rose-500 bg-rose-50 p-4 text-sm font-medium text-rose-900"
            >
              {errors.form}
            </p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}