(() => {
  // Preserve the live SVG colors when the existing export handlers clone the canvas.
  // Detached SVG clones do not inherit the page styles reliably, which caused
  // genogram/ecology PNGs to lose red/blue accents and appear monochrome.
  const STYLE_PROPS = [
    'fill','fill-opacity','stroke','stroke-opacity','stroke-width','stroke-dasharray',
    'stroke-linecap','stroke-linejoin','opacity','color','font-family','font-size',
    'font-weight','font-style','text-anchor','dominant-baseline'
  ];
  const TRANSIENT_CLASSES = [
    'selected','combined-target-selected','relation-selected','union-selected',
    'connect-selected','direct-connect-selected','cohabit-pick-selected',
    'person-delete-selected'
  ];

  function preserveSvgColorsForClone(svg) {
    if (!svg || svg.dataset.exportColorLock === '1') return;
    svg.dataset.exportColorLock = '1';

    const nodes = [svg, ...svg.querySelectorAll('*')];
    const snapshots = nodes.map(el => ({
      el,
      style: el.getAttribute('style'),
      cls: el.getAttribute('class')
    }));

    // Remove temporary editing/selection states before reading computed styles so
    // downloaded files do not accidentally contain a selection highlight.
    nodes.forEach(el => {
      TRANSIENT_CLASSES.forEach(cls => el.classList?.remove(cls));
    });

    // Resolve CSS variables and external stylesheet rules to concrete SVG colors.
    nodes.forEach(el => {
      const computed = getComputedStyle(el);
      STYLE_PROPS.forEach(prop => {
        const value = computed.getPropertyValue(prop);
        if (value) el.style.setProperty(prop, value);
      });
    });

    // Existing download handlers clone synchronously during this click. Restore the
    // editable canvas on the next frame after the clone has already been created.
    requestAnimationFrame(() => {
      snapshots.forEach(({ el, style, cls }) => {
        if (style == null) el.removeAttribute('style'); else el.setAttribute('style', style);
        if (cls == null) el.removeAttribute('class'); else el.setAttribute('class', cls);
      });
      delete svg.dataset.exportColorLock;
    });
  }

  // Hide editor-only guidance just before export while keeping it visible on screen.
  function hideForExport(selector) {
    const changed = [];
    document.querySelectorAll(selector).forEach(el => {
      changed.push({ el, display: el.getAttribute('display'), styleDisplay: el.style.display });
      el.setAttribute('display', 'none');
      el.style.display = 'none';
    });
    requestAnimationFrame(() => {
      changed.forEach(({ el, display, styleDisplay }) => {
        if (display == null) el.removeAttribute('display'); else el.setAttribute('display', display);
        el.style.display = styleDisplay;
      });
    });
  }

  document.addEventListener('click', event => {
    const button = event.target.closest?.('#downloadBtn,#combinedDownloadBtn,#ecoDownloadBtn');
    if (!button) return;

    let mode = document.body.dataset.studioMode || 'genogram';
    let svg = null;

    if (button.id === 'combinedDownloadBtn' || (button.id === 'downloadBtn' && mode === 'combined')) {
      svg = document.querySelector('#combinedMap');
      hideForExport('#combinedMap .combined-empty');
    } else if (button.id === 'ecoDownloadBtn' || (button.id === 'downloadBtn' && mode === 'eco')) {
      svg = document.querySelector('#ecomap');
      hideForExport('#ecomap .eco-empty-label');
    } else {
      svg = document.querySelector('#genogram');
    }

    preserveSvgColorsForClone(svg);
  }, true);
})();
