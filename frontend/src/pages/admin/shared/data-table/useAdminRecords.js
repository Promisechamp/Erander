import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { getAdminRecords } from "@/services/admin/adminRecordsApi";
import { getCurrentAdmin } from "@/services/admin/adminAuthApi";

export default function useAdminRecords({ section, datasets, initialDataset }) {
  const firstDataset = initialDataset || datasets?.[0]?.value || "";

  const [dataset, setDataset] = useState(firstDataset);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatusState] = useState("");
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(Boolean(firstDataset));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [permissions, setPermissions] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const requestRef = useRef(0);

  // Permissions load once.
  useEffect(() => {
    getCurrentAdmin()
      .then((response) =>
        setPermissions(
          response?.data?.admin?.permissions || response?.data?.permissions || []
        )
      )
      .catch(() => setPermissions([]));
  }, []);

  // A different page or dataset prop resets everything.
  useEffect(() => {
    setDataset(firstDataset);
    setPage(1);
    setStatusState("");
    setSearchInput("");
    setSearch("");
  }, [section, firstDataset]);

  // Debounced search.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(
    async ({ quiet = false } = {}) => {
      const requestId = ++requestRef.current;

      if (!dataset) {
        setPayload(null);
        setError("");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (quiet) setRefreshing(true);
      else setLoading(true);

      if (!quiet) setError("");

      try {
        const response = await getAdminRecords({
          section,
          dataset,
          page,
          limit: pageSize,
          search,
          status,
        });

        if (requestId !== requestRef.current) return;

        const data = response?.data || null;

        setPayload(data);
        setError("");
        setLastUpdated(new Date());

        const next = data?.permissions;
        if (Array.isArray(next)) {
          setPermissions((previous) =>
            previous.join("|") === next.join("|") ? previous : next
          );
        }
      } catch (requestError) {
        if (requestId !== requestRef.current) return;

        if (quiet) {
          toast.error("Couldn't refresh the records");
        } else {
          setPayload(null);
          setError(requestError?.message || "Unable to load these records.");
        }
      } finally {
        if (requestId === requestRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [dataset, page, pageSize, search, section, status]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Live mode: quiet refresh every 30 seconds while the tab is visible.
  useEffect(() => {
    if (!autoRefresh) return undefined;

    const timer = window.setInterval(() => {
      if (!document.hidden) load({ quiet: true });
    }, 30000);

    return () => window.clearInterval(timer);
  }, [autoRefresh, load]);

  const changeDataset = useCallback(
    (value) => {
      setDataset(value || firstDataset);
      setPage(1);
      setStatusState("");
      setSearchInput("");
      setSearch("");
    },
    [firstDataset]
  );

  const setStatus = useCallback((value) => {
    setStatusState(value || "");
    setPage(1);
  }, []);

  const changePageSize = useCallback((size) => {
    setPageSize(size);
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchInput("");
    setSearch("");
    setStatusState("");
    setPage(1);
  }, []);

  return {
    dataset,
    changeDataset,
    page,
    setPage,
    pageSize,
    changePageSize,
    searchInput,
    setSearchInput,
    search,
    status,
    setStatus,
    hasFilters: Boolean(search || status),
    clearFilters,
    payload,
    rows: payload?.items || [],
    columns: payload?.columns || [],
    loading,
    refreshing,
    error,
    permissions,
    lastUpdated,
    autoRefresh,
    setAutoRefresh,
    reload: () => load({ quiet: true }),
    retry: () => load(),
  };
}