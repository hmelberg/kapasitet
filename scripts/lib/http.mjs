const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class HttpError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export async function requestJson(url, {
  method = "GET", body, fetchImpl = globalThis.fetch, retries = 3, timeoutMs = 120_000, sleep = defaultSleep, headers = {},
} = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(1000 * 3 ** (attempt - 1));
    try {
      const res = await fetchImpl(url, {
        method,
        headers: { accept: "application/json", ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = await res.text();
      if (res.ok) return JSON.parse(text.replace(/^﻿/, ""));
      const err = new HttpError(`${method} ${url}: HTTP ${res.status} ${text.slice(0, 300)}`, res.status);
      if (!RETRY_STATUS.has(res.status)) throw err;
      lastErr = err;
    } catch (e) {
      if (e instanceof HttpError && !RETRY_STATUS.has(e.status)) throw e;
      lastErr = e;
    }
  }
  throw new Error(`${method} ${url}: ga opp etter ${retries + 1} forsøk – ${lastErr?.message ?? lastErr}`);
}

export const getJson = (url, opts = {}) => requestJson(url, { ...opts, method: "GET" });
export const postJson = (url, body, opts = {}) => requestJson(url, { ...opts, method: "POST", body });
