import Link from "next/link";
import { FeaturedDesks, HeroCard, LiveVerdicts, MostBacked } from "@/components/Landing";
import { CHAIN_ID, CONTRACT, RUBRIC_URL, addressUrl } from "@/lib/config";
import { RUBRIC } from "@/lib/rubric";

const STEPS = [
  ["01", "Ask", "Pick a desk, write one question, put money behind it."],
  ["02", "Back", "Anyone can add to the pot. Bigger pots rise to the top."],
  ["03", "Reply", "The desk answers, or declines openly with a reason."],
  ["04", "Verdict", "Validators decide. Answered pays the desk, a dodge refunds every backer."],
];

const VERDICTS = [
  ["ANSWERED", "The reply takes on the specific question and gives the asker something concrete: a yes or no with a reason, a number, a date, a decision, a plan, or an explanation.", "The whole pot goes to the desk."],
  ["DODGED", "The reply looks like an answer but avoids the core: an easier question, generic lines, a bare link to docs, or talking to the judge.", "One amendment if time is left, otherwise every backer reclaims."],
  ["REFUSED", "The reply openly says it will not or cannot answer, and gives a reason such as legal limits, security or privacy.", "Every backer reclaims. Honest refusals never lower the rate."],
];

const FAQ = [
  ["Who judges?", "GenLayer validators. Each one runs the same public rubric with its own model, and a verdict only stands when they agree on the label. Nobody at Answerable can change it afterwards."],
  ["What if the answer is false?", "Validators judge whether the reply answers the question, not whether it is true. Truth needs sources, and a false answer on a public record is already costly for the desk."],
  ["Can a desk refuse?", "Yes, in two ways. It can decline before replying, which refunds everyone and never lowers its rate, or reply with an open refusal and a reason, which the judge labels REFUSED and also refunds everyone."],
  ["What happens with no reply?", "When the reply window closes, the question expires, every backer can reclaim their stake, and the expiry counts against the desk like a dodge."],
  ["What does it cost?", "Only your stake, which you get back unless the question is answered. GenLayer Studio is gasless, so there is no network fee."],
  ["Which network?", `GenLayer Studio (Studionet), chain ${CHAIN_ID}. Test GEN comes from the Studio faucet. Everything is readable without a wallet.`],
];

const AGENT_CODE = `from genlayer_py import create_client, create_account
from genlayer_py.chains import studionet

agent = create_account()                      # the agent's own key
gl = create_client(chain=studionet, account=agent)
desk = "0x3e8b...41aa"                        # a human expert's desk

gl.write_contract(address="${CONTRACT}",
    function_name="ask", value=5 * 10**18,
    args=[desk, "Does clause 7.2 let us terminate early?", ""])

# later: find the question, read the verdict, reclaim on a dodge
mine = gl.read_contract(address="${CONTRACT}", function_name="list_questions",
    args=[desk, "", 0, 1, "new"])["items"][0]
q = gl.read_contract(address="${CONTRACT}",
    function_name="get_question", args=[mine["id"], agent.address])
q["status"], q["reason"]`;

export default function Landing() {
  return (
    <>
      <section className="wrap" style={{ paddingTop: 64 }}>
        <div className="two-col wide-right" style={{ gap: 48 }}>
          <div className="stack-lg">
            <span className="label">Paid questions, judged on GenLayer</span>
            <h1 className="display">
              Pay to ask.
              <br />
              Refunded if they dodge.
            </h1>
            <p className="muted" style={{ fontSize: 18, maxWidth: 560 }}>
              Put money behind a question to a founder, a team or an expert. If the reply answers it, they keep the
              money. If it dodges, GenLayer validators send it back to everyone who backed it.
            </p>
            <div className="row wrap-ok">
              <Link href="/ask" className="btn primary lg">Ask a question</Link>
              <Link href="/desk" className="btn lg">Open your desk</Link>
            </div>
            <p className="tiny muted">Reading needs no wallet. Asking and backing use test GEN on GenLayer Studio.</p>
          </div>
          <HeroCard />
        </div>
      </section>

      <section className="wrap" style={{ paddingTop: 40 }}>
        <LiveVerdicts />
      </section>

      <section id="how" className="wrap section-gap stack-lg">
        <span className="label">How it works</span>
        <div className="cards-4">
          {STEPS.map(([n, t, d]) => (
            <div key={n} className="stack">
              <span className="mono muted">{n}</span>
              <h3 style={{ fontSize: 20 }}>{t}</h3>
              <p className="muted small">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="rubric" className="wrap section-gap stack-lg">
        <div className="row between wrap-ok">
          <h2 className="section">The rubric</h2>
          <span className="small muted">Validators judge whether it answers, not whether it is true.</span>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {VERDICTS.map(([v, d, m]) => (
            <div key={v} className="panel pad stack">
              <span className={`seal ${v}`} style={{ alignSelf: "flex-start" }}>{v.toLowerCase()}</span>
              <p className="small">{d}</p>
              <p className="tiny muted">{m}</p>
            </div>
          ))}
        </div>
        <details className="panel pad">
          <summary className="row between" style={{ cursor: "pointer" }}>
            <span>The exact prompt, pinned in the contract (rubric v1)</span>
            <span className="tiny muted mono">
              {RUBRIC_URL ? (
                <a href={RUBRIC_URL} target="_blank" rel="noreferrer">source</a>
              ) : (
                <a href={addressUrl(CONTRACT)} target="_blank" rel="noreferrer">contract on explorer</a>
              )}
            </span>
          </summary>
          <pre className="code wrapable" style={{ marginTop: 16 }}>{RUBRIC}</pre>
          <p className="tiny muted" style={{ marginTop: 12 }}>
            Each validator runs this prompt with its own model and accepts the leader&apos;s result only if its own label
            matches. The reason sentence is never compared. A split vote rotates the leader instead of settling a guess.
          </p>
        </details>
      </section>

      <section id="desks" className="wrap section-gap stack-lg">
        <div className="row between wrap-ok">
          <h2 className="section">Featured desks</h2>
          <Link href="/leaderboard" className="small muted">Leaderboard</Link>
        </div>
        <FeaturedDesks />
      </section>

      <section id="questions" className="wrap section-gap stack-lg">
        <div className="row between wrap-ok">
          <h2 className="section">Most backed open questions</h2>
          <Link href="/ask" className="small muted">Ask your own</Link>
        </div>
        <MostBacked />
      </section>

      <section id="agents" className="wrap section-gap">
        <div className="two-col wide-right">
          <div className="stack">
            <h2 className="section">For agents</h2>
            <p className="muted">
              An agent that needs a human judgment can ask a desk through the same contract, then read the verdict. If the
              expert dodges, the agent reclaims its stake, so it only pays for real answers.
            </p>
            <p className="tiny muted mono">Same contract, same rubric, no special API.</p>
          </div>
          <pre className="code">{AGENT_CODE}</pre>
        </div>
      </section>

      <section id="faq" className="wrap section-gap">
        <h2 className="section" style={{ marginBottom: 8 }}>FAQ</h2>
        <div className="faq">
          {FAQ.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
