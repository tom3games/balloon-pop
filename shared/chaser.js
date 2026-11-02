// 風船屋の三兄弟（追う役）の動き。空中しっぽ取りの CPU と同じ考え方: 行きたい向きの前の建物・電柱にワイヤーを掛けてつなぐ
// 目標は自分（先回りは skill ぶん）。three.js に依存しない
import { findAnchor } from './runner.js?v=7'
const ang = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a }

export function createChaser(skill = 0.5, seed = 1) {
  let s = seed >>> 0 || 7
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
  return { skill, rnd, wT: 0, prevW: false, prevJ: false, stuck: 0, lx: 0, lz: 0 }
}

export function chaserInput(b, c, me, world, dt) {
  const r = c.r, inp = { throttle: 0, steer: 0 }
  if (!c.awake || c.stun > 0) return inp
  const d = Math.hypot(me.x - r.x, me.z - r.z)
  const lead = Math.min(1.0, d / 25) * b.skill
  const gx = me.x + me.vx * lead, gz = me.z + me.vz * lead, gy = me.y + me.vy * lead * 0.4
  const dh = Math.hypot(gx - r.x, gz - r.z)
  const want = Math.atan2(gx - r.x, gz - r.z)
  const diff = ang(want - r.yaw)
  inp.steer = Math.max(-1, Math.min(1, -diff * 2.5))
  inp.throttle = Math.abs(diff) > 1.8 && r.grounded ? 0.35 : 1
  if (r.climbing) {
    const cl = r.climbing, tx = -cl.nz, tz = cl.nx
    inp.climbY = gy > r.y + 1 ? 1 : gy < r.y - 2 ? -1 : 0
    inp.climbX = Math.max(-1, Math.min(1, ((gx - r.x) * tx + (gz - r.z) * tz) / 6))
    const away = (gx - r.x) * cl.nx + (gz - r.z) * cl.nz > 4
    if (away || (inp.climbY === 0 && dh > 10)) { inp.jump = !b.prevJ; b.prevJ = inp.jump; return inp }
  }
  b.wT += dt
  const gap = 0.3 + (1 - b.skill) * 0.8
  let wire = false
  if (!r.rope && !r.climbing && b.wT > gap && (r.grounded || r.vy < -1) && (dh > 8 || gy > r.y + 4)) {
    const v = Math.max(8, Math.hypot(r.vx, r.vz))
    const a = findAnchor(world, { ...r, yaw: want, vx: Math.sin(want) * v, vz: Math.cos(want) * v })
    if (a) { wire = true; b.aim = a }
    b.wT = 0
  }
  if (r.rope) {
    const past = (gx - r.x) * r.vx + (gz - r.z) * r.vz < 0 && dh < 30
    if ((past && r.vy > 0) || (dh < 6 && r.y > gy + 1)) wire = true
  }
  inp.wire = wire && !b.prevW; b.prevW = wire
  if (inp.wire && !r.rope && b.aim) inp.wireAt = b.aim
  b.aim = null
  b.stuck = Math.hypot(r.x - b.lx, r.z - b.lz) < 0.04 && !r.climbing ? b.stuck + dt : 0
  b.lx = r.x; b.lz = r.z
  if (b.stuck > 1.0) { inp.jump = !b.prevJ; b.prevJ = inp.jump; b.stuck = 0 } else b.prevJ = false
  return inp
}
