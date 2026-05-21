import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { BRANDING } from '../branding/paths'

const OWNER_NAME = 'FrotaApp'
const LAST_UPDATED = '12 de maio de 2026'

function LegalShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_top_left,rgba(181,22,73,0.12),transparent_32%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-4 py-8 text-slate-900 dark:bg-[radial-gradient(circle_at_top_left,rgba(181,22,73,0.2),transparent_34%),linear-gradient(180deg,#020617_0%,#01040b_100%)] dark:text-slate-100">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 overflow-hidden rounded-[2rem] bg-[#0b1020] p-6 text-white shadow-[0_24px_70px_rgba(15,23,42,0.20)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex shrink-0 items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 shadow-[0_18px_45px_rgba(0,0,0,0.28)] ring-1 ring-white/15">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#0b1020] shadow-sm ring-1 ring-white/10"
                title="FrotaApp"
              >
                <img
                  src={BRANDING.favicon}
                  alt="FrotaApp"
                  className="h-[72%] w-[72%] object-contain"
                  width={40}
                  height={40}
                  loading="eager"
                  decoding="async"
                />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-black leading-none tracking-tight text-white">
                  Frota<span className="text-sm font-bold text-[#b51649]">App</span>
                </p>
                <div className="mt-2 h-1 w-14 max-w-full rounded-full bg-gradient-to-r from-sky-400 to-sky-500" />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-rose-200">Desenvolvedor do software</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight">{title}</h1>
              <p className="mt-1 text-sm font-extrabold text-white/90">{OWNER_NAME}</p>
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-sm font-semibold leading-relaxed text-slate-300">{subtitle}</p>
          <p className="mt-3 text-xs font-semibold text-slate-400">Ultima atualizacao: {LAST_UPDATED}</p>
        </header>

        <section className="space-y-5 rounded-[2rem] border border-white/70 bg-white/[0.94] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-slate-950/[0.88]">
          {children}
        </section>

        <footer className="mt-6 flex flex-col gap-3 text-sm font-semibold text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {OWNER_NAME}. Desenvolvido por Italo Bruno da Silva Fontes.</p>
          <div className="flex gap-3">
            <Link className="text-[#9f1239] hover:underline dark:text-rose-300" to="/login">Login</Link>
            <Link className="text-[#9f1239] hover:underline dark:text-rose-300" to="/termos">Termos</Link>
            <Link className="text-[#9f1239] hover:underline dark:text-rose-300" to="/privacidade">Privacidade</Link>
          </div>
        </footer>
      </div>
    </main>
  )
}

function LegalBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article>
      <h2 className="text-lg font-black text-[#7f1022] dark:text-rose-200">{title}</h2>
      <div className="mt-2 space-y-2 text-sm font-semibold leading-relaxed text-slate-600 dark:text-slate-300">
        {children}
      </div>
    </article>
  )
}

