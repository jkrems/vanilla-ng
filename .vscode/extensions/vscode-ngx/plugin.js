console.log('plugin file loaded');

function init(modules) {
  console.log('init called');

  /** @type {import("typescript/lib/tsserverlibrary")} */
  const ts = modules.typescript;

  /**
   * @param {tss.server.PluginCreateInfo} info 
   */
  function create(info) {
    console.log('create called');

    // Diagnostic logging
    info.project.projectService.logger.info(
      "I'm getting set up now! Check the log for this message."
    );

    // Set up decorator object
    const proxy = Object.create(null);
    for (let k of Object.keys(info.languageService)) {
      const x = info.languageService[k];
      proxy[k] = (...args) => x.apply(info.languageService, args);
    }

    // Remove specified entries from completion list
    proxy.getCompletionsAtPosition = (fileName, position, options) => {
      const prior = info.languageService.getCompletionsAtPosition(fileName, position, options);
      if (!prior) return;

      return prior;
    };

    return proxy;
  }

  return { create };
}

export default init;
