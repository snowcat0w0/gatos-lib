/**
 * Gato's Library — timing helpers with no Foundry dependency.
 */

/**
 * Trailing debounce: fn runs once, ms after the last call, with that call's arguments.
 * The returned function has cancel() and flush().
 */
export function debounce(fn, ms) {
  let timer = null;
  let last = null;
  const run = () => {
    timer = null;
    const { self, args } = last;
    last = null;
    return fn.apply(self, args);
  };
  function debounced(...args) {
    last = { self: this, args };
    clearTimeout(timer);
    timer = setTimeout(run, ms);
  }
  debounced.cancel = () => {
    clearTimeout(timer);
    timer = null;
    last = null;
  };
  debounced.flush = () => {
    if (!timer) return undefined;
    clearTimeout(timer);
    return run();
  };
  debounced.pending = () => timer !== null;
  return debounced;
}

/**
 * Debounce per key. Call as `scheduled(key, ...args)`; fn receives `...args`, or `key` when no args were given.
 * Several calls for one key inside `ms` collapse into one run with the latest arguments.
 *
 * Options:
 * - coalesce (true): a request that fires while the previous run for the same key is still awaiting
 *   is not started in parallel; one more run is scheduled after the current one ends.
 * - restart (true): each call restarts the timer (trailing debounce). false keeps the first call's
 *   timer, so the run happens at most ms after the first request.
 * - onError: called with (error, key) when fn throws or rejects; defaults to console.error.
 *
 * The returned function also has cancel(key?), flush(key?) and has(key).
 */
// ported from gatos-turn-control visibility.js (scheduleSync) and gatos light sources.js (refreshActor)
export function keyedDebounce(fn, ms, { coalesce = true, restart = true, onError } = {}) {
  const pending = new Map(); // key -> { timer, args }
  const running = new Map(); // key -> args of a request made while running, or null
  const report = onError ?? ((err, key) => console.error(`keyedDebounce | run for "${key}" failed`, err));

  async function fire(key) {
    const entry = pending.get(key);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(key);
    if (coalesce && running.has(key)) {
      running.set(key, entry.args);
      return;
    }
    if (coalesce) running.set(key, null);
    try {
      await (entry.args.length ? fn(...entry.args) : fn(key));
    } catch (err) {
      report(err, key);
    }
    if (!coalesce) return;
    const again = running.get(key);
    running.delete(key);
    if (again) scheduled(key, ...again);
  }

  function scheduled(key, ...args) {
    const entry = pending.get(key);
    if (entry) {
      entry.args = args;
      if (!restart) return;
      clearTimeout(entry.timer);
    }
    pending.set(key, { args, timer: setTimeout(() => fire(key), ms) });
  }

  const keys = (key) => (key === undefined ? [...pending.keys()] : [key]);

  /** Drop pending runs (one key, or all). A run already in progress is not interrupted. */
  scheduled.cancel = (key) => {
    for (const k of keys(key)) {
      clearTimeout(pending.get(k)?.timer);
      pending.delete(k);
    }
  };

  /** Run pending requests now instead of waiting for the timer. */
  scheduled.flush = (key) => Promise.all(keys(key).map((k) => fire(k)));

  /** Whether a run is pending for the key. */
  scheduled.has = (key) => pending.has(key);

  return scheduled;
}
