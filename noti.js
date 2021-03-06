/**
 * Copyright (c) 2016, OCEAN
 * All rights reserved.
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * 1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * 3. The name of the author may not be used to endorse or promote products derived from this software without specific prior written permission.
 * THIS SOFTWARE IS PROVIDED BY THE AUTHOR ``AS IS'' AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/**
 * Created by Il Yeup, Ahn in KETI on 2016-09-21.
 */

var tas = require('./tas');
var js2xmlparser = require('js2xmlparser');
var fs = require('fs');

var _this = this;

exports.parse_sgn = function (rqi, pc, callback) {
    if(pc.sgn) {
        var nmtype = pc['sgn'] != null ? 'short' : 'long';
        var sgnObj = {};
        var cinObj = {};
        sgnObj = pc['sgn'] != null ? pc['sgn'] : pc['singleNotification'];

        if (nmtype === 'long') {
            console.log('oneM2M spec. define only short name for resource')
        }
        else { // 'short'
            if (sgnObj.sur) {
                var path_arr = sgnObj.sur.split('/');
            }

            if (sgnObj.nev) {
                if (sgnObj.nev.rep) {
                    if (sgnObj.nev.rep['m2m:cin']) {
                        sgnObj.nev.rep.cin = sgnObj.nev.rep['m2m:cin'];
                        delete sgnObj.nev.rep['m2m:cin'];
                    }

                    if (sgnObj.nev.rep.cin) {
                        cinObj = sgnObj.nev.rep.cin;
                    }
                    else {
                        console.log('[mqtt_noti_action] m2m:cin is none');
                        cinObj = null;
                    }
                }
                else {
                    console.log('[mqtt_noti_action] rep tag of m2m:sgn.nev is none. m2m:notification format mismatch with oneM2M spec.');
                    cinObj = null;
                }
            }
            else {
                console.log('[mqtt_noti_action] nev tag of m2m:sgn is none. m2m:notification format mismatch with oneM2M spec.');
                cinObj = null;
            }
        }
    }
    else {
        console.log('[mqtt_noti_action] m2m:sgn tag is none. m2m:notification format mismatch with oneM2M spec.');
        console.log(pc);
    }

    callback(path_arr, cinObj, rqi);
};



exports.response_mqtt = function (rsp_topic, rsc, to, fr, rqi, inpc, bodytype) {
    var rsp_message = {};
    rsp_message['m2m:rsp'] = {};
    rsp_message['m2m:rsp'].rsc = rsc;
    rsp_message['m2m:rsp'].to = to;
    rsp_message['m2m:rsp'].fr = fr;
    rsp_message['m2m:rsp'].rqi = rqi;
    rsp_message['m2m:rsp'].pc = inpc;

    if(bodytype === 'xml') {
        rsp_message['m2m:rsp']['@'] = {
            "xmlns:m2m": "http://www.onem2m.org/xml/protocols",
            "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance"
        };

        var xmlString = js2xmlparser.parse("m2m:rsp", rsp_message['m2m:rsp']);

        mqtt_client.publish(rsp_topic, xmlString);
    }
    else if (bodytype ===  'cbor') {
        xmlString = cbor.encode(rsp_message['m2m:rsp']).toString('hex');

        mqtt_client.publish(rsp_topic, xmlString);
    }
    else { // 'json'
        mqtt_client.publish(rsp_topic, JSON.stringify(rsp_message['m2m:rsp']));
    }
};

exports.response_ws = function (connection, rsc, to, fr, rqi, inpc, bodytype) {
    var rsp_message = {};
    rsp_message['m2m:rsp'] = {};
    rsp_message['m2m:rsp'].rsc = rsc;
    rsp_message['m2m:rsp'].to = to;
    rsp_message['m2m:rsp'].fr = fr;
    rsp_message['m2m:rsp'].rqi = rqi;
    rsp_message['m2m:rsp'].pc = inpc;

    if(bodytype === 'xml') {
        rsp_message['m2m:rsp']['@'] = {
            "xmlns:m2m": "http://www.onem2m.org/xml/protocols",
            "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance"
        };

        var xmlString = js2xmlparser.parse("m2m:rsp", rsp_message['m2m:rsp']);

        connection.sendUTF(xmlString.toString());
    }
    else if (bodytype ===  'cbor') {
        xmlString = cbor.encode(rsp_message['m2m:rsp']).toString('hex');

        connection.sendUTF(xmlString.toString());
    }
    else { // 'json'
        connection.sendUTF(JSON.stringify(rsp_message['m2m:rsp']));
    }
};

function getType(p) {
    if (Array.isArray(p)) return 'array';
    else if (typeof p == 'string') return 'string';
    else if (p != null && typeof p == 'object') return 'object';
    else return 'other';
}

