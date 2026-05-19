// Build an ASS (Advanced SubStation Alpha) subtitle file suitable for
// ffmpeg's `subtitles=` filter — used later when rendering vertical clips
// with word-by-word animated captions.

export interface WordCue {
  text: string;
  startSec: number;
  endSec: number;
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  // h:mm:ss.cs (centiseconds)
  return `${h}:${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`;
}

const HEADER = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Default,Inter,72,&H00FFFFFF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,4,2,2,40,40,160,1

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
`;

function escape(text: string): string {
  // ASS uses \N for newlines and {} for inline overrides.
  return text.replace(/\{/g, "(").replace(/\}/g, ")").replace(/\n/g, " ");
}

export function buildAssFromWords(words: WordCue[]): string {
  const events = words
    .map((w) => {
      const start = formatTime(w.startSec);
      const end = formatTime(w.endSec);
      // Karaoke-style highlight: pop the word in with a small zoom.
      const inline = "{\\fad(80,40)\\fscx105\\fscy105}";
      return `Dialogue: 0,${start},${end},Default,,0,0,0,,${inline}${escape(w.text)}`;
    })
    .join("\n");
  return HEADER + events + "\n";
}

/**
 * Distribute a body of text across [startSec, endSec] as evenly-spaced
 * word cues. Real STT would be better but this gives a usable demo and
 * matches Opus Clip's word-by-word style.
 */
export function evenlySpacedWords(
  text: string,
  startSec: number,
  endSec: number,
  perWordOverlap = 0.05
): WordCue[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || endSec <= startSec) return [];

  const duration = endSec - startSec;
  const per = duration / words.length;

  return words.map((w, i) => ({
    text: w,
    startSec: startSec + i * per,
    endSec: startSec + (i + 1) * per + perWordOverlap,
  }));
}
