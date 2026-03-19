import copy
import math
import time

MODULE_BASES = {
    "damage": 7.5,
    "health": 7.5,
    "armor": 7.5,
    "speed": 10,
}

ACTIONABLE_BERSERKS = {"freeze", "striker", "golden"}
VALID_BERSERKS = {"elemental", "freeze", "striker", "golden"}
VALID_BOT_KEYS = {"acid", "sawblade", "hacker", "sniper", "claymore"}
VALID_UNIQUE_TIERS = {"6", "7"}

BASE_HEALTH = 250
BASE_MOVE_SPEED = 100
ARENA_BOUNDS = {"minX": 70, "maxX": 1210, "minY": 120, "maxY": 650}
CHALLENGE_TTL_MS = 5 * 60 * 1000
RECONNECT_GRACE_MS = 20 * 1000
TICK_STEP_SECONDS = 0.05
MAX_ADVANCE_SECONDS = 2.0

BOT_CONFIGS = {
    "acid": {
        "name": "Acid Bot",
        "damage": 30,
        "cooldown": 2,
        "color": "#32CD32",
        "attackName": "acid burst",
        "attackType": "acid",
        "abilityType": None,
        "abilityCooldown": 0,
        "maxAbilityUses": 0,
    },
    "sawblade": {
        "name": "Swinging Sawblade Bot",
        "damage": 45,
        "cooldown": 2,
        "color": "#9932CC",
        "attackName": "saw swing",
        "attackType": "sawblade",
        "abilityType": None,
        "abilityCooldown": 0,
        "maxAbilityUses": 0,
    },
    "hacker": {
        "name": "Hacking Bot",
        "damage": 20,
        "abilityDamage": 40,
        "cooldown": 1,
        "color": "#1E90FF",
        "attackName": "cannon shot",
        "attackType": "projectile",
        "abilityType": "hack",
        "abilityCooldown": 10,
        "maxAbilityUses": 2,
    },
    "sniper": {
        "name": "Sniper Bot",
        "damage": 50,
        "cooldown": 3,
        "color": "#FF4500",
        "attackName": "sniper shot",
        "attackType": "sniper",
        "abilityType": None,
        "abilityCooldown": 0,
        "maxAbilityUses": 0,
    },
    "claymore": {
        "name": "Claymore Roomba",
        "damage": 20,
        "abilityDamage": 65,
        "cooldown": 1,
        "color": "#FFD700",
        "attackName": "cannon shot",
        "attackType": "projectile",
        "abilityType": "claymore",
        "abilityCooldown": 12,
        "maxAbilityUses": 999999,
    },
}


def now_ms():
    return int(time.time() * 1000)


def default_loadout():
    return {
        "playerBotKey": "acid",
        "modules": {key: 0 for key in MODULE_BASES},
        "berserks": [],
        "equippedBerserk": None,
        "salvage": [],
        "equippedUniques": {},
    }


