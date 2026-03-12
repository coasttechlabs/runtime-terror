const STORAGE_KEY = "runtime-terror-solo-save-v2";
const TICK_MS = 16;
const BASE_HEALTH = 150;
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
  },
  {
    key: "freeze",
    tier: 4,
    name: "Freeze Module Tier 4 (Active)",
    description: "Ability freezes enemy for 5s. Self-inflicts 40 dmg on use.",
    cost: 420,
  },
  {
    key: "striker",
    tier: 6,
    name: "Striker Module Tier 6 (Active)",
    description: "Ability: 3x Fire Rate, +30% Dmg taken for 5s.",
    cost: 760,
  },
  {
    key: "golden",
    tier: 7,
    name: "Golden Module Tier 7 (Active)",
    description: "Ability: 90% Deflect, 40% Reflect. Self Slow 40%, Fire Rate -30% for 7s.",
    cost: 980,
  },
];

const PLAYER_BOT_TYPES = [
  {
    key: "acid",
    name: "Acid Bot",
    damage: 30,
    cooldown: 2,
    color: "#32CD32", // Green
    abilityName: null,
    abilityCooldown: 0,
    ability: null,
    attackName: "acid stream",
    attack: acidAttack,
  },
  {
    key: "sawblade",
    name: "Swinging Sawblade Bot",
    damage: 45,
    cooldown: 2,
    color: "#9932CC", // Purple
    abilityName: null,
    abilityCooldown: 0,
    ability: null,
    attackName: "saw swing",
    attack: sawbladeAttack,
  },
  {
    key: "hacker",
    name: "Hacking Bot",
    damage: 20, // Bullet damage
    cooldown: 1, // 1 second delay
    color: "#1E90FF", // Blue
    abilityName: "System Hack",
    abilityCooldown: 10,
    attackName: "bullet",
    attack: playerAttack, // Normal shot
    ability: hackerAbility,
  },
  {
    key: "sniper",
    name: "Sniper Bot",
    damage: 50,
    cooldown: 3,
    color: "#FF4500", // Red
    abilityName: null,
    abilityCooldown: 0,
    ability: null,
    attackName: "sniper shot",
    attack: sniperAttack,
  },
  {
    key: "claymore",
    name: "Claymore Roomba",
    damage: 20, // Bullet damage
    cooldown: 1, // 1 second delay
    color: "#FFD700", // Yellow
    abilityName: "Detonate",
    abilityCooldown: 12,
    attackName: "standard shot",
    attack: playerAttack,
    ability: claymoreAbility,
  },
];

const BOT_TYPES = [
  {
    key: "acid",
    name: "Acid Bot",
    damage: 30,
    cooldown: 2,
    color: "#32CD32",
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
    color: "#9932CC",
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
    damage: 20,
    cooldown: 1,
    color: "#1E90FF",
    attackName: "bullet",
    unique6: "HyperThreadingTechnology",
    unique6Description: "Hack lasts 2 more seconds and deals 20 more damage.",
    unique7: "Hyper Efficient Coding",
    unique7Description: "75% chance to chain a weaker second hack.",
    attack: playerAttack, // Uses bullets as primary
  },
  {
    key: "sniper",
    name: "Sniper Bot",
    damage: 50,
    cooldown: 3,
    color: "#FF4500",
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
    damage: 20,
    cooldown: 1,
    color: "#FFD700",
    attackName: "standard shot",
    unique6: "Optimized Explosion Spreads",
    unique6Description: "Explosion coverage improves, adding 15 damage.",
    unique7: "Fire Infused Explosions",
    unique7Description: "Adds fire damage over time and reduces enemy armour.",
    attack: playerAttack, // Uses bullets as primary
  },
];

