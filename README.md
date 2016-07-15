# telehash-mantle-js
telehash-mantle is a shared repository and cli tool for building a telehash sdk for node, electron, and cordova.

Why one repository?
---
To leverage JavaScript code portability

Why a cli build tool instead of just one node module
---
Because Javascript code portability is a dirty lie.

Usage
---

```
npm install -g telehash-mantle
cd myproject
mantle -o ground.js --platform=<node/electron/cordova> --target=<version (electron only)> --format=<es/cjs> --transports=<serial-host,ble-central> --keystore=local
```

This will generate a `ground.js` file that is tailored to your platform.

API example
----
Usage is modeled after express. The flow is to initialize your app, configure middlewares, and turn it on

```javascript
//main.js
var Ground = require("./ground.js");

var app = Ground({/*options*/},function(err){
  if (err) console.log("error initializing telehash");
})
//whitelist connections
app.accept("asdf1234");
app.accept("mnbv9876");
//blacklist connections
app.reject("lkjhgfds");

// asyncronously accept connections
app.on('discover',function(greeting, accept){
  promtUserToAcceptLink(greeting.json.hashname, function(){
    link = accept();
    //do stuff with link;
  })
})

//handle new links

app.on('link', function(link){
  //send a console command to a link
  link.console("report()",function(err,result){
    if (err) return console.log(err);
    console.log(result);
  })
  
  // create a generic channel, inherits from node streams
  
  var chan = link.channel({json: {type : "event", label: "report"}, body: new Buffer("binary payload")});
  
  //data events;
  chan.on('data', function(packet){
    console.log(packet.json, packet.body) // {stuff}, <Buffer >
  })
  
  //pipe as stream
  chan.pipe(fs.createWriteStream("out.txt"));

  // send a one-off channel packet, no reply
  link.direct({type : "event", label:"stuff"}, new Buffer("payload"));

  // set an init script
  link.init(fs.readFileSync("path/to/script.js"), function(err, res){
    
  })
})

// iterate through all open links
app._links.forEach((link) => {
  link.console("parralel execution", ...)
})

// use middlewares (coming soon)
let mysql_sink = require("telehash-mysql-sink");
var instance1 = mysql_sink({host: localhost...});
var instance2 = mysql_sink({host : amazon...});
app.use(instance1);
app.use(instance2);

//generic event middleware
let events = require("filement-event");

app.use(events({label:"adfadf",callback: function(label, stuff){
  doStuffWithMatchingNetworkEvent(label, stuff)
})

//start app
app.start()
app.listen();
// -- OR --
app.start(true);

```
