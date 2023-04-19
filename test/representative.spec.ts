import assert from "assert";
import { lastValueFrom } from "rxjs";
import { Representative } from "../src/representative";
import * as Disclosure from "../src/disclosure";
import * as RepreselectAssert from "@sihlfall/represelect-assert";
import { counting } from "./callCount";

describe("Respresentative", function () {
  function trigger(success: (x: number) => void, error: (e: any) => void) {
    success(42);
  }

  it("initially discloses an Disclosure.INACTIVE status", function () {
    const repr = new Representative(trigger);
    RepreselectAssert.Disclosure.inactive(repr.disclose());
  });

  it("is not triggered on disclose", function () {
    const f = counting(trigger);
    const repr = new Representative(f);
    repr.disclose();
    assert.deepStrictEqual(f.nCalls(), 0);
  });

  it("for a successful sync trigger, discloses SUCCESS after subscribing to value$", function () {
    const repr = new Representative(trigger);
    repr.value$.subscribe();
    RepreselectAssert.Disclosure.successWith(repr.disclose(), 42);
  });

  it("for multiple subscriptions to value$, calls trigger only once", function () {
    const f = counting(trigger);
    const repr = new Representative(f);
    repr.value$.subscribe();
    assert.deepStrictEqual(f.nCalls(), 1);
    repr.value$.subscribe();
    assert.deepStrictEqual(f.nCalls(), 1);
  });

  it("does not trigger on subscribing to passive$", function () {
    const f = counting(trigger);
    const repr = new Representative(f);
    repr.disclose$.subscribe();
    assert.deepStrictEqual(f.nCalls(), 0);
  });

  it("distributes function value via value$", async function () {
    const f = counting(trigger);
    const repr = new Representative(f);
    const v = await lastValueFrom(repr.value$);
    assert.deepStrictEqual(v, 42);
  });

  it("distributes Disclosure.INACTIVE, PENDING, and SUCCESS via disclose$", function () {
    let observed: Disclosure.Unspecified<number> [] = [];
    const f = counting(trigger);
    const repr = new Representative(f);
    repr.disclose$.subscribe({ next(d) { observed.push(d); } });
    assert.deepStrictEqual(f.nCalls(), 0);
    assert.deepStrictEqual(
      observed,
      [
        Disclosure.inactive()
      ]
    );
    repr.value$.subscribe();
    assert.deepStrictEqual(f.nCalls(), 1);
    assert.deepStrictEqual(
      observed,
      [
        Disclosure.inactive(),
        Disclosure.pending(),
        Disclosure.success(42)
      ]
    );
  });

  it("emits SUCCESS on disclose$ even after completion", function () {
    let observed: Disclosure.Unspecified<number> [] = [];
    const f = counting(trigger);
    const repr = new Representative(f);
    repr.value$.subscribe();
    assert.ok(repr.disclose().status === Disclosure.Status.SUCCESS);
    repr.disclose$.subscribe(d => observed.push(d));
    assert.deepStrictEqual(observed, [ Disclosure.success(42) ]);
  })
});