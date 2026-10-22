import { Athlete, chargePower, strikePower, realisticReach, type GameMode, type RealismHud, type CourtPoint } from './realism'
import { CPU_LEVEL, chooseIntercept } from './cpu'
import { rallySummary, type MatchSummary, type PlayerSummary } from './matchStats'
import { BALL_R, COURT, SIM_DT, Shot, aimAt, clamp, inCpuReach, inYourReach, sampleReach, step, timingQuality, type Ball, type Difficulty, type Hitter, type Vec } from './physics'
import { status, winner, type Score, type Status } from './score'
import type { RuleKey } from './hints'
import { BODY, CpuBody, T_SPOT, type Joints } from './cpuBody'
import { SHOT_NAME, ZONE, cpuReturnChance, cpuShot, intentFrom, kindFor, newShot, playerShot, sharpness, type ShotKind } from './shots'

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
  lastShot: { by: Hitter; name: string } | null // 방금 친 샷 이름
  mode: GameMode
  realism: RealismHud | null
  status: Status // 듀스·게임볼
  summary: MatchSummary
  lastRally: MatchSummary | null
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
  private totals = { seconds: 0, rallySeconds: 0, hits: 0, bestRally: 0 }
  private matchMode: GameMode = 'classic'
  private rallyStart: MatchSummary | null = null
  private lastRally: MatchSummary | null = null
  private bestRally = 0
  private message = ''
  private timer = 0
  // 상대가 공을 칠 시각(내가 친 뒤 경과한 게임 시간 기준)
  private cpuPlan: { returns: boolean; t: number } = { returns: false, t: 0 }
  private cpuClock = 0
  private gameCarry = 0
  private body = new CpuBody()
  // 쉬움 모드: 칠 타이밍에 누르면 멈추고 공을 크게 보여 칠 곳을 고르게 한다
  private pick: { k: number; dir: 1 | -1; q: number; serve: boolean; sx: number; sy: number; sr: number; kind: ShotKind | null } | null = null
  private lastShot: { by: Hitter; kind: ShotKind; sharp: number } | null = null
  private trail: Vec[] = []
  private swings: { x: number; y: number; t: number; good: boolean; side: number }[] = []
  private pointer: { x: number; y: number } | null = null
  private flashes: { text: string; t: number; color: string; scale: number }[] = []
  private audio: AudioContext | null = null
  private master: DynamicsCompressorNode | null = null
  private noise: AudioBuffer | null = null
  // 카메라는 공이 화면 밖으로 나가지 않을 만큼만 따라간다(좁은 폰 화면에서 특히 필요)
  private cam = { x: CAM.x, y: CAM.y }
  // 점수가 날 때 관련 규칙을 한 번씩 물어본다. 다음 랠리가 시작되면 사라진다
  private hint: RuleKey | null = null
  private asked = new Set<RuleKey>()
  private paused = false
  private rallySaw = { boast: false, backWall: false }
  private lastStatus: Status = null
  public mode: GameMode = 'classic'
  public readonly player = new Athlete()
  public readonly opponent = new Athlete()
  private charge: { seconds: number; pointerType: string } | null = null
  private aimTarget: { x: number; y: number } | null = null
  private playerIntercept: CourtPoint | null = null
  private playerPlanIn = 0
  private hudClock = 0
  private lastPower = 0
  public difficulty: Difficulty = 'easy'
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
    this.cancelCharge()
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
    this.cancelCharge()
    this.paused = true
    this.emit()
  }

  resume() {
    this.paused = false
    this.last = performance.now()
    this.emit()
  }

  newMatch() {
    this.cancelCharge()
    this.player.reset()
    this.opponent.reset()
    this.matchMode = this.mode
    this.totals = { seconds: 0, rallySeconds: 0, hits: 0, bestRally: 0 }
    this.rallyStart = null
    this.lastRally = null
    this.lastPower = 0
    this.lastShot = null
    this.playerIntercept = null
    this.playerPlanIn = 0
    this.gameCarry = 0
    this.paused = false
    this.pick = null
    this.hint = null
    this.lastStatus = null
    this.score = { you: 0, cpu: 0 }
    this.server = 'you'
    this.side = 1
    this.rally = 0
    this.flashes = []
    this.setupServe()
  }

  /** 경기를 그만두고 시작 화면으로 돌아간다 */
  quit() {
    this.cancelCharge()
    this.paused = false
    this.hint = null
    this.score = { you: 0, cpu: 0 }
    this.rally = 0
    this.phase = 'ready'
    this.emit()
  }

  /** 자동 테스트용: 지금 칠 수 있는 공의 화면 위치 */
  debugTarget() {
    const reach =
      (this.phase === 'serve-you' && (this.mode === 'classic' || this.player.canStrike(this.ball.p))) ||
      (this.phase === 'rally' && this.shot.by === 'cpu' && this.canYouHit())
    const s = this.project(this.ball.p)
    return reach && s ? { x: s.x, y: s.y, z: this.ball.p.z, y3: this.ball.p.y, back: this.shot.backWall } : null
  }

  // ---------- 입력 ----------

  pointerMove(x: number, y: number, pointerType = 'mouse') {
    this.aimTarget = { x, y }
    if (this.mode !== 'realistic' || pointerType !== 'mouse' || !this.pointer) this.pointer = { x, y }
  }

  press(x: number, y: number, pointerType = 'mouse') {
    if (this.mode !== 'realistic') {
      this.tap(x, y)
      return
    }
    if (this.paused || this.charge || !this.yourBallNow()) return
    this.pointerMove(x, y, pointerType)
    const at = pointerType === 'mouse' ? (this.pointer ?? { x, y }) : { x, y }
    const ball = this.project(this.ball.p)
    if (!ball || Math.hypot(at.x - ball.x, at.y - ball.y) > this.hitRadius(ball.r)) return
    this.unlockAudio()
    this.charge = { seconds: 0, pointerType }
    this.emit()
  }

  release(x: number, y: number) {
    const held = this.charge
    if (!held) return
    if (x < 0 || y < 0 || x > this.w || y > this.h) {
      this.cancelCharge()
      this.emit()
      return
    }
    if (held.pointerType !== 'mouse') this.pointer = { x, y }
    this.charge = null
    const power = strikePower(chargePower(held.seconds), this.player)
    const at = held.pointerType === 'mouse' ? (this.pointer ?? { x, y }) : { x, y }
    this.tap(at.x, at.y, power)
    this.emit()
  }

  cancelCharge() {
    this.charge = null
    this.aimTarget = null
  }

  private canYouHit() {
    return this.mode === 'realistic' ? realisticReach(this.ball, this.shot) && this.player.canStrike(this.ball.p, this.shot.backWall) : inYourReach(this.ball, this.shot)
  }

  pointerLeave() {
    if (!this.charge) {
      this.pointer = null
      this.aimTarget = null
    }
  }

  tap(x: number, y: number, power?: number) {
    this.unlockAudio()
    if (this.phase === 'ready' || this.phase === 'over' || this.paused) return
    if (this.pick) return this.choose(x, y)
    const yourTurn =
      (this.phase === 'serve-you' && (this.mode === 'classic' || this.player.canStrike(this.ball.p))) ||
      (this.phase === 'rally' && this.shot.by === 'cpu' && this.canYouHit())
    const s = this.project(this.ball.p)
    const r = s ? this.hitRadius(s.r) : 0
    const near = s && Math.hypot(x - s.x, y - s.y) <= r
    if (!yourTurn || !s || !near) {
      this.swings.push({ x, y, t: 0, good: false, side: this.handSide() })
      return
    }
    const dx = clamp((x - s.x) / r, -1, 1)
    const dy = clamp((y - s.y) / r, -1, 1)
    const serve = this.phase === 'serve-you'
    const q = serve ? 0.9 : timingQuality(this.ball.p, this.shot.backWall, this.shot.boast || this.shot.short)
    navigator.vibrate?.(12)
    // 쉬움 모드: 여기서 멈추고 칠 곳을 고르게 한다
    if (this.difficulty === 'easy' && this.mode === 'classic') {
      this.pick = { k: 0, dir: 1, q, serve, sx: s.x, sy: s.y, sr: r, kind: null }
      this.pointer = null
      return
    }
    // 누른 곳 = 라켓이 공을 때린 곳: 안쪽은 보스트, 가운데는 드라이브, 벽 쪽은 크로스, 윗면은 드롭, 아랫면은 로브
    this.strike(kindFor(intentFrom(this.ball.p.x, dx, dy), this.ball.p, serve), serve, q, power)
    this.swings.push({ x: power != null ? x : s.x, y: power != null ? y : s.y, t: 0, good: true, side: this.handSide() })
    this.emit()
  }

  /** 쉬움 모드에서 멈춘 화면: 크게 보이는 공 둘레에서 칠 곳을 고른다 */
  private choose(x: number, y: number) {
    const p = this.pick!
    if (p.dir < 0 || p.k < 0.6) return
    const g = this.pickGeom()
    if (Math.hypot(x - g.cx, y - g.cy) > g.R) return
    const dx = clamp((x - g.cx) / g.R, -1, 1)
    const dy = clamp((y - g.cy) / g.R, -1, 1)
    p.kind = kindFor(intentFrom(this.ball.p.x, dx, dy), this.ball.p, p.serve)
    p.dir = -1
    navigator.vibrate?.(12)
  }

  private pickGeom() {
    const p = this.pick!
    const e = p.k * p.k * (3 - 2 * p.k)
    const big = Math.min(this.w * 0.4, this.h * 0.27)
    return { cx: p.sx + (this.w / 2 - p.sx) * e, cy: p.sy + (this.h * 0.5 - p.sy) * e, R: p.sr + (big - p.sr) * e, e }
  }

  /** 오른손잡이 기준: 공이 몸 오른쪽이면 포핸드(1), 왼쪽이면 백핸드(-1) */
  private handSide() {
    return this.ball.p.x >= -0.15 ? 1 : -1
  }

  /** 공 둘레에서 칠 수 있는 범위(px). 쉬움 모드는 더 넓다 */
  private hitRadius(ballR: number) {
    return this.difficulty === 'easy' ? Math.max(84, ballR * 4) : Math.max(48, ballR * 3.2)
  }

  private yourBallNow() {
    return (
      (this.phase === 'serve-you' && (this.mode === 'classic' || this.player.canStrike(this.ball.p))) ||
      (this.phase === 'rally' && this.shot.by === 'cpu' && this.canYouHit())
    )
  }

  /** 선택한 샷의 방향을 유지한다. 이상적인 샷 후보가 없어도 드라이브로 바꾸지 않는다. */
  private strike(kind: ShotKind, serve: boolean, q: number, power?: number) {
    if (serve) this.rallyStart = this.summary()
    const from = { ...this.ball.p }
    const hit = playerShot(kind, from, q, Math.random, power)
    const side = Math.sign(from.x) || 1
    const targetX = kind === 'boast' ? side * 7 : kind.startsWith('cross') ? -side * 2 : from.x * 0.85
    const k = kind
    const v = hit?.v ?? aimAt(from, { x: targetX, y: serve ? 2.4 : 1.2, z: 0 }, 8 + (power ?? 0.65) * 12)
    if (this.mode === 'realistic') {
      this.lastPower = power ?? 0.65
      this.player.hit(this.lastPower)
      this.player.target = { ...T_SPOT }
      this.playerIntercept = null
    }
    this.ball.v = v
    this.shot = newShot('you', k, from, serve)
    this.hint = null
    if (k === 'boast') this.rallySaw.boast = true
    const sharp = sharpness(k, v, from, 'you', serve).score
    this.lastShot = { by: 'you', kind: k, sharp }
    this.flash(sharp > 0.7 && !serve ? `${SHOT_NAME[k]} · 예리해요!` : SHOT_NAME[k], sharp > 0.7 ? C.tealBright : '#ffffff', 0.75)
    this.phase = 'rally'
    this.rally++
    this.totals.hits++
    this.sfx('hit', q)
    this.planCpu()
    return true
  }

  // ---------- 진행 ----------

  private setupServe() {
    this.playerIntercept = null
    this.playerPlanIn = 0
    this.trail = []
    this.rally = 0
    this.message = ''
    this.rallySaw = { boast: false, backWall: false }
    this.pick = null
    this.configureCpu()
    if (this.server === 'you') {
      this.phase = 'serve-you'
      this.toss()
      // 상대는 반대쪽 뒤에서 리시브를 기다린다
      this.body.placeAt({ x: -this.side * 1.6, z: 7.4 })
      this.player.root = { x: this.side * 1.6, z: 7.4 }
      this.player.target = { ...this.player.root }
    } else {
      this.phase = 'serve-cpu'
      // 규칙을 물어보는 중이면 읽을 시간을 조금 더 준다
      this.timer = this.hint ? 2.6 : 1.1
      // 서비스 박스에 한 발을 두고 포핸드로 서브한다
      this.ball = { p: { x: this.side > 0 ? 2.55 : -1.75, y: 1.1, z: 6.3 }, v: { x: 0, y: 0, z: 0 } }
      this.body.placeAt({ x: this.ball.p.x - 0.78, z: 6.75 })
      this.player.root = { x: -this.side * 1.6, z: 7.4 }
      this.player.target = { ...this.player.root }
      this.body.plan(this.ball.p, this.timer * TIME_SCALE[this.difficulty])
    }
    this.emit()
  }

  private toss() {
    this.ball = { p: { x: this.side * 2.0, y: 0.7, z: 7.0 }, v: { x: 0, y: 3.6, z: 0 } }
  }

  private update(realDt: number) {
    if (this.mode === 'realistic') {
      if (this.charge) this.charge.seconds += realDt
      if (this.pointer && this.aimTarget && this.charge?.pointerType !== 'touch') {
        const dx = this.aimTarget.x - this.pointer.x,
          dy = this.aimTarget.y - this.pointer.y
        const distance = Math.hypot(dx, dy)
        const amount = Math.min(1, (1800 * this.player.speedFactor * this.player.speedFactor * realDt) / Math.max(1, distance))
        this.pointer.x += dx * amount
        this.pointer.y += dy * amount
      }
      this.hudClock += realDt
      if (this.hudClock >= 0.08) {
        this.hudClock = 0
        this.emit()
      }
    }
    // 강도를 정하는 동안 공·몸·체력을 멈춘다. 충전한 시간을 물리에 더하지 않는다.
    if (this.mode === 'realistic' && this.charge) return
    for (const s of this.swings) s.t += realDt
    this.swings = this.swings.filter((s) => s.t < 0.32)
    for (const f of this.flashes) f.t += realDt
    this.flashes = this.flashes.filter((f) => f.t < 1.1)

    // 쉬움 모드에서 고르는 동안은 시간이 멈춘다
    if (this.pick) {
      const p = this.pick
      p.k = clamp(p.k + (p.dir * realDt) / 0.24, 0, 1)
      if (p.dir < 0 && p.k <= 0) {
        this.pick = null
        const s = this.project(this.ball.p)
        this.strike(p.kind ?? 'drive', p.serve, p.q)
        if (s) this.swings.push({ x: s.x, y: s.y, t: 0, good: true, side: this.handSide() })
        this.emit()
      }
      return
    }

    if (this.phase === 'point') {
      this.timer -= realDt
      if (this.timer <= 0) this.setupServe()
    }
    if (this.phase === 'serve-cpu') {
      this.timer -= realDt
      if (this.timer <= 0) {
        this.rallyStart = this.summary()
        const from = { ...this.ball.p }
        const power = this.cpuPower(from)
        const c = cpuShot(from, this.difficulty, true, Math.random, power)
        if (power != null) this.opponent.hit(power)
        this.ball.v = c.v
        this.shot = newShot('cpu', c.kind, from, true)
        this.lastShot = { by: 'cpu', kind: c.kind, sharp: 0 }
        this.planPlayer()
        this.phase = 'rally'
        this.rally++
        this.totals.hits++
        this.hint = null
        if (this.body.swing) {
          this.body.swing.t = 0
          this.body.swing.at = { ...from }
        }
        this.sfx('hit', 0.7)
        this.emit()
      }
    }

    const game = realDt * TIME_SCALE[this.difficulty]
    // 예측·실제 공·몸을 같은 간격으로 갱신해 화면 fps에 따라 타구 판정이 달라지지 않게 한다.
    this.gameCarry += game
    while (this.gameCarry >= SIM_DT) {
      if (this.phase === 'ready' || this.phase === 'over') {
        this.gameCarry = 0
        break
      }
      const previous = { ...this.body.root }
      const youDistance = this.player.distance
      const cpuDistance = this.opponent.distance
      const elapsed = SIM_DT / TIME_SCALE[this.difficulty]
      const rallying = this.phase === 'rally'
      const resting = !rallying
      this.totals.seconds += elapsed
      if (rallying) this.totals.rallySeconds += elapsed
      if (this.mode === 'realistic') {
        this.playerPlanIn -= SIM_DT
        if (this.phase === 'rally' && this.shot.by === 'cpu' && this.playerPlanIn <= 0) this.planPlayer()
        this.player.move(SIM_DT, resting)
        this.configureCpu()
        this.body.speed = Math.min(this.body.speed, this.body.maxSpeed)
      }
      this.body.update(SIM_DT)
      if (this.mode === 'realistic') {
        this.opponent.root = { ...this.body.root }
        const distance = Math.hypot(previous.x - this.body.root.x, previous.z - this.body.root.z)
        this.opponent.exert(SIM_DT, distance, this.opponent.atT, resting)
        this.player.workout.update(elapsed, (this.player.distance - youDistance) / SIM_DT, this.rally, rallying)
        this.opponent.workout.update(elapsed, (this.opponent.distance - cpuDistance) / SIM_DT, this.rally, rallying)
      }
      this.physics(SIM_DT)
      this.gameCarry -= SIM_DT
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
    const margin = this.w * 0.12
    const maxOff = (Math.max(20, this.w / 2 - margin) * dz) / this.f
    const x = clamp(Math.sign(b.x) * Math.max(0, Math.abs(b.x) - maxOff), -2.6, 2.6)
    const above = ((this.horizon - (this.mode === 'realistic' ? 158 : HUD_TOP)) * dz) / this.f
    // 모바일은 하단 미니맵과 충전 게이지만큼만 여백을 둔다.
    const bottomReserve = this.mode === 'realistic' ? (this.w < 768 ? 190 : 265) : 56
    const below = ((this.h - bottomReserve - this.horizon) * dz) / this.f
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
      this.sfx(e.hit === 'floor' ? 'floor' : 'wall', clamp(Math.hypot(this.ball.v.x, this.ball.v.y, this.ball.v.z) / 15, 0, 1))
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
      if (!r && e.hit === 'back' && this.shot.by === 'cpu') this.planPlayer()
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

    // 상대 차례: 미리 정한 시각에 공이 칠 수 있는 곳에 오면 친다(몸은 그 시각에 맞춰 스윙하고 있다)
    if (this.shot.by === 'you' && this.cpuPlan.returns) {
      this.cpuClock += dt
      if (this.cpuClock >= this.cpuPlan.t - 0.004 && inCpuReach(this.ball, this.shot) && (this.mode !== 'realistic' || this.opponent.canStrike(this.ball.p))) {
        const from = { ...this.ball.p }
        const power = this.cpuPower(from)
        const c = cpuShot(from, this.difficulty, false, Math.random, power)
        if (power != null) this.opponent.hit(power)
        this.ball.v = c.v
        this.shot = newShot('cpu', c.kind, from)
        this.lastShot = { by: 'cpu', kind: c.kind, sharp: 0 }
        this.planPlayer()
        this.rally++
        this.totals.hits++
        if (this.body.swing) {
          this.body.swing.t = 0
          this.body.swing.at = { ...from }
        }
        this.emit()
        this.sfx('hit', 0.6)
      } else if (this.cpuClock > this.cpuPlan.t + 0.3) this.cpuPlan.returns = false
    }
  }

  private configureCpu() {
    const level = CPU_LEVEL[this.difficulty]
    const factor = this.mode === 'realistic' ? this.opponent.speedFactor : 1
    this.body.configure({ maxSpeed: level.maxSpeed * factor, recoverySpeed: (this.mode === 'realistic' ? this.opponent.baseSpeed * 0.65 : level.recoverySpeed) * factor, recoveryDelay: this.mode === 'realistic' ? this.opponent.recoveryTime : level.recoveryDelay, earlyArrival: this.mode === 'realistic' })
  }

  private cpuPower(from: Vec) {
    return this.mode === 'realistic' ? (from.z < 4 ? 0.5 : 0.85) * this.opponent.powerFactor : undefined
  }

  private planPlayer() {
    if (this.mode !== 'realistic') return
    this.playerPlanIn = 0.1
    const pts = sampleReach(this.ball, this.shot, (b, s) => realisticReach(b, s) && this.player.strikeHeight(b.p, s.backWall))
    const root = this.player.root
    const speed = this.player.baseSpeed * this.player.speedFactor
    const can = pts.find((q) => q.t >= this.player.recovery && Math.max(0, Math.hypot(q.p.x - root.x, q.p.z - root.z) - (this.player.racketReach - 0.55)) / speed + 0.12 <= q.t)
    const target = can ?? pts.at(-1)
    this.playerIntercept = target ? { x: target.p.x, z: clamp(target.p.z + 0.4, 1.2, 9.1) } : null
    if (this.playerIntercept) this.player.target = { ...this.playerIntercept }
  }

  /** 공 궤적과 몸의 실제 이동을 함께 예측하고, 모션은 선택한 타점·시각을 따라간다. */
  private planCpu() {
    this.cpuClock = 0
    this.configureCpu()
    this.body.splitStep()
    const last = this.lastShot
    const chance = cpuReturnChance(this.difficulty, last?.kind ?? 'drive', last?.by === 'you' ? last.sharp : 0)
    const { hit, chase } = chooseIntercept(this.ball, this.shot, this.body, this.difficulty, (b, s) => inCpuReach(b, s) && (this.mode !== 'realistic' || this.opponent.strikeHeight(b.p)))
    if (hit && Math.random() < chance) {
      this.cpuPlan = { returns: true, t: hit.t }
      this.body.plan(hit.p, hit.t)
      return
    }
    this.cpuPlan = { returns: false, t: 0 }
    if (chase) this.body.plan(chase.p, chase.t + 0.35, false)
  }

  private endRally(win: Hitter, label: string, reason: RuleKey | null) {
    this.cancelCharge()
    const kept = win === this.server
    this.cpuPlan.returns = false
    this.body.recover()
    this.player.target = { ...T_SPOT }
    this.totals.bestRally = Math.max(this.totals.bestRally, this.rally)
    this.lastRally = rallySummary(this.summary(), this.rallyStart ?? this.summary(), this.rally)
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
    // 점수 알림 뒤에 듀스·게임볼을 이어서 알린다(상태가 바뀔 때만)
    const st = status(this.score)
    if (st && st !== this.lastStatus) {
      const msg = {
        deuce: ['듀스! 2점 앞서야 이겨요', '#f2c230'],
        'game-ball-you': ['게임볼! 1점이면 이겨요', C.tealBright],
        'game-ball-cpu': ['상대 게임볼! 지키세요', '#ff8a7a'],
      }[st]
      this.flash(msg[0], msg[1], 0.8, 0.75)
      this.sfx('alert', 1)
    }
    this.lastStatus = st
    if (winner(this.score)) {
      this.phase = 'over'
    } else {
      this.phase = 'point'
      this.timer = 1.3
    }
    this.emit()
  }

  private flash(text: string, color: string, scale = 1, delay = 0) {
    this.flashes.push({ text, t: -delay, color, scale })
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
      lastShot: this.lastShot ? { by: this.lastShot.by, name: SHOT_NAME[this.lastShot.kind] } : null,
      status: status(this.score),
      summary: this.summary(),
      lastRally: this.lastRally,
      mode: this.mode,
      realism:
        this.mode === 'realistic'
          ? {
              youWorkout: this.player.workout.hud,
              cpuWorkout: this.opponent.workout.hud,
              you: this.player.energy,
              cpu: this.opponent.energy,
              youDistance: this.player.distance,
              cpuDistance: this.opponent.distance,
              youAt: { ...this.player.root },
              cpuAt: { ...this.body.root },
              target: { ...this.player.target },
              atT: this.player.atT,
              charge: chargePower(this.charge?.seconds ?? 0),
              charging: !!this.charge,
              maxPower: this.player.powerFactor,
              lastPower: this.lastPower,
            }
          : null,
    })
  }

  private summary(): MatchSummary {
    const player = (a: Athlete): PlayerSummary => ({ distance: a.distance, calories: a.workout.calories, restCalories: a.workout.hud.restCalories, activeCalories: a.workout.hud.activeCalories, spent: a.spent, recovered: a.recovered })
    return { ...this.totals, mode: this.matchMode, points: this.score.you + this.score.cpu, you: player(this.player), cpu: player(this.opponent) }
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
    const ballBehindCpu = this.ball.p.z < this.body.root.z
    if (!ballBehindCpu) this.drawCpu()
    this.drawBall()
    if (ballBehindCpu) this.drawCpu()
    if (this.pick) this.drawPick()
    this.drawRacketCursor()
    this.drawFlashes()
  }

  /** 옷·피부·머리카락 없이 단색 관절 실루엣으로 표시한다. */
  private drawCpu() {
    const c = this.ctx
    const j: Joints = this.body.joints()
    const color = '#426875'
    const k = (v: Vec) => this.f / Math.max(0.3, CAM.z - v.z)
    const pieces: { depth: number; draw: () => void }[] = []
    // 두 조각으로 나눠 팔이 몸통 앞뒤를 지나는 순서를 유지한다.
    const seg = (a: Vec, b: Vec, width: number) => {
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 }
      for (const [from, to] of [[a, mid], [mid, b]]) {
        pieces.push({ depth: (from.z + to.z) / 2, draw: () => {
          const pa = this.pt(from.x, from.y, from.z), pb = this.pt(to.x, to.y, to.z)
          c.strokeStyle = color
          c.lineWidth = Math.max(1.5, width * (k(from) + k(to)) / 2)
          c.lineCap = 'round'
          c.beginPath()
          c.moveTo(...pa)
          c.lineTo(...pb)
          c.stroke()
        } })
      }
    }
    c.save()
    c.globalAlpha = 1 - clamp((j.pelvis.z - 7.4) / 1.4, 0, 0.45)
    const [sx, sy] = this.pt(j.pelvis.x, 0, j.pelvis.z)
    c.fillStyle = 'rgb(0 0 0 / 0.12)'
    c.beginPath()
    c.ellipse(sx, sy, k(j.pelvis) * 0.35, k(j.pelvis) * 0.08, 0, 0, Math.PI * 2)
    c.fill()
    for (const [hip, knee, ankle, toe] of [
      [j.hipL, j.kneeL, j.ankleL, j.toeL],
      [j.hipR, j.kneeR, j.ankleR, j.toeR],
    ]) {
      seg(hip, knee, 0.12)
      seg(knee, ankle, 0.1)
      seg(ankle, toe, 0.1)
    }
    seg(j.pelvis, j.chest, 0.27)
    seg(j.shoulderL, j.shoulderR, 0.12)
    seg(j.shoulderL, j.elbowL, 0.09)
    seg(j.elbowL, j.handL, 0.075)
    seg(j.shoulderR, j.elbowR, 0.09)
    seg(j.elbowR, j.handR, 0.075)
    pieces.push({ depth: j.head.z, draw: () => {
      const [x, y] = this.pt(j.head.x, j.head.y, j.head.z)
      c.fillStyle = color
      c.beginPath()
      c.arc(x, y, k(j.head) * BODY.headR, 0, Math.PI * 2)
      c.fill()
    } })
    const along = (t: number): Vec => ({
      x: j.handR.x + (j.racketTip.x - j.handR.x) * t,
      y: j.handR.y + (j.racketTip.y - j.handR.y) * t,
      z: j.handR.z + (j.racketTip.z - j.handR.z) * t,
    })
    seg(j.handR, along(0.42), 0.025)
    const head = along(0.72)
    pieces.push({ depth: head.z, draw: () => {
      const [x, y] = this.pt(head.x, head.y, head.z)
      const [tx, ty] = this.pt(j.racketTip.x, j.racketTip.y, j.racketTip.z)
      const neck = along(0.42), [nx, ny] = this.pt(neck.x, neck.y, neck.z)
      c.beginPath()
      c.ellipse(x, y, Math.max(4, Math.hypot(tx - nx, ty - ny) / 2), Math.max(3, k(head) * 0.095), Math.atan2(ty - ny, tx - nx), 0, Math.PI * 2)
      c.lineWidth = Math.max(1.5, k(head) * 0.025)
      c.strokeStyle = color
      c.stroke()
    } })
    pieces.sort((a, b) => a.depth - b.depth).forEach((p) => p.draw())
    c.restore()
  }

  /** 쉬움 모드: 멈춘 화면에서 공을 가운데로 크게 보여 주고 칠 곳을 고르게 한다 */
  private drawPick() {
    const c = this.ctx
    const { cx, cy, R, e } = this.pickGeom()
    const serve = this.pick!.serve
    c.fillStyle = `rgb(10 12 13 / ${0.62 * e})`
    c.fillRect(0, 0, this.w, this.h)
    const ballR = R * 0.13
    this.drawZones(cx, cy, R, ballR)
    // 공
    c.fillStyle = C.ink
    c.beginPath()
    c.arc(cx, cy, ballR, 0, Math.PI * 2)
    c.fill()
    c.strokeStyle = 'rgb(255 255 255 / 0.7)'
    c.lineWidth = 1.5
    c.stroke()
    c.fillStyle = '#f2c230'
    c.beginPath()
    c.arc(cx - ballR * 0.35, cy - ballR * 0.3, ballR * 0.2, 0, Math.PI * 2)
    c.arc(cx + ballR * 0.05, cy - ballR * 0.45, ballR * 0.2, 0, Math.PI * 2)
    c.fill()
    if (e < 0.5) return
    c.globalAlpha = (e - 0.5) * 2
    c.textAlign = 'center'
    c.fillStyle = '#ffffff'
    c.font = `800 ${clamp(this.w / 18, 19, 26)}px 'Pretendard Variable', sans-serif`
    c.fillText(serve ? '어떤 서브를 넣을까요?' : '공의 어디를 칠까요?', cx, cy - R - 44)
    c.font = `600 ${clamp(this.w / 30, 13, 16)}px 'Pretendard Variable', sans-serif`
    c.fillStyle = 'rgb(255 255 255 / 0.75)'
    c.fillText('라켓이 공을 때릴 곳을 누르세요', cx, cy - R - 20)
    // 공이 붙어 있는 벽: 벽 쪽을 치면 크로스, 반대쪽(안쪽)을 치면 보스트
    if (!serve) {
      const s = Math.sign(this.ball.p.x) || 1
      const wx = cx + s * (R + 16)
      c.fillStyle = 'rgb(233 236 235 / 0.9)'
      c.fillRect(wx - 3, cy - R * 0.9, 6, R * 1.8)
      c.font = `700 ${clamp(this.w / 32, 12, 15)}px 'Pretendard Variable', sans-serif`
      c.fillText(s > 0 ? '오른쪽 벽' : '왼쪽 벽', Math.min(this.w - 34, Math.max(34, wx)), cy + R + 26)
      c.fillStyle = 'rgb(255 255 255 / 0.7)'
      c.fillText(s > 0 ? '포핸드' : '백핸드', cx, cy + R + 26)
    }
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
    if (this.yourBallNow() && !this.pick) {
      // 칠 수 있을 때 공 둘레에 틸 링
      const pulse = 1 + Math.sin(performance.now() / 90) * 0.08
      c.strokeStyle = C.tealBright
      c.lineWidth = 3
      c.beginPath()
      c.arc(s.x, s.y, this.hitRadius(s.r) * 0.55 * pulse, 0, Math.PI * 2)
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

  /**
   * 쉬움 모드: 공 둘레를 칠 곳별로 나눠 무슨 샷이 나가는지 보여 준다.
   * 공이 오른쪽에 있으면 왼쪽 칸이 보스트, 가운데가 드라이브, 오른쪽 칸이 크로스(왼쪽이면 반대).
   */
  private drawZones(cx: number, cy: number, R: number, ballR: number) {
    const size = clamp(R / 6.5, 12, 21)
    const c = this.ctx
    const s = Math.sign(this.ball.p.x) || 1
    const serve = this.phase === 'serve-you'
    const cw = ZONE.col * R
    const rh = ZONE.row * R
    c.save()
    c.beginPath()
    c.arc(cx, cy, R, 0, Math.PI * 2)
    c.fillStyle = 'rgb(20 22 24 / 0.42)'
    c.fill()
    c.clip()
    // 마우스가 올라간 칸을 칠해 둔다
    if (this.pointer && Math.hypot(this.pointer.x - cx, this.pointer.y - cy) <= R) {
      const dx = (this.pointer.x - cx) / R
      const dy = (this.pointer.y - cy) / R
      const col = Math.abs(dx) <= ZONE.col ? 0 : Math.sign(dx)
      const row = dy < -ZONE.row ? -1 : dy > ZONE.row ? 1 : 0
      const inner = !serve && col !== 0 && col !== s
      c.fillStyle = 'rgb(25 163 174 / 0.35)'
      const x0 = col === 0 ? cx - cw : col < 0 ? cx - R : cx + cw
      const x1 = col === 0 ? cx + cw : col < 0 ? cx - cw : cx + R
      const y0 = inner || serve ? cy - R : row === 0 ? cy - rh : row < 0 ? cy - R : cy + rh
      const y1 = inner || serve ? cy + R : row === 0 ? cy + rh : row < 0 ? cy - rh : cy + R
      if (serve) c.fillRect(cx - R, row < 0 ? cy - R : cy - rh, 2 * R, row < 0 ? R - rh : R + rh)
      else c.fillRect(x0, y0, x1 - x0, y1 - y0)
    }
    c.strokeStyle = 'rgb(255 255 255 / 0.5)'
    c.lineWidth = 1.2
    c.beginPath()
    if (!serve) {
      for (const x of [cx - cw, cx + cw]) {
        c.moveTo(x, cy - R)
        c.lineTo(x, cy + R)
      }
    }
    // 가로줄: 서브는 위(하드 서브)/나머지(로브 서브), 랠리는 안쪽 칸(보스트)을 빼고
    const innerX = s > 0 ? cx - cw : cx + cw
    for (const y of serve ? [cy - rh] : [cy - rh, cy + rh]) {
      c.moveTo(serve ? cx - R : s > 0 ? innerX : cx - R, y)
      c.lineTo(serve ? cx + R : s > 0 ? cx + R : innerX, y)
    }
    c.stroke()
    c.restore()
    c.beginPath()
    c.arc(cx, cy, R, 0, Math.PI * 2)
    c.strokeStyle = C.tealBright
    c.lineWidth = 2.5
    c.stroke()

    const label = (text: string, x: number, y: number, strong = false) => {
      c.font = `${strong ? 800 : 700} ${size}px 'Pretendard Variable', sans-serif`
      c.textAlign = 'center'
      text.split('\n').forEach((line, i, all) => {
        const ly = y + (i - (all.length - 1) / 2) * size * 1.1 + size * 0.35
        c.fillStyle = strong ? '#ffffff' : 'rgb(255 255 255 / 0.92)'
        c.fillText(line, x, ly)
      })
    }
    if (serve) {
      label('하드 서브', cx, cy - (R + rh) / 2)
      label('로브 서브', cx, cy + R * 0.45, true)
      return
    }
    const mid = (R + cw) / 2
    const outerX = cx + s * mid
    const innerLX = cx - s * mid
    const rowY = [cy - (R + rh) / 2 + size * 0.2, cy, cy + (R + rh) / 2 - size * 0.2]
    label('드롭', cx, rowY[0])
    label('드라이브', cx, cy - Math.max(size * 1.1, ballR + size * 0.7), true)
    label('로브', cx, rowY[2])
    label('크로스\n드롭', outerX, rowY[0])
    label('크로스', outerX, rowY[1], true)
    label('크로스\n로브', outerX, rowY[2])
    label('보스트', innerLX, cy, true)
  }

  // 헤로우 Response 115 모양 라켓: 실버 프레임, 틸 포인트, 흰 그립.
  // PC 커서는 포핸드면 라켓 손잡이가 오른쪽 아래, 백핸드면 왼쪽 아래. 칠 때는 손을 축으로 라켓을 휘두른다
  private drawRacketCursor() {
    const size = clamp(this.h * 0.11, 52, 92)
    const side = this.handSide()
    if (this.pointer && !this.pick) this.drawRacket(this.pointer.x, this.pointer.y, side * 0.6, 0.9, size)
    for (const sw of this.swings) {
      const k = Math.min(1, sw.t / 0.32)
      const e = 1 - (1 - k) ** 3
      // 손(그립)은 공보다 아래·몸 쪽, 라켓 머리가 공 쪽(포핸드는 오른쪽, 백핸드는 왼쪽)을 향한 채 공을 지나간다
      const gx = sw.x - sw.side * size * 0.55
      const gy = sw.y + size * 0.9
      const mid = Math.atan2(sw.x - gx, -(sw.y - gy))
      const from = mid - sw.side * 1.35
      const to = mid + sw.side * 1.15
      const alpha = (1 - k * 0.85) * (sw.good ? 1 : 0.55)
      // 휘두른 자국
      const c = this.ctx
      c.save()
      c.strokeStyle = `rgb(255 255 255 / ${0.45 * (1 - k)})`
      c.lineWidth = size * 0.12
      c.lineCap = 'round'
      c.beginPath()
      const r = size * 1.02
      const a0 = from - Math.PI / 2
      const a1 = from + (to - from) * e - Math.PI / 2
      c.arc(gx, gy, r, Math.min(a0, a1), Math.max(a0, a1))
      c.stroke()
      c.restore()
      for (const lag of [0.18, 0.09, 0]) {
        const ang = from + (to - from) * Math.max(0, e - lag)
        this.drawRacketAt(gx, gy, ang, lag ? alpha * 0.25 : alpha, size, sw.side)
      }
    }
  }

  /** 라켓 머리 가운데가 (x, y)에 오게 */
  private drawRacket(x: number, y: number, angle: number, alpha: number, size: number) {
    const gx = x - Math.sin(angle) * size * 1.02
    const gy = y + Math.cos(angle) * size * 1.02
    this.drawRacketAt(gx, gy, angle, alpha, size, angle > 0 ? 1 : -1)
  }

  /** 그립 끝(gx, gy)을 축으로 angle만큼 기운 라켓 */
  private drawRacketAt(gx: number, gy: number, angle: number, alpha: number, size: number, side: number) {
    const c = this.ctx
    c.save()
    c.globalAlpha = alpha
    c.translate(gx, gy)
    c.rotate(angle)
    c.translate(0, -size * 0.9)
    if (side < 0) c.scale(-1, 1)
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

  private drawFlashes() {
    const c = this.ctx
    for (const f of this.flashes) {
      if (f.t < 0) continue // 아직 나올 차례가 아닌 알림
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

  /**
   * 소리를 켠다. 브라우저는 사용자가 누른 순간에만 소리를 허락하므로 시작 버튼과 첫 터치에서 부른다.
   * 아이폰은 무음 스위치가 켜져 있으면 Web Audio가 꺼지는데, 오디오 세션을 '재생'으로 두면 들린다.
   */
  unlockAudio() {
    if (!this.sound) return
    try {
      const nav = navigator as Navigator & { audioSession?: { type: string } }
      if (nav.audioSession) nav.audioSession.type = 'playback'
      if (!this.audio) {
        this.audio = new AudioContext()
        this.master = this.audio.createDynamicsCompressor()
        this.master.connect(this.audio.destination)
        // 짧은 잡음(공 맞는 소리 재료)을 한 번만 만들어 둔다
        const len = Math.floor(this.audio.sampleRate * 0.12)
        this.noise = this.audio.createBuffer(1, len, this.audio.sampleRate)
        const d = this.noise.getChannelData(0)
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2)
      }
      if (this.audio.state === 'suspended') void this.audio.resume()
    } catch {
      this.audio = null
    }
  }

  private sfx(kind: 'hit' | 'wall' | 'floor' | 'win' | 'lose' | 'alert', strength: number) {
    const a = this.audio
    if (!this.sound || !a || !this.master || a.state !== 'running') return
    const t = a.currentTime
    const out = this.master
    // 잡음을 걸러 "탁" 하는 타구음·벽 소리를 만든다
    const burst = (freq: number, q: number, gain: number, len: number) => {
      if (!this.noise) return
      const src = a.createBufferSource()
      src.buffer = this.noise
      const f = a.createBiquadFilter()
      f.type = 'bandpass'
      f.frequency.value = freq
      f.Q.value = q
      const g = a.createGain()
      g.gain.setValueAtTime(gain, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + len)
      src.connect(f).connect(g).connect(out)
      src.start(t)
      src.stop(t + len + 0.02)
    }
    const tone = (from: number, to: number, type: OscillatorType, gain: number, len: number, at = 0) => {
      const o = a.createOscillator()
      const g = a.createGain()
      o.type = type
      o.frequency.setValueAtTime(from, t + at)
      o.frequency.exponentialRampToValueAtTime(to, t + at + len)
      g.gain.setValueAtTime(0.0001, t + at)
      g.gain.exponentialRampToValueAtTime(gain, t + at + 0.01)
      g.gain.exponentialRampToValueAtTime(0.001, t + at + len)
      o.connect(g).connect(out)
      o.start(t + at)
      o.stop(t + at + len + 0.02)
    }
    if (kind === 'hit') {
      // 라켓 줄에 맞는 날카로운 소리 + 짧은 울림
      burst(1800 + strength * 900, 1.2, 0.9, 0.07)
      tone(260, 140, 'triangle', 0.35, 0.06)
    } else if (kind === 'wall') {
      // 앞벽·옆벽에 맞는 둔탁한 소리
      burst(650, 0.9, 0.55 * strength + 0.25, 0.09)
      tone(120, 70, 'sine', 0.35, 0.08)
    } else if (kind === 'floor') {
      burst(420, 1.1, 0.25, 0.05)
    } else if (kind === 'win') {
      tone(660, 660, 'sine', 0.25, 0.12)
      tone(990, 990, 'sine', 0.25, 0.22, 0.1)
    } else if (kind === 'lose') {
      tone(330, 220, 'sine', 0.25, 0.32)
    } else {
      tone(880, 880, 'square', 0.12, 0.08)
      tone(1175, 1175, 'square', 0.12, 0.14, 0.11)
    }
  }
}
