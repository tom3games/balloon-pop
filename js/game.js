// 空中風船割り。WIRE ESCAPE のワイヤーと街で、空に浮かぶ風船を飛び回って割りまくる（空中しっぽ取りのクローンから作り替え）
// 2026-11-02 本人「ワイヤーで飛び回るのは気持ちいい。しっぽ取りは人には難しい。もっと爽快で気持ちいいものに」
import * as THREE from 'three'
import { GAME } from '../shared/config.js?v=9'
import { createWorld } from '../shared/track.js?v=9'
import { setupArena, AREA, POLE_H } from '../shared/arena.js?v=9'
import { buildScene } from './scene.js?v=9'
import { FX } from './fx.js?v=9'
import { loadSky, setAniso } from './look.js?v=9'
import { Q } from './quality.js?v=9'
import { RunnerModel } from './runnermodel.js?v=9'
import { CharRunnerModel, loadCharAssets, charAssets } from './charmodel.js?v=9'
import { createRunner, stepRunner, findAnchor, rayHit, floorAt, RUN } from '../shared/runner.js?v=9'
import { BAL, createGame, stepGame, alive, lockTarget, rankOf, nearestChaser } from '../shared/balloons.js?v=9'
import { createChaser, chaserInput } from '../shared/chaser.js?v=9'

const $ = id => document.getElementById(id)
const STEP = GAME.step
const URL_ = 'https://tom3games.github.io/balloon-pop/'
const store = { get: k => { try { return localStorage.getItem(k) } catch (e) { return null } }, set: (k, v) => { try { localStorage.setItem(k, v) } catch (e) {} } }

// ---------------------------------------------------------------- 文言（日英）
const T = {
  ja: {
    logo: '空中風船割り', sub: '風船屋に追われながら、空の風船を割りまくる',
    start: 'はじめる', how: '遊び方', lang: 'EN', more: 'ほかのゲーム', muteOn: '音 入', muteOff: '音 切', loading: '風船をふくらませ中',
    howTitle: '遊び方', ok: 'わかった',
    howItems: [
      '<b>大きいボタン</b>か建物・電柱を<b>タッチ</b>でワイヤー。もう一回で離す。空中で<b>地面をタップ</b>すると地面に掛かって加速',
      '風船に<b>飛び込む</b>と割れる。割るたびに少し加速する',
      '怒った<b>風船屋の三兄弟</b>が追ってくる。捕まると背中の風船を1つ割られる。<b>2分</b>逃げきれば、残った風船がボーナス',
      '速く飛べば振り切れる。地面にいると追いつかれる。<b>金の風船</b>で背中の風船が1つ戻る'
    ],
    keysPc: 'PC: WASD・矢印で移動　クリックでワイヤー（E でも可）　Space でも離れる・壁を蹴る　ドラッグで見回す',
    credit: '音: Kenney, rubberduck, artisticdude, wubitog, poinl, Almitory ほか（CC0）。人物: KayKit（CC0）',
    pause: '休憩', paused: '休憩中', resume: '戻る', quit: 'やめる',
    jump: '跳ぶ', tooFar: '届かない',
    hint1: '<small>こつ</small>大きいボタンで、輪の風船へワイヤー', hint1Pc: '<small>こつ</small>ビルや電柱をクリック（か E）でワイヤー',
    hint2: '<small>こつ</small>風船の列を振り子でなぞると、続けて割れる', hint3: '<small>こつ</small>地面にいると追いつかれる。飛んで逃げろ',
    bros: ['長男', '次男', '三男'], wake: ['<small>長男</small>こらー！売り物やぞ！', '<small>次男</small>兄ちゃん、あいつか！', '<small>三男</small>ぼくの風船…！'],
    caughtL: [['1個300円や！', '弁償せえ！', 'つかまえたで'], ['兄ちゃん、やったで！', '次は逃がさん', 'ほれ見たことか'], ['ぼくの勝ち…', 'ごめんね、割るね', 'ぼくの風船の気持ち、わかった？']],
    near: '来てる！', life: '背中の風船がひとつ戻った', lastOne: 'あと1つ！',
    gold: '金の風船 ×5',
    // 白い風船は誰かの持ち物。割ると下から持ち主の声が聞こえる（全部うっかり。怒ってはいるが平和）
    odd: ['それ、娘の誕生日のやつ…', '社長の還暦祝いが…', 'プロポーズ用やったのに', 'デュフフ…ぼくの風船…デュフ', '中にへそくり入れてたんやけど', 'それ選挙の…まあええか', '犬の名前書いてたのに', '割る音で昼寝から起きた'], comboN: n => `${n}コンボ！`, comboEnd: n => `${n}コンボ`, last30: 'あと30秒', last10: 'あと10秒', end: 'そこまで',
    again: 'もう一回', save: '画像を保存', post: 'Xでポスト', toTitle: 'タイトル', ptsUnit: '点', pop: '個', combo: 'コンボ', statTime: '逃げた', downEnd: '全部割られた…', escaped: (n, b) => `逃げきった！<br><small>残った風船 ${n}つ ＋${b}点</small>`, statEscaped: '逃げきり',
    statPop: '割った', statCombo: '最高コンボ', statAir: '空にいた',
    titles: ['見習い', '風船ハンター', '空の割り屋', '風船の王'],
    verdict: ['まずは列をなぞろう', 'いい飛びっぷり', 'コンボがつながってる', '空の主。街の子どもは泣いている'],
    resLine: (n, c, s) => `${s}秒 逃げて ${n}個 割った`,
    broLine: '三兄弟「次は売り物、買うてな」',
    postText: (n, c, s, sec) => `空中風船割りで風船屋から${sec}秒逃げて${n}個割った（${s}点）`
  },
  en: {
    logo: 'Sky Balloon Pop', sub: 'Pop the balloons while the balloon shop brothers chase you',
    start: 'Play', how: 'How to play', lang: 'JP', more: 'More games', muteOn: 'Sound on', muteOff: 'Muted', loading: 'Blowing up balloons',
    howTitle: 'How to play', ok: 'Got it',
    howItems: [
      'The <b>big button</b> or <b>tapping</b> a building or pole fires the wire. Press again to let go. In the air, <b>tap the ground</b> to zip toward it',
      '<b>Fly into</b> balloons to pop them. Every pop gives you a little speed',
      'The angry <b>balloon shop brothers</b> chase you. Get caught and they pop one of your 3 balloons. Last <b>2 minutes</b> for a bonus',
      'Fly fast to shake them off. On the ground they catch up. <b>Gold balloons</b> give one back'
    ],
    keysPc: 'PC: WASD / arrows move · click to wire (or E) · Space also lets go / kicks off a wall · drag to look',
    credit: 'Sounds: Kenney, rubberduck, artisticdude, wubitog, poinl, Almitory and others (CC0). Characters: KayKit (CC0)',
    pause: 'Pause', paused: 'Paused', resume: 'Resume', quit: 'Quit',
    jump: 'Jump', tooFar: 'Too far',
    hint1: '<small>Tip</small>The big button swings you toward the ringed balloon', hint1Pc: '<small>Tip</small>Click a building or pole (or E) to wire',
    hint2: '<small>Tip</small>Swing along a line of balloons to pop them in a row', hint3: '<small>Tip</small>On the ground they catch you. Fly!',
    bros: ['Big bro', 'Mid bro', 'Little bro'], wake: ['<small>Big bro</small>Hey! Those are for sale!', '<small>Mid bro</small>Is that the guy?!', '<small>Little bro</small>My balloons...!'],
    caughtL: [['300 yen each!', 'You owe me!', 'Got you'], ['Got him, bro!', 'Not this time', 'Told you'], ['I win...', 'Sorry, popping it', 'Now you know how it feels']],
    near: 'Behind you!', life: 'Got a balloon back', lastOne: 'One left!',
    gold: 'Gold balloon x5',
    odd: ['That was my daughter\'s birthday balloon...', 'The boss\'s retirement balloon...', 'I was going to propose with that', 'Heh heh... my balloon... heh', 'My secret savings were in there', 'That was for the election... eh, fine', 'It had my dog\'s name on it', 'You woke me from my nap'], comboN: n => `${n} combo!`, comboEnd: n => `${n} combo`, last30: '30 seconds left', last10: '10 seconds left', end: 'Time!',
    again: 'Again', save: 'Save image', post: 'Post on X', toTitle: 'Title', ptsUnit: 'points', pop: '', combo: 'combo', statTime: 'Survived', downEnd: 'All popped...', escaped: (n, b) => `You made it!<br><small>${n} balloons left +${b}</small>`, statEscaped: 'Escaped',
    statPop: 'Popped', statCombo: 'Best combo', statAir: 'In the air',
    titles: ['Rookie', 'Balloon hunter', 'Sky popper', 'Balloon king'],
    verdict: ['Follow the balloon lines', 'Nice swinging', 'Your combos are flowing', 'Master of the sky. The kids are crying'],
    resLine: (n, c, s) => `${s}s on the run · ${n} popped`,
    broLine: 'The brothers: "Buy one next time"',
    postText: (n, c, s, sec) => `I ran from the balloon shop for ${sec}s and popped ${n} in Sky Balloon Pop (${s} pts)`
  }
}
let lang = store.get('bp.lang') || ((navigator.language || 'ja').startsWith('ja') ? 'ja' : 'en')
const t = k => T[lang][k]
const touchMode = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
document.body.classList.toggle('is-touch', touchMode)
function applyLang() {
  document.documentElement.lang = lang
  for (const el of document.querySelectorAll('[data-t]')) { const v = t(el.dataset.t); if (typeof v === 'string') el.textContent = v }
  $('howList').innerHTML = t('howItems').map((s, i) => `<li><i>${i + 1}</i><span>${s}</span></li>`).join('')
  $('howKeys').textContent = touchMode ? '' : t('keysPc')
  $('btnMute').textContent = Snd.muted ? t('muteOff') : t('muteOn')
}

