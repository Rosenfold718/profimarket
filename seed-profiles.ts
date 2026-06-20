import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

// ── Executor profile data (full profiles) ──────────────────────────────────

const executorProfiles: Record<
  string,
  {
    company: string
    position: string
    experienceYears: number
    specializations: string
    description: string
    region: string
    city: string
    education: string
    certificates: string
    rating: number
    completedOrders: number
    website: string | null
  }
> = {
  // 1. Иванов Сергей Петрович — expert@demo.ru (сметчик + строительная экспертиза)
  'cmqkkpbs4000aq4zar7z0r36g': {
    company: 'ООО «ЭкспертСтрой»',
    position: 'Главный эксперт-сметчик',
    experienceYears: 15,
    specializations: JSON.stringify([
      'Сметное дело',
      'Строительная экспертиза',
      'Оценка недвижимости',
    ]),
    description:
      'Ведущий эксперт с 15-летним опытом в сфере строительной экспертизы и сметного дела. Выполняю судебные и досудебные строительно-технические экспертизы для арбитражных судов Москвы и Московской области. Автор более 300 заключений.',
    region: 'Москва',
    city: 'Москва',
    education: JSON.stringify([
      'МГСУ, факультет «Экономика и управление в строительстве», 2009',
    ]),
    certificates: JSON.stringify([
      'Член СРО «Строительные эксперты» № СЭ-2019-0847',
      'Аттестат судебного строительного эксперта, 2015',
    ]),
    rating: 4.9,
    completedOrders: 87,
    website: 'https://expertstroy.ru',
  },

  // 2. Петрова Анна Викторовна — lawyer@demo.ru (юрист)
  'cmqkkpbs7000dq4za1aj9p4ah': {
    company: 'Адвокатский кабинет «ПравоГрад»',
    position: 'Адвокат, руководитель практики',
    experienceYears: 12,
    specializations: JSON.stringify([
      'Юридические услуги',
      'Оценка недвижимости',
      'Кадастр',
    ]),
    description:
      'Специализируюсь на земельных спорах, строительном праве и представлении интересов в арбитражных судах. За 12 лет практики вела более 500 дел, связанных со строительными контрактами и экспертизой. Работаю с регионами ЦФО и СЗФО.',
    region: 'Санкт-Петербург',
    city: 'Санкт-Петербург',
    education: JSON.stringify([
      'СПбГУ, юридический факультет, 2012',
      'МГУ им. М.В. Ломоносова, магистратура «Гражданское право», 2014',
    ]),
    certificates: JSON.stringify([
      'Член Адвокатской палаты г. Санкт-Петербурга, реестр № 78/5721',
      'Сертификат ФИДЖИП (международный коммерческий арбитраж), 2018',
    ]),
    rating: 4.8,
    completedOrders: 156,
    website: null,
  },

  // 3. Козлов Дмитрий Александрович — designer@demo.ru (проектировщик)
  'cmqkkpbs9000gq4za5y5jr7p3': {
    company: 'ИП Козлов Д.А.',
    position: 'Архитектор-проектировщик',
    experienceYears: 8,
    specializations: JSON.stringify([
      'Проектирование',
      'Технический надзор',
      'Строительная экспертиза',
    ]),
    description:
      'Разработка проектной и рабочей документации для жилых и общественных зданий. Автор более 50 реализованных проектов в Москве и Подмосковье. Осуществляю авторский надзор и техническое сопровождение строительства.',
    region: 'Москва',
    city: 'Москва',
    education: JSON.stringify([
      'МАРХИ, кафедра архитектуры, 2016',
    ]),
    certificates: JSON.stringify([
      'СРО проектировщиков «Объединение проектировщиков» № П-2018-312',
      'Свидетельство о допуске к технадзору, 2020',
    ]),
    rating: 4.7,
    completedOrders: 63,
    website: 'https://kozlov-arch.ru',
  },

  // 4. Тест Пользователь — test@demo.ru (оценка недвижимости + кадастр)
  'cmqkx9mf70006mtuo41bxr5io': {
    company: 'ООО «ОценкаПлюс»',
    position: 'Оценщик-аналитик',
    experienceYears: 5,
    specializations: JSON.stringify([
      'Оценка недвижимости',
      'Кадастр',
      'Сметное дело',
    ]),
    description:
      'Оценка коммерческой и жилой недвижимости, земельных участков и объектов незавершённого строительства. Работаю с банками, судами и частными клиентами. Опыт работы с кадастровым учётом и межеванием.',
    region: 'Нижегородская область',
    city: 'Нижний Новгород',
    education: JSON.stringify([
      'ННГАСУ, факультет экономики и управления, 2019',
    ]),
    certificates: JSON.stringify([
      'Член СРО «Общество оценщиков» № ОО-2021-1156',
    ]),
    rating: 4.2,
    completedOrders: 34,
    website: null,
  },

  // 5. Иванов Иван Сергеевич — smetchik_ivan@mail.ru (сметчик)
  'cmqky8f5p0000mtkzkb9y6hgh': {
    company: 'ИП Иванов И.С.',
    position: 'Инженер-сметчик',
    experienceYears: 7,
    specializations: JSON.stringify([
      'Сметное дело',
      'Строительная экспертиза',
    ]),
    description:
      'Составление смет в базах ФЕР-2001, ФССЦ, ТЕР для объектов жилищного и промышленного строительства. Проверка и аудит сметной документации. Опыт работы в генподрядных организациях и экспертных бюро.',
    region: 'Республика Татарстан',
    city: 'Казань',
    education: JSON.stringify([
      'КГАСУ, факультет «Промышленное и гражданское строительство», 2017',
    ]),
    certificates: JSON.stringify([
      'Член НП «Объединение сметчиков» № НС-2020-442',
    ]),
    rating: 4.6,
    completedOrders: 48,
    website: null,
  },

  // 6. Петрова Надежда Викторовна — expert_nadezhda@mail.ru (строительная экспертиза + оценка)
  'cmqky8f5s0003mtkzte558o6v': {
    company: 'ООО «СтройЭкспертГрупп»',
    position: 'Руководитель экспертного отдела',
    experienceYears: 10,
    specializations: JSON.stringify([
      'Строительная экспертиза',
      'Оценка недвижимости',
      'Технический надзор',
    ]),
    description:
      'Проведение строительно-технических экспертиз для судебных и внесудебных споров. Специализация — определение стоимости восстановительного ремонта, оценка причинённого ущерба. Работаю по всей России.',
    region: 'Свердловская область',
    city: 'Екатеринбург',
    education: JSON.stringify([
      'УГТУ-УПИ, строительный факультет, 2014',
      'УрГЮУ, правоведение, 2018 (второе высшее)',
    ]),
    certificates: JSON.stringify([
      'Член СРО «Строительные эксперты» № СЭ-2018-1562',
      'Сертификат оценщика ФСО № 034789',
    ]),
    rating: 4.5,
    completedOrders: 72,
    website: 'https://stroyexpertgroup.ru',
  },

  // 7. Сидоров Андрей Павлович — jurist_andrey@mail.ru (юрист)
  'cmqky8f5v0006mtkzus1m3ff0': {
    company: 'Юридическая фирма «Закон и Право»',
    position: 'Юрист, управляющий партнёр',
    experienceYears: 12,
    specializations: JSON.stringify([
      'Юридические услуги',
      'Кадастр',
    ]),
    description:
      'Защита интересов застройщиков и инвесторов в арбитражных судах. Специализация — земельные споры, признание права собственности, оспаривание кадастровой стоимости. Представляю интересы в судах Уральского федерального округа.',
    region: 'Свердловская область',
    city: 'Екатеринбург',
    education: JSON.stringify([
      'УрГЮУ, институт прокуратуры, 2012',
    ]),
    certificates: JSON.stringify([
      'Член Адвокатской палаты Свердловской области, реестр № 66/8934',
    ]),
    rating: 4.6,
    completedOrders: 95,
    website: null,
  },

  // 8. Козлова Ольга Дмитриевна — cadastr_olga@mail.ru (кадастр)
  'cmqky8f5w0009mtkzc4doakwe': {
    company: 'ИП Козлова О.Д.',
    position: 'Кадастровый инженер',
    experienceYears: 15,
    specializations: JSON.stringify([
      'Кадастр',
      'Геодезия',
      'Оценка недвижимости',
    ]),
    description:
      'Кадастровые работы: межевание, технические планы, акт обследования. Оспаривание кадастровой стоимости в суде и комиссии. Опыт работы 15 лет, более 2000 выполненных кадастровых процедур.',
    region: 'Краснодарский край',
    city: 'Краснодар',
    education: JSON.stringify([
      'КубГТУ, факультет «Землеустройство и кадастры», 2009',
    ]),
    certificates: JSON.stringify([
      'Квалификационный аттестат кадастрового инженера № 06724',
      'Член СРО «Кадастровые инженеры» № КИ-2017-2103',
    ]),
    rating: 4.5,
    completedOrders: 120,
    website: null,
  },

  // 9. Новиков Максим Анатольевич — geodez_maksim@mail.ru (геодезия + технадзор)
  'cmqky8f60000cmtkzp9o7duda': {
    company: 'ООО «ГеоСтройИзмерения»',
    position: 'Главный геодезист',
    experienceYears: 8,
    specializations: JSON.stringify([
      'Геодезия',
      'Технический надзор',
      'Кадастр',
    ]),
    description:
      'Топографо-геодезические изыскания, геодезический контроль строительства, исполнительная съёмка. Работаю с GNSS-оборудованием и тахеометрами Leica. Опыт на объектах промышленного и гражданского строительства.',
    region: 'Новосибирская область',
    city: 'Новосибирск',
    education: JSON.stringify([
      'СГГА (ныне СГУГиТ), факультет геодезии, 2016',
    ]),
    certificates: JSON.stringify([
      'Свидетельство о допуске к геодезическим работам, 2019',
    ]),
    rating: 4.7,
    completedOrders: 56,
    website: null,
  },

  // 10. Морозова Елена Сергеевна — project_elena@mail.ru (проектирование)
  'cmqky8f62000fmtkzyscf5kh4': {
    company: 'ООО «АрхПроектСтудия»',
    position: 'Главный инженер проекта',
    experienceYears: 9,
    specializations: JSON.stringify([
      'Проектирование',
      'Строительная экспертиза',
      'Сметное дело',
    ]),
    description:
      'Проектирование зданий и сооружений I–II уровней ответственности. Подготовка разделов ПОС, ППР, сметной документации. Сертифицированный BIM-специалист (Revit, Renga). Реализовано более 40 проектов.',
    region: 'Ростовская область',
    city: 'Ростов-на-Дону',
    education: JSON.stringify([
      'РГСУ, факультет «Промышленное и гражданское строительство», 2015',
    ]),
    certificates: JSON.stringify([
      'СРО проектировщиков «ПроектЮг» № П-2019-788',
      'Сертификат BIM-менеджера, 2021',
    ]),
    rating: 4.8,
    completedOrders: 41,
    website: 'https://archprojectstudio.ru',
  },
}

