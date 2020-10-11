"use strict";

var storage = require('../dist/node-persist/node-persist');

function PersistentStore(storePath) {
    storage.init({ dir: storePath });
}

PersistentStore.prototype.getTags = function (key, callback) {
    storage.getItem(key).then(function(res) {
        callback && callback(null, res)
    }).catch(function(err) {
        callback && callback(err, null)
    });
}

PersistentStore.prototype.setTags = function (key, value, callback) {
    storage.setItem(key, new Buffer(JSON.stringify(value))).then(function(res) {
        callback && callback(null, res)
    }).catch(function(err) {
        callback && callback(err, null)
    });
}

module.exports = PersistentStore;