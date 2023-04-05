import assert from "assert";
import { createRepreselector } from "../src/createRepreselector";
import { INACTIVE, SUCCESS, BUSY } from "../src/representative";
import { lastValueFrom } from "rxjs";
import { assertStatus } from "./assertDisclosure";
import { Representative } from "../src/representative";
import { createSelector } from "reselect";
import { countingFamily, counting } from "./callCount";

/*** Test cases: one trivial dependency */

function runTestsTrivialDependency (f: (x: { val: number }) => number | Promise<number>) {
  const identity = (x: { val: number}) => x;

  it("returns a representative representing the correct result value",
    async function () {
      const FORTYTWO = 42;
      const sel = createRepreselector(identity, f);
      const representative1 = sel({ val: FORTYTWO });
      assertStatus(representative1.disclose(), INACTIVE);
      const res1 = await lastValueFrom(representative1.value$);
      assert.deepStrictEqual(res1, FORTYTWO);
      const disclosure2 = representative1.disclose();
      assertStatus(disclosure2, SUCCESS);
      assert.deepStrictEqual(disclosure2.value, FORTYTWO);
    }
  );

  it("does not execute the function if we do not subscribe to the value",
    async function () {
      const FORTYTWO = 42;
      const a = { val: FORTYTWO };
      const ff = counting(f);
      const sel = createRepreselector(identity, ff);
      assert.deepStrictEqual(ff.nCalls(), 0);
      const representative1 = sel(a);
      assert.deepStrictEqual(ff.nCalls(), 0);
      sel(a);
      assert.deepStrictEqual(ff.nCalls(), 0);
      const disclosure1 = representative1.disclose();
      assertStatus(disclosure1, INACTIVE);
    }
  );

  it("returns the identical representative if called with the same argument",
    async function () {
      const FORTYTWO = 42;
      const a = { val: FORTYTWO };
      const ff = counting(f);
      const sel = createRepreselector(identity, ff);
      const representative1 = sel(a);
      const representative2 = sel(a);
      await lastValueFrom(representative1.value$);
      assert.deepStrictEqual(ff.nCalls(), 1);
      const representative3 = sel(a);
      assert.deepStrictEqual(ff.nCalls(), 1);
      assertStatus(representative2.disclose(), SUCCESS);
      assertStatus(representative3.disclose(), SUCCESS);
      assert.ok(representative1 === representative2);
      assert.ok(representative1 === representative3);
    }
  );
}

describe("createRepreselector (trivial dependency, one parameter, sync function), creates a representative selector that", function () {
  const f = (x: { val: number }) => x.val;
  runTestsTrivialDependency (f);

  it("delivers SUCCESS synchronously", function () {
    const identity = (x: { val: number}) => x;
    const FORTYTWO = 42;
    const a = { val: FORTYTWO };
    const ff = counting(f);
    const sel = createRepreselector(identity, ff);
    const representative1 = sel(a);
    assertStatus(representative1.disclose(), INACTIVE);
    representative1.value$.subscribe();
    assertStatus(representative1.disclose(), SUCCESS);
  });
});

describe("createRepreselector (trivial dependency, one parameter, async function), creates a representative selector that", function () {
  const f = async (x: { val: number }) => x.val;
  runTestsTrivialDependency (f);

  it("delivers BUSY asynchronously", function () {
    const identity = (x: { val: number}) => x;
    const FORTYTWO = 42;
    const a = { val: FORTYTWO };
    const ff = counting(f);
    const sel = createRepreselector(identity, ff);
    const representative1 = sel(a);
    assertStatus(representative1.disclose(), INACTIVE);
    representative1.value$.subscribe();
    assertStatus(representative1.disclose(), BUSY);
  });

  it("delivers SUCCESS asynchronously", async function () {
    const identity = (x: { val: number}) => x;
    const FORTYTWO = 42;
    const a = { val: FORTYTWO };
    const ff = counting(f);
    const sel = createRepreselector(identity, ff);
    const representative1 = sel(a);
    assertStatus(representative1.disclose(), INACTIVE);
    await lastValueFrom(representative1.value$);
    assertStatus(representative1.disclose(), SUCCESS);
  });
});

/* Test cases: one dependency, which is a plain function */