def normalize_loadout(payload):
    source = payload if isinstance(payload, dict) else {}
    base = default_loadout()
    merged = copy.deepcopy(base)

    bot_key = str(source.get("playerBotKey") or source.get("botKey") or base["playerBotKey"]).strip().lower()
    if bot_key not in VALID_BOT_KEYS:
        raise ValueError("playerBotKey must be one of acid, sawblade, hacker, sniper, or claymore.")
    merged["playerBotKey"] = bot_key

    modules = source.get("modules")
    if not isinstance(modules, dict):
        modules = {}
    for key in MODULE_BASES:
        try:
            value = int(modules.get(key, 0))
        except (TypeError, ValueError) as exc:
            raise ValueError(f"modules.{key} must be an integer.") from exc
        if value < 0 or value > 14:
            raise ValueError(f"modules.{key} must be between 0 and 14.")
        merged["modules"][key] = value

    berserks = source.get("berserks")
    if berserks is None:
        berserks = []
    if not isinstance(berserks, list):
        raise ValueError("berserks must be a list.")
    normalized_berserks = []
    for key in berserks:
        name = str(key).strip().lower()
        if name not in VALID_BERSERKS:
            raise ValueError("berserks contains an invalid module.")
        if name not in normalized_berserks:
            normalized_berserks.append(name)
    merged["berserks"] = normalized_berserks

    equipped_berserk = source.get("equippedBerserk")
    if equipped_berserk in ("", None):
        merged["equippedBerserk"] = None
    else:
        equipped_name = str(equipped_berserk).strip().lower()
        if equipped_name not in VALID_BERSERKS:
            raise ValueError("equippedBerserk contains an invalid module.")
        if equipped_name not in normalized_berserks:
            raise ValueError("equippedBerserk must also appear in berserks.")
        merged["equippedBerserk"] = equipped_name

    salvage = source.get("salvage")
    if salvage is None:
        salvage = []
    if not isinstance(salvage, list):
        raise ValueError("salvage must be a list.")
    merged["salvage"] = [str(item).strip() for item in salvage if str(item).strip()]

    equipped_uniques = source.get("equippedUniques")
    if equipped_uniques is None:
        equipped_uniques = {}
    if not isinstance(equipped_uniques, dict):
        raise ValueError("equippedUniques must be an object.")
    normalized_uniques = {}
    for bot_key, tier in equipped_uniques.items():
        normalized_key = str(bot_key).strip().lower()
        if normalized_key not in VALID_BOT_KEYS:
            raise ValueError("equippedUniques contains an invalid bot key.")
        if tier in ("", None):
            normalized_uniques[normalized_key] = None
            continue
        normalized_tier = str(tier).strip()
        if normalized_tier not in VALID_UNIQUE_TIERS:
            raise ValueError("equippedUniques values must be 6, 7, or null.")
        normalized_uniques[normalized_key] = normalized_tier
    merged["equippedUniques"] = normalized_uniques
    return merged


def serialize_loadout_document(uid, data):
    payload = normalize_loadout(data)
    payload["uid"] = uid
    return payload


def _round(value):
    return round(float(value) * 10) / 10


def _clamp(value, minimum, maximum):
    return min(maximum, max(minimum, value))


def _get_tier_from_level(level):
    return math.ceil(level / 2) if level > 0 else 0


def _is_plus_level(level):
    return level > 0 and level % 2 == 0


def _get_module_percent(level, base_bonus):
    if level <= 0:
        return 0
    tier = _get_tier_from_level(level)
    plus_bonus = 2.5 if _is_plus_level(level) else 0
    return base_bonus * (2 ** (tier - 1)) + plus_bonus


def build_player_profile(loadout):
    normalized = normalize_loadout(loadout)
    bot = BOT_CONFIGS[normalized["playerBotKey"]]
    equipped_unique = normalized["equippedUniques"].get(normalized["playerBotKey"])
    damage_bonus = _get_module_percent(normalized["modules"]["damage"], MODULE_BASES["damage"])
    health_bonus = _get_module_percent(normalized["modules"]["health"], MODULE_BASES["health"])
    armor_bonus = _get_module_percent(normalized["modules"]["armor"], MODULE_BASES["armor"])
    speed_bonus = _get_module_percent(normalized["modules"]["speed"], MODULE_BASES["speed"])
    has_elemental = normalized["equippedBerserk"] == "elemental" or "elemental" in normalized["berserks"]
    has_ability = bool(bot.get("abilityType"))
    health_multiplier = (1 + health_bonus / 100) * (0.9 if has_elemental else 1)
    shot_damage = bot["damage"] if has_ability else _round(bot["damage"] * (1 + damage_bonus / 100))
    ability_damage = 0
    if has_ability:
        ability_damage = _round((bot.get("abilityDamage") or 0) * (1 + damage_bonus / 100))
    return {
        "bot": bot,
        "damageBonus": damage_bonus,
        "healthBonus": health_bonus,
        "armorBonus": armor_bonus,
        "speedBonus": speed_bonus,
        "maxHealth": _round(BASE_HEALTH * health_multiplier),
        "shotDamage": shot_damage,
        "abilityDamage": ability_damage,
        "abilityCooldown": bot["abilityCooldown"],
        "maxAbilityUses": bot["maxAbilityUses"] or 0,
        "elementalDamage": _round(bot["damage"] * 0.1) if has_elemental else 0,
        "cooldown": bot["cooldown"] / (1 + speed_bonus / 100),
        "unique6": equipped_unique == "6",
        "unique7": equipped_unique == "7",
        "equippedBerserk": normalized["equippedBerserk"],
        "berserks": normalized["berserks"],
    }


