export function shouldBootstrapFromLocalStorage() {
  if (typeof window === 'undefined') return false;
  return !Boolean(window.electron?.storeGet);
}
