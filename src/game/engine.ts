import {
  BALL_R,
  COURT,
  Shot,
  aimAt,
  clamp,
  inCpuReach,
  inYourReach,
  step,
  timingQuality,
  type Ball,
  type Difficulty,
  type Hitter,
  type Vec,
} from './physics'
import { winner, type Score } from './score'
import type { RuleKey } from './hints'
import { SHOT_NAME, canBoast, cpuReturnChance, cpuShot, intentFrom, kindFor, newShot, playerShot, sharpness, type ShotKind } from './shots'

export type HudState = {
  score: Score
  server: Hitter
  rally: number
  bestRally: number
  phase: Phase
  message: string
  result: Hitter | null
  hint: RuleKey | null
  paused: boolean
  boastSide: -1 | 1 | null // 보스트를 칠 수 있으면 공이 있는 쪽(화면 왼쪽 -1, 오른쪽 1)
  lastShot: { by: Hitter; name: string } | null // 방금 친 샷 이름
}

type Phase = 'ready' | 'serve-you' | 'serve-cpu' | 'rally' | 'point' | 'over'

const TIME_SCALE: Record<Difficulty, number> = { easy: 0.5, normal: 0.6, hard: 0.72 }
const CAM = { x: 0, y: 1.55, z: 11.2 }
const HUD_TOP = 96 // 점수판 아래부터 공이 보이게
const BEST_KEY = 'squash.bestRally'

const C = {
  floor1: '#e9d9b8',
  floor2: '#dcc8a1',
  wall: '#f4f6f5',
  sideWall: '#e3e7e6',
  line: '#c8402f',
  tin: '#b9b9b9',
  ink: '#141618',
  teal: '#00707d',
  tealBright: '#19a3ae',
  silver: '#c9cdcc',
}

export class Engine {
  private ctx: CanvasRenderingContext2D
  private w = 0
  private h = 0
  private f = 0
  private horizon = 0
  private raf = 0
  private last = 0
  private ball: Ball = { p: { x: 0, y: 1, z: 7.5 }, v: { x: 0, y: 0, z: 0 } }
  private shot: Shot = new Shot('cpu')
  private phase: Phase = 'ready'
  private score: Score = { you: 0, cpu: 0 }
  private server: Hitter = 'you'
  private side = 1 // 서브 박스: 1 오른쪽, -1 왼쪽
  private rally = 0
  private bestRally = 0
  private message = ''
  private timer = 0
  private cpuPlan: { decided: boolean; returns: boolean } = { decided: false, returns: false }
  private cpu: Vec = { x: 0, y: 0, z: 5.6 }
  private lastShot: { by: Hitter; kind: ShotKind; sharp: number } | null = null
  private trail: Vec[] = []
  private swings: { x: number; y: number; t: number; good: boolean }[] = []
  private pointer: { x: number; y: number } | null = null
  private flashes: { text: string; t: number; color: string; scale: number }[] = []
  private audio: AudioContext | null = null
  // 카메라는 공이 화면 밖으로 나가지 않을 만큼만 따라간다(좁은 폰 화면에서 특히 필요)
  private cam = { x: CAM.x, y: CAM.y }
  // 점수가 날 때 관련 규칙을 한 번씩 물어본다. 다음 랠리가 시작되면 사라진다
  private hint: RuleKey | null = null
  private asked = new Set<RuleKey>()
  private paused = false
  private rallySaw = { boast: false, backWall: false }
  private boastSide: -1 | 1 | null = null
  public difficulty: Difficulty = 'normal'
  public sound = true
  public askRules = true

  private canvas: HTMLCanvasElement
  private onHud: (h: HudState) => void

  constructor(canvas: HTMLCanvasElement, onHud: (h: HudState) => void) {
    this.canvas = canvas
    this.onHud = onHud
    this.ctx = canvas.getContext('2d')!
    try {
      this.bestRally = Number(localStorage.getItem(BEST_KEY)) || 0
    } catch {
      this.bestRally = 0
    }
    this.resize()
    this.emit()
  }

