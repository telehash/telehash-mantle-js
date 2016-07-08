export const RNG = () => () => ({
  type :"rng",
  randomByte : () => crypto.getRandomValues(new Uint8Array(1))[0]
})

export {RNG as default}
