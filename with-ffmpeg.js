const { withDangerousMod, withProjectBuildGradle } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

// iOS Plugin: Points Pods to the active community-hosted spec
function withIosFfmpeg(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, "Podfile");
      if (fs.existsSync(podfilePath)) {
        let contents = fs.readFileSync(podfilePath, "utf8");
        const customPod = `pod 'shaquillehinds-ffmpeg-kit-ios', :podspec => 'https://raw.githubusercontent.com/shaquillehinds/ffmpeg/master/shaquillehinds-ffmpeg-kit-ios.podspec'`;
        if (!contents.includes("shaquillehinds-ffmpeg-kit-ios")) {
          // Injects the custom spec right below use_react_native!
          contents = contents.replace(
            "use_react_native!",
            `use_react_native!\n  ${customPod}`
          );
          fs.writeFileSync(podfilePath, contents, "utf8");
        }
      }
      return config;
    },
  ]);
}

// Android Plugin: Directs gradle to resolve working 16KB-compatible AAR binaries from Maven Central
function withAndroidFfmpeg(config) {
  return withProjectBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    const resolutionBlock = `
allprojects {
    configurations.all {
        resolutionStrategy.eachDependency { details ->
            if (details.requested.group == 'com.arthenica' && details.requested.name.startsWith('ffmpeg-kit')) {
                details.useTarget('com.moizhassan.ffmpeg:ffmpeg-kit-16kb:6.1.1')
                details.because('Substitute retired Arthenica binaries with 16KB-aligned Maven Central fork')
            }
        }
    }
}
`;

    if (!contents.includes("com.moizhassan.ffmpeg:ffmpeg-kit-16kb")) {
      contents = contents + "\n" + resolutionBlock;
      config.modResults.contents = contents;
    }
    return config;
  });
}

module.exports = function withFfmpegPlugin(config) {
  return withAndroidFfmpeg(withIosFfmpeg(config));
};
