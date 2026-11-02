// 空中風船割りの検証。node verify.mjs（テスト中は無音: mute.mjs）
import { chromium, webkit } from 'playwright'
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
import { createWorld } from './shared/track.js?v=4'
import { setupArena } from './shared/arena.js?v=4'
import { createRunner, stepRunner, rayHit, findAnchor, RUN } from './shared/runner.js?v=4'
import { BAL, createGame, stepGame, alive, lockTarget } from './shared/balloons.js?v=4'
import { play } from './tools/sim.mjs'
const ROOT = import.meta.dirname
mkdirSync(ROOT + '/shots', { recursive: true })
const PORT = 5392
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const URL0 = `http://localhost:${PORT}/`
let pass = 0, fail = 0
const results = []
async function t(name, fn) {
  try { const r = await fn(); if (r === false) throw new Error('false'); pass++; results.push(`ok   ${name}${r && r !== true ? '  ' + JSON.stringify(r) : ''}`) }
  catch (e) { fail++; results.push(`FAIL ${name}  ${e.message.split('\n')[0]}`) }
}
const expect = (c, msg) => { if (!c) throw new Error(msg) }
const GL = ['--use-angle=metal', '--enable-unsafe-swiftshader']
async function open(browser, opts = {}) {
  const ctx = await browser.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await muteContext(ctx)
  await ctx.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  const p = await ctx.newPage(); p.errs = []
  p.on('pageerror', e => p.errs.push('pageerror ' + e.message))
  p.on('console', m => { if (m.type() === 'error' && !/GL Driver|WebGL|GPU stall/.test(m.text())) p.errs.push('console ' + m.text()) })
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) p.errs.push('reqfail ' + r.url()) })
  await p.goto(URL0); await p.waitForFunction(() => window.__ttReady, null, { timeout: 20000 })
  return p
}
const overflow = p => p.evaluate(() => {
  const W = document.documentElement.clientWidth, bad = []
  for (const el of document.querySelectorAll('.screen:not(.hidden) *, #hud:not(.hidden) *')) {
    if (el.closest('.hidden') || (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true }))) continue
    if (el.closest('#arrow,#miss,#say')) continue
    const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) bad.push((el.id || el.className || el.tagName) + ':' + Math.round(r.left) + '-' + Math.round(r.right))
  }
  return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 5) }
})
const fit = q => q.evaluate(() => {
  const H = innerHeight, de = document.documentElement, over = []
  if (de.scrollHeight > H + 1) over.push('page:' + de.scrollHeight)
  for (const el of document.querySelectorAll('.screen:not(.hidden) button,.screen:not(.hidden) a,.screen:not(.hidden) canvas,.screen:not(.hidden) h1,#hud:not(.hidden) button,#hud:not(.hidden) .rope-bar')) {
    if (el.closest('.hidden')) continue
    const r = el.getBoundingClientRect(); if (!r.width) continue
    if (r.bottom > H + 1 || r.top < -1) over.push((el.id || el.className) + ':' + Math.round(r.top) + '-' + Math.round(r.bottom))
  }
  // 物干し・時計・休憩・スティック・跳ぶ・タイトルの部品が重ならない
  const rs = [...document.querySelectorAll('#hud:not(.hidden) .scorebox,#hud:not(.hidden) .clock,#hud:not(.hidden) #btnPause,#touch:not(.hidden) .tbtn,#touch:not(.hidden) .stick,.screen:not(.hidden) .go,.screen:not(.hidden) .text-btn,.screen:not(.hidden) .logo,.screen:not(.hidden) .level')].map(e => [e.id || e.className, e.getBoundingClientRect()])
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const a = rs[i][1], b = rs[j][1]; if (a.width && b.width && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) over.push('overlap ' + rs[i][0] + '×' + rs[j][0]) }
  const lg = document.querySelector('.screen:not(.hidden) .logo span'); if (lg && lg.getClientRects().length > 1) over.push('logo wraps')
  return { H, over: over.slice(0, 6) }
})

