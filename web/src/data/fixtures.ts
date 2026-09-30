import type { Category, Contract, Demand, Profile, Proposal, Service, User } from '../domain/types'
import { futureDate } from '../domain/rules'
export const categories: Category[] = [
  'Elétrica',
  'Encanamento',
  'Limpeza / diarista',
  'TI e informática',
  'Pintura',
].map((name, i) => ({
  id: `10000000-0000-0000-0000-00000000000${i + 1}`,
  name,
  slug: ['eletrica', 'encanamento', 'limpeza', 'ti', 'pintura'][i],
}))
export const demoUsers: User[] = [
  {
    id: 'ana',
    name: 'Ana Lopes',
    email: 'ana@demo.freelancenow.test',
    phone: '61999990000',
    role: 'CLIENT',
    city: 'Taguatinga, DF',
    bio: 'Procuro profissionais para manutenção residencial.',
  },
  {
    id: 'marcos',
    name: 'Marcos Vieira',
    email: 'marcos@demo.freelancenow.test',
    phone: '61999990000',
    role: 'FREELANCER',
    city: 'Taguatinga, DF',
    bio: 'Eletricista predial e residencial. Doze anos em instalações e manutenção elétrica.',
  },
  {
    id: 'admin',
    name: 'Administrador',
    email: 'admin@demo.freelancenow.test',
    phone: '61999990000',
    role: 'ADMIN',
    city: 'Brasília, DF',
    bio: 'Administração da demonstração.',
  },
]
export const professionals: Profile[] = [
  demoUsers[1],
  {
    id: 'juliana',
    name: 'Juliana Prado',
    role: 'FREELANCER',
    city: 'Águas Claras, DF',
    bio: 'Limpeza residencial, pós-obra e higienização de estofados.',
  },
  {
    id: 'rafael',
    name: 'Rafael Andrade',
    role: 'FREELANCER',
    city: 'Ceilândia, DF',
    bio: 'Detecção de vazamentos sem quebra e manutenção hidráulica.',
  },
  {
    id: 'camila',
    name: 'Camila Rocha',
    role: 'FREELANCER',
    city: 'Asa Norte, DF',
    bio: 'Redes, formatação e suporte de TI para pequenos escritórios.',
  },
]
const rows: [string, number, number, number, number][] = [
  ['Instalação de chuveiro elétrico', 180, 1, 0, 0],
  ['Troca de quadro de distribuição', 640, 2, 0, 0],
  ['Limpeza pós-obra completa', 380, 2, 2, 1],
  ['Diária de limpeza residencial', 160, 1, 2, 1],
  ['Caça-vazamento sem quebra', 220, 1, 1, 2],
  ['Desentupimento de esgoto', 290, 1, 1, 2],
  ['Configuração de rede para escritório', 480, 3, 3, 3],
  ['Formatação e backup de notebook', 250, 2, 3, 3],
]
export const services: Service[] = rows.map(([title, price, deliveryDays, cat, person], i) => ({
  id: String(i + 11),
  title,
  price,
  deliveryDays,
  category: categories[cat],
  freelancer: professionals[person],
  status: 'ACTIVE',
  description: `${professionals[person].bio} Atendimento com escopo combinado antes da execução. O valor informado é uma estimativa de mão de obra.`,
}))
export const contracts: Contract[] = (
  ['PENDENTE', 'EM_ANDAMENTO', 'AGUARDANDO_CONFIRMACAO', 'CONCLUIDO', 'EM_DISPUTA'] as const
).map((status, i) => ({
  id: String(101 + i),
  serviceId: '11',
  title: services[0].title,
  freelancerId: 'marcos',
  clientId: 'ana',
  clientName: 'Ana Lopes',
  freelancerName: 'Marcos Vieira',
  price: 180,
  date: futureDate(),
  description:
    'Troca de chuveiro com aparelho já comprado. Conferir ponto elétrico e testar com o cliente.',
  address: 'Taguatinga Norte, DF',
  status,
  history: [
    { status: 'PENDENTE', at: new Date(Date.now() - 86400000).toISOString() },
    { status, at: new Date().toISOString() },
  ],
  completedAt: status === 'CONCLUIDO' ? new Date().toISOString() : undefined,
  dispute: status === 'EM_DISPUTA' ? 'O disjuntor desarma no modo inverno.' : undefined,
}))
export const demands: Demand[] = [
  {
    id: 'd1',
    clientId: 'ana',
    title: 'Quadro de distribuição vive desarmando',
    description: 'Preciso de avaliação do quadro e troca dos disjuntores se necessário.',
    categoryId: categories[0].id,
    budget: 800,
    days: 2,
    city: 'Taguatinga, DF',
    status: 'OPEN',
  },
]
export const proposals: Proposal[] = [
  {
    id: 'p1',
    demandId: 'd1',
    freelancerId: 'marcos',
    freelancerName: 'Marcos Vieira',
    price: 720,
    days: 2,
    message: 'Avalio o quadro na mesma visita. Material será orçado separadamente.',
    status: 'PENDING',
  },
]
