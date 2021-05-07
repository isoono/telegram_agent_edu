/**
 * Copyright (c) 2017, OCEAN
 * All rights reserved.
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * 1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * 3. The name of the author may not be used to endorse or promote products derived from this software without specific prior written permission.
 * THIS SOFTWARE IS PROVIDED BY THE AUTHOR ``AS IS'' AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/**
 * Created by IL YEUP AHN in KETI on 2017-07-24.
 */

var http = require('http');
var express = require('express');
var fs = require('fs');
var bodyParser = require('body-parser');
var mqtt = require('mqtt');
var util = require('util');
var xml2js = require('xml2js');
var url = require('url');
var ip = require('ip');
var shortid = require('shortid');

var schedule = require('node-schedule');

global.sh_adn = require('./http_adn');
var noti = require('./noti');
var tas = require('./tas');

var HTTP_SUBSCRIPTION_ENABLE = 0;
var MQTT_SUBSCRIPTION_ENABLE = 0;


var TelegramBot = require('node-telegram-bot-api');

global.tele_arr = {};
global.bot_arr = {};

var app = express();

//app.use(bodyParser.urlencoded({ extended: true }));
//app.use(bodyParser.json());
//app.use(bodyParser.json({ type: 'application/*+json' }));
//app.use(bodyParser.text({ type: 'application/*+xml' }));

// ?????? ????????.
var server = null;
var noti_topic = '';

// ready for mqtt
for(var i = 0; i < conf.sub.length; i++) {
    if(conf.sub[i].name != null) {
        if(url.parse(conf.sub[i].nu).protocol === 'http:') {
            HTTP_SUBSCRIPTION_ENABLE = 1;
            if(url.parse(conf.sub[i]['nu']).hostname === 'autoset') {
                conf.sub[i]['nu'] = 'http://' + ip.address() + ':' + conf.ae.port + url.parse(conf.sub[i]['nu']).pathname;
            }
        }
        else if(url.parse(conf.sub[i].nu).protocol === 'mqtt:') {
            MQTT_SUBSCRIPTION_ENABLE = 1;
        }
        else {
            console.log('notification uri of subscription is not supported');
            process.exit();
        }
    }
}

var return_count = 0;
var request_count = 0;

function ready_for_notification() {
    if(HTTP_SUBSCRIPTION_ENABLE == 1) {
        server = http.createServer(app);
        server.listen(conf.ae.port, function () {
            console.log('http_server running at ' + conf.ae.port + ' port');
        });
    }

    if(MQTT_SUBSCRIPTION_ENABLE == 1) {
        if(conf.cse.id.split('/')[1] === '') {
            var cseid = conf.cse.id.split('/')[0];
        }
        else {
            cseid = conf.cse.id.split('/')[1];
        }

        for(var i = 0; i < conf.sub.length; i++) {
            if (conf.sub[i].name != null) {
                if (url.parse(conf.sub[i].nu).protocol === 'mqtt:') {
                    if (url.parse(conf.sub[i]['nu']).hostname === 'autoset') {
                        conf.sub[i]['nu'] = 'mqtt://' + conf.cse.host + '/' + conf.ae.id;
                        noti_topic = util.format('/oneM2M/req/%s/%s/#', cseid, conf.ae.id);
                    }
                    else if (url.parse(conf.sub[i]['nu']).hostname === conf.cse.host) {
                        noti_topic = util.format('/oneM2M/req/%s/%s/#', cseid, conf.ae.id);
                    }
                    else {
                        noti_topic = util.format('%s', url.parse(conf.sub[i].nu).pathname);
                    }
                }
            }
        }
        mqtt_connect(conf.cse.host, noti_topic);
    }
}

function ae_response_action(status, res_body, callback) {
    var aeid = res_body['m2m:ae']['aei'];
    conf.ae.id = aeid;
    callback(status, aeid);
}

