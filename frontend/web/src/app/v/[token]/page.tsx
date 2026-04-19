"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import {
  Shield,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Ban,
  Building2,
  Loader2,
  Clock,
  FileText,
} from "lucide-react";

const PUBLIC_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9600/api";

type ComplianceDoc = {
  doc_type: string;
  label?: string;
  expires_on: string;
  status: "VALID" | "EXPIRING_SOON" | "EXPIRED" | "REJECTED";
};

type PortalInfo = {
  vendor_code: string;
  vendor_name: string;
  required_docs?: string[];
  expires_at: string;
  project_name?: string;
  status: string;
  compliance_status?: "COMPLIANT" | "EXPIRING" | "NON_COMPLIANT" | "UNKNOWN";
  blocked_reason?: string | null;
  compliance_docs?: ComplianceDoc[];
};

type Submission = {
  filename: string;
  status: "RECEIVED" | "QUARANTINED" | "REJECTED" | "BLOCKED";
  classification?: string;
  piiFindings?: Record<string, number>;
  complianceFindings?: string[];
  message?: string;
  uploaded_at: string;
};

export default function VendorPortalPage({ params }: { params: { token: string } }) {
  const [info, setInfo] = useState<PortalInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploads, setUploads] = useState<Submission[]>([]);

  const verify = useCallback(async () => {
    try {
      const r = await axios.get(`${PUBLIC_BASE}/public/vendor-portal/${params.token}`);
      if (r.data?.success === false) setError(r.data.message || "Invalid portal");
      else setInfo(r.data.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Portal is not accessible");
    }
  }, [params.token]);

  useEffect(() => { verify(); }, [verify]);

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await axios.post(
        `${PUBLIC_BASE}/public/vendor-portal/${params.token}/upload`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      const payload = r.data?.data || r.data;
      setUploads((u) => [
        { ...payload, filename: file.name, uploaded_at: new Date().toISOString() },
        ...u,
      ]);
      setFile(null);
      verify();
    } catch (e: any) {
      alert(e?.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <AlertTriangle className="h-12 w-12 mx-auto text-red-500 mb-3" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">Portal unavailable</h1>
          <p className="text-sm text-slate-600">{error}</p>
          <p className="text-xs text-slate-400 mt-4">
            If you believe this is a mistake, contact your procurement representative.
          </p>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const blocked = info.compliance_status === "NON_COMPLIANT";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="border-b border-slate-200 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <Shield className="h-6 w-6 text-indigo-600" />
          <div className="flex-1">
            <div className="text-xs text-slate-500">Apex Nexus Secure Vendor Portal</div>
            <div className="font-bold flex items-center gap-2">
              <Building2 className="h-4 w-4" /> {info.vendor_name}
              <span className="text-xs font-normal text-slate-500">· {info.vendor_code}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500 flex items-center gap-1 justify-end">
              <Clock className="h-3 w-3" /> Expires {new Date(info.expires_at).toLocaleDateString()}
            </div>
            {info.project_name && <div className="text-xs text-slate-500">→ {info.project_name}</div>}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {blocked && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <Ban className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-red-800">Submissions are currently blocked</div>
                <div className="text-sm text-red-700 mt-1">{info.blocked_reason}</div>
                <p className="text-xs text-red-700/80 mt-2">
                  Please refresh the expired eligibility document(s) with your procurement contact.
                  Once updated, submissions will re-open automatically.
                </p>
              </div>
            </div>
          </div>
        )}
        {!blocked && info.compliance_status === "EXPIRING" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <AlertTriangle className="inline h-4 w-4 mr-1" />
            <strong>Heads up:</strong> {info.blocked_reason}. Please plan to send updated documents soon.
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-bold text-slate-900 mb-1">Welcome</h2>
          <p className="text-sm text-slate-600">
            Please upload the documents requested below. Every file is automatically scanned for
            personal data and compliance issues <strong>before</strong> it is shared with our team.
            You don&apos;t need an account — just this link.
          </p>
          {info.required_docs && info.required_docs.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {info.required_docs.map((d, i) => (
                <li key={i} className="flex items-center gap-2 text-slate-700">
                  <FileText className="h-4 w-4 text-indigo-500" /> {d}
                </li>
              ))}
            </ul>
          )}
        </div>

        {info.compliance_docs && info.compliance_docs.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-indigo-600" /> Your eligibility documents
            </h3>
            <div className="space-y-2">
              {info.compliance_docs.map((d, i) => {
                const tone = d.status === "VALID" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                  d.status === "EXPIRING_SOON" ? "bg-amber-50 text-amber-700 border-amber-200" :
                  "bg-red-50 text-red-700 border-red-200";
                return (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="font-mono text-xs px-2 py-0.5 rounded-full border bg-slate-100 text-slate-700 border-slate-200">
                      {d.doc_type}
                    </span>
                    <span className="text-slate-800">{d.label || ""}</span>
                    <span className="ml-auto text-xs text-slate-500">
                      expires {new Date(d.expires_on).toLocaleDateString()}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${tone}`}>
                      {d.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="font-bold mb-3 flex items-center gap-2">
            <Upload className="h-4 w-4 text-indigo-600" /> Upload a document
          </h3>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            disabled={blocked}
            title="Select file"
            className="block w-full text-sm text-slate-700 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 disabled:opacity-50"
          />
          {file && (
            <div className="text-xs text-slate-500 mt-2">
              {file.name} · {(file.size / 1024).toFixed(1)} KB
            </div>
          )}
          <button
            disabled={!file || uploading || blocked}
            onClick={upload}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Submit
          </button>
          {blocked && (
            <p className="mt-2 text-xs text-red-700">
              Uploading is disabled until your eligibility documents are refreshed.
            </p>
          )}
        </div>

        {uploads.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="font-bold mb-3">Your submissions</h3>
            <div className="space-y-2">
              {uploads.map((u, i) => {
                const rejected = u.status === "REJECTED" || u.status === "BLOCKED";
                const pending = u.status === "QUARANTINED";
                const ok = u.status === "RECEIVED";
                const pii = u.piiFindings && Object.keys(u.piiFindings).length > 0;
                const comp = u.complianceFindings && u.complianceFindings.length > 0;

                const banner = rejected ? "border-red-200 bg-red-50"
                  : pending ? "border-amber-200 bg-amber-50"
                  : "border-emerald-200 bg-emerald-50";
                const Icon = rejected ? XCircle : pending ? AlertTriangle : CheckCircle2;
                const iconColor = rejected ? "text-red-600" : pending ? "text-amber-600" : "text-emerald-600";

                return (
                  <div key={i} className={`rounded-md border p-3 text-sm ${banner}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Icon className={`h-4 w-4 ${iconColor}`} />
                      <span className="font-medium text-slate-900">{u.filename}</span>
                      {u.classification && (
                        <span className="text-xs px-2 py-0.5 rounded-full border bg-white text-slate-700 border-slate-200">
                          {u.classification}
                        </span>
                      )}
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                          ok ? "bg-white text-emerald-700 border-emerald-300"
                            : pending ? "bg-white text-amber-700 border-amber-300"
                            : "bg-white text-red-700 border-red-300"
                        }`}
                      >
                        {ok ? "Received — pending review"
                          : pending ? "Held for review"
                          : u.status === "BLOCKED" ? "Blocked — compliance"
                          : "Rejected"}
                      </span>
                    </div>
                    {u.message && <div className="mt-2 text-xs text-slate-700">{u.message}</div>}
                    {(pii || comp) && (
                      <div className="mt-2 text-xs text-slate-700 space-y-1">
                        {pii && (
                          <div>
                            Personal data detected: <strong>{Object.keys(u.piiFindings || {}).join(", ")}</strong>.
                            {rejected
                              ? " Please redact and resubmit — this file was not kept."
                              : " The document is held for human review before being shared internally."}
                          </div>
                        )}
                        {comp && <div>Compliance flags: {u.complianceFindings!.join(", ")}</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="text-center text-xs text-slate-400">
          Powered by <strong className="text-slate-600">Apex Nexus</strong> · Secure vendor intake ·
          Every view and upload is logged and watermarked.
        </div>
      </div>
    </div>
  );
}