describe("createRepreselector (one non-selector dependency, one parameter, sync function), creates a representative selector that", function () {
  it("calculates the result snychronously", function () {
    const selector = createRepreselector(
      (x: number) => x + 1, (y: number) => y * 2
    );
    const representative = selector(100);
    representative.value$.subscribe();
    assert.deepStrictEqual(representative.disclose().status, SUCCESS);
  });

  it("returns a representative representing the correct result value", async function () {
    const fns = countingFamily({
      d1: (x: number) => x * 100,
      f1: (x: number) => x + 3
    });

    const sel = createRepreselector(fns.d1, fns.f1);

    const representative1 = sel(2);
    assert.ok(representative1 instanceof Representative);
    assert.deepStrictEqual(await lastValueFrom(representative1.value$), 203);
  });

  it("does request the dependency to be evaluated when called", function() {
    const fns = countingFamily({
      d1: (x: number) => x * 100,
      f1: (x: number) => x + 3
    });

    const sel = createRepreselector(fns.d1, fns.f1);

    assert.deepStrictEqual(fns.nCalls(), { d1: 0, f1: 0 });
    const representative1 = sel(2);
    assert.deepStrictEqual(fns.nCalls(), { d1: 1, f1: 0 });
    representative1.value$.subscribe();
    assert.deepStrictEqual(fns.nCalls(), { d1: 1, f1: 1 });
  });

  it("memoizes result values", async function () {
    const d1 = counting( (_: number): number => 100 );
    const f1 = counting( (x: number) => x + 3 );

    const dSel = createRepreselector((w: number) => w, d1);
    const fSel = createRepreselector(dSel, f1);

    const representative1 = fSel(0);
    assert.ok(representative1 instanceof Representative);
    assert.deepStrictEqual(d1.nCalls (), 0);
    assert.deepStrictEqual(f1.nCalls (), 0);

    const representative2 = fSel(0);
    assert.ok(representative2 instanceof Representative);
    assert.deepStrictEqual(d1.nCalls (), 0);
    assert.deepStrictEqual(f1.nCalls (), 0);

    const disclosure1 = representative1.disclose();
    assertStatus(disclosure1, INACTIVE);
    assert.deepStrictEqual(d1.nCalls (), 0);
    assert.deepStrictEqual(f1.nCalls (), 0);

    const res1 = await lastValueFrom(representative1.value$);
    assert.deepStrictEqual(res1, 103);
    assert.deepStrictEqual(d1.nCalls (), 1);
    assert.deepStrictEqual(f1.nCalls (), 1);

    const res2 = await lastValueFrom(representative1.value$);
    assert.deepStrictEqual(res2, 103);
    assert.deepStrictEqual(d1.nCalls (), 1);
    assert.deepStrictEqual(f1.nCalls (), 1);
  });

  it("memoizes the resulting representative", function () {
    const fns = countingFamily({
      d1: (x: number) => x * 100,
      f1: (x: number) => x + 3
    });

    const sel = createRepreselector(fns.d1, fns.f1);

    assert.deepStrictEqual(fns.nCalls(), { d1: 0, f1: 0 });
    const representative1 = sel(2);
    const representative2 = sel(2);
    assert.ok(representative1 === representative2);
  });
});

describe("createRepreselector (one non-selector dependency, one parameter, sync function), creates a representative selector that", function () {
  it("is memoizing", async function () {
    const fns = countingFamily({
      d1: (_: number) => 100,
      f1: async (x: number) => x + 3
    });

    const sel = createRepreselector(fns.d1, fns.f1);

    assert.deepStrictEqual(fns.nCalls(), { d1: 0, f1: 0 });

    const representative1 = sel(0);
    assert.ok(representative1 instanceof Representative);
    assert.deepStrictEqual(fns.nCalls(), { d1: 1, f1: 0 });

    const representative2 = sel(0);
    assert.ok(representative2 instanceof Representative);
    assert.deepStrictEqual(fns.nCalls(), { d1: 1, f1: 0 });

    const disclosure1 = representative1.disclose();
    assertStatus(disclosure1, INACTIVE);
    assert.deepStrictEqual(fns.nCalls(), { d1: 1, f1: 0 });

    const res1 = await lastValueFrom(representative1.value$);
    assert.deepStrictEqual(res1, 103);
    assert.deepStrictEqual(fns.nCalls(), { d1: 1, f1: 1 });

    const res2 = await lastValueFrom(representative2.value$);
    assert.deepStrictEqual(res2, 103);
    assert.deepStrictEqual(fns.nCalls(), { d1: 1, f1: 1 });
  });
});

/* Test cases: one dependency, which is a representative selector */

describe("createRepreselector (one async representative dependency, one parameter, sync function), creates a representative selector that", function () {
  it("returns a representative representing the correct result value", async function () {
    const fns = countingFamily({
      d1: async (x: number) => x * 100,
      f1: (x: number) => x + 3
    });

    const d1Sel = createRepreselector((x: number) => x, fns.d1);
    const f1Sel = createRepreselector(d1Sel, fns.f1);

    const representative1 = f1Sel(2);
    assert.ok(representative1 instanceof Representative);
    assert.deepStrictEqual(await lastValueFrom(representative1.value$), 203);
  });

  it("does request the dependency to be evaluated only after its value is subscribed for", async function() {
    const fns = countingFamily({
      d1: async (x: number) => x * 100,
      f1: (x: number) => x + 3
    });

    const d1Sel = createRepreselector((x: number) => x, fns.d1);
    const f1Sel = createRepreselector(d1Sel, fns.f1);

    assert.deepStrictEqual(fns.nCalls(), { d1: 0, f1: 0 });
    const representative1 = f1Sel(2);
    assert.deepStrictEqual(fns.nCalls(), { d1: 0, f1: 0 });
    await lastValueFrom(representative1.value$);
    assert.deepStrictEqual(fns.nCalls(), { d1: 1, f1: 1 });
  });

  it("memoizes the resulting representative", function () {
    const fns = countingFamily({
      d1: async (x: number) => x * 100,
      f1: (x: number) => x + 3
    });

    const d1Sel = createRepreselector((x: number) => x, fns.d1);
    const f1Sel = createRepreselector(d1Sel, fns.f1);

    assert.deepStrictEqual(fns.nCalls(), { d1: 0, f1: 0 });
    const representative1 = f1Sel(2);
    const representative2 = f1Sel(2);
    assert.ok(representative1 === representative2);
  });
});

