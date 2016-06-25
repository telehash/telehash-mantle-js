'use strict';

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





export const SerialHost = (SerialPort, list) => (opts) => (Mesh, th) => {
  let mesh = Mesh._mesh;
  var ignore = new Set();
  var opts = {};

  const filterPort = (port) => !ignore.has(port.comName) &&  ( (opts.comName === port.comName) || (opts.vendors[port.vendorId] && opts.vendors[port.vendorId][port.productId]));

  let FRAME_SIZE = 64;
  let CHUNK_SIZE = 32;


  return {
    type : "transport",
    name : "serial-host",
    listen : (_opts) => {
      opts = Object.assign(opts ,defaultOpts, _opts || {});
      
      //return;
      let discoverinterval = setInterval(() => {
        list(function (err, ports) {
          if (err) return;
          ports.filter(filterPort)
               .forEach((port) => {
                ignore.add(port.comName)
                  let config = opts.vendors[port.vendorId][port.productId];
                  
                  var sock = new SerialPort(port.comName,{baudrate: 115200}, function(err){
                    if(err) return;
                  });

                  sock.on('open', (err) => {
                    Mesh[config.type](sock, config.size);
                  })

                  sock.on('error', (err) => {
                    console.log('error',err)
                    return;
                  })

                  sock.on('close', (err) => {
                    ignore.delete(port.comName)
                  })
                })
        });
      }, 3000)
    }
  }
}