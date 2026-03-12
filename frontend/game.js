const STORAGE_KEY = "runtime-terror-solo-save-v1";
const TICK_MS = 100;
const BASE_HEALTH = 100;
const BASE_PLAYER_DAMAGE = 22;
const BASE_PLAYER_COOLDOWN = 1.6;
const BASE_MOVE_SPEED = 180;

const MODULES = [
  { key: "damage", name: "Damage Module", baseBonus: 7.5, format: (value) => `+${value}% damage` },
  { key: "health", name: "Health Module", baseBonus: 7.5, format: (value) => `+${value}% max health` },
  { key: "armor", name: "Armour Module", baseBonus: 7.5, format: (value) => `-${value}% damage taken` },
  { key: "speed", name: "Speed Module", baseBonus: 10, format: (value) => `+${value}% speed` },
];

const BERSERKS = [
  {
    key: "elemental",
    tier: 2,
    name: "Elemental Module Tier 2",
    description: "-10% health. +10% elemental damage.",
    cost: 190,
    passive: true,
  },
  {
    key: "freeze",
    tier: 4,
    name: "Freeze Module Tier 4",
    description: "Freeze the enemy for 5 seconds. Self-inflicts 40 damage on use.",
    cost: 420,
    active: true,
  },
  {
    key: "striker",
    tier: 6,
    name: "Striker Module Tier 6",
    description: "3x fire rate for 5 seconds, but you take 30% more damage while active.",
    cost: 760,
    active: true,
  },
  {
    key: "golden",
    tier: 7,
    name: "Golden Module Tier 7",
    description: "7 seconds of heavy shot deflection. Movement and fire rate are reduced while active.",
    cost: 980,
    active: true,
  },
];

const BOT_TYPES = [
  {
    key: "acid",
    name: "Acid Bot",
    damage: 30,
    cooldown: 2,
    attackName: "acid stream",
    unique6: "Smart Acid",
    unique6Description: "Missed acid crawls back toward the enemy.",
    unique7: "Virus Acid",
    unique7Description: "10% chance every 2 seconds to disable target controls for 3 seconds.",
    attack: acidAttack,
  },
  {
    key: "sawblade",
    name: "Swinging Sawblade Bot",
    damage: 45,
    cooldown: 2,
    attackName: "saw swing",
    unique6: "Improved Motors",
    unique6Description: "Swinging arm moves 2.5x faster.",
    unique7: "Titanium Sharpening",
    unique7Description: "Damage loss happens every 3 swings instead of every swing.",
    attack: sawbladeAttack,
  },
  {
    key: "hacker",
    name: "Hacking Bot",
    damage: 40,
    cooldown: 3,
    attackName: "hack spike",
    unique6: "HyperThreadingTechnology",
    unique6Description: "Hack lasts 2 more seconds and deals 20 more damage.",
    unique7: "Hyper Efficient Coding",
    unique7Description: "75% chance to chain a weaker second hack.",
    attack: hackerAttack,
  },
  {
    key: "sniper",
    name: "Sniper Bot",
    damage: 50,
    cooldown: 3,
    attackName: "sniper shot",
    unique6: "Hyper Velocity",
    unique6Description: "Adds 15 damage to each shot.",
    unique7: "Plasma Charged",
    unique7Description: "Adds plasma damage and reduces enemy efficiency by 10%.",
    attack: sniperAttack,
  },
  {
    key: "claymore",
    name: "Claymore Roomba",
    damage: 65,
    cooldown: 3.4,
    attackName: "claymore blast",
    unique6: "Optimized Explosion Spreads",
    unique6Description: "Explosion coverage improves, adding 15 damage.",
    unique7: "Fire Infused Explosions",
    unique7Description: "Adds fire damage over time and reduces enemy armour.",
    attack: claymoreAttack,
  },
];

const dom = {
  arenaCanvas: document.querySelector("#arena-canvas"),
  encounterValue: document.querySelector("#encounter-value"),
  moneyValue: document.querySelector("#money-value"),
  recordValue: document.querySelector("#record-value"),
  difficultyValue: document.querySelector("#difficulty-value"),
  startBattle: document.querySelector("#start-battle"),
  resetSave: document.querySelector("#reset-save"),
  fireButton: document.querySelector("#fire-button"),
  berserkButton: document.querySelector("#berserk-button"),
  battleLog: document.querySelector("#battle-log"),
  playerHealthText: document.querySelector("#player-health-text"),
  enemyHealthText: document.querySelector("#enemy-health-text"),
  playerHealthBar: document.querySelector("#player-health-bar"),
  enemyHealthBar: document.querySelector("#enemy-health-bar"),
  playerCooldownBar: document.querySelector("#player-cooldown-bar"),
  enemyCooldownBar: document.querySelector("#enemy-cooldown-bar"),
  playerStats: document.querySelector("#player-stats"),
  enemyStats: document.querySelector("#enemy-stats"),
  playerStatus: document.querySelector("#player-status"),
  enemyStatus: document.querySelector("#enemy-status"),
  enemyName: document.querySelector("#enemy-name"),
  upgradeShop: document.querySelector("#upgrade-shop"),
  berserkShop: document.querySelector("#berserk-shop"),
  uniqueInventory: document.querySelector("#unique-inventory"),
};

let state = loadState();
let battle = null;
let lastBattleReport = "";
let arenaFrame = null;
let autoAdvanceTimeout = null;
const inputState = {
  up: false,
  down: false,
  left: false,
  right: false,
};

function setText(node, value) {
  if (node) node.textContent = value;
}

function setWidth(node, value) {
  if (node) node.style.width = value;
}

function setDisabled(node, value) {
  if (node) node.disabled = value;
}