describe("createRepreselector (one async representative dependency, one parameter, async function), creates a selector that", function () {
  it("works", async function () {
    const fns = countingFamily({
      d1: (w: number) => w + 1,
      e1: async (x: number) => 100 * x,
      f1: async (y: number) => y + 3
    });

    const eSel = createRepreselector(fns.d1, fns.e1);
    const fSel = createRepreselector(eSel, fns.f1);

    const representative1 = fSel(7);
    assert.ok(representative1 instanceof Representative);
    assert.deepStrictEqual(fns.nCalls (), { d1: 1, e1: 0, f1: 0 });

    const disclosure1 = representative1.disclose();
    assertStatus(disclosure1, INACTIVE);
    assert.deepStrictEqual(fns.nCalls (), { d1: 1, e1: 0, f1: 0 });

    const res1 = await lastValueFrom(representative1.value$);
    assert.deepStrictEqual(res1, 803);
    assert.deepStrictEqual(fns.nCalls (), { d1: 1, e1: 1, f1: 1 });

    const representative2 = fSel(7);
    const disclosure2 = representative2.disclose();
    assertStatus(disclosure2, SUCCESS);
    assert.deepStrictEqual(disclosure2.value, 803);
    assert.deepStrictEqual(fns.nCalls (), { d1: 1, e1: 1, f1: 1 });
  });

  it("returns the memoized result if called with the same argument", async function () {
    const fns = countingFamily({
      d1: (w: number) => w + 1,
      e1: async (x: number) => 100 * x,
      f1: async (y: number) => y + 3
    });

    const eSel = createRepreselector(fns.d1, fns.e1);
    const fSel = createRepreselector(eSel, fns.f1);

    const representative1 = fSel(7);
    await lastValueFrom(representative1.value$);

    const representative2 = fSel(7);
    const disclosure2 = representative2.disclose();
    assertStatus(disclosure2, SUCCESS);
    assert.deepStrictEqual(disclosure2.value, 803);
    assert.deepStrictEqual(fns.nCalls (), { d1: 1, e1: 1, f1: 1 });
  });

  it("returns the memoized result if the result of the dependency has not changed", async function () {
    const fns = countingFamily({
      d1: (w: number) => w % 2,
      e1: async (x: number) => 100 * x,
      f1: async (y: number) => y + 3
    });

    const eSel = createRepreselector(fns.d1, fns.e1);
    const fSel = createRepreselector(eSel, fns.f1);

    const representative1 = fSel(7);
    await lastValueFrom(representative1.value$);
    assert.deepStrictEqual(fns.nCalls (), { d1: 1, e1: 1, f1: 1 });

    const representative2 = fSel(9);
    const disclosure2 = representative2.disclose();
    assertStatus(disclosure2, SUCCESS);
    assert.deepStrictEqual(disclosure2.value, 103);
    assert.deepStrictEqual(fns.nCalls (), { d1: 2, e1: 1, f1: 1 });
  });
});

/* Test cases: two dependencies */

describe("createRepreselector (two non-representative dependencies, one parameter, sync function), creates a selector that", function () {
  it("delivers the correct result synchronously", function () {
    const identity = (x: number) => x;
    const fns = countingFamily({
      d1: (x: number) => x * 1000,
      d2: (x: number) => x * 100,
      f1: (x: number, y: number) => x + y
    });
    const d1Sel = createSelector(identity, fns.d1);
    const d2Sel = createSelector(identity, fns.d2);
    const f1Sel = createRepreselector(d1Sel, d2Sel, fns.f1);

    const representative = f1Sel(5);
    representative.value$.subscribe();
    const disclose = representative.disclose();
    assertStatus(disclose, SUCCESS);
    assert.deepStrictEqual(disclose.value, 5500);
  });
});  

describe("createRepreselector (two representative dependencies, one parameter, sync function), creates a selector that", function () {
  it("delivers the correct result synchronously", function () {
    const identity = (x: number) => x;
    const fns = countingFamily({
      d1: (x: number) => x * 1000,
      d2: (x: number) => x * 100,
      f1: (x: number, y: number) => x + y
    });
    const d1Sel = createRepreselector(identity, fns.d1);
    const d2Sel = createRepreselector(identity, fns.d2);
    const f1Sel = createRepreselector(d1Sel, d2Sel, fns.f1);

    const representative = f1Sel(5);
    representative.value$.subscribe();
    const disclose = representative.disclose();
    assertStatus(disclose, SUCCESS);
    assert.deepStrictEqual(disclose.value, 5500);
  });
});  
