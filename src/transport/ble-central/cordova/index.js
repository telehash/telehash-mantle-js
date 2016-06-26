'use strict';

import {Duplex} from 'stream';


// decoding advertisement from https://github.com/don/ITP-BluetoothLE/blob/887511c375b1ab2fbef3afe210d6a6b7db44cee9/phonegap/thermometer_v2/www/js/index.js#L18-L39
function asHexString(i) {
    var hex;

    hex = i.toString(16);

    // zero padding
    if (hex.length === 1) {
        hex = "0" + hex;
    }

    return "0x" + hex;
}

function parseAdvertisingData(buffer) {
    var length, type, data, i = 0, advertisementData = {};
    var bytes = new Uint8Array(buffer);

    while (length !== 0) {

        length = bytes[i] & 0xFF;
        i++;

        // decode type constants from https://www.bluetooth.org/en-us/specification/assigned-numbers/generic-access-profile
        type = bytes[i] & 0xFF;
        i++;

        data = bytes.slice(i, i + length - 1).buffer; // length includes type byte, but not length byte
        i += length - 2;  // move to end of data
        i++;

        advertisementData[asHexString(type)] = data;
    }

    return advertisementData;
}

class BLEStream extends Duplex {
  constructor(peripheral, transmit, receive){
    super();
    this._transmit = transmit;
    this._receive = receive;
    this.__read = false;

    ble.startNotification(
      peripheral.id, 
      receive.service, 
      receive.characteristic, 
      (buf) => {
        this.emit('data', new Buffer(buf))
      }, 
      () => {
        this.end();
      }
    );
  }

  _read(){

  }

  _write(data, enc, cb){
    // TERRIBLE HACK, write with ack when meta frame detected
    var zeros = new Buffer(8);
    zeros.fill(0);
    var method = (zeros.compare(data,9,16) == 0)?"write":"writeWithoutResponse";
    var ab = new ArrayBuffer(data.length);
    var v = new Uint8Array(ab);
    for (var i = 0; i < buffer.length; ++i) {
        v[i] = data[i];
    }

    ble[method](
      this._peripheral.id, 
      this._transmit.service, 
      this._transmit.characteristic, 
      ab, 
      () => cb(), 
      () => {
        this.end()
      }
    );
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
  ],
  seconds : 30
}

export const BleCentral = (_opts) => (Mesh, th) => {
  var opts = {};

  let FRAME_SIZE = 20;

  return {
    type : "transport",
    name : "noble",
    listen : (_opts) => {
      if (!ble)
        return;

      opts = Object.assign(opts ,defaultOpts, _opts || {});

      ble.scan([], opts.seconds, (peripheral) => {
        var mdata;
        switch (device.platform){
          case "Android":
            mdata = parseAdvertisingData(peripheral.advertising)["0xFF"];
          case "iOS":
            mdata = peripheral.advertising.kCBAdvDataManufacturerData;
          default : 
          return
        }

        mdata = new Buffer(mdata);
        if (!mdata)
          return;

        opts.devices.some((dev) => {
          if (dev.manufacturer_data === mdata.toString()){
            ble.connect(
              peripheral.id, 
              (peripheral) => {
                var transmit, receive;
                peripheral.characteristics.forEach((char) => {
                  if (dev.service_uuid.indexOf(char.service) >= 0){
                    if (dev.transmit_characteristic_uuid.indexOf(char.characteristic) >= 0){
                      transmit = char;
                    }
                    if (dev.receive_characteristic_uuid.indexOf(char.characteristic) >= 0){
                      receive = char;
                    }
                  }
                })

                if (transmit && receive){
                  Mesh.frames(new BLEStream(peripheral, transmit, receive), FRAME_SIZE);
                } else {
                  ble.disconnect(peripheral.id)
                }
              }, 
              () => {

              });
            return true;
          } else {
            return false;
          }
        })
      });
    }
  }
}

export {BleCentral as default}