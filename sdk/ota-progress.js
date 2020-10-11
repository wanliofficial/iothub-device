"use strict";

var createObjectId = require('../dist/objectid/index').createObjectId;

function OTAProgress (opts) {
    opts = opts || {}
    this.productName = opts.productName || ''
    this.deviceName = opts.deviceName || ''
    this.mqttClient = opts.mqttClient || null
    this.version = opts.version || ''
    this.type = opts.type || ''
}

OTAProgress.prototype.sendProgress = function (progress) {
    var meta = {
        version: this.version,
        type: this.type
    }
    var topic = 'update_ota_status/' + this.productName + '/' + this.deviceName + '/' + createObjectId()
    this.mqttClient.publish(topic, JSON.stringify(Object.assign(meta, progress)), {qos: 1})
}

OTAProgress.prototype.download = function (percent, desc) {
    desc = desc || "download"
    this.sendProgress({ progress: percent, desc: desc })
}

OTAProgress.prototype.downloadError = function (desc) {
    desc = desc || "download error"
    this.download(-1, desc)
}

OTAProgress.prototype.checkMD5Error = function (desc) {
    desc = desc || "check md5 error"
    this.sendProgress({ progress: -2, desc: desc })
}

OTAProgress.prototype.installError = function (desc) {
    desc = desc || "install error"
    this.sendProgress({ progress: -3, desc: desc })
}

OTAProgress.prototype.error = function (desc) {
    desc = desc || "error"
    this.sendProgress({ progress: -4, desc: desc })
}

module.exports = OTAProgress