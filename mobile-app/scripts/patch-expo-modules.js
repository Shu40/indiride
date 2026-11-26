const fs = require('fs');
const path = require('path');

const targetPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-modules-core',
  'src',
  'registerWebModule.ts'
);

if (fs.existsSync(targetPath)) {
  const content = fs.readFileSync(targetPath, 'utf8');
  if (content.includes("throw new Error('Module implementation must be a class')")) {
    console.log('[patch-expo-modules] Applying registerWebModule class fix...');
    const fixed = content.replace(
      /if \(!moduleImplementation\.name\) \{[\s\S]*?throw new Error\('Module implementation must be a class'\);[\s\S]*?\}/,
      `const moduleName = optionalName || moduleImplementation?.name || 'ExpoFontLoader';
  if (!globalThis?.expo?.modules) {
    globalThis.expo.modules = {};
  }
  if (globalThis.expo.modules[moduleName]) {
    return globalThis.expo.modules[moduleName];
  }
  try {
    globalThis.expo.modules[moduleName] = new (moduleImplementation as any)();
  } catch {
    globalThis.expo.modules[moduleName] = typeof moduleImplementation === 'function' ? (moduleImplementation as any)() : moduleImplementation;
  }
  return globalThis.expo.modules[moduleName];`
    );
    fs.writeFileSync(targetPath, fixed, 'utf8');
    console.log('[patch-expo-modules] Successfully patched registerWebModule.ts');
  } else {
    console.log('[patch-expo-modules] registerWebModule.ts already patched.');
  }
} else {
  console.log('[patch-expo-modules] expo-modules-core not found, skipping patch.');
}
