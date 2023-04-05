export function counting<F extends Function> (f: F) {
  let nCalls = 0;
  return (function () {
    let ff: any = (...a: any []) => { ++nCalls; return f(...a); };
    ff.nCalls = () => nCalls;
    return ff as F &{ nCalls: () => number };
  }) ();
}

export function countingFamily<FunctionFamily extends { [name: string]: Function }> (ff: FunctionFamily):
  FunctionFamily & { nCalls: () => { [name in keyof FunctionFamily]: number } }
{
  let calls: any = {};
  let obj: any = {};
  for (let key of Object.keys(ff)) {
    calls[key] = 0;
    obj[key] = (function () {
      const f = ff[key];
      return (...a: any []) => { ++(calls[key] as number); return f(...a); };
    }) ();
  }
  obj.nCalls = () => ({...calls as { [name in keyof FunctionFamily]: number }});
  return obj;
}