function defaultState() {
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

function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return {
      ...defaultState(),
      ...parsed,
      modules: {
        ...defaultState().modules,
        ...(parsed.modules || {}),
      },
      berserks: Array.isArray(parsed.berserks) ? parsed.berserks : [],
      salvage: Array.isArray(parsed.salvage) ? parsed.salvage : [],
    };
  } catch (_error) {
    return defaultState();
  }
}

function saveState() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getProgressionStage(encounter) {
  return Math.max(0, encounter - 1);
}

function getDifficultyLabel(encounter) {
  const stage = getProgressionStage(encounter);
  if (stage === 0) return "Boot";
  const tier = Math.min(7, Math.ceil(stage / 2));
  const plus = stage % 2 === 0;
  return `Tier ${tier}${plus ? "+" : ""}`;
}

function getTierFromLevel(level) {
  return level > 0 ? Math.ceil(level / 2) : 0;
}

function isPlusLevel(level) {
  return level > 0 && level % 2 === 0;
}

function getModulePercent(level, baseBonus) {
  if (level <= 0) return 0;
  const tier = getTierFromLevel(level);
  const plusBonus = isPlusLevel(level) ? 2.5 : 0;
  return baseBonus * (2 ** (tier - 1)) + plusBonus;
}

function formatModuleTier(level) {
  if (level <= 0) return "Tier 0";
  const tier = getTierFromLevel(level);
  return `Tier ${tier}${isPlusLevel(level) ? "+" : ""}`;
}

function getModuleUpgradeCost(nextLevel) {
  const tier = getTierFromLevel(nextLevel);
  const plus = isPlusLevel(nextLevel);
  return 55 + tier * 45 + (plus ? 25 : 0);
}

function getPlayerProfile() {
  const damageBonus = getModulePercent(state.modules.damage, 7.5);
  const healthBonus = getModulePercent(state.modules.health, 7.5);
  const armorBonus = getModulePercent(state.modules.armor, 7.5);
  const speedBonus = getModulePercent(state.modules.speed, 10);
  const hasElemental = state.berserks.includes("elemental");

  const healthMultiplier = (1 + healthBonus / 100) * (hasElemental ? 0.9 : 1);
  return {
    damageBonus,
    healthBonus,
    armorBonus,
    speedBonus,
    maxHealth: roundNumber(BASE_HEALTH * healthMultiplier),
    shotDamage: roundNumber(BASE_PLAYER_DAMAGE * (1 + damageBonus / 100)),
    elementalDamage: hasElemental ? roundNumber(BASE_PLAYER_DAMAGE * 0.1) : 0,
    cooldown: BASE_PLAYER_COOLDOWN / (1 + speedBonus / 100),
  };
}

function getEnemyBlueprint() {
  const stage = getProgressionStage(state.encounter);
  const bot = BOT_TYPES[(state.encounter - 1) % BOT_TYPES.length];
  const moduleLevels = { damage: 0, health: 0, armor: 0, speed: 0 };
  const moduleKeys = Object.keys(moduleLevels);
  const modulePoints = Math.min(32, stage + Math.floor(stage / 2));

  for (let index = 0; index < modulePoints; index += 1) {
    const key = moduleKeys[index % moduleKeys.length];
    moduleLevels[key] = Math.min(14, moduleLevels[key] + 1);
  }

  const damageBonus = getModulePercent(moduleLevels.damage, 7.5);
  const healthBonus = getModulePercent(moduleLevels.health, 7.5);
  const armorBonus = getModulePercent(moduleLevels.armor, 7.5);
  const speedBonus = getModulePercent(moduleLevels.speed, 10);
  const difficultyTier = stage === 0 ? 0 : Math.min(7, Math.ceil(stage / 2));

  return {
    bot,
    stage,
    difficultyTier,
    modules: moduleLevels,
    damageBonus,
    healthBonus,
    armorBonus,
    speedBonus,
    maxHealth: roundNumber(BASE_HEALTH * (1 + healthBonus / 100)),
    baseDamage: roundNumber(bot.damage * (1 + damageBonus / 100)),
    cooldown: bot.cooldown / (1 + speedBonus / 100),
    berserks: BERSERKS.filter((item) => difficultyTier >= item.tier).map((item) => item.key),
    unique6: difficultyTier >= 6,
    unique7: difficultyTier >= 7,
  };
}

function createActor(kind, config) {
  return {
    kind,
    key: config.key || kind,
    name: config.name,
    maxHealth: config.maxHealth,
    health: config.maxHealth,
    shotDamage: config.shotDamage,
    elementalDamage: config.elementalDamage || 0,
    armorBonus: config.armorBonus || 0,
    speedBonus: config.speedBonus || 0,
    cooldownDuration: config.cooldown,
    cooldownRemaining: 0,
    freezeFor: 0,
    disableFor: 0,
    burnFor: 0,
    burnDamage: 0,
    armorBreak: 0,
    plasmaDebuffFor: 0,
    acidHits: 0,
    berserks: config.berserks || [],
    usedBerserks: [],
    berserkState: null,
    attackImpl: config.attackImpl,
    unique6: Boolean(config.unique6),
    unique7: Boolean(config.unique7),
    sawLoss: 0,
    sawSwings: 0,
    lastVirusCheck: 0,
    x: config.x || 0,
    y: config.y || 0,
    moveSpeed: config.moveSpeed || BASE_MOVE_SPEED,
    facing: kind === "player" ? 1 : -1,
  };
}