def _create_actor(uid, username, loadout, x, y, facing):
    profile = build_player_profile(loadout)
    bot = profile["bot"]
    return {
        "uid": uid,
        "username": username or uid,
        "key": bot["attackType"] and loadout["playerBotKey"] or loadout["playerBotKey"],
        "botKey": loadout["playerBotKey"],
        "name": bot["name"],
        "color": bot["color"],
        "maxHealth": profile["maxHealth"],
        "health": profile["maxHealth"],
        "shotDamage": profile["shotDamage"],
        "abilityDamage": profile["abilityDamage"],
        "elementalDamage": profile["elementalDamage"],
        "armorBonus": profile["armorBonus"],
        "speedBonus": profile["speedBonus"],
        "cooldownDuration": profile["cooldown"],
        "cooldownRemaining": 1.0,
        "abilityCooldownDuration": profile["abilityCooldown"],
        "abilityCooldownRemaining": 1.0 if profile["abilityCooldown"] else 0,
        "maxAbilityUses": profile["maxAbilityUses"] or 0,
        "abilityUses": 0,
        "freezeFor": 0,
        "disableFor": 0,
        "burnFor": 0,
        "burnDamage": 0,
        "armorBreak": 0,
        "plasmaDebuffFor": 0,
        "acidHits": 0,
        "strikerModeFor": 0,
        "goldenModeFor": 0,
        "berserks": list(profile["berserks"]),
        "unique6": profile["unique6"],
        "unique7": profile["unique7"],
        "sawLoss": 0,
        "sawSwings": 0,
        "lastVirusCheck": 0,
        "plasmaApplied": False,
        "moveSpeed": BASE_MOVE_SPEED * (1 + profile["speedBonus"] / 100),
        "facing": facing,
        "x": x,
        "y": y,
        "attackType": bot["attackType"],
        "abilityType": bot["abilityType"],
        "attackName": bot["attackName"],
        "lastProcessedFireNonce": 0,
        "lastProcessedAbilityNonce": 0,
        "lastAimX": 0,
        "lastAimY": 0,
    }


def create_match_snapshot(player_a_uid, player_a_name, loadout_a, player_b_uid, player_b_name, loadout_b):
    now = now_ms()
    player_a_loadout = normalize_loadout(loadout_a)
    player_b_loadout = normalize_loadout(loadout_b)
    return {
        "status": "active",
        "winnerUid": None,
        "terminationReason": None,
        "lastTickAtMs": now,
        "logs": [
            f"{player_a_name or player_a_uid} challenged {player_b_name or player_b_uid}.",
            "Friend duel started.",
        ],
        "players": {
            player_a_uid: _create_actor(player_a_uid, player_a_name, player_a_loadout, 220, 420, 1),
            player_b_uid: _create_actor(player_b_uid, player_b_name, player_b_loadout, 1060, 420, -1),
        },
    }


def default_input_state():
    return {
        "up": False,
        "down": False,
        "left": False,
        "right": False,
        "aimX": None,
        "aimY": None,
        "fireNonce": 0,
        "abilityNonce": 0,
    }


def normalize_input_payload(payload):
    source = payload if isinstance(payload, dict) else {}
    normalized = default_input_state()
    for key in ("up", "down", "left", "right"):
        if key in source:
            normalized[key] = bool(source.get(key))
    if "aimX" in source:
        try:
            normalized["aimX"] = float(source.get("aimX"))
        except (TypeError, ValueError) as exc:
            raise ValueError("aimX must be a number.") from exc
    if "aimY" in source:
        try:
            normalized["aimY"] = float(source.get("aimY"))
        except (TypeError, ValueError) as exc:
            raise ValueError("aimY must be a number.") from exc
    for key in ("fireNonce", "abilityNonce"):
        if key in source:
            try:
                normalized[key] = int(source.get(key))
            except (TypeError, ValueError) as exc:
                raise ValueError(f"{key} must be an integer.") from exc
            if normalized[key] < 0:
                raise ValueError(f"{key} must be zero or greater.")
    return normalized


def append_log(snapshot, line):
    logs = list(snapshot.get("logs") or [])
    logs.append(str(line))
    snapshot["logs"] = logs[-20:]


