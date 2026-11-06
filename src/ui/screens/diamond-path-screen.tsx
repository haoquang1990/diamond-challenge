import { useCallback, useEffect, useState } from 'react';
import gameConfig from '../../config/game-config.json';
import type { EventStore, LogEvent } from '../../data/event-store';
import { computeProgress } from '../../domain/progress';
import { computeStageProgress, lastAcknowledgedStageId, parseStageConfig, shouldCelebrate } from '../../domain/stages';
import type { StageDef, StageProgress, StageStatus } from '../../domain/stages';
import {
  STRINGS,
  milestoneCountLabel,
  stagePercentLabel,
  stageXpNeedLabel,
  xpRemainingLabel,
} from '../strings';

const PARSED_STAGES = parseStageConfig(gameConfig.stages);
if (PARSED_STAGES.problems.length > 0) console.warn('[stages] config problems', PARSED_STAGES.problems);

/** Stages from game-config.json, validated once at load. */
export const DEFAULT_STAGES: readonly StageDef[] = PARSED_STAGES.stages;

/** Stage progress plus the stage to celebrate (null when nothing new). */
export interface StageView {
  readonly progress: StageProgress;
  readonly celebrate: StageDef | null;
}

/**
 * Derives the stage view from the log: total XP via computeProgress, stages
 * via computeStageProgress, and whether a celebration is due given the last
 * `settings_changed { stageAcknowledged }`. Pure.
 */
export function buildStageView(
  events: readonly LogEvent[],
  stages: readonly StageDef[],
  now: Date,
  timeZone: string,
): StageView {
  const { totalXp } = computeProgress(events, now, { dailyXpGoal: gameConfig.dailyXpGoal }, timeZone);
  const progress = computeStageProgress(events, totalXp, stages);
  const celebrate =
    progress.current !== null && shouldCelebrate(lastAcknowledgedStageId(events), progress.currentIndex, stages)
      ? progress.current
      : null;
  return { progress, celebrate };
}

/** Props for {@link DiamondPathScreen}. */
export interface DiamondPathScreenProps {
  /** Event log stages are derived from (injected). */
  readonly eventStore: EventStore;
  /** Stages; defaults to game-config.json. */
  readonly stages?: readonly StageDef[];
  /** Clock; defaults to the real one. */
  readonly now?: () => Date;
  /** IANA time zone; defaults to the device's. */
  readonly timeZone?: string;
  /** Opens the Bảng 30x30 screen; the entry button is shown only when provided. */
  readonly onOpenBoard?: () => void;
}

type ScreenState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error' }
  | { readonly kind: 'ready'; readonly progress: StageProgress; readonly celebrate: StageDef | null };

function realNow(): Date {
  return new Date();
}

/**
 * Màn Con đường: vertical path of stages (done / current / locked). Tapping a
 * stage expands its unlock conditions. A newly reached stage is celebrated by
 * the achievements popup (story 017), not on this screen.
 */
