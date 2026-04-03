export type FactoryContext = {
  runId: string;
  workerId: number;
  testName: string;
  next: () => number;
};

export const createFactoryContext = (
  runId: string,
  workerId: number,
  testName: string,
): FactoryContext => {
  let seq = 0;
  return {
    runId,
    workerId,
    testName,
    next: () => {
      seq += 1;
      return seq;
    },
  };
};

export const deterministicName = (ctx: FactoryContext, entity: string): string => {
  return `${entity}-${ctx.runId}-w${ctx.workerId}-n${ctx.next()}`;
};
