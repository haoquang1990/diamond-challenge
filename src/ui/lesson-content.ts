/**
 * Lessons and lesson stages from `content/lessons.json`, validated once at
 * load (never throws). Shared by Học and the Hôm nay suggestion (story 039).
 */
import lessonsJson from '../content/lessons.json';
import { parseLessons } from '../domain/lesson';
import type { ParsedLessons } from '../domain/lesson';
import { parseLessonStages } from '../domain/lesson-stages';
import type { LessonStage } from '../domain/lesson-stages';

/** Valid lessons in file order, plus parse problems. */
export const LOADED_LESSONS: ParsedLessons = parseLessons(lessonsJson);

/** Lesson stages in path order. */
export const LOADED_STAGES: readonly LessonStage[] = parseLessonStages(lessonsJson).stages;
