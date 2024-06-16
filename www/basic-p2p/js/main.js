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

console.log("The connection state is now", $peer.connection.connectionState);

const VideoFX = class {
  constructor() {
    this.filters = ["grayscale", "sepia", "noir", "psychadelic", "none"];
    this.count = 0;
  }

  cycleFilter() {
    const filter = this.filters[this.count % this.filters.length];
    this.count += 1;
    return filter;
  }
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

$self.filters = new VideoFX();

$self.messageQueue = [];

function queueMessage(message, push = true) {
  if (push) $self.messageQueue.push(message);
  else $self.messageQueue.unshift(message);
}

function sendOrQueueMessage(peer, message, push = true) {
  const chatChannel = peer.chatChannel;
  if (!chatChannel || chatChannel.readyState !== "open") {
    queueMessage(message, push);
    return;
  }

  try {
    chatChannel.send(message);
  } catch (error) {
    console.error("Error sending message:", error);
    queueMessage(message, push);
  }
}

document.querySelector("#self").addEventListener("click", handleSelfVideo);

function handleSelfVideo(event) {
  if ($peer.connection.connectionState !== "connected") return;

  const filter = `filter-${$self.filters.cycleFilter()}`;
  const fdc = $peer.connection.createDataChannel(filter);
  fdc.onclose = () =>
    console.log(`Remote peer has closed the ${filter} data channel`);

  event.target.className = filter;
}

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
      console.error("Invalid call/leave button className!");
    }
  }
}

function joinCall() {
  sc.open();
}

function leaveCall() {
  sc.close();
  resetPeer($peer);
}

/**
 *  User-Media and Data-Channel Functions
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

document
  .querySelector("#chat-form")
  .addEventListener("submit", handleMessageForm);

function appendMessage(sender, logElement, message) {
  const log = document.querySelector(logElement);
  const li = document.createElement("li");
  li.className = sender;
  li.innerText = message;
  log.appendChild(li);

  if (log.scrollTo) {
    log.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
  } else {
    log.scrollTop = log.scrollHeight;
  }
}

function handleMessageForm(event) {
  event.preventDefault();
  const input = document.querySelector("#chat-msg");
  const message = input.value;
  if (!message) return;

  appendMessage("self", "#chat-log", message);

  sendOrQueueMessage($peer, message);
  input.value = "";
}

function addChatChannel(peer) {
  peer.chatChannel = peer.connection.createDataChannel("text chat", {
    negotiated: true,
    id: 100,
  });

  peer.chatChannel.onmessage = (event) =>
    appendMessage("peer", "#chat-log", event.data);
  peer.chatChannel.onclose = () => console.log("Chat channel closed");

  peer.chatChannel.onopen = () => {
    console.log("Chat channel opened.");
    while (
      $self.messageQueue.length > 0 &&
      peer.chatChannel.readyState === "open"
    ) {
      console.log("Attempting to send a message from the queue...");
      let message = $self.messageQueue.shift();
      sendOrQueueMessage(peer, message, false);
    }
  };
}

/**
 *  Call Features & Reset Functions
 */
function establishCallFeatures(peer) {
  registerRtcCallbacks(peer);
  addChatChannel(peer);
  addStreamingMedia($self.mediaStream, peer);
}

function resetPeer(peer) {
  displayStream(null, "#peer");
  peer.connection.close();
  peer.connection = new RTCPeerConnection($self.rtcConfig);
}
/**
 *  WebRTC Functions and Callbacks
 */
function registerRtcCallbacks(peer) {
  peer.connection.onconnectionstatechange = handleRtcConnectionStateChange;
  peer.connection.ondatachannel = handleRtcDataChannel;
  peer.connection.onnegotiationneeded = handleRtcConnectionNegotiation;
  peer.connection.onicecandidate = handleRtcIceCandidate;
  peer.connection.ontrack = handleRtcPeerTrack;
}

function handleRtcDataChannel({ channel }) {
  const label = channel.label;
  console.log("Data channel added for", label);

  if (label.startsWith("filter-")) {
    document.querySelector("#peer").className = label;
    channel.onopen = () => channel.close();
  } else {
    console.log(`Opened ${channel.label} channel with an ID of ${channel.id}`);
  }
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
function handleRtcConnectionStateChange() {
  const connectionState = $peer.connection.connectionState;
  console.log("The connection state is now", connectionState);
  document.body.className = connectionState;
}

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

function handleScDisconnectedPeer() {
  resetPeer($peer);
  establishCallFeatures($peer);
}

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