// ---------------------------------------------------------------- 音（録音素材だけ）
Snd.muted = store.get('bp.mute') === '1'
Snd.def({
  wire: ['snd/swish-1.mp3', 'snd/swish-2.mp3', 'snd/swish-3.mp3'], hook: ['snd/metalClick.mp3', 'snd/metal_02.mp3'],
  land: ['snd/footstep_01.mp3', 'snd/footstep_02.mp3'], bonk: ['snd/thwack-01.mp3', 'snd/thwack-03.mp3'],
  pop: ['snd/pop1.mp3', 'snd/pop2.mp3', 'snd/pop3.mp3'],
  pick: 'snd/coin_drop.mp3', ding: 'snd/bell_ding1.mp3',
  click: 'snd/click_001.mp3', tick: 'snd/tick_002.mp3', whoosh: 'snd/swish-5.mp3', clap: 'snd/applause.mp3',
  caught: ['snd/grunt_01.mp3', 'snd/grunt_02.mp3', 'snd/grunt_03.mp3'], myPop: 'snd/thwack-03.mp3',
  win: 'snd/jingles_SAX01.mp3', mid: 'snd/jingles_SAX10.mp3', meh: 'snd/jingles_SAX03.mp3', lose: 'snd/jingles_PIZZA07.mp3'
})
const sfx = (n, o) => Snd.play(n, o)

// ---------------------------------------------------------------- 描画の土台
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true })
renderer.setPixelRatio(Q.pixelRatio)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.0
setAniso(renderer)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
$('view').appendChild(renderer.domElement)
const scene = new THREE.Scene()
scene.fog = new THREE.FogExp2(0xc9d6e2, 0.0022)
scene.background = new THREE.Color(0xa9c4e0)
const sun = new THREE.DirectionalLight(0xfff1dc, 3.0)
sun.userData.dir = new THREE.Vector3(-0.45, 0.62, -0.64).normalize()
sun.castShadow = true
sun.shadow.mapSize.set(Q.shadow, Q.shadow)
Object.assign(sun.shadow.camera, { left: -Q.shadowRange, right: Q.shadowRange, top: Q.shadowRange, bottom: -Q.shadowRange, near: 1, far: 400 })
sun.shadow.normalBias = 0.04; sun.shadow.bias = -0.0004
scene.add(sun, sun.target)
const hemi = new THREE.HemisphereLight(0xc4d8ff, 0x6a5a48, 1.8)
scene.add(hemi)
let skyReady = false
loadSky(renderer, scene, sun, () => { hemi.intensity = 0.4; skyReady = true })
const camera = new THREE.PerspectiveCamera(64, 1, 0.3, 2400)
const world = setupArena(createWorld('city'))
const built = buildScene(scene, world)
for (const g of built.gates) g.grp.visible = false
const fx = new FX(scene, world)

// 夜に明るくする窓（建物の発光の強さを覚えておく）
const glowMats = []
scene.traverse(o => { if (o.material && o.material.emissiveMap) glowMats.push({ m: o.material, base: o.material.emissiveIntensity }) })

// ---------------------------------------------------------------- 電柱と電線
{
  const P = world.poles, n = P.length
  const concrete = new THREE.MeshStandardMaterial({ color: 0x9a978f, roughness: 0.85 })
  const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.2, POLE_H, 8).translate(0, POLE_H / 2, 0), concrete, n)
  const arm = new THREE.InstancedMesh(new THREE.BoxGeometry(1.8, 0.12, 0.12).translate(0, POLE_H - 0.9, 0), new THREE.MeshStandardMaterial({ color: 0x5b5952, roughness: 0.8 }), n)
  const trans = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.32, 0.32, 0.8, 10).translate(0.42, POLE_H - 2.2, 0), new THREE.MeshStandardMaterial({ color: 0x7d8380, roughness: 0.6, metalness: 0.3 }), n)
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3()
  P.forEach((o, i) => {
    // 腕木は電線の向き（通りに沿う）に直角
    const alongX = world.spans.some(([a, b]) => (a === o || b === o) && Math.abs(a.cz - b.cz) < 0.1)
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), alongX ? Math.PI / 2 : 0)
    m4.compose(p.set(o.cx, 0, o.cz), q, one)
    pole.setMatrixAt(i, m4); arm.setMatrixAt(i, m4)
    trans.setMatrixAt(i, i % 4 === 0 ? m4 : new THREE.Matrix4().makeScale(0, 0, 0))
  })
  pole.castShadow = true
  scene.add(pole, arm, trans)
  // 電線（たるませる）
  const pts = []
  for (const [a, b] of world.spans) for (const off of [-0.7, 0.7]) {
    const alongX = Math.abs(a.cz - b.cz) < 0.1
    const ox = alongX ? 0 : off, oz = alongX ? off : 0
    const N = 8
    for (let k = 0; k < N; k++) {
      const f0 = k / N, f1 = (k + 1) / N, sag = f => 0.9 * 4 * f * (1 - f)
      pts.push(a.cx + (b.cx - a.cx) * f0 + ox, POLE_H - 0.95 - sag(f0), a.cz + (b.cz - a.cz) * f0 + oz)
      pts.push(a.cx + (b.cx - a.cx) * f1 + ox, POLE_H - 0.95 - sag(f1), a.cz + (b.cz - a.cz) * f1 + oz)
    }
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  scene.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x222222 })))
}
// 遊ぶ範囲の端: 工事用の柵（縞）
{
  const c = document.createElement('canvas'); c.width = 128; c.height = 32
  const x = c.getContext('2d'); x.fillStyle = '#f4c21b'; x.fillRect(0, 0, 128, 32); x.fillStyle = '#1c1c1c'
  for (let i = -2; i < 10; i++) { x.beginPath(); x.moveTo(i * 16, 32); x.lineTo(i * 16 + 8, 32); x.lineTo(i * 16 + 20, 0); x.lineTo(i * 16 + 12, 0); x.fill() }
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.wrapS = THREE.RepeatWrapping
  const mat = new THREE.MeshStandardMaterial({ map: tx, roughness: 0.7 })
  const B = AREA
  const segs = [[B.x0, B.z0, B.x1, B.z0], [B.x1, B.z0, B.x1, B.z1], [B.x1, B.z1, B.x0, B.z1], [B.x0, B.z1, B.x0, B.z0]]
  for (const [ax, az, bx, bz] of segs) {
    const L = Math.hypot(bx - ax, bz - az)
    const t2 = tx.clone(); t2.repeat.set(L / 2.4, 1); t2.needsUpdate = true
    const m = new THREE.Mesh(new THREE.BoxGeometry(L, 0.5, 0.15), new THREE.MeshStandardMaterial({ map: t2, roughness: 0.7 }))
    m.position.set((ax + bx) / 2, 1.0, (az + bz) / 2); m.rotation.y = -Math.atan2(bz - az, bx - ax)
    scene.add(m)
  }
}
// 夜の街灯の明かり（点の光）
const lampPts = (() => {
  const L = world.extraAnchors.filter(o => o.kind === 'lamp'), pos = []
  for (const o of L) pos.push(o.cx, o.y1 - 0.4, o.cz)
  for (const o of world.poles.filter((_, i) => i % 2 === 0)) pos.push(o.cx, POLE_H - 1.6, o.cz)
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  const c = document.createElement('canvas'); c.width = c.height = 64
  const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,236,190,1)'); gr.addColorStop(0.25, 'rgba(255,210,140,.6)'); gr.addColorStop(1, 'rgba(255,200,120,0)')
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64)
  const m = new THREE.PointsMaterial({ size: 3.2, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })
  const p = new THREE.Points(g, m); scene.add(p); return p
})()

