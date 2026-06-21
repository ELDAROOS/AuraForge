// ─── Workout Database ─────────────────────────────────────────────
// Zero-cost local data source for workout programs.

export type ExerciseType = 'reps' | 'time'

export interface Exercise {
  id: string
  name: string
  description: string
  type: ExerciseType
  /** reps count OR seconds duration */
  count: number
}

export interface WorkoutProgram {
  id: string
  name: string
  subtitle: string
  tag: string
  totalMinutes: number
  xpReward: number
  exercises: Exercise[]
}

export const workouts: WorkoutProgram[] = [
  {
    id: 'aura-base',
    name: 'AURA BASE WORKOUT',
    subtitle: 'Базовые упражнения со своим весом',
    tag: 'STRENGTH',
    totalMinutes: 20,
    xpReward: 50,
    exercises: [
      {
        id: 'pushups',
        name: 'Отжимания',
        description: 'Держи корпус прямым, лопатки сведены. Грудь касается пола.',
        type: 'reps',
        count: 15,
      },
      {
        id: 'squats',
        name: 'Приседания',
        description: 'Ноги на ширине плеч, колени не выходят за носки. Спина прямая.',
        type: 'reps',
        count: 20,
      },
      {
        id: 'lunges',
        name: 'Выпады',
        description: 'Шаг вперёд, заднее колено почти касается пола. Чередуй ноги.',
        type: 'reps',
        count: 12,
      },
      {
        id: 'plank',
        name: 'Планка',
        description: 'Опора на предплечья и носки. Тело — одна прямая линия. Не провисай.',
        type: 'time',
        count: 60,
      },
      {
        id: 'pushups-2',
        name: 'Отжимания (финал)',
        description: 'Последний подход. Максимальная амплитуда, медленный темп.',
        type: 'reps',
        count: 10,
      },
    ],
  },
  {
    id: 'desk-posture-reset',
    name: 'DESK POSTURE RESET',
    subtitle: '5-минутный комплекс против компьютерной шеи',
    tag: 'MOBILITY',
    totalMinutes: 5,
    xpReward: 30,
    exercises: [
      {
        id: 'chest-stretch',
        name: 'Растяжка грудных',
        description: 'Встань в дверном проёме, руки на косяках на уровне плеч. Медленно наклоняйся вперёд.',
        type: 'time',
        count: 40,
      },
      {
        id: 'scapula-squeeze',
        name: 'Сведение лопаток',
        description: 'Сведи лопатки вместе, удерживай 3 сек, расслабь. Плечи вниз, не поднимай.',
        type: 'reps',
        count: 15,
      },
      {
        id: 'neck-tilts',
        name: 'Наклоны головы',
        description: 'Медленно наклоняй голову к плечу, тяни рукой. По 20 сек на каждую сторону.',
        type: 'time',
        count: 40,
      },
      {
        id: 'chin-tucks',
        name: 'Chin Tucks (Мьюинг)',
        description: 'Прижми язык к нёбу. Потяни подбородок прямо назад, двойной подбородок — хороший знак.',
        type: 'reps',
        count: 12,
      },
      {
        id: 'thoracic-extension',
        name: 'Разгибание грудного отдела',
        description: 'Положи руки за голову, медленно прогибайся назад через спинку стула. Дыши ровно.',
        type: 'time',
        count: 45,
      },
    ],
  },
]
