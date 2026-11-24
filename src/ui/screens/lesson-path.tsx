import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { LogEvent } from '../../data/event-store';
import { isLessonCompletedToday, lessonHistory } from '../../domain/lesson';
import type { Lesson } from '../../domain/lesson';
import { suggestedNextLesson } from '../../domain/lesson-stages';
import type { LessonGroup, LessonStage } from '../../domain/lesson-stages';
import { resolveLessonIcon } from '../lesson-icons';
import type { IconShape } from '../lesson-icons';
import {
  LESSON_STRINGS,
  lessonLearnedLabel,
  pathLessonFacts,
  pathStageCount,
  pathStageHeading,
  pathTrophyBody,
} from '../lesson-strings';
import { STRINGS } from '../strings';
import { Dialog } from './person-form';

/** Props for {@link LessonPath}. */
export interface LessonPathProps {
  /** Lesson groups in path order (from `groupLessonsByStage`). */
  readonly groups: readonly LessonGroup[];
  /** Event log, for learned / learned-today state. */
  readonly events: readonly LogEvent[];
  /** Current instant and the time zone of the local day. */
  readonly at: Date;
  readonly timeZone: string;
  /** Starts `lesson` (the screen's question flow). */
  readonly onStart: (lesson: Lesson) => void;
}

/** Horizontal offset of the n-th node, in px: a gentle zigzag. */
const ZIGZAG = [0, 44, 66, 44, 0, -44, -66, -44] as const;

/** Number of stage colours defined in styles.css (`.lesson-stage--c0` …). */
const STAGE_COLOURS = 8;

type Popup = { readonly kind: 'lesson'; readonly lesson: Lesson } | { readonly kind: 'trophy'; readonly group: LessonGroup };

/** Stroke-only SVG icon on a 24×24 grid. */
export function PathIcon({ shapes, className }: { readonly shapes: readonly IconShape[]; readonly className?: string }) {
  return (
    <svg className={className ?? 'path-icon'} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {shapes.map((s, i) =>
        'd' in s ? (
          <path key={i} d={s.d} />
        ) : 'r' in s ? (
          <circle key={i} cx={s.cx} cy={s.cy} r={s.r} />
        ) : (
          <rect key={i} x={s.x} y={s.y} width={s.width} height={s.height} rx={s.rx} />
        ),
      )}
    </svg>
  );
}

/**
 * The Học path (story 037): one card per stage (icon, title, description,
 * progress bar), then the stage's lessons as zigzag round buttons, then a
 * trophy. Nothing is locked; tapping a node opens a popup with the lesson's
 * facts and a start button. A bar at the top names the stage being viewed
 * once its card has scrolled away.
 */
