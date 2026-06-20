'use client'
import { useSyncExternalStore } from 'react'
import { useAppStore } from '@/stores/use-app-store'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Building2, Briefcase, ShieldCheck, MessageSquare, Users,
  Scale, PenTool, MapPin, Calculator, Search, Home, Compass,
  ArrowRight, Star, Clock, CheckCircle2, ChevronRight
} from 'lucide-react'

const stats = [
  { label: 'Специалистов', value: '2 400+', icon: <Users className="w-5 h-5" /> },
  { label: 'Выполненных заказов', value: '8 500+', icon: <CheckCircle2 className="w-5 h-5" /> },
  { label: 'Средний рейтинг', value: '4.9', icon: <Star className="w-5 h-5" /> },
  { label: 'Регионов', value: '78', icon: <MapPin className="w-5 h-5" /> },
]

const categories = [
  { name: 'Сметное дело', icon: <Calculator className="w-6 h-6" />, desc: 'Составление и проверка смет' },
  { name: 'Строительная экспертиза', icon: <Search className="w-6 h-6" />, desc: 'Экспертиза объектов' },
  { name: 'Проектирование', icon: <PenTool className="w-6 h-6" />, desc: 'Архитектурные решения' },
  { name: 'Кадастр', icon: <MapPin className="w-6 h-6" />, desc: 'Кадастровые работы' },
  { name: 'Юридические услуги', icon: <Scale className="w-6 h-6" />, desc: 'Правовая поддержка' },
  { name: 'Оценка недвижимости', icon: <Home className="w-6 h-6" />, desc: 'Оценка стоимости' },
  { name: 'Технический надзор', icon: <ShieldCheck className="w-6 h-6" />, desc: 'Контроль качества' },
  { name: 'Геодезия', icon: <Compass className="w-6 h-6" />, desc: 'Измерения и изыскания' },
]

const steps = [
  { num: '01', title: 'Опубликуйте заказ', desc: 'Опишите задачу, укажите бюджет и сроки. Сотни специалистов увидят вашу заявку.' },
  { num: '02', title: 'Получите отклики', desc: 'Проверенные исполнители предложат свои услуги с описанием опыта и цены.' },
  { num: '03', title: 'Выберите исполнителя', desc: 'Сравните предложения, общайтесь в чате и выберите лучшего кандидата.' },
]

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-40px' },
  transition: { duration: 0.4 },
}

export function LandingView() {
  const { setView, user, setAuthMode } = useAppStore()
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto flex items-center h-14 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="w-4.5 h-4.5 text-primary-foreground" />
            </div>
            <span className="text-base font-semibold tracking-tight font-[family-name:var(--font-display)]">ProfiMarket</span>
          </div>
          <div className="flex-1" />
          {user ? (
            <Button size="sm" onClick={() => setView('dashboard')} variant="outline">
              <span className="hidden sm:inline">Перейти в кабинет</span>
              <ArrowRight className="w-4 h-4 sm:hidden" />
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setView('auth')}>
                Войти
              </Button>
              <Button size="sm" onClick={() => { setAuthMode('register'); setView('auth') }}>
                Регистрация
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="py-16 sm:py-24 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-2xl"
            >
              <Badge variant="secondary" className="mb-5 font-normal">
                Платформа для профессионалов
              </Badge>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.15] tracking-tight font-[family-name:var(--font-display)]">
                Маркетплейс экспертов<br className="hidden sm:block" />
                для строительной отрасли
              </h1>
              <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed">
                Единая платформа для поиска проверенных сметчиков, экспертов, юристов,
                проектировщиков и кадастровых инженеров. Для судов, организаций и бизнеса.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" onClick={() => setView('auth')} className="h-11 px-6">
                  Начать работу
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => user ? setView('orders') : setView('auth')} className="h-11 px-6">
                  Смотреть заказы
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-16 sm:py-20 px-4 sm:px-6 border-t border-border">
          <div className="max-w-6xl mx-auto">
            <motion.div {...fadeIn} className="mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold font-[family-name:var(--font-display)]">Как это работает</h2>
              <p className="mt-2 text-muted-foreground max-w-lg">
                Три простых шага от публикации заказа до получения результата
              </p>
            </motion.div>
            <div className="grid md:grid-cols-3 gap-6">
              {steps.map((s, i) => (
                <motion.div key={i} {...fadeIn} transition={{ duration: 0.4, delay: i * 0.1 }}>
                  <Card className="border bg-card">
                    <CardContent className="p-6">
                      <span className="text-xs font-bold text-accent tracking-widest">{s.num}</span>
                      <h3 className="mt-3 text-lg font-semibold font-[family-name:var(--font-display)]">{s.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Categories */}
        <section className="py-16 sm:py-20 px-4 sm:px-6 border-t border-border">
          <div className="max-w-6xl mx-auto">
            <motion.div {...fadeIn} className="mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold font-[family-name:var(--font-display)]">Направления</h2>
              <p className="mt-2 text-muted-foreground">Находите специалистов в нужной области</p>
            </motion.div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {categories.map((c, i) => (
                <motion.div key={i} {...fadeIn} transition={{ duration: 0.3, delay: i * 0.03 }}>
                  <Card className="card-hover cursor-pointer border bg-card">
                    <CardContent className="p-4 sm:p-5 text-center">
                      <div className="inline-flex items-center justify-center w-11 h-11 rounded-lg bg-muted text-muted-foreground mb-3">
                        {c.icon}
                      </div>
                      <p className="font-medium text-sm">{c.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{c.desc}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="py-16 sm:py-20 px-4 sm:px-6 border-t border-border bg-muted/30">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
              {stats.map((s, i) => (
                <motion.div key={i} {...fadeIn} transition={{ duration: 0.4, delay: i * 0.05 }}>
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-muted text-muted-foreground mb-3">
                      {s.icon}
                    </div>
                    <p className="text-2xl sm:text-3xl font-bold font-[family-name:var(--font-display)]">{s.value}</p>
                    <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 sm:py-20 px-4 sm:px-6 border-t border-border">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div {...fadeIn}>
              <h2 className="text-2xl sm:text-3xl font-bold font-[family-name:var(--font-display)]">
                Присоединяйтесь к ProfiMarket
              </h2>
              <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
                Тысячи профессионалов и заказчиков уже работают на платформе.
                Регистрация бесплатна.
              </p>
              <div className="mt-8">
                <Button size="lg" onClick={() => { setAuthMode('register'); setView('auth') }} className="h-11 px-8">
                  Создать аккаунт
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4 sm:px-6 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold">ProfiMarket</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <span>О платформе</span>
            <span>Условия использования</span>
            <span>Контакты</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © 2025 ProfiMarket. Все права защищены.
          </p>
        </div>
      </footer>
    </div>
  )
}
