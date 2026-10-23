import { useLayoutEffect, useRef, useState } from 'react';

/** Long titles/descriptions collapse to `maxLines` by default; clicking
 * expands to the full text, clicking again collapses back. Truncation is
 * measured from the element's own layout (scrollHeight vs the clamped
 * clientHeight), so text that fits naturally renders as a plain, non-click,
 * paragraph with no expansion affordance.
 *
 * The click handler stops propagation ONLY while the text can toggle — a
 * truncated card title claims the click for expand/collapse instead of the
 * parent's "expand inline details" handler, while a short one passes the
 * click straight through (same behavioral contract as the mobile app's
 * components/ui/expandable-text.tsx). */
export default function ExpandableText({
  text,
  maxLines = 2,
  as: Tag = 'p',
  className = '',
}) {
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const ref = useRef(null);

  // Measured in the clamped (collapsed) state only — while expanded the
  // height IS the full text, so there is nothing to compare. Re-measured on
  // resize so wrapping changes across viewport widths stay accurate.
  useLayoutEffect(() => {
    if (expanded) return undefined;
    const el = ref.current;
    if (!el) return undefined;

    const measure = () => setTruncated(el.scrollHeight > el.clientHeight + 1);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [expanded, maxLines, text]);

  const canToggle = truncated || expanded;

  const handleClick = (e) => {
    if (!canToggle) return; // short text: let the parent's click handler run
    e.stopPropagation();
    setExpanded((v) => !v);
  };

  return (
    <Tag
      ref={ref}
      className={`${className}${canToggle ? ' cursor-pointer' : ''}`}
      onClick={handleClick}
      style={
        expanded
          ? undefined
          : {
              display: '-webkit-box',
              WebkitLineClamp: maxLines,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }
      }
    >
      {text}
    </Tag>
  );
}
