import type { MatchQuestion } from '../../domain/lesson';
import { matchPairResults } from '../../domain/lesson';
import { LESSON_STRINGS } from '../lesson-strings';

/** Props for {@link MatchQuestionView}. */
export interface MatchQuestionViewProps {
  readonly question: MatchQuestion;
  /** Display order of the right-hand items (pair indices). */
  readonly shuffled: readonly number[];
  /** Per left item (pair index): the linked right item's pair index, or null. */
  readonly links: readonly (number | null)[];
  /** Left item waiting for a right item, or null. */
  readonly pendingLeft: number | null;
  /** True once checked: links are locked and results are shown. */
  readonly checked: boolean;
  /** Tap on a left item. */
  readonly onTapLeft: (left: number) => void;
  /** Tap on a right item (pair index). */
  readonly onTapRight: (right: number) => void;
}

/**
 * "Ghép cặp" body: numbered left cards on top, shuffled right cards below.
 * A linked right card shows the number of its left card. Display only; the
 * lesson screen owns `links` and the check.
 */
export function MatchQuestionView({ question, shuffled, links, pendingLeft, checked, onTapLeft, onTapRight }: MatchQuestionViewProps) {
  const results = checked ? matchPairResults(links.map((r) => r ?? -1)) : [];
  const allRight = checked && results.every(Boolean);
  const leftOf = (right: number): number => links.indexOf(right);
  return (
    <div className="match-question">
      {!checked && <p className="order-question__hint">{LESSON_STRINGS.matchHint}</p>}
      <div className="match-column" role="group" aria-label={LESSON_STRINGS.matchLeftLabel}>
        {question.pairs.map((pair, left) => {
          const linked = links[left] !== null && links[left] !== undefined;
          let modifier = '';
          if (checked) modifier = results[left] === true ? ' match-card--correct' : ' match-card--wrong';
          else if (pendingLeft === left) modifier = ' match-card--pending';
          else if (linked) modifier = ' match-card--linked';
          return (
            <button
              key={pair.left}
              type="button"
              className={`match-card${modifier}`}
              disabled={checked}
              aria-pressed={pendingLeft === left}
              onClick={() => onTapLeft(left)}
            >
              <span className="order-slot__number" aria-hidden="true">
                {left + 1}
              </span>
              <span>{pair.left}</span>
            </button>
          );
        })}
      </div>
      <div className="match-column match-column--right" role="group" aria-label={LESSON_STRINGS.matchRightLabel}>
        {shuffled.map((right) => {
          const pair = question.pairs[right];
          if (pair === undefined) return null;
          const left = leftOf(right);
          let modifier = left >= 0 ? ' match-card--linked' : '';
          if (checked) modifier = results[left] === true ? ' match-card--correct' : ' match-card--wrong';
          return (
            <button
              key={pair.right}
              type="button"
              className={`match-card match-card--answer${modifier}`}
              disabled={checked}
              onClick={() => onTapRight(right)}
            >
              <span className={left >= 0 ? 'order-slot__number' : 'order-slot__number match-card__badge--empty'} aria-hidden="true">
                {left >= 0 ? left + 1 : ''}
              </span>
              <span>{pair.right}</span>
            </button>
          );
        })}
      </div>
      {checked && !allRight && (
        <div className="order-answer">
          <p className="order-answer__title">{LESSON_STRINGS.matchCorrectPairsTitle}</p>
          <ul className="order-answer__list">
            {question.pairs.map((pair) => (
              <li key={pair.left}>
                {pair.left} → {pair.right}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
