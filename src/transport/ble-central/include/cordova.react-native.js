'use strict';

import {Duplex} from 'stream';

var BLE;
const FRAME_SIZE = 20;

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

        console.log("parsing...")
        console.log(asHexString(type));
        console.log((new Buffer(data)).toString());

        advertisementData[asHexString(type)] = data;
    }

    console.log("got advertisement data", advertisementData);

    return advertisementData;
}

class BLEStream extends Duplex {
  constructor(peripheral, transmit, receive){
    super();
    this._transmit = transmit;
    this._receive = receive;
    this._peripheral = peripheral;
    this.__read = false;

    console.log('ble construct');
    console.log(peripheral.id);
    BLE.startNotification(
      peripheral.id,
      receive.service,
      receive.characteristic,
      (buf) => {
        console.log("__ble_read");
        this.emit('data', new Buffer(buf))
      }
    ).catch(
      (err) => {
        console.log(err);
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
    var v = new Buffer(ab);
    for (var i = 0; i < data.length; ++i) {
        v[i] = data[i];
    }
    console.log(method);
    console.log(v.toString('hex'))
    BLE[method](
      this._peripheral.id,
      this._transmit.service,
      this._transmit.characteristic,
      ab
    ).then(
      (err) => {
        console.log("callback")
        cb()
      }
    ).catch(
      (err) => {
        console.log('error');
        console.log(err)
        this.end()
      }
    );
  }

  close(){
    BLE.disconnect(this._peripheral.id);
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

const assimilate = (Mesh) => (peripheral) => (
  Mesh.frames(new BLEStream(peripheral, peripheral.transmit, peripheral.receive), FRAME_SIZE)
)

const interrogate = (dev) => (peripheral) => {
  console.log("peripheral connected");
  var transmit, receive;
  peripheral.characteristics.forEach((char) => {
    console.log("char service config");
    let service_uuid = char.service.replace(/-|\s/g,"");
    console.log(dev.service_uuid);
    console.log(service_uuid);

    if (service_uuid === dev.service_uuid){
      console.log("char transmit");
      let characteristic_uuid = char.characteristic.replace(/-|\s/g,"");
      console.log(dev.transmit_characteristic_uuid);
      console.log(dev.receive_characteristic_uuid);
      console.log(characteristic_uuid);
      if (dev.transmit_characteristic_uuid === characteristic_uuid){
        peripheral.transmit = char;
        return;
      }
      if (dev.receive_characteristic_uuid === characteristic_uuid){
        peripheral.receive = char;
        return;
      }
    }
  })


  if (peripheral.transmit && peripheral.receive){
    return peripheral;
  } else {
    throw new Error("Peripheral does not have characteristics matching options");
  }
}



const BleCentral = (device, _opts) => (Mesh, th) => {
  var opts = {};
  let PLATFORM = device.platform.toLowerCase();

  return {
    type : "transport",
    name : "noble",
    listen : (_opts) => {
      if (!ble)
        return;

      opts = Object.assign(opts ,defaultOpts, _opts || {});

      BLE.scan([], opts.seconds, (peripheral) => {
        console.log("got peripheral",peripheral, device.platform);
        var mdata;
        switch (PLATFORM){
          case "android":
            mdata = parseAdvertisingData(peripheral.advertising)["0xff"];
            break;
          case "ios":
            mdata = peripheral.advertising.kCBAdvDataManufacturerData;
            break;
          default :
          return
        }


        mdata = new Buffer(mdata);
        if (!mdata)
          return;

        console.log("got mdata");
        console.log( mdata.toString());
        console.log("checking devices...")
        opts.devices.some((dev) => {
          console.log(dev.manufacturer_data);
          console.log(mdata.toString("hex"));
          if (dev.manufacturer_data === mdata.toString("hex")){
            return BLE.connect(peripheral.id) //Promises are truthy, so we'll break out of the some loop
                      .then(interrogate(dev))
                      .then(assimilate(Mesh))
                      .catch(() => BLE.disconnect(peripheral.id));
          }
        })
      });
    }
  }
}
export const ImportBleWrapper = (wrap, device, _opts) => {
  BLE = wrap(ble);
  return BleCentral(device, _opts);
};
