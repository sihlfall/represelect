import assert from "assert";
import { lastValueFrom } from "rxjs";
import { 
   Disclosure, INACTIVE, makeBusyDisclosure, makeInactiveDisclosure, 
   makeSuccessDisclosure, Representative, SUCCESS
} from "../src/representative";
import { assertSuccess } from "./assertDisclosure";
import { counting } from "./callCount";

describe("Respresentative", function () {
  function trigger(success: (x: number) => void, error: (e: any) => void) {
    success(42);
  }

  it("initially discloses an INACTIVE status", function () {
    const repr = new Representative(trigger);
    assert.deepStrictEqual(repr.disclose().status, INACTIVE);
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
    assertSuccess(repr.disclose(), 42);
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

  it("distributes INACTIVE, BUSY, and SUCCESS via disclose$", function () {
    let observed: Disclosure<number> [] = [];
    const f = counting(trigger);
    const repr = new Representative(f);
    repr.disclose$.subscribe({ next(d) { observed.push(d); } });
    assert.deepStrictEqual(f.nCalls(), 0);
    assert.deepStrictEqual(
      observed,
      [
        makeInactiveDisclosure()
      ]
    );
    repr.value$.subscribe();
    assert.deepStrictEqual(f.nCalls(), 1);
    assert.deepStrictEqual(
      observed,
      [
        makeInactiveDisclosure(),
        makeBusyDisclosure(),
        makeSuccessDisclosure(42)
      ]
    );
  });

  it("emits SUCCESS on disclose$ even after completion", function () {
    let observed: Disclosure<number> [] = [];
    const f = counting(trigger);
    const repr = new Representative(f);
    repr.value$.subscribe();
    assert.ok(repr.disclose().status === SUCCESS);
    repr.disclose$.subscribe(d => observed.push(d));
    assert.deepStrictEqual(observed, [ makeSuccessDisclosure(42) ]);
  })
});