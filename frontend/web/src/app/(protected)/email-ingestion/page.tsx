'use client';

import { useEffect, useState, useCallback } from 'react';
import { emailIngestionApi } from '@/lib/api';
import {
  Mail, Plus, Trash2, Power, PowerOff, RefreshCw, Play,
  Settings, Filter, ChevronDown, ChevronUp, X, Check, Pencil,
} from 'lucide-react';

interface Rule {
  id: string;
  configId: string;
  ruleName: string;
  ruleType: string;
  ruleValue: string;
  targetFolderId: string | null;
  enabled: boolean;
  createdAt: string;
}

interface Config {
  id: string;
  name: string;
  protocol: string;
  imapHost: string;
  imapPort: number;
  ewsUrl: string;
  username: string;
  folderName: string;
  useSsl: boolean;
  pollInterval: number;
  enabled: boolean;
  targetFolderId: string | null;
  createdAt: string;
  updatedAt: string;
  rules: Rule[];
}

const RULE_TYPES = [
  { value: 'FROM_CONTAINS', label: 'From Contains', placeholder: 'e.g. kuda' },
  { value: 'FROM_EQUALS', label: 'From Equals', placeholder: 'e.g. kuda@example.com' },
  { value: 'SUBJECT_CONTAINS', label: 'Subject Contains', placeholder: 'e.g. invoice' },
  { value: 'SUBJECT_EQUALS', label: 'Subject Equals', placeholder: 'e.g. Monthly Report' },
  { value: 'HAS_ATTACHMENT', label: 'Has Attachment', placeholder: '' },
];

