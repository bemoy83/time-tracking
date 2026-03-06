import type { CalcResult } from './types';

export function ResultDisplay({ result }: { result: CalcResult }) {
  if (result.type === 'crew') {
    return (
      <>
        <span className="calculator__result-value">{result.crewValue}</span>
        <span className="calculator__result-label">
          {result.crewValue === 1 ? 'worker' : 'workers'} needed
          <span className="calculator__advisory"> (advisory)</span>
        </span>
      </>
    );
  }
  return (
    <>
      <span className="calculator__result-value">{result.timeFormatted}</span>
      <span className="calculator__result-label">
        estimated duration
        <span className="calculator__advisory"> (advisory)</span>
      </span>
    </>
  );
}
