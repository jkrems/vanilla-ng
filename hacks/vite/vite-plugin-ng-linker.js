import { readFile } from "node:fs/promises";
import { createEs2015LinkerPlugin } from "@angular/compiler-cli/linker/babel";
import { transformAsync } from "@babel/core";
import * as path from "node:path";
import * as fs from "node:fs";

// Angular distributes files that don't work out-of-the-box.
// We need to transform all Angular packages to have valid AOT code.
export default function ngLinker() {
  return {
    name: "ng-linker",

    config(config) {
      config.optimizeDeps ||= {};
      config.optimizeDeps.esbuildOptions ||= {};
      config.optimizeDeps.esbuildOptions.plugins ||= [];
      config.optimizeDeps.esbuildOptions.plugins.push({
        name: "ng-linker",

        setup(build) {
          build.onLoad({ filter: /\.[cm]?js$/ }, async (args) => {
            if (args.path && /\/@angular\//.test(args.path)) {
              const code = await readFile(args.path, "utf8");
              return {
                contents: (await transformAsync(code, {
                  filename: args.path,
                  compact: true,
                  babelrc: false,
                  browserslistConfigFile: false,
                  plugins: [createEs2015LinkerPlugin({
                    linkerJitMode: false,
                    sourceMapping: false,
                    logger: {level: 1, ...console },
                    fileSystem: {
                      resolve: path.resolve,
                      exists: fs.existsSync,
                      dirname: path.dirname,
                      relative: path.relative,
                      readFile: fs.readFileSync,
                    },
                  })],
                })).code,
                loader: "js",
              };
            }

            return null;
          });
        },
      });
    },
  };
}
