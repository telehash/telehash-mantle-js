import {SerialHost as _serialhost} from '../include/node.electron.js'
import {SerialPort , list} from 'serialport';

const SerialHost = _serialhost(SerialPort, list)

export {SerialHost as default};