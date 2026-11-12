const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

const MARKER = '# expo-gl SDK 58 R8 compatibility';
const RULES = `
${MARKER}
# GLView is created through reflection and does not extend ExpoView.
-keepclassmembers class expo.modules.gl.GLView {
  public <init>(android.content.Context, expo.modules.kotlin.AppContext);
}

# EXGLContextPrepare looks up flush() by name through JNI.
-keepclassmembers class expo.modules.gl.GLContext {
  public void flush();
}
`;

/** Keeps the two expo-gl members that R8 removes from SDK 58 Android release builds. */
module.exports = function withExpoGlAndroidR8(config) {
  return withDangerousMod(config, ['android', async (configWithAndroid) => {
    const rulesPath = path.join(configWithAndroid.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
    const actuel = fs.existsSync(rulesPath) ? fs.readFileSync(rulesPath, 'utf8') : '';
    if (!actuel.includes(MARKER)) fs.writeFileSync(rulesPath, `${actuel.trimEnd()}\n${RULES}`);
    return configWithAndroid;
  }]);
};
