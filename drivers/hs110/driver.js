"use strict";
// need Homey module, see SDK Guidelines
const Homey = require('homey');

const {
    Client
} = require('tplink-smarthome-api');
const client = new Client();

// get driver name based on dirname (hs100, hs110, etc.)
function getDriverName() {
    var parts = __dirname.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1].split('.')[0];
}
var TPlinkModel = getDriverName().toUpperCase();
var myRegEx = new RegExp(TPlinkModel, 'g');
//var devIds = {};
var logEvent = function (eventName, plug) {
    //this.log(`${(new Date()).toISOString()} ${eventName} ${plug.model} ${plug.host} ${plug.deviceId}`);
    console.log(`${(new Date()).toISOString()} ${eventName} ${plug.model} ${plug.host}`);
};

function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

class TPlinkPlugDriver extends Homey.Driver {

    async onPair(session) {
        // socket is a direct channel to the front-end
        var devIds = {};

        try {
            let apidevices = await this.getDevices();
            Object.values(apidevices).forEach(device => {
                this.log("deviceId: " + device.getSettings().deviceId);
                devIds[device.getSettings().deviceId] = "";
            })
            this.log(devIds);
        } catch (err) {
            this.log(err);
        }

        var id = guid();
        let devices = [{
            "data": {
                "id": id
            },
            "name": "initial_name",
            "settings": {
                "settingIPAddress": "0.0.0.0",
                "totalOffset": 0
            } // initial settings
        }];

        // discover function
        session.setHandler("discover", async (data) => {
            this.log('Starting Plug Discovery');

            // discover new plugs
            // TODO: use API's discovery options (exclude MAC addresses, timeout, interval)
            var discoveryOptions = {
                deviceTypes: 'plug',
                discoveryInterval: 2500,
                discoveryTimeout: 9000
            }
            client.startDiscovery(discoveryOptions);
            client.on('plug-new', (plug) => {
                logEvent('plug-new', plug);

                if (plug.model.match(myRegEx)) {
                    // check if device is known
                    if (devIds.hasOwnProperty(plug.deviceId)) {
                        this.log("Key found in devices: " + JSON.stringify(devIds));
                        this.log("Device " + plug.host + " is known, skipping. Model: " + plug.model + " name " + plug.name + " mac " + plug.mac + " id " + plug.deviceId);
                    } else {
                        this.log("Plug found: " + plug.host + " model " + plug.model + " name " + plug.name + " mac " + plug.mac + " id " + plug.deviceId);

                        var data = {
                            ip: plug.host,
                            name: plug.name
                        }
                        session.emit('found', data);
                        setTimeout(function () {
                            client.stopDiscovery()
                        }, 1000);
                        this.log("Discovered new plug: " + data.id + " name " + data.name);
                        //callback(null, data);
                        return data
                    }
                }
            })
            client.on('plug-online', (plug) => {
                logEvent('plug-online', plug);
                if (plug.model.match(myRegEx)) {
                    if (devIds.hasOwnProperty(plug.deviceId)) {
                        this.log("Key found in devices: " + JSON.stringify(devIds));
                        this.log("Device " + plug.host + " is known, skipping. Model: " + plug.model + " name " + plug.name + " mac " + plug.mac + " id " + plug.deviceId);
                    } else {
                        this.log("Online plug found: " + plug.host + " model " + plug.model + " name " + plug.name + " mac " + plug.mac + " id " + plug.deviceId);

                        var data = {
                            ip: plug.host,
                            name: plug.name
                        }
                        session.emit('found', data);
                        setTimeout(function () {
                            client.stopDiscovery()
                        }, 1000);
                        this.log("Discovered online plug: " + data.name);
                        callback(null, data);
                    }
                }
            })
        });

        // this is called when the user presses save settings button in start.html
        session.setHandler("get_devices", async (data) => {
            this.log("Get_devices data: " + JSON.stringify(data));
            devices = [{
                data: {
                    id: id
                },
                name: data.deviceName,
                settings: {
                    "settingIPAddress": data.ipaddress,
                    "dynamicIp": false,
                    "totalOffset": 0
                } // initial settings
            }];

            // Set passed pair settings in variables
            this.log("Got get_devices from front-end, IP =", data.ipaddress, " Name = ", data.deviceName);
            session.emit('continue', null);

            // this method is run when Homey.emit('list_devices') is run on the front-end
            // which happens when you use the template `list_devices`

            session.setHandler("list_devices", async (data) => {

                this.log("List_devices data: " + JSON.stringify(data));

                //callback(null, devices);
                return devices
            });
        });

        session.setHandler("disconnect", async () => {
            this.log("Pairing is finished (done or aborted)");
        })
    }
}

module.exports = TPlinkPlugDriver;