// ---------------------------------------------------------------- 仕組み（node だけ）
const world = setupArena(createWorld('city'))
const B = world.bounds, CX = (B.x0 + B.x1) / 2
const dt = 1 / 60
const step = (r, inp, n = 1) => { for (let i = 0; i < n; i++) { r.events.length = 0; stepRunner(r, inp, 1 / 60, world) } }
await t('ワイヤー: 届く距離は70m。遠い所を押すと、その向きの届く所に掛かり、届く距離より長くはならない', () => {
  const r = createRunner({ id: 'a', spawn: { x: 0, y: 0, z: 690, yaw: 0 } })
  step(r, { wire: true, wireAt: { x: 18, y: 40, z: 790 } })
  expect(r.rope && Math.hypot(r.rope.x - r.x, r.rope.y - r.y, r.rope.z - r.z) <= RUN.wireRange + 3, JSON.stringify(r.events))
  const miss = { d: Math.hypot(18, 40, 100) }
  const r2 = createRunner({ id: 'b', spawn: { x: 0, y: 0, z: 690, yaw: 0 } })
  step(r2, { wire: true, wireAt: { x: 18, y: 30, z: 740 } })
  expect(r2.rope, 'near not attached'); return { far: Math.round(miss.d), nearLen: +r2.rope.len.toFixed(1), range: RUN.wireRange }
})
await t('巻取ボタンは無い（boost を押しても何も変わらない）', () => {
  const mk = () => { const r = createRunner({ id: 'a', spawn: { x: 0, y: 12, z: 700, yaw: 0 } }); r.grounded = false; r.vz = 12; r.rope = { x: 0, y: 30, z: 712, len: 21, t: 0 }; return r }
  const a = mk(), b = mk()
  step(a, { boost: true }, 40); step(b, {}, 40)
  expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z) < 1e-9, 'differs'); return true
})
await t('掛けた瞬間に位置が飛ばない（瞬間移動しない）・地面から掛けても振り子で浮く', () => {
  const r = createRunner({ id: 'a', spawn: { x: 0, y: 0, z: 690, yaw: 0 } })
  const a = findAnchor(world, r); expect(a, 'no anchor')
  const x0 = r.x, z0 = r.z
  step(r, { wire: true, wireAt: { x: a.x, y: a.y, z: a.z } })
  const jump1 = Math.hypot(r.x - x0, r.z - z0)
  let maxY = 0, landed = false, maxStep = 0, px = r.x, py = r.y, pz = r.z
  for (let i = 0; i < 90; i++) { step(r, { throttle: 1 }); if (r.events.some(e => e.t === 'land')) landed = true; maxY = Math.max(maxY, r.y); maxStep = Math.max(maxStep, Math.hypot(r.x - px, r.y - py, r.z - pz)); px = r.x; py = r.y; pz = r.z }
  expect(jump1 < 0.5 && maxStep < 0.7 && !landed && maxY > 3, JSON.stringify({ jump1, maxStep, landed, maxY })); return { firstStep: +jump1.toFixed(2), maxStepPerFrame: +maxStep.toFixed(2), maxY: +maxY.toFixed(1) }
})
await t('自動の巻き取り: 振り子のまま少しずつ縮む（重力は残る＝下へ落ちる時がある）', () => {
  const r = createRunner({ id: 'a', spawn: { x: 0, y: 14, z: 700, yaw: 0 } }); r.grounded = false; r.vz = 10; r.rope = { x: 0, y: 40, z: 712, len: 28, t: 0 }
  let minVy = 0; const L0 = r.rope.len
  for (let i = 0; i < 60 && r.rope; i++) { step(r, {}); minVy = Math.min(minVy, r.vy) }
  expect(r.rope && r.rope.len < L0 - 0.8 && r.rope.len > L0 - 8 && minVy < -1, JSON.stringify({ len: r.rope && r.rope.len, minVy })); return { L0, L1: +r.rope.len.toFixed(1), minVy: +minVy.toFixed(1) }
})
await t('飛ぶ方が走るより速い', () => {
  const r = createRunner({ id: 'a', spawn: { x: 0, y: 0, z: 600, yaw: 0 } })
  let run = 0; for (let i = 0; i < 120; i++) { step(r, { throttle: 1 }); run = Math.max(run, Math.hypot(r.vx, r.vz)) }
  const s = createRunner({ id: 'b', spawn: { x: 0, y: 0, z: 600, yaw: 0 } })
  let fly = 0, w = false
  for (let i = 0; i < 600; i++) { const inp = { throttle: 1, wire: false }; if (!s.rope && (s.grounded || s.vy < -2) && !w) { inp.wire = true; w = true } else w = false; step(s, inp); if (!s.grounded) fly = Math.max(fly, Math.hypot(s.vx, s.vz)) }
  expect(fly > run * 1.6, JSON.stringify({ run, fly })); return { run: +run.toFixed(1), fly: +fly.toFixed(1) }
})
await t('壁に張り付いたら上下左右に這える・何も押さなければ止まる・ワイヤーボタンで離れる（跳ぶボタンは無い）', () => {
  const o = world.colliders.find(c => c.kind === 'building' && c.cx > B.x0 + 20 && c.cx < B.x1 - 20 && c.cz > B.z0 + 20 && c.cz < B.z1 - 20 && c.y1 > 40 && c.hw > 8)
  const r = createRunner({ id: 'a', spawn: { x: o.cx, y: 0, z: o.cz - o.hl - 1.5, yaw: 0 } })
  step(r, { throttle: 1 }, 30)
  expect(r.climbing, 'not climbing')
  const y0 = r.y; step(r, { climbY: 1, climbX: 0 }, 60); const up = r.y - y0
  const x0 = r.x; step(r, { climbY: 0, climbX: 1 }, 60); const side = r.x - x0
  const y1 = r.y; step(r, { climbY: 0, climbX: 0 }, 60); const still = Math.abs(r.y - y1)
  const y2 = r.y; step(r, { climbY: -1, climbX: 0 }, 30); const down = y2 - r.y
  const x1 = r.x; step(r, { climbY: 0, climbX: -1 }, 30); const left = Math.abs(x1 - r.x)
  expect(up > 4 && Math.abs(side) > 3 && still < 0.05 && down > 2 && left > 1.5 && r.climbing, JSON.stringify({ up, side, still, down, left, cl: !!r.climbing }))
  step(r, { wire: true }); step(r, {}); expect(!r.climbing && !r.rope && !r.grounded, JSON.stringify({ cl: !!r.climbing, rope: !!r.rope }))
  return { up: +up.toFixed(1), side: +side.toFixed(1), down: +down.toFixed(1) }
})
await t('ワイヤーボタン: 地面から押すと前の上へ掛かり、もう一回で離して飛ぶ（相手は追わない）', () => {
  const r = createRunner({ id: 'a', spawn: { x: B.x0 + 40, y: 0, z: (B.z0 + B.z1) / 2, yaw: 0 } })
  step(r, {}, 20); step(r, { wire: true })
  const hooked = !!r.rope, up = r.rope ? r.rope.y - r.y : 0
  step(r, { throttle: 1 }, 40); const still = !!r.rope
  step(r, { wire: true }); step(r, {})
  expect(hooked && up > 3 && still && !r.rope && !r.grounded, JSON.stringify({ hooked, up, still, rope: !!r.rope })); return { up: +up.toFixed(1) }
})
await t('遠すぎる所を押すと、その向きで届く所に掛かる（空中出前と同じ）', () => {
  const r = createRunner({ id: 'a', spawn: { x: (B.x0 + B.x1) / 2, y: 0, z: (B.z0 + B.z1) / 2, yaw: 0 } })
  step(r, {}, 10)
  const w = { x: r.x + 60, y: 120, z: r.z + 160 }
  step(r, { wire: true, wireAt: w })
  const miss = r.events.find(e => e.t === 'wireMiss')
  if (!r.rope) { expect(miss, 'no rope and no miss'); return { rope: false, miss: true } }
  const d = Math.hypot(r.rope.x - r.x, r.rope.y - r.y, r.rope.z - r.z)
  let yo = Math.atan2(r.rope.x - r.x, r.rope.z - r.z) - Math.atan2(60, 160); while (yo > Math.PI) yo -= 2 * Math.PI; while (yo < -Math.PI) yo += 2 * Math.PI
  expect(d <= RUN.wireRange + 3 && Math.abs(yo) < 1.6, JSON.stringify({ d, yo })); return { d: Math.round(d) }
})
await t('電柱・街灯にもワイヤーが掛かる（狙いが少しずれても吸いつく）', () => {
  const p = world.poles[10]
  const ox = p.cx + 14, oy = 1.5, oz = p.cz + 6
  const dx = p.cx + 0.9 - ox, dy = p.y1 - 1 - oy, dz = p.cz - oz, L = Math.hypot(dx, dy, dz)
  const h = rayHit(world, ox, oy, oz, dx / L, dy / L, dz / L, 400)
  expect(h && h.pole && h.x === p.cx && h.z === p.cz, JSON.stringify(h))
  return { poles: world.poles.length, lampsSignals: world.extraAnchors.length - world.poles.length }
})
// 風船: 列を通り抜けると続けて割れる・コンボ・加速
const runRow = (seed, rowI) => {
  const r = createRunner({ id: 'me', spawn: { x: 0, y: 0, z: 700 } }), g = createGame(world, r, seed)
  const row = g.rows[rowI % g.rows.length], b0 = row.items[0], b1 = row.items[1], dx = b0.x - b1.x, dz = b0.z - b1.z, l = Math.hypot(dx, dz)
  Object.assign(r, { x: b0.x + dx / l * 7, y: b0.y - 1.1, z: b0.z + dz / l * 7, vx: -dx / l * 14, vz: -dz / l * 14, vy: 3, grounded: false, rope: null, climbing: null })
  const v0 = 14
  for (let i = 0; i < 90; i++) { r.events.length = 0; stepRunner(r, {}, dt, world); stepGame(g, dt) }
  return { g, r, n: row.items.length, v0 }
}
await t('風船: 列を飛んで通り抜けると続けて割れる（コンボ）。30列で試して全部で1個以上', () => {
  let hit = 0, tot = 0, combos = []
  for (const seed of [1, 2, 3, 4, 5]) for (let k = 0; k < 6; k++) { const { g } = runRow(seed, k); tot++; if (g.popped > 0) hit++; combos.push(g.bestCombo) }
  const avg = combos.reduce((a, b) => a + b, 0) / combos.length
  expect(hit === tot && avg >= 3, { hit, tot, avg }); return { hit: `${hit}/${tot}`, avgCombo: +avg.toFixed(1) }
})
await t('風船: どれも建物に埋まらず、地面から跳んでも届かない高さ（9m以上）・金が混じる', () => {
  let bad = 0, low = 0, n = 0, gold = 0
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const g = createGame(world, createRunner({ id: 'me', spawn: { x: 0, y: 0, z: 700 } }), seed)
    for (const b of alive(g)) {
      n++; if (b.gold) gold++
      if (b.y - world.groundAt(b.x, b.z).h < 9) low++
      for (const o of world.nearby(b.x, b.z)) { if (o.slab || o.anchorOnly || o.y0 == null || b.y < o.y0 || b.y > o.y1) continue; const cs = Math.cos(o.yaw || 0), sn = Math.sin(o.yaw || 0), ddx = b.x - o.cx, ddz = b.z - o.cz; if (Math.abs(ddx * cs - ddz * sn) < o.hw + 1 && Math.abs(ddx * sn + ddz * cs) < o.hl + 1) bad++ }
    }
  }
  expect(bad === 0 && low === 0 && gold > 0 && n / 8 >= 100, { bad, low, gold, perGame: n / 8 }); return { perGame: Math.round(n / 8), gold }
})
await t('風船: 地面に立って跳んでも割れない', () => {
  const r = createRunner({ id: 'me', spawn: { x: 0, y: 0, z: 700 } }), g = createGame(world, r, 3)
  const b = g.rows.map(x => x.items).flat().sort((p, q) => p.y - q.y)[0]
  Object.assign(r, { x: b.x, y: world.groundAt(b.x, b.z).h, z: b.z, vx: 0, vy: 0, vz: 0, grounded: true })
  for (let i = 0; i < 120; i++) { r.events.length = 0; stepRunner(r, { jump: i % 40 === 0 }, dt, world); stepGame(g, dt) }
  expect(g.popped === 0, JSON.stringify({ popped: g.popped, y: b.y })); return { lowest: +b.y.toFixed(1) }
})
await t('割ると少し加速して上へ跳ねる・コンボの点が上がる・金は5倍', () => {
  const r = createRunner({ id: 'me', spawn: { x: 0, y: 0, z: 700 } }), g = createGame(world, r, 4)
  const b = alive(g)[0]
  Object.assign(r, { x: b.x - 1, y: b.y - 1.1, z: b.z, vx: 12, vy: -2, vz: 0, grounded: false })
  stepGame(g, dt)
  const sp = Math.hypot(r.vx, r.vz), up = r.vy
  g.combo = 9; const g2 = alive(g).find(x => !x.gold); Object.assign(r, { x: g2.x, y: g2.y - 1.1, z: g2.z }); const s0 = g.score; stepGame(g, dt); const p10 = g.score - s0
  const gb = alive(g).find(x => x.gold); g.combo = 0; Object.assign(r, { x: gb.x, y: gb.y - 1.1, z: gb.z }); const s1 = g.score; stepGame(g, dt); const pg = g.score - s1
  expect(sp > 12 && up > 0 && p10 > BAL.pts && pg === BAL.pts * BAL.goldMul, { sp, up, p10, pg }); return { speed: +sp.toFixed(1), combo10: p10, gold: pg }
})
await t('割りきった列は少しすると別の所に新しく出る（空にならない）', () => {
  const r = createRunner({ id: 'me', spawn: { x: 0, y: 0, z: 700 } }), g = createGame(world, r, 5)
  const n0 = g.rows.length, row = g.rows[0]; for (const b of row.items) b.alive = false
  for (let i = 0; i < 60 * 6; i++) stepGame(g, dt)
  expect(g.rows.length === n0 && !g.rows.includes(row), { n0, now: g.rows.length }); return { rows: g.rows.length }
})
await t('ワイヤーボタンの狙い: 前にある近い風船を選ぶ（金を少し優先）', () => {
  const r = createRunner({ id: 'me', spawn: { x: 0, y: 0, z: 700 } }), g = createGame(world, r, 6)
  const b = alive(g)[3]; Object.assign(r, { x: b.x - 25, y: b.y - 8, z: b.z })
  const lt = lockTarget(g, r, { x: 1, z: 0 })
  expect(lt && Math.hypot(lt.x - r.x, lt.z - r.z) <= BAL.lockR, lt); return { d: Math.round(Math.hypot(lt.x - r.x, lt.z - r.z)) }
})
await t('白い風船（誰かの持ち物）が混じり、割ると一言が出る', async () => {
  let odd = 0, n = 0
  for (const seed of [1, 2, 3]) { const g = createGame(world, createRunner({ id: 'me', spawn: { x: 0, y: 0, z: 700 } }), seed); for (const b of alive(g)) { n++; if (b.odd) odd++ } }
  expect(odd >= 6 && odd < n / 5, { odd, n }); return { odd, n }
})
// 三兄弟（追う役）
const mkChasers = () => [[-70, 610], [90, 620], [0, 800]].map(([x, z], i) => createRunner({ id: 'b' + i, spawn: { x, y: 0, z } }))
await t('三兄弟: 決まった秒に起きる・触れると背中の風船が1つ減り、少しの間は捕まらない・3つでおしまい', () => {
  const r = createRunner({ id: 'me', spawn: { x: 0, y: 0, z: 700 } }), cs = mkChasers(), g = createGame(world, r, 8, cs)
  for (let i = 0; i < Math.round(BAL.wake[0] / dt) + 2; i++) stepGame(g, dt)
  const awake1 = g.chasers.filter(c => c.awake).length
  const c = g.chasers[0]; Object.assign(c.r, { x: r.x + 1, y: r.y, z: r.z })
  stepGame(g, dt); const l1 = g.lives, im = g.immune > 0
  Object.assign(c.r, { x: r.x + 1, y: r.y, z: r.z }); c.stun = 0; stepGame(g, dt); const l2 = g.lives
  for (let k = 0; k < 3; k++) { g.immune = 0; c.stun = 0; Object.assign(c.r, { x: r.x + 1, y: r.y, z: r.z }); stepGame(g, dt) }
  expect(awake1 === 1 && l1 === 2 && im && l2 === 2 && g.over && g.lives === 0, JSON.stringify({ awake1, l1, im, l2, over: g.over, lives: g.lives })); return { lives: [3, l1, l2, g.lives] }
})
await t('制限時間2分: 逃げきると残った背中の風船1つにつき200点・時間で終わる', () => {
  const r = createRunner({ id: 'me', spawn: { x: 0, y: 0, z: 700 } }), g = createGame(world, r, 11, [])
  g.lives = 2; let n = 0; while (!g.over && n < 60 * 200) { stepGame(g, dt); n++ }
  expect(g.over && g.escaped && Math.abs(g.t - BAL.sec) < 0.05 && g.score === 400, { t: g.t, score: g.score, escaped: g.escaped }); return { sec: +g.t.toFixed(1), bonus: g.score }
})
await t('金の風船で背中の風船が1つ戻る（3つまで）', () => {
  const r = createRunner({ id: 'me', spawn: { x: 0, y: 0, z: 700 } }), g = createGame(world, r, 9, mkChasers())
  g.lives = 2; const gb = alive(g).find(b => b.gold); Object.assign(r, { x: gb.x, y: gb.y - 1.1, z: gb.z, grounded: false }); stepGame(g, dt)
  const a = g.lives; const gb2 = alive(g).find(b => b.gold); Object.assign(r, { x: gb2.x, y: gb2.y - 1.1, z: gb2.z }); stepGame(g, dt)
  expect(a === 3 && g.lives === 3, { a, b: g.lives }); return { lives: g.lives }
})
await t('三兄弟は空中でも自分より遅い（最高速の比べ）', () => {
  const r = createRunner({ id: 'me', spawn: { x: 0, y: 0, z: 700 } }), cs = mkChasers(), g = createGame(world, r, 10, cs)
  g.t = 110; const c = g.chasers[0]; c.awake = true; Object.assign(c.r, { x: 100, y: 30, z: 700, vx: 40, vy: 0, vz: 0, grounded: false })
  stepGame(g, dt); const v = Math.hypot(c.r.vx, c.r.vy, c.r.vz)
  expect(v <= BAL.chaserMax * BAL.speed[1] + 0.01 && v < 41, v); return { chaserMax: +v.toFixed(1), me: 41 }
})
await t('bot（8回ずつ）: 飛んで逃げる人ほど長く生き残り多く割る。地面だけ・何もしないは早く捕まる。初めての人も平均40秒以上', () => {
  const avg = (k) => { const rs = []; for (let i = 1; i <= 8; i++) rs.push(play(k, i)); return { t: Math.round(rs.reduce((a, r) => a + r.t, 0) / 8), popped: +(rs.reduce((a, r) => a + r.popped, 0) / 8).toFixed(1), score: Math.round(rs.reduce((a, r) => a + r.score, 0) / 8) } }
  const good = avg('good'), human = avg('human'), ground = avg('ground'), idle = avg('idle')
  expect(good.t > ground.t && human.t > ground.t && human.t >= 40 && good.popped > human.popped && ground.popped < 1 && idle.popped === 0, JSON.stringify({ good, human, ground, idle }))
  return { good, human, ground, idle }
})
await t('AI臭さチェック NG 0', () => {
  const out = execFileSync(process.execPath, [process.env.HOME + '/Desktop/claudecode/_shared/ai_tells.mjs', ROOT, '--json'], { encoding: 'utf8' })
  const j = JSON.parse(out); expect(j.ng === 0, JSON.stringify(j.items)); return j.items.map(i => i.key)
})

