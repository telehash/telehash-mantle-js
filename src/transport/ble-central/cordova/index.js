'use strict';
import {ImportBleWrapper} from '../include/cordova.react-native.js';

const Promisify = (ble, fun) => function(){
  let args = Array.from(arguments);
  return new Promise((res, rej) => {
    args.push((v) => res(v));
    args.push((v) => rej(v));
    fun.apply(ble, args);
  })
}

const wrapBle = (ble) =>
  Object.keys(ble)
        .reduce((_ble, key) =>
          Object.assign(_ble, {
            [key] : Promisify(ble, ble[key])
          }), {});

export const BleCentral = (opts) => ImportBleWrapper(wrapBle, device, opts);

export {BleCentral as default}
