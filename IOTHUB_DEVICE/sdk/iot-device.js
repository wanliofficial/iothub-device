"use strict";

require('promise');
var fs = require('fs');
var mqtt = require('mqtt');
var EventEmitter = require('events').EventEmitter;
var createObjectId = require('../dist/objectid/index').createObjectId;
var storage = require('../dist/node-persist/node-persist');
var OTAProgress = require("./ota-progress");

fs.stat(__dirname + '/tmp/wanli', function (err, stats) {
    if (err) throw err;
    console.info('stats: ' + stats);
});

function IotDevice(opts) {
    opts = opts || {}
    this.serverAddress = 'mqtt://' + opts.serverAddress
    this.productName = opts.productName
    this.deviceName = opts.deviceName
    this.secret = opts.secret
    this.username = this.productName + '/' + this.deviceName
    this.shadowVersion = 0
    this.iotEmitter = new EventEmitter()

    if (opts.clientID) this.clientIdentifier = opts.clientID
    else this.clientIdentifier = this.productName + '-' + this.deviceName

    storage.init({ dir: opts.storePath || __dirname  + '/tmp' });
}

IotDevice.prototype.connect = function () {
    var opts = {
        rejectUnauthorized: false,
        username: this.username,
        password: this.secret,
        clientId: this.clientIdentifier,
        clean: false
    }, _this = this

    this.client = mqtt.connect(this.serverAddress, opts);
    this.client.on("connect", function() {
        _this.sendTagsRequest();
        _this.sendDataRequest("$shadow");
        _this.iotEmitter.emit("online");
    });
    this.client.on("offline", function() {
        _this.iotEmitter.emit("offline");
    });
    this.client.on("error", function(err) {
        _this.iotEmitter.emit("error", err);
    });
    this.client.on("message", function(topic, message) {
        _this.dispatchMessage(topic, message)
    });
}

IotDevice.prototype.disconnect = function () {
    if (this.client) this.client.end()
}

IotDevice.prototype.uploadData = function (data, type) {
    type = type || "default"
    if (this.client) {
        var topic = 'upload_data/' + this.productName + '/' + this.deviceName + '/' + type + '/' + createObjectId();
        this.client.publish(topic, data, { qos: 1 });
    }
}

IotDevice.prototype.updateStatus = function (status) {
    if (this.client) {
        var topic = 'update_status/' + this.productName + '/' + this.deviceName + '/' + createObjectId();
        this.client.publish(topic, JSON.stringify(status), { qos: 1 });
    }
}

IotDevice.prototype.checkRequestDuplication = function (requestID) {
    var key = 'requests/' + requestID, _this = this
    return new Promise(function(resolve, reject) {
        storage.getItem(key, function(err, res) {
            if (!err && !res) {
                storage.setItem(key, 1);
                resolve(true);
            }
            else reject(true);
        }).catch(function(error) {
            reject(error)
        })
    })
}

