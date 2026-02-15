import { useState } from 'react';
import { motion } from 'framer-motion';
import { Phone, Mic, MicOff } from 'lucide-react';

export function DemoWidget() {
  const [status, setStatus] = useState<'standby' | 'active'>('standby');

  return (
    <section className="py-24 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="text-xs uppercase tracking-[0.3em] text-emerald-400 mb-4 block">Interactive Demo</span>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Meet Your AI Screener</h2>
          <p className="text-white/40 mb-12">Click below to simulate an AI screening call experience</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="inline-block bg-white/[0.03] border border-white/[0.08] rounded-3xl p-10"
        >
          <div className="flex flex-col items-center gap-6">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 ${
              status === 'active'
                ? 'bg-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.4)]'
                : 'bg-white/10'
            }`}>
              <Phone className={`w-10 h-10 ${status === 'active' ? 'text-black' : 'text-white/40'}`} />
            </div>

            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-white/20'}`} />
              <span className="text-xs uppercase tracking-wider text-white/40">
                {status === 'active' ? 'On Call' : 'Standby'}
              </span>
            </div>

            <button
              onClick={() => setStatus(s => s === 'standby' ? 'active' : 'standby')}
              className={`px-8 py-3 rounded-xl font-semibold text-sm transition-all ${
                status === 'active'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                  : 'bg-emerald-500 text-black hover:bg-emerald-400'
              }`}
            >
              {status === 'active' ? 'End Call' : 'Start Demo Call'}
            </button>

            {status === 'active' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="text-sm text-white/40 space-y-2 mt-2"
              >
                <p className="text-emerald-400">"Hello! I'm calling from TechCorp regarding the Software Engineer position you applied for..."</p>
                <p className="text-white/30 text-xs">AI Agent is conducting the screening interview</p>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
