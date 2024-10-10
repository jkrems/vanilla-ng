import * as o from "@angular/compiler";
import ts from "typescript";

export class TypeScriptEmitterVisitor {
  refResolver;

  constructor(refResolver) {
    this.refResolver = refResolver;
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
    const expr = stmt.expr.visitExpression(this, ctx);
    return ts.factory.createExpressionStatement(expr);
  }

  visitReturnStmt(stmt, ctx) {
    const expr = stmt.value.visitExpression(this, ctx);
    return ts.factory.createReturnStatement(expr);
  }

  visitIfStmt(stmt, ctx) {
    const cond = stmt.condition.visitExpression(this, ctx);
    const trueStatements = this.visitAllStatements(stmt.trueCase, ctx);
    const falseStatements = this.visitAllStatements(stmt.falseCase ?? [], ctx);
    const hasElseCase = falseStatements.length > 0;

    return ts.factory.createIfStatement(
      cond,
      ts.factory.createBlock(trueStatements, true),
      falseStatements.length
        ? ts.factory.createBlock(falseStatements, true)
        : undefined
    );
  }

  visitDeclareVarStmt(stmt, ctx) {
    if (stmt.hasModifier(o.StmtModifier.Exported)) {
      throw new Error(`TODO: Exported ${stmt.name}`);
    }
    const init = stmt.value ? stmt.value.visitExpression(this, ctx) : undefined;
    return ts.factory.createVariableStatement(
      [],
      [
        ts.factory.createVariableDeclaration(
          stmt.name,
          undefined,
          undefined,
          init
        ),
      ]
    );
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

    const callee = expr.fn.visitExpression(this, ctx);
    const args = this.visitAllExpressions(expr.args, ctx);
    const call = ts.factory.createCallExpression(callee, undefined, args);

    return shouldParenthesize
      ? ts.factory.createParenthesizedExpression(call)
      : call;
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
    return this._getReferenceToExternal(ast.node);
  }
  visitTypeofExpr(expr, ctx) {
    ctx.print(expr, "typeof ");
    expr.expr.visitExpression(this, ctx);
  }
  visitReadVarExpr(ast, ctx) {
    return ts.factory.createIdentifier(ast.name);
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
      return ts.factory.createStringLiteral(value);
    } else if (typeof value === "boolean") {
      return ts.factory.createIdentifier(`${value}`);
    } else if (typeof value === "number") {
      if (value < 0) {
        return ts.factory.createPrefixUnaryExpression(
          ts.SyntaxKind.MinusToken,
          ts.factory.createNumericLiteral(-value)
        );
      }
      return ts.factory.createNumericLiteral(value);
    } else {
      throw new Error(`TODO: ${JSON.stringify(value)} [${typeof value}]`);
    }
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
    return this._getReferenceToExternal(
      this.refResolver.resolveExternalReference(ast.value)
    );
  }

  _getReferenceToExternal(value) {
    return ts.factory.createIdentifier(value);
  }

  visitConditionalExpr(ast, ctx) {
    const cond = ast.condition.visitExpression(this, ctx);
    const whenTrue = ast.trueCase.visitExpression(this, ctx);
    const whenFalse = ast.falseCase.visitExpression(this, ctx);
    return ts.factory.createConditionalExpression(
      cond,
      undefined,
      whenTrue,
      undefined,
      whenFalse
    );
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
    const params = this._visitParams(ast.params, ctx);
    const statements = this.visitAllStatements(ast.statements, ctx);
    return ts.factory.createFunctionExpression(
      undefined,
      undefined,
      ast.name ? ts.factory.createIdentifier(ast.name) : undefined,
      undefined,
      params,
      undefined,
      ts.factory.createBlock(statements, true)
    );
  }

  _visitParams(params, ctx) {
    return this.visitAllObjects((param) => {
      return ts.factory.createParameterDeclaration(undefined, undefined, param.name);
    }, params);
  }
  visitArrowFunctionExpr(ast, context) {
    throw new Error("Must be implemented in derived class");
  }
  visitDeclareFunctionStmt(stmt, ctx) {
    if (stmt.hasModifier(o.StmtModifier.Exported)) {
      throw new Error(`TODO: Exported ${stmt.name}`);
    }

    const params = this._visitParams(stmt.params, ctx);
    const statements = this.visitAllStatements(stmt.statements, ctx);
    return ts.factory.createFunctionDeclaration(
      undefined,
      undefined,
      stmt.name,
      undefined,
      params,
      undefined,
      ts.factory.createBlock(statements)
    );
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
        opStr = ts.SyntaxKind.EqualsEqualsToken;
        break;
      case o.BinaryOperator.Identical:
        opStr = ts.SyntaxKind.EqualsEqualsToken;
        break;
      case o.BinaryOperator.NotEquals:
        opStr = ts.SyntaxKind.ExclamationEqualsToken;
        break;
      case o.BinaryOperator.NotIdentical:
        opStr = ts.SyntaxKind.ExclamationEqualsEqualsToken;
        break;
      case o.BinaryOperator.And:
        opStr = ts.SyntaxKind.AmpersandAmpersandToken;
        break;
      case o.BinaryOperator.BitwiseOr:
        opStr = ts.SyntaxKind.BarToken;
        break;
      case o.BinaryOperator.BitwiseAnd:
        opStr = ts.SyntaxKind.AmpersandToken;
        break;
      case o.BinaryOperator.Or:
        opStr = ts.SyntaxKind.BarBarToken;
        break;
      case o.BinaryOperator.Plus:
        opStr = ts.SyntaxKind.PlusToken;
        break;
      case o.BinaryOperator.Minus:
        opStr = ts.SyntaxKind.MinusToken;
        break;
      case o.BinaryOperator.Divide:
        opStr = ts.SyntaxKind.SlashToken;
        break;
      case o.BinaryOperator.Multiply:
        opStr = ts.SyntaxKind.AsteriskToken;
        break;
      case o.BinaryOperator.Modulo:
        opStr = ts.SyntaxKind.PercentToken;
        break;
      case o.BinaryOperator.Lower:
        opStr = ts.SyntaxKind.LessThanToken;
        break;
      case o.BinaryOperator.LowerEquals:
        opStr = ts.SyntaxKind.LessThanEqualsToken;
        break;
      case o.BinaryOperator.Bigger:
        opStr = ts.SyntaxKind.GreaterThanToken;
        break;
      case o.BinaryOperator.BiggerEquals:
        opStr = ts.SyntaxKind.GreaterThanEqualsToken;
        break;
      case o.BinaryOperator.NullishCoalesce:
        opStr = ts.SyntaxKind.QuestionQuestionToken;
        break;
      default:
        throw new Error(`Unknown operator ${ast.operator}`);
    }
    const lhs = ast.lhs.visitExpression(this, ctx);
    const rhs = ast.rhs.visitExpression(this, ctx);
    const bin = ts.factory.createBinaryExpression(lhs, opStr, rhs);
    return ast.parens ? ts.factory.createParenthesizedExpression(bin) : bin;
  }

  visitReadPropExpr(ast, ctx) {
    const obj = ast.receiver.visitExpression(this, ctx);
    return ts.factory.createPropertyAccessExpression(obj, ast.name);
  }
  visitReadKeyExpr(ast, ctx) {
    ast.receiver.visitExpression(this, ctx);
    ctx.print(ast, `[`);
    ast.index.visitExpression(this, ctx);
    ctx.print(ast, `]`);
    return null;
  }
  visitLiteralArrayExpr(ast, ctx) {
    const items = this.visitAllExpressions(ast.entries, ctx);
    return ts.factory.createArrayLiteralExpression(items);
  }
  visitLiteralMapExpr(ast, ctx) {
    const props = this.visitAllObjects(
      (entry) => {
        return ts.factory.createPropertyAssignment(
          entry.key,
          entry.value.visitExpression(this, ctx)
        );
      },
      ast.entries,
      ctx
    );
    return ts.factory.createObjectLiteralExpression(props, true);
  }
  visitCommaExpr(ast, ctx) {
    ctx.print(ast, "(");
    this.visitAllExpressions(ast.parts, ctx, ",");
    ctx.print(ast, ")");
    return null;
  }
  visitAllExpressions(expressions, ctx, separator) {
    if (separator) {
      throw new Error("Call should be updated");
    }
    return this.visitAllObjects(
      (expr) => expr.visitExpression(this, ctx),
      expressions
    );
  }

  visitAllObjects(handler, expressions) {
    return expressions.map((expr) => handler(expr));
  }

  visitAllStatements(statements, ctx) {
    return statements.map((stmt) => stmt.visitStatement(this, ctx));
  }
}
