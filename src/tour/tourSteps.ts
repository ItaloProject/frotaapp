export type TourArea =
  | 'Início'
  | 'Dashboard'
  | 'Gerenciar'
  | 'Evolução'
  | 'Histórico'
  | 'Checklists'
  | 'Resultados'
  | 'Registro'
  | 'Usuários'
  | 'Encerramento'

export type TourStep = {
  path: string
  area: TourArea
  selector?: string
  title: string
  content: string
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center'
  waitMs?: number
}

export const TOUR_STEPS: TourStep[] = [
  // ─── Boas-vindas ────────────────────────────────────────────────────────
  {
    path: '/',
    area: 'Início',
    title: '👋 Bem-vindo ao FrotaApp!',
    content:
      'Este é o sistema de gestão completa da frota da FrotaApp. Vou te apresentar todas as funcionalidades em poucos minutos. Use ▶ Próximo / ◀ Voltar para navegar, ou Pular para sair.',
    waitMs: 600,
  },

  // ─── Sidebar ────────────────────────────────────────────────────────────
  {
    path: '/',
    area: 'Dashboard',
    selector: '[data-tour="sidebar"]',
    title: '📍 Menu de Navegação',
    content:
      'Este é o menu lateral. Por aqui você acessa todas as áreas: Dashboard, Gerenciar, Registro, Checklists e (para super admin) Usuários.',
    placement: 'right',
  },

  // ─── Dashboard ──────────────────────────────────────────────────────────
  {
    path: '/',
    area: 'Dashboard',
    title: '📊 Dashboard — Visão Geral',
    content:
      'Aqui ficam os KPIs principais da frota — total de veículos ativos, checklists do dia, conformidade e evolução. É a primeira tela ao entrar no sistema.',
    waitMs: 400,
  },
  {
    path: '/',
    area: 'Dashboard',
    selector: '[data-tour="notification-bell"]',
    title: '🔔 Sininho de Notificações',
    content:
      'O sininho alerta quando veículos não realizaram o checklist nos horários programados (10h, 16h e 18h). Clique para ver quais veículos estão pendentes e navegar direto para os detalhes.',
    placement: 'bottom',
    waitMs: 400,
  },

  // ─── Gerenciar ──────────────────────────────────────────────────────────
  {
    path: '/gerenciar',
    area: 'Gerenciar',
    title: '🛠️ Gerenciar — Apontamentos de Defeitos',
    content:
      'Cada NC (Não Conformidade) encontrada nos checklists vira um apontamento aqui. Admins acompanham, documentam a resolução e encerram cada ocorrência.',
    waitMs: 900,
  },
  {
    path: '/gerenciar',
    area: 'Gerenciar',
    selector: '[data-tour="manage-stats"]',
    title: '📈 KPIs do Período',
    content:
      'Os cartões mostram totais de Apontamentos, Pendentes, Resolvidos e Defeitos Entrantes (de hoje). Clique em qualquer cartão para filtrar a tabela automaticamente.',
    placement: 'bottom',
  },
  {
    path: '/gerenciar',
    area: 'Gerenciar',
    selector: '[data-tour="manage-severidade"]',
    title: '🚫 Filtro de Severidade',
    content:
      'Filtre rapidamente por 🚫 Impeditivos (veículo não pode rodar) ou ⚠ Precisa de Atenção (não bloqueia, mas exige acompanhamento). O contador em cada pill mostra o total atual.',
    placement: 'top',
  },
  {
    path: '/gerenciar',
    area: 'Gerenciar',
    selector: '[data-tour="manage-filtros-btn"]',
    title: '🔍 Filtros Avançados',
    content:
      'Clique em "Mostrar filtros" para filtrar por veículo, base, supervisor, gerência e intervalo de datas. Os filtros ativos são destacados e podem ser limpos de uma só vez.',
    placement: 'bottom',
  },
  {
    path: '/gerenciar',
    area: 'Gerenciar',
    selector: '[data-tour="manage-table"]',
    title: '📋 Tabela — Recorrentes e Ações',
    content:
      'Defeitos repetidos no mesmo veículo e item ficam agrupados em linha azul "Recorrente · Nx". Clique no badge azul "Ver histórico" para ver todas as ocorrências, ou use os botões de resolução e justificativa à direita.',
    placement: 'top',
  },

  // ─── Evolução ──────────────────────────────────────────────────────────
  {
    path: '/gerenciar/evolucao',
    area: 'Evolução',
    title: '📉 Evolução — Análise Temporal',
    content:
      'Mostra aberturas vs. resoluções ao longo do tempo, tempo médio de resolução e tendências mensais. Ferramenta essencial para análise estratégica da frota.',
    waitMs: 900,
  },
  {
    path: '/gerenciar/evolucao',
    area: 'Evolução',
    selector: '[data-tour="evolucao-kpis"]',
    title: '📊 KPIs de Velocidade',
    content:
      'Total resolvidos, pendentes, dias médios de resolução e tendência vs. período anterior. Verde = meta atingida, vermelho = atenção necessária.',
    placement: 'bottom',
  },
  {
    path: '/gerenciar/evolucao',
    area: 'Evolução',
    selector: '[data-tour="evolucao-chart"]',
    title: '📈 Gráfico Barras + Linha',
    content:
      'As barras mostram resolvidos vs. pendentes por semana/mês. A linha vermelha indica o tempo médio de resolução em dias. Use as abas Gráfico / Heatmap / Defeitos para alternar visões.',
    placement: 'top',
  },

  // ─── Histórico ──────────────────────────────────────────────────────────
  {
    path: '/gerenciar/historico',
    area: 'Histórico',
    title: '📜 Histórico — Manutenções Concluídas',
    content:
      'Todas as manutenções corretivas já encerradas ficam aqui, com fotos e descrição da resolução. Gere relatórios em PDF de qualquer registro com um clique.',
    waitMs: 800,
  },
  {
    path: '/gerenciar/historico',
    area: 'Histórico',
    selector: '[data-tour="historico-filtros"]',
    title: '🔍 Filtros + Paginação',
    content:
      'Filtre por Base e Gerência para focar nos dados relevantes. A lista é paginada em 25 registros por vez — ideal para frotas com grande volume de manutenções.',
    placement: 'bottom',
  },
  {
    path: '/gerenciar/historico',
    area: 'Histórico',
    selector: '[data-tour="historico-lista"]',
    title: '🗂️ Registros com Severidade',
    content:
      'A coluna "Sev." exibe 🚫 para impeditivos e ⚠ para atenção, igual ao Gerenciar. Cada linha tem botão PDF para gerar o relatório completo com fotos e dados da manutenção.',
    placement: 'top',
  },

  // ─── Checklists ──────────────────────────────────────────────────────────
  {
    path: '/gerenciar/checklists',
    area: 'Checklists',
    title: '✅ Checklists — Controle Diário',
    content:
      'Veja quais veículos realizaram (ou não) o checklist do dia. É a ponte entre o operador no campo e a gestão central da frota.',
    waitMs: 800,
  },
  {
    path: '/gerenciar/checklists',
    area: 'Checklists',
    selector: '[data-tour="checklists-actions"]',
    title: '🔗 Link Público do Checklist',
    content:
      'Os operadores acessam um link único (/checklist) sem precisar de login. O formulário pede placa, perguntas de inspeção e fotos dos defeitos. Pode ser enviado por WhatsApp ou QR Code.',
    placement: 'bottom',
  },

  // ─── Resultados ─────────────────────────────────────────────────────────
  {
    path: '/gerenciar/checklists/resultados',
    area: 'Resultados',
    title: '📊 Resultados dos Checklists',
    content:
      'Todos os checklists enviados pelos operadores aparecem aqui. Filtre por tipo de veículo, veja detalhes completos com fotos, edite (admin) ou exporte em CSV.',
    waitMs: 800,
  },

  // ─── Registro ──────────────────────────────────────────────────────────
  {
    path: '/registro',
    area: 'Registro',
    title: '🚗 Registro — Cadastro da Frota',
    content:
      'O cadastro mestre da frota. Usuários autorizados adicionam veículos manualmente ou importam planilhas Excel. A lista é paginada (24 por página em grid, 50 na tabela) para não pesar com frotas grandes.',
    waitMs: 800,
  },
  // ─── Usuários ──────────────────────────────────────────────────────────
  {
    path: '/usuarios',
    area: 'Usuários',
    title: '👥 Usuários — Gestão de Acessos',
    content:
      'Apenas super admins acessam esta área. Aqui você cria novos usuários, define perfis (admin/usuário), reseta senhas e gerencia quem tem acesso ao sistema.',
    waitMs: 800,
  },

  // ─── Encerramento ──────────────────────────────────────────────────────
  {
    path: '/',
    area: 'Encerramento',
    title: '🎉 Tour Concluído!',
    content:
      'Você conheceu todas as áreas do FrotaApp. Boa gestão! Para rever o tour a qualquer momento, clique no botão "?" no canto inferior direito da tela.',
    waitMs: 400,
  },
]

export const TOUR_AUTOSTART_EMAILS = ['demo@frotaapp.com']

export function shouldAutoStartTour(email: string | undefined | null): boolean {
  if (!email) return false
  return TOUR_AUTOSTART_EMAILS.includes(email.trim().toLowerCase())
}

/** Áreas únicas em ordem de aparição, para o mini-mapa */
export const TOUR_AREAS: TourArea[] = TOUR_STEPS.reduce<TourArea[]>((acc, s) => {
  if (!acc.includes(s.area)) acc.push(s.area)
  return acc
}, [])
