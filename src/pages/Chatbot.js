import React, { useState, useRef, useEffect, useMemo } from 'react';
import { generateResponse, SUGGESTIONS, RULE_CORPUS, BUILD_SPECS, INDEXED_DOCS, DOMAINS } from '../services/hslKnowledge';

// ── Helper: format markdown-ish text with line breaks and code ───────────────
function FormattedText({ text }) {
  return (
    <p className="text-[13px] leading-relaxed text-slate-200 whitespace-pre-wrap">{text}</p>
  );
}

// ── Calculation card ────────────────────────────────────────────────────────
function CalculationCard({ calc }) {
  const verdict = calc.result?.verdict;
  const vColor = verdict === 'PASS' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    : verdict === 'FAIL' ? 'text-red-400 bg-red-500/10 border-red-500/30'
    : 'text-sky-400 bg-sky-500/10 border-sky-500/30';
  return (
    <div className="mt-3 bg-slate-950/40 border border-app-border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-bold text-white uppercase tracking-widest">{calc.title}</div>
        {verdict && <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${vColor}`}>{verdict}</span>}
      </div>
      <div className="text-[11px] text-slate-400">
        <span className="text-slate-500">Formula:</span> <span className="font-mono text-slate-300">{calc.formula}</span>
      </div>
      {Object.keys(calc.inputs || {}).length > 0 && (
        <div className="text-[11px] text-slate-400">
          <span className="text-slate-500">Inputs:</span>{' '}
          {Object.entries(calc.inputs).map(([k, v]) => (
            <span key={k} className="font-mono mr-2 text-slate-300">{k}={v}</span>
          ))}
        </div>
      )}
      <div className="text-2xl font-bold text-sky-400 font-mono">
        {calc.result.value} <span className="text-sm text-slate-400 font-normal">{calc.result.unit}</span>
      </div>
      {calc.reference && (
        <div className="text-[10px] text-slate-500">Reference: <span className="text-slate-400">{calc.reference}</span></div>
      )}
    </div>
  );
}

// ── Rule citation card ──────────────────────────────────────────────────────
function RuleCard({ rule }) {
  return (
    <div className="mt-2 bg-slate-950/40 border border-app-border rounded-lg p-3">
      <div className="flex items-start gap-2 mb-1">
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 uppercase tracking-widest">{rule.society}</span>
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 uppercase tracking-widest">{rule.domain}</span>
        <span className="text-[10px] text-slate-500 font-mono">{rule.id}</span>
      </div>
      <h4 className="text-[12px] font-bold text-white mb-1">{rule.title}</h4>
      <p className="text-[11px] text-slate-400 leading-relaxed">{rule.excerpt}</p>
    </div>
  );
}

// ── Document diff card ──────────────────────────────────────────────────────
function DiffCard({ diff }) {
  const sevColor = (s) => s === 'critical' ? 'text-red-400' : s === 'high' ? 'text-orange-400' : s === 'medium' ? 'text-amber-400' : 'text-sky-400';
  return (
    <div className="mt-3 bg-slate-950/40 border border-app-border rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-app-border bg-white/[0.02]">
        <span className="text-[11px] font-bold text-white uppercase tracking-widest">Document Diff — {diff.length} changes</span>
      </div>
      <div className="divide-y divide-white/[0.05]">
        {diff.map((row, i) => (
          <div key={i} className="px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-slate-200">{row.section}</span>
              <span className={`text-[9px] font-bold uppercase ${sevColor(row.severity)}`}>{row.severity}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-300 border border-red-500/20">A: {row.a}</span>
              <span className="text-slate-600">→</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">B: {row.b}</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1 italic">{row.impact}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Spec card ───────────────────────────────────────────────────────────────
function SpecCard({ spec }) {
  return (
    <div className="mt-3 bg-slate-950/40 border border-app-border rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-app-border bg-white/[0.02] flex items-center justify-between">
        <span className="text-[11px] font-bold text-white">{spec.title}</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold uppercase">{spec.revision}</span>
      </div>
      <div className="p-3 space-y-2.5">
        {spec.sections.map((s, i) => (
          <div key={i}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-sky-400 mb-0.5">{s.heading}</div>
            <p className="text-[11px] text-slate-300 leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>
      <div className="px-3 py-2 border-t border-app-border bg-white/[0.02] flex items-center gap-2">
        <button className="text-[10px] px-2 py-1 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 font-semibold hover:bg-sky-500/25 transition-colors">Export .docx</button>
        <button className="text-[10px] px-2 py-1 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold hover:bg-emerald-500/25 transition-colors">Export .pdf</button>
        <span className="ml-auto text-[10px] text-slate-500 italic">draft — pending engineer review</span>
      </div>
    </div>
  );
}

// ── A single chat message ───────────────────────────────────────────────────
function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
        isUser
          ? 'bg-slate-700 text-slate-200'
          : 'bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-lg'
      }`}>
        {isUser ? 'U' : 'AI'}
      </div>
      <div className={`max-w-3xl ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`rounded-2xl px-4 py-2.5 ${isUser
          ? 'bg-slate-700/60 text-slate-100 rounded-tr-sm'
          : 'bg-app-panel border border-app-border rounded-tl-sm'}`}>
          <FormattedText text={msg.content} />

          {msg.response?.calculation && <CalculationCard calc={msg.response.calculation} />}

          {msg.response?.rules && msg.response.rules.length > 0 && (
            <div className="mt-2">
              {msg.response.rules.map(r => <RuleCard key={r.id} rule={r} />)}
            </div>
          )}

          {msg.response?.diff && <DiffCard diff={msg.response.diff} />}

          {msg.response?.spec && <SpecCard spec={msg.response.spec} />}

          {msg.response?.citations && msg.response.citations.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {msg.response.citations.map((c, i) => (
                <span key={i} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/30">{c}</span>
              ))}
            </div>
          )}
        </div>
        <div className="text-[9px] text-slate-600 mt-1 px-2">
          {msg.timestamp}
          {!isUser && msg.latencyMs && <span> · {msg.latencyMs} ms · local inference</span>}
        </div>
      </div>
    </div>
  );
}

// ── Main Chatbot page ───────────────────────────────────────────────────────
export default function Chatbot() {
  const [messages, setMessages] = useState(() => [
    {
      id: 'welcome',
      role: 'assistant',
      content: "Welcome to the HSL Design Assistant. I'm an air-gapped, domain-aware AI for shipbuilding. I can interpret Class (IRS/DNV/ABS/IACS), IMO, IEC and Naval rules, validate Build Specifications, generate technical specs, analyse scanned manuals, perform quick engineering calculations and cross-reference requirements across documents.\n\nTry one of the suggested prompts on the right, or ask anything in natural language.",
      timestamp: new Date().toLocaleTimeString('en-IN', { hour12: false }),
    },
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [contextDomain, setContextDomain] = useState('All');
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const send = (text) => {
    const q = (text ?? input).trim();
    if (!q) return;
    const now = Date.now();
    const userMsg = {
      id: 'u' + now,
      role: 'user',
      content: q,
      timestamp: new Date().toLocaleTimeString('en-IN', { hour12: false }),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    // Simulate local model latency 700–1300 ms
    const lat = 700 + Math.floor(Math.random() * 600);
    setTimeout(() => {
      const resp = generateResponse(q);
      const reply = {
        id: 'a' + Date.now(),
        role: 'assistant',
        content: resp.summary,
        response: resp,
        timestamp: new Date().toLocaleTimeString('en-IN', { hour12: false }),
        latencyMs: lat,
      };
      setMessages(prev => [...prev, reply]);
      setIsThinking(false);
    }, lat);
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const stats = useMemo(() => ({
    rules: RULE_CORPUS.length,
    docs: INDEXED_DOCS.length,
    specs: BUILD_SPECS.length,
    msgs: messages.filter(m => m.role === 'user').length,
  }), [messages]);

  return (
    <div className="h-full flex gap-3">
      {/* ── Left sidebar: context + capabilities ──────────────────────────── */}
      <aside className="w-64 shrink-0 flex flex-col gap-3 overflow-y-auto">
        <div className="bg-app-panel border border-app-border rounded-xl p-3">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Domain Focus</div>
          <select
            value={contextDomain}
            onChange={e => setContextDomain(e.target.value)}
            className="w-full text-[11px] px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-200"
          >
            <option value="All">All domains</option>
            {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div className="bg-app-panel border border-app-border rounded-xl p-3">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Capabilities</div>
          <ul className="space-y-1.5 text-[11px] text-slate-300">
            {[
              ['📖', 'Rule interpretation'],
              ['🔍', 'Document Q&A'],
              ['📊', 'Document comparison'],
              ['📝', 'Specification drafting'],
              ['🧮', 'Engineering calculations'],
              ['🔗', 'Cross-reference'],
              ['🖼', 'Scanned PDF / OCR'],
            ].map(([i, t]) => (
              <li key={t} className="flex items-center gap-2">
                <span>{i}</span><span>{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-app-panel border border-app-border rounded-xl p-3">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Session</div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div><div className="text-base font-bold text-sky-400">{stats.rules}</div><div className="text-[9px] text-slate-500 uppercase">Rules</div></div>
            <div><div className="text-base font-bold text-emerald-400">{stats.docs}</div><div className="text-[9px] text-slate-500 uppercase">Docs</div></div>
            <div><div className="text-base font-bold text-violet-400">{stats.specs}</div><div className="text-[9px] text-slate-500 uppercase">Specs</div></div>
            <div><div className="text-base font-bold text-amber-400">{stats.msgs}</div><div className="text-[9px] text-slate-500 uppercase">Queries</div></div>
          </div>
        </div>

        <div className="bg-emerald-500/[0.04] border border-emerald-500/30 rounded-xl p-3 text-[10px] text-emerald-300 leading-relaxed">
          <div className="flex items-center gap-1.5 font-bold mb-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            OFFLINE & SECURE
          </div>
          All inference runs on HSL infrastructure. No queries, documents or telemetry leave the intranet.
        </div>
      </aside>

      {/* ── Main chat panel ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-app-panel border border-app-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-app-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">AI</div>
            <div>
              <div className="text-sm font-bold text-white">HSL Design Assistant</div>
              <div className="text-[10px] text-slate-500">Domain: <span className="text-sky-400">{contextDomain}</span></div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="flex items-center gap-1 text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Local model online</span>
            <button onClick={() => setMessages(prev => [prev[0]])} className="px-2 py-1 rounded text-slate-400 hover:text-white hover:bg-white/[0.04] border border-app-border">Clear</button>
          </div>
        </div>

        {/* Chat scroll area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map(m => <Message key={m.id} msg={m} />)}
          {isThinking && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">AI</div>
              <div className="bg-app-panel border border-app-border rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                <span className="text-[10px] text-slate-500 ml-1">Retrieving from local index…</span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Composer */}
        <div className="border-t border-app-border p-3">
          <div className="flex items-end gap-2 bg-slate-900/40 border border-slate-700 rounded-xl px-3 py-2 focus-within:border-sky-500/50 transition-colors">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              rows={1}
              placeholder="Ask about a rule, validate a spec, generate documentation, run a calculation…"
              className="flex-1 bg-transparent text-[13px] text-slate-200 placeholder-slate-500 outline-none resize-none max-h-32 py-1"
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || isThinking}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500 text-white text-[11px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex items-center gap-1"
            >
              Send
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </button>
          </div>
          <div className="text-[10px] text-slate-600 mt-1.5 px-1">Enter to send · Shift+Enter for new line · All processing stays on-prem</div>
        </div>
      </div>

      {/* ── Right sidebar: suggested prompts + recent ─────────────────────── */}
      <aside className="w-72 shrink-0 flex flex-col gap-3 overflow-y-auto">
        <div className="bg-app-panel border border-app-border rounded-xl p-3">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Suggested prompts</div>
          <div className="space-y-1.5">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => send(s.text)}
                className="w-full text-left text-[11px] px-2.5 py-2 rounded-lg bg-white/[0.02] border border-app-border hover:bg-sky-500/[0.06] hover:border-sky-500/30 hover:text-sky-200 text-slate-300 transition-colors flex items-start gap-2"
              >
                <span className="shrink-0">{s.icon}</span>
                <span className="leading-snug">{s.text}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-app-panel border border-app-border rounded-xl p-3">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Quick reference</div>
          <div className="space-y-1.5 text-[10px]">
            {RULE_CORPUS.slice(0, 4).map(r => (
              <button
                key={r.id}
                onClick={() => send(`Explain ${r.id}`)}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-white/[0.03] text-slate-300"
              >
                <div className="font-mono font-bold text-sky-400">{r.id}</div>
                <div className="text-slate-500 truncate">{r.title}</div>
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
