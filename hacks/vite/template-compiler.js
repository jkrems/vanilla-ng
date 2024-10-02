import * as o from "@angular/compiler";

const _SINGLE_QUOTE_ESCAPE_STRING_RE = /'|\\|\n|\r|\$/g;
const _LEGAL_IDENTIFIER_RE = /^[$A-Z_][0-9A-Z_$]*$/i;

export class AbstractEmitterVisitor {
  _escapeDollarInStrings;

  constructor(_escapeDollarInStrings) {
    this._escapeDollarInStrings = _escapeDollarInStrings;
  }

  printLeadingComments(stmt, ctx) {
    if (stmt.leadingComments === undefined) {
      return;
    }
    for (const comment of stmt.leadingComments) {
      if (comment instanceof o.JSDocComment) {
        ctx.print(stmt, `/*${comment.toString()}*/`, comment.trailingNewline);
      } else {
        if (comment.multiline) {
          ctx.print(stmt, `/* ${comment.text} */`, comment.trailingNewline);
        } else {
          comment.text.split("\n").forEach((line) => {
            ctx.println(stmt, `// ${line}`);
          });
        }
      }
    }
  }

  visitExpressionStmt(stmt, ctx) {
    this.printLeadingComments(stmt, ctx);
    stmt.expr.visitExpression(this, ctx);
    ctx.println(stmt, ";");
    return null;
  }

  visitReturnStmt(stmt, ctx) {
    this.printLeadingComments(stmt, ctx);
    ctx.print(stmt, `return `);
    stmt.value.visitExpression(this, ctx);
    ctx.println(stmt, ";");
    return null;
  }

  visitIfStmt(stmt, ctx) {
    this.printLeadingComments(stmt, ctx);
    ctx.print(stmt, `if (`);
    stmt.condition.visitExpression(this, ctx);
    ctx.print(stmt, `) {`);
    const hasElseCase = stmt.falseCase != null && stmt.falseCase.length > 0;
    if (stmt.trueCase.length <= 1 && !hasElseCase) {
      ctx.print(stmt, ` `);
      this.visitAllStatements(stmt.trueCase, ctx);
      ctx.removeEmptyLastLine();
      ctx.print(stmt, ` `);
    } else {
      ctx.println();
      ctx.incIndent();
      this.visitAllStatements(stmt.trueCase, ctx);
      ctx.decIndent();
      if (hasElseCase) {
        ctx.println(stmt, `} else {`);
        ctx.incIndent();
        this.visitAllStatements(stmt.falseCase, ctx);
        ctx.decIndent();
      }
    }
    ctx.println(stmt, `}`);
    return null;
  }

  visitDeclareVarStmt(stmt, ctx) {
    throw new Error("Must be implemented in derived class");
  }

  visitWriteVarExpr(expr, ctx) {
    const lineWasEmpty = ctx.lineIsEmpty();
    if (!lineWasEmpty) {
      ctx.print(expr, "(");
    }
    ctx.print(expr, `${expr.name} = `);
    expr.value.visitExpression(this, ctx);
    if (!lineWasEmpty) {
      ctx.print(expr, ")");
    }
    return null;
  }
  visitWriteKeyExpr(expr, ctx) {
    const lineWasEmpty = ctx.lineIsEmpty();
    if (!lineWasEmpty) {
      ctx.print(expr, "(");
    }
    expr.receiver.visitExpression(this, ctx);
    ctx.print(expr, `[`);
    expr.index.visitExpression(this, ctx);
    ctx.print(expr, `] = `);
    expr.value.visitExpression(this, ctx);
    if (!lineWasEmpty) {
      ctx.print(expr, ")");
    }
    return null;
  }
  visitWritePropExpr(expr, ctx) {
    const lineWasEmpty = ctx.lineIsEmpty();
    if (!lineWasEmpty) {
      ctx.print(expr, "(");
    }
    expr.receiver.visitExpression(this, ctx);
    ctx.print(expr, `.${expr.name} = `);
    expr.value.visitExpression(this, ctx);
    if (!lineWasEmpty) {
      ctx.print(expr, ")");
    }
    return null;
  }

