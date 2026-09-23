import { CHAIN_ID, CONTRACT, GITHUB_URL, NETWORK_SLUG, X_URL, addressUrl } from "@/lib/config";
import { short } from "@/lib/format";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="links">
          <a href={addressUrl(CONTRACT)} target="_blank" rel="noreferrer" className="mono">
            Contract {short(CONTRACT)}
          </a>
          <a href="/#rubric">The rubric</a>
          {GITHUB_URL ? (
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub</a>
          ) : null}
          <a href={X_URL} target="_blank" rel="noreferrer">X</a>
        </div>
        <span className="mono">
          Reading {NETWORK_SLUG} / chain {CHAIN_ID}
        </span>
      </div>
    </footer>
  );
}
