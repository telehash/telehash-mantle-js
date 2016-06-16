var jetpack = require("fs-jetpack")
var path = require("path");

var src = jetpack.cwd(path.join(process.env.NODE_PATH, 'src'))
var dist = jetpack.cwd(path.join(process.env.NODE_PATH, 'dist'));
var rollup = require("rollup")
var util = require("util")
var chokidar = require("chokidar")

var bundle;
var injections = {};

function DO(){
  return src.findAsync('.', {
    matching: 'package.inject.json'
  }).then((matches) => {
    console.log(matches, injections)
    matches.filter((p) => {
      var _src = src.inspect(p, {checksum: "md5"})
      var _dest = dist.inspect(p, {checksum : "md5"})
      return (!_dest || _dest.md5 != _src.md5)
    }).forEach((p) => {
      let _path = p.split(path.sep);
      _path.pop();
      let master = src.read('../package.json','json');
      let _inj = src.read(p, 'json')
      let version = _inj.version || master.version
      version = version.split(".").map((t) => Number.parseInt(t));
      version[2]++;
      console.log("!",version)
      version = version.join(".")
      var pkg = Object.assign(master, src.read(p, 'json'), {
        name : "telehash-" + _path.join('-'),
        version : version,
        devDependencies : {}
      })

      _path.push("package.json")
      dist.write((_path.join(path.sep)), pkg);
      src.write("../package.json", Object.assign(master, {version : version}))

      let inj = Object.assign(_inj, {
        version : version
      })
      src.write(p, inj)
      dist.write(p, inj)
    })
    injections = matches.map((p) => src.inspect(p, {checksum : "md5"})).reduce((inj, item) => {
      inj[item.md5] = item;
      return inj;
    },{});
    console.log(injections)
  }).then(() => {
    
    return Promise.all(src.find(".",{matching : "index.js"}).map((p) => {
      console.log(src.path(p))
        return rollup.rollup({
        // The bundle's starting point. This file will be
        // included, along with the minimum necessary code
        // from its dependencies
        entry: src.path(p),
        cache : bundle
      }).then((b) => {
          bundle = b;
          var result = bundle.generate({
            // output format - 'amd', 'cjs', 'es6', 'iife', 'umd'
            format: 'cjs'
          });
          dist.write( p, result.code );
      })
    }))
  })
}
function watch(){
  let watcher = chokidar.watch('./src/**', {}).on('change', (event, path) => {
    watcher.close();
    DO().then(watch)
  });
}
DO().then(watch)