// ---------------------------------------------------------------- 風船（まとめて描く）
const HUES = [0xe8423a, 0x2f7fe0, 0xf2a42a, 0x3fb05a, 0xd64aa8, 0x8a5ae0]
const MAXB = 260
const balMat = new THREE.MeshStandardMaterial({ roughness: 0.28, metalness: 0.0, emissive: 0x000000 })
const balGeo = new THREE.SphereGeometry(1, 18, 14).scale(1.05, 1.22, 1.05)
const balMesh = new THREE.InstancedMesh(balGeo, balMat, MAXB); balMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); balMesh.castShadow = true
const knotMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(0.16, 0.26, 8).rotateX(Math.PI), balMat, MAXB)
scene.add(balMesh, knotMesh)
const strGeo = new THREE.BufferGeometry(); strGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(MAXB * 6), 3))
const strLines = new THREE.LineSegments(strGeo, new THREE.LineBasicMaterial({ color: 0xf4f1ea, transparent: true, opacity: 0.75 })); scene.add(strLines)
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _col = new THREE.Color()
function drawBalloons(dt) {
  if (!m) return
  const k = performance.now() / 1000
  let n = 0
  const pos = strGeo.attributes.position.array
  for (const row of m.rows) for (const b of row.items) {
    if (!b.alive || n >= MAXB) continue
    const sc = b.gold ? 1.55 : 1.15, bob = Math.sin(k * 1.3 + b.ph) * 0.35, sway = Math.sin(k * 0.9 + b.ph) * 0.12
    _q.setFromEuler(new THREE.Euler(sway * 0.4, 0, sway))
    _m4.compose(_p.set(b.x, b.y + bob, b.z), _q, _s.set(sc, sc, sc)); balMesh.setMatrixAt(n, _m4)
    _m4.compose(_p.set(b.x, b.y + bob - sc * 1.25, b.z), _q, _s.set(sc, sc, sc)); knotMesh.setMatrixAt(n, _m4)
    _col.setHex(b.gold ? 0xffc93a : b.odd ? 0xf4f1ea : HUES[b.hue]); balMesh.setColorAt(n, _col); knotMesh.setColorAt(n, _col)
    const ty = b.y + bob - sc * 1.35
    pos.set([b.x, ty, b.z, b.x + sway * 2, ty - 3.2, b.z], n * 6)
    n++
  }
  balMesh.count = n; knotMesh.count = n
  balMesh.instanceMatrix.needsUpdate = true; knotMesh.instanceMatrix.needsUpdate = true
  if (balMesh.instanceColor) balMesh.instanceColor.needsUpdate = true
  if (knotMesh.instanceColor) knotMesh.instanceColor.needsUpdate = true
  strGeo.setDrawRange(0, n * 2); strGeo.attributes.position.needsUpdate = true
  window.__balloonsDrawn = n
}

// 自分の色（KayKit の人物を塗る）
const ME_COLOR = { id: 'me', name: ['あなた', 'You'], cloth: '#d8402c', coat: ['#f4f1ea', '#c9c6be'] }
// 風船屋の三兄弟（そろいの縞の前掛け色。長男は濃い紫、次男は緑、三男は水色）
const BRO_COLORS = [{ id: 'b1', cloth: '#6a3fa0', coat: ['#f2d34a', '#b89a2a'] }, { id: 'b2', cloth: '#2f8a52', coat: ['#f2d34a', '#b89a2a'] }, { id: 'b3', cloth: '#3aa7d8', coat: ['#f2d34a', '#b89a2a'] }]
// ワイヤー
const ropes = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 5).rotateX(Math.PI / 2).translate(0, 0, 0.5), new THREE.MeshBasicMaterial({ color: 0x2b2b2b })); m.visible = false; scene.add(m); return m })
// 背中の風船（残り）。三兄弟は手に売り物の風船の束を持つ
const backBal = [0xe8423a, 0x2f7fe0, 0xf2a42a].map(c => { const g = new THREE.Group(); const b = new THREE.Mesh(balGeo, new THREE.MeshStandardMaterial({ color: c, roughness: 0.28 })); b.scale.setScalar(0.24); b.position.y = 0.0; const s = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.7, 4), new THREE.MeshBasicMaterial({ color: 0xf4f1ea })); s.position.y = -0.6; g.add(b, s); scene.add(g); return g })
const broBal = [0, 1, 2].map(() => { const g = new THREE.Group(); HUES.slice(0, 4).forEach((c, k) => { const b = new THREE.Mesh(balGeo, new THREE.MeshStandardMaterial({ color: c, roughness: 0.3 })); b.scale.setScalar(0.32); b.position.set((k % 2 - 0.5) * 0.5, 1.3 + Math.floor(k / 2) * 0.45, 0); g.add(b) }); scene.add(g); return g })
// 狙い（PC の E で掛かる所）
const aimMark = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false }))
aimMark.renderOrder = 5; aimMark.visible = false; scene.add(aimMark)

// ---------------------------------------------------------------- 状態
let mode = 'title'        // title | play | result
let m = null, models = []
let paused = false, dbgPause = false, endAt = 0
let hitStop = 0, fovKick = 0, flashA = 0   // 割った瞬間に少し止める・視野を一瞬動かす・光る
const cam = { hd: 0, pitch: 0.15, userT: -1e9, pos: new THREE.Vector3(), off: new THREE.Vector3(-6, 3, 0), look: new THREE.Vector3(), lookOff: new THREE.Vector3(), fov: 64 }
const _v = new THREE.Vector3(), _w = new THREE.Vector3()
// ワイヤーボタンが向かう風船の目印（輪）
const lockRing = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.14, 6, 36), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false }))
lockRing.renderOrder = 10; lockRing.visible = false; scene.add(lockRing)
const me = () => m && m.players[0]

let bots = []
function newMatch(seed) {
  const b = world.bounds, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2
  const r = createRunner({ id: 'me', spawn: { x: cx, y: 0, z: cz - 40, yaw: 0 } })
  // 三兄弟は少し離れた所から（自分の後ろ・横）
  const cs = [[cx - 70, cz - 110], [cx + 90, cz - 100], [cx, cz + 110]].map(([x, z], i) => createRunner({ id: 'b' + i, spawn: { x, y: 0, z, yaw: Math.atan2(cx - x, cz - 40 - z) } }))
  m = createGame(world, r, seed, cs)
  m.players = [{ i: 0, r }, ...m.chasers.map(c => ({ i: c.i + 1, r: c.r, c }))]
  bots = BAL.skill.map((s, i) => createChaser(s, seed * 7 + i))
  if (models.length !== 4) rebuildModels()
}
function rebuildModels() {
  for (const md of models) { scene.remove(md.group); md.dispose() }
  models = [ME_COLOR, ...BRO_COLORS].map(c => { const md = charAssets.ready ? new CharRunnerModel(c) : new RunnerModel(); scene.add(md.group); return md })
}
loadCharAssets().then(() => { if (charAssets.ready && models.length && !(models[0] instanceof CharRunnerModel)) rebuildModels() })

