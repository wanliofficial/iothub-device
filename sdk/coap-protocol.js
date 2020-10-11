"use strict";
var coap = require('coap');
var createObjectId = require('../dist/objectid/index').createObjectId;

function IotCoAPProtocol (opts) {
    opts = opts || {}
    this.serverAddress = opts.serverAddress || "127.0.0.1"
    this.serverPort = opts.serverPort || 5683
    this.productName = opts.productName
    this.deviceName = opts.deviceName
    this.secret = opts.secret
    this.username = this.productName + '/' + this.deviceName
    if (opts.clientID != null) {
        this.clientIdentifier = this.username + '/' + opts.clientID
    } else {
        this.clientIdentifier = this.username
    }
}

IotCoAPProtocol.prototype.publish = function (topic, payload) {
    var req = coap.request({
        host: this.serverAddress,
        post: this.serverPort,
        method: "put",
        pathname: 'mqtt/' + topic,
        query: 'c=' + this.clientIdentifier + '&u=' + this.username + '&p=' + this.secret
    })
    req.end(new Buffer(payload))
}

IotCoAPProtocol.prototype.uploadData = function (data, type) {
    var topic = 'upload_data/' + this.productName + '/' + this.deviceName + '/' + type + '/' + createObjectId()
    this.publish(topic, data)
}

IotCoAPProtocol.prototype.updateStatus = function (status) {
    var topic = 'update_status/' + this.productName + '/' + this.deviceName + '/' + createObjectId()
    this.publish(topic, JSON.stringify(status))
}

module.exports = IotCoAPProtocol