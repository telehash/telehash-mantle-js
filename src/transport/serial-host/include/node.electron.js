'use strict';
import SerialPort from 'serialport';

const defaultOpts = {
  vendors : {
    "0x2c93" : {
      "0x7232" : {
        type : "chunks",
        size : 32,
      },
      "0x7233" : {
        type : "frames",
        size : 64
      }
    }
  }
};


export const SerialHost = (opts) => (Mesh, th) => {
  let mesh = Mesh._mesh;
  var ignore = new Set();
  var opts = {};

  const filterPort = (port) => !ignore.has(port.comName) &&  ( (opts.comName === port.comName) || (opts.vendors[port.vendorId] && opts.vendors[port.vendorId][port.productId]));

  const normalize = (port) => {
    try {
      if (!(port.vendorId || port.productId)){
        if (port.pnpId){
          var parts = port.pnpId.split('\\');
          var vidpid = parts[1];
          var serialnum = parts[2];

          var vidpidparts = vidpid.split('&');
          var vid = vidpidparts[0].split("_")[1];
          var pid = vidpidparts[1].split("_")[1];

          port.vendorId = port.vendorId || `0x${vid.toLowerCase()}`;
          port.productId = port.productId || `0x${pid.toLowerCase()}`;
        }
      }
    } catch (e) {
      console.log("normalize error",e)
    }
    return port;
  }

  let FRAME_SIZE = 64;
  let CHUNK_SIZE = 32;


  return {
    type : "transport",
    name : "serial-host",
    listen : (_opts) => {
      opts = Object.assign(opts ,defaultOpts, _opts || {});

      //return;
      let discoverinterval = setInterval(() => {
        SerialPort.list(function (err, ports) {
          //console.log("ports",ports);
          if (err) return;
          ports.map(normalize)
               .filter(filterPort)
               .forEach((port) => {
                 console.log("connecting",port);
                 ignore.add(port.comName)
                  let config = opts.vendors[port.vendorId][port.productId];
                  var sock = new SerialPort.SerialPort(port.comName,{baudrate: 115200}, function(err){
                    if(err) {
                      ignore.delete(port.comName)
                      return console.log(err)
                    };
                  });

                  sock.on('open', (err) => {
                    process.nextTick(() => Mesh[config.type](sock, config.size));
                  });

                  sock.on('error', (err) => {
                    ignore.delete(port.comName)
                    return;
                  });

                  sock.on('close', (err) => {
                    ignore.delete(port.comName)
                  });


                })
        });
      }, 3000)

      return Promise.resolve(() => clearInterval(discoverinterval))
    }
  }
}
