import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "StratVeda OS — Operational Success";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Copy here comes only from the approved hero and Get Started wording — no invented figures,
// no dashboard, and nothing that reads as a customer result.
const steps = ["Bring one real business question.", "Examine the evidence and alternatives.", "Define a practical next action."];

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "62px 76px",
        color: "#172b20",
        background: "linear-gradient(135deg,#f3f8f4 0%,#e8f2eb 58%,#f7faf8 100%)",
        fontFamily: "Arial, sans-serif",
      }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.8 }}>StratVeda OS</span>
          <span style={{ marginTop: 6, color: "#4d785d", fontSize: 16, fontWeight: 700, letterSpacing: 3.2 }}>OPERATIONAL SUCCESS</span>
          <div style={{ marginTop: 44, fontSize: 62, lineHeight: 1.06, letterSpacing: -2.6, fontWeight: 800, maxWidth: 900 }}>
            What should your business do next?
          </div>
          <div style={{ marginTop: 22, color: "#4f6157", fontSize: 23, lineHeight: 1.5, maxWidth: 880 }}>
            Bring the decision you are working through. StratVeda OS helps you examine the evidence and develop a focused Decision Brief.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 40 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {steps.map(step => (
              <div key={step} style={{ display: "flex", alignItems: "center", gap: 12, color: "#4a5b6b", fontSize: 18 }}>
                <div style={{ width: 9, height: 9, borderRadius: 9, background: "#377b59" }}/>
                <span>{step}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <span style={{ color: "#22583f", fontSize: 20, fontWeight: 700 }}>Experience the full product free for one month.</span>
            <span style={{ color: "#68796e", fontSize: 17 }}>stratvedatech.com</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