  visitInvokeFunctionExpr(expr, ctx) {
    const shouldParenthesize = expr.fn instanceof o.ArrowFunctionExpr;

    if (shouldParenthesize) {
      ctx.print(expr.fn, "(");
    }
    expr.fn.visitExpression(this, ctx);
    if (shouldParenthesize) {
      ctx.print(expr.fn, ")");
    }
    ctx.print(expr, `(`);
    this.visitAllExpressions(expr.args, ctx, ",");
    ctx.print(expr, `)`);
    return null;
  }
  visitTaggedTemplateExpr(expr, ctx) {
    expr.tag.visitExpression(this, ctx);
    ctx.print(expr, "`" + expr.template.elements[0].rawText);
    for (let i = 1; i < expr.template.elements.length; i++) {
      ctx.print(expr, "${");
      expr.template.expressions[i - 1].visitExpression(this, ctx);
      ctx.print(expr, `}${expr.template.elements[i].rawText}`);
    }
    ctx.print(expr, "`");
    return null;
  }
  visitWrappedNodeExpr(ast, ctx) {
    throw new Error("emitter cannot visit WrappedNodeExpr.");
  }
  visitTypeofExpr(expr, ctx) {
    ctx.print(expr, "typeof ");
    expr.expr.visitExpression(this, ctx);
  }
  visitReadVarExpr(ast, ctx) {
    ctx.print(ast, ast.name);
    return null;
  }
  visitInstantiateExpr(ast, ctx) {
    ctx.print(ast, `new `);
    ast.classExpr.visitExpression(this, ctx);
    ctx.print(ast, `(`);
    this.visitAllExpressions(ast.args, ctx, ",");
    ctx.print(ast, `)`);
    return null;
  }

  visitLiteralExpr(ast, ctx) {
    const value = ast.value;
    if (typeof value === "string") {
      ctx.print(ast, escapeIdentifier(value, this._escapeDollarInStrings));
    } else {
      ctx.print(ast, `${value}`);
    }
    return null;
  }

  visitLocalizedString(ast, ctx) {
    const head = ast.serializeI18nHead();
    ctx.print(ast, "$localize `" + head.raw);
    for (let i = 1; i < ast.messageParts.length; i++) {
      ctx.print(ast, "${");
      ast.expressions[i - 1].visitExpression(this, ctx);
      ctx.print(ast, `}${ast.serializeI18nTemplatePart(i).raw}`);
    }
    ctx.print(ast, "`");
    return null;
  }

  visitExternalExpr(ast, ctx) {
    throw new Error("Must be implemented in derived class");
  }

  visitConditionalExpr(ast, ctx) {
    ctx.print(ast, `(`);
    ast.condition.visitExpression(this, ctx);
    ctx.print(ast, "? ");
    ast.trueCase.visitExpression(this, ctx);
    ctx.print(ast, ": ");
    ast.falseCase.visitExpression(this, ctx);
    ctx.print(ast, `)`);
    return null;
  }

  visitDynamicImportExpr(ast, ctx) {
    ctx.print(ast, `import(${ast.url})`);
  }

  visitNotExpr(ast, ctx) {
    ctx.print(ast, "!");
    ast.condition.visitExpression(this, ctx);
    return null;
  }
  visitFunctionExpr(ast, ctx) {
    throw new Error("Must be implemented in derived class");
  }
  visitArrowFunctionExpr(ast, context) {
    throw new Error("Must be implemented in derived class");
  }
  visitDeclareFunctionStmt(stmt, context) {
    throw new Error("Must be implemented in derived class");
  }

  visitUnaryOperatorExpr(ast, ctx) {
    let opStr;
    switch (ast.operator) {
      case o.UnaryOperator.Plus:
        opStr = "+";
        break;
      case o.UnaryOperator.Minus:
        opStr = "-";
        break;
      default:
        throw new Error(`Unknown operator ${ast.operator}`);
    }
    if (ast.parens) ctx.print(ast, `(`);
    ctx.print(ast, opStr);
    ast.expr.visitExpression(this, ctx);
    if (ast.parens) ctx.print(ast, `)`);
    return null;
  }

  visitBinaryOperatorExpr(ast, ctx) {
    let opStr;
    switch (ast.operator) {
      case o.BinaryOperator.Equals:
        opStr = "==";
        break;
      case o.BinaryOperator.Identical:
        opStr = "===";
        break;
      case o.BinaryOperator.NotEquals:
        opStr = "!=";
        break;
      case o.BinaryOperator.NotIdentical:
        opStr = "!==";
        break;
      case o.BinaryOperator.And:
        opStr = "&&";
        break;
      case o.BinaryOperator.BitwiseOr:
        opStr = "|";
        break;
      case o.BinaryOperator.BitwiseAnd:
        opStr = "&";
        break;
      case o.BinaryOperator.Or:
        opStr = "||";
        break;
      case o.BinaryOperator.Plus:
        opStr = "+";
        break;
      case o.BinaryOperator.Minus:
        opStr = "-";
        break;
      case o.BinaryOperator.Divide:
        opStr = "/";
        break;
      case o.BinaryOperator.Multiply:
        opStr = "*";
        break;
      case o.BinaryOperator.Modulo:
        opStr = "%";
        break;
      case o.BinaryOperator.Lower:
        opStr = "<";
        break;
      case o.BinaryOperator.LowerEquals:
        opStr = "<=";
        break;
      case o.BinaryOperator.Bigger:
        opStr = ">";
        break;
      case o.BinaryOperator.BiggerEquals:
        opStr = ">=";
        break;
      case o.BinaryOperator.NullishCoalesce:
        opStr = "??";
        break;
      default:
        throw new Error(`Unknown operator ${ast.operator}`);
    }
    if (ast.parens) ctx.print(ast, `(`);
    ast.lhs.visitExpression(this, ctx);
    ctx.print(ast, ` ${opStr} `);
    ast.rhs.visitExpression(this, ctx);
    if (ast.parens) ctx.print(ast, `)`);
    return null;
  }

