import { arithmeticExpression } from "./arithmeticExpression";
import { evaluateFormula } from "./compliance";
test.each([
  ["2 + 3 * 4", 14],
  ["(2+3)/2", 2.5],
  ["-2 + .5", -1.5],
  ["2**3**2", 512],
  ["12.0", 12],
  ["1/0", 0],
  ["0/0", 0],
])("arithmetic %s", (text, expected) =>
  expect(arithmeticExpression(text as string)).toBe(expected),
);
test.each([
  "globalThis.x=1",
  "1;2",
  "Math.random()",
  "2 3",
  "1..2",
  "1..",
  "()",
  "1+",
  "(".repeat(65) + "1" + ")".repeat(65),
  "1".repeat(4097),
])("rejects %s", (text) => expect(() => arithmeticExpression(text)).toThrow());
test("formula IDs retain arithmetic behavior without code execution", () => {
  const items = [
    { id: 1, indicator: "A", monthlyProgress: [6], monthlyGoals: [8] },
    { id: 2, indicator: "B", monthlyProgress: [3], monthlyGoals: [4] },
  ] as any;
  expect(evaluateFormula("{1}/{2}", items, 0)).toBe(2);
  expect(evaluateFormula("{id:1}+{id:2}", items, 0)).toBe(9);
});
