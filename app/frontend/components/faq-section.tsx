type Faq = { question: string; answer: string[]; leadStrong?: boolean; link?: { label: string; href: string } };

export const faqs: Faq[] = [
  {
    question: "What is StratVeda OS?",
    answer: ["StratVeda OS is an AI decision partner for founders and business owners. It helps you clarify a business question, examine available evidence, consider alternatives, and work toward a focused recommendation and practical next step."],
  },
  {
    question: "What does OS stand for?",
    leadStrong: true,
    answer: [
      "OS stands for Operational Success.",
      "It reflects our focus on connecting business decisions with practical actions and ways to assess progress. It is not a guarantee of a particular business result.",
    ],
  },
  {
    question: "What is included in the free month?",
    answer: [
      "You receive access to the full StratVeda OS product experience for one month—not a limited-feature preview.",
      "Use it to work through your business questions and evaluate its decision-support workflow.",
    ],
  },
  {
    question: "Who can use the free-month offer?",
    answer: ["The one-month free offer is available to all users."],
  },
  {
    question: "Do I need complete business data to start?",
    answer: [
      "No. Begin with a business question and the context you have.",
      "The strength and specificity of a recommendation depend on the evidence available. Some questions will require additional information before a responsible recommendation can be made.",
    ],
  },
  {
    question: "How is StratVeda OS different from ChatGPT, Claude, Gemini, or Microsoft Copilot?",
    answer: [
      "StratVeda OS is designed around a specific task: helping founders work through business decisions using a defined process.",
      "That process connects your objective, constraints, evidence, alternative explanations, and next action. Its central output is a Decision Brief.",
      "We do not claim that other AI platforms cannot support business decisions or that StratVeda OS is inherently more intelligent. The reason to choose it is the fit of its decision-focused workflow.",
    ],
  },
  {
    question: "Why try it if I already use another AI assistant?",
    answer: [
      "Use the free month to evaluate whether a dedicated decision workflow is useful for your business.",
      "Bring a real question and assess whether the resulting brief clarifies your options, makes the uncertainties visible, and helps you define a practical next step.",
    ],
  },
  {
    question: "Will I always get a definitive recommendation?",
    answer: [
      "No. Sometimes the most useful next step is to clarify the objective, resolve conflicting information, or test an assumption.",
      "Missing evidence should not be replaced with false certainty.",
    ],
  },
  {
    question: "Does StratVeda OS carry out the recommended actions?",
    answer: ["Its core role is decision support. You remain responsible for approving, assigning, and executing actions."],
  },
  {
    question: "Does it guarantee business results?",
    answer: [
      "No. Results depend on the information available, the decision made, execution, and other factors.",
      "Verify important information and involve qualified specialists when needed.",
    ],
  },
  {
    question: "Who is behind StratVeda OS?",
    answer: ["StratVeda OS is a product of StratVeda Technologies."],
    link: { label: "About StratVeda Technologies", href: "https://stratvedatech.com/" },
  },
];

export const faqMainEntity = faqs.map(faq => ({
  "@type": "Question",
  name: faq.question,
  acceptedAnswer: { "@type": "Answer", text: faq.link ? `${faq.answer.join(" ")} ${faq.link.label}` : faq.answer.join(" ") },
}));

export function FaqList() {
  return (
    <div className="faq-list" data-scroll-reveal>
      {faqs.map(faq => (
        <details className="faq-item" key={faq.question}>
          <summary><h2 className="faq-question">{faq.question}</h2><span className="faq-mark" aria-hidden="true"/></summary>
          <div className="faq-answer">
            {faq.answer.map((paragraph, index) => (
              <p key={paragraph}>{faq.leadStrong && index === 0 ? <strong>{paragraph}</strong> : paragraph}</p>
            ))}
            {faq.link ? <p><a href={faq.link.href} target="_blank" rel="noopener noreferrer">{faq.link.label}</a></p> : null}
          </div>
        </details>
      ))}
    </div>
  );
}
