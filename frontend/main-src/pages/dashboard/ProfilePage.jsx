import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  Building2,
  Check,
  Edit3,
  Home,
  MapPin,
  Plus,
  Star,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import Modal from "@/components/Modal";

import {
  createMyAddress,
  deleteMyAddress,
  getMyAddresses,
  getMyProfile,
  setMyDefaultAddress,
  updateMyAddress,
  updateMyProfile,
} from "@/services/profiles/profilesApi";

const inputClass =
  "w-full rounded-xl border border-line bg-surface-white px-3.5 py-3 text-sm text-foreground outline-none transition placeholder:text-slate-400 focus:border-brand-green focus:ring-2 focus:ring-brand-green/15";

const labelClass =
  "mb-1.5 block text-sm font-medium text-foreground";

const buttonPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-brand-green px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";

const buttonSecondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface-white px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

const emptyAddress = {
  label: "Home",
  location_type: "residential",
  country: "Nigeria",
  state: "",
  city: "",
  street: "",
  home_address: "",
  landmark: "",
  make_default: false,
};

/* ------------------ Helpers ------------------ */

function responseData(result) {
  return result?.data ?? result ?? {};
}

function errorMessage(error, fallback) {
  return error?.message || fallback;
}

function asString(value, fallback = "") {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return String(value);
  }

  return fallback;
}

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function addressIsDefault(address) {
  return Boolean(
    address?.is_default ?? address?.make_default ?? false
  );
}

function uniqueAddressParts(parts) {
  const seen = new Set();

  return parts
    .map((part) => asString(part).trim())
    .filter(Boolean)
    .filter((part) => {
      const normalized = part.toLowerCase();

      if (seen.has(normalized)) {
        return false;
      }

      seen.add(normalized);
      return true;
    });
}

function getAddressText(address) {
  if (!address || typeof address !== "object") {
    return "No address details available";
  }

  const parts = uniqueAddressParts([
    address.home_address,
    address.street,
    address.city,
    address.state,
    address.country,
  ]);

  return parts.length
    ? parts.join(", ")
    : "No address details available";
}

function formatRoles(roles) {
  if (!Array.isArray(roles) || roles.length === 0) {
    return "Customer";
  }

  const names = roles
    .map((role) => {
      if (typeof role === "string") {
        return role.trim();
      }

      if (role && typeof role === "object") {
        return asString(
          role.name ??
            role.title ??
            role.role ??
            role.label
        ).trim();
      }

      return "";
    })
    .filter(Boolean);

  return names.length ? names.join(", ") : "Customer";
}

function toAddressForm(address) {
  return {
    label: asString(address?.label, "Home"),
    location_type: asString(
      address?.location_type,
      "residential"
    ),
    country: asString(address?.country, "Nigeria"),
    state: asString(address?.state),
    city: asString(address?.city),
    street: asString(address?.street),
    home_address: asString(address?.home_address),
    landmark: asString(address?.landmark),
    make_default: addressIsDefault(address),
  };
}

function getProfilePayload(result) {
  const data = responseData(result);

  return {
    data,
    user: data?.user ?? {},
    profile: data?.profile ?? data?.user?.profile ?? {},
  };
}

function getAddressesPayload(result) {
  const data = responseData(result);

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.addresses)) {
    return data.addresses;
  }

  if (Array.isArray(data?.data?.addresses)) {
    return data.data.addresses;
  }

  return [];
}

/* ------------------ AddressFields ------------------ */