exports.mqtt_noti_action = function(topic_arr, jsonObj) {
    if (jsonObj != null) {
        var bodytype = conf.ae.bodytype;
        if(topic_arr[5] != null) {
            bodytype = topic_arr[5];
        }

        var op = (jsonObj['m2m:rqp']['op'] == null) ? '' : jsonObj['m2m:rqp']['op'];
        var to = (jsonObj['m2m:rqp']['to'] == null) ? '' : jsonObj['m2m:rqp']['to'];
        var fr = (jsonObj['m2m:rqp']['fr'] == null) ? '' : jsonObj['m2m:rqp']['fr'];
        var rqi = (jsonObj['m2m:rqp']['rqi'] == null) ? '' : jsonObj['m2m:rqp']['rqi'];
        var pc = {};
        pc = (jsonObj['m2m:rqp']['pc'] == null) ? {} : jsonObj['m2m:rqp']['pc'];

        if(pc['m2m:sgn']) {
            pc.sgn = {};
            pc.sgn = pc['m2m:sgn'];
            delete pc['m2m:sgn'];
        }

        _this.parse_sgn(rqi, pc, function (path_arr, cinObj, rqi) {
            if(cinObj) {
                for (var i = 0; i < conf.sub.length; i++) {
                    if (conf.sub[i].parent.split('/')[conf.sub[i].parent.split('/').length-1] === path_arr[path_arr.length-2]) {
                        if (conf.sub[i].name === path_arr[path_arr.length-1]) {
                            console.log('mqtt ' + bodytype + ' notification <----');

                            var rsp_topic = '/oneM2M/resp/' + topic_arr[3] + '/' + topic_arr[4] + '/' + topic_arr[5];
                            _this.response_mqtt(rsp_topic, 2001, '', conf.ae.id, rqi, '', topic_arr[5]);
                            console.log('mqtt response - 2001 ---->');

                            var cnt_arr = [];
                            var count = 0;
                            var sns_list = JSON.parse(fs.readFileSync(conf_file));
                            for(var idx in sns_list) {
                                if (sns_list.hasOwnProperty(idx)) {
                                    for (var usr in sns_list[idx]) {
                                        if (sns_list[idx].hasOwnProperty(usr)) {
                                            for (var sns in sns_list[idx][usr]) {
                                                if (sns_list[idx][usr].hasOwnProperty(sns)) {
                                                    if(sns === 'telegram' && sns === conf.sub[i].name.replace('sub_', '')) {
                                                        for (idx2 in sns_list[idx][usr][sns].cnt_path) {
                                                            if (sns_list[idx][usr][sns].cnt_path.hasOwnProperty(idx2)) {
                                                                if (conf.sub[i].parent === sns_list[idx][usr][sns].cnt_path[idx2]) {
                                                                    var cur_d = new Date();
                                                                    cur_o = cur_d.getTimezoneOffset() / (-60);
                                                                    cur_d.setHours(cur_d.getHours() + cur_o);
                                                                    var cur_time = cur_d.toISOString().replace(/\..+/, '');

                                                                    var conType = getType(cinObj.con);
                                                                    if (conType === 'object') {
                                                                        var conString = cur_time + ' - ' + sns_list[idx][usr][sns].cnt_path[idx2] + ' - ' + JSON.stringify(cinObj.con);
                                                                    }
                                                                    else if (conType === 'string') {
                                                                        conString = cur_time + ' - ' + sns_list[idx][usr][sns].cnt_path[idx2] + ' - ' + cinObj.con.toString();
                                                                    }
                                                                    else {
                                                                        conString = cur_time + ' - ' + sns_list[idx][usr][sns].cnt_path[idx2] + ' - ' + JSON.stringify(cinObj.con.toString());
                                                                    }

                                                                    tas.send_telegram(sns_list[idx][usr][sns].token, sns_list[idx][usr][sns].chatid, conString);
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            break;
                        }
                    }
                }
            }
        });
    }
    else {
        console.log('[mqtt_noti_action] message is not noti');
    }
};


exports.http_noti_action = function (rqi, pc, bodytype, response) {
    if (pc['m2m:sgn']) {
        pc.sgn = {};
        pc.sgn = pc['m2m:sgn'];
        delete pc['m2m:sgn'];
    }

    _this.parse_sgn(rqi, pc, function (path_arr, cinObj, rqi) {
        if (cinObj) {
            for (var i = 0; i < conf.sub.length; i++) {
                if (conf.sub[i].parent.split('/')[conf.sub[i].parent.split('/').length - 1] === path_arr[path_arr.length - 2]) {
                    if (conf.sub[i].name === path_arr[path_arr.length - 1]) {
                        response.setHeader('X-M2M-RSC', '2001');
                        response.setHeader('X-M2M-RI', rqi);
                        response.status(201).end('<h1>success to receive notification</h1>');

                        //console.log((cinObj.con != null ? cinObj.con : cinObj.content));
                        console.log('http ' + bodytype + ' notification <----');

                        tas.noti(path_arr, cinObj);
                    }
                }
            }
        }
    });
};


