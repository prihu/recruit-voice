import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Phone, BarChart3, Users, CheckCircle, Loader2, Play } from 'lucide-react';

export default function DemoLogin() {
  const { user, loading, signInDemo } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const features = [
    {
      icon: Phone,
      title: "AI Voice Screening",
      description: "Automated phone interviews with natural conversations"
    },
    {
      icon: Users,
      title: "Candidate Management",
      description: "Track and manage all candidates in one place"
    },
    {
      icon: BarChart3,
      title: "Smart Analytics",
      description: "Real-time insights and scoring metrics"
    },
    {
      icon: CheckCircle,
      title: "Instant Results",
      description: "Get transcripts and evaluations immediately"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Hero Section */}
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-5xl font-bold tracking-tight bg-gradient-primary bg-clip-text text-transparent">
              RecruiterScreen AI
            </h1>
            <p className="text-xl text-muted-foreground">
              Automate first-round phone screenings with AI
            </p>
          </div>

          <div className="prose prose-lg text-muted-foreground">
            <p>
              Save <span className="text-primary font-semibold">2-5 days</span> per job posting by letting AI handle repetitive screening calls. 
              Focus on what matters - engaging with qualified candidates.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {features.map((feature, index) => (
              <div key={index} className="flex gap-3">
                <feature.icon className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-sm">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="w-4 h-4 text-success" />
            <span>No credit card required for demo</span>
          </div>
        </div>

        {/* Login Card */}
        <Card className="shadow-2xl border-primary/20">
          <CardHeader className="space-y-1 pb-8">
            <CardTitle className="text-2xl">Welcome to the Demo</CardTitle>
            <CardDescription>
              Explore all features with pre-loaded sample data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="bg-primary/5 rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-sm">What's included in the demo:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• 3 active job roles with different requirements</li>
                  <li>• 10 sample candidates with various skill levels</li>
                  <li>• 6 completed screening sessions with transcripts</li>
                  <li>• Live voice screening simulation (ElevenLabs required)</li>
                  <li>• Full analytics and reporting dashboard</li>
                </ul>
              </div>

              <Button 
                className="w-full bg-gradient-primary border-0 text-lg h-12"
                onClick={signInDemo}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Loading Demo...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 mr-2" />
                    Start Interactive Demo
                  </>
                )}
              </Button>
            </div>

            <div className="pt-4 border-t">
              <p className="text-xs text-center text-muted-foreground">
                By clicking "Start Interactive Demo", you agree to explore our AI-powered 
                recruitment screening solution. This is a sandbox environment with sample data.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}