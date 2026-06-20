'use client'

import { useState } from 'react'
import { X, ArrowRight, CheckCircle2, ChevronLeft } from 'lucide-react'
import {
  calculateMacros,
  type Gender,
  type ActivityLevel,
  type Goal,
  type MacroResult
} from '@/lib/calculations'

interface MacroCalculatorModalProps {
  onClose: () => void
  onSave: (result: MacroResult) => void
}

export function MacroCalculatorModal({ onClose, onSave }: MacroCalculatorModalProps) {
  const [step, setStep] = useState(1)
  
  // Form State
  const [gender, setGender] = useState<Gender>('male')
  const [age, setAge] = useState<number>(25)
  const [weight, setWeight] = useState<number>(75)
  const [height, setHeight] = useState<number>(180)
  const [activity, setActivity] = useState<ActivityLevel>('moderate')
  const [goal, setGoal] = useState<Goal>('maintain')

  const totalSteps = 5

  const handleNext = () => setStep(s => Math.min(totalSteps, s + 1))
  const handlePrev = () => setStep(s => Math.max(1, s - 1))

  const handleSave = () => {
    const result = calculateMacros(weight, height, age, gender, activity, goal)
    onSave(result)
  }

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4 animate-in fade-in">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">БИОМЕТРИЯ (ШАГ 1)</p>
            <div className="grid grid-cols-2 gap-3">
              {(['male', 'female'] as Gender[]).map(g => (
                <button
                  key={g}
                  onClick={() => setGender(g)}
                  className={`py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all border ${
                    gender === g
                      ? 'bg-zinc-100 text-black border-zinc-100'
                      : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  {g === 'male' ? 'МУЖЧИНА' : 'ЖЕНЩИНА'}
                </button>
              ))}
            </div>
          </div>
        )
      case 2:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">ПАРАМЕТРЫ (ШАГ 2)</p>
            
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">ВОЗРАСТ</label>
              <input
                type="number"
                value={age}
                onChange={e => setAge(Number(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-lg font-mono text-zinc-100 focus:outline-none focus:border-zinc-600 transition-colors"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">ВЕС (КГ)</label>
                <input
                  type="number"
                  value={weight}
                  onChange={e => setWeight(Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-lg font-mono text-zinc-100 focus:outline-none focus:border-zinc-600 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">РОСТ (СМ)</label>
                <input
                  type="number"
                  value={height}
                  onChange={e => setHeight(Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-lg font-mono text-zinc-100 focus:outline-none focus:border-zinc-600 transition-colors"
                />
              </div>
            </div>
          </div>
        )
      case 3:
        const activities: { id: ActivityLevel, label: string, desc: string }[] = [
          { id: 'sedentary', label: 'СИДЯЧИЙ', desc: 'Минимум активности, офис' },
          { id: 'light', label: 'ЛЕГКИЙ', desc: 'Тренировки 1-3 раза в неделю' },
          { id: 'moderate', label: 'УМЕРЕННЫЙ', desc: 'Тренировки 3-5 раз в неделю' },
          { id: 'active', label: 'АКТИВНЫЙ', desc: 'Тренировки 6-7 раз в неделю' },
          { id: 'athlete', label: 'АТЛЕТ', desc: '2 тренировки в день / физ. труд' },
        ]
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">АКТИВНОСТЬ (ШАГ 3)</p>
            <div className="space-y-2">
              {activities.map(a => (
                <button
                  key={a.id}
                  onClick={() => setActivity(a.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    activity === a.id
                      ? 'bg-zinc-800 border-zinc-600'
                      : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-bold tracking-widest ${activity === a.id ? 'text-zinc-100' : 'text-zinc-400'}`}>
                      {a.label}
                    </p>
                    {activity === a.id && <CheckCircle2 size={16} className="text-zinc-100" />}
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1">{a.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )
      case 4:
        const goals: { id: Goal, label: string }[] = [
          { id: 'lose', label: 'СБРОСИТЬ ВЕС (-20%)' },
          { id: 'maintain', label: 'ПОДДЕРЖАНИЕ (0%)' },
          { id: 'gain', label: 'НАБРАТЬ МАССУ (+15%)' },
          { id: 'skin', label: 'УЛУЧШИТЬ КОЖУ (БАЗА)' },
        ]
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">ЦЕЛЬ (ШАГ 4)</p>
            <div className="space-y-2">
              {goals.map(g => (
                <button
                  key={g.id}
                  onClick={() => setGoal(g.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    goal === g.id
                      ? 'bg-zinc-800 border-zinc-600'
                      : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-bold tracking-widest ${goal === g.id ? 'text-zinc-100' : 'text-zinc-400'}`}>
                      {g.label}
                    </p>
                    {goal === g.id && <CheckCircle2 size={16} className="text-zinc-100" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )
      case 5:
        const result = calculateMacros(weight, height, age, gender, activity, goal)
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">ВАШ ПЛАН ПИТАНИЯ</p>
            
            <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">НОРМА КАЛОРИЙ</p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black font-mono text-zinc-100">{result.targetCalories}</span>
                <span className="text-sm font-bold text-zinc-600 uppercase tracking-widest">ККАЛ</span>
              </div>
              <p className="text-[10px] text-zinc-500 mt-2 font-mono">BMR: {result.bmr} / TDEE: {result.tdee}</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 text-center">
                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2">БЕЛКИ</p>
                <p className="text-xl font-bold font-mono text-zinc-100">{result.macros.protein}г</p>
              </div>
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 text-center">
                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2">УГЛЕВ</p>
                <p className="text-xl font-bold font-mono text-zinc-100">{result.macros.carbs}г</p>
              </div>
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 text-center">
                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2">ЖИРЫ</p>
                <p className="text-xl font-bold font-mono text-zinc-100">{result.macros.fat}г</p>
              </div>
            </div>
            
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest leading-relaxed">
              *Расчет по формуле Миффлина-Сан Жеора. Белки: 2г/кг, Жиры: 1г/кг, остаток на углеводы.
            </p>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-in fade-in p-4 pb-safe">
      <div className="w-full max-w-lg mx-auto bg-zinc-900 rounded-[2rem] border border-zinc-800 overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between px-6 py-5 border-b border-zinc-800/50">
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button onClick={handlePrev} className="text-zinc-400 hover:text-zinc-100 transition-colors">
                <ChevronLeft size={20} />
              </button>
            )}
            <p className="text-sm font-bold text-zinc-100 uppercase tracking-widest">КАЛЬКУЛЯТОР</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-zinc-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1 bg-zinc-950">
          <div
            className="h-full bg-zinc-100 transition-all duration-300 ease-out"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {renderStepContent()}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 p-6 border-t border-zinc-800/50 bg-zinc-900">
          {step < totalSteps ? (
            <button
              onClick={handleNext}
              className="w-full py-4 rounded-xl bg-zinc-100 text-black font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white active:scale-95 transition-all"
            >
              СЛЕДУЮЩИЙ ШАГ <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSave}
              className="w-full py-4 rounded-xl bg-emerald-500 text-black font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-400 active:scale-95 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]"
            >
              <CheckCircle2 size={16} /> ПРИМЕНИТЬ ПЛАН
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
