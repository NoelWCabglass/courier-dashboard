// Short two-tone chime via Web Audio — no audio file needed.
let ctx = null
export function playPing() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
    const now = ctx.currentTime
    const notes = [880, 1175] // A5, D6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = now + i * 0.15
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.25, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.3)
    })
  } catch (e) { /* audio not available — ignore */ }
}
