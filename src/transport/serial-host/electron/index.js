import {SerialHost as _serialhost} from '../include/node.electron.js'
import {SerialPort as _serialport, list} from 'serial-worker';

class SerialPort extends _serialport {
  constructor(comName, opts, cb){
    super(comName, opts, false, cb);
  }
}

const SerialHost = _serialhost(SerialPort, list)

export {SerialHost as default};