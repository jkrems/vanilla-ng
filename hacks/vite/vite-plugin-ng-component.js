const shortFileRegex = /\.component$/;
const fileRegex = /\.component\.html\?ng-component$/;

export default function ngComponent() {
  return {
    name: 'ng-component',

    resolveId: {
      order: 'pre',
      async handler(source, importer, options) {
        // Redirect component imports to the implementation template.
        if (shortFileRegex.test(source)) {
          const resolution = await this.resolve(`${source}.html`, importer, options);
          if (!resolution || resolution.external) {
            return resolution;
          }
          return `${resolution.id}?ng-component`;
        }
        return null;
      },
    },

    transform(code, id) {
      if (fileRegex.test(id)) {
        const scriptId = id.replace(fileRegex, '.component.ts');
        // TODO: Detect the correct class name.
        const className = 'AppComponent';
        // TODO: Compile template properly.
        return `
import {
  ɵɵdefineComponent,
  ɵɵStandaloneFeature,

  ɵɵelementStart,
  ɵɵelementEnd,
  ɵɵtext,
} from '@angular/core';

import {${className}} from ${JSON.stringify(scriptId)};
${className}.ɵcmp = ɵɵdefineComponent({
  type: ${className},
  selectors: [["app-root"]],
  standalone: true,
  features: [ɵɵStandaloneFeature],
  decls: 2,
  vars: 0,
  consts: [],
  template: function TestCmp_Template(rf, ctx) {
    if (rf & 1) {
      ɵɵelementStart(0, "h1");
      ɵɵtext(1, "Hello");
      ɵɵelementEnd();
    }
  },
});
${className}.ɵfac = function ${className}_Factory(__ngFactoryType__) {
  return new (__ngFactoryType__ || ${className})();
};

console.log(${className});
console.log(${className}.ɵcmp);

export * from ${JSON.stringify(scriptId)};

console.log(${JSON.stringify(code)});
`;
      }
    },
  };
}