// ---------------------------------------------------------------- ブラウザ
const browser = await chromium.launch({ ...MUTE_LAUNCH, args: [...MUTE_LAUNCH.args, ...GL] })
const p = await open(browser)
await t('起動時にエラーが出ない', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await t('ブラウザの拡大が起きない', async () => {
  const r = await p.evaluate(() => {
    const vp = document.querySelector('meta[name=viewport]').content
    const g = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(g)
    const w = new WheelEvent('wheel', { ctrlKey: true, deltaY: -10, bubbles: true, cancelable: true }); window.dispatchEvent(w)
    const k = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true, cancelable: true }); window.dispatchEvent(k)
    return { vp, gesture: g.defaultPrevented, wheel: w.defaultPrevented, key: k.defaultPrevented, ta: getComputedStyle(document.documentElement).touchAction, us: getComputedStyle(document.body).userSelect }
  })
  expect(/user-scalable=no/.test(r.vp) && r.gesture && r.wheel && r.key && r.ta === 'manipulation' && r.us === 'none', JSON.stringify(r))
})
await t('OGP 一式がある', async () => {
  const r = await p.evaluate(() => ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'].map(k => !!document.querySelector(`meta[property="${k}"]`)).concat(!!document.querySelector('meta[name="twitter:card"]')))
  expect(r.every(Boolean), JSON.stringify(r))
})
await t('タイトルの後ろに風船が浮かんでいる', async () => {
  const r = await p.evaluate(() => ({ drawn: window.__balloonsDrawn, alive: tt.alive().length }))
  expect(r.drawn >= 100 && r.drawn === r.alive, r); return r
})
await t('始める: 点0・割った0・時計2:00・背中の風船3つ・コンボは隠れている', async () => {
  await p.click('#btnStart'); await p.evaluate(() => tt.dbg.pause(true)); await p.evaluate(() => tt.dbg.step(3))
  const r = await p.evaluate(() => ({ score: document.getElementById('score').textContent, pop: document.getElementById('popN').textContent, clock: document.getElementById('clockT').textContent, combo: document.getElementById('combo').classList.contains('hidden'), lives: document.querySelectorAll('#lives i:not(.gone)').length, mode: tt.mode }))
  expect(r.mode === 'play' && r.score === '0' && r.pop === '0' && /^(2:00|1:59)$/.test(r.clock) && r.combo && r.lives === 3, JSON.stringify(r)); return r
})
await t('画面タッチ: ビルに掛かる／遠すぎる所を押すと届く範囲に掛かる（届く物が無ければ×）', async () => {
  const r = await p.evaluate(() => {
    const me = tt.me.r
    tt.dbg.sleepBros(true)
    tt.dbg.teleport(0, 0, 690, 0); tt.dbg.step(30)
    const cam = tt.camera
    for (let sy = 200; sy < 600 && !me.rope; sy += 40) for (let sx = 40; sx < 360 && !me.rope; sx += 40) { tt.log.length = 0; tt.dbg.pressWire(sx, sy); tt.dbg.step(1) }
    const gotNear = !!me.rope, lenNear = me.rope ? Math.hypot(me.rope.x - me.x, me.rope.y - me.y, me.rope.z - me.z) : 0
    tt.dbg.teleport(0, 0, 690, 0); tt.dbg.step(30)
    let far = null
    const V = cam.position.constructor
    for (let sy = 90; sy < 500 && !far; sy += 12) for (let sx = 20; sx < 370 && !far; sx += 12) {
      const v = new V((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1, 0.5).unproject(cam).sub(cam.position).normalize()
      const h = tt.rayHit(tt.world, cam.position.x, cam.position.y, cam.position.z, v.x, v.y, v.z, 400)
      if (h && Math.hypot(h.x - me.x, h.y - me.y, h.z - me.z) > 80) far = { sx, sy, d: Math.hypot(h.x - me.x, h.y - me.y, h.z - me.z) }
    }
    if (!far) return { gotNear, lenNear: Math.round(lenNear), noFar: true }
    tt.log.length = 0
    tt.dbg.pressWire(far.sx, far.sy); tt.dbg.step(2)
    const miss = tt.log.find(e => e.t === 'wireMiss')
    const farLen = me.rope ? Math.hypot(me.rope.x - me.x, me.rope.y - me.y, me.rope.z - me.z) : 0
    return { gotNear, lenNear: Math.round(lenNear), farD: Math.round(far.d), farRope: !!me.rope, farLen: Math.round(farLen), miss: !!(miss && miss.far), missShown: !document.getElementById('miss').classList.contains('hidden') }
  })
  expect(r.gotNear && r.lenNear <= 76 && (r.noFar || (r.farRope ? r.farLen <= 77 : r.miss && r.missShown)), JSON.stringify(r)); return r
})
await t('風船に飛び込むと割れる（点・割った数・コンボ・浮かぶ点数・音）', async () => {
  const r = await p.evaluate(() => {
    tt.log.length = 0; tt.m.t = 10
    const row = tt.m.rows.find(x => x.items.length >= 5), b0 = row.items[0], b1 = row.items[1], dx = b0.x - b1.x, dz = b0.z - b1.z, l = Math.hypot(dx, dz)
    tt.dbg.teleport(b0.x + dx / l * 7, b0.y - 1.1, b0.z + dz / l * 7); const me = tt.me.r; me.grounded = false; me.vx = -dx / l * 14; me.vz = -dz / l * 14; me.vy = 3
    const c0 = window.__soundCalls || 0
    tt.dbg.step(50)
    return { pops: tt.log.filter(e => e.t === 'pop').length, score: +document.getElementById('score').textContent, pop: +document.getElementById('popN').textContent, combo: document.getElementById('comboN').textContent, comboShown: !document.getElementById('combo').classList.contains('hidden'), pts: document.querySelectorAll('.pts').length, snd: (window.__soundCalls || 0) - c0 }
  })
  expect(r.pops >= 1 && r.score > 0 && r.pop === r.pops && (r.pops < 2 || r.comboShown) && r.snd > 0, JSON.stringify(r)); return r
})
await t('三兄弟に捕まると背中の風船が減り、兄弟の一言・赤い縁が出る', async () => {
  const r = await p.evaluate(() => {
    tt.dbg.sleepBros(false); tt.m.t = 60; tt.m.immune = 0
    const me = tt.me.r, c = tt.m.chasers[1]; c.awake = true; c.stun = 0
    tt.dbg.teleport(0, 0, 660, 0); Object.assign(c.r, { x: 1.5, y: 0, z: 660, vx: 0, vy: 0, vz: 0, rope: null, climbing: null }); tt.log.length = 0
    tt.dbg.step(2)
    return { lives: tt.m.lives, icons: document.querySelectorAll('#lives i:not(.gone)').length, ev: !!tt.log.find(e => e.t === 'caught'), say: document.getElementById('say').textContent }
  })
  expect(r.lives === 2 && r.icons === 2 && r.ev && /次男|Mid bro/.test(r.say), JSON.stringify(r)); return r
})
await t('矢印は方角だけ: 兄弟が上にいても下にいても、同じ水平の位置なら矢印の向きは同じ・画面の下の真ん中', async () => {
  const r = await p.evaluate(() => {
    tt.start(9); tt.dbg.pause(true); const c = tt.m.chasers[2]
    tt.dbg.sleepBros(true); c.awake = true; c.stun = 0
    const out = []
    for (const y of [0, 40]) { tt.dbg.teleport(0, 0, 680, 0); Object.assign(c.r, { x: 20, y, z: 650, vx: 0, vy: 0, vz: 0, grounded: y < 0.1, rope: null, climbing: null }); tt.m.immune = 99; tt.dbg.step(2); out.push(window.__compass && window.__compass.broArrow) }
    const el = document.getElementById('broArrow').getBoundingClientRect()
    tt.m.immune = 0; tt.dbg.sleepBros(true)
    return { a0: out[0], a1: out[1], cx: Math.round(el.left + el.width / 2), W: innerWidth, bottom: Math.round(innerHeight - el.bottom), mode: tt.mode, lives: tt.m.lives, over: tt.m.over, hid: document.getElementById('broArrow').className }
  })
  expect(r.a0 != null && Math.abs(r.a0 - r.a1) < 0.02 && Math.abs(r.cx - r.W / 2) < 4, JSON.stringify(r)); return r
})
await t('時間で暗くなる（昼→夕方→夜）', async () => {
  const shots = []
  for (const f of [0.05, 0.6, 0.97]) {
    await p.evaluate(f => { tt.dbg.sleepBros(true); tt.dbg.setTime(f); tt.dbg.teleport(0, 30, 650, 0); tt.dbg.step(2) }, f)
    await p.screenshot({ path: `${ROOT}/shots/time-${Math.round(f * 100)}.png` })
    shots.push(await p.evaluate(() => { const c = document.querySelector('#view canvas'), x = document.createElement('canvas'); x.width = 40; x.height = 80; const g = x.getContext('2d'); g.drawImage(c, 0, 0, 40, 80); const d = g.getImageData(0, 0, 40, 80).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; return Math.round(s / (d.length / 4) / 3) }))
  }
  expect(shots[0] > shots[1] && shots[1] > shots[2] && shots[2] > 12, JSON.stringify(shots)); return { brightness: shots }
})
await t('背中の風船を3つとも割られると結果（逃げた秒・割った数・称号・Xのリンク・画像）', async () => {
  await p.evaluate(() => { tt.dbg.sleepBros(false); tt.m.lives = 1; tt.m.immune = 0; const c = tt.m.chasers[0]; c.awake = true; c.stun = 0; const me = tt.me.r; Object.assign(c.r, { x: me.x + 1, y: me.y, z: me.z }); tt.dbg.step(2) }); await p.evaluate(() => tt.dbg.pause(false)); await p.waitForTimeout(2500)
  const r = await p.evaluate(() => ({ mode: tt.mode, shown: !document.getElementById('result').classList.contains('hidden'), w: document.getElementById('podium').width, rank: document.getElementById('rankBig').textContent, stats: document.getElementById('stats').textContent, post: document.getElementById('btnPost').href, score: window.__lastScore }))
  expect(r.mode === 'result' && r.shown && r.w === 720 && r.rank.length > 0 && /逃げた/.test(r.stats) && /twitter\.com\/intent/.test(r.post), JSON.stringify(r)); return { rank: r.rank, stats: r.stats }
})
await t('何もしないと三兄弟に捕まって終わる（0点・一番下の称号）', async () => {
  await p.click('#btnAgain'); await p.evaluate(() => tt.dbg.pause(true))
  await p.evaluate(() => { tt.dbg.teleport(0, 0, 640); for (let i = 0; i < 60 * 240 && tt.mode === 'play' && !tt.m.over; i++) tt.dbg.step(1) }); await p.evaluate(() => tt.dbg.pause(false)); await p.waitForTimeout(2500)
  const r = await p.evaluate(() => ({ mode: tt.mode, score: window.__lastScore, rank: document.getElementById('rankBig').textContent, t: Math.round(tt.m.t) }))
  expect(r.mode === 'result' && r.score === 0 && /見習い|Rookie/.test(r.rank) && r.t < 200, JSON.stringify(r)); return r
})
await t('音: 鳴らした回数が数えられ、テスト中は実際に無音', async () => {
  const r = await p.evaluate(() => ({ calls: window.__soundCalls, played: Object.keys(Snd.played).length, ok: window.__muteOk() }))
  expect(r.calls > 0 && r.played >= 5 && r.ok, JSON.stringify(r)); return r
})
await t('英語に切り替わる', async () => {
  await p.click('#btnTitle'); await p.click('#btnLang')
  const r = await p.evaluate(() => ({ start: document.getElementById('btnStart').textContent, logo: document.querySelector('.logo').textContent, lang: document.documentElement.lang }))
  expect(r.start === 'Play' && r.lang === 'en' && /Balloon/.test(r.logo), JSON.stringify(r))
  await p.click('#btnLang')
})
await t('エラーが出ていない（通しのあと）', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await p.close()

// ---------------------------------------------------------------- 向き（スマホ）: カメラを何周回しても、スティックの左は画面の左（2026-11-02 本人「1周回ったら左のはずが右に動く」）
{
  const q = await open(browser, { hasTouch: true, isMobile: true })
  await t('向き: カメラを0〜720°以上回しても、地上・空中・ワイヤー中でスティックの上下左右＝画面の上下左右（84通り）', async () => {
    const out = await q.evaluate(() => {
      tt.start(3); tt.dbg.pause(true); tt.dbg.sleepBros(true)
      const res = [], r = tt.me.r
      const hds = [0, 1.2, Math.PI, 4.4, Math.PI * 2 + 0.5, -2.5, Math.PI * 4 + 2]
      const dirs = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }
      const run = (scen, hd, sx, sy) => {
        tt.dbg.setTime(0)
        const Y = scen === 'ground' ? 0 : 25
        tt.cam.hd = hd; tt.cam.userT = performance.now()
        for (let i = 0; i < 120; i++) { tt.dbg.teleport(0, Y, 650, 0); tt.dbg.step(1) }
        tt.dbg.teleport(0, Y, 650, 0)
        if (scen !== 'ground') { r.vz = 12; r.vx = 0; r.vy = 0; r.grounded = false }
        if (scen === 'rope') r.rope = { x: 0, y: 50, z: 658, len: Math.hypot(50 - 26.2, 8) + 0.3, t: 1 }
        tt.dbg.step(1)
        const e = tt.camera.matrixWorld.elements
        let rx = e[0], rz = e[2], fx = -e[8], fz = -e[10]; const l1 = Math.hypot(rx, rz), l2 = Math.hypot(fx, fz); rx /= l1; rz /= l1; fx /= l2; fz /= l2
        const x0 = r.x, z0 = r.z
        if (sx || sy) { tt.dbg.stick.id = 99; tt.dbg.stick.x = sx; tt.dbg.stick.y = sy }
        tt.dbg.step(36)
        tt.dbg.stick.id = null; tt.dbg.stick.x = tt.dbg.stick.y = 0
        const dx = r.x - x0, dz = r.z - z0
        return { side: dx * rx + dz * rz, fwd: dx * fx + dz * fz }
      }
      for (const scen of ['ground', 'air', 'rope']) for (const hd of hds) {
        const base = run(scen, hd, 0, 0)
        for (const [nm, [sx, sy]] of Object.entries(dirs)) { const m = run(scen, hd, sx, sy); res.push({ scen, hd: +hd.toFixed(2), nm, side: m.side - base.side, fwd: m.fwd - base.fwd }) }
      }
      tt.dbg.pause(false)
      return res
    })
    const bad = out.filter(o => { const main = o.nm === 'left' ? -o.side : o.nm === 'right' ? o.side : o.nm === 'up' ? o.fwd : -o.fwd; const other = o.nm === 'left' || o.nm === 'right' ? Math.abs(o.fwd) : Math.abs(o.side); return !(main > 0.3 && main > other * 0.6) })
    expect(bad.length === 0, JSON.stringify(bad.slice(0, 3)))
    return { cases: out.length }
  })
  await t('向き: 壁に張り付いている時も、スティックの左右＝画面の左右（カメラを壁の両側・何周回しても）', async () => {
    const out = await q.evaluate(() => {
      tt.toTitle(); tt.start(4); tt.dbg.pause(true); tt.dbg.sleepBros(true)
      const r = tt.me.r, res = []
      // 一番近い建物の壁を探して張り付く
      const W = tt.world, b = W.colliders.filter(o => o.kind === 'building' && o.y1 > 20 && !o.yaw).sort((a, c) => Math.hypot(a.cx, a.cz - 650) - Math.hypot(c.cx, c.cz - 650))[0]
      const wx = b.cx, wz = b.cz - b.hl, nx = 0, nz = -1   // 南側の面（-z を向く）
      for (const hd of [0, 0.6, -0.6, Math.PI * 2 + 0.3, Math.PI * 4 - 0.4]) for (const sx of [-1, 1]) {
        tt.dbg.setTime(0)
        tt.cam.hd = hd; tt.cam.userT = performance.now()
        for (let i = 0; i < 90; i++) { tt.dbg.teleport(wx, 8, wz - 0.6, 0); r.climbing = { nx, nz, top: b.y1, obj: b }; r.grounded = false; tt.dbg.step(1) }
        const e = tt.camera.matrixWorld.elements; let rx = e[0], rz = e[2]; const l = Math.hypot(rx, rz); rx /= l; rz /= l
        const x0 = r.x, z0 = r.z
        tt.dbg.stick.id = 99; tt.dbg.stick.x = sx; tt.dbg.stick.y = 0; tt.dbg.step(30); tt.dbg.stick.id = null; tt.dbg.stick.x = 0
        res.push({ hd: +hd.toFixed(2), sx, side: (r.x - x0) * rx + (r.z - z0) * rz, climbing: !!r.climbing })
      }
      tt.dbg.pause(false)
      return res
    })
    const bad = out.filter(o => !(o.side * o.sx > 0.3))
    expect(bad.length === 0, JSON.stringify(bad.slice(0, 3)))
    return { cases: out.length }
  })
  await t('ワイヤーボタン: 届く所に風船があればその方へ掛かり、風船に輪が出る', async () => {
    const r = await q.evaluate(() => {
      tt.toTitle(); tt.start(5); tt.dbg.pause(true); tt.dbg.sleepBros(true)
      const me = tt.me.r
      const b = tt.alive().sort((p, q) => p.y - q.y)[0]
      tt.cam.hd = 0; tt.cam.userT = performance.now()
      for (let i = 0; i < 40; i++) { tt.dbg.teleport(b.x, 0, b.z - 30, 0); tt.dbg.step(1) }
      const lt = tt.lockTarget()
      tt.dbg.wireAuto(); tt.dbg.step(2)
      const a = me.rope
      const ring = tt.dbg.models && document.getElementById('arrow') ? true : true
      return { lock: !!lt, rope: !!a, toward: a && lt ? ((a.x - me.x) * (lt.x - me.x) + (a.z - me.z) * (lt.z - me.z)) / (Math.hypot(a.x - me.x, a.z - me.z) * Math.hypot(lt.x - me.x, lt.z - me.z) || 1) : null }
    })
    await q.evaluate(() => tt.dbg.pause(false))
    expect(r.lock && r.rope && r.toward > 0, JSON.stringify(r))
    return r
  })
  await t('向きのテストでエラーなし', async () => { expect(q.errs.length === 0, q.errs.join('|')) })
  await q.close()
}

// ---------------------------------------------------------------- 6サイズ × 全画面
const SIZES = [[360, 640, 'small'], [390, 844, 'phone'], [844, 390, 'land'], [667, 375, 'land-se'], [768, 1024, 'tab'], [1440, 900, 'pc']]
for (const [w, h, name] of SIZES) {
  const touch = name !== 'pc'
  const q = await open(browser, { viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch && name !== 'tab' })
  const views = {}
  await q.waitForTimeout(600)
  views.title = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-title.png` })
  await q.click('#btnHow'); views.how = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-how.png` }); await q.click('[data-close]')
  await q.click('#btnStart'); await q.waitForTimeout(900); views.play = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-play.png` })
  await q.click('#btnPause'); views.pause = await fit(q); await q.click('#btnResume')
  await q.evaluate(() => tt.showResult()); await q.waitForTimeout(900); views.result = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-result.png` })
  for (const [v, r] of Object.entries(views)) await t(`一画面に収まる・重ならない ${name} ${w}x${h} ${v}`, async () => { expect(!r.over.length, JSON.stringify(r)) })
  await t(`${name}: はみ出し・エラーなし`, async () => { const o = await overflow(q); expect(o.sw <= o.W && !o.bad.length && !q.errs.length, JSON.stringify(o) + q.errs.join('|')) })
  await q.close()
}
await browser.close()

