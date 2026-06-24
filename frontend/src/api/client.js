const API_BASE_URL = import.meta.env?.VITE_API_URL || '/api';
const GET_CACHE_TTL_MS = 30_000;
const getCache = new Map();
const inFlightGets = new Map();
let cacheGeneration = 0;

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export async function apiRequest(path, options = {}) {
  const { timeoutMs = 15_000, signal: externalSignal, ...fetchOptions } = options;
  const token = localStorage.getItem('classmanager_token');
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abortFromCaller = () => controller.abort();
  if (externalSignal?.aborted) abortFromCaller();
  else externalSignal?.addEventListener('abort', abortFromCaller, { once: true });

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...fetchOptions, headers, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      const message = timedOut
        ? 'Máy chủ phản hồi quá lâu. Vui lòng thử lại.'
        : 'Yêu cầu đã bị hủy.';
      throw new ApiError(message, 0, { aborted: true });
    }
    throw new ApiError('Không thể kết nối đến máy chủ. Hãy kiểm tra backend đang chạy.', 0);
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', abortFromCaller);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(payload?.message || 'Yêu cầu không thành công', response.status, payload?.details);
  }
  return payload;
}

function getCacheKey(path) {
  return `${localStorage.getItem('classmanager_token') || 'anonymous'}:${path}`;
}

function cachedGet(path, options = {}) {
  const key = getCacheKey(path);
  const cached = getCache.get(key);
  if (cached && Date.now() - cached.savedAt < GET_CACHE_TTL_MS) return Promise.resolve(cached.payload);
  if (inFlightGets.has(key)) return inFlightGets.get(key);

  const generation = cacheGeneration;
  let request;
  request = apiRequest(path, options)
    .then((payload) => {
      if (generation === cacheGeneration) getCache.set(key, { payload, savedAt: Date.now() });
      return payload;
    })
    .finally(() => {
      if (inFlightGets.get(key) === request) inFlightGets.delete(key);
    });
  inFlightGets.set(key, request);
  return request;
}

export function clearApiCache() {
  cacheGeneration += 1;
  getCache.clear();
  inFlightGets.clear();
}

async function mutate(path, options) {
  const payload = await apiRequest(path, options);
  clearApiCache();
  return payload;
}

export const api = {
  get: (path, options) => cachedGet(path, options),
  post: (path, body) => mutate(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => mutate(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path) => mutate(path, { method: 'DELETE' }),
};
