"use client";

// In-app demo prompter — the living presenter script. Renders the structured
// steps from lib/demo/prompter-steps.ts (the single source of truth). Platform
// admins pop this out into a small window (a second monitor) and advance with
// Space / arrows. Dark navy/amber theme, namespaced under `.rxp` so it never
// collides with the app's styles.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  STEPS,
  PROMPTER_VERSION,
  type Beat,
  type PrompterStep,
} from "@/lib/demo/prompter-steps";

const CSS = `
.rxp{position:fixed;inset:0;background:#0C1628;color:#EDF2FF;font-family:Inter,-apple-system,sans-serif;display:flex;flex-direction:column;font-size:14px}
.rxp *{box-sizing:border-box}
.rxp-top{display:flex;align-items:center;justify-content:space-between;padding:10px 24px;border-bottom:1px solid #1A3558;background:#0A1422;flex-shrink:0}
.rxp-progress{height:3px;background:#1A3558;flex-shrink:0}
.rxp-bar{height:100%;background:#F07C30;transition:width .3s}
.rxp-content{flex:1;overflow-y:auto;padding:24px 28px;max-width:800px;margin:0 auto;width:100%}
.rxp-bottom{display:flex;align-items:center;justify-content:space-between;padding:14px 28px;border-top:1px solid #1A3558;background:#0A1422;flex-shrink:0}
.rxp-act{font-size:10px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;margin-bottom:7px}
.rxp h1{font-size:20px;font-weight:700;letter-spacing:-.3px;color:#EDF2FF;margin:0}
.rxp-titlerow{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px}
.rxp-time{color:#3D6088;font-size:12px;font-family:monospace;flex-shrink:0;margin-left:16px}
.rxp-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(240,124,48,.12);border:1px solid rgba(240,124,48,.28);border-radius:6px;padding:5px 12px;margin-bottom:14px}
.rxp-tab{color:#F07C30;font-weight:700;font-size:10px;letter-spacing:.12em;font-family:monospace}
.rxp-tabnote{color:#6B9CC8;font-size:12px}
.rxp-dir{display:flex;gap:10px;margin-bottom:10px;align-items:flex-start}
.rxp-dir-arrow{color:#F07C30;font-size:12px;margin-top:2px;flex-shrink:0}
.rxp-dir-txt{color:#6B9CC8;font-size:14px;line-height:1.55}
.rxp-script{border-left:3px solid #F07C30;background:rgba(240,124,48,.05);border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:14px;font-size:17px;line-height:1.75;color:#F8FAFF;white-space:pre-wrap}
.rxp-pivot{background:rgba(240,124,48,.12);border:1.5px solid rgba(240,124,48,.28);border-radius:10px;padding:18px 22px;margin-bottom:14px;text-align:center}
.rxp-pivot-l{color:#6B9CC8;font-size:11px;letter-spacing:.12em;margin-bottom:8px;text-transform:uppercase}
.rxp-pivot-t{color:#F07C30;font-size:20px;font-weight:700;letter-spacing:-.3px;line-height:1.4}
.rxp-pause{background:rgba(212,134,10,.12);border:1px solid rgba(212,134,10,.3);border-radius:8px;padding:12px 16px;margin-bottom:14px;display:flex;gap:10px;align-items:center;color:#D4860A;font-size:14px;font-weight:600}
.rxp-prompt{background:#111E35;border:1px solid #1A3558;border-radius:8px;padding:14px 16px;margin-bottom:14px}
.rxp-prompt-l{color:#6B9CC8;font-size:10px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:8px}
.rxp-prompt-t{font-family:monospace;font-size:15px;color:#F07C30;background:rgba(240,124,48,.08);border-radius:6px;padding:8px 12px;margin-bottom:8px}
.rxp-prompt-e{color:#6B9CC8;font-size:12px}
.rxp-note{color:#3D6088;font-size:12px;margin-bottom:10px;display:flex;gap:8px;padding-left:4px;line-height:1.5}
.rxp-cond{background:rgba(212,134,10,.1);border:1px solid rgba(212,134,10,.25);border-radius:6px;padding:6px 12px;margin-bottom:12px;display:inline-block;color:#D4860A;font-size:11px;font-weight:700;letter-spacing:.08em}
.rxp-trans{margin-top:14px;padding:11px 14px;border-top:1px solid #1A3558;color:#6B9CC8;font-size:13px;font-style:italic;display:flex;gap:8px}
.rxp-item{display:flex;gap:14px;align-items:flex-start;border-radius:8px;padding:12px 16px;cursor:pointer;margin-bottom:8px;border:1px solid #1A3558;background:#111E35}
.rxp-item.done{background:rgba(46,125,94,.12);border-color:rgba(46,125,94,.3)}
.rxp-box{width:20px;height:20px;border-radius:5px;flex-shrink:0;margin-top:1px;border:2px solid #3D6088;background:transparent;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff}
.rxp-box.done{background:#2E7D5E;border-color:#2E7D5E}
.rxp-itxt{font-size:14px;line-height:1.5;color:#EDF2FF}
.rxp-itxt.done{color:#6B9CC8;text-decoration:line-through}
.rxp-alldone{margin-top:16px;padding:12px 16px;background:rgba(46,125,94,.12);border:1px solid rgba(46,125,94,.3);border-radius:8px;color:#2E7D5E;font-size:14px;font-weight:600;text-align:center}
.rxp-qcard{background:#111E35;border:1px solid #1A3558;border-radius:10px;overflow:hidden;margin-bottom:14px}
.rxp-qtop{padding:14px 18px;border-bottom:1px solid #1A3558}
.rxp-qnum{color:#6B9CC8;font-size:10px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px}
.rxp-qtext{color:#EDF2FF;font-size:16px;font-weight:600;line-height:1.45}
.rxp-sigs{padding:12px 18px;display:flex;flex-direction:column;gap:8px}
.rxp-sig{display:flex;gap:10px;align-items:flex-start}
.rxp-sig-if{color:#F07C30;font-size:11px;font-weight:700;margin-top:2px;min-width:110px}
.rxp-sig-do{color:#6B9CC8;font-size:13px;line-height:1.5}
.rxp-closeq{border-left:3px solid #F07C30;background:rgba(240,124,48,.05);border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:10px;color:#EDF2FF;font-size:16px;font-weight:600;line-height:1.5}
.rxp-obj{background:#111E35;border:1px solid #1A3558;border-radius:8px;padding:12px 16px;margin-bottom:8px}
.rxp-obj-q{color:#F07C30;font-size:13px;font-weight:600;margin-bottom:6px}
.rxp-obj-a{color:#6B9CC8;font-size:13px;line-height:1.55}
.rxp-next{border-left:3px solid #2E7D5E;background:rgba(46,125,94,.12);border-radius:0 8px 8px 0;padding:16px 20px;font-size:16px;line-height:1.75;color:#F8FAFF;white-space:pre-wrap}
.rxp-sec{color:#6B9CC8;font-size:11px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:10px;margin-top:6px}
.rxp button{font-family:inherit;cursor:pointer;border:none}
.rxp button:disabled{cursor:default;opacity:.5}
.rxp-back{padding:9px 22px;border-radius:6px;border:1px solid #1A3558;background:transparent;color:#6B9CC8;font-size:14px}
.rxp-nextbtn{padding:9px 22px;border-radius:6px;background:#F07C30;color:#fff;font-size:14px;font-weight:600}
.rxp-nextbtn:disabled{background:#1A3558}
.rxp-kbd{color:#3D6088;font-size:11px}
.rxp-toggle{display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none}
.rxp-track{width:34px;height:18px;border-radius:9px;position:relative;transition:background .2s;flex-shrink:0}
.rxp-knob{position:absolute;top:3px;width:12px;height:12px;border-radius:50%;background:#fff;transition:left .2s}
.rxp-timer{display:flex;align-items:center;gap:8px;padding:5px 12px;border-radius:6px;cursor:pointer;border:1px solid #1A3558;background:#111E35}
.rxp-timer-txt{color:#6B9CC8;font-size:13px;font-family:monospace;min-width:34px}
.rxp-counter{color:#3D6088;font-size:11px;font-family:monospace}
`;

