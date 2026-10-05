export const isAuthPopupAssertion = reason =>
  /INTERNAL ASSERTION FAILED: Pending promise was never set/i.test(String(reason?.message || reason || ""));

// Share the active request so rapid clicks cannot cancel each other's popup.
export function singleFlightAuth(start) {
  let pending;
  return (...args) => {
    if (!pending) {
      pending = Promise.resolve().then(() => start(...args)).finally(() => { pending = null; });
    }
    return pending;
  };
}
