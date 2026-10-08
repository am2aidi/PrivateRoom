/**
 * Voice Changer Module (Web Audio API)
 * Dynamic real-time microphone transformation for WebRTC.
 * 
 * Modifies active DSP nodes dynamically so WebRTC audio tracks remain continuous
 * and altered voice is transmitted clearly over P2P calls.
 */

export class VoiceChanger {
  constructor() {
    this.audioCtx = null;
    this.sourceNode = null;
    this.destinationNode = null;
    this.stream = null;
    this.isMuted = false;

    // Permanent DSP Nodes
    this.filterNode = null;
    this.gainNode = null;
    this.ringModOsc = null;
    this.ringModGain = null;
    this.compressorNode = null;

    this.activeEffect = 'normal';
    this.stackedEffect = 'none';
  }

  /**
   * Initialize Web Audio API graph from mic stream
   */
  async init(micStream) {
    this.stream = micStream;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.audioCtx = new AudioContextClass();

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    this.sourceNode = this.audioCtx.createMediaStreamSource(micStream);
    this.destinationNode = this.audioCtx.createMediaStreamDestination();

    // 1. Create BiquadFilter Node (for Deep / High / Whisper)
    this.filterNode = this.audioCtx.createBiquadFilter();
    this.filterNode.type = 'allpass'; // Default bypass

    // 2. Create Ring Modulator Nodes (for Robot)
    this.ringModGain = this.audioCtx.createGain();
    this.ringModGain.gain.setValueAtTime(1.0, this.audioCtx.currentTime);

    this.ringModOsc = this.audioCtx.createOscillator();
    this.ringModOsc.type = 'sine';
    this.ringModOsc.frequency.setValueAtTime(35, this.audioCtx.currentTime);
    
    // Ring mod carrier gain
    const oscGain = this.audioCtx.createGain();
    oscGain.gain.setValueAtTime(0.0, this.audioCtx.currentTime); // Off by default
    this.ringModOsc.connect(oscGain);
    oscGain.connect(this.ringModGain.gain);
    this.ringModOsc.start();

    this.oscGainNode = oscGain;

    // 3. Create DynamicsCompressor & Output Gain
    this.compressorNode = this.audioCtx.createDynamicsCompressor();
    this.gainNode = this.audioCtx.createGain();
    this.gainNode.gain.setValueAtTime(1.2, this.audioCtx.currentTime);

    // Wire Graph: Source -> Filter -> RingModGain -> Compressor -> Gain -> Destination
    this.sourceNode.connect(this.filterNode);
    this.filterNode.connect(this.ringModGain);
    this.ringModGain.connect(this.compressorNode);
    this.compressorNode.connect(this.gainNode);
    this.gainNode.connect(this.destinationNode);

    this.applyParams();
    return this.destinationNode.stream;
  }

  /**
   * Change voice effect dynamically in real-time
   */
  setEffect(preset, stackedPreset = 'none') {
    this.activeEffect = preset;
    this.stackedEffect = stackedPreset;

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    this.applyParams();
  }

  /**
   * Apply DSP node parameters dynamically
   */
  applyParams() {
    if (!this.audioCtx || !this.filterNode) return;
    const now = this.audioCtx.currentTime;

    const preset = this.activeEffect;
    const stacked = this.stackedEffect;

    // Reset default values
    let filterType = 'allpass';
    let filterFreq = 1000;
    let filterQ = 1.0;
    let ringAmount = 0.0;
    let masterGain = 1.2;

    const applyPresetLogic = (eff) => {
      if (eff === 'deep') {
        filterType = 'lowpass';
        filterFreq = 380;
        masterGain = 1.8;
      } else if (eff === 'high') {
        filterType = 'highpass';
        filterFreq = 1400;
        masterGain = 1.5;
      } else if (eff === 'robot') {
        ringAmount = 0.85;
      } else if (eff === 'whisper') {
        filterType = 'bandpass';
        filterFreq = 2200;
        filterQ = 1.8;
        masterGain = 2.2;
      }
    };

    applyPresetLogic(preset);
    if (stacked && stacked !== 'none' && stacked !== preset) {
      if (stacked === 'robot') ringAmount = 0.85;
      if (stacked === 'deep' && preset !== 'deep') filterFreq = Math.min(filterFreq, 500);
      if (stacked === 'high' && preset !== 'high') filterFreq = Math.max(filterFreq, 1200);
    }

    // Smooth parameter transitions
    this.filterNode.type = filterType;
    this.filterNode.frequency.setTargetAtTime(filterFreq, now, 0.05);
    this.filterNode.Q.setTargetAtTime(filterQ, now, 0.05);

    if (this.oscGainNode) {
      this.oscGainNode.gain.setTargetAtTime(ringAmount, now, 0.05);
    }

    this.gainNode.gain.setTargetAtTime(masterGain, now, 0.05);
  }

  toggleMute(muted) {
    this.isMuted = muted;
    if (this.stream) {
      this.stream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
    }
  }

  destroy() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    if (this.ringModOsc) {
      try { this.ringModOsc.stop(); } catch (e) {}
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close();
    }
    this.audioCtx = null;
    this.sourceNode = null;
    this.destinationNode = null;
  }
}
