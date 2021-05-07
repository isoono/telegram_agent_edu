/**
 * Created by Il Yeup, Ahn in KETI on 2017-02-23.
 */

/**
 * Copyright (c) 2017, OCEAN
 * All rights reserved.
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * 1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * 3. The name of the author may not be used to endorse or promote products derived from this software without specific prior written permission.
 * THIS SOFTWARE IS PROVIDED BY THE AUTHOR ``AS IS'' AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

var fs = require('fs');


var conf = {};
var cse = {};
var ae = {};
var cnt_arr = [];
var sub_arr = [];
var acp = {};

conf.useprotocol = 'http'; // select one for 'http' or 'mqtt' or 'coap' or 'ws'

// build cse
cse.host        = '203.253.128.161';
cse.port        = '7579';
cse.name        = 'Mobius';
cse.id          = '/Mobius2';
cse.mqttport    = '1883';
cse.wsport      = '7577';

// build ae
ae.name         = 'tg_agent2';
ae.id           = 'S201708241156448840K40';

ae.parent       = '/' + cse.name;
ae.appid        = 'bridge_telegram';
ae.port         = '9727';
ae.bodytype     = 'json'; // select 'json' or 'xml' or 'cbor'
ae.tasport      = '3106';

// build cnt
var count = 0;

// build sub
count = 0;

global.Twitter_arr = {};
global.conf_file = 'telegram.json';

var sns_list = JSON.parse(fs.readFileSync(conf_file));
for(var idx in sns_list) {
    if (sns_list.hasOwnProperty(idx)) {
        for (var usr in sns_list[idx]) {
            if (sns_list[idx].hasOwnProperty(usr)) {
                for (var sns in sns_list[idx][usr]) {
                    if (sns_list[idx][usr].hasOwnProperty(sns)) {
                        for (var idx2 in sns_list[idx][usr][sns].cnt_path) {
                            if (sns_list[idx][usr][sns].cnt_path.hasOwnProperty(idx2)) {
                                var cnt_path_arr = sns_list[idx][usr][sns].cnt_path[idx2].split('/');
                                cnt_arr[count] = {};
                                cnt_arr[count].parent = sns_list[idx][usr][sns].cnt_path[idx2].replace('/' + cnt_path_arr[cnt_path_arr.length - 1], '');
                                cnt_arr[count].name = cnt_path_arr[cnt_path_arr.length - 1];

                                sub_arr[count] = {};
                                sub_arr[count].parent = cnt_arr[count].parent + '/' + cnt_arr[count].name;
                                sub_arr[count].name = 'sub_'+sns;
                                sub_arr[count].nu = 'mqtt://' + cse.host + '/' + ae.id + '?ct=' + ae.bodytype;

                                count++;
                            }
                        }
                    }
                }
            }
        }
    }
}

conf.usesecure  = 'disable';

if(conf.usesecure === 'enable') {
    cse.mqttport = '8883';
}

conf.cse = cse;
conf.ae = ae;
conf.cnt = cnt_arr;
conf.sub = sub_arr;
conf.acp = acp;



module.exports = conf;