// ---------------------------------------------------------------- 入力
const keys = new Set()
const press = { jump: false }
let pendingWire = null
addEventListener('keydown', e => {
  if (mode !== 'play') return
  if (e.repeat) return
  keys.add(e.code)
  if (e.code === 'KeyE') pendingWire = { at: null, key: true }
  if (e.code === 'Space') { press.jump = true; e.preventDefault() }
  if (e.code === 'Escape' || e.code === 'KeyP') setPause(!paused)
})
addEventListener('keyup', e => keys.delete(e.code))
const gest = new Map()
// スワイプで見回す感度（2026-11-03 本人「ほんとにちょっとだけ高く」で約1.2倍: 0.006→0.0072 / 0.004→0.0048。ワイヤー系全部）
const LOOK = { yaw: 0.0072, pitch: 0.0048 }
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
renderer.domElement.addEventListener('pointerdown', e => {
  Snd.init()
  if (mode !== 'play' || paused) return
  gest.set(e.pointerId, { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), moved: false })
})
addEventListener('pointermove', e => {
  const g = gest.get(e.pointerId); if (!g) return
  const dx = e.clientX - g.lx, dy = e.clientY - g.ly; g.lx = e.clientX; g.ly = e.clientY
  if (!g.moved && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 12) g.moved = true
  if (!g.moved) return
  cam.hd -= dx * LOOK.yaw; cam.pitch = Math.max(-0.35, Math.min(1, cam.pitch + dy * LOOK.pitch)); cam.userT = performance.now()
})
addEventListener('pointerup', e => {
  const g = gest.get(e.pointerId); if (!g) return
  gest.delete(e.pointerId)
  if (!g.moved && performance.now() - g.t < 450 && mode === 'play' && !paused) aimAt(e.clientX, e.clientY)
})
addEventListener('pointercancel', e => gest.delete(e.pointerId))
// タップした所: 建物・電柱に当たればそこ（建物を優先）。当たった所が床（道・屋上）で自分より下なら地面ワイヤー、
// 何にも当たらなければ道の面（高さ0）を見る。地面ワイヤーになるのは画面の地面をタップした時だけ（ボタン・自動の狙いでは絶対に掛けない）
function tapTarget(o, d) {
  const h = rayHit(world, o.x, o.y, o.z, d.x, d.y, d.z, 400)
  const r = me() && me().r
  if (h) {
    if (!h.pole && r && h.y < r.y - 0.5 && Math.abs(floorAt(world, h.x, h.z, h.y + 0.2).h - h.y) < 0.15) return { ...h, ground: true }
    return h
  }
  if (d.y < -0.02) { const t = -o.y / d.y; if (t > 0 && t < 400) return { x: o.x + d.x * t, y: 0, z: o.z + d.z * t, ground: true } }
  return null
}
function aimAt(cx, cy) {
  const rc = renderer.domElement.getBoundingClientRect()
  ndc.set((cx - rc.left) / rc.width * 2 - 1, -((cy - rc.top) / rc.height) * 2 + 1)
  ray.setFromCamera(ndc, camera)
  const o = ray.ray.origin, d = ray.ray.direction
  // ワイヤー中でも狙った所があれば掛け直す（つなぎ）。何も無い所なら外すだけ
  pendingWire = { at: tapTarget(o, d), sx: cx, sy: cy }
}
const stick = { x: 0, y: 0, id: null }
{
  // 左スティックは左下に固定（2026-11-03 本人「左スティックは固定で」）。触った所に動かない
  const zone = $('stickZone'), el = $('stick'), knob = el.querySelector('.knob')
  let ox = 0, oy = 0
  const R = () => el.getBoundingClientRect().width / 2
  const upd = e => {
    let dx = (e.clientX - ox) / R(), dy = (e.clientY - oy) / R()
    const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l }
    stick.x = dx; stick.y = dy; knob.style.transform = `translate(${dx * 36}px,${dy * 36}px)`
  }
  zone.addEventListener('pointerdown', e => {
    Snd.init(); if (stick.id != null) return
    stick.id = e.pointerId; try { zone.setPointerCapture(e.pointerId) } catch (er) {}
    // 左下に固定したスティック: 触った所に動かさず、円の真ん中からの向きで倒す
    const sr = el.getBoundingClientRect(); ox = sr.left + sr.width / 2; oy = sr.top + sr.height / 2
    if (Math.hypot(e.clientX - ox, e.clientY - oy) > sr.width / 2 + 70) { stick.id = null; return }   // 円の少し外まで
    el.classList.add('held'); upd(e)
  })
  zone.addEventListener('pointermove', e => { if (e.pointerId === stick.id) upd(e) })
  const end = e => { if (e.pointerId !== stick.id) return; stick.id = null; stick.x = stick.y = 0; knob.style.transform = ''; el.classList.remove('held') }
  zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end)
  // 大きいボタン: 前の上へ自動でワイヤー（相手は追わない）。ワイヤー中なら離す、壁に張り付き中なら壁から離れる。跳ぶボタンは無い（2026-11-02 本人）
  for (const b of document.querySelectorAll('.tbtn')) b.addEventListener('pointerdown', e => { e.preventDefault(); Snd.init(); if (b.dataset.k === 'wire') pendingWire = { at: null, key: true } })
}
function gather(r) {
  let thr = 0, brk = 0, steer = 0, cx = 0, cy = 0
  if (keys.has('KeyW') || keys.has('ArrowUp')) { thr = 1; cy += 1 }
  if (keys.has('KeyS') || keys.has('ArrowDown')) { brk = 1; cy -= 1 }
  if (keys.has('KeyA') || keys.has('ArrowLeft')) { steer -= 1; cx -= 1 }
  if (keys.has('KeyD') || keys.has('ArrowRight')) { steer += 1; cx += 1 }
  // 画面の右と前（カメラの実際の向きから取る。cam.hd の計算に頼らない）
  const e = camera.matrixWorld.elements
  let rgx = e[0], rgz = e[2], fwx = -e[8], fwz = -e[10]
  { const l1 = Math.hypot(rgx, rgz) || 1, l2 = Math.hypot(fwx, fwz) || 1; rgx /= l1; rgz /= l1; fwx /= l2; fwz /= l2 }
  let moveDir = null
  if (stick.id != null) {
    const mag = Math.min(1, Math.hypot(stick.x, stick.y))
    if (mag > 0.15) {
      // 倒した向き（画面から見て）へ動く。少し倒すだけで全力
      const dx = rgx * stick.x - fwx * stick.y, dz = rgz * stick.x - fwz * stick.y, l = Math.hypot(dx, dz) || 1
      moveDir = { x: dx / l, z: dz / l }
      thr = Math.max(thr, Math.min(1, mag * 1.3)); steer = 0
      cy = -stick.y; cx = stick.x
    }
  }
  const inp = { throttle: thr, brake: brk, steer, jump: press.jump, wire: false, moveDir }
  // ワイヤーボタンの自動狙い: 届く距離に風船があればその上の掛け点へ（輪の出ている風船）。無ければスティックの向き、スマホでは画面の前
  const lt = m && mode === 'play' ? lockTarget(m, r, { x: fwx, z: fwz }) : null
  inp.wireYaw = lt ? Math.atan2(lt.x - r.x, lt.z - r.z) : moveDir ? Math.atan2(moveDir.x, moveDir.z) : touchMode ? Math.atan2(fwx, fwz) : undefined
  // 壁: スティックの上下＝上下、左右＝画面の左右（カメラから見て）
  if (r.climbing) {
    const cl = r.climbing, tx = -cl.nz, tz = cl.nx
    const side = Math.sign(rgx * tx + rgz * tz) || 1   // 画面の右と壁沿いの向きをそろえる（カメラの実際の向きから）
    inp.climbY = Math.abs(cy) > 0.25 ? Math.sign(cy) * Math.min(1, Math.abs(cy) * 1.3) : 0
    inp.climbX = Math.abs(cx) > 0.25 ? Math.sign(cx) * Math.min(1, Math.abs(cx) * 1.3) * side : 0
  }
  if (pendingWire) { inp.wire = true; if (pendingWire.at) inp.wireAt = pendingWire.at; r._tap = pendingWire; pendingWire = null }
  press.jump = false
  return inp
}

// ---------------------------------------------------------------- 画面の切り替え
function show(id) { for (const s of ['title', 'how', 'pause', 'result']) $(s).classList.toggle('hidden', s !== id); $('hud').classList.toggle('hidden', mode !== 'play') }
function toTitle() {
  mode = 'title'; paused = false
  newMatch(Math.floor(Math.random() * 1e6))
  cam.hd = 0; show('title'); $('touch').classList.add('hidden')
  Snd.loop('bgm', 'snd/bgm_title.mp3', 0.2); Snd.loop('amb', 'snd/city_street_loop.wav', 0.22); Snd.loop('wind', null)
}
let hints = []
function startMatch(seed = Math.floor(Math.random() * 1e6)) {
  Snd.init(); sfx('click')
  mode = 'play'; paused = false; endAt = 0; warned = {}; photo = null
  newMatch(seed); m.seed = seed
  cam.hd = me().r.yaw; cam.pitch = 0.15; cam.userT = -1e9
  show(null); $('touch').classList.toggle('hidden', !touchMode)
  Snd.loop('bgm', 'snd/bgm_play.mp3', 0.15); Snd.loop('amb', 'snd/city_street_loop.wav', 0.26); Snd.loop('wind', 'snd/wind_loop.wav', 0.0001)
  const seen = store.get('bp.tut') === '1'
  hints = seen ? [[1.0, touchMode ? 'hint1' : 'hint1Pc']] : [[1.0, touchMode ? 'hint1' : 'hint1Pc'], [7, 'hint2'], [16, 'hint3']]
  store.set('bp.tut', '1')
}
let warned = {}
function setPause(p) { if (mode !== 'play') return; paused = p; $('pause').classList.toggle('hidden', !p) }

