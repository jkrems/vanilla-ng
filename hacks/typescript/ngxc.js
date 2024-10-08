import ts from "typescript";
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

import { JitEmitterVisitor } from "../ng/template-compiler.js";

const program = ts.createProgram(
  [import.meta.dirname + "/example/my-comp.ng.tsx"],
  {
    strict: true,
    types: [],
  },
  ts.createCompilerHost({}, true)
);

for (const src of program.getSourceFiles()) {
  if (!src.fileName.endsWith(".ng.tsx")) {
    continue;
  }

  function findEnclosingFunction(node) {
    while (node.parent) {
      node = node.parent;
      if (node.kind === ts.SyntaxKind.FunctionDeclaration) {
        return node;
      }
    }
    throw new Error("Could not find surrounding function declaration");
  }

  const coreImports = new Set();
  class ExternalReferenceResolver {
    resolveExternalReference(ref) {
      if (ref.moduleName !== "@angular/core") {
        throw new Error(`Unexpected import ${ref.name} from ${ref.moduleName}`);
      }
      coreImports.add(ref.name);
      return ref.name;
    }
  }

  function cleanUpTemplate(tplNode) {
    function visitor(node, context) {
      switch (node.kind) {
        case ts.SyntaxKind.PropertyAccessExpression:
          if (
            ts.isPropertyAccessExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.escapedText === "ctx"
          ) {
            return node.name;
          }
          break;
      }
      return ts.visitEachChild(node, visitor, context);
    }

    return ts.visitNode(tplNode, visitor);
  }

  const metaByFunction = new Map();

  /** @param {ts.Node} node */
  function visitor(node, context) {
    switch (node.kind) {
      case ts.SyntaxKind.SourceFile: {
        const patched = ts.visitEachChild(node, visitor, context);
        if (coreImports.size) {
          return ts.factory.updateSourceFile(patched, [
            ts.factory.createImportDeclaration(
              undefined,
              ts.factory.createImportClause(
                false,
                undefined,
                ts.factory.createNamedImports(
                  Array.from(coreImports, (name) =>
                    ts.factory.createImportSpecifier(
                      false,
                      undefined,
                      ts.factory.createIdentifier(name)
                    )
                  )
                )
              ),
              ts.factory.createStringLiteral("@angular/core")
            ),
            ...patched.statements,
          ]);
        }
        return patched;
      }

      case ts.SyntaxKind.FunctionDeclaration: {
        if (!ts.isSourceFile(node.parent)) {
          break;
        }
        if (!/^[A-Z]/.test(node.name.escapedText)) {
          break;
        }
        const transformed = ts.visitEachChild(node, visitor, context);
        const meta = metaByFunction.get(node);
        coreImports.add("ɵɵdefineComponent");
        return [
          transformed,
          ts.factory.createExpressionStatement(
            ts.factory.createAssignment(
              ts.factory.createPropertyAccessExpression(
                transformed.name,
                "ɵcmp"
              ),
              ts.factory.createCallExpression(
                ts.factory.createIdentifier("ɵɵdefineComponent"),
                undefined,
                [
                  // TODO: Use proper AST-ish things here instead of hand-writing.
                  ts.factory.createObjectLiteralExpression(
                    [
                      ts.factory.createPropertyAssignment(
                        "type",
                        transformed.name
                      ),
                      ts.factory.createPropertyAssignment(
                        "selectors",
                        ts.factory.createArrayLiteralExpression([
                          ts.factory.createArrayLiteralExpression([
                            ts.factory.createStringLiteral(meta.selector),
                          ]),
                        ])
                      ),
                      ts.factory.createPropertyAssignment(
                        "exportAs",
                        ts.factory.createArrayLiteralExpression([])
                      ),
                      ts.factory.createPropertyAssignment(
                        "template",
                        ts.factory.createArrowFunction(
                          undefined,
                          undefined,
                          [
                            ts.factory.createParameterDeclaration(
                              undefined,
                              undefined,
                              ts.factory.createIdentifier("rf")
                            ),
                            ts.factory.createParameterDeclaration(
                              undefined,
                              undefined,
                              ts.factory.createIdentifier("ctx")
                            ),
                          ],
                          undefined,
                          undefined,
                          ts.factory.createCallExpression(ts.factory.createIdentifier('ctx'), undefined, [ts.factory.createIdentifier('rf')])
                        )
                      ),
                      /*
ɵɵdefineComponent({type:MyComp,
selectors:[['my-comp']],exportAs:[],standalone:true,
    signals:true,features:[ɵɵStandaloneFeature],decls:5,vars:2,consts:[[3,'click']],
    template:function MyComp_Template(rf,ctx) {
      if ((rf & 1)) {
        ɵɵtemplate(0,MyComp_Conditional_0_Template,2,0,'p');
        ɵɵelementStart(1,'h1');
        ɵɵtext(2);
        ɵɵelementEnd();
        ɵɵelementStart(3,'button',0);
        ɵɵlistener('click',function MyComp_Template_button_click_3_listener() {
          return ctx.inc;
        });
        ɵɵtext(4,'Increment');
        ɵɵelementEnd();
      }
      if ((rf & 2)) {
        ɵɵconditional(((ctx.count() > 20)? 0: -1));
        ɵɵadvance(2);
        ɵɵtextInterpolate(ctx.count());
      }
    },encapsulation:2})
*/
                    ],
                    true
                  ),
                ]
              )
            )
          ),
          ts.factory.createExpressionStatement(
            ts.factory.createAssignment(
              ts.factory.createPropertyAccessExpression(
                transformed.name,
                "ɵfac"
              ),
              transformed.name
            )
          ),
        ];
      }

      case ts.SyntaxKind.ReturnStatement: {
        const retNode = node;
        let jsxNode = retNode.expression;
        while (ts.isParenthesizedExpression(jsxNode)) {
          jsxNode = jsxNode.expression;
        }
        if (!ts.isJsxElement(jsxNode)) {
          return node;
        }
        const compFn = findEnclosingFunction(jsxNode);
        const className = compFn.name.escapedText;

        const tplText = src.text.slice(
          jsxNode.openingElement.end,
          jsxNode.closingElement.pos
        );
        const selector = jsxNode.openingElement.tagName.escapedText;
        const patchedTplText = tplText
          .replace(/on:([a-z]+)=\{([^}]+)\}/g, '($1)="$2"')
          .replace(/\{([^}\n]+)\}/g, "{{$1}}");
        const template = parseTemplate(patchedTplText);
        if (template.errors) {
          throw new Error(template.errors[0].msg);
        }

        const binder = new R3TargetBinder(new SelectorMatcher());
        const boundTarget = binder.bind({ template: template.nodes });
        const deferBlockDependencies = undefined;
        const typeNodeWrapped = new WrappedNodeExpr(className);
        const typeNode = { value: typeNodeWrapped, type: typeNodeWrapped };

        // TODO: Cleanly handle imports, including deduping.
        const declarations = [];

        const meta = {
          name: className,
          // This is likely the wrong path.
          relativeContextFilePath: src.fileName,
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
        metaByFunction.set(compFn, meta);

        const constantPool = new ConstantPool();
        const bindingParser = makeBindingParser(meta.interpolation);
        const res = compileComponentFromMetadata(
          meta,
          constantPool,
          bindingParser
        );

        const visitor = new JitEmitterVisitor(new ExternalReferenceResolver());
        const visitorContext = new EmitterVisitorContext(0);
        // Find template function in returned expression.
        const templateFnExpr = [
          ...[...res.expression.args.entries()][0].entries(),
        ][1][1].entries.find((entry) => entry.key === "template").value;
        visitor.visitFunctionExpr(templateFnExpr, visitorContext);

        const fullDefContext = new EmitterVisitorContext(0);
        visitor.visitAllExpressions([res.expression], fullDefContext);

        const constantVisitorContext = new EmitterVisitorContext(0);
        visitor.visitAllStatements(
          constantPool.statements,
          constantVisitorContext
        );
        const tplSrc = cleanUpTemplate(
          ts.createSourceFile(
            "tpl.ts",
            `function ___() {
  ${constantVisitorContext.toSource()}

  return ${visitorContext.toSource()};
}`
          )
        );
        // Replace with new return value.
        return tplSrc.statements[tplSrc.statements.length - 1].body.statements;
      }
    }

    return ts.visitEachChild(node, visitor, context);
  }

  const newSrc = ts.visitNode(src, visitor);
  const printer = ts.createPrinter();
  console.error(printer.printFile(newSrc));
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
