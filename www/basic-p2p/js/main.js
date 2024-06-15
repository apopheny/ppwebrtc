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

/**
 *  Signaling-Channel Setup
 */
const namespace = prepareNamespace(globalThis.location.hash, true);
const sc = io.connect("/" + namespace, { autoConnect: false });

registerScCallbacks();

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

/**
 *  Call Features & Reset Functions
 */

/**
 *  WebRTC Functions and Callbacks
 */

/**
 * =========================================================================
 *  End Application-Specific Code
 * =========================================================================
 */

/**
 *  Reusable WebRTC Functions and Callbacks
 */

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
}

function handleScConnectedPeer() {}
function handleScDisconnectedPeer() {}
function handleScSignal() {}

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