// ---------------------------------------------------------------- 画面の文字
let sayT = 0
function say(html, sec = 1.8, cls = '') { const el = $('say'); el.className = 'say ' + cls; el.innerHTML = html; sayT = sec }
function fmt(s) { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
let lastHud = ''
function updateHud(dt) {
  const key = m.score + '|' + m.popped + '|' + m.combo
  if (key !== lastHud) {
    lastHud = key
    $('score').textContent = m.score
    $('popN').textContent = m.popped
    $('combo').classList.toggle('hidden', m.combo < 2)
    $('comboN').textContent = m.combo
  }
  $('comboBar').style.transform = `scaleX(${m.combo >= 2 ? Math.max(0, m.comboT / BAL.comboSec).toFixed(3) : 0})`
  $('clockT').textContent = fmt(BAL.sec - m.t)
  $('clockHand').setAttribute('transform', `rotate(${(m.t / BAL.sec) * 360} 20 20)`)
  broArrow()
  const lv = $('lives'); if (lv.dataset.n !== String(m.lives)) { lv.dataset.n = m.lives; lv.querySelectorAll('i').forEach((el, j) => el.classList.toggle('gone', j >= m.lives)) }
  if (sayT > 0) { sayT -= dt; $('say').classList.toggle('hidden', sayT <= 0) }
  // ワイヤーボタンが向かう風船に輪。見えていない時は矢印
  const r = me().r
  const lt = lockTarget(m, r, fwdOf())
  lockRing.visible = !!lt
  if (lt) { const k = performance.now() / 1000; lockRing.position.set(lt.x, lt.y, lt.z); lockRing.material.color.set(lt.gold ? 0xffd34a : 0xffffff); lockRing.rotation.set(0, 0, k * 2); lockRing.lookAt(camera.position); lockRing.scale.setScalar(1 + Math.sin(k * 6) * 0.08) }
  let goal = lt
  if (!goal) { let gd = 1e9; for (const b of alive(m)) { const d = Math.hypot(b.x - r.x, b.z - r.z) - (b.gold ? 30 : 0); if (d < gd) { gd = d; goal = b } } }
  const ar = $('arrow')
  if (!goal) { ar.classList.add('hidden'); return }
  if (onScreen(goal.x, goal.y, goal.z)) { ar.classList.add('hidden'); return }   // 見えている時は輪だけ
  ar.classList.remove('hidden'); ar.style.setProperty('--c', goal.gold ? '#ffd34a' : '#fff')
  $('arrowD').textContent = Math.round(Math.hypot(goal.x - r.x, goal.z - r.z)) + 'm'
  placeCompass(ar, compassAngle(goal.x, goal.z, r))
}
// 矢印は方角だけ（2026-11-03 本人「高さを表すと分かりづらい。方角だけでいい」）: カメラの前を上として、目標の水平の向きへ回す。画面の上の真ん中に固定
function compassAngle(tx, tz, r) {
  const e = camera.matrixWorld.elements
  let rx = e[0], rz = e[2], fx = -e[8], fz = -e[10]; const a = Math.hypot(rx, rz) || 1, b = Math.hypot(fx, fz) || 1; rx /= a; rz /= a; fx /= b; fz /= b
  const dx = tx - r.x, dz = tz - r.z
  return Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz)
}
function onScreen(x, y, z) { const p = _v.set(x, y, z).project(camera), W = innerWidth, H = innerHeight; const sx = (p.x * 0.5 + 0.5) * W, sy = (-p.y * 0.5 + 0.5) * H; return p.z < 1 && sx > 30 && sx < W - 30 && sy > 70 && sy < H - 30 }
function placeCompass(el, ang) { el.style.left = '50%'; el.style.top = ''; el.querySelector('svg').style.transform = `rotate(${ang}rad)`; window.__compass = window.__compass || {}; window.__compass[el.id] = ang }

// 一番近い兄弟の向きと距離（画面の外なら赤い矢印。見えていれば頭の上に小さく）
function broArrow() {
  const el = $('broArrow'), nc = nearestChaser(m)
  if (!nc || nc.d > 70 || nc.c.stun > 0) { el.classList.add('hidden'); return }
  el.classList.remove('hidden'); $('broD').textContent = Math.round(nc.d) + 'm'
  el.classList.toggle('close', nc.d < 18)
  placeCompass(el, compassAngle(nc.c.r.x, nc.c.r.z, m.me))   // 兄弟は画面の下の真ん中（後ろから来ることが多い）
}
function fwdOf() { const e = camera.matrixWorld.elements, x = -e[8], z = -e[10], l = Math.hypot(x, z) || 1; return { x: x / l, z: z / l } }

