require('promise')
var https = require('https');
var qs = require('querystring');

function request(url) {
    return new Promise(function(resolved, reject) {
        https.get(url, function(res) {
            var result = "";

            res.on('data', function(d) {
                result += d;
            });

            res.on("end", function() {
                resolved(result);
            });
        }).on('error', function(e) {
            reject(e);
        });
    });
}

module.exports = {
    request: request
}