"use client";

import { useState } from "react";
import { FeedbackToast, type ToastNotice } from "./feedback-toast";

export function ContactForm() {
  const [notice, setNotice] = useState<ToastNotice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;

    setIsSubmitting(true);
    setNotice(null);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.message ?? "We couldn’t send your message. Please try again shortly.");
      }

      form.reset();
      setNotice({ kind: "success", title: "Message sent", message: "Thanks for contacting us. Your enquiry has been delivered to our team." });
    } catch (error) {
      setNotice({
        kind: "error",
        title: "Message not sent",
        message: error instanceof Error ? error.message : "We couldn’t send your message. Please try again shortly.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <form className="contact-form" onSubmit={handleSubmit}>
        <div className="contact-field">
          <label htmlFor="contact-name">Full name</label>
          <input id="contact-name" name="name" type="text" autoComplete="name" placeholder="Your name" minLength={2} maxLength={120} required/>
        </div>
        <div className="contact-field">
          <label htmlFor="contact-email">Email address</label>
          <input id="contact-email" name="email" type="email" autoComplete="email" placeholder="you@company.com" maxLength={254} required/>
        </div>
        <div className="contact-field">
          <label htmlFor="contact-company">Company <span className="contact-optional">Optional</span></label>
          <input id="contact-company" name="company" type="text" autoComplete="organization" placeholder="Company name" maxLength={160}/>
        </div>
        <div className="contact-field">
          <label htmlFor="contact-message">How can we help?</label>
          <textarea id="contact-message" name="message" rows={5} placeholder="Describe the decision or question you want a hand with." minLength={10} maxLength={5000} required/>
        </div>
        <div className="contact-form-trap" aria-hidden="true">
          <label htmlFor="contact-website">Leave this field empty</label>
          <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off"/>
        </div>
        <button className="button button-primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Sending…" : "Send message"} <span aria-hidden="true">→</span>
        </button>
        <p className="contact-form-note" aria-live="polite">Your details will be used only to respond to this enquiry.</p>
      </form>
      <FeedbackToast notice={notice} onDismiss={() => setNotice(null)}/>
    </>
  );
}