function startBattle() {
  if (battle) return;
  if (autoAdvanceTimeout) {
    window.clearTimeout(autoAdvanceTimeout);
    autoAdvanceTimeout = null;
  }

  const playerProfile = getPlayerProfile();
  const enemyBlueprint = getEnemyBlueprint();
  const player = createActor("player", {
    key: "player",
    name: "Your Bot",
    ...playerProfile,
    berserks: state.berserks,
    attackImpl: playerAttack,
    x: 220,
    y: 420,
    moveSpeed: BASE_MOVE_SPEED * (1 + playerProfile.speedBonus / 100),
  });
  const enemy = createActor("enemy", {
    key: enemyBlueprint.bot.key,
    name: enemyBlueprint.bot.name,
    maxHealth: enemyBlueprint.maxHealth,
    shotDamage: enemyBlueprint.baseDamage,
    elementalDamage: 0,
    armorBonus: enemyBlueprint.armorBonus,
    speedBonus: enemyBlueprint.speedBonus,
    cooldown: enemyBlueprint.cooldown,
    berserks: enemyBlueprint.berserks,
    attackImpl: enemyBlueprint.bot.attack,
    unique6: enemyBlueprint.unique6,
    unique7: enemyBlueprint.unique7,
    x: 900,
    y: 420,
    moveSpeed: BASE_MOVE_SPEED * (1 + enemyBlueprint.speedBonus / 100) * 0.92,
  });

  battle = {
    startedAt: Date.now(),
    logLines: [],
    player,
    enemy,
    enemyBlueprint,
    intervalId: window.setInterval(tickBattle, TICK_MS),
  };

  pushLog(`Encounter ${state.encounter} started. ${enemy.name} enters on ${getDifficultyLabel(state.encounter)} difficulty.`);
  maybeAutoBerserk(enemy, player);
  syncStaticUi();
  syncBattleUi();
}

function endBattle(result) {
  if (!battle) return;
  window.clearInterval(battle.intervalId);

  const enemy = battle.enemy;
  const finalLogLine = result === "win" ? "You won the encounter." : `${battle.enemy.name} won the encounter.`;
  const baseReward = 100 + (state.encounter - 1) * 52;
  const damagePercent = clamp(((enemy.maxHealth - Math.max(enemy.health, 0)) / enemy.maxHealth) * 100, 0, 100);
  let reward = baseReward;

  if (result === "loss") {
    reward = calculateLossReward(baseReward, damagePercent);
    state.losses += 1;
    pushLog(`Defeat. You damaged the enemy for ${damagePercent.toFixed(1)}% and still salvaged $${reward}.`);
  } else {
    state.wins += 1;
    pushLog(`Victory. Reward collected: $${reward}.`);
  }

  state.money += Math.floor(reward);
  maybeGrantSalvage(result);
  state.encounter += 1;
  autoSpendMoney();
  saveState();

  pushLog(finalLogLine);
  lastBattleReport = battle.logLines.join("\n");
  battle = null;
  syncStaticUi();
  syncBattleUi();
  renderShops();
  renderInventory();
  scheduleAutoAdvance();
}

function calculateLossReward(baseReward, damagePercent) {
  let divisor = 3;
  if (damagePercent >= 90) divisor = 1.5;
  else if (damagePercent >= 70) divisor = 1.7;
  else if (damagePercent >= 50) divisor = 2;
  else if (damagePercent >= 20) divisor = 2.5;
  return Math.floor(baseReward / divisor);
}

function maybeGrantSalvage(result) {
  const difficulty = getDifficultyLabel(state.encounter);
  if (!difficulty.startsWith("Tier 7")) return;
  if (!battle) return;

  const bot = battle.enemyBlueprint.bot;
  if (Math.random() <= 0.01) {
    const code = `${bot.key}:6`;
    if (!state.salvage.includes(code)) {
      state.salvage.push(code);
      pushLog(`Salvage found${result === "loss" ? " despite the loss" : ""}: ${bot.unique6}.`);
    }
  }
  if (Math.random() <= 0.005) {
    const code = `${bot.key}:7`;
    if (!state.salvage.includes(code)) {
      state.salvage.push(code);
      pushLog(`Rare salvage found: ${bot.unique7}.`);
    }
  }
}

function tickBattle() {
  if (!battle) return;

  const delta = TICK_MS / 1000;
  const { player, enemy } = battle;
  stepMovement(player, enemy, delta);
  stepActorTimers(player, enemy, delta);
  stepActorTimers(enemy, player, delta);

  maybeAutoBerserk(enemy, player);

  if (player.cooldownRemaining > 0) {
    player.cooldownRemaining = Math.max(0, player.cooldownRemaining - delta);
  }

  if (enemy.cooldownRemaining > 0) {
    enemy.cooldownRemaining = Math.max(0, enemy.cooldownRemaining - delta);
  }

  if (!isDisabled(enemy) && enemy.cooldownRemaining <= 0) {
    enemy.attackImpl(enemy, player);
    enemy.cooldownRemaining = getEffectiveCooldown(enemy);
  }

  if (player.health <= 0) {
    endBattle("loss");
    return;
  }

  if (enemy.health <= 0) {
    endBattle("win");
    return;
  }

  syncBattleUi();
}

function stepActorTimers(actor, opponent, delta) {
  actor.freezeFor = Math.max(0, actor.freezeFor - delta);
  actor.disableFor = Math.max(0, actor.disableFor - delta);
  actor.plasmaDebuffFor = Math.max(0, actor.plasmaDebuffFor - delta);

  if (actor.berserkState) {
    actor.berserkState.remaining -= delta;
    if (actor.berserkState.remaining <= 0) {
      pushLog(`${actor.name} lost ${actor.berserkState.name}.`);
      actor.berserkState = null;
    }
  }

  if (actor.burnFor > 0) {
    const tickDamage = roundNumber(actor.burnDamage * delta);
    if (tickDamage > 0) {
      applyDamage(actor, tickDamage, "burn damage", actor.name, { projectile: false });
    }
    actor.burnFor = Math.max(0, actor.burnFor - delta);
  }

  if (actor.kind === "enemy" && actor.unique7 && actor.name === "Acid Bot") {
    actor.lastVirusCheck += delta;
    if (actor.lastVirusCheck >= 2) {
      actor.lastVirusCheck = 0;
      if (Math.random() <= 0.1) {
        opponent.disableFor = Math.max(opponent.disableFor, 3);
        pushLog("Virus Acid hits. Your controls cut out for 3 seconds.");
      }
    }
  }
}

