'use strict';

import noble from 'noble';
import {Duplex} from 'stream';

var _nobleOn;

noble.on('stateChange', function(state) {
  //console.log('State changed: ' + state);
  if (state === 'poweredOn') {
    _nobleOn = true;
  } else {
    _nobleOn = false
    noble.stopScanning();
  }
});


function compareUUIDs(a, b) {
  a = a || '';
  b = b || '';
  a = a.toLowerCase().replace(/\-/g, '');
  b = b.toLowerCase().replace(/\-/g, '');
  return a === b;
}

class BLEStream extends Duplex {
  constructor(peripheral, transmit, receive){
    super();
    this._transmit = transmit;
    this._readbuf = [];
    this.__read = false;
    
    receive.on('read', (data) => {
      if (data.length > 4) this.emit('data',data)
    });

    peripheral.once('disconnect', () => {
      this.end()
    })
    receive.notify(true, function(err) {
     // console.log('notify', err);
    });
  }

  _read(){
    while (this._readbuf.length){
      if (!this.push(this._readbuf.shift())) break;
    }
    if (!this._readbuf.length) this.__read = true;
  }

  _write(data, enc, cb){
    // TERRIBLE HACK, write with ack when meta frame detected
    var zeros = new Buffer(8);
    zeros.fill(0);
    var noack = (zeros.compare(data,9,16) == 0)?false:true;
    this._transmit.write(data, noack, cb)
  }
}

const defaultOpts = {
  devices : [
    {
      manufacturer_data : Buffer.concat([(new Buffer("FFFF","hex")),(new Buffer("Filament\0"))]).toString("hex"),
      service_uuid : '6e400001b5a3f393e0a9e50e24dcca9f',
      transmit_characteristic_uuid : '6e400002b5a3f393e0a9e50e24dcca9f',
      receive_characteristic_uuid : '6e400003b5a3f393e0a9e50e24dcca9f'
    }
  ]
}

export const BleCentral = (_opts) => (Mesh, th) => {
  var opts = {};

  let FRAME_SIZE = 20;

  return {
    type : "transport",
    name : "noble",
    listen : (_opts) => {
      opts = Object.assign(opts ,defaultOpts, _opts || {});
      noble.on('discover', function(peripheral) {
        // Match discovered characteristics and name or address against
        // provided options. If opts.localName is empty, match against
        // all named devices
        let mdata = peripheral.advertisement.manufacturerData;
        if (!mdata)
          return;
        opts.devices.some((dev) => {

          if (dev.manufacturer_data === mdata.toString("hex")){
            peripheral.connect(function(err) {
              // Discover services and characteristics
              peripheral.discoverSomeServicesAndCharacteristics( 
                [dev.service_uuid],
                [dev.transmit_characteristic_uuid,dev.receive_characteristic_uuid], 
                function(err, services, characteristics){
                  var transmit, receive;

                  characteristics.forEach(function(characteristic) {
                    if (compareUUIDs(dev.transmit_characteristic_uuid, characteristic.uuid)) {
                      transmit = characteristic;
                    } else if (compareUUIDs(dev.receive_characteristic_uuid, characteristic.uuid)) {
                      receive = characteristic;
                    }
                  })

                  if (transmit && receive){
                    Mesh.frames(new BLEStream(peripheral, transmit, receive), FRAME_SIZE);   
                  } else {
                    peripheral.disconnect();
                  }
                }
              )
            }); // connect
            return true;
          } else {
            return false;
          }
        })
      }); // on discover

      // set up scanning;
      if (_nobleOn) noble.startScanning();
      else noble.on('stateChange', (state) => state === "poweredOn" ? noble.startScanning() : null)
 
    }
  }
}