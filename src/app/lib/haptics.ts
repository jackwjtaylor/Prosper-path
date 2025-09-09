export function haptic(pattern: number | number[] = 30) {
  if (typeof window === 'undefined') return;
  const n = navigator as any;
  try {
    if (typeof n.vibrate === 'function') n.vibrate(pattern as any);
  } catch {}
}

export function hapticToggle(on: boolean) {
  // Short pulse for toggle; slightly longer when enabling listening
  if (on) haptic([10, 50, 10]); else haptic(20);
}

