import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';

const LazyTelemetryChart = lazy(() => import('../TelemetryChart'));

export default function TelemetryPanel({ title, subtitle, option, tools, footer, className = '', onVisibilityChange }: {
  title: string;
  subtitle?: string;
  option: object;
  tools?: ReactNode;
  footer?: ReactNode;
  className?: string;
  onVisibilityChange?: (visible: boolean) => void;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!('IntersectionObserver' in window)) { setVisible(true); onVisibilityChange?.(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      onVisibilityChange?.(entry.isIntersecting);
      if (entry.isIntersecting) {
        setVisible(true);
        if (!onVisibilityChange) observer.disconnect();
      }
    }, { rootMargin: '300px' });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [onVisibilityChange]);
  return <section className={`panel chart-panel ${className}`} ref={ref} aria-label={title}>
    <div className="telemetry-heading"><div><h2>{title}</h2>{subtitle && <p className="telemetry-subtitle">{subtitle}</p>}</div>{tools}</div>
    <Suspense fallback={<div className="chart-placeholder" aria-busy="true" />}>{visible ? <LazyTelemetryChart option={option} /> : <div className="chart-placeholder" />}</Suspense>
    {footer}
  </section>;
}