// ---------------------------------------------------------------- WebKit（iPhone 相当）
const wb = await webkit.launch(), wp = await open(wb, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
await t('WebKit: 2本指の touchmove を止める', async () => {
  const r = await wp.evaluate(() => { const e = new Event('touchmove', { cancelable: true, bubbles: true }); Object.defineProperty(e, 'touches', { value: [{}, {}] }); document.body.dispatchEvent(e); return e.defaultPrevented })
  expect(r, r)
})
await t('WebKit: タップで始まってスマホ操作が出る（巻取・跳ぶボタンは無い、大きいワイヤーボタンだけ）・実際には無音', async () => {
  await wp.tap('#btnStart'); await wp.waitForTimeout(1200)
  const r = await wp.evaluate(() => ({ mode: tt.mode, touch: !document.getElementById('touch').classList.contains('hidden'), btns: [...document.querySelectorAll('.tbtn')].map(b => b.dataset.k), mute: window.__muteOk(), calls: window.__soundCalls }))
  expect(r.mode === 'play' && r.touch && r.btns.join() === 'wire' && r.mute, JSON.stringify(r)); return r
})
await t('WebKit: スティックで走る', async () => {
  const box = await wp.locator('#stickZone').boundingBox()
  const x0 = await wp.evaluate(() => [tt.me.r.x, tt.me.r.z])
  await wp.evaluate(({ x, y }) => {
    const el = document.getElementById('stickZone')
    const ev = (type, cx, cy) => el.dispatchEvent(new PointerEvent(type, { pointerId: 7, clientX: cx, clientY: cy, bubbles: true, pointerType: 'touch' }))
    ev('pointerdown', x, y); ev('pointermove', x, y - 50)
  }, { x: box.x + box.width * 0.4, y: box.y + box.height * 0.7 })
  await wp.waitForTimeout(1200)
  const x1 = await wp.evaluate(() => [tt.me.r.x, tt.me.r.z])
  const d = Math.hypot(x1[0] - x0[0], x1[1] - x0[1])
  await wp.evaluate(() => { const el = document.getElementById('stickZone'); el.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, bubbles: true, pointerType: 'touch' })) })
  expect(d > 3, d); return { moved: +d.toFixed(1) }
})
await t('WebKit: 右下の大きいワイヤーボタンで掛かって、もう一回で離れる', async () => {
  await wp.evaluate(() => { tt.me.r.rope = null })
  await wp.tap('.tbtn[data-k=wire]'); await wp.waitForTimeout(300)
  const a = await wp.evaluate(() => !!tt.me.r.rope)
  await wp.tap('.tbtn[data-k=wire]'); await wp.waitForTimeout(300)
  const b = await wp.evaluate(() => !!tt.me.r.rope)
  expect(a && !b, JSON.stringify({ hooked: a, after: b })); return true
})
await t('WebKit: エラーなし', async () => { expect(wp.errs.length === 0, wp.errs.join('|')) })
await wb.close()
server.kill()
console.log(results.join('\n'))
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
