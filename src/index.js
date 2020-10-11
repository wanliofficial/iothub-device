'use strict';

require("promise");
var os = require('os');
var packageConfig = require('../package');

var IotDevice = require("../sdk/iot-device");
// var IotCoAPProtocol = require("../sdk/coap-protocol");
var business = require("./business")

var timer = null

$.ready(function (error) {
    if (error) {
        console.log(error);
        return;
    }

    $('#led-r').turnOn();
    $('#led-g').turnOn();
    $('#led-b').turnOn();

    var device = new IotDevice({
        serverAddress: packageConfig.server.host + ":" + packageConfig.server.port,
        productName: packageConfig.authenticate.productName,
        deviceName: packageConfig.authenticate.deviceName,
        secret: packageConfig.authenticate.secret,
        clientID: packageConfig.authenticate.clientID
    });

    device.connect();
    // device.disconnect();

    device.iotEmitter.on('online', function() {
        console.log('device is online!');

        device.updateStatus({ firmware_ver: packageConfig.firmwareVersion });
        device.sendNTPRequest();

        device.uploadData(JSON.stringify({
            network: os.networkInterfaces()
        }), "system-network");

        device.uploadData(JSON.stringify({
            arch: "",
            cpus: os.cpus(),
            hostname: os.hostname(),
            platform: "",
            release: "",
            type: "",
            uptime: os.uptime(),
            version: ""
        }), "system-information");
    });

    device.iotEmitter.on('offline', function() {
        console.log('device is offline!')
    });

    device.iotEmitter.on('error', function(err) {
        console.error(err)
    });

    device.iotEmitter.on('command', function(command, data, respondCommand) {
        if (command == "ping") { //处理指令
            var buf = Buffer.alloc(4);
            buf.writeUInt32BE(Math.floor(Date.now()) / 1000, 0);
            respondCommand(buf) //处理完毕后回复，可以带任何格式的数据，字符串或者二进制数据
            console.log(command, Buffer.from(data.toString(), 'base64'))
        } else if (command == "weather") {
            console.log('weather: ' + data.toString())
        } else {
            console.log('received cmd: ' + command)
        }
    });

    device.iotEmitter.on('ntp_set', function(time) {
        console.log('going to set time:' + time)
    });

    device.iotEmitter.on("m2m_msg", function(sender, payload) {
        console.log('received: ' + payload.toString() + ' from: ' + sender)
        setTimeout(function () {
            device.sendToDevice(sender, "ping")
        }, 1000)
    });

    device.iotEmitter.on("ota_upgrade", function(ota, progress) { // progress is class ota-progress of instance
        console.log('going to upgrade ' + ota.type + ': ' + ota.url + ', version=' + ota.version)

        var percent = 0;

        var performUpgrade = function () {
            console.log('download:' + percent)
            progress.download(percent)
            if (percent < 100) {
                percent += 20
                setTimeout(performUpgrade, 2000)
            } else {
                setTimeout(function () {
                    device.updateStatus({ firmware_ver: ota.version })
                    console.log('upgrade complete!')
                }, 3000)
            }
        }

        performUpgrade()
    });

    timer = setInterval(function() {
        device.uploadData(JSON.stringify({
            loadavg: os.loadavg(),
            totalmem: os.totalmem(),
            freemem: os.freemem(),
            uptime: os.uptime()
        }), "system-operation")

        business.getDeviceLocationInfo().then(function(res) {
            device.uploadData(JSON.stringify({
                address_summary: res.address,
                address_detail: res.content.address_detail,
                address: res.content.address,
                point: res.content.point
            }), "system-location")
        }).catch(function(err) {
            console.log(err)
        })
    }, 30000);

    // 在 `#button` 按下时点亮 `#led-r`.
    $('#button').on('push', function () {
        console.log('Button pushed.');
        $('#led-r').turnOn();
    });

    // 在 `#button` 释放时熄灭 `#led-r`.
    $('#button').on('release', function () {
        console.log('Button released.');
        $('#led-r').turnOff();
    });
});

$.end(function () {
    $('#led-r').turnOff();
    $('#led-g').turnOff();
    $('#led-b').turnOff();

    clearInterval(timer)
});