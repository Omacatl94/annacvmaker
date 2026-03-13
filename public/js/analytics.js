/**
 * Track custom event via Plausible.
 * No-op if Plausible not loaded (dev, adblocker).
 */
export function track(event, props) {
  if (typeof plausible !== 'undefined') {
    plausible(event, { props });
  }
}