function stepMovement(player, enemy, delta) {
  if (!isDisabled(player)) {
    const dx = (inputState.right ? 1 : 0) - (inputState.left ? 1 : 0);
    const dy = (inputState.down ? 1 : 0) - (inputState.up ? 1 : 0);
    moveActor(player, dx, dy, delta);
    if (dx !== 0) player.facing = dx > 0 ? 1 : -1;
  }

  if (!isDisabled(enemy)) {
    const offsetX = player.x - enemy.x;
    const offsetY = player.y - enemy.y;
    const distance = Math.hypot(offsetX, offsetY);
    let dx = 0;
    let dy = 0;

    if (distance > 360) {
      dx = offsetX;
      dy = offsetY;
    } else if (distance < 250) {
      dx = -offsetX;
      dy = -offsetY;
    } else {
      dy = offsetY * 0.6;
    }

    moveActor(enemy, dx, dy, delta, 0.65);
    if (Math.abs(dx) > 1) enemy.facing = dx > 0 ? 1 : -1;
  }
}

function moveActor(actor, dx, dy, delta, multiplier = 1) {
  const length = Math.hypot(dx, dy);
  if (length === 0) return;

  const normalizedX = dx / length;
  const normalizedY = dy / length;
  const nextX = actor.x + normalizedX * actor.moveSpeed * multiplier * delta;
  const nextY = actor.y + normalizedY * actor.moveSpeed * multiplier * delta;
  actor.x = clamp(nextX, 70, 1210);
  actor.y = clamp(nextY, 120, 650);
}

function isDisabled(actor) {
  return actor.freezeFor > 0 || actor.disableFor > 0;
}

function getEffectiveCooldown(actor) {
  let multiplier = actor.plasmaDebuffFor > 0 ? 1.1 : 1;
  if (actor.berserkState?.key === "striker") multiplier /= 3;
  if (actor.berserkState?.key === "golden") multiplier *= 1.3;
  if (actor.key === "sawblade" && actor.unique6) multiplier /= 2.5;
  return actor.cooldownDuration * multiplier;
}

function applyDamage(target, amount, source, attackerName, options = {}) {
  if (target.health <= 0) return 0;
  const incoming = Math.max(0, amount);

  if (target.berserkState?.key === "golden" && options.projectile !== false && Math.random() <= 0.9) {
    pushLog(`${target.name} deflected ${source}.`);
    if (Math.random() <= 0.4 && battle) {
      const reflectTarget = target.kind === "player" ? battle.enemy : battle.player;
      const reflected = roundNumber(incoming / 2);
      reflectTarget.health = Math.max(0, reflectTarget.health - reflected);
      pushLog(`${target.name} reflected ${reflected} damage back to ${reflectTarget.name}.`);
    }
    return 0;
  }

  const armorMultiplier = Math.max(0.1, 1 - target.armorBonus / 100);
  const breakMultiplier = 1 + target.armorBreak / 100;
  const berserkMultiplier = target.berserkState?.key === "striker" ? 1.3 : 1;
  const finalDamage = roundNumber(incoming * armorMultiplier * breakMultiplier * berserkMultiplier);
  target.health = Math.max(0, target.health - finalDamage);
  pushLog(`${attackerName} used ${source} for ${finalDamage} damage.`);
  return finalDamage;
}

function playerAttack(attacker, defender) {
  const damage = attacker.shotDamage;
  applyDamage(defender, damage, "cannon shot", attacker.name);
  if (attacker.elementalDamage > 0) {
    applyDamage(defender, attacker.elementalDamage, "elemental splash", attacker.name, { projectile: false });
  }
}

function acidAttack(attacker, defender) {
  const damage = attacker.shotDamage;
  applyDamage(defender, damage, "acid burst", attacker.name);
  defender.acidHits += attacker.unique6 ? 2 : 1;
  if (defender.acidHits >= 7 && defender.armorBreak < 20) {
    defender.armorBreak = 20;
    pushLog(`${defender.name}'s armour has corroded. Incoming damage increased by 20%.`);
  }
}

function sawbladeAttack(attacker, defender) {
  const lossStep = attacker.unique7 ? (attacker.sawSwings > 0 && attacker.sawSwings % 3 === 0 ? 5 : 0) : 5;
  attacker.sawSwings += 1;
  attacker.sawLoss += lossStep;
  const base = attacker.shotDamage - attacker.sawLoss - (attacker.unique7 ? 7 : 0);
  applyDamage(defender, Math.max(8, base), "saw swing", attacker.name);
}

function hackerAttack(attacker, defender) {
  const damage = attacker.shotDamage + (attacker.unique6 ? 20 : 0);
  const disableTime = 5 + (attacker.unique6 ? 2 : 0);
  applyDamage(defender, damage, "hack spike", attacker.name, { projectile: false });
  defender.disableFor = Math.max(defender.disableFor, disableTime);
  pushLog(`${defender.name} is hacked for ${disableTime.toFixed(0)} seconds.`);

  if (attacker.unique7 && Math.random() <= 0.75) {
    const chainedTime = roundNumber(disableTime / 1.5);
    const chainedDamage = roundNumber(damage / 1.5);
    defender.disableFor = Math.max(defender.disableFor, chainedTime);
    applyDamage(defender, chainedDamage, "rehack", attacker.name, { projectile: false });
    pushLog("Hyper Efficient Coding triggered a weaker re-hack.");
  }
}