export function LessonPath({ groups, events, at, timeZone, onStart }: LessonPathProps) {
  const [popup, setPopup] = useState<Popup | null>(null);
  const [barStage, setBarStage] = useState<number | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const learned = (id: string) => lessonHistory(events, id).count > 0;
  const nextId = suggestedNextLesson(groups, learned);

  useEffect(() => {
    const onScroll = () => {
      let current: number | null = null;
      cardRefs.current.forEach((card, index) => {
        if (card !== null && card.getBoundingClientRect().bottom < 0) current = index;
      });
      setBarStage(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [groups]);

  const barGroup = barStage === null ? undefined : groups[barStage];

  return (
    <div className="lesson-path">
      {barGroup !== undefined && (
        <div className={`lesson-path__bar lesson-stage--c${barStage! % STAGE_COLOURS}`} aria-hidden="true">
          <span>
            <small>{pathStageHeading(barStage! + 1, '')}</small>
            <b>{barGroup.stage?.title ?? LESSON_STRINGS.stageOther}</b>
          </span>
          <span className="lesson-path__bar-count">
            {pathStageCount(barGroup.lessons.filter((l) => learned(l.id)).length, barGroup.lessons.length)}
          </span>
        </div>
      )}
      {groups.map((group, groupIndex) => {
        const stage: LessonStage | null = group.stage;
        const total = group.lessons.length;
        const learnedCount = group.lessons.filter((l) => learned(l.id)).length;
        const allLearned = total > 0 && learnedCount === total;
        return (
          <section
            key={stage?.id ?? 'other'}
            className={`lesson-stage lesson-stage--c${groupIndex % STAGE_COLOURS}`}
            aria-label={pathStageHeading(groupIndex + 1, stage?.title ?? LESSON_STRINGS.stageOther)}
          >
            <div
              className="lesson-stage__card"
              ref={(el) => {
                cardRefs.current[groupIndex] = el;
              }}
            >
              <div className="lesson-stage__icon">
                <PathIcon shapes={resolveLessonIcon(stage?.icon)} />
              </div>
              <div className="lesson-stage__text">
                <h2 className="lesson-stage__title">{pathStageHeading(groupIndex + 1, stage?.title ?? LESSON_STRINGS.stageOther)}</h2>
                {stage?.description !== undefined && <p className="lesson-stage__desc">{stage.description}</p>}
                {total === 0 ? (
                  <p className="lesson-stage__soon">{LESSON_STRINGS.stageComingSoon}</p>
                ) : (
                  <div className="lesson-stage__progress">
                    <div
                      className="lesson-stage__bar"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={total}
                      aria-valuenow={learnedCount}
                      aria-label={pathStageCount(learnedCount, total)}
                    >
                      <i style={{ width: `${Math.round((100 * learnedCount) / total)}%` }} />
                    </div>
                    <span className="lesson-stage__count">{pathStageCount(learnedCount, total)}</span>
                  </div>
                )}
              </div>
            </div>
            {total > 0 && (
              <ol className="lesson-path__nodes">
                {group.lessons.map((lesson, i) => {
                  const isLearned = learned(lesson.id);
                  const isNext = lesson.id === nextId;
                  const state = isNext ? 'next' : isLearned ? 'done' : 'todo';
                  return (
                    <li
                      key={lesson.id}
                      className={`lesson-node-item lesson-node-item--${state}`}
                      style={{ '--path-x': `${ZIGZAG[i % ZIGZAG.length]}px` } as CSSProperties}
                    >
                      <button
                        type="button"
                        className={`lesson-node lesson-node--${state}`}
                        aria-label={`${lesson.title}${isLearned ? `, ${LESSON_STRINGS.pathLearned}` : ''}${isNext ? `, ${LESSON_STRINGS.pathNext}` : ''}`}
                        onClick={() => setPopup({ kind: 'lesson', lesson })}
                      >
                        {isNext && (
                          <span className="lesson-node__bubble" aria-hidden="true">
                            {LESSON_STRINGS.pathNext}
                          </span>
                        )}
                        <PathIcon shapes={resolveLessonIcon(lesson.icon, stage?.icon)} />
                        {isLearned && (
                          <span className="lesson-node__check" aria-hidden="true">
                            <PathIcon shapes={resolveLessonIcon('check')} />
                          </span>
                        )}
                      </button>
                      <span className="lesson-node__label" aria-hidden="true">
                        {lesson.title}
                      </span>
                    </li>
                  );
                })}
                <li className="lesson-node-item lesson-node-item--trophy">
                  <button
                    type="button"
                    className={`lesson-node lesson-node--trophy${allLearned ? ' lesson-node--trophy-won' : ''}`}
                    aria-label={LESSON_STRINGS.pathTrophy}
                    onClick={() => setPopup({ kind: 'trophy', group })}
                  >
                    <PathIcon shapes={resolveLessonIcon('trophy')} />
                  </button>
                  <span className="lesson-node__label" aria-hidden="true">
                    {LESSON_STRINGS.pathTrophy}
                  </span>
                </li>
              </ol>
            )}
          </section>
        );
      })}
      {popup?.kind === 'lesson' && (
        <Dialog title={popup.lesson.title} onClose={() => setPopup(null)}>
          {(() => {
            const history = lessonHistory(events, popup.lesson.id);
            const today = isLessonCompletedToday(events, popup.lesson.id, at, timeZone);
            return (
              <>
                <p className="lesson-sheet__facts">{pathLessonFacts(popup.lesson.xp, popup.lesson.questions.length)}</p>
                {history.count > 0 && history.lastAt !== null && <p className="lesson-sheet__learned">{lessonLearnedLabel(history.count, history.lastAt)}</p>}
                {today && <p className="lesson-sheet__learned">{STRINGS.lessonDoneToday}</p>}
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => {
                    const lesson = popup.lesson;
                    setPopup(null);
                    onStart(lesson);
                  }}
                >
                  {history.count > 0 ? LESSON_STRINGS.pathReview : LESSON_STRINGS.pathStart}
                </button>
                <button type="button" className="button button--secondary" onClick={() => setPopup(null)}>
                  {LESSON_STRINGS.pathClose}
                </button>
              </>
            );
          })()}
        </Dialog>
      )}
      {popup?.kind === 'trophy' && (
        <Dialog title={LESSON_STRINGS.pathTrophy} onClose={() => setPopup(null)}>
          <p className="popup__body">
            {pathTrophyBody(
              popup.group.lessons.filter((l) => learned(l.id)).length,
              popup.group.lessons.length,
              popup.group.stage?.title ?? LESSON_STRINGS.stageOther,
            )}
          </p>
          <button type="button" className="button button--secondary" onClick={() => setPopup(null)}>
            {LESSON_STRINGS.pathClose}
          </button>
        </Dialog>
      )}
    </div>
  );
}
