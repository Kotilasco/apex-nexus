'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { shareLinkApi } from '@/lib/api';

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [linkData, setLinkData] = useState<{
    documentId: string;
    title: string;
    allowPreview: boolean;
    allowDownload: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleValidate = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await shareLinkApi.validate(token, password || undefined);
      setLinkData(res.data.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Invalid or expired link');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      await shareLinkApi.recordDownload(token);
      // Redirect to the download via gateway
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      window.open(`${baseUrl}/documents/${linkData?.documentId}/preview`, '_blank');
    } catch {
      setError('Download failed');
    }
  };

  if (!linkData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="text-3xl font-bold text-blue-600 mb-2">Apex Nexus</div>
            <p className="text-gray-600">Shared Document Access</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password (if required)
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter password..."
              />
            </div>

            <button
              onClick={handleValidate}
              disabled={loading}
              className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Validating...' : 'Access Document'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="text-3xl font-bold text-blue-600 mb-2">Apex Nexus</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">{linkData.title}</h2>
        <p className="text-gray-500 mb-6">Shared document</p>

        <div className="flex gap-3 justify-center">
          {linkData.allowPreview && (
            <button
              onClick={handleDownload}
              className="bg-blue-600 text-white rounded-lg px-6 py-2.5 font-medium hover:bg-blue-700 transition-colors"
            >
              Preview
            </button>
          )}
          {linkData.allowDownload && (
            <button
              onClick={handleDownload}
              className="bg-green-600 text-white rounded-lg px-6 py-2.5 font-medium hover:bg-green-700 transition-colors"
            >
              Download
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
