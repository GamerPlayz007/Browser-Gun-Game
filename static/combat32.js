/** Stage 3.2: input and UI state only; the server remains authoritative for hits. */
export function fireMode(weapon) {
  // Supports both the four shipping weapons and future data-defined fire modes.
  if (weapon?.fireMode === 'semi' || weapon?.fireMode === 'auto') return weapon.fireMode;
  return ['PUMP SHOTGUN', 'PRECISION RIFLE'].includes(weapon?.type) ? 'semi' : 'auto';
}

export function makeTrigger() { return { held: false, primed: false }; }
export function pressTrigger(trigger) {
  if (!trigger.held) { trigger.held = true; trigger.primed = true; }
}
export function releaseTrigger(trigger) { trigger.held = false; trigger.primed = false; }
export function takeTriggerPulse(trigger, weapon) {
  if (!trigger.held) return false;
  if (fireMode(weapon) === 'semi') {
    if (!trigger.primed) return false;
    trigger.primed = false;
    return true;
  }
  trigger.primed = false;
  return true;
}

export function predictedAmmo(authoritativeAmmo, pendingShots, weaponId) {
  const base = Number.isFinite(authoritativeAmmo) ? Math.max(0, Math.floor(authoritativeAmmo)) : 0;
  const outgoing = pendingShots.filter(s => s.weapon === weaponId).length;
  return Math.max(0, base - outgoing);
}
export function reloadFraction(remaining, total) {
  if (!(remaining > 0) || !(total > 0)) return 0;
  return Math.max(0, Math.min(1, 1 - remaining / total));
}
export function ammoState(ammo, magazine) {
  if (ammo <= 0) return 'empty';
  return ammo <= Math.max(2, Math.ceil(magazine * .2)) ? 'low' : 'ready';
}
/** Bearing on a clock face: 0° forward, +90° right, 180° behind. */
export function damageBearing(origin, position, yaw) {
  if (!Array.isArray(origin) || origin.length < 3 || !position || !Number.isFinite(yaw)) return null;
  const dx = origin[0] - position.x, dz = origin[2] - position.z;
  if (!Number.isFinite(dx) || !Number.isFinite(dz) || dx * dx + dz * dz < .0001) return null;
  return ((Math.atan2(dx, -dz) + yaw) * 180 / Math.PI + 540) % 360 - 180;
}
/** Only a server-supplied hit event is allowed to produce confirmation. */
export function confirmedHit(event, myId) {
  if (!event || event.type !== 'hit' || event.id !== myId) return null;
  const damage = Math.max(0, Math.round(Number(event.damage) || 0));
  if (!damage) return null;
  return { damage, head: event.head === true, killed: event.killed === true };
}