function Beats({ beats }: { beats: Beat[] }) {
  return (
    <>
      {beats.map((b, i) => {
        if (b.t === "d")
          return (
            <div className="rxp-dir" key={i}>
              <span className="rxp-dir-arrow">▶</span>
              <span className="rxp-dir-txt">{b.v}</span>
            </div>
          );
        if (b.t === "s")
          return (
            <div className="rxp-script" key={i}>
              {b.v}
            </div>
          );
        if (b.t === "pv")
          return (
            <div className="rxp-pivot" key={i}>
              <div className="rxp-pivot-l">Say this slowly — pause before and after</div>
              <div className="rxp-pivot-t">&ldquo;{b.v}&rdquo;</div>
            </div>
          );
        if (b.t === "pause")
          return (
            <div className="rxp-pause" key={i}>
              <span>⏸</span>
              <span>{b.v}</span>
            </div>
          );
        if (b.t === "p")
          return (
            <div className="rxp-prompt" key={i}>
              <div className="rxp-prompt-l">Type this into Ask AI</div>
              <div className="rxp-prompt-t">&ldquo;{b.v}&rdquo;</div>
              {b.ex && <div className="rxp-prompt-e">Expected: {b.ex}</div>}
            </div>
          );
        if (b.t === "n")
          return (
            <div className="rxp-note" key={i}>
              <span>📌</span>
              <span>{b.v}</span>
            </div>
          );
        if (b.t === "cond")
          return (
            <div className="rxp-cond" key={i}>
              {b.v}
            </div>
          );
        return null;
      })}
    </>
  );
}

