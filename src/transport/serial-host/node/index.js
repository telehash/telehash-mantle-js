import {SerialHost as _serialHost} from '../include/node.electron.js';
import {SerialPort, list} from 'serialport';

const SerialHost = _serialHost(SerialPort, list);
export {SerialHost as default};