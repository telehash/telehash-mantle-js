'use strict';

import noble from 'noble';
import {Duplex} from 'stream';

var _nobleOn;
console.log("NOBLE")
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
    this.buffer = []
    
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
    this._transmit.write(data, false, cb)

    //  console.log('buffering ', data);
    if (!Buffer.isBuffer(data)) {
      data = new Buffer(data);
    }
    this.buffer.push(data);
    if(this.buffer.length > 1) return;
    if(!this.transmit) return;

    const sender = () =>
    {
      if(!(data = this.buffer.shift())) return cb();
      console.log('ble_write', data);
      this.transmit.write(data, false, function(err){
        if(err)
        {
          this.up = false;
          this.emit('down');
          return;
        }
        setTimeout(sender,1);
      });
    }

    sender();
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

const BleCentral = (_opts) => (Mesh, th) => {
  th.util_sys_logging(1);
  var opts = {};

  let FRAME_SIZE = 20;

  return {
    type : "transport",
    name : "noble",
    listen : (_opts) => {
      opts = Object.assign(opts ,defaultOpts, _opts || {});
      console.log("LISTEN")
      noble.on('discover', function(peripheral) {
        // Match discovered characteristics and name or address against
        // provided options. If opts.localName is empty, match against
        // all named devices
        console.log(peripheral.advertisement)
        let mdata = peripheral.advertisement.manufacturerData;
        if (!mdata)
          return;
        console.log("RETURNED")
        opts.devices.some((dev) => {

          if (dev.manufacturer_data === mdata.toString("hex")){
            console.log()
            peripheral.connect(function(err) {
              // Discover services and characteristics
              peripheral.discoverSomeServicesAndCharacteristics( 
                [dev.service_uuid],
                [dev.transmit_characteristic_uuid,dev.receive_characteristic_uuid], 
                function(err, services, characteristics){
                  console.log("got ")
                  var transmit, receive;

                  characteristics.forEach(function(characteristic) {
                    if (compareUUIDs(dev.transmit_characteristic_uuid, characteristic.uuid)) {
                      transmit = characteristic;
                    } else if (compareUUIDs(dev.receive_characteristic_uuid, characteristic.uuid)) {
                      receive = characteristic;
                    }
                  })

                  if (transmit && receive){
                    console.log("got tx/rx")
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
      console.log("START")
      if (_nobleOn) noble.startScanning();
      else noble.on('stateChange', (state) => state === "poweredOn" ? noble.startScanning() : null)
 
    }
  }
}

export {BleCentral as default}
