const { withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = function withLlamaGradle(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error(
        "Cannot add Llama.rn maven repository because the project build.gradle is not groovy"
      );
    }

    const jitpackMaven = "maven { url 'https://www.jitpack.io' }";

    // Add the JitPack repository if it's not already there.
    if (!config.modResults.contents.includes("jitpack.io")) {
      // Use a more robust method to add the repository to the allprojects.repositories block
      config.modResults.contents = config.modResults.contents.replace(
        /allprojects\s*\{\s*repositories\s*\{/,
        `allprojects {
    repositories {
        ${jitpackMaven}`
      );
    }

    return config;
  });
};