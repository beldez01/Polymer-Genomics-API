/**
 * DMP statistics — lambda calculation, summary generation
 */

import type { DMPRow, DMPSummary, ThresholdState } from './types';

/**
 * Calculate genomic inflation factor (lambda).
 * lambda = median(chi2_observed) / median(chi2_expected)
 * For 1 df chi-square, median of chi2(1) = 0.4549364
 */
export function computeLambda(pValues: number[]): number {
  if (pValues.length === 0) return 1;

  const CHI2_MEDIAN_1DF = 0.4549364;

  // Convert p-values to chi-squared statistics (1 df)
  // chi2 = qchisq(1 - p, 1)  — approximation via inverse normal
  const chi2 = pValues
    .filter(p => p > 0 && p < 1)
    .map(p => {
      // Use inverse chi-square via -2*ln(p) approximation for 1df
      // More accurate: use the relationship chi2_1df = (Z)^2 where Z = qnorm(1-p)
      // Simple approximation that works well:
      const z = inverseNormalCDF(1 - p);
      return z * z;
    })
    .sort((a, b) => a - b);

  if (chi2.length === 0) return 1;

  const median = chi2[Math.floor(chi2.length / 2)];
  return median / CHI2_MEDIAN_1DF;
}

/**
 * Rational approximation of the inverse normal CDF (probit function).
 * Abramowitz and Stegun approximation 26.2.23. Accurate to ~4.5e-4.
 */
function inverseNormalCDF(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;

  const sign = p < 0.5 ? -1 : 1;
  const pp = p < 0.5 ? p : 1 - p;

  const t = Math.sqrt(-2 * Math.log(pp));
  const c0 = 2.515517;
  const c1 = 0.802853;
  const c2 = 0.010328;
  const d1 = 1.432788;
  const d2 = 0.189269;
  const d3 = 0.001308;

  const z = t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t);
  return sign * z;
}

export function computeSummary(rows: DMPRow[], thresholds: ThresholdState): DMPSummary {
  if (rows.length === 0) {
    return {
      total: 0, significant: 0, hyper: 0, hypo: 0,
      lambda: 1, deltaBetaMin: 0, deltaBetaMax: 0, maxNegLog10P: 0,
    };
  }

  const { adjPValueCutoff, deltaBetaCutoff } = thresholds;

  let significant = 0;
  let hyper = 0;
  let hypo = 0;
  let dbMin = Infinity;
  let dbMax = -Infinity;
  let maxNlp = 0;

  for (const row of rows) {
    if (row.delta_beta < dbMin) dbMin = row.delta_beta;
    if (row.delta_beta > dbMax) dbMax = row.delta_beta;
    if (row.neg_log10_p > maxNlp) maxNlp = row.neg_log10_p;

    const isSig = row.adj_p_value < adjPValueCutoff && Math.abs(row.delta_beta) >= deltaBetaCutoff;
    if (isSig) {
      significant++;
      if (row.delta_beta > 0) hyper++;
      else hypo++;
    }
  }

  const lambda = computeLambda(rows.map(r => r.p_value));

  return {
    total: rows.length,
    significant,
    hyper,
    hypo,
    lambda: Math.round(lambda * 1000) / 1000,
    deltaBetaMin: dbMin,
    deltaBetaMax: dbMax,
    maxNegLog10P: maxNlp,
  };
}
