let csrfTokenMemory: string | null = null;

export function setCsrfToken(token: string | null) {
  csrfTokenMemory = token;
}

export function getCsrfToken(): string | null {
  if (csrfTokenMemory) return csrfTokenMemory;
  // Fallback to reading from document.cookie (_csrf or XSRF-TOKEN)
  const match = document.cookie.match(/(?:^|; )(?:_csrf|XSRF-TOKEN)=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export interface ApiResponse<T = any> {
  status: string;
  data?: T;
  message?: string;
  csrfToken?: string;
  mfaRequired?: boolean;
  tempToken?: string;
  user?: any;
}

export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const csrfToken = getCsrfToken();
  if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method?.toUpperCase() || '')) {
    headers.set('X-CSRF-Token', csrfToken);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include', // Include HttpOnly cookies (accessToken, refreshToken, XSRF-TOKEN)
  });

  const data: ApiResponse<T> = await response.json().catch(() => ({
    status: 'error',
    message: response.statusText || 'Network request failed',
  }));

  // Update memory CSRF token if returned in JSON
  if (data.csrfToken) {
    setCsrfToken(data.csrfToken);
  }

  if (!response.ok) {
    const errorMsg =
      (data as any).error ||
      data.message ||
      (data as any).details ||
      `Request failed with status ${response.status}`;
    const error: any = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return (data.data !== undefined ? data.data : data) as T;
}
