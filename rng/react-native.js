import {randomBytes} from 'react-native-randombytes';

export const RNG = () => () => ({
  type : "rng",
  randomByte : () => randomBytes(1)[0]
})

export {RNG as default}