const dom = {
  arenaCanvas: document.querySelector("#arena-canvas"),
  botSelectionScreen: document.querySelector("#bot-selection-screen"),
  botSelectionContainer: document.querySelector("#bot-selection-container"),
  gameOverScreen: document.querySelector("#game-over-screen"),
  arenaScreen: document.querySelector("#arena-screen"),
  encounterValue: document.querySelector("#encounter-value"),
  moneyValue: document.querySelector("#money-value"),
  recordValue: document.querySelector("#record-value"),
  difficultyValue: document.querySelector("#difficulty-value"),
  startBattle: document.querySelector("#start-battle"),
  resetSave: document.querySelector("#reset-save"),
  playAgainButton: document.querySelector("#play-again-button"),
  profileButton: document.querySelector("#profile-button"),
  gameOverTitle: document.querySelector("#game-over-title"),
  gameOverMessage: document.querySelector("#game-over-message"),
  fireButton: document.querySelector("#fire-button"),
  abilityButton: document.querySelector("#ability-button"),
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
  mouseX: 0,
  mouseY: 0,
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
    playerBotKey: null,
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
  if (nextLevel <= 1) return 650;
  let cost = 650;
  for (let l = 2; l <= nextLevel; l++) {
    if (isPlusLevel(l)) cost *= 1.5;
    else cost *= 2.5;
  }
  return Math.floor(cost);
}

function getPlayerProfile() {
  const playerBot = PLAYER_BOT_TYPES.find((b) => b.key === state.playerBotKey) || PLAYER_BOT_TYPES[0];
  const baseDamage = playerBot.damage;
  const baseCooldown = playerBot.cooldown;

  const damageBonus = getModulePercent(state.modules.damage, 7.5);
  const healthBonus = getModulePercent(state.modules.health, 7.5);
  const armorBonus = getModulePercent(state.modules.armor, 7.5);
  const speedBonus = getModulePercent(state.modules.speed, 10);
  const hasElemental = state.berserks.includes("elemental");

  const healthMultiplier = (1 + healthBonus / 100) * (hasElemental ? 0.9 : 1);
  return {
    bot: playerBot,
    damageBonus,
    healthBonus,
    armorBonus,
    speedBonus,
    maxHealth: roundNumber(BASE_HEALTH * healthMultiplier),
    shotDamage: roundNumber(baseDamage * (1 + damageBonus / 100)),
    abilityCooldown: playerBot.abilityCooldown,
    elementalDamage: hasElemental ? roundNumber(baseDamage * 0.1) : 0,
    cooldown: baseCooldown / (1 + speedBonus / 100),
  };
}