def _is_disabled(actor):
    return actor["freezeFor"] > 0 or actor["disableFor"] > 0


def _move_actor(actor, dx, dy, delta, multiplier=1):
    length = math.hypot(dx, dy)
    if length == 0:
        return
    if actor["goldenModeFor"] > 0:
        multiplier *= 0.6
    nx = dx / length
    ny = dy / length
    actor["x"] = _clamp(actor["x"] + nx * actor["moveSpeed"] * multiplier * delta, ARENA_BOUNDS["minX"], ARENA_BOUNDS["maxX"])
    actor["y"] = _clamp(actor["y"] + ny * actor["moveSpeed"] * multiplier * delta, ARENA_BOUNDS["minY"], ARENA_BOUNDS["maxY"])


def _distance_units(from_x, from_y, to_x, to_y):
    return math.hypot(to_x - from_x, to_y - from_y) / 6.65


def _effective_cooldown(actor):
    multiplier = 1.1 if actor["plasmaDebuffFor"] > 0 else 1
    if actor["strikerModeFor"] > 0:
        multiplier /= 3
    if actor["goldenModeFor"] > 0:
        multiplier *= 1.3
    if actor["botKey"] == "sawblade" and actor["unique6"]:
        multiplier /= 2.5
    return actor["cooldownDuration"] * multiplier


def _apply_damage(snapshot, target, amount, source, attacker_name, players, projectile=True):
    if target["health"] <= 0:
        return 0
    incoming = max(0, amount)
    if target["goldenModeFor"] > 0 and projectile:
        if math.floor(time.time() * 1000) % 10 < 9:
            append_log(snapshot, f'{target["name"]} deflected {source} (Golden).')
            if math.floor(time.time() * 1000) % 10 < 4:
                for candidate in players.values():
                    if candidate["uid"] != target["uid"]:
                        reflected = _round(incoming / 2)
                        candidate["health"] = max(0, candidate["health"] - reflected)
                        append_log(snapshot, f'{target["name"]} reflected {reflected} damage back to {candidate["name"]}.')
                        break
            return 0
    armor_multiplier = max(0.1, 1 - target["armorBonus"] / 100)
    break_multiplier = 1 + target["armorBreak"] / 100
    striker_multiplier = 1.3 if target["strikerModeFor"] > 0 else 1
    final_damage = _round(incoming * armor_multiplier * break_multiplier * striker_multiplier)
    target["health"] = max(0, target["health"] - final_damage)
    append_log(snapshot, f"{attacker_name} used {source} for {final_damage} damage.")
    return final_damage


def _acid_attack(snapshot, attacker, defender, players):
    _apply_damage(snapshot, defender, attacker["shotDamage"], "acid burst", attacker["name"], players)
    defender["acidHits"] += 2 if attacker["unique6"] else 1
    if defender["acidHits"] >= 7 and defender["armorBreak"] < 20:
        defender["armorBreak"] = 20
        append_log(snapshot, f'{defender["name"]}\'s armour has corroded. Incoming damage increased by 20%.')


def _sawblade_attack(snapshot, attacker, defender, players):
    if _distance_units(attacker["x"], attacker["y"], defender["x"], defender["y"]) > 30:
        return
    loss_step = 0
    if attacker["unique7"]:
        if attacker["sawSwings"] > 0 and attacker["sawSwings"] % 3 == 0:
            loss_step = 5
    else:
        loss_step = 5
    attacker["sawSwings"] += 1
    attacker["sawLoss"] += loss_step
    base = attacker["shotDamage"] - attacker["sawLoss"] - (7 if attacker["unique7"] else 0)
    _apply_damage(snapshot, defender, max(8, base), "saw swing", attacker["name"], players, projectile=False)


def _projectile_attack(snapshot, attacker, defender, players):
    _apply_damage(snapshot, defender, attacker["shotDamage"], "cannon shot", attacker["name"], players)
    if attacker["elementalDamage"] > 0:
        _apply_damage(snapshot, defender, attacker["elementalDamage"], "elemental splash", attacker["name"], players, projectile=False)


