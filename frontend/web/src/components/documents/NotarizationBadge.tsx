"use client";

import { useEffect, useState } from "react";
import { notarizationApi } from "@/lib/api";
import { ShieldCheck, ShieldAlert, ShieldOff, Loader2, Hash, Link2, Clock, X } from "lucide-react";

interface VerifyResult {
  notarized: boolean;
  verified: boolean;
  chainValid?: boolean;
  currentHashMatches?: boolean;
  currentHash?: string;
  latestBlockHash?: string;
  blockCount?: number;
  reason?: string;
  blocks?: Array<{
    block_number: number;
    block_hash: string;
    previous_block_hash: string | null;
    content_hash: string;
    version: number;
    notarized_at: string;
    notarized_by_name: string;
    network: string;
  }>;
}

export default function NotarizationBadge({ documentId }: { documentId: string }) {
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [notarizing, setNotarizing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await notarizationApi.verify(documentId);
      setVerify(r.data?.data || r.data);
    } catch { /* noop */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [documentId]);

  const handleNotarize = async () => {
    setNotarizing(true);
    try {
      await notarizationApi.notarize(documentId);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || "Failed to notarize");
    } finally { setNotarizing(false); }
  };

  if (loading) {
    return <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Loader2 className="w-3 h-3 animate-spin" /></span>;
  }
  if (!verify) return null;

  if (!verify.notarized) {
    return (
      <button
        onClick={handleNotarize}
        disabled={notarizing}
        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-700 transition"
        title="Click to notarize on Apex Chain"
      >
        {notarizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldOff className="w-3 h-3" />}
        {notarizing ? "Notarizing…" : "Not notarized"}
      </button>
    );
  }

  const Icon = verify.verified ? ShieldCheck : ShieldAlert;
  const color = verify.verified ? "bg-green-50 text-green-700 hover:bg-green-100" : "bg-red-50 text-red-700 hover:bg-red-100";
  const label = verify.verified ? "Verified" : "Tampered!";

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition ${color}`}
        title={verify.verified ? "Verified on Apex Chain — click for proof" : "Hash mismatch detected"}
      >
        <Icon className="w-3 h-3" /> {label}
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold flex items-center gap-2">
                <Icon className={`w-5 h-5 ${verify.verified ? "text-green-600" : "text-red-600"}`} />
                Blockchain Notarization Proof
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className={`p-3 rounded-md ${verify.verified ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                <div className="font-medium">{verify.verified ? "✓ Document is verified" : "⚠ Verification failed"}</div>
                <div className="text-sm text-slate-600 mt-1">
                  Content hash matches: <strong>{verify.currentHashMatches ? "Yes" : "No"}</strong> ·
                  Chain integrity: <strong>{verify.chainValid ? "Valid" : "Broken"}</strong> ·
                  Blocks: <strong>{verify.blockCount}</strong>
                </div>
              </div>

              <div className="text-xs space-y-1">
                <div className="flex items-start gap-2">
                  <Hash className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <div className="text-slate-500">Current document hash (SHA-256)</div>
                    <code className="font-mono break-all text-slate-700">{verify.currentHash}</code>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Link2 className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <div className="text-slate-500">Latest block hash</div>
                    <code className="font-mono break-all text-slate-700">{verify.latestBlockHash}</code>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1"><Clock className="w-4 h-4" /> Hash Chain History</h4>
                <div className="space-y-2">
                  {verify.blocks?.map((b) => (
                    <div key={b.block_number} className="border rounded-md p-2 text-xs bg-slate-50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-bold">Block #{b.block_number}</span>
                        <span className="text-slate-500">v{b.version} · {new Date(b.notarized_at).toLocaleString()} · by {b.notarized_by_name || "system"}</span>
                      </div>
                      <div className="font-mono text-[10px] text-slate-600 break-all">
                        hash: {b.block_hash}<br />
                        prev: {b.previous_block_hash || "GENESIS"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-xs text-slate-400">Network: apex-chain-v1</span>
                <button
                  onClick={handleNotarize}
                  disabled={notarizing}
                  className="text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {notarizing ? "Sealing…" : "Add new block (re-notarize)"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
