import keytar from 'keytar-fallback'

export const Keytar = (opts) => (Mesh, th) => {
  let mesh = Mesh._mesh;
  var ignore = new Set();
  var opts = {};

  return {
    type : "keystore",
    name : "local",
    getKeys: (cb) => {
      let res = keytar.getPassword("telehash", "keys");
      let r = (typeof res === "string") ? res.split(":") : [null, null];
      let secret = r[0], keys = r[1]
      cb(secret, keys);
    },

    storeKeys :  (secrets, keys, cb) => {
      let res = keytar.addPassword("telehash","keys",([secrets, keys]).join(":"));
      if (res instanceof Promise){
        res.catch((e) => console.error(e)).then(() => cb)
      } else {
        cb()
      }
    }
  }
}
