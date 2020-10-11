'use strict';

require("promise");
var https = require('https');

function getDeviceLocationInfo() {
    return new Promise(function(resolved, reject) {
        https.get("https://api.map.baidu.com/location/ip?ak=aZEAgYG8wKuLd6DS9BmCloGtfnGGkRMn&coor=gcj02", function(res) {
            var result = "";

            res.on('data', function(d) {
                result += d;
            });

            res.on("end", function() {
                resolved(JSON.parse(result));
            });
        }).on('error', function(e) {
            reject(e);
        });
    });
}

function getTemperature() { // 获取温度
    return new Promise(function(resolved, reject) {
        try {
            $('#dht11').getTemperature(function(error, temperature) {
                if (error) reject(error);
                else resolved(temperature);
            });
        } catch(e) {
            reject({
                type: 'err',
                code: -1,
                msg: 'read fail, try again'
            });
        }
    });
}

function getRelativeHumidity() { // 获取湿度
    return new Promise(function(resolved, reject) {
        try {
            $('#dht11').getRelativeHumidity(function(error, humidity) {
                if (error) reject(error);
                else resolved(humidity);
            });
        } catch(e) {
            reject({
                type: 'err',
                code: -1,
                msg: 'read fail, try again'
            });
        }
    });
}

function getIlluminance() { // 获取光照传感器数据
    return new Promise(function(resolved, reject) {
        $('#gy-30').getIlluminance(function(error, value) {
            if (error) reject(error);
            else resolved(value);
        });
    });
}

function getSoundStatus() { // 获取声音传感器数据 成功无返回值
    return new Promise(function(resolved, reject) {
        $('#sound-01').on('sound', function(res) {
            if (res) console.log(res);
            resolved('sound detected');
        });
    });
}

function getIRRData() { // 获取红外线接收器数据
    return new Promise(function(resolved, reject) {
        $('#irr-01').on('data', function(data) {
            if (data) resolved(data);
            else reject('fail');
        });
    });
}

function setIRTData(data) { // 设置红外线发射器传输数据
    return new Promise(function(resolved, reject) {
        $('#irt-01').send(data, function(error) {
            if (error) reject(error);
            else resolved('success');
        });
    });
}

function getBuzzerStatus(sensor) { // 获取蜂鸣器的开关状态
    return new Promise(function(resolved, reject) {
        $('#fc-49').isOn(function(error, on) {
            if (error) reject(error);
            else resolved(on);
        });
    });
}

function setLEDOn() { // 打开LED灯
    return new Promise(function(resolved, reject) {
        $('#led').turnOn(function(error) {
            if (error) reject(error);
            else resolved('success');
        });
    });
}

function setLEDOff() { //关闭LED灯
    return new Promise(function(resolved, reject) {
        $('#led').turnOff(function(error) {
            if (error) reject(error);
            else resolved('success');
        });
    });
}

function setLEDColor(color) { // 设置LED灯颜色
    return new Promise(function(resolved, reject){
        $('#led').setRGB(color, function(error) {
            if (error) reject(error);
            else resolved('success');
        });
    });
}

function getLEDColor() { // 获取LED灯颜色
    return new Promise(function(resolved, reject) {
        $('#led').getRGB(function(error, rgb) {
            if (error) reject(error);
            else resolved(rgb);
        });
    });
}

function setBuzzerOn() { // 打开蜂鸣器
    return new Promise(function(resolved, reject) {
        $('#fc-49').turnOn(function(error) {
            if (error) reject(error);
            else resolved('success');
        });
    });
}

function setBuzzerOff() { // 关闭蜂鸣器
    return new Promise(function(resolved, reject) {
        $('#fc-49').turnOff(function(error) {
            if (error) reject(error);
            else resolved('success');
        });
    });
}

function lcdPrint(data) { // 在LCD屏幕上打印内容
    return new Promise(function(resolved, reject) {
        $('#lcd').print(data, function(error){
            if (error) reject(error);
            else resolved();
        });
    });
}

function cleanLCDScreen() { // 清空LCD屏幕
    return new Promise(function(resolved, reject) {
        $("#lcd").clear(function(error){
            if (error) reject(error);
            else resolved();
        });
    });
}

module.exports = {
    getDeviceLocationInfo: getDeviceLocationInfo,
    getTemperature: getTemperature,
    getRelativeHumidity: getRelativeHumidity,
    getIlluminance: getIlluminance,
    getSoundStatus: getSoundStatus,
    getBuzzerStatus: getBuzzerStatus,
    setLEDOn: setLEDOn,
    setLEDOff: setLEDOff,
    setLEDColor: setLEDColor,
    getLEDColor: getLEDColor,
    setBuzzerOn: setBuzzerOn,
    setBuzzerOff: setBuzzerOff,
    lcdPrint: lcdPrint,
    cleanLCDScreen: cleanLCDScreen
}