def _sniper_attack(snapshot, attacker, defender, players):
    damage = attacker["shotDamage"] + (15 if attacker["unique6"] else 0)
    _apply_damage(snapshot, defender, damage, "sniper shot", attacker["name"], players)
    if attacker["unique7"]:
        _apply_damage(snapshot, defender, 10, "plasma damage", attacker["name"], players)
        defender["plasmaDebuffFor"] = max(defender["plasmaDebuffFor"], 4)
        if not defender["plasmaApplied"]:
            defender["maxHealth"] = _round(defender["maxHealth"] * 0.9)
            defender["health"] = min(defender["health"], defender["maxHealth"])
            defender["shotDamage"] = _round(defender["shotDamage"] * 0.9)
            defender["cooldownDuration"] *= 1.1
            defender["plasmaApplied"] = True
            append_log(snapshot, f'{defender["name"]} is destabilized. Damage, speed, and health efficiency reduced by 10%.')


def _hacker_ability(snapshot, attacker, defender, players):
    damage = attacker["abilityDamage"] + (20 if attacker["unique6"] else 0)
    disable_time = 7 if attacker["unique6"] else 5
    _apply_damage(snapshot, defender, damage, "hack spike", attacker["name"], players, projectile=False)
    defender["disableFor"] = max(defender["disableFor"], disable_time)
    append_log(snapshot, f'{defender["name"]} is hacked for {disable_time:.0f} seconds.')
    if attacker["unique7"]:
        chained_time = _round(disable_time / 1.5)
        chained_damage = _round(damage / 1.5)
        defender["disableFor"] = max(defender["disableFor"], chained_time)
        _apply_damage(snapshot, defender, chained_damage, "rehack", attacker["name"], players, projectile=False)
        append_log(snapshot, "Hyper Efficient Coding triggered a weaker re-hack.")


def _claymore_ability(snapshot, attacker, defender, players):
    damage = attacker["abilityDamage"] + (15 if attacker["unique6"] else 0)
    _apply_damage(snapshot, defender, damage, "Explosion", attacker["name"], players, projectile=False)
    defender["armorBreak"] = max(defender["armorBreak"], 20 if attacker["unique7"] else 40)
    append_log(snapshot, f'{defender["name"]}\'s armour is compromised.')
    if attacker["unique7"]:
        defender["burnFor"] = max(defender["burnFor"], 2)
        defender["burnDamage"] = 10
        append_log(snapshot, f'{defender["name"]} is burning for 2 seconds.')


def _process_fire(snapshot, attacker, defender, input_state, players):
    if attacker["health"] <= 0 or defender["health"] <= 0:
        return
    if _is_disabled(attacker) or attacker["cooldownRemaining"] > 0:
        return
    if attacker["botKey"] == "sawblade":
        _sawblade_attack(snapshot, attacker, defender, players)
        attacker["cooldownRemaining"] = _effective_cooldown(attacker)
        return
    aim_x = input_state.get("aimX")
    aim_y = input_state.get("aimY")
    if aim_x is None or aim_y is None:
        aim_x = defender["x"]
        aim_y = defender["y"]
    angle = math.atan2(aim_y - attacker["y"], aim_x - attacker["x"])
    angle_to_enemy = math.atan2(defender["y"] - attacker["y"], defender["x"] - attacker["x"])
    dist_to_enemy = math.hypot(defender["x"] - attacker["x"], defender["y"] - attacker["y"])
    threshold = math.atan2(40, max(dist_to_enemy, 1))
    diff = abs(angle - angle_to_enemy)
    normalized_diff = abs(((diff + math.pi) % (2 * math.pi)) - math.pi)
    if normalized_diff < threshold:
        if attacker["attackType"] == "acid":
            _acid_attack(snapshot, attacker, defender, players)
        elif attacker["attackType"] == "sniper":
            _sniper_attack(snapshot, attacker, defender, players)
        else:
            _projectile_attack(snapshot, attacker, defender, players)
    attacker["cooldownRemaining"] = _effective_cooldown(attacker)
    attacker["lastAimX"] = aim_x
    attacker["lastAimY"] = aim_y


