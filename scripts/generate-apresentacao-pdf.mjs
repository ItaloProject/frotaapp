/**
 * Gera a apresentação em PDF do Portal CGB Frota.
 * Uso: node scripts/generate-apresentacao-pdf.mjs
 * Saída: public/Apresentacao-CGB-Frota.pdf
 */
import { jsPDF } from 'jspdf'
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'public')
const OUT_FILE = join(OUT_DIR, 'Apresentacao-CGB-Frota.pdf')
const SHOTS_DIR = join(OUT_DIR, 'apresentacao-screenshots')

/** Cores CGB */
const C = {
  crimson: [181, 22, 73],
  crimsonDark: [127, 16, 34],
  navy: [11, 16, 32],
  navyMid: [30, 41, 59],
  slate: [100, 116, 139],
  light: [248, 250, 252],
  white: [255, 255, 255],
  emerald: [16, 185, 129],
}

const PAGE_W = 842
const PAGE_H = 595
const M = 48

function setFill(doc, rgb) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2])
}
function setDraw(doc, rgb) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2])
}
function setText(doc, rgb) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2])
}

function drawHeader(doc, title, subtitle) {
  setFill(doc, C.navy)
  doc.rect(0, 0, PAGE_W, 72, 'F')
  setFill(doc, C.crimson)
  doc.rect(0, 72, PAGE_W, 4, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  setText(doc, C.white)
  doc.text(title, M, 38)

  if (subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(203, 213, 225)
    doc.text(subtitle, M, 56)
  }
}

function drawFooter(doc, pageNum, total) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  setText(doc, C.slate)
  doc.text('CGB Engenharia — Portal de Gestão de Frota', M, PAGE_H - 24)
  doc.text(`${pageNum} / ${total}`, PAGE_W - M, PAGE_H - 24, { align: 'right' })
}

function wrapText(doc, text, x, y, maxW, lineH, fontSize = 11) {
  doc.setFontSize(fontSize)
  const lines = doc.splitTextToSize(text, maxW)
  lines.forEach((line, i) => doc.text(line, x, y + i * lineH))
  return y + lines.length * lineH
}

function drawBullets(doc, items, x, y, maxW, opts = {}) {
  const lineH = opts.lineH ?? 18
  const fontSize = opts.fontSize ?? 11
  let cy = y
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(fontSize)
  setText(doc, opts.color ?? C.navyMid)

  for (const item of items) {
    setFill(doc, C.crimson)
    doc.circle(x + 4, cy - 3.5, 2.5, 'F')
    cy = wrapText(doc, item, x + 16, cy, maxW - 16, lineH, fontSize) + 4
  }
  return cy
}

