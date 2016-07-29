#!/usr/bin/env node
'use strict';
var jetpack = require('fs-jetpack');
var path = require("path");
var tmp = jetpack.cwd(path.join(__dirname, "..","tmp"));
var argv = require("minimist")(process.argv);
var _CP = require("child_process");
var spawn = _CP.spawn;
var rollup = require("rollup").rollup;
var resolve = require("rollup-plugin-node-resolve");
var commonjs = require("rollup-plugin-commonjs");
var string = require("rollup-plugin-string");
var alias = require('rollup-plugin-alias');
var globals = require('rollup-plugin-node-globals');
var builtins = require('rollup-plugin-node-builtins');
var json = require('rollup-plugin-json');
var babel = require('rollup-plugin-babel');

if (!argv.platform)
  throw new Error("required option --platform missing, e.g: --platform <node/electron/chrome/browser>");

if (argv.platform == "electron" && !argv.target) throw new Error("must provide electron version");

var ground = tmp.createWriteStream("./ground.js");

var head = `import Core from "thc";\n`
         + `var _middlewares = {}\n`;

var config = {};
var rebuild = [];

const camelCase = (str) => {
  var string = str.replace(/-([a-z])/g, (m, w) => {
    return w.toUpperCase();
  });
  return string.charAt(0).toUpperCase() + string.slice(1);
};

const installMiddleware = (type, name, platform) => new Promise((res, rej) => {
  let module_name = `telehash-${type}-${name}-${platform}`;
  let module_inject_path = path.join("..","src",type,name,platform, "package.inject.json");
  let module_index_path = path.join("..","src",type,name,platform, "index.js");
  let inject = tmp.read(module_inject_path, 'json');
  console.log(inject, module_inject_path);

  let mods = inject ? inject.external ? inject.external : [] : [];

  if (inject.rebuild)
    rebuild = rebuild.concat(inject.rebuild);

  let npmargs = (["install","--save"]).concat(mods);

  console.log(npmargs);
  spawn("npm",npmargs, {stdio:"inherit"}).on('close', () => {
    setTimeout(() => {
      addConfig(name, inject);
      appendToPreamble(name, module_index_path);
      res();
    },5000);

  }).on('error',rej);
});

const appendToPreamble = (name, module) => {
    let cc = camelCase(name);
    ground.write(`import  ${cc}  from '${module}';\n`);
    ground.write(`_middlewares['${cc}'] = ${cc};\n`);
};

const addConfig = (name, inject) => {
  let configTemplate = inject.config;
  config[camelCase(name)] = configTemplate || {};
};

const bundleByType = (type, string) => string.split(',').map((name) => installMiddleware(type, name, argv.platform));

const Build = () => {
  ground.write(head);

  let promises = [];
  console.log(argv.transports);
  if (argv.transports) promises = promises.concat(bundleByType('transport', argv.transports));
  if (argv.channels) promises = promises.concat(bundleByType('channel',argv.channels));

  if (argv.keystore) promises.push(installMiddleware('keystore', argv.keystore, argv.platform));

  Promise.all(promises).then(() => {
    appendToPreamble('RNG',path.join("..","rng",`${argv.platform}.js`));
    require('fs').createReadStream(path.join(__dirname,'_ground.js')).pipe(ground);
    tmp.write('config.template.json', config);
  }).catch(e => console.log(e));

};

ground.on('close',() => {
  console.log("close");
  let plugins = [
    //builtins(),
    resolve({
      // use "jsnext:main" if possible
      // – see https://github.com/rollup/rollup/wiki/jsnext:main
      jsnext: true,  // Default: false

      // use "main" field or index.js, even if it's not an ES6 module
      // (needs to be converted from CommonJS to ES6
      // – see https://github.com/rollup/rollup-plugin-commonjs
      main: true,  // Default: true

      // if there's something your bundle requires that you DON'T
      // want to include, add it to 'skip'. Local and relative imports
      // can be skipped by giving the full filepath. E.g.,
      // `path.resolve('src/relative-dependency.js')`
      skip: [ 'keytar','serialport','noble', 'react-native','react-native-randombytes','keytar-fallback' ],  // Default: []

      // some package.json files have a `browser` field which
      // specifies alternative files to load for people bundling
      // for the browser. If that's you, use this option, otherwise
      // pkg.browser will be ignored
      browser:(argv.platform === "react-native" || argv.platform === "cordova"),  // Default: false

      // not all files you want to resolve are .js files
      extensions: [ '.js', '.json'],  // Default: ['.js']

      // whether to prefer built-in modules (e.g. `fs`, `path`) or
      // local ones with the same names
      //preferBuiltins: false  // Default: true

    }),
    commonjs({
    //  ignoreGlobals : true
    })
    //globals(),
    //json()
  ];
  console.log(plugins);
  rollup({
    entry: tmp.path("ground.js"),
    format : 'cjs',
    plugins: plugins
  }).then( bundle => bundle.write({ dest: argv.o || 'ground.js', format:argv.format || "es", moduleName: "Ground" }) )
  .then(() => {

    if (argv.platform == 'electron'){
      let chain = Promise.resolve();
      rebuild.forEach(
        (name) => chain = chain.then(() => new Promise((res, rej) => {
          name = name.split(":").join(path.sep);
          let cwd = path.join(_CP.execSync("npm root").toString().replace(/\n$/, ""), name);
          console.log(cwd);
          spawn(
            'node-gyp'
            , ['rebuild',`--target=${argv.target}`,`--arch=x64`,`--dist-url=https://atom.io/download/atom-shell`]
            , {stdio : 'inherit', cwd : cwd}
          ).on('close', () => res()).on('error',() => res());
        }))
      );
      return chain;
    } else return Promise.resolve();

  }).then(() => console.log("done")).catch(e => console.log(e));
});


Build();
