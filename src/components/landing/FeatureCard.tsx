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
      className="group relative bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 hover:border-emerald-500/30 hover:bg-white/[0.05] transition-all duration-500"
    >
      <div className="flex items-start justify-between mb-6">
        <span className="text-5xl font-black text-white/[0.06] group-hover:text-emerald-500/20 transition-colors">{number}</span>
        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
          <Icon className="w-6 h-6 text-emerald-400" />
        </div>
      </div>
      <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
      <p className="text-white/50 text-sm mb-6">{description}</p>
      <ul className="space-y-2">
        {features.map((f, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-white/40">
            <div className="w-1 h-1 rounded-full bg-emerald-500" />
            {f}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