export function DiamondPathScreen({
  eventStore,
  stages = DEFAULT_STAGES,
  now = realNow,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  onOpenBoard,
}: DiamondPathScreenProps) {
  const [state, setState] = useState<ScreenState>({ kind: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    eventStore
      .list()
      .then((events) => {
        if (cancelled) return;
        const view = buildStageView(events, stages, now(), timeZone);
        // Reaching a stage is celebrated by the achievements popup (story 017), on any screen.
        setState({ kind: 'ready', progress: view.progress, celebrate: null });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('[path] failed to read the event log', error);
        setState({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [eventStore, stages, now, timeZone, reloadKey]);

  return (
    <main className="screen">
      <header className="screen__header">
        <h1 className="screen__title">{STRINGS.pathTitle}</h1>
        <p className="screen__prompt">{STRINGS.pathPrompt}</p>
      </header>

      <p className="path-disclaimer">{STRINGS.pathDisclaimer}</p>

      {onOpenBoard !== undefined && (
        <button type="button" className="button button--secondary" onClick={onOpenBoard}>
          {STRINGS.boardOpen}
        </button>
      )}

      {state.kind === 'loading' && (
        <p className="message" role="status">
          {STRINGS.loading}
        </p>
      )}
      {state.kind === 'error' && (
        <div className="card">
          <p className="message message--error" role="alert">
            {STRINGS.pathLoadError}
          </p>
          <button type="button" className="button button--secondary" onClick={reload}>
            {STRINGS.retry}
          </button>
        </div>
      )}

      {state.kind === 'ready' && state.progress.stages.length === 0 && <p className="message">{STRINGS.pathNoStages}</p>}

      {state.kind === 'ready' && state.progress.stages.length > 0 && (
        <ol className="path-list">
          {state.progress.stages.map((status) => (
            <StageItem
              key={status.stage.id}
              status={status}
              progress={state.progress}
              open={openId === status.stage.id}
              onToggle={() => setOpenId(openId === status.stage.id ? null : status.stage.id)}
            />
          ))}
        </ol>
      )}
    </main>
  );
}

function stateLabel(state: StageStatus['state']): string {
  return state === 'done' ? STRINGS.stageDone : state === 'current' ? STRINGS.stageCurrent : STRINGS.stageLocked;
}

interface StageItemProps {
  readonly status: StageStatus;
  readonly progress: StageProgress;
  readonly open: boolean;
  readonly onToggle: () => void;
}

/** One stage on the path; a button that expands its unlock conditions. */
function StageItem({ status, progress, open, onToggle }: StageItemProps) {
  const { stage, state } = status;
  const panelId = `stage-${stage.id}-conditions`;
  const isCurrent = state === 'current';
  return (
    <li className={`path-item path-item--${state}`} aria-current={isCurrent ? 'step' : undefined}>
      <span className="path-node" aria-hidden="true">
        {state === 'done' ? '✓' : state === 'locked' ? '' : '◆'}
      </span>
      <button type="button" className="path-stage" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
        <span className="path-stage__row">
          <span className="path-stage__name">{stage.name}</span>
          <span className="path-stage__tag">{stateLabel(state)}</span>
        </span>
        {isCurrent && <CurrentDetail progress={progress} />}
        {open && (
          <span id={panelId}>
            <span className="path-stage__detail">{STRINGS.stageConditions}</span>
            <ul className="path-conditions">
              <li className={status.xpMissing === 0 ? 'path-conditions__met' : undefined}>
                {stageXpNeedLabel(stage.xp)}
                {status.xpMissing === 0 ? ` · ${STRINGS.stageReached}` : ` · ${xpRemainingLabel(status.xpMissing)}`}
              </li>
              {status.milestones.map((m) => (
                <li key={`${m.activityType}-${m.count}`} className={m.met ? 'path-conditions__met' : undefined}>
                  {milestoneCountLabel(m.label, m.current, m.count)}
                  {m.met ? ` · ${STRINGS.stageReached}` : ''}
                </li>
              ))}
            </ul>
          </span>
        )}
      </button>
    </li>
  );
}

/** Percentage toward the next stage and what is still missing, on the current stage. */
function CurrentDetail({ progress }: { readonly progress: StageProgress }) {
  const { next, percentToNext, blockedByMilestones, xpToNext, missingMilestones } = progress;
  if (next === null) return <span className="path-stage__detail">{STRINGS.stageLastReached}</span>;
  const percent = Math.floor(percentToNext);
  return (
    <>
      <span
        className="xp-bar"
        style={{ display: 'block' }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={stagePercentLabel(percent, next.name)}
      >
        <span className="xp-bar__fill" style={{ display: 'block', width: `${percent}%` }} />
      </span>
      <span className="path-stage__detail">{stagePercentLabel(percent, next.name)}</span>
      {blockedByMilestones && <span className="path-stage__warn">{STRINGS.stageXpMetMilestoneMissing}</span>}
      <span className="path-stage__detail">
        {STRINGS.stageNeed}:{' '}
        {[
          ...(xpToNext > 0 ? [`${xpToNext} XP`] : []),
          ...missingMilestones.map((m) => milestoneCountLabel(m.label, m.current, m.count)),
        ].join(' · ')}
      </span>
    </>
  );
}
