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

  const compImports = new Set();
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

  /**
   *
   * @param {*} tplNode
   * @returns
   */
  function cleanUpTemplate(tplNode) {
    function visitor(node, context) {
      switch (node.kind) {
        case ts.SyntaxKind.PropertyAccessExpression: {
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

        // ɵɵelementStart(0, "MatButton", 0);
        case ts.SyntaxKind.CallExpression: {
          if (
            !ts.isCallExpression(node) ||
            !ts.isIdentifier(node.expression) ||
            !["ɵɵelementStart", "ɵɵelement"].includes(
              node.expression.escapedText
            ) ||
            !ts.isLiteralExpression(node.arguments[0]) ||
            !ts.isLiteralExpression(node.arguments[1])
          ) {
            break;
          }
          const tagName = node.arguments[1].text;

          if (!/[A-Z]/.test(tagName)) {
            break;
          }
          coreImports.add("ɵɵselectorTag");
          compImports.add(tagName);
          return ts.factory.updateCallExpression(
            node,
            node.expression,
            node.typeArguments,
            [
              node.arguments[0],
              ts.factory.createCallExpression(
                ts.factory.createIdentifier("ɵɵselectorTag"),
                undefined,
                [ts.factory.createIdentifier(tagName)]
              ),
              ...node.arguments.slice(2),
            ]
          );
        }
      }
      return ts.visitEachChild(node, visitor, context);
    }

    return ts.visitNode(tplNode, visitor);
  }

  /**
   *
   * @param {ts.CallExpression} originalNode
   * @param {ts.FunctionDeclaration} compFnNode
   * @returns
   */
  function patchDefComponentCall(originalNode, compFnNode) {
    let templateNode;
    let decls = null;
    let vars = null;

    let updatedCompImports = false;

    function visitor(node, context) {
      switch (node.kind) {
        case ts.SyntaxKind.ObjectLiteralExpression: {
          const patched = ts.visitEachChild(node, visitor, context);
          if (!updatedCompImports && compImports.size) {
            return ts.factory.updateObjectLiteralExpression(node, [
              ...patched.properties,
              ts.factory.createPropertyAssignment(
                "dependencies",
                ts.factory.createArrayLiteralExpression(
                  Array.from(compImports, (compImport) =>
                    ts.factory.createIdentifier(compImport)
                  )
                )
              ),
            ]);
          }
          return patched;
        }

        case ts.SyntaxKind.PropertyAssignment:
          if (!ts.isPropertyAssignment(node)) break;

          if (node.name.escapedText === "decls") {
            decls = +node.initializer.text;
            return ts.factory.updatePropertyAssignment(
              node,
              node.name,
              ts.factory.createNumericLiteral(1)
            );
          } else if (node.name.escapedText === "vars") {
            vars = +node.initializer.text;
            return ts.factory.updatePropertyAssignment(
              node,
              node.name,
              ts.factory.createNumericLiteral(1)
            );
          } else if (node.name.escapedText === "dependencies") {
            updatedCompImports = true;
            return ts.factory.updatePropertyAssignment(
              node,
              node.name,
              ts.factory.createArrayLiteralExpression([
                ...node.initializer.elements,
                ...Array.from(compImports, (compImport) =>
                  ts.factory.createIdentifier(compImport)
                ),
              ])
            );
          } else if (node.name.escapedText === "type") {
            const oldValue = node.initializer;
            coreImports.add("inject");
            coreImports.add("Injector");
            coreImports.add("runInInjectionContext");

            const firstParam = compFnNode.parameters?.[0];
            const typeNode = ts.factory.createObjectLiteralExpression(
              [
                ts.factory.createPropertyAssignment(
                  "ɵfac",
                  ts.factory.createArrowFunction(
                    undefined,
                    undefined,
                    [],
                    undefined,
                    undefined,
                    ts.factory.createBlock(
                      [
                        ts.factory.createVariableStatement(undefined, [
                          ts.factory.createVariableDeclaration(
                            "ctx",
                            undefined,
                            undefined,
                            ts.factory.createObjectLiteralExpression(
                              [
                                // ɵɵinjector: inject(EnvironmentInjector),
                                ts.factory.createPropertyAssignment(
                                  "ɵɵinjector",
                                  ts.factory.createCallExpression(
                                    ts.factory.createIdentifier("inject"),
                                    undefined,
                                    [
                                      ts.factory.createIdentifier(
                                        "Injector"
                                      ),
                                    ]
                                  )
                                ),
                                // ɵɵtemplateImpl: (rf) => { throw new Error("Template impl called before init"); },
                                ts.factory.createPropertyAssignment(
                                  "ɵɵtemplateImpl",
                                  ts.factory.createArrowFunction(
                                    undefined,
                                    undefined,
                                    [],
                                    undefined,
                                    undefined,
                                    ts.factory.createBlock([
                                      ts.factory.createThrowStatement(
                                        ts.factory.createNewExpression(
                                          ts.factory.createIdentifier("Error"),
                                          undefined,
                                          [
                                            ts.factory.createStringLiteral(
                                              "Template impl called before init"
                                            ),
                                          ]
                                        )
                                      ),
                                    ])
                                  )
                                ),
                                // ɵɵtemplate: (rf) => { ctx.ɵɵtemplateImpl(rf); },
                                ts.factory.createPropertyAssignment(
                                  "ɵɵtemplate",
                                  ts.factory.createArrowFunction(
                                    undefined,
                                    undefined,
                                    [
                                      ts.factory.createParameterDeclaration(
                                        undefined,
                                        undefined,
                                        "rf"
                                      ),
                                    ],
                                    undefined,
                                    undefined,
                                    ts.factory.createBlock([
                                      ts.factory.createExpressionStatement(
                                        ts.factory.createCallExpression(
                                          ts.factory.createPropertyAccessExpression(
                                            ts.factory.createIdentifier("ctx"),
                                            "ɵɵtemplateImpl"
                                          ),
                                          undefined,
                                          [ts.factory.createIdentifier("rf")]
                                        )
                                      ),
                                    ])
                                  )
                                ),
                                // ɵɵinitialized: signal(false),
                                ts.factory.createPropertyAssignment(
                                  "ɵɵinitialized",
                                  ts.factory.createCallExpression(
                                    ts.factory.createIdentifier("signal"),
                                    undefined,
                                    [ts.factory.createIdentifier("false")]
                                  )
                                ),
                                // ...(({}) => ({}))({})
                                ts.factory.createSpreadAssignment(
                                  ts.factory.createCallExpression(
                                    ts.factory.createParenthesizedExpression(
                                      ts.factory.createArrowFunction(
                                        undefined,
                                        undefined,
                                        compFnNode.parameters,
                                        undefined,
                                        undefined,
                                        ts.factory.createParenthesizedExpression(
                                          ts.factory.createObjectLiteralExpression(
                                            ts.isObjectBindingPattern(
                                              firstParam?.name
                                            )
                                              ? firstParam.name.elements.map(
                                                  (param) => {
                                                    const bindingName =
                                                      param.name;
                                                    const propName =
                                                      param.propertyName ||
                                                      param.name;
                                                    return ts.factory.createPropertyAssignment(
                                                      propName,
                                                      bindingName
                                                    );
                                                  }
                                                )
                                              : []
                                          )
                                        )
                                      )
                                    ),
                                    undefined,
                                    [ts.factory.createObjectLiteralExpression()]
                                  )
                                ),
                              ],
                              true
                            )
                          ),
                        ]),
                        ts.factory.createReturnStatement(
                          ts.factory.createIdentifier("ctx")
                        ),
                      ],
                      true
                    )
                  )
                ),
                ts.factory.createPropertyAssignment(
                  "prototype",
                  ts.factory.createObjectLiteralExpression(
                    [
                      ts.factory.createPropertyAssignment(
                        "ngOnInit",
                        ts.factory.createFunctionExpression(
                          undefined,
                          undefined,
                          "ngOnInit",
                          undefined,
                          [],
                          undefined,
                          ts.factory.createBlock(
                            [
                              // const instance = runInInjectionContext(this.ɵɵinjector, () => Comp(this);
                              ts.factory.createVariableStatement(undefined, [
                                ts.factory.createVariableDeclaration(
                                  "instance",
                                  undefined,
                                  undefined,
                                  ts.factory.createCallExpression(
                                    ts.factory.createIdentifier(
                                      "runInInjectionContext"
                                    ),
                                    undefined,
                                    [
                                      ts.factory.createPropertyAccessExpression(
                                        ts.factory.createIdentifier("this"),
                                        "ɵɵinjector"
                                      ),
                                      ts.factory.createArrowFunction(
                                        undefined,
                                        undefined,
                                        [],
                                        undefined,
                                        undefined,
                                        ts.factory.createCallExpression(
                                          oldValue,
                                          undefined,
                                          [ts.factory.createIdentifier("this")]
                                        )
                                      ),
                                    ]
                                  )
                                ),
                              ]),
                              // this.ɵɵtemplateImpl = instance.ɵɵtemplate;
                              ts.factory.createExpressionStatement(
                                ts.factory.createAssignment(
                                  ts.factory.createPropertyAccessExpression(
                                    ts.factory.createIdentifier("this"),
                                    "ɵɵtemplateImpl"
                                  ),
                                  ts.factory.createPropertyAccessExpression(
                                    ts.factory.createIdentifier("instance"),
                                    "ɵɵtemplate"
                                  )
                                )
                              ),
                              // this.ɵɵinitialized.set(true);
                              ts.factory.createExpressionStatement(
                                ts.factory.createCallExpression(
                                  ts.factory.createPropertyAccessExpression(
                                    ts.factory.createPropertyAccessExpression(
                                      ts.factory.createIdentifier("this"),
                                      "ɵɵinitialized"
                                    ),
                                    "set"
                                  ),
                                  undefined,
                                  [ts.factory.createIdentifier("true")]
                                )
                              ),
                            ],
                            true
                          )
                        )
                      ),
                    ],
                    true
                  )
                ),
              ],
              true
            );
            return ts.factory.updatePropertyAssignment(
              node,
              node.name,
              typeNode
            );
          }
          if (node.name.escapedText === "template") {
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
                  "rf"
                ),
                ts.factory.createParameterDeclaration(
                  undefined,
                  undefined,
                  "ctx"
                ),
              ],
              undefined,
              ts.factory.createBlock(
                [
                  ts.factory.createIfStatement(
                    ts.factory.createBinaryExpression(
                      ts.factory.createIdentifier("rf"),
                      ts.SyntaxKind.AmpersandToken,
                      ts.factory.createNumericLiteral(1)
                    ),
                    ts.factory.createBlock(
                      [
                        ts.factory.createExpressionStatement(
                          ts.factory.createCallExpression(
                            ts.factory.createIdentifier("ɵɵtemplate"),
                            undefined,
                            [
                              ts.factory.createNumericLiteral(0),
                              ts.factory.createPropertyAccessExpression(
                                ts.factory.createIdentifier("ctx"),
                                "ɵɵtemplate"
                              ),
                              ts.factory.createNumericLiteral(decls),
                              ts.factory.createNumericLiteral(vars),
                            ]
                          )
                        ),
                      ],
                      true
                    )
                  ),
                  ts.factory.createIfStatement(
                    ts.factory.createBinaryExpression(
                      ts.factory.createIdentifier("rf"),
                      ts.SyntaxKind.AmpersandToken,
                      ts.factory.createNumericLiteral(2)
                    ),
                    ts.factory.createBlock(
                      [
                        // ɵɵconditional(ctx.ɵɵinitialized() ? 0 : -1);
                        ts.factory.createExpressionStatement(
                          ts.factory.createCallExpression(
                            ts.factory.createIdentifier("ɵɵconditional"),
                            undefined,
                            [
                              ts.factory.createConditionalExpression(
                                ts.factory.createCallExpression(
                                  ts.factory.createPropertyAccessExpression(
                                    ts.factory.createIdentifier("ctx"),
                                    "ɵɵinitialized"
                                  )
                                ),
                                undefined,
                                ts.factory.createNumericLiteral(0),
                                undefined,
                                ts.factory.createPrefixUnaryExpression(
                                  ts.SyntaxKind.MinusToken,
                                  ts.factory.createNumericLiteral(1)
                                )
                              ),
                            ]
                          )
                        ),
                      ],
                      true
                    )
                  ),
                ],
                true
              )
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
          const hasSelectorTagFn = coreImports.has("ɵɵselectorTag");
          coreImports.delete("ɵɵselectorTag");
          const stmts = [...patched.statements];
          if (coreImports.size) {
            stmts.unshift(
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
              )
            );
          }
          if (hasSelectorTagFn) {
            stmts.push(
              ts.factory.createFunctionDeclaration(
                undefined,
                undefined,
                "ɵɵselectorTag",
                undefined,
                [
                  ts.factory.createParameterDeclaration(
                    undefined,
                    undefined,
                    "C"
                  ),
                ],
                undefined,
                ts.factory.createBlock(
                  [
                    ts.factory.createReturnStatement(
                      ts.factory.createElementAccessExpression(
                        ts.factory.createElementAccessExpression(
                          ts.factory.createPropertyAccessExpression(
                            ts.factory.createPropertyAccessExpression(
                              ts.factory.createIdentifier("C"),
                              "ɵcmp"
                            ),
                            "selectors"
                          ),
                          0
                        ),
                        0
                      )
                    ),
                  ],
                  true
                )
              )
            );
          }
          return ts.factory.updateSourceFile(patched, stmts);
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
            if (!el.initializer || !ts.isCallExpression(el.initializer)) {
              throw new Error(
                `Not sure how to handle param ${propName.escapedText}`
              );
            }

            const propKey = propName.escapedText;
            const propType = sourceText
              .slice(
                el.initializer.expression.pos,
                el.initializer.expression.end
              )
              .trim();

            switch (propType) {
              case "input":
                inputs.set(propKey, {
                  binding: bindingName.escapedText,
                  required: false,
                });
                break;

              case "input.required":
                inputs.set(propKey, {
                  binding: bindingName.escapedText,
                  required: true,
                });
                break;

              default:
                throw new Error(
                  `Not sure how to handle param ${propName.escapedText} [${propType}]`
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
            Array.from(inputs, ([inputName, { required }]) => {
              return [
                inputName,
                {
                  classPropertyName: inputName,
                  bindingPropertyName: inputName,
                  required,
                  isSignal: true,
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
        const { defNode, templateNode } = patchDefComponentCall(
          originalDefNode,
          compFn,
          constantPool
        );
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
