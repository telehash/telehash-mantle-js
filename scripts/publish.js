'use strict';

var jetpack = require("fs-jetpack");
var path = require("path");
var {exec, spawn, execSync} = require("child_process");

var dist = jetpack.cwd(path.join(process.env.NODE_PATH, 'dist'));
require("./build")().then(() => {
  console.log("build completed");
  dist.find(".",{matching : "index.js"}).filter(p => {
    let _path = p.split(path.sep);
    _path.pop();
    let publishpath = _path.join(path.sep);
    _path.push("package.json");
    console.log(_path);
    let pkg = dist.read(_path.join(path.sep),'json');

    try {
      exec("npm show " + pkg.name + " version", (err, stdout) => {

        if (err || stdout.replace(/\n$/, "") != pkg.version){
          console.log(pkg.name, "publish", stdout.replace(/\n$/, ""), "replaces",pkg.version);
          let cwd = dist.path(publishpath);
          let npm = execSync("which npm").toString();
          console.log("cwd", cwd, npm);
          spawn(npm.replace(/\n$/, ""),["publish"], {
            cwd ,
            env : process.env,
            stdio : "inherit"
          }).on('error',(err) => {
            console.log("ER",err);
          });
        }

      });
    } catch(e){
      console.log("ERRO",e);
    }
  });
});
