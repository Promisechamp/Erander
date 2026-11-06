import { useCallback, useRef, useState } from "react";

import {
  getAdminErrandDetails,
  getAdminUserDetails,
} from "@/services/admin/adminRecordsApi";

/** Loads the full user profile and full errand record shown in the big dialogs. */
export default function useEntityDetails() {
  const [profileDetails, setProfileDetails] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [errand, setErrand] = useState(null);
  const [errandLoading, setErrandLoading] = useState(false);
  const [errandError, setErrandError] = useState("");

  const profileRequest = useRef(0);
  const errandRequest = useRef(0);

  const openProfile = useCallback(async (profile, fallbackId) => {
    const id = profile?.id || fallbackId;
    if (!id) return;

    const requestId = ++profileRequest.current;

    setProfileDetails(null);
    setProfileError("");
    setProfileLoading(true);

    try {
      const response = await getAdminUserDetails(id);
      if (requestId !== profileRequest.current) return;
      setProfileDetails(response?.data || null);
    } catch (requestError) {
      if (requestId !== profileRequest.current) return;
      setProfileError(requestError?.message || "Unable to load this user.");
      setProfileDetails({
        profile: profile || { id },
        wallets: [],
        withdrawalAccounts: [],
        recentTransactions: [],
      });
    } finally {
      if (requestId === profileRequest.current) setProfileLoading(false);
    }
  }, []);

  const closeProfile = useCallback(() => {
    profileRequest.current += 1;
    setProfileDetails(null);
    setProfileError("");
    setProfileLoading(false);
  }, []);

  // silent keeps the current errand on screen while it refreshes.
  const openErrand = useCallback(async (errandId, { silent = false } = {}) => {
    if (!errandId) return;

    const requestId = ++errandRequest.current;

    if (!silent) setErrand(null);
    setErrandError("");
    setErrandLoading(true);

    try {
      const response = await getAdminErrandDetails(errandId);
      if (requestId !== errandRequest.current) return;
      setErrand(response?.data?.errand || null);
    } catch (requestError) {
      if (requestId !== errandRequest.current) return;
      setErrandError(
        requestError?.message || "Unable to load the complete errand."
      );
    } finally {
      if (requestId === errandRequest.current) setErrandLoading(false);
    }
  }, []);

  const closeErrand = useCallback(() => {
    errandRequest.current += 1;
    setErrand(null);
    setErrandError("");
    setErrandLoading(false);
  }, []);

  return {
    profileDetails,
    profileLoading,
    profileError,
    openProfile,
    closeProfile,
    errand,
    errandLoading,
    errandError,
    openErrand,
    closeErrand,
  };
}