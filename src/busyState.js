let activeBusyCount = 0;

function syncBusyState() {
  if (typeof document === 'undefined') return;

  const isBusy = activeBusyCount > 0;
  const stage = document.getElementById('stage');
  const overlay = document.getElementById('visualizationBusy');

  document.body.classList.toggle('taxonomy-busy', isBusy);
  if (stage) stage.setAttribute('aria-busy', String(isBusy));
  if (overlay) overlay.hidden = !isBusy;

  document.querySelectorAll('.summary-search-btn').forEach(button => {
    button.disabled = isBusy;
  });
}

export function isTaxonomyBusy() {
  return activeBusyCount > 0;
}

export function beginTaxonomyBusy() {
  activeBusyCount += 1;
  syncBusyState();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeBusyCount = Math.max(0, activeBusyCount - 1);
    syncBusyState();
  };
}

export function syncTaxonomyBusyState() {
  syncBusyState();
}