  visitReadPropExpr(ast, ctx) {
    ast.receiver.visitExpression(this, ctx);
    ctx.print(ast, `.`);
    ctx.print(ast, ast.name);
    return null;
  }
  visitReadKeyExpr(ast, ctx) {
    ast.receiver.visitExpression(this, ctx);
    ctx.print(ast, `[`);
    ast.index.visitExpression(this, ctx);
    ctx.print(ast, `]`);
    return null;
  }
  visitLiteralArrayExpr(ast, ctx) {
    ctx.print(ast, `[`);
    this.visitAllExpressions(ast.entries, ctx, ",");
    ctx.print(ast, `]`);
    return null;
  }
  visitLiteralMapExpr(ast, ctx) {
    ctx.print(ast, `{`);
    this.visitAllObjects(
      (entry) => {
        ctx.print(
          ast,
          `${escapeIdentifier(
            entry.key,
            this._escapeDollarInStrings,
            entry.quoted
          )}:`
        );
        entry.value.visitExpression(this, ctx);
      },
      ast.entries,
      ctx,
      ","
    );
    ctx.print(ast, `}`);
    return null;
  }
  visitCommaExpr(ast, ctx) {
    ctx.print(ast, "(");
    this.visitAllExpressions(ast.parts, ctx, ",");
    ctx.print(ast, ")");
    return null;
  }
  visitAllExpressions(expressions, ctx, separator) {
    this.visitAllObjects(
      (expr) => expr.visitExpression(this, ctx),
      expressions,
      ctx,
      separator
    );
  }

  visitAllObjects(handler, expressions, ctx, separator) {
    let incrementedIndent = false;
    for (let i = 0; i < expressions.length; i++) {
      if (i > 0) {
        if (ctx.lineLength() > 80) {
          ctx.print(null, separator, true);
          if (!incrementedIndent) {
            // continuation are marked with double indent.
            ctx.incIndent();
            ctx.incIndent();
            incrementedIndent = true;
          }
        } else {
          ctx.print(null, separator, false);
        }
      }
      handler(expressions[i]);
    }
    if (incrementedIndent) {
      // continuation are marked with double indent.
      ctx.decIndent();
      ctx.decIndent();
    }
  }

  visitAllStatements(statements, ctx) {
    statements.forEach((stmt) => stmt.visitStatement(this, ctx));
  }
}

export function escapeIdentifier(input, escapeDollar, alwaysQuote = true) {
  if (input == null) {
    return null;
  }
  const body = input.replace(_SINGLE_QUOTE_ESCAPE_STRING_RE, (...match) => {
    if (match[0] == "$") {
      return escapeDollar ? "\\$" : "$";
    } else if (match[0] == "\n") {
      return "\\n";
    } else if (match[0] == "\r") {
      return "\\r";
    } else {
      return `\\${match[0]}`;
    }
  });
  const requiresQuotes = alwaysQuote || !_LEGAL_IDENTIFIER_RE.test(body);
  return requiresQuotes ? `'${body}'` : body;
}

export class AbstractJsEmitterVisitor extends AbstractEmitterVisitor {
  constructor() {
    super(false);
  }

  visitWrappedNodeExpr(ast, ctx) {
    throw new Error("Cannot emit a WrappedNodeExpr in Javascript.");
  }