// ---------------------------------------------------------------- 出来事
const log = []
function onRunnerEvent(e) {
  log.push({ src: 'r', ...e, at: +m.t.toFixed(2) })
  if (e.t === 'wire') { sfx('wire', { vol: 0.7 }); sfx('hook', { vol: 0.5, delay: 0.06 }); if (e.ground) fovKick = 6 }   // 地面に掛けた瞬間はぐっと引かれる
  else if (e.t === 'wireMiss') {
    sfx('wire', { vol: 0.4, rate: 1.3 })
    const tp = me().r._tap
    if (e.far && tp && tp.sx != null) { const el = $('miss'); el.style.left = tp.sx + 'px'; el.style.top = tp.sy + 'px'; el.classList.remove('hidden'); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; clearTimeout(el._t); el._t = setTimeout(() => el.classList.add('hidden'), 800) }
  } else if (e.t === 'land') { sfx('land', { vol: Math.min(1, 0.3 + e.impact / 20) }); if (e.impact > 14) { sfx('bonk', { vol: 0.5 }); fx.addShake(Math.min(0.6, e.impact / 40)) } }
  else if (e.t === 'bonk') { sfx('bonk', { vol: 0.8 }); fx.addShake(0.4) }
  else if (e.t === 'unwire' && e.ground) { sfx('whoosh', { vol: e.high ? 0.7 : 0.45, rate: 1.05 }); fovKick = e.high ? 7 : 4 }   // 地面ワイヤーが外れる（高い所なら跳ねる、床の近くならそのまま着地）
  else if (e.t === 'unwire' && !e.auto) { const r = me().r, v = Math.hypot(r.vx, r.vy, r.vz); if (v > 16) { sfx('whoosh', { vol: Math.min(0.8, v / 50), rate: 0.9 + Math.random() * 0.2 }); fovKick = Math.min(6, (v - 16) * 0.3) } }   // 速く離すと風を切る
}
function onGameEvent(e) {
  log.push({ src: 'm', ...e, at: +m.t.toFixed(2) })
  if (e.t === 'pop') {
    const col = e.gold ? 0xffd34a : HUES[e.hue]
    // 割れる音: コンボが続くほど少しずつ高く（気持ちよく上がっていく）
    sfx('pop', { vol: e.gold ? 1 : 0.85, rate: Math.min(1.6, 0.92 + e.combo * 0.025) })
    fx.debrisAt(e.x, e.y, e.z, e.gold ? 26 : 14, col, { speed: e.gold ? 11 : 8, up: 4, size: e.gold ? 0.16 : 0.12 })
    fx.flash && fx.flash(e.x, e.y, e.z)
    hitStop = e.gold ? 0.07 : 0.025; fovKick = Math.max(fovKick - (e.gold ? 5 : 1.5), -8); fx.addShake(e.gold ? 0.45 : 0.12)
    if (e.gold) { sfx('ding', { vol: 0.7, delay: 0.05 }); sfx('pick', { vol: 0.6, delay: 0.1 }); flashA = 1; say(t('gold'), 1.2, 'good') }
    else if (e.odd) { const L = t('odd'); say('<small>下から声</small>' + L[e.line % L.length], 2.0, 'small') }
    floatPts(e)
    if (e.combo > 0 && e.combo % 10 === 0) { say(t('comboN')(e.combo), 1.4, 'big'); sfx('clap', { vol: 0.35 }) }
    comboBump()
  } else if (e.t === 'comboEnd') { if (e.n >= 5) say(t('comboEnd')(e.n), 1.2, 'small') }
  else if (e.t === 'wake') { say(t('wake')[e.who], 2.2, 'bad'); sfx('caught', { vol: 0.5 }) }
  else if (e.t === 'caught') {
    sfx('myPop', { vol: 1 }); sfx('pop', { vol: 1, rate: 0.75, delay: 0.03 }); sfx('caught', { vol: 0.8, delay: 0.12 })
    fx.debrisAt(e.x, e.y, e.z, 18, [0xe8423a, 0x2f7fe0, 0xf2a42a][e.lives] || 0xe8423a, { speed: 8, up: 4, size: 0.12 })
    fx.addShake(0.7); hitStop = 0.12; fovKick = 6; flashA = 1
    const L = t('caughtL')[e.who]; say(`<small>${t('bros')[e.who]}</small>` + L[Math.floor(Math.random() * L.length)] + (e.lives === 1 ? `<br><b>${t('lastOne')}</b>` : ''), 1.8, 'bad')
  }
  else if (e.t === 'life') { say(t('life'), 1.4, 'good'); sfx('ding', { vol: 0.6 }) }
  else if (e.t === 'end') { sfx('whoosh'); if (e.timeUp) { say(t('escaped')(e.lives, e.bonus), 2.2, 'big good'); sfx('clap', { vol: 0.5 }) } else say(t('downEnd'), 1.8, 'big'); endAt = e.timeUp ? 2.2 : 1.8 }
}
// 割った所に点数を浮かべる
function floatPts(e) {
  const p = _v.set(e.x, e.y, e.z).project(camera); if (p.z > 1) return
  const el = document.createElement('div'); el.className = 'pts' + (e.gold ? ' gold' : '')
  el.textContent = '+' + e.pts
  el.style.left = ((p.x * 0.5 + 0.5) * innerWidth) + 'px'; el.style.top = ((-p.y * 0.5 + 0.5) * innerHeight) + 'px'
  $('hud').appendChild(el); setTimeout(() => el.remove(), 900)
}
function comboBump() { const el = $('combo'); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump') }

// ---------------------------------------------------------------- 結果
let photo = null
function showResult() {
  mode = 'result'
  Snd.loop('wind', null); Snd.loop('bgm', null)
  const rk = rankOf(m.score)
  drawResult($('podium'), rk)
  const R = T[lang]
  $('rankBig').textContent = R.titles[rk]
  $('rankBig').className = 'rank-big r' + (4 - rk)
  const air = Math.round(m.airT / Math.max(1, m.t) * 100)
  $('stats').innerHTML = `<span>${m.escaped ? R.statEscaped : R.statTime} <b>${Math.floor(Math.min(m.t, BAL.sec))}${lang === 'ja' ? '秒' : 's'}</b></span><span>${R.statPop} <b>${m.popped}</b></span><span>${R.statCombo} <b>${m.bestCombo}</b></span>`
  $('verdict').textContent = R.verdict[rk]
  sfx(rk >= 3 ? 'win' : rk === 2 ? 'mid' : rk === 1 ? 'meh' : 'lose', { vol: 0.8 })
  if (rk >= 2) sfx('clap', { vol: 0.6, delay: 0.4 })
  $('btnPost').href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(t('postText')(m.popped, m.bestCombo, m.score, Math.floor(m.t))) + '&url=' + encodeURIComponent(URL_)
  $('touch').classList.add('hidden')
  show('result')
  $('result').classList.remove('play'); void $('result').offsetWidth; $('result').classList.add('play')
  window.__lastScore = m.score
}
// 結果の絵（保存用の画像も同じ）: 夜の街に風船の数とコンボ
function drawResult(cv, rk) {
  const W = 720, H = 560
  cv.width = W; cv.height = H
  const x = cv.getContext('2d')
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0f1630'); g.addColorStop(0.6, '#2b2d52'); g.addColorStop(1, '#4a3a4e'); x.fillStyle = g; x.fillRect(0, 0, W, H)
  if (photo) { x.globalAlpha = 0.35; const k = Math.max(W / photo.width, H / photo.height); x.drawImage(photo, (W - photo.width * k) / 2, (H - photo.height * k) / 2, photo.width * k, photo.height * k); x.globalAlpha = 1 }
  let s = 5; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
  x.fillStyle = 'rgba(16,20,36,.85)'
  for (let i = 0; i < 18; i++) { const bw = 30 + rnd() * 50, bh = 60 + rnd() * 160; x.fillRect(i * 42 - 10, H - 80 - bh, bw, bh + 80) }
  x.fillStyle = 'rgba(255,214,140,.5)'
  for (let i = 0; i < 140; i++) x.fillRect(rnd() * W, H - 80 - rnd() * 200, 3, 4)
  // 割った数だけ風船（最大60個）を空に散らす
  const n = Math.min(60, m.popped)
  for (let i = 0; i < n; i++) {
    const bx = 40 + rnd() * (W - 80), by = 120 + rnd() * 220, r = 13 + rnd() * 6, col = '#' + HUES[i % HUES.length].toString(16).padStart(6, '0')
    x.strokeStyle = 'rgba(255,255,255,.45)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(bx, by + r * 1.15); x.quadraticCurveTo(bx + 6, by + r * 2, bx, by + r * 2.8); x.stroke()
    x.fillStyle = col; x.beginPath(); x.ellipse(bx, by, r, r * 1.15, 0, 0, Math.PI * 2); x.fill()
    x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.ellipse(bx - r * 0.35, by - r * 0.4, r * 0.22, r * 0.32, -0.5, 0, Math.PI * 2); x.fill()
  }
  const font = '"Zen Kaku Gothic New", sans-serif'
  x.textAlign = 'center'
  x.fillStyle = '#fff'; x.font = `900 92px ${font}`; x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 12
  x.fillText(String(m.score), W / 2, 112)
  x.font = `700 24px ${font}`; x.fillText(T[lang].ptsUnit, W / 2, 146)
  x.shadowBlur = 0
  x.font = `900 34px ${font}`; x.fillStyle = '#ffd34a'
  x.fillText(T[lang].resLine(m.popped, m.bestCombo, Math.floor(m.t)), W / 2, H - 52)
  x.font = `700 20px ${font}`; x.fillStyle = 'rgba(255,255,255,.85)'; x.fillText(T[lang].broLine, W / 2, H - 20)
  x.font = `700 18px ${font}`; x.fillStyle = 'rgba(255,255,255,.7)'
  x.textAlign = 'left'; x.fillText(T[lang].logo, 18, 30)
  x.textAlign = 'right'; x.fillText('tom3games.github.io/balloon-pop', W - 18, 30)
}
$('btnSave').onclick = () => { $('podium').toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'balloon-pop-result.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000) }) }
$('btnStart').onclick = () => startMatch()
$('btnAgain').onclick = () => startMatch()
$('btnTitle').onclick = () => toTitle()
$('btnHow').onclick = () => { Snd.init(); show('how') }
for (const b of document.querySelectorAll('[data-close]')) b.onclick = () => show('title')
$('btnLang').onclick = () => { lang = lang === 'ja' ? 'en' : 'ja'; store.set('bp.lang', lang); applyLang() }
$('btnMute').onclick = () => { Snd.init(); Snd.setMute(!Snd.muted); store.set('bp.mute', Snd.muted ? '1' : '0'); applyLang() }
$('btnPause').onclick = () => setPause(true)
$('btnResume').onclick = () => setPause(false)
$('btnQuit').onclick = () => { setPause(false); toTitle() }

// ---------------------------------------------------------------- カメラ
const lerpAngle = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * k }
function updateCamera(dt, c, md) {
  if (window.__freeze) return
  const pos = md.group.position
  const v = Math.hypot(c.vx, c.vz)
  let hx = Math.sin(c.yaw), hz = Math.cos(c.yaw)
  if (v > 8 && !c.climbing) { const k = c.grounded ? 0.25 : 0.45; hx = hx * (1 - k) + (c.vx / v) * k; hz = hz * (1 - k) + (c.vz / v) * k; const l = Math.hypot(hx, hz); hx /= l; hz /= l }
  const manual = touchMode || performance.now() - cam.userT < 1800   // スマホはカメラが勝手に追いかけない（空中出前と同じ）
  if (!manual) { cam.hd = lerpAngle(cam.hd, Math.atan2(hx, hz), 1 - Math.exp(-dt * (touchMode ? 2.2 : 5))); cam.pitch += ((c.climbing ? 0.35 : 0.15) - cam.pitch) * (1 - Math.exp(-dt * 1.5)) }
  hx = Math.sin(cam.hd); hz = Math.cos(cam.hd)
  let back = 5.2 + Math.min(2.4, v * 0.07), up = 2.1
  if (camera.aspect < 1) { back += 0.6; up += 0.5 }
  up += cam.pitch * 4.2; back *= 1 - Math.max(0, cam.pitch) * 0.15
  let tx = pos.x - hx * back, tz = pos.z - hz * back, ty = pos.y + up
  for (let i = 1; i <= 6; i++) {
    const f = i / 6, px = pos.x + (tx - pos.x) * f, pz = pos.z + (tz - pos.z) * f, py = pos.y + (ty - pos.y) * f
    let hit = false
    for (const o of world.nearby(px, pz)) {
      if (o.slab || o.kind === 'bound' || o.y0 == null || py < o.y0 || py > o.y1) continue
      const cs = Math.cos(o.yaw || 0), sn = Math.sin(o.yaw || 0), dx = px - o.cx, dz = pz - o.cz
      if (Math.abs(dx * cs - dz * sn) < o.hw + 0.4 && Math.abs(dx * sn + dz * cs) < o.hl + 0.4) { hit = true; break }
    }
    if (hit) { const ff = Math.max(0.25, (i - 1) / 6); tx = pos.x + (tx - pos.x) * ff; tz = pos.z + (tz - pos.z) * ff; ty = pos.y + up * 0.8 + (1 - ff) * 2; break }
  }
  const gy = world.groundAt(tx, tz, ty).h + 0.8
  if (ty < gy) ty = gy
  cam.off.lerp(_v.set(tx - pos.x, ty - pos.y, tz - pos.z), 1 - Math.exp(-dt * 10))
  cam.pos.set(pos.x + cam.off.x, pos.y + cam.off.y, pos.z + cam.off.z)
  cam.lookOff.lerp(_v.set(hx * 10, (camera.aspect < 1 ? 0.4 : 1.1) + 1.3 - cam.pitch * 1.2, hz * 10), 1 - Math.exp(-dt * 12))
  cam.look.set(pos.x + cam.lookOff.x, pos.y + cam.lookOff.y, pos.z + cam.lookOff.z)
  camera.position.copy(cam.pos)
  const sh_ = fx.shake
  if (sh_ > 0) camera.position.add(_v.set((Math.random() - 0.5) * sh_, (Math.random() - 0.5) * sh_ * 0.7, (Math.random() - 0.5) * sh_))
  camera.lookAt(cam.look)
  const asp = camera.aspect
  const base = asp >= 1 ? 60 : Math.min(84, 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(37)) / asp) * 180 / Math.PI)
  const fov = base + Math.min(18, Math.max(0, Math.hypot(c.vx, c.vy, c.vz) - 6) * 0.5)   // 速いほど広く（12→18）
  cam.fov += (fov - cam.fov) * (1 - Math.exp(-dt * 4))
  fovKick *= Math.exp(-dt * 6)
  camera.fov = cam.fov + fovKick; camera.updateProjectionMatrix()
  // 振り子の向きに少しだけ体ごと傾く（横へ流れる速さから）
  const me_ = camera.matrixWorld.elements, rl = Math.hypot(me_[0], me_[2]) || 1, lat = (c.vx * me_[0] + c.vz * me_[2]) / rl   // 画面の右向きの速さ
  cam.bank = (cam.bank || 0) + (Math.max(-0.1, Math.min(0.1, (c.rope ? lat : 0) * -0.004)) - (cam.bank || 0)) * (1 - Math.exp(-dt * 3))
  camera.rotateZ(cam.bank)
}

