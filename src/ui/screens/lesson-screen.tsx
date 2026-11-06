import { useEffect, useState } from 'react';
import lessonsJson from '../../content/lessons.json';
import type { EventStore, LogEvent } from '../../data/event-store';
import { computeLessonResult, gradeAnswer, isLessonCompletedToday, parseLessons, xpForCompletion } from '../../domain/lesson';
import type { Lesson, LessonResult, ParsedLessons } from '../../domain/lesson';
import { STRINGS, questionProgressLabel, scoreLabel, xpLabel } from '../strings';

/** Lessons from content/lessons.json, validated once at load (never throws). */
const LOADED_LESSONS: ParsedLessons = parseLessons(lessonsJson);

/** Props for {@link LessonScreen}. */
export interface LessonScreenProps {
  /** Event log the completion is appended to (injected; no singleton). */
  readonly eventStore: EventStore;
  /** Called from the finished screen to return to Hôm nay. */
  readonly onDone: () => void;
  /** Called with true while a lesson is running (the shell hides the tab bar). */
  readonly onActiveChange?: (active: boolean) => void;
  /** Lessons to offer; defaults to the validated content file. */
  readonly parsed?: ParsedLessons;
  /** Injected clock; defaults to the real one. */
  readonly now?: () => Date;
  /** IANA time zone defining the local day; defaults to the device's. */
  readonly timeZone?: string;
}

type ViewState =
  | { readonly kind: 'list' }
  | {
      readonly kind: 'question';
      readonly lesson: Lesson;
      readonly index: number;
      readonly answers: readonly number[];
      /** Chosen option for the current question, or null before answering. */
      readonly selected: number | null;
      readonly saving: boolean;
      readonly error: string | null;
    }
  | { readonly kind: 'complete'; readonly lesson: Lesson; readonly xp: number; readonly result: LessonResult };

/**
 * Màn Học (brief MVP feature 2, story 005). List → questions with instant
 * đúng/sai + explanation → complete. Completion appends `lesson_completed`
 * `{ lessonId, xp, score }`; a same-day repeat appends it with xp 0.
 */
