import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, FileText, Users, Brain, BarChart3 } from 'lucide-react';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { FeatureCard } from '@/components/landing/FeatureCard';
import { UseCaseMarquee } from '@/components/landing/UseCaseMarquee';
import { WhyChooseUs } from '@/components/landing/WhyChooseUs';
import { LandingFooter } from '@/components/landing/LandingFooter';

const services = [
  {
    number: '01',
    title: 'Roles & Questions',
    description: 'Configure custom screening questions, scoring rules, and AI agent personas for each position',
    icon: FileText,
    features: ['Custom question sets', 'Scoring rubrics', 'FAQ knowledge base', 'Agent personality config'],
  },
  {
    number: '02',
    title: 'Bulk Screening',
    description: 'Import candidates via CSV and initiate hundreds of AI phone calls simultaneously',
    icon: Users,
    features: ['CSV bulk import', 'Concurrent calls', 'Scheduled campaigns', 'Retry logic'],
  },
  {
    number: '03',
    title: 'Smart Evaluation',
    description: 'AI evaluates responses in real-time with sentiment analysis and keyword detection',
    icon: Brain,
    features: ['Real-time scoring', 'Sentiment analysis', 'Keyword detection', 'Pass/Fail/Review routing'],
  },
  {
    number: '04',
    title: 'Analytics & Export',
    description: 'Comprehensive dashboards with exportable reports and interview transcripts',
    icon: BarChart3,
    features: ['Full transcripts', 'Performance metrics', 'Export to CSV/Excel', 'Team analytics'],
  },
];

export default function LandingPage() {
  return (
    <div className="bg-background min-h-screen text-foreground">
      <LandingNavbar />
      <HeroSection />

      {/* Mission Section */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-block text-xs uppercase tracking-[0.3em] text-foreground font-bold border-2 border-border px-4 py-1.5 shadow-xs mb-8">
              Our Mission
            </span>
            <h2 className="text-3xl md:text-5xl font-bold text-foreground leading-tight mb-8">
              Powering India's fastest-growing companies with{' '}
              <span className="text-success">AI-powered phone screening</span>.
              Screen faster. Hire smarter.
            </h2>
            <a href="#features" className="inline-flex items-center gap-2 text-foreground hover:text-muted-foreground transition-colors font-bold border-2 border-border px-5 py-2 shadow-xs hover:shadow-sm">
              Explore Features <ArrowRight className="w-4 h-4" />
            </a>
          </motion.div>
        </div>
      </section>

      {/* Services Grid */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-bold mb-4 block">Our Services</span>
            <h2 className="text-4xl md:text-5xl font-black text-foreground">Everything You Need</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {services.map((s, i) => (
              <FeatureCard key={i} index={i} {...s} />
            ))}
          </div>
        </div>
      </section>

      <UseCaseMarquee />

      <WhyChooseUs />

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-6xl font-black text-foreground mb-6">
              Ready to Transform<br />Your Hiring?
            </h2>
            <p className="text-muted-foreground mb-10 text-lg">Start screening candidates with AI today.</p>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-bold px-10 py-4 border-2 border-border shadow-md hover:shadow-lg text-lg transition-all"
            >
              Start Free Trial
              <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
