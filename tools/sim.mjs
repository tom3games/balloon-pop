// 自分の遊び方（bot）ごとに、三兄弟に追われながら何秒生き残り何個割れるか。node tools/sim.mjs [回数]
// 性格: good（上手い: 反応0.15秒・狙い正確）/ human（初めての人: 反応0.45秒・ぶれる・ワイヤーはボタンの自動狙い）/ ground（地面を走るだけ）/ idle
import { createWorld } from '../shared/track.js?v=5'
import { setupArena } from '../shared/arena.js?v=5'
import { createRunner, stepRunner, findAnchor } from '../shared/runner.js?v=5'
import { BAL, createGame, stepGame, alive, lockTarget } from '../shared/balloons.js?v=5'
import { createChaser, chaserInput } from '../shared/chaser.js?v=5'
const N = +(process.argv[2] || 8), only = process.argv[3]
const world = setupArena(createWorld('city')), dt = 1 / 60
const ang = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a }
function playerInput(k, st, m, r) {
  if (k === 'idle') return {}
  let g = lockTarget(m, r, { x: Math.sin(r.yaw), z: Math.cos(r.yaw) })
  if (!g) { let bd = 1e9; for (const b of alive(m)) { const d = Math.hypot(b.x - r.x, b.z - r.z); if (d < bd) { bd = d; g = b } } }
  if (!g) return { throttle: 1 }
  const lag = k === 'good' ? 9 : 27
  st.q.push([g.x, g.y, g.z]); const [gx, gy, gz] = st.q.length > lag ? st.q.shift() : st.q[0]
  st.nT -= dt; if (st.nT <= 0) { st.n = (st.rnd() - 0.5) * (k === 'good' ? 0.3 : 1.1); st.nT = 0.5 + st.rnd() }
  const yaw = Math.atan2(gx - r.x, gz - r.z) + st.n
  const inp = { throttle: 1, moveDir: { x: Math.sin(yaw), z: Math.cos(yaw) } }
  if (k === 'ground') return inp
  const dh = Math.hypot(gx - r.x, gz - r.z)
  if (r.climbing) { inp.climbY = gy > r.y + 1 ? 1 : 0; st.cl = (st.cl || 0) + dt; if (st.cl > 0.8) { inp.wire = true; st.cl = 0 } return inp }
  st.wT += dt
  if (!r.rope) { if (st.wT > (k === 'good' ? 0.35 : 0.9) && (r.grounded || r.vy < -1) && st.rnd() < (k === 'good' ? 1 : 0.06)) { inp.wire = true; inp.wireYaw = yaw; st.wT = 0; st.rT = 0 } }
  else { st.rT += dt; const past = (gx - r.x) * r.vx + (gz - r.z) * r.vz < 0; if ((past && r.vy > 0 && st.rT > 0.4) || st.rT > (k === 'good' ? 1.8 : 2.4)) { inp.wire = true; st.rT = 0 } }
  return inp
}
export function play(k, seed) {
  const b = world.bounds, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2
  const me = createRunner({ id: 'me', spawn: { x: cx, y: 0, z: cz - 40, yaw: 0 } })
  const cs = [[cx - 70, cz - 110], [cx + 90, cz - 100], [cx, cz + 110]].map(([x, z], i) => createRunner({ id: 'c' + i, spawn: { x, y: 0, z, yaw: 0 } }))
  const m = createGame(world, me, seed, cs)
  const bots = BAL.skill.map((s, i) => createChaser(s, seed * 7 + i))
  let s0 = seed >>> 0 || 3; const st = { q: [], n: 0, nT: 0, wT: 0, rT: 0, rnd: () => (s0 = (s0 * 16807) % 2147483647) / 2147483647 }
  let pw = false
  while (!m.over && m.t < 400) {
    let inp = playerInput(k, st, m, me); const w = !!inp.wire; inp.wire = w && !pw; pw = w
    me.events.length = 0; stepRunner(me, inp, dt, world)
    m.chasers.forEach((c, i) => { c.r.events.length = 0; stepRunner(c.r, chaserInput(bots[i], c, me, world, dt), dt, world) })
    stepGame(m, dt); m.events.length = 0
  }
  return { t: m.t, popped: m.popped, score: m.score, combo: m.bestCombo, caught: m.caught }
}
if (import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  for (const k of ['good', 'human', 'ground', 'idle']) {
    if (only && only !== k) continue
    const rs = []; for (let i = 1; i <= N; i++) rs.push(play(k, i))
    const med = a => { const s = [...a].sort((p, q) => p - q); return s[Math.floor(s.length / 2)] }
    console.log(`${k.padEnd(7)} 生き残り 中央${med(rs.map(r => r.t)).toFixed(0)}秒 最短${Math.min(...rs.map(r => r.t)).toFixed(0)} 最長${Math.max(...rs.map(r => r.t)).toFixed(0)}  割った 中央${med(rs.map(r => r.popped))}  点 中央${med(rs.map(r => r.score))}  最高コンボ 中央${med(rs.map(r => r.combo))}`)
  }
}
