export function fakeFetch(responses) {
  const queue = [...responses];
  const calls = [];
  const impl = async (url, init = {}) => {
    calls.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(init.body) : undefined });
    const next = queue.shift();
    if (!next) throw new Error(`fakeFetch: ingen respons igjen for ${url}`);
    const { status = 200, json } = typeof next === "function" ? next({ url, init }) : next;
    return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(json) };
  };
  impl.calls = calls;
  return impl;
}