def _process_ability(snapshot, attacker, defender, players):
    if attacker["health"] <= 0 or defender["health"] <= 0:
        return
    if _is_disabled(attacker) or attacker["abilityCooldownRemaining"] > 0:
        return
    if attacker["abilityType"]:
        if attacker["maxAbilityUses"] and attacker["abilityUses"] >= attacker["maxAbilityUses"]:
            append_log(snapshot, f'{attacker["name"]} tried to use ability, but maximum uses reached.')
        else:
            if attacker["abilityType"] == "hack":
                _hacker_ability(snapshot, attacker, defender, players)
            elif attacker["abilityType"] == "claymore":
                _claymore_ability(snapshot, attacker, defender, players)
            attacker["abilityUses"] += 1
            append_log(snapshot, f'{attacker["name"]} used ability.')
    if "freeze" in attacker["berserks"]:
        defender["freezeFor"] = max(defender["freezeFor"], 5)
        _apply_damage(snapshot, attacker, 40, "Freeze Module Self-Damage", attacker["name"], players, projectile=False)
        append_log(snapshot, "Freeze Module active.")
    if "striker" in attacker["berserks"]:
        attacker["strikerModeFor"] = max(attacker["strikerModeFor"], 5)
        append_log(snapshot, "Striker Module active.")
    if "golden" in attacker["berserks"]:
        attacker["goldenModeFor"] = max(attacker["goldenModeFor"], 7)
        append_log(snapshot, "Golden Module active.")
    fallback = 12 if any(item in ACTIONABLE_BERSERKS for item in attacker["berserks"]) and attacker["abilityCooldownDuration"] == 0 else 0
    attacker["abilityCooldownRemaining"] = max(attacker["abilityCooldownDuration"], fallback)


def _step_actor_timers(snapshot, actor, opponent, delta):
    actor["freezeFor"] = max(0, actor["freezeFor"] - delta)
    actor["disableFor"] = max(0, actor["disableFor"] - delta)
    actor["plasmaDebuffFor"] = max(0, actor["plasmaDebuffFor"] - delta)
    actor["strikerModeFor"] = max(0, actor["strikerModeFor"] - delta)
    actor["goldenModeFor"] = max(0, actor["goldenModeFor"] - delta)
    if actor["burnFor"] > 0:
        tick_damage = _round(actor["burnDamage"] * delta)
        if tick_damage > 0:
            _apply_damage(snapshot, actor, tick_damage, "burn damage", actor["name"], snapshot["players"], projectile=False)
        actor["burnFor"] = max(0, actor["burnFor"] - delta)
    if actor["unique7"] and actor["botKey"] == "acid":
        actor["lastVirusCheck"] += delta
        if actor["lastVirusCheck"] >= 2:
            actor["lastVirusCheck"] = 0
            if int((actor["health"] + opponent["health"] + actor["x"]) * 10) % 10 == 0:
                opponent["disableFor"] = max(opponent["disableFor"], 3)
                append_log(snapshot, "Virus Acid hits. Controls cut out for 3 seconds.")


def _check_winner(snapshot):
    living = [actor for actor in snapshot["players"].values() if actor["health"] > 0]
    if len(living) == 1:
        winner = living[0]
        snapshot["status"] = "completed"
        snapshot["winnerUid"] = winner["uid"]
        snapshot["terminationReason"] = "elimination"
        append_log(snapshot, f'{winner["username"]} won the duel.')
        return winner["uid"]
    if len(living) == 0:
        snapshot["status"] = "completed"
        snapshot["winnerUid"] = None
        snapshot["terminationReason"] = "draw"
        append_log(snapshot, "The duel ended in a draw.")
        return ""
    return None


def create_match_record(challenge_id, player_a_uid, player_a_name, loadout_a, player_b_uid, player_b_name, loadout_b):
    timestamp_ms = now_ms()
    snapshot = create_match_snapshot(player_a_uid, player_a_name, loadout_a, player_b_uid, player_b_name, loadout_b)
    return {
        "challengeId": challenge_id,
        "status": "active",
        "playerAUid": player_a_uid,
        "playerBUid": player_b_uid,
        "playerAUsername": player_a_name or player_a_uid,
        "playerBUsername": player_b_name or player_b_uid,
        "playerALoadout": normalize_loadout(loadout_a),
        "playerBLoadout": normalize_loadout(loadout_b),
        "snapshot": snapshot,
        "inputs": {
            player_a_uid: default_input_state(),
            player_b_uid: default_input_state(),
        },
        "presenceByUid": {
            player_a_uid: timestamp_ms,
            player_b_uid: timestamp_ms,
        },
        "lastActionAtMs": timestamp_ms,
        "createdAtMs": timestamp_ms,
        "acceptedAtMs": timestamp_ms,
        "completedAtMs": None,
        "winnerUid": None,
        "terminationReason": None,
    }