function AddressFields({ value, onChange }) {
  function setField(field, nextValue) {
    onChange((current) => ({
      ...current,
      [field]: nextValue,
    }));
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label
          className={labelClass}
          htmlFor="address-label"
        >
          Address label
        </label>

        <input
          id="address-label"
          name="label"
          className={inputClass}
          value={value.label}
          onChange={(event) =>
            setField("label", event.target.value)
          }
          maxLength={60}
          required
          placeholder="Home, Office..."
        />
      </div>

      <div>
        <label
          className={labelClass}
          htmlFor="location-type"
        >
          Location type
        </label>

        <select
          id="location-type"
          name="location_type"
          className={inputClass}
          value={value.location_type}
          onChange={(event) =>
            setField("location_type", event.target.value)
          }
        >
          <option value="residential">Residential</option>
          <option value="business">Business</option>
          <option value="public">Public place</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div>
        <label
          className={labelClass}
          htmlFor="address-country"
        >
          Country
        </label>

        <input
          id="address-country"
          name="country"
          className={inputClass}
          value={value.country}
          onChange={(event) =>
            setField("country", event.target.value)
          }
          maxLength={100}
          required
          autoComplete="country-name"
        />
      </div>

      <div>
        <label
          className={labelClass}
          htmlFor="address-state"
        >
          State
        </label>

        <input
          id="address-state"
          name="state"
          className={inputClass}
          value={value.state}
          onChange={(event) =>
            setField("state", event.target.value)
          }
          maxLength={100}
          required
          placeholder="e.g. Rivers"
          autoComplete="address-level1"
        />
      </div>

      <div>
        <label
          className={labelClass}
          htmlFor="address-city"
        >
          City / town
        </label>

        <input
          id="address-city"
          name="city"
          className={inputClass}
          value={value.city}
          onChange={(event) =>
            setField("city", event.target.value)
          }
          maxLength={100}
          required
          placeholder="e.g. Port Harcourt"
          autoComplete="address-level2"
        />
      </div>

      <div>
        <label
          className={labelClass}
          htmlFor="address-street"
        >
          Street / road
        </label>

        <input
          id="address-street"
          name="street"
          className={inputClass}
          value={value.street}
          onChange={(event) =>
            setField("street", event.target.value)
          }
          maxLength={200}
          required
          placeholder="Street or road name"
          autoComplete="address-line1"
        />
      </div>

      <div className="sm:col-span-2">
        <label
          className={labelClass}
          htmlFor="address-home"
        >
          House number and full address
        </label>

        <input
          id="address-home"
          name="home_address"
          className={inputClass}
          value={value.home_address}
          onChange={(event) =>
            setField("home_address", event.target.value)
          }
          maxLength={300}
          required
          placeholder="House number, building, estate..."
          autoComplete="address-line2"
        />
      </div>

      <div className="sm:col-span-2">
        <label
          className={labelClass}
          htmlFor="address-landmark"
        >
          Landmark{" "}
          <span className="font-normal text-slate-500">
            (optional)
          </span>
        </label>

        <input
          id="address-landmark"
          name="landmark"
          className={inputClass}
          value={value.landmark}
          onChange={(event) =>
            setField("landmark", event.target.value)
          }
          maxLength={200}
          placeholder="Nearby landmark or directions"
        />
      </div>

      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          name="make_default"
          className="h-4 w-4 accent-emerald-500"
          checked={Boolean(value.make_default)}
          onChange={(event) =>
            setField("make_default", event.target.checked)
          }
        />

        Make this my default address
      </label>
    </div>
  );
}

/* ------------------ ProfilePage ------------------ */

