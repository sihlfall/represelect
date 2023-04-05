import assert from "assert";
import { SUCCESS, ERROR, INACTIVE, BUSY, Disclosure, SuccessDisclosure, makeSuccessDisclosure } from "../src/representative";

export function assertStatus<
  T extends { status: typeof INACTIVE | typeof BUSY | typeof SUCCESS | typeof ERROR},
  Expected
> (
  r: T,
  expectedStatus: Expected & (typeof INACTIVE | typeof BUSY | typeof SUCCESS | typeof ERROR)
):
asserts r is T & { status: Expected & (typeof INACTIVE | typeof BUSY | typeof SUCCESS | typeof ERROR) } {
  assert.ok (r.status === expectedStatus);
}

export function assertSuccess<Value>(
  d: Disclosure<Value>,
  expectedValue: Value
): asserts d is SuccessDisclosure<Value> {
  assert.deepStrictEqual(
    d,
    makeSuccessDisclosure(expectedValue)
  );
}
