import { Icon } from "./icon";

// Illustrative values from the supplied reference; the SAMPLE DATA label stays until API data is wired in.
const summary = [
  { label: "ARR", value: "$4.82M", change: "+18.4%" },
  { label: "NET REVENUE RETENTION", value: "118%", change: "+4.1pt" },
  { label: "FORECAST ACCURACY", value: "94.2%", change: "+2.8pt" },
];

export function HeroPreview() {
  return (
    <div className="preview-frame" role="group" aria-label="Sample decision intelligence dashboard preview">
      <div className="preview-window-bar"><span className="window-dot dot-coral"/><span className="window-dot dot-amber"/><span className="window-dot dot-green"/><span className="preview-live"><i/> SAMPLE DATA</span><span className="preview-period">Q4 overview</span></div>
      <div className="preview-body">
        <div className="preview-metrics">
          {summary.map(item=><article className="preview-metric" key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small><Icon name="trend" size={12}/>{item.change}</small></article>)}
        </div>
        <div className="preview-chart-card">
          <div className="preview-chart-heading"><div><strong>REVENUE TREND</strong><small>ARR by month</small></div><div className="chart-legend"><span><i className="legend-actual"/> Actual</span><span><i className="legend-forecast"/> Forecast</span></div></div>
          <div className="preview-chart" role="img" aria-label="Illustrative revenue trend chart, showing actual performance increasing through September with a forecast to November">
            <div className="chart-axis-labels"><span>$5M</span><span>$4M</span><span>$3M</span><span>$2M</span></div>
            <svg viewBox="0 0 600 180" preserveAspectRatio="none" aria-hidden="true">
              <defs><linearGradient id="revenue-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#438864" stopOpacity=".16"/><stop offset="1" stopColor="#438864" stopOpacity="0"/></linearGradient></defs>
              {[22,65,108,151].map(y=><line key={y} x1="0" x2="600" y1={y} y2={y} className="preview-grid-line"/>)}
              {/* Keep actuals and forecast visually distinct so the line style carries meaning as well as color. */}
              <path d="M0 145 C54 138 78 131 112 122 S178 104 224 91 S291 72 336 60 S397 38 448 25 L448 151 L0 151Z" fill="url(#revenue-fill)"/>
              <path d="M0 145 C54 138 78 131 112 122 S178 104 224 91 S291 72 336 60 S397 38 448 25" className="preview-actual-line"/>
              <path d="M448 25 C489 19 527 12 600 2" className="preview-forecast-line"/>
              <circle cx="448" cy="25" r="4" className="preview-chart-point"/>
            </svg>
            <div className="chart-months"><span>Jan</span><span>Mar</span><span>May</span><span>Jul</span><span>Sep</span><span>Nov</span></div>
          </div>
        </div>
        <div className="preview-insight"><span className="preview-insight-icon"><Icon name="sparkles" size={15}/></span><p><strong>AI insight</strong> Enterprise expansion in APAC is 3 weeks ahead of plan — 14 accounts are forecast to upgrade before quarter end.</p><Icon name="arrow-right" size={15} className="preview-insight-arrow"/></div>
      </div>
      <div className="preview-glow" aria-hidden="true"/>
    </div>
  );
}
