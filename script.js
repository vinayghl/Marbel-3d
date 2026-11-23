import * as THREE from 'https://esm.sh/three@0.170.0';
import { OrbitControls } from 'https://esm.sh/three@0.170.0/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'https://esm.sh/three@0.170.0/examples/jsm/environments/RoomEnvironment.js';
import RAPIER from 'https://esm.sh/@dimforge/rapier3d-compat@0.14.0';

// ============================================================================
// Constants & Presets
// ============================================================================
const BALL_RADIUS = 0.4;
const FIXED_DT = 1 / 120;
const MAX_SUBSTEPS_PER_FRAME = 30;
const FOLLOW_SHOT_ANGLES = ['Chase', 'Low Bumper', 'Side Drone', 'Reverse Cam'];

const GRAVITY_PRESETS = {
  moon: { label: 'Moon', value: 3.7 },
  earth: { label: 'Earth', value: 9.81 },
  heavy: { label: 'Heavy', value: 16.0 },
  turbo: { label: 'Turbo', value: 22.0 },
};

const FRICTION_PRESETS = {
  ice: { label: 'Ice', friction: 0.04, restitution: 0.55 },
  polished: { label: 'Polished', friction: 0.18, restitution: 0.45 },
  rubber: { label: 'Rubber', friction: 0.45, restitution: 0.62 },
  grip: { label: 'High Grip', friction: 0.75, restitution: 0.35 },
};

const HURDLE_SIZE_SCALES = {
  small: 0.78,
  medium: 1.0,
  large: 1.32,
};

const ALL_OBSTACLE_TYPES = [
  'rotating_bar',
  'moving_gate',
  'speed_bump',
  'spinning_wheel',
  'jump_ramp',
  'narrow_passage',
  'moving_platform',
];

const COLOR_PALETTES = {
  grandprix: [
    '#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#ec4899',
    '#06b6d4', '#f97316', '#8b5cf6', '#eab308', '#14b8a6',
    '#e11d48', '#2563eb', '#84cc16', '#a855f7', '#0ea5e9',
  ],
  mineral: [
    '#d97706', '#0d9488', '#dc2626', '#4f46e5', '#059669',
    '#b45309', '#0284c7', '#be185d', '#65a30d', '#7c3aed',
    '#ea580c', '#0891b2', '#9f1239', '#4338ca', '#15803d',
  ],
  contrast: [
    '#d62828', '#0077b6', '#e9c46a', '#2a9d8f', '#e76f51',
    '#6d597a', '#f4f1de', '#b5179e', '#1d3557', '#606c38',
    '#bc6c25', '#457b9d', '#e63946', '#4a4e69', '#f4a261',
  ],
  pastel: [
    '#e8a598', '#89b0ae', '#f3d58d', '#81b29a', '#d4a5a5',
    '#98c1d9', '#f2cc8f', '#b5a8d5', '#a3b18a', '#7fb3b5',
    '#e29578', '#8e9aaf', '#ede0d4', '#cbb2d6', '#90b4ce',
  ],
  steel: [
    '#c97b2b', '#d9dde2', '#3a7ca5', '#b93848', '#7d8590',
    '#d9a441', '#bcc3cc', '#2c668d', '#c45b67', '#5c646d',
    '#dfc070', '#eef1f4', '#4d8fae', '#a32c3b', '#41474e',
  ],
  ultradark: [
    '#b80014', '#0038d4', '#007a24', '#6200b8', '#c93800',
    '#b87400', '#a80063', '#006e7a', '#8c0028', '#1452cc',
    '#4a7a00', '#42009e', '#b81c00', '#005c9e', '#8f3b00',
  ],
};

const COLOR_DARKNESS_PRESETS = {
  standard: {
    label: 'Standard',
    satBoost: 1.0,
    skyMul: 1.0,
    fogMul: 1.0,
    terrainMul: 1.0,
    trackMul: 1.0,
    hemiMul: 1.0,
    keyMul: 1.0,
    rimMul: 1.0,
    exposureMul: 1.0,
  },
  deep: {
    label: 'Deep',
    satBoost: 1.42,
    skyMul: 0.68,
    fogMul: 0.68,
    terrainMul: 0.72,
    trackMul: 0.72,
    hemiMul: 0.82,
    keyMul: 1.06,
    rimMul: 1.2,
    exposureMul: 0.96,
  },
  ultra: {
    label: 'Ultra Dark',
    satBoost: 1.85,
    skyMul: 0.44,
    fogMul: 0.44,
    terrainMul: 0.48,
    trackMul: 0.48,
    hemiMul: 0.62,
    keyMul: 1.15,
    rimMul: 1.4,
    exposureMul: 0.95,
  },
};

const QUALITY_PRESETS = {
  standard: {
    label: '1080p Standard',
    targetLongestEdge: 1920,
    maxPr: 1.5,
    shadowSize: 2048,
    recordMaxWidth: 1920,
    recordBitrates: [28_000_000, 18_000_000, 12_000_000],
  },
  uhd4k: {
    label: '4K UHD',
    targetLongestEdge: 3840,
    maxPr: 4.0,
    shadowSize: 4096,
    recordMaxWidth: 3840,
    recordBitrates: [58_000_000, 40_000_000, 26_000_000, 16_000_000],
  },
  uhd8k: {
    label: '8K Cinema',
    targetLongestEdge: 5760,
    maxPr: 6.0,
    shadowSize: 4096,
    recordMaxWidth: 3840,
    recordBitrates: [75_000_000, 52_000_000, 36_000_000, 24_000_000],
  },
  master32k: {
    label: '32K Master',
    targetLongestEdge: 7680,
    maxPr: 8.0,
    shadowSize: 4096,
    recordMaxWidth: 3840,
    recordBitrates: [90_000_000, 65_000_000, 45_000_000, 30_000_000, 18_000_000],
  },
};

const DEFAULT_CONFIG = {
  ballCount: 10,
  speedMultiplier: 1.0,
  distancePreset: '100',
  distanceMeters: 100,
  colorDarkness: 'standard',
  mapPreset: 'expedition',
  cycleMapOnNewTrack: true,
  trackType: 'straight',
  trackWidth: 10,
  gravityPreset: 'earth',
  frictionPreset: 'polished',
  experimentalVariance: false,
  hurdleCount: 10,
  hurdleSize: 'medium',
  randomHurdles: true,
  enabledObstacles: new Set(ALL_OBSTACLE_TYPES),
  palette: 'grandprix',
  allowDuplicateColors: false,
};

const TERRITORY_ORDER = [
  'expedition',
  'alpine',
  'canyon',
  'coastal',
  'arctic',
  'savanna',
  'volcanic',
  'bamboo',
  'badlands',
  'autumn',
];

const TERRITORIES = {
  expedition: {
    label: 'All Territories',
    skyStops: ['#2864a8', '#5b93cd', '#a8cce6', '#dde8ee'],
    fogColor: 0xc2d5e0,
    fogDensity: 0.00118,
    hemiSky: 0xd4e8ff,
    hemiGround: 0x3b352c,
    hemiIntensity: 0.94,
    keyColor: 0xfff1d6,
    keyIntensity: 2.85,
    rimColor: 0x9ec6eb,
    rimIntensity: 0.45,
    exposure: 1.0,
    trackBase: '#2d2f33',
    trackLine: 'rgba(236, 232, 224, 0.78)',
    curbPrimary: '#c63d2d',
    curbSecondary: '#eae5dc',
    railColor: 0x6f767e,
    pylonColor: 0x4c5258,
    hasWater: true,
    waterColor: 0x205d79,
    waterLevelOffset: -2.6,
  },
  alpine: {
    label: 'Alpine Valley',
    skyStops: ['#225b99', '#548ec9', '#9bc3e3', '#d6e5ed'],
    fogColor: 0xbacfd9,
    fogDensity: 0.00125,
    hemiSky: 0xd8ecff,
    hemiGround: 0x31402a,
    hemiIntensity: 0.96,
    keyColor: 0xfff3de,
    keyIntensity: 2.85,
    rimColor: 0xa4cbe8,
    rimIntensity: 0.44,
    exposure: 1.0,
    trackBase: '#2f3237',
    trackLine: 'rgba(238, 235, 228, 0.78)',
    curbPrimary: '#bf3b2b',
    curbSecondary: '#eae6de',
    railColor: 0x6e757d,
    pylonColor: 0x4a5056,
    hasWater: true,
    waterColor: 0x246278,
    waterLevelOffset: -3.2,
  },
  canyon: {
    label: 'Red Canyon',
    skyStops: ['#2861a1', '#6999ca', '#c7c2b0', '#e6cca9'],
    fogColor: 0xd5bda2,
    fogDensity: 0.00115,
    hemiSky: 0xffe9d2,
    hemiGround: 0x5c3624,
    hemiIntensity: 0.92,
    keyColor: 0xffebd0,
    keyIntensity: 2.95,
    rimColor: 0xb8cde0,
    rimIntensity: 0.42,
    exposure: 1.0,
    trackBase: '#332e2b',
    trackLine: 'rgba(240, 231, 214, 0.76)',
    curbPrimary: '#b84228',
    curbSecondary: '#eadfc8',
    railColor: 0x766c63,
    pylonColor: 0x57483e,
    hasWater: false,
    waterColor: 0x2c6468,
    waterLevelOffset: -9.5,
  },
  coastal: {
    label: 'Coastal Cliffs',
    skyStops: ['#1f5899', '#528ec9', '#9ecbe6', '#d8ebf2'],
    fogColor: 0xc5dbe6,
    fogDensity: 0.00112,
    hemiSky: 0xdaf0ff,
    hemiGround: 0x424a38,
    hemiIntensity: 0.98,
    keyColor: 0xfff5e4,
    keyIntensity: 2.9,
    rimColor: 0x9bd0eb,
    rimIntensity: 0.46,
    exposure: 1.0,
    trackBase: '#2f3338',
    trackLine: 'rgba(242, 240, 234, 0.8)',
    curbPrimary: '#c2432f',
    curbSecondary: '#ece8df',
    railColor: 0x767d84,
    pylonColor: 0x555b60,
    hasWater: true,
    waterColor: 0x1a5b7d,
    waterLevelOffset: -1.85,
  },
  arctic: {
    label: 'Nordic Fjord',
    skyStops: ['#244c7a', '#537da8', '#9ebbd4', '#cfdce6'],
    fogColor: 0xc4d4df,
    fogDensity: 0.0012,
    hemiSky: 0xe3f1ff,
    hemiGround: 0x4a5562,
    hemiIntensity: 1.02,
    keyColor: 0xf6f9ff,
    keyIntensity: 2.75,
    rimColor: 0xb8d4eb,
    rimIntensity: 0.48,
    exposure: 0.98,
    trackBase: '#31373e',
    trackLine: 'rgba(235, 240, 245, 0.8)',
    curbPrimary: '#a63e34',
    curbSecondary: '#e8edf2',
    railColor: 0x79838e,
    pylonColor: 0x46505b,
    hasWater: true,
    waterColor: 0x1c4962,
    waterLevelOffset: -2.8,
  },
  savanna: {
    label: 'Savanna Plains',
    skyStops: ['#2b649e', '#6f9bc4', '#d1c49f', '#eadbb7'],
    fogColor: 0xd6c7a8,
    fogDensity: 0.00112,
    hemiSky: 0xfff0d6,
    hemiGround: 0x594a30,
    hemiIntensity: 0.94,
    keyColor: 0xffe8c2,
    keyIntensity: 2.95,
    rimColor: 0xb2cce0,
    rimIntensity: 0.4,
    exposure: 1.0,
    trackBase: '#33302b',
    trackLine: 'rgba(240, 232, 212, 0.76)',
    curbPrimary: '#b8492a',
    curbSecondary: '#eae1cc',
    railColor: 0x756c5e,
    pylonColor: 0x52493d,
    hasWater: true,
    waterColor: 0x336355,
    waterLevelOffset: -4.2,
  },
  volcanic: {
    label: 'Volcanic Basalt',
    skyStops: ['#1b232e', '#3a424d', '#6b5f58', '#8a7365'],
    fogColor: 0x6f6058,
    fogDensity: 0.00145,
    hemiSky: 0xb8c0ca,
    hemiGround: 0x261d19,
    hemiIntensity: 0.76,
    keyColor: 0xffd5b0,
    keyIntensity: 2.65,
    rimColor: 0x8f9dad,
    rimIntensity: 0.56,
    exposure: 0.94,
    trackBase: '#222326',
    trackLine: 'rgba(222, 214, 202, 0.72)',
    curbPrimary: '#943522',
    curbSecondary: '#cbc5ba',
    railColor: 0x545960,
    pylonColor: 0x34373b,
    hasWater: false,
    waterColor: 0x283238,
    waterLevelOffset: -9.5,
  },
  bamboo: {
    label: 'Misty Highlands',
    skyStops: ['#2c5973', '#618ea1', '#a7c4c2', '#d2ded9'],
    fogColor: 0xbed0cc,
    fogDensity: 0.00142,
    hemiSky: 0xdcf0eb,
    hemiGround: 0x283b2c,
    hemiIntensity: 0.95,
    keyColor: 0xfff4de,
    keyIntensity: 2.65,
    rimColor: 0x9ec9be,
    rimIntensity: 0.45,
    exposure: 0.98,
    trackBase: '#2b3230',
    trackLine: 'rgba(235, 238, 232, 0.78)',
    curbPrimary: '#2f6e52',
    curbSecondary: '#e5e8e1',
    railColor: 0x62706b,
    pylonColor: 0x3e4a46,
    hasWater: true,
    waterColor: 0x225a52,
    waterLevelOffset: -3.0,
  },
  badlands: {
    label: 'Golden Dunes',
    skyStops: ['#2b69ab', '#699cd1', '#d6c59c', '#edd7ac'],
    fogColor: 0xdec89e,
    fogDensity: 0.00105,
    hemiSky: 0xfff2d4,
    hemiGround: 0x664e2c,
    hemiIntensity: 0.96,
    keyColor: 0xffebd1,
    keyIntensity: 3.05,
    rimColor: 0xb0cde6,
    rimIntensity: 0.38,
    exposure: 1.0,
    trackBase: '#36322c',
    trackLine: 'rgba(244, 236, 216, 0.78)',
    curbPrimary: '#b56328',
    curbSecondary: '#efe4cc',
    railColor: 0x7c7160,
    pylonColor: 0x594d3d,
    hasWater: false,
    waterColor: 0x2e6460,
    waterLevelOffset: -9.5,
  },
  autumn: {
    label: 'Autumn Timberland',
    skyStops: ['#24568f', '#5787bd', '#b0c3cf', '#ded7c8'],
    fogColor: 0xc9c6bc,
    fogDensity: 0.00124,
    hemiSky: 0xe6efff,
    hemiGround: 0x473423,
    hemiIntensity: 0.92,
    keyColor: 0xffe8c7,
    keyIntensity: 2.8,
    rimColor: 0x9fc0de,
    rimIntensity: 0.44,
    exposure: 0.98,
    trackBase: '#2d2f33',
    trackLine: 'rgba(240, 234, 224, 0.78)',
    curbPrimary: '#ad4424',
    curbSecondary: '#eae3d6',
    railColor: 0x6a6e72,
    pylonColor: 0x47484b,
    hasWater: true,
    waterColor: 0x285469,
    waterLevelOffset: -3.1,
  },
};

function mulberry32(seed) {
  let a = (seed >>> 0) + 0x6d2b79f5;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2D(ix, iz, seed) {
  let n = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed | 0, 1442695041);
  n = (n ^ (n >>> 13)) | 0;
  n = Math.imul(n, 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function valueNoise2D(x, z, seed) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2D(ix, iz, seed);
  const b = hash2D(ix + 1, iz, seed);
  const c = hash2D(ix, iz + 1, seed);
  const d = hash2D(ix + 1, iz + 1, seed);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

function fbm2D(x, z, seed, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1.0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise2D(x * freq, z * freq, seed + i * 97) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.04;
  }
  return sum / norm;
}

function evaluateTerritoryWeights(uProgress, x, z, mapKey, seed) {
  const w = {
    arctic: 0,
    alpine: 0,
    bamboo: 0,
    canyon: 0,
    badlands: 0,
    autumn: 0,
    savanna: 0,
    volcanic: 0,
    coastal: 0,
  };
  if (mapKey !== 'expedition') {
    w[mapKey in w ? mapKey : 'alpine'] = 1.0;
    return w;
  }
  // Smooth organic transition across all 9 open-world territories along the route
  const warp = (fbm2D(x * 0.008, z * 0.008, seed + 19, 2) - 0.5) * 0.12;
  const u = THREE.MathUtils.clamp(uProgress + warp, 0, 1);
  const zones = [
    { key: 'arctic', center: 0.04, width: 0.14 },
    { key: 'alpine', center: 0.16, width: 0.14 },
    { key: 'bamboo', center: 0.28, width: 0.14 },
    { key: 'autumn', center: 0.40, width: 0.14 },
    { key: 'canyon', center: 0.52, width: 0.14 },
    { key: 'badlands', center: 0.64, width: 0.14 },
    { key: 'savanna', center: 0.76, width: 0.14 },
    { key: 'volcanic', center: 0.87, width: 0.14 },
    { key: 'coastal', center: 0.97, width: 0.14 },
  ];
  let total = 0;
  for (const zDef of zones) {
    const d = Math.abs(u - zDef.center) / zDef.width;
    const weight = d >= 1 ? 0 : Math.pow(1 - d * d, 2);
    w[zDef.key] = weight;
    total += weight;
  }
  if (total < 1e-4) {
    w.alpine = 1;
  } else {
    for (const k of Object.keys(w)) w[k] /= total;
  }
  return w;
}

// ============================================================================
// Software WebGL Detection (Three.js Skill Standard)
// ============================================================================
const isSoftwareGl = (() => {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
})();

// ============================================================================
// Procedural Broadcast Sound Engine (Web Audio API - Zero External Files)
// ============================================================================
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.masterComp = null;
    this.noiseBuffer = null;
    this.loopNoiseBuffer = null;
    this.rollSource = null;
    this.rollFilter = null;
    this.rollGain = null;
    this.rollOsc = null;
    this.rollOscGain = null;
    this.mediaDest = null;
    this.enabled = true;
    this.musicEnabled = true;
    this.musicGain = null;
    this.musicFilter = null;
    this.musicDelay = null;
    this.musicTimer = null;
    this.musicStarted = false;
    this.musicBarIdx = 0;
    this.lastClackAt = 0;
    this.lastHurdleAt = 0;
    this.lastWallAt = 0;
    this.lastWhooshAt = 0;
    this.crowdSource = null;
    this.crowdFilterLow = null;
    this.crowdFilterHigh = null;
    this.crowdMurmurGain = null;
    this.crowdCheerGain = null;
    this.lastCrowdSpikeAt = 0;
  }

  ensureContext(forceForMusic = false) {
    if (!this.enabled && !(forceForMusic && this.musicEnabled)) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterComp = this.ctx.createDynamicsCompressor();
      this.masterComp.threshold.value = -14;
      this.masterComp.knee.value = 18;
      this.masterComp.ratio.value = 6;
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.88;
      this.masterComp.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      if (this.ctx.createMediaStreamDestination) {
        this.mediaDest = this.ctx.createMediaStreamDestination();
        this.masterGain.connect(this.mediaDest);
      }

      // Warm low-pass ambient music bus with gentle room echo
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicEnabled ? 0.24 : 0.0001;
      this.musicFilter = this.ctx.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.value = 920;
      this.musicFilter.Q.value = 0.5;

      this.musicDelay = this.ctx.createDelay(1.0);
      this.musicDelay.delayTime.value = 0.38;
      const delayFeedback = this.ctx.createGain();
      delayFeedback.gain.value = 0.26;
      const delayWet = this.ctx.createGain();
      delayWet.gain.value = 0.32;

      this.musicFilter.connect(this.musicGain);
      this.musicFilter.connect(this.musicDelay);
      this.musicDelay.connect(delayFeedback);
      delayFeedback.connect(this.musicDelay);
      this.musicDelay.connect(delayWet);
      delayWet.connect(this.musicGain);
      this.musicGain.connect(this.masterGain);

      this.noiseBuffer = this.createNoiseBuffer(0.14);
      this.loopNoiseBuffer = this.createPinkLoopBuffer(1.6);
      this.initRollingBed();
      this.initCrowdBed();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.musicEnabled && !this.musicStarted) {
      this.startMusic(true);
    }
    return this.ctx;
  }

  setMusicEnabled(enabled) {
    this.musicEnabled = Boolean(enabled);
    if (this.musicEnabled) {
      const ctx = this.ensureContext(true);
      if (ctx && this.musicGain) {
        this.musicGain.gain.setTargetAtTime(0.24, ctx.currentTime, 0.25);
      }
      this.startMusic();
    } else {
      if (this.ctx && this.musicGain) {
        this.musicGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.18);
      }
    }
  }

  startMusic(fromEnsure = false) {
    if (!this.musicEnabled || this.musicStarted) return;
    const ctx = fromEnsure ? this.ctx : this.ensureContext(true);
    if (!ctx || !this.musicFilter || this.musicStarted) return;
    this.musicStarted = true;
    this.scheduleMusicBar();
    if (!this.musicTimer) {
      this.musicTimer = window.setInterval(() => {
        if (this.musicEnabled && this.ctx && this.ctx.state === 'running') {
          this.scheduleMusicBar();
        }
      }, 3600);
    }
  }

  scheduleMusicBar() {
    if (!this.ctx || !this.musicFilter || !this.musicEnabled) return;
    const now = this.ctx.currentTime + 0.05;
    // Peaceful floating Cmaj9 -> Am9 -> Fmaj9 -> G6 progression
    const chords = [
      { pad: [130.81, 246.94, 293.66, 329.63], arp: [523.25, 659.25, 587.33, 783.99] },
      { pad: [110.0, 220.0, 261.63, 329.63], arp: [493.88, 659.25, 523.25, 587.33] },
      { pad: [87.31, 174.61, 220.0, 261.63], arp: [440.0, 523.25, 659.25, 587.33] },
      { pad: [98.0, 196.0, 246.94, 293.66], arp: [392.0, 493.88, 587.33, 659.25] },
    ];
    const bar = chords[this.musicBarIdx % chords.length];
    this.musicBarIdx++;

    // Soft sustained felt-pad voicing
    for (let i = 0; i < bar.pad.length; i++) {
      const freq = bar.pad[i];
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      const peak = i === 0 ? 0.075 : 0.036;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.85);
      gain.gain.setValueAtTime(peak * 0.88, now + 2.35);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.75);
      osc.connect(gain);
      gain.connect(this.musicFilter);
      osc.start(now);
      osc.stop(now + 3.85);
    }

    // Gentle acoustic felt-mallet notes spaced smoothly across the bar
    for (let k = 0; k < bar.arp.length; k++) {
      const t0 = now + k * 0.88 + 0.18;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(bar.arp[k], t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.034, t0 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.45);
      osc.connect(gain);
      gain.connect(this.musicFilter);
      osc.start(t0);
      osc.stop(t0 + 1.52);
    }
  }

  createNoiseBuffer(seconds = 0.14) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  createPinkLoopBuffer(seconds = 1.6) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.95 * b2 + white * 0.048;
      data[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + white * 0.12) * 1.4));
    }
    return buf;
  }

  initRollingBed() {
    if (!this.ctx || !this.loopNoiseBuffer || this.rollSource) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.loopNoiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 180;
    filter.Q.value = 1.1;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.0001;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterComp);
    src.start();

    // Subtle glass-on-track harmonic hum
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 72;
    const oscGain = this.ctx.createGain();
    oscGain.gain.value = 0.0001;
    osc.connect(oscGain);
    oscGain.connect(this.masterComp);
    osc.start();

    this.rollSource = src;
    this.rollFilter = filter;
    this.rollGain = gain;
    this.rollOsc = osc;
    this.rollOscGain = oscGain;
  }

  updateRollingBed(speed, active) {
    if (!this.ctx || !this.rollGain || !this.rollFilter || !this.rollOscGain) return;
    const now = this.ctx.currentTime;
    if (!this.enabled || !active || speed < 1.2) {
      this.rollGain.gain.setTargetAtTime(0.0001, now, 0.06);
      this.rollOscGain.gain.setTargetAtTime(0.0001, now, 0.06);
      return;
    }
    const norm = Math.min(1, Math.max(0, (speed - 1.2) / 24));
    const targetNoiseGain = 0.008 + norm * 0.042;
    const targetFilterFreq = 160 + norm * 620;
    const targetOscFreq = 64 + norm * 92;
    const targetOscGain = 0.004 + norm * 0.018;

    this.rollGain.gain.setTargetAtTime(targetNoiseGain, now, 0.05);
    this.rollFilter.frequency.setTargetAtTime(targetFilterFreq, now, 0.05);
    this.rollOsc.frequency.setTargetAtTime(targetOscFreq, now, 0.05);
    this.rollOscGain.gain.setTargetAtTime(targetOscGain, now, 0.05);
  }

  initCrowdBed() {
    if (!this.ctx || !this.loopNoiseBuffer || this.crowdSource) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.loopNoiseBuffer;
    src.loop = true;
    src.playbackRate.value = 0.88;

    // Warm lower stadium murmur band
    const fLow = this.ctx.createBiquadFilter();
    fLow.type = 'bandpass';
    fLow.frequency.value = 340;
    fLow.Q.value = 0.72;
    const gLow = this.ctx.createGain();
    gLow.gain.value = 0.0001;

    // Bright upper cheering formant band
    const fHigh = this.ctx.createBiquadFilter();
    fHigh.type = 'bandpass';
    fHigh.frequency.value = 920;
    fHigh.Q.value = 0.95;
    const gHigh = this.ctx.createGain();
    gHigh.gain.value = 0.0001;

    src.connect(fLow);
    fLow.connect(gLow);
    gLow.connect(this.masterComp);

    src.connect(fHigh);
    fHigh.connect(gHigh);
    gHigh.connect(this.masterComp);

    src.start();

    this.crowdSource = src;
    this.crowdFilterLow = fLow;
    this.crowdFilterHigh = fHigh;
    this.crowdMurmurGain = gLow;
    this.crowdCheerGain = gHigh;
  }

  updateCrowdExcitement(excitement01, active) {
    if (!this.ctx || !this.crowdMurmurGain || !this.crowdCheerGain) return;
    const now = this.ctx.currentTime;
    if (!this.enabled || !active) {
      this.crowdMurmurGain.gain.setTargetAtTime(0.0001, now, 0.16);
      this.crowdCheerGain.gain.setTargetAtTime(0.0001, now, 0.16);
      return;
    }
    const e = Math.min(1, Math.max(0, excitement01 || 0));
    const murmurGain = 0.007 + e * 0.044;
    const cheerGain = 0.002 + Math.pow(e, 1.3) * 0.105;
    this.crowdMurmurGain.gain.setTargetAtTime(murmurGain, now, 0.14);
    this.crowdCheerGain.gain.setTargetAtTime(cheerGain, now, 0.12);
    this.crowdFilterLow.frequency.setTargetAtTime(320 + e * 210, now, 0.14);
    this.crowdFilterHigh.frequency.setTargetAtTime(760 + e * 980, now, 0.12);
  }

  playCrowdCheerSpike(strength = 0.8) {
    if (!this.enabled) return;
    const nowMs = performance.now();
    if (nowMs - this.lastCrowdSpikeAt < 420) return;
    this.lastCrowdSpikeAt = nowMs;
    const ctx = this.ensureContext();
    if (!ctx || !this.loopNoiseBuffer || !this.masterComp) return;
    const now = ctx.currentTime;
    const s = Math.min(1.1, Math.max(0.25, strength));
    const src = ctx.createBufferSource();
    src.buffer = this.loopNoiseBuffer;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(640, now);
    bp.frequency.exponentialRampToValueAtTime(1480, now + 0.35);
    bp.frequency.exponentialRampToValueAtTime(920, now + 1.05);
    bp.Q.value = 0.85;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.075 * s, now + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.15);
    src.connect(bp);
    bp.connect(gain);
    gain.connect(this.masterComp);
    src.start(now);
    src.stop(now + 1.2);
  }

  getAudioTrack() {
    const ctx = this.ensureContext(true);
    if (!ctx || !this.mediaDest) return null;
    return this.mediaDest.stream.getAudioTracks()[0] || null;
  }

  playTone(freq, duration = 0.12, type = 'sine', gainVal = 0.08, endFreq = null) {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterComp) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.masterComp);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playNoiseBurst(duration = 0.035, centerFreq = 1800, q = 2.5, gainVal = 0.08) {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer || !this.masterComp) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(centerFreq, now);
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterComp);
    src.start(now);
    src.stop(now + duration + 0.01);
  }

  playCountdown(isGo) {
    if (isGo) {
      this.playTone(880, 0.28, 'triangle', 0.14);
      this.playTone(440, 0.25, 'sine', 0.09);
      setTimeout(() => this.playTone(1174.66, 0.34, 'triangle', 0.12), 55);
      this.playNoiseBurst(0.11, 1400, 1.2, 0.08);
    } else {
      this.playTone(440, 0.13, 'sine', 0.1);
      this.playTone(220, 0.11, 'triangle', 0.05);
    }
  }

  playWin() {
    // Victory brass-like triad + celebratory stadium crowd rush
    const ctx = this.ensureContext();
    if (ctx && this.loopNoiseBuffer && this.masterComp) {
      const now = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = this.loopNoiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(650, now);
      bp.frequency.exponentialRampToValueAtTime(1450, now + 0.55);
      bp.Q.value = 0.85;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.11, now + 0.22);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 1.45);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.masterComp);
      src.start(now);
      src.stop(now + 1.5);
    }

    this.playTone(523.25, 0.2, 'triangle', 0.12);
    setTimeout(() => this.playTone(659.25, 0.2, 'triangle', 0.12), 110);
    setTimeout(() => this.playTone(783.99, 0.32, 'triangle', 0.14), 220);
    setTimeout(() => {
      this.playTone(1046.5, 0.55, 'triangle', 0.14);
      this.playTone(523.25, 0.55, 'sine', 0.09);
    }, 340);
  }

  playCheckpointChime() {
    this.playTone(660, 0.08, 'sine', 0.055, 880);
    setTimeout(() => this.playTone(987.77, 0.11, 'triangle', 0.05), 45);
  }

  playWhoosh(strength = 0.7) {
    if (!this.enabled) return;
    const nowMs = performance.now();
    if (nowMs - this.lastWhooshAt < 260) return;
    this.lastWhooshAt = nowMs;
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer || !this.masterComp) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(420, now);
    filter.frequency.exponentialRampToValueAtTime(2100, now + 0.13);
    filter.Q.value = 1.6;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.002, now);
    gain.gain.linearRampToValueAtTime(0.085 * strength, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterComp);
    src.start(now);
    src.stop(now + 0.15);
  }

  playCameraCut() {
    if (!this.ctx || !this.enabled) return;
    this.playNoiseBurst(0.015, 3400, 3.2, 0.025);
  }

  playMarbleClack(strength = 0.7) {
    const nowMs = performance.now();
    if (nowMs - this.lastClackAt < 38) return;
    this.lastClackAt = nowMs;
    const s = Math.min(1, Math.max(0.18, strength));
    const jitter = 0.9 + Math.random() * 0.22;
    this.playTone(1340 * jitter, 0.042, 'sine', s * 0.068);
    this.playTone(2580 * jitter, 0.028, 'triangle', s * 0.042);
    this.playNoiseBurst(0.02, 2800 * jitter, 3.0, s * 0.058);
  }

  playHurdleHit(subType = 'rotating_bar', strength = 0.8) {
    const nowMs = performance.now();
    if (nowMs - this.lastHurdleAt < 42 && subType !== 'booster') return;
    if (subType !== 'booster') this.lastHurdleAt = nowMs;

    const s = Math.min(1, Math.max(0.22, strength));
    const pitchVar = 0.92 + Math.random() * 0.18;

    if (subType === 'booster') {
      this.playTone(340, 0.2, 'sawtooth', 0.055, 1120);
      this.playTone(540, 0.18, 'sine', 0.075, 1460);
      this.playWhoosh(0.95);
      return;
    }

    if (subType === 'rotating_bar' || subType === 'spinning_wheel' || subType === 'moving_gate') {
      this.playTone(390 * pitchVar, 0.12, 'triangle', s * 0.095, 290 * pitchVar);
      this.playTone(840 * pitchVar, 0.09, 'sine', s * 0.06);
      this.playNoiseBurst(0.032, 1650 * pitchVar, 2.2, s * 0.088);
    } else if (subType === 'speed_bump' || subType === 'jump_ramp') {
      this.playTone(215 * pitchVar, 0.09, 'sine', s * 0.1, 95);
      this.playNoiseBurst(0.025, 780, 1.5, s * 0.05);
      if (subType === 'jump_ramp' && s > 0.5) {
        this.playWhoosh(s * 0.75);
      }
    } else {
      this.playTone(280 * pitchVar, 0.08, 'triangle', s * 0.09, 170);
      this.playTone(560 * pitchVar, 0.05, 'sine', s * 0.045);
      this.playNoiseBurst(0.026, 1250, 2.0, s * 0.065);
    }
  }

  playWallHit(strength = 0.5) {
    const nowMs = performance.now();
    if (nowMs - this.lastWallAt < 70) return;
    this.lastWallAt = nowMs;
    const s = Math.min(1, Math.max(0.15, strength));
    this.playTone(155 + s * 60, 0.055, 'sine', s * 0.06, 95);
    this.playNoiseBurst(0.018, 920, 1.8, s * 0.03);
  }

  playRespawn() {
    this.playTone(520, 0.09, 'sine', 0.075, 780);
    setTimeout(() => this.playTone(780, 0.11, 'triangle', 0.065, 1040), 55);
  }
}

// ============================================================================
// Full Gameplay Video Recorder (SSAA GPU Frame Capture -> High-Bitrate MP4/WebM)
// ============================================================================
class GameplayRecorder {
  constructor(canvas, soundEngine) {
    this.sourceCanvas = canvas;
    this.soundEngine = soundEngine;
    this.recordWidth = canvas ? canvas.width : 1920;
    this.recordHeight = canvas ? canvas.height : 1080;
    this.recordFps = isSoftwareGl ? 24 : 60;
    this.recorder = null;
    this.chunks = [];
    this.stream = null;
    this.captureCanvas = null;
    this.captureCtx = null;
    this.useCaptureCanvas = false;
    this.mimeType = '';
    this.ext = 'webm';
    this.isRecording = false;
    this.recordedUrl = null;
    this.recordedBlob = null;
    this.stopPromise = null;
  }

  static pickSupportedMimeType() {
    if (typeof MediaRecorder === 'undefined') return null;
    // Prefer H.264 High Profile L5.1 (true 4K) & VP9 over low-profile Baseline avc1.42E01E
    const candidates = [
      { mime: 'video/mp4;codecs=avc1.640033,mp4a.40.2', ext: 'mp4' },
      { mime: 'video/mp4;codecs=avc1.640032,mp4a.40.2', ext: 'mp4' },
      { mime: 'video/mp4;codecs=avc1.64002A,mp4a.40.2', ext: 'mp4' },
      { mime: 'video/webm;codecs=vp9,opus', ext: 'webm' },
      { mime: 'video/webm;codecs=vp9', ext: 'webm' },
      { mime: 'video/mp4;codecs=avc1.4D4033,mp4a.40.2', ext: 'mp4' },
      { mime: 'video/mp4;codecs=avc1,mp4a.40.2', ext: 'mp4' },
      { mime: 'video/mp4', ext: 'mp4' },
      { mime: 'video/webm;codecs=vp8,opus', ext: 'webm' },
      { mime: 'video/webm;codecs=vp8', ext: 'webm' },
      { mime: 'video/webm', ext: 'webm' },
    ];
    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported(c.mime)) return c;
    }
    return { mime: '', ext: 'webm' };
  }

  isSupported() {
    return (
      typeof MediaRecorder !== 'undefined' &&
      this.sourceCanvas &&
      typeof this.sourceCanvas.captureStream === 'function'
    );
  }

  captureFrame() {
    if (!this.isRecording || !this.useCaptureCanvas || !this.captureCtx || !this.sourceCanvas) {
      return;
    }
    this.captureCtx.drawImage(
      this.sourceCanvas,
      0,
      0,
      this.recordWidth,
      this.recordHeight
    );
  }

  start(qualityCfg = QUALITY_PRESETS.standard) {
    this.discard();
    if (!this.isSupported()) return false;

    try {
      const srcW = Math.max(640, this.sourceCanvas.width || 1920);
      const srcH = Math.max(360, this.sourceCanvas.height || 1080);
      const aspect = srcW / srcH;
      const maxRecW = isSoftwareGl ? 1920 : (qualityCfg?.recordMaxWidth || 3840);

      let targetW = Math.min(srcW, maxRecW);
      let targetH = Math.round(targetW / aspect);
      // H.264 & VP9 hardware encoders require even pixel dimensions
      targetW = Math.max(2, targetW - (targetW % 2));
      targetH = Math.max(2, targetH - (targetH % 2));

      this.recordWidth = targetW;
      this.recordHeight = targetH;
      this.recordFps = isSoftwareGl ? 24 : 60;

      // Downsample >4K SSAA WebGL backbuffer or odd dimensions via high-quality GPU blit
      const needsDownsample = srcW !== targetW || srcH !== targetH;
      this.useCaptureCanvas = needsDownsample;

      let streamSource = this.sourceCanvas;
      if (this.useCaptureCanvas) {
        this.captureCanvas = document.createElement('canvas');
        this.captureCanvas.width = targetW;
        this.captureCanvas.height = targetH;
        this.captureCtx = this.captureCanvas.getContext('2d', { alpha: false });
        if (this.captureCtx) {
          this.captureCtx.imageSmoothingEnabled = true;
          this.captureCtx.imageSmoothingQuality = 'high';
          this.captureCtx.drawImage(this.sourceCanvas, 0, 0, targetW, targetH);
          streamSource = this.captureCanvas;
        } else {
          this.useCaptureCanvas = false;
        }
      }

      const canvasStream = streamSource.captureStream(this.recordFps);
      const tracks = [...canvasStream.getVideoTracks()];
      const audioTrack = this.soundEngine.getAudioTrack();
      if (audioTrack) {
        tracks.push(audioTrack);
      }
      this.stream = new MediaStream(tracks);

      const picked = GameplayRecorder.pickSupportedMimeType();
      this.mimeType = picked?.mime || '';
      this.ext = picked?.ext || 'webm';

      this.chunks = [];
      const bitrates = qualityCfg?.recordBitrates || [
        90_000_000,
        65_000_000,
        45_000_000,
        30_000_000,
        18_000_000,
      ];
      let created = null;
      for (const bps of bitrates) {
        try {
          const opts = this.mimeType
            ? { mimeType: this.mimeType, videoBitsPerSecond: bps, audioBitsPerSecond: 192_000 }
            : { videoBitsPerSecond: bps, audioBitsPerSecond: 192_000 };
          created = new MediaRecorder(this.stream, opts);
          break;
        } catch {
          created = null;
        }
      }
      if (!created) {
        created = new MediaRecorder(this.stream);
      }
      this.recorder = created;
      this.recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.chunks.push(e.data);
        }
      };

      this.isRecording = true;
      this.recorder.start(1000);
      return true;
    } catch (err) {
      console.warn('Video recording unavailable:', err);
      this.cleanupTracks();
      this.isRecording = false;
      return false;
    }
  }

  pause() {
    if (this.recorder && this.recorder.state === 'recording') {
      try {
        this.recorder.pause();
      } catch {
        // Ignore browser-specific pause restrictions
      }
    }
  }

  resume() {
    if (this.recorder && this.recorder.state === 'paused') {
      try {
        this.recorder.resume();
      } catch {
        // Ignore browser-specific resume restrictions
      }
    }
  }

  stop() {
    if (this.stopPromise) return this.stopPromise;
    if (!this.recorder || this.recorder.state === 'inactive') {
      this.isRecording = false;
      return Promise.resolve(
        this.recordedBlob
          ? {
              blob: this.recordedBlob,
              url: this.recordedUrl,
              ext: this.ext,
              width: this.recordWidth,
              height: this.recordHeight,
              fps: this.recordFps,
            }
          : null
      );
    }

    this.stopPromise = new Promise((resolve) => {
      this.recorder.onstop = () => {
        this.isRecording = false;
        const type = this.mimeType || 'video/webm';
        const blob = new Blob(this.chunks, { type });
        this.recordedBlob = blob;
        if (this.recordedUrl) {
          URL.revokeObjectURL(this.recordedUrl);
        }
        this.recordedUrl = URL.createObjectURL(blob);
        this.cleanupTracks();
        this.stopPromise = null;
        resolve({
          blob,
          url: this.recordedUrl,
          ext: this.ext,
          width: this.recordWidth,
          height: this.recordHeight,
          fps: this.recordFps,
        });
      };
      try {
        this.recorder.stop();
      } catch {
        this.isRecording = false;
        this.stopPromise = null;
        resolve(null);
      }
    });

    return this.stopPromise;
  }

  cleanupTracks() {
    if (this.stream) {
      this.stream.getVideoTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.useCaptureCanvas = false;
    this.captureCtx = null;
    this.captureCanvas = null;
  }

  discard() {
    if (this.recorder && this.recorder.state !== 'inactive') {
      try {
        this.recorder.onstop = null;
        this.recorder.stop();
      } catch {
        // Ignore
      }
    }
    this.cleanupTracks();
    this.recorder = null;
    this.chunks = [];
    this.isRecording = false;
    this.stopPromise = null;
    this.recordedBlob = null;
    if (this.recordedUrl) {
      URL.revokeObjectURL(this.recordedUrl);
      this.recordedUrl = null;
    }
  }
}

// ============================================================================
// Cinematic Physics Replay Recorder & Intense-Moment Director
// ============================================================================
class ReplaySystem {
  constructor() {
    this.sampleInterval = 1 / 30;
    this.maxFrames = 12000;
    this.reset();
  }

  reset() {
    this.frames = [];
    this.events = [];
    this.audioCues = [];
    this.highlights = [];
    this.shots = [];
    this.totalDuration = 0;
    this.ballCount = 0;
    this.hurdleCount = 0;
    this.lastSampleTime = -1;
    this.lastAudioCueAt = -1;
    this.lastEventTimeByKey = new Map();
    this.isPlaying = true;
    this.currentTime = 0;
    this.playbackSpeed = 1.0;
    this.autoSlowMo = true;
    this.autoDirector = true;
    this.activeShotIdx = -1;
    this.prevTimeForAudio = 0;
  }

  hasData() {
    return this.frames.length >= 4 && this.totalDuration > 0.25;
  }

  captureFrame(simTime, balls, kinematicHurdles, startGate) {
    if (this.frames.length >= this.maxFrames) return;
    if (this.lastSampleTime >= 0 && simTime - this.lastSampleTime < this.sampleInterval * 0.92) {
      return;
    }
    this.lastSampleTime = simTime;
    const nBalls = balls.length;
    const nHurdles = kinematicHurdles.length;
    this.ballCount = nBalls;
    this.hurdleCount = nHurdles;

    const ballData = new Float32Array(nBalls * 8);
    const ballProgress = new Float32Array(nBalls);
    const ballRanks = new Uint8Array(nBalls);

    for (let i = 0; i < nBalls; i++) {
      const b = balls[i];
      const p = b.body.translation();
      const q = b.body.rotation();
      const off = i * 8;
      ballData[off] = p.x;
      ballData[off + 1] = p.y;
      ballData[off + 2] = p.z;
      ballData[off + 3] = q.x;
      ballData[off + 4] = q.y;
      ballData[off + 5] = q.z;
      ballData[off + 6] = q.w;
      ballData[off + 7] = b.currentSpeed;
      ballProgress[i] = b.progressMeters;
      ballRanks[i] = b.rank;
    }

    const hurdleData = new Float32Array(nHurdles * 7);
    for (let i = 0; i < nHurdles; i++) {
      const h = kinematicHurdles[i];
      const p = h.mesh.position;
      const q = h.mesh.quaternion;
      const off = i * 7;
      hurdleData[off] = p.x;
      hurdleData[off + 1] = p.y;
      hurdleData[off + 2] = p.z;
      hurdleData[off + 3] = q.x;
      hurdleData[off + 4] = q.y;
      hurdleData[off + 5] = q.z;
      hurdleData[off + 6] = q.w;
    }

    this.frames.push({
      t: simTime,
      ballData,
      ballProgress,
      ballRanks,
      hurdleData,
      gateProgress: startGate ? startGate.openProgress : 1,
    });
    this.totalDuration = Math.max(this.totalDuration, simTime);
  }

  recordAudioCue(time, kind, intensity = 0.5, subType = '') {
    if (this.audioCues.length > 5000) return;
    if (time - this.lastAudioCueAt < 0.032 && kind !== 'win') return;
    this.lastAudioCueAt = time;
    this.audioCues.push({ time, kind, intensity, subType });
  }

  recordEvent(ev) {
    if (this.events.length > 1500) return;
    // Merge dense collision clusters within 0.38s at same track region into a multi-ball clash
    if (ev.type === 'pack_clash') {
      for (let i = this.events.length - 1; i >= Math.max(0, this.events.length - 6); i--) {
        const prev = this.events[i];
        if (prev.type === 'pack_clash' && ev.time - prev.time < 0.38 && Math.abs(ev.s - prev.s) < 6) {
          prev.intensity = Math.min(1.6, prev.intensity + 0.28);
          prev.label = 'Multi-Ball Pileup';
          if (ev.intensity > prev.intensity * 0.85) {
            prev.primaryBallId = ev.primaryBallId;
            prev.secondaryBallId = ev.secondaryBallId;
            prev.worldPos.copy(ev.worldPos);
          }
          return;
        }
      }
    }

    const dedupeKey = `${ev.type}_${ev.primaryBallId}`;
    const lastT = this.lastEventTimeByKey.get(dedupeKey) ?? -10;
    if (ev.type !== 'finish' && ev.type !== 'lead_change' && ev.time - lastT < 0.75) {
      return;
    }
    this.lastEventTimeByKey.set(dedupeKey, ev.time);
    this.events.push({
      time: ev.time,
      type: ev.type,
      label: ev.label,
      category: ev.category || 'clash',
      intensity: ev.intensity,
      primaryBallId: ev.primaryBallId ?? 0,
      secondaryBallId: ev.secondaryBallId ?? -1,
      s: ev.s ?? 0,
      worldPos: ev.worldPos ? ev.worldPos.clone() : new THREE.Vector3(),
      subType: ev.subType || '',
    });
  }

  compileDirectorSheet(totalDuration, balls) {
    const dur = Math.max(totalDuration, this.totalDuration, 1.0);
    this.totalDuration = dur;

    // 1. Pick top non-overlapping highlight peaks from captured physics events
    const ranked = [...this.events].sort((a, b) => b.intensity - a.intensity);
    const chosen = [];
    for (const ev of ranked) {
      if (chosen.some((c) => Math.abs(c.time - ev.time) < 2.25)) continue;
      chosen.push(ev);
      if (chosen.length >= 18) break;
    }
    chosen.sort((a, b) => a.time - b.time);
    this.highlights = chosen;

    // 2. Build seamless gapless director shot timeline covering [0, dur]
    const rawCuts = [];
    const angleForEvent = (ev, prevAngle) => {
      let pool = ['apex_chase', 'impact_close', 'side_drone', 'above_pack_drone', 'helicopter_orbit'];
      if (ev.type === 'pack_clash') {
        pool = ['impact_close', 'reverse_pack', 'above_pack_drone', 'side_drone'];
      } else if (ev.type === 'hurdle_hit') {
        pool = ['hurdle_hero', 'impact_close', 'apex_chase', 'side_drone'];
      } else if (ev.type === 'big_air') {
        pool = ['jump_profile', 'impact_close', 'side_drone'];
      } else if (ev.type === 'lead_change') {
        pool = ['bumper_duel', 'side_drone', 'above_pack_drone', 'reverse_pack'];
      } else if (ev.type === 'booster') {
        pool = ['bumper_duel', 'apex_chase', 'jump_profile'];
      } else if (ev.type === 'wall_slam') {
        pool = ['impact_close', 'hurdle_hero', 'side_drone'];
      } else if (ev.type === 'finish') {
        pool = ['finish_hero'];
      }
      const filtered = pool.filter((a) => a !== prevAngle);
      return filtered[0] || pool[0];
    };

    const shotTitleMap = {
      launch_sweep: 'Grid Launch Sweep',
      impact_close: 'Trackside Impact',
      hurdle_hero: 'Obstacle Close-Up',
      jump_profile: 'Aerial Flight Pan',
      bumper_duel: 'Bumper Duel',
      reverse_pack: 'Reverse Pack Cam',
      helicopter_orbit: 'Helicopter Sweeper',
      side_drone: 'Drone Side Follow',
      above_pack_drone: 'Drone Top Overhead',
      apex_chase: 'Dynamic Action Chase',
      finish_hero: 'Finish Gantry Hero',
    };

    // Always start with dramatic opening launch
    let cursor = 0;
    let prevAngle = 'launch_sweep';
    const openingEnd = Math.min(dur, chosen.length > 0 ? Math.min(2.6, Math.max(1.5, chosen[0].time - 0.85)) : Math.min(3.2, dur));
    if (openingEnd > 0.3) {
      rawCuts.push({
        startTime: 0,
        endTime: openingEnd,
        angleType: 'launch_sweep',
        shotLabel: shotTitleMap.launch_sweep,
        momentLabel: 'Gate Drop & Pack Launch',
        category: 'start',
        primaryBallId: 0,
        secondaryBallId: -1,
        focusPos: null,
        s: 0,
        intensity: 0.6,
        slowMoStart: -1,
        slowMoEnd: -1,
      });
      cursor = openingEnd;
    }

    const fillerAngles = ['apex_chase', 'side_drone', 'above_pack_drone', 'helicopter_orbit', 'reverse_pack', 'bumper_duel'];
    let fillerIdx = 0;

    for (const ev of chosen) {
      const preLead = ev.type === 'finish' ? 1.4 : 0.95;
      const postHold = ev.type === 'finish' ? 2.4 : 1.75;
      let segStart = Math.max(cursor, ev.time - preLead);
      const segEnd = Math.min(dur, Math.max(segStart + 1.85, ev.time + postHold));

      // Fill gap before highlight with dynamic kinetic coverage
      while (segStart - cursor > 2.2) {
        const chunkEnd = Math.min(segStart, cursor + 3.2);
        const fAngle = fillerAngles.find((_, idx) => fillerAngles[(fillerIdx + idx) % fillerAngles.length] !== prevAngle)
          || fillerAngles[fillerIdx % fillerAngles.length];
        fillerIdx++;
        const leaderId = this.findLeaderAtTime(cursor + (chunkEnd - cursor) * 0.5);
        rawCuts.push({
          startTime: cursor,
          endTime: chunkEnd,
          angleType: fAngle,
          shotLabel: shotTitleMap[fAngle] || 'Action Chase',
          momentLabel: 'High-Speed Pursuit',
          category: 'race',
          primaryBallId: leaderId,
          secondaryBallId: -1,
          focusPos: null,
          s: 0,
          intensity: 0.45,
          slowMoStart: -1,
          slowMoEnd: -1,
        });
        prevAngle = fAngle;
        cursor = chunkEnd;
      }

      // Snap start backward cleanly if gap was tiny (<2.2s)
      segStart = cursor;
      if (segEnd - segStart < 0.7 && rawCuts.length > 0) {
        continue;
      }

      const angle = angleForEvent(ev, prevAngle);
      prevAngle = angle;
      const slowMoEligible = ev.intensity >= 0.92 || ev.type === 'finish' || ev.type === 'lead_change';
      rawCuts.push({
        startTime: segStart,
        endTime: segEnd,
        angleType: angle,
        shotLabel: shotTitleMap[angle] || 'Highlight Cam',
        momentLabel: ev.label,
        category: ev.category,
        primaryBallId: ev.primaryBallId,
        secondaryBallId: ev.secondaryBallId,
        focusPos: ev.worldPos ? ev.worldPos.clone() : null,
        s: ev.s,
        intensity: ev.intensity,
        slowMoStart: slowMoEligible ? Math.max(segStart, ev.time - 0.34) : -1,
        slowMoEnd: slowMoEligible ? Math.min(segEnd, ev.time + 0.55) : -1,
      });
      cursor = segEnd;
    }

    // Ensure finish & remaining tail are covered
    while (dur - cursor > 0.15) {
      const chunkEnd = Math.min(dur, cursor + 3.4);
      const isNearEnd = dur - cursor < 3.6;
      const fAngle = isNearEnd && prevAngle !== 'finish_hero'
        ? 'finish_hero'
        : fillerAngles.find((_, idx) => fillerAngles[(fillerIdx + idx) % fillerAngles.length] !== prevAngle) || 'apex_chase';
      fillerIdx++;
      const leaderId = this.findLeaderAtTime(cursor + (chunkEnd - cursor) * 0.5);
      rawCuts.push({
        startTime: cursor,
        endTime: chunkEnd,
        angleType: fAngle,
        shotLabel: shotTitleMap[fAngle] || 'Finish Sweep',
        momentLabel: isNearEnd ? 'Checkered Flag Run' : 'Pack Battle',
        category: isNearEnd ? 'finish' : 'race',
        primaryBallId: leaderId,
        secondaryBallId: -1,
        focusPos: null,
        s: 0,
        intensity: isNearEnd ? 0.95 : 0.45,
        slowMoStart: isNearEnd ? Math.max(cursor, dur - 1.1) : -1,
        slowMoEnd: isNearEnd ? dur : -1,
      });
      prevAngle = fAngle;
      cursor = chunkEnd;
    }

    // Fallback if empty
    if (rawCuts.length === 0) {
      rawCuts.push({
        startTime: 0,
        endTime: dur,
        angleType: 'apex_chase',
        shotLabel: shotTitleMap.apex_chase,
        momentLabel: 'Full Race Replay',
        category: 'race',
        primaryBallId: balls?.[0]?.id ?? 0,
        secondaryBallId: -1,
        focusPos: null,
        s: 0,
        intensity: 0.5,
        slowMoStart: -1,
        slowMoEnd: -1,
      });
    }

    this.shots = rawCuts;
    this.activeShotIdx = -1;
  }

  findLeaderAtTime(time) {
    if (this.frames.length === 0) return 0;
    const f = this.frames[this.findFrameIndex(time)];
    for (let i = 0; i < f.ballRanks.length; i++) {
      if (f.ballRanks[i] === 1) return i;
    }
    return 0;
  }

  findFrameIndex(time) {
    const frames = this.frames;
    let lo = 0;
    let hi = frames.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (frames[mid].t <= time) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  getShotIndexAt(time) {
    for (let i = 0; i < this.shots.length; i++) {
      if (time >= this.shots[i].startTime && time <= this.shots[i].endTime) {
        return i;
      }
    }
    return Math.max(0, this.shots.length - 1);
  }
}

// ============================================================================
// Colour Utilities
// ============================================================================
function hslToHex(h, s, l) {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = sNorm * Math.min(lNorm, 1 - lNorm);
  const f = (n) => lNorm - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) => Math.round(255 * x).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

const _depthColor = new THREE.Color();
const _depthHsl = { h: 0, s: 0, l: 0 };

function scaleHexColorInt(hexInt, lightMul = 1.0, satBoost = 1.0) {
  if (lightMul >= 0.999 && satBoost <= 1.001) return hexInt;
  _depthColor.setHex(hexInt);
  _depthColor.getHSL(_depthHsl);
  const nextS = Math.min(1, _depthHsl.s * satBoost);
  const nextL = Math.max(0.03, Math.min(0.95, _depthHsl.l * lightMul));
  _depthColor.setHSL(_depthHsl.h, nextS, nextL);
  return _depthColor.getHex();
}

function scaleCssColor(cssHex, lightMul = 1.0, satBoost = 1.0) {
  if ((lightMul >= 0.999 && satBoost <= 1.001) || !cssHex || cssHex[0] !== '#') return cssHex;
  const hexInt = parseInt(cssHex.slice(1), 16);
  if (Number.isNaN(hexInt)) return cssHex;
  const scaled = scaleHexColorInt(hexInt, lightMul, satBoost);
  return `#${scaled.toString(16).padStart(6, '0')}`;
}

function generateDistinctColor(index, existingSet, paletteKey = 'grandprix') {
  const isDark = paletteKey === 'ultradark';
  let step = index;
  for (let attempt = 0; attempt < 200; attempt++) {
    const hue = (step * 137.508 + attempt * 23) % 360;
    const sat = isDark ? 92 + ((step + attempt) % 2) * 8 : 68 + ((step + attempt) % 3) * 10;
    const light = isDark ? 30 + ((step + attempt) % 4) * 4 : 48 + ((step + attempt) % 4) * 7;
    const hex = hslToHex(hue, sat, light).toLowerCase();
    if (!existingSet.has(hex)) return hex;
    step++;
  }
  return isDark
    ? hslToHex(Math.random() * 360, 96, 34).toLowerCase()
    : `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`;
}

function buildBallColorsForPalette(paletteKey, count, allowDuplicates) {
  const base = COLOR_PALETTES[paletteKey] || COLOR_PALETTES.grandprix;
  const result = [];
  const used = new Set();
  for (let i = 0; i < count; i++) {
    let candidate = base[i % base.length].toLowerCase();
    if (!allowDuplicates && used.has(candidate)) {
      candidate = generateDistinctColor(i, used, paletteKey);
    }
    used.add(candidate);
    result.push(candidate);
  }
  return result;
}

// ============================================================================
// High-Res Procedural PBR Textures (Zero External Assets, Realistic Surfaces)
// ============================================================================
function createTrackSurfaceTexture(maxAnisotropy, mapCfg, trackMul = 1.0) {
  const S = isSoftwareGl ? 1024 : 2048;
  const k = S / 1024;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = scaleCssColor(mapCfg?.trackBase || '#2d2f33', trackMul);
  ctx.fillRect(0, 0, S, S);

  // Subtle racing groove wear down track center
  const groove = ctx.createLinearGradient(0, 0, S, 0);
  groove.addColorStop(0.0, 'rgba(0,0,0,0.18)');
  groove.addColorStop(0.22, 'rgba(255,255,255,0.03)');
  groove.addColorStop(0.5, 'rgba(255,255,255,0.045)');
  groove.addColorStop(0.78, 'rgba(255,255,255,0.03)');
  groove.addColorStop(1.0, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = groove;
  ctx.fillRect(0, 0, S, S);

  // Fine aggregate asphalt & stone micro-grain (sharp at 4K/8K, noise-free in motion)
  const grainCount = isSoftwareGl ? 4200 : 12000;
  for (let i = 0; i < grainCount; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const alpha = 0.014 + Math.random() * 0.022;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha * 1.2})`;
    ctx.fillRect(x, y, 2 * k, 2 * k);
  }

  // Crisp concrete/asphalt expansion seams
  ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
  for (let y = 0; y < S; y += 256 * k) {
    ctx.fillRect(0, y, S, 3 * k);
  }

  // Razor-sharp painted motorsport shoulder lines
  ctx.fillStyle = mapCfg?.trackLine || 'rgba(238, 235, 228, 0.78)';
  ctx.fillRect(26 * k, 0, 12 * k, S);
  ctx.fillRect(S - 38 * k, 0, 12 * k, S);

  // Crisp center lane guide dashes
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  for (let y = 32 * k; y < S; y += 128 * k) {
    ctx.fillRect(S * 0.5 - 4 * k, y, 8 * k, 56 * k);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createTrackNormalTexture(maxAnisotropy) {
  const S = isSoftwareGl ? 512 : 1024;
  const seamMod = S / 4;
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    const seam = y % seamMod < 3 ? -0.32 : 0;
    for (let x = 0; x < S; x++) {
      const weave =
        Math.sin(x * 0.28) * Math.cos(y * 0.28) * 0.05 + (Math.random() - 0.5) * 0.035;
      h[y * S + x] = seam + weave;
    }
  }

  const data = new Uint8Array(S * S * 4);
  const strength = 1.15;
  for (let y = 0; y < S; y++) {
    const ym = (y - 1 + S) % S;
    const yp = (y + 1) % S;
    for (let x = 0; x < S; x++) {
      const xm = (x - 1 + S) % S;
      const xp = (x + 1) % S;
      const dx = (h[y * S + xp] - h[y * S + xm]) * strength;
      const dy = (h[yp * S + x] - h[ym * S + x]) * strength;
      let nx = -dx;
      let ny = -dy;
      let nz = 1.0;
      const invLen = 1 / Math.hypot(nx, ny, nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;
      const i = (y * S + x) * 4;
      data[i] = Math.round((nx * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[i + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

function createTrackRoughnessTexture(maxAnisotropy) {
  const S = isSoftwareGl ? 512 : 1024;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');

  // Polished racing lanes in middle (darker = glossier), grippier shoulders
  const grad = ctx.createLinearGradient(0, 0, S, 0);
  grad.addColorStop(0.0, '#b8b8b8');
  grad.addColorStop(0.16, '#848484');
  grad.addColorStop(0.5, '#686868');
  grad.addColorStop(0.84, '#848484');
  grad.addColorStop(1.0, '#b8b8b8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);

  for (let i = 0; i < (isSoftwareGl ? 2200 : 5200); i++) {
    const v = 100 + Math.floor(Math.random() * 55);
    ctx.fillStyle = `rgba(${v},${v},${v},0.06)`;
    ctx.fillRect(Math.random() * S, Math.random() * S, 3, 3);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createSkyDomeTexture(skyStops = ['#2864a8', '#5b93cd', '#a8cce6', '#dde8ee'], skyMul = 1.0) {
  const W = isSoftwareGl ? 1024 : 2048;
  const H = isSoftwareGl ? 512 : 1024;
  const k = W / 1024;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0.0, scaleCssColor(skyStops[0], skyMul));
  grad.addColorStop(0.28, scaleCssColor(skyStops[1], skyMul));
  grad.addColorStop(0.49, scaleCssColor(skyStops[2], skyMul));
  grad.addColorStop(0.56, scaleCssColor(skyStops[3], skyMul));
  grad.addColorStop(1.0, scaleCssColor(skyStops[3], skyMul));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Soft natural cirrus & cumulus cloud wisps above the horizon
  const cloudRng = mulberry32(4219);
  const cloudBright = skyMul < 0.45 ? 0.35 : skyMul < 0.8 ? 0.65 : 1.0;
  for (let i = 0; i < 65; i++) {
    const cx = cloudRng() * W;
    const cy = H * (0.18 + cloudRng() * 0.25);
    const rx = (38 + cloudRng() * 110) * k;
    const ry = (8 + cloudRng() * 20) * k;
    const alpha = (0.05 + cloudRng() * 0.11) * cloudBright;
    const cg = ctx.createRadialGradient(cx, cy, rx * 0.1, cx, cy, rx);
    cg.addColorStop(0.0, `rgba(255, 253, 248, ${alpha})`);
    cg.addColorStop(0.6, `rgba(255, 253, 248, ${alpha * 0.35})`);
    cg.addColorStop(1.0, 'rgba(255, 253, 248, 0.0)');
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    ctx.translate(-cx, -cy);
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(cx, cy, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

function createBallMarbleTexture(maxAnisotropy) {
  const S = isSoftwareGl ? 512 : 1024;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');

  // Clean, uniform high-chroma surface with subtle organic micro-sheen (zero circular lines/rings)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, S, S);

  const rng = mulberry32(9187);
  for (let i = 0; i < 180; i++) {
    const cx = rng() * S;
    const cy = rng() * S;
    const r = (18 + rng() * 52) * (S / 512);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.045)');
    g.addColorStop(1, 'rgba(235, 235, 235, 0.0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

const _richHslTmp = { h: 0, s: 0, l: 0 };
function setRichMarbleColor(targetColor, hex) {
  targetColor.set(hex);
  targetColor.getHSL(_richHslTmp);
  if (_richHslTmp.s > 0.08) {
    _richHslTmp.s = Math.min(1.0, _richHslTmp.s * 1.18);
  }
  _richHslTmp.l = Math.max(0.12, Math.min(0.74, _richHslTmp.l * 0.78));
  targetColor.setHSL(_richHslTmp.h, _richHslTmp.s, _richHslTmp.l);
  return targetColor;
}

function createBoosterTexture(maxAnisotropy) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Industrial dark brushed steel plate with muted anodized bronze chevrons
  ctx.fillStyle = '#25292e';
  ctx.fillRect(0, 0, 256, 512);

  ctx.fillStyle = '#9c6b35';
  ctx.fillRect(6, 0, 12, 512);
  ctx.fillRect(238, 0, 12, 512);

  ctx.strokeStyle = '#b98344';
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let y = 40; y < 512; y += 128) {
    ctx.beginPath();
    ctx.moveTo(48, y + 66);
    ctx.lineTo(128, y + 12);
    ctx.lineTo(208, y + 66);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1.5);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createRumbleCurbTexture(maxAnisotropy, primary = '#c63d2d', secondary = '#eae5dc') {
  const W = isSoftwareGl ? 128 : 256;
  const H = isSoftwareGl ? 512 : 1024;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const segH = H / 8;
  for (let y = 0; y < H; y += segH) {
    ctx.fillStyle = Math.round(y / segH) % 2 === 0 ? primary : secondary;
    ctx.fillRect(0, y, W, segH);
  }
  ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
  for (let i = 0; i < 900; i++) {
    ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createSoftRadialTexture() {
  const S = isSoftwareGl ? 128 : 256;
  const half = S * 0.5;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(half, half, 2, half, half, half - 2);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.42, 'rgba(255, 255, 255, 0.55)');
  grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

function createCheckeredTexture(maxAnisotropy, cols = 12, rows = 4) {
  const canvas = document.createElement('canvas');
  canvas.width = isSoftwareGl ? 1024 : 2048;
  canvas.height = isSoftwareGl ? 340 : 680;
  const ctx = canvas.getContext('2d');
  const cw = canvas.width / cols;
  const ch = canvas.height / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#f4f2ec' : '#1b1d20';
      ctx.fillRect(c * cw, r * ch, cw + 0.5, ch + 0.5);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createHazardStripeTexture(maxAnisotropy) {
  const S = isSoftwareGl ? 512 : 1024;
  const k = S / 512;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#d9821e';
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#1f2226';
  for (let i = -S; i < S * 2; i += 96 * k) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 48 * k, 0);
    ctx.lineTo(i + 560 * k, S);
    ctx.lineTo(i + 512 * k, S);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createArenaFloorTexture(maxAnisotropy) {
  // Neutral natural mineral/soil micro-detail texture multiplied cleanly by vertex colors
  const S = isSoftwareGl ? 512 : 1024;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#e5e3dc';
  ctx.fillRect(0, 0, S, S);

  for (let i = 0; i < (isSoftwareGl ? 14000 : 28000); i++) {
    const a = 0.03 + Math.random() * 0.07;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(25,22,18,${a})`;
    const sz = 1 + Math.floor(Math.random() * 3);
    ctx.fillRect(Math.random() * S, Math.random() * S, sz, sz);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(95, 95);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createSignCanvasTexture(text, bgColor = '#1e201d', fgColor = '#d97724') {
  const W = isSoftwareGl ? 512 : 1024;
  const H = isSoftwareGl ? 256 : 512;
  const k = W / 256;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = fgColor;
  ctx.lineWidth = 6 * k;
  ctx.strokeRect(6 * k, 6 * k, 244 * k, 116 * k);
  ctx.fillStyle = '#f3f2ee';
  ctx.font = `bold ${52 * k}px "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, W * 0.5, H * 0.5 + 2 * k);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ============================================================================
// Track Curve Mathematics (Seeded Variety Across All 5 Layouts)
// ============================================================================
function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function buildTrackStations(config, trackSeed = 0) {
  const rng = mulberry32(trackSeed * 7919 + 137);
  const L = config.distanceMeters;
  const W = config.trackWidth;

  const usableW = Math.max(2.5, W - 1.4);
  const cols = Math.max(2, Math.floor(usableW / 0.98));
  const rows = Math.ceil(config.ballCount / cols);
  const startApronLen = Math.max(7.5, rows * 1.15 + 3.2);
  const finishApronLen = 24.0;

  const ds = 0.5;
  const sStart = -startApronLen;
  const sEnd = L + finishApronLen;

  // Seeded track parameters so Generate New Track truly reshapes every run
  const dirSign = rng() > 0.5 ? 1 : -1;
  const basePitch = 0.295 + rng() * 0.055; // 16.9° - 20.1° energetic downhill
  const curveAmp = 0.55 + rng() * 0.48;
  const curveCycles = Math.max(1.25, L / (34 + rng() * 20));
  const secondaryAmp = (rng() - 0.5) * 0.35;
  const spiralRadius = Math.max(14, W * (1.45 + rng() * 0.45));
  const spiralCurvature = 1 / spiralRadius;
  const spiralDir = dirSign;
  const straightWaveAmp = trackSeed > 0 ? 0.05 + rng() * 0.045 : 0.03;
  const mixedWaveFreq = 0.16 + rng() * 0.12;
  const multilaneSweep = trackSeed > 0 ? (rng() - 0.5) * 0.52 : 0;

  const stations = [];
  const pos = new THREE.Vector3(0, 0, 0);
  const worldUp = new THREE.Vector3(0, 1, 0);
  let spiralYawAccum = 0;

  for (let s = sStart; s <= sEnd + 1e-4; s += ds) {
    // Downhill pitch profile
    let pitch = basePitch;
    if (s < 0) {
      pitch = 0.15;
    } else if (s < 2.2) {
      pitch = THREE.MathUtils.lerp(0.15, basePitch, smoothstep(0, 2.2, s));
    } else if (s > L) {
      pitch = THREE.MathUtils.lerp(basePitch, 0.0, smoothstep(L, L + 10, s));
    } else if (config.trackType === 'straight') {
      const env = smoothstep(6, 14, s) * (1 - smoothstep(L - 12, L, s));
      pitch = basePitch + straightWaveAmp * Math.sin(s * 0.15 + trackSeed) * env;
    } else if (config.trackType === 'mixed') {
      const env = smoothstep(4, 12, s) * (1 - smoothstep(L - 10, L, s));
      pitch = basePitch + 0.095 * Math.sin(s * mixedWaveFreq + trackSeed * 0.7) * env;
    } else if (config.trackType === 'curved' || config.trackType === 'zigzag' || config.trackType === 'chicane') {
      const env = smoothstep(6, 14, s) * (1 - smoothstep(L - 12, L, s));
      pitch = basePitch + 0.045 * Math.sin(s * 0.14 + trackSeed) * env;
    } else if (config.trackType === 'rollercoaster') {
      const env = smoothstep(3, 10, s) * (1 - smoothstep(L - 10, L, s));
      const waveCycles = Math.max(2.0, L / 28);
      const pArg = ((s - 2) / Math.max(18, L - 8)) * Math.PI * 2 * waveCycles;
      pitch = THREE.MathUtils.clamp(basePitch + 0.165 * Math.sin(pArg + trackSeed * 0.6) * env, 0.065, 0.5);
    } else if (config.trackType === 'split') {
      const env = smoothstep(5, 12, s) * (1 - smoothstep(L - 12, L, s));
      pitch = basePitch + 0.055 * Math.sin(s * 0.11 + trackSeed) * env;
    }

    // Yaw & banking profile
    let yaw = 0;
    let bank = 0;

    if (config.trackType === 'curved') {
      const span = Math.max(20, L - 10);
      const env = smoothstep(2, 10, s) * (1 - smoothstep(L - 10, L, s));
      const arg = ((s - 2) / span) * Math.PI * 2 * curveCycles;
      yaw = (curveAmp * dirSign * Math.sin(arg) + secondaryAmp * Math.sin(arg * 1.7 + 0.6)) * env;
      const dYaw =
        (curveAmp * dirSign * ((Math.PI * 2 * curveCycles) / span) * Math.cos(arg) +
          secondaryAmp * ((Math.PI * 3.4 * curveCycles) / span) * Math.cos(arg * 1.7 + 0.6)) *
        env;
      bank = THREE.MathUtils.clamp(-dYaw * 4.4, -0.25, 0.25);
    } else if (config.trackType === 'spiral') {
      const env = smoothstep(2, 10, s) * (1 - smoothstep(L - 8, L, s));
      spiralYawAccum += spiralDir * spiralCurvature * ds * env;
      yaw = spiralYawAccum;
      bank = 0.22 * spiralDir * env;
    } else if (config.trackType === 'multilane') {
      const span = Math.max(20, L - 10);
      const env = smoothstep(4, 14, s) * (1 - smoothstep(L - 14, L, s));
      const arg = ((s - 4) / span) * Math.PI * 2.0;
      yaw = multilaneSweep * Math.sin(arg) * env;
      const dYaw = multilaneSweep * ((Math.PI * 2.0) / span) * Math.cos(arg) * env;
      bank = THREE.MathUtils.clamp(-dYaw * 3.5, -0.16, 0.16);
    } else if (config.trackType === 'zigzag') {
      const span = Math.max(20, L - 10);
      const env = smoothstep(2, 9, s) * (1 - smoothstep(L - 9, L, s));
      const zigCount = Math.max(3.0, Math.round(L / 26));
      const dArg = (Math.PI * zigCount) / span;
      const arg = ((s - 2) / span) * Math.PI * zigCount;
      const sA = Math.sin(arg);
      const zigWave = (2 / Math.PI) * Math.asin(sA * 0.92);
      yaw = 0.9 * dirSign * zigWave * env;
      const dZig = (2 / Math.PI) * ((0.92 * Math.cos(arg)) / Math.sqrt(Math.max(0.08, 1 - 0.8464 * sA * sA)));
      const dYaw = 0.9 * dirSign * dZig * dArg * env;
      bank = THREE.MathUtils.clamp(-dYaw * 3.8, -0.26, 0.26);
    } else if (config.trackType === 'rollercoaster') {
      const span = Math.max(20, L - 10);
      const env = smoothstep(4, 12, s) * (1 - smoothstep(L - 12, L, s));
      const arg = ((s - 4) / span) * Math.PI * 2.0;
      yaw = (0.28 + (trackSeed % 2) * 0.12) * dirSign * Math.sin(arg) * env;
      const dYaw = (0.28 + (trackSeed % 2) * 0.12) * dirSign * ((Math.PI * 2.0) / span) * Math.cos(arg) * env;
      bank = THREE.MathUtils.clamp(-dYaw * 3.6, -0.18, 0.18);
    } else if (config.trackType === 'chicane') {
      const span = Math.max(20, L - 10);
      const env = smoothstep(3, 10, s) * (1 - smoothstep(L - 10, L, s));
      const chicanePairs = Math.max(2, Math.round(L / 34));
      const dArg = (Math.PI * 2 * chicanePairs) / span;
      const arg = ((s - 3) / span) * Math.PI * 2 * chicanePairs;
      const sVal = Math.sin(arg);
      yaw = 0.78 * dirSign * sVal * sVal * sVal * env;
      const dYaw = 0.78 * dirSign * 3 * sVal * sVal * Math.cos(arg) * dArg * env;
      bank = THREE.MathUtils.clamp(-dYaw * 3.8, -0.24, 0.24);
    } else if (config.trackType === 'split') {
      const span = Math.max(20, L - 10);
      const env = smoothstep(4, 12, s) * (1 - smoothstep(L - 12, L, s));
      const arg = ((s - 4) / span) * Math.PI * 2.0;
      yaw = 0.36 * dirSign * Math.sin(arg) * env;
      const dYaw = 0.36 * dirSign * ((Math.PI * 2.0) / span) * Math.cos(arg) * env;
      bank = THREE.MathUtils.clamp(-dYaw * 3.2, -0.15, 0.15);
    } else if (config.trackType === 'mixed') {
      const span = Math.max(20, L - 10);
      const env = smoothstep(4, 12, s) * (1 - smoothstep(L - 10, L, s));
      const cyclesMix = 2.5 + (trackSeed % 3) * 0.5;
      const arg = ((s - 4) / span) * Math.PI * cyclesMix;
      yaw = (0.58 + (trackSeed % 2) * 0.18) * dirSign * Math.sin(arg) * env;
      const dYaw = (0.58 + (trackSeed % 2) * 0.18) * dirSign * ((Math.PI * cyclesMix) / span) * Math.cos(arg) * env;
      bank = THREE.MathUtils.clamp(-dYaw * 3.8, -0.22, 0.22);
    }

    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const sy = Math.sin(yaw);
    const cy = Math.cos(yaw);
    const T = new THREE.Vector3(sy * cp, -sp, -cy * cp).normalize();

    const R0 = new THREE.Vector3().crossVectors(T, worldUp).normalize();
    const U0 = new THREE.Vector3().crossVectors(R0, T).normalize();

    const cb = Math.cos(bank);
    const sb = Math.sin(bank);
    const R = new THREE.Vector3()
      .addScaledVector(R0, cb)
      .addScaledVector(U0, sb)
      .normalize();
    const U = new THREE.Vector3()
      .addScaledVector(R0, -sb)
      .addScaledVector(U0, cb)
      .normalize();

    const basisMat = new THREE.Matrix4().makeBasis(R, U, T.clone().negate());
    const quat = new THREE.Quaternion().setFromRotationMatrix(basisMat);

    stations.push({
      s,
      pos: pos.clone(),
      T,
      R,
      U,
      quat,
      pitch,
      yaw,
      bank,
    });

    pos.addScaledVector(T, ds);
  }

  let minY = Infinity;
  for (const st of stations) {
    if (st.pos.y < minY) minY = st.pos.y;
  }
  const yLift = 10 - minY;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let maxY = -Infinity;
  minY = Infinity;

  for (const st of stations) {
    st.pos.y += yLift;
    if (st.pos.x < minX) minX = st.pos.x;
    if (st.pos.x > maxX) maxX = st.pos.x;
    if (st.pos.y < minY) minY = st.pos.y;
    if (st.pos.y > maxY) maxY = st.pos.y;
    if (st.pos.z < minZ) minZ = st.pos.z;
    if (st.pos.z > maxZ) maxZ = st.pos.z;
  }

  const halfW = W * 0.5;
  const bounds = {
    minX: minX - halfW - 3,
    maxX: maxX + halfW + 3,
    minY,
    maxY: maxY + 6,
    minZ: minZ - halfW - 3,
    maxZ: maxZ + halfW + 3,
    centerX: (minX + maxX) * 0.5,
    centerY: (minY + maxY) * 0.5,
    centerZ: (minZ + maxZ) * 0.5,
    spanX: maxX - minX + W + 6,
    spanZ: maxZ - minZ + W + 6,
  };

  // Compute checkpoint stations every 25m (or midpoint on short tracks)
  const checkpoints = [];
  if (L >= 45) {
    for (let cp = 25; cp <= L - 14; cp += 25) {
      checkpoints.push(cp);
    }
  } else {
    checkpoints.push(Math.round(L * 0.5));
  }

  return {
    stations,
    ds,
    sStart,
    sEnd,
    startApronLen,
    finishApronLen,
    cols,
    rows,
    bounds,
    checkpoints,
  };
}

function getStationAtS(trackData, targetS) {
  const { stations, sStart, ds } = trackData;
  const floatIdx = (targetS - sStart) / ds;
  const i0 = Math.max(0, Math.min(stations.length - 2, Math.floor(floatIdx)));
  const i1 = i0 + 1;
  const alpha = THREE.MathUtils.clamp(floatIdx - i0, 0, 1);

  const st0 = stations[i0];
  const st1 = stations[i1];

  const pos = new THREE.Vector3().lerpVectors(st0.pos, st1.pos, alpha);
  const T = new THREE.Vector3().lerpVectors(st0.T, st1.T, alpha).normalize();
  const R = new THREE.Vector3().lerpVectors(st0.R, st1.R, alpha).normalize();
  const U = new THREE.Vector3().lerpVectors(st0.U, st1.U, alpha).normalize();
  const quat = new THREE.Quaternion().slerpQuaternions(st0.quat, st1.quat, alpha);

  return { s: targetS, pos, T, R, U, quat };
}

// ============================================================================
// Main Simulation Application
// ============================================================================
class MarbleRushApp {
  constructor() {
    this.canvas = document.getElementById('race-canvas');
    this.sound = new SoundEngine();
    this.recorder = new GameplayRecorder(this.canvas, this.sound);
    this.cinematicRecorder = new GameplayRecorder(this.canvas, this.sound);

    // State
    this.config = {
      ...DEFAULT_CONFIG,
      enabledObstacles: new Set(DEFAULT_CONFIG.enabledObstacles),
    };
    this.ballColors = buildBallColorsForPalette(
      this.config.palette,
      this.config.ballCount,
      this.config.allowDuplicateColors
    );

    this.raceState = 'READY'; // READY | COUNTDOWN | RACING | PAUSED | FINISHED | REPLAY
    this.cameraMode = 'overview';
    this.preReplayCameraMode = 'overview';
    this.followShotAngle = 0;
    this.directorState = {
      shotName: 'Wide Dolly',
      cutAt: 0,
      cycleIdx: 0,
      fixedPos: new THREE.Vector3(),
      hasFixedPos: false,
      justCut: false,
      liveEventType: null,
      liveBallId: 0,
    };
    this.replay = new ReplaySystem();
    this.lastLeaderId = 0;
    this.raceElapsedTime = 0;
    this.countdownRemaining = 0;
    this.lastCountdownDigit = null;
    this.physicsAccumulator = 0;
    this.finishedCount = 0;
    this.winnerAnnounced = false;
    this.hudHidden = false;
    this.resultsDismissed = false;
    this.trackSeed = 0;
    this.recordedVideoInfo = null;
    this.recordedCinematicInfo = null;
    this.isRecordingCinematic = false;
    this.gameplayEndHold = 0;
    this.cinematicEndHold = 0;
    this.crowdExcitement = 0;
    this.lastReplayWinnerBannerId = -1;
    this.replayAnnouncedBallIds = new Set();
    this.activeFinishBanners = [];
    this.endLeaderboardActive = false;
    this.endLeaderboardSorted = [];
    this.minimapCache = null;
    this.lastOverlayDrawAt = 0;
    this.qualityPreset = 'standard';
    this.recordQualityPreset = 'standard';
    this.recordedVideoQuality = 'standard';
    this.recordedCinematicQuality = 'standard';
    this.replayRecordTarget = 'cinematic';
    this.isRecordingGameplayPass = false;
    this.gameplayReplayEndHold = 0;
    this._savedReplayState = null;
    this.adaptivePrScale = 1.0;
    this.slowFrameCount = 0;
    this._activeEnvMapKey = null;

    // Three.js & Rapier objects
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.controls = null;
    this.hemiLight = null;
    this.keyLight = null;
    this.rimLight = null;
    this.world = null;
    this.eventQueue = null;
    this.colliderMeta = new Map();
    this.trackGroup = null;
    this.hurdleGroup = null;
    this.ballGroup = null;
    this.contactShadowMesh = null;
    this.waterMesh = null;
    this.waterUniforms = null;
    this.physicsDebugEnabled = false;
    this.physicsDebugMesh = null;
    this._debugRgbBuffer = new Float32Array(0);
    this.hudScene = null;
    this.hudCamera = null;
    this.countdownMesh = null;
    this.countdownCanvas = null;
    this.countdownCtx = null;
    this.countdownTex = null;
    this.countdownAnimTime = 0;
    this.hudOverlayMesh = null;
    this.hudOverlayCanvas = null;
    this.hudOverlayCtx = null;
    this.hudOverlayTex = null;

    this.trackData = null;
    this.balls = [];
    this.kinematicHurdles = [];
    this.hurdleStationsS = [];
    this.flagMeshes = [];
    this.crowdSpectatorGroups = [];
    this.startGate = null;
    this.startLightPods = [];
    this.podiumSlots = [];

    // Free Camera keyboard state
    this.keysPressed = new Set();

    // Shared GPU resources
    this.shared = {};

    // Loop & timing
    this.frameId = 0;
    this.lastFrameTime = performance.now();
    this.lastHudUpdateAt = 0;
    this.smoothCamPos = new THREE.Vector3(0, 20, 30);
    this.smoothCamTarget = new THREE.Vector3(0, 10, -20);
    this.smoothFov = 52;
    this.camInitialized = false;
    this.camShake = 0;
    this.camBankRoll = 0;

    // Pre-allocated math helpers for zero-GC render loop
    this._v1 = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
    this._v3 = new THREE.Vector3();
    this._v4 = new THREE.Vector3();
    this._q1 = new THREE.Quaternion();
    this._q2 = new THREE.Quaternion();
    this._dummy = new THREE.Object3D();
    this._upVec = new THREE.Vector3(0, 1, 0);

    this.cacheDom();
    this.bindUiEvents();
  }

  cacheDom() {
    this.dom = {
      loadingScreen: document.getElementById('loading-screen'),
      loadingStatus: document.getElementById('loading-status'),
      errorScreen: document.getElementById('error-screen'),
      errorMessage: document.getElementById('error-message'),
      btnRetryInit: document.getElementById('btn-retry-init'),

      hudRoot: document.getElementById('hud-root'),
      configDrawer: document.getElementById('config-drawer'),
      btnToggleConfig: document.getElementById('btn-toggle-config'),
      leaderboardPanel: document.getElementById('leaderboard-panel'),
      btnToggleLeaderboard: document.getElementById('btn-toggle-leaderboard'),
      leaderboardList: document.getElementById('leaderboard-list'),

      hudTimer: document.getElementById('hud-timer'),
      hudLeaderSwatch: document.getElementById('hud-leader-swatch'),
      hudLeaderName: document.getElementById('hud-leader-name'),
      hudFinished: document.getElementById('hud-finished'),
      hudProgressBar: document.getElementById('hud-progress-bar'),
      hudProgressPct: document.getElementById('hud-progress-pct'),
      hudSpeed: document.getElementById('hud-speed'),
      hudRecBadge: document.getElementById('hud-rec-badge'),
      hudReplayBadge: document.getElementById('hud-replay-badge'),
      hudReplayMomentText: document.getElementById('hud-replay-moment-text'),

      btnStart: document.getElementById('btn-start-race'),
      btnPause: document.getElementById('btn-pause-race'),
      btnResume: document.getElementById('btn-resume-race'),
      btnRestart: document.getElementById('btn-restart-race'),
      btnCinematicReplay: document.getElementById('btn-cinematic-replay'),
      btnViewResults: document.getElementById('btn-view-results'),
      selectQuality: document.getElementById('select-quality'),
      btnToggleMusic: document.getElementById('btn-toggle-music'),
      btnToggleSound: document.getElementById('btn-toggle-sound'),

      // Config controls
      inputBallCount: document.getElementById('input-ball-count'),
      inputBallCountNum: document.getElementById('input-ball-count-num'),
      valBallCount: document.getElementById('val-ball-count'),
      inputBallSpeed: document.getElementById('input-ball-speed'),
      valBallSpeed: document.getElementById('val-ball-speed'),
      customDistanceWrap: document.getElementById('custom-distance-wrap'),
      inputCustomDistance: document.getElementById('input-custom-distance'),
      inputCycleMap: document.getElementById('input-cycle-map'),
      inputTrackWidth: document.getElementById('input-track-width'),
      valTrackWidth: document.getElementById('val-track-width'),
      inputExperimentalVariance: document.getElementById('input-experimental-variance'),

      inputHurdleCount: document.getElementById('input-hurdle-count'),
      inputHurdleCountNum: document.getElementById('input-hurdle-count-num'),
      valHurdleCount: document.getElementById('val-hurdle-count'),
      inputRandomHurdles: document.getElementById('input-random-hurdles'),
      obstacleTypesList: document.getElementById('obstacle-types-list'),
      btnObstaclesAll: document.getElementById('btn-obstacles-all'),
      btnObstaclesNone: document.getElementById('btn-obstacles-none'),

      btnRandomizeColors: document.getElementById('btn-randomize-colors'),
      inputAllowDuplicates: document.getElementById('input-allow-duplicates'),
      ballCountCaption: document.getElementById('ball-count-caption'),
      ballListContainer: document.getElementById('ball-list-container'),

      btnGenerateTrack: document.getElementById('btn-generate-track'),
      btnResetSettings: document.getElementById('btn-reset-settings'),

      selectMap: document.getElementById('select-map'),
      selectTrack: document.getElementById('select-track'),
      selectDistance: document.getElementById('select-distance'),
      selectDarkness: document.getElementById('select-darkness'),
      selectGravity: document.getElementById('select-gravity'),
      selectFriction: document.getElementById('select-friction'),
      selectHurdleSize: document.getElementById('select-hurdle-size'),
      selectPalette: document.getElementById('select-palette'),
      inputMusicEnabled: document.getElementById('input-music-enabled'),
      inputSoundEnabled: document.getElementById('input-sound-enabled'),
      btnToggleMusic: document.getElementById('btn-toggle-music'),

      cameraDock: document.getElementById('camera-dock'),
      selectCameraMode: document.getElementById('select-camera-mode'),
      selectFollowAngle: document.getElementById('select-follow-angle'),
      cameraShotLabel: document.getElementById('camera-shot-label'),
      btnHideHud: document.getElementById('btn-hide-hud'),
      btnShowHud: document.getElementById('btn-show-hud'),
      freeCamBar: document.getElementById('free-cam-bar'),
      btnFreeFocusLeader: document.getElementById('btn-free-focus-leader'),
      btnFreeCenterTrack: document.getElementById('btn-free-center-track'),

      replayDock: document.getElementById('replay-dock'),
      replayShotBadge: document.getElementById('replay-shot-badge'),
      replayScrubberWrap: document.getElementById('replay-scrubber-wrap'),
      replayProgressFill: document.getElementById('replay-progress-fill'),
      replayMarkers: document.getElementById('replay-markers'),
      replayScrubberThumb: document.getElementById('replay-scrubber-thumb'),
      replayTimeReadout: document.getElementById('replay-time-readout'),
      btnReplayPlay: document.getElementById('btn-replay-play'),
      btnReplayPrevHl: document.getElementById('btn-replay-prev-hl'),
      btnReplayNextHl: document.getElementById('btn-replay-next-hl'),
      selectReplaySpeed: document.getElementById('select-replay-speed'),
      inputReplaySlowmo: document.getElementById('input-replay-slowmo'),
      inputReplayAutocam: document.getElementById('input-replay-autocam'),
      btnReplayRecord: document.getElementById('btn-replay-record'),
      selectReplayQuality: document.getElementById('select-replay-quality'),
      btnReplayExit: document.getElementById('btn-replay-exit'),

      countdownOverlay: document.getElementById('countdown-overlay'),
      countdownText: document.getElementById('countdown-text'),
      winnerToast: document.getElementById('winner-toast'),
      winnerToastSwatch: document.getElementById('winner-toast-swatch'),
      winnerToastText: document.getElementById('winner-toast-text'),

      resultsModal: document.getElementById('results-modal'),
      resultsDuration: document.getElementById('results-duration'),
      resultsTrackInfo: document.getElementById('results-track-info'),
      winnerBadgeColor: document.getElementById('winner-badge-color'),
      winnerTitle: document.getElementById('winner-title'),
      winnerTimeLine: document.getElementById('winner-time-line'),
      selectExportQuality: document.getElementById('select-export-quality'),
      videoExportPanel: document.getElementById('video-export-panel'),
      videoExportMeta: document.getElementById('video-export-meta'),
      btnRenderGameplay: document.getElementById('btn-render-gameplay'),
      btnPreviewVideo: document.getElementById('btn-preview-video'),
      btnExportVideo: document.getElementById('btn-export-video'),
      videoExportCinematicPanel: document.getElementById('video-export-cinematic-panel'),
      videoCinematicMeta: document.getElementById('video-cinematic-meta'),
      btnRecordCinematic: document.getElementById('btn-record-cinematic'),
      btnPreviewCinematic: document.getElementById('btn-preview-cinematic'),
      btnExportCinematic: document.getElementById('btn-export-cinematic'),
      videoPreviewWrap: document.getElementById('video-preview-wrap'),
      replayVideoPlayer: document.getElementById('replay-video-player'),
      resultsTableBody: document.getElementById('results-table-body'),
      btnResultsCinematicReplay: document.getElementById('btn-results-cinematic-replay'),
      btnResultsRaceAgain: document.getElementById('btn-results-race-again'),
      btnResultsNewTrack: document.getElementById('btn-results-new-track'),
      btnResultsSettings: document.getElementById('btn-results-settings'),
    };
  }

  async init() {
    try {
      this.dom.loadingStatus.textContent = 'Loading Rapier 3D physics WASM...';
      await RAPIER.init();

      this.dom.loadingStatus.textContent = 'Building 3D studio environment...';
      this.initThreeScene();
      this.initSharedAssets();

      this.dom.loadingStatus.textContent = 'Generating racing circuit...';
      this.renderBallColorEditor();
      this.rebuildTrackAndRace({ preserveCamera: false });

      if (!isSoftwareGl) {
        try {
          this.renderer.compile(this.scene, this.camera);
        } catch (compileErr) {
          console.warn('Pre-compile warning:', compileErr);
        }
      }

      this.syncUiState();
      this.hideLoadingScreen();
      this.startLoop();
    } catch (err) {
      console.error('Initialization error:', err);
      this.dom.loadingScreen.classList.add('hidden');
      this.dom.errorMessage.textContent =
        err?.message || 'Failed to initialize WebGL or Rapier physics.';
      this.dom.errorScreen.classList.remove('hidden');
    }
  }

  hideLoadingScreen() {
    this.dom.loadingScreen.classList.add('fade-out');
    setTimeout(() => {
      this.dom.loadingScreen.classList.add('hidden');
    }, 380);
  }

  getEffectiveQualityPresetKey() {
    if (
      !isSoftwareGl &&
      (this.isRecordingCinematic || this.isRecordingGameplayPass) &&
      QUALITY_PRESETS[this.recordQualityPreset]
    ) {
      return this.recordQualityPreset;
    }
    return QUALITY_PRESETS[this.qualityPreset] ? this.qualityPreset : 'standard';
  }

  getTargetPixelRatio() {
    if (isSoftwareGl) return 1;
    const w = Math.max(1, window.innerWidth || 1280);
    const h = Math.max(1, window.innerHeight || 720);
    const activeKey = this.getEffectiveQualityPresetKey();
    const qCfg = QUALITY_PRESETS[activeKey] || QUALITY_PRESETS.standard;
    const isRecordingPass = this.isRecordingCinematic || this.isRecordingGameplayPass;
    const prScale = isRecordingPass ? 1.0 : this.adaptivePrScale;
    const desiredPr = Math.max(
      window.devicePixelRatio || 1,
      qCfg.targetLongestEdge / Math.max(w, h)
    );
    let pr = Math.min(desiredPr, qCfg.maxPr) * prScale;
    if (this.renderer) {
      const caps = this.renderer.capabilities;
      const gl = this.renderer.getContext();
      const maxRb = gl ? gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) || 4096 : 4096;
      const maxVp = gl ? gl.getParameter(gl.MAX_VIEWPORT_DIMS) || [4096, 4096] : [4096, 4096];
      const maxW = Math.min(caps.maxTextureSize || 4096, maxRb, maxVp[0] || 4096, 7680);
      const maxH = Math.min(caps.maxTextureSize || 4096, maxRb, maxVp[1] || 4096, 4320);
      const maxPixelBudgetPr = Math.sqrt(33_200_000 / Math.max(1, w * h));
      const maxSafePr = Math.min(maxW / w, maxH / h, maxPixelBudgetPr);
      pr = Math.max(0.75, Math.min(pr, maxSafePr));
    }
    return pr;
  }

  initThreeScene() {
    const w = Math.max(1, window.innerWidth || 1280);
    const h = Math.max(1, window.innerHeight || 720);
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(this.getTargetPixelRatio());
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping ?? THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.88;
    this.renderer.shadowMap.enabled = !isSoftwareGl;
    this.renderer.shadowMap.type = isSoftwareGl ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xc2d5e0);
    this.scene.fog = new THREE.FogExp2(0xc2d5e0, 0.00118);

    // Outdoor Daylight IBL Reflections (updated per active territory)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.shared.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.shared.envMap;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(
      52,
      window.innerWidth / window.innerHeight,
      0.2,
      2600
    );
    this.camera.position.set(16, 26, 18);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = !isSoftwareGl;
    this.controls.dampingFactor = 0.08;
    this.controls.screenSpacePanning = true;
    this.controls.rotateSpeed = 0.85;
    this.controls.panSpeed = 1.25;
    this.controls.zoomSpeed = 1.35;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.maxDistance = 680;
    this.controls.minDistance = 2.5;
    this.controls.enabled = false;

    // Natural Sun + Sky Hemisphere Lighting Rig
    this.hemiLight = new THREE.HemisphereLight(0xd4e8ff, 0x3b352c, 0.94);
    this.scene.add(this.hemiLight);

    const qCfg = QUALITY_PRESETS[this.qualityPreset] || QUALITY_PRESETS.standard;
    const maxTex = this.renderer.capabilities.maxTextureSize || 4096;
    const shadowRes = isSoftwareGl ? 1024 : Math.min(qCfg.shadowSize, maxTex);

    this.keyLight = new THREE.DirectionalLight(0xfff1d6, 2.85);
    this.keyLight.position.set(42, 72, 34);
    this.keyLight.castShadow = !isSoftwareGl;
    this.keyLight.shadow.mapSize.set(shadowRes, shadowRes);
    const d = 42;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.camera.near = 4;
    this.keyLight.shadow.camera.far = 210;
    this.keyLight.shadow.bias = -0.00025;
    this.keyLight.shadow.normalBias = 0.015;
    this.scene.add(this.keyLight);
    this.scene.add(this.keyLight.target);

    this.rimLight = new THREE.DirectionalLight(0x9ec6eb, 0.45);
    this.rimLight.position.set(-40, 30, -50);
    this.scene.add(this.rimLight);

    // Scene hierarchy groups
    this.trackGroup = new THREE.Group();
    this.hurdleGroup = new THREE.Group();
    this.ballGroup = new THREE.Group();
    this.scene.add(this.trackGroup, this.hurdleGroup, this.ballGroup);

    // Daylight sky dome
    const skyGeo = new THREE.SphereGeometry(920, 48, 32);
    const skyMat = new THREE.MeshBasicMaterial({
      map: createSkyDomeTexture(TERRITORIES.expedition.skyStops),
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    });
    this.skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyDome);

    // WebGL Orthographic Countdown Overlay (captured cleanly inside GameplayRecorder MP4/WebM video)
    const aspect = w / h;
    this.hudScene = new THREE.Scene();
    this.hudCamera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0, 10);
    this.countdownCanvas = document.createElement('canvas');
    this.countdownCanvas.width = isSoftwareGl ? 512 : 1536;
    this.countdownCanvas.height = isSoftwareGl ? 256 : 768;
    this.countdownCtx = this.countdownCanvas.getContext('2d');
    this.countdownTex = new THREE.CanvasTexture(this.countdownCanvas);
    this.countdownTex.colorSpace = THREE.SRGBColorSpace;
    this.countdownTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const cdMat = new THREE.MeshBasicMaterial({
      map: this.countdownTex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.countdownMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.575), cdMat);
    this.countdownMesh.position.set(0, 0.08, -1);
    this.countdownMesh.visible = false;
    this.hudScene.add(this.countdownMesh);

    // Full-frame WebGL Broadcast Overlay (Minimap, Live Standings, Finisher Notifications, Final Leaderboard)
    this.hudOverlayCanvas = document.createElement('canvas');
    this.hudOverlayCtx = this.hudOverlayCanvas.getContext('2d');
    const ovMat = new THREE.MeshBasicMaterial({
      map: null,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.hudOverlayMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), ovMat);
    this.hudOverlayMesh.position.set(0, 0, -1.25);
    this.hudOverlayMesh.visible = false;
    this.hudScene.add(this.hudOverlayMesh);
    this.syncHudOverlayLayout(true);

    // Canvas WebGL context safety
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      if (this.frameId) {
        cancelAnimationFrame(this.frameId);
        clearTimeout(this.frameId);
      }
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.startLoop();
    });

    window.addEventListener('resize', () => this.onResize());
  }

  initSharedAssets() {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const mapCfg = TERRITORIES[this.config.mapPreset] || TERRITORIES.expedition;
    this.shared.trackTex = createTrackSurfaceTexture(maxAniso, mapCfg);
    this.shared.trackNormalTex = createTrackNormalTexture(maxAniso);
    this.shared.trackRoughnessTex = createTrackRoughnessTexture(maxAniso);
    this.shared.rumbleTex = createRumbleCurbTexture(
      maxAniso,
      mapCfg.curbPrimary,
      mapCfg.curbSecondary
    );
    this.shared.marbleTex = createBallMarbleTexture(maxAniso);
    this.shared.checkerTex = createCheckeredTexture(maxAniso);
    this.shared.hazardTex = createHazardStripeTexture(maxAniso);
    this.shared.floorTex = createArenaFloorTexture(maxAniso);
    this.shared.boosterTex = createBoosterTexture(maxAniso);
    this.shared.softRadialTex = createSoftRadialTexture();

    this.shared.ballGeo = new THREE.SphereGeometry(
      BALL_RADIUS,
      isSoftwareGl ? 28 : 48,
      isSoftwareGl ? 20 : 36
    );

    // Instanced soft contact shadows directly beneath every marble
    const shadowGeo = new THREE.PlaneGeometry(BALL_RADIUS * 2.4, BALL_RADIUS * 2.4);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: this.shared.softRadialTex,
      color: 0x000000,
      transparent: true,
      opacity: 0.44,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    this.contactShadowMesh = new THREE.InstancedMesh(shadowGeo, shadowMat, 50);
    this.contactShadowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.contactShadowMesh.frustumCulled = false;
    this._dummy.scale.set(0, 0, 0);
    this._dummy.updateMatrix();
    for (let i = 0; i < 50; i++) {
      this.contactShadowMesh.setMatrixAt(i, this._dummy.matrix);
    }
    this.contactShadowMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.contactShadowMesh);
  }

  updateEnvironmentReflection(mapCfg, darkCfg) {
    if (!this.renderer || isSoftwareGl) return;
    const skyMul = darkCfg?.skyMul ?? 1.0;
    const terrainMul = darkCfg?.terrainMul ?? 1.0;
    const iblScene = new THREE.Scene();
    const skySphere = new THREE.Mesh(
      new THREE.SphereGeometry(20, 24, 16),
      new THREE.MeshBasicMaterial({
        map: createSkyDomeTexture(mapCfg.skyStops, skyMul),
        side: THREE.BackSide,
      })
    );
    iblScene.add(skySphere);

    // Subtle terrain ground bounce for natural reflections without harsh sun hotspot glare
    const groundBounce = new THREE.Mesh(
      new THREE.CircleGeometry(18, 24),
      new THREE.MeshBasicMaterial({
        color: scaleHexColorInt(mapCfg.hemiGround, terrainMul),
        side: THREE.DoubleSide,
      })
    );
    groundBounce.rotation.x = -Math.PI / 2;
    groundBounce.position.set(0, -10, 0);
    iblScene.add(groundBounce);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const nextEnv = pmrem.fromScene(iblScene, 0.04).texture;
    if (this.shared.envMap) this.shared.envMap.dispose();
    this.shared.envMap = nextEnv;
    this.scene.environment = nextEnv;

    skySphere.material.map.dispose();
    skySphere.geometry.dispose();
    skySphere.material.dispose();
    groundBounce.geometry.dispose();
    groundBounce.material.dispose();
    pmrem.dispose();
  }

  applyMapEnvironment() {
    const mapKey = this.config.mapPreset || 'expedition';
    const mapCfg = TERRITORIES[mapKey] || TERRITORIES.expedition;
    const darkKey = this.config.colorDarkness || 'standard';
    const darkCfg = COLOR_DARKNESS_PRESETS[darkKey] || COLOR_DARKNESS_PRESETS.standard;
    const satBoost = darkCfg.satBoost ?? 1.0;
    const envCacheKey = `${mapKey}:${darkKey}`;
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();

    if (this._activeEnvMapKey !== envCacheKey) {
      this._activeEnvMapKey = envCacheKey;

      const richSkyStops = mapCfg.skyStops.map((s) => scaleCssColor(s, 1.0, satBoost));
      if (this.skyDome && this.skyDome.material) {
        if (this.skyDome.material.map) this.skyDome.material.map.dispose();
        this.skyDome.material.map = createSkyDomeTexture(richSkyStops, darkCfg.skyMul);
        this.skyDome.material.needsUpdate = true;
      }
      this.updateEnvironmentReflection({ ...mapCfg, skyStops: richSkyStops }, darkCfg);

      if (this.shared.trackTex) this.shared.trackTex.dispose();
      if (this.shared.rumbleTex) this.shared.rumbleTex.dispose();
      this.shared.trackTex = createTrackSurfaceTexture(maxAniso, mapCfg, darkCfg.trackMul);
      this.shared.rumbleTex = createRumbleCurbTexture(
        maxAniso,
        scaleCssColor(mapCfg.curbPrimary, darkCfg.trackMul, satBoost),
        scaleCssColor(mapCfg.curbSecondary, Math.max(0.7, darkCfg.trackMul), 1.0)
      );
    }

    const fogHex = scaleHexColorInt(mapCfg.fogColor, darkCfg.fogMul, satBoost);
    this.scene.background.setHex(fogHex);
    this.scene.fog.color.setHex(fogHex);
    this.scene.fog.density = mapCfg.fogDensity;

    this.hemiLight.color.setHex(scaleHexColorInt(mapCfg.hemiSky, darkCfg.skyMul, satBoost));
    this.hemiLight.groundColor.setHex(scaleHexColorInt(mapCfg.hemiGround, darkCfg.terrainMul, satBoost));
    this.hemiLight.intensity = mapCfg.hemiIntensity * darkCfg.hemiMul;

    this.keyLight.color.setHex(mapCfg.keyColor);
    this.keyLight.intensity = mapCfg.keyIntensity * darkCfg.keyMul;

    this.rimLight.color.setHex(mapCfg.rimColor);
    this.rimLight.intensity = mapCfg.rimIntensity * darkCfg.rimMul;

    this.renderer.toneMappingExposure = mapCfg.exposure * darkCfg.exposureMul * 0.88;
    return { ...mapCfg, _darkCfg: darkCfg };
  }

  syncHudOverlayLayout(force = false) {
    if (!this.hudOverlayCanvas || !this.hudOverlayMesh || !this.renderer) return;
    const w = Math.max(1, window.innerWidth || 1280);
    const h = Math.max(1, window.innerHeight || 720);
    const aspect = w / h;
    const pr = this.getTargetPixelRatio();
    const targetH = isSoftwareGl
      ? 540
      : Math.max(1080, Math.min(2160, Math.round(h * pr)));
    const minW = isSoftwareGl ? 480 : 960;
    const maxW = isSoftwareGl ? 1280 : 3840;
    const targetW = THREE.MathUtils.clamp(Math.round(targetH * aspect), minW, maxW);

    this.hudOverlayMesh.scale.set(aspect, 1, 1);

    if (
      force ||
      !this.hudOverlayTex ||
      Math.abs(this.hudOverlayCanvas.width - targetW) > 18 ||
      Math.abs(this.hudOverlayCanvas.height - targetH) > 18
    ) {
      this.hudOverlayCanvas.width = targetW;
      this.hudOverlayCanvas.height = targetH;
      if (this.hudOverlayTex) {
        this.hudOverlayTex.dispose();
      }
      this.hudOverlayTex = new THREE.CanvasTexture(this.hudOverlayCanvas);
      this.hudOverlayTex.colorSpace = THREE.SRGBColorSpace;
      this.hudOverlayTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      this.hudOverlayMesh.material.map = this.hudOverlayTex;
      this.hudOverlayMesh.material.needsUpdate = true;
      this.lastOverlayDrawAt = 0;
    }
  }

  onResize() {
    const w = Math.max(1, window.innerWidth || 1280);
    const h = Math.max(1, window.innerHeight || 720);
    const aspect = w / h;
    const pr = this.getTargetPixelRatio();
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    if (this.hudCamera) {
      this.hudCamera.left = -aspect;
      this.hudCamera.right = aspect;
      this.hudCamera.top = 1;
      this.hudCamera.bottom = -1;
      this.hudCamera.updateProjectionMatrix();
    }
    this.syncHudOverlayLayout(false);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h);
  }

  // ==========================================================================
  // Disposal & Clean Rebuild
  // ==========================================================================
  disposeGroup(group) {
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      child.traverse((obj) => {
        if (obj.geometry && obj.geometry !== this.shared.ballGeo) {
          obj.geometry.dispose();
        }
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          const sharedMaps = [
            this.shared.trackTex,
            this.shared.trackNormalTex,
            this.shared.trackRoughnessTex,
            this.shared.rumbleTex,
            this.shared.marbleTex,
            this.shared.checkerTex,
            this.shared.hazardTex,
            this.shared.floorTex,
            this.shared.boosterTex,
            this.shared.softRadialTex,
          ];
          for (const m of mats) {
            if (m.map && !sharedMaps.includes(m.map)) m.map.dispose();
            if (m.bumpMap && !sharedMaps.includes(m.bumpMap)) m.bumpMap.dispose();
            if (m.normalMap && !sharedMaps.includes(m.normalMap)) m.normalMap.dispose();
            if (m.roughnessMap && !sharedMaps.includes(m.roughnessMap)) m.roughnessMap.dispose();
            if (m.emissiveMap && !sharedMaps.includes(m.emissiveMap)) m.emissiveMap.dispose();
            m.dispose();
          }
        }
      });
    }
  }

  rebuildTrackAndRace({ preserveCamera = false } = {}) {
    const wasRecording =
      this.recorder.isRecording ||
      this.cinematicRecorder.isRecording ||
      this.isRecordingGameplayPass ||
      this.isRecordingCinematic;
    this.recorder.discard();
    this.cinematicRecorder.discard();
    this.recordedVideoInfo = null;
    this.recordedCinematicInfo = null;
    this.recordedVideoQuality = this.qualityPreset;
    this.recordedCinematicQuality = this.recordQualityPreset;
    this.isRecordingCinematic = false;
    this.isRecordingGameplayPass = false;
    this.replayRecordTarget = 'cinematic';
    this.gameplayEndHold = 0;
    this.gameplayReplayEndHold = 0;
    this.cinematicEndHold = 0;
    this._savedReplayState = null;
    if (wasRecording) this.applyEffectiveRenderQuality();
    this.crowdExcitement = 0;
    this.lastReplayWinnerBannerId = -1;
    this.replayAnnouncedBallIds = new Set();
    this.activeFinishBanners = [];
    this.endLeaderboardActive = false;
    this.endLeaderboardSorted = [];
    this.dom.hudRecBadge.classList.add('hidden');
    this.dom.videoPreviewWrap.classList.add('hidden');
    this.dom.replayVideoPlayer.removeAttribute('src');
    this.dom.videoExportPanel.classList.add('hidden');
    if (this.dom.videoExportCinematicPanel) {
      this.dom.videoExportCinematicPanel.classList.add('hidden');
    }

    if (this.countdownMesh) this.countdownMesh.visible = false;
    this.hideCanvasOverlay();
    if (this.contactShadowMesh) {
      this._dummy.scale.set(0, 0, 0);
      this._dummy.updateMatrix();
      for (let i = 0; i < 50; i++) {
        this.contactShadowMesh.setMatrixAt(i, this._dummy.matrix);
      }
      this.contactShadowMesh.instanceMatrix.needsUpdate = true;
    }

    this.raceState = 'READY';
    this.replay.reset();
    this.lastLeaderId = 0;
    this.raceElapsedTime = 0;
    this.physicsAccumulator = 0;
    this.finishedCount = 0;
    this.winnerAnnounced = false;
    this.resultsDismissed = false;
    this.camShake = 0;
    this.camBankRoll = 0;
    this.directorState.cutAt = 0;
    this.directorState.hasFixedPos = false;
    this.directorState.shotName = 'Wide Dolly';
    this.directorState.liveEventType = null;
    this.directorState.liveBallId = 0;
    this.kinematicHurdles = [];
    this.hurdleStationsS = [];
    this.flagMeshes = [];
    this.crowdSpectatorGroups = [];
    this.waterMesh = null;
    this.waterUniforms = null;
    this.podiumSlots = [];
    this.startLightPods = [];
    this.balls = [];
    this.startGate = null;
    this.colliderMeta.clear();
    this.sound.updateRollingBed(0, false);
    this.sound.updateCrowdExcitement(0, false);

    this.dom.countdownOverlay.classList.add('hidden');
    this.dom.winnerToast.classList.add('hidden');
    this.dom.resultsModal.classList.add('hidden');
    this.dom.btnViewResults.classList.add('hidden');
    if (this.dom.btnCinematicReplay) this.dom.btnCinematicReplay.classList.add('hidden');
    if (this.dom.replayDock) this.dom.replayDock.classList.add('hidden');
    if (this.dom.hudReplayBadge) this.dom.hudReplayBadge.classList.add('hidden');
    if (this.dom.cameraDock) this.dom.cameraDock.classList.remove('hidden');

    // Dispose old Three.js objects & Rapier world
    this.disposeGroup(this.trackGroup);
    this.disposeGroup(this.hurdleGroup);
    this.disposeGroup(this.ballGroup);
    if (this.eventQueue) {
      this.eventQueue.free();
      this.eventQueue = null;
    }
    if (this.world) {
      this.world.free();
      this.world = null;
    }

    // Apply selected Map / Environment theme
    const mapCfg = this.applyMapEnvironment();

    // Create fresh Rapier world & collision event queue
    const gVal = GRAVITY_PRESETS[this.config.gravityPreset]?.value ?? 9.81;
    this.world = new RAPIER.World({ x: 0.0, y: -gVal, z: 0.0 });
    this.eventQueue = new RAPIER.EventQueue(true);

    // Generate track geometry + physics collider
    this.trackData = buildTrackStations(this.config, this.trackSeed);
    this.buildMinimapCache();
    this.buildTrackMeshesAndPhysics(mapCfg);
    this.buildEnvironmentFloorAndSupports(mapCfg);
    this.buildDistanceMarkers();
    this.buildStartGate();
    this.buildFinishArchAndPodium();
    this.buildMultiLaneOrSplitFeatures();
    this.buildHurdles();
    this.buildBoosterPads();
    this.spawnBalls();

    if (!preserveCamera) {
      this.snapOverviewCamera();
    }

    this.updateLeaderboard(true);
    this.syncUiState();
    this.renderBroadcastHudCanvas(true);
  }

  // ==========================================================================
  // Watertight Swept 3D Track Mesh & Physics Trimesh
  // ==========================================================================
  buildTrackMeshesAndPhysics(mapCfg) {
    const { stations } = this.trackData;
    const halfW = this.config.trackWidth / 2;
    const curbW = 0.36;
    const curbH = 0.16;
    const wallH = 0.50;
    const wallT = 0.42;
    const shieldTopY = 3.55;
    const physShieldMidY = 4.6;
    const physShieldTopY = 6.5;
    const deckBottom = -0.68;

    const profile = [
      [-halfW + curbW, 0],
      [halfW - curbW, 0],
      [halfW, curbH],
      [halfW, wallH],
      [halfW + wallT, wallH],
      [halfW + wallT, deckBottom],
      [-halfW - wallT, deckBottom],
      [-halfW - wallT, wallH],
      [-halfW, wallH],
      [-halfW, curbH],
    ];
    const P = profile.length;
    const numStations = stations.length;

    const positions = [];
    const uvs = [];
    const indices = [];

    const railPositions = [];
    const railUvs = [];
    const railIndices = [];

    const glassPositions = [];
    const glassUvs = [];
    const glassIndices = [];

    const rightShieldProfile = [
      [halfW, wallH - 0.12],
      [halfW, physShieldMidY],
      [halfW - 0.48, physShieldTopY],
      [halfW + wallT + 0.16, physShieldTopY],
      [halfW + wallT + 0.16, wallH - 0.12],
    ];
    const leftShieldProfile = [
      [-halfW - wallT - 0.16, wallH - 0.12],
      [-halfW - wallT - 0.16, physShieldTopY],
      [-halfW + 0.48, physShieldTopY],
      [-halfW, physShieldMidY],
      [-halfW, wallH - 0.12],
    ];
    const shieldVertsR = [];
    const shieldIndicesR = [];
    const shieldVertsL = [];
    const shieldIndicesL = [];

    for (let i = 0; i < numStations; i++) {
      const st = stations[i];
      const vCoord = st.s * 0.25;
      for (let k = 0; k < P; k++) {
        const [lx, ly] = profile[k];
        const vx = st.pos.x + st.R.x * lx + st.U.x * ly;
        const vy = st.pos.y + st.R.y * lx + st.U.y * ly;
        const vz = st.pos.z + st.R.z * lx + st.U.z * ly;
        positions.push(vx, vy, vz);
        const uCoord =
          k <= 2 || k === 9
            ? (lx + halfW) / this.config.trackWidth
            : (lx + halfW) / this.config.trackWidth + (k - 2) * 0.08;
        uvs.push(uCoord, vCoord);
      }

      // Physics containment upper shields (solid watertight walls up to 6.5m with inward catch lip)
      for (let k = 0; k < 5; k++) {
        const [rx, ry] = rightShieldProfile[k];
        shieldVertsR.push(
          st.pos.x + st.R.x * rx + st.U.x * ry,
          st.pos.y + st.R.y * rx + st.U.y * ry,
          st.pos.z + st.R.z * rx + st.U.z * ry
        );
        const [lx, ly] = leftShieldProfile[k];
        shieldVertsL.push(
          st.pos.x + st.R.x * lx + st.U.x * ly,
          st.pos.y + st.R.y * lx + st.U.y * ly,
          st.pos.z + st.R.z * lx + st.U.z * ly
        );
      }

      // Crystal-clear tall architectural safety glass rising cleanly from the low 0.50m curb
      const glassPts = [
        [-halfW - 0.05, wallH],
        [-halfW - 0.05, shieldTopY],
        [halfW + 0.05, wallH],
        [halfW + 0.05, shieldTopY],
      ];
      for (let g = 0; g < 4; g++) {
        const [gx, gy] = glassPts[g];
        glassPositions.push(
          st.pos.x + st.R.x * gx + st.U.x * gy,
          st.pos.y + st.R.y * gx + st.U.y * gy,
          st.pos.z + st.R.z * gx + st.U.z * gy
        );
        glassUvs.push(g % 2, vCoord);
      }

      // Slim hairline brushed aluminum edge cap on top of glass fence (unobstructed view)
      const railPts = [
        [-halfW - 0.08, shieldTopY + 0.02],
        [-halfW - 0.02, shieldTopY + 0.02],
        [halfW + 0.02, shieldTopY + 0.02],
        [halfW + 0.08, shieldTopY + 0.02],
      ];
      for (let r = 0; r < 4; r++) {
        const [rx, ry] = railPts[r];
        railPositions.push(
          st.pos.x + st.R.x * rx + st.U.x * ry,
          st.pos.y + st.R.y * rx + st.U.y * ry,
          st.pos.z + st.R.z * rx + st.U.z * ry
        );
        railUvs.push(r % 2, vCoord);
      }
    }

    for (let i = 0; i < numStations - 1; i++) {
      const rowA = i * P;
      const rowB = (i + 1) * P;
      for (let k = 0; k < P; k++) {
        const nextK = (k + 1) % P;
        const a = rowA + k;
        const b = rowA + nextK;
        const c = rowB + nextK;
        const d = rowB + k;
        indices.push(a, b, c, a, c, d);
      }

      const sA = i * 5;
      const sB = (i + 1) * 5;
      for (let k = 0; k < 5; k++) {
        const nk = (k + 1) % 5;
        shieldIndicesR.push(sA + k, sA + nk, sB + nk, sA + k, sB + nk, sB + k);
        shieldIndicesL.push(sA + k, sA + nk, sB + nk, sA + k, sB + nk, sB + k);
      }

      const rA = i * 4;
      const rB = (i + 1) * 4;
      railIndices.push(rA, rA + 1, rB + 1, rA, rB + 1, rB);
      railIndices.push(rA + 2, rA + 3, rB + 3, rA + 2, rB + 3, rB + 2);
      glassIndices.push(rA, rA + 1, rB + 1, rA, rB + 1, rB);
      glassIndices.push(rA + 2, rB + 3, rA + 3, rA + 2, rB + 2, rB + 3);
    }

    const addEndWall = (st, dirSign, visualHeight, physHeight) => {
      const wallCenter = st.pos
        .clone()
        .addScaledVector(st.U, visualHeight * 0.5)
        .addScaledVector(st.T, dirSign * 0.35);
      const wallBox = new THREE.BoxGeometry(this.config.trackWidth + wallT * 2, visualHeight, 0.7);
      const darkTrackMul = mapCfg?._darkCfg?.trackMul ?? 1.0;
      const wallMat = new THREE.MeshStandardMaterial({
        color: scaleHexColorInt(mapCfg?.pylonColor ?? 0x262f3f, darkTrackMul),
        roughness: 0.45,
        metalness: 0.55,
      });
      const wallMesh = new THREE.Mesh(wallBox, wallMat);
      wallMesh.position.copy(wallCenter);
      wallMesh.quaternion.copy(st.quat);
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      this.trackGroup.add(wallMesh);

      const physCenter = st.pos
        .clone()
        .addScaledVector(st.U, physHeight * 0.5)
        .addScaledVector(st.T, dirSign * 0.35);
      const frictionCfg = FRICTION_PRESETS[this.config.frictionPreset];
      const rb = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed()
          .setTranslation(physCenter.x, physCenter.y, physCenter.z)
          .setRotation(st.quat)
      );
      const col = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(
          (this.config.trackWidth + wallT * 2) * 0.5,
          physHeight * 0.5,
          0.35
        )
          .setFriction(frictionCfg.friction)
          .setRestitution(0.45),
        rb
      );
      this.colliderMeta.set(col.handle, { kind: 'wall' });
    };

    addEndWall(stations[0], -1, 1.35, 6.2);
    addEndWall(stations[stations.length - 1], 1, 1.55, 6.2);

    const trackGeo = new THREE.BufferGeometry();
    trackGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    trackGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    trackGeo.setIndex(indices);
    trackGeo.computeVertexNormals();

    const trackMat = new THREE.MeshStandardMaterial({
      map: this.shared.trackTex,
      normalMap: this.shared.trackNormalTex,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughnessMap: this.shared.trackRoughnessTex,
      roughness: this.config.frictionPreset === 'ice' ? 0.18 : 0.84,
      metalness: 0.08,
      envMapIntensity: 0.9,
    });
    const trackMesh = new THREE.Mesh(trackGeo, trackMat);
    trackMesh.castShadow = true;
    trackMesh.receiveShadow = true;
    this.trackGroup.add(trackMesh);

    const glassGeo = new THREE.BufferGeometry();
    glassGeo.setAttribute('position', new THREE.Float32BufferAttribute(glassPositions, 3));
    glassGeo.setAttribute('uv', new THREE.Float32BufferAttribute(glassUvs, 2));
    glassGeo.setIndex(glassIndices);
    glassGeo.computeVertexNormals();
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xdcebf7,
      transparent: true,
      opacity: 0.11,
      roughness: 0.08,
      metalness: 0.06,
      envMapIntensity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const glassMesh = new THREE.Mesh(glassGeo, glassMat);
    this.trackGroup.add(glassMesh);

    const railGeo = new THREE.BufferGeometry();
    railGeo.setAttribute('position', new THREE.Float32BufferAttribute(railPositions, 3));
    railGeo.setAttribute('uv', new THREE.Float32BufferAttribute(railUvs, 2));
    railGeo.setIndex(railIndices);
    railGeo.computeVertexNormals();

    const railMat = new THREE.MeshStandardMaterial({
      color: scaleHexColorInt(mapCfg?.railColor ?? 0x6f767e, mapCfg?._darkCfg?.trackMul ?? 1.0),
      roughness: 0.35,
      metalness: 0.72,
      side: THREE.DoubleSide,
    });
    const railMesh = new THREE.Mesh(railGeo, railMat);
    railMesh.castShadow = false;
    railMesh.receiveShadow = true;
    this.trackGroup.add(railMesh);

    // Painted matte motorsport rumble curbs flanking both track shoulders (non-emissive)
    const curbPositions = [];
    const curbUvs = [];
    const curbIndices = [];
    for (let i = 0; i < numStations; i++) {
      const st = stations[i];
      const vCurb = st.s * 0.45;
      const pts = [
        [-halfW + 0.02, curbH + 0.02],
        [-halfW + 0.02, curbH + 0.16],
        [halfW - 0.02, curbH + 0.02],
        [halfW - 0.02, curbH + 0.16],
      ];
      for (let k = 0; k < 4; k++) {
        curbPositions.push(
          st.pos.x + st.R.x * pts[k][0] + st.U.x * pts[k][1],
          st.pos.y + st.R.y * pts[k][0] + st.U.y * pts[k][1],
          st.pos.z + st.R.z * pts[k][0] + st.U.z * pts[k][1]
        );
        curbUvs.push(k % 2, vCurb);
      }
    }
    for (let i = 0; i < numStations - 1; i++) {
      const a = i * 4;
      const b = (i + 1) * 4;
      curbIndices.push(a, a + 1, b + 1, a, b + 1, b);
      curbIndices.push(a + 2, b + 3, a + 3, a + 2, b + 2, b + 3);
    }
    const curbGeo = new THREE.BufferGeometry();
    curbGeo.setAttribute('position', new THREE.Float32BufferAttribute(curbPositions, 3));
    curbGeo.setAttribute('uv', new THREE.Float32BufferAttribute(curbUvs, 2));
    curbGeo.setIndex(curbIndices);
    curbGeo.computeVertexNormals();
    const curbMat = new THREE.MeshStandardMaterial({
      map: this.shared.rumbleTex,
      roughness: 0.72,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    const curbMesh = new THREE.Mesh(curbGeo, curbMat);
    curbMesh.receiveShadow = true;
    this.trackGroup.add(curbMesh);

    // Rapier Trimesh Collider from the solid track shell + upper containment walls
    const frictionCfg = FRICTION_PRESETS[this.config.frictionPreset];
    const vertsF32 = new Float32Array(positions);
    const idxU32 = new Uint32Array(indices);
    const trackBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const trimeshCol = RAPIER.ColliderDesc.trimesh(vertsF32, idxU32)
      .setFriction(frictionCfg.friction)
      .setRestitution(frictionCfg.restitution);
    const trackCollider = this.world.createCollider(trimeshCol, trackBody);
    this.colliderMeta.set(trackCollider.handle, { kind: 'track' });

    const shieldRCol = this.world.createCollider(
      RAPIER.ColliderDesc.trimesh(new Float32Array(shieldVertsR), new Uint32Array(shieldIndicesR))
        .setFriction(0.08)
        .setRestitution(0.42),
      trackBody
    );
    this.colliderMeta.set(shieldRCol.handle, { kind: 'wall' });

    const shieldLCol = this.world.createCollider(
      RAPIER.ColliderDesc.trimesh(new Float32Array(shieldVertsL), new Uint32Array(shieldIndicesL))
        .setFriction(0.08)
        .setRestitution(0.42),
      trackBody
    );
    this.colliderMeta.set(shieldLCol.handle, { kind: 'wall' });
  }

  getPlazaPadAnchors() {
    const L = this.config.distanceMeters;
    const halfW = this.config.trackWidth * 0.5;
    const podSt = getStationAtS(this.trackData, L + 13);
    const podPos = podSt.pos
      .clone()
      .addScaledVector(podSt.R, halfW + 5.2)
      .addScaledVector(podSt.U, -0.35);

    const standSt = getStationAtS(this.trackData, L + 9);
    const standPos = standSt.pos
      .clone()
      .addScaledVector(standSt.R, -(halfW + 6.2))
      .addScaledVector(standSt.U, -0.35);

    const hasMidStand = L >= 45;
    const midStandSt = hasMidStand ? getStationAtS(this.trackData, L * 0.52) : null;
    const midStandPos = midStandSt
      ? midStandSt.pos
          .clone()
          .addScaledVector(midStandSt.R, -(halfW + 6.0))
          .addScaledVector(midStandSt.U, -0.35)
      : null;

    return {
      podSt,
      podPos,
      standSt,
      standPos,
      hasMidStand,
      midStandSt,
      midStandPos,
    };
  }

  buildEnvironmentFloorAndSupports(mapCfg) {
    const { stations, bounds } = this.trackData;
    const mapKey = this.config.mapPreset || 'expedition';
    const seed = this.trackSeed + 101;
    const centerX = bounds.centerX;
    const centerZ = bounds.centerZ;
    const baseElevation = bounds.minY - 3.6;
    const waterY = bounds.minY + (mapCfg?.waterLevelOffset ?? -2.6);

    const anchors = this.getPlazaPadAnchors();
    const plazaPads = [
      { x: anchors.podPos.x, y: anchors.podPos.y - 0.14, z: anchors.podPos.z, inner: 10.5, outer: 22.0 },
      { x: anchors.standPos.x, y: anchors.standPos.y - 0.14, z: anchors.standPos.z, inner: 10.2, outer: 21.5 },
    ];
    if (anchors.hasMidStand && anchors.midStandPos) {
      plazaPads.push({
        x: anchors.midStandPos.x,
        y: anchors.midStandPos.y - 0.14,
        z: anchors.midStandPos.z,
        inner: 9.2,
        outer: 19.5,
      });
    }

    const groundSize = Math.max(760, Math.max(bounds.spanX, bounds.spanZ) * 4.4);
    const segs = isSoftwareGl ? 56 : 84;
    const cols = segs + 1;
    const terrainGeo = new THREE.PlaneGeometry(groundSize, groundSize, segs, segs);
    terrainGeo.rotateX(-Math.PI / 2);

    // Coarse track station lookup for corridor carving & multi-territory blending
    const coarse = [];
    for (let i = 0; i < stations.length; i += 3) {
      const st = stations[i];
      coarse.push({
        x: st.pos.x,
        y: st.pos.y,
        z: st.pos.z,
        u: THREE.MathUtils.clamp(st.s / Math.max(1, this.config.distanceMeters), 0, 1),
      });
    }

    const halfW = this.config.trackWidth * 0.5;
    const corridorHalf = halfW + 3.4;
    const shoulderReach = corridorHalf + 15.0;
    const overlapRadius = this.config.trackWidth * 2.2 + 4.0;
    const overlapRadiusSq = overlapRadius * overlapRadius;

    const posAttr = terrainGeo.attributes.position;
    const vertCount = posAttr.count;
    const heightGrid = new Float32Array(vertCount);
    const zoneWeightsCache = new Array(vertCount);

    for (let v = 0; v < vertCount; v++) {
      const wx = posAttr.getX(v) + centerX;
      const wz = posAttr.getZ(v) + centerZ;

      let minDistSq = Infinity;
      let nearestIdx = 0;
      let lowestNearbyY = Infinity;
      for (let k = 0; k < coarse.length; k++) {
        const c = coarse[k];
        const dx = wx - c.x;
        const dz = wz - c.z;
        const dSq = dx * dx + dz * dz;
        if (dSq < minDistSq) {
          minDistSq = dSq;
          nearestIdx = k;
        }
        if (dSq < overlapRadiusSq && c.y < lowestNearbyY) {
          lowestNearbyY = c.y;
        }
      }

      const nearest = coarse[nearestIdx];
      const distToTrack = Math.sqrt(minDistSq);
      const weights = evaluateTerritoryWeights(nearest.u, wx, wz, mapKey, seed);
      zoneWeightsCache[v] = weights;

      // Natural geomorphology blended across active territories
      const nMacro = fbm2D(wx * 0.009, wz * 0.009, seed + 7, 4);
      const nDetail = fbm2D(wx * 0.032, wz * 0.032, seed + 53, 3);
      const ridge = 1.0 - Math.abs(fbm2D(wx * 0.0075, wz * 0.0075, seed + 131, 3) * 2 - 1);

      const hAlpine = (nMacro - 0.38) * 28 + Math.pow(ridge, 1.8) * 32 + (nDetail - 0.5) * 4.5;
      const hArctic = (nMacro - 0.36) * 26 + Math.pow(ridge, 2.2) * 38 + (nDetail - 0.5) * 5.0;
      // Terraced canyon mesas & eroded gorges
      const mesaStep = Math.floor(Math.max(0, nMacro - 0.38) * 6.5) / 6.5;
      const hCanyon = mesaStep * 34 + (nDetail - 0.5) * 3.8 + (ridge > 0.7 ? (ridge - 0.7) * 28 : 0);
      // Savanna rolling plains with occasional rocky kopjes
      const kopje = nMacro > 0.72 ? (nMacro - 0.72) * 34 : 0;
      const hSavanna = (nMacro - 0.45) * 9.5 + kopje + (nDetail - 0.5) * 2.2;
      // Coastal headlands sloping down toward ocean basin on outer side
      const coastSlope = THREE.MathUtils.clamp((wx - centerX) * 0.035, -1, 1);
      const hCoastal = coastSlope * -8.5 + (nMacro - 0.42) * 18 + (nDetail - 0.5) * 3.0;
      // Volcanic jagged basalt calderas & dark obsidian ridges
      const hVolcanic = Math.pow(ridge, 1.45) * 36 + (nMacro - 0.44) * 20 + (nDetail - 0.5) * 6.2;
      // Misty Bamboo Highlands: lush terraced karst hills
      const bambooTerrace = Math.floor(Math.max(0, nMacro - 0.32) * 5.0) / 5.0;
      const hBamboo = bambooTerrace * 24 + Math.pow(ridge, 1.6) * 22 + (nDetail - 0.5) * 3.4;
      // Golden Dunes: wind-sculpted desert sand waves
      const duneWave = Math.sin(wx * 0.035 + wz * 0.02 + nMacro * 5.0) * 5.2;
      const hBadlands = (nMacro - 0.44) * 15 + duneWave + (nDetail - 0.5) * 1.6;
      // Autumn Timberland: rolling forested mountain valleys
      const hAutumn = (nMacro - 0.4) * 24 + Math.pow(ridge, 1.5) * 22 + (nDetail - 0.5) * 4.0;

      let rawOffset =
        weights.alpine * hAlpine +
        weights.arctic * hArctic +
        weights.canyon * hCanyon +
        weights.savanna * hSavanna +
        weights.coastal * hCoastal +
        weights.volcanic * hVolcanic +
        weights.bamboo * hBamboo +
        weights.badlands * hBadlands +
        weights.autumn * hAutumn;

      // Frame the racing valley cleanly with distant mountain ridges outside track corridor
      const rimLift = THREE.MathUtils.smoothstep(distToTrack, 24, 105) * (6.0 + ridge * 16.0);
      let wy = Math.min(nearest.y, baseElevation + 2.5) + rawOffset + rimLift;

      // Carve track roadbed & soft earthen shoulder embankments cleanly beneath lowest deck
      const roadbedY = (Number.isFinite(lowestNearbyY) ? lowestNearbyY : nearest.y) - 0.76;
      if (distToTrack < shoulderReach) {
        const tCarve = THREE.MathUtils.smoothstep(distToTrack, corridorHalf, shoulderReach);
        wy = THREE.MathUtils.lerp(roadbedY, wy, tCarve);
      }

      // Grade flat level plazas beneath Victory Pavilion podium & spectator grandstands so terrain never clips/merges
      for (let pIdx = 0; pIdx < plazaPads.length; pIdx++) {
        const pad = plazaPads[pIdx];
        const dPad = Math.hypot(wx - pad.x, wz - pad.z);
        if (dPad < pad.outer) {
          const tPad = THREE.MathUtils.smoothstep(dPad, pad.inner, pad.outer);
          wy = THREE.MathUtils.lerp(pad.y, wy, tPad);
        }
      }

      posAttr.setY(v, wy);
      heightGrid[v] = wy;
    }

    terrainGeo.computeVertexNormals();
    const normAttr = terrainGeo.attributes.normal;
    const colArr = new Float32Array(vertCount * 3);

    const terrainMul = mapCfg?._darkCfg?.terrainMul ?? 1.0;
    const satBoost = mapCfg?._darkCfg?.satBoost ?? 1.0;
    const cFlat = new THREE.Color();
    const cRock = new THREE.Color();
    const cHigh = new THREE.Color();
    const cGravel = new THREE.Color(scaleHexColorInt(0x6b655a, terrainMul, satBoost));
    const cShore = new THREE.Color(scaleHexColorInt(0xcab58a, terrainMul, satBoost));

    const tmpA = new THREE.Color();
    const tmpC = new THREE.Color();
    const paletteFlat = {
      alpine: 0x456336,
      arctic: 0xd9e2ea,
      canyon: 0xb05d3a,
      savanna: 0x9b8244,
      coastal: 0x526b42,
      volcanic: 0x2c2928,
      bamboo: 0x355c3c,
      badlands: 0xc29a58,
      autumn: 0x7a5732,
    };
    const paletteRock = {
      alpine: 0x5d646b,
      arctic: 0x414a55,
      canyon: 0x7e3923,
      savanna: 0x6f5743,
      coastal: 0x827d73,
      volcanic: 0x1a1b1f,
      bamboo: 0x4e5955,
      badlands: 0x8f693e,
      autumn: 0x57544e,
    };

    for (let v = 0; v < vertCount; v++) {
      const wx = posAttr.getX(v) + centerX;
      const wy = heightGrid[v];
      const wz = posAttr.getZ(v) + centerZ;
      const ny = normAttr.getY(v);
      const w = zoneWeightsCache[v];

      cFlat.setRGB(0, 0, 0);
      cRock.setRGB(0, 0, 0);
      for (const k of Object.keys(w)) {
        if (w[k] <= 0.001) continue;
        tmpA.setHex(paletteFlat[k]);
        cFlat.r += tmpA.r * w[k];
        cFlat.g += tmpA.g * w[k];
        cFlat.b += tmpA.b * w[k];
        tmpC.setHex(paletteRock[k]);
        cRock.r += tmpC.r * w[k];
        cRock.g += tmpC.g * w[k];
        cRock.b += tmpC.b * w[k];
      }

      // Slope-based cliff rock exposure
      const slopeMix = THREE.MathUtils.smoothstep(1 - ny, 0.08, 0.34);
      tmpA.copy(cFlat).lerp(cRock, slopeMix);

      // High-altitude snow line on alpine/arctic peaks
      const snowBias = w.arctic * 0.9 + w.alpine * 0.55;
      if (snowBias > 0.1 && wy > bounds.maxY + 4.5) {
        const snowAmt = THREE.MathUtils.smoothstep(wy, bounds.maxY + 4.5, bounds.maxY + 18) * snowBias;
        cHigh.setHex(0xeaf0f5);
        tmpA.lerp(cHigh, snowAmt * 0.85);
      }

      if (terrainMul < 0.999 || satBoost > 1.001) {
        tmpA.getHSL(_depthHsl);
        tmpA.setHSL(
          _depthHsl.h,
          Math.min(1, _depthHsl.s * satBoost),
          Math.max(0.03, Math.min(0.95, _depthHsl.l * terrainMul))
        );
      }

      // Sandy shoreline near water level
      if (mapCfg?.hasWater && wy < waterY + 1.3) {
        const shoreAmt = THREE.MathUtils.smoothstep(waterY + 1.3, waterY - 0.6, wy);
        tmpA.lerp(cShore, shoreAmt * 0.72);
      }

      // Natural gravel shoulder tinting close to track
      const nTone = (fbm2D(wx * 0.06, wz * 0.06, seed + 211, 2) - 0.5) * 0.08 * terrainMul;
      tmpA.offsetHSL(0, 0, nTone);

      // Blend subtly toward compacted gravel near track height where steep slopes carve walls
      if (slopeMix < 0.25 && ny > 0.95 && Math.abs(wy - (bounds.minY - 0.76)) < 0.9) {
        tmpA.lerp(cGravel, 0.18);
      }

      colArr[v * 3] = tmpA.r;
      colArr[v * 3 + 1] = tmpA.g;
      colArr[v * 3 + 2] = tmpA.b;
    }

    terrainGeo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));

    const terrainMat = new THREE.MeshStandardMaterial({
      map: this.shared.floorTex,
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.03,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.position.set(centerX, 0, centerZ);
    terrainMesh.receiveShadow = true;
    this.trackGroup.add(terrainMesh);

    const sampleHeight = (wx, wz) => {
      const lx = wx - centerX + groundSize * 0.5;
      const lz = wz - centerZ + groundSize * 0.5;
      const gx = THREE.MathUtils.clamp((lx / groundSize) * segs, 0, segs - 0.001);
      const gz = THREE.MathUtils.clamp((lz / groundSize) * segs, 0, segs - 0.001);
      const ix = Math.floor(gx);
      const iz = Math.floor(gz);
      const fx = gx - ix;
      const fz = gz - iz;
      const h00 = heightGrid[iz * cols + ix];
      const h10 = heightGrid[iz * cols + (ix + 1)];
      const h01 = heightGrid[(iz + 1) * cols + ix];
      const h11 = heightGrid[(iz + 1) * cols + (ix + 1)];
      return (h00 * (1 - fx) + h10 * fx) * (1 - fz) + (h01 * (1 - fx) + h11 * fx) * fz;
    };

    // Animated Reflective Valley Lakes / Fjord / Coastal Ocean Water Plane
    if (mapCfg?.hasWater) {
      const waterGeo = new THREE.PlaneGeometry(groundSize * 0.98, groundSize * 0.98, 24, 24);
      waterGeo.rotateX(-Math.PI / 2);
      const waterUniforms = { uTime: { value: 0 } };
      this.waterUniforms = waterUniforms;
      const waterMat = new THREE.MeshStandardMaterial({
        color: scaleHexColorInt(mapCfg.waterColor ?? 0x205d79, terrainMul),
        normalMap: this.shared.trackNormalTex,
        normalScale: new THREE.Vector2(0.24, 0.24),
        roughness: 0.12,
        metalness: 0.38,
        envMapIntensity: 1.25,
      });
      waterMat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = waterUniforms.uTime;
        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            `#include <common>
            uniform float uTime;
            varying vec3 vWaterWorldPos;`
          )
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            transformed.y += sin(position.x * 0.12 + uTime * 1.4) * 0.045 + cos(position.z * 0.14 - uTime * 1.1) * 0.045;
            vWaterWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            `#include <common>
            uniform float uTime;
            varying vec3 vWaterWorldPos;`
          )
          .replace(
            '#include <normal_fragment_maps>',
            `#include <normal_fragment_maps>
            float w1 = sin(vWaterWorldPos.x * 0.36 + uTime * 1.65) * 0.025;
            float w2 = cos(vWaterWorldPos.z * 0.42 - uTime * 1.35) * 0.025;
            normal = normalize(normal + vec3(w1, 0.0, w2));`
          );
      };
      this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
      this.waterMesh.position.set(centerX, waterY, centerZ);
      this.waterMesh.userData.baseY = waterY;
      this.waterMesh.receiveShadow = false;
      this.trackGroup.add(this.waterMesh);
    }

    // Grounded Concrete/Steel Viaduct Piers with Crossheads anchored to exact terrain elevation
    const darkTrackMul = mapCfg?._darkCfg?.trackMul ?? 1.0;
    const pillarMat = new THREE.MeshStandardMaterial({
      color: scaleHexColorInt(mapCfg?.pylonColor ?? 0x4c5258, darkTrackMul),
      roughness: 0.68,
      metalness: 0.25,
    });
    const footMat = new THREE.MeshStandardMaterial({
      color: scaleHexColorInt(mapCfg?.railColor ?? 0x6f767e, darkTrackMul),
      roughness: 0.72,
      metalness: 0.22,
    });

    for (let i = 4; i < stations.length - 4; i += 34) {
      const st = stations[i];
      const pylonGroup = new THREE.Group();
      const offsetX = this.config.trackWidth * 0.42;
      let builtLegs = 0;

      for (const side of [-1, 1]) {
        const legPos = st.pos.clone().addScaledVector(st.R, side * offsetX);
        const legGroundY = Math.min(sampleHeight(legPos.x, legPos.z), mapCfg?.hasWater ? waterY - 1.2 : Infinity);
        const legH = legPos.y - 0.55 - legGroundY;
        if (legH <= 0.75) continue;

        let blockedBelow = false;
        if (this.config.trackType === 'spiral') {
          const clearanceR = this.config.trackWidth * 0.5 + 1.1;
          for (let j = i + 20; j < stations.length; j += 2) {
            const lower = stations[j];
            if (lower.pos.y < legPos.y - 1.0) {
              const dx = lower.pos.x - legPos.x;
              const dz = lower.pos.z - legPos.z;
              if (dx * dx + dz * dz < clearanceR * clearanceR) {
                blockedBelow = true;
                break;
              }
            }
          }
        }
        if (blockedBelow) continue;

        const legGeo = new THREE.CylinderGeometry(0.3, 0.42, legH + 0.5, 10);
        const leg = new THREE.Mesh(legGeo, pillarMat);
        leg.position.set(legPos.x, legGroundY + legH * 0.5 - 0.15, legPos.z);
        leg.castShadow = true;
        leg.receiveShadow = true;
        pylonGroup.add(leg);

        const footGeo = new THREE.CylinderGeometry(0.68, 0.82, 0.45, 10);
        const foot = new THREE.Mesh(footGeo, footMat);
        foot.position.set(legPos.x, legGroundY + 0.15, legPos.z);
        foot.receiveShadow = true;
        pylonGroup.add(foot);
        builtLegs++;
      }

      if (builtLegs === 2) {
        const capBeam = new THREE.Mesh(
          new THREE.BoxGeometry(offsetX * 2 + 0.8, 0.42, 0.75),
          pillarMat
        );
        capBeam.position.copy(st.pos).addScaledVector(st.U, -0.78);
        capBeam.quaternion.copy(st.quat);
        capBeam.castShadow = true;
        capBeam.receiveShadow = true;
        pylonGroup.add(capBeam);
      }

      if (pylonGroup.children.length > 0) {
        this.trackGroup.add(pylonGroup);
      }
    }

    this.buildOpenWorldProps(mapKey, mapCfg, bounds, coarse, sampleHeight, waterY, seed, plazaPads);
  }

  buildOpenWorldProps(mapKey, mapCfg, bounds, coarse, sampleHeight, waterY, seed, plazaPads = []) {
    const rng = mulberry32(seed * 7919 + 31);
    const halfW = this.config.trackWidth * 0.5;
    const safeClearance = halfW + 6.8;
    const safeClearanceSq = safeClearance * safeClearance;
    const hasWater = Boolean(mapCfg?.hasWater);
    const terrainMul = mapCfg?._darkCfg?.terrainMul ?? 1.0;

    const scatterR = Math.min(265, Math.max(bounds.spanX, bounds.spanZ) * 0.88 + 75);
    const trunkMats = new THREE.MeshStandardMaterial({
      color: scaleHexColorInt(0x4f3b2b, terrainMul),
      roughness: 0.92,
      metalness: 0.02,
    });
    const pineFoliageMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, metalness: 0.02, flatShading: true });
    const acaciaCanopyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0.02, flatShading: true });
    const rockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0.04, flatShading: true });

    const pineTransforms = [];
    const pineColors = [];
    const acaciaTransforms = [];
    const acaciaColors = [];
    const rockTransforms = [];
    const rockColors = [];
    const basaltTransforms = [];
    const basaltColors = [];
    const mesaTransforms = [];
    const mesaColors = [];

    const tmpCol = new THREE.Color();
    const candidates = isSoftwareGl ? 200 : 410;

    for (let i = 0; i < candidates; i++) {
      const wx = bounds.centerX + (rng() - 0.5) * scatterR * 2;
      const wz = bounds.centerZ + (rng() - 0.5) * scatterR * 2;

      let minDistSq = Infinity;
      let nearest = coarse[0];
      for (let k = 0; k < coarse.length; k++) {
        const c = coarse[k];
        const dx = wx - c.x;
        const dz = wz - c.z;
        const dSq = dx * dx + dz * dz;
        if (dSq < minDistSq) {
          minDistSq = dSq;
          nearest = c;
        }
      }
      if (minDistSq < safeClearanceSq) continue;

      let nearPlaza = false;
      for (let p = 0; p < plazaPads.length; p++) {
        const pad = plazaPads[p];
        const dx = wx - pad.x;
        const dz = wz - pad.z;
        if (dx * dx + dz * dz < pad.inner * pad.inner) {
          nearPlaza = true;
          break;
        }
      }
      if (nearPlaza) continue;

      const wy = sampleHeight(wx, wz);
      if (hasWater && wy < waterY + 0.65) continue;

      const weights = evaluateTerritoryWeights(nearest.u, wx, wz, mapKey, seed);
      const slopeCheck = Math.abs(sampleHeight(wx + 1.5, wz) - wy) + Math.abs(sampleHeight(wx, wz + 1.5) - wy);
      const scale = 0.78 + rng() * 0.66;
      const rotY = rng() * Math.PI * 2;

      const zonePick = weights.alpine + weights.arctic * 0.85 + weights.coastal * 0.7 + weights.bamboo * 0.9 + weights.autumn * 0.95;
      const rockTrigger =
        slopeCheck > 1.35 ||
        weights.canyon > 0.45 ||
        weights.volcanic > 0.45 ||
        weights.badlands > 0.5 ||
        rng() < 0.28;

      if (rockTrigger) {
        if ((weights.volcanic > 0.42 || weights.arctic > 0.48) && rng() < 0.62) {
          const h = (2.4 + rng() * 4.2) * scale;
          const r = (0.75 + rng() * 0.65) * scale;
          basaltTransforms.push({ x: wx, y: wy + h * 0.45, z: wz, r, h, rotY });
          tmpCol.setHex(weights.volcanic > 0.42 ? 0x26282e : 0x738494);
          tmpCol.offsetHSL(0, 0, (rng() - 0.5) * 0.08);
          tmpCol.multiplyScalar(terrainMul);
          basaltColors.push(tmpCol.clone());
        } else if ((weights.canyon > 0.42 || weights.badlands > 0.48) && rng() < 0.45) {
          const sx = (2.4 + rng() * 2.8) * scale;
          const sy = (1.6 + rng() * 3.0) * scale;
          const sz = (2.2 + rng() * 2.6) * scale;
          mesaTransforms.push({ x: wx, y: wy + sy * 0.42, z: wz, sx, sy, sz, rotY });
          tmpCol.setHex(weights.canyon > 0.42 ? 0x99482e : 0xb3834a);
          tmpCol.offsetHSL(0, 0, (rng() - 0.5) * 0.07);
          tmpCol.multiplyScalar(terrainMul);
          mesaColors.push(tmpCol.clone());
        } else {
          const sx = (1.1 + rng() * 2.2) * scale;
          const sy = (0.7 + rng() * (weights.canyon > 0.4 || weights.volcanic > 0.4 ? 2.4 : 1.1)) * scale;
          const sz = (1.1 + rng() * 2.1) * scale;
          rockTransforms.push({ x: wx, y: wy + sy * 0.3, z: wz, sx, sy, sz, rotY });
          if (weights.canyon > 0.4) tmpCol.setHex(0x8d442b);
          else if (weights.volcanic > 0.4) tmpCol.setHex(0x232429);
          else if (weights.badlands > 0.45) tmpCol.setHex(0xa87d48);
          else if (weights.arctic > 0.45) tmpCol.setHex(0x555f6b);
          else tmpCol.setHex(0x6e716d);
          tmpCol.offsetHSL(0, 0, (rng() - 0.5) * 0.08);
          tmpCol.multiplyScalar(terrainMul);
          rockColors.push(tmpCol.clone());
        }
      } else if (weights.savanna > 0.4) {
        acaciaTransforms.push({ x: wx, y: wy, z: wz, scale, rotY });
        tmpCol.setHex(0x5d7236).offsetHSL(0, (rng() - 0.5) * 0.08, (rng() - 0.5) * 0.08);
        tmpCol.multiplyScalar(terrainMul);
        acaciaColors.push(tmpCol.clone());
      } else if (zonePick > 0.25) {
        pineTransforms.push({ x: wx, y: wy, z: wz, scale, rotY });
        if (weights.arctic > 0.45) {
          tmpCol.setHex(rng() > 0.45 ? 0xcad6df : 0x3b594b);
        } else if (weights.autumn > 0.42) {
          const autumnTones = [0xb34722, 0xc97322, 0x8f291c, 0x3a542f];
          tmpCol.setHex(autumnTones[Math.floor(rng() * autumnTones.length)]);
        } else if (weights.bamboo > 0.42) {
          tmpCol.setHex(rng() > 0.4 ? 0x2c6642 : 0x427549);
        } else if (weights.coastal > 0.45) {
          tmpCol.setHex(0x3a5d34);
        } else {
          tmpCol.setHex(0x2f5432);
        }
        tmpCol.offsetHSL(0, (rng() - 0.5) * 0.06, (rng() - 0.5) * 0.07);
        tmpCol.multiplyScalar(terrainMul);
        pineColors.push(tmpCol.clone());
      }
    }

    if (pineTransforms.length > 0) {
      const n = pineTransforms.length;
      const trunkGeo = new THREE.CylinderGeometry(0.18, 0.32, 2.4, 6);
      trunkGeo.translate(0, 1.2, 0);
      const coneLoGeo = new THREE.ConeGeometry(1.9, 3.2, 7);
      coneLoGeo.translate(0, 2.9, 0);
      const coneMidGeo = new THREE.ConeGeometry(1.45, 2.7, 7);
      coneMidGeo.translate(0, 4.5, 0);
      const coneHiGeo = new THREE.ConeGeometry(0.95, 2.3, 7);
      coneHiGeo.translate(0, 5.9, 0);

      const trunkIM = new THREE.InstancedMesh(trunkGeo, trunkMats, n);
      const coneLoIM = new THREE.InstancedMesh(coneLoGeo, pineFoliageMat, n);
      const coneMidIM = new THREE.InstancedMesh(coneMidGeo, pineFoliageMat, n);
      const coneHiIM = new THREE.InstancedMesh(coneHiGeo, pineFoliageMat, n);

      for (let i = 0; i < n; i++) {
        const t = pineTransforms[i];
        this._dummy.position.set(t.x, t.y - 0.15, t.z);
        this._dummy.rotation.set(0, t.rotY, 0);
        this._dummy.scale.setScalar(t.scale);
        this._dummy.updateMatrix();
        trunkIM.setMatrixAt(i, this._dummy.matrix);
        coneLoIM.setMatrixAt(i, this._dummy.matrix);
        coneMidIM.setMatrixAt(i, this._dummy.matrix);
        coneHiIM.setMatrixAt(i, this._dummy.matrix);
        coneLoIM.setColorAt(i, pineColors[i]);
        coneMidIM.setColorAt(i, pineColors[i]);
        coneHiIM.setColorAt(i, pineColors[i]);
      }
      this.trackGroup.add(trunkIM, coneLoIM, coneMidIM, coneHiIM);
    }

    if (acaciaTransforms.length > 0) {
      const n = acaciaTransforms.length;
      const trunkGeo = new THREE.CylinderGeometry(0.16, 0.28, 3.4, 6);
      trunkGeo.translate(0, 1.7, 0);
      const canopyGeo = new THREE.CylinderGeometry(2.6, 1.4, 0.85, 8);
      canopyGeo.translate(0, 3.6, 0);

      const trunkIM = new THREE.InstancedMesh(trunkGeo, trunkMats, n);
      const canopyIM = new THREE.InstancedMesh(canopyGeo, acaciaCanopyMat, n);

      for (let i = 0; i < n; i++) {
        const t = acaciaTransforms[i];
        this._dummy.position.set(t.x, t.y - 0.15, t.z);
        this._dummy.rotation.set(0, t.rotY, 0);
        this._dummy.scale.setScalar(t.scale);
        this._dummy.updateMatrix();
        trunkIM.setMatrixAt(i, this._dummy.matrix);
        canopyIM.setMatrixAt(i, this._dummy.matrix);
        canopyIM.setColorAt(i, acaciaColors[i]);
      }
      this.trackGroup.add(trunkIM, canopyIM);
    }

    if (basaltTransforms.length > 0) {
      const n = basaltTransforms.length;
      const hexGeo = new THREE.CylinderGeometry(0.95, 1.12, 1.0, 6);
      const basaltIM = new THREE.InstancedMesh(hexGeo, rockMat, n);
      basaltIM.receiveShadow = true;
      for (let i = 0; i < n; i++) {
        const t = basaltTransforms[i];
        this._dummy.position.set(t.x, t.y, t.z);
        this._dummy.rotation.set(0, t.rotY, 0);
        this._dummy.scale.set(t.r, t.h, t.r);
        this._dummy.updateMatrix();
        basaltIM.setMatrixAt(i, this._dummy.matrix);
        basaltIM.setColorAt(i, basaltColors[i]);
      }
      this.trackGroup.add(basaltIM);
    }

    if (mesaTransforms.length > 0) {
      const n = mesaTransforms.length;
      const mesaGeo = new THREE.CylinderGeometry(0.72, 1.15, 1.0, 7);
      const mesaIM = new THREE.InstancedMesh(mesaGeo, rockMat, n);
      mesaIM.receiveShadow = true;
      for (let i = 0; i < n; i++) {
        const t = mesaTransforms[i];
        this._dummy.position.set(t.x, t.y, t.z);
        this._dummy.rotation.set(0, t.rotY, 0);
        this._dummy.scale.set(t.sx, t.sy, t.sz);
        this._dummy.updateMatrix();
        mesaIM.setMatrixAt(i, this._dummy.matrix);
        mesaIM.setColorAt(i, mesaColors[i]);
      }
      this.trackGroup.add(mesaIM);
    }

    if (rockTransforms.length > 0) {
      const n = rockTransforms.length;
      const rockGeo = new THREE.DodecahedronGeometry(1.0, 0);
      const rockIM = new THREE.InstancedMesh(rockGeo, rockMat, n);
      rockIM.receiveShadow = true;

      for (let i = 0; i < n; i++) {
        const t = rockTransforms[i];
        this._dummy.position.set(t.x, t.y, t.z);
        this._dummy.rotation.set(0, t.rotY, 0);
        this._dummy.scale.set(t.sx, t.sy, t.sz);
        this._dummy.updateMatrix();
        rockIM.setMatrixAt(i, this._dummy.matrix);
        rockIM.setColorAt(i, rockColors[i]);
      }
      this.trackGroup.add(rockIM);
    }
  }

  buildDistanceMarkers() {
    // Clean, unobtrusive matte distance strips painted flush onto deck (zero posts or signs blocking sightlines)
    const L = this.config.distanceMeters;
    const stripW = Math.max(1.2, this.config.trackWidth - 1.4);
    const stripGeo = new THREE.PlaneGeometry(stripW, 0.24);
    stripGeo.rotateX(-Math.PI / 2);
    const stripMat = new THREE.MeshStandardMaterial({
      color: 0xd8d3c8,
      roughness: 0.85,
      metalness: 0.02,
      transparent: true,
      opacity: 0.45,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    for (let s = 25; s <= L - 15; s += 25) {
      const st = getStationAtS(this.trackData, s);
      const strip = new THREE.Mesh(stripGeo, stripMat);
      strip.position.copy(st.pos).addScaledVector(st.U, 0.018);
      strip.quaternion.copy(st.quat);
      strip.receiveShadow = true;
      this.trackGroup.add(strip);
    }
  }

  buildBoosterPads() {
    const L = this.config.distanceMeters;
    if (L < 45) return;

    const padCount = L >= 160 ? 3 : 2;
    const W = this.config.trackWidth;
    const padW = Math.min(3.4, W * 0.38);
    const padL = 3.4;

    const padMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.shared.boosterTex,
      roughness: 0.42,
      metalness: 0.42,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });

    for (let i = 0; i < padCount; i++) {
      const targetS = THREE.MathUtils.lerp(16, L - 14, (i + 0.5) / padCount);
      // Skip if too close to a hurdle
      const nearHurdle = this.hurdleStationsS.some((hs) => Math.abs(hs - targetS) < 3.5);
      const s = nearHurdle ? targetS + 3.2 : targetS;
      if (s > L - 10) continue;

      const st = getStationAtS(this.trackData, s);
      const latOffset = (i % 2 === 0 ? 1 : -1) * Math.min(1.6, (W - padW) * 0.22);
      const padPos = st.pos.clone().addScaledVector(st.R, latOffset);

      const padGeo = new THREE.PlaneGeometry(padW, padL);
      padGeo.rotateX(-Math.PI / 2);
      const padMesh = new THREE.Mesh(padGeo, padMat);
      padMesh.position.copy(padPos).addScaledVector(st.U, 0.032);
      padMesh.quaternion.copy(st.quat);
      this.trackGroup.add(padMesh);

      const rb = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed()
          .setTranslation(padPos.x, padPos.y + 0.3, padPos.z)
          .setRotation(st.quat)
      );
      const col = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(padW * 0.5, 0.45, padL * 0.5)
          .setSensor(true)
          .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
        rb
      );
      this.colliderMeta.set(col.handle, {
        kind: 'booster',
        dir: st.T.clone(),
      });
    }
  }

  buildStartGate() {
    const st = getStationAtS(this.trackData, 0.25);
    const gateW = this.config.trackWidth - 0.2;
    const gateH = 1.3;
    const gateD = 0.28;

    const gateGroup = new THREE.Group();
    const beamGeo = new THREE.BoxGeometry(gateW, gateH, gateD);
    const beamMat = new THREE.MeshStandardMaterial({
      map: this.shared.hazardTex,
      roughness: 0.35,
      metalness: 0.4,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.castShadow = true;
    gateGroup.add(beam);

    // Top gantry frame (stays fixed visually)
    const archGroup = new THREE.Group();
    const postMat = new THREE.MeshStandardMaterial({
      color: 0x454b52,
      roughness: 0.42,
      metalness: 0.72,
    });
    const postGeo = new THREE.BoxGeometry(0.4, 3.6, 0.4);
    const halfW = this.config.trackWidth * 0.5 + 0.22;
    const leftPost = new THREE.Mesh(postGeo, postMat);
    leftPost.position.set(-halfW, 1.8, 0);
    const rightPost = new THREE.Mesh(postGeo, postMat);
    rightPost.position.set(halfW, 1.8, 0);
    const topBar = new THREE.Mesh(
      new THREE.BoxGeometry(this.config.trackWidth + 0.9, 0.45, 0.45),
      postMat
    );
    topBar.position.set(0, 3.6, 0);

    const startSign = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.9, 0.2),
      new THREE.MeshStandardMaterial({
        map: createSignCanvasTexture('START', '#20221e', '#2e9e66'),
        roughness: 0.42,
      })
    );
    startSign.position.set(0, 3.6, 0.22);

    // 3-Pod Starting Light Tree (Red -> Amber -> Green)
    this.startLightPods = [];
    const podOffsets = [-1.05, 0, 1.05];
    const podColors = [0xdc4a3a, 0xd97724, 0x2e9e66];
    for (let k = 0; k < 3; k++) {
      const podMat = new THREE.MeshStandardMaterial({
        color: 0x24282c,
        emissive: podColors[k],
        emissiveIntensity: 0.06,
        roughness: 0.3,
        metalness: 0.35,
      });
      const pod = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), podMat);
      pod.position.set(podOffsets[k], 2.95, 0.22);
      archGroup.add(pod);
      this.startLightPods.push({ mesh: pod, baseEmissive: podColors[k] });
    }

    archGroup.add(leftPost, rightPost, topBar, startSign);
    archGroup.position.copy(st.pos);
    archGroup.quaternion.copy(st.quat);
    this.trackGroup.add(archGroup);

    // Physical kinematic gate beam
    const closedPos = st.pos.clone().addScaledVector(st.U, gateH * 0.5);
    const openPos = st.pos.clone().addScaledVector(st.U, gateH * 0.5 + 2.4);

    gateGroup.position.copy(closedPos);
    gateGroup.quaternion.copy(st.quat);
    this.trackGroup.add(gateGroup);

    const rb = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(closedPos.x, closedPos.y, closedPos.z)
        .setRotation(st.quat)
    );
    const gateCol = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(gateW * 0.5, gateH * 0.5, gateD * 0.5)
        .setFriction(0.1)
        .setRestitution(0.2),
      rb
    );
    this.colliderMeta.set(gateCol.handle, { kind: 'wall' });

    this.startGate = {
      mesh: gateGroup,
      body: rb,
      closedPos,
      openPos,
      quat: st.quat.clone(),
      openProgress: 0,
    };
  }

  buildFinishArchAndPodium() {
    const L = this.config.distanceMeters;
    const st = getStationAtS(this.trackData, L);
    const halfW = this.config.trackWidth * 0.5;

    // Checkered Finish Line Strip on Track Surface
    const stripGeo = new THREE.PlaneGeometry(this.config.trackWidth - 0.5, 2.0);
    stripGeo.rotateX(-Math.PI / 2);
    const stripMat = new THREE.MeshStandardMaterial({
      map: this.shared.checkerTex,
      roughness: 0.6,
      metalness: 0.06,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.copy(st.pos).addScaledVector(st.U, 0.02);
    strip.quaternion.copy(st.quat);
    strip.receiveShadow = true;
    this.trackGroup.add(strip);

    // Finish-Line Architectural Truss Arch
    const archGroup = new THREE.Group();
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x4c5259,
      roughness: 0.42,
      metalness: 0.72,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0xb08642,
      roughness: 0.34,
      metalness: 0.65,
    });

    const pillarH = 4.6;
    const pillarGeo = new THREE.BoxGeometry(0.55, pillarH, 0.55);
    const pL = new THREE.Mesh(pillarGeo, metalMat);
    pL.position.set(-halfW - 0.3, pillarH * 0.5, 0);
    pL.castShadow = true;
    const pR = new THREE.Mesh(pillarGeo, metalMat);
    pR.position.set(halfW + 0.3, pillarH * 0.5, 0);
    pR.castShadow = true;

    const beamGeo = new THREE.BoxGeometry(this.config.trackWidth + 1.4, 0.55, 0.65);
    const beam = new THREE.Mesh(beamGeo, metalMat);
    beam.position.set(0, pillarH, 0);
    beam.castShadow = true;

    const bannerGeo = new THREE.BoxGeometry(this.config.trackWidth + 0.4, 1.05, 0.16);
    const bannerMat = new THREE.MeshStandardMaterial({
      map: this.shared.checkerTex,
      roughness: 0.52,
    });
    const banner = new THREE.Mesh(bannerGeo, bannerMat);
    banner.position.set(0, pillarH - 0.72, 0);

    const signMesh = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.95, 0.22),
      new THREE.MeshStandardMaterial({
        map: createSignCanvasTexture('FINISH', '#1c1f24', '#d8b26e'),
        roughness: 0.42,
      })
    );
    signMesh.position.set(0, pillarH + 0.72, 0);

    const trimL = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.2, 0.62), accentMat);
    trimL.position.set(-halfW - 0.3, 2.2, 0);
    const trimR = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.2, 0.62), accentMat);
    trimR.position.set(halfW + 0.3, 2.2, 0);

    archGroup.add(pL, pR, beam, banner, signMesh, trimL, trimR);
    archGroup.position.copy(st.pos);
    archGroup.quaternion.copy(st.quat);
    this.trackGroup.add(archGroup);

    // Championship Victory Pavilion beside Finish Plaza (Travertine steps, canopy arch, faceted pedestals, laurel halos & flags)
    const podiumGroup = new THREE.Group();

    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xc2b9a7, roughness: 0.78, metalness: 0.06 });
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x5c4b3b, roughness: 0.68, metalness: 0.08 });
    const graniteMat = new THREE.MeshStandardMaterial({ color: 0x3a3e44, roughness: 0.54, metalness: 0.24 });
    const steelArchMat = new THREE.MeshStandardMaterial({ color: 0x4b5159, roughness: 0.36, metalness: 0.72 });
    const brassTrimMat = new THREE.MeshStandardMaterial({ color: 0xc59b49, roughness: 0.28, metalness: 0.78 });

    // Stepped Two-Tier Terrace
    const lowerTerrace = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.48, 4.8), stoneMat);
    lowerTerrace.position.set(0, 0.24, 0);
    lowerTerrace.receiveShadow = true;
    lowerTerrace.castShadow = true;
    podiumGroup.add(lowerTerrace);

    const upperTerrace = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.36, 3.6), deckMat);
    upperTerrace.position.set(0, 0.66, 0);
    upperTerrace.receiveShadow = true;
    upperTerrace.castShadow = true;
    podiumGroup.add(upperTerrace);

    // Front approach stairs
    for (let sIdx = 0; sIdx < 2; sIdx++) {
      const stair = new THREE.Mesh(
        new THREE.BoxGeometry(4.2 - sIdx * 0.4, 0.22, 0.55),
        stoneMat
      );
      stair.position.set(0, 0.11 + sIdx * 0.22, 2.55 - sIdx * 0.45);
      stair.receiveShadow = true;
      podiumGroup.add(stair);
    }

    // Sculptural Pavilion Roof Arch Columns & Canopy
    for (const sideX of [-3.5, 3.5]) {
      for (const sideZ of [-1.45, 1.45]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 4.3, 10), steelArchMat);
        col.position.set(sideX, 0.84 + 2.15, sideZ);
        col.castShadow = true;
        podiumGroup.add(col);
      }
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 3.4), steelArchMat);
      rib.position.set(sideX, 5.2, 0);
      podiumGroup.add(rib);
    }

    const roofFrame = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.24, 3.4), steelArchMat);
    roofFrame.position.set(0, 5.28, 0);
    roofFrame.castShadow = true;
    podiumGroup.add(roofFrame);

    const skylightMat = new THREE.MeshPhysicalMaterial({
      color: 0xe6eff5,
      transparent: true,
      opacity: 0.42,
      roughness: 0.12,
      metalness: 0.08,
    });
    const roofGlass = new THREE.Mesh(new THREE.BoxGeometry(6.9, 0.08, 2.7), skylightMat);
    roofGlass.position.set(0, 5.4, 0);
    podiumGroup.add(roofGlass);

    const friezeSign = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 0.62, 0.16),
      new THREE.MeshStandardMaterial({
        map: createSignCanvasTexture('CHAMPIONS', '#1e2126', '#d8b26e'),
        roughness: 0.38,
      })
    );
    friezeSign.position.set(0, 5.45, 1.72);
    podiumGroup.add(friezeSign);

    const friezeTrim = new THREE.Mesh(new THREE.BoxGeometry(7.9, 0.09, 3.48), brassTrimMat);
    friezeTrim.position.set(0, 5.14, 0);
    podiumGroup.add(friezeTrim);

    // Three Sculpted Octagonal Marble-Granite Pedestals + Trophy Marbles + Rotating Metallic Laurel Halos
    const steps = [
      { rank: 2, x: -2.15, h: 1.25, color: 0xd0d6de },
      { rank: 1, x: 0.0, h: 1.95, color: 0xe5b84b },
      { rank: 3, x: 2.15, h: 0.85, color: 0xc47a42 },
    ];

    for (const step of steps) {
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(0.76, 0.92, step.h, 8),
        graniteMat
      );
      col.position.set(step.x, 0.84 + step.h * 0.5, 0);
      col.castShadow = true;
      col.receiveShadow = true;
      podiumGroup.add(col);

      const collarMat = new THREE.MeshStandardMaterial({
        color: step.color,
        roughness: 0.24,
        metalness: 0.82,
      });
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(0.82, 0.82, 0.14, 8),
        collarMat
      );
      ring.position.set(step.x, 0.84 + step.h + 0.07, 0);
      podiumGroup.add(ring);

      const plaque = new THREE.Mesh(
        new THREE.BoxGeometry(0.88, 0.44, 0.08),
        new THREE.MeshStandardMaterial({
          map: createSignCanvasTexture(`${step.rank}`, '#1d2024', `#${step.color.toString(16).padStart(6, '0')}`),
          roughness: 0.4,
        })
      );
      plaque.position.set(step.x, 0.84 + step.h * 0.55, 0.88);
      podiumGroup.add(plaque);

      const trophy = new THREE.Mesh(
        this.shared.ballGeo,
        new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          map: this.shared.marbleTex,
          roughness: 0.22,
          metalness: 0.02,
          clearcoat: 0.28,
          clearcoatRoughness: 0.08,
          ior: 1.48,
          reflectivity: 0.48,
          envMapIntensity: 0.28,
        })
      );
      trophy.scale.setScalar(1.3);
      const baseTrophyY = 0.84 + step.h + 0.14 + BALL_RADIUS * 1.3;
      trophy.position.set(step.x, baseTrophyY, 0);
      trophy.visible = false;
      trophy.castShadow = true;
      podiumGroup.add(trophy);

      const haloGeo = new THREE.TorusGeometry(0.78, 0.045, 10, 32);
      const haloRing = new THREE.Mesh(haloGeo, collarMat);
      haloRing.position.set(step.x, baseTrophyY, 0);
      haloRing.rotation.x = Math.PI * 0.28;
      haloRing.visible = false;
      podiumGroup.add(haloRing);

      this.podiumSlots.push({
        rank: step.rank,
        mesh: trophy,
        haloRing,
        baseY: baseTrophyY,
      });
    }

    // Waving Checkered Flags flanking the Victory Pavilion
    const flagMat = new THREE.MeshStandardMaterial({
      map: this.shared.checkerTex,
      roughness: 0.65,
      metalness: 0.04,
      side: THREE.DoubleSide,
    });
    for (const fx of [-4.2, 4.2]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 4.8, 8), steelArchMat);
      pole.position.set(fx, 0.48 + 2.4, -1.6);
      podiumGroup.add(pole);

      const flagCloth = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.85, 8, 2), flagMat);
      flagCloth.position.set(fx + (fx < 0 ? -0.72 : 0.72), 4.7, -1.6);
      flagCloth.userData.phase = fx < 0 ? 0.0 : 1.7;
      podiumGroup.add(flagCloth);
      this.flagMeshes.push(flagCloth);
    }

    // Retaining plinth beneath Victory Pavilion so it never floats or clips terrain
    const podPlinth = new THREE.Mesh(new THREE.BoxGeometry(9.8, 3.2, 5.6), graniteMat);
    podPlinth.position.set(0, -1.6, 0.15);
    podPlinth.receiveShadow = true;
    podiumGroup.add(podPlinth);

    const anchors = this.getPlazaPadAnchors();
    const podSt = anchors.podSt;
    podiumGroup.position.copy(anchors.podPos);
    podiumGroup.quaternion.copy(podSt.quat);
    this.trackGroup.add(podiumGroup);

    // Helper: Stylized 3D Instanced Spectators sitting/cheering across bleacher tiers
    const populateStandCrowd = (targetGroup, tiersCount, colsPerTier, tierRise, tierStepZ, halfSpanX) => {
      const total = tiersCount * colsPerTier;
      const torsoGeo = new THREE.CylinderGeometry(0.14, 0.18, 0.44, 8);
      const headGeo = new THREE.SphereGeometry(0.135, 10, 8);
      const torsoMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, metalness: 0.04 });
      const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, metalness: 0.02 });
      const torsoIM = new THREE.InstancedMesh(torsoGeo, torsoMat, total);
      const headIM = new THREE.InstancedMesh(headGeo, headMat, total);
      torsoIM.castShadow = true;
      headIM.castShadow = true;

      const outfitHex = [0x3b4d61, 0x8c4438, 0xb8aa96, 0x4d6b53, 0x5c5169, 0xa8783a, 0x353b42, 0x966246, 0x44667a];
      const skinHex = [0xdcb593, 0xc89872, 0x9d6c4d, 0xe8c7ab, 0x724c36];
      const colTmp = new THREE.Color();
      const baseSpecs = [];
      let idx = 0;

      for (let t = 0; t < tiersCount; t++) {
        for (let c = 0; c < colsPerTier; c++) {
          const u = colsPerTier > 1 ? c / (colsPerTier - 1) - 0.5 : 0;
          const jitterX = Math.sin((t * 17 + c * 31) * 1.37) * 0.09;
          const sx = u * (halfSpanX * 2) + jitterX;
          const sy = 0.76 + t * tierRise;
          const sz = -t * tierStepZ + 0.04;
          const scale = 0.92 + ((t * 7 + c * 3) % 5) * 0.04;
          const phase = (t * 1.9 + c * 0.77) % (Math.PI * 2);

          baseSpecs.push({ x: sx, y: sy, z: sz, scale, phase });

          this._dummy.position.set(sx, sy, sz);
          this._dummy.rotation.set(0, 0, 0);
          this._dummy.scale.setScalar(scale);
          this._dummy.updateMatrix();
          torsoIM.setMatrixAt(idx, this._dummy.matrix);

          this._dummy.position.set(sx, sy + 0.36 * scale, sz);
          this._dummy.updateMatrix();
          headIM.setMatrixAt(idx, this._dummy.matrix);

          colTmp.setHex(outfitHex[(idx * 5 + t) % outfitHex.length]);
          torsoIM.setColorAt(idx, colTmp);
          colTmp.setHex(skinHex[(idx * 3 + c) % skinHex.length]);
          headIM.setColorAt(idx, colTmp);
          idx++;
        }
      }
      torsoIM.instanceMatrix.needsUpdate = true;
      headIM.instanceMatrix.needsUpdate = true;
      if (torsoIM.instanceColor) torsoIM.instanceColor.needsUpdate = true;
      if (headIM.instanceColor) headIM.instanceColor.needsUpdate = true;

      targetGroup.add(torsoIM, headIM);
      this.crowdSpectatorGroups.push({ torsoIM, headIM, specs: baseSpecs });
    };

    // Opposite Finish Plaza Architectural Grandstand Tiers, Crowd & Timing Booth
    const standGroup = new THREE.Group();
    const standBaseMat = new THREE.MeshStandardMaterial({ color: 0x52575e, roughness: 0.72, metalness: 0.14 });
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x8c5938, roughness: 0.74, metalness: 0.05 });
    const standPlinth = new THREE.Mesh(new THREE.BoxGeometry(9.2, 3.2, 4.9), graniteMat);
    standPlinth.position.set(0, -1.6, -1.25);
    standPlinth.receiveShadow = true;
    standGroup.add(standPlinth);

    for (let t = 0; t < 3; t++) {
      const tier = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.45, 1.15), standBaseMat);
      tier.position.set(0, 0.225 + t * 0.45, -t * 1.05);
      tier.receiveShadow = true;
      tier.castShadow = true;
      standGroup.add(tier);

      const bench = new THREE.Mesh(new THREE.BoxGeometry(8.1, 0.12, 0.65), benchMat);
      bench.position.set(0, 0.48 + t * 0.45, -t * 1.05);
      standGroup.add(bench);
    }
    const booth = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 2.0), graniteMat);
    booth.position.set(0, 2.1, -3.2);
    booth.castShadow = true;
    standGroup.add(booth);
    const boothGlass = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.95, 0.08), skylightMat);
    boothGlass.position.set(0, 2.35, -2.18);
    standGroup.add(boothGlass);

    populateStandCrowd(standGroup, 3, 15, 0.45, 1.05, 3.65);

    standGroup.position.copy(anchors.standPos);
    standGroup.quaternion.copy(anchors.standSt.quat);
    standGroup.rotateY(Math.PI * 0.35);
    this.trackGroup.add(standGroup);

    // Mid-Course Spectator Viewing Stand with live cheering fans
    if (anchors.hasMidStand && anchors.midStandPos && anchors.midStandSt) {
      const midStandGroup = new THREE.Group();
      const midPlinth = new THREE.Mesh(new THREE.BoxGeometry(8.4, 3.2, 3.6), graniteMat);
      midPlinth.position.set(0, -1.6, -0.75);
      midPlinth.receiveShadow = true;
      midStandGroup.add(midPlinth);

      for (let t = 0; t < 2; t++) {
        const tier = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.45, 1.1), standBaseMat);
        tier.position.set(0, 0.225 + t * 0.45, -t * 1.02);
        tier.receiveShadow = true;
        tier.castShadow = true;
        midStandGroup.add(tier);

        const bench = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.12, 0.62), benchMat);
        bench.position.set(0, 0.48 + t * 0.45, -t * 1.02);
        midStandGroup.add(bench);
      }

      populateStandCrowd(midStandGroup, 2, 13, 0.45, 1.02, 3.3);
      midStandGroup.position.copy(anchors.midStandPos);
      midStandGroup.quaternion.copy(anchors.midStandSt.quat);
      midStandGroup.rotateY(Math.PI * 0.5);
      this.trackGroup.add(midStandGroup);
    }

    // Clean major architectural span portals every 80m so sightlines remain wide open
    const gantryMat = new THREE.MeshStandardMaterial({
      color: 0x4a5056,
      roughness: 0.48,
      metalness: 0.65,
    });
    for (let s = 55; s < L - 22; s += 80) {
      const gst = getStationAtS(this.trackData, s);
      const gantry = new THREE.Group();
      const postH = 5.5;
      const gPostL = new THREE.Mesh(new THREE.BoxGeometry(0.28, postH, 0.28), gantryMat);
      gPostL.position.set(-halfW - 0.35, postH * 0.5, 0);
      const gPostR = new THREE.Mesh(new THREE.BoxGeometry(0.28, postH, 0.28), gantryMat);
      gPostR.position.set(halfW + 0.35, postH * 0.5, 0);
      const spanBeam = new THREE.Mesh(
        new THREE.BoxGeometry(this.config.trackWidth + 1.1, 0.24, 0.3),
        gantryMat
      );
      spanBeam.position.set(0, postH, 0);
      gantry.add(gPostL, gPostR, spanBeam);
      gantry.position.copy(gst.pos);
      gantry.quaternion.copy(gst.quat);
      this.trackGroup.add(gantry);
    }
  }

  buildMultiLaneOrSplitFeatures() {
    const L = this.config.distanceMeters;
    const W = this.config.trackWidth;
    const frictionCfg = FRICTION_PRESETS[this.config.frictionPreset];

    if (this.config.trackType === 'multilane') {
      const lanes = W >= 10 ? 4 : 3;
      const dividerMat = new THREE.MeshStandardMaterial({
        color: 0x475569,
        roughness: 0.35,
        metalness: 0.7,
      });

      const sectionLen = 14;
      const gapLen = 8;
      for (let sStart = 6; sStart < L - 10; sStart += sectionLen + gapLen) {
        const sEnd = Math.min(L - 6, sStart + sectionLen);
        const segLen = sEnd - sStart;
        if (segLen < 4) continue;
        const sMid = (sStart + sEnd) * 0.5;
        const st = getStationAtS(this.trackData, sMid);

        for (let d = 1; d < lanes; d++) {
          const offsetX = -W * 0.5 + (W / lanes) * d;
          const divPos = st.pos
            .clone()
            .addScaledVector(st.R, offsetX)
            .addScaledVector(st.U, 0.45);

          const divGeo = new THREE.BoxGeometry(0.28, 0.9, segLen);
          const divMesh = new THREE.Mesh(divGeo, dividerMat);
          divMesh.position.copy(divPos);
          divMesh.quaternion.copy(st.quat);
          divMesh.castShadow = true;
          divMesh.receiveShadow = true;
          this.trackGroup.add(divMesh);

          const rb = this.world.createRigidBody(
            RAPIER.RigidBodyDesc.fixed()
              .setTranslation(divPos.x, divPos.y, divPos.z)
              .setRotation(st.quat)
          );
          const divCol = this.world.createCollider(
            RAPIER.ColliderDesc.cuboid(0.14, 0.45, segLen * 0.5)
              .setFriction(frictionCfg.friction)
              .setRestitution(0.45),
            rb
          );
          this.colliderMeta.set(divCol.handle, { kind: 'hurdle', subType: 'narrow_passage' });
        }
      }
    } else if (this.config.trackType === 'split') {
      // Twin-route central split islands along the course
      const islandMat = new THREE.MeshStandardMaterial({
        color: 0x3b434d,
        roughness: 0.42,
        metalness: 0.55,
      });
      const fractions = L >= 90 ? [0.22, 0.46, 0.70, 0.88] : [0.30, 0.68];
      for (const frac of fractions) {
        const s = L * frac;
        if (s < 8 || s > L - 8) continue;
        const st = getStationAtS(this.trackData, s);
        const islandW = Math.min(2.0, W * 0.21);
        const islandL = Math.min(11.0, L * 0.11);
        const islandH = 1.25;
        const pos = st.pos.clone().addScaledVector(st.U, islandH * 0.5);

        const geo = new THREE.CylinderGeometry(islandW * 0.48, islandW * 0.66, islandH, 6);
        const mesh = new THREE.Mesh(geo, islandMat);
        mesh.scale.set(1, 1, islandL / (islandW * 1.2));
        mesh.position.copy(pos);
        mesh.quaternion.copy(st.quat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.trackGroup.add(mesh);

        const rb = this.world.createRigidBody(
          RAPIER.RigidBodyDesc.fixed()
            .setTranslation(pos.x, pos.y, pos.z)
            .setRotation(st.quat)
        );
        const islandCol = this.world.createCollider(
          RAPIER.ColliderDesc.cuboid(islandW * 0.46, islandH * 0.5, islandL * 0.46)
            .setFriction(frictionCfg.friction)
            .setRestitution(0.5),
          rb
        );
        this.colliderMeta.set(islandCol.handle, { kind: 'hurdle', subType: 'narrow_passage' });
      }
    } else if (this.config.trackType === 'chicane') {
      // Alternating physical lateral chicane curb baffles
      const baffleMat = new THREE.MeshStandardMaterial({
        color: 0x474f57,
        roughness: 0.45,
        metalness: 0.52,
      });
      const count = Math.max(3, Math.floor(L / 20));
      for (let i = 0; i < count; i++) {
        const s = THREE.MathUtils.lerp(12, L - 12, (i + 0.5) / count);
        const st = getStationAtS(this.trackData, s);
        const side = i % 2 === 0 ? -1 : 1;
        const baffleW = W * 0.34;
        const baffleH = 1.05;
        const baffleD = 0.72;
        const offsetX = side * (W * 0.5 - baffleW * 0.5);
        const pos = st.pos
          .clone()
          .addScaledVector(st.R, offsetX)
          .addScaledVector(st.U, baffleH * 0.5);

        const baffleQuat = st.quat
          .clone()
          .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), side * 0.28));

        const mesh = new THREE.Mesh(new THREE.BoxGeometry(baffleW, baffleH, baffleD), baffleMat);
        mesh.position.copy(pos);
        mesh.quaternion.copy(baffleQuat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.trackGroup.add(mesh);

        const rb = this.world.createRigidBody(
          RAPIER.RigidBodyDesc.fixed()
            .setTranslation(pos.x, pos.y, pos.z)
            .setRotation(baffleQuat)
        );
        const col = this.world.createCollider(
          RAPIER.ColliderDesc.cuboid(baffleW * 0.5, baffleH * 0.5, baffleD * 0.5)
            .setFriction(frictionCfg.friction)
            .setRestitution(0.52),
          rb
        );
        this.colliderMeta.set(col.handle, { kind: 'hurdle', subType: 'narrow_passage' });
      }
    } else if (this.config.trackType === 'mixed') {
      // Physical split islands at 35% and 70% of track length
      const islandMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.35,
        metalness: 0.65,
      });
      for (const frac of [0.34, 0.68]) {
        const s = L * frac;
        if (s < 10 || s > L - 10) continue;
        const st = getStationAtS(this.trackData, s);
        const islandW = Math.min(2.2, W * 0.24);
        const islandL = 6.5;
        const islandH = 1.25;
        const pos = st.pos.clone().addScaledVector(st.U, islandH * 0.5);

        // Diamond-shaped prism (45-deg rotated box nose or cylinder pillar)
        const geo = new THREE.CylinderGeometry(islandW * 0.55, islandW * 0.72, islandH, 6);
        const mesh = new THREE.Mesh(geo, islandMat);
        mesh.scale.set(1, 1, islandL / (islandW * 1.3));
        mesh.position.copy(pos);
        mesh.quaternion.copy(st.quat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.trackGroup.add(mesh);

        const rb = this.world.createRigidBody(
          RAPIER.RigidBodyDesc.fixed()
            .setTranslation(pos.x, pos.y, pos.z)
            .setRotation(st.quat)
        );
        const islandCol = this.world.createCollider(
          RAPIER.ColliderDesc.cylinder(islandH * 0.5, islandW * 0.62)
            .setFriction(frictionCfg.friction)
            .setRestitution(0.55),
          rb
        );
        this.colliderMeta.set(islandCol.handle, { kind: 'hurdle', subType: 'narrow_passage' });
      }
    }
  }

  // ==========================================================================
  // Hurdles (All 7 Obstacle Types with Real Rapier Colliders)
  // ==========================================================================
  buildHurdles() {
    const count = this.config.hurdleCount;
    const enabled = Array.from(this.config.enabledObstacles);
    if (count <= 0 || enabled.length === 0) return;

    const L = this.config.distanceMeters;
    const sMin = 7.5;
    const sMax = Math.max(sMin + 4, L - 5.5);
    const span = sMax - sMin;
    const scale = HURDLE_SIZE_SCALES[this.config.hurdleSize] ?? 1.0;

    const stationsS = [];
    if (this.config.randomHurdles) {
      const step = span / count;
      for (let i = 0; i < count; i++) {
        const jitter = (Math.random() - 0.5) * step * 0.55;
        const s = THREE.MathUtils.clamp(sMin + (i + 0.5) * step + jitter, sMin, sMax);
        stationsS.push(s);
      }
    } else {
      const step = span / (count + 1);
      for (let i = 1; i <= count; i++) {
        stationsS.push(sMin + i * step);
      }
    }

    this.hurdleStationsS = stationsS;
    for (let i = 0; i < stationsS.length; i++) {
      const s = stationsS[i];
      const type = this.config.randomHurdles
        ? enabled[Math.floor(Math.random() * enabled.length)]
        : enabled[i % enabled.length];

      const st = getStationAtS(this.trackData, s);
      this.spawnSingleHurdle(type, st, scale, i);
    }
  }

  spawnSingleHurdle(type, st, scale, index) {
    const W = this.config.trackWidth;
    const halfW = W * 0.5;
    const frictionCfg = FRICTION_PRESETS[this.config.frictionPreset];

    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.28,
      metalness: 0.82,
    });
    const hazardMat = new THREE.MeshStandardMaterial({
      map: this.shared.hazardTex,
      roughness: 0.35,
      metalness: 0.35,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0x9c6234,
      roughness: 0.38,
      metalness: 0.52,
    });

    if (type === 'rotating_bar') {
      const barLen = Math.min(W - 1.4, (3.8 + W * 0.25) * scale);
      const maxLatOffset = Math.max(0, halfW - barLen * 0.5 - 0.35);
      const lateralOffset = this.config.randomHurdles
        ? (Math.random() - 0.5) * 2 * maxLatOffset * 0.75
        : 0;
      const barThick = 0.34 * scale;
      const hubY = BALL_RADIUS * 1.15;

      const group = new THREE.Group();
      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35 * scale, 0.42 * scale, hubY + 0.5, 16),
        metalMat
      );
      hub.castShadow = true;
      group.add(hub);

      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(barLen, barThick, barThick),
        hazardMat
      );
      arm.castShadow = true;
      group.add(arm);

      const basePos = st.pos
        .clone()
        .addScaledVector(st.R, lateralOffset)
        .addScaledVector(st.U, hubY);
      group.position.copy(basePos);
      group.quaternion.copy(st.quat);
      this.hurdleGroup.add(group);

      const rb = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased()
          .setTranslation(basePos.x, basePos.y, basePos.z)
          .setRotation(st.quat)
      );
      const barCol = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(barLen * 0.5, barThick * 0.5, barThick * 0.5)
          .setFriction(0.2)
          .setRestitution(0.56),
        rb
      );
      this.colliderMeta.set(barCol.handle, { kind: 'hurdle', subType: 'rotating_bar' });

      this.kinematicHurdles.push({
        type,
        mesh: group,
        body: rb,
        basePos,
        baseQuat: st.quat.clone(),
        axis: st.U.clone(),
        R: st.R.clone(),
        U: st.U.clone(),
        speed: (index % 2 === 0 ? 1 : -1) * (1.8 + (index % 3) * 0.45),
        phase: index * 1.1,
      });
    } else if (type === 'moving_gate') {
      const gateW = Math.max(1.8, Math.min(W * 0.46, 2.8 * scale));
      const gateH = 1.25 * scale;
      const gateD = 0.42;
      const travelAmp = Math.max(0.8, halfW - gateW * 0.5 - 0.35);

      const gateMesh = new THREE.Mesh(
        new THREE.BoxGeometry(gateW, gateH, gateD),
        hazardMat
      );
      gateMesh.castShadow = true;
      gateMesh.receiveShadow = true;

      const basePos = st.pos.clone().addScaledVector(st.U, gateH * 0.5 + 0.04);
      gateMesh.position.copy(basePos);
      gateMesh.quaternion.copy(st.quat);
      this.hurdleGroup.add(gateMesh);

      // Fixed overhead guide rail
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(W + 0.4, 0.22, 0.28),
        metalMat
      );
      rail.position.copy(st.pos).addScaledVector(st.U, gateH + 0.25);
      rail.quaternion.copy(st.quat);
      this.hurdleGroup.add(rail);

      const rb = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased()
          .setTranslation(basePos.x, basePos.y, basePos.z)
          .setRotation(st.quat)
      );
      const gateCol = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(gateW * 0.5, gateH * 0.5, gateD * 0.5)
          .setFriction(0.15)
          .setRestitution(0.5),
        rb
      );
      this.colliderMeta.set(gateCol.handle, { kind: 'hurdle', subType: 'moving_gate' });

      this.kinematicHurdles.push({
        type,
        mesh: gateMesh,
        body: rb,
        basePos,
        baseQuat: st.quat.clone(),
        R: st.R.clone(),
        U: st.U.clone(),
        amp: travelAmp,
        speed: 1.75 + (index % 3) * 0.35,
        phase: index * 1.3,
      });
    } else if (type === 'speed_bump') {
      // Smooth transverse rounded ridge never exceeding 0.85 * ballRadius so balls reliably clear it
      const bumpR = THREE.MathUtils.clamp(0.24 * scale, 0.16, BALL_RADIUS * 0.82);
      const bumpLen = W - 0.8;
      const group = new THREE.Group();

      const cylGeo = new THREE.CylinderGeometry(bumpR, bumpR, bumpLen, 16);
      cylGeo.rotateZ(Math.PI / 2);
      const bumpMesh = new THREE.Mesh(cylGeo, accentMat);
      bumpMesh.castShadow = true;
      bumpMesh.receiveShadow = true;
      group.add(bumpMesh);

      const pos = st.pos.clone().addScaledVector(st.U, bumpR * 0.35);
      group.position.copy(pos);
      group.quaternion.copy(st.quat);
      this.hurdleGroup.add(group);

      const rotZ = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1),
        Math.PI / 2
      );
      const colQuat = st.quat.clone().multiply(rotZ);

      const rb = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed()
          .setTranslation(pos.x, pos.y, pos.z)
          .setRotation(colQuat)
      );
      const bumpCol = this.world.createCollider(
        RAPIER.ColliderDesc.cylinder(bumpLen * 0.5, bumpR)
          .setFriction(frictionCfg.friction)
          .setRestitution(0.4),
        rb
      );
      this.colliderMeta.set(bumpCol.handle, { kind: 'hurdle', subType: 'speed_bump' });
    } else if (type === 'spinning_wheel') {
      const wheelR = 1.15 * scale;
      const wheelW = Math.min(W - 1.4, 3.2 * scale);
      const lateralOffset = this.config.randomHurdles
        ? (Math.random() - 0.5) * Math.max(0, W - wheelW - 1.2) * 0.7
        : ((index % 3) - 1) * Math.max(0, (W - wheelW - 1.4) * 0.4);

      const group = new THREE.Group();
      const axle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, wheelW + 0.5, 12),
        metalMat
      );
      axle.rotation.z = Math.PI / 2;
      group.add(axle);

      const bladeThick = 0.16;
      const bladeGeo = new THREE.BoxGeometry(wheelW, wheelR * 2, bladeThick);
      const blade1 = new THREE.Mesh(bladeGeo, accentMat);
      blade1.castShadow = true;
      const blade2 = new THREE.Mesh(bladeGeo, hazardMat);
      blade2.rotation.x = Math.PI / 2;
      blade2.castShadow = true;
      group.add(blade1, blade2);

      const basePos = st.pos
        .clone()
        .addScaledVector(st.R, lateralOffset)
        .addScaledVector(st.U, wheelR + 0.14);
      group.position.copy(basePos);
      group.quaternion.copy(st.quat);
      this.hurdleGroup.add(group);

      const rb = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased()
          .setTranslation(basePos.x, basePos.y, basePos.z)
          .setRotation(st.quat)
      );
      const wCol1 = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(wheelW * 0.5, wheelR, bladeThick * 0.5)
          .setFriction(0.25)
          .setRestitution(0.52),
        rb
      );
      const perpQuat = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        Math.PI / 2
      );
      const wCol2 = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(wheelW * 0.5, wheelR, bladeThick * 0.5)
          .setRotation(perpQuat)
          .setFriction(0.25)
          .setRestitution(0.52),
        rb
      );
      this.colliderMeta.set(wCol1.handle, { kind: 'hurdle', subType: 'spinning_wheel' });
      this.colliderMeta.set(wCol2.handle, { kind: 'hurdle', subType: 'spinning_wheel' });

      this.kinematicHurdles.push({
        type,
        mesh: group,
        body: rb,
        basePos,
        baseQuat: st.quat.clone(),
        axis: st.R.clone(),
        speed: 2.3 + (index % 3) * 0.5,
        phase: index * 0.9,
      });
    } else if (type === 'jump_ramp') {
      const rampW = Math.min(W - 1.2, 4.2 * scale);
      const rampL = 3.2 * scale;
      const rampH = 0.56 * scale;
      const lateralOffset = this.config.randomHurdles
        ? (Math.random() - 0.5) * Math.max(0, W - rampW - 1.0) * 0.7
        : 0;

      // Build flush wedge prism (leading edge sits at y = 0 so balls never snag)
      const hw = rampW * 0.5;
      const hl = rampL * 0.5;
      const wedgeVerts = new Float32Array([
        // Leading edge (bottom +Z in local frame since forward is -Z)
        -hw, 0, hl,
        hw, 0, hl,
        // Trailing top edge (-Z)
        hw, rampH, -hl,
        -hw, rampH, -hl,
        // Trailing bottom edge (-Z)
        hw, 0, -hl,
        -hw, 0, -hl,
      ]);
      const wedgeIndices = [
        // Top sloped surface
        0, 1, 2, 0, 2, 3,
        // Back vertical face
        3, 2, 4, 3, 4, 5,
        // Left side triangle
        0, 3, 5,
        // Right side triangle
        1, 4, 2,
        // Bottom face
        0, 5, 4, 0, 4, 1,
      ];

      const wedgeGeo = new THREE.BufferGeometry();
      wedgeGeo.setAttribute('position', new THREE.BufferAttribute(wedgeVerts, 3));
      wedgeGeo.setIndex(wedgeIndices);
      wedgeGeo.computeVertexNormals();

      const rampGroup = new THREE.Group();
      const rampMesh = new THREE.Mesh(wedgeGeo, accentMat);
      rampMesh.castShadow = true;
      rampMesh.receiveShadow = true;
      rampGroup.add(rampMesh);

      // Side guide rails on ramp
      const guideMat = metalMat;
      const guideGeo = new THREE.BoxGeometry(0.16, rampH + 0.15, rampL);
      const gL = new THREE.Mesh(guideGeo, guideMat);
      gL.position.set(-hw - 0.08, (rampH + 0.15) * 0.5, 0);
      const gR = new THREE.Mesh(guideGeo, guideMat);
      gR.position.set(hw + 0.08, (rampH + 0.15) * 0.5, 0);
      rampGroup.add(gL, gR);

      const pos = st.pos.clone().addScaledVector(st.R, lateralOffset);
      rampGroup.position.copy(pos);
      rampGroup.quaternion.copy(st.quat);
      this.hurdleGroup.add(rampGroup);

      const rb = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed()
          .setTranslation(pos.x, pos.y, pos.z)
          .setRotation(st.quat)
      );
      const rampCol = this.world.createCollider(
        RAPIER.ColliderDesc.convexHull(wedgeVerts)
          .setFriction(frictionCfg.friction)
          .setRestitution(0.22),
        rb
      );
      this.colliderMeta.set(rampCol.handle, { kind: 'hurdle', subType: 'jump_ramp' });
    } else if (type === 'narrow_passage') {
      // Twin side pilasters squeezing the lane while guaranteeing clearance >= 2.6 * ballDiameter
      const minGap = Math.max(2.3, BALL_RADIUS * 5.6);
      const maxBlockEach = Math.max(0.6, (W - minGap) * 0.5);
      const blockW = Math.min(maxBlockEach, (W * 0.28) * scale);
      const blockH = 1.45 * scale;
      const blockL = 2.6 * scale;

      const group = new THREE.Group();
      const blockGeo = new THREE.BoxGeometry(blockW, blockH, blockL);

      for (const side of [-1, 1]) {
        const bx = side * (halfW - blockW * 0.5);
        const blockMesh = new THREE.Mesh(blockGeo, metalMat);
        blockMesh.position.set(bx, blockH * 0.5, 0);
        blockMesh.castShadow = true;
        blockMesh.receiveShadow = true;
        group.add(blockMesh);

        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(blockW + 0.04, 0.24, blockL + 0.04),
          hazardMat
        );
        stripe.position.set(bx, blockH - 0.15, 0);
        group.add(stripe);
      }

      group.position.copy(st.pos);
      group.quaternion.copy(st.quat);
      this.hurdleGroup.add(group);

      const rb = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed()
          .setTranslation(st.pos.x, st.pos.y, st.pos.z)
          .setRotation(st.quat)
      );
      for (const side of [-1, 1]) {
        const bx = side * (halfW - blockW * 0.5);
        const npCol = this.world.createCollider(
          RAPIER.ColliderDesc.cuboid(blockW * 0.5, blockH * 0.5, blockL * 0.5)
            .setTranslation(bx, blockH * 0.5, 0)
            .setFriction(frictionCfg.friction)
            .setRestitution(0.48),
          rb
        );
        this.colliderMeta.set(npCol.handle, { kind: 'hurdle', subType: 'narrow_passage' });
      }
    } else if (type === 'moving_platform') {
      // Oscillating bumper-shuttle platform gliding laterally with safe side clearance
      const platW = Math.min(W * 0.4, 2.6 * scale);
      const platH = 0.72 * scale;
      const platL = 2.0 * scale;
      const amp = Math.max(0.5, halfW - platW * 0.5 - 0.85);

      const platGroup = new THREE.Group();
      const bodyMesh = new THREE.Mesh(
        new THREE.BoxGeometry(platW, platH, platL),
        metalMat
      );
      bodyMesh.castShadow = true;
      bodyMesh.receiveShadow = true;
      const capMesh = new THREE.Mesh(
        new THREE.BoxGeometry(platW + 0.06, 0.16, platL + 0.06),
        accentMat
      );
      capMesh.position.y = platH * 0.5;
      platGroup.add(bodyMesh, capMesh);

      const basePos = st.pos.clone().addScaledVector(st.U, platH * 0.5);
      platGroup.position.copy(basePos);
      platGroup.quaternion.copy(st.quat);
      this.hurdleGroup.add(platGroup);

      const rb = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased()
          .setTranslation(basePos.x, basePos.y, basePos.z)
          .setRotation(st.quat)
      );
      const platCol = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(platW * 0.5, platH * 0.5, platL * 0.5)
          .setFriction(0.22)
          .setRestitution(0.55),
        rb
      );
      this.colliderMeta.set(platCol.handle, { kind: 'hurdle', subType: 'moving_platform' });

      this.kinematicHurdles.push({
        type,
        mesh: platGroup,
        body: rb,
        basePos,
        baseQuat: st.quat.clone(),
        R: st.R.clone(),
        U: st.U.clone(),
        amp,
        speed: 1.45 + (index % 3) * 0.3,
        phase: index * 1.7,
      });
    }
  }

  // ==========================================================================
  // Spawn Balls on Dynamic Starting Grid
  // ==========================================================================
  spawnBalls() {
    const count = this.config.ballCount;
    const { cols } = this.trackData;
    const W = this.config.trackWidth;
    const usableW = Math.max(2.5, W - 1.5);
    const colSpacing = cols > 1 ? usableW / (cols - 1) : 0;
    const rowSpacing = 1.1;
    const frictionCfg = FRICTION_PRESETS[this.config.frictionPreset];

    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const itemsInRow = Math.min(cols, count - row * cols);
      const rowOffset = itemsInRow > 1 ? (col - (itemsInRow - 1) * 0.5) * colSpacing : 0;
      const stagger = (row % 2 === 1 ? 0.14 : -0.14) * (cols > 2 ? 1 : 0);
      const sPos = -1.2 - row * rowSpacing;

      const st = getStationAtS(this.trackData, sPos);
      const spawnPos = st.pos
        .clone()
        .addScaledVector(st.R, THREE.MathUtils.clamp(rowOffset + stagger, -W * 0.42, W * 0.42))
        .addScaledVector(st.U, BALL_RADIUS + 0.04);

      const colorHex = this.ballColors[i] || '#f59e0b';
      const mat = new THREE.MeshPhysicalMaterial({
        color: setRichMarbleColor(new THREE.Color(), colorHex),
        map: this.shared.marbleTex,
        roughness: 0.22,
        metalness: 0.02,
        clearcoat: 0.28,
        clearcoatRoughness: 0.08,
        ior: 1.48,
        reflectivity: 0.48,
        envMapIntensity: 0.26,
      });

      const mesh = new THREE.Mesh(this.shared.ballGeo, mat);
      mesh.position.copy(spawnPos);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.ballIndex = i;
      this.ballGroup.add(mesh);

      // Optional experimental variance (off by default so all balls are physically identical)
      const density = this.config.experimentalVariance
        ? 2.2 + ((i * 7) % 11) * 0.12
        : 2.6;
      const restitution = this.config.experimentalVariance
        ? THREE.MathUtils.clamp(frictionCfg.restitution + ((i % 5) - 2) * 0.07, 0.15, 0.85)
        : frictionCfg.restitution;

      const rbDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(spawnPos.x, spawnPos.y, spawnPos.z)
        .setCcdEnabled(true)
        .setLinearDamping(0.015)
        .setAngularDamping(0.015);

      const body = this.world.createRigidBody(rbDesc);
      const colDesc = RAPIER.ColliderDesc.ball(BALL_RADIUS)
        .setDensity(density)
        .setFriction(frictionCfg.friction)
        .setRestitution(restitution)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
      const ballCol = this.world.createCollider(colDesc, body);
      this.colliderMeta.set(ballCol.handle, { kind: 'ball', ballId: i });

      this.balls.push({
        id: i,
        name: `Ball #${String(i + 1).padStart(2, '0')}`,
        color: colorHex,
        mesh,
        body,
        stationIdx: Math.max(0, Math.floor((sPos - this.trackData.sStart) / this.trackData.ds)),
        progressMeters: 0,
        prevProgressMeters: 0,
        lastCheckpointS: 0.6,
        stuckTimer: 0,
        lastBoostAt: -10,
        currentSpeed: 0,
        prevSpeed: 0,
        peakSpeed: 0,
        finished: false,
        finishTime: null,
        finishRank: null,
        rank: i + 1,
        worldPos: spawnPos.clone(),
        prevPos: spawnPos.clone(),
        currPos: spawnPos.clone(),
        prevQuat: new THREE.Quaternion(),
        currQuat: new THREE.Quaternion(),
      });
    }
  }

  // ==========================================================================
  // Race Lifecycle Controls
  // ==========================================================================
  startRace() {
    if (this.raceState === 'REPLAY') {
      this.cameraMode = this.preReplayCameraMode || 'overview';
      this.raceState = 'FINISHED';
    }
    if (this.raceState === 'FINISHED' || this.raceState === 'RACING' || this.raceState === 'PAUSED') {
      this.rebuildTrackAndRace({ preserveCamera: true });
    }
    this.sound.ensureContext(true);
    const liveQualityKey = QUALITY_PRESETS[this.qualityPreset] ? this.qualityPreset : 'standard';
    const activeQualityCfg = QUALITY_PRESETS[liveQualityKey] || QUALITY_PRESETS.standard;
    this.recordedVideoQuality = liveQualityKey;
    const recStarted = this.recorder.start(activeQualityCfg);
    this.dom.hudRecBadge.classList.toggle('hidden', !recStarted);
    this.gameplayEndHold = 0;
    this.gameplayReplayEndHold = 0;
    this.crowdExcitement = 0.15;
    this.activeFinishBanners = [];
    this.endLeaderboardActive = false;
    this.endLeaderboardSorted = [];
    this.hideCanvasOverlay();
    this.renderBroadcastHudCanvas(true);

    this.raceState = 'COUNTDOWN';
    this.countdownRemaining = 3.2;
    this.lastCountdownDigit = null;
    if (this.countdownMesh) this.countdownMesh.visible = false;

    // Auto-tuck configuration drawer on mobile/tablet or narrow viewports so action is clear
    if (window.innerWidth < 1180) {
      this.setConfigDrawerOpen(false);
    }
    this.syncUiState();
  }

  pauseRace() {
    if (this.raceState === 'RACING') {
      this.raceState = 'PAUSED';
      this.sound.updateRollingBed(0, false);
      this.recorder.pause();
      this.syncUiState();
    }
  }

  resumeRace() {
    if (this.raceState === 'PAUSED') {
      this.raceState = 'RACING';
      this.recorder.resume();
      this.lastFrameTime = performance.now();
      this.syncUiState();
    }
  }

  restartRace() {
    this.rebuildTrackAndRace({ preserveCamera: false });
  }

  generateNewTrack() {
    this.trackSeed++;
    if (this.config.cycleMapOnNewTrack) {
      const idx = TERRITORY_ORDER.indexOf(this.config.mapPreset);
      this.config.mapPreset = TERRITORY_ORDER[(idx + 1) % TERRITORY_ORDER.length];
      this.syncSettingsControlsToDom();
    }
    this.rebuildTrackAndRace({ preserveCamera: false });
  }

  randomizeBallColors() {
    const used = new Set();
    const isDark = this.config.palette === 'ultradark';
    for (let i = 0; i < this.config.ballCount; i++) {
      let hex;
      if (this.config.allowDuplicateColors) {
        hex = isDark
          ? hslToHex(Math.random() * 360, 92 + Math.random() * 8, 30 + Math.random() * 11)
          : hslToHex(Math.random() * 360, 72 + Math.random() * 20, 48 + Math.random() * 14);
      } else {
        hex = generateDistinctColor(Math.floor(Math.random() * 100) + i, used, this.config.palette);
        used.add(hex);
      }
      this.ballColors[i] = hex;
      if (this.balls[i]) {
        this.balls[i].color = hex;
        setRichMarbleColor(this.balls[i].mesh.material.color, hex);
      }
    }
    this.renderBallColorEditor();
    this.updateLeaderboard(true);
  }

  resetSettings() {
    this.config = {
      ...DEFAULT_CONFIG,
      enabledObstacles: new Set(DEFAULT_CONFIG.enabledObstacles),
    };
    this.ballColors = buildBallColorsForPalette(
      this.config.palette,
      this.config.ballCount,
      this.config.allowDuplicateColors
    );
    this.renderBallColorEditor();
    this.syncSettingsControlsToDom();
    this.rebuildTrackAndRace({ preserveCamera: false });
  }

  // ==========================================================================
  // Physics Step & Real Progress / Finish Measurement
  // ==========================================================================
  showCanvasCountdown(label, isGo = false) {
    if (!this.countdownCtx || !this.countdownMesh || !this.countdownTex) return;
    const ctx = this.countdownCtx;
    const w = this.countdownCanvas.width;
    const h = this.countdownCanvas.height;
    const k = w / 512;
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.fillStyle = 'rgba(18, 21, 26, 0.74)';
    ctx.strokeStyle = isGo ? 'rgba(92, 194, 134, 0.92)' : 'rgba(216, 178, 110, 0.85)';
    ctx.lineWidth = 4 * k;
    const rw = (isGo ? 304 : 216) * k;
    const rh = 176 * k;
    const rx = (w - rw) * 0.5;
    const ry = (h - rh) * 0.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(rx, ry, rw, rh, 18 * k);
    else ctx.rect(rx, ry, rw, rh);
    ctx.fill();
    ctx.stroke();

    ctx.font = `700 ${116 * k}px "Plus Jakarta Sans", Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isGo ? '#68d391' : '#f4f1e8';
    ctx.fillText(label, w * 0.5, h * 0.5 + 4 * k);
    ctx.restore();

    this.countdownTex.needsUpdate = true;
    this.countdownMesh.visible = true;
    this.countdownAnimTime = 0;
    this.countdownMesh.scale.setScalar(1.18);
  }

  formatOrdinal(rank) {
    const mod100 = rank % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${rank}TH`;
    const mod10 = rank % 10;
    if (mod10 === 1) return `${rank}ST`;
    if (mod10 === 2) return `${rank}ND`;
    if (mod10 === 3) return `${rank}RD`;
    return `${rank}TH`;
  }

  buildMinimapCache() {
    if (!this.trackData) {
      this.minimapCache = null;
      return;
    }
    const L = this.config.distanceMeters;
    const samples = 110;
    const rawPts = [];
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (let i = 0; i <= samples; i++) {
      const s = (i / samples) * L;
      const st = getStationAtS(this.trackData, s);
      const px = st.pos.x;
      const pz = st.pos.z;
      rawPts.push({ x: px, z: pz });
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (pz < minZ) minZ = pz;
      if (pz > maxZ) maxZ = pz;
    }

    const span = Math.max(maxX - minX, maxZ - minZ, 12);
    const cx = (minX + maxX) * 0.5;
    const cz = (minZ + maxZ) * 0.5;
    const toNorm = (wx, wz) => ({
      nx: THREE.MathUtils.clamp(0.5 + ((wx - cx) / span) * 0.72, 0.08, 0.92),
      nz: THREE.MathUtils.clamp(0.5 + ((wz - cz) / span) * 0.72, 0.1, 0.9),
    });

    const points = rawPts.map((p) => toNorm(p.x, p.z));
    this.minimapCache = {
      cx,
      cz,
      span,
      points,
      startNorm: points[0] || { nx: 0.5, nz: 0.15 },
      finishNorm: points[points.length - 1] || { nx: 0.5, nz: 0.85 },
    };
  }

  projectToMinimap(wx, wz) {
    if (!this.minimapCache) return { nx: 0.5, nz: 0.5 };
    const { cx, cz, span } = this.minimapCache;
    return {
      nx: THREE.MathUtils.clamp(0.5 + ((wx - cx) / span) * 0.72, 0.06, 0.94),
      nz: THREE.MathUtils.clamp(0.5 + ((wz - cz) / span) * 0.72, 0.06, 0.94),
    };
  }

  hideCanvasOverlay() {
    this.endLeaderboardActive = false;
    this.endLeaderboardSorted = [];
    this.lastReplayWinnerBannerId = -1;
    this.renderBroadcastHudCanvas(true);
  }

  pushFinishBanner(ball, winnerTime = null) {
    if (!ball) return;
    const rank = ball.finishRank || ball.rank || 1;
    const gap =
      rank > 1 && winnerTime !== null && ball.finishTime !== null
        ? `+${Math.max(0, ball.finishTime - winnerTime).toFixed(2)}s`
        : rank === 1
          ? 'WINNER'
          : '';
    this.activeFinishBanners = this.activeFinishBanners.filter((b) => b.id !== ball.id);
    this.activeFinishBanners.unshift({
      id: ball.id,
      rank,
      name: ball.name,
      color: ball.color,
      finishTime: ball.finishTime,
      gap,
      remaining: rank === 1 ? 3.2 : 2.35,
    });
    if (this.activeFinishBanners.length > 2) {
      this.activeFinishBanners.length = 2;
    }
    this.renderBroadcastHudCanvas(true);
  }

  showCanvasWinnerBanner(winnerBall) {
    this.pushFinishBanner(winnerBall, winnerBall?.finishTime ?? null);
  }

  showCanvasEndLeaderboard(sorted) {
    if (!sorted || sorted.length === 0) return;
    this.endLeaderboardActive = true;
    this.endLeaderboardSorted = sorted;
    this.renderBroadcastHudCanvas(true);
  }

  renderBroadcastHudCanvas(force = false) {
    if (!this.hudOverlayCtx || !this.hudOverlayMesh || !this.hudOverlayTex) return;
    const now = performance.now();
    if (!force && now - this.lastOverlayDrawAt < 34) return;
    this.lastOverlayDrawAt = now;

    const ctx = this.hudOverlayCtx;
    const w = this.hudOverlayCanvas.width;
    const h = this.hudOverlayCanvas.height;
    const k = h / 1080;
    ctx.clearRect(0, 0, w, h);

    // 1. Official Final Results Leaderboard Card (shown at end of BOTH Video 1 and Video 2)
    if (this.endLeaderboardActive && this.endLeaderboardSorted.length > 0) {
      const sorted = this.endLeaderboardSorted;
      const winner = sorted[0];
      const maxRows = Math.min(sorted.length, 10);
      const rowH = 52 * k;
      const cardW = Math.min(w - 48 * k, 780 * k);
      const headerH = 132 * k;
      const cardH = headerH + maxRows * rowH + 26 * k;
      const cx = (w - cardW) * 0.5;
      const cy = Math.max(54 * k, (h - cardH) * 0.5);

      ctx.save();
      ctx.fillStyle = 'rgba(15, 18, 23, 0.92)';
      ctx.strokeStyle = 'rgba(229, 184, 75, 0.92)';
      ctx.lineWidth = 3 * k;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cx, cy, cardW, cardH, 14 * k);
      else ctx.rect(cx, cy, cardW, cardH);
      ctx.fill();
      ctx.stroke();

      ctx.font = `700 ${22 * k}px "JetBrains Mono", monospace`;
      ctx.fillStyle = '#e5b84b';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('OFFICIAL FINAL STANDINGS', cx + 32 * k, cy + 34 * k);

      if (winner) {
        ctx.beginPath();
        ctx.arc(cx + 46 * k, cy + 84 * k, 18 * k, 0, Math.PI * 2);
        ctx.fillStyle = winner.color || '#e5b84b';
        ctx.fill();
        ctx.lineWidth = 2 * k;
        ctx.strokeStyle = 'rgba(255,255,255,0.65)';
        ctx.stroke();

        ctx.font = `700 ${34 * k}px "Plus Jakarta Sans", Inter, system-ui, sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`1ST PLACE: ${winner.name.toUpperCase()}`, cx + 80 * k, cy + 84 * k);

        const wTime =
          winner.finishTime !== null
            ? `${winner.finishTime.toFixed(2)}s`
            : `${winner.progressMeters.toFixed(1)}m`;
        ctx.font = `700 ${30 * k}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'right';
        ctx.fillStyle = '#68d391';
        ctx.fillText(wTime, cx + cardW - 32 * k, cy + 84 * k);
      }

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 1.5 * k;
      ctx.beginPath();
      ctx.moveTo(cx + 28 * k, cy + headerH - 6 * k);
      ctx.lineTo(cx + cardW - 28 * k, cy + headerH - 6 * k);
      ctx.stroke();

      const winnerTime = winner?.finishTime ?? null;
      for (let i = 0; i < maxRows; i++) {
        const b = sorted[i];
        const ry = cy + headerH + i * rowH + rowH * 0.5;
        if (i % 2 === 0) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
          ctx.fillRect(cx + 22 * k, ry - rowH * 0.45, cardW - 44 * k, rowH * 0.9);
        }

        ctx.textAlign = 'left';
        ctx.font = `700 ${24 * k}px "JetBrains Mono", monospace`;
        ctx.fillStyle = i === 0 ? '#eab308' : i === 1 ? '#cbd5e1' : i === 2 ? '#d97706' : '#9aa1ac';
        ctx.fillText(this.formatOrdinal(i + 1), cx + 34 * k, ry);

        ctx.beginPath();
        ctx.arc(cx + 122 * k, ry, 11 * k, 0, Math.PI * 2);
        ctx.fillStyle = b.color || '#ffffff';
        ctx.fill();
        ctx.lineWidth = 1.5 * k;
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.stroke();

        ctx.font = `600 ${25 * k}px "Plus Jakarta Sans", Inter, system-ui, sans-serif`;
        ctx.fillStyle = '#f1f0ec';
        ctx.fillText(b.name, cx + 150 * k, ry);

        ctx.textAlign = 'right';
        ctx.font = `600 ${23 * k}px "JetBrains Mono", monospace`;
        if (b.finished && b.finishTime !== null) {
          ctx.fillStyle = i === 0 ? '#68d391' : '#d2d6de';
          const gapTxt =
            i === 0
              ? 'WINNER'
              : winnerTime !== null
                ? `+${(b.finishTime - winnerTime).toFixed(2)}s`
                : '';
          ctx.fillText(`${b.finishTime.toFixed(2)}s   ${gapTxt}`, cx + cardW - 34 * k, ry);
        } else {
          ctx.fillStyle = '#8b929e';
          ctx.fillText(`${b.progressMeters.toFixed(1)}m`, cx + cardW - 34 * k, ry);
        }
      }

      ctx.restore();
      this.hudOverlayTex.needsUpdate = true;
      this.hudOverlayMesh.visible = true;
      return;
    }

    const activeRaceOrReplay =
      this.raceState === 'COUNTDOWN' ||
      this.raceState === 'RACING' ||
      this.raceState === 'REPLAY' ||
      this.raceState === 'FINISHED';

    const sorted = [...this.balls].sort((a, b) => a.rank - b.rank);
    let anyDrawn = false;

    // 2. Compact Bottom-Left Minimap (Track Path, Start, Finish, Live Balls)
    if (this.minimapCache && this.balls.length > 0) {
      anyDrawn = true;
      const mapW = 136 * k;
      const mapH = 136 * k;
      const mx = 14 * k;
      const my = h - mapH - 14 * k;
      const padTop = 22 * k;
      const innerPad = 10 * k;
      const plotW = mapW - innerPad * 2;
      const plotH = mapH - padTop - innerPad;
      const plotX = mx + innerPad;
      const plotY = my + padTop;

      ctx.save();
      ctx.fillStyle = 'rgba(13, 16, 22, 0.76)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 1.4 * k;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(mx, my, mapW, mapH, 7 * k);
      else ctx.rect(mx, my, mapW, mapH);
      ctx.fill();
      ctx.stroke();

      // Quiet Header + Progress %
      const leader = sorted[0];
      const leadPct = leader
        ? Math.min(100, Math.max(0, Math.round((leader.progressMeters / Math.max(1, this.config.distanceMeters)) * 100)))
        : 0;
      ctx.font = `700 ${9.5 * k}px "JetBrains Mono", monospace`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#8b93a2';
      ctx.fillText('MAP', mx + 9 * k, my + 12 * k);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#e0a943';
      ctx.fillText(`${leadPct}%`, mx + mapW - 9 * k, my + 12 * k);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1 * k;
      ctx.beginPath();
      ctx.moveTo(mx + 6 * k, my + padTop - 1 * k);
      ctx.lineTo(mx + mapW - 6 * k, my + padTop - 1 * k);
      ctx.stroke();

      // Thin Track Ribbon
      const pts = this.minimapCache.points;
      if (pts.length >= 2) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
          const px = plotX + pts[i].nx * plotW;
          const py = plotY + pts[i].nz * plotH;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = 'rgba(130, 140, 156, 0.48)';
        ctx.lineWidth = 5.2 * k;
        ctx.stroke();

        ctx.strokeStyle = '#1f242d';
        ctx.lineWidth = 2.8 * k;
        ctx.stroke();
      }

      // Start & Finish Markers
      const sPt = this.minimapCache.startNorm;
      const fPt = this.minimapCache.finishNorm;
      const sx = plotX + sPt.nx * plotW;
      const sy = plotY + sPt.nz * plotH;
      const fx = plotX + fPt.nx * plotW;
      const fy = plotY + fPt.nz * plotH;

      ctx.beginPath();
      ctx.arc(sx, sy, 4.2 * k, 0, Math.PI * 2);
      ctx.fillStyle = '#2ea86f';
      ctx.fill();
      ctx.lineWidth = 1.2 * k;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(fx, fy, 4.8 * k, 0, Math.PI * 2);
      ctx.fillStyle = '#e0a943';
      ctx.fill();
      ctx.lineWidth = 1.2 * k;
      ctx.strokeStyle = '#111419';
      ctx.stroke();

      // Compact S / F Labels kept cleanly inside bounds
      ctx.font = `700 ${8 * k}px "JetBrains Mono", monospace`;
      ctx.textBaseline = 'middle';
      const sRight = sx > plotX + plotW * 0.62;
      ctx.textAlign = sRight ? 'right' : 'left';
      ctx.fillStyle = '#68d391';
      ctx.fillText('START', sx + (sRight ? -7 * k : 7 * k), sy);

      const fRight = fx > plotX + plotW * 0.62;
      ctx.textAlign = fRight ? 'right' : 'left';
      ctx.fillStyle = '#f2cc73';
      ctx.fillText('FINISH', fx + (fRight ? -8 * k : 8 * k), fy);

      // Every Ball Live Dot (leader crisp on top)
      for (let i = sorted.length - 1; i >= 0; i--) {
        const b = sorted[i];
        const bp = this.projectToMinimap(b.worldPos.x, b.worldPos.z);
        const bx = plotX + bp.nx * plotW;
        const by = plotY + bp.nz * plotH;
        const isFirst = i === 0;
        const r = (isFirst ? 4.4 : 3.1) * k;

        if (isFirst) {
          ctx.beginPath();
          ctx.arc(bx, by, r + 2 * k, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(224, 169, 67, 0.92)';
          ctx.lineWidth = 1.4 * k;
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, Math.PI * 2);
        ctx.fillStyle = b.color || '#ffffff';
        ctx.fill();
        ctx.lineWidth = 1 * k;
        ctx.strokeStyle = '#0f1217';
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3. Slim Top-Right Timing Tower Standings (Rendered on WebGL Canvas for Video 1 & Video 2)
    if (activeRaceOrReplay && sorted.length > 0) {
      anyDrawn = true;
      const maxShown = 6;
      const maxRows = Math.min(sorted.length, maxShown);
      const rowH = 23 * k;
      const cardW = 184 * k;
      const headerH = 26 * k;
      const extraFoot = sorted.length > maxShown ? 18 * k : 6 * k;
      const cardH = headerH + maxRows * rowH + extraFoot;
      const lx = w - cardW - 14 * k;
      const ly = 58 * k;

      ctx.save();
      ctx.fillStyle = 'rgba(13, 16, 22, 0.78)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 1.4 * k;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(lx, ly, cardW, cardH, 7 * k);
      else ctx.rect(lx, ly, cardW, cardH);
      ctx.fill();
      ctx.stroke();

      // Header + Live Clock
      const shownTime =
        this.raceState === 'REPLAY' ? this.replay.currentTime : this.raceElapsedTime;
      ctx.font = `700 ${9.5 * k}px "JetBrains Mono", monospace`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#8b93a2';
      ctx.fillText('STANDINGS', lx + 9 * k, ly + 14 * k);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#e0a943';
      ctx.fillText(this.formatTime(shownTime), lx + cardW - 9 * k, ly + 14 * k);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1 * k;
      ctx.beginPath();
      ctx.moveTo(lx + 7 * k, ly + headerH - 1 * k);
      ctx.lineTo(lx + cardW - 7 * k, ly + headerH - 1 * k);
      ctx.stroke();

      const replayT = this.replay.currentTime;
      for (let i = 0; i < maxRows; i++) {
        const b = sorted[i];
        const ry = ly + headerH + i * rowH + rowH * 0.5;
        if (i === 0) {
          ctx.fillStyle = 'rgba(224, 169, 67, 0.1)';
          ctx.fillRect(lx + 4 * k, ry - rowH * 0.44, cardW - 8 * k, rowH * 0.88);
        }

        ctx.textAlign = 'right';
        ctx.font = `700 ${10 * k}px "JetBrains Mono", monospace`;
        ctx.fillStyle = i === 0 ? '#eab308' : i === 1 ? '#cbd5e1' : i === 2 ? '#d97706' : '#7b8392';
        ctx.fillText(`${i + 1}`, lx + 20 * k, ry);

        // Sleek Formula Timing Bar instead of oversized circle
        ctx.fillStyle = b.color || '#ffffff';
        ctx.fillRect(lx + 26 * k, ry - 6 * k, 3 * k, 12 * k);

        ctx.textAlign = 'left';
        ctx.font = `600 ${11 * k}px "Plus Jakarta Sans", Inter, system-ui, sans-serif`;
        ctx.fillStyle = '#f1f0ec';
        ctx.fillText(b.name, lx + 35 * k, ry);

        const isFinishedShown =
          this.raceState === 'REPLAY'
            ? b.finishTime !== null && b.finishTime <= replayT + 0.04
            : b.finished && b.finishTime !== null;

        ctx.textAlign = 'right';
        ctx.font = `600 ${10 * k}px "JetBrains Mono", monospace`;
        if (isFinishedShown) {
          ctx.fillStyle = '#68d391';
          ctx.fillText(`${b.finishTime.toFixed(2)}s`, lx + cardW - 9 * k, ry);
        } else {
          ctx.fillStyle = '#9aa1ac';
          ctx.fillText(`${Math.max(0, b.progressMeters).toFixed(1)}m`, lx + cardW - 9 * k, ry);
        }
      }

      if (sorted.length > maxShown) {
        ctx.font = `500 ${9 * k}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#7b8392';
        ctx.fillText(`+${sorted.length - maxShown} racing`, lx + cardW * 0.5, ly + cardH - 9 * k);
      }
      ctx.restore();
    }

    // 4. Slim Top-Center Finisher Notification Banner (tight to top edge, single-clean presentation)
    if (this.activeFinishBanners.length > 0) {
      anyDrawn = true;
      const boxW = Math.min(w - 460 * k, 410 * k);
      const boxH = 42 * k;
      const gapY = 6 * k;
      const bx = (w - boxW) * 0.5;

      ctx.save();
      for (let i = 0; i < this.activeFinishBanners.length; i++) {
        const bn = this.activeFinishBanners[i];
        const by = 58 * k + i * (boxH + gapY);
        const borderCol =
          bn.rank === 1
            ? 'rgba(224, 169, 67, 0.94)'
            : bn.rank === 2
              ? 'rgba(203, 213, 225, 0.85)'
              : bn.rank === 3
                ? 'rgba(217, 119, 6, 0.85)'
                : 'rgba(110, 168, 224, 0.78)';
        const tagCol =
          bn.rank === 1
            ? '#e0a943'
            : bn.rank === 2
              ? '#e2e8f0'
              : bn.rank === 3
                ? '#f59e0b'
                : '#7dd3fc';

        ctx.fillStyle = 'rgba(13, 16, 22, 0.88)';
        ctx.strokeStyle = borderCol;
        ctx.lineWidth = 1.6 * k;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx, by, boxW, boxH, 7 * k);
        else ctx.rect(bx, by, boxW, boxH);
        ctx.fill();
        ctx.stroke();

        const cy = by + boxH * 0.5;
        ctx.beginPath();
        ctx.arc(bx + 20 * k, cy, 7.5 * k, 0, Math.PI * 2);
        ctx.fillStyle = bn.color || '#ffffff';
        ctx.fill();
        ctx.lineWidth = 1.2 * k;
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.stroke();

        ctx.font = `700 ${13 * k}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = tagCol;
        ctx.fillText(this.formatOrdinal(bn.rank), bx + 36 * k, cy);

        ctx.font = `700 ${15.5 * k}px "Outfit", "Plus Jakarta Sans", system-ui, sans-serif`;
        ctx.fillStyle = '#f4f1e8';
        ctx.fillText(bn.name.toUpperCase(), bx + 84 * k, cy);

        const timeLabel = bn.finishTime !== null ? `${bn.finishTime.toFixed(2)}s` : '';
        const rightTxt = bn.gap ? `${timeLabel} · ${bn.gap}` : timeLabel;
        ctx.font = `600 ${13 * k}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'right';
        ctx.fillStyle = '#68d391';
        ctx.fillText(rightTxt, bx + boxW - 14 * k, cy);
      }
      ctx.restore();
    }

    this.hudOverlayMesh.visible = anyDrawn;
    if (anyDrawn) {
      this.hudOverlayTex.needsUpdate = true;
    }
  }

  stepSimulation(dt) {
    if (this.raceState === 'REPLAY') {
      this.stepReplaySimulation(dt);
      return;
    }

    if (this.raceState === 'COUNTDOWN') {
      this.countdownRemaining -= dt;
      const digit = this.countdownRemaining > 0.6 ? Math.ceil(this.countdownRemaining - 0.4) : 0;
      if (digit !== this.lastCountdownDigit) {
        this.lastCountdownDigit = digit;
        if (digit >= 1 && digit <= 3) {
          this.dom.countdownText.textContent = String(digit);
          this.showCanvasCountdown(String(digit), false);
          this.sound.playCountdown(false);
          this.startLightPods.forEach((pod, idx) => {
            const lit = (digit === 3 && idx === 0) || (digit <= 2 && idx <= 1);
            pod.mesh.material.emissiveIntensity = lit ? 0.95 : 0.04;
          });
        } else if (digit <= 0) {
          this.dom.countdownText.textContent = 'GO!';
          this.showCanvasCountdown('GO!', true);
          this.sound.playCountdown(true);
          this.startLightPods.forEach((pod, idx) => {
            pod.mesh.material.emissiveIntensity = idx === 2 ? 1.15 : 0.04;
          });
          this.raceState = 'RACING';
          this.replay.captureFrame(0, this.balls, this.kinematicHurdles, this.startGate);
          this.syncUiState();
          setTimeout(() => {
            if (this.raceState !== 'COUNTDOWN' && this.countdownMesh) {
              this.countdownMesh.visible = false;
            }
          }, 620);
        }
      }

      this.world.timestep = FIXED_DT;
      this.world.step(this.eventQueue);
      this.eventQueue.drainCollisionEvents(() => {});
      this.syncBallsFromPhysics(false);
      return;
    }

    if (this.raceState !== 'RACING' && this.raceState !== 'FINISHED') {
      this.world.timestep = FIXED_DT;
      this.world.step(this.eventQueue);
      this.eventQueue.drainCollisionEvents(() => {});
      this.syncBallsFromPhysics(false);
      return;
    }

    const scaledDt = Math.min(dt, 0.085) * this.config.speedMultiplier;
    this.physicsAccumulator += scaledDt;

    let substeps = 0;
    while (this.physicsAccumulator >= FIXED_DT && substeps < MAX_SUBSTEPS_PER_FRAME) {
      this.physicsAccumulator -= FIXED_DT;
      substeps++;

      // Capture previous rigid body transform right before the final substep for smooth sub-frame interpolation
      if (this.physicsAccumulator < FIXED_DT) {
        for (let i = 0; i < this.balls.length; i++) {
          const b = this.balls[i];
          const p = b.body.translation();
          const q = b.body.rotation();
          b.prevPos.set(p.x, p.y, p.z);
          b.prevQuat.set(q.x, q.y, q.z, q.w);
        }
      }

      if (this.raceState === 'RACING') {
        this.raceElapsedTime += FIXED_DT;
      }

      if (this.startGate && this.startGate.openProgress < 1) {
        this.startGate.openProgress = Math.min(1, this.startGate.openProgress + FIXED_DT * 3.5);
        const eased = 1 - Math.pow(1 - this.startGate.openProgress, 3);
        this._v1.lerpVectors(this.startGate.closedPos, this.startGate.openPos, eased);
        this.startGate.body.setNextKinematicTranslation(this._v1);
        this.startGate.mesh.position.copy(this._v1);
      }

      this.updateKinematicHurdles(this.raceElapsedTime);

      this.world.timestep = FIXED_DT;
      this.world.step(this.eventQueue);
      this.eventQueue.drainCollisionEvents((h1, h2, started) => {
        if (started) this.handlePhysicsCollision(h1, h2);
      });

      if (this.raceState === 'RACING') {
        this.measureBallProgressAndFinishes(FIXED_DT);
        this.replay.captureFrame(
          this.raceElapsedTime,
          this.balls,
          this.kinematicHurdles,
          this.startGate
        );
      }
    }

    const interpAlpha = substeps > 0 ? THREE.MathUtils.clamp(this.physicsAccumulator / FIXED_DT, 0, 1) : 1;
    this.syncBallsFromPhysics(true, interpAlpha);
  }

  addCamShake(ball, amount) {
    if (!ball) return;
    const isFollowed =
      this.raceState === 'REPLAY' ||
      ((this.cameraMode === 'leader' || this.cameraMode === 'director') && ball.rank === 1);
    if (isFollowed) {
      this.camShake = Math.min(0.42, Math.max(this.camShake, amount));
    }
  }

  triggerLiveDirectorMoment(type, ball) {
    if (this.cameraMode !== 'director' || this.raceState !== 'RACING') return;
    const nowSec = performance.now() * 0.001;
    if (nowSec - this.directorState.cutAt < 2.4) return;
    this.directorState.cutAt = nowSec;
    this.directorState.liveEventType = type;
    this.directorState.liveBallId = ball?.id ?? 0;

    if (type === 'hurdle_hit') {
      this.setDirectorShot('Hurdle Action');
      this.directorState.hasFixedPos = false;
    } else if (type === 'pack_clash') {
      this.setDirectorShot('Reverse Pack');
      this.directorState.hasFixedPos = false;
    } else if (type === 'big_air' || type === 'lead_change') {
      this.setDirectorShot('Bumper Duel');
      this.directorState.hasFixedPos = false;
    }
  }

  handlePhysicsCollision(h1, h2) {
    if (this.raceState !== 'RACING' && this.raceState !== 'FINISHED') return;
    const m1 = this.colliderMeta.get(h1);
    const m2 = this.colliderMeta.get(h2);
    if (!m1 || !m2) return;

    let ballMeta = null;
    let otherMeta = null;
    if (m1.kind === 'ball' && m2.kind === 'ball') {
      const b1 = this.balls[m1.ballId];
      const b2 = this.balls[m2.ballId];
      if (!b1 || !b2) return;
      const v1 = b1.body.linvel();
      const v2 = b2.body.linvel();
      const relSpeed = Math.hypot(v1.x - v2.x, v1.y - v2.y, v1.z - v2.z);
      if (relSpeed > 1.1) {
        const s = Math.min(1, relSpeed / 14);
        this.sound.playMarbleClack(s);
        if (relSpeed > 4.8) {
          this.crowdExcitement = Math.min(1, this.crowdExcitement + 0.14);
        }
        if (this.raceState === 'RACING') {
          this.replay.recordAudioCue(this.raceElapsedTime, 'clack', s);
          if (relSpeed > 5.0) {
            const topPackBonus = b1.rank <= 4 || b2.rank <= 4 ? 0.25 : 0;
            const intensity = THREE.MathUtils.clamp(relSpeed / 13 + topPackBonus, 0.4, 1.3);
            this._v4.lerpVectors(b1.worldPos, b2.worldPos, 0.5);
            this.replay.recordEvent({
              time: this.raceElapsedTime,
              type: 'pack_clash',
              label: topPackBonus > 0 ? 'Lead Battle Clash' : 'Pack Collision',
              category: 'clash',
              intensity,
              primaryBallId: b1.rank <= b2.rank ? b1.id : b2.id,
              secondaryBallId: b1.rank <= b2.rank ? b2.id : b1.id,
              s: (b1.progressMeters + b2.progressMeters) * 0.5,
              worldPos: this._v4,
            });
            if (intensity >= 0.86) {
              this.triggerLiveDirectorMoment('pack_clash', b1.rank <= b2.rank ? b1 : b2);
            }
          }
        }
        if (relSpeed > 7.0) {
          this.addCamShake(b1, 0.12);
          this.addCamShake(b2, 0.12);
        }
      }
      return;
    }

    if (m1.kind === 'ball') {
      ballMeta = m1;
      otherMeta = m2;
    } else if (m2.kind === 'ball') {
      ballMeta = m2;
      otherMeta = m1;
    } else {
      return;
    }

    const ball = this.balls[ballMeta.ballId];
    if (!ball) return;
    const lv = ball.body.linvel();
    const speed = Math.hypot(lv.x, lv.y, lv.z);

    if (otherMeta.kind === 'booster') {
      if (this.raceElapsedTime - ball.lastBoostAt > 0.7) {
        ball.lastBoostAt = this.raceElapsedTime;
        const boost = 7.4 * this.config.speedMultiplier;
        ball.body.setLinvel(
          {
            x: lv.x + otherMeta.dir.x * boost,
            y: lv.y + otherMeta.dir.y * boost + 0.12,
            z: lv.z + otherMeta.dir.z * boost,
          },
          true
        );
        this.sound.playHurdleHit('booster', 0.95);
        if (this.raceState === 'RACING') {
          this.replay.recordAudioCue(this.raceElapsedTime, 'hurdle', 0.95, 'booster');
          this.replay.recordEvent({
            time: this.raceElapsedTime,
            type: 'booster',
            label: `${ball.name} Turbo Surge`,
            category: 'clash',
            intensity: 0.76 + (ball.rank <= 3 ? 0.2 : 0),
            primaryBallId: ball.id,
            s: ball.progressMeters,
            worldPos: ball.worldPos,
          });
        }
        this.addCamShake(ball, 0.28);
      }
    } else if (otherMeta.kind === 'hurdle') {
      if (speed > 0.75) {
        const s = Math.min(1, speed / 14);
        this.sound.playHurdleHit(otherMeta.subType, s);
        if (this.raceState === 'RACING') {
          this.replay.recordAudioCue(this.raceElapsedTime, 'hurdle', s, otherMeta.subType);
          if (speed > 4.2 || otherMeta.subType === 'jump_ramp') {
            const labelMap = {
              rotating_bar: 'Rotating Bar Strike',
              moving_gate: 'Moving Gate Impact',
              spinning_wheel: 'Spinning Wheel Hit',
              moving_platform: 'Shuttle Deflection',
              jump_ramp: 'Ramp Launch',
              narrow_passage: 'Chicane Squeeze',
              speed_bump: 'Rumble Crest',
            };
            const isAir = otherMeta.subType === 'jump_ramp';
            const intensity =
              THREE.MathUtils.clamp(speed / 13, 0.45, 1.15) +
              (isAir ? 0.24 : 0) +
              (ball.rank <= 3 ? 0.18 : 0);
            this.replay.recordEvent({
              time: this.raceElapsedTime,
              type: isAir ? 'big_air' : 'hurdle_hit',
              label: `${ball.name} ${labelMap[otherMeta.subType] || 'Obstacle Hit'}`,
              category: isAir ? 'air' : 'clash',
              intensity,
              primaryBallId: ball.id,
              s: ball.progressMeters,
              worldPos: ball.worldPos,
              subType: otherMeta.subType,
            });
            if (intensity >= 0.85) {
              this.triggerLiveDirectorMoment(isAir ? 'big_air' : 'hurdle_hit', ball);
            }
          }
        }
        this.addCamShake(ball, Math.min(0.24, speed * 0.015));
      }
    } else if (otherMeta.kind === 'wall') {
      if (speed > 1.8) {
        const s = Math.min(1, speed / 18);
        this.sound.playWallHit(s);
        if (this.raceState === 'RACING') {
          this.replay.recordAudioCue(this.raceElapsedTime, 'wall', s);
          if (speed > 10.5) {
            this.replay.recordEvent({
              time: this.raceElapsedTime,
              type: 'wall_slam',
              label: `${ball.name} Barrier Slam`,
              category: 'clash',
              intensity: THREE.MathUtils.clamp(speed / 16 + (ball.rank <= 3 ? 0.15 : 0), 0.55, 1.1),
              primaryBallId: ball.id,
              s: ball.progressMeters,
              worldPos: ball.worldPos,
            });
          }
        }
        if (speed > 8.0) this.addCamShake(ball, 0.1);
      }
    } else if (otherMeta.kind === 'track') {
      // Only play landing thud / whoosh if ball drops hard onto track surface
      if (Math.abs(lv.y) > 4.2) {
        const s = Math.min(1, Math.abs(lv.y) / 14);
        this.sound.playWallHit(s);
        if (this.raceState === 'RACING') {
          this.replay.recordAudioCue(this.raceElapsedTime, 'wall', s);
        }
        if (Math.abs(lv.y) > 6.2) {
          this.sound.playWhoosh(0.65);
          if (this.raceState === 'RACING') {
            this.replay.recordAudioCue(this.raceElapsedTime, 'whoosh', 0.65);
          }
          this.addCamShake(ball, 0.16);
        }
      }
    }
  }

  updateKinematicHurdles(simTime) {
    for (const h of this.kinematicHurdles) {
      if (h.type === 'rotating_bar' || h.type === 'spinning_wheel') {
        const angle = simTime * h.speed + h.phase;
        this._q1.setFromAxisAngle(h.axis, angle).multiply(h.baseQuat);
        h.body.setNextKinematicRotation(this._q1);
        h.mesh.quaternion.copy(this._q1);
      } else if (h.type === 'moving_gate' || h.type === 'moving_platform') {
        const offset = Math.sin(simTime * h.speed + h.phase) * h.amp;
        this._v1.copy(h.basePos).addScaledVector(h.R, offset);
        h.body.setNextKinematicTranslation(this._v1);
        h.mesh.position.copy(this._v1);
      }
    }
  }

  respawnBallAtCheckpoint(ball, reason, nearS = null) {
    const L = this.config.distanceMeters;
    const halfW = this.config.trackWidth * 0.5;
    const fallbackS = Math.max(ball.lastCheckpointS + 0.8, 1.0);
    let targetS =
      nearS !== null
        ? THREE.MathUtils.clamp(Math.max(ball.lastCheckpointS, nearS - 1.6), 0.8, Math.max(2.0, L - 3.5))
        : THREE.MathUtils.clamp(fallbackS, 1.0, Math.max(2.0, L - 3.0));

    // Avoid dropping directly inside any hurdle
    for (let attempt = 0; attempt < 4; attempt++) {
      const collidesHurdle = this.hurdleStationsS.some((hs) => Math.abs(hs - targetS) < 2.2);
      if (!collidesHurdle) break;
      targetS = THREE.MathUtils.clamp(targetS + 2.4, 1.0, Math.max(2.0, L - 3.0));
    }

    const st = getStationAtS(this.trackData, targetS);
    const maxSpread = Math.max(0.4, halfW - 1.25);
    const latOffset = THREE.MathUtils.clamp(
      ((ball.id % 5) - 2) * 0.55 + (Math.random() - 0.5) * 0.65,
      -maxSpread,
      maxSpread
    );

    const spawnPos = st.pos
      .clone()
      .addScaledVector(st.R, latOffset)
      .addScaledVector(st.U, BALL_RADIUS + 0.35);

    const forwardSpeed = 3.6 * this.config.speedMultiplier;
    ball.body.setTranslation({ x: spawnPos.x, y: spawnPos.y, z: spawnPos.z }, true);
    ball.body.setLinvel(
      { x: st.T.x * forwardSpeed, y: st.T.y * forwardSpeed, z: st.T.z * forwardSpeed },
      true
    );
    ball.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    ball.body.wakeUp();

    ball.worldPos.copy(spawnPos);
    ball.prevPos.copy(spawnPos);
    ball.currPos.copy(spawnPos);
    ball.mesh.position.copy(spawnPos);
    ball.stationIdx = Math.max(
      0,
      Math.min(
        this.trackData.stations.length - 1,
        Math.round((targetS - this.trackData.sStart) / this.trackData.ds)
      )
    );
    ball.progressMeters = targetS;
    ball.prevProgressMeters = targetS;
    ball.stuckTimer = 0;
    ball.prevSpeed = forwardSpeed;
    ball.currentSpeed = forwardSpeed;

    this.sound.playRespawn();
  }

  measureBallProgressAndFinishes(substepDt) {
    const { stations, sStart, ds, bounds, checkpoints } = this.trackData;
    const finishS = this.config.distanceMeters;
    const halfW = this.config.trackWidth * 0.5;
    const canRescueStuck =
      this.raceElapsedTime > 1.6 && (!this.startGate || this.startGate.openProgress >= 0.85);

    for (const ball of this.balls) {
      const p = ball.body.translation();
      ball.worldPos.set(p.x, p.y, p.z);

      let bestIdx = ball.stationIdx;
      let bestDistSq = Infinity;
      const searchMin = Math.max(0, ball.stationIdx - 14);
      const searchMax = Math.min(stations.length - 1, ball.stationIdx + 28);

      for (let idx = searchMin; idx <= searchMax; idx++) {
        const sp = stations[idx].pos;
        const dx = p.x - sp.x;
        const dy = p.y - sp.y;
        const dz = p.z - sp.z;
        const dSq = dx * dx + dy * dy + dz * dz;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          bestIdx = idx;
        }
      }

      if (bestDistSq > 49) {
        for (let idx = 0; idx < stations.length; idx++) {
          const sp = stations[idx].pos;
          const dx = p.x - sp.x;
          const dy = p.y - sp.y;
          const dz = p.z - sp.z;
          const dSq = dx * dx + dy * dy + dz * dz;
          if (dSq < bestDistSq) {
            bestDistSq = dSq;
            bestIdx = idx;
          }
        }
      }

      ball.stationIdx = bestIdx;
      const st = stations[bestIdx];
      this._v1.set(p.x - st.pos.x, p.y - st.pos.y, p.z - st.pos.z);
      const alongOffset = this._v1.dot(st.T);
      const latOffset = this._v1.dot(st.R);
      const vertOffset = this._v1.dot(st.U);
      const exactS = sStart + bestIdx * ds + alongOffset;

      ball.prevProgressMeters = ball.progressMeters;
      ball.progressMeters = Math.max(0, exactS);

      // Record dramatic mid-air jumps for Replay Director
      if (vertOffset > 1.15 && ball.currentSpeed > 6.5 && exactS > 4 && exactS < finishS - 2) {
        this.replay.recordEvent({
          time: this.raceElapsedTime,
          type: 'big_air',
          label: `${ball.name} Big Air Flight`,
          category: 'air',
          intensity: THREE.MathUtils.clamp(0.72 + vertOffset * 0.2 + (ball.rank <= 3 ? 0.18 : 0), 0.72, 1.35),
          primaryBallId: ball.id,
          s: exactS,
          worldPos: ball.worldPos,
        });
      }

      // Immediate strict out-of-track containment recovery (zero roaming outside walls)
      const outsideTrack =
        vertOffset < -0.45 ||
        Math.abs(latOffset) > halfW + 0.18 ||
        p.y < bounds.minY - 1.4;

      if (outsideTrack) {
        this.respawnBallAtCheckpoint(ball, 'fell', Math.max(1.0, exactS));
        continue;
      }

      // Track silent recovery sectors for stuck-ball rescue (no intrusive visual checkpoints)
      for (const cpS of checkpoints) {
        if (ball.progressMeters >= cpS && cpS > ball.lastCheckpointS) {
          ball.lastCheckpointS = cpS;
        }
      }

      // Check stuck behind obstacle; respawn near checkpoint
      if (!ball.finished && canRescueStuck) {
        const lv = ball.body.linvel();
        const speed = Math.hypot(lv.x, lv.y, lv.z);
        const forwardDelta = ball.progressMeters - ball.prevProgressMeters;
        if (speed < 0.9 || forwardDelta < substepDt * 0.22) {
          ball.stuckTimer += substepDt;
          if (ball.stuckTimer >= 2.25) {
            this.respawnBallAtCheckpoint(ball, 'stuck', Math.max(1.0, exactS));
            continue;
          }
        } else {
          ball.stuckTimer = Math.max(0, ball.stuckTimer - substepDt * 1.8);
        }
      }

      // Detect actual finish-line crossing
      if (!ball.finished && exactS >= finishS) {
        ball.finished = true;
        this.finishedCount++;
        ball.finishRank = this.finishedCount;

        const prevS = ball.prevProgressMeters;
        const deltaS = exactS - prevS;
        const frac = deltaS > 0.0001 ? THREE.MathUtils.clamp((finishS - prevS) / deltaS, 0, 1) : 1;
        ball.finishTime = Math.max(0.01, this.raceElapsedTime - (1 - frac) * substepDt);

        const podSlot = this.podiumSlots.find((slot) => slot.rank === ball.finishRank);
        if (podSlot) {
          setRichMarbleColor(podSlot.mesh.material.color, ball.color);
          podSlot.mesh.visible = true;
          if (podSlot.haloRing) podSlot.haloRing.visible = true;
        }

        if (ball.finishRank <= 3) {
          this.crowdExcitement = 1.0;
          this.sound.playCrowdCheerSpike(ball.finishRank === 1 ? 1.0 : 0.72);
        } else {
          this.sound.playCheckpointChime();
        }

        const firstWinner = this.balls.find((b) => b.finishRank === 1);
        const winnerTime = firstWinner?.finishTime ?? (ball.finishRank === 1 ? ball.finishTime : null);
        this.showWinnerToast(ball, winnerTime);
        this.pushFinishBanner(ball, winnerTime);

        if (ball.finishRank === 1 && !this.winnerAnnounced) {
          this.winnerAnnounced = true;
          this.sound.playWin();
          this.replay.recordAudioCue(this.raceElapsedTime, 'win', 1.0);
          this.replay.recordEvent({
            time: this.raceElapsedTime,
            type: 'finish',
            label: `${ball.name} Wins Photo Finish`,
            category: 'finish',
            intensity: 1.55,
            primaryBallId: ball.id,
            s: finishS,
            worldPos: ball.worldPos,
          });
          this.dom.btnViewResults.classList.remove('hidden');
          if (this.dom.btnCinematicReplay) {
            this.dom.btnCinematicReplay.classList.remove('hidden');
          }
        }
      }
    }

    const sorted = [...this.balls].sort((a, b) => {
      if (a.finished && b.finished) return a.finishRank - b.finishRank;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.progressMeters - a.progressMeters;
    });
    for (let r = 0; r < sorted.length; r++) {
      sorted[r].rank = r + 1;
    }

    // Dynamic crowd excitement driven by ball density at hurdles/finish & tight packs
    if (sorted.length > 0) {
      let left = 0;
      let maxCluster = 1;
      let maxZoneCluster = 1;
      for (let right = 0; right < sorted.length; right++) {
        if (sorted[right].finished) continue;
        while (
          left < right &&
          (sorted[left].finished || sorted[left].progressMeters - sorted[right].progressMeters > 4.6)
        ) {
          left++;
        }
        const winSize = right - left + 1;
        if (winSize > maxCluster) maxCluster = winSize;
        const sMid = sorted[right].progressMeters;
        let nearCritical = sMid >= finishS - 20;
        if (!nearCritical) {
          for (let hIdx = 0; hIdx < this.hurdleStationsS.length; hIdx++) {
            if (Math.abs(this.hurdleStationsS[hIdx] - sMid) < 4.5) {
              nearCritical = true;
              break;
            }
          }
        }
        if (nearCritical && winSize > maxZoneCluster) {
          maxZoneCluster = winSize;
        }
      }
      const packRatio = THREE.MathUtils.clamp((maxCluster - 1) / Math.max(2, sorted.length * 0.55), 0, 1);
      const zoneRatio = THREE.MathUtils.clamp((maxZoneCluster - 1) / Math.max(2, sorted.length * 0.42), 0, 1);
      const leadSprint = sorted[0].progressMeters >= finishS - 18 && !sorted[0].finished ? 0.34 : 0;
      const densityExc = THREE.MathUtils.clamp(packRatio * 0.5 + zoneRatio * 0.55 + leadSprint, 0, 1);
      this.crowdExcitement = Math.max(this.crowdExcitement, densityExc);
    }

    // Track real overtakes / lead changes for Cinematic Replay Highlights
    if (sorted.length > 0 && !sorted[0].finished) {
      const newLeader = sorted[0];
      if (
        newLeader.id !== this.lastLeaderId &&
        newLeader.progressMeters > 4.5 &&
        this.raceElapsedTime > 1.2
      ) {
        const oldLeaderId = this.lastLeaderId;
        this.lastLeaderId = newLeader.id;
        this.crowdExcitement = Math.min(1, this.crowdExcitement + 0.44);
        this.sound.playCrowdCheerSpike(0.75);
        this.replay.recordEvent({
          time: this.raceElapsedTime,
          type: 'lead_change',
          label: `${newLeader.name} Takes the Lead!`,
          category: 'overtake',
          intensity: 1.28,
          primaryBallId: newLeader.id,
          secondaryBallId: oldLeaderId,
          s: newLeader.progressMeters,
          worldPos: newLeader.worldPos,
        });
        this.triggerLiveDirectorMoment('lead_change', newLeader);
      } else {
        this.lastLeaderId = newLeader.id;
      }
    }

    if (this.finishedCount >= this.balls.length && this.raceState === 'RACING') {
      this.raceState = 'FINISHED';
      this.crowdExcitement = 1.0;
      this.sound.playCrowdCheerSpike(1.0);
      this.replay.captureFrame(
        this.raceElapsedTime,
        this.balls,
        this.kinematicHurdles,
        this.startGate
      );
      this.showCanvasEndLeaderboard(sorted);
      this.syncUiState();
      if (this.recorder.isRecording) {
        this.gameplayEndHold = 2.8;
      } else {
        this.finalizeRecordingAndOpenResults();
      }
    }
  }

  async finalizeRecordingAndOpenResults() {
    this.gameplayEndHold = 0;
    if (this.recorder.isRecording) {
      this.dom.hudRecBadge.classList.add('hidden');
      this.recordedVideoInfo = await this.recorder.stop();
    }
    this.hideCanvasOverlay();
    if (!this.resultsDismissed) {
      this.openResultsModal();
    }
  }

  syncBallsFromPhysics(allowEffects, interpAlpha = 1) {
    let trackedSpeed = 0;
    const useInterp = allowEffects && interpAlpha < 0.999 && this.raceState === 'RACING';
    for (let i = 0; i < this.balls.length; i++) {
      const ball = this.balls[i];
      const t = ball.body.translation();
      const r = ball.body.rotation();
      const lv = ball.body.linvel();
      if (!Number.isFinite(t.x) || !Number.isFinite(t.y) || !Number.isFinite(t.z)) {
        this.respawnBallAtCheckpoint(ball, 'fell');
        continue;
      }
      const speed = Math.hypot(lv.x, lv.y, lv.z);

      ball.prevSpeed = ball.currentSpeed;
      ball.currentSpeed = Number.isFinite(speed) ? speed : 0;
      if (ball.currentSpeed > ball.peakSpeed) {
        ball.peakSpeed = ball.currentSpeed;
      }
      if (ball.rank === 1) {
        trackedSpeed = ball.currentSpeed;
      }

      ball.currPos.set(t.x, t.y, t.z);
      ball.currQuat.set(r.x, r.y, r.z, r.w);
      if (useInterp && ball.prevPos.distanceToSquared(ball.currPos) < 4.0) {
        ball.mesh.position.lerpVectors(ball.prevPos, ball.currPos, interpAlpha);
        ball.mesh.quaternion.slerpQuaternions(ball.prevQuat, ball.currQuat, interpAlpha);
      } else {
        ball.mesh.position.copy(ball.currPos);
        ball.mesh.quaternion.copy(ball.currQuat);
      }
      ball.worldPos.copy(ball.mesh.position);

      // Ground contact shadow directly beneath marble
      if (this.contactShadowMesh && i < 50) {
        const st = this.trackData?.stations?.[ball.stationIdx];
        const trackY = st ? st.pos.y + 0.028 : ball.mesh.position.y - BALL_RADIUS + 0.03;
        const clearance = Math.max(0, ball.mesh.position.y - BALL_RADIUS - trackY);
        const shadowScale = Math.max(0.25, 1.0 - clearance * 0.16);
        this._dummy.position.set(
          ball.mesh.position.x,
          Math.min(ball.mesh.position.y - BALL_RADIUS + 0.035, trackY),
          ball.mesh.position.z
        );
        this._dummy.rotation.set(0, 0, 0);
        this._dummy.scale.set(shadowScale, 1, shadowScale);
        this._dummy.updateMatrix();
        this.contactShadowMesh.setMatrixAt(i, this._dummy.matrix);
      }
    }

    if (this.contactShadowMesh) {
      if (this.balls.length < 50) {
        this._dummy.scale.set(0, 0, 0);
        this._dummy.updateMatrix();
        for (let i = this.balls.length; i < 50; i++) {
          this.contactShadowMesh.setMatrixAt(i, this._dummy.matrix);
        }
      }
      this.contactShadowMesh.instanceMatrix.needsUpdate = true;
    }

    this.sound.updateRollingBed(trackedSpeed, this.raceState === 'RACING' && allowEffects);
  }

  // ==========================================================================
  // Cinematic Replay Playback & Intense-Moment Timeline Control
  // ==========================================================================
  formatReplayShortTime(seconds) {
    const clamped = Math.max(0, seconds || 0);
    const mins = Math.floor(clamped / 60);
    const secs = Math.floor(clamped % 60);
    const tenths = Math.floor((clamped % 1) * 10);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
  }

  restoreReplayRecordingOverrides() {
    if (this._savedReplayState) {
      this.replay.autoDirector = this._savedReplayState.autoDirector;
      this.replay.autoSlowMo = this._savedReplayState.autoSlowMo;
      this.replay.playbackSpeed = this._savedReplayState.playbackSpeed;
      this._savedReplayState = null;
    }
    this.replayRecordTarget = 'cinematic';
  }

  enterReplayMode(startAtTime = 0, { autoRecord = false, recordMode = 'cinematic' } = {}) {
    if (!this.replay.hasData()) return;
    this.sound.ensureContext(true);
    this.sound.updateRollingBed(0, false);

    if (this.dom.replayVideoPlayer) {
      this.dom.replayVideoPlayer.pause();
    }
    this.dom.resultsModal.classList.add('hidden');
    this.dom.countdownOverlay.classList.add('hidden');
    this.dom.winnerToast.classList.add('hidden');

    if (this.raceState !== 'REPLAY') {
      this.preReplayCameraMode = this.cameraMode;
    }

    this.restoreReplayRecordingOverrides();
    this.replay.compileDirectorSheet(this.raceElapsedTime, this.balls);
    this.replay.isPlaying = true;
    this.replay.activeShotIdx = -1;
    this.cinematicEndHold = 0;
    this.gameplayReplayEndHold = 0;
    this.lastReplayWinnerBannerId = -1;
    this.replayAnnouncedBallIds = new Set();
    this.activeFinishBanners = [];
    this.endLeaderboardActive = false;
    this.endLeaderboardSorted = [];
    this.hideCanvasOverlay();
    this.raceState = 'REPLAY';

    if (autoRecord && recordMode === 'gameplay') {
      this.replayRecordTarget = 'gameplay';
      this._savedReplayState = {
        autoDirector: this.replay.autoDirector,
        autoSlowMo: this.replay.autoSlowMo,
        playbackSpeed: this.replay.playbackSpeed,
      };
      this.replay.autoDirector = false;
      this.replay.autoSlowMo = false;
      this.replay.playbackSpeed = 1.0;
      if (this.preReplayCameraMode && this.preReplayCameraMode !== 'free') {
        this.cameraMode = this.preReplayCameraMode;
      } else {
        this.cameraMode = 'director';
      }
      this.startGameplayReplayRecording();
    } else if (autoRecord) {
      this.replayRecordTarget = 'cinematic';
      this.replay.autoDirector = true;
      this.startCinematicRecording();
    } else if (
      startAtTime === 0 &&
      !this.recordedCinematicInfo &&
      this.replay.autoDirector &&
      !this.recorder.isRecording
    ) {
      this.replayRecordTarget = 'cinematic';
      this.startCinematicRecording();
    }

    // Give full uncluttered screen to the replay / export pass
    this.setConfigDrawerOpen(false);
    this.renderReplayMarkers();
    this.seekReplay(startAtTime);
    this.syncUiState();
    this.renderBroadcastHudCanvas(true);
  }

  startGameplayReplayRecording() {
    if (!this.replay.hasData() || this.cinematicRecorder.isRecording) return false;
    this.sound.ensureContext(true);
    const recKey = QUALITY_PRESETS[this.recordQualityPreset] ? this.recordQualityPreset : 'standard';
    const activeQualityCfg = QUALITY_PRESETS[recKey] || QUALITY_PRESETS.standard;
    this.isRecordingGameplayPass = true;
    this.applyEffectiveRenderQuality();
    const ok = this.recorder.start(activeQualityCfg);
    if (!ok) {
      this.isRecordingGameplayPass = false;
      this.applyEffectiveRenderQuality();
    }
    this.gameplayReplayEndHold = 0;
    this.dom.hudRecBadge.classList.toggle('hidden', !ok);
    this.syncUiState();
    return ok;
  }

  async finishGameplayReplayRecording() {
    this.gameplayReplayEndHold = 0;
    const wasRec = this.isRecordingGameplayPass;
    this.isRecordingGameplayPass = false;
    if (this.recorder.isRecording) {
      this.dom.hudRecBadge.classList.add('hidden');
      this.recordedVideoInfo = await this.recorder.stop();
      this.recordedVideoQuality = QUALITY_PRESETS[this.recordQualityPreset]
        ? this.recordQualityPreset
        : 'standard';
    }
    this.applyEffectiveRenderQuality();
    this.hideCanvasOverlay();
    this.restoreReplayRecordingOverrides();
    if (wasRec && this.raceState === 'REPLAY') {
      this.exitReplayMode(true);
    } else {
      this.syncUiState();
    }
  }

  startCinematicRecording() {
    if (!this.replay.hasData() || this.recorder.isRecording) return false;
    this.sound.ensureContext(true);
    const recKey = QUALITY_PRESETS[this.recordQualityPreset] ? this.recordQualityPreset : 'standard';
    const activeQualityCfg = QUALITY_PRESETS[recKey] || QUALITY_PRESETS.standard;
    this.isRecordingCinematic = true;
    this.applyEffectiveRenderQuality();
    const ok = this.cinematicRecorder.start(activeQualityCfg);
    if (!ok) {
      this.isRecordingCinematic = false;
      this.applyEffectiveRenderQuality();
    }
    this.cinematicEndHold = 0;
    this.dom.hudRecBadge.classList.toggle('hidden', !ok);
    this.syncUiState();
    return ok;
  }

  async finishCinematicRecording() {
    this.cinematicEndHold = 0;
    const wasRec = this.isRecordingCinematic;
    this.isRecordingCinematic = false;
    if (this.cinematicRecorder.isRecording) {
      this.dom.hudRecBadge.classList.add('hidden');
      this.recordedCinematicInfo = await this.cinematicRecorder.stop();
      this.recordedCinematicQuality = QUALITY_PRESETS[this.recordQualityPreset]
        ? this.recordQualityPreset
        : 'standard';
    }
    this.applyEffectiveRenderQuality();
    this.hideCanvasOverlay();
    if (wasRec && this.raceState === 'REPLAY') {
      this.exitReplayMode(true);
    } else {
      this.syncUiState();
    }
  }

  exitReplayMode(openResults = false) {
    if (this.raceState !== 'REPLAY') return;
    if (this.cinematicRecorder.isRecording) {
      this.cinematicRecorder.discard();
    }
    if (this.isRecordingGameplayPass && this.recorder.isRecording) {
      this.recorder.discard();
    }
    this.isRecordingCinematic = false;
    this.isRecordingGameplayPass = false;
    this.cinematicEndHold = 0;
    this.gameplayReplayEndHold = 0;
    this.restoreReplayRecordingOverrides();
    this.applyEffectiveRenderQuality();
    this.dom.hudRecBadge.classList.add('hidden');
    this.hideCanvasOverlay();

    this.sound.updateRollingBed(0, false);
    this.sound.updateCrowdExcitement(0, false);
    this.raceState = this.winnerAnnounced || this.finishedCount > 0 ? 'FINISHED' : 'READY';
    this.cameraMode = this.preReplayCameraMode || 'overview';
    this.replay.isPlaying = false;
    this.replay.activeShotIdx = -1;
    this.camShake = 0;
    this.camBankRoll = 0;
    this.directorState.justCut = true;

    if (this.replay.hasData()) {
      this.applyReplayFrameAtTime(this.replay.totalDuration);
    }

    this.syncUiState();
    this.updateTelemetryHud();
    this.updateLeaderboard(false);

    if (openResults && this.winnerAnnounced) {
      this.openResultsModal();
    }
  }

  renderReplayMarkers() {
    if (!this.dom.replayMarkers) return;
    this.dom.replayMarkers.innerHTML = '';
    const dur = Math.max(0.5, this.replay.totalDuration);
    for (const hl of this.replay.highlights) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `replay-marker type-${hl.category || 'clash'}`;
      const pct = THREE.MathUtils.clamp((hl.time / dur) * 100, 1, 99);
      btn.style.left = `${pct}%`;
      btn.title = `${hl.label} (${this.formatReplayShortTime(hl.time)})`;
      btn.setAttribute('aria-label', `${hl.label} at ${this.formatReplayShortTime(hl.time)}`);
      btn.addEventListener('pointerdown', (e) => e.stopPropagation());
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.replay.isPlaying = true;
        this.seekReplay(Math.max(0, hl.time - 0.65));
        this.syncUiState();
      });
      this.dom.replayMarkers.appendChild(btn);
    }
  }

  playReplayAudioCue(cue) {
    if (!this.sound.enabled) return;
    if (cue.kind === 'clack') {
      this.sound.playMarbleClack(cue.intensity);
      this.crowdExcitement = Math.min(1, this.crowdExcitement + 0.14);
    } else if (cue.kind === 'hurdle') {
      this.sound.playHurdleHit(cue.subType || 'rotating_bar', cue.intensity);
      this.crowdExcitement = Math.min(1, this.crowdExcitement + 0.22);
    } else if (cue.kind === 'wall') {
      this.sound.playWallHit(cue.intensity);
    } else if (cue.kind === 'whoosh') {
      this.sound.playWhoosh(cue.intensity);
    } else if (cue.kind === 'win') {
      this.sound.playWin();
      this.crowdExcitement = 1.0;
      this.sound.playCrowdCheerSpike(1.0);
    }
  }

  stepReplaySimulation(dt) {
    if (!this.replay.hasData()) return;
    const t = this.replay.currentTime;
    const shotIdx = this.replay.getShotIndexAt(t);
    const shot = this.replay.shots[shotIdx];
    const inSlowMo = Boolean(
      this.replay.autoSlowMo &&
        shot &&
        shot.slowMoStart >= 0 &&
        t >= shot.slowMoStart &&
        t <= shot.slowMoEnd
    );

    if (!this.replay.isPlaying) {
      this.applyReplayFrameAtTime(t);
      this.sound.updateRollingBed(0, false);
      this.updateReplayHud(inSlowMo);
      return;
    }

    const slowFactor = inSlowMo ? 0.36 : 1.0;
    const prevT = t;
    let nextT = prevT + dt * this.replay.playbackSpeed * slowFactor;
    const reachedEnd = nextT >= this.replay.totalDuration;
    if (reachedEnd) {
      nextT = this.replay.totalDuration;
      this.replay.isPlaying = false;
      this.syncUiState();
    }

    // Trigger captured Web Audio SFX synchronized with replay timeline
    let cuesPlayed = 0;
    for (let i = 0; i < this.replay.audioCues.length; i++) {
      const cue = this.replay.audioCues[i];
      if (cue.time > this.replay.prevTimeForAudio && cue.time <= nextT) {
        this.playReplayAudioCue(cue);
        cuesPlayed++;
        if (cuesPlayed >= 3) break;
      }
    }
    this.replay.prevTimeForAudio = nextT;
    this.replay.currentTime = nextT;

    this.applyReplayFrameAtTime(nextT);
    this.updateReplayHud(inSlowMo);

    // Trigger per-ball finisher notification banner as each marble crosses the line during replay
    const winnerBall = this.balls.find((b) => b.finishRank === 1);
    const winnerTime = winnerBall?.finishTime ?? null;
    const orderedFinishers = this.balls
      .filter((b) => b.finishTime !== null && b.finishTime <= nextT + 0.04)
      .sort((a, b) => (a.finishRank || 999) - (b.finishRank || 999));

    for (const fb of orderedFinishers) {
      if (!this.replayAnnouncedBallIds.has(fb.id)) {
        this.replayAnnouncedBallIds.add(fb.id);
        if (!reachedEnd) {
          this.pushFinishBanner(fb, winnerTime);
          if (fb.finishRank && fb.finishRank <= 3) {
            this.crowdExcitement = 1.0;
            this.sound.playCrowdCheerSpike(fb.finishRank === 1 ? 1.0 : 0.72);
          } else {
            this.sound.playCheckpointChime();
          }
        }
      }
    }

    if (reachedEnd) {
      const sorted = [...this.balls].sort((a, b) => a.rank - b.rank);
      this.crowdExcitement = 1.0;
      this.sound.playCrowdCheerSpike(0.95);
      this.activeFinishBanners = [];
      this.showCanvasEndLeaderboard(sorted);
      if (this.isRecordingGameplayPass && this.recorder.isRecording) {
        this.gameplayReplayEndHold = 2.8;
      } else if (this.isRecordingCinematic && this.cinematicRecorder.isRecording) {
        this.cinematicEndHold = 2.8;
      }
    }
  }

  applyReplayFrameAtTime(t) {
    const frames = this.replay.frames;
    if (frames.length === 0 || this.balls.length === 0) return;

    const clampedT = THREE.MathUtils.clamp(t, 0, this.replay.totalDuration);
    const idx0 = this.replay.findFrameIndex(clampedT);
    const idx1 = Math.min(frames.length - 1, idx0 + 1);
    const f0 = frames[idx0];
    const f1 = frames[idx1];
    const span = f1.t - f0.t;
    const alpha = span > 1e-5 ? THREE.MathUtils.clamp((clampedT - f0.t) / span, 0, 1) : 0;

    const n = Math.min(this.balls.length, this.replay.ballCount);
    const stations = this.trackData?.stations;
    const sStart = this.trackData?.sStart ?? 0;
    const ds = this.trackData?.ds ?? 0.5;
    let leaderSpeed = 0;

    for (let i = 0; i < n; i++) {
      const ball = this.balls[i];
      const off = i * 8;
      this._v1.set(f0.ballData[off], f0.ballData[off + 1], f0.ballData[off + 2]);
      this._v2.set(f1.ballData[off], f1.ballData[off + 1], f1.ballData[off + 2]);

      if (this._v1.distanceToSquared(this._v2) < 9.0) {
        ball.currPos.lerpVectors(this._v1, this._v2, alpha);
      } else {
        ball.currPos.copy(alpha < 0.5 ? this._v1 : this._v2);
      }

      this._q1.set(
        f0.ballData[off + 3],
        f0.ballData[off + 4],
        f0.ballData[off + 5],
        f0.ballData[off + 6]
      );
      this._q2.set(
        f1.ballData[off + 3],
        f1.ballData[off + 4],
        f1.ballData[off + 5],
        f1.ballData[off + 6]
      );
      ball.currQuat.slerpQuaternions(this._q1, this._q2, alpha);

      ball.mesh.position.copy(ball.currPos);
      ball.mesh.quaternion.copy(ball.currQuat);
      ball.worldPos.copy(ball.currPos);
      ball.prevPos.copy(ball.currPos);
      ball.prevQuat.copy(ball.currQuat);

      ball.currentSpeed = THREE.MathUtils.lerp(f0.ballData[off + 7], f1.ballData[off + 7], alpha);
      ball.progressMeters = THREE.MathUtils.lerp(f0.ballProgress[i], f1.ballProgress[i], alpha);
      ball.rank = f0.ballRanks[i] || ball.rank;
      if (ball.rank === 1) leaderSpeed = ball.currentSpeed;

      if (stations && stations.length > 0) {
        const approxIdx = Math.round((ball.progressMeters - sStart) / ds);
        ball.stationIdx = THREE.MathUtils.clamp(approxIdx, 0, stations.length - 1);
      }

      if (this.contactShadowMesh && i < 50) {
        const st = stations?.[ball.stationIdx];
        const trackY = st ? st.pos.y + 0.028 : ball.mesh.position.y - BALL_RADIUS + 0.03;
        const clearance = Math.max(0, ball.mesh.position.y - BALL_RADIUS - trackY);
        const shadowScale = Math.max(0.25, 1.0 - clearance * 0.16);
        this._dummy.position.set(
          ball.mesh.position.x,
          Math.min(ball.mesh.position.y - BALL_RADIUS + 0.035, trackY),
          ball.mesh.position.z
        );
        this._dummy.rotation.set(0, 0, 0);
        this._dummy.scale.set(shadowScale, 1, shadowScale);
        this._dummy.updateMatrix();
        this.contactShadowMesh.setMatrixAt(i, this._dummy.matrix);
      }
    }

    if (this.contactShadowMesh) {
      this.contactShadowMesh.instanceMatrix.needsUpdate = true;
    }

    // Interpolate kinematic hurdles cleanly
    const nh = Math.min(this.kinematicHurdles.length, this.replay.hurdleCount);
    if (f0.hurdleData.length >= nh * 7 && f1.hurdleData.length >= nh * 7) {
      for (let i = 0; i < nh; i++) {
        const h = this.kinematicHurdles[i];
        const off = i * 7;
        this._v1.set(f0.hurdleData[off], f0.hurdleData[off + 1], f0.hurdleData[off + 2]);
        this._v2.set(f1.hurdleData[off], f1.hurdleData[off + 1], f1.hurdleData[off + 2]);
        h.mesh.position.lerpVectors(this._v1, this._v2, alpha);

        this._q1.set(
          f0.hurdleData[off + 3],
          f0.hurdleData[off + 4],
          f0.hurdleData[off + 5],
          f0.hurdleData[off + 6]
        );
        this._q2.set(
          f1.hurdleData[off + 3],
          f1.hurdleData[off + 4],
          f1.hurdleData[off + 5],
          f1.hurdleData[off + 6]
        );
        h.mesh.quaternion.slerpQuaternions(this._q1, this._q2, alpha);
      }
    }

    // Start gate position during replay
    if (this.startGate) {
      const gp = THREE.MathUtils.lerp(f0.gateProgress, f1.gateProgress, alpha);
      const eased = 1 - Math.pow(1 - gp, 3);
      this.startGate.mesh.position.lerpVectors(this.startGate.closedPos, this.startGate.openPos, eased);
    }

    // Winner podium trophies & laurel halos appear at the exact moment each podium marble finishes
    for (const slot of this.podiumSlots) {
      const finisher = this.balls.find((b) => b.finishRank === slot.rank);
      if (finisher && finisher.finishTime !== null && finisher.finishTime <= clampedT + 0.05) {
        setRichMarbleColor(slot.mesh.material.color, finisher.color);
        slot.mesh.visible = true;
        if (slot.haloRing) slot.haloRing.visible = true;
      } else {
        slot.mesh.visible = false;
        if (slot.haloRing) slot.haloRing.visible = false;
      }
    }

    this.sound.updateRollingBed(leaderSpeed, this.replay.isPlaying);
    // Compute crowd pack density excitement during replay as well
    if (this.replay.isPlaying && n > 0) {
      let avgS = 0;
      for (let i = 0; i < n; i++) avgS += this.balls[i].progressMeters;
      avgS /= n;
      let clusterCount = 0;
      for (let i = 0; i < n; i++) {
        if (Math.abs(this.balls[i].progressMeters - avgS) < 6.5) clusterCount++;
      }
      const finishApproach = this.balls.some((b) => b.progressMeters >= this.config.distanceMeters - 18) ? 0.35 : 0;
      const densityExc = THREE.MathUtils.clamp((clusterCount / Math.max(2, n * 0.7)) * 0.65 + finishApproach, 0, 1);
      this.crowdExcitement = Math.max(this.crowdExcitement, densityExc);
    }
  }

  seekReplay(targetTime) {
    if (!this.replay.hasData()) return;
    const clamped = THREE.MathUtils.clamp(targetTime, 0, this.replay.totalDuration);
    this.replay.currentTime = clamped;
    this.replay.prevTimeForAudio = clamped;
    this.replay.activeShotIdx = -1;
    this.directorState.justCut = true;
    this.lastReplayWinnerBannerId = -1;
    this.activeFinishBanners = [];
    this.replayAnnouncedBallIds = new Set();
    for (const b of this.balls) {
      if (b.finishTime !== null && b.finishTime <= clamped + 0.04) {
        this.replayAnnouncedBallIds.add(b.id);
      }
    }
    if (clamped < this.replay.totalDuration - 0.05) {
      this.hideCanvasOverlay();
    }
    this.applyReplayFrameAtTime(clamped);
    this.updateReplayHud(false);
    this.updateTelemetryHud();
    this.updateLeaderboard(false);
    this.renderBroadcastHudCanvas(true);
  }

  jumpToReplayHighlight(dir) {
    const hls = this.replay.highlights;
    if (!hls || hls.length === 0) {
      this.seekReplay(dir < 0 ? 0 : this.replay.totalDuration);
      return;
    }
    const cur = this.replay.currentTime;
    let target = null;
    if (dir > 0) {
      target = hls.find((h) => h.time > cur + 0.85) || hls[0];
    } else {
      for (let i = hls.length - 1; i >= 0; i--) {
        if (hls[i].time < cur - 0.85) {
          target = hls[i];
          break;
        }
      }
      if (!target) target = hls[hls.length - 1];
    }
    this.replay.isPlaying = true;
    this.seekReplay(Math.max(0, target.time - 0.65));
    this.syncUiState();
  }

  updateReplayHud(inSlowMo = false) {
    const dur = Math.max(0.01, this.replay.totalDuration);
    const cur = THREE.MathUtils.clamp(this.replay.currentTime, 0, dur);
    const pct = (cur / dur) * 100;

    if (this.dom.replayProgressFill) {
      this.dom.replayProgressFill.style.width = `${pct.toFixed(2)}%`;
    }
    if (this.dom.replayScrubberThumb) {
      this.dom.replayScrubberThumb.style.left = `${pct.toFixed(2)}%`;
    }
    if (this.dom.replayScrubberWrap) {
      this.dom.replayScrubberWrap.setAttribute('aria-valuenow', String(Math.round(pct)));
    }
    if (this.dom.replayTimeReadout) {
      this.dom.replayTimeReadout.textContent = `${this.formatReplayShortTime(cur)} / ${this.formatReplayShortTime(dur)}`;
    }
    if (this.dom.btnReplayPlay) {
      this.dom.btnReplayPlay.textContent = this.replay.isPlaying ? 'Pause' : cur >= dur - 0.05 ? 'Replay' : 'Play';
      this.dom.btnReplayPlay.classList.toggle('active', this.replay.isPlaying);
    }

    const shotIdx = this.replay.getShotIndexAt(cur);
    const shot = this.replay.shots[shotIdx];
    const shotLabel = this.isRecordingGameplayPass
      ? 'Gameplay Camera'
      : !this.replay.autoDirector
        ? 'Manual Orbit'
        : shot
          ? shot.shotLabel
          : 'Auto Director';
    if (this.dom.replayShotBadge) {
      this.dom.replayShotBadge.textContent = inSlowMo ? `0.36x · ${shotLabel}` : shotLabel;
    }
    if (this.dom.hudReplayMomentText) {
      const qLabel = QUALITY_PRESETS[this.recordQualityPreset]?.label || '1080p Standard';
      if (this.isRecordingGameplayPass) {
        this.dom.hudReplayMomentText.textContent = `Rendering Video 1 (${qLabel})`;
      } else {
        const momentText = shot ? shot.momentLabel : 'Highlight Reel';
        this.dom.hudReplayMomentText.textContent = inSlowMo
          ? `SLOW-MO · ${momentText}`
          : `${shotLabel} · ${momentText}`;
      }
    }
  }

  // ==========================================================================
  // Camera Choreography (Overview, Broadcast, Leader, Full Top-Down, Finish, Free Roam)
  // ==========================================================================
  snapOverviewCamera() {
    if (!this.trackData) return;
    const midS = Math.min(20, this.config.distanceMeters * 0.22);
    const st = getStationAtS(this.trackData, midS);
    const startSt = getStationAtS(this.trackData, 0);

    this.smoothCamTarget.copy(startSt.pos).lerp(st.pos, 0.55);
    this.smoothCamPos
      .copy(startSt.pos)
      .addScaledVector(startSt.T, -15)
      .addScaledVector(startSt.U, 13.5)
      .addScaledVector(startSt.R, 12.5);

    this.camera.position.copy(this.smoothCamPos);
    this.camera.lookAt(this.smoothCamTarget);
    this.controls.target.copy(this.smoothCamTarget);
    this.camInitialized = true;
  }

  snapFreeCamToPack() {
    if (!this.trackData || this.balls.length === 0) return;
    const sorted = [...this.balls].sort((a, b) => a.rank - b.rank);
    const leader = sorted[0];
    const st = getStationAtS(
      this.trackData,
      THREE.MathUtils.clamp(leader.progressMeters, 0, this.config.distanceMeters)
    );
    const target = leader.worldPos.clone().addScaledVector(st.T, 3);
    const pos = leader.worldPos
      .clone()
      .addScaledVector(st.T, -14)
      .addScaledVector(st.U, 11)
      .addScaledVector(st.R, 9);
    this.camera.position.copy(pos);
    this.controls.target.copy(target);
    this.controls.update();
  }

  centerFreeCamOnTrack() {
    if (!this.trackData) return;
    const { bounds } = this.trackData;
    const span = Math.max(bounds.spanX, bounds.spanZ);
    const target = new THREE.Vector3(bounds.centerX, bounds.centerY, bounds.centerZ);
    const pos = new THREE.Vector3(
      bounds.centerX + span * 0.42,
      bounds.maxY + span * 0.36,
      bounds.centerZ + span * 0.48
    );
    this.camera.position.copy(pos);
    this.controls.target.copy(target);
    this.controls.update();
  }

  updateFreeCameraMovement(dt) {
    if (this.keysPressed.size === 0) return;
    const fast = this.keysPressed.has('ShiftLeft') || this.keysPressed.has('ShiftRight');
    const moveSpeed = (fast ? 78 : 34) * dt;

    // Derive horizontal forward & right vectors from camera gaze
    this._v1.subVectors(this.controls.target, this.camera.position);
    this._v1.y = 0;
    if (this._v1.lengthSq() < 1e-4) this._v1.set(0, 0, -1);
    this._v1.normalize(); // forward XZ

    this._v2.crossVectors(this._v1, this.camera.up).normalize(); // right XZ

    this._v3.set(0, 0, 0);
    if (this.keysPressed.has('KeyW') || this.keysPressed.has('ArrowUp')) this._v3.add(this._v1);
    if (this.keysPressed.has('KeyS') || this.keysPressed.has('ArrowDown')) this._v3.sub(this._v1);
    if (this.keysPressed.has('KeyD') || this.keysPressed.has('ArrowRight')) this._v3.add(this._v2);
    if (this.keysPressed.has('KeyA') || this.keysPressed.has('ArrowLeft')) this._v3.sub(this._v2);
    if (this.keysPressed.has('KeyE') || this.keysPressed.has('Space')) this._v3.y += 1;
    if (this.keysPressed.has('KeyQ') || this.keysPressed.has('KeyC')) this._v3.y -= 1;

    if (this._v3.lengthSq() > 0) {
      this._v3.normalize().multiplyScalar(moveSpeed);
      this.camera.position.add(this._v3);
      this.controls.target.add(this._v3);
      const minCamY = (this.trackData?.bounds?.minY ?? 4) - 3.5;
      if (this.camera.position.y < minCamY) {
        this.camera.position.y = minCamY;
      }
    }
  }

  setDirectorShot(name) {
    if (this.directorState.shotName !== name) {
      this.directorState.shotName = name;
      this.directorState.justCut = true;
      if (this.dom.cameraShotLabel) {
        this.dom.cameraShotLabel.textContent = name;
      }
      if (this.raceState === 'RACING') {
        this.sound.playCameraCut();
      }
    }
  }

  computeFollowShot(ball, angleIdx, st, rightSign = 1) {
    const speedBonus = THREE.MathUtils.clamp(ball.currentSpeed * 0.34, 0, 11);
    const halfW = this.config.trackWidth * 0.5;
    if (angleIdx === 1) {
      // Low Bumper
      this._v3.copy(ball.worldPos).addScaledVector(st.T, 8.5).addScaledVector(st.U, 0.35);
      this._v1
        .copy(ball.worldPos)
        .addScaledVector(st.T, -4.2)
        .addScaledVector(st.U, 1.52)
        .addScaledVector(st.R, 0.52 * rightSign);
      return { fov: 56 + speedBonus, bankEnabled: true };
    }
    if (angleIdx === 2) {
      // Side Drone (frames cleanly through crystal-clear safety glass above 0.50m curb)
      const side = Math.cos(this.raceElapsedTime * 0.25) >= 0 ? 1 : -1;
      this._v3.copy(ball.worldPos).addScaledVector(st.T, 3.6);
      this._v1
        .copy(ball.worldPos)
        .addScaledVector(st.T, 1.4)
        .addScaledVector(st.U, 2.85)
        .addScaledVector(st.R, (halfW + 4.4) * side);
      return { fov: 50 + speedBonus * 0.45, bankEnabled: false };
    }
    if (angleIdx === 3) {
      // Reverse Cam (looking back into chasing pack)
      this._v3.copy(ball.worldPos).addScaledVector(st.T, -5.8).addScaledVector(st.U, 0.4);
      this._v1
        .copy(ball.worldPos)
        .addScaledVector(st.T, 6.2)
        .addScaledVector(st.U, 2.45)
        .addScaledVector(st.R, 0.85 * rightSign);
      return { fov: 55 + speedBonus * 0.7, bankEnabled: false };
    }
    // 0: Classic Hero Chase
    this._v3.copy(ball.worldPos).addScaledVector(st.T, 7.2);
    this._v1
      .copy(ball.worldPos)
      .addScaledVector(st.T, -8.8)
      .addScaledVector(st.U, 4.3)
      .addScaledVector(st.R, 1.1 * rightSign);
    return { fov: 52 + speedBonus, bankEnabled: true };
  }

  updateCamera(dt) {
    if (!this.trackData || this.balls.length === 0) return;

    const mapCfg = TERRITORIES[this.config.mapPreset] || TERRITORIES.expedition;
    const targetFog =
      this.cameraMode === 'topdown' || this.cameraMode === 'drone_top' || this.cameraMode === 'drone_side'
        ? 0.00026
        : mapCfg.fogDensity;
    if (this.scene.fog) {
      this.scene.fog.density = THREE.MathUtils.damp(this.scene.fog.density, targetFog, 6, dt);
    }

    if (this.raceState === 'REPLAY' && !this.replay.autoDirector && !this.isRecordingGameplayPass) {
      this.controls.enabled = true;
      this.camera.up.set(0, 1, 0);
      this.updateFreeCameraMovement(dt);
      this.controls.update();
      if (this.skyDome) this.skyDome.position.copy(this.camera.position);
      return;
    }

    if (this.cameraMode === 'free' && this.raceState !== 'REPLAY') {
      this.controls.enabled = true;
      this.camera.up.set(0, 1, 0);
      this.updateFreeCameraMovement(dt);
      this.controls.update();
      if (this.skyDome) this.skyDome.position.copy(this.camera.position);
      return;
    }
    this.controls.enabled = false;

    const sorted = [...this.balls].sort((a, b) => a.rank - b.rank);
    const leader = sorted[0];
    const L = this.config.distanceMeters;
    const halfW = this.config.trackWidth * 0.5;

    const packCount = Math.max(1, Math.ceil(sorted.length * 0.55));
    let packS = 0;
    this._v2.set(0, 0, 0);
    for (let i = 0; i < packCount; i++) {
      this._v2.add(sorted[i].worldPos);
      packS += sorted[i].progressMeters;
    }
    this._v2.divideScalar(packCount);
    packS /= packCount;

    let dampFactor = isSoftwareGl ? 18 : 6.2;
    let targetFov = 52;
    let targetBank = 0;
    let speedNorm = THREE.MathUtils.clamp(leader.currentSpeed / 24, 0, 1);

    if (this.raceState === 'REPLAY' && this.replay.autoDirector && this.replay.shots.length > 0) {
      const rTime = this.replay.currentTime;
      const shotIdx = this.replay.getShotIndexAt(rTime);
      const shot = this.replay.shots[shotIdx];
      if (shotIdx !== this.replay.activeShotIdx) {
        this.replay.activeShotIdx = shotIdx;
        this.directorState.justCut = true;
        this.sound.playCameraCut();
        if (shot && shot.intensity >= 0.92 && this.replay.isPlaying) {
          this.camShake = Math.max(this.camShake, 0.16);
        }
      }

      const primary = (shot && this.balls[shot.primaryBallId]) || leader;
      const secondary =
        shot && shot.secondaryBallId >= 0 ? this.balls[shot.secondaryBallId] || null : null;
      const focusS = THREE.MathUtils.clamp(primary.progressMeters, 0, L + 10);
      const st = getStationAtS(this.trackData, focusS);
      const stAhead = getStationAtS(this.trackData, THREE.MathUtils.clamp(focusS + 4.0, 0, L + 10));
      const shotElapsed = Math.max(0, rTime - (shot ? shot.startTime : 0));
      const rightSign = shotIdx % 2 === 0 ? 1 : -1;

      // Anchor onto battle midpoint when two contenders collide/duel closely
      if (secondary && primary.worldPos.distanceToSquared(secondary.worldPos) < 120) {
        this._v4.lerpVectors(primary.worldPos, secondary.worldPos, 0.5);
      } else {
        this._v4.copy(primary.worldPos);
      }

      const angleType = shot ? shot.angleType : 'apex_chase';
      if (angleType === 'launch_sweep') {
        const startSt = getStationAtS(this.trackData, 0);
        const sweep = Math.sin(rTime * 0.9) * (halfW * 0.75);
        this._v3.copy(this._v2).addScaledVector(startSt.T, 1.5);
        this._v1
          .copy(startSt.pos)
          .addScaledVector(startSt.T, 9.5 + shotElapsed * 1.4)
          .addScaledVector(startSt.U, 3.9)
          .addScaledVector(startSt.R, sweep);
        targetFov = 49;
        dampFactor = 8.5;
      } else if (angleType === 'impact_close') {
        const lookAhead = Math.min(L + 8, focusS + 4.8);
        const camSt = getStationAtS(this.trackData, lookAhead);
        this._v3.copy(this._v4).addScaledVector(st.U, 0.35);
        this._v1
          .copy(camSt.pos)
          .addScaledVector(camSt.U, 2.35)
          .addScaledVector(camSt.R, rightSign * (halfW + 3.4));
        targetFov = 44;
        dampFactor = 13.0;
      } else if (angleType === 'hurdle_hero') {
        const hCamSt = getStationAtS(this.trackData, Math.min(L + 8, focusS + 5.6));
        this._v3.copy(primary.worldPos).addScaledVector(st.T, 1.0);
        this._v1
          .copy(hCamSt.pos)
          .addScaledVector(hCamSt.U, 2.2)
          .addScaledVector(hCamSt.R, rightSign * (halfW * 0.78));
        targetFov = 52;
        dampFactor = 11.5;
      } else if (angleType === 'jump_profile') {
        this._v3.copy(primary.worldPos).addScaledVector(st.T, 2.8);
        this._v1
          .copy(st.pos)
          .addScaledVector(st.T, 0.8)
          .addScaledVector(st.U, 2.1)
          .addScaledVector(st.R, rightSign * (halfW + 4.8));
        targetFov = 50;
        dampFactor = 9.0;
      } else if (angleType === 'bumper_duel') {
        const info = this.computeFollowShot(primary, 1, st, rightSign);
        this._v3.copy(this._v4).addScaledVector(st.T, 6.2).addScaledVector(st.U, 0.3);
        targetFov = info.fov;
        dampFactor = 9.5;
        targetBank = THREE.MathUtils.clamp(
          this._v4.subVectors(stAhead.T, st.T).dot(st.R) * -0.48,
          -0.14,
          0.14
        );
      } else if (angleType === 'reverse_pack') {
        const info = this.computeFollowShot(primary, 3, st, rightSign);
        targetFov = info.fov;
        dampFactor = 9.0;
      } else if (angleType === 'helicopter_orbit') {
        const angle = shotElapsed * 0.75 * rightSign;
        const rad = 11.5;
        this._v3.copy(this._v2).addScaledVector(st.T, 2.5);
        this._v1
          .copy(this._v2)
          .addScaledVector(st.T, -Math.cos(angle) * rad)
          .addScaledVector(st.U, 8.8)
          .addScaledVector(st.R, Math.sin(angle) * rad);
        targetFov = 51;
        dampFactor = 6.5;
      } else if (angleType === 'side_drone') {
        this._v3.copy(this._v4).addScaledVector(st.T, 3.6);
        this._v1
          .copy(st.pos)
          .addScaledVector(st.T, 1.4 - shotElapsed * 0.6)
          .addScaledVector(st.U, 3.2)
          .addScaledVector(st.R, rightSign * (halfW + 5.0));
        targetFov = 48;
        dampFactor = 9.0;
      } else if (angleType === 'above_pack_drone') {
        this._v3.copy(this._v2).addScaledVector(st.T, 2.5);
        this._v1
          .copy(this._v2)
          .addScaledVector(st.T, -4.4)
          .addScaledVector(st.U, 8.6);
        targetFov = 51;
        dampFactor = 8.0;
      } else if (angleType === 'finish_hero') {
        const finSt = getStationAtS(this.trackData, L + 9.2);
        this._v3.copy(leader.worldPos).lerp(finSt.pos, 0.28);
        this._v1
          .copy(finSt.pos)
          .addScaledVector(finSt.U, 4.3)
          .addScaledVector(finSt.R, -(halfW + 2.8));
        targetFov = 47;
        dampFactor = 9.5;
      } else {
        // apex_chase
        const info = this.computeFollowShot(primary, 0, st, rightSign);
        targetFov = info.fov;
        dampFactor = 8.5;
        targetBank = THREE.MathUtils.clamp(
          this._v4.subVectors(stAhead.T, st.T).dot(st.R) * -0.45,
          -0.13,
          0.13
        );
      }
    } else if (this.cameraMode === 'overview') {
      if (this.raceState === 'READY' || this.raceState === 'COUNTDOWN') {
        const startSt = getStationAtS(this.trackData, 0);
        const lookSt = getStationAtS(this.trackData, Math.min(28, L * 0.35));
        const sway = Math.sin(performance.now() * 0.00055) * 3.5;
        this._v3.copy(startSt.pos).lerp(lookSt.pos, 0.45);
        this._v1
          .copy(startSt.pos)
          .addScaledVector(startSt.T, -15)
          .addScaledVector(startSt.U, 13.5)
          .addScaledVector(startSt.R, 12.5 + sway);
      } else if (this.raceState === 'FINISHED') {
        const finSt = getStationAtS(this.trackData, L + 6);
        const podSt = getStationAtS(this.trackData, L + 13);
        this._v3.copy(podSt.pos).addScaledVector(podSt.R, halfW + 5.2).addScaledVector(podSt.U, 2.2);
        this._v1
          .copy(finSt.pos)
          .addScaledVector(finSt.T, -15)
          .addScaledVector(finSt.U, 11.5)
          .addScaledVector(finSt.R, -9.5);
      } else {
        const st = getStationAtS(this.trackData, THREE.MathUtils.clamp(packS, 0, L));
        const orbitAngle = Math.sin(this.raceElapsedTime * 0.16) * 0.35;
        const sideSign = Math.cos(orbitAngle) >= 0 ? 1 : -1;
        this._v3.copy(this._v2).addScaledVector(st.T, 6.5);
        this._v1
          .copy(this._v2)
          .addScaledVector(st.T, -17.5)
          .addScaledVector(st.U, 14.5)
          .addScaledVector(st.R, 12.0 * sideSign + Math.sin(this.raceElapsedTime * 0.2) * 3.0);
      }
    } else if (this.cameraMode === 'director') {
      // Automatic Broadcast TV Director Choreography
      const nowSec = performance.now() * 0.001;
      if (this.raceState === 'READY' || this.raceState === 'COUNTDOWN') {
        this.setDirectorShot('Wide Dolly');
        const startSt = getStationAtS(this.trackData, 0);
        const tSweep = Math.sin(nowSec * 0.65) * 5.2;
        this._v3.copy(startSt.pos).addScaledVector(startSt.T, -1.2).addScaledVector(startSt.U, 1.2);
        this._v1
          .copy(startSt.pos)
          .addScaledVector(startSt.T, 7.5)
          .addScaledVector(startSt.U, 3.8)
          .addScaledVector(startSt.R, tSweep);
        targetFov = 48;
      } else if (this.raceState === 'FINISHED' || this.winnerAnnounced) {
        this.setDirectorShot('Podium Triumph');
        const podSt = getStationAtS(this.trackData, L + 13);
        const orbit = Math.sin(nowSec * 0.45) * 4.2;
        this._v3
          .copy(podSt.pos)
          .addScaledVector(podSt.R, halfW + 5.2)
          .addScaledVector(podSt.U, 2.3);
        this._v1
          .copy(podSt.pos)
          .addScaledVector(podSt.T, -11.5)
          .addScaledVector(podSt.U, 4.8)
          .addScaledVector(podSt.R, halfW + 5.2 + orbit);
        targetFov = 45;
      } else if (leader.progressMeters >= L - 17) {
        this.setDirectorShot('Photo Finish');
        const finCamSt = getStationAtS(this.trackData, L + 9.5);
        this._v3.copy(leader.worldPos).addScaledVector(finCamSt.T, 1.5);
        this._v1
          .copy(finCamSt.pos)
          .addScaledVector(finCamSt.U, 4.4)
          .addScaledVector(finCamSt.R, -(halfW + 1.8));
        targetFov = 50;
      } else {
        if (this.directorState.cutAt === 0 || nowSec - this.directorState.cutAt >= 4.4) {
          this.directorState.cutAt = nowSec;
          this.directorState.cycleIdx = (this.directorState.cycleIdx + 1) % 6;
          const seq = [
            'Launch Chase',
            'Bumper Duel',
            'Trackside Crane',
            'Hurdle Action',
            'Aerial Sweep',
            'Reverse Pack',
          ];
          let chosen = seq[this.directorState.cycleIdx];
          if (chosen === 'Trackside Crane') {
            const craneSt = getStationAtS(this.trackData, Math.min(L - 4, leader.progressMeters + 14));
            const side = this.directorState.cycleIdx % 2 === 0 ? 1 : -1;
            this.directorState.fixedPos
              .copy(craneSt.pos)
              .addScaledVector(craneSt.U, 6.2)
              .addScaledVector(craneSt.R, side * (halfW + 4.2));
            this.directorState.hasFixedPos = true;
          } else if (chosen === 'Hurdle Action') {
            const nextHurdleS = this.hurdleStationsS.find(
              (hs) => hs > leader.progressMeters + 5 && hs < leader.progressMeters + 24
            );
            if (nextHurdleS !== undefined) {
              const hSt = getStationAtS(this.trackData, nextHurdleS + 4.2);
              this.directorState.fixedPos
                .copy(hSt.pos)
                .addScaledVector(hSt.U, 2.3)
                .addScaledVector(hSt.R, halfW * 0.65);
              this.directorState.hasFixedPos = true;
            } else {
              chosen = 'Aerial Sweep';
              this.directorState.hasFixedPos = false;
            }
          } else {
            this.directorState.hasFixedPos = false;
          }
          this.setDirectorShot(chosen);
        }

        const st = getStationAtS(
          this.trackData,
          THREE.MathUtils.clamp(leader.progressMeters, 0, L + 6)
        );
        const stAhead = getStationAtS(
          this.trackData,
          THREE.MathUtils.clamp(leader.progressMeters + 4.0, 0, L + 8)
        );
        const curShot = this.directorState.shotName;

        if (curShot === 'Trackside Crane' || curShot === 'Hurdle Action') {
          this._v3.copy(leader.worldPos).addScaledVector(st.T, 1.6);
          this._v1.copy(this.directorState.fixedPos);
          targetFov = curShot === 'Hurdle Action' ? 56 : 50;
          dampFactor = 14;
        } else if (curShot === 'Bumper Duel') {
          const info = this.computeFollowShot(leader, 1, st, 1);
          targetFov = info.fov;
          targetBank = THREE.MathUtils.clamp(
            this._v4.subVectors(stAhead.T, st.T).dot(st.R) * -0.48,
            -0.14,
            0.14
          );
        } else if (curShot === 'Aerial Sweep') {
          this._v3.copy(this._v2).addScaledVector(st.T, 5.5);
          this._v1
            .copy(this._v2)
            .addScaledVector(st.T, -12.5)
            .addScaledVector(st.U, 10.5)
            .addScaledVector(st.R, Math.sin(nowSec * 0.6) * 9.5);
          targetFov = 54;
        } else if (curShot === 'Reverse Pack') {
          const info = this.computeFollowShot(leader, 3, st, 1);
          targetFov = info.fov;
        } else {
          const info = this.computeFollowShot(leader, 0, st, 1);
          targetFov = info.fov;
          targetBank = THREE.MathUtils.clamp(
            this._v4.subVectors(stAhead.T, st.T).dot(st.R) * -0.45,
            -0.13,
            0.13
          );
        }
      }
    } else if (this.cameraMode === 'leader') {
      const st = getStationAtS(this.trackData, THREE.MathUtils.clamp(leader.progressMeters, 0, L + 8));
      const stAhead = getStationAtS(
        this.trackData,
        THREE.MathUtils.clamp(leader.progressMeters + 3.8, 0, L + 8)
      );
      const info = this.computeFollowShot(leader, this.followShotAngle, st, 1);
      targetFov = info.fov;
      if (info.bankEnabled) {
        targetBank = THREE.MathUtils.clamp(
          this._v4.subVectors(stAhead.T, st.T).dot(st.R) * -0.48,
          -0.14,
          0.14
        );
      }
    } else if (this.cameraMode === 'topdown') {
      const { bounds } = this.trackData;
      const halfFovRad = THREE.MathUtils.degToRad(this.camera.fov * 0.5);
      const tanHalfFov = Math.tan(halfFovRad);
      const reqHeightZ = (bounds.spanZ * 0.5) / tanHalfFov;
      const reqHeightX = (bounds.spanX * 0.5) / (tanHalfFov * Math.max(0.4, this.camera.aspect));
      const altitude = Math.max(reqHeightZ, reqHeightX) * 1.14 + 14;

      this._v3.set(bounds.centerX, bounds.centerY, bounds.centerZ);
      this._v1.set(bounds.centerX, bounds.centerY + altitude, bounds.centerZ + altitude * 0.055);
    } else if (this.cameraMode === 'drone_top' || this.cameraMode === 'drone_side') {
      // Dynamic Drone Tracking ALL balls until the finish line (above-pack top OR lateral side drone)
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      let sumX = 0;
      let sumY = 0;
      let sumZ = 0;
      let maxY = -Infinity;
      let avgS = 0;

      for (let i = 0; i < this.balls.length; i++) {
        const bp = this.balls[i].worldPos;
        if (bp.x < minX) minX = bp.x;
        if (bp.x > maxX) maxX = bp.x;
        if (bp.z < minZ) minZ = bp.z;
        if (bp.z > maxZ) maxZ = bp.z;
        if (bp.y > maxY) maxY = bp.y;
        sumX += bp.x;
        sumY += bp.y;
        sumZ += bp.z;
        avgS += this.balls[i].progressMeters;
      }

      if (leader.progressMeters >= L - 16) {
        const finAnchor = getStationAtS(this.trackData, L).pos;
        if (finAnchor.x < minX) minX = finAnchor.x;
        if (finAnchor.x > maxX) maxX = finAnchor.x;
        if (finAnchor.z < minZ) minZ = finAnchor.z;
        if (finAnchor.z > maxZ) maxZ = finAnchor.z;
        if (finAnchor.y > maxY) maxY = finAnchor.y;
      }

      const nB = Math.max(1, this.balls.length);
      const cx = (minX + maxX) * 0.5 * 0.58 + (sumX / nB) * 0.42;
      const cz = (minZ + maxZ) * 0.5 * 0.58 + (sumZ / nB) * 0.42;
      const cy = sumY / nB;
      avgS /= nB;

      const spreadDiag = Math.hypot(Math.max(0, maxX - minX), Math.max(0, maxZ - minZ));
      const midSt = getStationAtS(this.trackData, THREE.MathUtils.clamp(avgS, 0, L));

      if (this.cameraMode === 'drone_top') {
        // Above-head overhead drone follow: stays just above the balls' heads (not full-map bird's eye)
        const altitude = THREE.MathUtils.clamp(6.8 + spreadDiag * 0.48, 7.2, 24.0);
        this._v3.set(cx + midSt.T.x * 2.0, cy + 0.35, cz + midSt.T.z * 2.0);
        this._v1.set(
          cx - midSt.T.x * altitude * 0.38,
          Math.max(cy, maxY) + altitude,
          cz - midSt.T.z * altitude * 0.38
        );
        targetFov = 54;
        dampFactor = isSoftwareGl ? 18 : 6.2;
      } else {
        // Lateral Side Drone Follow: skims beside the track framing all balls until finish line
        const lateralDist = halfW + 6.8 + Math.min(11.0, spreadDiag * 0.36);
        const sideHeight = 3.4 + Math.min(5.2, spreadDiag * 0.14);
        this._v3.set(cx + midSt.T.x * 1.6, cy + 0.4, cz + midSt.T.z * 1.6);
        this._v1
          .set(cx, Math.max(cy, maxY), cz)
          .addScaledVector(midSt.R, lateralDist)
          .addScaledVector(midSt.U, sideHeight)
          .addScaledVector(midSt.T, 1.8);
        targetFov = 52;
        dampFactor = isSoftwareGl ? 18 : 6.0;
      }
    } else if (this.cameraMode === 'finish') {
      const finishSt = getStationAtS(this.trackData, L + 11.5);
      const lineSt = getStationAtS(this.trackData, Math.max(0, L - 5.5));
      const podiumAnchor = getStationAtS(this.trackData, L + 13);
      const podTarget = podiumAnchor.pos
        .clone()
        .addScaledVector(podiumAnchor.R, halfW + 5.2)
        .addScaledVector(podiumAnchor.U, 2.0);

      this._v3.copy(lineSt.pos).lerp(podTarget, this.winnerAnnounced ? 0.58 : 0.25).addScaledVector(lineSt.U, 1.1);
      if (leader && leader.progressMeters > L - 32 && leader.progressMeters < L + 3) {
        this._v3.lerp(leader.worldPos, 0.35);
      }

      this._v1
        .copy(finishSt.pos)
        .addScaledVector(finishSt.U, 5.4)
        .addScaledVector(finishSt.R, -(halfW + 3.8));
    }

    if (
      !Number.isFinite(this._v1.x) ||
      !Number.isFinite(this._v1.y) ||
      !Number.isFinite(this._v1.z) ||
      !Number.isFinite(this._v3.x) ||
      !Number.isFinite(this._v3.y) ||
      !Number.isFinite(this._v3.z)
    ) {
      return;
    }

    if (this.directorState.justCut) {
      this.directorState.justCut = false;
      this.smoothCamPos.copy(this._v1);
      this.smoothCamTarget.copy(this._v3);
    } else {
      this.smoothCamPos.x = THREE.MathUtils.damp(this.smoothCamPos.x, this._v1.x, dampFactor, dt);
      this.smoothCamPos.y = THREE.MathUtils.damp(this.smoothCamPos.y, this._v1.y, dampFactor, dt);
      this.smoothCamPos.z = THREE.MathUtils.damp(this.smoothCamPos.z, this._v1.z, dampFactor, dt);

      this.smoothCamTarget.x = THREE.MathUtils.damp(this.smoothCamTarget.x, this._v3.x, dampFactor, dt);
      this.smoothCamTarget.y = THREE.MathUtils.damp(this.smoothCamTarget.y, this._v3.y, dampFactor, dt);
      this.smoothCamTarget.z = THREE.MathUtils.damp(this.smoothCamTarget.z, this._v3.z, dampFactor, dt);
    }

    // Damped broadcast micro-shake on impacts / boosters
    this.camera.position.copy(this.smoothCamPos);
    if (this.camShake > 0.002) {
      this.camera.position.x += (Math.random() - 0.5) * this.camShake;
      this.camera.position.y += (Math.random() - 0.5) * this.camShake * 0.7;
      this.camera.position.z += (Math.random() - 0.5) * this.camShake;
      this.camShake = Math.max(0, this.camShake - dt * 1.65);
    }

    // Dynamic curve banking roll
    this.camBankRoll = THREE.MathUtils.damp(this.camBankRoll, targetBank, 5.5, dt);
    this._v4.subVectors(this.smoothCamTarget, this.camera.position);
    if (Math.abs(this.camBankRoll) > 0.001 && this._v4.lengthSq() > 1e-6) {
      this._v4.normalize();
      this._upVec.set(0, 1, 0).applyAxisAngle(this._v4, this.camBankRoll);
      this.camera.up.copy(this._upVec);
    } else {
      this.camera.up.set(0, 1, 0);
    }

    this.camera.lookAt(this.smoothCamTarget);

    this.smoothFov = THREE.MathUtils.damp(this.smoothFov, targetFov, 4.5, dt);
    if (Math.abs(this.camera.fov - this.smoothFov) > 0.03) {
      this.camera.fov = THREE.MathUtils.clamp(this.smoothFov, 25, 95);
      this.camera.updateProjectionMatrix();
    }

    if (this.skyDome) {
      this.skyDome.position.copy(this.camera.position);
    }

    if (this.keyLight && this.keyLight.castShadow) {
      this.keyLight.target.position.copy(this.smoothCamTarget);
      this.keyLight.position.set(
        this.smoothCamTarget.x + 35,
        this.smoothCamTarget.y + 62,
        this.smoothCamTarget.z + 28
      );
    }
  }

  // ==========================================================================
  // Main Loop & Software-WebGL Frame Pacing
  // ==========================================================================
  afterDraw(cb) {
    const gl = this.renderer.getContext();
    if (!gl || !gl.fenceSync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  togglePhysicsDebug() {
    this.physicsDebugEnabled = !this.physicsDebugEnabled;
    if (!this.physicsDebugEnabled) {
      if (this.physicsDebugMesh) {
        this.physicsDebugMesh.visible = false;
      }
      return;
    }
    this.updatePhysicsDebugGeometry();
  }

  updatePhysicsDebugGeometry() {
    if (!this.world || !this.scene) return;
    const { vertices, colors } = this.world.debugRender();
    const vertexCount = vertices ? Math.floor(vertices.length / 3) : 0;

    if (!this.physicsDebugMesh) {
      const geo = new THREE.BufferGeometry();
      const mat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        depthTest: true,
      });
      this.physicsDebugMesh = new THREE.LineSegments(geo, mat);
      this.physicsDebugMesh.frustumCulled = false;
      this.physicsDebugMesh.renderOrder = 999;
      this.scene.add(this.physicsDebugMesh);
    }

    this.physicsDebugMesh.visible = vertexCount > 0;
    if (vertexCount === 0) return;

    const neededLen = vertexCount * 3;
    const geo = this.physicsDebugMesh.geometry;
    let posAttr = geo.getAttribute('position');
    let colAttr = geo.getAttribute('color');

    if (!posAttr || posAttr.array.length < neededLen) {
      const cap = Math.max(neededLen, Math.floor((posAttr ? posAttr.array.length : 0) * 1.35));
      const posArr = new Float32Array(cap);
      this._debugRgbBuffer = new Float32Array(cap);
      posAttr = new THREE.BufferAttribute(posArr, 3);
      posAttr.setUsage(THREE.DynamicDrawUsage);
      colAttr = new THREE.BufferAttribute(this._debugRgbBuffer, 3);
      colAttr.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('position', posAttr);
      geo.setAttribute('color', colAttr);
    }

    posAttr.array.set(vertices);
    for (let i = 0, j = 0; i < vertexCount; i++, j += 4) {
      const o = i * 3;
      this._debugRgbBuffer[o] = colors[j] ?? 0.2;
      this._debugRgbBuffer[o + 1] = colors[j + 1] ?? 0.9;
      this._debugRgbBuffer[o + 2] = colors[j + 2] ?? 0.4;
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    geo.setDrawRange(0, vertexCount);
  }

  renderActiveFrame() {
    const gl = this.renderer?.getContext?.();
    if (!gl || gl.isContextLost()) return;

    if (this.physicsDebugEnabled) {
      this.updatePhysicsDebugGeometry();
    } else if (this.physicsDebugMesh && this.physicsDebugMesh.visible) {
      this.physicsDebugMesh.visible = false;
    }

    const hasHudOverlay =
      (this.countdownMesh && this.countdownMesh.visible) ||
      (this.hudOverlayMesh && this.hudOverlayMesh.visible);
    if (hasHudOverlay && this.hudScene && this.hudCamera) {
      this.renderer.autoClear = false;
      this.renderer.clear();
      this.renderer.render(this.scene, this.camera);
      this.renderer.clearDepth();
      this.renderer.render(this.hudScene, this.hudCamera);
      this.renderer.autoClear = true;
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    if (this.recorder.isRecording) {
      this.recorder.captureFrame();
    }
    if (this.cinematicRecorder.isRecording) {
      this.cinematicRecorder.captureFrame();
    }
  }

  startLoop() {
    this.lastFrameTime = performance.now();
    const tick = () => {
      try {
        const now = performance.now();
        const rawDtMs = Math.max(1, now - this.lastFrameTime);
        const dt = Math.min(0.085, rawDtMs / 1000);
        this.lastFrameTime = now;

        // Lightweight adaptive GPU protection so 8K/32K SSAA stays smooth without lag
        const anyRec = this.recorder.isRecording || this.cinematicRecorder.isRecording;
        if (!isSoftwareGl && !anyRec && this.adaptivePrScale > 0.48) {
          if (rawDtMs > 44) {
            this.slowFrameCount++;
            if (this.slowFrameCount >= 42) {
              this.adaptivePrScale = Math.max(0.45, this.adaptivePrScale * 0.72);
              this.slowFrameCount = 0;
              this.onResize();
            }
          } else if (rawDtMs < 24 && this.slowFrameCount > 0) {
            this.slowFrameCount--;
          }
        }

        this.stepSimulation(dt);
        this.updateCamera(dt);

        // Handle post-finish leaderboard hold for Full Gameplay Video & Cinematic Replay Video
        if (this.gameplayEndHold > 0) {
          this.gameplayEndHold -= dt;
          if (this.gameplayEndHold <= 0) {
            this.finalizeRecordingAndOpenResults();
          }
        }
        if (this.gameplayReplayEndHold > 0) {
          this.gameplayReplayEndHold -= dt;
          if (this.gameplayReplayEndHold <= 0) {
            this.finishGameplayReplayRecording();
          }
        }
        if (this.cinematicEndHold > 0) {
          this.cinematicEndHold -= dt;
          if (this.cinematicEndHold <= 0) {
            this.finishCinematicRecording();
          }
        }

        // Dynamic Crowd Audio Layer & Animated Spectators in Stands
        this.crowdExcitement = Math.max(0, this.crowdExcitement - dt * 0.38);
        const crowdActive =
          this.raceState === 'RACING' ||
          (this.raceState === 'REPLAY' && (this.replay.isPlaying || this.cinematicEndHold > 0)) ||
          (this.raceState === 'FINISHED' && this.crowdExcitement > 0.08);
        this.sound.updateCrowdExcitement(this.crowdExcitement, crowdActive);

        if (this.crowdSpectatorGroups.length > 0) {
          const exc = this.crowdExcitement;
          const jumpAmp = 0.015 + exc * 0.17;
          const jumpRate = 0.0038 + exc * 0.0092;
          const swayAmp = 0.04 + exc * 0.14;
          for (let g = 0; g < this.crowdSpectatorGroups.length; g++) {
            const cg = this.crowdSpectatorGroups[g];
            const specs = cg.specs;
            for (let i = 0; i < specs.length; i++) {
              const sp = specs[i];
              const wave = Math.abs(Math.sin(now * jumpRate + sp.phase)) * jumpAmp;
              const swayZ = Math.sin(now * 0.004 + sp.phase * 1.3) * swayAmp;
              this._dummy.position.set(sp.x, sp.y + wave, sp.z);
              this._dummy.rotation.set(swayZ, 0, swayZ * 0.5);
              this._dummy.scale.setScalar(sp.scale);
              this._dummy.updateMatrix();
              cg.torsoIM.setMatrixAt(i, this._dummy.matrix);

              this._dummy.position.set(sp.x, sp.y + wave + 0.36 * sp.scale, sp.z);
              this._dummy.rotation.set(0, swayZ * 0.8, 0);
              this._dummy.updateMatrix();
              cg.headIM.setMatrixAt(i, this._dummy.matrix);
            }
            cg.torsoIM.instanceMatrix.needsUpdate = true;
            cg.headIM.instanceMatrix.needsUpdate = true;
          }
        }

        if (this.shared.boosterTex) {
          this.shared.boosterTex.offset.y -= dt * 2.4;
        }
        if (this.waterUniforms) {
          this.waterUniforms.uTime.value = now * 0.001;
        }
        if (this.countdownMesh && this.countdownMesh.visible) {
          this.countdownAnimTime += dt;
          const ease = THREE.MathUtils.lerp(this.countdownMesh.scale.x, 1.0, Math.min(1, dt * 12));
          this.countdownMesh.scale.setScalar(ease);
        }

        for (const flag of this.flagMeshes) {
          const ph = flag.userData.phase || 0;
          flag.rotation.y = Math.sin(now * 0.0042 + ph) * 0.18;
        }

        // Gently animate claimed winner podium trophies & metallic laurel halos
        for (const slot of this.podiumSlots) {
          if (slot.mesh.visible) {
            slot.mesh.rotation.y += dt * 1.35;
            const bobY = slot.baseY + Math.sin(now * 0.003 + slot.rank) * 0.09;
            slot.mesh.position.y = bobY;
            if (slot.haloRing) {
              slot.haloRing.position.y = bobY;
              slot.haloRing.rotation.z += dt * 0.9;
            }
          }
        }

        // Expire temporary per-ball finisher notification banners cleanly
        if (this.activeFinishBanners.length > 0 && (this.raceState === 'RACING' || this.raceState === 'REPLAY' || this.raceState === 'FINISHED')) {
          let bannerChanged = false;
          for (let i = this.activeFinishBanners.length - 1; i >= 0; i--) {
            this.activeFinishBanners[i].remaining -= dt;
            if (this.activeFinishBanners[i].remaining <= 0) {
              this.activeFinishBanners.splice(i, 1);
              bannerChanged = true;
            }
          }
          if (bannerChanged) {
            this.renderBroadcastHudCanvas(true);
          }
        }

        if (now - this.lastHudUpdateAt > 75) {
          this.lastHudUpdateAt = now;
          this.updateTelemetryHud();
          this.updateLeaderboard(false);
        }

        // Update on-canvas Minimap, Live Standings & Broadcast Overlay (~30 Hz for smooth zero-jitter capture)
        this.renderBroadcastHudCanvas(false);

        this.renderActiveFrame();
      } catch (frameErr) {
        console.error('Frame tick error:', frameErr);
      }

      if (isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      this.frameId = window.setTimeout(tick, 16);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  // ==========================================================================
  // HUD, Telemetry, Leaderboard & Results
  // ==========================================================================
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const cs = Math.floor((seconds % 1) * 100);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  }

  updateTelemetryHud() {
    const shownTime =
      this.raceState === 'REPLAY' ? this.replay.currentTime : this.raceElapsedTime;
    this.dom.hudTimer.textContent = this.formatTime(shownTime);

    let finCount = this.finishedCount;
    if (this.raceState === 'REPLAY') {
      finCount = 0;
      const curT = this.replay.currentTime;
      for (const b of this.balls) {
        if (b.finishTime !== null && b.finishTime <= curT + 0.04) finCount++;
      }
    }
    this.dom.hudFinished.textContent = `${finCount} / ${this.balls.length}`;

    if (this.balls.length === 0) return;
    const sorted = [...this.balls].sort((a, b) => a.rank - b.rank);
    const leader = sorted[0];

    const pct = Math.min(
      100,
      Math.max(0, Math.round((leader.progressMeters / this.config.distanceMeters) * 100))
    );
    this.dom.hudProgressBar.style.width = `${pct}%`;
    this.dom.hudProgressPct.textContent = `${pct}%`;

    let maxSpd = 0;
    for (const b of this.balls) {
      if (b.currentSpeed > maxSpd) maxSpd = b.currentSpeed;
    }
    this.dom.hudSpeed.textContent = `${maxSpd.toFixed(1)} m/s`;

    if (this.raceState === 'READY') {
      this.dom.hudLeaderSwatch.classList.add('hidden');
      this.dom.hudLeaderName.textContent = 'Ready';
    } else {
      this.dom.hudLeaderSwatch.classList.remove('hidden');
      this.dom.hudLeaderSwatch.style.backgroundColor = leader.color;
      this.dom.hudLeaderName.textContent = leader.name;
    }
  }

  updateLeaderboard(forceRebuild) {
    const sorted = [...this.balls].sort((a, b) => a.rank - b.rank);
    const list = this.dom.leaderboardList;

    if (forceRebuild || list.children.length !== sorted.length) {
      list.innerHTML = '';
      for (const ball of sorted) {
        const row = document.createElement('div');
        row.className = 'lb-row';
        row.dataset.ballId = String(ball.id);
        row.innerHTML = `
          <span class="lb-rank mono">1</span>
          <span class="swatch-dot"></span>
          <span class="lb-name"></span>
          <span class="lb-metric mono"></span>
        `;
        list.appendChild(row);
      }
    }

    for (let i = 0; i < sorted.length; i++) {
      const ball = sorted[i];
      const row = list.children[i];
      row.dataset.ballId = String(ball.id);
      row.className = `lb-row rank-${ball.rank <= 3 ? ball.rank : 'other'}`;
      row.children[0].textContent = String(ball.rank);
      row.children[1].style.backgroundColor = ball.color;
      row.children[2].textContent = ball.name;
      const metric = row.children[3];
      if (ball.finished && ball.finishTime !== null) {
        metric.textContent = `${ball.finishTime.toFixed(2)}s`;
        metric.classList.add('finished');
      } else {
        metric.textContent = `${ball.progressMeters.toFixed(1)}m`;
        metric.classList.remove('finished');
      }
    }
  }

  showWinnerToast(ball, winnerTime = null) {
    if (!ball) return;
    const rank = ball.finishRank || 1;
    const ord = this.formatOrdinal(rank);
    const fTime = ball.finishTime !== null ? `${ball.finishTime.toFixed(2)}s` : '';
    const gap =
      rank > 1 && winnerTime !== null && ball.finishTime !== null
        ? ` (+${Math.max(0, ball.finishTime - winnerTime).toFixed(2)}s)`
        : '';
    this.dom.winnerToastSwatch.style.backgroundColor = ball.color;
    this.dom.winnerToastText.textContent =
      rank === 1
        ? `${ball.name} Wins 1st Place in ${fTime}!`
        : `${ord} Place · ${ball.name} finished in ${fTime}${gap}`;
    this.dom.winnerToast.classList.remove('hidden');
    clearTimeout(this._winnerToastTimer);
    this._winnerToastTimer = setTimeout(() => {
      this.dom.winnerToast.classList.add('hidden');
    }, 3200);
  }

  getShortQualityTag(presetKey) {
    const map = {
      standard: '1080p',
      uhd4k: '4K UHD',
      uhd8k: '8K Cinema',
      master32k: '32K Master',
    };
    return map[presetKey] || '1080p';
  }

  refreshResultsExportUi() {
    const qKey = QUALITY_PRESETS[this.recordQualityPreset] ? this.recordQualityPreset : 'standard';
    const qShort = this.getShortQualityTag(qKey);
    if (this.dom.selectExportQuality) {
      this.dom.selectExportQuality.value = qKey;
      if (isSoftwareGl) this.dom.selectExportQuality.disabled = true;
    }

    // Configure Video 1 · Full Gameplay Video Panel
    if (this.dom.videoExportPanel) {
      const hasGameplayData = this.replay.hasData() && this.recorder.isSupported();
      const hasGameplayVideo = Boolean(this.recordedVideoInfo && this.recordedVideoInfo.blob.size > 0);
      this.dom.videoExportPanel.classList.toggle('hidden', !hasGameplayVideo && !hasGameplayData && this.recorder.isSupported());

      if (!this.recorder.isSupported()) {
        this.dom.videoExportPanel.classList.remove('hidden');
        this.dom.videoExportMeta.textContent = 'Video capture unavailable in browser';
        if (this.dom.btnRenderGameplay) this.dom.btnRenderGameplay.classList.add('hidden');
        this.dom.btnExportVideo.disabled = true;
        this.dom.btnPreviewVideo.disabled = true;
      } else {
        if (hasGameplayVideo) {
          const mb = (this.recordedVideoInfo.blob.size / (1024 * 1024)).toFixed(2);
          const v1Tag = this.getShortQualityTag(this.recordedVideoQuality);
          const resLabel = `${this.recordedVideoInfo.width || 1920}×${this.recordedVideoInfo.height || 1080} · ${this.recordedVideoInfo.fps || 60}fps`;
          this.dom.videoExportMeta.textContent = `${v1Tag} · ${resLabel} · ${mb} MB · ${this.recordedVideoInfo.ext.toUpperCase()}`;
          this.dom.btnPreviewVideo.classList.remove('hidden');
          this.dom.btnExportVideo.classList.remove('hidden');
          this.dom.btnExportVideo.disabled = false;
          this.dom.btnPreviewVideo.disabled = false;
        } else {
          this.dom.videoExportMeta.textContent = `Render gameplay camera in ${qShort} + leaderboard`;
          this.dom.btnPreviewVideo.classList.add('hidden');
          this.dom.btnExportVideo.classList.add('hidden');
        }

        if (this.dom.btnRenderGameplay) {
          this.dom.btnRenderGameplay.classList.toggle('hidden', !hasGameplayData);
          const sameQuality = hasGameplayVideo && this.recordedVideoQuality === qKey;
          this.dom.btnRenderGameplay.textContent = sameQuality
            ? `Re-render ${qShort}`
            : `Render in ${qShort}`;
        }
      }
    }

    // Configure Video 2 · Cinematic Shots Recording Panel
    if (this.dom.videoExportCinematicPanel) {
      const hasCinData = this.replay.hasData() && this.cinematicRecorder.isSupported();
      this.dom.videoExportCinematicPanel.classList.toggle('hidden', !hasCinData);
      if (this.recordedCinematicInfo && this.recordedCinematicInfo.blob.size > 0) {
        const mb2 = (this.recordedCinematicInfo.blob.size / (1024 * 1024)).toFixed(2);
        const v2Tag = this.getShortQualityTag(this.recordedCinematicQuality);
        const resLabel2 = `${this.recordedCinematicInfo.width || 1920}×${this.recordedCinematicInfo.height || 1080} · ${this.recordedCinematicInfo.fps || 60}fps`;
        this.dom.videoCinematicMeta.textContent = `${v2Tag} · ${resLabel2} · ${mb2} MB · ${this.recordedCinematicInfo.ext.toUpperCase()}`;
        this.dom.btnPreviewCinematic.classList.remove('hidden');
        this.dom.btnExportCinematic.classList.remove('hidden');
        const sameCinQuality = this.recordedCinematicQuality === qKey;
        this.dom.btnRecordCinematic.textContent = sameCinQuality
          ? `Re-record ${qShort}`
          : `Record in ${qShort}`;
      } else {
        this.dom.videoCinematicMeta.textContent = `Auto-cut highlights in ${qShort} + leaderboard`;
        this.dom.btnPreviewCinematic.classList.add('hidden');
        this.dom.btnExportCinematic.classList.add('hidden');
        this.dom.btnRecordCinematic.textContent = `Record in ${qShort}`;
      }
    }
  }

  async openResultsModal() {
    if (this.recorder.isRecording) {
      this.dom.hudRecBadge.classList.add('hidden');
      this.recordedVideoInfo = await this.recorder.stop();
    }

    const sorted = [...this.balls].sort((a, b) => a.rank - b.rank);
    const winner = sorted[0];

    this.dom.resultsDuration.textContent = this.formatTime(this.raceElapsedTime);
    const trackNames = {
      straight: 'Straight',
      curved: 'Curved',
      spiral: 'Spiral',
      multilane: 'Multi-Lane',
      zigzag: 'Zig-Zag',
      rollercoaster: 'Drop & Wave',
      chicane: 'Chicanes',
      split: 'Split Track',
      mixed: 'Mixed Course',
    };
    const mapLabel = (TERRITORIES[this.config.mapPreset] || TERRITORIES.expedition).label;
    this.dom.resultsTrackInfo.textContent = `${this.config.distanceMeters}m · ${
      trackNames[this.config.trackType]
    } · ${mapLabel} · ${this.config.hurdleCount} Hurdles`;

    if (winner) {
      this.dom.winnerBadgeColor.style.backgroundColor = winner.color;
      this.dom.winnerTitle.textContent = winner.name;
      this.dom.winnerTimeLine.textContent =
        winner.finishTime !== null
          ? `Measured Finish Time: ${winner.finishTime.toFixed(2)}s · Peak Speed: ${winner.peakSpeed.toFixed(1)} m/s`
          : `Distance Reached: ${winner.progressMeters.toFixed(1)}m`;
    }

    this.refreshResultsExportUi();
    if (this.recordedVideoInfo && this.recordedVideoInfo.url) {
      this.dom.replayVideoPlayer.src = this.recordedVideoInfo.url;
    }

    this.dom.videoPreviewWrap.classList.add('hidden');
    this.dom.btnPreviewVideo.textContent = 'Preview Video 1';
    if (this.dom.btnPreviewCinematic) this.dom.btnPreviewCinematic.textContent = 'Preview Video 2';

    const winnerTime = winner?.finishTime ?? null;
    const tbody = this.dom.resultsTableBody;
    tbody.innerHTML = '';

    for (const ball of sorted) {
      const tr = document.createElement('tr');
      const timeStr =
        ball.finished && ball.finishTime !== null ? `${ball.finishTime.toFixed(2)}s` : 'In Progress';
      let gapStr = '—';
      if (ball.rank === 1 && ball.finished) {
        gapStr = 'Winner';
      } else if (ball.finished && ball.finishTime !== null && winnerTime !== null) {
        gapStr = `+${(ball.finishTime - winnerTime).toFixed(2)}s`;
      }

      tr.innerHTML = `
        <td class="mono">${ball.rank}</td>
        <td>
          <div class="results-ball-cell">
            <span class="swatch-dot" style="background-color: ${ball.color}"></span>
            <span>${ball.name}</span>
          </div>
        </td>
        <td class="mono">${Math.min(this.config.distanceMeters, ball.progressMeters).toFixed(1)} m</td>
        <td class="mono">${ball.peakSpeed.toFixed(1)} m/s</td>
        <td class="mono">${timeStr}</td>
        <td class="mono">${gapStr}</td>
      `;
      tbody.appendChild(tr);
    }

    if (this.dom.btnResultsCinematicReplay) {
      this.dom.btnResultsCinematicReplay.classList.toggle('hidden', !this.replay.hasData());
    }
    this.dom.resultsModal.classList.remove('hidden');
  }

  exportGameVideo(which = 'gameplay') {
    const info = which === 'cinematic' ? this.recordedCinematicInfo : this.recordedVideoInfo;
    if (!info || !info.url) return;
    const qKey = which === 'cinematic' ? this.recordedCinematicQuality : this.recordedVideoQuality;
    const a = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const suffix = which === 'cinematic' ? 'cinematic-shots' : 'gameplay';
    a.href = info.url;
    a.download = `marble-rush-${suffix}-${qKey || 'standard'}-${stamp}.${info.ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // ==========================================================================
  // UI Binding & Synchronization
  // ==========================================================================
  syncUiState() {
    const s = this.raceState;
    const isReplay = s === 'REPLAY';
    this.dom.btnStart.classList.toggle('hidden', s !== 'READY' && s !== 'FINISHED');
    this.dom.btnPause.classList.toggle('hidden', s !== 'RACING');
    this.dom.btnResume.classList.toggle('hidden', s !== 'PAUSED');
    this.dom.btnStart.textContent = s === 'FINISHED' ? 'Race Again' : 'Start Race';

    if (this.dom.leaderboardPanel) {
      const useCanvasBroadcast =
        s === 'COUNTDOWN' || s === 'RACING' || s === 'REPLAY' || s === 'FINISHED';
      this.dom.leaderboardPanel.classList.toggle('hidden-for-broadcast', useCanvasBroadcast);
    }

    if (this.dom.btnCinematicReplay) {
      this.dom.btnCinematicReplay.classList.toggle('hidden', isReplay || !this.replay.hasData());
    }
    if (this.dom.cameraDock) {
      this.dom.cameraDock.classList.toggle('hidden', isReplay);
    }
    if (this.dom.replayDock) {
      this.dom.replayDock.classList.toggle('hidden', !isReplay);
    }
    if (this.dom.hudReplayBadge) {
      this.dom.hudReplayBadge.classList.toggle('hidden', !isReplay);
    }
    if (this.dom.btnReplayRecord) {
      const recOn = isReplay && this.isRecordingCinematic && this.cinematicRecorder.isRecording;
      this.dom.btnReplayRecord.classList.toggle('recording', recOn);
      this.dom.btnReplayRecord.textContent = recOn
        ? 'REC Video 2...'
        : this.recordedCinematicInfo
          ? 'Re-record Video 2'
          : 'Record Video 2';
    }

    // Camera mode select, Follow-Up Angle select, Director shot tag & Free Cam
    if (this.dom.selectCameraMode) {
      this.dom.selectCameraMode.value = this.cameraMode;
    }
    if (this.dom.selectFollowAngle) {
      const showCycle = !isReplay && this.cameraMode === 'leader';
      this.dom.selectFollowAngle.classList.toggle('hidden', !showCycle);
      this.dom.selectFollowAngle.value = String(this.followShotAngle);
    }
    if (this.dom.cameraShotLabel) {
      this.dom.cameraShotLabel.classList.toggle('hidden', isReplay || this.cameraMode !== 'director');
      this.dom.cameraShotLabel.textContent = this.directorState.shotName;
    }
    if (this.dom.freeCamBar) {
      const showFreeBar =
        (!isReplay && this.cameraMode === 'free') ||
        (isReplay && !this.replay.autoDirector && !this.isRecordingGameplayPass);
      this.dom.freeCamBar.classList.toggle('hidden', !showFreeBar);
    }
    if (this.dom.btnToggleMusic) {
      this.dom.btnToggleMusic.textContent = this.sound.musicEnabled ? 'Music' : 'Music Off';
      this.dom.btnToggleMusic.classList.toggle('active', this.sound.musicEnabled);
    }
    if (this.dom.btnToggleSound) {
      this.dom.btnToggleSound.textContent = this.sound.enabled ? 'Sound' : 'Sound Off';
      this.dom.btnToggleSound.classList.toggle('active', this.sound.enabled);
    }
    if (this.dom.selectQuality) {
      this.dom.selectQuality.value = this.qualityPreset;
      if (isSoftwareGl) this.dom.selectQuality.disabled = true;
    }
    if (this.dom.selectReplayQuality) {
      this.dom.selectReplayQuality.value = this.recordQualityPreset;
      if (isSoftwareGl) this.dom.selectReplayQuality.disabled = true;
    }
    if (this.dom.selectExportQuality) {
      this.dom.selectExportQuality.value = this.recordQualityPreset;
      if (isSoftwareGl) this.dom.selectExportQuality.disabled = true;
    }

    if (this.dom.selectReplaySpeed) {
      this.dom.selectReplaySpeed.value = String(this.replay.playbackSpeed);
    }
    if (this.dom.inputReplaySlowmo) {
      this.dom.inputReplaySlowmo.checked = this.replay.autoSlowMo;
    }
    if (this.dom.inputReplayAutocam) {
      this.dom.inputReplayAutocam.checked = this.replay.autoDirector;
    }
    if (isReplay) {
      this.updateReplayHud(false);
    }
  }

  applyEffectiveRenderQuality() {
    if (isSoftwareGl) return;
    const key = this.getEffectiveQualityPresetKey();
    const qCfg = QUALITY_PRESETS[key] || QUALITY_PRESETS.standard;
    this.adaptivePrScale = 1.0;
    this.slowFrameCount = 0;

    if (this.keyLight && this.renderer) {
      const maxTex = this.renderer.capabilities.maxTextureSize || 4096;
      const shadowRes = Math.min(qCfg.shadowSize, maxTex);
      if (
        this.keyLight.shadow.mapSize.x !== shadowRes ||
        this.keyLight.shadow.mapSize.y !== shadowRes
      ) {
        this.keyLight.shadow.mapSize.set(shadowRes, shadowRes);
        if (this.keyLight.shadow.map) {
          this.keyLight.shadow.map.dispose();
          this.keyLight.shadow.map = null;
        }
        this.keyLight.shadow.needsUpdate = true;
      }
    }

    this.onResize();
  }

  setQualityPreset(presetKey) {
    if (isSoftwareGl) return;
    this.qualityPreset = QUALITY_PRESETS[presetKey] ? presetKey : 'standard';
    this.applyEffectiveRenderQuality();
    this.syncUiState();
  }

  setRecordQualityPreset(presetKey) {
    if (isSoftwareGl) return;
    this.recordQualityPreset = QUALITY_PRESETS[presetKey] ? presetKey : 'standard';
    this.syncUiState();
    this.refreshResultsExportUi();
  }

  cycleFollowShot() {
    this.followShotAngle = (this.followShotAngle + 1) % FOLLOW_SHOT_ANGLES.length;
    this.sound.playCameraCut();
    this.syncUiState();
  }

  setConfigDrawerOpen(open) {
    this.dom.configDrawer.classList.toggle('collapsed', !open);
    this.dom.btnToggleConfig.setAttribute('aria-expanded', String(open));
    this.dom.btnToggleConfig.textContent = open ? 'Hide Setup' : 'Setup';
  }

  setCameraMode(mode) {
    const prevMode = this.cameraMode;
    this.cameraMode = mode;
    if (mode === 'director' && prevMode !== 'director') {
      this.directorState.cutAt = 0;
      this.directorState.hasFixedPos = false;
    }
    if (mode === 'free' && prevMode !== 'free') {
      this.controls.target.copy(this.smoothCamTarget);
      this.controls.update();
    }
    if (mode !== prevMode) {
      this.sound.playCameraCut();
    }
    this.syncUiState();
  }

  renderBallColorEditor() {
    const container = this.dom.ballListContainer;
    this.dom.ballCountCaption.textContent = `${this.config.ballCount} balls`;
    container.innerHTML = '';

    for (let i = 0; i < this.config.ballCount; i++) {
      const hex = this.ballColors[i] || '#f59e0b';
      const row = document.createElement('div');
      row.className = 'ball-row';

      const left = document.createElement('div');
      left.className = 'ball-row-left';

      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.className = 'ball-color-input';
      colorInput.value = hex;
      colorInput.setAttribute('aria-label', `Color for Ball #${i + 1}`);
      colorInput.addEventListener('input', (e) => {
        this.updateSingleBallColor(i, e.target.value, colorInput, hexLabel);
      });

      const idLabel = document.createElement('span');
      idLabel.className = 'ball-id-label';
      idLabel.textContent = `Ball #${String(i + 1).padStart(2, '0')}`;

      const hexLabel = document.createElement('span');
      hexLabel.className = 'ball-hex-label mono';
      hexLabel.textContent = hex.toUpperCase();

      left.append(colorInput, idLabel, hexLabel);
      row.append(left);
      container.appendChild(row);
    }
  }

  updateSingleBallColor(index, newHex, inputEl, hexLabel) {
    const normalized = newHex.toLowerCase();
    if (!this.config.allowDuplicateColors) {
      const existingIdx = this.ballColors
        .slice(0, this.config.ballCount)
        .findIndex((c, idx) => idx !== index && c.toLowerCase() === normalized);
      if (existingIdx !== -1) {
        // Swap colors cleanly so uniqueness is always preserved
        const prevColor = this.ballColors[index];
        this.ballColors[existingIdx] = prevColor;
        if (this.balls[existingIdx]) {
          this.balls[existingIdx].color = prevColor;
          setRichMarbleColor(this.balls[existingIdx].mesh.material.color, prevColor);
        }
        this.ballColors[index] = normalized;
        if (this.balls[index]) {
          this.balls[index].color = normalized;
          setRichMarbleColor(this.balls[index].mesh.material.color, normalized);
        }
        this.renderBallColorEditor();
        this.updateLeaderboard(false);
        return;
      }
    }

    this.ballColors[index] = normalized;
    hexLabel.textContent = normalized.toUpperCase();
    if (this.balls[index]) {
      this.balls[index].color = normalized;
      setRichMarbleColor(this.balls[index].mesh.material.color, normalized);
    }
    this.updateLeaderboard(false);
  }

  syncSettingsControlsToDom() {
    this.dom.inputBallCount.value = String(this.config.ballCount);
    this.dom.inputBallCountNum.value = String(this.config.ballCount);
    this.dom.valBallCount.textContent = String(this.config.ballCount);

    this.dom.inputBallSpeed.value = String(this.config.speedMultiplier);
    this.dom.valBallSpeed.textContent = `${this.config.speedMultiplier.toFixed(1)}x`;

    if (this.dom.selectDistance) this.dom.selectDistance.value = this.config.distancePreset;
    this.dom.customDistanceWrap.classList.toggle(
      'hidden',
      this.config.distancePreset !== 'custom'
    );
    if (this.config.distancePreset === 'custom') {
      this.dom.inputCustomDistance.value = String(this.config.distanceMeters);
    }

    if (this.dom.selectDarkness) this.dom.selectDarkness.value = this.config.colorDarkness;
    if (this.dom.selectMap) this.dom.selectMap.value = this.config.mapPreset;
    this.dom.inputCycleMap.checked = this.config.cycleMapOnNewTrack;

    if (this.dom.selectTrack) this.dom.selectTrack.value = this.config.trackType;

    this.dom.inputTrackWidth.value = String(this.config.trackWidth);
    this.dom.valTrackWidth.textContent = `${this.config.trackWidth} m`;

    if (this.dom.selectGravity) this.dom.selectGravity.value = this.config.gravityPreset;
    if (this.dom.selectFriction) this.dom.selectFriction.value = this.config.frictionPreset;
    this.dom.inputExperimentalVariance.checked = this.config.experimentalVariance;

    this.dom.inputHurdleCount.value = String(this.config.hurdleCount);
    this.dom.inputHurdleCountNum.value = String(this.config.hurdleCount);
    this.dom.valHurdleCount.textContent = String(this.config.hurdleCount);

    if (this.dom.selectHurdleSize) this.dom.selectHurdleSize.value = this.config.hurdleSize;
    this.dom.inputRandomHurdles.checked = this.config.randomHurdles;

    this.dom.obstacleTypesList.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.checked = this.config.enabledObstacles.has(cb.value);
    });

    if (this.dom.selectPalette) this.dom.selectPalette.value = this.config.palette;
    this.dom.inputAllowDuplicates.checked = this.config.allowDuplicateColors;
    if (this.dom.inputMusicEnabled) this.dom.inputMusicEnabled.checked = this.sound.musicEnabled;
    if (this.dom.inputSoundEnabled) this.dom.inputSoundEnabled.checked = this.sound.enabled;
  }

  bindUiEvents() {
    this.dom.btnRetryInit.addEventListener('click', () => window.location.reload());

    // Unlock gentle background chord music on first user gesture
    window.addEventListener(
      'pointerdown',
      () => {
        if (this.sound.musicEnabled) this.sound.ensureContext(true);
      },
      { once: true }
    );

    // Drawer tabs
    document.querySelectorAll('.tab-btn').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach((t) => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        document.getElementById(tab.dataset.tab).classList.add('active');
      });
    });

    this.dom.btnToggleConfig.addEventListener('click', () => {
      const isCollapsed = this.dom.configDrawer.classList.contains('collapsed');
      this.setConfigDrawerOpen(isCollapsed);
    });

    this.dom.btnToggleLeaderboard.addEventListener('click', () => {
      const collapsed = this.dom.leaderboardPanel.classList.toggle('collapsed');
      this.dom.btnToggleLeaderboard.textContent = collapsed ? 'Show' : 'Hide';
    });

    // Transport buttons
    this.dom.btnStart.addEventListener('click', () => this.startRace());
    this.dom.btnPause.addEventListener('click', () => this.pauseRace());
    this.dom.btnResume.addEventListener('click', () => this.resumeRace());
    this.dom.btnRestart.addEventListener('click', () => this.restartRace());
    this.dom.btnGenerateTrack.addEventListener('click', () => this.generateNewTrack());
    this.dom.btnRandomizeColors.addEventListener('click', () => this.randomizeBallColors());
    this.dom.btnResetSettings.addEventListener('click', () => this.resetSettings());

    this.dom.btnViewResults.addEventListener('click', () => this.openResultsModal());

    if (this.dom.selectQuality) {
      this.dom.selectQuality.addEventListener('change', (e) => {
        this.setQualityPreset(e.target.value);
      });
    }

    const applyMusicToggle = (enabled) => {
      this.sound.setMusicEnabled(enabled);
      if (this.dom.inputMusicEnabled) this.dom.inputMusicEnabled.checked = this.sound.musicEnabled;
      this.syncUiState();
    };
    if (this.dom.btnToggleMusic) {
      this.dom.btnToggleMusic.addEventListener('click', () => {
        applyMusicToggle(!this.sound.musicEnabled);
      });
    }
    if (this.dom.inputMusicEnabled) {
      this.dom.inputMusicEnabled.addEventListener('change', (e) => {
        applyMusicToggle(e.target.checked);
      });
    }

    const applySoundToggle = (enabled) => {
      this.sound.enabled = Boolean(enabled);
      if (this.sound.enabled) this.sound.ensureContext(true);
      else this.sound.updateRollingBed(0, false);
      if (this.dom.inputSoundEnabled) this.dom.inputSoundEnabled.checked = this.sound.enabled;
      this.syncUiState();
    };
    this.dom.btnToggleSound.addEventListener('click', () => {
      applySoundToggle(!this.sound.enabled);
    });
    if (this.dom.inputSoundEnabled) {
      this.dom.inputSoundEnabled.addEventListener('change', (e) => {
        applySoundToggle(e.target.checked);
      });
    }

    // Ball count
    const applyBallCount = (val) => {
      const clamped = Math.max(2, Math.min(50, Math.round(Number(val) || 10)));
      this.config.ballCount = clamped;
      // Ensure colors array covers up to clamped count without duplicates
      const used = new Set(this.ballColors.slice(0, clamped).map((c) => c.toLowerCase()));
      while (this.ballColors.length < clamped) {
        const nextIdx = this.ballColors.length;
        const base = COLOR_PALETTES[this.config.palette] || COLOR_PALETTES.grandprix;
        let cand = base[nextIdx % base.length].toLowerCase();
        if (!this.config.allowDuplicateColors && used.has(cand)) {
          cand = generateDistinctColor(nextIdx, used, this.config.palette);
        }
        used.add(cand);
        this.ballColors.push(cand);
      }
      this.syncSettingsControlsToDom();
      this.renderBallColorEditor();
      this.rebuildTrackAndRace({ preserveCamera: false });
    };
    this.dom.inputBallCount.addEventListener('input', (e) => {
      this.dom.valBallCount.textContent = e.target.value;
      this.dom.inputBallCountNum.value = e.target.value;
    });
    this.dom.inputBallCount.addEventListener('change', (e) => applyBallCount(e.target.value));
    this.dom.inputBallCountNum.addEventListener('change', (e) => applyBallCount(e.target.value));

    // Ball speed
    const applySpeed = (val) => {
      this.config.speedMultiplier = THREE.MathUtils.clamp(Number(val) || 1.0, 0.5, 3.0);
      this.syncSettingsControlsToDom();
    };
    this.dom.inputBallSpeed.addEventListener('input', (e) => applySpeed(e.target.value));

    // Finish-line distance
    if (this.dom.selectDistance) {
      this.dom.selectDistance.addEventListener('change', (e) => {
        const preset = e.target.value;
        this.config.distancePreset = preset;
        if (preset !== 'custom') {
          this.config.distanceMeters = Number(preset);
        } else {
          this.config.distanceMeters = THREE.MathUtils.clamp(
            Number(this.dom.inputCustomDistance.value) || 120,
            30,
            350
          );
        }
        this.syncSettingsControlsToDom();
        this.rebuildTrackAndRace({ preserveCamera: false });
      });
    }
    this.dom.inputCustomDistance.addEventListener('change', (e) => {
      this.config.distancePreset = 'custom';
      this.config.distanceMeters = THREE.MathUtils.clamp(Number(e.target.value) || 120, 30, 350);
      e.target.value = String(this.config.distanceMeters);
      this.syncSettingsControlsToDom();
      this.rebuildTrackAndRace({ preserveCamera: false });
    });

    // Colour Depth preset
    if (this.dom.selectDarkness) {
      this.dom.selectDarkness.addEventListener('change', (e) => {
        this.config.colorDarkness = e.target.value;
        this.syncSettingsControlsToDom();
        this.rebuildTrackAndRace({ preserveCamera: true });
      });
    }

    // Arena Map & Environment presets
    if (this.dom.selectMap) {
      this.dom.selectMap.addEventListener('change', (e) => {
        this.config.mapPreset = e.target.value;
        this.syncSettingsControlsToDom();
        this.rebuildTrackAndRace({ preserveCamera: true });
      });
    }
    this.dom.inputCycleMap.addEventListener('change', (e) => {
      this.config.cycleMapOnNewTrack = e.target.checked;
    });

    // Track type
    if (this.dom.selectTrack) {
      this.dom.selectTrack.addEventListener('change', (e) => {
        this.config.trackType = e.target.value;
        this.syncSettingsControlsToDom();
        this.rebuildTrackAndRace({ preserveCamera: false });
      });
    }

    // Track width
    this.dom.inputTrackWidth.addEventListener('input', (e) => {
      this.dom.valTrackWidth.textContent = `${e.target.value} m`;
    });
    this.dom.inputTrackWidth.addEventListener('change', (e) => {
      this.config.trackWidth = THREE.MathUtils.clamp(Number(e.target.value) || 10, 6, 16);
      this.syncSettingsControlsToDom();
      this.rebuildTrackAndRace({ preserveCamera: false });
    });

    // Gravity & Friction
    if (this.dom.selectGravity) {
      this.dom.selectGravity.addEventListener('change', (e) => {
        this.config.gravityPreset = e.target.value;
        this.syncSettingsControlsToDom();
        this.rebuildTrackAndRace({ preserveCamera: true });
      });
    }
    if (this.dom.selectFriction) {
      this.dom.selectFriction.addEventListener('change', (e) => {
        this.config.frictionPreset = e.target.value;
        this.syncSettingsControlsToDom();
        this.rebuildTrackAndRace({ preserveCamera: true });
      });
    }

    this.dom.inputExperimentalVariance.addEventListener('change', (e) => {
      this.config.experimentalVariance = e.target.checked;
      this.rebuildTrackAndRace({ preserveCamera: true });
    });

    // Hurdles
    const applyHurdleCount = (val) => {
      this.config.hurdleCount = THREE.MathUtils.clamp(Math.round(Number(val) || 0), 0, 30);
      this.syncSettingsControlsToDom();
      this.rebuildTrackAndRace({ preserveCamera: true });
    };
    this.dom.inputHurdleCount.addEventListener('input', (e) => {
      this.dom.valHurdleCount.textContent = e.target.value;
      this.dom.inputHurdleCountNum.value = e.target.value;
    });
    this.dom.inputHurdleCount.addEventListener('change', (e) => applyHurdleCount(e.target.value));
    this.dom.inputHurdleCountNum.addEventListener('change', (e) => applyHurdleCount(e.target.value));

    if (this.dom.selectHurdleSize) {
      this.dom.selectHurdleSize.addEventListener('change', (e) => {
        this.config.hurdleSize = e.target.value;
        this.syncSettingsControlsToDom();
        this.rebuildTrackAndRace({ preserveCamera: true });
      });
    }

    this.dom.inputRandomHurdles.addEventListener('change', (e) => {
      this.config.randomHurdles = e.target.checked;
      this.rebuildTrackAndRace({ preserveCamera: true });
    });

    this.dom.obstacleTypesList.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener('change', () => {
        if (cb.checked) this.config.enabledObstacles.add(cb.value);
        else this.config.enabledObstacles.delete(cb.value);
        this.rebuildTrackAndRace({ preserveCamera: true });
      });
    });

    this.dom.btnObstaclesAll.addEventListener('click', () => {
      this.config.enabledObstacles = new Set(ALL_OBSTACLE_TYPES);
      this.syncSettingsControlsToDom();
      this.rebuildTrackAndRace({ preserveCamera: true });
    });
    this.dom.btnObstaclesNone.addEventListener('click', () => {
      this.config.enabledObstacles.clear();
      this.syncSettingsControlsToDom();
      this.rebuildTrackAndRace({ preserveCamera: true });
    });

    // Ball color presets & duplicate toggle
    if (this.dom.selectPalette) {
      this.dom.selectPalette.addEventListener('change', (e) => {
        this.config.palette = e.target.value;
        this.ballColors = buildBallColorsForPalette(
          this.config.palette,
          this.config.ballCount,
          this.config.allowDuplicateColors
        );
        for (let i = 0; i < this.balls.length; i++) {
          this.balls[i].color = this.ballColors[i];
          setRichMarbleColor(this.balls[i].mesh.material.color, this.ballColors[i]);
        }
        this.syncSettingsControlsToDom();
        this.renderBallColorEditor();
        this.updateLeaderboard(false);
      });
    }

    this.dom.inputAllowDuplicates.addEventListener('change', (e) => {
      this.config.allowDuplicateColors = e.target.checked;
      if (!this.config.allowDuplicateColors) {
        // Deduplicate any existing duplicate colors
        const used = new Set();
        for (let i = 0; i < this.config.ballCount; i++) {
          let c = (this.ballColors[i] || '#f59e0b').toLowerCase();
          if (used.has(c)) {
            c = generateDistinctColor(i, used, this.config.palette);
            this.ballColors[i] = c;
            if (this.balls[i]) {
              this.balls[i].color = c;
              setRichMarbleColor(this.balls[i].mesh.material.color, c);
            }
          }
          used.add(c);
        }
        this.renderBallColorEditor();
        this.updateLeaderboard(false);
      }
    });

    // Camera modes, Follow-Up Angle dropdown & Clean HUD toggle
    if (this.dom.selectCameraMode) {
      this.dom.selectCameraMode.addEventListener('change', (e) => {
        this.setCameraMode(e.target.value);
      });
    }
    if (this.dom.selectFollowAngle) {
      this.dom.selectFollowAngle.addEventListener('change', (e) => {
        this.followShotAngle = Number(e.target.value) || 0;
        this.sound.playCameraCut();
        this.syncUiState();
      });
    }

    const toggleZenHud = () => {
      this.hudHidden = !this.hudHidden;
      this.dom.hudRoot.classList.toggle('zen-hidden', this.hudHidden);
      this.dom.btnShowHud.classList.toggle('hidden', !this.hudHidden);
      this.syncUiState();
    };
    this.dom.btnHideHud.addEventListener('click', toggleZenHud);
    this.dom.btnShowHud.addEventListener('click', toggleZenHud);

    // Results modal actions & dual video export (Video 1 Gameplay + Video 2 Cinematic)
    let activePreviewKind = null;
    const toggleVideoPreview = (kind) => {
      const info = kind === 'cinematic' ? this.recordedCinematicInfo : this.recordedVideoInfo;
      if (!info || !info.url) return;
      const isShowingSame =
        !this.dom.videoPreviewWrap.classList.contains('hidden') && activePreviewKind === kind;
      if (isShowingSame) {
        this.dom.videoPreviewWrap.classList.add('hidden');
        this.dom.replayVideoPlayer.pause();
        activePreviewKind = null;
      } else {
        activePreviewKind = kind;
        this.dom.replayVideoPlayer.src = info.url;
        this.dom.videoPreviewWrap.classList.remove('hidden');
        this.dom.replayVideoPlayer.play().catch(() => {});
      }
      this.dom.btnPreviewVideo.textContent =
        activePreviewKind === 'gameplay' ? 'Hide Preview' : 'Preview Video 1';
      if (this.dom.btnPreviewCinematic) {
        this.dom.btnPreviewCinematic.textContent =
          activePreviewKind === 'cinematic' ? 'Hide Preview' : 'Preview Video 2';
      }
    };

    this.dom.btnExportVideo.addEventListener('click', () => this.exportGameVideo('gameplay'));
    this.dom.btnPreviewVideo.addEventListener('click', () => toggleVideoPreview('gameplay'));

    if (this.dom.selectExportQuality) {
      this.dom.selectExportQuality.addEventListener('change', (e) => {
        this.setRecordQualityPreset(e.target.value);
      });
    }
    if (this.dom.selectReplayQuality) {
      this.dom.selectReplayQuality.addEventListener('change', (e) => {
        this.setRecordQualityPreset(e.target.value);
      });
    }
    if (this.dom.btnRenderGameplay) {
      this.dom.btnRenderGameplay.addEventListener('click', () => {
        this.enterReplayMode(0, { autoRecord: true, recordMode: 'gameplay' });
      });
    }

    if (this.dom.btnRecordCinematic) {
      this.dom.btnRecordCinematic.addEventListener('click', () => {
        this.enterReplayMode(0, { autoRecord: true, recordMode: 'cinematic' });
      });
    }
    if (this.dom.btnPreviewCinematic) {
      this.dom.btnPreviewCinematic.addEventListener('click', () => toggleVideoPreview('cinematic'));
    }
    if (this.dom.btnExportCinematic) {
      this.dom.btnExportCinematic.addEventListener('click', () => this.exportGameVideo('cinematic'));
    }

    this.dom.btnResultsRaceAgain.addEventListener('click', () => {
      this.dom.replayVideoPlayer.pause();
      this.dom.resultsModal.classList.add('hidden');
      this.startRace();
    });
    this.dom.btnResultsNewTrack.addEventListener('click', () => {
      this.dom.replayVideoPlayer.pause();
      this.dom.resultsModal.classList.add('hidden');
      this.generateNewTrack();
    });
    this.dom.btnResultsSettings.addEventListener('click', () => {
      this.dom.replayVideoPlayer.pause();
      this.resultsDismissed = true;
      this.dom.resultsModal.classList.add('hidden');
      this.setConfigDrawerOpen(true);
    });

    // Cinematic Replay Controls & Interactive Highlight Timeline
    if (this.dom.btnCinematicReplay) {
      this.dom.btnCinematicReplay.addEventListener('click', () => this.enterReplayMode(0));
    }
    if (this.dom.btnResultsCinematicReplay) {
      this.dom.btnResultsCinematicReplay.addEventListener('click', () => this.enterReplayMode(0));
    }
    if (this.dom.btnReplayRecord) {
      this.dom.btnReplayRecord.addEventListener('click', () => {
        if (this.raceState !== 'REPLAY') return;
        this.enterReplayMode(0, { autoRecord: true });
      });
    }
    if (this.dom.btnReplayExit) {
      this.dom.btnReplayExit.addEventListener('click', () => this.exitReplayMode(false));
    }
    if (this.dom.btnReplayPlay) {
      this.dom.btnReplayPlay.addEventListener('click', () => {
        if (this.raceState !== 'REPLAY') return;
        if (!this.replay.isPlaying && this.replay.currentTime >= this.replay.totalDuration - 0.05) {
          this.replay.isPlaying = true;
          this.seekReplay(0);
        } else {
          this.replay.isPlaying = !this.replay.isPlaying;
          if (!this.replay.isPlaying) this.sound.updateRollingBed(0, false);
        }
        this.syncUiState();
      });
    }
    if (this.dom.btnReplayPrevHl) {
      this.dom.btnReplayPrevHl.addEventListener('click', () => this.jumpToReplayHighlight(-1));
    }
    if (this.dom.btnReplayNextHl) {
      this.dom.btnReplayNextHl.addEventListener('click', () => this.jumpToReplayHighlight(1));
    }
    if (this.dom.selectReplaySpeed) {
      this.dom.selectReplaySpeed.addEventListener('change', (e) => {
        this.replay.playbackSpeed = Number(e.target.value) || 1;
        this.syncUiState();
      });
    }
    if (this.dom.inputReplaySlowmo) {
      this.dom.inputReplaySlowmo.addEventListener('change', (e) => {
        this.replay.autoSlowMo = e.target.checked;
        this.syncUiState();
      });
    }
    if (this.dom.inputReplayAutocam) {
      this.dom.inputReplayAutocam.addEventListener('change', (e) => {
        this.replay.autoDirector = e.target.checked;
        if (!this.replay.autoDirector) {
          this.controls.target.copy(this.smoothCamTarget);
          this.controls.update();
        } else {
          this.replay.activeShotIdx = -1;
          this.directorState.justCut = true;
        }
        this.syncUiState();
      });
    }
    if (this.dom.replayScrubberWrap) {
      let isScrubbing = false;
      const scrubFromPointer = (clientX) => {
        const rect = this.dom.replayScrubberWrap.getBoundingClientRect();
        const frac = THREE.MathUtils.clamp((clientX - rect.left) / Math.max(1, rect.width), 0, 1);
        this.seekReplay(frac * this.replay.totalDuration);
      };
      this.dom.replayScrubberWrap.addEventListener('pointerdown', (e) => {
        isScrubbing = true;
        try {
          this.dom.replayScrubberWrap.setPointerCapture(e.pointerId);
        } catch {
          // Ignore capture errors
        }
        scrubFromPointer(e.clientX);
      });
      this.dom.replayScrubberWrap.addEventListener('pointermove', (e) => {
        if (!isScrubbing) return;
        scrubFromPointer(e.clientX);
      });
      const stopScrub = () => {
        isScrubbing = false;
      };
      this.dom.replayScrubberWrap.addEventListener('pointerup', stopScrub);
      this.dom.replayScrubberWrap.addEventListener('pointercancel', stopScrub);
    }

    // Free camera quick actions
    this.dom.btnFreeFocusLeader.addEventListener('click', () => this.snapFreeCamToPack());
    this.dom.btnFreeCenterTrack.addEventListener('click', () => this.centerFreeCamOnTrack());

    // Keyboard shortcuts & Free Camera WASD/QE movement
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (
        (this.cameraMode === 'free' || (this.raceState === 'REPLAY' && !this.replay.autoDirector)) &&
        (e.code === 'Space' || e.code.startsWith('Arrow'))
      ) {
        e.preventDefault();
      }
      this.keysPressed.add(e.code);

      if (!e.repeat && (e.key === 'h' || e.key === 'H')) toggleZenHud();
      else if (
        !e.repeat &&
        (e.key === 'd' || e.key === 'D') &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        (e.shiftKey || !(this.cameraMode === 'free' || (this.raceState === 'REPLAY' && !this.replay.autoDirector)))
      ) {
        this.togglePhysicsDebug();
      }
      else if (this.raceState === 'REPLAY' && e.code === 'Escape') {
        this.exitReplayMode(false);
      } else if (this.raceState === 'REPLAY' && e.code === 'Space' && this.replay.autoDirector) {
        e.preventDefault();
        if (!this.replay.isPlaying && this.replay.currentTime >= this.replay.totalDuration - 0.05) {
          this.replay.isPlaying = true;
          this.seekReplay(0);
        } else {
          this.replay.isPlaying = !this.replay.isPlaying;
          if (!this.replay.isPlaying) this.sound.updateRollingBed(0, false);
        }
        this.syncUiState();
      } else if (this.raceState === 'REPLAY' && e.code === 'ArrowLeft' && this.replay.autoDirector) {
        e.preventDefault();
        if (e.shiftKey) this.jumpToReplayHighlight(-1);
        else this.seekReplay(this.replay.currentTime - 1.5);
      } else if (this.raceState === 'REPLAY' && e.code === 'ArrowRight' && this.replay.autoDirector) {
        e.preventDefault();
        if (e.shiftKey) this.jumpToReplayHighlight(1);
        else this.seekReplay(this.replay.currentTime + 1.5);
      } else if (e.key === '1') this.setCameraMode('overview');
      else if (e.key === '2') this.setCameraMode('director');
      else if (e.key === '3') this.setCameraMode('leader');
      else if (e.key === '4') this.setCameraMode('topdown');
      else if (e.key === '5') this.setCameraMode('drone_top');
      else if (e.key === '6') this.setCameraMode('drone_side');
      else if (e.key === '7') this.setCameraMode('finish');
      else if (e.key === '8') this.setCameraMode('free');
      else if ((e.key === 'c' || e.key === 'C') && this.cameraMode === 'leader') {
        this.cycleFollowShot();
      } else if (e.code === 'Space' && this.cameraMode !== 'free') {
        e.preventDefault();
        if (this.raceState === 'RACING') this.pauseRace();
        else if (this.raceState === 'PAUSED') this.resumeRace();
        else if (this.raceState === 'READY') this.startRace();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keysPressed.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keysPressed.clear();
    });
  }
}

// Boot simulator
const app = new MarbleRushApp();
app.init();
