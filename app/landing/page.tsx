"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import BrandMark from "@/components/BrandMark";

// ─── Flowing background paths ───────────────────────────────────────────────
// 36 layered bézier strokes; the two mirrored groups drift in opposite directions
// via the CSS `drift` keyframes. Deterministic, so it renders identically on server
// and client (no hydration mismatch).
function buildPaths(position: number) {
  const arr: { d: string; w: number; o: number }[] = [];
  for (let i = 0; i < 36; i++) {
    const d =
      `M-${380 - i * 5 * position} -${189 + i * 6}` +
      `C-${380 - i * 5 * position} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${152 - i * 5 * position} ${343 - i * 6}` +
      `C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`;
    arr.push({ d, w: 1 + i * 0.08, o: Math.min(0.55, 0.08 + i * 0.016) });
  }
  return arr;
}

function FlowPaths() {
  const group = (pos: number, cls: string) => (
    <g key={cls} className={cls}>
      {buildPaths(pos).map((p, i) => (
        <path key={i} d={p.d} stroke="#d4c09a" strokeWidth={p.w} strokeOpacity={p.o} fill="none" />
      ))}
    </g>
  );
  return (
    <svg
      className="fpsvg"
      viewBox="-420 -200 1120 1120"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
      width="100%"
      height="100%"
    >
      {group(1, "g1")}
      {group(-1, "g2")}
    </svg>
  );
}