export default function EmailIngestionPage() {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedConfig, setExpandedConfig] = useState<string | null>(null);
  const [polling, setPolling] = useState<string | null>(null);
  const [pollResult, setPollResult] = useState<string | null>(null);

  // New config form
  const [form, setForm] = useState({
    name: '', protocol: 'IMAP', imapHost: '', imapPort: 993, ewsUrl: '',
    username: '', password: '', folderName: 'INBOX', useSsl: true, pollInterval: 5,
  });

  // New rule form
  const [ruleForm, setRuleForm] = useState({ ruleName: '', ruleType: 'FROM_CONTAINS', ruleValue: '' });
  const [addingRule, setAddingRule] = useState<string | null>(null);

  // Edit config
  const [editingConfig, setEditingConfig] = useState<Config | null>(null);
  const [editForm, setEditForm] = useState({
    name: '', protocol: 'IMAP', imapHost: '', imapPort: 993, ewsUrl: '',
    username: '', password: '', folderName: 'INBOX', useSsl: true, pollInterval: 5,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await emailIngestionApi.getConfigs();
      const data = res.data?.data ?? res.data;
      setConfigs(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreateConfig = async () => {
    if (!form.name || !form.username || !form.password) return;
    if (form.protocol === 'IMAP' && !form.imapHost) return;
    if (form.protocol === 'EWS' && !form.ewsUrl) return;
    try {
      await emailIngestionApi.createConfig(form);
      setShowCreate(false);
      setForm({ name: '', protocol: 'IMAP', imapHost: '', imapPort: 993, ewsUrl: '', username: '', password: '', folderName: 'INBOX', useSsl: true, pollInterval: 5 });
      load();
    } catch { /* silent */ }
  };

  const handleToggleConfig = async (id: string) => {
    try { await emailIngestionApi.toggleConfig(id); load(); } catch { /* silent */ }
  };

  const handleDeleteConfig = async (id: string) => {
    if (!confirm('Delete this email configuration and all its rules?')) return;
    try { await emailIngestionApi.deleteConfig(id); load(); } catch { /* silent */ }
  };

  const handlePollNow = async (id: string) => {
    setPolling(id);
    setPollResult(null);
    try {
      const res = await emailIngestionApi.pollNow(id);
      const data = res.data?.data ?? res.data;
      setPollResult(`Ingested ${data.documentsIngested} document(s)`);
    } catch (err: any) {
      setPollResult('Poll failed: ' + (err?.response?.data?.message || err.message));
    }
    setPolling(null);
    load();
  };

  const handleAddRule = async (configId: string) => {
    if (!ruleForm.ruleName || !ruleForm.ruleType) return;
    try {
      await emailIngestionApi.addRule(configId, ruleForm);
      setAddingRule(null);
      setRuleForm({ ruleName: '', ruleType: 'FROM_CONTAINS', ruleValue: '' });
      load();
    } catch { /* silent */ }
  };

  const handleToggleRule = async (ruleId: string) => {
    try { await emailIngestionApi.toggleRule(ruleId); load(); } catch { /* silent */ }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try { await emailIngestionApi.deleteRule(ruleId); load(); } catch { /* silent */ }
  };

  const startEditing = (cfg: Config) => {
    setEditingConfig(cfg);
    setEditForm({
      name: cfg.name, protocol: cfg.protocol || 'IMAP',
      imapHost: cfg.imapHost || '', imapPort: cfg.imapPort || 993,
      ewsUrl: cfg.ewsUrl || '', username: cfg.username || '',
      password: '', folderName: cfg.folderName || 'INBOX',
      useSsl: cfg.useSsl ?? true, pollInterval: cfg.pollInterval || 5,
    });
  };

  const handleUpdateConfig = async () => {
    if (!editingConfig) return;
    if (!editForm.name || !editForm.username) return;
    if (editForm.protocol === 'IMAP' && !editForm.imapHost) return;
    if (editForm.protocol === 'EWS' && !editForm.ewsUrl) return;
    try {
      const payload: any = { ...editForm };
      if (!payload.password) delete payload.password; // don't overwrite if blank
      await emailIngestionApi.updateConfig(editingConfig.id, payload);
      setEditingConfig(null);
      load();
    } catch { /* silent */ }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Mail className="h-6 w-6 text-blue-600" /> Email Ingestion
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Automatically import documents from email. Set up IMAP or Exchange (EWS) connections and define rules to filter which emails get ingested.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="px-3 py-2 text-sm border rounded-lg hover:bg-slate-50 flex items-center gap-1">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1">
            <Plus className="h-4 w-4" /> Add Mailbox
          </button>
        </div>
      </div>

      {/* Poll result toast */}
      {pollResult && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex justify-between items-center">
          <span>{pollResult}</span>
          <button onClick={() => setPollResult(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Create config modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-4 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Settings className="h-5 w-5 text-blue-600" /> New Email Connection
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Connection Name</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. Work Exchange" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Protocol</label>
                <div className="flex gap-4">
                  {['IMAP', 'EWS'].map(p => (
                    <label key={p} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="protocol" value={p} checked={form.protocol === p}
                        onChange={e => setForm({...form, protocol: e.target.value})}
                        className="accent-blue-600" />
                      <span className="text-sm font-medium text-slate-700">{p === 'EWS' ? 'Exchange (EWS)' : 'IMAP'}</span>
                    </label>
                  ))}
                </div>
              </div>
              {form.protocol === 'IMAP' ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">IMAP Host</label>
                    <input value={form.imapHost} onChange={e => setForm({...form, imapHost: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="imap.gmail.com" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Port</label>
                    <input type="number" value={form.imapPort} onChange={e => setForm({...form, imapPort: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                </>
              ) : (
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">EWS URL</label>
                  <input value={form.ewsUrl} onChange={e => setForm({...form, ewsUrl: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="https://mail.example.com/EWS/Exchange.asmx" />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Username / Email</label>
                <input value={form.username} onChange={e => setForm({...form, username: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm" placeholder={form.protocol === 'EWS' ? 'DOMAIN\\user or user@domain' : 'you@gmail.com'} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Password / App Password</label>
                <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="••••••••" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Folder</label>
                <input value={form.folderName} onChange={e => setForm({...form, folderName: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Poll Interval (min)</label>
                <input type="number" value={form.pollInterval} onChange={e => setForm({...form, pollInterval: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border rounded-lg text-sm" min={1} max={60} />
              </div>
              {form.protocol === 'IMAP' && (
                <div className="col-span-2 flex items-center gap-2">
                  <input type="checkbox" checked={form.useSsl} onChange={e => setForm({...form, useSsl: e.target.checked})}
                    className="rounded" id="ssl" />
                  <label htmlFor="ssl" className="text-sm text-slate-700">Use SSL/TLS</label>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
              <button onClick={handleCreateConfig}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Create Connection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit config modal */}
      {editingConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-4 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Pencil className="h-5 w-5 text-blue-600" /> Edit Connection
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Connection Name</label>
                <input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Protocol</label>
                <div className="flex gap-4">
                  {['IMAP', 'EWS'].map(p => (
                    <label key={p} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="editProtocol" value={p} checked={editForm.protocol === p}
                        onChange={e => setEditForm({...editForm, protocol: e.target.value})}
                        className="accent-blue-600" />
                      <span className="text-sm font-medium text-slate-700">{p === 'EWS' ? 'Exchange (EWS)' : 'IMAP'}</span>
                    </label>
                  ))}
                </div>
              </div>
              {editForm.protocol === 'IMAP' ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">IMAP Host</label>
                    <input value={editForm.imapHost} onChange={e => setEditForm({...editForm, imapHost: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Port</label>
                    <input type="number" value={editForm.imapPort} onChange={e => setEditForm({...editForm, imapPort: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                </>
              ) : (
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">EWS URL</label>
                  <input value={editForm.ewsUrl} onChange={e => setEditForm({...editForm, ewsUrl: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Username / Email</label>
                <input value={editForm.username} onChange={e => setEditForm({...editForm, username: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Password <span className="text-slate-400 font-normal">(leave blank to keep current)</span></label>
                <input type="password" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="••••••••" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Folder</label>
                <input value={editForm.folderName} onChange={e => setEditForm({...editForm, folderName: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Poll Interval (min)</label>
                <input type="number" value={editForm.pollInterval} onChange={e => setEditForm({...editForm, pollInterval: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border rounded-lg text-sm" min={1} max={60} />
              </div>
              {editForm.protocol === 'IMAP' && (
                <div className="col-span-2 flex items-center gap-2">
                  <input type="checkbox" checked={editForm.useSsl} onChange={e => setEditForm({...editForm, useSsl: e.target.checked})}
                    className="rounded" id="editSsl" />
                  <label htmlFor="editSsl" className="text-sm text-slate-700">Use SSL/TLS</label>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditingConfig(null)} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
              <button onClick={handleUpdateConfig}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Config list */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : configs.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border">
          <Mail className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <p className="text-slate-500 mb-1">No email connections configured</p>
          <p className="text-xs text-slate-400">Click "Add Mailbox" to set up automatic email document ingestion</p>
        </div>
      ) : (
        <div className="space-y-4">
          {configs.map(cfg => (
            <div key={cfg.id} className="bg-white rounded-xl border overflow-hidden">
              {/* Config header */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpandedConfig(expandedConfig === cfg.id ? null : cfg.id)}>
                  <div className={`p-2 rounded-lg ${cfg.enabled ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                      {cfg.name}
                      {cfg.enabled && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Active</span>}
                    </h3>
                    <p className="text-xs text-slate-500">
                      <span className="inline-block bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-semibold mr-1">{cfg.protocol || 'IMAP'}</span>
                      {cfg.protocol === 'EWS' ? cfg.ewsUrl : `${cfg.imapHost}:${cfg.imapPort}`} &middot; {cfg.username} &middot; {cfg.folderName} &middot; Every {cfg.pollInterval}min
                    </p>
                  </div>
                  {expandedConfig === cfg.id ? <ChevronUp className="h-4 w-4 text-slate-400 ml-2" /> : <ChevronDown className="h-4 w-4 text-slate-400 ml-2" />}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => startEditing(cfg)}
                    className="px-3 py-1.5 text-xs border rounded-lg hover:bg-slate-50 text-slate-600 flex items-center gap-1">
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                  <button onClick={() => handlePollNow(cfg.id)} disabled={polling === cfg.id}
                    className="px-3 py-1.5 text-xs border rounded-lg hover:bg-blue-50 text-blue-600 flex items-center gap-1 disabled:opacity-50">
                    {polling === cfg.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    Poll Now
                  </button>
                  <button onClick={() => handleToggleConfig(cfg.id)}
                    className={`px-3 py-1.5 text-xs border rounded-lg flex items-center gap-1 ${cfg.enabled ? 'text-amber-600 hover:bg-amber-50' : 'text-green-600 hover:bg-green-50'}`}>
                    {cfg.enabled ? <><PowerOff className="h-3 w-3" /> Disable</> : <><Power className="h-3 w-3" /> Enable</>}
                  </button>
                  <button onClick={() => handleDeleteConfig(cfg.id)}
                    className="p-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Expanded: rules section */}
              {expandedConfig === cfg.id && (
                <div className="border-t bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                      <Filter className="h-4 w-4" /> Ingestion Rules ({cfg.rules?.length || 0})
                    </h4>
                    <button onClick={() => setAddingRule(addingRule === cfg.id ? null : cfg.id)}
                      className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1">
                      <Plus className="h-3 w-3" /> Add Rule
                    </button>
                  </div>

                  {/* Add rule form */}
                  {addingRule === cfg.id && (
                    <div className="bg-white border rounded-lg p-3 space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs text-slate-500 mb-0.5">Rule Name</label>
                          <input value={ruleForm.ruleName} onChange={e => setRuleForm({...ruleForm, ruleName: e.target.value})}
                            className="w-full px-2 py-1.5 border rounded text-sm" placeholder="e.g. Emails from Kuda" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-0.5">Type</label>
                          <select value={ruleForm.ruleType} onChange={e => setRuleForm({...ruleForm, ruleType: e.target.value})}
                            className="w-full px-2 py-1.5 border rounded text-sm bg-white">
                            {RULE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-0.5">Value</label>
                          <input value={ruleForm.ruleValue} onChange={e => setRuleForm({...ruleForm, ruleValue: e.target.value})}
                            className="w-full px-2 py-1.5 border rounded text-sm"
                            placeholder={RULE_TYPES.find(t => t.value === ruleForm.ruleType)?.placeholder}
                            disabled={ruleForm.ruleType === 'HAS_ATTACHMENT'} />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setAddingRule(null)} className="px-3 py-1 text-xs border rounded">Cancel</button>
                        <button onClick={() => handleAddRule(cfg.id)}
                          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1">
                          <Check className="h-3 w-3" /> Save Rule
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Rules list */}
                  {(!cfg.rules || cfg.rules.length === 0) ? (
                    <p className="text-xs text-slate-400 text-center py-4">
                      No rules yet. Add rules like &quot;From Contains kuda&quot; or &quot;Subject Contains invoice&quot; to filter which emails get ingested.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {cfg.rules.map(rule => (
                        <div key={rule.id} className={`flex items-center justify-between bg-white border rounded-lg px-3 py-2 ${!rule.enabled ? 'opacity-50' : ''}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${rule.enabled ? 'bg-green-500' : 'bg-slate-300'}`} />
                            <div>
                              <span className="text-sm font-medium text-slate-800">{rule.ruleName}</span>
                              <span className="ml-2 text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                {RULE_TYPES.find(t => t.value === rule.ruleType)?.label || rule.ruleType}
                              </span>
                              {rule.ruleValue && (
                                <span className="ml-1 text-xs text-blue-600 font-mono">&quot;{rule.ruleValue}&quot;</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleToggleRule(rule.id)}
                              className={`p-1 rounded text-xs ${rule.enabled ? 'text-amber-500 hover:bg-amber-50' : 'text-green-500 hover:bg-green-50'}`}
                              title={rule.enabled ? 'Disable' : 'Enable'}>
                              {rule.enabled ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                            </button>
                            <button onClick={() => handleDeleteRule(rule.id)}
                              className="p-1 rounded text-red-400 hover:bg-red-50 text-xs">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* How it works info */}
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mt-2">
                    <p className="text-xs text-blue-700">
                      <strong>How it works:</strong> The system polls this mailbox every {cfg.pollInterval} minutes. When an email matches
                      any enabled rule, its attachments are automatically saved as documents in the ECM. If no attachments exist, the email
                      body is saved as a text file. All ingested documents go through the full pipeline including search indexing and PII detection.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
