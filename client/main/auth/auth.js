
'use strict';

const ProgressStream = require('../utils/progressstream');

function events() {
    let stream = new ProgressStream();
    stream.resolve();
    return stream;
}

function promptSignIn(opts) {

}

function currentUser() {
    return null;
}

async function getAuthToken(forceRefresh) {
    return null;
}

async function signOut() {

}

async function waitForSignIn() {

}

function init() {

}

module.exports = { init, currentUser, events, getAuthToken, signOut, promptSignIn, waitForSignIn };