function drawMockScreen(doc, x, y, w, h, label, lines) {
  setDraw(doc, [226, 232, 240])
  setFill(doc, C.light)
  doc.roundedRect(x, y, w, h, 8, 8, 'FD')

  setFill(doc, C.navy)
  doc.roundedRect(x, y, w, 28, 8, 0, 'F')
  doc.rect(x, y + 20, w, 8, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setText(doc, C.white)
  doc.text(label, x + 12, y + 18)

  let ly = y + 44
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  setText(doc, C.slate)
  for (const line of lines) {
    setFill(doc, [226, 232, 240])
    doc.roundedRect(x + 12, ly - 8, w - 24, 14, 3, 3, 'F')
    doc.text(line, x + 18, ly + 2)
    ly += 22
  }
}

function slideCover(doc) {
  setFill(doc, C.navy)
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F')

  setFill(doc, C.crimsonDark)
  doc.circle(PAGE_W * 0.85, PAGE_H * 0.15, 120, 'F')
  setFill(doc, C.crimson)
  doc.circle(PAGE_W * 0.12, PAGE_H * 0.88, 80, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(251, 207, 232)
  doc.text('CGB ENGENHARIA', M, 120)

  doc.setFontSize(42)
  setText(doc, C.white)
  doc.text('Portal CGB', M, 175)
  doc.text('Gestão de Frota', M, 225)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(18)
  doc.setTextColor(203, 213, 225)
  doc.text('Sua frota sob controle total.', M, 275)

  doc.setFontSize(12)
  doc.text('Apresentação do sistema — gestão, checklists e apontamentos', M, 310)

  doc.setFontSize(10)
  doc.setTextColor(148, 163, 184)
  const date = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  doc.text(`Documento gerado em ${date}`, M, PAGE_H - 48)
}

function drawScreenshot(doc, shotId, x, y, maxW, maxH) {
  const path = join(SHOTS_DIR, `${shotId}.png`)
  if (!existsSync(path)) return null

  const data = readFileSync(path).toString('base64')
  const aspects = {
    checklist: 390 / 844,
    default: 1280 / 800,
  }
  const aspect = aspects[shotId] ?? aspects.default

  let w = maxW
  let h = w / aspect
  if (h > maxH) {
    h = maxH
    w = h * aspect
  }

  setDraw(doc, [203, 213, 225])
  doc.setLineWidth(1)
  doc.roundedRect(x - 1, y - 1, w + 2, h + 2, 6, 6, 'S')
  doc.addImage(`data:image/png;base64,${data}`, 'PNG', x, y, w, h)
  return { w, h, bottom: y + h }
}

function drawScreenOrMock(doc, x, y, maxW, maxH, shotId, mock) {
  const shot = shotId ? drawScreenshot(doc, shotId, x, y, maxW, maxH) : null
  if (shot) return shot.bottom
  drawMockScreen(doc, x, y, maxW, maxH, mock.label, mock.lines)
  return y + maxH
}

function slideContent(doc, { title, subtitle, bullets, screen, screenshot, extra, twoCol }) {
  drawHeader(doc, title, subtitle)
  let y = 96

  if (twoCol && (screen || screenshot)) {
    const colW = (PAGE_W - M * 2 - 24) / 2
    const maxH = 380
    drawScreenOrMock(doc, M, y, colW, maxH, screenshot, screen)
    drawBullets(doc, bullets, M + colW + 24, y + 8, colW - 8, { fontSize: 10.5, lineH: 17 })
    if (extra) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(10)
      setText(doc, C.slate)
      wrapText(doc, extra, M, PAGE_H - 72, PAGE_W - M * 2, 14, 10)
    }
  } else {
    if (bullets?.length) y = drawBullets(doc, bullets, M, y, PAGE_W - M * 2) + 12
    if (screenshot || screen) {
      y = drawScreenOrMock(doc, M, y, PAGE_W - M * 2, 220, screenshot, screen) + 16
    }
    if (extra) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(10)
      setText(doc, C.slate)
      wrapText(doc, extra, M, y, PAGE_W - M * 2, 14, 10)
    }
  }
}

