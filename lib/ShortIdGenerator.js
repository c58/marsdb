import Random from './Random';


/**
 * Generates a random short obhect id for given collection
 * @param  {String} modelName
 * @return {String}
 */
export default function(modelName) {
  const nextSeed = Random.default().hexString(20);
  const sequenceSeed = [nextSeed, `/collection/${modelName}`];
  return {
    value: Random.createWithSeeds.apply(null, sequenceSeed).id(17),
    seed: nextSeed,
  };
}
