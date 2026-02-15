export function AudioWaveform() {
  const bars = 40;
  return (
    <div className="flex items-end justify-center gap-[3px] h-24 w-full">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className="w-1.5 rounded-full bg-gradient-to-t from-emerald-500 to-emerald-300 opacity-80"
          style={{
            animation: `waveform 1.2s ease-in-out infinite`,
            animationDelay: `${i * 0.05}s`,
            height: '20%',
          }}
        />
      ))}
    </div>
  );
}