def advance_match_state(match_data, actor_uid=None, input_payload=None):
    now = now_ms()
    data = copy.deepcopy(match_data or {})
    snapshot = copy.deepcopy(data.get("snapshot") or {})
    players = snapshot.get("players") or {}
    if not players:
        return data

    if actor_uid:
        presence = copy.deepcopy(data.get("presenceByUid") or {})
        presence[actor_uid] = now
        data["presenceByUid"] = presence

    inputs = copy.deepcopy(data.get("inputs") or {})
    for uid in players:
        if uid not in inputs:
            inputs[uid] = default_input_state()
    if actor_uid and input_payload is not None:
        merged_input = default_input_state()
        merged_input.update(inputs.get(actor_uid) or {})
        merged_input.update(normalize_input_payload(input_payload))
        inputs[actor_uid] = merged_input
        data["lastActionAtMs"] = now
    data["inputs"] = inputs

    if data.get("status") != "active":
        return data

    for uid, last_seen in (data.get("presenceByUid") or {}).items():
        if now - int(last_seen or 0) > RECONNECT_GRACE_MS:
            living_uid = next((candidate for candidate in players if candidate != uid), None)
            data["status"] = "forfeited"
            data["winnerUid"] = living_uid
            data["terminationReason"] = "disconnect"
            data["completedAtMs"] = now
            snapshot["status"] = "completed"
            snapshot["winnerUid"] = living_uid
            snapshot["terminationReason"] = "disconnect"
            append_log(snapshot, f"{uid} disconnected and forfeited the duel.")
            data["snapshot"] = snapshot
            return data

    last_tick = int(snapshot.get("lastTickAtMs") or now)
    remaining = min(MAX_ADVANCE_SECONDS, max(0.0, (now - last_tick) / 1000))
    if remaining <= 0:
        data["snapshot"] = snapshot
        return data

    player_ids = list(players.keys())
    while remaining > 1e-9 and snapshot.get("status") == "active":
        delta = min(TICK_STEP_SECONDS, remaining)
        remaining -= delta
        first = players[player_ids[0]]
        second = players[player_ids[1]]
        for actor, opponent in ((first, second), (second, first)):
            _step_actor_timers(snapshot, actor, opponent, delta)
            actor["cooldownRemaining"] = max(0, actor["cooldownRemaining"] - delta)
            actor["abilityCooldownRemaining"] = max(0, actor["abilityCooldownRemaining"] - delta)
            if not _is_disabled(actor):
                state = inputs.get(actor["uid"]) or default_input_state()
                dx = (1 if state.get("right") else 0) - (1 if state.get("left") else 0)
                dy = (1 if state.get("down") else 0) - (1 if state.get("up") else 0)
                _move_actor(actor, dx, dy, delta)
                if dx:
                    actor["facing"] = 1 if dx > 0 else -1
            if actor["botKey"] == "sawblade" and actor["cooldownRemaining"] <= 0 and not _is_disabled(actor):
                _sawblade_attack(snapshot, actor, opponent, players)
                actor["cooldownRemaining"] = _effective_cooldown(actor)

        for actor, opponent in ((first, second), (second, first)):
            state = inputs.get(actor["uid"]) or default_input_state()
            fire_nonce = int(state.get("fireNonce") or 0)
            if fire_nonce > actor["lastProcessedFireNonce"]:
                _process_fire(snapshot, actor, opponent, state, players)
                actor["lastProcessedFireNonce"] = fire_nonce
            ability_nonce = int(state.get("abilityNonce") or 0)
            if ability_nonce > actor["lastProcessedAbilityNonce"]:
                _process_ability(snapshot, actor, opponent, players)
                actor["lastProcessedAbilityNonce"] = ability_nonce
        _check_winner(snapshot)

    snapshot["lastTickAtMs"] = now
    data["snapshot"] = snapshot
    if snapshot.get("status") == "completed":
        data["status"] = "completed"
        data["winnerUid"] = snapshot.get("winnerUid")
        data["terminationReason"] = snapshot.get("terminationReason")
        data["completedAtMs"] = now
    return data
