'use strict';
var jetpack = require('fs-jetpack');
var path = require("path")
var tmp = jetpack.cwd(path.join(process.cwd()));
var argv = require("minimist")(process.argv);
var spawn = require("child_process").spawn;
var rollup = require("rollup").rollup;
var resolve = require("rollup-plugin-node-resolve");
var commonjs = require("rollup-plugin-commonjs");
var string = require("rollup-plugin-string");


if (!argv.platform)
  throw new Error("required option --platform missing, e.g: --platform <node/electron/chrome/browser>")

if (argv.platform == "electron" && !argv.target) throw new Error("must provide electron version")
var ground = tmp.createWriteStream("./ground.js");

var head = `import Core from "thc";\n`
         + `var _middlewares = {}\n`;

var config = {}

const camelCase = (str) => {
  var string = str.replace(/-([a-z])/g, (m, w) => {
    return w.toUpperCase();
  }); 
  return string.charAt(0).toUpperCase() + string.slice(1);
}

const installMiddleware = (type, name, platform) => new Promise((res, rej) => {
  let module_name = `telehash-${type}-${name}-${platform}`;
  if (argv.skip){
      addConfig(name, module_name)
    appendToPreamble(name, module_name);  
    return process.nextTick(() => res());
  }
  
  spawn("npm",["install","--save", module_name], {stdio:"inherit"}).on('close', () => {
    setTimeout(() => {
    addConfig(name, module_name)
    appendToPreamble(name, module_name);
    res();
    },5000)

  }).on('error',rej)
})

const appendToPreamble = (name, module) => {
    let cc = camelCase(name);
    ground.write(`import  ${cc}  from '${module}';\n`);
    ground.write(`_middlewares['${cc}'] = ${cc};\n`)
}

const addConfig = (name, module_name) => {
  console.log(name, module_name)
  let configTemplate = tmp.read(path.join("node_modules",module_name,"package.json"), "json").ground;
  config[camelCase(name)] = configTemplate || {};
}

const bundleByType = (type, string) => string.split(',').map((name) => installMiddleware(type, name, argv.platform));

const Build = () => {
  ground.write(head);
  let promises = [new Promise((res, rej) => {
    spawn('npm',['install','thc'],{stdio: "inherit"}).on('close',() => res())
  })];
  console.log(argv.transports)
  if (argv.transports) promises = promises.concat(bundleByType('transport', argv.transports))
  if (argv.channels) promises = promises.concat(bundleByType('channel',argv.channels))

  if (argv.keystore) promises.push(installMiddleware('keystore', argv.keystore, argv.platform))

  Promise.all(promises).then(() => {
    require('fs').createReadStream(path.join(__dirname,'_ground.js')).pipe(ground);
    tmp.write('config.template.json', config);
  }).catch(e => console.log(e))

}

ground.on('close',() => {
  console.log("close")
  rollup({
    entry: 'ground.js',
    format : 'cjs',
    plugins: [
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
        skip: [ 'keytar','serialport','noble', 'serial-worker' ],  // Default: []

        // some package.json files have a `browser` field which
        // specifies alternative files to load for people bundling
        // for the browser. If that's you, use this option, otherwise
        // pkg.browser will be ignored
        browser: true,  // Default: false

        // not all files you want to resolve are .js files
        extensions: [ '.js', '.json', '.mem' ],  // Default: ['.js']

        // whether to prefer built-in modules (e.g. `fs`, `path`) or
        // local ones with the same names
        preferBuiltins: false  // Default: true

      }),
      commonjs(),
      string({
        include : "**/*.js.mem"
      })
    ]
  }).then( bundle => bundle.write({ dest: 'bundle.js', format: argv.format || "cjs" }) )
  .then(() => {
    var app = jetpack.cwd(process.cwd())
    var len = process.cwd().split(path.sep).length
    var things =  (argv.platform === "electron" ? (['keytar','serial-worker','noble']) : ['keytar','serialport','noble']).map(k => "**/" + k + "/package.json")
    console.log((['keytar','serial-worker','noble']).map(k => k + "/package.json"))
    app.find(".",{matching: things, files: true, directories: false}).forEach((dir) => {
      var src = dir.split(path.sep)
      src.pop();
      var name = src[src.length - 1];
      src = src.join(path.sep);
      var dest = path.join("node_modules",name)
      app.copy(src, dest, {overwrite : true})
    })

    if (argv.platform == 'electron'){
      return Promise.all(app.find(".",{
        matching : (['keytar','serialport','noble']).map(k => "**/" + k + "/package.json")
        , files: true
        , directories: false
      }).map(
        (dir) => new Promise((res, rej) => {
          var src = dir.split(path.sep)
          src.pop();
          src = src.join(path.sep);
          console.log("rebuild")
          spawn(
            'node-gyp'
            , ['rebuild',`--target=${argv.target}`,`--arch=x64`,`--dist-url=https://atom.io/download/atom-shell`]
            , {stdio : 'inherit', cwd : path.join(process.cwd(), src)}
          ).on('close', () => res())
        })
      ))
    } else return Promise.resolve()

  }).then(() => console.log("done")).catch(e => console.log(e));
})


Build();


