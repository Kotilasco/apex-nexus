'use client';

import { useState } from 'react';
import { searchApi } from '@/lib/api';

interface PiiFinding {
  type: string;
  description: string;
  severity: string;
  occurrences: number;
}

interface ScanResult {
  piiFound: boolean;
  severity: string;
  findings: PiiFinding[];
  totalPiiCount: number;
  scannedLength: number;
}

const severityColors: Record<string, string> = {
  NONE: 'bg-green-100 text-green-800',
  LOW: 'bg-blue-100 text-blue-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HIGH: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800',
};

export default function GdprScanner() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');

  const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setLoading(true);
    try {
      const res = await searchApi.gdprScan(file);
      setResult(res.data.data);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">GDPR Privacy Scanner</h3>
      <p className="text-sm text-gray-500 mb-4">
        Upload a document to scan for personally identifiable information (PII).
      </p>

      <label className="flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:border-blue-400 transition-colors">
        <input type="file" className="hidden" onChange={handleScan} />
        <div className="text-center">
          <div className="text-2xl mb-1">🔒</div>
          <p className="text-sm font-medium text-gray-700">
            {loading ? 'Scanning...' : fileName || 'Click to upload a document'}
          </p>
        </div>
      </label>

      {result && (
        <div className="mt-4">
          <div className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${severityColors[result.severity] || severityColors.NONE}`}>
            {result.piiFound ? `⚠ PII Detected — ${result.severity}` : '✓ No PII Found'}
          </div>

          {result.findings.length > 0 && (
            <div className="mt-3 space-y-2">
              {result.findings.map((f, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                  <div>
                    <span className="text-sm font-medium text-gray-900">{f.description}</span>
                    <span className={`ml-2 inline-flex text-xs rounded px-1.5 py-0.5 ${severityColors[f.severity]}`}>
                      {f.severity}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">{f.occurrences} found</span>
                </div>
              ))}
            </div>
          )}

          <p className="mt-3 text-xs text-gray-400">
            Scanned {result.scannedLength.toLocaleString()} characters — {result.totalPiiCount} PII items total
          </p>
        </div>
      )}
    </div>
  );
}
