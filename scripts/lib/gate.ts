/**
 * Minimal PASS/FAIL reporter shared by every verify-partN script.
 * Each check prints one line; the process exits 1 if any check failed.
 */
export interface CheckResult { label: string; pass: boolean; detail?: string }

export class Gate {
  readonly results: CheckResult[] = [];
  constructor(readonly name: string) {
    console.log(`=== ${name} ===`);
  }
  check(label: string, pass: boolean, detail = ''): boolean {
    this.results.push({ label, pass, detail });
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
    return pass;
  }
  get failed(): number {
    return this.results.filter((r) => !r.pass).length;
  }
  finish(): never {
    const n = this.results.length;
    console.log(`--- ${this.name}: ${n - this.failed}/${n} PASS${this.failed ? `, ${this.failed} FAIL` : ''} ---`);
    process.exit(this.failed ? 1 : 0);
  }
}
