'use client'
import { useCallback, useRef } from 'react'

// ─── Sound definitions using Web Audio API ─────────────────────────────────────

type SoundType = 'chime' | 'pop' | 'ding'

const DEFAULT_SOUND: SoundType = 'ding'

interface SoundDefinition {
  name: string
  description: string
  play: (ctx: AudioContext) => void
}

function createOsc(ctx: AudioContext, type: OscillatorType, freq: number, start: number, duration: number, gain: number = 0.15) {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
  g.gain.setValueAtTime(0, ctx.currentTime + start)
  g.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.01)
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration)
  osc.connect(g).connect(ctx.destination)
  osc.start(ctx.currentTime + start)
  osc.stop(ctx.currentTime + start + duration)
}

const sounds: Record<SoundType, SoundDefinition> = {
  // ─── Variant 1: Soft chime (like iMessage) ─────────────────────────────
  chime: {
    name: 'Мягкий звонок',
    description: 'Нежный двухтональный звук, похожий на iMessage',
    play: (ctx) => {
      createOsc(ctx, 'sine', 880, 0, 0.15, 0.12)
      createOsc(ctx, 'sine', 1100, 0.08, 0.2, 0.1)
    },
  },

  // ─── Variant 2: Gentle pop (like Telegram) ──────────────────────────────
  pop: {
    name: 'Тихий хлопок',
    description: 'Короткий мягкий звук, похожий на Telegram',
    play: (ctx) => {
      createOsc(ctx, 'sine', 600, 0, 0.08, 0.15)
      createOsc(ctx, 'sine', 900, 0.03, 0.1, 0.08)
    },
  },

  // ─── Variant 3: Soft two-note signal (refined) ──────────────────────────
  ding: {
    name: 'Приглушённый сигнал',
    description: 'Две ноты с плавным переходом, похожий на Slack',
    play: (ctx) => {
      const t = ctx.currentTime
      const master = ctx.createGain()
      master.gain.setValueAtTime(0.35, t)
      master.connect(ctx.destination)

      // Helper: create a soft sine tone with a subtle harmonic shimmer
      const softTone = (freq: number, start: number, peakGain: number, peakAt: number, endAt: number) => {
        // Fundamental — pure sine
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, t + start)
        g.gain.setValueAtTime(0, t + start)
        g.gain.linearRampToValueAtTime(peakGain, t + start + peakAt)
        g.gain.exponentialRampToValueAtTime(0.0001, t + start + endAt)
        osc.connect(g).connect(master)
        osc.start(t + start)
        osc.stop(t + start + endAt)

        // Shimmer — quiet octave harmonic for warmth
        const osc2 = ctx.createOscillator()
        const g2 = ctx.createGain()
        osc2.type = 'sine'
        osc2.frequency.setValueAtTime(freq * 2, t + start)
        g2.gain.setValueAtTime(0, t + start)
        g2.gain.linearRampToValueAtTime(peakGain * 0.15, t + start + peakAt + 0.02)
        g2.gain.exponentialRampToValueAtTime(0.0001, t + start + endAt * 0.7)
        osc2.connect(g2).connect(master)
        osc2.start(t + start)
        osc2.stop(t + start + endAt)
      }

      // Note 1: F4 (349 Hz) — warm low tone
      softTone(349, 0, 0.18, 0.04, 0.55)

      // Note 2: A4 (440 Hz) — major third up, starts well into note 1's sustain
      softTone(440, 0.25, 0.16, 0.04, 0.55)
    },
  },
}

export const soundTypes = Object.keys(sounds) as SoundType[]
export const soundMeta: Record<SoundType, Omit<SoundDefinition, 'play'>> = {
  chime: { name: sounds.chime.name, description: sounds.chime.description },
  pop: { name: sounds.pop.name, description: sounds.pop.description },
  ding: { name: sounds.ding.name, description: sounds.ding.description },
}

let audioCtx: AudioContext | null = null
function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioContext()
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

/** Get the user's preferred sound type (defaults to 'ding') */
function getEffectiveSound(): SoundType {
  try {
    const pref = localStorage.getItem('pm_sound')
    if (pref && pref !== 'off' && pref in sounds) return pref as SoundType
  } catch { /* ignore */ }
  return DEFAULT_SOUND
}

/** Play a notification sound, respecting user preference.
 *  Can be called with no args — will use the saved preference or default 'ding'. */
export function playNotificationSound(type?: SoundType) {
  try {
    if (!type) type = getEffectiveSound()
    const ctx = getAudioCtx()
    sounds[type].play(ctx)
  } catch { /* audio not supported */ }
}

/** Play a notification sound with rate-limiting, respecting user preference */
export function useNotificationSound() {
  const lastPlayedRef = useRef(0)

  const play = useCallback(() => {
    // Don't play more than once per second
    const now = Date.now()
    if (now - lastPlayedRef.current < 1000) return
    lastPlayedRef.current = now

    // Check if sound is explicitly disabled
    try {
      if (localStorage.getItem('pm_sound') === 'off') return
    } catch { /* ignore */ }

    playNotificationSound()
  }, [])

  return play
}

export function isSoundEnabled(): boolean {
  try {
    return localStorage.getItem('pm_sound') !== 'off'
  } catch { return true }
}

export function getSelectedSound(): SoundType {
  return getEffectiveSound()
}

export function setSoundPreference(type: SoundType | 'off') {
  try {
    localStorage.setItem('pm_sound', type)
  } catch { /* ignore */ }
}