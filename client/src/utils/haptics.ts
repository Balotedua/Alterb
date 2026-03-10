/**
 * Haptic feedback utility — wraps the Vibration API with graceful fallback.
 * No-ops silently on browsers/devices that don't support navigator.vibrate.
 */

function vibrate(pattern: number | number[]): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(pattern);
  }
}

export const haptics = {
  /** Short tap — message sent */
  send: () => vibrate(18),

  /** Double pulse — fragment opened */
  fragment: () => vibrate([12, 60, 22]),

  /** Soft buzz — response received / elaborated */
  response: () => vibrate(35),
};
