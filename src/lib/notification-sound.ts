'use client'
import { useCallback, useRef } from 'react'

// ─── Sound definitions using Web Audio API ─────────────────────────────────────

type SoundType = 'chime' | 'pop' | 'ding'

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

  // ─── Variant 3: Subtle ding (like Slack) ────────────────────────────────
  ding: {
    name: 'Приглушённый сигнал',
    description: 'Мягкий одиночный тон, похожий на Slack',
    play: (ctx) => {
      createOsc(ctx, 'triangle', 792, 0, 0.3, 0.12)
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

/** Play a notification sound by type */
export function playNotificationSound(type: SoundType) {
  try {
    const ctx = getAudioCtx()
    sounds[type].play(ctx)
  } catch { /* audio not supported */ }
}

/** Play a notification sound, respecting user preference */
export function useNotificationSound() {
  const lastPlayedRef = useRef(0)

  const play = useCallback((type: SoundType = 'chime') => {
    // Don't play more than once per second
    const now = Date.now()
    if (now - lastPlayedRef.current < 1000) return
    lastPlayedRef.current = now

    // Check preference
    try {
      const pref = localStorage.getItem('pm_sound')
      if (pref === 'off' || pref === null) return
      if (pref !== type) {
        // User has a different sound selected, play theirs
        playNotificationSound(pref as SoundType)
        return
      }
    } catch { /* ignore */ }

    playNotificationSound(type)
  }, [])

  return play
}

export function isSoundEnabled(): boolean {
  try {
    return localStorage.getItem('pm_sound') !== 'off' && localStorage.getItem('pm_sound') !== null
  } catch { return false }
}

export function getSelectedSound(): SoundType | null {
  try {
    const s = localStorage.getItem('pm_sound')
    if (s && s !== 'off' && s in sounds) return s as SoundType
    return null
  } catch { return null }
}

export function setSoundPreference(type: SoundType | 'off') {
  try {
    localStorage.setItem('pm_sound', type)
  } catch { /* ignore */ }
}