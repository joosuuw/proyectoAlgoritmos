import { useCallback, useState } from "react";
import { analyzeCode } from "../algorithms/analyzer/analyze";
import {
  DEFAULT_SAMPLE,
  SAMPLES,
  type AlgorithmSample,
} from "../algorithms/analyzer/samples";
import type { GrowthKind } from "../algorithms/analyzer/types";
import type { AnalysisResult } from "../algorithms/analyzer/types";

export interface ComparisonEntry {
  id: string;
  name: string;
  category: string;
  timeLabel: string;
  spaceLabel: string;
  timeKind: GrowthKind;
  confidence: number;
}

const MAX_COMPARISON = 6;

export interface UseAlgorithmAnalyzerResult {
  code: string;
  setCode: (code: string) => void;
  sampleId: string;
  loadSample: (id: string) => void;
  samples: AlgorithmSample[];
  result: AnalysisResult | null;
  error: string | null;
  notice: string | null;
  analyze: () => void;
  clear: () => void;
  comparison: ComparisonEntry[];
  addToComparison: () => void;
  removeFromComparison: (id: string) => void;
  clearComparison: () => void;
}

export function useAlgorithmAnalyzer(): UseAlgorithmAnalyzerResult {
  const [code, setCodeState] = useState(DEFAULT_SAMPLE.code);
  const [sampleId, setSampleId] = useState(DEFAULT_SAMPLE.id);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [comparison, setComparison] = useState<ComparisonEntry[]>([]);

  const setCode = useCallback((value: string) => {
    setCodeState(value);
    setResult(null);
    setError(null);
    setNotice(null);
  }, []);

  const loadSample = useCallback((id: string) => {
    const sample = SAMPLES.find((item) => item.id === id);
    if (!sample) return;
    setSampleId(sample.id);
    setCodeState(sample.code);
    setResult(null);
    setError(null);
    setNotice(null);
  }, []);

  const analyze = useCallback(() => {
    const outcome = analyzeCode(code);
    setResult(outcome.result);
    setError(outcome.error);
    setNotice(null);
  }, [code]);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
    setNotice(null);
  }, []);

  const addToComparison = useCallback(() => {
    if (!result) return;

    const entry: ComparisonEntry = {
      id: `${result.name}::${result.time.label}::${result.space.label}`,
      name: result.name,
      category: result.category,
      timeLabel: result.time.label,
      spaceLabel: result.space.label,
      timeKind: result.time.kind,
      confidence: result.confidence,
    };

    setComparison((current) => {
      if (current.some((item) => item.id === entry.id)) {
        setNotice(`${result.name} ya está en la comparación.`);
        return current;
      }
      setNotice(`${result.name} añadido a la comparación.`);
      return [...current, entry].slice(-MAX_COMPARISON);
    });
  }, [result]);

  const removeFromComparison = useCallback((id: string) => {
    setComparison((current) => current.filter((item) => item.id !== id));
    setNotice(null);
  }, []);

  const clearComparison = useCallback(() => {
    setComparison([]);
    setNotice(null);
  }, []);

  return {
    code,
    setCode,
    sampleId,
    loadSample,
    samples: SAMPLES,
    result,
    error,
    notice,
    analyze,
    clear,
    comparison,
    addToComparison,
    removeFromComparison,
    clearComparison,
  };
}
