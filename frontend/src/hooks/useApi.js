import { useState, useEffect, useRef } from 'react'

/**
 * Fetches data from an API function whenever `params` changes.
 * Cancels in-flight requests on param change or unmount.
 *
 * @param {Function} apiFn  - function from api.js (e.g. api.mapHex)
 * @param {Object}   params - query params; changing this triggers a refetch
 * @returns {{ data, loading, error }}
 */
export function useApi(apiFn, params) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const abortRef = useRef(null)

  useEffect(() => {
    // Cancel previous request
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)

    apiFn(params)
      .then(d  => { if (!controller.signal.aborted) setData(d) })
      .catch(e => { if (!controller.signal.aborted) setError(e.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })

    return () => controller.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params)])

  return { data, loading, error }
}