  visitDeclareVarStmt(stmt, ctx) {
    ctx.print(stmt, `var ${stmt.name}`);
    if (stmt.value) {
      ctx.print(stmt, " = ");
      stmt.value.visitExpression(this, ctx);
    }
    ctx.println(stmt, `;`);
    return null;
  }
  visitTaggedTemplateExpr(ast, ctx) {
    // The following convoluted piece of code is effectively the downlevelled equivalent of
    // ```
    // tag`...`
    // ```
    // which is effectively like:
    // ```
    // tag(__makeTemplateObject(cooked, raw), expression1, expression2, ...);
    // ```
    const elements = ast.template.elements;
    ast.tag.visitExpression(this, ctx);
    ctx.print(ast, `(${makeTemplateObjectPolyfill}(`);
    ctx.print(
      ast,
      `[${elements
        .map((part) => escapeIdentifier(part.text, false))
        .join(", ")}], `
    );
    ctx.print(
      ast,
      `[${elements
        .map((part) => escapeIdentifier(part.rawText, false))
        .join(", ")}])`
    );
    ast.template.expressions.forEach((expression) => {
      ctx.print(ast, ", ");
      expression.visitExpression(this, ctx);
    });
    ctx.print(ast, ")");
    return null;
  }
  visitFunctionExpr(ast, ctx) {
    ctx.print(ast, `function${ast.name ? " " + ast.name : ""}(`);
    this._visitParams(ast.params, ctx);
    ctx.println(ast, `) {`);
    ctx.incIndent();
    this.visitAllStatements(ast.statements, ctx);
    ctx.decIndent();
    ctx.print(ast, `}`);
    return null;
  }
  visitArrowFunctionExpr(ast, ctx) {
    ctx.print(ast, "(");
    this._visitParams(ast.params, ctx);
    ctx.print(ast, ") =>");

    if (Array.isArray(ast.body)) {
      ctx.println(ast, `{`);
      ctx.incIndent();
      this.visitAllStatements(ast.body, ctx);
      ctx.decIndent();
      ctx.print(ast, `}`);
    } else {
      const isObjectLiteral = ast.body instanceof o.LiteralMapExpr;

      if (isObjectLiteral) {
        ctx.print(ast, "(");
      }

      ast.body.visitExpression(this, ctx);

      if (isObjectLiteral) {
        ctx.print(ast, ")");
      }
    }

    return null;
  }
  visitDeclareFunctionStmt(stmt, ctx) {
    ctx.print(stmt, `function ${stmt.name}(`);
    this._visitParams(stmt.params, ctx);
    ctx.println(stmt, `) {`);
    ctx.incIndent();
    this.visitAllStatements(stmt.statements, ctx);
    ctx.decIndent();
    ctx.println(stmt, `}`);
    return null;
  }
  visitLocalizedString(ast, ctx) {
    // The following convoluted piece of code is effectively the downlevelled equivalent of
    // ```
    // $localize `...`
    // ```
    // which is effectively like:
    // ```
    // $localize(__makeTemplateObject(cooked, raw), expression1, expression2, ...);
    // ```
    ctx.print(ast, `$localize(${makeTemplateObjectPolyfill}(`);
    const parts = [ast.serializeI18nHead()];
    for (let i = 1; i < ast.messageParts.length; i++) {
      parts.push(ast.serializeI18nTemplatePart(i));
    }
    ctx.print(
      ast,
      `[${parts
        .map((part) => escapeIdentifier(part.cooked, false))
        .join(", ")}], `
    );
    ctx.print(
      ast,
      `[${parts.map((part) => escapeIdentifier(part.raw, false)).join(", ")}])`
    );
    ast.expressions.forEach((expression) => {
      ctx.print(ast, ", ");
      expression.visitExpression(this, ctx);
    });
    ctx.print(ast, ")");
    return null;
  }

  _visitParams(params, ctx) {
    this.visitAllObjects(
      (param) => ctx.print(null, param.name),
      params,
      ctx,
      ","
    );
  }
}

/**
 * An Angular AST visitor that converts AST nodes into executable JavaScript code.
 */
export class JitEmitterVisitor extends AbstractJsEmitterVisitor {
  _evalArgNames = [];
  _evalArgValues = [];
  _evalExportedVars = [];
  refResolver;

  constructor(refResolver) {
    super();

    this.refResolver = refResolver;
  }

  createReturnStmt(ctx) {
    const stmt = new o.ReturnStatement(
      new o.LiteralMapExpr(
        this._evalExportedVars.map(
          (resultVar) =>
            new o.LiteralMapEntry(resultVar, o.variable(resultVar), false)
        )
      )
    );
    stmt.visitStatement(this, ctx);
  }

  getArgs() {
    const result = {};
    for (let i = 0; i < this._evalArgNames.length; i++) {
      result[this._evalArgNames[i]] = this._evalArgValues[i];
    }
    return result;
  }

  visitExternalExpr(ast, ctx) {
    this._emitReferenceToExternal(
      ast,
      this.refResolver.resolveExternalReference(ast.value),
      ctx
    );
    return null;
  }

  visitWrappedNodeExpr(ast, ctx) {
    this._emitReferenceToExternal(ast, ast.node, ctx);
    return null;
  }

  visitDeclareVarStmt(stmt, ctx) {
    if (stmt.hasModifier(o.StmtModifier.Exported)) {
      this._evalExportedVars.push(stmt.name);
    }
    return super.visitDeclareVarStmt(stmt, ctx);
  }

  visitDeclareFunctionStmt(stmt, ctx) {
    if (stmt.hasModifier(o.StmtModifier.Exported)) {
      this._evalExportedVars.push(stmt.name);
    }
    return super.visitDeclareFunctionStmt(stmt, ctx);
  }

  _emitReferenceToExternal(ast, value, ctx) {
    ctx.print(ast, value);
  }
}
