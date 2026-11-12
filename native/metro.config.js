// Configuration Metro (bundler d'Expo) : le modèle 3D de l'athlète (.glb) doit rester accessible.
// Le .glb est le seul modèle de l'athlète.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('glb');

module.exports = config;
