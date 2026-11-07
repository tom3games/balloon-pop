// SNS 用の画像 og.png（1200x630）。風船の列へワイヤーで振り込む瞬間＋タイトル。node og.mjs
import './mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { muteContext, MUTE_LAUNCH } from './mute.mjs'
const srv = spawn(process.execPath, ['server.mjs'], { cwd: import.meta.dirname, env: { ...process.env, PORT: '5395' } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch({ ...MUTE_LAUNCH, args: [...MUTE_LAUNCH.args, '--use-angle=metal', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 1200, height: 630 } }); await muteContext(ctx)
const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message))
await p.goto('http://localhost:5395/'); await p.waitForFunction(() => window.__ttReady, null, { timeout: 20000 })
await p.waitForTimeout(2500)
await p.evaluate(() => tt.start(5)); await p.waitForTimeout(1200)
await p.evaluate(() => {
  tt.dbg.pause(true)
  const me = tt.me.r
  tt.dbg.setTime(0.5)   // 夕方の手前
  // 風船の列へ、ワイヤーで振り込んで1個割った瞬間
  const row = tt.m.rows.slice().sort((a, b) => b.items.length - a.items.length)[0], it = row.items
  const k = Math.floor(it.length / 2), b = it[k], n = it[k + 1] || it[k - 1], dx = n.x - b.x, dz = n.z - b.z, l = Math.hypot(dx, dz)
  Object.assign(me, { x: b.x - dx / l * 1.2, y: b.y - 1.6, z: b.z - dz / l * 1.2, vx: dx / l * 20, vy: 2, vz: dz / l * 20, grounded: false, climbing: null, yaw: Math.atan2(dx, dz) })
  me.rope = { x: b.x + dx / l * 6, y: b.y + 18, z: b.z + dz / l * 6, len: 19, t: 0.5 }
  // すぐ後ろに長男（売り物の風船の束を持って追ってくる）
  const c = tt.m.chasers[0]; c.awake = true
  Object.assign(c.r, { x: me.x - dx / l * 5.5 - dz / l * 1.2, y: me.y - 0.6, z: me.z - dz / l * 5.5 + dx / l * 1.2, vx: dx / l * 18, vy: 1, vz: dz / l * 18, grounded: false, climbing: null, yaw: Math.atan2(dx, dz) })
  c.r.rope = { x: me.x - dx / l * 2, y: me.y + 18, z: me.z - dz / l * 2, len: 19, t: 0.5 }
  tt.dbg.step(1)
  window.__freeze = true
  const cm = tt.camera
  // 横から少し後ろ。列が画面の右へ流れていく
  const sx = -dz / l, sz = dx / l
  cm.position.set(me.x - dx / l * 4 + sx * 9, me.y + 2.6, me.z - dz / l * 4 + sz * 9); cm.lookAt(me.x + dx / l * 2, me.y + 1.2, me.z + dz / l * 2); cm.fov = 60; cm.updateProjectionMatrix()
  tt.dbg.step(1)
  for (const id of ['hud', 'pause', 'title']) document.getElementById(id).classList.add('hidden')
  const d = document.createElement('div')
  d.innerHTML = `<div style="position:fixed;left:48px;top:44px;z-index:30;color:#fff">
    <div style="font-family:'Rampart One',sans-serif;font-size:100px;line-height:1.05;transform:rotate(-2.5deg);transform-origin:0 100%;text-shadow:0 4px 0 rgba(0,0,0,.3)">空中<br>風船割り</div>
    <div style="font-family:'Zen Kaku Gothic New',sans-serif;font-weight:900;font-size:34px;margin-top:22px;line-height:1.4;text-shadow:0 2px 10px rgba(0,0,0,.85)">風船屋に追われながら<br>風船を割りまくる</div></div>`
  document.body.appendChild(d)
})
await p.waitForTimeout(900)
await p.screenshot({ path: 'og.png' })
await b.close(); srv.kill()
console.log('og.png')
