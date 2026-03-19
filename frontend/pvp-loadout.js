export const STORAGE_KEY_BASE = "runtime-terror-solo-save-v1";

export function defaultSoloState() {
  return {
    encounter: 1,
    money: 0,
    wins: 0,
    losses: 0,
    modules: {
      damage: 0,
      health: 0,
      armor: 0,
      speed: 0,
    },
    berserks: [],
    salvage: [],
  };
}

export function loadSoloState(storageKey = STORAGE_KEY_BASE) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return defaultSoloState();
    const parsed = JSON.parse(raw);
    return {
      ...defaultSoloState(),
      ...parsed,
      modules: {
        ...defaultSoloState().modules,
        ...(parsed.modules || {}),
      },
      berserks: Array.isArray(parsed.berserks) ? parsed.berserks : [],
      salvage: Array.isArray(parsed.salvage) ? parsed.salvage : [],
    };
  } catch (_error) {
    return defaultSoloState();
  }
}

export function saveSoloState(state, storageKey = STORAGE_KEY_BASE) {
  window.localStorage.setItem(storageKey, JSON.stringify(state));
}

export function buildPvpLoadoutFromSoloState(state) {
  const source = state || defaultSoloState();
  return {
    playerBotKey: "acid",
    modules: {
      damage: Number(source.modules?.damage || 0),
      health: Number(source.modules?.health || 0),
      armor: Number(source.modules?.armor || 0),
      speed: Number(source.modules?.speed || 0),
    },
    berserks: Array.isArray(source.berserks) ? [...source.berserks] : [],
    equippedBerserk: Array.isArray(source.berserks) && source.berserks.includes("elemental") ? "elemental" : null,
    salvage: Array.isArray(source.salvage) ? [...source.salvage] : [],
    equippedUniques: {},
  };
}

export async function syncPvpLoadout(apiBase, token, state) {
  if (!apiBase || !token) return null;
  const response = await fetch(`${apiBase}/pvp/loadout`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildPvpLoadoutFromSoloState(state)),
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch (_error) {
    payload = null;
  }
  if (!response.ok) {
    throw new Error(payload?.detail || payload?.loadout || `Failed to sync PvP loadout (${response.status})`);
  }
  return payload?.loadout || null;
}
