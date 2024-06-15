/***
 * Excerpted from "Programming WebRTC",
 * published by The Pragmatic Bookshelf.
 * Copyrights apply to this code. It may not be used to create training material,
 * courses, books, articles, and the like. Contact us if you are in doubt.
 * We make no guarantees that this code is fit for any purpose.
 * Visit https://pragprog.com/titles/ksrtc for more book information.
 ***/
"use strict";
/**
 *  Global Variables: $self and $peer
 */
const $self = {
  rtcConfig: null,
  isPolite: false,
  isMakingOffer: false,
  isIgnoringOffer: false,
  isSettingRemoteAnswerPending: false,
  mediaConstraints: { audio: false, video: true },
};

const $peer = {
  connection: new RTCPeerConnection($self.rtcConfig),
};

/**
 *  Signaling-Channel Setup
 */
const namespace = prepareNamespace(globalThis.location.hash, true);
const sc = io.connect("/" + namespace, { autoConnect: false });

registerScCallbacks($self.mediaConstraints);

/**
 * =========================================================================
 *  Begin Application-Specific Code
 * =========================================================================
 */

/**
 *  User-Interface Setup
 */
document.querySelector("#header h1").innerText =
  "Welcome to Room #" + namespace;

document
  .querySelector("#call-button")
  .addEventListener("click", handleCallButton);

/**
 *  User-Media Setup
 */
requestUserMedia($self.mediaConstraints);

/**
 *  User-Interface Functions and Callbacks
 */
function handleCallButton(event) {
  const callButton = event.target;
  switch (callButton.className) {
    case "join": {
      console.log("Joining the call...");
      callButton.className = "leave";
      callButton.innerText = "Leave Call";
      joinCall();
      return;
    }
    case "leave": {
      console.log("Leaving the call...");
      callButton.className = "join";
      callButton.innerText = "Join Call";
      leaveCall();
      return;
    }
    default: {
      console.error("Call Button invalid className!");
    }
  }
}

function joinCall() {
  sc.open();
}

function leaveCall() {
  sc.close();
}

/**
 *  User-Media Functions
 */
function displayStream(stream, selector) {
  document.querySelector(selector).srcObject = stream;
}

async function requestUserMedia(mediaConstraints) {
  $self.mediaStream = new MediaStream();
  $self.media = await navigator.mediaDevices.getUserMedia(mediaConstraints);
  $self.mediaStream.addTrack($self.media.getTracks().at(0));

  displayStream($self.mediaStream, "#self");
}

function addStreamingMedia(stream, peer) {
  if (stream) {
    for (let track of stream.getTracks()) {
      peer.connection.addTrack(track, stream);
    }
  }
}

/**
 *  Call Features & Reset Functions
 */
function establishCallFeatures(peer) {
  registerRtcCallbacks(peer);
  addStreamingMedia($self.mediaStream, peer);
}
/**
 *  WebRTC Functions and Callbacks
 */
function registerRtcCallbacks(peer) {
  peer.connection.onnegotiationneeded = handleRtcConnectionNegotiation;
  peer.connection.onicecandidate = handleRtcIceCandidate;
  peer.connection.ontrack = handleRtcPeerTrack;
}

function handleRtcPeerTrack({ track, streams: [stream] }) {
  console.log("Attempt to display media from peer...");
  displayStream(stream, "#peer");
}
/**
 * =========================================================================
 *  End Application-Specific Code
 * =========================================================================
 */

/**
 *  Reusable WebRTC Functions and Callbacks
 */
async function handleRtcConnectionNegotiation() {
  $self.isMakingOffer = true;
  console.log("Attempting to make an offer...");
  await $peer.connection.setLocalDescription();
  sc.emit("signal", { description: $peer.connection.localDescription });
  $self.isMakingOffer = false;
}

function handleRtcIceCandidate({ candidate }) {
  console.log("Attempting to handle an ICE candidate...");
  sc.emit("signal", { candidate });
}
/**
 *  Signaling-Channel Functions and Callbacks
 */
function registerScCallbacks() {
  sc.on("connect", handleScConnect);
  sc.on("connected peer", handleScConnectedPeer);
  sc.on("disconnected peer", handleScDisconnectedPeer);
  sc.on("signal", handleScSignal);
}

function handleScConnect() {
  console.log("Successfully connected to the signaling server!");
  establishCallFeatures($peer);
}

function handleScConnectedPeer() {
  $self.isPolite = true;
}

function handleScDisconnectedPeer() {}

async function handleScSignal({ description, candidate }) {
  if (description) {
    const readyForOffer =
      !$self.isMakingOffer &&
      ($peer.connection.signalingState === "stable" ||
        $self.isSettingRemoteAnswerPending);

    const offerCollision = description.type === "offer" && !readyForOffer;
    $self.isIgnoringOffer = !$self.isPolite && offerCollision;
    if ($self.isIgnoringOffer) return;

    $self.isSettingRemoteAnswerPending = description.type === "answer";
    await $peer.connection.setRemoteDescription(description);
    $self.isSettingRemoteAnswerPending = false;

    if (description.type === "offer") {
      await $peer.connection.setLocalDescription();
      sc.emit("signal", { description: $peer.connection.localDescription });
    }
  } else if (candidate) {
    try {
      await $peer.connection.addIceCandidate(candidate);
    } catch (error) {
      if (!$self.isIgnoringOffer && candidate.candidate.length > 1) {
        console.error("Unable to add ICE candidate for peer:", error);
      }
    }
  }
}

/**
 *  Utility Functions
 */
function prepareNamespace(hash, setLocation) {
  let ns = hash.replace(/^#/, "");

  if (/^[0-9]{7}$/.test(ns)) {
    console.log("Checked existing namespace", ns);
    return ns;
  }

  ns = Math.random().toString().substring(2, 9);
  console.log("Created new namespace", ns);

  if (setLocation) globalThis.location.hash = ns;
  return ns;
}
