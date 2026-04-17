'use client';

import { useEffect, useState } from 'react';
import { documentApi, jurisdictionApi, projectApi } from '@/lib/api';
import type { Document, Jurisdiction, JurisdictionRetentionRule, Project } from '@/lib/types';
import { X, Shield, Clock, Lock, AlertTriangle, Info, BookOpen, Loader2, Save, Timer } from 'lucide-react';

interface Props {
  document: Document;
  projectId?: string;
  onClose: () => void;
  onUpdate?: (doc: Document) => void;
}

export default function DocumentRetentionPanel({ document: doc, projectId, onClose, onUpdate }: Props) {
  const [project, setProject] = useState<Project | null>(null);
  const [jurisdictions, setJurisdictions] = useState<Jurisdiction[]>([]);
  const [rules, setRules] = useState<JurisdictionRetentionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [retentionMode, setRetentionMode] = useState<'years' | 'minutes'>(doc.retentionPeriodMinutes ? 'minutes' : 'years');
  const [retentionValue, setRetentionValue] = useState<number>(
    doc.retentionPeriodMinutes ? doc.retentionPeriodMinutes : (doc.retentionPeriodYears ?? 20)
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const fetches: Promise<void>[] = [
      jurisdictionApi.getJurisdictions().then(res => setJurisdictions(res.data?.data ?? res.data ?? [])),
      jurisdictionApi.getAllRules().then(res => setRules(res.data?.data ?? res.data ?? [])),
    ];
    if (projectId) {
      fetches.push(projectApi.get(projectId).then(res => setProject(res.data?.data ?? res.data)));
    }
    Promise.all(fetches).catch(() => {}).finally(() => setLoading(false));
  }, [projectId]);

  const projectRetention = project?.defaultRetentionPeriodYears;
  const docRetention = doc.retentionPeriodMinutes
    ? `${doc.retentionPeriodMinutes} minutes`
    : `${doc.retentionPeriodYears ?? 20} years`;
  const docRetentionYears = doc.retentionPeriodMinutes
    ? doc.retentionPeriodMinutes / (365 * 24 * 60)
    : (doc.retentionPeriodYears ?? 20);
  const isCompliant = !projectRetention || docRetentionYears >= projectRetention;
  const jurisdictionCode = project?.jurisdictionCode;
  const jurisdictionRules = jurisdictionCode ? rules.filter(r => r.jurisdictionCode === jurisdictionCode) : [];
  const jurisdiction = jurisdictionCode ? jurisdictions.find(j => j.code === jurisdictionCode) : null;

  const handleSaveRetention = async () => {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const payload = retentionMode === 'minutes'
        ? { retentionPeriodMinutes: retentionValue }
        : { retentionPeriodYears: retentionValue };
      const res = await documentApi.updateRetention(doc.id, payload);
      const updated = res.data?.data ?? res.data;
      setSuccess('Retention updated successfully');
      if (onUpdate) onUpdate(updated);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update retention';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  // Calculate max allowed value based on project retention
  const getMaxValue = () => {
    if (!projectRetention) return undefined;
    if (retentionMode === 'years') return projectRetention;
    return projectRetention * 365 * 24 * 60; // convert years to minutes
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-slate-900">Retention & Compliance</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
          </div>
        ) : (
          <div className="p-5 space-y-6">
            {/* Document Info */}
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Document: {doc.title}</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400">Retention Period</span>
                  <p className="font-medium text-slate-700 mt-0.5">{docRetention}</p>
                </div>
                <div>
                  <span className="text-slate-400">Retention Start</span>
                  <p className="font-medium text-slate-700 mt-0.5">
                    {doc.retentionStartDate ? new Date(doc.retentionStartDate).toLocaleDateString() : 'Not started'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Retention Expiry</span>
                  <p className="font-medium text-slate-700 mt-0.5">
                    {doc.retentionExpiry ? new Date(doc.retentionExpiry).toLocaleString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Legal Hold</span>
                  <p className={`font-medium mt-0.5 ${doc.legalHold ? 'text-red-600' : 'text-green-600'}`}>
                    {doc.legalHold ? 'Active' : 'None'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Privacy Redaction</span>
                  <p className={`font-medium mt-0.5 ${doc.privacyRedactionEnabled ? 'text-primary-600' : 'text-slate-500'}`}>
                    {doc.privacyRedactionEnabled ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Status</span>
                  <p className="font-medium text-slate-700 mt-0.5">{doc.status}</p>
                </div>
              </div>
              {doc.legalHold && doc.legalHoldReason && (
                <div className="mt-3 flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded">
                  <Lock className="h-3.5 w-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-700"><strong>Legal Hold Reason:</strong> {doc.legalHoldReason}</p>
                </div>
              )}
            </div>

            {/* Per-Document Retention Editor */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Timer className="h-4 w-4 text-primary-600" />
                <h3 className="text-sm font-semibold text-slate-700">Set Document Retention</h3>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Override the retention period for this specific document.
                {projectRetention && ` Cannot exceed project maximum of ${projectRetention} years.`}
              </p>

              <div className="flex items-center gap-2 mb-3">
                <select
                  value={retentionMode}
                  onChange={e => { setRetentionMode(e.target.value as 'years' | 'minutes'); setRetentionValue(retentionMode === 'years' ? 1 : 1); setError(null); }}
                  className="px-2 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                >
                  <option value="years">Years</option>
                  <option value="minutes">Minutes (demo/testing)</option>
                </select>
                <input
                  type="number"
                  min={1}
                  max={getMaxValue()}
                  value={retentionValue}
                  onChange={e => { setRetentionValue(parseInt(e.target.value) || 1); setError(null); }}
                  className="w-24 px-2 py-1.5 text-xs border border-slate-300 rounded-md"
                />
                <span className="text-xs text-slate-500">{retentionMode}</span>
                <button
                  onClick={handleSaveRetention}
                  disabled={saving}
                  className="ml-auto flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Save
                </button>
              </div>

              {error && (
                <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>
              )}
              {success && (
                <div className="p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">{success}</div>
              )}
            </div>

            {/* Project Default Compliance */}
            {project && (
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-primary-600" />
                  <h3 className="text-sm font-semibold text-slate-700">Project Defaults</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400">Min Retention</span>
                    <p className="font-medium text-slate-700 mt-0.5">
                      {projectRetention ? `${projectRetention} years` : 'Not set'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Jurisdiction</span>
                    <p className="font-medium text-slate-700 mt-0.5">
                      {jurisdiction ? `${jurisdiction.name} (${jurisdiction.code})` : 'Not set'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Privacy Redaction</span>
                    <p className={`font-medium mt-0.5 ${project.privacyRedactionEnabled ? 'text-primary-600' : 'text-slate-500'}`}>
                      {project.privacyRedactionEnabled ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Compliance Category</span>
                    <p className="font-medium text-slate-700 mt-0.5">
                      {project.complianceCategory || 'Not set'}
                    </p>
                  </div>
                </div>

                {/* Compliance Check */}
                <div className="mt-4">
                  {isCompliant ? (
                    <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <Shield className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-green-700">
                        <strong>Compliant:</strong> Document retention ({docRetention}) meets or exceeds project minimum ({projectRetention ?? 'none'} years).
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-red-700">
                        <strong>Non-Compliant:</strong> Document retention ({docRetention}) is below the project minimum ({projectRetention} years). The retention period must be increased.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Jurisdiction Rules */}
            {jurisdictionRules.length > 0 && (
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="h-4 w-4 text-primary-600" />
                  <h3 className="text-sm font-semibold text-slate-700">
                    {jurisdiction?.name} Retention Rules
                  </h3>
                </div>

                <div className="space-y-2">
                  {jurisdictionRules.map(r => {
                    const meetsRule = docRetentionYears >= r.minRetentionYears;
                    return (
                      <div key={r.id} className={`p-3 rounded-lg border text-xs ${
                        meetsRule ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{r.documentCategory}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                            meetsRule ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {meetsRule ? 'COMPLIANT' : 'NON-COMPLIANT'}
                          </span>
                        </div>
                        <p className="text-slate-600">Min: {r.minRetentionYears} years — {r.legalFrameworkName || r.legalFrameworkCode}</p>
                        {r.legalCitation && <p className="text-slate-400 mt-1">{r.legalCitation}</p>}
                        {!meetsRule && r.penaltyInfo && (
                          <p className="text-red-600 mt-1 font-medium">Penalty: {r.penaltyInfo}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* No project info */}
            {!project && (
              <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <Info className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-slate-500">
                  This document is not assigned to a project. Project-level retention defaults and compliance rules will apply when the document is in a project with retention settings configured.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
