'use client'

import { useState } from 'react'
import { WorkoutProgram } from '@/lib/workouts-db'
import { WorkoutDashboard } from '@/components/body/WorkoutDashboard'
import { WorkoutPlayer } from '@/components/body/WorkoutPlayer'

export default function BodyPage() {
  const [activeWorkout, setActiveWorkout] = useState<WorkoutProgram | null>(null)

  if (activeWorkout) {
    return (
      <WorkoutPlayer
        workout={activeWorkout}
        onExit={() => setActiveWorkout(null)}
      />
    )
  }

  return <WorkoutDashboard onSelect={setActiveWorkout} />
}
