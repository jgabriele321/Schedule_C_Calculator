import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
} from 'remotion';

// Scene 1: Opening - Logo reveal
const OpeningScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: {
      damping: 100,
    },
  });

  const opacity = interpolate(frame, [0, 20], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #60a5fa 100%)',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          opacity,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 120,
            fontWeight: 'bold',
            color: 'white',
            marginBottom: 20,
            textShadow: '0 4px 20px rgba(0,0,0,0.3)',
          }}
        >
          Schedule C Assistant
        </div>
        <div
          style={{
            fontSize: 48,
            color: 'rgba(255,255,255,0.9)',
            fontWeight: 300,
          }}
        >
          Tax preparation made effortless
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Scene 2: Problem statement
const ProblemScene: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1]);
  const translateY = interpolate(frame, [0, 20], [50, 0]);

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 100,
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${translateY}px)`,
          textAlign: 'center',
          maxWidth: 1200,
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 'bold',
            color: '#f87171',
            marginBottom: 40,
          }}
        >
          😰 Tax Season Stress?
        </div>
        <div
          style={{
            fontSize: 48,
            color: '#d1d5db',
            lineHeight: 1.5,
          }}
        >
          Scattered receipts. Mixed expenses. Confused categorization.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Scene 3: Solution - Upload
const UploadScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: frame - 10,
    fps,
    config: {
      damping: 100,
    },
  });

  const opacity = interpolate(frame, [0, 15], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 100,
      }}
    >
      <div style={{ opacity, textAlign: 'center' }}>
        <div
          style={{
            fontSize: 64,
            fontWeight: 'bold',
            color: '#60a5fa',
            marginBottom: 60,
          }}
        >
          ✨ Simple Solution
        </div>

        {/* Upload Icon */}
        <div
          style={{
            transform: `scale(${scale})`,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 200,
              height: 200,
              margin: '0 auto',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              borderRadius: 30,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              boxShadow: '0 20px 60px rgba(59, 130, 246, 0.5)',
            }}
          >
            <div
              style={{
                fontSize: 100,
                color: 'white',
              }}
            >
              📤
            </div>
          </div>
        </div>

        <div
          style={{
            fontSize: 56,
            color: '#e5e7eb',
            fontWeight: 600,
          }}
        >
          1. Upload Your CSV Files
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Scene 4: Categorize
const CategorizeScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const categories = [
    { emoji: '📦', label: 'Office Supplies', color: '#3b82f6' },
    { emoji: '✈️', label: 'Travel', color: '#06b6d4' },
    { emoji: '🍔', label: 'Meals', color: '#f59e0b' },
  ];

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 100,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontSize: 64,
            fontWeight: 'bold',
            color: '#10b981',
            marginBottom: 60,
          }}
        >
          🤖 AI Auto-Categorization
        </div>

        <div
          style={{
            display: 'flex',
            gap: 40,
            justifyContent: 'center',
            marginBottom: 60,
          }}
        >
          {categories.map((cat, i) => {
            const delay = i * 10;
            const scale = spring({
              frame: frame - delay,
              fps,
              config: {
                damping: 100,
              },
            });

            return (
              <div
                key={i}
                style={{
                  transform: `scale(${scale})`,
                  background: `${cat.color}20`,
                  border: `3px solid ${cat.color}`,
                  borderRadius: 20,
                  padding: '30px 40px',
                  minWidth: 250,
                }}
              >
                <div style={{ fontSize: 80, marginBottom: 20 }}>{cat.emoji}</div>
                <div style={{ fontSize: 32, color: '#e5e7eb', fontWeight: 600 }}>
                  {cat.label}
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            fontSize: 56,
            color: '#e5e7eb',
            fontWeight: 600,
          }}
        >
          2. Smart Categorization
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Scene 5: Results
const ResultsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const numberScale = spring({
    frame: frame - 10,
    fps,
    config: {
      damping: 100,
    },
  });

  const amount = Math.floor(interpolate(frame, [10, 40], [0, 12456]));

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 100,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontSize: 64,
            fontWeight: 'bold',
            color: '#d1fae5',
            marginBottom: 60,
          }}
        >
          📊 Instant Overview
        </div>

        <div
          style={{
            transform: `scale(${numberScale})`,
            marginBottom: 60,
          }}
        >
          <div
            style={{
              fontSize: 120,
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            ${amount.toLocaleString()}
          </div>
          <div
            style={{
              fontSize: 40,
              color: '#d1fae5',
              marginTop: 20,
            }}
          >
            Business Deductions
          </div>
        </div>

        <div
          style={{
            fontSize: 56,
            color: '#f0fdf4',
            fontWeight: 600,
          }}
        >
          3. Beautiful Reports
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Scene 6: Export
const ExportScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: frame - 10,
    fps,
    config: {
      damping: 100,
    },
  });

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 100,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontSize: 64,
            fontWeight: 'bold',
            color: '#dbeafe',
            marginBottom: 60,
          }}
        >
          📥 Export & Done
        </div>

        <div
          style={{
            transform: `scale(${scale})`,
            marginBottom: 60,
          }}
        >
          <div
            style={{
              fontSize: 100,
              marginBottom: 30,
            }}
          >
            ✅
          </div>
        </div>

        <div
          style={{
            fontSize: 56,
            color: '#f0f9ff',
            fontWeight: 600,
            marginBottom: 40,
          }}
        >
          4. Send to Your Accountant
        </div>

        <div
          style={{
            fontSize: 40,
            color: '#bfdbfe',
            fontStyle: 'italic',
          }}
        >
          Professional. Organized. Stress-free.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Scene 7: Closing CTA
const ClosingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: {
      damping: 100,
    },
  });

  const buttonScale = spring({
    frame: frame - 20,
    fps,
    config: {
      damping: 100,
    },
  });

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #60a5fa 100%)',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div style={{ textAlign: 'center', transform: `scale(${scale})` }}>
        <div
          style={{
            fontSize: 96,
            fontWeight: 'bold',
            color: 'white',
            marginBottom: 40,
            textShadow: '0 4px 20px rgba(0,0,0,0.3)',
          }}
        >
          Schedule C Assistant
        </div>

        <div
          style={{
            fontSize: 56,
            color: 'rgba(255,255,255,0.9)',
            marginBottom: 60,
          }}
        >
          Transform tax season from stress to success
        </div>

        <div
          style={{
            transform: `scale(${buttonScale})`,
            background: 'white',
            color: '#1e3a8a',
            fontSize: 48,
            fontWeight: 'bold',
            padding: '30px 80px',
            borderRadius: 20,
            display: 'inline-block',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}
        >
          Get Started Today
        </div>

        <div
          style={{
            fontSize: 32,
            color: 'rgba(255,255,255,0.8)',
            marginTop: 40,
          }}
        >
          localhost:3003
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Main composition
export const ScheduleCCommercial: React.FC = () => {
  return (
    <AbsoluteFill>
      <Sequence from={0} durationInFrames={60}>
        <OpeningScene />
      </Sequence>

      <Sequence from={60} durationInFrames={60}>
        <ProblemScene />
      </Sequence>

      <Sequence from={120} durationInFrames={60}>
        <UploadScene />
      </Sequence>

      <Sequence from={180} durationInFrames={60}>
        <CategorizeScene />
      </Sequence>

      <Sequence from={240} durationInFrames={60}>
        <ResultsScene />
      </Sequence>

      <Sequence from={300} durationInFrames={60}>
        <ExportScene />
      </Sequence>

      <Sequence from={360} durationInFrames={90}>
        <ClosingScene />
      </Sequence>
    </AbsoluteFill>
  );
};
