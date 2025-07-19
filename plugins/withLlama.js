const { withProjectBuildGradle, withMainApplication } = require('@expo/config-plugins');

const withLlamaBuildGradle = (config) => {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error("Cannot add Llama.rn maven repository because the project build.gradle is not groovy");
    }
    const jitpackMaven = "maven { url 'https://www.jitpack.io' }";
    if (!config.modResults.contents.includes("jitpack.io")) {
      // Add JitPack repository after mavenCentral()
      config.modResults.contents = config.modResults.contents.replace(
        'mavenCentral()',
        `mavenCentral()\n        ${jitpackMaven}`
      );
    }
    return config;
  });
};

const withLlamaPackage = (config) => {
  return withMainApplication(config, (config) => {
    if (config.modResults.language !== 'kt') {
      throw new Error("Cannot add RNLlamaPackage because MainApplication is not Kotlin");
    }
    
    const { contents } = config.modResults;
    let newContents = contents;

    // Add the import statement if it doesn't exist
    if (!newContents.includes('import com.rnllama.RNLlamaPackage')) {
      newContents = newContents.replace(
        'import com.facebook.react.PackageList',
        'import com.facebook.react.PackageList\nimport com.rnllama.RNLlamaPackage'
      );
    }

    // Add the package to the list if it doesn't exist
    if (!newContents.includes('packages.add(RNLlamaPackage())')) {
      newContents = newContents.replace(
        'return packages',
        'packages.add(RNLlamaPackage())\n            return packages'
      );
    }

    config.modResults.contents = newContents;
    return config;
  });
};

module.exports = (config) => {
  config = withLlamaBuildGradle(config);
  config = withLlamaPackage(config);
  return config;
};
