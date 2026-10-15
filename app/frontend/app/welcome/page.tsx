import { WelcomeCopyrightFooter, WelcomeHeader } from "../../components/site-chrome";
import { WelcomeGreeting } from "../../components/welcome-greeting";
import { WelcomeSetupProgress } from "../../components/welcome-setup-progress";
import { SessionRequired } from "../../components/session-required";

export default function WelcomePage() {
  return (
    <SessionRequired>
      <a className="skip-link" href="#welcome-main">Skip to content</a>
      <WelcomeHeader />
      <main id="welcome-main" className="welcome-page">
        <div className="welcome-layout">
          <section className="welcome-story" aria-labelledby="welcome-title">
            <WelcomeGreeting />
            <p className="welcome-eyebrow"><span aria-hidden="true" /> YOUR STRATVEDA WORKSPACE</p>
            <h1 id="welcome-title">A clearer way to make <span>your next move.</span></h1>
            <p className="welcome-description">
              You’re in the right place. We’ll shape this workspace around your business, your priorities, and the decisions in front of you. Take it one step at a time.
            </p>
            <div className="welcome-value-list" aria-label="What you will shape during setup">
              <div className="welcome-value-item">
                <span className="welcome-value-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 20V8l8-4 8 4v12M8 20v-6h8v6M8 9h.01M12 9h.01M16 9h.01" /></svg></span>
                  <div><strong>Your business, understood</strong><p>Share the context that makes your company unique.</p></div>
              </div>
              <div className="welcome-value-item">
                <span className="welcome-value-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 19V5m0 14h15M8 15l4-4 3 2 5-6M16 7h4v4" /></svg></span>
                  <div><strong>Your priorities, in focus</strong><p>Choose what progress should look like for you.</p></div>
              </div>
              <div className="welcome-value-item">
                <span className="welcome-value-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4M8 10.5h5M10.5 8v5" /></svg></span>
                  <div><strong>Decisions that matter</strong><p>Bring the important questions into clearer view.</p></div>
              </div>
            </div>
          </section>

          <aside className="welcome-card" aria-labelledby="welcome-card-title">
            <div className="welcome-card-orbit" aria-hidden="true" />
            <p className="welcome-card-kicker">A GOOD PLACE TO BEGIN</p>
            <h2 id="welcome-card-title">Let’s set up a workspace that feels like yours.</h2>
            <p className="welcome-card-description">A few thoughtful steps will help us make your insights more relevant from day one.</p>
            <WelcomeSetupProgress />
            <div className="welcome-card-note"><span aria-hidden="true">✓</span> Your progress saves as you go <i /> Go at your own pace <i /> Evidence is optional</div>
          </aside>
        </div>
      </main>
      <WelcomeCopyrightFooter />
    </SessionRequired>
  );
}
