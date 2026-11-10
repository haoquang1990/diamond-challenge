import type { OrderQuestion } from '../../domain/lesson';
import { orderSlotResults } from '../../domain/lesson';
import { LESSON_STRINGS, orderEmptySlotLabel } from '../lesson-strings';

/** Props for {@link OrderQuestionView}. */
export interface OrderQuestionViewProps {
  readonly question: OrderQuestion;
  /** Display order of the step pool (original step indices). */
  readonly shuffled: readonly number[];
  /** Step indices placed so far, slot by slot. */
  readonly placed: readonly number[];
  /** True once checked: placement is locked and results are shown. */
  readonly checked: boolean;
  /** Tap on a pool step: put it in the next empty slot. */
  readonly onPlace: (stepIndex: number) => void;
  /** Tap on a filled slot: return its step to the pool. */
  readonly onRemove: (slot: number) => void;
}

/**
 * "Xếp đúng thứ tự" body: numbered slots on top, shuffled step cards below.
 * Display only; the lesson screen owns `placed` and the check.
 */
export function OrderQuestionView({ question, shuffled, placed, checked, onPlace, onRemove }: OrderQuestionViewProps) {
  const results = checked ? orderSlotResults(placed) : [];
  const allRight = checked && results.every(Boolean);
  return (
    <div className="order-question">
      {!checked && <p className="order-question__hint">{LESSON_STRINGS.orderHint}</p>}
      <ol className="order-slots" aria-label={LESSON_STRINGS.orderSlotsLabel}>
        {question.steps.map((_, slot) => {
          const stepIndex = placed[slot];
          const position = slot + 1;
          if (stepIndex === undefined) {
            return (
              <li key={slot} className="order-slot order-slot--empty" aria-label={orderEmptySlotLabel(position)}>
                <span className="order-slot__number" aria-hidden="true">
                  {position}
                </span>
              </li>
            );
          }
          let modifier = '';
          if (checked) modifier = results[slot] === true ? ' order-slot--correct' : ' order-slot--wrong';
          return (
            <li key={slot} className={`order-slot${modifier}`}>
              <button type="button" className="order-slot__button" disabled={checked} onClick={() => onRemove(slot)}>
                <span className="order-slot__number" aria-hidden="true">
                  {position}
                </span>
                <span>{question.steps[stepIndex]}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {!checked && (
        <div className="order-pool" role="group" aria-label={LESSON_STRINGS.orderPoolLabel}>
          {shuffled
            .filter((stepIndex) => !placed.includes(stepIndex))
            .map((stepIndex) => (
              <button key={stepIndex} type="button" className="lesson-option order-pool__step" onClick={() => onPlace(stepIndex)}>
                {question.steps[stepIndex]}
              </button>
            ))}
        </div>
      )}
      {checked && !allRight && (
        <div className="order-answer">
          <p className="order-answer__title">{LESSON_STRINGS.orderCorrectOrderTitle}</p>
          <ol className="order-answer__list">
            {question.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
