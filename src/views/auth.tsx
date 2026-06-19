'use client'
import { useState } from 'react'
import { useAppStore } from '@/stores/use-app-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, ArrowLeft, User, Building, Eye, EyeOff, Loader2 } from 'lucide-react'

export function AuthView() {
  const { setView, setUser, addToast } = useAppStore()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [role, setRole] = useState<'CLIENT' | 'EXECUTOR'>('EXECUTOR')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', name: '' })
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    setLoading(true)
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const body = mode === 'login'
        ? { email: form.email, password: form.password }
        : { ...form, role }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Ошибка'); setLoading(false); return }

      setUser(data.user, data.token || null)
      addToast(mode === 'login' ? 'Добро пожаловать!' : 'Аккаунт создан!', 'success')
      setView('dashboard')
    } catch {
      setError('Сетевая ошибка')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto flex items-center h-14 px-4 sm:px-6">
          <button onClick={() => setView('landing')} className="flex items-center gap-2.5 hover:opacity-70 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="w-4.5 h-4.5 text-primary-foreground" />
            </div>
            <span className="text-base font-semibold tracking-tight font-[family-name:var(--font-display)]">ProfiMarket</span>
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setView('landing')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            На главную
          </button>
        </div>
      </header>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-lg"
        >
          <Card className="border bg-card">
            <CardHeader className="pb-5">
              <CardTitle className="text-xl font-[family-name:var(--font-display)]">
                {mode === 'login' ? 'Вход в аккаунт' : 'Регистрация'}
              </CardTitle>
              <CardDescription className="text-sm">
                {mode === 'login'
                  ? 'Введите email и пароль для входа'
                  : 'Создайте аккаунт, чтобы начать работу на платформе'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Role selector (register only) */}
              <AnimatePresence>
                {mode === 'register' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Label className="text-sm font-medium">Тип аккаунта</Label>
                    <div className="grid grid-cols-2 gap-3 mt-1.5">
                      <button
                        onClick={() => setRole('EXECUTOR')}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                          role === 'EXECUTOR'
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-muted-foreground/30'
                        }`}
                      >
                        <User className={`w-4 h-4 ${role === 'EXECUTOR' ? 'text-accent' : 'text-muted-foreground'}`} />
                        <div className="text-left">
                          <p className="text-sm font-medium">Исполнитель</p>
                          <p className="text-xs text-muted-foreground">Эксперт, сметчик, юрист</p>
                        </div>
                      </button>
                      <button
                        onClick={() => setRole('CLIENT')}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                          role === 'CLIENT'
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-muted-foreground/30'
                        }`}
                      >
                        <Building className={`w-4 h-4 ${role === 'CLIENT' ? 'text-accent' : 'text-muted-foreground'}`} />
                        <div className="text-left">
                          <p className="text-sm font-medium">Заказчик</p>
                          <p className="text-xs text-muted-foreground">Суд, организация</p>
                        </div>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {mode === 'register' && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">ФИО или название</Label>
                  <Input
                    id="name"
                    placeholder="Иванов Сергей Петрович"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@mail.ru"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Пароль</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Минимум 6 символов"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && submit()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                  {error}
                </motion.p>
              )}

              <Button
                onClick={submit}
                disabled={loading || !form.email || !form.password || (mode === 'register' && !form.name)}
                className="w-full h-11"
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
              </Button>

              <div className="text-center">
                <button
                  onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {mode === 'login' ? (
                    <>Нет аккаунта? <span className="font-medium text-foreground">Зарегистрироваться</span></>
                  ) : (
                    <>Уже есть аккаунт? <span className="font-medium text-foreground">Войти</span></>
                  )}
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
