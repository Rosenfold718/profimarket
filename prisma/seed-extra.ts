import { PrismaClient } from '@prisma/client'
import { createHash, randomBytes } from 'crypto'

const db = new PrismaClient({
  datasourceUrl: 'file:/home/z/my-project/db/custom.db',
})

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = createHash('sha256').update(salt + password).digest('hex')
  return `${salt}:${hash}`
}

function daysAgo(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}

function daysFromNow(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}

async function main() {
  console.log('🌱 Seeding extra data for ProfiMarket...\n')

  // Ensure we have existing users
  const existingUsers = await db.user.findMany()
  console.log(`Found ${existingUsers.length} existing users`)

  // Get category IDs
  const categories = await db.category.findMany()
  const catMap = new Map(categories.map(c => [c.slug, c.id]))

  // Find existing users by email
  const clients = existingUsers.filter(u => u.role === 'CLIENT')
  const executors = existingUsers.filter(u => u.role === 'EXECUTOR')

  if (clients.length === 0 || executors.length === 0) {
    console.log('⚠ No clients or executors found, creating minimal set...')
  }

  // Create additional executor users if needed
  const execEmails = ['expert@demo.ru', 'lawyer@demo.ru', 'designer@demo.ru']
  const additionalExecutors: string[] = []

  const newExecData = [
    { email: 'smetchik_ivan@mail.ru', name: 'Иванов Иван Сергеевич', role: 'EXECUTOR' },
    { email: 'expert_nadezhda@mail.ru', name: 'Петрова Надежда Викторовна', role: 'EXECUTOR' },
    { email: 'jurist_andrey@mail.ru', name: 'Сидоров Андрей Павлович', role: 'EXECUTOR' },
    { email: 'cadastr_olga@mail.ru', name: 'Козлова Ольга Дмитриевна', role: 'EXECUTOR' },
    { email: 'geodez_maksim@mail.ru', name: 'Новиков Максим Анатольевич', role: 'EXECUTOR' },
    { email: 'project_elena@mail.ru', name: 'Морозова Елена Сергеевна', role: 'EXECUTOR' },
  ]

  for (const data of newExecData) {
    const existing = await db.user.findUnique({ where: { email: data.email } })
    if (!existing) {
      const user = await db.user.create({
        data: {
          email: data.email,
          name: data.name,
          passwordHash: hashPassword('demo123'),
          role: data.role,
        },
      })
      // Create profile
      await db.profile.create({
        data: {
          userId: user.id,
          specializations: '["сметное дело", "ФЕР", "ФССЦ"]',
          description: 'Опытный специалист с многолетним стажем работы.',
          rating: 4.5 + Math.random() * 0.5,
          completedOrders: Math.floor(Math.random() * 30) + 5,
          region: 'Москва',
          city: 'Москва',
          experienceYears: Math.floor(Math.random() * 15) + 3,
        },
      })
      additionalExecutors.push(user.id)
      console.log(`  Created executor: ${data.name} (${data.email})`)
    } else {
      additionalExecutors.push(existing.id)
    }
  }

  // Create additional client users if needed
  const newClientData = [
    { email: 'court_sverdlovsk@mail.ru', name: 'Свердловский районный суд', role: 'CLIENT' },
    { email: 'stroy_company@mail.ru', name: 'ООО «СтройИнвестПроект»', role: 'CLIENT' },
    { email: 'admin_krasnodar@mail.ru', name: 'Администрация Краснодарского края', role: 'CLIENT' },
  ]

  const additionalClients: string[] = []

  for (const data of newClientData) {
    const existing = await db.user.findUnique({ where: { email: data.email } })
    if (!existing) {
      const user = await db.user.create({
        data: {
          email: data.email,
          name: data.name,
          passwordHash: hashPassword('demo123'),
          role: data.role,
        },
      })
      await db.profile.create({
        data: {
          userId: user.id,
          specializations: '[]',
          rating: 0,
          completedOrders: 0,
          region: 'Краснодарский край',
          city: 'Краснодар',
        },
      })
      additionalClients.push(user.id)
      console.log(`  Created client: ${data.name} (${data.email})`)
    } else {
      additionalClients.push(existing.id)
    }
  }

  // Collect all executor and client IDs
  const allExecutors = [...executors.map(e => e.id), ...additionalExecutors]
  const allClients = [...clients.map(c => c.id), ...additionalClients]

  const pickClient = () => allClients[Math.floor(Math.random() * allClients.length)]
  const pickExecutor = () => allExecutors[Math.floor(Math.random() * allExecutors.length)]

  // Orders to create
  const ordersData = [
    {
      title: 'Составление локальной сметы на устройство монолитного каркаса',
      description: 'Необходимо составить локальную смету на устройство монолитного железобетонного каркаса 9-этажного жилого дома. Работы включают: арматурные работы, устройство опалубки, бетонирование. Имеется проектная документация в формате PDF. Требуется применение текущих ФЕР-2001 и индексов пересчёта.',
      categoryId: catMap.get('smetnoe-delo'),
      city: 'Москва', region: 'Москва',
      budgetFrom: 45000, budgetTo: 80000,
      deadline: daysFromNow(14),
      status: 'OPEN',
    },
    {
      title: 'Судебная строительно-техническая экспертиза многоквартирного дома',
      description: 'Назначена судебная строительно-техническая экспертиза многоквартирного жилого дома по делу о нарушении строительных норм при возведении пристроя. Необходимо установить: соответствие фактических конструкций проектной документации, наличие дефектов, причины их возникновения, стоимость устранения. Объект расположен в Московской области.',
      categoryId: catMap.get('stroitelnaia-ekspertiza'),
      city: 'Подольск', region: 'Московская область',
      budgetFrom: 150000, budgetTo: 300000,
      deadline: daysFromNow(30),
      status: 'OPEN',
    },
    {
      title: 'Проверка сметной документации на дорожные работы',
      description: 'Требуется аудит сметной документации на реконструкцию автомобильной дороги regional значения. Объём работ: 12 км дороги, устройство основания, укладка асфальтобетона, нанесение дорожной разметки, установка барьерных ограждений. Общая заявленная стоимость — 87 млн руб. Необходимо проверить обоснованность расценок и объёмов.',
      categoryId: catMap.get('smetnoe-delo'),
      city: 'Санкт-Петербург', region: 'Санкт-Петербург',
      budgetFrom: 120000, budgetTo: 200000,
      deadline: daysFromNow(21),
      status: 'OPEN',
    },
    {
      title: 'Кадастровые работы по образованию земельного участка',
      description: 'Необходимо выполнить кадастровые работы по образованию нового земельного участка из земель муниципальной собственности. Включает: подготовка межевого плана, определение координат поворотных точек, постановка на кадастровый учёт. Площадь участка — 0,15 га. Местоположение: г. Казань, Кировский район.',
      categoryId: catMap.get('kadastr'),
      city: 'Казань', region: 'Республика Татарстан',
      budgetFrom: 35000, budgetTo: 55000,
      deadline: daysFromNow(10),
      status: 'OPEN',
    },
    {
      title: 'Проектирование системы вентиляции торгового центра',
      description: 'Требуется разработка раздела проектной документации «Система вентиляции и кондиционирования» для торгового центра площадью 4500 кв.м. Необходимо выполнить расчёты воздухообмена, подобрать оборудование, разработать чертежи в формате AutoCAD. Стадия — рабочая документация.',
      categoryId: catMap.get('proektirovanie'),
      city: 'Екатеринбург', region: 'Свердловская область',
      budgetFrom: 200000, budgetTo: 350000,
      deadline: daysFromNow(45),
      status: 'OPEN',
    },
    {
      title: 'Юридическое сопровождение подрядных договоров в строительстве',
      description: 'Необходима юридическая экспертиза трёх подрядных договоров на выполнение строительно-монтажных работ. Требуется: анализ условий об ответственности сторон, проверка соответствия требованиям Градостроительного кодекса и 44-ФЗ, подготовка заключения. Общая сумма договоров — 320 млн руб.',
      categoryId: catMap.get('uridicheskie-uslugi'),
      city: 'Москва', region: 'Москва',
      budgetFrom: 80000, budgetTo: 150000,
      deadline: daysFromNow(7),
      status: 'OPEN',
    },
    {
      title: 'Оценка рыночной стоимости коммерческой недвижимости',
      description: 'Требуется независимая оценка рыночной стоимости нежилого помещения (складского комплекса) для целей залогового обеспечения. Площадь объекта — 2400 кв.м., расположение: г. Краснодар. Необходимо предоставить отчёт об оценке, соответствующий стандартам ФСО.',
      categoryId: catMap.get('otsenka-nedvizhimosti'),
      city: 'Краснодар', region: 'Краснодарский край',
      budgetFrom: 60000, budgetTo: 100000,
      deadline: daysFromNow(12),
      status: 'OPEN',
    },
    {
      title: 'Геодезическая съёмка земельного участка под строительство',
      description: 'Необходимо выполнить топографическую съёмку земельного участка площадью 2,5 га для разработки проектной документации. Масштаб съёмки — 1:500. Участок расположен в Ленинском районе Московской области. Срок выполнения — не более 5 рабочих дней.',
      categoryId: catMap.get('geodezia'),
      city: 'Видное', region: 'Московская область',
      budgetFrom: 40000, budgetTo: 65000,
      deadline: daysFromNow(5),
      status: 'OPEN',
    },
    {
      title: 'Технический надзор за строительством детского сада',
      description: 'Требуется технический надзор за строительством детского сада на 220 мест. Строительство ведётся с отступлениями от проектной документации. Необходимо контролировать качество работ, соответствие материалов проекту, ведение исполнительной документации. Объект находится в стадии — возведение 2 этажа.',
      categoryId: catMap.get('tekhnicheskii-nadzor'),
      city: 'Нижний Новгород', region: 'Нижегородская область',
      budgetFrom: 250000, budgetTo: 400000,
      deadline: daysFromNow(90),
      status: 'OPEN',
    },
    {
      title: 'Ревизия смет на реконструкцию школы',
      description: 'Провести ревизию актов выполненных работ и проверить соответствие объёмов фактически выполненных работ объёмам, указанным в рабочей документации. Объект — школа на 550 мест, реконструкция включает: замену системы отопления, утепление фасада, ремонт кровли.',
      categoryId: catMap.get('smetnoe-delo'),
      city: 'Самара', region: 'Самарская область',
      budgetFrom: 55000, budgetTo: 90000,
      deadline: daysFromNow(18),
      status: 'IN_PROGRESS',
    },
    {
      title: 'Экспертиза качества отделочных работ офисного здания',
      description: 'Заказчик выявил дефекты отделочных работ в новом офисном здании класса «А». Необходимо провести экспертизу качества: облицовка фасада, устройство полов, оклейка стен, устройство подвесных потолков. Определить стоимость устранения дефектов и подготовить экспертное заключение.',
      categoryId: catMap.get('stroitelnaia-ekspertiza'),
      city: 'Москва', region: 'Москва',
      budgetFrom: 100000, budgetTo: 180000,
      deadline: daysFromNow(20),
      status: 'IN_PROGRESS',
    },
    {
      title: 'Разработка проектной документации на сетевой газопровод',
      description: 'Требуется разработка проектной документации на строительство сетевого газопровода-отвода к жилому посёлку. Протяжённость — 3,2 км, давление — среднее. Включает: технические условия, инженерные изыскания, проектную и рабочую документацию. Паспорт объекта — Челябинская область.',
      categoryId: catMap.get('proektirovanie'),
      city: 'Миасс', region: 'Челябинская область',
      budgetFrom: 300000, budgetTo: 500000,
      deadline: daysFromNow(60),
      status: 'IN_PROGRESS',
    },
    {
      title: 'Кадастровый учёт линейного объекта (кабельной линии)',
      description: 'Необходимо поставить на кадастровый учёт кабельную линию электропередачи 10 кВ протяжённостью 4,8 км. Работы включают: подготовку межевого плана линейного объекта, определение координат опор, согласование границ с землепользователями. Местоположение: Татарстан.',
      categoryId: catMap.get('kadastr'),
      city: 'Бугульма', region: 'Республика Татарстан',
      budgetFrom: 45000, budgetTo: 70000,
      deadline: daysFromNow(3),
      status: 'COMPLETED',
    },
    {
      title: 'Смета на капитальный ремонт подъездов МКД',
      description: 'Составить смету на комплексный капитальный ремонт подъездов 5-этажного жилого дома (3 подъезда). Работы: замена входных дверей, устройство)new полимерных покрытий, покраска стен, замена освещения, устройство домофонной системы. Площадь подъездов — 450 кв.м.',
      categoryId: catMap.get('smetnoe-delo'),
      city: 'Уфа', region: 'Республика Башкортостан',
      budgetFrom: 25000, budgetTo: 40000,
      deadline: daysFromNow(-5),
      status: 'COMPLETED',
    },
  ]

  console.log(`\n📦 Creating ${ordersData.length} orders...`)

  const createdOrders: string[] = []

  for (const orderData of ordersData) {
    const clientId = pickClient()
    const order = await db.order.create({
      data: {
        ...orderData,
        clientId,
      },
    })
    createdOrders.push(order.id)
    console.log(`  Created: ${order.title.substring(0, 60)}...`)
  }

  // Create responses for OPEN and IN_PROGRESS orders
  console.log('\n📝 Creating responses...')

  const responseTexts = [
    'Готов выполнить данную работу. Имею опыт аналогичных проектов более 10 лет. Предлагаю рассмотреть мой отклик — гарантирую качество и соблюдение сроков.',
    'Специализируюсь именно на данном виде работ. Выполню заказ в установленный срок с предоставлением всех необходимых документов.',
    'Имею все необходимые допуски СРО для выполнения данного вида работ. Готов приступить незамедлительно.',
    'Выполнял аналогичные заказы для судебных органов Московской области. Предлагаю бюджет с учётом всех необходимых работ.',
    'Готов взять заказ. Подготовлю предварительные расчёты в течение 2 дней после подтверждения.',
    'Более 15 лет опыта в данной сфере. Предлагаю выполнить работы качественно и в срок.',
  ]

  for (const orderId of createdOrders) {
    const order = await db.order.findUnique({ where: { id: orderId } })
    if (!order) continue

    // Add 1-4 responses for OPEN orders
    const numResponses = order.status === 'OPEN' ? Math.floor(Math.random() * 3) + 1 : 
                         order.status === 'IN_PROGRESS' ? 2 : 0

    for (let i = 0; i < numResponses; i++) {
      const executorId = pickExecutor()
      // Avoid same executor responding twice to same order
      const existing = await db.response.findFirst({
        where: { orderId, executorId },
      })
      if (existing) continue

      await db.response.create({
        data: {
          orderId,
          executorId,
          message: responseTexts[Math.floor(Math.random() * responseTexts.length)],
          proposedBudget: order.budgetFrom ? order.budgetFrom * (0.8 + Math.random() * 0.4) : null,
          status: order.status === 'IN_PROGRESS' && i === 0 ? 'ACCEPTED' : 'PENDING',
        },
      })

      // If accepted, set executor
      if (order.status === 'IN_PROGRESS' && i === 0) {
        await db.order.update({
          where: { id: orderId },
          data: { executorId },
        })
      }

      console.log(`  Response added to: ${order.title.substring(0, 40)}...`)
    }
  }

  // Create messages for orders with responses
  console.log('\n💬 Creating messages...')

  const messageTexts = [
    'Добрый день! Готов выполнить заказ. Подскажите, есть ли дополнительные материалы по объекту?',
    'Здравствуйте! Отправляю вам предварительные расчёты. Посмотрите, пожалуйста.',
    'Спасибо за информацию. Когда можно приступить к осмотру объекта?',
    'Нужны ли дополнительные документы для начала работ?',
    'Завтра буду на объекте с 10:00. Подойдёт?',
    'Документы готовы. Могу выслать на электронную почту.',
    'Смета составлена. Жду ваших комментариев.',
    'Получили вашу правку, внесли изменения. Отправляю обновлённый вариант.',
    'Хотел уточнить по срокам — возможно ли продлить дедлайн на 3 дня?',
    'Работы завершены. Готов предоставить отчёт.',
  ]

  const ordersWithMessages = await db.order.findMany({
    where: {
      status: { in: ['OPEN', 'IN_PROGRESS'] },
    },
    include: {
      responses: { where: { status: { in: ['ACCEPTED', 'PENDING'] } } },
    },
  })

  for (const order of ordersWithMessages) {
    if (order.responses.length === 0) continue

    const clientId = order.clientId
    const responseExecutors = order.responses.map(r => r.executorId)
    const numMessages = Math.floor(Math.random() * 5) + 2

    for (let i = 0; i < numMessages; i++) {
      const isClient = i % 2 === 0
      const senderId = isClient ? clientId : responseExecutors[Math.floor(Math.random() * responseExecutors.length)]

      if (!senderId) continue

      await db.message.create({
        data: {
          orderId: order.id,
          senderId,
          content: messageTexts[Math.floor(Math.random() * messageTexts.length)],
          createdAt: daysAgo(Math.floor(Math.random() * 7)),
        },
      })
    }
    console.log(`  ${numMessages} messages added to: ${order.title.substring(0, 40)}...`)
  }

  console.log('\n✅ Seeding completed!')
  console.log(`  Orders created: ${ordersData.length}`)
  console.log(`  New executors: ${newExecData.length}`)
  console.log(`  New clients: ${newClientData.length}`)
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
