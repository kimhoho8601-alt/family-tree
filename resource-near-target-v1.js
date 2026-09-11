(() => {
  const connectForm = document.querySelector('#resourceConnectForm');
  const targetSelect = document.querySelector('#combinedTarget');
  if (!connectForm && !targetSelect) return;

  let restoreStringify = null;

  function familyState() {
    if (typeof state !== 'undefined' && Array.isArray(state.people)) return state;
    try {
      const saved = JSON.parse(localStorage.getItem('genogram-studio') || 'null');
      return saved && Array.isArray(saved.people) ? saved : { people: [] };
    } catch {
      return { people: [] };
    }
  }

  function targetPoint(person, offset) {
    return {
      x: 170 + Number(offset?.x || 0) + Number(person.x || 600) * 0.78,
      y: 70 + Number(offset?.y || 0) + Number(person.y || 360) * 0.78
    };
  }

  function familyPoint(person, offset) {
    return targetPoint(person, offset);
  }

  function chooseNearbyPosition(combined, item, person) {
    const offset = combined.familyOffset || { x: 0, y: 0 };
    const target = targetPoint(person, offset);
    const familyCenter = { x: 638 + Number(offset.x || 0), y: 350 + Number(offset.y || 0) };

    let baseAngle = Math.atan2(target.y - familyCenter.y, target.x - familyCenter.x);
    if (!Number.isFinite(baseAngle)) baseAngle = 0;

    // Put the resource outside the family cluster, close to the selected person.
    // Diagonal alternatives are tried early so lower/upper members do not push
    // the resource against the canvas edge.
    const angleOffsets = [0, -0.58, 0.58, -1.12, 1.12, -1.62, 1.62, Math.PI];
    const radii = [225, 250, 285];
    const others = combined.resources.filter(resource => resource.id !== item.id);
    const people = familyState().people || [];

    let best = null;

    for (const radius of radii) {
      for (const delta of angleOffsets) {
        const angle = baseAngle + delta;
        const rawX = target.x + Math.cos(angle) * radius;
        const rawY = target.y + Math.sin(angle) * radius;
        const x = Math.max(105, Math.min(1295, rawX));
        const y = Math.max(75, Math.min(685, rawY));

        let score = Math.hypot(x - rawX, y - rawY) * 40;

        // Keep resource cards from stacking on top of each other.
        others.forEach(resource => {
          const dx = Math.abs(Number(resource.x || 0) - x);
          const dy = Math.abs(Number(resource.y || 0) - y);
          if (dx < 205 && dy < 108) score += 12000 + (205 - dx) * 10 + (108 - dy) * 8;
        });

        // Avoid covering any family member symbol/label.
        people.forEach(member => {
          const p = familyPoint(member, offset);
          const dx = Math.abs(p.x - x);
          const dy = Math.abs(p.y - y);
          if (dx < 135 && dy < 100) score += 9000 + (135 - dx) * 8 + (100 - dy) * 6;
        });

        // Prefer a compact connection once collision penalties are equal.
        score += Math.hypot(x - target.x, y - target.y) * 0.12;

        if (!best || score < best.score) best = { x, y, score };
      }
    }

    if (best) {
      item.x = Math.round(best.x);
      item.y = Math.round(best.y);
    }
  }

  function armPlacement(targetId) {
    if (!targetId || targetId === 'family') return;

    const person = familyState().people.find(member => member.id === targetId);
    if (!person) return;

    if (restoreStringify) restoreStringify();

    const original = JSON.stringify;
    let active = true;

    const restore = () => {
      if (!active) return;
      active = false;
      if (JSON.stringify === wrapped) JSON.stringify = original;
      restoreStringify = null;
    };

    const wrapped = function(value, ...args) {
      try {
        const isCombinedState = value && typeof value === 'object' &&
          Array.isArray(value.resources) && value.familyOffset && 'selected' in value;
        if (isCombinedState) {
          const item = value.resources.find(resource => resource.id === value.selected);
          if (item && (item.target || targetId) === targetId) chooseNearbyPosition(value, item, person);
        }
      } finally {
        restore();
      }
      return original.call(JSON, value, ...args);
    };

    JSON.stringify = wrapped;
    restoreStringify = restore;
    setTimeout(restore, 0);
  }

  // Capture phase runs before combined-map-v1.js' normal submit/change handlers.
  // This lets the existing save/render flow keep ownership of the data while we
  // only adjust the new resource position at the exact moment the target is set.
  connectForm?.addEventListener('submit', () => {
    const targetId = document.querySelector('#resourceConnectTarget')?.value;
    armPlacement(targetId);
  }, true);

  targetSelect?.addEventListener('change', event => {
    armPlacement(event.target.value);
  }, true);
})();