export function LessonScreen({
  eventStore,
  onDone,
  onActiveChange,
  parsed = LOADED_LESSONS,
  now = () => new Date(),
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
}: LessonScreenProps) {
  const [view, setView] = useState<ViewState>({ kind: 'list' });
  const [events, setEvents] = useState<readonly LogEvent[]>([]);

  const running = view.kind === 'question';
  useEffect(() => {
    onActiveChange?.(running);
  }, [running, onActiveChange]);
  useEffect(() => () => onActiveChange?.(false), [onActiveChange]);

  useEffect(() => {
    if (view.kind !== 'list') return undefined;
    let cancelled = false;
    eventStore
      .list()
      .then((list) => {
        if (!cancelled) setEvents(list);
      })
      .catch((error: unknown) => console.error('[lesson] could not read the event log', error));
    return () => {
      cancelled = true;
    };
  }, [eventStore, view.kind]);

  if (parsed.lessons.length === 0) {
    return (
      <main className="screen">
        <header className="screen__header">
          <h1 className="screen__title">{STRINGS.lessonListTitle}</h1>
        </header>
        <div className="card" role="alert">
          <h2 className="card__title">{STRINGS.lessonErrorTitle}</h2>
          <p className="card__body">{STRINGS.lessonErrorBody}</p>
        </div>
      </main>
    );
  }

  async function advance(): Promise<void> {
    if (view.kind !== 'question' || view.selected === null || view.saving) return;
    const { lesson, index } = view;
    const answers = [...view.answers, view.selected];
    if (index + 1 < lesson.questions.length) {
      setView({ kind: 'question', lesson, index: index + 1, answers, selected: null, saving: false, error: null });
      return;
    }
    setView({ ...view, saving: true, error: null });
    try {
      const history = await eventStore.list();
      const at = now();
      const xp = xpForCompletion(lesson, history, at, timeZone);
      const result = computeLessonResult(lesson, answers);
      await eventStore.append({
        type: 'lesson_completed',
        timestamp: at.toISOString(),
        payload: { lessonId: lesson.id, xp, score: result.correct },
      });
      setView({ kind: 'complete', lesson, xp, result });
    } catch (error) {
      console.error('[lesson] save failed', error);
      setView({ ...view, saving: false, error: STRINGS.lessonSaveError });
    }
  }

  if (view.kind === 'question') {
    const { lesson, index, selected, saving, error } = view;
    const question = lesson.questions[index];
    if (question === undefined) return null;
    const answered = selected !== null;
    const correct = answered && gradeAnswer(question, selected);
    const last = index + 1 === lesson.questions.length;
    return (
      <main className="screen">
        <header className="screen__header">
          <button type="button" className="back-button" onClick={() => setView({ kind: 'list' })} disabled={saving}>
            ‹ {STRINGS.lessonLeave}
          </button>
          <p className="lesson-progress">{questionProgressLabel(index + 1, lesson.questions.length)}</p>
          <h1 className="screen__prompt">{question.prompt}</h1>
        </header>
        <div className="lesson-options">
          {question.options.map((option, optionIndex) => {
            let modifier = '';
            if (answered && optionIndex === question.correctIndex) modifier = ' lesson-option--correct';
            else if (answered && optionIndex === selected) modifier = ' lesson-option--wrong';
            return (
              <button
                key={option}
                type="button"
                className={`lesson-option${modifier}`}
                disabled={answered}
                onClick={() => setView({ ...view, selected: optionIndex })}
              >
                {option}
              </button>
            );
          })}
        </div>
        {answered && (
          <div className={correct ? 'lesson-feedback lesson-feedback--correct' : 'lesson-feedback lesson-feedback--wrong'} role="status" aria-live="polite">
            <p className="lesson-feedback__title">{correct ? STRINGS.lessonCorrect : STRINGS.lessonWrong}</p>
            <p className="lesson-feedback__body">{question.explanation}</p>
          </div>
        )}
        {error !== null && (
          <p className="message message--error" role="alert">
            {error}
          </p>
        )}
        <div className="action-bar">
          <button type="button" className="button button--primary" disabled={!answered || saving} onClick={() => void advance()}>
            {saving ? STRINGS.lessonFinishing : !answered ? STRINGS.lessonCheckAnswer : last ? STRINGS.lessonFinish : STRINGS.lessonNext}
          </button>
        </div>
      </main>
    );
  }

  if (view.kind === 'complete') {
    return (
      <main className="screen screen--saved">
        <div className="saved-feedback" role="status" aria-live="polite">
          <div className="saved-feedback__gem" aria-hidden="true">
            ◆
          </div>
          <p className="saved-feedback__title">{STRINGS.lessonCompleteTitle}</p>
          <p className="lesson-complete__lesson">{view.lesson.title}</p>
          <p className="saved-feedback__xp">{view.xp > 0 ? xpLabel(view.xp) : STRINGS.lessonRepeatNote}</p>
          <p className="message">{scoreLabel(view.result.correct, view.result.total)}</p>
        </div>
        <div className="action-bar">
          <button type="button" className="button button--secondary" onClick={() => setView({ kind: 'list' })}>
            {STRINGS.lessonBackToList}
          </button>
          <button type="button" className="button button--primary" onClick={onDone}>
            {STRINGS.lessonFinish}
          </button>
        </div>
      </main>
    );
  }

  const at = now();
  return (
    <main className="screen">
      <header className="screen__header">
        <button type="button" className="back-button" onClick={onDone}>
          ‹ {STRINGS.back}
        </button>
        <h1 className="screen__title">{STRINGS.lessonListTitle}</h1>
        <p className="screen__prompt">{STRINGS.lessonListPrompt}</p>
      </header>
      {parsed.problems.length > 0 && <p className="message">{STRINGS.lessonSkippedNote}</p>}
      <div className="activity-list">
        {parsed.lessons.map((lesson) => {
          const done = isLessonCompletedToday(events, lesson.id, at, timeZone);
          return (
            <button
              key={lesson.id}
              type="button"
              className={done ? 'activity-option lesson-item--done' : 'activity-option'}
              onClick={() =>
                setView({ kind: 'question', lesson, index: 0, answers: [], selected: null, saving: false, error: null })
              }
            >
              <span className="activity-option__name">
                {done && '✓ '}
                {lesson.title}
              </span>
              <span className="activity-option__xp">{done ? STRINGS.lessonDoneToday : xpLabel(lesson.xp)}</span>
            </button>
          );
        })}
      </div>
    </main>
  );
}
