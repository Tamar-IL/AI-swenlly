'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ModelInfo } from '@/lib/providers/types';
import type { Receipt as ReceiptData } from '@/lib/cost/cost';
import { Message, type ChatTurn } from '@/components/Message';
import { Council, type CouncilAnswer } from '@/components/Council';
import { ScopeControl } from '@/components/ScopeControl';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CapMeter } from '@/components/CapMeter';
import { usd } from '@/lib/format';

type Item =
  | { kind: 'msg'; turn: ChatTurn }
  | { kind: 'council'; id: string; answers: CouncilAnswer[]; synthesis?: CouncilAnswer; note?: string };

function newId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const SUGGESTIONS = [
  'What is the capital of France?',
  'Write a Python function to reverse a linked list.',
  'Analyze the tradeoffs between microservices and a monolith.',
  'Write a short poem about autumn leaves.',
];

export default function Home() {
  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [override, setOverride] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [spent, setSpent] = useState(0);
  const [cap, setCap] = useState(0.05);
  const [capped, setCapped] = useState<string | null>(null);

  const transcriptRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Boot: session id + model catalog.
  useEffect(() => {
    let sid = '';
    try {
      sid = localStorage.getItem('conductor-session') ?? '';
      if (!sid) {
        sid = newId();
        localStorage.setItem('conductor-session', sid);
      }
    } catch {
      sid = newId();
    }
    setSessionId(sid);

    fetch('/api/models')
      .then((r) => r.json())
      .then((d) => {
        setModels(d.models ?? []);
        if (typeof d.capUsd === 'number') setCap(d.capUsd);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' });
  }, [items]);

  const savingsToDate = useMemo(
    () =>
      items.reduce((sum, it) => {
        if (it.kind === 'msg' && it.turn.receipt) return sum + it.turn.receipt.savedUsd;
        return sum;
      }, 0),
    [items],
  );

  async function send(text: string) {
    const prompt = text.trim();
    if (!prompt || busy || !sessionId) return;
    setCapped(null);
    setInput('');

    const userTurn: ChatTurn = { id: newId(), role: 'user', content: prompt };
    const pendingId = newId();
    const pending: ChatTurn = { id: pendingId, role: 'assistant', content: '', pending: true };
    setItems((prev) => [...prev, { kind: 'msg', turn: userTurn }, { kind: 'msg', turn: pending }]);
    setBusy(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, sessionId, overrideModelId: override ?? undefined }),
      });
      const data = await res.json();

      if (data.blocked) {
        // Remove the pending assistant bubble; surface the gate.
        setItems((prev) => prev.filter((it) => !(it.kind === 'msg' && it.turn.id === pendingId)));
        setCapped(data.message ?? 'Session cost cap reached.');
        if (data.session) setSpent(data.session.spentUsd);
        return;
      }

      const receipt = data.receipt as ReceiptData;
      setItems((prev) =>
        prev.map((it) =>
          it.kind === 'msg' && it.turn.id === pendingId
            ? { kind: 'msg', turn: { ...it.turn, content: data.answer ?? '', receipt, pending: false } }
            : it,
        ),
      );
      if (data.session) {
        setSpent(data.session.spentUsd);
        setCap(data.session.capUsd);
      }
    } catch {
      setItems((prev) =>
        prev.map((it) =>
          it.kind === 'msg' && it.turn.id === pendingId
            ? { kind: 'msg', turn: { ...it.turn, content: '⚠️ The model call failed. Please retry.', pending: false } }
            : it,
        ),
      );
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  async function convene() {
    const prompt = input.trim();
    if (!prompt || busy || !sessionId) return;
    setCapped(null);
    setInput('');
    const userTurn: ChatTurn = { id: newId(), role: 'user', content: prompt };
    setItems((prev) => [...prev, { kind: 'msg', turn: userTurn }]);
    setBusy(true);
    try {
      const res = await fetch('/api/council', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, sessionId }),
      });
      const data = await res.json();
      if (data.blocked) {
        setCapped(data.message ?? 'Session cost cap reached.');
      } else if (data.refused) {
        setItems((prev) => [
          ...prev,
          { kind: 'msg', turn: { id: newId(), role: 'assistant', content: data.message ?? "I can't help with that request." } },
        ]);
      } else if (data.answers?.length) {
        setItems((prev) => [...prev, { kind: 'council', id: newId(), answers: data.answers, synthesis: data.synthesis, note: data.message }]);
      }
      if (data.session) {
        setSpent(data.session.spentUsd);
        setCap(data.session.capUsd);
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
      e.preventDefault();
      convene();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  const empty = items.length === 0;

  return (
    <div className="grid h-screen grid-cols-1 bg-bg text-text md:grid-cols-[280px_1fr]">
      {/* Sidebar */}
      <aside className="hidden flex-col border-r border-border bg-surface md:flex">
        <div className="p-4">
          <button
            onClick={() => {
              setItems([]);
              setCapped(null);
            }}
            className="flex w-full items-center gap-2 rounded-sm border border-border-strong px-3 py-2 text-[13px] font-medium text-text-secondary transition hover:border-accent hover:text-text"
          >
            <span aria-hidden>＋</span> New conversation
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4">
          <p className="px-1 py-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">This session</p>
          <div className="rounded-sm bg-accent-soft px-3 py-2 text-[13px] text-text">Current chat</div>
        </div>
        <div className="border-t border-border p-4">
          <p className="text-[12px] text-text-muted">You've saved</p>
          <p className="font-mono tnum text-[20px] font-semibold text-savings">{usd(savingsToDate)}</p>
          <p className="text-[12px] text-text-muted">by routing instead of always using the strong model</p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border bg-bg/80 px-6 backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-accent-soft text-accent" aria-hidden>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M4 12h2M9 7v10M14 4v16M19 9v6" />
              </svg>
            </span>
            <h1 className="text-[15px] font-semibold tracking-[-0.01em]">The Conductor</h1>
            <span className="hidden text-[12px] text-text-muted sm:inline">· one answer, many minds</span>
          </div>
          <div className="flex items-center gap-2">
            <ScopeControl models={models} value={override} onChange={setOverride} />
            <ThemeToggle />
          </div>
        </header>

        {/* Transcript */}
        <div ref={transcriptRef} className="scroll-thin flex-1 overflow-y-auto">
          <div className={`mx-auto px-6 py-8 ${items.some((i) => i.kind === 'council') ? 'max-w-council' : 'max-w-column'}`}>
            {empty ? (
              <EmptyState onPick={(s) => send(s)} />
            ) : (
              <div className="space-y-6">
                {items.map((it) =>
                  it.kind === 'msg' ? (
                    <Message key={it.turn.id} turn={it.turn} />
                  ) : (
                    <Council key={it.id} answers={it.answers} synthesis={it.synthesis} note={it.note} />
                  ),
                )}
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="composer-fade relative px-6 pb-5">
          <div className="mx-auto max-w-column">
            {capped && (
              <div role="alert" className="mb-3 flex gap-3 rounded-lg border border-danger/40 bg-danger-bg p-4">
                <span className="text-danger" aria-hidden>⛔</span>
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-text">Session cost cap reached ({usd(cap)})</p>
                  <p className="text-[12px] text-text-secondary">{capped}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        const cheap = models.find((m) => m.free);
                        if (cheap) setOverride(cheap.id);
                        setCapped(null);
                      }}
                      className="rounded-sm border border-border-strong bg-surface px-3 py-1.5 text-[12px] font-medium transition hover:border-accent"
                    >
                      Switch to Free-only
                    </button>
                    <button
                      onClick={() => {
                        try {
                          const sid = newId();
                          localStorage.setItem('conductor-session', sid);
                          setSessionId(sid);
                        } catch {}
                        setSpent(0);
                        setItems([]);
                        setCapped(null);
                      }}
                      className="rounded-sm px-3 py-1.5 text-[12px] font-medium text-accent transition hover:bg-surface-sunken"
                    >
                      Start a new session
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-border-strong bg-surface shadow-md transition focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/15">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder="Ask anything — the Conductor picks the right AI for it…"
                className="max-h-[200px] w-full resize-none bg-transparent px-4 py-3.5 text-[16px] leading-[26px] text-text placeholder:text-text-muted focus:outline-none"
                disabled={busy}
              />
              <div className="flex items-center justify-between px-3 pb-3">
                <button
                  onClick={convene}
                  disabled={busy || !input.trim()}
                  title="Convene the council — ask 3 models side by side (⌘⇧⏎)"
                  className="rounded-sm px-2.5 py-1.5 text-[12px] font-medium text-text-secondary transition hover:bg-surface-sunken disabled:opacity-40"
                >
                  ⑂ Convene council
                </button>
                <button
                  onClick={() => send(input)}
                  disabled={busy || !input.trim()}
                  aria-label="Send"
                  className="grid h-9 w-9 place-items-center rounded-full bg-accent text-text-inverse shadow-accent transition hover:bg-accent-hover active:scale-95 disabled:bg-border-strong disabled:shadow-none"
                >
                  {busy ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-text-inverse border-t-transparent" aria-hidden />
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between px-1">
              <span className="text-[12px] text-text-muted">
                {override ? 'Manual model pinned · routing off' : 'Auto-routing on · cheapest model that answers well'}
              </span>
              <CapMeter spent={spent} cap={cap} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <div className="mb-5 grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-accent">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M4 12h2M9 7v10M14 4v16M19 9v6" />
        </svg>
      </div>
      <h2 className="text-[30px] font-bold leading-9 tracking-[-0.02em]">One answer, many minds</h2>
      <p className="mt-2 max-w-md text-[15px] text-text-secondary">
        Ask anything. The Conductor routes each question to the cheapest AI that answers it well — and shows
        you the receipt: which AI answered, and what it saved you.
      </p>
      <div className="mt-8 grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-md border border-border bg-surface px-4 py-3 text-left text-[13px] text-text-secondary transition hover:border-accent hover:text-text"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
