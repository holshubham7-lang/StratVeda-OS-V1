"use client";

import { useState } from "react";
import { FeedbackToast, type ToastNotice } from "./feedback-toast";

export function ContactForm() {
  const [notice, setNotice] = useState<ToastNotice | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = [...form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea")];
    const invalid = fields.find((field) => !field.checkValidity());
    if (invalid) {
      invalid.focus();
      setNotice({ kind: "error", title: "Check the form", message: "Please complete the required fields with valid values." });
      return;
    }
    setNotice({ kind: "info", title: "Form not connected", message: "This form is not connected to an inbox yet, so your message has not been sent." });
  }

  return (
    <>
      <form className="contact-form" onSubmit={handleSubmit} noValidate>
        <div className="contact-field">
          <label htmlFor="contact-name">Full name</label>
          <input id="contact-name" name="name" type="text" autoComplete="name" placeholder="Your name" required/>
        </div>
        <div className="contact-field">
          <label htmlFor="contact-email">Email address</label>
          <input id="contact-email" name="email" type="email" autoComplete="email" placeholder="you@company.com" required/>
        </div>
        <div className="contact-field">
          <label htmlFor="contact-company">Company <span className="contact-optional">Optional</span></label>
          <input id="contact-company" name="company" type="text" autoComplete="organization" placeholder="Company name"/>
        </div>
        <div className="contact-field">
          <label htmlFor="contact-message">How can we help?</label>
          <textarea id="contact-message" name="message" rows={5} placeholder="Describe the decision or question you want a hand with." required/>
        </div>
        <button className="button button-primary" type="submit">Send message <span aria-hidden="true">→</span></button>
        <p className="contact-form-note">This form is not connected yet, so messages are not delivered.</p>
      </form>
      <FeedbackToast notice={notice} onDismiss={() => setNotice(null)}/>
    </>
  );
}