function StepBody({
  step,
  checked,
  toggle,
}: {
  step: PrompterStep;
  checked: Record<string, boolean>;
  toggle: (k: string) => void;
}) {
  if (step.type === "checklist" && step.items) {
    const allDone = step.items.every((_, i) => checked[`${step.id}-${i}`]);
    return (
      <>
        {step.subtitle && (
          <div
            style={{
              color: "#D4860A",
              fontSize: 13,
              marginBottom: 20,
              padding: "8px 14px",
              background: "rgba(212,134,10,0.1)",
              borderRadius: 6,
              display: "inline-block",
            }}
          >
            ⚠ {step.subtitle}
          </div>
        )}
        {step.items.map((item, i) => {
          const k = `${step.id}-${i}`;
          const done = !!checked[k];
          return (
            <div
              key={i}
              className={`rxp-item${done ? " done" : ""}`}
              onClick={() => toggle(k)}
            >
              <div className={`rxp-box${done ? " done" : ""}`}>
                {done ? "✓" : ""}
              </div>
              <div className={`rxp-itxt${done ? " done" : ""}`}>{item}</div>
            </div>
          );
        })}
        {allDone && <div className="rxp-alldone">✓ All set — start the call</div>}
      </>
    );
  }

  if (step.type === "discovery" && step.questions) {
    return (
      <>
        <div className="rxp-dir">
          <span className="rxp-dir-arrow">▶</span>
          <span className="rxp-dir-txt">Ask all three before showing anything.</span>
        </div>
        {step.questions.map((q, i) => (
          <div className="rxp-qcard" key={i}>
            <div className="rxp-qtop">
              <div className="rxp-qnum">Q{i + 1}</div>
              <div className="rxp-qtext">&ldquo;{q.q}&rdquo;</div>
            </div>
            <div className="rxp-sigs">
              {q.sigs.map((sig, j) => (
                <div className="rxp-sig" key={j}>
                  <div className="rxp-sig-if">&ldquo;{sig.i}&rdquo;</div>
                  <div className="rxp-sig-do">→ {sig.d}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </>
    );
  }

  if (step.type === "close") {
    return (
      <>
        {step.beats && <Beats beats={step.beats} />}
        <div className="rxp-sec">Ask these two questions</div>
        {(step.closeQ ?? []).map((q, i) => (
          <div className="rxp-closeq" key={i}>
            &ldquo;{q}&rdquo;
          </div>
        ))}
        <div className="rxp-sec">If they say…</div>
        {(step.objections ?? []).map((o, i) => (
          <div className="rxp-obj" key={i}>
            <div className="rxp-obj-q">&ldquo;{o.q}&rdquo;</div>
            <div className="rxp-obj-a">→ {o.a}</div>
          </div>
        ))}
        <div className="rxp-sec">Next step — say this</div>
        {step.nextStep && <div className="rxp-next">{step.nextStep}</div>}
      </>
    );
  }

  return (
    <>
      {step.beats && <Beats beats={step.beats} />}
      {step.transition && (
        <div className="rxp-trans">
          <span style={{ color: "#F07C30", flexShrink: 0 }}>→ Transition:</span>
          <span>&ldquo;{step.transition}&rdquo;</span>
        </div>
      )}
    </>
  );
}

export default function DemoPrompter() {
  const [idx, setIdx] = useState(0);
  const [singleLoc, setSingleLoc] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const steps = useMemo(
    () => (singleLoc ? STEPS.filter((s) => !s.multiOnly) : STEPS),
    [singleLoc]
  );
  const total = steps.length;
  const i = Math.min(idx, total - 1);
  const step = steps[i];

  const nav = useCallback(
    (dir: number) => setIdx((cur) => Math.min(Math.max(cur + dir, 0), total - 1)),
    [total]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        nav(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        nav(-1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nav]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const pct = total > 1 ? (i / (total - 1)) * 100 : 0;
  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="rxp">
      <style>{CSS}</style>
      <div className="rxp-top">
        <span style={{ color: "#EDF2FF", fontWeight: 700, fontSize: 13, letterSpacing: "-0.2px" }}>
          Rx<span style={{ color: "#F07C30" }}>·</span>Shift Demo{" "}
          <span style={{ color: "#3D6088", fontSize: 10, fontWeight: 400 }}>
            {PROMPTER_VERSION}
          </span>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="rxp-toggle" onClick={() => setSingleLoc((v) => !v)}>
            <div
              className="rxp-track"
              style={{ background: singleLoc ? "#F07C30" : "#1A3558" }}
            >
              <div className="rxp-knob" style={{ left: singleLoc ? 17 : 3 }} />
            </div>
            <span style={{ color: "#6B9CC8", fontSize: 11 }}>Single location</span>
          </div>
          <div
            className="rxp-timer"
            onClick={() => {
              if (running) {
                setRunning(false);
                setSeconds(0);
              } else {
                setSeconds(0);
                setRunning(true);
              }
            }}
            style={
              running
                ? { border: "1px solid rgba(240,124,48,0.28)", background: "rgba(240,124,48,0.12)" }
                : undefined
            }
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: running ? "#F07C30" : "#3D6088",
              }}
            />
            <span className="rxp-timer-txt" style={running ? { color: "#F07C30" } : undefined}>
              {mmss}
            </span>
          </div>
          <span className="rxp-counter">
            {i + 1}/{total}
          </span>
        </div>
      </div>
      <div className="rxp-progress">
        <div className="rxp-bar" style={{ width: `${pct}%` }} />
      </div>
      <div className="rxp-content">
        <div className="rxp-act" style={{ color: step.actColor || "#6B9CC8" }}>
          {step.act || ""}
        </div>
        <div className="rxp-titlerow">
          <h1>{step.title}</h1>
          {step.time && <span className="rxp-time">{step.time}</span>}
        </div>
        {step.tab && (
          <div className="rxp-badge">
            <span className="rxp-tab">{step.tab}</span>
            {step.tabNote && <span className="rxp-tabnote">{step.tabNote}</span>}
          </div>
        )}
        <StepBody
          step={step}
          checked={checked}
          toggle={(k) => setChecked((c) => ({ ...c, [k]: !c[k] }))}
        />
      </div>
      <div className="rxp-bottom">
        <button className="rxp-back" onClick={() => nav(-1)} disabled={i === 0}>
          ← Back
        </button>
        <span className="rxp-kbd">Space or → to advance</span>
        <button
          className="rxp-nextbtn"
          onClick={() => nav(1)}
          disabled={i === total - 1}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
