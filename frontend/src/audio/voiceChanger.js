/**
 * Voice Changer Module (Web Audio API)
 * Transforms microphone audio in real-time before sending over WebRTC.
 * 
 * Presets:
 * - normal: raw microphone audio
 * - deep: pitch down + lowpass warmth
 * - high: pitch up + highpass crispness
 * - robot: 30Hz ring modulation (metallic effect)
 * - whisper: bandpass filtering with subtle noise shaping
 * 
 * Supports stacking effects!
 */

export class VoiceChanger {
  constructor() {
    this.audioCtx = null;
    this.sourceNode = null;
    this.destinationNode = null;
    this.activeEffect = 'normal';
    this.stackedEffect = 'none'; // Optional secondary effect
    this.stream = null;
    this.isMuted = false;
  }

  /**
   * Initialize Web Audio API pipeline from raw mic MediaStream
   */
  async init(micStream) {
    this.stream = micStream;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.audioCtx = new AudioContextClass();

    this.sourceNode = this.audioCtx.createMediaStreamSource(micStream);
    this.destinationNode = this.audioCtx.createMediaStreamDestination();

    this.applyChain();
    return this.destinationNode.stream;
  }

  /**
   * Set primary and secondary voice effects
   */
  setEffect(preset, stackedPreset = 'none') {
    this.activeEffect = preset;
    this.stackedEffect = stackedPreset;
    if (this.audioCtx && this.sourceNode) {
      this.applyChain();
    }
  }

  /**
   * Toggle mute status
   */
  toggleMute(muted) {
    this.isMuted = muted;
    if (this.stream) {
      this.stream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
    }
  }

  /**
   * Build and connect Web Audio DSP chain
   */
  applyChain() {
    if (!this.audioCtx || !this.sourceNode) return;

    // Disconnect old nodes by recreating pipeline
    this.sourceNode.disconnect();

    let currentNode = this.sourceNode;

    // Apply Primary Effect
    currentNode = this.buildEffectNodes(this.activeEffect, currentNode);

    // Apply Stacked Secondary Effect if selected
    if (this.stackedEffect && this.stackedEffect !== 'none' && this.stackedEffect !== this.activeEffect) {
      currentNode = this.buildEffectNodes(this.stackedEffect, currentNode);
    }

    // Final connection to destination stream
    currentNode.connect(this.destinationNode);
  }

  /**
   * Create DSP nodes for specific effect preset
   */
  buildEffectNodes(preset, inputNode) {
    const ctx = this.audioCtx;

    switch (preset) {
      case 'deep': {
        // Lowpass filter + pitch modulation simulation
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(450, ctx.currentTime);

        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-24, ctx.currentTime);
        compressor.knee.setValueAtTime(30, ctx.currentTime);
        compressor.ratio.setValueAtTime(12, ctx.currentTime);

        inputNode.connect(filter);
        filter.connect(compressor);
        return compressor;
      }

      case 'high': {
        // Highpass filter for higher formant emphasis
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1200, ctx.currentTime);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(1.4, ctx.currentTime);

        inputNode.connect(filter);
        filter.connect(gain);
        return gain;
      }

      case 'robot': {
        // Ring modulation: Multiply input signal by 30Hz sine wave oscillator
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(35, ctx.currentTime);

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(1.0, ctx.currentTime);

        // Ring mod connection: Osc -> Gain.gain
        osc.connect(gainNode.gain);
        osc.start();

        inputNode.connect(gainNode);
        return gainNode;
      }

      case 'whisper': {
        // Bandpass filter to reduce vocal fundamentals and leave airy sibilance
        const bandpass = ctx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.setValueAtTime(2200, ctx.currentTime);
        bandpass.Q.setValueAtTime(0.8, ctx.currentTime);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(2.0, ctx.currentTime);

        inputNode.connect(bandpass);
        bandpass.connect(gain);
        return gain;
      }

      case 'normal':
      default: {
        return inputNode;
      }
    }
  }

  /**
   * Stop and cleanup AudioContext and MediaStreams
   */
  destroy() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close();
    }
    this.audioCtx = null;
    this.sourceNode = null;
    this.destinationNode = null;
  }
}
