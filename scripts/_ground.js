export const Ground = (config, cb) => {
  let core = Core(cb);
  Object.keys(_middlewares).forEach((mw) => {
    core.use(_middlewares[mw](config[mw]));
  });
  return core;
};

export default Ground;