// ---------------------------------------------------------------- 昼→夕方→夜
const C = (h) => new THREE.Color(h)
const KEYS = [
  { f: 0, sun: C(0xfff1dc), si: 3.0, hemiS: C(0xc4d8ff), hi: 0.4, fog: C(0xc9d6e2), bg: 1.0, env: 1.0, exp: 1.0, win: 1, lamp: 0 },
  { f: 0.5, sun: C(0xffb070), si: 2.2, hemiS: C(0xffc7a0), hi: 0.45, fog: C(0xe0a888), bg: 0.75, env: 0.8, exp: 1.0, win: 1.6, lamp: 0.2 },
  { f: 0.75, sun: C(0xff7a48), si: 1.1, hemiS: C(0x9a7aa8), hi: 0.45, fog: C(0x8a6a86), bg: 0.42, env: 0.5, exp: 1.08, win: 3.0, lamp: 0.7 },
  { f: 1, sun: C(0x6f86c8), si: 0.35, hemiS: C(0x4a5a90), hi: 0.6, fog: C(0x232a48), bg: 0.18, env: 0.32, exp: 1.2, win: 4.2, lamp: 1 }
]
const _c1 = new THREE.Color()
function setTime(f) {
  let a = KEYS[0], b = KEYS[KEYS.length - 1]
  for (let i = 0; i < KEYS.length - 1; i++) if (f >= KEYS[i].f && f <= KEYS[i + 1].f) { a = KEYS[i]; b = KEYS[i + 1]; break }
  const k = (f - a.f) / Math.max(1e-6, b.f - a.f), L = (p, q) => p + (q - p) * k
  sun.color.copy(a.sun).lerp(b.sun, k); sun.intensity = L(a.si, b.si)
  hemi.color.copy(a.hemiS).lerp(b.hemiS, k); if (skyReady) hemi.intensity = L(a.hi, b.hi)
  scene.fog.color.copy(a.fog).lerp(b.fog, k)
  if (skyReady) { scene.backgroundIntensity = L(a.bg, b.bg); scene.environmentIntensity = L(a.env, b.env) }
  else if (scene.background && scene.background.isColor) scene.background.copy(_c1.copy(a.fog).lerp(b.fog, k))
  renderer.toneMappingExposure = L(a.exp, b.exp)
  const w = L(a.win, b.win); for (const g of glowMats) g.m.emissiveIntensity = g.base * w
  lampPts.material.opacity = L(a.lamp, b.lamp)
  window.__timeF = f
}

