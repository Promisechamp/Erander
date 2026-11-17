import { useCallback, useEffect, useState } from "react";

export function useIsMobile(query = "(max-width: 767px)") {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia(query).matches
      : false
  );

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;

    const media = window.matchMedia(query);
    const handler = (event) => setMatches(event.matches);

    setMatches(media.matches);

    if (media.addEventListener) media.addEventListener("change", handler);
    else media.addListener(handler);

    return () => {
      if (media.removeEventListener)
        media.removeEventListener("change", handler);
      else media.removeListener(handler);
    };
  }, [query]);

  return matches;
}

const storageKey = (section, dataset) =>
  `erander.admin.records.${section}.${dataset}`;

function readPrefs(key) {
  try {
    return JSON.parse(window.localStorage.getItem(key)) || {};
  } catch {
    return {};
  }
}

/**
 * Per page + dataset view preferences, saved in the browser.
 * With no saved choice, phones get cards and larger screens get the table.
 */
export default function useViewPrefs(section, dataset) {
  const isMobile = useIsMobile();
  const key = storageKey(section, dataset);

  const [prefs, setPrefs] = useState(() => readPrefs(key));

  useEffect(() => {
    setPrefs(readPrefs(key));
  }, [key]);

  const update = useCallback(
    (patch) => {
      setPrefs((previous) => {
        const next = { ...previous, ...patch };

        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* storage unavailable: keep in memory only */
        }

        return next;
      });
    },
    [key]
  );

  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    setPrefs({});
  }, [key]);

  return {
    isMobile,
    view: prefs.view || (isMobile ? "cards" : "table"),
    setView: (view) => update({ view }),
    dense: Boolean(prefs.dense),
    setDense: (dense) => update({ dense }),
    hiddenColumns: prefs.hidden || [],
    setHiddenColumns: (hidden) => update({ hidden }),
    cardFields: prefs.cardFields || null,
    setCardFields: (cardFields) => update({ cardFields }),
    reset,
  };
}