function sniperAttack(attacker, defender) {
  let damage = attacker.shotDamage + (attacker.unique6 ? 15 : 0);
  applyDamage(defender, damage, "sniper shot", attacker.name);
  if (attacker.unique7) {
    applyDamage(defender, 10, "plasma damage", attacker.name);
    defender.plasmaDebuffFor = Math.max(defender.plasmaDebuffFor, 4);
    if (!defender.plasmaApplied) {
      defender.maxHealth = roundNumber(defender.maxHealth * 0.9);
      defender.health = Math.min(defender.health, defender.maxHealth);
      defender.shotDamage = roundNumber(defender.shotDamage * 0.9);
      defender.cooldownDuration *= 1.1;
      defender.plasmaApplied = true;
      pushLog(`${defender.name} is destabilized. Damage, speed, and health efficiency reduced by 10%.`);
    }
  }
}

function claymoreAttack(attacker, defender) {
  let damage = attacker.shotDamage + (attacker.unique6 ? 15 : 0);
  applyDamage(defender, damage, "claymore blast", attacker.name);
  defender.armorBreak = Math.max(defender.armorBreak, attacker.unique7 ? 20 : 40);
  pushLog(`${defender.name}'s armour is compromised.`);
  if (attacker.unique7) {
    defender.burnFor = Math.max(defender.burnFor, 2);
    defender.burnDamage = 10;
    pushLog(`${defender.name} is burning for 2 seconds.`);
  }
}

function maybeAutoBerserk(actor, opponent) {
  if (!battle || actor.berserkState) return;

  if (actor.berserks.includes("golden") && !actor.usedBerserks.includes("golden") && actor.health / actor.maxHealth <= 0.45) {
    activateBerserk(actor, opponent, "golden");
    return;
  }
  if (actor.berserks.includes("striker") && !actor.usedBerserks.includes("striker") && actor.health / actor.maxHealth <= 0.6) {
    activateBerserk(actor, opponent, "striker");
    return;
  }
  if (actor.berserks.includes("freeze") && !actor.usedBerserks.includes("freeze") && opponent.health / opponent.maxHealth <= 0.65) {
    activateBerserk(actor, opponent, "freeze");
    return;
  }
}

function activateBerserk(actor, opponent, key) {
  const berserk = BERSERKS.find((item) => item.key === key);
  if (!berserk) return false;
  if (actor.berserkState || !actor.berserks.includes(key)) return false;
  if (actor.usedBerserks.includes(key)) return false;
  if (isDisabled(actor)) return false;

  if (key === "freeze") {
    opponent.freezeFor = Math.max(opponent.freezeFor, 5);
    actor.health = Math.max(0, actor.health - 40);
    pushLog(`${actor.name} activated Freeze Module. ${opponent.name} is locked for 5 seconds.`);
    pushLog(`${actor.name} took 40 self-damage from the cold backlash.`);
  } else if (key === "striker") {
    actor.berserkState = { key, name: berserk.name, remaining: 5 };
    pushLog(`${actor.name} activated Striker Module for 5 seconds.`);
  } else if (key === "golden") {
    actor.berserkState = { key, name: berserk.name, remaining: 7 };
    pushLog(`${actor.name} activated Golden Module for 7 seconds.`);
  }

  actor.usedBerserks.push(key);

  syncBattleUi();
  if (actor.health <= 0) {
    endBattle(actor.kind === "player" ? "loss" : "win");
  }
  return true;
}

function handlePlayerFire() {
  if (!battle) return;
  const { player, enemy } = battle;
  if (player.cooldownRemaining > 0 || isDisabled(player)) return;

  player.attackImpl(player, enemy);
  player.cooldownRemaining = getEffectiveCooldown(player);
  if (enemy.health <= 0) {
    endBattle("win");
    return;
  }
  syncBattleUi();
}

function handlePlayerBerserk() {
  if (!battle) return;
  const available = state.berserks.filter(
    (key) => ["freeze", "striker", "golden"].includes(key) && !battle.player.usedBerserks.includes(key)
  );
  if (available.length === 0) return;

  const preferred = ["freeze", "striker", "golden"].find((key) => available.includes(key));
  activateBerserk(battle.player, battle.enemy, preferred);
  syncBattleUi();
}

function renderShops() {
  if (!dom.upgradeShop || !dom.berserkShop) return;
  dom.upgradeShop.replaceChildren();
  MODULES.forEach((module) => {
    const currentLevel = state.modules[module.key];
    const nextLevel = Math.min(14, currentLevel + 1);
    const exhausted = currentLevel >= 14;
    const card = document.createElement("article");
    card.className = "upgrade";
    const value = getModulePercent(currentLevel, module.baseBonus);
    const cost = getModuleUpgradeCost(nextLevel);
    card.innerHTML = `
      <h4>${module.name}</h4>
      <p class="meta">Current: ${formatModuleTier(currentLevel)} ${currentLevel ? `(${module.format(value)})` : "(no bonus yet)"}</p>
      <p class="meta">${exhausted ? "Maximum tier reached." : `Next: ${formatModuleTier(nextLevel)} for $${cost}`}</p>
    `;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = exhausted ? "Maxed" : `Buy ${formatModuleTier(nextLevel)}`;
    button.disabled = exhausted || state.money < cost || Boolean(battle);
    button.addEventListener("click", () => {
      state.money -= cost;
      state.modules[module.key] = nextLevel;
      saveState();
      syncStaticUi();
      renderShops();
    });
    card.appendChild(button);
    dom.upgradeShop.appendChild(card);
  });

  dom.berserkShop.replaceChildren();
  BERSERKS.forEach((berserk) => {
    const owned = state.berserks.includes(berserk.key);
    const unlocked = highestOwnedTier() >= berserk.tier;
    const card = document.createElement("article");
    card.className = "berserk";
    card.innerHTML = `
      <span class="badge">${owned ? "Owned" : unlocked ? "Unlocked" : `Needs Tier ${berserk.tier}`}</span>
      <h4>${berserk.name}</h4>
      <p class="meta">${berserk.description}</p>
      <p class="meta">Cost: $${berserk.cost}</p>
    `;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = owned ? "Installed" : "Buy Module";
    button.disabled = owned || !unlocked || state.money < berserk.cost || Boolean(battle);
    button.addEventListener("click", () => {
      state.money -= berserk.cost;
      state.berserks = [...state.berserks, berserk.key];
      saveState();
      syncStaticUi();
      renderShops();
    });
    card.appendChild(button);
    dom.berserkShop.appendChild(card);
  });
}