function create_cnt_all(count, callback) {
    if(conf.cnt.length == 0) {
        callback(2001, count);
    }
    else {
        sh_adn.crtct(count, function (rsc, res_body, count) {
            if(rsc == 5106 || rsc == 2001 || rsc == 4105) {
                count++;
                if(conf.cnt.length > count) {
                    create_cnt_all(count, function (rsc, count) {
                        callback(rsc, count);
                    });
                }
                else {
                    callback(rsc, count);
                }
            }
            else {
                callback('9999', count);
            }
        });
    }
}

function delete_sub_all(count, callback) {
    if(conf.sub.length == 0) {
        callback(2001, count);
    }
    else {
        sh_adn.delsub(count, function (rsc, res_body, count) {
            if(rsc == 5106 || rsc == 2002 || rsc == 2000 || rsc == 4105 || rsc == 4004) {
                count++;
                if(conf.sub.length > count) {
                    delete_sub_all(count, function (rsc, count) {
                        callback(rsc, count);
                    })
                }
                else {
                    callback(rsc, count);
                }
            }
            else {
                callback('9999', count);
            }
        });
    }
}

function create_sub_all(count, callback) {
    if(conf.sub.length == 0) {
        callback(2001, count);
    }
    else {
        sh_adn.crtsub(count, function (rsc, res_body, count) {
            if(rsc == 5106 || rsc == 2001 || rsc == 4105) {
                count++;
                if(conf.sub.length > count) {
                    create_sub_all(count, function (rsc, count) {
                        callback(rsc, count);
                    })
                }
                else {
                    callback(rsc, count);
                }
            }
            else {
                callback('9999', count);
            }
        });
    }
}

global.tgObj = {};