export default function ProfilePage() {
  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    other_names: "",
    display_name: "",
    phone: "",
    avatar_url: "",
  });

  const [account, setAccount] = useState({
    email: "",
    created_at: "",
    account_status: "active",
    user_roles: [],
  });

  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  const [addressModalOpen, setAddressModalOpen] =
    useState(false);
  const [editingAddressId, setEditingAddressId] =
    useState(null);
  const [addressForm, setAddressForm] = useState({
    ...emptyAddress,
  });
  const [savingAddress, setSavingAddress] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingAddressId, setDeletingAddressId] =
    useState(null);
  const [settingDefaultId, setSettingDefaultId] =
    useState(null);

  const loadPage = useCallback(async () => {
    setLoading(true);

    try {
      const [profileResult, addressResult] =
        await Promise.all([
          getMyProfile(),
          getMyAddresses(),
        ]);

      const {
        data: profileData,
        user,
        profile: loadedProfile,
      } = getProfilePayload(profileResult);

      setProfile({
        first_name: asString(loadedProfile.first_name),
        last_name: asString(loadedProfile.last_name),
        other_names: asString(loadedProfile.other_names),
        display_name: asString(loadedProfile.display_name),
        phone: asString(loadedProfile.phone),
        avatar_url: asString(loadedProfile.avatar_url),
      });

      setAccount({
        email: asString(
          user.email ?? profileData.email
        ),
        created_at: asString(
          loadedProfile.created_at ?? user.created_at
        ),
        account_status: asString(
          loadedProfile.account_status,
          "active"
        ),
        user_roles: Array.isArray(
          loadedProfile.user_roles
        )
          ? loadedProfile.user_roles
          : Array.isArray(user.user_roles)
            ? user.user_roles
            : [],
      });

      setAddresses(getAddressesPayload(addressResult));
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          "Unable to load your profile."
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  async function refreshAddresses({
    silent = false,
  } = {}) {
    try {
      const result = await getMyAddresses();
      setAddresses(getAddressesPayload(result));
      return true;
    } catch (error) {
      if (!silent) {
        toast.error(
          errorMessage(
            error,
            "Unable to refresh your saved addresses."
          )
        );
      }

      return false;
    }
  }

  function changeProfile(field, value) {
    setProfile((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();

    if (
      !profile.first_name.trim() ||
      !profile.last_name.trim()
    ) {
      toast.error(
        "First name and last name are required."
      );
      return;
    }

    setSavingProfile(true);

    try {
      const result = await updateMyProfile({
        first_name: profile.first_name.trim(),
        last_name: profile.last_name.trim(),
        other_names: profile.other_names.trim(),
        display_name: profile.display_name.trim(),
        phone: profile.phone.trim(),
        avatar_url: profile.avatar_url.trim(),
      });

      const data = responseData(result);
      const updated = data.profile ?? data;

      setProfile((current) => ({
        ...current,
        first_name: asString(
          updated.first_name,
          current.first_name
        ),
        last_name: asString(
          updated.last_name,
          current.last_name
        ),
        other_names: asString(
          updated.other_names,
          current.other_names
        ),
        display_name: asString(
          updated.display_name,
          current.display_name
        ),
        phone: asString(
          updated.phone,
          current.phone
        ),
        avatar_url: asString(
          updated.avatar_url,
          current.avatar_url
        ),
      }));

      toast.success(
        "Your profile has been updated."
      );
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          "Unable to update your profile."
        )
      );
    } finally {
      setSavingProfile(false);
    }
  }

  function openNewAddress() {
    setEditingAddressId(null);
    setAddressForm({ ...emptyAddress });
    setAddressModalOpen(true);
  }

  function openEditAddress(address) {
    if (!address?.id) {
      toast.error(
        "This address cannot be edited because its ID is missing."
      );
      return;
    }

    setEditingAddressId(address.id);
    setAddressForm(toAddressForm(address));
    setAddressModalOpen(true);
  }

  function closeAddressModal() {
    if (savingAddress) {
      return;
    }

    setAddressModalOpen(false);
    setEditingAddressId(null);
    setAddressForm({ ...emptyAddress });
  }

  async function handleAddressSubmit(event) {
    event.preventDefault();

    const requiredFields = [
      "label",
      "country",
      "state",
      "city",
      "street",
      "home_address",
    ];

    const hasMissingRequiredField =
      requiredFields.some(
        (field) =>
          !String(addressForm[field] ?? "").trim()
      );

    if (hasMissingRequiredField) {
      toast.error(
        "Complete all required address fields."
      );
      return;
    }

    if (
      editingAddressId &&
      !String(editingAddressId).trim()
    ) {
      toast.error(
        "The address ID is invalid. Please reopen the address and try again."
      );
      return;
    }

    setSavingAddress(true);

    const payload = {
      label: String(
        addressForm.label ?? ""
      ).trim(),
      location_type:
        addressForm.location_type || "residential",
      country: String(
        addressForm.country ?? ""
      ).trim(),
      state: String(
        addressForm.state ?? ""
      ).trim(),
      city: String(
        addressForm.city ?? ""
      ).trim(),
      street: String(
        addressForm.street ?? ""
      ).trim(),
      home_address: String(
        addressForm.home_address ?? ""
      ).trim(),
      landmark: String(
        addressForm.landmark ?? ""
      ).trim(),
      make_default: Boolean(
        addressForm.make_default
      ),
    };

    try {
      if (editingAddressId) {
        await updateMyAddress(
          editingAddressId,
          payload
        );

        toast.success("Address updated.");
      } else {
        await createMyAddress(payload);
        toast.success("Address saved.");
      }

      setAddressModalOpen(false);
      setEditingAddressId(null);
      setAddressForm({ ...emptyAddress });

      await refreshAddresses({ silent: true });
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          "Unable to save this address."
        )
      );
    } finally {
      setSavingAddress(false);
    }
  }

  async function handleSetDefault(addressId) {
    if (!addressId) {
      toast.error(
        "This address cannot be selected because its ID is missing."
      );
      return;
    }

    setSettingDefaultId(addressId);

    try {
      await setMyDefaultAddress(addressId);

      setAddresses((current) =>
        current.map((address) => ({
          ...address,
          is_default: address.id === addressId,
          make_default: address.id === addressId,
        }))
      );

      toast.success("Default address updated.");

      await refreshAddresses({ silent: true });
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          "Unable to set the default address."
        )
      );
    } finally {
      setSettingDefaultId(null);
    }
  }

  async function handleDeleteAddress() {
    if (!deleteTarget?.id) {
      return;
    }

    const targetId = deleteTarget.id;

    setDeletingAddressId(targetId);

    try {
      await deleteMyAddress(targetId);

      setAddresses((current) =>
        current.filter(
          (address) => address.id !== targetId
        )
      );

      setDeleteTarget(null);

      toast.success("Address deleted.");

      await refreshAddresses({ silent: true });
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          "Unable to delete this address."
        )
      );
    } finally {
      setDeletingAddressId(null);
    }
  }

  const fullName = [
    profile.first_name,
    profile.other_names,
    profile.last_name,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");

  if (loading) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-5xl p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 rounded-lg bg-slate-200" />
            <div className="h-48 rounded-2xl bg-slate-100" />
            <div className="h-64 rounded-2xl bg-slate-100" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <main className="mx-auto max-w-5xl space-y-8 p-4 pb-12 sm:p-6 lg:p-8">
        <header>
          <p className="text-sm font-medium text-brand-green">
            Account settings
          </p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            My profile
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Manage your personal information and the
            addresses you use when placing errands on
            ERANDER.
          </p>
        </header>

        {/* ---------------- Personal information ---------------- */}

        <section className="rounded-2xl border border-line bg-surface-white p-5 shadow-sm sm:p-7">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <UserRound size={21} />
            </div>

            <div>
              <h2 className="font-semibold text-foreground">
                Personal information
              </h2>

              <p className="text-sm text-slate-500">
                Keep your details up to date.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleProfileSubmit}
            className="space-y-5"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  className={labelClass}
                  htmlFor="first-name"
                >
                  First name
                </label>

                <input
                  id="first-name"
                  name="first_name"
                  className={inputClass}
                  value={profile.first_name}
                  onChange={(event) =>
                    changeProfile(
                      "first_name",
                      event.target.value
                    )
                  }
                  maxLength={100}
                  autoComplete="given-name"
                  required
                />
              </div>

              <div>
                <label
                  className={labelClass}
                  htmlFor="last-name"
                >
                  Last name
                </label>

                <input
                  id="last-name"
                  name="last_name"
                  className={inputClass}
                  value={profile.last_name}
                  onChange={(event) =>
                    changeProfile(
                      "last_name",
                      event.target.value
                    )
                  }
                  maxLength={100}
                  autoComplete="family-name"
                  required
                />
              </div>

              <div>
                <label
                  className={labelClass}
                  htmlFor="other-names"
                >
                  Other names
                </label>

                <input
                  id="other-names"
                  name="other_names"
                  className={inputClass}
                  value={profile.other_names}
                  onChange={(event) =>
                    changeProfile(
                      "other_names",
                      event.target.value
                    )
                  }
                  maxLength={150}
                  autoComplete="additional-name"
                />
              </div>

              <div>
                <label
                  className={labelClass}
                  htmlFor="display-name"
                >
                  Display name
                </label>

                <input
                  id="display-name"
                  name="display_name"
                  className={inputClass}
                  value={profile.display_name}
                  onChange={(event) =>
                    changeProfile(
                      "display_name",
                      event.target.value
                    )
                  }
                  maxLength={150}
                  placeholder="Name shown on your profile"
                />
              </div>

              <div>
                <label
                  className={labelClass}
                  htmlFor="phone"
                >
                  Phone number
                </label>

                <input
                  id="phone"
                  name="phone"
                  className={inputClass}
                  type="tel"
                  value={profile.phone}
                  onChange={(event) =>
                    changeProfile(
                      "phone",
                      event.target.value
                    )
                  }
                  maxLength={30}
                  placeholder="+234..."
                  autoComplete="tel"
                />
              </div>

              <div>
                <label
                  className={labelClass}
                  htmlFor="avatar-url"
                >
                  Profile image URL
                </label>

                <input
                  id="avatar-url"
                  name="avatar_url"
                  className={inputClass}
                  type="url"
                  value={profile.avatar_url}
                  onChange={(event) =>
                    changeProfile(
                      "avatar_url",
                      event.target.value
                    )
                  }
                  maxLength={1000}
                  placeholder="https://..."
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  className={labelClass}
                  htmlFor="email"
                >
                  Email address
                </label>

                <input
                  id="email"
                  name="email"
                  type="email"
                  className={`${inputClass} cursor-not-allowed bg-slate-50`}
                  value={account.email}
                  readOnly
                  autoComplete="email"
                />

                <p className="mt-1.5 text-xs text-slate-500">
                  Email changes should be handled through
                  your account security or authentication
                  flow.
                </p>
              </div>
            </div>

            {profile.avatar_url && (
              <div className="flex items-center gap-3">
                <img
                  src={profile.avatar_url}
                  alt={
                    fullName
                      ? `${fullName} profile preview`
                      : "Profile preview"
                  }
                  className="h-14 w-14 rounded-full border border-line object-cover"
                  onError={(event) => {
                    event.currentTarget.style.display =
                      "none";
                  }}
                />

                <span className="text-sm text-slate-500">
                  Profile image preview
                </span>
              </div>
            )}

            <div className="flex justify-end border-t border-line pt-5">
              <button
                type="submit"
                className={buttonPrimary}
                disabled={savingProfile}
              >
                <Check size={16} />

                {savingProfile
                  ? "Saving..."
                  : "Save changes"}
              </button>
            </div>
          </form>
        </section>

        {/* ---------------- Saved addresses ---------------- */}

        <section className="rounded-2xl border border-line bg-surface-white p-5 shadow-sm sm:p-7">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <MapPin size={21} />
              </div>

              <div>
                <h2 className="font-semibold text-foreground">
                  Saved addresses
                </h2>

                <p className="text-sm text-slate-500">
                  Choose an address quickly when placing an
                  errand.
                </p>
              </div>
            </div>

            <button
              type="button"
              className={buttonPrimary}
              onClick={openNewAddress}
            >
              <Plus size={17} />
              Add address
            </button>
          </div>

          {addresses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line px-5 py-10 text-center">
              <MapPin
                className="mx-auto mb-3 text-slate-400"
                size={30}
              />

              <h3 className="font-semibold text-foreground">
                No saved addresses yet
              </h3>

              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                Add your home, office, or another regular
                destination to make placing errands easier.
              </p>

              <button
                type="button"
                className={`${buttonSecondary} mt-4`}
                onClick={openNewAddress}
              >
                <Plus size={16} />
                Add your first address
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {addresses.map((address) => {
                const isDefault =
                  addressIsDefault(address);

                const addressText =
                  getAddressText(address);

                return (
                  <article
                    key={address.id}
                    className={`rounded-xl border p-4 ${
                      isDefault
                        ? "border-brand-green/50 bg-emerald-50/40"
                        : "border-line"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm">
                          {address.location_type ===
                          "business" ? (
                            <Building2 size={19} />
                          ) : address.location_type ===
                            "residential" ? (
                            <Home size={19} />
                          ) : (
                            <MapPin size={19} />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-foreground">
                              {address.label ||
                                "Saved address"}
                            </h3>

                            {isDefault && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">
                                <Star size={11} />
                                Default
                              </span>
                            )}
                          </div>

                          <p className="mt-1 break-words text-sm leading-6 text-slate-600">
                            {addressText}
                          </p>

                          {address.landmark && (
                            <p className="mt-1 break-words text-xs text-slate-500">
                              Landmark: {address.landmark}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 border-t border-line/70 pt-3">
                      {!isDefault && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                          disabled={
                            settingDefaultId === address.id
                          }
                          onClick={() =>
                            handleSetDefault(address.id)
                          }
                        >
                          <Star size={14} />

                          {settingDefaultId === address.id
                            ? "Updating..."
                            : "Make default"}
                        </button>
                      )}

                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        onClick={() =>
                          openEditAddress(address)
                        }
                      >
                        <Edit3 size={14} />
                        Edit
                      </button>

                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                        onClick={() =>
                          setDeleteTarget(address)
                        }
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* ---------------- Account information ---------------- */}

        <section className="rounded-2xl border border-line bg-surface-white p-5 shadow-sm sm:p-7">
          <div className="mb-5">
            <h2 className="font-semibold text-foreground">
              Account information
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Details associated with your ERANDER account.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Account status
              </p>

              <p className="mt-2 font-semibold capitalize text-foreground">
                {account.account_status || "Active"}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Member since
              </p>

              <p className="mt-2 font-semibold text-foreground">
                {formatDate(account.created_at)}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Account roles
              </p>

              <p className="mt-2 break-words font-semibold capitalize text-foreground">
                {formatRoles(account.user_roles)}
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* ---------------- Add/Edit address modal ---------------- */}

      <Modal
        isOpen={addressModalOpen}
        onClose={closeAddressModal}
        closeOnOverlayClick={!savingAddress}
        closeOnEscape={!savingAddress}
        title={
          editingAddressId
            ? "Edit address"
            : "Add saved address"
        }
      >
        <form
          onSubmit={handleAddressSubmit}
          className="space-y-5"
        >
          <AddressFields
            value={addressForm}
            onChange={setAddressForm}
          />

          <div className="flex justify-end gap-3 border-t border-line pt-4">
            <button
              type="button"
              className={buttonSecondary}
              onClick={closeAddressModal}
              disabled={savingAddress}
            >
              <X size={16} />
              Cancel
            </button>

            <button
              type="submit"
              className={buttonPrimary}
              disabled={savingAddress}
            >
              <Check size={16} />

              {savingAddress
                ? "Saving..."
                : "Save address"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ---------------- Delete address modal ---------------- */}

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          if (!deletingAddressId) {
            setDeleteTarget(null);
          }
        }}
        closeOnOverlayClick={!deletingAddressId}
        closeOnEscape={!deletingAddressId}
        title="Delete saved address?"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-red-50 p-4 text-red-800">
            <AlertCircle
              className="mt-0.5 shrink-0"
              size={20}
            />

            <p className="text-sm">
              Delete{" "}
              <strong>
                {deleteTarget?.label || "this address"}
              </strong>
              ? This cannot be undone. Existing errands
              should retain their saved location snapshot.
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              className={buttonSecondary}
              disabled={Boolean(deletingAddressId)}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </button>

            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={Boolean(deletingAddressId)}
              onClick={handleDeleteAddress}
            >
              <Trash2 size={16} />

              {deletingAddressId
                ? "Deleting..."
                : "Delete address"}
            </button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}