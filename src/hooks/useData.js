import { useRef } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'

/**
 * Drop-in replacement for the old polling hook — now backed by React Query.
 *
 * Benefits over the old implementation:
 *  • Shared cache: components calling the same fetch fn reuse one request.
 *  • Stale-while-revalidate: re-visiting a tab shows last data instantly,
 *    then silently refetches in the background (no blank loading flash).
 *  • 5-minute GC window: cache survives tab switches (component unmounts).
 *  • Background polling still works via refetchInterval.
 *
 * API is identical to the old hook so no call sites need changing.
 */
export function useData(fetchFn, interval = 5000, deps = []) {
  // Derive a stable cache key from the function source + deps.
  // Arrow functions with the same body (e.g. () => eventsApi.list()) produce
  // the same string, so identical fetches across components share one cache entry.
  const fnKey = useRef(fetchFn.toString())

  const queryKey = [fnKey.current, ...deps]

  const { data, isPending, error, refetch } = useQuery({
    queryKey,
    queryFn:          fetchFn,
    refetchInterval:  interval > 0 ? interval : false,
    // Show cached data as "fresh" for half the polling window so we don't
    // re-request on every tiny re-render.
    staleTime:        interval > 0 ? Math.min(interval * 0.5, 30_000) : 30_000,
    // Keep the cache alive for 5 minutes after the component unmounts so
    // returning to a tab is instant.
    gcTime:           5 * 60 * 1_000,
    // While a background refetch runs, keep serving the previous snapshot
    // instead of switching back to loading=true.
    placeholderData:  keepPreviousData,
  })

  return {
    data:    data ?? null,
    loading: isPending,
    error:   error?.message ?? null,
    refresh: () => refetch(),
  }
}
