import './mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// 公開URLの確認。node live.mjs（ログインしていないブラウザで見る）。SKIPGH=1 で GitHub ページの確認を省く
import { chromium, webkit } from 'playwright'
import { execSync } from 'node:child_process'
// 個人のIDは公開物に書かない。手元の gh から取って照らし合わせる
const ME = (() => { try { return execSync('gh api user -q .login', { encoding: 'utf8' }).trim() } catch (e) { return '' } })()
const URL0 = 'https://tom3games.github.io/balloon-pop/'
const out = []
for (const [name, bt, opts] of [['chromium', chromium, {}], ['webkit', webkit, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
  const b = await bt.launch(bt === chromium ? { ...MUTE_LAUNCH, args: [...MUTE_LAUNCH.args, '--use-angle=metal'] } : {}), ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await muteContext(ctx)
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  p.on('requestfailed', r => errs.push('fail ' + r.url()))
  await p.goto(URL0 + '?t=' + Date.now(), { waitUntil: 'networkidle' })
  await p.waitForFunction(() => window.__ttReady, null, { timeout: 15000 })
  // 遊びの通し: 始める → 風船の列に飛び込んで割る → 90秒 → 結果
  if (opts.hasTouch) await p.tap('#btnStart'); else await p.click('#btnStart')
  await p.waitForTimeout(800)
  const flow = await p.evaluate(() => {
    tt.dbg.pause(true); tt.dbg.step(2); tt.m.t = 10
    const row = tt.m.rows.find(x => x.items.length >= 5), b0 = row.items[0], b1 = row.items[1], dx = b0.x - b1.x, dz = b0.z - b1.z, l = Math.hypot(dx, dz)
    tt.dbg.teleport(b0.x + dx / l * 7, b0.y - 1.1, b0.z + dz / l * 7); const r = tt.me.r; Object.assign(r, { grounded: false, vx: -dx / l * 14, vz: -dz / l * 14, vy: 3 })
    tt.dbg.step(50)
    const popped = tt.m.popped
    tt.dbg.step(60 * 92); tt.dbg.pause(false)
    return { popped }
  })
  await p.waitForTimeout(2500)
  const res = await p.evaluate(() => ({ mode: tt.mode, score: window.__lastScore, mute: window.__muteOk() }))
  out.push(`${name}: flow=${JSON.stringify(flow)} result=${JSON.stringify(res)}`)
  await p.screenshot({ path: `shots/live-${name}.png` })
  const og = await p.evaluate(async () => { const r = await fetch(document.querySelector('meta[property="og:image"]').content); return r.status + ' ' + r.headers.get('content-type') })
  out.push(`${name}: og=${og} errors=${errs.length ? errs.join(' | ') : 'none'}`)
  await b.close()
}
if (process.env.SKIPGH) { console.log(out.join('\n')); process.exit(0) }
// ログアウト状態でリポジトリ・更新履歴に個人のIDが出ていないか
const b = await chromium.launch(MUTE_LAUNCH), p = await b.newPage()
for (const u of ['https://github.com/tom3games/balloon-pop', 'https://github.com/tom3games/balloon-pop/commits/main']) {
  const res = await p.goto(u, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500)
  out.push(`${u} status=${res.status()} personalId=${ME && (await p.content()).toLowerCase().includes(ME.toLowerCase()) ? 'FOUND' : 'none'}`)
}
await b.close()
console.log(out.join('\n'))
