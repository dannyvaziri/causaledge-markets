'use client';

export default function LoginCard({ loading, error, draftToken = '', setDraftToken = () => {}, unlock = () => {} }) {
  if (loading) return <main className="loginShell"><section className="loginCard"><div className="hexMark big">CE</div><h1>CausalEdge Markets</h1><p>Preparing your investing workspace…</p></section></main>;

  return <main className="loginShell">
    <section className="loginCard">
      <div className="hexMark big">CE</div>
      <p className="eyebrow">INVEST WITH CONTEXT, NOT NOISE</p>
      <h1>A smarter way to understand your money.</h1>
      <p>Track your paper portfolio, explore transparent strategies, get personalized market explanations, and go deeper with CausalEdge global intelligence when you want it.</p>
      {error && <p className="loginError">{error}</p>}
      <button className="googleBtn" onClick={() => { window.location.href = '/api/auth/google/start'; }}>Continue with Google</button>
      <div className="loginDivider"><span>OR</span></div>
      <form onSubmit={unlock}>
        <label>Private access password</label>
        <input type="password" value={draftToken} onChange={(event) => setDraftToken(event.target.value)} placeholder="Enter access password" autoComplete="current-password"/>
        <button type="submit">Open CausalEdge</button>
      </form>
      <small>Paper-investing research only. Paper execution, automatic execution and live-money trading remain controlled by separate server safeguards.</small>
    </section>
  </main>;
}
