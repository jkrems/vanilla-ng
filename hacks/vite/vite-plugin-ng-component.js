import {
  parseTemplate,
  ConstantPool,
  makeBindingParser,
  SelectorMatcher,
  DEFAULT_INTERPOLATION_CONFIG,
  compileComponentFromMetadata,
  R3TargetBinder,
  WrappedNodeExpr,
  EmitterVisitorContext,
} from "@angular/compiler";
import { ViewEncapsulation } from "@angular/core";
import {readFile} from 'node:fs/promises';

import { JitEmitterVisitor } from "../ng/template-compiler.js";

const shortFileRegex = /\.(component|ng)$/;
const fileRegex = /\.(component|ng)\.html\?ng-component$/;

export default function ngComponent() {
  return {
    name: "ng-component",

    resolveId: {
      order: "pre",
      async handler(source, importer, options) {
        // Redirect component imports to the implementation template.
        if (shortFileRegex.test(source)) {
          const resolution = await this.resolve(
            `${source}.html`,
            importer,
            options
          );
          if (!resolution || resolution.external) {
            return resolution;
          }
          return `${resolution.id}?ng-component`;
        }
        return null;
      },
    },

    async transform(code, id) {
      if (fileRegex.test(id)) {
        const scriptId = id.replace(fileRegex, ".$1.ts");
        // TODO: Find a cleaner way to handle metadata.
        const scriptSource = await readFile(scriptId, 'utf8');
        // export class MessageComponent
        const className = scriptSource.match(/^export class (\w+)/m)[1];
        // static selector = 'static-message';
        const selector = scriptSource.match(/^[ ]*static selector = ['"]([^'"]+)['"];/m)[1];

        const template = parseTemplate(code, id, {});
        if (template.errors) {
          throw new Error(template.errors[0].msg);
        }

        const binder = new R3TargetBinder(new SelectorMatcher());
        const boundTarget = binder.bind({ template: template.nodes });
        const deferBlockDependencies = undefined;
        const typeNodeWrapped = new WrappedNodeExpr(className);
        const typeNode = { value: typeNodeWrapped, type: typeNodeWrapped };

        const coreImports = new Set();
        class ExternalReferenceResolver {
          resolveExternalReference(ref) {
            if (ref.moduleName !== "@angular/core") {
              throw new Error(
                `Unexpected import ${ref.name} from ${ref.moduleName}`
              );
            }
            coreImports.add(ref.name);
            return ref.name;
          }
        }

        // TODO: Cleanly handle imports, including deduping.
        const declarations = className === 'AppComponent' ?
          [{
            type: new WrappedNodeExpr('MessageComponent'),
            moduleName: './message.component',
          }] : [];

        const meta = {
          name: className,
          // This is likely the wrong path.
          relativeContextFilePath: scriptId,
          template,
          interpolation: DEFAULT_INTERPOLATION_CONFIG,
          defer: createR3ComponentDeferMetadata(
            boundTarget,
            deferBlockDependencies
          ),
          type: typeNode,
          queries: [],
          viewQueries: [],
          host: {
            properties: [],
            listeners: {},
            attributes: {},
            specialAttributes: {},
          },
          inputs: {},
          declarationListEmitMode: 0 /* Direct */,
          declarations,
          outputs: {},
          exportAs: [],
          lifecycle: {},
          isStandalone: true,
          isSignal: true,
          selector,
          animations: null,
          encapsulation: ViewEncapsulation.Emulated,
        };
        const constantPool = new ConstantPool();
        const bindingParser = makeBindingParser(meta.interpolation);
        const res = compileComponentFromMetadata(
          meta,
          constantPool,
          bindingParser
        );

        const visitor = new JitEmitterVisitor(new ExternalReferenceResolver());
        const visitorContext = new EmitterVisitorContext(0);
        visitor.visitAllExpressions([res.expression], visitorContext);
        visitor.visitAllStatements(res.statements, visitorContext);

        const constantVisitorContext = new EmitterVisitorContext(0);
        visitor.visitAllStatements(constantPool.statements, constantVisitorContext);

        // TODO: Compile template properly.
        return `
import { ${[...coreImports].join(", ")} } from '@angular/core';
${declarations.map(decl => `import {${decl.type.node}} from '${decl.moduleName}';`).join('\n')}

import {${className}} from ${JSON.stringify(scriptId)};

${constantVisitorContext.toSource()}

${className}.ɵcmp = ${visitorContext.toSource()};
${className}.ɵfac = () => new ${className}();

export * from ${JSON.stringify(scriptId)};
`;
      }
    },
  };
}

function createR3ComponentDeferMetadata(boundTarget, deferBlockDependencies) {
  const deferredBlocks = boundTarget.getDeferBlocks();
  const blocks = new Map();

  for (let i = 0; i < deferredBlocks.length; i++) {
    const dependencyFn = deferBlockDependencies?.[i];
    blocks.set(
      deferredBlocks[i],
      dependencyFn ? new WrappedNodeExpr(dependencyFn) : null
    );
  }

  return { mode: 0 /* DeferBlockDepsEmitMode.PerBlock */, blocks };
}
