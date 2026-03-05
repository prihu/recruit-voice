import { motion } from 'framer-motion';
import { type LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  number: string;
  title: string;
  description: string;
  icon: LucideIcon;
  features: string[];
  index: number;
}

export function FeatureCard({ number, title, description, icon: Icon, features, index }: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      className="group relative bg-card border-2 border-border p-8 shadow-sm hover:shadow-md transition-all duration-300"
    >
      <div className="flex items-start justify-between mb-6">
        <span className="text-5xl font-black text-muted-foreground/20 group-hover:text-foreground/20 transition-colors">{number}</span>
        <div className="w-12 h-12 bg-muted flex items-center justify-center border-2 border-border shadow-2xs">
          <Icon className="w-6 h-6 text-foreground" />
        </div>
      </div>
      <h3 className="text-xl font-bold text-foreground mb-3">{title}</h3>
      <p className="text-muted-foreground text-sm mb-6">{description}</p>
      <ul className="space-y-2">
        {features.map((f, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-1.5 h-1.5 bg-foreground" />
            {f}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
