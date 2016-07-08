import crypto from 'crypto';

export const RNG = () => () => ({
  type : "rng",
  randomByte : () => crypto.randomBytes(1)[0]
})

export {RNG as default}