function renderInventory() {
  if (!dom.uniqueInventory) return;
  dom.uniqueInventory.replaceChildren();
  if (state.salvage.length === 0) {
    const empty = document.createElement("div");
    empty.className = "inventory-item";
    empty.innerHTML = `<h4>No salvage yet</h4><p class="meta">Reach Tier 7 difficulty to start rolling 1% Tier 6 and 0.5% Tier 7 unique module drops.</p>`;
    dom.uniqueInventory.appendChild(empty);
    return;
  }

  state.salvage.forEach((code) => {
    const [botKey, tier] = code.split(":");
    const bot = BOT_TYPES.find((item) => item.key === botKey);
    const card = document.createElement("article");
    card.className = "inventory-item";
    card.innerHTML = `
      <h4>${bot ? bot.name : botKey} - Tier ${tier}</h4>
      <p class="meta">${tier === "6" ? bot?.unique6Description || "" : bot?.unique7Description || ""}</p>
    `;
    dom.uniqueInventory.appendChild(card);
  });
}

function highestOwnedTier() {
  return Math.max(...Object.values(state.modules).map((level) => getTierFromLevel(level)), 0);
}

function syncStaticUi() {
  setText(dom.encounterValue, `${state.encounter}`);
  setText(dom.moneyValue, `$${state.money}`);
  setText(dom.recordValue, `${state.wins}W / ${state.losses}L`);
  setText(dom.difficultyValue, getDifficultyLabel(state.encounter));
}

function syncBattleUi() {
  const playerProfile = getPlayerProfile();
  if (dom.playerStats) {
    dom.playerStats.replaceChildren(...makeStats([
    `Damage ${playerProfile.shotDamage}`,
    `Health ${playerProfile.maxHealth}`,
    `Armour ${playerProfile.armorBonus.toFixed(1)}%`,
    `Speed ${playerProfile.speedBonus.toFixed(1)}%`,
    `Elemental ${playerProfile.elementalDamage}`,
    `Berserks ${state.berserks.length}`,
    ]));
  }

  if (!battle) {
    setText(dom.enemyName, "Enemy Bot");
    setText(dom.playerHealthText, `${playerProfile.maxHealth} / ${playerProfile.maxHealth}`);
    setText(dom.enemyHealthText, "100 / 100");
    setWidth(dom.playerHealthBar, "100%");
    setWidth(dom.enemyHealthBar, "100%");
    setWidth(dom.playerCooldownBar, "0%");
    setWidth(dom.enemyCooldownBar, "0%");
    setText(dom.playerStatus, "Ready");
    setText(dom.enemyStatus, "");
    if (dom.enemyStats) {
      dom.enemyStats.replaceChildren(...makeStats([
        `Weapon ???`,
        `Damage ???`,
        `Health ???`,
        `Armour ???`,
        `Speed ???`,
        `Unique drop rolls Tier 7+`,
      ]));
    }
    setDisabled(dom.fireButton, true);
    setDisabled(dom.berserkButton, true);
    setDisabled(dom.startBattle, false);
    setText(dom.battleLog, lastBattleReport);
    renderArena();
    return;
  }

  const { player, enemy, enemyBlueprint } = battle;
  setText(dom.enemyName, enemy.name);
  setText(dom.playerHealthText, `${roundNumber(player.health)} / ${roundNumber(player.maxHealth)}`);
  setText(dom.enemyHealthText, `${roundNumber(enemy.health)} / ${roundNumber(enemy.maxHealth)}`);
  setWidth(dom.playerHealthBar, `${clamp((player.health / player.maxHealth) * 100, 0, 100)}%`);
  setWidth(dom.enemyHealthBar, `${clamp((enemy.health / enemy.maxHealth) * 100, 0, 100)}%`);
  setWidth(dom.playerCooldownBar, `${cooldownPercent(player)}%`);
  setWidth(dom.enemyCooldownBar, `${cooldownPercent(enemy)}%`);
  setText(dom.playerStatus, getStatusLine(player));
  setText(dom.enemyStatus, getStatusLine(enemy));
  if (dom.enemyStats) {
    dom.enemyStats.replaceChildren(...makeStats([
      `${enemyBlueprint.bot.attackName}`,
      `Damage ${enemy.shotDamage}`,
      `Health ${enemy.maxHealth}`,
      `Armour ${enemy.armorBonus.toFixed(1)}%`,
      `Speed ${enemy.speedBonus.toFixed(1)}%`,
      `${getDifficultyLabel(state.encounter)} enemy`,
    ]));
  }
  setDisabled(dom.fireButton, player.cooldownRemaining > 0 || isDisabled(player) || player.health <= 0 || enemy.health <= 0);
  setDisabled(
    dom.berserkButton,
    isDisabled(player) ||
    !state.berserks.some((key) => ["freeze", "striker", "golden"].includes(key) && !player.usedBerserks.includes(key)) ||
    Boolean(player.berserkState)
  );
  setDisabled(dom.startBattle, true);
  setText(dom.battleLog, battle.logLines.join("\n"));
  if (dom.battleLog) dom.battleLog.scrollTop = dom.battleLog.scrollHeight;
  renderArena();
}

function makeStats(items) {
  return items.map((text) => {
    const node = document.createElement("div");
    node.className = "stat-pill";
    node.textContent = text;
    return node;
  });
}

