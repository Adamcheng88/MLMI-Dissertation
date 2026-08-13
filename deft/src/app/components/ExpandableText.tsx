import { useState, useRef, useLayoutEffect, useEffect } from 'react';

interface ExpandableTextProps {
  text: string;

  maxLines?: number;
  className?: string;
}


export default function ExpandableText({
  text,
  maxLines = 10,
  className = 'text-sm text-muted-foreground leading-relaxed',
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);


  useEffect(() => {
    setExpanded(false);
  }, [text]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const cs = getComputedStyle(el);
    let lineHeight = parseFloat(cs.lineHeight);
    if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
      lineHeight = parseFloat(cs.fontSize) * 1.625;
    }


    const probe = el.cloneNode(true) as HTMLParagraphElement;
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    probe.style.display = 'block';
    probe.style.webkitLineClamp = 'unset';
    probe.style.overflow = 'visible';
    probe.style.height = 'auto';
    probe.style.maxHeight = 'none';
    probe.style.width = `${el.clientWidth}px`;
    el.parentElement?.appendChild(probe);
    const fullHeight = probe.scrollHeight;
    probe.remove();

    setOverflows(fullHeight > lineHeight * maxLines + 1);
  }, [text, maxLines]);

  return (
    <div>
      <p
        ref={ref}
        className={className}
        style={
          expanded
            ? undefined
            : {
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: maxLines,
                overflow: 'hidden',
              }
        }
      >
        {text}
      </p>
      {overflows && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="mt-1.5 text-xs font-medium text-primary hover:underline"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}
