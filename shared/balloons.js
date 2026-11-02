// 空中風船割りのきまり。three.js に依存しない（画面と検証で同じものが動く）
// 2026-11-02 本人「ワイヤーで飛び回るのは気持ちいい。しっぽ取りは人には難しい。もっと爽快で気持ちいいものに」
// - 相手はいない。90秒で、街の上に浮かんだ風船をワイヤーで飛び回って割りまくる
// - 風船は通りの上空に「列」で並ぶ（振り子で通り抜けると続けて割れる）。地面からは届かない高さ
// - 割るたびに少し加速して上へ跳ねる（つなぐほど速く気持ちよくなる）
// - 続けて割るとコンボ。コンボが続くほど1個の点が上がる。金の風船は大きく点が高い
// - 割った風船は少しすると別の所に新しい列で出てくる（空になることがない）
import { RUN } from './runner.js?v=1'

export const BAL = {
  sec: 90,
  popR: 3.4,            // 胸と風船の中心がこれより近いと割れる（大きめ。かすっても割れる）
  assistR: 12,          // 空中でこれより近い風船へ少し吸い寄せる（初めての人でも当たる）
  assistAcc: 16,
  comboSec: 2.8,        // これ以内に次を割るとコンボが続く
  kick: 2.2,            // 割った瞬間に進む向きへ足す速さ
  upKick: 3.2,          // 割った瞬間に上へ足す速さ（地面へ落ちにくく、つなぎやすい）
  maxKickSpeed: 36,     // 加速はこの速さまで
  rows: 22,             // 同時に出ている列の数
  perRow: [5, 9],       // 1列の風船の数
  gap: 5.2,             // 列の風船の間隔（m）
  yMin: 9, yMax: 34,    // 列の一番低い所と高い所（地面からは届かない）
  goldEvery: 9,         // 何個に1個が金
  oddEvery: 13,         // 何個に1個が「誰かの風船」（白。割ると持ち主の一言が出る。遊び心）
  respawn: 3.5,         // 列を割りきったあと、新しい列が出るまでの秒数
  pts: 10, ptsCombo: 2, comboCap: 40, goldMul: 5,
  lockR: 70             // ワイヤーボタンが風船の方へ掛かる距離
}

// その点が建物などの箱の中（と、まわり m メートル）に入っていないか
function blocked(w, x, y, z, mg = 3) {
  for (const o of w.nearby(x, z)) {
    if (o.slab || o.anchorOnly || o.kind === 'bound' || o.y0 == null || y < o.y0 - mg || y > o.y1 + mg) continue
    const cs = Math.cos(o.yaw || 0), sn = Math.sin(o.yaw || 0), dx = x - o.cx, dz = z - o.cz
    if (Math.abs(dx * cs - dz * sn) < o.hw + mg && Math.abs(dx * sn + dz * cs) < o.hl + mg) return true
  }
  return false
}
function rng(seed) { let s = (seed >>> 0) || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647 }

// 通りの上に1列置く。通りに沿って弧（真ん中が低いU字＝振り子の通り道）か、ななめの坂
function makeRow(m, id) {
  const w = m.world, b = w.bounds, rnd = m.rnd
  for (let g = 0; g < 200; g++) {
    const x = b.x0 + 20 + rnd() * (b.x1 - b.x0 - 40), z = b.z0 + 20 + rnd() * (b.z1 - b.z0 - 40)
    if (w.surfaceAt(x, z) !== 'road') continue
    // 通りの向き: 前後が道の方
    const alongX = w.surfaceAt(x + 14, z) === 'road' && w.surfaceAt(x - 14, z) === 'road'
    const alongZ = w.surfaceAt(x, z + 14) === 'road' && w.surfaceAt(x, z - 14) === 'road'
    if (!alongX && !alongZ) continue
    const dx = alongX && (!alongZ || rnd() < 0.5) ? 1 : 0, dz = dx ? 0 : 1, sgn = rnd() < 0.5 ? -1 : 1
    const n = BAL.perRow[0] + Math.floor(rnd() * (BAL.perRow[1] - BAL.perRow[0] + 1))
    const shape = rnd() < 0.6 ? 'arc' : 'slope'
    const hiY = BAL.yMin + 8 + rnd() * (BAL.yMax - BAL.yMin - 8), loY = Math.max(BAL.yMin, hiY - 6 - rnd() * 8)
    const items = []
    let ok = true
    for (let k = 0; k < n; k++) {
      const f = n > 1 ? k / (n - 1) : 0.5
      const px = x + dx * sgn * (k - (n - 1) / 2) * BAL.gap, pz = z + dz * sgn * (k - (n - 1) / 2) * BAL.gap
      if (px < b.x0 + 4 || px > b.x1 - 4 || pz < b.z0 + 4 || pz > b.z1 - 4 || w.surfaceAt(px, pz) !== 'road') { ok = false; break }
      const y = shape === 'arc' ? loY + (hiY - loY) * Math.pow(2 * f - 1, 2) : loY + (hiY - loY) * f
      if (blocked(w, px, y, pz) || blocked(w, px, y - 6, pz, 1.5)) { ok = false; break }   // 建物に埋まらない・すぐ下も空いている
      items.push({ x: px, y, z: pz })
    }
    if (!ok || items.length < BAL.perRow[0]) continue
    // 他の列と重ならない
    if (m.rows.some(r => r.items.some(a => items.some(c => Math.hypot(a.x - c.x, a.z - c.z) < 6)))) continue
    const row = { id, items: [] }
    for (const it of items) {
      m.made++
      row.items.push({ id: m.made, x: it.x, y: it.y, z: it.z, gold: m.made % BAL.goldEvery === 0, odd: m.made % BAL.goldEvery !== 0 && m.made % BAL.oddEvery === 0, hue: Math.floor(rnd() * 6), ph: rnd() * 6.28, alive: true })
    }
    return row
  }
  return null
}