function cooldownPercent(actor) {
  const duration = Math.max(actor.cooldownDuration, 0.01);
  const remaining = clamp(actor.cooldownRemaining, 0, duration);
  return clamp((1 - remaining / duration) * 100, 0, 100);
}

function getStatusLine(actor) {
  const statuses = [];
  if (actor.freezeFor > 0) statuses.push(`Frozen ${actor.freezeFor.toFixed(1)}s`);
  if (actor.disableFor > 0) statuses.push(`Disabled ${actor.disableFor.toFixed(1)}s`);
  if (actor.berserkState) statuses.push(actor.berserkState.name);
  if (actor.armorBreak > 0) statuses.push(`Armour break +${actor.armorBreak}%`);
  if (actor.plasmaDebuffFor > 0) statuses.push(`Plasma debuff ${actor.plasmaDebuffFor.toFixed(1)}s`);
  return statuses.join(" | ") || "Nominal";
}

function pushLog(line) {
  if (!battle) return;
  battle.logLines.push(line);
  if (battle.logLines.length > 120) {
    battle.logLines = battle.logLines.slice(-120);
  }
}

function resetSave() {
  if (battle) {
    window.clearInterval(battle.intervalId);
    battle = null;
  }
  if (autoAdvanceTimeout) {
    window.clearTimeout(autoAdvanceTimeout);
    autoAdvanceTimeout = null;
  }
  state = defaultState();
  lastBattleReport = "";
  saveState();
  syncStaticUi();
  syncBattleUi();
  renderShops();
  renderInventory();
  scheduleAutoAdvance();
}

function autoSpendMoney() {
  let changed = false;
  let purchased = true;

  while (purchased) {
    purchased = false;

    const moduleOption = MODULES
      .map((module) => {
        const currentLevel = state.modules[module.key];
        const nextLevel = Math.min(14, currentLevel + 1);
        return {
          key: module.key,
          nextLevel,
          cost: currentLevel >= 14 ? Number.POSITIVE_INFINITY : getModuleUpgradeCost(nextLevel),
        };
      })
      .sort((left, right) => left.cost - right.cost)[0];

    if (moduleOption && Number.isFinite(moduleOption.cost) && moduleOption.cost <= state.money) {
      state.money -= moduleOption.cost;
      state.modules[moduleOption.key] = moduleOption.nextLevel;
      changed = true;
      purchased = true;
      continue;
    }

    const berserkOption = BERSERKS
      .filter((item) => !state.berserks.includes(item.key) && highestOwnedTier() >= item.tier && item.cost <= state.money)
      .sort((left, right) => left.cost - right.cost)[0];

    if (berserkOption) {
      state.money -= berserkOption.cost;
      state.berserks = [...state.berserks, berserkOption.key];
      changed = true;
      purchased = true;
    }
  }

  return changed;
}

function scheduleAutoAdvance() {
  if (!dom.startBattle) return;
  if (battle || autoAdvanceTimeout) return;
  autoAdvanceTimeout = window.setTimeout(() => {
    autoAdvanceTimeout = null;
    startBattle();
  }, 1100);
}

function getArenaContext() {
  if (!dom.arenaCanvas) return null;
  const context = dom.arenaCanvas.getContext("2d");
  return context;
}

function renderArena() {
  const context = getArenaContext();
  if (!context || !dom.arenaCanvas) return;

  const canvas = dom.arenaCanvas;
  const width = canvas.width;
  const height = canvas.height;
  const now = performance.now() / 1000;

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#000";
  context.fillRect(0, 0, width, height);

  if (!battle) {
    const playerX = width * 0.23;
    const enemyX = width * 0.7;
    const playerY = height * 0.58;
    const enemyY = height * 0.58;
    drawHudText(context, 150, 10, distanceUnits(playerX, playerY, enemyX, enemyY));
    drawPlayerBot(context, playerX, playerY, 150, 150, 10, now);
    drawEnemyBot(context, enemyX, enemyY, 200, 200, now);
    return;
  }

  const player = battle.player;
  const enemy = battle.enemy;
  const playerX = player.x * (width / 1280);
  const enemyX = enemy.x * (width / 1280);
  const playerY = player.y * (height / 720);
  const enemyY = enemy.y * (height / 720);
  const playerAmmo = Math.round(cooldownPercent(player) / 10);

  drawHudText(context, player.health, playerAmmo, distanceUnits(playerX, playerY, enemyX, enemyY));
  drawPlayerBot(context, playerX, playerY, player.health, player.maxHealth, playerAmmo, now, player);
  drawEnemyBot(context, enemyX, enemyY, enemy.health, enemy.maxHealth, now, enemy);
  drawShot(context, playerX + 16 * player.facing, playerY - 16, enemyX - 18 * enemy.facing, enemyY - 6, justFired(player), "#2f44ff");
  drawShot(context, enemyX + 14 * enemy.facing, enemyY - 4, playerX + 12 * player.facing, playerY - 12, justFired(enemy), "#ff4338");
}

function drawHudText(context, hp, ammo, dist) {
  context.save();
  context.fillStyle = "#f5f5f5";
  context.font = '700 28px "Share Tech Mono", monospace';
  context.textBaseline = "top";
  context.fillText(`HP: ${Math.max(0, Math.round(hp))} | AMMO: ${Math.max(0, ammo)} | DIST: ${dist.toFixed(1)}U`, 28, 24);
  context.restore();
}

