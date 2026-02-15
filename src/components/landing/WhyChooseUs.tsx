import { motion } from 'framer-motion';
import { Globe, Zap, Mic, Shield, Phone } from 'lucide-react';

const reasons = [
  { icon: Globe, title: 'Indian Voice Support', desc: 'Native Hindi, Tamil, Telugu, Kannada and more regional languages' },
  { icon: Zap, title: 'Enterprise Scale', desc: 'Handle 10,000+ screening calls per day without breaking a sweat' },
  { icon: Mic, title: '50+ AI Voices', desc: 'Professional, natural-sounding voices for every screening need' },
  { icon: Shield, title: 'Secure & Compliant', desc: 'SOC2 Type II certified, GDPR ready, end-to-end encryption' },
  { icon: Phone, title: 'Indian Phone Numbers', desc: 'Build local trust with +91 numbers and caller ID' },
];

export function WhyChooseUs() {
  return (
    <section id="whyus" className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-xs uppercase tracking-[0.3em] text-emerald-400 mb-4 block">Why Choose Us</span>
          <h2 className="text-4xl md:text-5xl font-black text-white">Built for India. Scales Globally.</h2>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reasons.map((r, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 hover:border-emerald-500/20 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-5 group-hover:bg-emerald-500/20 transition-colors">
                <r.icon className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{r.title}</h3>
              <p className="text-sm text-white/40">{r.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