export function TermsPage() {
  return (
    <LegalShell
      title="Termos de Uso"
      subtitle={`Este documento informa as condicoes de uso do aplicativo. O software foi desenvolvido por ${OWNER_NAME}.`}
    >
      <LegalBlock title="1. Desenvolvimento do software">
        <p>
          O codigo-fonte, arquitetura, telas, fluxos, regras de negocio, componentes especificos, documentacao e demais elementos
          proprios desta aplicacao foram desenvolvidos por {OWNER_NAME}.
        </p>
        <p>
          Nenhuma parte deste software pode ser copiada, modificada, distribuida, revendida, sublicenciada ou explorada comercialmente
          sem autorizacao previa e por escrito.
        </p>
      </LegalBlock>

      <LegalBlock title="2. Licenca de uso">
        <p>
          O acesso ao sistema concede apenas uma permissao limitada de uso operacional, conforme autorizado pelo titular. Essa permissao
          nao transfere propriedade intelectual, codigo-fonte, direitos autorais ou direito de exploracao comercial.
        </p>
      </LegalBlock>

      <LegalBlock title="3. Marcas, logotipos e identidade visual">
        <p>
          Marcas, nomes comerciais, logotipos e materiais de identidade visual eventualmente exibidos na aplicacao pertencem aos seus
          respectivos titulares. O uso desses elementos nao altera os direitos sobre o software desenvolvido por {OWNER_NAME}.
        </p>
      </LegalBlock>

      <LegalBlock title="4. Uso permitido">
        <p>
          O sistema deve ser utilizado somente para gestao de frota, checklists, apontamentos, evidencias, acompanhamentos e demais rotinas
          autorizadas. O usuario nao deve tentar burlar permissoes, acessar dados de terceiros ou extrair informacoes sem autorizacao.
        </p>
      </LegalBlock>

      <LegalBlock title="5. Bibliotecas e servicos de terceiros">
        <p>
          Esta aplicacao pode utilizar bibliotecas open source, provedores de banco de dados, hospedagem, inteligencia artificial ou outros
          servicos externos. Esses componentes continuam sujeitos aos seus proprios termos e licencas.
        </p>
      </LegalBlock>

      <LegalBlock title="6. Alteracoes">
        <p>
          Estes termos podem ser atualizados para refletir alteracoes tecnicas, legais ou operacionais. A continuidade de uso apos a
          atualizacao indica ciencia dos termos vigentes.
        </p>
      </LegalBlock>
    </LegalShell>
  )
}

export function PrivacyPage() {
  return (
    <LegalShell
      title="Politica de Privacidade"
      subtitle="Este documento explica, de forma objetiva, quais dados podem ser tratados pela aplicacao durante o uso operacional."
    >
      <LegalBlock title="1. Dados coletados">
        <p>
          A aplicacao pode registrar dados como nome, matricula, e-mail, perfil de acesso, informacoes de veiculos, respostas de checklists,
          apontamentos, datas, historicos de resolucao, anexos, fotos e evidencias operacionais.
        </p>
      </LegalBlock>

      <LegalBlock title="2. Finalidade">
        <p>
          Os dados sao utilizados para autenticacao, gestao de frota, controle de checklists, registro de nao conformidades, acompanhamento
          de pendencias, relatorios, auditoria operacional e melhoria do processo interno.
        </p>
      </LegalBlock>

      <LegalBlock title="3. Armazenamento e sincronizacao offline">
        <p>
          Em funcionalidades offline, alguns dados podem ser armazenados temporariamente no dispositivo do usuario para sincronizacao
          posterior. Ao recuperar conexao, a aplicacao tenta enviar as informacoes pendentes ao banco de dados configurado.
        </p>
      </LegalBlock>

      <LegalBlock title="4. Compartilhamento">
        <p>
          Os dados podem ser processados por servicos tecnicos necessarios ao funcionamento da aplicacao, como autenticacao, banco de dados,
          armazenamento de arquivos, hospedagem e ferramentas auxiliares. Nao ha autorizacao para venda dos dados pessoais.
        </p>
      </LegalBlock>

      <LegalBlock title="5. Seguranca">
        <p>
          Sao adotadas medidas tecnicas razoaveis para proteger o acesso ao sistema, incluindo autenticacao, perfis de usuario e separacao
          de rotas. O usuario tambem deve proteger suas credenciais e evitar compartilhar acessos.
        </p>
      </LegalBlock>

      <LegalBlock title="6. Direitos do titular dos dados">
        <p>
          Quando aplicavel, o titular dos dados pode solicitar confirmacao de tratamento, correcao, atualizacao ou exclusao de dados,
          respeitadas obrigacoes legais, operacionais e registros necessarios para auditoria.
        </p>
      </LegalBlock>

      <LegalBlock title="7. Desenvolvedor do software">
        <p>
          O software foi desenvolvido por {OWNER_NAME}. Questoes sobre uso, licenciamento e desenvolvimento devem ser tratadas diretamente
          com o desenvolvedor.
        </p>
      </LegalBlock>
    </LegalShell>
  )
}
