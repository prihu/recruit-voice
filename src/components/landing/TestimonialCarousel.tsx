import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star } from 'lucide-react';

const testimonials = [
  {
    quote: "We screened 500 candidates in a single day — something that used to take our team two weeks. The AI agent handles the calls naturally and candidates love the experience.",
    name: 'Priya Sharma',
    title: 'Head of Talent Acquisition',
    company: 'TechCorp India',
  },
  {
    quote: "The Indian language support is a game changer. Our candidates in Tier-2 cities can now be screened in Hindi, Tamil, or Telugu. Massive improvement in candidate experience.",
    name: 'Rajesh Kumar',
    title: 'VP of HR',
    company: 'FinServe Ltd',
  },
  {
    quote: "Reduced our time-to-hire by 60%. The structured scoring and transcripts make it incredibly easy to shortlist candidates. Best HR tech investment we've made.",
    name: 'Anita Desai',
    title: 'CHRO',
    company: 'MegaRetail Inc',
  },
];

export function TestimonialCarousel() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setActive(p => (p + 1) % testimonials.length), 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section id="testimonials" className="py-24 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <span className="text-xs uppercase tracking-[0.3em] text-emerald-400 mb-4 block">Testimonials</span>
        <h2 className="text-4xl md:text-5xl font-black text-white mb-16">What Our Clients Say</h2>

        <div className="relative min-h-[250px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <div className="flex justify-center gap-1 mb-6">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-emerald-400 text-emerald-400" />
                ))}
              </div>
              <blockquote className="text-xl md:text-2xl text-white/80 font-light leading-relaxed mb-8 italic">
                "{testimonials[active].quote}"
              </blockquote>
              <div>
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 mx-auto mb-3 flex items-center justify-center text-emerald-400 font-bold">
                  {testimonials[active].name[0]}
                </div>
                <p className="text-white font-semibold">{testimonials[active].name}</p>
                <p className="text-white/40 text-sm">{testimonials[active].title}, {testimonials[active].company}</p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex justify-center gap-2 mt-8">
          {testimonials.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`w-2.5 h-2.5 rounded-full transition-all ${i === active ? 'bg-emerald-400 w-8' : 'bg-white/20'}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
