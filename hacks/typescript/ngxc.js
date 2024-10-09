import * as ts from "typescript";
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
import { TypeScriptEmitterVisitor } from "../ng/ts-emitter.js";

/**
 * @param {string} fileName
 * @param {string} sourceText
 */
export function stripTSX(fileName, sourceText) {
  const src = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TSX
  );

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
            // ctx_r0
            /^ctx(_r[\d]+)?$/.test(node.expression.escapedText)
          ) {
            return node.name;
          }
          break;
      }
      return ts.visitEachChild(node, visitor, context);
    }

    return ts.visitNode(tplNode, visitor);
  }

  function patchDefComponentCall(originalNode) {
    let templateNode;

    function visitor(node, context) {
      switch (node.kind) {
        case ts.SyntaxKind.PropertyAssignment:
          if (
            ts.isPropertyAssignment(node) &&
            node.name.escapedText === "template"
          ) {
            templateNode = cleanUpTemplate(node.initializer);
            const newInit = ts.factory.createFunctionExpression(
              undefined,
              undefined,
              undefined,
              undefined,
              [
                ts.factory.createParameterDeclaration(
                  undefined,
                  undefined,
                  "ref"
                ),
                ts.factory.createParameterDeclaration(
                  undefined,
                  undefined,
                  "ctx"
                ),
              ],
              undefined,
              ts.factory.createBlock([
                ts.factory.createExpressionStatement(
                  ts.factory.createCallExpression(
                    ts.factory.createParenthesizedExpression(
                      ts.factory.createCommaListExpression([
                        ts.factory.createNumericLiteral(0),
                        ts.factory.createPropertyAccessExpression(
                          ts.factory.createIdentifier("ctx"),
                          ts.factory.createIdentifier("ɵɵtemplate")
                        ),
                      ])
                    ),
                    undefined,
                    [ts.factory.createIdentifier("ref")]
                  )
                ),
              ])
            );
            return ts.factory.updatePropertyAssignment(
              node,
              node.name,
              newInit
            );
          }
          break;
      }
      return ts.visitEachChild(node, visitor, context);
    }

    const defNode = ts.visitNode(originalNode, visitor);
    return { defNode, templateNode };
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
        const defNode = metaByFunction.get(node);
        return [
          transformed,
          ts.factory.createExpressionStatement(
            ts.factory.createAssignment(
              ts.factory.createPropertyAccessExpression(
                transformed.name,
                "ɵcmp"
              ),
              defNode
            )
          ),
          ts.factory.createExpressionStatement(
            ts.factory.createAssignment(
              ts.factory.createPropertyAccessExpression(
                transformed.name,
                "ɵfac"
              ),
              ts.factory.createArrowFunction(
                undefined,
                undefined,
                [],
                undefined,
                undefined,
                ts.factory.createCallExpression(transformed.name, undefined, [
                  ts.factory.createObjectLiteralExpression(),
                ])
              )
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

        const firstParam = ts.isFunctionDeclaration(compFn)
          ? compFn.parameters[0]
          : undefined;
        const inputs = new Map();
        if (
          ts.isParameter(firstParam) &&
          ts.isObjectBindingPattern(firstParam.name)
        ) {
          for (const el of firstParam.name.elements) {
            const bindingName = el.name;
            const propName = el.propertyName || bindingName;
            if (!ts.isIdentifier(propName) || !ts.isIdentifier(bindingName)) {
              // TODO: Support renaming..?
              // e.g. {x: y = 20}
              throw new Error(
                `Expected identifier but got ${ts.SyntaxKind[el.name.kind]}`
              );
            }
            if (
              !el.initializer ||
              !ts.isCallExpression(el.initializer) ||
              !ts.isIdentifier(el.initializer.expression)
            ) {
              throw new Error(
                `Not sure how to handle param ${propName.escapedText}`
              );
            }

            const propKey = propName.escapedText;
            const propType = el.initializer.expression.escapedText;

            switch (propType) {
              case "input":
                inputs.set(propKey, bindingName.escapedText);
                break;

              default:
                throw new Error(
                  `Not sure how to handle param ${propName.escapedText}`
                );
            }
          }
        }

        const tplText = src.text.slice(
          jsxNode.openingElement.end,
          jsxNode.closingElement.pos
        );
        const selector = jsxNode.openingElement.tagName.escapedText;
        const patchedTplText = tplText
          .replace(/on:([a-z]+)=\{([^}]+)\}/g, '($1)="$2"')
          .replace(/style:([\w-]+)=\{([^}]+)\}/g, '[style.$1]="$2"')
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
          inputs: Object.fromEntries(
            Array.from(inputs.keys(), (inputName) => {
              return [
                inputName,
                {
                  classPropertyName: inputName,
                  bindingPropertyName: inputName,
                  required: false, // ?
                  isSignal: true, // ?
                  transformFunction: null,
                },
              ];
            })
          ),
          declarationListEmitMode: 0 /* Direct */,
          declarations,
          outputs: {},
          exportAs: [],
          lifecycle: {},
          isStandalone: true,
          isSignal: false,
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

        const tsVisitor = new TypeScriptEmitterVisitor(
          new ExternalReferenceResolver()
        );
        const originalDefNode = res.expression.visitExpression(tsVisitor);
        const { defNode, templateNode } =
          patchDefComponentCall(originalDefNode);
        metaByFunction.set(compFn, defNode);

        const visitor = new JitEmitterVisitor(new ExternalReferenceResolver());
        const visitorContext = new EmitterVisitorContext(0);
        // Find template function in returned expression.
        const templateFnExpr = [
          ...[...res.expression.args.entries()][0].entries(),
        ][1][1].entries.find((entry) => entry.key === "template").value;
        visitor.visitFunctionExpr(templateFnExpr, visitorContext);

        const fullDefContext = new EmitterVisitorContext(0);
        visitor.visitAllExpressions([res.expression], fullDefContext);

        const tplStatements = tsVisitor
          .visitAllStatements(constantPool.statements)
          .map((stmt) => cleanUpTemplate(stmt));
        // Replace with new return value.
        return [
          ...tplStatements,
          ts.factory.createReturnStatement(
            ts.factory.createObjectLiteralExpression([
              ts.factory.createPropertyAssignment("ɵɵtemplate", templateNode),
              ...Array.from(inputs, ([inputProp, inputBinding]) => {
                return ts.factory.createPropertyAssignment(
                  inputProp,
                  ts.factory.createIdentifier(inputBinding)
                );
              }),
            ])
          ),
        ];
      }
    }

    return ts.visitEachChild(node, visitor, context);
  }

  const newSrc = ts.visitNode(src, visitor);
  const printer = ts.createPrinter();
  return printer.printFile(newSrc);
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
