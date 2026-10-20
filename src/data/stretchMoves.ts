import type { Limb, Move, Pose } from '../components/rig'

// 스트레칭마다 막대 인형 동작. 이름은 stretches.ts의 name과 같다.
// 옆모습: 인형은 오른쪽을 본다. a = 가까운 다리, ha = 가까운 팔. 정면: a = 화면 오른쪽.

const ARM_A: Limb = [8, 14]
const ARM_B: Limb = [-6, 6]
const STAND = { a: [0, 0], b: [0, 0], ha: ARM_A, hb: ARM_B } satisfies Partial<Pose>
const swap = (k: Pose): Pose => ({ ...k, a: k.b, b: k.a, ha: k.hb, hb: k.ha })
const twice = (...k: Pose[]) => [...k, ...k]
const floor = (x: number): Limb => ({ to: [x, 0] })

export const MOVES: Record<string, Move> = {
  // ---------- 운동 전 ----------
  '가볍게 뛰며 몸 데우기': (() => {
    const jog: Pose = { a: [30, -15], b: [-18, -55], ha: [-35, 45], hb: [35, 105], lift: 2, dur: 0.3, hold: 0 }
    const knee: Pose = { a: [92, 4], b: [0, 0], ha: [-40, 40], hb: [50, 130], lift: 3, dur: 0.3, hold: 0.05, step: 1 }
    const kick: Pose = { a: [-6, -160], b: [0, 0], ha: [-30, 50], hb: [30, 100], lift: 3, dur: 0.3, hold: 0.05, step: 1 }
    return { view: 'side', focus: ['thighA', 'shinA'], keys: [...twice(jog, swap(jog)), ...twice(knee, swap(knee)), ...twice(kick, swap(kick))] }
  })(),

  '발목 돌리기와 까치발': {
    view: 'side',
    focus: ['footA', 'shinA'],
    ground: ['hipB', 'kneeB', 'ankleB', 'toeB'],
    keys: [
      ...twice({ ...STAND, a: [28, -4, 35], dur: 0.45, hold: 0 }, { ...STAND, a: [28, -4, 85], dur: 0.45, hold: 0 }),
      { ...STAND, dur: 0.5 },
      ...twice({ ...STAND, a: [0, 0, 38], b: [0, 0, 38], ha: [10, 20], hold: 0.35, step: 1 }, { ...STAND, hold: 0.25, step: 1 }),
    ],
  },

  '앞뒤 다리 흔들기': (() => {
    const base = { b: [0, 0], ha: [10, 16], hb: { to: [26, 60] } } satisfies Partial<Pose>
    return {
      view: 'side',
      focus: ['thighA'],
      bar: 28,
      keys: [
        { ...base, a: [0, 0], hold: 0.4 },
        ...twice({ ...base, a: [30, 22], dur: 0.45, hold: 0, step: 1 }, { ...base, a: [-15, -22], dur: 0.45, hold: 0, step: 1 }),
        ...twice({ ...base, a: [70, 62], dur: 0.55, hold: 0, step: 1 }, { ...base, a: [-35, -48], dur: 0.55, hold: 0, step: 1 }),
      ],
    }
  })(),

  '옆으로 다리 흔들기': (() => {
    const base = { b: [0, 0], ha: [70, 160, 0, 0.7], hb: [-70, -160, 0, 0.7] } satisfies Partial<Pose>
    return {
      view: 'front',
      focus: ['thighA'],
      keys: twice({ ...base, a: [-28, -26], dur: 0.5, hold: 0 }, { ...base, a: [48, 45], dur: 0.5, hold: 0 }),
    }
  })(),

  '고관절 열고 닫기': (() => {
    const arms = { ha: [50, -40], hb: [-50, 40], b: [0, 0] } satisfies Partial<Pose>
    const down: Pose = { ...arms, a: [0, 0] }
    const up: Pose = { ...arms, a: [172, 2, 90, 0.15] }
    const side: Pose = { ...arms, a: [96, 6] }
    return {
      view: 'front',
      focus: ['thighA'],
      keys: [
        { ...down, hold: 0.3 },
        { ...up, dur: 0.6, hold: 0.05 },
        { ...side, dur: 0.6, hold: 0.05 },
        { ...down, dur: 0.6, hold: 0.4 },
        { ...side, dur: 0.6, hold: 0.05, step: 1 },
        { ...up, dur: 0.6, hold: 0.05, step: 1 },
        { ...down, dur: 0.6, hold: 0.3, step: 1 },
      ],
    }
  })(),

  '워킹 런지 + 몸통 돌리기': (() => {
    const arms = { ha: [80, 100], hb: [80, 100] } satisfies Partial<Pose>
    const lunge: Pose = { ...arms, a: [80, 0], b: [-25, -95, 90], dur: 0.8 }
    const turn: Pose = { ...lunge, ha: [-55, -25, 0, 0.9], hb: [100, 65], dur: 0.6, hold: 0.5 }
    const stand: Pose = { ...arms, a: [0, 0], b: [0, 0], dur: 0.8, hold: 0.2 }
    return {
      view: 'side',
      focus: ['thighA', 'thighB', 'torso'],
      keys: [
        stand,
        lunge,
        turn,
        { ...lunge, dur: 0.5 },
        { ...stand, step: 1 },
        { ...swap(lunge), step: 1 },
        { ...swap(lunge), ha: [100, 65], hb: [-55, -25, 0, 0.9], dur: 0.6, hold: 0.5, step: 1 },
        { ...swap(lunge), dur: 0.5, step: 1 },
      ],
    }
  })(),

  '사이드 런지': (() => {
    const arms = { ha: [50, -40], hb: [-50, 40] } satisfies Partial<Pose>
    const feet = { a: { to: [30, 0], bend: 1 }, b: { to: [-30, 0], bend: -1 } } satisfies Partial<Pose>
    return {
      view: 'front',
      focus: ['thighA', 'thighB'],
      keys: [
        { ...arms, ...feet, h: 38, hold: 0.3 },
        { ...arms, ...feet, h: 28, x: 14, dur: 0.9, hold: 0.6 },
        { ...arms, ...feet, h: 38, dur: 0.8, hold: 0.2 },
        { ...arms, ...feet, h: 28, x: -14, dur: 0.9, hold: 0.6, step: 1 },
        { ...arms, ...feet, h: 38, dur: 0.8, step: 1 },
      ],
    }
  })(),

  인치웜: (() => {
    const legs = (t: number, f = 90): Partial<Pose> => ({ a: [t, t, f], b: [t, t, f] })
    return {
      view: 'side',
      anchor: 'toeA',
      focus: ['thighA', 'torso'],
      keys: [
        { ...STAND, ...legs(0), hold: 0.4 },
        { ...legs(0), lean: 150, head: 20, ha: floor(14), hb: floor(18), dur: 1, hold: 0.2 } as Pose,
        { ...legs(-22, 95), lean: 122, head: 15, ha: floor(32), hb: floor(24), dur: 0.6, hold: 0.1 } as Pose,
        { ...legs(-48, 100), lean: 100, head: 5, ha: floor(46), hb: floor(52), dur: 0.6, hold: 0.1 } as Pose,
        { ...legs(-75, 105), lean: 75, ha: floor(68), hb: floor(68), dur: 0.6, hold: 0.6 } as Pose,
        { ...legs(-48, 100), lean: 100, head: 5, ha: floor(46), hb: floor(52), dur: 0.6, hold: 0.1, step: 1 } as Pose,
        { ...legs(-22, 95), lean: 122, head: 15, ha: floor(32), hb: floor(24), dur: 0.6, hold: 0.1, step: 1 } as Pose,
        { ...legs(0), lean: 150, head: 20, ha: floor(14), hb: floor(18), dur: 0.6, hold: 0.1, step: 1 } as Pose,
        { ...STAND, ...legs(0), dur: 1, step: 1 },
      ],
    }
  })(),

  '플랭크와 데드버그': (() => {
    const plank: Pose = { lean: 88, a: [-80, -80, 110], b: [-80, -80, 110], ha: [0, 90], hb: [0, 90] }
    const table: Pose = { lean: -90, a: [180, 90], b: [180, 90], ha: [180, 180], hb: [180, 180], step: 1 }
    return {
      view: 'side',
      focus: ['torso'],
      mat: true,
      keys: [
        { ...plank, cut: true, hold: 2.4 },
        { ...table, cut: true, hold: 0.4 },
        { ...table, ha: [250, 250], b: [96, 96], dur: 0.8, hold: 0.4 },
        { ...table, dur: 0.8, hold: 0.2 },
        { ...table, hb: [250, 250], a: [96, 96], dur: 0.8, hold: 0.4 },
        { ...table, dur: 0.8, hold: 0.3 },
      ],
    }
  })(),

  '어깨·손목 풀고 빈 스윙': (() => {
    const legs = { a: [8, -4], b: [-8, -12] } satisfies Partial<Pose>
    const circle = [0, 90, 180, 270].map((d): Pose => ({ ...legs, ha: [d, d], hb: [d, d], dur: 0.32, hold: 0, lin: true }))
    return {
      view: 'side',
      focus: ['upperA', 'foreA'],
      keys: [
        ...twice(...circle),
        { ...legs, ha: [10, 20], hb: [-5, 5], dur: 0.4 },
        { ...legs, ha: [110, 175, 10], hb: [45, 90], racket: 1, dur: 0.6, hold: 0.2, step: 1 },
        { ...legs, ha: [140, 215, -10], hb: [40, 90], racket: 1, dur: 0.4, hold: 0.05, step: 1 },
        { ...legs, ha: [70, 85], hb: [20, 60], racket: 1, dur: 0.3, hold: 0, step: 1 },
        { ...legs, ha: [150, 150, 30], hb: [10, 40], racket: 1, dur: 0.35, hold: 0.3, step: 1 },
        { ...legs, ha: [10, 20], hb: [-5, 5], racket: 0, dur: 0.6 },
      ],
    }
  })(),

  '스플릿 스텝과 고스팅': (() => {
    const ready: Pose = { lean: 15, a: [25, -10], b: [-15, -35], ha: [60, 140], hb: [40, 90], racket: 1 }
    return {
      view: 'side',
      focus: ['shinA', 'shinB', 'thighA'],
      keys: [
        { ...ready, hold: 0.4 },
        { ...ready, a: [12, -4], b: [-8, -18], lift: 7, dur: 0.25, hold: 0 },
        { ...ready, lean: 20, a: [35, -5], b: [-30, -50], dur: 0.2, hold: 0.1 },
        { ...ready, lean: 35, a: [85, 5], b: [-35, -82], ha: [85, 85], dur: 0.45, hold: 0.4 },
        { ...ready, dur: 0.5, hold: 0.3, step: 1 },
      ],
    }
  })(),

  // ---------- 운동 후 ----------
  '종아리 벽 스트레칭': (() => {
    const hands = { ha: { to: [36.5, 84] }, hb: { to: [36.5, 78] } } satisfies Partial<Pose>
    return {
      view: 'side',
      focus: ['shinA', 'footA'],
      wall: 40,
      keys: [
        { ...hands, lean: 25, a: [-28, -28, 120], b: [35, 8], dur: 1, hold: 2.4 },
        { ...hands, lean: 22, a: [-22, -10, 102], b: [40, 12], dur: 1, hold: 2.4, step: 1 },
      ],
    }
  })(),

  '햄스트링 늘이기': (() => {
    const legs = { a: [90, 90], b: [127, 39, 90, 0.43, 0.3] } satisfies Partial<Pose>
    return {
      view: 'side',
      focus: ['thighA'],
      mat: true,
      keys: [
        { ...legs, lean: 12, ha: { to: 'kneeA' }, hb: { to: 'kneeA' }, dur: 1.2, hold: 0.8 },
        { ...legs, lean: 52, head: 15, ha: { to: 'ankleA' }, hb: { to: 'ankleA' }, dur: 1.6, hold: 2.2, step: 1 },
      ],
    }
  })(),

  '허벅지 앞 늘이기': {
    view: 'side',
    focus: ['thighA'],
    keys: [
      { a: [0, 0], b: [0, 0], ha: ARM_A, hb: [20, 40], hold: 0.4 },
      { a: [-6, -168], b: [0, 0], ha: { to: 'ankleA' }, hb: [75, 85], dur: 1, hold: 1.4 },
      { a: [-16, -170], b: [0, 0], ha: { to: 'ankleA' }, hb: [75, 85], dur: 0.8, hold: 2, step: 1 },
    ],
  },

  '하프 닐링 고관절 늘이기': (() => {
    const front = { b: { to: [32, 0] }, ha: { to: 'kneeB' }, hb: { to: 'kneeB' } } satisfies Partial<Pose>
    return {
      view: 'side',
      anchor: 'kneeA',
      ground: ['hip', 'kneeA', 'ankleA', 'toeA'],
      focus: ['thighA'],
      mat: true,
      keys: [
        { ...front, a: [-14, -92, -3], dur: 1, hold: 1 },
        { ...front, a: [-32, -95, -3], lean: -4, dur: 1.2, hold: 2.2, step: 1 },
      ],
    }
  })(),

  '엉덩이 4자 스트레칭': {
    view: 'side',
    focus: ['thighA'],
    mat: true,
    keys: [
      { lean: -90, a: floor(30), b: floor(30), ha: [90, 90], hb: [90, 90], hold: 0.5 },
      { lean: -90, a: { to: 'kneeB' }, b: floor(30), ha: [90, 90], hb: [90, 90], dur: 0.9, hold: 0.6 },
      { lean: -90, a: { to: 'kneeB' }, b: [150, 95], ha: { to: 'kneeB', bend: 1 }, hb: { to: 'kneeB', bend: 1 }, dur: 1.1, hold: 2.4, step: 1 },
    ],
  },

  '나비 자세': {
    view: 'front',
    focus: ['thighA', 'thighB'],
    ground: ['hip'],
    mat: true,
    keys: [
      { a: [110, -71, 90, 0.8], b: [-110, 71, 90, 0.8], ha: { to: 'ankleA', bend: 1 }, hb: { to: 'ankleB', bend: -1 }, hold: 0.6 },
      { a: [98, -81, 90, 0.8], b: [-98, 81, 90, 0.8], ha: { to: 'ankleA', bend: 1 }, hb: { to: 'ankleB', bend: -1 }, dur: 1.4, hold: 1.2 },
      { a: [98, -81, 90, 0.8], b: [-98, 81, 90, 0.8], torso: 0.78, ha: { to: 'ankleA', bend: 1 }, hb: { to: 'ankleB', bend: -1 }, dur: 1.2, hold: 2, step: 1 },
    ],
  },

  '허리 비틀기와 아기 자세': (() => {
    const lie: Pose = { lean: -90, a: floor(30), b: floor(30), ha: [270, 270, 0, 0.55], hb: [270, 270, 0, 0.55] }
    const child: Pose = { lean: 100, head: 30, a: [75, -95, -5], b: [75, -95, -5], ha: floor(56), hb: floor(54), step: 1 }
    return {
      view: 'side',
      focus: ['torso'],
      mat: true,
      keys: [
        { ...lie, cut: true, hold: 0.5 },
        { ...lie, a: [100, 30], b: [104, 36], dur: 1.2, hold: 1.8 },
        { ...lie, dur: 1, hold: 0.4 },
        { ...child, cut: true, hold: 1.4 },
        { ...child, lean: 104, ha: floor(60), hb: floor(58), dur: 1.2, hold: 1.4 },
      ],
    }
  })(),

  '팔뚝·손목 늘이기': {
    view: 'side',
    focus: ['foreA', 'palmA'],
    keys: [
      { ...STAND, hold: 0.4 },
      { ...STAND, ha: [90, 90, -75], hb: { to: 'fingersA' }, dur: 1, hold: 2 },
      { ...STAND, ha: [90, 90, 0], hb: [40, 70], dur: 0.6, hold: 0.2 },
      { ...STAND, ha: [90, 90, 75], hb: { to: 'fingersA' }, dur: 1, hold: 2 },
      { ...STAND, dur: 0.8, step: 1 },
    ],
  },

  '어깨 늘이기': {
    view: 'front',
    focus: ['upperA'],
    keys: [
      { a: [0, 0], b: [0, 0], ha: [6, 4], hb: [-6, -4], hold: 0.4 },
      { a: [0, 0], b: [0, 0], ha: [-80, -86], hb: { to: 'elbowA' }, dur: 1, hold: 2 },
      { a: [0, 0], b: [0, 0], ha: [6, 4], hb: [-6, -4], dur: 0.8, hold: 0.3, step: 1 },
      { a: [0, 0], b: [0, 0], ha: [192, -5], hb: { to: 'elbowA', bend: 1 }, dur: 1.1, hold: 2, step: 1 },
    ],
  },

  // ---------- 폼롤러 ----------
  종아리: {
    view: 'side',
    focus: ['shinA'],
    roller: { seg: 'shinA' },
    mat: true,
    keys: [
      { lean: -60, a: [96, 92], b: [96, 92], ha: { ...floor(-58), end: -90 }, hb: { ...floor(-56), end: -90 }, roll: 0.2, dur: 1.6 },
      { lean: -60, a: [96, 92], b: [96, 92], ha: { ...floor(-58), end: -90 }, hb: { ...floor(-56), end: -90 }, roll: 0.85, dur: 1.6 },
      { lean: -60, a: [96, 92], b: [88, 80], ha: { ...floor(-58), end: -90 }, hb: { ...floor(-56), end: -90 }, roll: 0.2, dur: 1.6, step: 1 },
      { lean: -60, a: [96, 92], b: [88, 80], ha: { ...floor(-58), end: -90 }, hb: { ...floor(-56), end: -90 }, roll: 0.85, dur: 1.6, step: 1 },
    ],
  },

  '허벅지 뒤': {
    view: 'side',
    focus: ['thighA'],
    roller: { seg: 'thighA' },
    mat: true,
    keys: [
      { lean: -60, a: [92, 92], b: [92, 92], ha: { ...floor(-38), end: -90 }, hb: { ...floor(-36), end: -90 }, roll: 0.2, dur: 1.6 },
      { lean: -60, a: [92, 92], b: [92, 92], ha: { ...floor(-38), end: -90 }, hb: { ...floor(-36), end: -90 }, roll: 0.85, dur: 1.6 },
    ],
  },

  '허벅지 앞': {
    view: 'side',
    focus: ['thighA'],
    roller: { seg: 'thighA' },
    mat: true,
    keys: [
      { lean: 80, a: [-90, -90, 170], b: [-90, -90, 170], ha: [0, 90], hb: [0, 90], roll: 0.15, dur: 1.6 },
      { lean: 80, a: [-90, -90, 170], b: [-90, -90, 170], ha: [0, 90], hb: [0, 90], roll: 0.8, dur: 1.6 },
    ],
  },

  '허벅지 바깥': {
    view: 'side',
    focus: ['thighA'],
    roller: { seg: 'thighA' },
    mat: true,
    keys: [
      { lean: -80, a: [90, 90], b: { to: [8, 0] }, ha: [0, -90], hb: [100, 60], roll: 0.15, dur: 1.8 },
      { lean: -80, a: [90, 90], b: { to: [8, 0] }, ha: [0, -90], hb: [100, 60], roll: 0.75, dur: 1.8 },
    ],
  },

  엉덩이: {
    view: 'side',
    focus: ['thighA'],
    roller: { under: 'hip' },
    mat: true,
    keys: [
      { lean: -25, b: floor(24), a: { to: 'kneeB' }, ha: { ...floor(-20), end: -90 }, hb: { ...floor(-18), end: -90 }, roll: -3, dur: 1.4 },
      { lean: -25, b: floor(24), a: { to: 'kneeB' }, ha: { ...floor(-20), end: -90 }, hb: { ...floor(-18), end: -90 }, roll: 3, dur: 1.4 },
    ],
  },

  '등 위쪽': {
    view: 'side',
    focus: ['torso'],
    roller: { seg: 'torso' },
    mat: true,
    keys: [
      { lean: -80, a: floor(46), b: floor(46), ha: { to: 'head', bend: 1 }, hb: { to: 'head', bend: 1 }, roll: 0.55, dur: 1.6 },
      { lean: -80, a: floor(46), b: floor(46), ha: { to: 'head', bend: 1 }, hb: { to: 'head', bend: 1 }, roll: 0.85, dur: 1.6 },
    ],
  },
}