const SLIDES = [
  { type: 'cover' },
  {
    title: 'Visão geral',
    subtitle: 'O que é o Portal CGB Frota',
    bullets: [
      'Plataforma web para gestão completa da frota da CGB Engenharia.',
      'Centraliza inspeções (checklists), apontamentos de defeitos, registro de veículos e indicadores.',
      'Dois públicos: operadores de campo (sem login) e gestores/administradores (com login).',
      'Funciona no navegador do celular ou computador — inclusive offline para checklists.',
      'Integração com WhatsApp para alertas de não conformidades (NC) aos supervisores.',
    ],
  },
  {
    title: 'Dois fluxos de uso',
    subtitle: 'Operador x Gestor',
    twoCol: true,
    screenshot: 'checklist',
    screen: {
      label: 'Operador (campo)',
      lines: ['/checklist — link público', 'Sem login necessário', 'Preenche inspeção no celular', 'Online ou offline'],
    },
    bullets: [
      'Gestor acessa /login com e-mail e senha.',
      'Dashboard com KPIs e adesão aos checklists.',
      'Gerenciar apontamentos abertos e resolvidos.',
      'Evolução analítica e histórico de reparos.',
      'Registro e catálogo de veículos da frota.',
      'Administração de usuários (super admin).',
    ],
    extra: 'Operadores recebem o link /checklist; gestores usam credenciais corporativas.',
  },
  {
    title: 'Página de Login',
    subtitle: 'Rota: /login',
    twoCol: true,
    screenshot: 'login',
    screen: {
      label: 'Tela de Login',
      lines: ['Logo CGB', 'E-mail + senha', 'Mostrar/ocultar senha', 'Tema claro / escuro', 'Links: Termos e Privacidade'],
    },
    bullets: [
      'Portal de entrada para gestores e administradores.',
      'Identidade visual CGB: vermelho institucional e slogan “Sua frota sob controle total”.',
      'Suporte a tema claro e escuro conforme preferência do usuário.',
      'Primeiro acesso pode exigir troca de senha (/trocar-senha).',
      'Após login, redirecionamento automático ao Dashboard.',
    ],
  },
  {
    title: 'Perfis de acesso',
    subtitle: 'Controle por papel (role)',
    bullets: [
      'user — acesso às áreas operacionais: Dashboard, Gerenciar, Registro e Checklists.',
      'admin — mesmas permissões do user para gestão da frota.',
      'super_admin — inclui gestão de usuários (/usuarios): criar, editar e desativar contas.',
      'Operadores de campo não possuem login — usam apenas o checklist público.',
      'Menu lateral adapta-se ao perfil (ex.: “Usuários” só para super_admin).',
    ],
  },
  {
    title: 'Dashboard',
    subtitle: 'Rota: / — Painel inicial',
    twoCol: true,
    screenshot: 'dashboard',
    screen: {
      label: 'Dashboard',
      lines: ['KPIs de frota e checklists', 'Filtros: base, processo, supervisor', 'Gráficos de adesão', 'Status operacional dos veículos'],
    },
    bullets: [
      'Visão executiva da operação em tempo real.',
      'Indicadores de checklists realizados vs. esperados (adesão).',
      'Resumo do status operacional: ativos, em manutenção, impedidos.',
      'Filtros por base, coordenador, supervisor e processo.',
      'Gráficos de evolução por período (hoje, 7, 30 ou 90 dias).',
    ],
  },
  {
    title: 'Gerenciar',
    subtitle: 'Rota: /gerenciar — Apontamentos do dia',
    twoCol: true,
    screenshot: 'gerenciar',
    screen: {
      label: 'Gerenciar Apontamentos',
      lines: ['Cards de estatísticas', 'Filtros avançados', 'Lista de NCs abertas', 'Resolver / reparo / evidências'],
    },
    bullets: [
      'Central de trabalho para tratar não conformidades dos checklists.',
      'Cards com totais: abertos, resolvidos hoje, urgentes e impeditivos.',
      'Filtros por placa, supervisor, base, processo e data.',
      'Cada apontamento: descrição, fotos, veículo, operador e supervisor.',
      'Fluxo de resolução com registro de reparo, valor e anexos (OS).',
    ],
  },
  {
    title: 'Evolução',
    subtitle: 'Rota: /gerenciar/evolucao',
    twoCol: true,
    screenshot: 'evolucao',
    screen: {
      label: 'Evolução Analítica',
      lines: ['KPIs de tendência', 'Gráficos por período', 'Ranking de defeitos', 'Exportação CSV'],
    },
    bullets: [
      'Análise de tendências dos apontamentos ao longo do tempo.',
      'KPIs: total de defeitos, taxa de resolução, tempo médio, custo.',
      'Gráficos interativos por tipo de defeito, base e supervisor.',
      'Identificação de padrões recorrentes para ação preventiva.',
      'Exportação de dados em CSV para relatórios externos.',
    ],
  },
  {
    title: 'Histórico',
    subtitle: 'Rota: /gerenciar/historico',
    twoCol: true,
    screenshot: 'historico',
    screen: {
      label: 'Histórico de Reparos',
      lines: ['Reparos concluídos', 'Filtro por valor e data', 'Detalhes do reparo', 'Gerar PDF com OS'],
    },
    bullets: [
      'Consulta de todos os reparos já finalizados.',
      'Filtros por placa, valor mínimo/máximo e intervalo de datas.',
      'Total gasto em reparos no período selecionado.',
      'Geração de PDF individual por reparo (dados + ordem de serviço anexa).',
      'Rastreabilidade completa: quem resolveu, quando e quanto custou.',
    ],
  },
  {
    title: 'Checklists (Admin)',
    subtitle: 'Rota: /gerenciar/checklists',
    twoCol: true,
    screenshot: 'checklists',
    screen: {
      label: 'Tipos de Checklist',
      lines: ['SKY, Munck, Picape…', 'Preview do formulário', 'Contagem de itens', 'Link para operadores'],
    },
    bullets: [
      'Visão administrativa dos 7+ tipos de checklist disponíveis.',
      'SKY, Munck, Picape Leve/4x4, Motocicleta, Veículo Leve, Empilhadeira.',
      'Preview da estrutura: grupos, itens e campos extras por tipo.',
      'Itens impeditivos (🚫) bloqueiam condução do veículo se marcados NC.',
      'Acesso aos resultados enviados pelos operadores.',
    ],
  },
  {
    title: 'Resultados de Checklists',
    subtitle: 'Rota: /gerenciar/checklists/resultados',
    twoCol: true,
    screenshot: 'resultados',
    screen: {
      label: 'Resultados',
      lines: ['Lista de envios', 'Filtros por tipo/data', 'Detalhe completo', 'Export CSV'],
    },
    bullets: [
      'Lista de todos os checklists enviados pelos operadores.',
      'Filtros por tipo, data, placa, operador e supervisor.',
      'Visualização de respostas C / NC / NA item a item.',
      'Fotos de evidência e dados do veículo inspecionado.',
      'Exportação CSV para auditoria e relatórios gerenciais.',
    ],
  },
  {
    title: 'Registro de Veículos',
    subtitle: 'Rota: /registro',
    twoCol: true,
    screenshot: 'registro',
    screen: {
      label: 'Registro da Frota',
      lines: ['Catálogo por tipo', 'Placa, modelo, prefixo', 'Status ATIVO/INATIVO', 'Importação XLSX'],
    },
    bullets: [
      'Cadastro e manutenção do catálogo completo da frota.',
      'Organização por tipo: SKY, Munck, Motos, Picapes, Veículos Leves, etc.',
      'Campos: placa, modelo, prefixo, base, supervisor, coordenador, ano.',
      'Status operacional e flag de manutenção por veículo.',
      'Importação em lote via planilha Excel (XLSX).',
      'Assistente IA para consultas sobre a frota (Gemini).',
    ],
  },
  {
    title: 'Checklist Público',
    subtitle: 'Rota: /checklist — Operadores de campo',
    twoCol: true,
    screenshot: 'checklist',
    screen: {
      label: 'Fluxo do Operador',
      lines: ['1. Escolher tipo', '2. Nome + matrícula', '3. Dados do veículo', '4. C / NC / NA por item', '5. Enviar'],
    },
    bullets: [
      'Acesso público — operador não precisa de login.',
      'Identificação: nome completo e matrícula (até 5 dígitos).',
      'Dados do veículo: placa (autocomplete), KM, localidade (GPS).',
      'Seleção do supervisor responsável com validação WhatsApp.',
      'Respostas: Conforme (C), Não Conforme (NC) ou Não se Aplica (NA).',
      'NC exige descrição + fotos; itens impeditivos impedem condução.',
      'Funciona offline — sincroniza quando a internet voltar (PWA).',
    ],
  },
  {
    title: 'Conclusão do Checklist',
    subtitle: 'Tela final para o operador',
    bullets: [
      '“Tudo Conforme!” — verde, quando não há NC.',
      '“NC Registrado” — alerta âmbar com botão para avisar supervisor via WhatsApp.',
      '“Veículo Impedido!” — vermelho quando há NC em item impeditivo (🚫).',
      'Mensagem pré-formatada no WhatsApp com todos os NCs e fotos.',
      'Modo offline: “Checklist salvo no dispositivo” até sincronizar.',
    ],
    extra: 'Demo automática para gravação de vídeo: /checklist/demo',
  },
  {
    title: 'Usuários',
    subtitle: 'Rota: /usuarios — Apenas super_admin',
    twoCol: true,
    screenshot: 'usuarios',
    screen: {
      label: 'Administração',
      lines: ['Lista de usuários', 'Criar nova conta', 'Papel: user/admin/super', 'Ativar / desativar'],
    },
    bullets: [
      'Gestão centralizada de contas de acesso ao portal.',
      'Criação de usuários com e-mail, senha temporária e perfil.',
      'Alteração de papel (role) e reset de senha.',
      'Ativação/desativação sem excluir histórico.',
      'Controle de quem acessa cada área do sistema.',
    ],
  },
  {
    title: 'Recursos técnicos',
    subtitle: 'Diferenciais da plataforma',
    bullets: [
      'PWA (Progressive Web App) — instalável no celular como app.',
      'Modo offline para checklists com fila de sincronização (IndexedDB).',
      'Compressão automática de fotos antes do envio (~155 KB).',
      'Notificações de NC por e-mail (Edge Function Supabase).',
      'Tema claro/escuro em todas as telas autenticadas.',
      'Tour guiado interativo para novos usuários (botão “?”).',
      'Backend Supabase: autenticação, banco PostgreSQL e storage.',
    ],
  },
  {
    title: 'Mapa de rotas',
    subtitle: 'Referência rápida',
    bullets: [
      'Público: /login · /checklist · /checklist/demo · /termos · /privacidade',
      'Autenticado: / (Dashboard) · /gerenciar · /gerenciar/evolucao · /gerenciar/historico',
      'Checklists: /gerenciar/checklists · /gerenciar/checklists/resultados · /checklists/detalhar',
      'Frota: /registro · /veiculos/status',
      'Admin: /usuarios · /trocar-senha',
    ],
  },
  {
    title: 'Obrigado',
    subtitle: 'CGB Engenharia — Gestão de Frota',
    bullets: [
      'Portal integrado para inspeção, gestão e rastreabilidade da frota.',
      'Operadores preenchem checklists no celular; gestores acompanham em tempo real.',
      'Redução de riscos com itens impeditivos e alertas imediatos ao supervisor.',
      'Dados centralizados para decisões baseadas em indicadores.',
    ],
    extra: 'Contato: @grupocgboficial · Portal CGB — Sua frota sob controle total.',
  },
]

function buildPdf() {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const total = SLIDES.length

  SLIDES.forEach((slide, i) => {
    if (i > 0) doc.addPage()
    if (slide.type === 'cover') {
      slideCover(doc)
    } else {
      slideContent(doc, slide)
    }
    drawFooter(doc, i + 1, total)
  })

  mkdirSync(OUT_DIR, { recursive: true })
  const buf = Buffer.from(doc.output('arraybuffer'))
  writeFileSync(OUT_FILE, buf)
  return OUT_FILE
}

const out = buildPdf()
console.log(`Apresentação gerada: ${out}`)
console.log(`Slides: ${SLIDES.length}`)
if (existsSync(SHOTS_DIR)) {
  const { readdirSync } = await import('node:fs')
  const n = readdirSync(SHOTS_DIR).filter((f) => f.endsWith('.png')).length
  console.log(`Screenshots embarcados: ${n}`)
} else {
  console.log('Dica: rode "npm run gen:apresentacao" com o dev server ativo para capturar telas reais.')
}
