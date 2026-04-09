'use client';

import { useEffect, useState } from 'react';
import { signatureApi } from '@/lib/api';

interface Signature {
  id: string;
  documentId: string;
  signerId: string;
  status: string;
  provider: string;
  signedAt: string | null;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  SIGNED: 'bg-green-100 text-green-800',
  DECLINED: 'bg-red-100 text-red-800',
  EXPIRED: 'bg-gray-100 text-gray-800',
  REVOKED: 'bg-gray-100 text-gray-800',
};

export default function SignaturePanel({ documentId }: { documentId: string }) {
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!documentId) return;
    signatureApi.getByDocument(documentId)
      .then(res => setSignatures(res.data.data || []))
      .catch(() => setSignatures([]))
      .finally(() => setLoading(false));
  }, [documentId]);

  const handleSign = async (id: string) => {
    try {
      await signatureApi.sign(id);
      const res = await signatureApi.getByDocument(documentId);
      setSignatures(res.data.data || []);
    } catch { /* ignore */ }
  };

  const handleDecline = async (id: string) => {
    try {
      await signatureApi.decline(id);
      const res = await signatureApi.getByDocument(documentId);
      setSignatures(res.data.data || []);
    } catch { /* ignore */ }
  };

  if (loading) return <div className="text-sm text-gray-400">Loading signatures...</div>;
  if (signatures.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h4 className="text-sm font-semibold text-gray-900 mb-3">Signatures</h4>
      <div className="space-y-2">
        {signatures.map(sig => (
          <div key={sig.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <span className={`inline-flex text-xs rounded-full px-2 py-0.5 font-medium ${statusColors[sig.status] || statusColors.PENDING}`}>
                {sig.status}
              </span>
              <span className="text-sm text-gray-600">{sig.provider}</span>
            </div>
            {sig.status === 'PENDING' && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleSign(sig.id)}
                  className="text-xs bg-green-600 text-white rounded px-3 py-1 hover:bg-green-700"
                >
                  Sign
                </button>
                <button
                  onClick={() => handleDecline(sig.id)}
                  className="text-xs bg-red-100 text-red-700 rounded px-3 py-1 hover:bg-red-200"
                >
                  Decline
                </button>
              </div>
            )}
            {sig.signedAt && (
              <span className="text-xs text-gray-400">
                {new Date(sig.signedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