// ─── Step icons ─────────────────────────────────────────────────────────────
function Ic({ children }: { children: ReactNode }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#c8a878"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}
const IcMic = (
  <Ic>
    <rect x={9} y={2} width={6} height={12} rx={3} />
    <path d="M5 10a7 7 0 0 0 14 0" />
    <line x1={12} y1={17} x2={12} y2={22} />
  </Ic>
);
const IcParse = (
  <Ic>
    <path d="M4 6h16" />
    <path d="M4 12h10" />
    <path d="M4 18h13" />
    <circle cx={19} cy={12} r={2} fill="#c8a878" stroke="none" />
  </Ic>
);
const IcTrack = (
  <Ic>
    <path d="M4 19V5" />
    <path d="M4 19h16" />
    <path d="M7 15l4-5 3 3 4-6" />
  </Ic>
);

// ─── Scoped stylesheet ──────────────────────────────────────────────────────
// Every selector is nested under `.lp` so nothing leaks into the app screens.
// Font families map to the layout's next/font CSS variables. The `.lp` root
// breaks out of the layout's max-width column to render full-bleed (body is
// overflow-x-hidden, so no horizontal scrollbar).
const CSS = `
.lp{width:100vw;margin-left:calc(50% - 50vw);min-height:100vh;background:#0f0e0b;color:#e8d5b0;font-family:var(--font-dm-mono),monospace;-webkit-font-smoothing:antialiased}
.lp a{color:#c8a878;text-decoration:none}.lp a:hover{color:#d8bc98}
.lp .wrap{max-width:1080px;margin:0 auto;padding:0 32px}
.lp .kick{font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:#8a7a68}
.lp .nav{position:sticky;top:0;z-index:20;background:rgba(15,14,11,.82);backdrop-filter:blur(12px);border-bottom:1px solid #1f1c19}
.lp .navin{max-width:1080px;margin:0 auto;padding:16px 32px;display:flex;align-items:center;justify-content:space-between}
.lp .brand{display:flex;align-items:center;gap:11px}
.lp .wordmark{font-family:var(--font-playfair),serif;font-style:italic;font-size:20px;color:#f0e4cc;letter-spacing:-.01em}
.lp .navr{display:flex;align-items:center;gap:24px}
.lp .navlink{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8a7a68}.lp .navlink:hover{color:#d4c09a}
.lp .btn{font-family:var(--font-dm-mono),monospace;font-size:12px;letter-spacing:.06em;border-radius:999px;padding:11px 22px;cursor:pointer;border:1px solid transparent;display:inline-flex;align-items:center;gap:9px;transition:.2s}
.lp .btn-p{background:#c8a878;color:#1a1512;font-weight:500}.lp .btn-p:hover{background:#d8bc98;color:#1a1512}
.lp .btn-g{background:none;border-color:#302d29;color:#d4c09a}.lp .btn-g:hover{border-color:#4a453f;color:#f0e4cc}
.lp .hero{padding:92px 0 104px;text-align:center;position:relative;overflow:hidden}
.lp .h1{font-family:var(--font-playfair),serif;font-weight:600;font-size:60px;line-height:1.04;letter-spacing:-.02em;color:#f0e4cc;margin:0 auto;max-width:820px}
.lp .h1 em{font-style:italic;color:#c8a878}
.lp .sub{font-size:15px;line-height:1.75;color:#d4c09a;max-width:540px;margin:26px auto 0}
.lp .herocta{display:flex;gap:14px;justify-content:center;margin-top:38px;flex-wrap:wrap}
.lp .trust{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#6a5a4a;margin-top:26px}
.lp .fp{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.lp .fpsvg g{animation:drift 26s ease-in-out infinite alternate}
.lp .fpsvg g.g2{animation-duration:34s;animation-direction:alternate-reverse}
@keyframes drift{from{transform:translateX(-16px)}to{transform:translateX(16px)}}
.lp .markwrap{position:relative;width:132px;height:132px;margin:0 auto 40px;display:flex;align-items:center;justify-content:center}
.lp .markglow{position:absolute;width:340px;height:340px;left:50%;top:50%;transform:translate(-50%,-50%);background:radial-gradient(circle at center,rgba(200,168,120,.16),rgba(15,14,11,.55) 42%,transparent 70%);pointer-events:none}
.lp .heromark{position:relative;width:132px;height:132px}
.lp .sec{padding:96px 0;border-top:1px solid #1f1c19}
.lp .sechead{text-align:center;margin-bottom:64px}
.lp .sectitle{font-family:var(--font-playfair),serif;font-style:italic;font-weight:600;font-size:38px;letter-spacing:-.02em;color:#f0e4cc;margin:12px 0 0}
.lp .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
.lp .step{background:#16130f;border:1px solid #2a2620;border-radius:18px;padding:32px 28px;display:flex;flex-direction:column;gap:16px}
.lp .stepnum{font-family:var(--font-playfair),serif;font-style:italic;font-size:15px;color:#c8a878}
.lp .stepicon{width:46px;height:46px;border-radius:13px;background:#211d18;border:1px solid #2f2b25;display:flex;align-items:center;justify-content:center}
.lp .steptitle{font-family:var(--font-playfair),serif;font-size:21px;color:#f0e4cc;margin:0}
.lp .stepbody{font-size:13px;line-height:1.75;color:#8a7a68;margin:0}
.lp .peek{display:grid;grid-template-columns:1.05fr .95fr;gap:56px;align-items:center}
.lp .peektitle{font-family:var(--font-playfair),serif;font-style:italic;font-weight:600;font-size:34px;line-height:1.15;letter-spacing:-.02em;color:#f0e4cc;margin:0}
.lp .peekbody{font-size:14px;line-height:1.8;color:#d4c09a;margin:22px 0 0}
.lp .peeklist{list-style:none;padding:0;margin:28px 0 0;display:flex;flex-direction:column;gap:14px}
.lp .peeklist li{display:flex;align-items:flex-start;gap:12px;font-size:13px;line-height:1.6;color:#d4c09a}
.lp .tick{color:#c8a878;flex-shrink:0}
.lp .mock{background:#16130f;border:1px solid #2a2620;border-radius:22px;padding:24px;box-shadow:0 40px 80px -40px rgba(0,0,0,.7)}
.lp .mockbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
.lp .mocklabel{font-size:9px;letter-spacing:.24em;text-transform:uppercase;color:#6a5a4a}
.lp .mood{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#c8a878;border:1px solid #3a342c;border-radius:999px;padding:5px 11px}
.lp .tcard{border-radius:12px;padding:14px 16px;margin-bottom:10px}
.lp .tcard .tl{font-size:9px;letter-spacing:.2em;text-transform:uppercase;margin-bottom:6px}
.lp .tcard .tt{font-size:12.5px;line-height:1.55;color:#e8d5b0;font-family:var(--font-playfair),serif;font-style:italic}
.lp .ty{background:rgba(23,37,84,.28)}.lp .ty .tl{color:rgba(96,165,250,.75)}
.lp .tt2{background:rgba(69,26,3,.3)}.lp .tt2 .tl{color:rgba(251,191,36,.75)}
.lp .tm{background:rgba(5,46,22,.32)}.lp .tm .tl{color:rgba(74,222,128,.75)}
.lp .taskrow{display:flex;align-items:center;gap:10px;padding:11px 4px;border-top:1px solid #211d18;font-size:12px;color:#d4c09a}
.lp .pdot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.lp .tasksh{font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:#6a5a4a;margin:16px 0 2px}
.lp .final{padding:120px 0;text-align:center;border-top:1px solid #1f1c19}
.lp .finalh{font-family:var(--font-playfair),serif;font-weight:600;font-size:52px;line-height:1.08;letter-spacing:-.02em;color:#f0e4cc;margin:0 auto;max-width:680px}
.lp .finalh em{font-style:italic;color:#c8a878}
.lp .finalsub{font-size:14px;line-height:1.7;color:#8a7a68;max-width:440px;margin:22px auto 0}
.lp .mission{background:#15120e}
.lp .mwrap{max-width:600px;margin:0 auto;text-align:center}
.lp .mtitle{font-family:var(--font-playfair),serif;font-style:italic;font-weight:600;font-size:34px;line-height:1.18;letter-spacing:-.02em;color:#f0e4cc;margin:14px 0 0}
.lp .mbody{font-size:15px;line-height:1.85;color:#d4c09a;margin:24px 0 0}
.lp .mnote{font-family:var(--font-playfair),serif;font-style:italic;font-size:17px;line-height:1.6;color:#e8d5b0;margin:34px 0 0;padding-top:28px;border-top:1px solid #2a2620}
.lp .msig{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#8a7a68;margin:16px 0 0}
.lp .foot{border-top:1px solid #1f1c19;padding:40px 0}
.lp .footin{max-width:1080px;margin:0 auto;padding:0 32px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px}
.lp .footnav{display:flex;gap:24px}
.lp .ver{font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:#4a3c2e}
.lp .rv.pend{opacity:0;transform:translateY(20px)}
.lp .rv.in{opacity:1;transform:none;transition:opacity .7s ease,transform .7s cubic-bezier(.16,.9,.3,1)}
.bm-ring,.bm-dot{transform-box:fill-box;transform-origin:center}
.bm-play .bm-dot{animation:hdot .6s cubic-bezier(.34,1.4,.5,1) .15s both}
.bm-play .bm-ring{animation:hring 1.05s cubic-bezier(.16,.9,.3,1) .5s both}
@keyframes hdot{0%{transform:scale(0)}62%{transform:scale(1.35)}100%{transform:scale(1)}}
@keyframes hring{0%{transform:scale(0);opacity:0}22%{opacity:1}100%{transform:scale(1);opacity:1}}
@media(max-width:820px){.lp .h1{font-size:40px}.lp .steps{grid-template-columns:1fr}.lp .peek{grid-template-columns:1fr;gap:32px}.lp .finalh{font-size:36px}.lp .navlinks{display:none}}
`;

// ─── Page ───────────────────────────────────────────────────────────────────
export default function LandingPage() {
  // Fade sections up as they scroll into view. Degrades gracefully: without JS the
  // content is simply visible; without IntersectionObserver everything reveals at once.
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".lp .rv"));
    if (!els.length) return;
    const show = (e: HTMLElement) => {
      e.classList.remove("pend");
      e.classList.add("in");
    };
    if (!("IntersectionObserver" in window)) {
      els.forEach(show);
      return;
    }
    els.forEach((e) => e.classList.add("pend"));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            show(en.target as HTMLElement);
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    els.forEach((e) => {
      const r = e.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) show(e);
      else io.observe(e);
    });
    const safety = setTimeout(() => els.forEach(show), 2500);
    return () => {
      io.disconnect();
      clearTimeout(safety);
    };
  }, []);

  return (
    <div className="lp">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Nav */}
      <div className="nav">
        <div className="navin">
          <Link className="brand" href="#top">
            <BrandMark size={24} stroke={8} dotR={3.4} />
            <span className="wordmark">Progress</span>
          </Link>
          <div className="navr">
            <a className="navlink navlinks" href="#how">How it works</a>
            <a className="navlink navlinks" href="#peek">The payoff</a>
            <a className="navlink navlinks" href="#mission">Mission</a>
            <Link className="btn btn-g" href="/login">Sign in</Link>
            <Link className="btn btn-p" href="/login">Get started</Link>
          </div>
        </div>
      </div>

      <div id="top" />

      {/* Hero */}
      <section className="hero">
        <div className="fp">
          <FlowPaths />
        </div>
        <div className="wrap">
          <div className="markwrap">
            <div className="markglow" />
            <div className="heromark">
              <BrandMark size={132} stroke={5} dotR={15} animate />
            </div>
          </div>
          <h1 className="h1">
            Your progress, <em>mapped how you want it.</em>
          </h1>
          <p className="sub">
            Progress is a voice-first journal. Talk for a minute — it turns your brain-dump into
            structured reflection, tasks, and reminders, threaded through your week. Zero forms.
          </p>
          <div className="herocta">
            <Link className="btn btn-p" href="/login">Start for free →</Link>
            <a className="btn btn-g" href="#how">See how it works</a>
          </div>
          <p className="trust">No typing required · works on any device</p>
        </div>
      </section>

      {/* How it works */}
      <section className="sec" id="how">
        <div className="wrap">
          <div className="sechead rv">
            <p className="kick">How it works</p>
            <h2 className="sectitle">Three steps, one minute.</h2>
          </div>
          <div className="steps">
            <div className="step rv">
              <span className="stepnum">01</span>
              <div className="stepicon">{IcMic}</div>
              <h3 className="steptitle">Speak your day</h3>
              <p className="stepbody">
                Hit record and talk like you&apos;d tell a friend. Progress transcribes everything — no
                typing, no prompts to fill in, no friction.
              </p>
            </div>
            <div className="step rv">
              <span className="stepnum">02</span>
              <div className="stepicon">{IcParse}</div>
              <h3 className="steptitle">It finds the structure</h3>
              <p className="stepbody">
                Yesterday, today and tomorrow are split apart automatically. Tasks and reminders
                surface with priorities and dates — you lift no finger.
              </p>
            </div>
            <div className="step rv">
              <span className="stepnum">03</span>
              <div className="stepicon">{IcTrack}</div>
              <h3 className="steptitle">Watch it accumulate</h3>
              <p className="stepbody">
                Every entry becomes a day on your timeline. Tasks flow into Today, Calendar and Goals
                — so progress compounds while you just talk.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The payoff */}
      <section className="sec" id="peek">
        <div className="wrap">
          <div className="peek">
            <div className="rv">
              <p className="kick">The payoff</p>
              <h3 className="peektitle">A rambled minute becomes a structured day.</h3>
              <p className="peekbody">
                This is what Progress hands back after you speak — parsed, sorted, and ready to act on.
                Nothing to reformat, nothing to file.
              </p>
              <ul className="peeklist">
                <li>
                  <span className="tick">✦</span>
                  <span>Time-sectioned reflection: yesterday, today, tomorrow</span>
                </li>
                <li>
                  <span className="tick">✦</span>
                  <span>Tasks with priority and due dates, pulled from what you said</span>
                </li>
                <li>
                  <span className="tick">✦</span>
                  <span>Reminders scheduled to the exact day and time — keep coming back to keep the streak</span>
                </li>
              </ul>
              <Link className="btn btn-p" href="/login" style={{ marginTop: 32 }}>
                Try it on today →
              </Link>
            </div>
            <div className="mock rv">
              <div className="mockbar">
                <span className="mocklabel">Sun, Jun 14 · parsed</span>
                <span className="mood">✦ hopeful</span>
              </div>
              <div className="tcard ty">
                <div className="tl">Yesterday</div>
                <div className="tt">shipped the redesign, finally — felt like a weight lifted.</div>
              </div>
              <div className="tcard tt2">
                <div className="tl">Today</div>
                <div className="tt">deep work on the parser, then a walk to reset.</div>
              </div>
              <div className="tcard tm">
                <div className="tl">Tomorrow</div>
                <div className="tt">call the dentist and prep the monday review.</div>
              </div>
              <p className="tasksh">Tasks · 2</p>
              <div className="taskrow">
                <span className="pdot" style={{ background: "#c87a6a" }} />
                Prep Monday review
                <span style={{ marginLeft: "auto", color: "#6a5a4a" }}>tomorrow</span>
              </div>
              <div className="taskrow">
                <span className="pdot" style={{ background: "#c8a860" }} />
                Call the dentist
                <span style={{ marginLeft: "auto", color: "#6a5a4a" }}>9:00 am</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="sec mission" id="mission">
        <div className="wrap">
          <div className="mwrap rv">
            <p className="kick">Our mission</p>
            <h2 className="mtitle">For everyone carrying more than they can hold.</h2>
            <p className="mbody">
              Progress is for people who want to achieve so much that the wanting turns into noise —
              and for people who just want to be a little more organized, to think out loud and speak
              their mind and have it make sense afterward.
            </p>
            <p className="mnote">
              Journaling — really just talking about my days — helped me move through the noise and
              see how far I&apos;d actually come. We built Progress to hand that to everyone.
            </p>
            <p className="msig">— the Progress team</p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="final">
        <div className="wrap rv">
          <h2 className="finalh">
            Most journals demand effort. <em>Progress just needs your voice.</em>
          </h2>
          <p className="finalsub">
            Speak once a day. Let the structure, the tasks, and the timeline build themselves.
          </p>
          <div className="herocta">
            <Link className="btn btn-p" href="/login">Start for free →</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="foot">
        <div className="footin">
          <div className="brand">
            <BrandMark size={22} stroke={8} dotR={3.4} />
            <span className="wordmark">Progress</span>
          </div>
          <div className="footnav">
            <Link className="navlink" href="/">Today</Link>
            <Link className="navlink" href="/journal">Journal</Link>
            <Link className="navlink" href="/schedule">Calendar</Link>
            <Link className="navlink" href="/tasks">Goals</Link>
            <Link className="navlink" href="/privacy">Privacy</Link>
            <Link className="navlink" href="/terms">Terms</Link>
          </div>
          <span className="ver">v1.0</span>
        </div>
      </footer>
    </div>
  );
}