export function createGame(world, runner, seed = 1) {
  const m = { t: 0, over: false, world, seed, rnd: rng(seed), rows: [], made: 0, events: [], me: runner,
    popped: 0, golds: 0, score: 0, combo: 0, bestCombo: 0, comboT: 0, airT: 0, wait: [] }
  for (let i = 0; i < BAL.rows; i++) { const r = makeRow(m, i); if (r) m.rows.push(r) }
  return m
}

const chest = r => ({ x: r.x, y: r.y + 1.1, z: r.z })
export const alive = m => { const out = []; for (const r of m.rows) for (const b of r.items) if (b.alive) out.push(b); return out }

export function stepGame(m, dt) {
  if (m.over) return
  m.t += dt
  const r = m.me
  if (!r.grounded) m.airT += dt
  // コンボの残り時間
  if (m.combo > 0) { m.comboT -= dt; if (m.comboT <= 0) { m.events.push({ t: 'comboEnd', n: m.combo }); m.combo = 0 } }
  const c0 = chest(r)
  // 空中で近くの風船へ少し吸い寄せる
  const hAbove = r.y - (r.groundY || 0)
  if (!r.grounded && !r.climbing && (r.rope || hAbove > 3)) {   // 地面で跳んだだけでは吸い寄せない（跳んで割れてしまう）
    let tg = null, td = BAL.assistR
    for (const row of m.rows) for (const b of row.items) if (b.alive) { const d = Math.hypot(b.x - c0.x, b.y - c0.y, b.z - c0.z); if (d < td) { td = d; tg = b } }
    if (tg && td > 0.5) { const k = BAL.assistAcc * dt / td; r.vx += (tg.x - c0.x) * k; r.vy += (tg.y - c0.y) * k; r.vz += (tg.z - c0.z) * k }
  }
  // 割る
  for (const row of m.rows) for (const b of row.items) {
    if (!b.alive) continue
    const d = Math.hypot(b.x - c0.x, b.y - c0.y, b.z - c0.z)
    if (d > (b.gold ? BAL.popR + 0.8 : BAL.popR)) continue
    b.alive = false
    m.popped++; if (b.gold) m.golds++
    m.combo++; m.comboT = BAL.comboSec; m.bestCombo = Math.max(m.bestCombo, m.combo)
    const pts = (BAL.pts + BAL.ptsCombo * Math.min(m.combo - 1, BAL.comboCap)) * (b.gold ? BAL.goldMul : 1)
    m.score += pts
    // 加速して少し上へ（進んでいる向きへ）
    const hv = Math.hypot(r.vx, r.vz)
    if (hv > 1 && hv < BAL.maxKickSpeed) { r.vx += r.vx / hv * BAL.kick; r.vz += r.vz / hv * BAL.kick }
    if (!r.grounded && r.vy < BAL.upKick + 4) r.vy = Math.max(r.vy, 0) + BAL.upKick
    m.events.push({ t: 'pop', id: b.id, gold: b.gold, odd: b.odd, line: b.odd ? Math.floor(m.rnd() * 1e6) : 0, combo: m.combo, pts, hue: b.hue, x: b.x, y: b.y, z: b.z })
  }
  // 割りきった列は、少ししたら別の所に新しく出す
  for (let i = m.rows.length - 1; i >= 0; i--) {
    if (m.rows[i].items.some(b => b.alive)) continue
    m.wait.push(BAL.respawn); m.rows.splice(i, 1)
  }
  for (let i = m.wait.length - 1; i >= 0; i--) {
    m.wait[i] -= dt
    if (m.wait[i] > 0) continue
    const row = makeRow(m, m.made)
    if (row) { m.rows.push(row); m.wait.splice(i, 1); m.events.push({ t: 'row', x: row.items[0].x, z: row.items[0].z }) }
    else m.wait[i] = 0.5
  }
  if (m.t >= BAL.sec) { m.over = true; m.events.push({ t: 'end' }) }
}

// ワイヤーボタンの狙い: 届く距離の中で、近くて前にある風船（向き直りが少ないほど優先）
export function lockTarget(m, r, fwd) {
  let best = null, bs = 1e9
  const c0 = chest(r)
  for (const row of m.rows) for (const b of row.items) {
    if (!b.alive) continue
    const dx = b.x - c0.x, dz = b.z - c0.z, d = Math.hypot(dx, b.y - c0.y, dz)
    if (d > BAL.lockR || d < 6) continue
    const ahead = fwd ? (dx * fwd.x + dz * fwd.z) / (Math.hypot(dx, dz) || 1) : 0
    const s = d - ahead * 25 - (b.gold ? 10 : 0)
    if (s < bs) { bs = s; best = b }
  }
  return best
}

// 称号（点で）
export function rankOf(score) { return score >= 6000 ? 3 : score >= 3000 ? 2 : score >= 1200 ? 1 : 0 }

export { RUN }
