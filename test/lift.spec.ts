import assert from "assert";
import { lift } from "../src/lift";
import { SUCCESS, INACTIVE, BUSY } from "../src/representative";
import { count, lastValueFrom, tap } from "rxjs";
import { assertStatus } from "./assertDisclosure";
import { Representative } from "../src/representative";
import { countingFamily } from "./callCount";

const FAILED_INTENTIONALLY = "Made to fail";

function runTestsDependencylessParameterless<V> (f: () => V, expected: Awaited<V>) {
  describe("lifts the function to a function returning a representative that", function () {
    it(
      "represents the expected result",
      async function () {
        const liftedf = lift(f);
        const representative1 = liftedf();
        const res1 = representative1.disclose();
        assertStatus(res1, INACTIVE);
        const observed = await lastValueFrom(representative1.value$);
        assert.deepStrictEqual(observed, expected);
        const res2 = representative1.disclose();
        assertStatus(res2, SUCCESS);
        assert.deepStrictEqual(res2.value, expected);
      }
    );

    it("initially discloses an INACTIVE status", function () {
      const representative = lift(f)();
      const res = representative.disclose();
      assertStatus(res, INACTIVE);
    });

    it("discloses an INACTIVE status on the second call to disclose()", function () {
      const representative = lift(f)();
      representative.disclose();
      const res = representative.disclose();
      assertStatus(res, INACTIVE);
    });

    it("whose value$ emits one and only one value", async function () {
      const representative = lift(f)();
      const res = representative.disclose();
      assertStatus(res, INACTIVE);
      const nEmissions = await lastValueFrom(representative.value$.pipe(count()));
      assert.deepStrictEqual(nEmissions, 1);
    });

    it("whose value$ emits the value to multiple subscribers", async function () {
      const representative = lift(f)();
      const res = representative.disclose();
      assertStatus(res, INACTIVE);
      const finalRes1 = await lastValueFrom(representative.value$);
      const finalRes2 = await lastValueFrom(representative.value$);
      assert.deepStrictEqual(finalRes1, expected);
      assert.deepStrictEqual(finalRes2, expected);
    });

    it("whose value$, after completion, emits the value synchronously on subscription", async function () {
      const representative = lift(f)();
      const res1 = representative.disclose();
      assertStatus(res1, INACTIVE);
      await lastValueFrom(representative.value$);
      let v: V | null = null;
      representative.value$.pipe(tap(vv => v = vv)).subscribe();
      assert.deepStrictEqual(v, expected);
    });
  });
}

describe("lift (applied to sync function without parameters),", function () {
  const FORTYTWO = 42;
  const f = () => FORTYTWO;
  runTestsDependencylessParameterless (f, FORTYTWO);

  it("returns a representative whose value$ emits SUCCESS status after subscription", function () {
    const representative = lift( () => 142 )();
    const resBeforeSubscription = representative.disclose();
    assertStatus(resBeforeSubscription, INACTIVE);
    representative.value$.subscribe();
    const resAfterSubscription = representative.disclose();
    assertStatus(resAfterSubscription, SUCCESS);
  });
});

describe("lift (applied to async function without parameters),", function () {
  const FORTYTWO = 42;
  const f = async () => FORTYTWO;
  runTestsDependencylessParameterless (f, FORTYTWO);

  it("returns a representative disclosing a BUSY status on subscription", function () {
    const representative = lift(f)();
    const resBeforeSubscription = representative.disclose();
    assertStatus(resBeforeSubscription, INACTIVE);
    representative.value$.subscribe();
    const resAfterSubscription = representative.disclose();
    assertStatus(resAfterSubscription, BUSY);
  });

});

describe("lift (applied to sync function with one parameter),", function () {
  it("creates a memoizing lift", async function () {
    const fns = countingFamily({
      d1: (): number => 100,
      f1: (x: number) => x + 3
    });

    const d1Lifted = lift(fns.d1);
    const f1Lifted = lift(fns.f1);
    const d1Result = d1Lifted();

    const representative1 = f1Lifted(d1Result);
    assert.ok(representative1 instanceof Representative);
    assert.deepStrictEqual(fns.nCalls(), { d1: 0, f1: 0 });

    const representative2 = f1Lifted(d1Result);
    assert.ok(representative2 instanceof Representative);
    assert.deepStrictEqual(fns.nCalls(), { d1: 0, f1: 0 });

    const res1 = await lastValueFrom(representative1.value$);
    assert.deepStrictEqual(res1, 103);
    assert.deepStrictEqual(fns.nCalls(), { d1: 1, f1: 1 });

    const res2 = await lastValueFrom(representative2.value$);
    assert.deepStrictEqual(res2, 103);
    assert.deepStrictEqual(fns.nCalls(), { d1: 1, f1: 1 });
  });
});

describe("lift (applied to async function with one parameter),", function () {
  it("passes its argument to the async", async function () {
    const representative = lift(async (x: number) => x)(1112);
    const res = representative.disclose();
    assertStatus(res, INACTIVE);
    const finalRes = await lastValueFrom(representative.value$);
    assert.deepStrictEqual(finalRes, 1112);
  });

  it("creates a memoizing lift", async function () {
    const fns = countingFamily({
      d1: async (): Promise<number> => 100,
      f1: async (x: number) => x + 3
    });

    const d1Lifted = lift(fns.d1);
    const f1Lifted = lift(fns.f1);
    const d1Result = d1Lifted();

    const representative1 = f1Lifted(d1Result);
    assert.ok(representative1 instanceof Representative);
    assert.deepStrictEqual(fns.nCalls(), { d1: 0, f1: 0 });

    const representative2 = f1Lifted(d1Result);
    assert.ok(representative2 instanceof Representative);
    assert.deepStrictEqual(fns.nCalls(), { d1: 0, f1: 0 });

    const res1 = await lastValueFrom(representative1.value$);
    assert.deepStrictEqual(res1, 103);
    assert.deepStrictEqual(fns.nCalls(), { d1: 1, f1: 1 });

    const res2 = await lastValueFrom(representative2.value$);
    assert.deepStrictEqual(res2, 103);
    assert.deepStrictEqual(fns.nCalls(), { d1: 1, f1: 1 });
  });
});

describe("lift (applied to a failing sync function), returns a function that", function () {
  function someFailingSyncFunction () {
    throw new Error(FAILED_INTENTIONALLY);
  }
  
  it("returns a representative whose value$ eventually emits a FAILED status", async function () {
    const representative = lift(someFailingSyncFunction)();
    const res = representative.disclose();
    assertStatus(res, INACTIVE);
    
    await assert.rejects(
      lastValueFrom(representative.value$),
      new Error(FAILED_INTENTIONALLY)
    );
  });
});

describe("lift (applied to a failing async function), returns a function that", function () {
  function someFailingAsyncFunction () {
    return new Promise<number>( (resolve, reject) => {
      setTimeout( () => {
        reject(new Error(FAILED_INTENTIONALLY));
      } , 5);
    });
  }
  
  it("returns a representative whose value$ eventually emits a FAILED state", async function () {
    const representative = lift(someFailingAsyncFunction)();
    const res = representative.disclose();
    assertStatus(res, INACTIVE);
    await assert.rejects(
      lastValueFrom(representative.value$),
      new Error(FAILED_INTENTIONALLY)
    );
  });
});