function getEnemyBlueprint() {
  const stage = getProgressionStage(state.encounter);
  const bot = BOT_TYPES[Math.floor(Math.random() * BOT_TYPES.length)];
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
    color: config.color || "#ccc",
    shotDamage: config.shotDamage,
    elementalDamage: config.elementalDamage || 0,
    armorBonus: config.armorBonus || 0,
    speedBonus: config.speedBonus || 0,
    cooldownDuration: config.cooldown,
    cooldownRemaining: 0,
    abilityImpl: config.abilityImpl,
    abilityCooldownDuration: config.abilityCooldown || 0,
    abilityCooldownRemaining: 0,
    freezeFor: 0,
    disableFor: 0,
    burnFor: 0,
    burnDamage: 0,
    armorBreak: 0,
    plasmaDebuffFor: 0,
    acidHits: 0,
    strikerModeFor: 0,
    goldenModeFor: 0,
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
    key: playerProfile.bot.key,
    name: playerProfile.bot.name,
    color: playerProfile.bot.color,
    ...playerProfile,
    berserks: state.berserks,
    attackImpl: playerProfile.bot.attack,
    abilityImpl: playerProfile.bot.ability,
    x: 220,
    y: 420,
    moveSpeed: BASE_MOVE_SPEED * (1 + playerProfile.speedBonus / 100),
  });
  const enemy = createActor("enemy", {
    key: enemyBlueprint.bot.key,
    name: enemyBlueprint.bot.name,
    color: enemyBlueprint.bot.color,
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

  // Add a one second delay before shooting bullets, including at the start of the match
  player.cooldownRemaining = 1;
  enemy.cooldownRemaining = 1;

  pushLog(`Encounter ${state.encounter} started. ${enemy.name} enters on ${getDifficultyLabel(state.encounter)} difficulty.`);
  applyPassiveBerserks(player);
  applyPassiveBerserks(enemy);
  syncStaticUi();
  syncBattleUi();
  if (dom.gameOverScreen) dom.gameOverScreen.classList.add("hidden");
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
  saveState();

  pushLog(finalLogLine);
  lastBattleReport = battle.logLines.join("\n");
  battle = null;
  syncStaticUi();
  syncBattleUi();
  renderShops();
  renderInventory();
  
  // Show Game Over Screen
  if (dom.gameOverScreen) {
    dom.gameOverScreen.classList.remove("hidden");
    if (result === "win") {
      setText(dom.gameOverTitle, "VICTORY");
      setText(dom.gameOverMessage, `You defeated ${enemy.name}! Reward: $${Math.floor(reward)}`);
    } else {
      setText(dom.gameOverTitle, "DEFEAT");
      setText(dom.gameOverMessage, `You were destroyed by ${enemy.name}. Salvage: $${Math.floor(reward)}`);
    }
  }
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

  if (player.cooldownRemaining > 0) {
    player.cooldownRemaining = Math.max(0, player.cooldownRemaining - delta);
  }

  // Sawblade Passive Logic: Auto-attacks if in range (30 units) and cooldown is ready
  if (player.key === "sawblade" && player.cooldownRemaining <= 0 && !isDisabled(player)) {
      const dist = distanceUnits(player.x, player.y, enemy.x, enemy.y);
      if (dist <= 30) {
          player.attackImpl(player, enemy);
          player.cooldownRemaining = getEffectiveCooldown(player);
      }
  }

  if (player.abilityCooldownRemaining > 0) {
    player.abilityCooldownRemaining = Math.max(0, player.abilityCooldownRemaining - delta);
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
  actor.strikerModeFor = Math.max(0, actor.strikerModeFor - delta);
  actor.goldenModeFor = Math.max(0, actor.goldenModeFor - delta);

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

    // Modified AI logic: Sawblade rushes, others keep distance
    const isSawblade = enemy.key === "sawblade";
    const minRange = isSawblade ? 0 : 250;
    const maxRange = isSawblade ? 20 : 360;

    if (distance > maxRange) {
      dx = offsetX;
      dy = offsetY;
    } else if (distance < minRange) {
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
  
  if (actor.goldenModeFor > 0) multiplier *= 0.6; // 40% slower

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
  if (actor.strikerModeFor > 0) multiplier /= 3; // 3x Fire Rate = 1/3 cooldown
  if (actor.goldenModeFor > 0) multiplier *= 1.3; // 30% slower
  if (actor.key === "sawblade" && actor.unique6) multiplier /= 2.5;
  return actor.cooldownDuration * multiplier;
}

function applyDamage(target, amount, source, attackerName, options = {}) {
  if (target.health <= 0) return 0;
  const incoming = Math.max(0, amount);

  // Golden Module Logic (Active)
  if (target.goldenModeFor > 0 && options.projectile !== false) {
    if (Math.random() <= 0.9) {
      pushLog(`${target.name} deflected ${source} (Golden).`);
      if (Math.random() <= 0.4 && battle) {
        const reflectTarget = target.kind === "player" ? battle.enemy : battle.player;
        const reflected = roundNumber(incoming / 2);
        reflectTarget.health = Math.max(0, reflectTarget.health - reflected);
        pushLog(`${target.name} reflected ${reflected} damage back to ${reflectTarget.name}.`);
      }
      return 0;
    }
  }

  const armorMultiplier = Math.max(0.1, 1 - target.armorBonus / 100);
  const breakMultiplier = 1 + target.armorBreak / 100;
  
  // Striker Vulnerability
  const strikerMult = target.strikerModeFor > 0 ? 1.3 : 1;

  const finalDamage = roundNumber(incoming * armorMultiplier * breakMultiplier * strikerMult);
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
  if (attacker.berserks.includes("freeze") && Math.random() <= 0.15) {
    defender.moveSpeed *= 0.8; 
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
  const dist = distanceUnits(attacker.x, attacker.y, defender.x, defender.y);
  if (dist > 30) return;

  // Starts at 45, -5 every hit
  const degradation = 5;
  const lossStep = attacker.unique7 ? (attacker.sawSwings > 0 && attacker.sawSwings % 3 === 0 ? degradation : 0) : degradation;
  
  attacker.sawSwings += 1;
  attacker.sawLoss += lossStep;
  
  const base = attacker.shotDamage - attacker.sawLoss - (attacker.unique7 ? 7 : 0);
  applyDamage(defender, Math.max(8, base), "saw swing", attacker.name, { projectile: false });
}

// This is now the Ability for the Hacker bot, not primary fire
function hackerAbility(attacker, defender) {
  const damage = 40 + (attacker.unique6 ? 20 : 0);
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

// This is now the Ability for Claymore, not primary fire
function claymoreAbility(attacker, defender) {
  let damage = 65 + (attacker.unique6 ? 15 : 0);
  applyDamage(defender, damage, "Explosion", attacker.name, { projectile: false });
  defender.armorBreak = Math.max(defender.armorBreak, attacker.unique7 ? 20 : 40);
  pushLog(`${defender.name}'s armour is compromised.`);
  if (attacker.unique7) {
    defender.burnFor = Math.max(defender.burnFor, 2);
    defender.burnDamage = 10;
    pushLog(`${defender.name} is burning for 2 seconds.`);
  }
}

function applyPassiveBerserks(actor) {
  return true;
}

function handlePlayerFire() {
  if (!battle) return;
  const { player, enemy } = battle;
  if (player.cooldownRemaining > 0 || isDisabled(player)) return;

  // Manual Aim Logic
  const rect = dom.arenaCanvas.getBoundingClientRect();
  // Convert mouse position (CSS pixels) directly to Game Logic Coordinates (1280x720)
  const mouseGameX = (inputState.mouseX - rect.left) * (1280 / rect.width);
  const mouseGameY = (inputState.mouseY - rect.top) * (720 / rect.height);

  const angle = Math.atan2(mouseGameY - player.y, mouseGameX - player.x);
  
  // Raycast Hit Check
  const angleToEnemy = Math.atan2(enemy.y - player.y, enemy.x - player.x);
  const distToEnemy = Math.hypot(enemy.x - player.x, enemy.y - player.y);
  // Hitbox cone based on distance (closer = wider angular tolerance)
  const threshold = Math.atan2(40, distToEnemy); 
  const diff = Math.abs(angle - angleToEnemy);
  const normalizedDiff = Math.abs(((diff + Math.PI) % (2 * Math.PI)) - Math.PI);

  if (normalizedDiff < threshold) {
      player.attackImpl(player, enemy);
  }

  // Visuals: Save target for drawShot
  player.aimTarget = { x: player.x + Math.cos(angle) * 1280, y: player.y + Math.sin(angle) * 1280 };

  player.cooldownRemaining = getEffectiveCooldown(player);
  if (enemy.health <= 0) {
    endBattle("win");
    return;
  }
  syncBattleUi();
}

function handlePlayerAbility() {
  if (!battle) return;
  const { player, enemy } = battle;
  if (player.abilityCooldownRemaining > 0 || isDisabled(player)) return;
  
  // Check if we have an ability OR Berserk triggers
  const hasBerserkAbility = player.berserks.some(k => ["freeze", "striker", "golden"].includes(k));
  if (!player.abilityImpl && !hasBerserkAbility) return;
  
  if (player.abilityImpl) {
    player.abilityImpl(player, enemy);
    pushLog(`${player.name} used ability.`);
  }

  // Berserk Active Triggers
  if (player.berserks.includes("freeze")) {
    enemy.freezeFor = Math.max(enemy.freezeFor, 5);
    applyDamage(player, 40, "Freeze Module Self-Damage", player.name, { projectile: false });
    pushLog("Freeze Module active: Enemy frozen 5s, 40 self-damage taken.");
  }

  if (player.berserks.includes("striker")) {
    player.strikerModeFor = 5;
    pushLog("Striker Module active: 3x Fire Rate, +30% Incoming Dmg for 5s.");
  }

  if (player.berserks.includes("golden")) {
    player.goldenModeFor = 7;
    pushLog("Golden Module active: Deflection/Reflection up, Speed/FireRate down for 7s.");
  }

  player.abilityCooldownRemaining = Math.max(player.abilityCooldownDuration, hasBerserkAbility && player.abilityCooldownDuration === 0 ? 12 : 0);
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
  setDisabled(dom.abilityButton, true);
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
    dom.abilityButton,
    isDisabled(player) ||
    (!player.abilityImpl && !player.berserks.some(k => ["freeze", "striker", "golden"].includes(k))) || 
    player.abilityCooldownRemaining > 0
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
  if (actor.strikerModeFor > 0) statuses.push(`Striker ${actor.strikerModeFor.toFixed(1)}s`);
  if (actor.goldenModeFor > 0) statuses.push(`Golden ${actor.goldenModeFor.toFixed(1)}s`);
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
  if (dom.gameOverScreen) {
      dom.gameOverScreen.classList.add("hidden");
  }
  if (autoAdvanceTimeout) {
    window.clearTimeout(autoAdvanceTimeout);
    autoAdvanceTimeout = null;
  }
  state = defaultState();
  lastBattleReport = "";
  saveState();
  renderBotSelection();
  showScreen("bot-selection");
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
  // Disabled auto-advance to allow Win Screen interaction
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
    drawHudText(context, BASE_HEALTH, distanceUnits(playerX, playerY, enemyX, enemyY));
    drawBot(context, playerX, playerY, BASE_HEALTH, BASE_HEALTH, "#0000FF", now, { kind: "player", color: "#666" }); // Demo player
    drawBot(context, enemyX, enemyY, 200, 200, "#FF0000", now, { kind: "enemy", color: "#666" }); // Demo enemy
    return;
  }

  const player = battle.player;
  const enemy = battle.enemy;
  const playerX = player.x * (width / 1280);
  const enemyX = enemy.x * (width / 1280);
  const playerY = player.y * (height / 720);
  const enemyY = enemy.y * (height / 720);

  drawHudText(context, player.health, distanceUnits(playerX, playerY, enemyX, enemyY));
  drawBot(context, playerX, playerY, player.health, player.maxHealth, "#0000FF", now, player);
  drawBot(context, enemyX, enemyY, enemy.health, enemy.maxHealth, "#FF0000", now, enemy);
  
  // Player Shot Visual (Manual Aim)
  if (justFired(player) && player.key !== "sawblade") {
    const tx = player.aimTarget ? player.aimTarget.x * (width / 1280) : (enemyX - 18 * enemy.facing);
    const ty = player.aimTarget ? player.aimTarget.y * (height / 720) : (enemyY - 6);
    drawShot(context, playerX + 16 * player.facing, playerY - 16, tx, ty, true, "#2f44ff");
  }
  
  drawShot(context, enemyX + 14 * enemy.facing, enemyY - 4, playerX + 12 * player.facing, playerY - 12, justFired(enemy) && enemy.key !== "sawblade", "#ff4338");
}

function drawHudText(context, hp, dist) {
  context.save();
  context.fillStyle = "#f5f5f5";
  context.font = '700 28px "Share Tech Mono", monospace';
  context.textBaseline = "top";
  context.fillText(`HP: ${Math.max(0, Math.round(hp))} | DIST: ${dist.toFixed(1)}U`, 28, 24);
  context.restore();
}

function drawBot(context, x, y, health, maxHealth, identityColor, now, actor) {
  context.save();
  context.translate(x, y);

  // Main Body Body
  context.strokeStyle = actor.color || "#fff";
  context.lineWidth = 6;
  context.beginPath();
  context.arc(0, 0, 40, 0, Math.PI * 2);
  context.stroke();

  // Inner Fill
  context.fillStyle = actor.color || "#ccc";
  context.beginPath();
  context.arc(0, 0, 25, 0, Math.PI * 2);
  context.fill();

  // Weapon/Facing Arm
  context.strokeStyle = "rgba(15, 37, 255, 0.95)";
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(26 * (actor?.facing || 1), -26);
  context.stroke();

  // Identity Square (Blue = You, Red = Opponent)
  context.fillStyle = identityColor;
  context.fillRect(-8, -8, 16, 16);

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
  return Math.hypot(toX - fromX, toY - fromY) / 12.8;
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundNumber(value) {
  return Math.round(value * 10) / 10;
}

function showScreen(screen) {
  dom.botSelectionScreen.classList.add("hidden");
  dom.arenaScreen.classList.add("hidden");

  if (screen === "bot-selection") {
    dom.botSelectionScreen.classList.remove("hidden");
  } else if (screen === "arena") {
    dom.arenaScreen.classList.remove("hidden");
  }
}

function renderBotSelection() {
  if (!dom.botSelectionContainer) return;
  dom.botSelectionContainer.replaceChildren();

  PLAYER_BOT_TYPES.forEach((bot) => {
    const card = document.createElement("article");
    card.className = "bot-card";
    card.dataset.botKey = bot.key;
    card.innerHTML = `
      <h3>${bot.name}</h3>
    `;
    card.addEventListener("click", () => {
      selectPlayerBot(bot.key);
    });
    dom.botSelectionContainer.appendChild(card);
  });
}

function selectPlayerBot(botKey) {
  state.playerBotKey = botKey;
  saveState();
  showScreen("arena");
  resizeArenaCanvas();
  startBattle();
}

function initializeArena() {
  if (dom.startBattle || dom.arenaCanvas) {
    syncStaticUi();
    syncBattleUi();
    renderShops();
    renderInventory();
    scheduleAutoAdvance();
  }
}

function main() {
  state = loadState();
  renderBotSelection();
  showScreen("bot-selection");
}

if (dom.startBattle) dom.startBattle.addEventListener("click", startBattle);
if (dom.resetSave) dom.resetSave.addEventListener("click", resetSave);
if (dom.fireButton) dom.fireButton.addEventListener("click", handlePlayerFire);
if (dom.abilityButton) dom.abilityButton.addEventListener("click", handlePlayerAbility);
if (dom.playAgainButton) dom.playAgainButton.addEventListener("click", () => {
    dom.gameOverScreen.classList.add("hidden");
    startBattle();
});
if (dom.profileButton) dom.profileButton.addEventListener("click", () => {
    window.location.href = "profile-settings.html";
});

function tickArenaFrame() {
  renderArena();
  arenaFrame = window.requestAnimationFrame(tickArenaFrame);
}

if (dom.arenaCanvas) {
  resizeArenaCanvas();
  if (!arenaFrame) {
    arenaFrame = window.requestAnimationFrame(tickArenaFrame);
  }
  dom.arenaCanvas.addEventListener("mousemove", (e) => {
      inputState.mouseX = e.clientX;
      inputState.mouseY = e.clientY;
  });
  dom.arenaCanvas.addEventListener("pointerdown", handlePlayerFire);
  window.addEventListener("resize", resizeArenaCanvas);
  window.addEventListener("keydown", (event) => {
    setInput(event.code, true);
    if (event.code === "Space" || event.code === "KeyQ") {
      event.preventDefault();
      if (!event.repeat) handlePlayerAbility();
      return;
    }
    if (event.code.startsWith("Arrow") || event.code.startsWith("Key")) {
      event.preventDefault();
    }
  });
  window.addEventListener("keyup", (event) => {
    setInput(event.code, false);
    if (event.code.startsWith("Arrow") || event.code.startsWith("Key") || event.code === "Space" || event.code === "KeyQ") {
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

main();