// ── Client profile data (simpler profiles) ─────────────────────────────────

const clientProfiles: Record<
  string,
  {
    company: string | null
    description: string
    region: string
    city: string
  }
> = {
  // 11. Арбитражный суд г. Москвы — court@demo.ru
  'cmqkkpbs00008q4zafx99dg04': {
    company: 'Арбитражный суд города Москвы',
    description:
      'Арбитражный суд города Москвы рассматривает экономические споры, связанные со строительством, подрядными контрактами и определением стоимости работ. Регулярно привлекает независимых экспертов и оценщиков.',
    region: 'Москва',
    city: 'Москва',
  },

  // 12. Департамент строительства — budget@demo.ru
  'cmqkkpbs20009q4zaie0qa188': {
    company: 'Департамент строительства города Москвы',
    description:
      'Государственный орган исполнительной власти, осуществляющий полномочия в сфере градостроительной политики, строительства и реконструкции в Москве. Заказчик строительных экспертиз и сметных расчётов.',
    region: 'Москва',
    city: 'Москва',
  },

  // 13. Свердловский районный суд — court_sverdlovsk@mail.ru
  'cmqky8f64000imtkzgay7e3i9': {
    company: 'Свердловский районный суд',
    description:
      'Районный суд, рассматривающий гражданские дела, связанные со строительными спорами, определением ущерба недвижимости и земельными вопросами. Находится в городе Екатеринбург.',
    region: 'Свердловская область',
    city: 'Екатеринбург',
  },

  // 14. ООО «СтройИнвестПроект» — stroy_company@mail.ru
  'cmqky8f66000lmtkzu1jw9b91': {
    company: 'ООО «СтройИнвестПроект»',
    description:
      'Генподрядная строительная компания, специализирующаяся на возведении жилых комплексов и коммерческих объектов в Краснодарском крае. Привлекает экспертов для проведения строительно-технических экспертиз и аудита смет.',
    region: 'Краснодарский край',
    city: 'Краснодар',
  },

  // 15. Администрация Краснодарского края — admin_krasnodar@mail.ru
  'cmqky8f68000omtkzh50porbg': {
    company: 'Администрация Краснодарского края',
    description:
      'Орган исполнительной власти Краснодарского края. Заказчик проектных работ, кадастровых измерений и строительных экспертиз для объектов региональной инфраструктуры.',
    region: 'Краснодарский край',
    city: 'Краснодар',
  },
}

async function main() {
  console.log('🌱 Seeding profiles for all users...\n')

  // ── Update executor profiles ──
  for (const [userId, data] of Object.entries(executorProfiles)) {
    const result = await db.profile.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    })
    console.log(`  ✅ Executor profile updated: ${result.userId}`)
  }

  // ── Update/create client profiles ──
  for (const [userId, data] of Object.entries(clientProfiles)) {
    const result = await db.profile.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        company: data.company,
        position: null,
        experienceYears: null,
        specializations: '[]',
        description: data.description,
        region: data.region,
        city: data.city,
        education: null,
        certificates: null,
        rating: 0,
        completedOrders: 0,
        website: null,
      },
    })
    console.log(`  ✅ Client profile updated: ${result.userId}`)
  }

  console.log('\n✨ Done! All profiles seeded.')
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())