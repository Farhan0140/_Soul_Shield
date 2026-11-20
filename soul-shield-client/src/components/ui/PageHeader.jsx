import { cn } from '../../utils/cn';

/** Page title block: optional back link / eyebrow, title, description, and
 * actions that sit to the right on wide screens and wrap below on phones. */
export default function PageHeader({ title, description, eyebrow, back, actions, className = '' }) {
  return (
    <header className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {back && <div className="mb-3">{back}</div>}
        {eyebrow && <p className="mb-2 text-[13px] text-muted">{eyebrow}</p>}
        <h1 className="display text-[32px] leading-[1.15] break-words text-fg sm:text-[40px]">{title}</h1>
        {description && <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Heading for a block inside a page. */
export function SectionHeader({ title, meta, action, tone = 'default', className = '' }) {
  return (
    <div className={cn('mb-3 flex items-center justify-between gap-3', className)}>
      <h2 className={cn('text-sm font-medium', tone === 'danger' ? 'text-danger' : 'text-fg')}>
        {title}
        {meta != null && <span className="ml-2 font-normal tabular-nums text-muted">{meta}</span>}
      </h2>
      {action}
    </div>
  );
}
