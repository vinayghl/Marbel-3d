import * as THREE from 'https://esm.sh/three@0.170.0';
import { OrbitControls } from 'https://esm.sh/three@0.170.0/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'https://esm.sh/three@0.170.0/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'https://esm.sh/three@0.170.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://esm.sh/three@0.170.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://esm.sh/three@0.170.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'https://esm.sh/three@0.170.0/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'https://esm.sh/three@0.170.0/examples/jsm/postprocessing/OutputPass.js';
import RAPIER from 'https://esm.sh/@dimforge/rapier3d-compat@0.14.0';

// ============================================================================
// Constants, Post-Processing Shaders & Presets
// ============================================================================
const BALL_RADIUS = 0.4;
const FIXED_DT = 1 / 120;
const MAX_SUBSTEPS_PER_FRAME = 10;
const FOLLOW_SHOT_ANGLES = ['Chase', 'Low Bumper', 'Side Drone', 'Reverse Cam'];

const CinematicLensShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTexelSize: { value: new THREE.Vector2(1 / 1920, 1 / 1080) },
    uSharpness: { value: 0.24 },
    uAberration: { value: 0.0012 },
    uVignette: { value: 0.16 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 uTexelSize;
    uniform float uSharpness;
    uniform float uAberration;
    uniform float uVignette;
    varying vec2 vUv;

    void main() {
      vec2 offset = vUv - 0.5;
      float radial = dot(offset, offset);

      // Subtle optical edge chromatic dispersion scaled by speed (UVs clamped cleanly)
      vec2 ca = offset * uAberration * (0.4 + radial * 2.4);
      vec3 base = texture2D(tDiffuse, vUv).rgb;
      float r = texture2D(tDiffuse, clamp(vUv + ca, 0.001, 0.999)).r;
      float b = texture2D(tDiffuse, clamp(vUv - ca, 0.001, 0.999)).b;
      vec3 col = vec3(r, base.g, b);

      // 4K crispness unsharp clarity filter in linear space
      if (uSharpness > 0.001) {
        vec3 n = texture2D(tDiffuse, clamp(vUv + vec2(0.0, uTexelSize.y), 0.001, 0.999)).rgb;
        vec3 s = texture2D(tDiffuse, clamp(vUv - vec2(0.0, uTexelSize.y), 0.001, 0.999)).rgb;
        vec3 e = texture2D(tDiffuse, clamp(vUv + vec2(uTexelSize.x, 0.0), 0.001, 0.999)).rgb;
        vec3 w = texture2D(tDiffuse, clamp(vUv - vec2(uTexelSize.x, 0.0), 0.001, 0.999)).rgb;
        vec3 blur = (n + s + e + w) * 0.25;
        vec3 detail = clamp(col - blur, -0.14, 0.14);
        col += detail * uSharpness;
      }

      // Clean broadcast optical vignette (preserve HDR highlights for OutputPass)
      float vig = 1.0 - smoothstep(0.28, 0.95, radial * 1.65) * uVignette;
      col *= vig;
      gl_FragColor = vec4(clamp(col, vec3(0.0), vec3(32.0)), 1.0);
    }
  `,
};

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
    '#ff2a54', '#00e5ff', '#ffe600', '#00ff88', '#ff7b00',
    '#b366ff', '#ffffff', '#ff00aa', '#38bdf8', '#a3e635',
    '#fb7185', '#2dd4bf', '#facc15', '#c084fc', '#fb923c',
  ],
  pastel: [
    '#fda4af', '#93c5fd', '#fcd34d', '#6ee7b7', '#f9a8d4',
    '#67e8f9', '#fdba74', '#c4b5fd', '#bef264', '#5eead4',
    '#fca5a5', '#a5b4fc', '#fde047', '#d8b4fe', '#7dd3fc',
  ],
  steel: [
    '#f59e0b', '#e2e8f0', '#38bdf8', '#f43f5e', '#94a3b8',
    '#fbbf24', '#cbd5e1', '#0ea5e9', '#fb7185', '#64748b',
    '#fcd34d', '#f8fafc', '#22d3ee', '#e11d48', '#475569',
  ],
};

const DEFAULT_CONFIG = {
  ballCount: 10,
  speedMultiplier: 1.0,
  distancePreset: '100',
  distanceMeters: 100,
  mapPreset: 'alpine',
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

const MAP_ORDER = ['alpine', 'sunset', 'cyber', 'arctic', 'caldera'];

const ENVIRONMENT_MAPS = {
  alpine: {
    label: 'Alpine Twilight',
    skyStops: ['#050a14', '#0f1b2e', '#233b59', '#0c111a'],
    fogColor: 0x0d1522,
    fogDensity: 0.0034,
    hemiSky: 0x9ec5ff,
    hemiGround: 0x182230,
    hemiIntensity: 1.0,
    keyColor: 0xfff2dc,
    keyIntensity: 2.35,
    rimColor: 0x38bdf8,
    rimIntensity: 0.85,
    exposure: 1.12,
    groundBase: '#0b1018',
    groundGrid: 'rgba(148, 163, 184, 0.09)',
    trackBase: '#1b212b',
    trackLine: 'rgba(245, 158, 11, 0.65)',
    curbColor: 0xf59e0b,
    curbEmissive: 0xd97706,
    railColor: 0x64748b,
    pylonColor: 0x1e293b,
    landmarkKind: 'peaks',
    landmarkColor: 0x26354a,
    landmarkAccent: 0xcbd5e1,
  },
  sunset: {
    label: 'Canyon Sunset',
    skyStops: ['#160c18', '#4c1d2b', '#b4532a', '#1f1210'],
    fogColor: 0x2a1618,
    fogDensity: 0.0032,
    hemiSky: 0xffb37a,
    hemiGround: 0x2b1712,
    hemiIntensity: 1.05,
    keyColor: 0xffcf96,
    keyIntensity: 2.5,
    rimColor: 0xf97316,
    rimIntensity: 0.9,
    exposure: 1.15,
    groundBase: '#1c120e',
    groundGrid: 'rgba(251, 146, 60, 0.09)',
    trackBase: '#27201e',
    trackLine: 'rgba(251, 146, 60, 0.72)',
    curbColor: 0xf97316,
    curbEmissive: 0xea580c,
    railColor: 0x92400e,
    pylonColor: 0x291c18,
    landmarkKind: 'mesas',
    landmarkColor: 0x5c2d1f,
    landmarkAccent: 0x9a4e32,
  },
  cyber: {
    label: 'Neon Night',
    skyStops: ['#04040c', '#0b0a22', '#17133a', '#06060f'],
    fogColor: 0x070716,
    fogDensity: 0.0038,
    hemiSky: 0x6366f1,
    hemiGround: 0x0f172a,
    hemiIntensity: 0.9,
    keyColor: 0xe0f2fe,
    keyIntensity: 2.1,
    rimColor: 0xec4899,
    rimIntensity: 1.1,
    exposure: 1.16,
    groundBase: '#060711',
    groundGrid: 'rgba(56, 189, 248, 0.12)',
    trackBase: '#111623',
    trackLine: 'rgba(34, 211, 238, 0.75)',
    curbColor: 0x22d3ee,
    curbEmissive: 0x06b6d4,
    railColor: 0x475569,
    pylonColor: 0x161b2e,
    landmarkKind: 'towers',
    landmarkColor: 0x13172b,
    landmarkAccent: 0x22d3ee,
  },
  arctic: {
    label: 'Polar Ice',
    skyStops: ['#081826', '#123249', '#2b5e78', '#0c1c28'],
    fogColor: 0x102838,
    fogDensity: 0.0028,
    hemiSky: 0xbae6fd,
    hemiGround: 0x1e3a4c,
    hemiIntensity: 1.25,
    keyColor: 0xf8fafc,
    keyIntensity: 2.4,
    rimColor: 0x67e8f9,
    rimIntensity: 0.95,
    exposure: 1.18,
    groundBase: '#10212e',
    groundGrid: 'rgba(186, 230, 253, 0.12)',
    trackBase: '#1e2f3d',
    trackLine: 'rgba(103, 232, 249, 0.72)',
    curbColor: 0x38bdf8,
    curbEmissive: 0x0284c7,
    railColor: 0x94a3b8,
    pylonColor: 0x1e3547,
    landmarkKind: 'glaciers',
    landmarkColor: 0x36607a,
    landmarkAccent: 0xbae6fd,
  },
  caldera: {
    label: 'Volcanic Caldera',
    skyStops: ['#0d0606', '#260c0a', '#4a1810', '#120807'],
    fogColor: 0x1a0b09,
    fogDensity: 0.0036,
    hemiSky: 0xfb923c,
    hemiGround: 0x260c08,
    hemiIntensity: 0.95,
    keyColor: 0xffedd5,
    keyIntensity: 2.25,
    rimColor: 0xef4444,
    rimIntensity: 1.05,
    exposure: 1.14,
    groundBase: '#120a09',
    groundGrid: 'rgba(239, 68, 68, 0.11)',
    trackBase: '#1b1617',
    trackLine: 'rgba(249, 115, 22, 0.72)',
    curbColor: 0xf97316,
    curbEmissive: 0xdc2626,
    railColor: 0x57534e,
    pylonColor: 0x231919,
    landmarkKind: 'basalt',
    landmarkColor: 0x291c1c,
    landmarkAccent: 0xf97316,
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
    this.lastClackAt = 0;
    this.lastHurdleAt = 0;
    this.lastWallAt = 0;
    this.lastWhooshAt = 0;
  }

  ensureContext() {
    if (!this.enabled) return null;
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
      this.noiseBuffer = this.createNoiseBuffer(0.14);
      this.loopNoiseBuffer = this.createPinkLoopBuffer(1.6);
      this.initRollingBed();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
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

  getAudioTrack() {
    const ctx = this.ensureContext();
    if (!ctx || !this.mediaDest) return null;
    return this.mediaDest.stream.getAudioTracks()[0] || null;
  }

  playTone(freq, duration = 0.12, type = 'sine', gainVal = 0.08, endFreq = null) {
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
// Full Gameplay Video Recorder (Canvas + Procedural Audio -> WebM / MP4)
// ============================================================================
class GameplayRecorder {
  constructor(canvas, soundEngine) {
    this.canvas = canvas;
    this.soundEngine = soundEngine;
    this.recorder = null;
    this.chunks = [];
    this.stream = null;
    this.mimeType = '';
    this.ext = 'webm';
    this.isRecording = false;
    this.recordedUrl = null;
    this.recordedBlob = null;
    this.stopPromise = null;
  }

  static pickSupportedMimeType() {
    if (typeof MediaRecorder === 'undefined') return null;
    const candidates = [
      { mime: 'video/mp4;codecs=avc1,mp4a.40.2', ext: 'mp4' },
      { mime: 'video/mp4', ext: 'mp4' },
      { mime: 'video/webm;codecs=vp9,opus', ext: 'webm' },
      { mime: 'video/webm;codecs=vp8,opus', ext: 'webm' },
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
      typeof this.canvas.captureStream === 'function'
    );
  }

  start() {
    this.discard();
    if (!this.isSupported()) return false;

    try {
      const fps = isSoftwareGl ? 30 : 60;
      const canvasStream = this.canvas.captureStream(fps);
      const tracks = [...canvasStream.getVideoTracks()];
      const audioTrack = this.soundEngine.getAudioTrack();
      if (audioTrack) {
        tracks.push(audioTrack);
      }
      this.stream = new MediaStream(tracks);

      const picked = GameplayRecorder.pickSupportedMimeType();
      this.mimeType = picked?.mime || '';
      this.ext = picked?.ext || 'webm';

      const options = this.mimeType
        ? { mimeType: this.mimeType, videoBitsPerSecond: 6_000_000 }
        : { videoBitsPerSecond: 6_000_000 };

      this.chunks = [];
      this.recorder = new MediaRecorder(this.stream, options);
      this.recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.chunks.push(e.data);
        }
      };

      this.recorder.start(250);
      this.isRecording = true;
      return true;
    } catch (err) {
      console.warn('Video recording unavailable:', err);
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
          ? { blob: this.recordedBlob, url: this.recordedUrl, ext: this.ext }
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
        resolve({ blob, url: this.recordedUrl, ext: this.ext });
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
// Pooled 3D Spark & Confetti Particle System (Zero-GC InstancedMesh)
// ============================================================================
class ParticlePool {
  constructor(scene, maxCount = 220) {
    this.maxCount = maxCount;
    this.particles = [];
    this.cursor = 0;

    const geo = new THREE.BoxGeometry(0.11, 0.11, 0.22);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, maxCount);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;

    this._dummy = new THREE.Object3D();
    this._color = new THREE.Color();

    for (let i = 0; i < maxCount; i++) {
      this.particles.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        rot: new THREE.Euler(),
        rotSpeed: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        baseScale: 1,
        gravity: 14,
      });
      this._dummy.scale.set(0, 0, 0);
      this._dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this._dummy.matrix);
      this.mesh.setColorAt(i, this._color.setHex(0xf59e0b));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    scene.add(this.mesh);
  }

  emitBurst(origin, count, colorHex, speed = 7, life = 0.55, gravity = 14, baseScale = 1) {
    this._color.set(colorHex);
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.cursor];
      this.cursor = (this.cursor + 1) % this.maxCount;
      p.active = true;
      p.pos.copy(origin);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.65;
      const mag = speed * (0.45 + Math.random() * 0.75);
      p.vel.set(
        Math.sin(phi) * Math.cos(theta) * mag,
        Math.cos(phi) * mag * 0.85 + 1.5,
        Math.sin(phi) * Math.sin(theta) * mag
      );
      p.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      p.rotSpeed.set(
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14
      );
      p.life = life * (0.7 + Math.random() * 0.5);
      p.maxLife = p.life;
      p.baseScale = baseScale * (0.7 + Math.random() * 0.6);
      p.gravity = gravity;
      this.mesh.setColorAt(this.cursor === 0 ? this.maxCount - 1 : this.cursor - 1, this._color);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt) {
    let anyUpdated = false;
    for (let i = 0; i < this.maxCount; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      anyUpdated = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this._dummy.scale.set(0, 0, 0);
        this._dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this._dummy.matrix);
        continue;
      }

      p.vel.y -= p.gravity * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.rot.x += p.rotSpeed.x * dt;
      p.rot.y += p.rotSpeed.y * dt;
      p.rot.z += p.rotSpeed.z * dt;

      const s = p.baseScale * (p.life / p.maxLife);
      this._dummy.position.copy(p.pos);
      this._dummy.rotation.copy(p.rot);
      this._dummy.scale.set(s, s, s);
      this._dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this._dummy.matrix);
    }
    if (anyUpdated) {
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  clear() {
    for (let i = 0; i < this.maxCount; i++) {
      this.particles[i].active = false;
      this._dummy.scale.set(0, 0, 0);
      this._dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this._dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ============================================================================
// Single-Draw-Call Additive Motion Trail Ribbons (Zero-GC Ring Buffer)
// ============================================================================
class BallTrailRenderer {
  constructor(scene, maxBalls = 50, pointsPerBall = 14) {
    this.maxBalls = maxBalls;
    this.pointsPerBall = pointsPerBall;
    const quadsPerBall = pointsPerBall - 1;
    const totalVerts = maxBalls * quadsPerBall * 6;

    this.positions = new Float32Array(totalVerts * 3);
    this.colors = new Float32Array(totalVerts * 3);

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    this.histories = Array.from({ length: maxBalls }, () => []);
    this._color = new THREE.Color();
    this._side = new THREE.Vector3();
    this._dir = new THREE.Vector3();
  }

  reset() {
    for (const h of this.histories) h.length = 0;
    this.positions.fill(0);
    this.colors.fill(0);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }

  update(balls, cameraPos) {
    let vIdx = 0;
    const P = this.pointsPerBall;

    for (let b = 0; b < this.maxBalls; b++) {
      const ball = balls[b];
      const hist = this.histories[b];
      if (!ball || ball.currentSpeed < 4.5) {
        if (hist.length > 0 && ball && ball.currentSpeed < 2.2) {
          hist.shift();
        } else if (!ball) {
          hist.length = 0;
        }
      }

      if (ball && ball.currentSpeed >= 4.5) {
        const last = hist[hist.length - 1];
        if (!last || last.distanceToSquared(ball.worldPos) > 0.08) {
          hist.push(ball.worldPos.clone());
          if (hist.length > P) hist.shift();
        } else {
          last.copy(ball.worldPos);
        }
      }

      const quads = P - 1;
      const nPts = hist.length;
      if (!ball || nPts < 2) {
        for (let q = 0; q < quads * 6; q++) {
          const base = vIdx * 3;
          this.positions[base] = 0;
          this.positions[base + 1] = 0;
          this.positions[base + 2] = 0;
          this.colors[base] = 0;
          this.colors[base + 1] = 0;
          this.colors[base + 2] = 0;
          vIdx++;
        }
        continue;
      }

      this._color.set(ball.color);
      const speedFade = Math.min(1, Math.max(0, (ball.currentSpeed - 4.5) / 14));
      const baseHalfW = BALL_RADIUS * (0.28 + speedFade * 0.24);

      for (let q = 0; q < quads; q++) {
        if (q >= nPts - 1) {
          for (let k = 0; k < 6; k++) {
            const base = vIdx * 3;
            this.positions[base] = 0;
            this.positions[base + 1] = 0;
            this.positions[base + 2] = 0;
            this.colors[base] = 0;
            this.colors[base + 1] = 0;
            this.colors[base + 2] = 0;
            vIdx++;
          }
          continue;
        }

        const p0 = hist[q];
        const p1 = hist[q + 1];
        const t0 = q / (nPts - 1);
        const t1 = (q + 1) / (nPts - 1);
        const w0 = baseHalfW * t0;
        const w1 = baseHalfW * t1;

        this._dir.subVectors(p1, p0);
        if (this._dir.lengthSq() < 1e-6) this._dir.set(0, 0, -1);
        this._side.subVectors(cameraPos, p1).cross(this._dir);
        if (this._side.lengthSq() < 1e-6) this._side.set(1, 0, 0);
        this._side.normalize();

        const b0 = t0 * t0 * speedFade * 0.72;
        const b1 = t1 * t1 * speedFade * 0.72;
        const r0 = this._color.r * b0;
        const g0 = this._color.g * b0;
        const bl0 = this._color.b * b0;
        const r1 = this._color.r * b1;
        const g1 = this._color.g * b1;
        const bl1 = this._color.b * b1;

        const ax = p0.x - this._side.x * w0;
        const ay = p0.y - this._side.y * w0;
        const az = p0.z - this._side.z * w0;
        const bx = p0.x + this._side.x * w0;
        const by = p0.y + this._side.y * w0;
        const bz = p0.z + this._side.z * w0;
        const cx = p1.x + this._side.x * w1;
        const cy = p1.y + this._side.y * w1;
        const cz = p1.z + this._side.z * w1;
        const dx = p1.x - this._side.x * w1;
        const dy = p1.y - this._side.y * w1;
        const dz = p1.z - this._side.z * w1;

        const pts = [
          [ax, ay, az, r0, g0, bl0],
          [bx, by, bz, r0, g0, bl0],
          [cx, cy, cz, r1, g1, bl1],
          [ax, ay, az, r0, g0, bl0],
          [cx, cy, cz, r1, g1, bl1],
          [dx, dy, dz, r1, g1, bl1],
        ];
        for (let k = 0; k < 6; k++) {
          const base = vIdx * 3;
          this.positions[base] = pts[k][0];
          this.positions[base + 1] = pts[k][1];
          this.positions[base + 2] = pts[k][2];
          this.colors[base] = pts[k][3];
          this.colors[base + 1] = pts[k][4];
          this.colors[base + 2] = pts[k][5];
          vIdx++;
        }
      }
    }

    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}

// ============================================================================
// Ambient Map-Themed Atmospheric Drift (Mist / Snow / Embers / Neon Motes)
// ============================================================================
class AmbientAtmosphere {
  constructor(scene, spriteTex, count = 220) {
    this.count = count;
    this.positions = new Float32Array(count * 3);
    this.velocities = [];
    for (let i = 0; i < count; i++) {
      this.positions[i * 3] = (Math.random() - 0.5) * 90;
      this.positions[i * 3 + 1] = (Math.random() - 0.5) * 38;
      this.positions[i * 3 + 2] = (Math.random() - 0.5) * 90;
      this.velocities.push({
        x: (Math.random() - 0.5) * 1.1,
        y: (Math.random() - 0.5) * 0.8,
        z: (Math.random() - 0.5) * 1.1,
      });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.mat = new THREE.PointsMaterial({
      size: 0.48,
      map: spriteTex,
      transparent: true,
      opacity: 0.52,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      color: 0xcbd5e1,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.verticalBias = -0.3;
  }

  setTheme(mapKey) {
    if (mapKey === 'caldera') {
      this.mat.color.setHex(0xf97316);
      this.mat.size = 0.52;
      this.mat.opacity = 0.65;
      this.verticalBias = 1.4; // rising volcanic embers
    } else if (mapKey === 'arctic') {
      this.mat.color.setHex(0xe0f2fe);
      this.mat.size = 0.5;
      this.mat.opacity = 0.62;
      this.verticalBias = -1.6; // falling snow crystals
    } else if (mapKey === 'cyber') {
      this.mat.color.setHex(0x38bdf8);
      this.mat.size = 0.42;
      this.mat.opacity = 0.55;
      this.verticalBias = -0.4;
    } else if (mapKey === 'sunset') {
      this.mat.color.setHex(0xfdba74);
      this.mat.size = 0.46;
      this.mat.opacity = 0.48;
      this.verticalBias = 0.15;
    } else {
      this.mat.color.setHex(0x94a3b8);
      this.mat.size = 0.44;
      this.mat.opacity = 0.4;
      this.verticalBias = -0.25;
    }
  }

  update(dt, focusPos) {
    const halfX = 45;
    const halfY = 19;
    const halfZ = 45;
    for (let i = 0; i < this.count; i++) {
      const idx = i * 3;
      const v = this.velocities[i];
      let x = this.positions[idx] + v.x * dt;
      let y = this.positions[idx + 1] + (v.y + this.verticalBias) * dt;
      let z = this.positions[idx + 2] + v.z * dt;

      if (x < focusPos.x - halfX) x += halfX * 2;
      else if (x > focusPos.x + halfX) x -= halfX * 2;
      if (y < focusPos.y - halfY) y += halfY * 2;
      else if (y > focusPos.y + halfY) y -= halfY * 2;
      if (z < focusPos.z - halfZ) z += halfZ * 2;
      else if (z > focusPos.z + halfZ) z -= halfZ * 2;

      this.positions[idx] = x;
      this.positions[idx + 1] = y;
      this.positions[idx + 2] = z;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
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

function generateDistinctColor(index, existingSet) {
  let step = index;
  for (let attempt = 0; attempt < 200; attempt++) {
    const hue = (step * 137.508 + attempt * 23) % 360;
    const sat = 68 + ((step + attempt) % 3) * 10;
    const light = 48 + ((step + attempt) % 4) * 7;
    const hex = hslToHex(hue, sat, light).toLowerCase();
    if (!existingSet.has(hex)) return hex;
    step++;
  }
  return `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`;
}

function buildBallColorsForPalette(paletteKey, count, allowDuplicates) {
  const base = COLOR_PALETTES[paletteKey] || COLOR_PALETTES.grandprix;
  const result = [];
  const used = new Set();
  for (let i = 0; i < count; i++) {
    let candidate = base[i % base.length].toLowerCase();
    if (!allowDuplicates && used.has(candidate)) {
      candidate = generateDistinctColor(i, used);
    }
    used.add(candidate);
    result.push(candidate);
  }
  return result;
}

// ============================================================================
// High-Res 4K-Grade Procedural PBR Textures (Zero External Assets)
// ============================================================================
function createTrackSurfaceTexture(maxAnisotropy, mapCfg) {
  const S = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = mapCfg?.trackBase || '#1b2029';
  ctx.fillRect(0, 0, S, S);

  // Subtle racing groove shading down track center
  const groove = ctx.createLinearGradient(0, 0, S, 0);
  groove.addColorStop(0.0, 'rgba(0,0,0,0.22)');
  groove.addColorStop(0.18, 'rgba(255,255,255,0.03)');
  groove.addColorStop(0.5, 'rgba(255,255,255,0.05)');
  groove.addColorStop(0.82, 'rgba(255,255,255,0.03)');
  groove.addColorStop(1.0, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = groove;
  ctx.fillRect(0, 0, S, S);

  // Fine asphalt & carbon micro-grain
  for (let i = 0; i < 14000; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const alpha = 0.025 + Math.random() * 0.055;
    ctx.fillStyle = Math.random() > 0.48 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha * 1.4})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Subtle transverse precision expansion seams
  ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
  for (let y = 0; y < S; y += 256) {
    ctx.fillRect(0, y, S, 3);
  }

  // Crisp twin racing shoulder stripes
  ctx.fillStyle = mapCfg?.trackLine || 'rgba(245, 158, 11, 0.72)';
  ctx.fillRect(26, 0, 14, S);
  ctx.fillRect(S - 40, 0, 14, S);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.fillRect(48, 0, 4, S);
  ctx.fillRect(S - 52, 0, 4, S);

  // Center lane guide dashes
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  for (let y = 32; y < S; y += 128) {
    ctx.fillRect(S * 0.5 - 5, y, 10, 62);
  }

  // Subtle directional racing chevrons
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
  ctx.lineWidth = 6;
  for (let y = 128; y < S; y += 256) {
    ctx.beginPath();
    ctx.moveTo(S * 0.38, y + 48);
    ctx.lineTo(S * 0.5, y);
    ctx.lineTo(S * 0.62, y + 48);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createTrackNormalTexture(maxAnisotropy) {
  const S = 512;
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    const seam = y % 128 < 2 ? -0.38 : 0;
    for (let x = 0; x < S; x++) {
      const weave =
        Math.sin(x * 0.45) * Math.cos(y * 0.45) * 0.08 + (Math.random() - 0.5) * 0.22;
      h[y * S + x] = seam + weave;
    }
  }

  const data = new Uint8Array(S * S * 4);
  const strength = 2.6;
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
  const S = 512;
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

  for (let i = 0; i < 6500; i++) {
    const v = 80 + Math.floor(Math.random() * 90);
    ctx.fillStyle = `rgba(${v},${v},${v},0.16)`;
    ctx.fillRect(Math.random() * S, Math.random() * S, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createSkyDomeTexture(skyStops = ['#050a14', '#0f1b2e', '#233b59', '#0c111a']) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0.0, skyStops[0]);
  grad.addColorStop(0.42, skyStops[1]);
  grad.addColorStop(0.68, skyStops[2]);
  grad.addColorStop(1.0, skyStops[3]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 1024);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createBallMarbleTexture(maxAnisotropy) {
  const W = 1024;
  const H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Rich marbled ceramic + metallic micro-flake base multiplied by ball color
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, W, H);

  // Subtle tonal depth gradient across hemispheres
  const depthGrad = ctx.createLinearGradient(0, 0, 0, H);
  depthGrad.addColorStop(0.0, 'rgba(255,255,255,0.22)');
  depthGrad.addColorStop(0.5, 'rgba(226,232,240,0.0)');
  depthGrad.addColorStop(1.0, 'rgba(15,23,42,0.18)');
  ctx.fillStyle = depthGrad;
  ctx.fillRect(0, 0, W, H);

  // Flowing glass marble swirl ribbons
  for (let i = 0; i < 9; i++) {
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(255, 255, 255, 0.65)' : 'rgba(15, 23, 42, 0.12)';
    ctx.lineWidth = 8 + (i % 3) * 4;
    ctx.beginPath();
    const y0 = 32 + i * 52;
    ctx.moveTo(0, y0);
    ctx.bezierCurveTo(W * 0.33, y0 + 48, W * 0.66, y0 - 48, W, y0);
    ctx.stroke();
  }

  // Subtle metallic micro-speckle
  for (let i = 0; i < 2400; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.28)' : 'rgba(15,23,42,0.08)';
    ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }

  // Precision equator racing band + twin crisp pin-stripes
  ctx.fillStyle = 'rgba(15, 23, 42, 0.42)';
  ctx.fillRect(0, H * 0.45, W, H * 0.1);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
  ctx.fillRect(0, H * 0.49, W, 8);
  ctx.fillRect(0, H * 0.46, W, 3);
  ctx.fillRect(0, H * 0.535, W, 3);

  // Opposite pole markers for unmistakable rotational spin reading
  ctx.fillStyle = 'rgba(15, 23, 42, 0.34)';
  ctx.beginPath();
  ctx.arc(W * 0.25, H * 0.21, 36, 0, Math.PI * 2);
  ctx.arc(W * 0.75, H * 0.79, 36, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createBoosterTexture(maxAnisotropy) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#06202a';
  ctx.fillRect(0, 0, 256, 512);

  // Bright cyan side rails
  ctx.fillStyle = '#22d3ee';
  ctx.fillRect(6, 0, 14, 512);
  ctx.fillRect(236, 0, 14, 512);

  // Repeating luminous directional chevrons
  ctx.strokeStyle = '#67e8f9';
  ctx.lineWidth = 18;
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

function createSoftRadialTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.42, 'rgba(255, 255, 255, 0.55)');
  grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

function createSpotBeamTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.42)');
  grad.addColorStop(0.55, 'rgba(255, 255, 255, 0.14)');
  grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 256);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

function createCheckeredTexture(maxAnisotropy, cols = 12, rows = 4) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 340;
  const ctx = canvas.getContext('2d');
  const cw = canvas.width / cols;
  const ch = canvas.height / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#f8fafc' : '#0f172a';
      ctx.fillRect(c * cw, r * ch, cw + 0.5, ch + 0.5);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createHazardStripeTexture(maxAnisotropy) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, 0, 512, 512);
  ctx.fillStyle = '#141923';
  for (let i = -512; i < 1024; i += 96) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 48, 0);
    ctx.lineTo(i + 560, 512);
    ctx.lineTo(i + 512, 512);
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

function createArenaFloorTexture(maxAnisotropy, mapCfg) {
  const S = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = mapCfg?.groundBase || '#0c0f15';
  ctx.fillRect(0, 0, S, S);

  for (let i = 0; i < 6000; i++) {
    const a = 0.015 + Math.random() * 0.03;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    ctx.fillRect(Math.random() * S, Math.random() * S, 3, 3);
  }

  ctx.strokeStyle = mapCfg?.groundGrid || 'rgba(148, 163, 184, 0.09)';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, S, S);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
  ctx.lineWidth = 1.5;
  for (let i = 256; i < S; i += 256) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, S);
    ctx.moveTo(0, i);
    ctx.lineTo(S, i);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(110, 110);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createSignCanvasTexture(text, bgColor = '#141923', fgColor = '#f59e0b') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = fgColor;
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 244, 116);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 54px Oxanium, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 66);
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
  const basePitch = 0.265 + rng() * 0.055; // 15° - 18.3°
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
      pitch = 0.085;
    } else if (s < 4.5) {
      pitch = THREE.MathUtils.lerp(0.085, basePitch, smoothstep(0, 4.5, s));
    } else if (s > L) {
      pitch = THREE.MathUtils.lerp(basePitch, 0.0, smoothstep(L, L + 10, s));
    } else if (config.trackType === 'straight') {
      const env = smoothstep(6, 14, s) * (1 - smoothstep(L - 12, L, s));
      pitch = basePitch + straightWaveAmp * Math.sin(s * 0.15 + trackSeed) * env;
    } else if (config.trackType === 'mixed') {
      const env = smoothstep(4, 12, s) * (1 - smoothstep(L - 10, L, s));
      pitch = basePitch + 0.095 * Math.sin(s * mixedWaveFreq + trackSeed * 0.7) * env;
    } else if (config.trackType === 'curved') {
      const env = smoothstep(6, 14, s) * (1 - smoothstep(L - 12, L, s));
      pitch = basePitch + 0.045 * Math.sin(s * 0.14 + trackSeed) * env;
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
    this.particles = null;

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

    this.raceState = 'READY'; // READY | COUNTDOWN | RACING | PAUSED | FINISHED
    this.cameraMode = 'overview';
    this.followShotAngle = 0;
    this.directorState = {
      shotName: 'Hero Dolly',
      cutAt: 0,
      cycleIdx: 0,
      fixedPos: new THREE.Vector3(),
      hasFixedPos: false,
      justCut: false,
    };
    this.selectedBallIndex = 0;
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
    this.ultraQuality = !isSoftwareGl;
    this.composerFailed = false;
    this.composerVerified = false;
    this._activeEnvMapKey = null;

    // Three.js & Rapier objects
    this.renderer = null;
    this.composer = null;
    this.bloomPass = null;
    this.lensPass = null;
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
    this.selectionHalo = null;
    this.contactShadowMesh = null;
    this.trails = null;
    this.atmosphere = null;

    this.trackData = null;
    this.balls = [];
    this.kinematicHurdles = [];
    this.hurdleStationsS = [];
    this.checkpointVisuals = [];
    this.finishLaserBar = null;
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
    this._dummy = new THREE.Object3D();
    this._upVec = new THREE.Vector3(0, 1, 0);
    this._raycaster = new THREE.Raycaster();
    this._pointer = new THREE.Vector2();
    this._pointerDownPos = { x: 0, y: 0 };

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

      btnStart: document.getElementById('btn-start-race'),
      btnPause: document.getElementById('btn-pause-race'),
      btnResume: document.getElementById('btn-resume-race'),
      btnRestart: document.getElementById('btn-restart-race'),
      btnViewResults: document.getElementById('btn-view-results'),
      btnToggleQuality: document.getElementById('btn-toggle-quality'),
      btnToggleSound: document.getElementById('btn-toggle-sound'),

      // Config controls
      inputBallCount: document.getElementById('input-ball-count'),
      inputBallCountNum: document.getElementById('input-ball-count-num'),
      valBallCount: document.getElementById('val-ball-count'),
      inputBallSpeed: document.getElementById('input-ball-speed'),
      valBallSpeed: document.getElementById('val-ball-speed'),
      speedPresetRow: document.querySelector('[data-speed-presets]'),
      valDistance: document.getElementById('val-distance'),
      distancePresets: document.getElementById('distance-presets'),
      customDistanceWrap: document.getElementById('custom-distance-wrap'),
      inputCustomDistance: document.getElementById('input-custom-distance'),
      mapPresetGroup: document.getElementById('map-preset-group'),
      inputCycleMap: document.getElementById('input-cycle-map'),
      trackTypeGroup: document.getElementById('track-type-group'),
      inputTrackWidth: document.getElementById('input-track-width'),
      valTrackWidth: document.getElementById('val-track-width'),
      gravityPresets: document.getElementById('gravity-presets'),
      frictionPresets: document.getElementById('friction-presets'),
      inputExperimentalVariance: document.getElementById('input-experimental-variance'),

      inputHurdleCount: document.getElementById('input-hurdle-count'),
      inputHurdleCountNum: document.getElementById('input-hurdle-count-num'),
      valHurdleCount: document.getElementById('val-hurdle-count'),
      hurdleSizeGroup: document.getElementById('hurdle-size-group'),
      inputRandomHurdles: document.getElementById('input-random-hurdles'),
      obstacleTypesList: document.getElementById('obstacle-types-list'),
      btnObstaclesAll: document.getElementById('btn-obstacles-all'),
      btnObstaclesNone: document.getElementById('btn-obstacles-none'),

      colorPresetsGroup: document.getElementById('color-presets-group'),
      btnRandomizeColors: document.getElementById('btn-randomize-colors'),
      inputAllowDuplicates: document.getElementById('input-allow-duplicates'),
      ballCountCaption: document.getElementById('ball-count-caption'),
      ballListContainer: document.getElementById('ball-list-container'),

      btnGenerateTrack: document.getElementById('btn-generate-track'),
      btnResetSettings: document.getElementById('btn-reset-settings'),

      cameraModeButtons: document.getElementById('camera-mode-buttons'),
      btnCycleShot: document.getElementById('btn-cycle-shot'),
      cameraShotLabel: document.getElementById('camera-shot-label'),
      cinemaBars: document.getElementById('cinema-bars'),
      selectFollowBall: document.getElementById('select-follow-ball'),
      btnHideHud: document.getElementById('btn-hide-hud'),
      btnShowHud: document.getElementById('btn-show-hud'),
      freeCamBar: document.getElementById('free-cam-bar'),
      btnFreeFocusLeader: document.getElementById('btn-free-focus-leader'),
      btnFreeCenterTrack: document.getElementById('btn-free-center-track'),

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
      videoExportPanel: document.getElementById('video-export-panel'),
      videoExportMeta: document.getElementById('video-export-meta'),
      btnPreviewVideo: document.getElementById('btn-preview-video'),
      btnExportVideo: document.getElementById('btn-export-video'),
      videoPreviewWrap: document.getElementById('video-preview-wrap'),
      replayVideoPlayer: document.getElementById('replay-video-player'),
      resultsTableBody: document.getElementById('results-table-body'),
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

  getTargetPixelRatio() {
    if (isSoftwareGl) return 1;
    const baseCap = this.ultraQuality ? 2.0 : 1.0;
    let pr = Math.min(window.devicePixelRatio || 1, baseCap);
    if (this.renderer) {
      const caps = this.renderer.capabilities;
      const gl = this.renderer.getContext();
      const maxRb = gl ? gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) || 4096 : 4096;
      const maxDim = Math.min(caps.maxTextureSize || 4096, maxRb, 4096);
      const w = Math.max(1, window.innerWidth || 1280);
      const h = Math.max(1, window.innerHeight || 720);
      const maxSafePr = Math.min(maxDim / w, maxDim / h);
      pr = Math.max(0.5, Math.min(pr, maxSafePr));
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
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(this.getTargetPixelRatio());
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = !isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1522);
    this.scene.fog = new THREE.FogExp2(0x0d1522, 0.0034);

    // Initial Studio IBL Reflections (updated per active map theme)
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

    // 3-Point Warm/Cool Lighting Rig
    this.hemiLight = new THREE.HemisphereLight(0x9ec5ff, 0x182230, 1.0);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfff2dc, 2.35);
    this.keyLight.position.set(35, 65, 28);
    this.keyLight.castShadow = !isSoftwareGl;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    const d = 54;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.camera.near = 4;
    this.keyLight.shadow.camera.far = 220;
    this.keyLight.shadow.bias = -0.0004;
    this.keyLight.shadow.normalBias = 0.03;
    this.scene.add(this.keyLight);
    this.scene.add(this.keyLight.target);

    this.rimLight = new THREE.DirectionalLight(0x38bdf8, 0.85);
    this.rimLight.position.set(-40, 30, -50);
    this.scene.add(this.rimLight);

    // Scene hierarchy groups
    this.trackGroup = new THREE.Group();
    this.hurdleGroup = new THREE.Group();
    this.ballGroup = new THREE.Group();
    this.scene.add(this.trackGroup, this.hurdleGroup, this.ballGroup);

    // Atmospheric gradient sky dome
    const skyGeo = new THREE.SphereGeometry(920, 36, 24);
    const skyMat = new THREE.MeshBasicMaterial({
      map: createSkyDomeTexture(ENVIRONMENT_MAPS.alpine.skyStops),
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    });
    this.skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyDome);

    // Pooled spark & confetti particle system + single-draw-call motion trail ribbons
    this.particles = new ParticlePool(this.scene, 320);
    this.trails = new BallTrailRenderer(this.scene, 50, 14);

    if (!isSoftwareGl) {
      this.initPostProcessing();
    }

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

  initPostProcessing() {
    try {
      const w = Math.max(1, window.innerWidth || 1280);
      const h = Math.max(1, window.innerHeight || 720);
      const pr = this.getTargetPixelRatio();
      const gl = this.renderer.getContext();
      const isWebGL2 = Boolean(this.renderer.capabilities.isWebGL2);
      const hasFloatColor =
        isWebGL2 &&
        Boolean(
          gl.getExtension('EXT_color_buffer_half_float') ||
            gl.getExtension('EXT_color_buffer_float')
        );

      // Unscaled CSS dimensions + samples: 0 avoids double-DPR FBO overflow and MSAA HalfFloat driver black-screens
      const rt = new THREE.WebGLRenderTarget(w, h, {
        type: hasFloatColor ? THREE.HalfFloatType : THREE.UnsignedByteType,
        samples: 0,
      });

      this.composer = new EffectComposer(this.renderer, rt);
      this.composer.setPixelRatio(pr);
      this.composer.setSize(w, h);

      this.composer.addPass(new RenderPass(this.scene, this.camera));

      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.26, 0.52, 0.94);
      this.composer.addPass(this.bloomPass);

      this.lensPass = new ShaderPass(CinematicLensShader);
      this.lensPass.uniforms.uTexelSize.value.set(
        1 / Math.max(1, w * pr),
        1 / Math.max(1, h * pr)
      );
      this.composer.addPass(this.lensPass);

      // OutputPass must be last so ACESFilmicToneMapping + SRGBColorSpace run cleanly to screen
      this.composer.addPass(new OutputPass());
      this.composerFailed = false;
      this.composerVerified = false;
    } catch (err) {
      console.warn('Post-processing disabled, falling back to direct renderer:', err);
      this.disablePostProcessing();
    }
  }

  disablePostProcessing() {
    if (this.composer) {
      try {
        this.composer.dispose();
      } catch {
        // Ignore cleanup errors
      }
      this.composer = null;
    }
    this.bloomPass = null;
    this.lensPass = null;
    this.composerFailed = true;
    this.ultraQuality = false;
  }

  initSharedAssets() {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const mapCfg = ENVIRONMENT_MAPS[this.config.mapPreset] || ENVIRONMENT_MAPS.alpine;
    this.shared.trackTex = createTrackSurfaceTexture(maxAniso, mapCfg);
    this.shared.trackNormalTex = createTrackNormalTexture(maxAniso);
    this.shared.trackRoughnessTex = createTrackRoughnessTexture(maxAniso);
    this.shared.marbleTex = createBallMarbleTexture(maxAniso);
    this.shared.checkerTex = createCheckeredTexture(maxAniso);
    this.shared.hazardTex = createHazardStripeTexture(maxAniso);
    this.shared.floorTex = createArenaFloorTexture(maxAniso, mapCfg);
    this.shared.boosterTex = createBoosterTexture(maxAniso);
    this.shared.softRadialTex = createSoftRadialTexture();
    this.shared.spotBeamTex = createSpotBeamTexture();

    this.shared.ballGeo = new THREE.SphereGeometry(BALL_RADIUS, 40, 28);

    // Map-themed ambient drift motes / snow / embers
    this.atmosphere = new AmbientAtmosphere(
      this.scene,
      this.shared.softRadialTex,
      isSoftwareGl ? 90 : 240
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

    // Selection halo ring around followed ball
    const haloGeo = new THREE.RingGeometry(BALL_RADIUS * 1.35, BALL_RADIUS * 1.65, 32);
    haloGeo.rotateX(-Math.PI / 2);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    this.selectionHalo = new THREE.Mesh(haloGeo, haloMat);
    this.selectionHalo.visible = false;
    this.scene.add(this.selectionHalo);
  }

  updateEnvironmentReflection(mapCfg) {
    if (!this.renderer || isSoftwareGl) return;
    const iblScene = new THREE.Scene();
    const skySphere = new THREE.Mesh(
      new THREE.SphereGeometry(20, 24, 16),
      new THREE.MeshBasicMaterial({
        map: createSkyDomeTexture(mapCfg.skyStops),
        side: THREE.BackSide,
      })
    );
    iblScene.add(skySphere);

    // Crisp studio reflection softboxes tinted to match active map
    const keyStrip = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 4),
      new THREE.MeshBasicMaterial({ color: mapCfg.keyColor, side: THREE.DoubleSide })
    );
    keyStrip.position.set(8, 12, 8);
    keyStrip.lookAt(0, 0, 0);
    iblScene.add(keyStrip);

    const rimStrip = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 3),
      new THREE.MeshBasicMaterial({ color: mapCfg.rimColor, side: THREE.DoubleSide })
    );
    rimStrip.position.set(-10, 7, -10);
    rimStrip.lookAt(0, 0, 0);
    iblScene.add(rimStrip);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const nextEnv = pmrem.fromScene(iblScene, 0.035).texture;
    if (this.shared.envMap) this.shared.envMap.dispose();
    this.shared.envMap = nextEnv;
    this.scene.environment = nextEnv;

    skySphere.material.map.dispose();
    skySphere.geometry.dispose();
    skySphere.material.dispose();
    keyStrip.geometry.dispose();
    keyStrip.material.dispose();
    rimStrip.geometry.dispose();
    rimStrip.material.dispose();
    pmrem.dispose();
  }

  applyMapEnvironment() {
    const mapKey = this.config.mapPreset || 'alpine';
    const mapCfg = ENVIRONMENT_MAPS[mapKey] || ENVIRONMENT_MAPS.alpine;
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();

    if (this._activeEnvMapKey !== mapKey) {
      this._activeEnvMapKey = mapKey;

      // Update sky dome texture & map-matched IBL reflections only when map theme actually changes
      if (this.skyDome && this.skyDome.material) {
        if (this.skyDome.material.map) this.skyDome.material.map.dispose();
        this.skyDome.material.map = createSkyDomeTexture(mapCfg.skyStops);
        this.skyDome.material.needsUpdate = true;
      }
      this.updateEnvironmentReflection(mapCfg);
      this.atmosphere?.setTheme(mapKey);

      if (this.shared.trackTex) this.shared.trackTex.dispose();
      if (this.shared.floorTex) this.shared.floorTex.dispose();
      this.shared.trackTex = createTrackSurfaceTexture(maxAniso, mapCfg);
      this.shared.floorTex = createArenaFloorTexture(maxAniso, mapCfg);
    }

    // Lighting & atmosphere
    this.scene.background.setHex(mapCfg.fogColor);
    this.scene.fog.color.setHex(mapCfg.fogColor);
    this.scene.fog.density = mapCfg.fogDensity;

    this.hemiLight.color.setHex(mapCfg.hemiSky);
    this.hemiLight.groundColor.setHex(mapCfg.hemiGround);
    this.hemiLight.intensity = mapCfg.hemiIntensity;

    this.keyLight.color.setHex(mapCfg.keyColor);
    this.keyLight.intensity = mapCfg.keyIntensity;

    this.rimLight.color.setHex(mapCfg.rimColor);
    this.rimLight.intensity = mapCfg.rimIntensity;

    this.renderer.toneMappingExposure = mapCfg.exposure;
    return mapCfg;
  }

  onResize() {
    const w = Math.max(1, window.innerWidth || 1280);
    const h = Math.max(1, window.innerHeight || 720);
    const pr = this.getTargetPixelRatio();
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h);
    if (this.composer && !this.composerFailed) {
      try {
        this.composer.setPixelRatio(pr);
        this.composer.setSize(w, h);
        if (this.bloomPass) {
          this.bloomPass.setSize(w, h);
        }
        if (this.lensPass) {
          this.lensPass.uniforms.uTexelSize.value.set(
            1 / Math.max(1, w * pr),
            1 / Math.max(1, h * pr)
          );
        }
      } catch (err) {
        console.warn('Composer resize fallback:', err);
        this.disablePostProcessing();
      }
    }
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
            this.shared.marbleTex,
            this.shared.checkerTex,
            this.shared.hazardTex,
            this.shared.floorTex,
            this.shared.boosterTex,
            this.shared.softRadialTex,
            this.shared.spotBeamTex,
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
    this.recorder.discard();
    this.recordedVideoInfo = null;
    this.dom.hudRecBadge.classList.add('hidden');
    this.dom.videoPreviewWrap.classList.add('hidden');
    this.dom.replayVideoPlayer.removeAttribute('src');
    this.dom.videoExportPanel.classList.add('hidden');

    if (this.particles) this.particles.clear();
    if (this.trails) this.trails.reset();
    if (this.contactShadowMesh) {
      this._dummy.scale.set(0, 0, 0);
      this._dummy.updateMatrix();
      for (let i = 0; i < 50; i++) {
        this.contactShadowMesh.setMatrixAt(i, this._dummy.matrix);
      }
      this.contactShadowMesh.instanceMatrix.needsUpdate = true;
    }

    this.raceState = 'READY';
    this.raceElapsedTime = 0;
    this.physicsAccumulator = 0;
    this.finishedCount = 0;
    this.winnerAnnounced = false;
    this.resultsDismissed = false;
    this.camShake = 0;
    this.camBankRoll = 0;
    this.directorState.cutAt = 0;
    this.directorState.hasFixedPos = false;
    this.directorState.shotName = 'Hero Dolly';
    this.kinematicHurdles = [];
    this.hurdleStationsS = [];
    this.checkpointVisuals = [];
    this.finishLaserBar = null;
    this.podiumSlots = [];
    this.startLightPods = [];
    this.balls = [];
    this.startGate = null;
    this.colliderMeta.clear();
    this.sound.updateRollingBed(0, false);

    this.dom.countdownOverlay.classList.add('hidden');
    this.dom.winnerToast.classList.add('hidden');
    this.dom.resultsModal.classList.add('hidden');
    this.dom.btnViewResults.classList.add('hidden');

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
    this.buildTrackMeshesAndPhysics(mapCfg);
    this.buildEnvironmentFloorAndSupports(mapCfg);
    this.buildCheckpoints();
    this.buildStartGate();
    this.buildFinishArchAndPodium();
    this.buildMultiLaneOrSplitFeatures();
    this.buildHurdles();
    this.buildBoosterPads();
    this.spawnBalls();

    if (!preserveCamera) {
      this.snapOverviewCamera();
    }

    this.updateFollowBallSelect();
    this.updateLeaderboard(true);
    this.syncUiState();
  }

  // ==========================================================================
  // Watertight Swept 3D Track Mesh & Physics Trimesh
  // ==========================================================================
  buildTrackMeshesAndPhysics(mapCfg) {
    const { stations } = this.trackData;
    const halfW = this.config.trackWidth / 2;
    const curbW = 0.36;
    const curbH = 0.16;
    const wallH = 1.82;
    const wallT = 0.45;
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

    for (let i = 0; i < numStations; i++) {
      const st = stations[i];
      const vCoord = st.s * 0.25;
      for (let k = 0; k < P; k++) {
        const [lx, ly] = profile[k];
        const vx = st.pos.x + st.R.x * lx + st.U.x * ly;
        const vy = st.pos.y + st.R.y * lx + st.U.y * ly;
        const vz = st.pos.z + st.R.z * lx + st.U.z * ly;
        positions.push(vx, vy, vz);
        // Deck top vertices (k = 0..2, 9) use exact lane UVs; side/underbody vertices step cleanly to avoid degenerate tangent derivatives
        const uCoord =
          k <= 2 || k === 9
            ? (lx + halfW) / this.config.trackWidth
            : (lx + halfW) / this.config.trackWidth + (k - 2) * 0.08;
        uvs.push(uCoord, vCoord);
      }

      const railPts = [
        [-halfW - wallT - 0.02, wallH + 0.06],
        [-halfW + 0.02, wallH + 0.06],
        [halfW - 0.02, wallH + 0.06],
        [halfW + wallT + 0.02, wallH + 0.06],
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

      const rA = i * 4;
      const rB = (i + 1) * 4;
      railIndices.push(rA, rA + 1, rB + 1, rA, rB + 1, rB);
      railIndices.push(rA + 2, rA + 3, rB + 3, rA + 2, rB + 3, rB + 2);
    }

    const addEndWall = (st, dirSign, height) => {
      const wallCenter = st.pos
        .clone()
        .addScaledVector(st.U, height * 0.5)
        .addScaledVector(st.T, dirSign * 0.35);
      const wallBox = new THREE.BoxGeometry(this.config.trackWidth + wallT * 2, height, 0.7);
      const wallMat = new THREE.MeshStandardMaterial({
        color: mapCfg?.pylonColor ?? 0x262f3f,
        roughness: 0.45,
        metalness: 0.55,
      });
      const wallMesh = new THREE.Mesh(wallBox, wallMat);
      wallMesh.position.copy(wallCenter);
      wallMesh.quaternion.copy(st.quat);
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      this.trackGroup.add(wallMesh);

      const frictionCfg = FRICTION_PRESETS[this.config.frictionPreset];
      const rb = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed()
          .setTranslation(wallCenter.x, wallCenter.y, wallCenter.z)
          .setRotation(st.quat)
      );
      const col = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(
          (this.config.trackWidth + wallT * 2) * 0.5,
          height * 0.5,
          0.35
        )
          .setFriction(frictionCfg.friction)
          .setRestitution(0.55),
        rb
      );
      this.colliderMeta.set(col.handle, { kind: 'wall' });
    };

    addEndWall(stations[0], -1, wallH);
    addEndWall(stations[stations.length - 1], 1, wallH + 0.6);

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
      roughness: this.config.frictionPreset === 'ice' ? 0.16 : 0.78,
      metalness: 0.24,
      envMapIntensity: 1.25,
    });
    const trackMesh = new THREE.Mesh(trackGeo, trackMat);
    trackMesh.castShadow = true;
    trackMesh.receiveShadow = true;
    this.trackGroup.add(trackMesh);

    const railGeo = new THREE.BufferGeometry();
    railGeo.setAttribute('position', new THREE.Float32BufferAttribute(railPositions, 3));
    railGeo.setAttribute('uv', new THREE.Float32BufferAttribute(railUvs, 2));
    railGeo.setIndex(railIndices);
    railGeo.computeVertexNormals();

    const railMat = new THREE.MeshStandardMaterial({
      color: mapCfg?.railColor ?? 0x64748b,
      roughness: 0.24,
      metalness: 0.88,
      side: THREE.DoubleSide,
    });
    const railMesh = new THREE.Mesh(railGeo, railMat);
    railMesh.castShadow = true;
    railMesh.receiveShadow = true;
    this.trackGroup.add(railMesh);

    // Map-themed emissive inner-curb guide strips
    const ledPositions = [];
    const ledIndices = [];
    for (let i = 0; i < numStations; i++) {
      const st = stations[i];
      const pts = [
        [-halfW + 0.03, curbH + 0.14],
        [-halfW + 0.03, curbH + 0.22],
        [halfW - 0.03, curbH + 0.14],
        [halfW - 0.03, curbH + 0.22],
      ];
      for (let k = 0; k < 4; k++) {
        ledPositions.push(
          st.pos.x + st.R.x * pts[k][0] + st.U.x * pts[k][1],
          st.pos.y + st.R.y * pts[k][0] + st.U.y * pts[k][1],
          st.pos.z + st.R.z * pts[k][0] + st.U.z * pts[k][1]
        );
      }
    }
    for (let i = 0; i < numStations - 1; i++) {
      const a = i * 4;
      const b = (i + 1) * 4;
      ledIndices.push(a, a + 1, b + 1, a, b + 1, b);
      ledIndices.push(a + 2, b + 3, a + 3, a + 2, b + 2, b + 3);
    }
    const ledGeo = new THREE.BufferGeometry();
    ledGeo.setAttribute('position', new THREE.Float32BufferAttribute(ledPositions, 3));
    ledGeo.setIndex(ledIndices);
    ledGeo.computeVertexNormals();
    const ledMat = new THREE.MeshStandardMaterial({
      color: mapCfg?.curbColor ?? 0xf59e0b,
      emissive: mapCfg?.curbEmissive ?? 0xd97706,
      emissiveIntensity: 0.95,
      roughness: 0.3,
      side: THREE.DoubleSide,
    });
    this.trackGroup.add(new THREE.Mesh(ledGeo, ledMat));

    // Rapier Trimesh Collider from the solid track shell
    const frictionCfg = FRICTION_PRESETS[this.config.frictionPreset];
    const vertsF32 = new Float32Array(positions);
    const idxU32 = new Uint32Array(indices);
    const trackBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const trimeshCol = RAPIER.ColliderDesc.trimesh(vertsF32, idxU32)
      .setFriction(frictionCfg.friction)
      .setRestitution(frictionCfg.restitution);
    const trackCollider = this.world.createCollider(trimeshCol, trackBody);
    this.colliderMeta.set(trackCollider.handle, { kind: 'track' });
  }

  buildEnvironmentFloorAndSupports(mapCfg) {
    const { stations, bounds } = this.trackData;
    const groundY = bounds.minY - 6.0;
    const centerX = bounds.centerX;
    const centerZ = bounds.centerZ;

    // Grounded arena plane sized generously for long tracks & top-down overview
    const groundSize = Math.max(950, Math.max(bounds.spanX, bounds.spanZ) * 4.5);
    const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      map: this.shared.floorTex,
      roughness: 0.85,
      metalness: 0.15,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.set(centerX, groundY, centerZ);
    groundMesh.receiveShadow = true;
    this.trackGroup.add(groundMesh);

    // Architectural steel support pylons every ~18m
    const pillarMat = new THREE.MeshStandardMaterial({
      color: mapCfg?.pylonColor ?? 0x1e2533,
      roughness: 0.45,
      metalness: 0.68,
    });
    const footMat = new THREE.MeshStandardMaterial({
      color: mapCfg?.railColor ?? 0x334155,
      roughness: 0.4,
      metalness: 0.75,
    });

    for (let i = 4; i < stations.length - 4; i += 36) {
      const st = stations[i];
      const topY = st.pos.y - 0.65;
      const colH = topY - groundY;
      if (colH <= 0.5) continue;

      const pylonGroup = new THREE.Group();
      const offsetX = this.config.trackWidth * 0.42;

      for (const side of [-1, 1]) {
        const legPos = st.pos.clone().addScaledVector(st.R, side * offsetX);
        const legH = legPos.y - 0.5 - groundY;
        if (legH <= 0.4) continue;

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

        const legGeo = new THREE.CylinderGeometry(0.28, 0.36, legH, 10);
        const leg = new THREE.Mesh(legGeo, pillarMat);
        leg.position.set(legPos.x, groundY + legH * 0.5, legPos.z);
        leg.castShadow = true;
        leg.receiveShadow = true;
        pylonGroup.add(leg);

        const footGeo = new THREE.CylinderGeometry(0.65, 0.75, 0.35, 12);
        const foot = new THREE.Mesh(footGeo, footMat);
        foot.position.set(legPos.x, groundY + 0.175, legPos.z);
        foot.receiveShadow = true;
        pylonGroup.add(foot);
      }

      this.trackGroup.add(pylonGroup);
    }

    // Scenic Map Landmarks arranged safely outside the track bounding footprint
    this.buildScenicLandmarks(mapCfg, bounds, groundY);
  }

  buildScenicLandmarks(mapCfg, bounds, groundY) {
    const rng = mulberry32(this.trackSeed * 3571 + 41);
    const kind = mapCfg?.landmarkKind || 'peaks';
    const baseMat = new THREE.MeshStandardMaterial({
      color: mapCfg?.landmarkColor ?? 0x26354a,
      roughness: kind === 'glaciers' ? 0.18 : 0.78,
      metalness: kind === 'towers' ? 0.65 : 0.12,
      flatShading: true,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: mapCfg?.landmarkAccent ?? 0xcbd5e1,
      emissive: kind === 'towers' || kind === 'basalt' ? mapCfg.landmarkAccent : 0x000000,
      emissiveIntensity: kind === 'towers' ? 1.1 : kind === 'basalt' ? 0.85 : 0,
      roughness: 0.35,
      flatShading: true,
    });

    const ringMinRx = bounds.spanX * 0.5 + 22;
    const ringMinRz = bounds.spanZ * 0.5 + 22;
    const count = 28;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (rng() - 0.5) * 0.16;
      const distMult = 1.0 + rng() * 0.65;
      const x = bounds.centerX + Math.cos(angle) * ringMinRx * distMult;
      const z = bounds.centerZ + Math.sin(angle) * ringMinRz * distMult;
      const scaleH = 14 + rng() * 34;
      const radius = 5 + rng() * 9;

      if (kind === 'peaks') {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, scaleH, 6), baseMat);
        cone.position.set(x, groundY + scaleH * 0.5, z);
        cone.rotation.y = rng() * Math.PI;
        this.trackGroup.add(cone);

        const cap = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.42, scaleH * 0.38, 6), accentMat);
        cap.position.set(x, groundY + scaleH * 0.81, z);
        cap.rotation.y = cone.rotation.y;
        this.trackGroup.add(cap);
      } else if (kind === 'mesas') {
        const h = 10 + rng() * 22;
        const mesa = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.72, radius * 1.1, h, 7), baseMat);
        mesa.position.set(x, groundY + h * 0.5, z);
        mesa.rotation.y = rng() * Math.PI;
        this.trackGroup.add(mesa);

        const strata = new THREE.Mesh(
          new THREE.CylinderGeometry(radius * 0.84, radius * 0.92, h * 0.22, 7),
          accentMat
        );
        strata.position.set(x, groundY + h * 0.68, z);
        strata.rotation.y = mesa.rotation.y;
        this.trackGroup.add(strata);
      } else if (kind === 'towers') {
        const h = 16 + rng() * 32;
        const w = 3.2 + rng() * 3.5;
        const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), baseMat);
        tower.position.set(x, groundY + h * 0.5, z);
        this.trackGroup.add(tower);

        const crown = new THREE.Mesh(new THREE.BoxGeometry(w + 0.25, 0.55, w + 0.25), accentMat);
        crown.position.set(x, groundY + h - 0.6, z);
        this.trackGroup.add(crown);
      } else if (kind === 'glaciers') {
        const h = 12 + rng() * 28;
        const spire = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.75, h, 5), baseMat);
        spire.position.set(x, groundY + h * 0.48, z);
        spire.rotation.set((rng() - 0.5) * 0.2, rng() * Math.PI, (rng() - 0.5) * 0.2);
        this.trackGroup.add(spire);

        const shard = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.4, h * 0.6, 5), accentMat);
        shard.position.set(x + radius * 0.45, groundY + h * 0.28, z + radius * 0.3);
        shard.rotation.z = -0.25;
        this.trackGroup.add(shard);
      } else {
        // Volcanic basalt columns & magma vents
        const h = 12 + rng() * 26;
        const rock = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.45, radius * 0.78, h, 6), baseMat);
        rock.position.set(x, groundY + h * 0.5, z);
        this.trackGroup.add(rock);

        if (i % 2 === 0) {
          const vent = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.65, radius * 0.65, 0.25, 10), accentMat);
          vent.position.set(x + radius * 0.9, groundY + 0.13, z);
          this.trackGroup.add(vent);
        }
      }
    }
  }

  buildCheckpoints() {
    const halfW = this.config.trackWidth * 0.5;
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.32,
      metalness: 0.82,
    });

    this.trackData.checkpoints.forEach((cpS, idx) => {
      const st = getStationAtS(this.trackData, cpS);
      const cpGroup = new THREE.Group();

      const cpBeaconMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0ea5e9,
        emissiveIntensity: 1.5,
        roughness: 0.2,
      });
      const cpStripMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.75,
        roughness: 0.35,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });

      // Surface threshold line
      const stripGeo = new THREE.PlaneGeometry(this.config.trackWidth - 0.75, 0.55);
      stripGeo.rotateX(-Math.PI / 2);
      const strip = new THREE.Mesh(stripGeo, cpStripMat);
      strip.position.set(0, 0.025, 0);
      cpGroup.add(strip);

      // Slim side checkpoint pylons (high clearance, zero obstacle interference)
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.75, 0.28), pillarMat);
        post.position.set(side * (halfW + 0.24), 1.38, 0);
        post.castShadow = true;
        cpGroup.add(post);

        const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.32), cpBeaconMat);
        beacon.position.set(side * (halfW + 0.24), 2.86, 0);
        cpGroup.add(beacon);
      }

      // Checkpoint sign on left side
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 0.82, 0.12),
        new THREE.MeshStandardMaterial({
          map: createSignCanvasTexture(`CP ${idx + 1} · ${cpS}m`, '#0f172a', '#38bdf8'),
          roughness: 0.32,
        })
      );
      sign.position.set(halfW + 0.55, 2.3, 0);
      cpGroup.add(sign);

      cpGroup.position.copy(st.pos);
      cpGroup.quaternion.copy(st.quat);
      this.trackGroup.add(cpGroup);

      this.checkpointVisuals.push({
        s: cpS,
        pos: st.pos.clone().addScaledVector(st.U, 1.5),
        beaconMat: cpBeaconMat,
        stripMat: cpStripMat,
        triggered: false,
      });
    });
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
      emissiveMap: this.shared.boosterTex,
      emissive: 0x22d3ee,
      emissiveIntensity: 1.65,
      roughness: 0.2,
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
      color: 0x334155,
      roughness: 0.3,
      metalness: 0.85,
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
        map: createSignCanvasTexture('START', '#0f172a', '#10b981'),
        roughness: 0.3,
      })
    );
    startSign.position.set(0, 3.6, 0.22);

    // 3-Pod Starting Light Tree (Red -> Amber -> Green)
    this.startLightPods = [];
    const podOffsets = [-1.05, 0, 1.05];
    const podColors = [0xef4444, 0xf59e0b, 0x10b981];
    for (let k = 0; k < 3; k++) {
      const podMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        emissive: podColors[k],
        emissiveIntensity: 0.08,
        roughness: 0.2,
        metalness: 0.4,
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
      roughness: 0.4,
      metalness: 0.1,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.copy(st.pos).addScaledVector(st.U, 0.02);
    strip.quaternion.copy(st.quat);
    strip.receiveShadow = true;
    this.trackGroup.add(strip);

    // Finish-Line Truss Arch
    const archGroup = new THREE.Group();
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.25,
      metalness: 0.88,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.3,
      metalness: 0.6,
    });

    const pillarH = 4.6;
    const pillarGeo = new THREE.BoxGeometry(0.55, pillarH, 0.55);
    const pL = new THREE.Mesh(pillarGeo, metalMat);
    pL.position.set(-halfW - 0.3, pillarH * 0.5, 0);
    pL.castShadow = true;
    const pR = new THREE.Mesh(pillarGeo, metalMat);
    pR.position.set(halfW + 0.3, pillarH * 0.5, 0);
    pR.castShadow = true;

    const beamGeo = new THREE.BoxGeometry(this.config.trackWidth + 1.4, 0.6, 0.7);
    const beam = new THREE.Mesh(beamGeo, metalMat);
    beam.position.set(0, pillarH, 0);
    beam.castShadow = true;

    const bannerGeo = new THREE.BoxGeometry(this.config.trackWidth + 0.4, 1.15, 0.16);
    const bannerMat = new THREE.MeshStandardMaterial({
      map: this.shared.checkerTex,
      roughness: 0.35,
    });
    const banner = new THREE.Mesh(bannerGeo, bannerMat);
    banner.position.set(0, pillarH - 0.75, 0);

    const signMesh = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.95, 0.22),
      new THREE.MeshStandardMaterial({
        map: createSignCanvasTexture('FINISH', '#0f172a', '#f59e0b'),
        roughness: 0.3,
      })
    );
    signMesh.position.set(0, pillarH + 0.75, 0);

    const trimL = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.2, 0.62), accentMat);
    trimL.position.set(-halfW - 0.3, 2.2, 0);
    const trimR = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.2, 0.62), accentMat);
    trimR.position.set(halfW + 0.3, 2.2, 0);

    // Animated finish-line optical timing laser bar
    const laserMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const laserStrip = new THREE.Mesh(
      new THREE.BoxGeometry(this.config.trackWidth - 0.4, 0.06, 0.06),
      laserMat
    );
    laserStrip.position.set(0, 2.45, 0);
    this.finishLaserBar = laserStrip;

    // Volumetric downward stadium beam cones flanking Finish Arch
    const beamMat = new THREE.MeshBasicMaterial({
      map: this.shared.spotBeamTex,
      color: 0xfef3c7,
      transparent: true,
      opacity: 0.26,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const spotConeGeo = new THREE.ConeGeometry(3.2, 9.0, 24, 1, true);
    for (const side of [-1, 1]) {
      const cone = new THREE.Mesh(spotConeGeo, beamMat);
      cone.position.set(side * (halfW * 0.55), 4.8, 0);
      archGroup.add(cone);
    }

    archGroup.add(pL, pR, beam, banner, signMesh, trimL, trimR, laserStrip);
    archGroup.position.copy(st.pos);
    archGroup.quaternion.copy(st.quat);
    this.trackGroup.add(archGroup);

    // Winner Podium beside Finish Plaza (s = L + 14m, raised lateral platform)
    const podSt = getStationAtS(this.trackData, L + 13);
    const podiumGroup = new THREE.Group();
    const basePlinth = new THREE.Mesh(
      new THREE.BoxGeometry(6.8, 0.6, 3.2),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.5 })
    );
    basePlinth.position.set(0, 0.3, 0);
    basePlinth.receiveShadow = true;
    podiumGroup.add(basePlinth);

    const steps = [
      { rank: 2, x: -2.0, h: 1.15, color: 0xcbd5e1 }, // Silver
      { rank: 1, x: 0.0, h: 1.75, color: 0xfbbf24 },  // Gold
      { rank: 3, x: 2.0, h: 0.8, color: 0xd97706 },   // Bronze
    ];

    for (const step of steps) {
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(0.75, 0.85, step.h, 20),
        new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.35, metalness: 0.75 })
      );
      col.position.set(step.x, 0.6 + step.h * 0.5, 0);
      col.castShadow = true;
      podiumGroup.add(col);

      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(0.78, 0.78, 0.12, 20),
        new THREE.MeshStandardMaterial({
          color: step.color,
          roughness: 0.22,
          metalness: 0.88,
        })
      );
      ring.position.set(step.x, 0.6 + step.h + 0.06, 0);
      podiumGroup.add(ring);

      // Podium rank plaque
      const plaque = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.45, 0.08),
        new THREE.MeshStandardMaterial({
          map: createSignCanvasTexture(`${step.rank}`, '#0f172a', `#${step.color.toString(16).padStart(6, '0')}`),
          roughness: 0.3,
        })
      );
      plaque.position.set(step.x, 0.6 + step.h * 0.5, 0.82);
      podiumGroup.add(plaque);

      // Trophy marble showcase placeholder (hidden until rank finishes)
      const trophy = new THREE.Mesh(
        this.shared.ballGeo,
        new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          map: this.shared.marbleTex,
          roughness: 0.1,
          metalness: 0.15,
          clearcoat: 1.0,
          clearcoatRoughness: 0.04,
          ior: 1.52,
          envMapIntensity: 1.45,
        })
      );
      trophy.scale.setScalar(1.25);
      const baseTrophyY = 0.6 + step.h + 0.12 + BALL_RADIUS * 1.25;
      trophy.position.set(step.x, baseTrophyY, 0);
      trophy.visible = false;
      trophy.castShadow = true;
      podiumGroup.add(trophy);

      this.podiumSlots.push({ rank: step.rank, mesh: trophy, baseY: baseTrophyY });
    }

    // Podium spotlight volumetric beam cone
    const podBeam = new THREE.Mesh(
      new THREE.ConeGeometry(4.2, 11.0, 24, 1, true),
      new THREE.MeshBasicMaterial({
        map: this.shared.spotBeamTex,
        color: 0xfde68a,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    podBeam.position.set(0, 6.2, 0);
    podiumGroup.add(podBeam);

    const podPos = podSt.pos
      .clone()
      .addScaledVector(podSt.R, halfW + 4.4)
      .addScaledVector(podSt.U, -0.35);
    podiumGroup.position.copy(podPos);
    podiumGroup.quaternion.copy(podSt.quat);
    this.trackGroup.add(podiumGroup);

    // Overhead stadium floodlight gantries every ~36m
    const gantryMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.3,
      metalness: 0.82,
    });
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: 0xe2e8f0,
      emissiveIntensity: 1.35,
      roughness: 0.2,
    });
    for (let s = 22; s < L - 12; s += 36) {
      const gst = getStationAtS(this.trackData, s);
      const gantry = new THREE.Group();
      const postH = 5.4;
      const gPostL = new THREE.Mesh(new THREE.BoxGeometry(0.32, postH, 0.32), gantryMat);
      gPostL.position.set(-halfW - 0.35, postH * 0.5, 0);
      const gPostR = new THREE.Mesh(new THREE.BoxGeometry(0.32, postH, 0.32), gantryMat);
      gPostR.position.set(halfW + 0.35, postH * 0.5, 0);
      const spanBeam = new THREE.Mesh(
        new THREE.BoxGeometry(this.config.trackWidth + 1.1, 0.3, 0.35),
        gantryMat
      );
      spanBeam.position.set(0, postH, 0);
      const lightBar = new THREE.Mesh(
        new THREE.BoxGeometry(this.config.trackWidth * 0.72, 0.14, 0.26),
        lampMat
      );
      lightBar.position.set(0, postH - 0.18, 0);
      gantry.add(gPostL, gPostR, spanBeam, lightBar);
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
      color: 0xf59e0b,
      roughness: 0.32,
      metalness: 0.55,
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
          .setRestitution(0.75),
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
          .setRestitution(0.65),
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
          .setRestitution(0.45),
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
          .setRestitution(0.65),
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
          .setRestitution(0.65),
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
      const rampH = 0.72 * scale;
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
          .setRestitution(0.25),
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
            .setRestitution(0.5),
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
          .setRestitution(0.7),
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
        color: new THREE.Color(colorHex),
        map: this.shared.marbleTex,
        roughness: 0.08,
        metalness: 0.14,
        clearcoat: 1.0,
        clearcoatRoughness: 0.03,
        iridescence: 0.22,
        iridescenceIOR: 1.35,
        sheen: 0.14,
        sheenRoughness: 0.3,
        ior: 1.52,
        reflectivity: 0.98,
        envMapIntensity: 1.65,
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
        .setLinearDamping(0.04)
        .setAngularDamping(0.03);

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
      });
    }

    if (this.selectedBallIndex >= count) {
      this.selectedBallIndex = 0;
    }
  }

  // ==========================================================================
  // Race Lifecycle Controls
  // ==========================================================================
  startRace() {
    if (this.raceState === 'FINISHED' || this.raceState === 'RACING' || this.raceState === 'PAUSED') {
      this.rebuildTrackAndRace({ preserveCamera: true });
    }
    this.sound.ensureContext();
    const recStarted = this.recorder.start();
    this.dom.hudRecBadge.classList.toggle('hidden', !recStarted);

    this.raceState = 'COUNTDOWN';
    this.countdownRemaining = 3.2;
    this.lastCountdownDigit = null;
    this.dom.countdownOverlay.classList.remove('hidden');

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
      const idx = MAP_ORDER.indexOf(this.config.mapPreset);
      this.config.mapPreset = MAP_ORDER[(idx + 1) % MAP_ORDER.length];
      this.syncSettingsControlsToDom();
    }
    this.rebuildTrackAndRace({ preserveCamera: false });
  }

  randomizeBallColors() {
    const used = new Set();
    for (let i = 0; i < this.config.ballCount; i++) {
      let hex;
      if (this.config.allowDuplicateColors) {
        hex = hslToHex(Math.random() * 360, 72 + Math.random() * 20, 48 + Math.random() * 14);
      } else {
        hex = generateDistinctColor(Math.floor(Math.random() * 100) + i, used);
        used.add(hex);
      }
      this.ballColors[i] = hex;
      if (this.balls[i]) {
        this.balls[i].color = hex;
        this.balls[i].mesh.material.color.set(hex);
      }
    }
    this.renderBallColorEditor();
    this.updateFollowBallSelect();
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
  stepSimulation(dt) {
    if (this.raceState === 'COUNTDOWN') {
      this.countdownRemaining -= dt;
      const digit = this.countdownRemaining > 0.6 ? Math.ceil(this.countdownRemaining - 0.4) : 0;
      if (digit !== this.lastCountdownDigit) {
        this.lastCountdownDigit = digit;
        if (digit >= 1 && digit <= 3) {
          this.dom.countdownText.textContent = String(digit);
          this.dom.countdownText.classList.remove('go');
          this.sound.playCountdown(false);
          this.startLightPods.forEach((pod, idx) => {
            const lit = (digit === 3 && idx === 0) || (digit <= 2 && idx <= 1);
            pod.mesh.material.emissiveIntensity = lit ? 2.6 : 0.08;
          });
        } else if (digit <= 0) {
          this.dom.countdownText.textContent = 'GO!';
          this.dom.countdownText.classList.add('go');
          this.sound.playCountdown(true);
          this.startLightPods.forEach((pod, idx) => {
            pod.mesh.material.emissiveIntensity = idx === 2 ? 3.2 : 0.08;
          });
          this.raceState = 'RACING';
          this.syncUiState();
          setTimeout(() => {
            if (this.raceState !== 'COUNTDOWN') {
              this.dom.countdownOverlay.classList.add('hidden');
            }
          }, 550);
        }
        this.dom.countdownText.style.animation = 'none';
        void this.dom.countdownText.offsetWidth;
        this.dom.countdownText.style.animation = '';
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

    const scaledDt = Math.min(dt, 0.05) * this.config.speedMultiplier;
    this.physicsAccumulator += scaledDt;

    let substeps = 0;
    while (this.physicsAccumulator >= FIXED_DT && substeps < MAX_SUBSTEPS_PER_FRAME) {
      this.physicsAccumulator -= FIXED_DT;
      substeps++;

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
      }
    }

    this.syncBallsFromPhysics(true);
  }

  addCamShake(ball, amount) {
    if (!ball) return;
    const isFollowed =
      ((this.cameraMode === 'leader' || this.cameraMode === 'director') && ball.rank === 1) ||
      (this.cameraMode === 'selected' && ball.id === this.selectedBallIndex);
    if (isFollowed) {
      this.camShake = Math.min(0.42, Math.max(this.camShake, amount));
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
        this.sound.playMarbleClack(Math.min(1, relSpeed / 14));
        if (relSpeed > 7.0) {
          this.addCamShake(b1, 0.12);
          this.addCamShake(b2, 0.12);
        }
        if (this.particles && relSpeed > 6.5 && Math.random() < 0.45) {
          this._v4.lerpVectors(b1.worldPos, b2.worldPos, 0.5);
          this.particles.emitBurst(this._v4, 5, '#ffffff', 5.2, 0.34, 14, 0.72);
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
        const boost = 7.8 * this.config.speedMultiplier;
        ball.body.setLinvel(
          {
            x: lv.x + otherMeta.dir.x * boost,
            y: lv.y + otherMeta.dir.y * boost + 0.5,
            z: lv.z + otherMeta.dir.z * boost,
          },
          true
        );
        this.sound.playHurdleHit('booster', 0.95);
        this.addCamShake(ball, 0.28);
        if (this.particles) {
          this.particles.emitBurst(ball.worldPos, 10, '#22d3ee', 7.2, 0.45, 10, 0.95);
        }
      }
    } else if (otherMeta.kind === 'hurdle') {
      if (speed > 0.75) {
        this.sound.playHurdleHit(otherMeta.subType, Math.min(1, speed / 14));
        this.addCamShake(ball, Math.min(0.24, speed * 0.015));
        if (this.particles && speed > 4.0 && Math.random() < 0.7) {
          this.particles.emitBurst(ball.worldPos, 6, '#fbbf24', 6.4, 0.4, 14, 0.88);
        }
      }
    } else if (otherMeta.kind === 'wall') {
      if (speed > 1.8) {
        this.sound.playWallHit(Math.min(1, speed / 18));
        if (speed > 8.0) this.addCamShake(ball, 0.1);
      }
    } else if (otherMeta.kind === 'track') {
      // Only play landing thud / whoosh if ball drops hard onto track surface
      if (Math.abs(lv.y) > 4.2) {
        this.sound.playWallHit(Math.min(1, Math.abs(lv.y) / 14));
        if (Math.abs(lv.y) > 6.2) {
          this.sound.playWhoosh(0.65);
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

  respawnBallAtCheckpoint(ball, reason) {
    const L = this.config.distanceMeters;
    const halfW = this.config.trackWidth * 0.5;
    let targetS = THREE.MathUtils.clamp(ball.lastCheckpointS + 0.8, 1.0, Math.max(2.0, L - 3.0));

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
    if (this.particles) {
      this.particles.emitBurst(spawnPos, 10, '#38bdf8', 6.0, 0.55, 10, 1.05);
    }
  }

  measureBallProgressAndFinishes(substepDt) {
    const { stations, sStart, ds, bounds, checkpoints } = this.trackData;
    const finishS = this.config.distanceMeters;
    const halfW = this.config.trackWidth * 0.5;
    const canRescue = this.raceElapsedTime > 1.6 && (!this.startGate || this.startGate.openProgress >= 0.85);

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

      // Update latest passed checkpoint + flash visual beacons on leader crossing
      for (const cpS of checkpoints) {
        if (ball.progressMeters >= cpS && cpS > ball.lastCheckpointS) {
          ball.lastCheckpointS = cpS;
        }
      }
      if (ball.rank === 1) {
        for (const cpVis of this.checkpointVisuals) {
          if (!cpVis.triggered && ball.progressMeters >= cpVis.s) {
            cpVis.triggered = true;
            cpVis.beaconMat.color.setHex(0x10b981);
            cpVis.beaconMat.emissive.setHex(0x10b981);
            cpVis.beaconMat.emissiveIntensity = 3.2;
            cpVis.stripMat.color.setHex(0x10b981);
            cpVis.stripMat.emissive.setHex(0x10b981);
            cpVis.stripMat.emissiveIntensity = 1.8;
            this.sound.playCheckpointChime();
            if (this.particles) {
              this.particles.emitBurst(cpVis.pos, 12, '#34d399', 6.5, 0.55, 10, 1.0);
            }
          }
        }
      }

      // Check fell-off-track or stuck behind obstacle; respawn near checkpoint
      if (!ball.finished && canRescue) {
        const fellOut =
          vertOffset < -1.35 ||
          Math.abs(latOffset) > halfW + 1.45 ||
          p.y < bounds.minY - 2.2;

        if (fellOut) {
          this.respawnBallAtCheckpoint(ball, 'fell');
          continue;
        }

        const lv = ball.body.linvel();
        const speed = Math.hypot(lv.x, lv.y, lv.z);
        const forwardDelta = ball.progressMeters - ball.prevProgressMeters;
        if (speed < 0.9 || forwardDelta < substepDt * 0.22) {
          ball.stuckTimer += substepDt;
          if (ball.stuckTimer >= 2.25) {
            this.respawnBallAtCheckpoint(ball, 'stuck');
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
          podSlot.mesh.material.color.set(ball.color);
          podSlot.mesh.visible = true;
        }

        if (ball.finishRank === 1 && !this.winnerAnnounced) {
          this.winnerAnnounced = true;
          this.sound.playWin();
          this.showWinnerToast(ball);
          this.dom.btnViewResults.classList.remove('hidden');

          if (this.particles) {
            const fSt = getStationAtS(this.trackData, finishS);
            const burstOrigin = fSt.pos.clone().addScaledVector(fSt.U, 3.6);
            this.particles.emitBurst(burstOrigin, 44, ball.color, 11.5, 1.6, 6.2, 1.55);
            this.particles.emitBurst(burstOrigin, 36, '#fbbf24', 10.5, 1.65, 6.2, 1.45);
          }
        } else if (ball.finishRank <= 3 && this.particles) {
          const fSt = getStationAtS(this.trackData, finishS);
          const burstOrigin = fSt.pos.clone().addScaledVector(fSt.U, 3.2);
          this.particles.emitBurst(burstOrigin, 22, ball.color, 9.0, 1.2, 6.8, 1.25);
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

    if (this.finishedCount >= this.balls.length && this.raceState === 'RACING') {
      this.raceState = 'FINISHED';
      this.syncUiState();
      this.finalizeRecordingAndOpenResults();
    }
  }

  async finalizeRecordingAndOpenResults() {
    if (this.recorder.isRecording) {
      this.dom.hudRecBadge.classList.add('hidden');
      this.recordedVideoInfo = await this.recorder.stop();
    }
    if (!this.resultsDismissed) {
      this.openResultsModal();
    }
  }

  syncBallsFromPhysics(allowEffects) {
    let trackedSpeed = 0;
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
      if (
        (this.cameraMode === 'selected' && ball.id === this.selectedBallIndex) ||
        (this.cameraMode !== 'selected' && ball.rank === 1)
      ) {
        trackedSpeed = ball.currentSpeed;
      }

      ball.worldPos.set(t.x, t.y, t.z);
      ball.mesh.position.set(t.x, t.y, t.z);
      ball.mesh.quaternion.set(r.x, r.y, r.z, r.w);

      // Ground contact shadow directly beneath marble
      if (this.contactShadowMesh && i < 50) {
        const st = this.trackData?.stations?.[ball.stationIdx];
        const trackY = st ? st.pos.y + 0.028 : t.y - BALL_RADIUS + 0.03;
        const clearance = Math.max(0, t.y - BALL_RADIUS - trackY);
        const shadowScale = Math.max(0.25, 1.0 - clearance * 0.16);
        this._dummy.position.set(t.x, Math.min(t.y - BALL_RADIUS + 0.035, trackY), t.z);
        this._dummy.rotation.set(0, 0, 0);
        this._dummy.scale.set(shadowScale, 1, shadowScale);
        this._dummy.updateMatrix();
        this.contactShadowMesh.setMatrixAt(i, this._dummy.matrix);
      }

      // Subtle spark puff on extreme sudden velocity drop
      if (allowEffects && Math.abs(ball.prevSpeed - speed) > 7.5 && this.particles && Math.random() < 0.4) {
        this.particles.emitBurst(ball.worldPos, 4, ball.color, 5.5, 0.38, 14, 0.75);
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

    const selBall = this.balls[this.selectedBallIndex];
    if (selBall && (this.cameraMode === 'selected' || this.raceState === 'RACING')) {
      this.selectionHalo.visible = true;
      this.selectionHalo.position.set(
        selBall.worldPos.x,
        selBall.worldPos.y - BALL_RADIUS + 0.06,
        selBall.worldPos.z
      );
    } else {
      this.selectionHalo.visible = false;
    }
  }

  // ==========================================================================
  // Camera Choreography (All 6 Modes: Overview, Leader, Ball, Full Top-Down, Finish, Easy Free)
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
    // Sets this._v1 (camera pos) and this._v3 (look target), returns { fovBonus, bankEnabled }
    const speedBonus = THREE.MathUtils.clamp(ball.currentSpeed * 0.36, 0, 12);
    if (angleIdx === 1) {
      // Low Bumper
      this._v3.copy(ball.worldPos).addScaledVector(st.T, 8.5).addScaledVector(st.U, 0.35);
      this._v1
        .copy(ball.worldPos)
        .addScaledVector(st.T, -4.1)
        .addScaledVector(st.U, 1.38)
        .addScaledVector(st.R, 0.52 * rightSign);
      return { fov: 58 + speedBonus, bankEnabled: true };
    }
    if (angleIdx === 2) {
      // Side Drone
      const side = Math.cos(this.raceElapsedTime * 0.25) >= 0 ? 1 : -1;
      this._v3.copy(ball.worldPos).addScaledVector(st.T, 3.4);
      this._v1
        .copy(ball.worldPos)
        .addScaledVector(st.T, 1.5)
        .addScaledVector(st.U, 3.0)
        .addScaledVector(st.R, 6.8 * side);
      return { fov: 53 + speedBonus * 0.5, bankEnabled: false };
    }
    if (angleIdx === 3) {
      // Reverse Cam (looking back into chasing pack)
      this._v3.copy(ball.worldPos).addScaledVector(st.T, -5.8).addScaledVector(st.U, 0.4);
      this._v1
        .copy(ball.worldPos)
        .addScaledVector(st.T, 5.8)
        .addScaledVector(st.U, 2.35)
        .addScaledVector(st.R, 0.9 * rightSign);
      return { fov: 56 + speedBonus * 0.75, bankEnabled: false };
    }
    // 0: Classic Hero Chase
    this._v3.copy(ball.worldPos).addScaledVector(st.T, 7.0);
    this._v1
      .copy(ball.worldPos)
      .addScaledVector(st.T, -8.5)
      .addScaledVector(st.U, 4.2)
      .addScaledVector(st.R, 1.15 * rightSign);
    return { fov: 52 + speedBonus, bankEnabled: true };
  }

  updateCamera(dt) {
    if (!this.trackData || this.balls.length === 0) return;

    const mapCfg = ENVIRONMENT_MAPS[this.config.mapPreset] || ENVIRONMENT_MAPS.alpine;
    const targetFog = this.cameraMode === 'topdown' ? 0.00028 : mapCfg.fogDensity;
    if (this.scene.fog) {
      this.scene.fog.density = THREE.MathUtils.damp(this.scene.fog.density, targetFog, 6, dt);
    }

    if (this.cameraMode === 'free') {
      this.controls.enabled = true;
      this.camera.up.set(0, 1, 0);
      this.updateFreeCameraMovement(dt);
      this.controls.update();
      if (this.skyDome) this.skyDome.position.copy(this.camera.position);
      this.atmosphere?.update(dt, this.controls.target);
      return;
    }
    this.controls.enabled = false;

    const sorted = [...this.balls].sort((a, b) => a.rank - b.rank);
    const leader = sorted[0];
    const selected = this.balls[this.selectedBallIndex] || leader;
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

    if (this.cameraMode === 'overview') {
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
        const podSt = getStationAtS(this.trackData, L + 12);
        this._v3.copy(podSt.pos).addScaledVector(podSt.R, this.config.trackWidth * 0.35);
        this._v1
          .copy(finSt.pos)
          .addScaledVector(finSt.T, -16)
          .addScaledVector(finSt.U, 12.5)
          .addScaledVector(finSt.R, -10.5);
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
        this.setDirectorShot('Hero Dolly');
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
        const orbit = Math.sin(nowSec * 0.55) * 4.5;
        this._v3
          .copy(podSt.pos)
          .addScaledVector(podSt.R, halfW + 4.4)
          .addScaledVector(podSt.U, 2.0);
        this._v1
          .copy(podSt.pos)
          .addScaledVector(podSt.T, -10.5)
          .addScaledVector(podSt.U, 5.2)
          .addScaledVector(podSt.R, halfW + 4.4 + orbit);
        targetFov = 46;
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
    } else if (this.cameraMode === 'selected') {
      speedNorm = THREE.MathUtils.clamp(selected.currentSpeed / 24, 0, 1);
      const st = getStationAtS(
        this.trackData,
        THREE.MathUtils.clamp(selected.progressMeters, 0, L + 8)
      );
      const stAhead = getStationAtS(
        this.trackData,
        THREE.MathUtils.clamp(selected.progressMeters + 3.8, 0, L + 8)
      );
      const info = this.computeFollowShot(selected, this.followShotAngle, st, -1);
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
    } else if (this.cameraMode === 'finish') {
      const finishSt = getStationAtS(this.trackData, L + 11.5);
      const lineSt = getStationAtS(this.trackData, Math.max(0, L - 5.5));
      const podiumAnchor = getStationAtS(this.trackData, L + 12.5);
      const podTarget = podiumAnchor.pos
        .clone()
        .addScaledVector(podiumAnchor.R, this.config.trackWidth * 0.38);

      this._v3.copy(lineSt.pos).lerp(podTarget, this.winnerAnnounced ? 0.42 : 0.18).addScaledVector(lineSt.U, 1.0);
      if (leader && leader.progressMeters > L - 32 && leader.progressMeters < L + 3) {
        this._v3.lerp(leader.worldPos, 0.35);
      }

      this._v1
        .copy(finishSt.pos)
        .addScaledVector(finishSt.U, 5.2)
        .addScaledVector(finishSt.R, -(this.config.trackWidth * 0.52 + 3.0));
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

    // Speed-reactive lens chromatic dispersion
    if (this.lensPass) {
      const caBase =
        this.cameraMode === 'leader' || this.cameraMode === 'selected' || this.cameraMode === 'director'
          ? 0.0008 + speedNorm * 0.0026
          : 0.0005;
      this.lensPass.uniforms.uAberration.value = THREE.MathUtils.damp(
        this.lensPass.uniforms.uAberration.value,
        caBase,
        6,
        dt
      );
    }

    if (this.skyDome) {
      this.skyDome.position.copy(this.camera.position);
    }
    this.atmosphere?.update(dt, this.smoothCamTarget);

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

  renderActiveFrame() {
    const gl = this.renderer?.getContext?.();
    if (!gl || gl.isContextLost()) return;

    if (this.ultraQuality && this.composer && !this.composerFailed && !isSoftwareGl) {
      try {
        // Clear any stale WebGL error flag before verifying first post-processing pass
        if (!this.composerVerified) {
          while (gl.getError() !== gl.NO_ERROR) {
            /* drain */
          }
        }
        this.composer.render();
        if (!this.composerVerified) {
          const glErr = gl.getError();
          this.composerVerified = true;
          if (glErr === gl.INVALID_FRAMEBUFFER_OPERATION || glErr === gl.OUT_OF_MEMORY) {
            throw new Error(`WebGL post-processing error ${glErr}`);
          }
        }
        return;
      } catch (err) {
        console.warn('Post-processing render fallback triggered:', err);
        this.disablePostProcessing();
        this.syncUiState();
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  startLoop() {
    this.lastFrameTime = performance.now();
    const tick = () => {
      try {
        const now = performance.now();
        const dt = Math.min(0.05, Math.max(0.001, (now - this.lastFrameTime) / 1000));
        this.lastFrameTime = now;

        this.stepSimulation(dt);
        this.updateCamera(dt);
        if (this.particles) {
          this.particles.update(dt);
        }
        if (this.trails) {
          this.trails.update(this.balls, this.camera.position);
        }
        if (this.shared.boosterTex) {
          this.shared.boosterTex.offset.y -= dt * 2.6;
        }
        if (this.finishLaserBar && this.finishLaserBar.material) {
          this.finishLaserBar.material.opacity = 0.52 + Math.sin(now * 0.008) * 0.25;
        }

        // Gently animate claimed winner podium trophies
        for (const slot of this.podiumSlots) {
          if (slot.mesh.visible) {
            slot.mesh.rotation.y += dt * 1.4;
            slot.mesh.position.y = slot.baseY + Math.sin(now * 0.003 + slot.rank) * 0.09;
          }
        }

        if (now - this.lastHudUpdateAt > 75) {
          this.lastHudUpdateAt = now;
          this.updateTelemetryHud();
          this.updateLeaderboard(false);
        }

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
    this.dom.hudTimer.textContent = this.formatTime(this.raceElapsedTime);
    this.dom.hudFinished.textContent = `${this.finishedCount} / ${this.balls.length}`;

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
        row.addEventListener('click', () => {
          this.selectBall(ball.id, true);
        });
        list.appendChild(row);
      }
    }

    for (let i = 0; i < sorted.length; i++) {
      const ball = sorted[i];
      const row = list.children[i];
      row.dataset.ballId = String(ball.id);
      row.className = `lb-row rank-${ball.rank <= 3 ? ball.rank : 'other'}${
        ball.id === this.selectedBallIndex ? ' selected' : ''
      }`;
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

  showWinnerToast(winnerBall) {
    this.dom.winnerToastSwatch.style.backgroundColor = winnerBall.color;
    this.dom.winnerToastText.textContent = `${winnerBall.name} Wins in ${winnerBall.finishTime.toFixed(2)}s!`;
    this.dom.winnerToast.classList.remove('hidden');
    setTimeout(() => {
      this.dom.winnerToast.classList.add('hidden');
    }, 4500);
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
      mixed: 'Mixed Course',
    };
    const mapLabel = (ENVIRONMENT_MAPS[this.config.mapPreset] || ENVIRONMENT_MAPS.alpine).label;
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

    // Configure Export Game Video Panel
    if (this.recordedVideoInfo && this.recordedVideoInfo.blob.size > 0) {
      const mb = (this.recordedVideoInfo.blob.size / (1024 * 1024)).toFixed(2);
      this.dom.videoExportMeta.textContent = `${mb} MB · ${this.recordedVideoInfo.ext.toUpperCase()} · ${this.formatTime(this.raceElapsedTime)}`;
      this.dom.videoExportPanel.classList.remove('hidden');
      this.dom.btnExportVideo.disabled = false;
      this.dom.btnPreviewVideo.disabled = false;
      this.dom.replayVideoPlayer.src = this.recordedVideoInfo.url;
    } else if (!this.recorder.isSupported()) {
      this.dom.videoExportPanel.classList.remove('hidden');
      this.dom.videoExportMeta.textContent = 'Video capture unavailable in this browser';
      this.dom.btnExportVideo.disabled = true;
      this.dom.btnPreviewVideo.disabled = true;
    } else {
      this.dom.videoExportPanel.classList.add('hidden');
    }
    this.dom.videoPreviewWrap.classList.add('hidden');
    this.dom.btnPreviewVideo.textContent = 'Preview Replay';

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

    this.dom.resultsModal.classList.remove('hidden');
  }

  exportGameVideo() {
    if (!this.recordedVideoInfo || !this.recordedVideoInfo.url) return;
    const a = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = this.recordedVideoInfo.url;
    a.download = `marble-rush-3d-${stamp}.${this.recordedVideoInfo.ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // ==========================================================================
  // UI Binding & Synchronization
  // ==========================================================================
  syncUiState() {
    const s = this.raceState;
    this.dom.btnStart.classList.toggle('hidden', s !== 'READY' && s !== 'FINISHED');
    this.dom.btnPause.classList.toggle('hidden', s !== 'RACING');
    this.dom.btnResume.classList.toggle('hidden', s !== 'PAUSED');
    this.dom.btnStart.textContent = s === 'FINISHED' ? 'Race Again' : 'Start Race';

    // Camera mode button active state, Follow-Up Angle button, Director shot tag, Letterbox & Free Cam
    const camBtns = this.dom.cameraModeButtons.querySelectorAll('.cam-btn');
    camBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.cam === this.cameraMode);
    });
    if (this.dom.btnCycleShot) {
      const showCycle = this.cameraMode === 'leader' || this.cameraMode === 'selected';
      this.dom.btnCycleShot.classList.toggle('hidden', !showCycle);
      this.dom.btnCycleShot.textContent = `Angle: ${FOLLOW_SHOT_ANGLES[this.followShotAngle]}`;
    }
    if (this.dom.cameraShotLabel) {
      this.dom.cameraShotLabel.classList.toggle('hidden', this.cameraMode !== 'director');
      this.dom.cameraShotLabel.textContent = this.directorState.shotName;
    }
    if (this.dom.cinemaBars) {
      const showBars = this.cameraMode === 'director' && this.hudHidden;
      this.dom.cinemaBars.classList.toggle('hidden', !showBars);
    }
    if (this.dom.freeCamBar) {
      this.dom.freeCamBar.classList.toggle('hidden', this.cameraMode !== 'free');
    }
    if (this.dom.btnToggleQuality) {
      this.dom.btnToggleQuality.textContent = this.ultraQuality ? '4K Ultra' : 'Balanced';
      this.dom.btnToggleQuality.classList.toggle('active', this.ultraQuality);
      if (isSoftwareGl) this.dom.btnToggleQuality.disabled = true;
    }
  }

  setUltraQuality(enabled) {
    if (isSoftwareGl || this.composerFailed) return;
    this.ultraQuality = enabled;
    if (enabled && !this.composer) {
      this.initPostProcessing();
    }
    this.onResize();
    this.syncUiState();
  }

  cycleFollowShot() {
    this.followShotAngle = (this.followShotAngle + 1) % FOLLOW_SHOT_ANGLES.length;
    this.sound.playCameraCut();
    this.syncUiState();
  }

  setConfigDrawerOpen(open) {
    this.dom.configDrawer.classList.toggle('collapsed', !open);
    this.dom.btnToggleConfig.setAttribute('aria-expanded', String(open));
    this.dom.btnToggleConfig.textContent = open ? 'Hide Setup' : 'Configure';
  }

  selectBall(ballId, switchCam = false) {
    this.selectedBallIndex = THREE.MathUtils.clamp(ballId, 0, this.balls.length - 1);
    this.dom.selectFollowBall.value = String(this.selectedBallIndex);
    if (switchCam) {
      this.setCameraMode('selected');
    }
    this.renderBallColorEditor();
    this.updateLeaderboard(false);
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

  updateFollowBallSelect() {
    const sel = this.dom.selectFollowBall;
    sel.innerHTML = '';
    for (let i = 0; i < this.config.ballCount; i++) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = `Ball #${String(i + 1).padStart(2, '0')}`;
      sel.appendChild(opt);
    }
    sel.value = String(this.selectedBallIndex);
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

      const followBtn = document.createElement('button');
      followBtn.type = 'button';
      followBtn.className = `ball-follow-btn${i === this.selectedBallIndex ? ' active' : ''}`;
      followBtn.textContent = i === this.selectedBallIndex ? 'Following' : 'Follow';
      followBtn.addEventListener('click', () => {
        this.selectBall(i, true);
      });

      row.append(left, followBtn);
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
          this.balls[existingIdx].mesh.material.color.set(prevColor);
        }
        this.ballColors[index] = normalized;
        if (this.balls[index]) {
          this.balls[index].color = normalized;
          this.balls[index].mesh.material.color.set(normalized);
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
      this.balls[index].mesh.material.color.set(normalized);
    }
    this.updateLeaderboard(false);
  }

  syncSettingsControlsToDom() {
    this.dom.inputBallCount.value = String(this.config.ballCount);
    this.dom.inputBallCountNum.value = String(this.config.ballCount);
    this.dom.valBallCount.textContent = String(this.config.ballCount);

    this.dom.inputBallSpeed.value = String(this.config.speedMultiplier);
    this.dom.valBallSpeed.textContent = `${this.config.speedMultiplier.toFixed(1)}x`;
    this.dom.speedPresetRow.querySelectorAll('.seg-btn').forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.speed) === this.config.speedMultiplier);
    });

    this.dom.valDistance.textContent = `${this.config.distanceMeters} m`;
    this.dom.distancePresets.querySelectorAll('.seg-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.dist === this.config.distancePreset);
    });
    this.dom.customDistanceWrap.classList.toggle(
      'hidden',
      this.config.distancePreset !== 'custom'
    );

    this.dom.mapPresetGroup.querySelectorAll('.seg-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.map === this.config.mapPreset);
    });
    this.dom.inputCycleMap.checked = this.config.cycleMapOnNewTrack;

    this.dom.trackTypeGroup.querySelectorAll('.seg-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.track === this.config.trackType);
    });

    this.dom.inputTrackWidth.value = String(this.config.trackWidth);
    this.dom.valTrackWidth.textContent = `${this.config.trackWidth} m`;

    this.dom.gravityPresets.querySelectorAll('.seg-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.gravity === this.config.gravityPreset);
    });
    this.dom.frictionPresets.querySelectorAll('.seg-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.friction === this.config.frictionPreset);
    });
    this.dom.inputExperimentalVariance.checked = this.config.experimentalVariance;

    this.dom.inputHurdleCount.value = String(this.config.hurdleCount);
    this.dom.inputHurdleCountNum.value = String(this.config.hurdleCount);
    this.dom.valHurdleCount.textContent = String(this.config.hurdleCount);

    this.dom.hurdleSizeGroup.querySelectorAll('.seg-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.size === this.config.hurdleSize);
    });
    this.dom.inputRandomHurdles.checked = this.config.randomHurdles;

    this.dom.obstacleTypesList.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.checked = this.config.enabledObstacles.has(cb.value);
    });

    this.dom.colorPresetsGroup.querySelectorAll('.seg-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.palette === this.config.palette);
    });
    this.dom.inputAllowDuplicates.checked = this.config.allowDuplicateColors;
  }

  bindUiEvents() {
    this.dom.btnRetryInit.addEventListener('click', () => window.location.reload());

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

    if (this.dom.btnToggleQuality) {
      this.dom.btnToggleQuality.addEventListener('click', () => {
        this.setUltraQuality(!this.ultraQuality);
      });
    }

    this.dom.btnToggleSound.addEventListener('click', () => {
      this.sound.enabled = !this.sound.enabled;
      this.dom.btnToggleSound.textContent = this.sound.enabled ? 'Sound On' : 'Sound Off';
      if (!this.sound.enabled) {
        this.sound.updateRollingBed(0, false);
      }
    });

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
          cand = generateDistinctColor(nextIdx, used);
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
    this.dom.speedPresetRow.querySelectorAll('.seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => applySpeed(btn.dataset.speed));
    });

    // Finish-line distance
    this.dom.distancePresets.querySelectorAll('.seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.dist;
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
    });
    this.dom.inputCustomDistance.addEventListener('change', (e) => {
      this.config.distancePreset = 'custom';
      this.config.distanceMeters = THREE.MathUtils.clamp(Number(e.target.value) || 120, 30, 350);
      e.target.value = String(this.config.distanceMeters);
      this.syncSettingsControlsToDom();
      this.rebuildTrackAndRace({ preserveCamera: false });
    });

    // Arena Map & Environment presets
    this.dom.mapPresetGroup.querySelectorAll('.seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.config.mapPreset = btn.dataset.map;
        this.syncSettingsControlsToDom();
        this.rebuildTrackAndRace({ preserveCamera: true });
      });
    });
    this.dom.inputCycleMap.addEventListener('change', (e) => {
      this.config.cycleMapOnNewTrack = e.target.checked;
    });

    // Track type
    this.dom.trackTypeGroup.querySelectorAll('.seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.config.trackType = btn.dataset.track;
        this.syncSettingsControlsToDom();
        this.rebuildTrackAndRace({ preserveCamera: false });
      });
    });

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
    this.dom.gravityPresets.querySelectorAll('.seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.config.gravityPreset = btn.dataset.gravity;
        this.syncSettingsControlsToDom();
        this.rebuildTrackAndRace({ preserveCamera: true });
      });
    });
    this.dom.frictionPresets.querySelectorAll('.seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.config.frictionPreset = btn.dataset.friction;
        this.syncSettingsControlsToDom();
        this.rebuildTrackAndRace({ preserveCamera: true });
      });
    });

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

    this.dom.hurdleSizeGroup.querySelectorAll('.seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.config.hurdleSize = btn.dataset.size;
        this.syncSettingsControlsToDom();
        this.rebuildTrackAndRace({ preserveCamera: true });
      });
    });

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
    this.dom.colorPresetsGroup.querySelectorAll('.seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.config.palette = btn.dataset.palette;
        this.ballColors = buildBallColorsForPalette(
          this.config.palette,
          this.config.ballCount,
          this.config.allowDuplicateColors
        );
        for (let i = 0; i < this.balls.length; i++) {
          this.balls[i].color = this.ballColors[i];
          this.balls[i].mesh.material.color.set(this.ballColors[i]);
        }
        this.syncSettingsControlsToDom();
        this.renderBallColorEditor();
        this.updateLeaderboard(false);
      });
    });

    this.dom.inputAllowDuplicates.addEventListener('change', (e) => {
      this.config.allowDuplicateColors = e.target.checked;
      if (!this.config.allowDuplicateColors) {
        // Deduplicate any existing duplicate colors
        const used = new Set();
        for (let i = 0; i < this.config.ballCount; i++) {
          let c = (this.ballColors[i] || '#f59e0b').toLowerCase();
          if (used.has(c)) {
            c = generateDistinctColor(i, used);
            this.ballColors[i] = c;
            if (this.balls[i]) {
              this.balls[i].color = c;
              this.balls[i].mesh.material.color.set(c);
            }
          }
          used.add(c);
        }
        this.renderBallColorEditor();
        this.updateLeaderboard(false);
      }
    });

    // Camera modes, Follow-Up Angle cycling & Zen HUD
    this.dom.cameraModeButtons.querySelectorAll('.cam-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.setCameraMode(btn.dataset.cam));
    });
    if (this.dom.btnCycleShot) {
      this.dom.btnCycleShot.addEventListener('click', () => this.cycleFollowShot());
    }

    this.dom.selectFollowBall.addEventListener('change', (e) => {
      this.selectBall(Number(e.target.value), true);
    });

    const toggleZenHud = () => {
      this.hudHidden = !this.hudHidden;
      this.dom.hudRoot.classList.toggle('zen-hidden', this.hudHidden);
      this.dom.btnShowHud.classList.toggle('hidden', !this.hudHidden);
      this.syncUiState();
    };
    this.dom.btnHideHud.addEventListener('click', toggleZenHud);
    this.dom.btnShowHud.addEventListener('click', toggleZenHud);

    // Results modal actions & video export
    this.dom.btnExportVideo.addEventListener('click', () => this.exportGameVideo());
    this.dom.btnPreviewVideo.addEventListener('click', () => {
      const hidden = this.dom.videoPreviewWrap.classList.toggle('hidden');
      this.dom.btnPreviewVideo.textContent = hidden ? 'Preview Replay' : 'Hide Replay';
      if (!hidden) {
        this.dom.replayVideoPlayer.play().catch(() => {});
      } else {
        this.dom.replayVideoPlayer.pause();
      }
    });
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

    // Raycast click on 3D marbles to select & follow
    this.canvas.addEventListener('pointerdown', (e) => {
      this._pointerDownPos = { x: e.clientX, y: e.clientY };
    });
    this.canvas.addEventListener('pointerup', (e) => {
      const dist = Math.hypot(
        e.clientX - this._pointerDownPos.x,
        e.clientY - this._pointerDownPos.y
      );
      if (dist > 6) return;
      const rect = this.canvas.getBoundingClientRect();
      this._pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this._pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this._raycaster.setFromCamera(this._pointer, this.camera);
      const meshes = this.balls.map((b) => b.mesh);
      const hits = this._raycaster.intersectObjects(meshes, false);
      if (hits.length > 0) {
        const idx = hits[0].object.userData.ballIndex;
        if (typeof idx === 'number') {
          this.selectBall(idx, true);
        }
      }
    });

    // Free camera quick actions
    this.dom.btnFreeFocusLeader.addEventListener('click', () => this.snapFreeCamToPack());
    this.dom.btnFreeCenterTrack.addEventListener('click', () => this.centerFreeCamOnTrack());

    // Keyboard shortcuts & Free Camera WASD/QE movement
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (
        this.cameraMode === 'free' &&
        (e.code === 'Space' || e.code.startsWith('Arrow'))
      ) {
        e.preventDefault();
      }
      this.keysPressed.add(e.code);

      if (e.key === 'h' || e.key === 'H') toggleZenHud();
      else if (e.key === '1') this.setCameraMode('overview');
      else if (e.key === '2') this.setCameraMode('leader');
      else if (e.key === '3') this.setCameraMode('selected');
      else if (e.key === '4') this.setCameraMode('topdown');
      else if (e.key === '5') this.setCameraMode('finish');
      else if (e.key === '6') this.setCameraMode('free');
      else if (e.key === '7') this.setCameraMode('director');
      else if ((e.key === 'c' || e.key === 'C') && (this.cameraMode === 'leader' || this.cameraMode === 'selected')) {
        this.cycleFollowShot();
      }
      else if (e.code === 'Space' && this.cameraMode !== 'free') {
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
