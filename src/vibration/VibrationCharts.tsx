import { useEffect, useMemo, useState } from 'react';
import { Download, Pause, Play, RotateCcw } from 'lucide-react';
import TelemetryPanel from '../components/TelemetryPanel';
import { axes, featureScope, readWaveformBundle, selectReference, vibrationTrendOption, waveformOption, type Axis, type WaveformBundle } from './model';

type Reading = Parameters<typeof vibrationTrendOption>[0][number] & { crackMm?: number; windSpeed: number; rpm: number; source?: string; serviceMode?: string };
let archivePromise: Promise<WaveformBundle> | null = null;
function loadArchive() {
  if (!archivePromise) archivePromise = fetch(`${import.meta.env.BASE_URL}data/vibration-waveforms.json`)
    .then((response) => { if (!response.ok) throw new Error('Reference archive unavailable'); return response.json(); })
    .then(readWaveformBundle).catch((error: unknown) => { archivePromise = null; throw error; });
  return archivePromise;
}

function ReferenceWaveform({ latest }: { latest: Reading }) {
  const [inView, setInView] = useState(false);
  const [archive, setArchive] = useState<WaveformBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [axis, setAxis] = useState<Axis>('X');
  const [offset, setOffset] = useState(0);
  const held = latest.source === 'manual-input';
  const [playing, setPlaying] = useState(() => !held && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [documentVisible, setDocumentVisible] = useState(!document.hidden);
  const suspended = latest.serviceMode === 'in-downtime' || latest.rpm === 0;
  useEffect(() => {
    if (!inView || archive || error) return;
    let active = true;
    void loadArchive().then((bundle) => { if (active) setArchive(bundle); }).catch(() => { if (active) setError('Reference archive unavailable'); });
    return () => { active = false; };
  }, [inView, archive, error, attempt]);
  useEffect(() => {
    const visibility = () => setDocumentVisible(!document.hidden);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const preference = () => { if (media.matches) setPlaying(false); };
    document.addEventListener('visibilitychange', visibility);
    media.addEventListener('change', preference);
    return () => { document.removeEventListener('visibilitychange', visibility); media.removeEventListener('change', preference); };
  }, []);
  useEffect(() => { if (held) setPlaying(false); }, [held]);
  const record = useMemo(() => archive ? selectReference(archive.records, latest.crackMm ?? 0, latest.windSpeed) : null, [archive, latest.crackMm, latest.windSpeed]);
  useEffect(() => setOffset(0), [record?.id]);
  const active = !!record && playing && !suspended && inView && documentVisible;
  useEffect(() => {
    if (!active || !record) return;
    const timer = window.setInterval(() => setOffset((current) => current + record.sampleRateHz / 10 > record.samples.length - record.sampleRateHz / 4 ? 0 : current + record.sampleRateHz / 10), 100);
    return () => window.clearInterval(timer);
  }, [active, record]);
  const option = useMemo(() => waveformOption(record, axis, offset), [record, axis, offset]);
  function download() {
    if (!record || !archive) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify({ manifest: archive.manifest, reference: record }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = record.id.replace('.csv', '-excerpt.json'); link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return <TelemetryPanel title="Blade Acceleration Waveform" subtitle="Archived simulated reference / looped excerpt / not live" className="waveform-panel" option={option} onVisibilityChange={setInView}
    tools={<div className="waveform-tools"><fieldset className="waveform-axis"><legend className="sr-only">Waveform axis</legend>{axes.map((value) => <label key={value} title={`${value} axis acceleration`}><input type="radio" name="waveform-axis" value={value} aria-label={`Waveform ${value} axis`} checked={axis === value} onChange={() => setAxis(value)} /><span>{value}</span></label>)}</fieldset>
      <button type="button" aria-label={playing && !suspended ? 'Pause archived reference' : 'Play archived reference'} title={suspended ? 'Reference paused during simulated hold' : playing ? 'Pause archived reference' : 'Play archived reference'} disabled={!record || suspended} onClick={() => setPlaying((current) => !current)}>{playing && !suspended ? <Pause size={16} /> : <Play size={16} />}</button>
      <button type="button" aria-label="Download reference excerpt" title="Download reference excerpt (JSON)" disabled={!record} onClick={download}><Download size={16} /></button>
    </div>}
    footer={<div className="waveform-caption" data-reference-id={record?.id ?? ''} data-axis={axis} data-offset={offset} data-playing={active}>
      {record ? <><span>{record.state} reference / {record.crackMm} mm / {record.windSpeed.toFixed(2)} m/s / {(record.sampleRateHz / 1000).toFixed(0)} kHz</span><span>{record.id} / <strong>{suspended ? 'Simulated WT hold' : playing ? 'Reference playback' : 'Reference paused'}</strong></span><span className="waveform-time">Excerpt {(offset / record.sampleRateHz).toFixed(3)}-{((offset + record.sampleRateHz / 4 - 1) / record.sampleRateHz).toFixed(3)} s / not synchronised with model features</span></>
        : error ? <div role="alert">{error}<button type="button" title="Retry reference archive" aria-label="Retry reference archive" onClick={() => { setError(null); setAttempt((current) => current + 1); }}><RotateCcw size={16} /></button></div> : <span role="status">Reference archive pending</span>}
    </div>} />;
}

export default function VibrationCharts({ history, latest }: { history: Reading[]; latest: Reading }) {
  return <div className="vibration-grid" aria-label="Blade vibration monitoring">
    <TelemetryPanel title="Blade Vibration RMS" subtitle={`X / flapwise, Y / edgewise, Z / auxiliary / g. ${featureScope(latest)}`} option={vibrationTrendOption(history, 'rms')} />
    <TelemetryPanel title="Blade Vibration Kurtosis" subtitle={`Pearson / unitless / focused scale. ${featureScope(latest)}`} option={vibrationTrendOption(history, 'kurtosis')} />
    <ReferenceWaveform latest={latest} />
  </div>;
}
