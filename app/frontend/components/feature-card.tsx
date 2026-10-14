import { Icon, type IconName } from "./icon";

type FeatureCardProps = {
  icon: IconName;
  title: string;
  description: string;
  index: number;
};

export function FeatureCard({ icon, title, description, index }: FeatureCardProps) {
  return (
    <article className="feature-card" data-scroll-reveal>
      <div className={`feature-icon feature-icon-${index + 1}`}><Icon name={icon} size={19}/></div>
      <h3>{title}</h3>
      <p>{description}</p>
      <span className="feature-card-accent" aria-hidden="true"/>
    </article>
  );
}