  start() {
    this.last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - this.last) / 1000)
      this.last = now
      if (!this.paused) this.update(dt)
      this.draw()
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop() {
    cancelAnimationFrame(this.raf)
    void this.audio?.close()
  }

  resize() {
    const r = this.canvas.getBoundingClientRect()
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    this.w = r.width
    this.h = r.height
    this.canvas.width = Math.round(r.width * dpr)
    this.canvas.height = Math.round(r.height * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    // 앞벽이 화면 폭이나 높이 어느 쪽에도 넘치지 않게
    const dz = CAM.z
    this.f = Math.min((this.w * 0.9 * dz) / (COURT.halfWidth * 2), (this.h * 0.5 * dz) / 4.7)
    this.horizon = Math.max(56, this.h * 0.1) + (this.f * (COURT.frontOut - CAM.y)) / dz
    this.cam = { ...this.camTarget() }
  }

  /** 규칙 설명을 읽는 동안 멈춘다 */
  pause() {
    this.paused = true
    this.emit()
  }

  resume() {
    this.paused = false
    this.last = performance.now()
    this.emit()
  }

  newMatch() {
    this.paused = false
    this.hint = null
    this.score = { you: 0, cpu: 0 }
    this.server = 'you'
    this.side = 1
    this.rally = 0
    this.flashes = []
    this.setupServe()
  }

  /** 자동 테스트용: 지금 칠 수 있는 공의 화면 위치 */
  debugTarget() {
    const reach = this.phase === 'serve-you' || (this.phase === 'rally' && this.shot.by === 'cpu' && inYourReach(this.ball, this.shot))
    const s = this.project(this.ball.p)
    return reach && s ? { x: s.x, y: s.y, z: this.ball.p.z, y3: this.ball.p.y, back: this.shot.backWall } : null
  }

  // ---------- 입력 ----------

  pointerMove(x: number, y: number) {
    this.pointer = { x, y }
  }

  pointerLeave() {
    this.pointer = null
  }

  tap(x: number, y: number) {
    this.unlockAudio()
    if (this.phase === 'ready' || this.phase === 'over' || this.paused) return
    const yourTurn = this.phase === 'serve-you' || (this.phase === 'rally' && this.shot.by === 'cpu' && inYourReach(this.ball, this.shot))
    const s = this.project(this.ball.p)
    const r = s ? Math.max(48, s.r * 3.2) : 0
    const near = s && Math.hypot(x - s.x, y - s.y) <= r
    if (!yourTurn || !s || !near) {
      this.swings.push({ x, y, t: 0, good: false })
      return
    }
    const dx = clamp((x - s.x) / r, -1, 1)
    const dy = clamp((y - s.y) / r, -1, 1)
    const serve = this.phase === 'serve-you'
    const q = serve ? 0.9 : timingQuality(this.ball.p, this.shot.backWall, this.shot.boast || this.shot.short)
    // 누른 곳으로 샷 종류를 고른다: 벽 쪽 옆면은 크로스, 윗면은 드롭(높은 공은 킬), 아랫면은 로브
    this.strike(kindFor(intentFrom(this.ball.p.x, dx, dy), this.ball.p, serve), serve, q)
    this.swings.push({ x, y, t: 0, good: true })
    navigator.vibrate?.(12)
    this.emit()
  }

  /** 보스트 버튼(또는 B 키): 옆벽 가까이 뒤쪽에 온 공을 옆벽으로 쳐서 보스트 */
  boast() {
    if (this.paused || this.boastSide == null) return false
    this.unlockAudio()
    const q = timingQuality(this.ball.p, this.shot.backWall)
    if (!this.strike('boast', false, q)) return false
    this.rallySaw.boast = true
    const s = this.project(this.ball.p)
    if (s) this.swings.push({ x: s.x, y: s.y, t: 0, good: true })
    navigator.vibrate?.(12)
    this.emit()
    return true
  }

  /** 계획한 샷을 친다. 그 자리에서 안 되는 샷이면 드라이브(서브는 로브 서브)로 */
  private strike(kind: ShotKind, serve: boolean, q: number) {
    const from = { ...this.ball.p }
    let hit = playerShot(kind, from, q)
    if (!hit && kind === 'boast') return false
    if (!hit) hit = playerShot(serve ? 'serve-lob' : 'drive', from, q)
    const k = hit?.kind ?? 'drive'
    const v = hit?.v ?? aimAt(from, { x: from.x * 0.8, y: 2.2, z: 0 }, 13)
    this.ball.v = v
    this.shot = newShot('you', k, from, serve)
    this.hint = null
    this.boastSide = null
    const sharp = sharpness(k, v, from, 'you', serve).score
    this.lastShot = { by: 'you', kind: k, sharp }
    this.flash(sharp > 0.7 && !serve ? `${SHOT_NAME[k]} · 예리해요!` : SHOT_NAME[k], sharp > 0.7 ? C.tealBright : '#ffffff', 0.75)
    this.cpuPlan = { decided: false, returns: false }
    this.phase = 'rally'
    this.rally++
    this.sfx('hit', q)
    return true
  }

  // ---------- 진행 ----------

  private setupServe() {
    this.trail = []
    this.rally = 0
    this.message = ''
    this.rallySaw = { boast: false, backWall: false }
    if (this.server === 'you') {
      this.phase = 'serve-you'
      this.toss()
    } else {
      this.phase = 'serve-cpu'
      // 규칙을 물어보는 중이면 읽을 시간을 조금 더 준다
      this.timer = this.hint ? 2.6 : 0.9
      this.ball = { p: { x: this.side * 2.2, y: 1.1, z: 6.3 }, v: { x: 0, y: 0, z: 0 } }
    }
    this.emit()
  }

  private toss() {
    this.ball = { p: { x: this.side * 2.0, y: 0.7, z: 7.0 }, v: { x: 0, y: 3.6, z: 0 } }
  }

  private update(realDt: number) {
    for (const s of this.swings) s.t += realDt
    this.swings = this.swings.filter((s) => s.t < 0.35)
    for (const f of this.flashes) f.t += realDt
    this.flashes = this.flashes.filter((f) => f.t < 1.1)

    if (this.phase === 'point') {
      this.timer -= realDt
      if (this.timer <= 0) this.setupServe()
    }
    if (this.phase === 'serve-cpu') {
      this.timer -= realDt
      if (this.timer <= 0) {
        const from = { ...this.ball.p }
        const c = cpuShot(from, this.difficulty, true)
        this.ball.v = c.v
        this.shot = newShot('cpu', c.kind, from, true)
        this.lastShot = { by: 'cpu', kind: c.kind, sharp: 0 }
        this.phase = 'rally'
        this.rally++
        this.hint = null
        this.sfx('hit', 0.7)
        this.emit()
      }
    }

    const dt = (realDt * TIME_SCALE[this.difficulty]) / 4
    for (let i = 0; i < 4; i++) this.physics(dt)

    // 상대는 공을 따라 움직이고, 내 차례에는 T 근처로 돌아간다
    const targetX = this.shot.by === 'you' && this.phase === 'rally' ? this.ball.p.x : 0
    const targetZ = this.shot.by === 'you' && this.phase === 'rally' ? clamp(this.ball.p.z, 3.2, 7.2) : 5.4
    this.cpu.x += (clamp(targetX, -2.9, 2.9) - this.cpu.x) * Math.min(1, realDt * 5)
    this.cpu.z += (targetZ - this.cpu.z) * Math.min(1, realDt * 3)

    const yourBall = this.phase === 'rally' && this.shot.by === 'cpu' && inYourReach(this.ball, this.shot) && !this.shot.boast
    const side = yourBall && canBoast(this.ball.p) ? (Math.sign(this.ball.p.x - this.cam.x) >= 0 ? 1 : -1) : null
    if (side !== this.boastSide) {
      this.boastSide = side
      this.emit()
    }

    const t = this.camTarget()
    const k = Math.min(1, realDt * 7)
    this.cam.x += (t.x - this.cam.x) * k
    this.cam.y += (t.y - this.cam.y) * k
  }

  private camTarget() {
    const b = this.ball.p
    // 공이 화면 폭의 38% 안, 점수판 아래~화면 아래 여백 위에 들어오게.
    // 뒷벽 근처(카메라 바로 앞)까지 온 공도 놓치지 않도록 실제 거리로 계산한다
    const dz = Math.max(1.3, CAM.z - Math.max(b.z, 6))
    const maxOff = (this.w * 0.38 * dz) / this.f
    const x = clamp(Math.sign(b.x) * Math.max(0, Math.abs(b.x) - maxOff), -2.6, 2.6)
    const above = ((this.horizon - HUD_TOP) * dz) / this.f
    const below = ((this.h - 56 - this.horizon) * dz) / this.f
    const y = clamp(clamp(CAM.y, b.y - above, b.y + below), 0.5, 2.6)
    return { x, y }
  }

  private physics(dt: number) {
    if (this.phase === 'ready' || this.phase === 'over') return
    if (this.phase === 'serve-cpu') return
    const events = step(this.ball, dt)
    if (this.phase === 'serve-you') {
      // 토스한 공이 떨어지면 다시 띄운다
      if (events.some((e) => e.hit === 'floor')) this.toss()
      return
    }
    if (this.phase !== 'rally') return
    this.trail.push({ ...this.ball.p })
    if (this.trail.length > 14) this.trail.shift()

    for (const e of events) {
      if (e.hit !== 'floor') this.sfx('wall', 0.5)
      // 상대 공이 뒷벽을 맞고 나오면 아직 칠 수 있다고 알려 준다
      if (e.hit === 'back' && this.shot.by === 'cpu' && this.shot.frontOk && !this.shot.backWall && this.shot.floorAfterFront <= 1 && e.at.y <= COURT.backOut) {
        this.rallySaw.backWall = true
        this.flash('뒷벽! 나오는 공을 치세요', C.tealBright, 0.9)
      }
      // 상대 공이 앞 코트로 떨어지는 샷이면 앞으로 나오라고 알려 준다
      if (e.hit === 'front' && !this.shot.frontOk && this.shot.by === 'cpu' && e.at.y >= COURT.tin && (this.shot.boast || this.shot.short)) {
        if (this.shot.boast) this.rallySaw.boast = true
        this.flash(`${this.lastShot ? SHOT_NAME[this.lastShot.kind] : '짧은 공'}! 앞으로 나가 치세요`, C.tealBright, 0.8)
      }
      const r = this.shot.apply(e)
      if (!r) continue
      const by = this.shot.by
      const other: Hitter = by === 'you' ? 'cpu' : 'you'
      if (r === 'double') {
        this.endRally(by, by === 'you' ? '위너!' : '놓쳤어요', by === 'cpu' ? 'not-up' : null)
      } else {
        const wallOut = r === 'out' && e.hit !== 'front'
        const label = { down: '바닥에 먼저 닿았어요', tin: '틴!', out: wallOut ? '아웃! (벽 아웃 라인 위)' : '아웃!', 'serve-fault': '서브 폴트' }[r]
        this.endRally(other, label, wallOut ? 'out-wall' : r)
      }
      return
    }

    // 상대 차례: 칠 수 있는 순간 받아칠지 정한다
    if (this.shot.by === 'you' && inCpuReach(this.ball, this.shot)) {
      if (!this.cpuPlan.decided) {
        const last = this.lastShot
        const p = cpuReturnChance(this.difficulty, last?.kind ?? 'drive', last?.by === 'you' ? last.sharp : 0)
        this.cpuPlan = { decided: true, returns: Math.random() < p }
      }
      if (this.cpuPlan.returns && Math.abs(this.cpu.x - this.ball.p.x) < 1.8) {
        const from = { ...this.ball.p }
        const c = cpuShot(from, this.difficulty, false)
        this.ball.v = c.v
        this.shot = newShot('cpu', c.kind, from)
        this.lastShot = { by: 'cpu', kind: c.kind, sharp: 0 }
        this.rally++
        this.emit()
        this.sfx('hit', 0.6)
      }
    }
  }

  private endRally(win: Hitter, label: string, reason: RuleKey | null) {
    const kept = win === this.server
    this.score = { ...this.score, [win]: this.score[win] + 1 }
    if (this.rally > this.bestRally) {
      this.bestRally = this.rally
      try {
        localStorage.setItem(BEST_KEY, String(this.bestRally))
      } catch {
        // 저장이 막힌 브라우저에서는 이번 판에만 기억한다
      }
    }
    // 서브권을 지키면 박스를 바꾸고, 넘어오면 오른쪽부터
    if (win === this.server) this.side = -this.side
    else {
      this.server = win
      this.side = 1
    }
    this.message = label
    this.flash(win === 'you' ? `+1  ${label}` : label, win === 'you' ? C.teal : C.line)
    this.sfx(win === 'you' ? 'win' : 'lose', 1)
    this.hint = null
    if (this.askRules && !winner(this.score)) {
      const deuce = this.score.you === 10 && this.score.cpu === 10
      const order: (RuleKey | null)[] = [
        reason,
        this.rallySaw.boast ? 'boast' : null,
        this.rallySaw.backWall && win === 'cpu' ? 'back-wall' : null,
        deuce ? 'deuce' : null,
        kept ? 'serve-box' : null,
      ]
      this.hint = order.find((k): k is RuleKey => !!k && !this.asked.has(k)) ?? null
      if (this.hint) this.asked.add(this.hint)
    }
    if (winner(this.score)) {
      this.phase = 'over'
    } else {
      this.phase = 'point'
      this.timer = 1.3
    }
    this.emit()
  }

  private flash(text: string, color: string, scale = 1) {
    this.flashes.push({ text, t: 0, color, scale })
  }

  private emit() {
    this.onHud({
      score: this.score,
      server: this.server,
      rally: this.rally,
      bestRally: this.bestRally,
      phase: this.phase,
      message: this.message,
      result: winner(this.score),
      hint: this.hint,
      paused: this.paused,
      boastSide: this.boastSide,
      lastShot: this.lastShot ? { by: this.lastShot.by, name: SHOT_NAME[this.lastShot.kind] } : null,
    })
  }

  // ---------- 그리기 ----------

  private project(p: Vec) {
    const dz = CAM.z - p.z
    if (dz < 0.3) return null
    return {
      x: this.w / 2 + (this.f * (p.x - this.cam.x)) / dz,
      y: this.horizon - (this.f * (p.y - this.cam.y)) / dz,
      r: (this.f * BALL_R) / dz,
    }
  }

  private pt(x: number, y: number, z: number) {
    const dz = Math.max(0.3, CAM.z - z)
    return [this.w / 2 + (this.f * (x - this.cam.x)) / dz, this.horizon - (this.f * (y - this.cam.y)) / dz] as const
  }

  private poly(points: (readonly [number, number])[], fill: string) {
    const c = this.ctx
    c.beginPath()
    points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)))
    c.closePath()
    c.fillStyle = fill
    c.fill()
  }

  private line(a: readonly [number, number], b: readonly [number, number], color: string, width: number) {
    const c = this.ctx
    c.beginPath()
    c.moveTo(a[0], a[1])
    c.lineTo(b[0], b[1])
    c.strokeStyle = color
    c.lineWidth = width
    c.stroke()
  }

  private draw() {
    const c = this.ctx
    const W = COURT.halfWidth
    const L = COURT.length
    const near = L - 0.05
    c.clearRect(0, 0, this.w, this.h)
    c.fillStyle = '#1a1d1f'
    c.fillRect(0, 0, this.w, this.h)

    // 바닥(나무 판자)
    this.poly([this.pt(-W, 0, 0), this.pt(W, 0, 0), this.pt(W, 0, near), this.pt(-W, 0, near)], C.floor1)
    for (let i = 1; i < 16; i++) {
      const x = -W + (i * 2 * W) / 16
      this.line(this.pt(x, 0, 0), this.pt(x, 0, near), C.floor2, 1)
    }
    // 옆벽, 앞벽
    this.poly([this.pt(-W, 0, 0), this.pt(-W, 5.6, 0), this.pt(-W, 5.6, near), this.pt(-W, 0, near)], C.sideWall)
    this.poly([this.pt(W, 0, 0), this.pt(W, 5.6, 0), this.pt(W, 5.6, near), this.pt(W, 0, near)], C.sideWall)
    this.poly([this.pt(-W, 0, 0), this.pt(W, 0, 0), this.pt(W, 5.6, 0), this.pt(-W, 5.6, 0)], C.wall)
    // 틴
    this.poly([this.pt(-W, 0, 0), this.pt(W, 0, 0), this.pt(W, COURT.tin, 0), this.pt(-W, COURT.tin, 0)], C.tin)

    const lw = Math.max(1.5, this.f / 260)
    this.line(this.pt(-W, COURT.tin, 0), this.pt(W, COURT.tin, 0), C.line, lw * 1.4)
    this.line(this.pt(-W, COURT.serviceLine, 0), this.pt(W, COURT.serviceLine, 0), C.line, lw)
    this.line(this.pt(-W, COURT.frontOut, 0), this.pt(W, COURT.frontOut, 0), C.line, lw)
    // 옆벽 아웃 라인(앞 4.57m에서 뒤 2.13m로 내려온다)
    for (const s of [-W, W]) this.line(this.pt(s, COURT.frontOut, 0), this.pt(s, COURT.backOut, L), C.line, lw)
    // 바닥 라인
    this.line(this.pt(-W, 0, COURT.shortLine), this.pt(W, 0, COURT.shortLine), C.line, lw)
    this.line(this.pt(0, 0, COURT.shortLine), this.pt(0, 0, near), C.line, lw)
    for (const s of [-1, 1]) {
      const bx = s * (W - 1.6)
      this.line(this.pt(bx, 0, COURT.shortLine), this.pt(bx, 0, COURT.shortLine + 1.6), C.line, lw)
      this.line(this.pt(bx, 0, COURT.shortLine + 1.6), this.pt(s * W, 0, COURT.shortLine + 1.6), C.line, lw)
    }
    // 앞벽 로고
    const [lx, ly] = this.pt(0, 3.2, 0)
    c.font = `${Math.max(10, this.f / 38)}px Michroma, sans-serif`
    c.textAlign = 'center'
    c.fillStyle = 'rgb(0 112 125 / 0.22)'
    c.fillText('SQUASH COURT', lx, ly)

    // 공보다 먼 쪽이면 상대를 먼저 그린다
    const ballBehindCpu = this.ball.p.z < this.cpu.z
    if (!ballBehindCpu) this.drawCpu()
    this.drawBall()
    if (ballBehindCpu) this.drawCpu()
    this.drawRacketCursor()
    this.drawFlashes()
  }

  private drawCpu() {
    const c = this.ctx
    const { x, z } = this.cpu
    const [fx, fy] = this.pt(x, 0, z)
    const [, hy] = this.pt(x, 1.75, z)
    const hgt = fy - hy
    const wdt = hgt * 0.28
    c.globalAlpha = 0.55
    c.fillStyle = 'rgb(0 0 0 / 0.25)'
    c.beginPath()
    c.ellipse(fx, fy, wdt * 0.9, wdt * 0.22, 0, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = C.ink
    c.fillRect(fx - wdt * 0.35, fy - hgt * 0.45, wdt * 0.28, hgt * 0.45)
    c.fillRect(fx + wdt * 0.07, fy - hgt * 0.45, wdt * 0.28, hgt * 0.45)
    c.fillStyle = C.teal
    c.beginPath()
    c.roundRect(fx - wdt / 2, fy - hgt * 0.82, wdt, hgt * 0.42, wdt * 0.2)
    c.fill()
    c.fillStyle = '#d9b99a'
    c.beginPath()
    c.arc(fx, fy - hgt * 0.9, wdt * 0.26, 0, Math.PI * 2)
    c.fill()
    c.globalAlpha = 1
  }

  private drawBall() {
    const c = this.ctx
    const b = this.ball.p
    const sh = this.project({ x: b.x, y: 0, z: b.z })
    if (sh) {
      c.fillStyle = `rgb(0 0 0 / ${clamp(0.35 - b.y * 0.08, 0.08, 0.35)})`
      c.beginPath()
      c.ellipse(sh.x, sh.y, sh.r * 1.3, sh.r * 0.45, 0, 0, Math.PI * 2)
      c.fill()
    }
    this.trail.forEach((p, i) => {
      const s = this.project(p)
      if (!s) return
      c.fillStyle = `rgb(20 22 24 / ${(i / this.trail.length) * 0.18})`
      c.beginPath()
      c.arc(s.x, s.y, s.r * 0.8, 0, Math.PI * 2)
      c.fill()
    })
    const s = this.project(b)
    if (!s) return
    const reach = (this.phase === 'rally' && this.shot.by === 'cpu' && inYourReach(this.ball, this.shot)) || this.phase === 'serve-you'
    if (reach) {
      // 칠 수 있을 때 공 둘레에 틸 링
      const pulse = 1 + Math.sin(performance.now() / 90) * 0.08
      c.strokeStyle = C.tealBright
      c.lineWidth = 3
      c.beginPath()
      c.arc(s.x, s.y, Math.max(48, s.r * 3.2) * 0.55 * pulse, 0, Math.PI * 2)
      c.stroke()
    }
    c.fillStyle = C.ink
    c.beginPath()
    c.arc(s.x, s.y, Math.max(3, s.r), 0, Math.PI * 2)
    c.fill()
    // 노란 점 두 개(더블 옐로 닷)
    c.fillStyle = '#f2c230'
    const d = Math.max(0.8, s.r * 0.22)
    c.beginPath()
    c.arc(s.x - s.r * 0.35, s.y - s.r * 0.3, d, 0, Math.PI * 2)
    c.arc(s.x + s.r * 0.05, s.y - s.r * 0.45, d, 0, Math.PI * 2)
    c.fill()
  }

  // 헤로우 Response 115 모양 라켓: 실버 프레임, 틸 포인트, 흰 그립
  private drawRacketCursor() {
    const c = this.ctx
    const items: { x: number; y: number; angle: number; alpha: number }[] = []
    if (this.pointer) items.push({ x: this.pointer.x, y: this.pointer.y, angle: -0.35, alpha: 0.9 })
    for (const s of this.swings) {
      const k = s.t / 0.35
      items.push({ x: s.x, y: s.y, angle: -1.1 + k * 1.6, alpha: (1 - k) * (s.good ? 1 : 0.5) })
    }
    const size = clamp(this.h * 0.11, 52, 92)
    for (const it of items) {
      c.save()
      c.globalAlpha = it.alpha
      c.translate(it.x, it.y)
      c.rotate(it.angle)
      // 그립(아래쪽)
      c.fillStyle = '#ffffff'
      c.strokeStyle = '#141618'
      c.lineWidth = 1
      c.beginPath()
      c.roundRect(-size * 0.07, size * 0.62, size * 0.14, size * 0.62, 3)
      c.fill()
      c.stroke()
      c.fillStyle = '#141618'
      c.fillRect(-size * 0.075, size * 0.58, size * 0.15, size * 0.08)
      // 샤프트
      c.fillStyle = C.silver
      c.fillRect(-size * 0.05, size * 0.3, size * 0.1, size * 0.3)
      // 헤드(티어드롭)
      c.beginPath()
      c.ellipse(0, -size * 0.12, size * 0.34, size * 0.46, 0, 0, Math.PI * 2)
      c.lineWidth = size * 0.07
      c.strokeStyle = C.silver
      c.stroke()
      c.lineWidth = size * 0.025
      c.strokeStyle = C.teal
      c.beginPath()
      c.ellipse(0, -size * 0.12, size * 0.34, size * 0.46, 0, Math.PI * 0.15, Math.PI * 0.55)
      c.stroke()
      // 줄
      c.strokeStyle = 'rgb(20 22 24 / 0.25)'
      c.lineWidth = 1
      for (let i = -3; i <= 3; i++) {
        c.beginPath()
        c.moveTo(i * size * 0.08, -size * 0.52)
        c.lineTo(i * size * 0.08, size * 0.28)
        c.stroke()
        c.beginPath()
        c.moveTo(-size * 0.3, -size * 0.12 + i * size * 0.1)
        c.lineTo(size * 0.3, -size * 0.12 + i * size * 0.1)
        c.stroke()
      }
      c.restore()
    }
  }

  private drawFlashes() {
    const c = this.ctx
    for (const f of this.flashes) {
      const k = f.t / 1.1
      c.globalAlpha = 1 - k
      c.font = `800 ${clamp(this.w / 14, 22, 40) * f.scale}px 'Pretendard Variable', sans-serif`
      c.textAlign = 'center'
      c.fillStyle = f.color
      c.fillText(f.text, this.w / 2, this.h * 0.42 - k * 40)
      c.globalAlpha = 1
    }
  }

  // ---------- 소리 ----------

  private unlockAudio() {
    if (!this.sound || this.audio) return
    try {
      this.audio = new AudioContext()
    } catch {
      this.audio = null
    }
  }

  private sfx(kind: 'hit' | 'wall' | 'win' | 'lose', strength: number) {
    const a = this.audio
    if (!this.sound || !a) return
    const t = a.currentTime
    const o = a.createOscillator()
    const g = a.createGain()
    o.connect(g).connect(a.destination)
    const freq = { hit: 520 + strength * 260, wall: 180, win: 880, lose: 220 }[kind]
    const len = { hit: 0.06, wall: 0.04, win: 0.22, lose: 0.28 }[kind]
    o.type = kind === 'hit' ? 'triangle' : kind === 'wall' ? 'square' : 'sine'
    o.frequency.setValueAtTime(freq, t)
    if (kind === 'win') o.frequency.exponentialRampToValueAtTime(1320, t + len)
    if (kind === 'lose') o.frequency.exponentialRampToValueAtTime(140, t + len)
    g.gain.setValueAtTime(kind === 'wall' ? 0.05 : 0.18, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + len)
    o.start(t)
    o.stop(t + len + 0.02)
  }
}
