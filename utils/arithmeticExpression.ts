/** Bounded arithmetic parser. Never executes JavaScript or resolves properties. */
export function arithmeticExpression(source: string): number {
  if (!source || source.length > 4096 || /[^0-9.+*/()\s-]/.test(source))
    throw new Error("Invalid arithmetic expression");
  const tokens = source.match(/(?:\d+(?:\.\d*)?|\.\d+)|\*\*|[()+*/-]/g) || [];
  if (tokens.join("") !== source.replace(/\s/g, ""))
    throw new Error("Invalid token");
  let pos = 0;
  let depth = 0;
  const atom = (): number => {
    if (++depth > 64) throw new Error("Expression too deep");
    let result: number;
    const token = tokens[pos++];
    if (token === "+" || token === "-")
      result = (token === "-" ? -1 : 1) * atom();
    else if (token === "(") {
      result = sum();
      if (tokens[pos++] !== ")") throw new Error("Missing closing parenthesis");
    } else if (token && /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token))
      result = Number(token);
    else throw new Error("Expected number");
    depth--;
    return result;
  };
  const power = (): number => {
    const left = atom();
    if (tokens[pos] !== "**") return left;
    pos++;
    if (++depth > 64) throw new Error("Expression too deep");
    const result = left ** power();
    depth--;
    return result;
  };
  const product = (): number => {
    let result = power();
    while (tokens[pos] === "*" || tokens[pos] === "/") {
      const op = tokens[pos++];
      const rhs = power();
      result = op === "*" ? result * rhs : result / rhs;
    }
    return result;
  };
  const sum = (): number => {
    let result = product();
    while (tokens[pos] === "+" || tokens[pos] === "-") {
      const op = tokens[pos++];
      const rhs = product();
      result = op === "+" ? result + rhs : result - rhs;
    }
    return result;
  };
  const result = sum();
  if (pos !== tokens.length) throw new Error("Invalid arithmetic result");
  return Number.isFinite(result) ? result : 0;
}
