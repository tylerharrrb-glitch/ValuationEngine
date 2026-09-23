import { readFileSync } from 'node:fs';
import type { CompanyData } from '../../src/domain/company';
import type { RatesRegistry } from '../../src/domain/rates';

export function loadMopco(): CompanyData {
  return JSON.parse(readFileSync('tests/fixtures/mopco-fy2025.json', 'utf8')) as CompanyData;
}

export function loadSeed(): RatesRegistry {
  return JSON.parse(readFileSync('data/rates.seed.json', 'utf8')) as RatesRegistry;
}
