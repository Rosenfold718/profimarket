import { useAppStore } from '@/stores/use-app-store'

/**
 * Wrapper around fetch() that automatically includes the JWT token
 * from Zustand store via Authorization header.
 * Use this for all authenticated API requests.
 */
export function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = useAppStore.getState().token
  const headers = new Headers(options.headers || {})

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  if (!headers.has('Content-Type') && options.method && options.method !== 'GET') {
    // Don't set Content-Type for FormData — the browser sets it automatically with the correct boundary
    if (!(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json')
    }
  }

  return fetch(url, { ...options, headers, credentials: 'include' })
}
