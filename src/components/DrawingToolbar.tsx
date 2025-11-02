import { useState } from 'react';
import { Button } from './ui/button';
import { MousePointer2, Minus, Eraser, Sparkles, Loader2, Trash2 } from 'lucide-react';

type Mode = 'select' | 'create-horizontal' | 'erase';

interface Props {
  mode: Mode;
  onModeChange: (m: Mode) => void;
  onAiSuggest?: () => Promise<void> | void;
  onClearAI?: () => void;
}

export function DrawingToolbar({ mode, onModeChange, onAiSuggest, onClearAI }: Props) {
  const [loading, setLoading] = useState(false);
  const handleChange = (m: Mode) => {
    onModeChange(m);
  };

  return (
    <div className="flex items-center gap-2 pointer-events-auto" role="group" aria-label="드로잉 툴바" style={{ pointerEvents: 'auto' }}>
      <Button
        variant="outline"
        size="sm"
        aria-pressed={mode === 'select'}
        onClick={() => handleChange('select')}
        className={mode === 'select' ? 'bg-slate-100 border-slate-900' : ''}
        aria-label="선택"
      >
        <MousePointer2 className="w-4 h-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        aria-pressed={mode === 'create-horizontal'}
        onClick={() => handleChange('create-horizontal')}
        className={mode === 'create-horizontal' ? 'bg-slate-100 border-slate-900' : ''}
        aria-label="수평선"
      >
        <Minus className="w-4 h-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        aria-pressed={mode === 'erase'}
        onClick={() => handleChange('erase')}
        className={mode === 'erase' ? 'bg-slate-100 border-slate-900' : ''}
        aria-label="지우기"
      >
        <Eraser className="w-4 h-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          if (!onAiSuggest) return;
          try {
            // @ts-ignore
            if (setLoading) setLoading(true);
            await onAiSuggest();
          } finally {
            // @ts-ignore
            if (setLoading) setLoading(false);
          }
        }}
        aria-label="AI 제안"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onClearAI?.()}
        aria-label="AI 지우기"
        title="AI 지우기"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}
