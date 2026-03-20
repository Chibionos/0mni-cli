type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitRecord {
  state: CircuitState;
  failures: number;
  lastFailure: number;
}

export class CircuitBreaker {
  private circuits = new Map<string, CircuitRecord>();

  constructor(
    private readonly threshold: number = 3,
    private readonly resetTimeMs: number = 60_000,
  ) {}

  async execute<T>(
    fn: () => Promise<T>,
    fallbackFn: () => Promise<T>,
    key = 'default',
  ): Promise<T> {
    const record = this.getRecord(key);

    if (record.state === 'open') {
      if (Date.now() - record.lastFailure >= this.resetTimeMs) {
        record.state = 'half-open';
      } else {
        return fallbackFn();
      }
    }

    try {
      const result = await fn();
      this.onSuccess(record);
      return result;
    } catch (err) {
      this.onFailure(record);

      if (record.state === ('open' as CircuitState)) {
        return fallbackFn();
      }

      throw err;
    }
  }

  private getRecord(key: string): CircuitRecord {
    let record = this.circuits.get(key);
    if (!record) {
      record = { state: 'closed', failures: 0, lastFailure: 0 };
      this.circuits.set(key, record);
    }
    return record;
  }

  private onSuccess(record: CircuitRecord): void {
    record.failures = 0;
    record.state = 'closed';
  }

  private onFailure(record: CircuitRecord): void {
    record.failures += 1;
    record.lastFailure = Date.now();

    if (record.failures >= this.threshold) {
      record.state = 'open';
    }
  }
}