function http_watchdog() {
    if (sh_state === 'crtae') {
        console.log('[sh_state] : ' + sh_state);
        sh_adn.crtae(function (status, res_body) {
            console.log(res_body);
            if (status == 2001) {
                ae_response_action(status, res_body, function (status, aeid) {
                    console.log('x-m2m-rsc : ' + status + ' - ' + aeid + ' <----');
                    sh_state = 'delsub';
                });
            }
            else if (status == 5106 || status == 4105) {
                console.log('x-m2m-rsc : ' + status + ' <----');
                sh_state = 'rtvae'
            }
        });
    }
    else if (sh_state === 'rtvae') {
        if (conf.ae.id === 'S') {
            conf.ae.id = 'S' + shortid.generate();
        }

        console.log('[sh_state] : ' + sh_state);
        sh_adn.rtvae(function (status, res_body) {
            if (status == 2000) {
                var aeid = res_body['m2m:ae']['aei'];
                console.log('x-m2m-rsc : ' + status + ' - ' + aeid + ' <----');

                if(conf.ae.id != aeid) {
                    console.log('AE-ID created is ' + aeid + ' not equal to device AE-ID is ' + conf.ae.id);
                }
                else {
                    sh_state = 'delsub';
                }
            }
            else {
                console.log('x-m2m-rsc : ' + status + ' <----');
            }
        });
    }
    else if (sh_state === 'crtct') {
        console.log('[sh_state] : ' + sh_state);
        request_count = 0;
        return_count = 0;

        create_cnt_all(0, function (status, count) {
            if (conf.cnt.length <= count) {
                sh_state = 'delsub';
            }
        });
    }
    else if (sh_state === 'delsub') {
        console.log('[sh_state] : ' + sh_state);
        request_count = 0;
        return_count = 0;

        delete_sub_all(0, function (status, count) {
            if (conf.sub.length <= count) {
                sh_state = 'crtsub';
            }
        });
    }
    else if (sh_state === 'crtsub') {
        console.log('[sh_state] : ' + sh_state);
        request_count = 0;
        return_count = 0;

        create_sub_all(0, function (status, count) {
            if (conf.sub.length <= count) {
                sh_state = 'crtci';

                ready_for_notification();

                tas.ready();}
        });
    }
    else if (sh_state === 'crtci') {
        var cnt_arr = [];
        var count = 0;
        var sns_list = JSON.parse(fs.readFileSync(conf_file));
        for(var idx in sns_list) {
            if (sns_list.hasOwnProperty(idx)) {
                for (var usr in sns_list[idx]) {
                    if (sns_list[idx].hasOwnProperty(usr)) {
                        for (var sns in sns_list[idx][usr]) {
                            if (sns_list[idx][usr].hasOwnProperty(sns)) {
                                if(sns === 'telegram') {
                                    tgObj = sns_list[idx][usr][sns];

                                    if (tele_arr[sns_list[idx][usr][sns].token] == null) {
                                        tele_arr[sns_list[idx][usr][sns].token] = new TelegramBot(sns_list[idx][usr][sns].token, {polling: true});

                                        console.log("new telegram bot is ready");

                                        var bot = tele_arr[sns_list[idx][usr][sns].token];

                                        for(var id in sns_list[idx][usr][sns].chatid) {
                                            if(sns_list[idx][usr][sns].chatid.hasOwnProperty(id)) {
                                                bot_arr[sns_list[idx][usr][sns].chatid[id]] = bot;
                                                bot.sendMessage(sns_list[idx][usr][sns].chatid[id], '텔레그램 브릿지 서버 시작합니다.');
                                            }
                                        }

                                        bot.on('polling_error', function(error) {
                                            console.log(error.code);  // => 'EFATAL'
                                        });

                                        bot.onText(/\/echo (.+)/, function (msg, match) {
                                            // 'msg' is the received Message from Telegram
                                            // 'match' is the result of executing the regexp above on the text content
                                            // of the message

                                            // send back the matched "whatever" to the chat
                                            console.log('<---- [telegram] ' +  match[1] + ' <----');
                                            var con_arr = match[1].split(' ');

                                            for (var idx in tgObj.post) {
                                                if (tgObj.post.hasOwnProperty(idx)) {
                                                    var targetUri = tgObj.post[idx];
                                                    if (con_arr[0] === targetUri) {
                                                        con = con_arr[1];

                                                        sh_adn.crtci2(con_arr[0], con, msg.chat.id, function (status, res_body, to, chatid) {
                                                            console.log('----> x-m2m-rsc : ' + status + ' ---->');
                                                            bot_arr[chatid].sendMessage(chatid, con_arr[0] + ' ' + status);
                                                        });
                                                    }
                                                }
                                            }

                                            for (idx in tgObj.get) {
                                                if (tgObj.get.hasOwnProperty(idx)) {
                                                    targetUri = tgObj.get[idx];
                                                    if (con_arr[0] === targetUri) {
                                                        sh_adn.rtvci(con_arr[0] + '/la', msg.chat.id, function (status, res_body, chatid) {
                                                            console.log('---->' + con_arr[0] + ' : ' + res_body['m2m:cin'].con + ' ---->');
                                                            bot_arr[chatid].sendMessage(chatid, con_arr[0] + ' : ' + res_body['m2m:cin'].con);
                                                        });
                                                    }
                                                }
                                            }
                                        });

                                        if(tgObj.rule.length) {
                                            for(var num in tgObj.rule) {
                                                if(tgObj.rule.hasOwnProperty(num)) {
                                                    if(tgObj.rule[num].type === "time") {
                                                        var name = {};
                                                        name.chatid = tgObj.chatid.toString();
                                                        name.target = tgObj.rule[num].target;
                                                        name.command = tgObj.rule[num].command;
                                                        var time_arr = tgObj.rule[num].value.split(':');
                                                        schedule.scheduleJob(JSON.stringify(name), time_arr[1] + ' ' + time_arr[0] + ' * * *', function () {
                                                            var ruleObj = JSON.parse(this.name);
                                                            if(ruleObj.command === "user-define") {
                                                                ruleObj.command = (parseInt((Math.random() * 10), 10) % 7).toString();
                                                            }
                                                            console.log('<---- [schedule]' + ruleObj.target + ' ' + ruleObj.command);
                                                            sh_adn.crtci2(ruleObj.target, ruleObj.command, '', function (status, res_body, to) {
                                                                console.log('----> x-m2m-rsc : ' + status + ' ---->');
                                                                var chatid = Object.keys(bot_arr);
                                                                for(id in chatid) {
                                                                    if(chatid.hasOwnProperty(id)) {
                                                                        bot_arr[chatid[id]].sendMessage(' ----> ' + status + ' for ' + chatid[id], ruleObj.target + ' ' + ruleObj.command);
                                                                    }
                                                                }
                                                            });
                                                        });
                                                    }
                                                    else if(tgObj.rule[num].type === "period") {
                                                        name = {};
                                                        name.chatid = tgObj.chatid.toString();
                                                        name.target = tgObj.rule[num].target;
                                                        name.command = tgObj.rule[num].command;
                                                        if(parseInt(tgObj.rule[num].value, 10) >= 3600) {
                                                            var hr = parseInt(parseInt(tgObj.rule[num].value, 10) / 3600).toString();
                                                            var sec = parseInt(parseInt(tgObj.rule[num].value, 10) % 3600).toString();
                                                            if(parseInt(sec, 10) >= 60) {
                                                                var min = parseInt(parseInt(sec, 10) / 60).toString();
                                                                sec = parseInt(parseInt(sec, 10) % 60).toString();
                                                            }
                                                            var spec = sec + ' ' + min + ' */' + hr + ' * * *';
                                                        }
                                                        else if(parseInt(tgObj.rule[num].value, 10) >= 60) {
                                                            min = parseInt(parseInt(tgObj.rule[num].value, 10) / 60).toString();
                                                            sec = parseInt(parseInt(tgObj.rule[num].value, 10) % 60).toString();
                                                            spec = sec + ' */' + min + ' * * * *';
                                                        }
                                                        else {
                                                            spec = '*/' + tgObj.rule[num].value + ' * * * * *';
                                                        }
                                                        schedule.scheduleJob(JSON.stringify(name), spec, function () {
                                                            var ruleObj = JSON.parse(this.name);
                                                            if(ruleObj.command === "user-define") {
                                                                ruleObj.command = (parseInt((Math.random() * 10), 10) % 7).toString();
                                                            }
                                                            console.log('<---- [schedule]' + ruleObj.target + ' ' + ruleObj.command);
                                                            sh_adn.crtci2(ruleObj.target, ruleObj.command, '', function (status, res_body, to) {
                                                                console.log('----> x-m2m-rsc : ' + status + ' ---->');
                                                                //var chatid = Object.keys(bot_arr);
                                                                // for(id in chatid) {
                                                                //     if(chatid.hasOwnProperty(id)) {
                                                                //         bot_arr[chatid[id]].sendMessage(chatid[id], '아침 9시 자동 조명 켜기 : ' + ' ' + status);
                                                                //     }
                                                                // }
                                                            });
                                                        });
                                                    }
                                                }
                                            }
                                            //var job1 = schedule.scheduleJob('10 * * * * *', function(){
                                            // var job1 = schedule.scheduleJob(sns_list[idx][usr][sns].chatid.toString(), '*/10 * * * * *', function () {
                                            //     sh_adn.crtci2('/Mobius/lego/led', (parseInt((Math.random() * 10), 10) % 7).toString(), '', function (status, res_body, to) {
                                            //         console.log('[schedule] /Mobius/aqua1/led_ctrl on - x-m2m-rsc : ' + status + ' <----');
                                            //         var chatid = Object.keys(bot_arr);
                                            //         // for(id in chatid) {
                                            //         //     if(chatid.hasOwnProperty(id)) {
                                            //         //         bot_arr[chatid[id]].sendMessage(chatid[id], '아침 9시 자동 조명 켜기 : ' + ' ' + status);
                                            //         //     }
                                            //         // }
                                            //     });
                                            // });

                                            //var job2 = schedule.scheduleJob('40 * * * * *', function(){
                                            // var job2 = schedule.scheduleJob('0 18 * * *', function () {
                                            //     sh_adn.crtci2('/Mobius/aqua1/led_ctrl', '0', '', function (status, res_body, to) {
                                            //         console.log('[schedule] /Mobius/aqua1/led_ctrl off - x-m2m-rsc : ' + status + ' <----');
                                            //         var chatid = Object.keys(bot_arr);
                                            //         for (id in chatid) {
                                            //             if (chatid.hasOwnProperty(id)) {
                                            //                 bot_arr[chatid[id]].sendMessage(chatid[id], '저녁 6시 자동 조명 끄기 : ' + ' ' + status);
                                            //             }
                                            //         }
                                            //     });
                                            // });
                                        }
                                    }
                                }

                                for (var idx2 in sns_list[idx][usr][sns].cnt_path) {
                                    if (sns_list[idx][usr][sns].cnt_path.hasOwnProperty(idx2)) {
                                        var cnt_path_arr = sns_list[idx][usr][sns].cnt_path[idx2].split('/');
                                        cnt_arr[count] = {};
                                        cnt_arr[count].parent = sns_list[idx][usr][sns].cnt_path[idx2].replace('/' + cnt_path_arr[cnt_path_arr.length - 1], '');
                                        cnt_arr[count++].name = cnt_path_arr[cnt_path_arr.length - 1];
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        for(idx in cnt_arr) {
            if(cnt_arr.hasOwnProperty(idx)) {
                var new_sub = 1;
                for(var idx3 in conf.sub) {
                    if(conf.sub.hasOwnProperty(idx3)) {
                        if(conf.sub[idx3].parent === (cnt_arr[idx].parent + '/' + cnt_arr[idx].name)) {
                            new_sub = 0;
                            break;
                        }
                    }
                }
                if(new_sub === 1) {
                    var sub_arr = [];
                    count = 0;
                    sub_arr[count] = {};
                    sub_arr[count].parent = cnt_arr[idx].parent + '/' + cnt_arr[idx].name;
                    sub_arr[count].name = 'sub_tw';
                    sub_arr[count].nu = 'mqtt://' + conf.cse.host + '/' + conf.ae.id + '?ct=' + conf.ae.bodytype;
                    conf.sub.push(sub_arr[count]);

                    sh_adn.crtsub(conf.sub.indexOf(sub_arr[count]), function (rsc, res_body, count) {
                        if(rsc == 5106 || rsc == 2001 || rsc == 4105) {
                        }
                        else {
                        }
                    });
                }
            }
        }

        for(idx3 in conf.sub) {
            if(conf.sub.hasOwnProperty(idx3)) {
                var old_sub = 1;
                for(idx in cnt_arr) {
                    if(cnt_arr.hasOwnProperty(idx)) {
                        if(conf.sub[idx3].parent == (cnt_arr[idx].parent + '/' + cnt_arr[idx].name)) {
                            old_sub = 0;
                            break;
                        }
                    }
                }
                if(old_sub === 1) {
                    sh_adn.delsub(idx3, function (rsc, res_body, count) {
                        if(rsc == 5106 || rsc == 2001 || rsc == 4105 || rsc == 2000 || rsc == 2002) {
                            conf.sub.splice(count, 1);
                        }
                        else {
                        }
                    });
                }
            }
        }
    }
}

wdt.set_wdt(require('shortid').generate(), 2, http_watchdog);


// for notification
//var xmlParser = bodyParser.text({ type: '*/*' });


function mqtt_connect(serverip, noti_topic) {
    if(mqtt_client == null) {
        if (conf.usesecure === 'disable') {
            var connectOptions = {
                host: serverip,
                port: conf.cse.mqttport,
//            username: 'ryeubi',
//            password: 'Dksdlfduq@2',
                protocol: "mqtt",
                keepalive: 10,
                //             clientId: serverUID,
                protocolId: "MQTT",
                protocolVersion: 4,
                clean: true,
                reconnectPeriod: 2000,
                connectTimeout: 2000,
                rejectUnauthorized: false
            };
        }
        else {
            connectOptions = {
                host: serverip,
                port: conf.cse.mqttport,
                protocol: "mqtts",
                keepalive: 10,
                //             clientId: serverUID,
                protocolId: "MQTT",
                protocolVersion: 4,
                clean: true,
                reconnectPeriod: 2000,
                connectTimeout: 2000,
                key: fs.readFileSync("./server-key.pem"),
                cert: fs.readFileSync("./server-crt.pem"),
                rejectUnauthorized: false
            };
        }

        mqtt_client = mqtt.connect(connectOptions);
    }

    mqtt_client.on('connect', function () {
        mqtt_client.subscribe(noti_topic);
        console.log('[mqtt_connect] noti_topic : ' + noti_topic);
    });

    mqtt_client.on('message', function (topic, message) {

        var topic_arr = topic.split("/");

        var bodytype = conf.ae.bodytype;
        if (topic_arr[5] != null) {
            bodytype = (topic_arr[5] === 'xml') ? topic_arr[5] : ((topic_arr[5] === 'json') ? topic_arr[5] : ((topic_arr[5] === 'cbor') ? topic_arr[5] : 'json'));
        }

        if (topic_arr[1] === 'oneM2M' && topic_arr[2] === 'req' && topic_arr[4] === conf.ae.id) {
            console.log(message.toString());
            if (bodytype === 'xml') {
                var parser = new xml2js.Parser({explicitArray: false});
                parser.parseString(message.toString(), function (err, jsonObj) {
                    if (err) {
                        console.log('[mqtt noti xml2js parser error]');
                    }
                    else {
                        noti.mqtt_noti_action(topic_arr, jsonObj);
                    }
                });
            }
            else if (bodytype === 'cbor') {
                var encoded = message.toString();
                cbor.decodeFirst(encoded, function (err, jsonObj) {
                    if (err) {
                        console.log('[mqtt noti cbor parser error]');
                    }
                    else {
                        noti.mqtt_noti_action(topic_arr, jsonObj);
                    }
                });
            }
            else { // json
                var jsonObj = JSON.parse(message.toString());

                if (jsonObj['m2m:rqp'] == null) {
                    jsonObj['m2m:rqp'] = jsonObj;
                }
                noti.mqtt_noti_action(topic_arr, jsonObj);
            }
        }
        else {
            console.log('topic is not supported');
        }
    });

    mqtt_client.on('error', function (err) {
        console.log(err.message);
    });
}

var onem2mParser = bodyParser.text(
    {
        limit: '1mb',
        type: 'application/onem2m-resource+xml;application/xml;application/json;application/vnd.onem2m-res+xml;application/vnd.onem2m-res+json'
    }
);

var noti_count = 0;

app.post('/:resourcename0', onem2mParser, function(request, response) {
    var fullBody = '';
    request.on('data', function (chunk) {
        fullBody += chunk.toString();
    });
    request.on('end', function () {
        request.body = fullBody;

        for (var i = 0; i < conf.sub.length; i++) {
            if (conf.sub[i]['nu'] != null) {
                if(url.parse(conf.sub[i].nu).protocol === 'http:') {
                    var nu_path = url.parse(conf.sub[i]['nu']).pathname.toString().split('/')[1];
                    if (nu_path === request.params.resourcename0) {
                        var content_type = request.headers['content-type'];
                        if(content_type.includes('xml')) {
                            var bodytype = 'xml';
                        }
                        else if(content_type.includes('cbor')) {
                            bodytype = 'cbor';
                        }
                        else {
                            bodytype = 'json';
                        }
                        if (bodytype === 'json') {
                            try {
                                var pc = JSON.parse(request.body);
                                var rqi = request.headers['x-m2m-ri'];

                                noti.http_noti_action(rqi, pc, 'json', response);
                            }
                            catch (e) {
                                console.log(e);
                            }
                        }
                        else if(bodytype === 'cbor') {
                            var encoded = request.body;
                            cbor.decodeFirst(encoded, function(err, pc) {
                                if (err) {
                                    console.log('[http noti cbor parser error]');
                                }
                                else {
                                    var rqi = request.headers['x-m2m-ri'];

                                    noti.http_noti_action(rqi, pc, 'cbor', response);
                                }
                            });
                        }
                        else {
                            var parser = new xml2js.Parser({explicitArray: false});
                            parser.parseString(request.body, function (err, pc) {
                                if (err) {
                                    console.log('[http noti xml2js parser error]');
                                }
                                else {
                                    var rqi = request.headers['x-m2m-ri'];

                                    noti.http_noti_action(rqi, pc, 'xml', response);
                                }
                            });
                        }
                        break;
                    }
                }
            }
        }
    });
});

app.get('/conf', onem2mParser, function(request, response, next) {

});
