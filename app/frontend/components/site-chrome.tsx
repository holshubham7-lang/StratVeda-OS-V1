import Image from "next/image";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFacebookF, faInstagram, faLinkedinIn, faXTwitter } from "@fortawesome/free-brands-svg-icons";
import { Icon } from "./icon";
import { ActiveLink } from "./active-link";
import { LogoutButton } from "./logout-button";
import { SessionUser } from "./session-user";
import { WorkspaceReturnLink } from "./workspace-return-link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className={`brand${compact ? " brand-compact" : ""}`} href="/" aria-label="StratVeda OS — Operational Success home">
      <Image src="/assets/brand-mark.png" alt="" width={42} height={42} priority={!compact} className="brand-mark" />
      <span className="brand-copy"><strong>StratVeda OS</strong><small>Operational Success</small></span>
    </Link>
  );
}

export function Header() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Brand />
        <nav className="top-nav" aria-label="Main navigation">
          <ActiveLink href="/">Home</ActiveLink>
          <ActiveLink href="/about">About Us</ActiveLink>
          <ActiveLink href="/how-it-works">How It Works</ActiveLink>
          <ActiveLink href="/contact">Contact</ActiveLink>
        </nav>
        <div className="header-actions">
          <a className="sign-in-link" href="/sign-in">Sign in</a>
          <a className="button button-small button-primary" href="/sign-up">Get Started</a>
        </div>
        <details className="mobile-menu">
          <summary aria-label="Open navigation menu"><Icon name="menu" size={21}/></summary>
          <nav aria-label="Mobile navigation">
            <ActiveLink href="/">Home</ActiveLink>
            <ActiveLink href="/about">About Us</ActiveLink>
            <ActiveLink href="/how-it-works">How It Works</ActiveLink>
            <ActiveLink href="/contact">Contact</ActiveLink>
            <a href="/sign-in">Sign in</a>
            <a className="button button-small button-primary" href="/sign-up">Get Started</a>
          </nav>
        </details>
      </div>
    </header>
  );
}

export function WelcomeHeader() {
  return (
    <header className="site-header app-shell-header">
      <div className="header-inner">
        <Brand />
        <div className="app-shell-session">
          <WorkspaceReturnLink />
          <SessionUser />
        </div>
      </div>
    </header>
  );
}

function SocialLinks() {
  return (
    <div className="social-links" aria-label="Social media">
      <a href="https://www.linkedin.com/" aria-label="LinkedIn" title="LinkedIn" target="_blank" rel="noopener noreferrer"><FontAwesomeIcon icon={faLinkedinIn} aria-hidden="true"/></a>
      <a href="https://www.instagram.com/" aria-label="Instagram" title="Instagram" target="_blank" rel="noopener noreferrer"><FontAwesomeIcon icon={faInstagram} aria-hidden="true"/></a>
      <a href="https://x.com/" aria-label="X" title="X" target="_blank" rel="noopener noreferrer"><FontAwesomeIcon icon={faXTwitter} aria-hidden="true"/></a>
      <a href="https://www.facebook.com/" aria-label="Facebook" title="Facebook" target="_blank" rel="noopener noreferrer"><FontAwesomeIcon icon={faFacebookF} aria-hidden="true"/></a>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="site-footer" id="footer">
      <div className="footer-main page-width">
        <div className="footer-brand-column">
          <Brand compact/>
          <h2>ABOUT</h2>
          <p className="footer-description">Decision intelligence that turns scattered revenue data into forecasts, alerts, and next-best actions.</p>
        </div>
        <div className="footer-link-column"><h2>PRODUCT</h2><ActiveLink href="/how-it-works">How it works</ActiveLink><ActiveLink href="/faq">FAQ</ActiveLink></div>
        <div className="footer-link-column"><h2>COMPANY</h2><ActiveLink href="/about">About us</ActiveLink><ActiveLink href="/contact">Contact us</ActiveLink><a href="/#get-started">Blogs</a></div>
        <div className="footer-link-column footer-social-column">
          <h2>FOLLOW US</h2>
          <SocialLinks/>
          <a href="mailto:hello@stratvedatech.com">hello@stratvedatech.com</a>
        </div>
      </div>
      <div className="footer-bottom page-width">
        <p>Copyright © 2026 <a href="https://stratvedatech.com/" target="_blank" rel="noopener noreferrer"><strong>StratVeda Technologies Pvt. Ltd.</strong></a> All rights reserved.</p>
        <nav className="footer-legal" aria-label="Policies">
          <ActiveLink href="/privacy-policy">Privacy Policy</ActiveLink>
          <ActiveLink href="/terms">Terms &amp; Conditions</ActiveLink>
          <ActiveLink href="/cookie-policy">Cookie Policy</ActiveLink>
        </nav>
      </div>
    </footer>
  );
}

export function WelcomeFooter() {
  return (
    <footer className="app-shell-footer">
      <div className="app-shell-footer-inner">
        <Brand compact/>
        <span>© 2026 <a href="https://stratvedatech.com/" target="_blank" rel="noopener noreferrer">StratVeda Technologies Pvt. Ltd.</a></span>
        <span className="app-shell-footer-trust"><i aria-hidden="true">✓</i> Your revenue data stays yours</span>
      </div>
    </footer>
  );
}

export function WelcomeCopyrightFooter() {
  return (
    <footer className="welcome-copyright-footer">
      <p>Copyright © 2026 <a href="https://stratvedatech.com/" target="_blank" rel="noopener noreferrer"><strong>StratVeda Technologies Pvt. Ltd.</strong></a> All rights reserved.</p>
    </footer>
  );
}
