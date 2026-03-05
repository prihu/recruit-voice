import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { AudioWaveform } from './AudioWaveform';

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6 pt-20 bg-gradient-subtle">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 text-center max-w-6xl mx-auto"
      >
        <h1 className="text-5xl sm:text-7xl lg:text-[8rem] font-black tracking-tight leading-[0.9] text-foreground mb-6">
          <span className="block">AUTOMATED</span>
          <span className="block text-success">PHONE SCREENING</span>
          <span className="block">EXPERIENCE</span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          AI-powered voice agents that screen candidates, answer FAQs, and deliver scored results — so your recruiters can focus on what matters.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <Link
            to="/dashboard"
            className="group inline-flex items-center gap-2 bg-primary text-primary-foreground font-bold px-8 py-4 border-2 border-border shadow-sm hover:shadow-md text-lg transition-all"
          >
            Get Started
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <a
            href="#features"
            className="inline-flex items-center gap-2 border-2 border-border text-foreground px-8 py-4 text-lg transition-all hover:shadow-sm bg-card"
          >
            Watch Demo
          </a>
        </div>
      </motion.div>

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