function drawPlayerBot(context, x, y, health, maxHealth, ammo, now, actor = null) {
  context.save();
  context.translate(x, y);

  context.strokeStyle = "#0f25ff";
  context.lineWidth = 6;
  context.beginPath();
  context.arc(0, 0, 40, 0, Math.PI * 2);
  context.stroke();

  context.fillStyle = "#3948ff";
  context.beginPath();
  context.arc(0, 0, 25, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "rgba(15, 37, 255, 0.95)";
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(26 * (actor?.facing || 1), -26);
  context.stroke();

  if (actor?.berserkState) {
    context.strokeStyle = "#ffd24d";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(0, 0, 50 + Math.sin(now * 16) * 2, 0, Math.PI * 2);
    context.stroke();
  }

  if (actor && isDisabled(actor)) {
    context.strokeStyle = "#8fd3ff";
    context.setLineDash([6, 6]);
    context.lineWidth = 2;
    context.beginPath();
    context.arc(0, 0, 56, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
  }

  context.restore();
  drawHealthBar(context, x - 30, y - 48, 60, health, maxHealth);

  context.save();
  context.fillStyle = "#ff2b2b";
  context.font = '700 18px "Share Tech Mono", monospace';
  context.fillText(`${Math.max(0, ammo)}`, x + 10, y - 24);
  context.restore();
}

function drawEnemyBot(context, x, y, health, maxHealth, now, actor = null) {
  context.save();
  context.translate(x, y);

  context.fillStyle = "#ff3a2f";
  context.beginPath();
  context.arc(0, 0, 24, 0, Math.PI * 2);
  context.fill();

  if (actor?.berserkState) {
    context.strokeStyle = "#ffd24d";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(0, 0, 36 + Math.sin(now * 16) * 2, 0, Math.PI * 2);
    context.stroke();
  }

  if (actor && isDisabled(actor)) {
    context.strokeStyle = "#8fd3ff";
    context.setLineDash([6, 6]);
    context.lineWidth = 2;
    context.beginPath();
    context.arc(0, 0, 42, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
  }

  context.restore();
  drawHealthBar(context, x - 30, y - 48, 60, health, maxHealth);

  context.save();
  context.fillStyle = "#f5f5f5";
  context.font = '700 18px "Share Tech Mono", monospace';
  context.fillText(`${Math.max(0, Math.round(health))}`, x + 38, y - 40);
  context.restore();
}

function drawHealthBar(context, x, y, width, health, maxHealth) {
  context.save();
  context.fillStyle = "#114400";
  context.fillRect(x, y, width, 8);
  context.fillStyle = "#00ff1a";
  context.fillRect(x, y, width * clamp(health / Math.max(maxHealth, 1), 0, 1), 8);
  context.restore();
}

function drawShot(context, fromX, fromY, toX, toY, active, color) {
  if (!active) return;
  context.save();
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(fromX, fromY);
  context.lineTo(toX, toY);
  context.stroke();
  context.restore();
}

function justFired(actor) {
  if (!actor) return false;
  const duration = Math.max(actor.cooldownDuration, 0.01);
  return actor.cooldownRemaining >= duration - 0.14;
}

function distanceUnits(fromX, fromY, toX, toY) {
  return Math.hypot(toX - fromX, toY - fromY) / 6.65;
}

function resizeArenaCanvas() {
  if (!dom.arenaCanvas) return;
  const ratio = window.devicePixelRatio || 1;
  const bounds = dom.arenaCanvas.getBoundingClientRect();
  const nextWidth = Math.max(1, Math.round(bounds.width * ratio));
  const nextHeight = Math.max(1, Math.round(bounds.height * ratio));

  if (dom.arenaCanvas.width !== nextWidth || dom.arenaCanvas.height !== nextHeight) {
    dom.arenaCanvas.width = nextWidth;
    dom.arenaCanvas.height = nextHeight;
  }
}

function setInput(eventCode, pressed) {
  if (eventCode === "KeyW" || eventCode === "ArrowUp") inputState.up = pressed;
  if (eventCode === "KeyS" || eventCode === "ArrowDown") inputState.down = pressed;
  if (eventCode === "KeyA" || eventCode === "ArrowLeft") inputState.left = pressed;
  if (eventCode === "KeyD" || eventCode === "ArrowRight") inputState.right = pressed;
}

function tickArenaFrame() {
  renderArena();
  arenaFrame = window.requestAnimationFrame(tickArenaFrame);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundNumber(value) {
  return Math.round(value * 10) / 10;
}

if (dom.startBattle) dom.startBattle.addEventListener("click", startBattle);
if (dom.resetSave) dom.resetSave.addEventListener("click", resetSave);
if (dom.fireButton) dom.fireButton.addEventListener("click", handlePlayerFire);
if (dom.berserkButton) dom.berserkButton.addEventListener("click", handlePlayerBerserk);

if (dom.arenaCanvas) {
  resizeArenaCanvas();
  if (!arenaFrame) {
    arenaFrame = window.requestAnimationFrame(tickArenaFrame);
  }

  dom.arenaCanvas.addEventListener("pointerdown", handlePlayerFire);
  window.addEventListener("resize", resizeArenaCanvas);
  window.addEventListener("keydown", (event) => {
    setInput(event.code, true);
    if (event.code === "Space") {
      event.preventDefault();
      if (!event.repeat) handlePlayerFire();
      return;
    }
    if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
      event.preventDefault();
      if (!event.repeat) handlePlayerBerserk();
      return;
    }
    if (event.code.startsWith("Arrow") || event.code.startsWith("Key")) {
      event.preventDefault();
    }
  });
  window.addEventListener("keyup", (event) => {
    setInput(event.code, false);
    if (event.code.startsWith("Arrow") || event.code.startsWith("Key") || event.code === "Space") {
      event.preventDefault();
    }
  });
  window.addEventListener("blur", () => {
    inputState.up = false;
    inputState.down = false;
    inputState.left = false;
    inputState.right = false;
  });
}

if (dom.startBattle || dom.arenaCanvas) {
  syncStaticUi();
  syncBattleUi();
  renderShops();
  renderInventory();
  scheduleAutoAdvance();
}