IotDevice.prototype.dispatchMessage = function (topic, payload) {
    // var cmdTopicRule = "(cmd|rpc)/:productName/:deviceName/:commandName/:encoding/:requestID/:expiresAt?"
    // var tagTopicRule = "tags/:productName/:tag/cmd/:commandName/:encoding/:requestID/:expiresAt?"
    // var m2mTopicRule = "m2m/:productName/:deviceName/:senderDeviceName/:MessageID"

    var cmdReg = /^(cmd|rpc)(?:\/([^\/#\?]+?))(?:\/([^\/#\?]+?))(?:\/([^\/#\?]+?))(?:\/([^\/#\?]+?))(?:\/([^\/#\?]+?))(?:\/([^\/#\?]+?))?[\/#\?]?$/i
    var tagsReg = /^tags(?:\/([^\/#\?]+?))(?:\/([^\/#\?]+?))\/cmd(?:\/([^\/#\?]+?))(?:\/([^\/#\?]+?))(?:\/([^\/#\?]+?))(?:\/([^\/#\?]+?))?[\/#\?]?$/i
    var m2mReg = /^m2m(?:\/([^\/#\?]+?))(?:\/([^\/#\?]+?))(?:\/([^\/#\?]+?))(?:\/([^\/#\?]+?))[\/#\?]?$/i
    var result = null, _this = this

    if ((result = cmdReg.exec(topic)) != null) this.checkRequestDuplication(result[6]).then(function(res) {
        _this.handleCommand({
            commandName: result[4],
            encoding: result[5],
            requestID: result[6],
            expiresAt: result[7] != null ? parseInt(result[7]) : null,
            payload: payload,
            commandType: result[1]
        })
    }).catch(function(err) {
        console.error(err)
    });
    else if ((result = tagsReg.exec(topic)) != null) this.checkRequestDuplication(result[7]).then(function(res) {
        _this.handleCommand({
            commandName: result[5],
            encoding: result[6],
            requestID: result[7],
            expiresAt: result[8] != null ? parseInt(result[8]) : null,
            payload: payload
        })
    }).catch(function(err) {
        console.error(err)
    });
    else if ((result = m2mReg.exec(topic)) != null) this.checkRequestDuplication(result[5]).then(function(res) {
        _this.iotEmitter.emit("m2m_msg", result[4], payload)
    }).catch(function(err) {
        console.error(err)
    });
    else console.error('unkonw message type')
}

IotDevice.prototype.handleCommand = function (opts) {
    opts = opts || { commandName: '', encoding: '', requestID: '', expiresAt: '', payload: {}, commandType: "cmd" }
    if (!opts.expiresAt || opts.expiresAt > Math.floor(Date.now() / 1000)) {
        var data = opts.payload;

        if (opts.encoding == "base64") data = new Buffer(opts.payload.toString(), 'base64');

        if (opts.commandName.startsWith("$")) {
            var payload = JSON.parse(data.toString())
            if (opts.commandName == "$set_ntp") this.handleNTP(payload)
            else if (opts.commandName == "$set_tags") this.setTags(payload)
            else if (opts.commandName = "$$ota_upgrade") {
                var progress = new OTAProgress({
                    productName: this.productName,
                    deviceName: this.deviceName,
                    mqttClient: this.client,
                    version: payload.version,
                    type: payload.type
                })
                this.iotEmitter.emit("ota_upgrade", payload, progress)
            }
        } else {
            console.log(155, data, opts)
            var _this = this
            this.iotEmitter.emit("command", opts.commandName, data, function(res) {
                var topic = opts.commandType + '_res/' + _this.productName + '/' + _this.deviceName + '/' + opts.commandName + '/' + opts.requestID + '/' + createObjectId()
                _this.client.publish(topic, res, { qos: 1 })
            });
        }
    } else if (opts.commandName == "$update_shadow") {
        this.handleUpdateShadow(opts.payload);
    } else if (opts.commandName == "$shadow_reply") {
        if (opts.payload.version > this.shadowVersion && opts.payload.status == "success") this.shadowVersion = opts.payload.version
    } else console.log(payload)
}

IotDevice.prototype.handleUpdateShaow = function (shadow) {
    if (this.shadowVersion <= shadow.version) {
        this.shadowVersion = shadow.version
        var _this = this
        if (shadow.state.desired) this.iotEmitter.emit('shadow', shadow.state.desired, function() {
            _this.uploadData(JSON.stringify({
                state: {
                    desired: null
                },
                version: _this.shadowVersion
            }), "$shadow_updated")
        })
    }
}

IotDevice.prototype.reportShadow = function (reported) {
    this.uploadData(JSON.stringify({
        state: {
            reported: reported
        },
        version: this.shadowVersion
    }), "$shadow_updated")
}

IotDevice.prototype.handleNTP = function (payload) {
    var time = Math.floor((payload.iothub_recv + payload.iothub_send + Date.now() - payload.device_time) / 2)
    this.iotEmitter.emit("ntp_set", time)
}

IotDevice.prototype.sendDataRequest = function (resource, payload) {
    payload = payload || "{}"
    if (this.client) {
        var topic = 'get/' + this.productName + '/' + this.deviceName + '/' + resource + '/' + createObjectId()
        this.client.publish(topic, payload, { qos: 1 });
    }
}

IotDevice.prototype.sendNTPRequest = function () {
    this.sendDataRequest("$ntp", JSON.stringify({ device_time: Date.now() }))
}

IotDevice.prototype.sendTagsRequest = function () {
    var _this = this
    storage.getItem("__tags", function(error, tags) {
        _this.sendDataRequest("$tags", JSON.stringify(tags))
    })
}

IotDevice.prototype.sendToDevice = function (deviceName, payload) {
    var topic = 'm2m/' + this.productName + '/' + deviceName + '/' + this.deviceName + '/' + createObjectId()
    if (this.client) this.client.publish(topic, payload, { qos: 1 })
}

IotDevice.prototype.setTags = function (serverTags) {
    var subscribe = [], unsubscribe = [], _this = this;
    storage.getItem("__tags", function(error, localTags) {
        if (localTags.tags_version < serverTags.tags_version) {
            serverTags.tags.forEach(function(tag) {
                if (localTags.tags.indexOf(tag) == -1) subscribe.push('tags/' + _this.productName + '/' + tag + '/' + cmd + '/+/+/+/#')
            })
            localTags.tags.forEach(function(tag) {
                if (serverTags.tags.indexOf(tag) == -1) unsubscribe.push('tags/' + _this.productName + '/' + tag + '/' + cmd + '/+/+/+/#')
            })

            subscribe.length && _this.client.subscribe(subscribe, { qos: 1 })
            unsubscribe.length && _this.client.unsubscribe(unsubscribe)

            storage.setItem("__tags", serverTags)
        }
    })
}

module.exports = IotDevice