import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Star } from 'lucide-react';
import { AudioWaveform } from './AudioWaveform';

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6 pt-20">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.08)_0%,_transparent_60%)]" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 text-center max-w-6xl mx-auto"
      >
        {/* Trust badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 mb-8"
        >
          <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-3 h-3 fill-emerald-400 text-emerald-400" />
            ))}
          </div>
          <span className="text-xs text-white/70">Trusted by 100+ Recruiting Teams</span>
        </motion.div>

        {/* Hero text */}
        <h1 className="text-5xl sm:text-7xl lg:text-[8rem] font-black tracking-tight leading-[0.9] text-white mb-6">
          <span className="block">AUTOMATED</span>
          <span className="block text-emerald-400">PHONE SCREENING</span>
          <span className="block">EXPERIENCE</span>
        </h1>

        <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-10">
          AI-powered voice agents that screen candidates, answer FAQs, and deliver scored results — so your recruiters can focus on what matters.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <Link
            to="/dashboard"
            className="group inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-8 py-4 rounded-xl text-lg transition-all"
          >
            Get Started
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <a
            href="#features"
            className="inline-flex items-center gap-2 border border-white/10 hover:border-white/20 text-white px-8 py-4 rounded-xl text-lg transition-all"
          >
            Watch Demo
          </a>
        </div>
      </motion.div>

      {/* Floating card */}
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.6, duration: 0.8 }}
        className="hidden xl:block absolute top-1/3 right-12 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 max-w-xs"
        style={{ animation: 'float 6s ease-in-out infinite' }}
      >
        <div className="text-emerald-400 text-sm font-semibold mb-2">Live Now</div>
        <div className="text-white text-sm">
          247 candidates screened today across 12 roles with 94% call completion rate
        </div>
      </motion.div>

      {/* Waveform */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-0 left-0 right-0 z-10"
      >
        <AudioWaveform />
      </motion.div>
    </section>
  );
}
