'use strict';
import {Platform, NativeAppEventEmitter} from 'react-native';
import {ImportBleWrapper} from '../include/cordova.react-native.js';

const device = {
  platform : Platform.OS
}

const CallbackEvents = {
  scan : 'BleManagerDiscoverPeripheral',
  startNotification : 'BleManagerDidUpdateValueForCharacteristic'
}

const wrapCallbackFun = (ble, fun) => function _cbwrapped() {
  let args = Array.from(arguments);
  let cb = args.pop();
  switch (fun.name){
    case "scan" :
      NativeAppEventEmitter.addListener(CallbackEvents.scan, (peripheral) => {
        console.log("discovered peripheral");
        console.log(Object.keys(peripheral))
        cb(peripheral);
      })
      break;
    case "startNotification":
      let peripheralid = args.shift();
      NativeAppEventEmitter.addListener(CallbackEvents.startNotification, (update) => {
        if (update.peripheral === peripheralid){

          cb(update);
        }
      })
      break;
    default :
      break;
  }
  return fun.apply(ble, arguments);
}

const wrapBle = (ble) =>
  Object.keys(ble)
        .reduce((_ble, key) =>
          Object.assign(_ble, {
            [key] : wrapCallbackFun(ble, ble[key])
          }), {});

export const BleCentral = (opts) => ImportBleWrapper(wrapBle, device, opts);

export {BleCentral as default}
