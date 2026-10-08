/**
 * WebRTC PeerConnection Manager
 * Handles peer-to-peer audio calls (with STUN fallback) and DataChannel for view-once images.
 */

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

export class WebRTCManager {
  constructor(sendSignalCallback, callbacks = {}) {
    this.sendSignal = sendSignalCallback;
    this.callbacks = callbacks; // { onRemoteStream, onDataChannelMessage, onCallEnded }
    this.peerConnection = null;
    this.dataChannel = null;
    this.localStream = null;
    this.remoteAudioElement = null;
  }

  /**
   * Initialize RTCPeerConnection
   */
  initPeerConnection() {
    if (this.peerConnection) return;

    this.peerConnection = new RTCPeerConnection(RTC_CONFIG);

    // Handle ICE Candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({
          type: 'webrtc-signal',
          signalType: 'ice-candidate',
          candidate: event.candidate
        });
      }
    };

    // Handle incoming Remote Audio Stream
    this.peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (this.callbacks.onRemoteStream) {
        this.callbacks.onRemoteStream(remoteStream);
      }
      this.playRemoteAudio(remoteStream);
    };

    // Handle incoming DataChannel
    this.peerConnection.ondatachannel = (event) => {
      this.setupDataChannel(event.channel);
    };

    // Connection state monitoring
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        if (this.callbacks.onCallEnded) {
          this.callbacks.onCallEnded();
        }
      }
    };
  }

  /**
   * Setup DataChannel listeners
   */
  setupDataChannel(channel) {
    this.dataChannel = channel;
    this.dataChannel.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (this.callbacks.onDataChannelMessage) {
          this.callbacks.onDataChannelMessage(parsed);
        }
      } catch (err) {
        console.error('DataChannel parse error:', err);
      }
    };
  }

  /**
   * Start an Audio Call (Initiator)
   */
  async startCall(processedAudioStream) {
    this.initPeerConnection();
    this.localStream = processedAudioStream;

    // Create DataChannel
    const dc = this.peerConnection.createDataChannel('viewOnceChannel');
    this.setupDataChannel(dc);

    // Add processed audio tracks
    processedAudioStream.getAudioTracks().forEach((track) => {
      this.peerConnection.addTrack(track, processedAudioStream);
    });

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    this.sendSignal({
      type: 'webrtc-signal',
      signalType: 'offer',
      sdp: offer
    });
  }

  /**
   * Accept an incoming Call (Joiner)
   */
  async acceptCall(processedAudioStream, offerSdp) {
    this.initPeerConnection();
    this.localStream = processedAudioStream;

    processedAudioStream.getAudioTracks().forEach((track) => {
      this.peerConnection.addTrack(track, processedAudioStream);
    });

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offerSdp));

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    this.sendSignal({
      type: 'webrtc-signal',
      signalType: 'answer',
      sdp: answer
    });
  }

  /**
   * Process incoming WebRTC signal (offer, answer, candidate)
   */
  async handleSignal(signalData) {
    if (!this.peerConnection && signalData.signalType !== 'offer') return;

    switch (signalData.signalType) {
      case 'offer':
        // Incoming call notification handled by UI caller
        break;
      case 'answer':
        if (this.peerConnection && this.peerConnection.signalingState === 'have-local-offer') {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
        }
        break;
      case 'ice-candidate':
        if (this.peerConnection && signalData.candidate) {
          try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(signalData.candidate));
          } catch (e) {
            console.warn('Error adding ICE candidate:', e);
          }
        }
        break;
    }
  }

  /**
   * Send data via WebRTC DataChannel if open
   */
  sendData(dataObject) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(dataObject));
      return true;
    }
    return false;
  }

  /**
   * Play remote audio stream using hidden <audio> element
   */
  playRemoteAudio(stream) {
    if (!this.remoteAudioElement) {
      this.remoteAudioElement = document.createElement('audio');
      this.remoteAudioElement.autoplay = true;
      document.body.appendChild(this.remoteAudioElement);
    }
    this.remoteAudioElement.srcObject = stream;
  }

  /**
   * End call and cleanup peer connection
   */
  endCall() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.remoteAudioElement) {
      this.remoteAudioElement.srcObject = null;
      if (this.remoteAudioElement.parentNode) {
        this.remoteAudioElement.parentNode.removeChild(this.remoteAudioElement);
      }
      this.remoteAudioElement = null;
    }
  }
}
