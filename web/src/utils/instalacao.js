export function estaInstalado() {
  const modoStandalone = window.matchMedia?.('(display-mode: standalone)').matches;
  const modoStandaloneIOS = window.navigator.standalone === true; // Safari/iOS
  return Boolean(modoStandalone || modoStandaloneIOS);
}