// ---------------------------------------------------------------- ループ
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); fx.setScale && fx.setScale(h) }
addEventListener('resize', resize); resize()
let last = performance.now(), acc = 0, frameN = 0, snapAt = 0
function stepOnce() {
  if (!m || mode === 'result') return
  if (mode === 'play' && (paused || m.over)) return
  const r = me().r
  r.events.length = 0
  if (mode === 'play') {
    stepRunner(r, gather(r), STEP, world)
    for (const e of r.events) onRunnerEvent(e)
    m.chasers.forEach((c, i) => { c.r.events.length = 0; stepRunner(c.r, chaserInput(bots[i], c, r, world, STEP), STEP, world) })
    stepGame(m, STEP)
    for (const e of m.events) onGameEvent(e)
  } else {
    m.chasers.forEach(c => { c.r.events.length = 0; stepRunner(c.r, {}, STEP, world) })
    stepRunner(r, {}, STEP, world)
    m.t += STEP; drawBalloons.t = m.t
  }
  m.events.length = 0
}
function frame() {
  requestAnimationFrame(frame)
  const now = performance.now()
  let dt = Math.min(0.1, (now - last) / 1000); last = now
  if (hitStop > 0) { hitStop -= dt; acc = 0 }   // ヒットストップ: ほんの一瞬だけ止める
  else if (!dbgPause) { acc += dt; let n = 0; while (acc >= STEP && n < 6) { stepOnce(); acc -= STEP; n++ } if (n >= 6) acc = 0 }
  else dt = 0
  render(dt || 0.016)
}
// 速さの線: 画面のふちから中心へ流れる白い線。速いほど多く濃く（20m/s から）
const spd = document.getElementById('speedfx'), sctx = spd.getContext('2d'), hf = document.getElementById('hitflash')
const lines = Array.from({ length: 46 }, () => ({ a: Math.random() * Math.PI * 2, p: Math.random(), s: 0.6 + Math.random() * 0.8, w: 1 + Math.random() * 2 }))
let spdOn = false
function drawSpeed(v, dt) {
  flashA = Math.max(0, flashA - dt * 5); hf.style.opacity = flashA.toFixed(2)
  const k = Math.max(0, Math.min(1, (v - 20) / 18))
  window.__speedK = k
  if (k <= 0) { if (spdOn) { sctx.clearRect(0, 0, spd.width, spd.height); spdOn = false } return }
  spdOn = true
  const W = innerWidth, H = innerHeight, dpr = Math.min(2, devicePixelRatio || 1)
  if (spd.width !== Math.round(W * dpr) || spd.height !== Math.round(H * dpr)) { spd.width = Math.round(W * dpr); spd.height = Math.round(H * dpr) }
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0); sctx.clearRect(0, 0, W, H)
  const cx = W / 2, cy = H * 0.45, R = Math.hypot(W, H) * 0.55
  sctx.lineCap = 'round'
  const n = Math.round(lines.length * (0.35 + 0.65 * k))
  for (let i = 0; i < n; i++) {
    const L = lines[i]
    L.p += dt * L.s * (1.6 + k * 2.4); if (L.p > 1) { L.p -= 1; L.a = Math.random() * Math.PI * 2 }
    const r1 = R * (1.05 - L.p * 0.45), r0 = r1 - R * (0.12 + 0.2 * k) * L.s
    const ca = Math.cos(L.a), sa = Math.sin(L.a)
    sctx.strokeStyle = `rgba(255,255,255,${(0.1 + 0.32 * k) * Math.min(1, L.p * 4)})`; sctx.lineWidth = L.w
    sctx.beginPath(); sctx.moveTo(cx + ca * r0, cy + sa * r0); sctx.lineTo(cx + ca * r1, cy + sa * r1); sctx.stroke()
  }
}
function render(dt) {
  if (!m) return
  const p0 = me(), md = models[0]
  m.players.forEach((p, i) => {
    const mm = models[i]; if (!mm) return
    mm.tails = 0; mm.glow = false
    mm.update(p.r, dt)
    const rp = ropes[i]
    if (p.r.rope) { const h = mm.handWorld && mm.handWorld.lengthSq() ? mm.handWorld : _v.set(p.r.x, p.r.y + 1.4, p.r.z); rp.visible = true; rp.position.copy(h); rp.lookAt(p.r.rope.x, p.r.rope.y, p.r.rope.z); rp.scale.set(1, 1, Math.max(0.1, h.distanceTo(_w.set(p.r.rope.x, p.r.rope.y, p.r.rope.z)))) }
    else rp.visible = false
    if (i === 0) mm.group.visible = !(m.immune > 0 && Math.floor(performance.now() / 90) % 2 === 0)   // 捕まった直後は点滅
    else { const g = broBal[i - 1]; g.position.set(p.r.x - Math.sin(p.r.yaw) * 0.5, p.r.y + 1.2, p.r.z - Math.cos(p.r.yaw) * 0.5); g.rotation.y = p.r.yaw; g.visible = true }
  })
  // 背中の風船（残りの数だけ）。体の後ろにひもで浮かぶ
  { const r = p0.r, k = performance.now() / 1000, bx = -Math.sin(r.yaw), bz = -Math.cos(r.yaw)
    backBal.forEach((g, j) => { g.visible = j < m.lives && mode !== 'result'; g.position.set(r.x - bx * 0.1 + Math.cos(r.yaw) * (j - 1) * 0.36, r.y + 2.25 + Math.sin(k * 2 + j) * 0.08 + (j === 1 ? 0.18 : 0), r.z - bz * 0.1 - Math.sin(r.yaw) * (j - 1) * 0.36) }) }   // 頭の上（カメラの前をふさがない）
  if (md) {
    if (mode === 'title') { cam.hd += dt * 0.12; cam.userT = performance.now() }   // タイトルはゆっくり見回す
    updateCamera(dt, p0.r, md)
    const d = sun.userData.dir, c = p0.r; sun.position.set(c.x + d.x * 150, c.y + d.y * 150, c.z + d.z * 150); sun.target.position.set(c.x, c.y, c.z)
  }
  drawBalloons(dt)
  // 時間（タイトルは夕方の手前で止めておく）
  setTime(mode === 'title' ? 0.35 : Math.min(1, m.t / BAL.dayLen))
  // PC の狙い
  aimMark.visible = false
  const r0 = p0.r
  if (mode === 'play' && !touchMode && frameN % 4 === 0) aimMark.userData.p = findAnchor(world, r0)
  if (mode === 'play' && !touchMode && aimMark.userData.p) { const p = aimMark.userData.p; aimMark.visible = true; aimMark.position.set(p.x, p.y, p.z); aimMark.lookAt(camera.position) }
  if (mode === 'play') { const v3 = Math.hypot(r0.vx, r0.vy, r0.vz); const wl = Snd.loops.wind; if (wl && wl.g) wl.g.gain.value = r0.grounded ? 0 : Math.min(0.35, Math.max(0, (v3 - 16) / 40)) /* 風: 地面では鳴らさない・空中で 16m/s から（2026-11-03 本人「謎の水の音がずっと鳴ってる」） */ }
  fx.update(dt)
  fx.shake = Math.max(0, fx.shake - dt * 2.5)
  drawSpeed(mode === 'play' ? Math.hypot(r0.vx, r0.vy, r0.vz) : 0, dt)
  if (mode === 'play') {
    const tt = m.t
    if (hints.length && tt >= hints[0][0] && sayT <= 0) { say(t(hints[0][1]), 3.2); hints.shift() }   // ほかの知らせを上書きしない
    // 近い兄弟: 画面のふちが赤く脈打つ・注意
    const nc = nearestChaser(m), close = nc && m.immune <= 0 && nc.c.stun <= 0 ? Math.max(0, 1 - nc.d / 22) : 0
    $('danger').style.opacity = (close * (0.55 + 0.45 * Math.sin(performance.now() / 110))).toFixed(2)
    if (close > 0.4 && !warned.near) { warned.near = 1; sfx('tick', { vol: 0.6 }) } else if (close < 0.1) warned.near = 0
    const left = BAL.sec - tt
    if (left < 30 && !warned[30]) { warned[30] = 1; say(t('last30'), 1.6, 'big'); sfx('tick') }
    if (left < 10 && !warned[10]) { warned[10] = 1; say(t('last10'), 1.6, 'big'); sfx('tick') }
    if (left < 5 && Math.floor(left) !== warned.tk) { warned.tk = Math.floor(left); sfx('tick', { vol: 0.5 }) }
    updateHud(dt)
    if (endAt > 0) { endAt -= dt; if (endAt <= 0) showResult() }
    snapAt -= dt
  }
  if (mode !== 'play') lockRing.visible = false
  renderer.render(scene, camera)
  // 結果の背景にする写真（一番コンボが長かった瞬間）
  if (mode === 'play' && snapAt <= 0 && m.combo >= (photo && photo._n || 1)) { snapAt = 2; const c2 = document.createElement('canvas'); c2.width = 480; c2.height = Math.round(480 * innerHeight / innerWidth); c2.getContext('2d').drawImage(renderer.domElement, 0, 0, c2.width, c2.height); c2._n = m.combo; photo = c2 }
  frameN++
}

// ---------------------------------------------------------------- 検証用の窓口
window.tt = {
  get mode() { return mode }, log, LOOK, get m() { return m }, get me() { return me() }, BAL, RUN, world, camera, touchMode, rayHit, cam,
  lockTarget: () => m && lockTarget(m, me().r, null), alive: () => m ? alive(m) : [],
  start: seed => startMatch(seed), toTitle, showResult, setLang: l => { lang = l; applyLang() }, get lang() { return lang },
  dbg: {
    pause: on => { dbgPause = on }, step: n => { for (let i = 0; i < n; i++) stepOnce(); render(STEP) },
    teleport: (x, y, z, yaw) => { const r = me().r; Object.assign(r, { x, y, z, vx: 0, vy: 0, vz: 0, rope: null, climbing: null, grounded: y < 0.1 }); if (yaw != null) r.yaw = yaw },
    pressWire: (sx, sy) => aimAt(sx, sy), tapTarget: (sx, sy) => { const rc = renderer.domElement.getBoundingClientRect(); ndc.set((sx - rc.left) / rc.width * 2 - 1, -((sy - rc.top) / rc.height) * 2 + 1); ray.setFromCamera(ndc, camera); return tapTarget(ray.ray.origin, ray.ray.direction) }, pressJump: () => { press.jump = true }, wireAuto: () => { pendingWire = { at: null, key: true } },
    keys, stick, say, setTime: f => { m.t = f * BAL.dayLen }, get models() { return models }, sleepBros: on => { for (const c of m.chasers) { c.awake = !on; c.stun = on ? 1e9 : 0 } }
  }
}
applyLang()
toTitle()
requestAnimationFrame(frame)
window.__jsUp = true
// ロード画面: 本物の読み込み（人物・空・質感）に合わせて進み、全部そろったら消す。遅い回線でも12秒で必ず消す
{
  let shown = 0, done = false
  const set = p => { shown = Math.max(shown, Math.min(1, p)); $('boot').style.setProperty('--p', shown.toFixed(3)) }
  THREE.DefaultLoadingManager.onProgress = (u, l, n) => set(0.1 + 0.85 * l / Math.max(1, n))
  const finish = () => { if (done) return; done = true; set(1); setTimeout(() => { $('boot').classList.add('out'); setTimeout(() => $('boot').classList.add('hidden'), 360); window.__ttReady = true }, 220) }
  set(0.06)
  const skyP = new Promise(ok => { const k = setInterval(() => { if (skyReady) { clearInterval(k); ok() } }, 60) })
  Promise.all([loadCharAssets().catch(() => {}), skyP]).then(finish)
  setTimeout(finish, 12000)
}
