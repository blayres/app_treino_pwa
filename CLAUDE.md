# CLAUDE.md — app_treino_pwa (Focus Improve Train)

PWA de treino (Expo 54 + React Native Web) com Supabase (auth + Postgres). Produção na Vercel.

## Comunicação
- Responder **sempre em português do Brasil**. Código, nomes, comentários e mensagens de commit em inglês.
- Explicar o que mudou e o que **não** foi verificado. Nunca afirmar que algo funciona sem ter testado.

## Comandos
| Ação | Comando |
|---|---|
| Dev (web) | `npm run web` → http://localhost:8081 |
| Tipos | `npx tsc --noEmit -p .` |
| Testes | `npm test` (Jest + ts-jest, arquivos em `__tests__/`) |
| Build web | `npm run build:web` (roda no pre-commit via Husky) |

Antes de todo commit: `tsc` sem erros e `npm test` verde.

## Git e deploy
- Trabalhar na `develop`. `main` = produção (deploy automático na Vercel a cada push).
- Commit, merge e push **só quando a usuária pedir**. Commits no estilo `feat:/fix:/security:/chore:` em inglês.
- Mudança de banco **antes** do deploy do código que depende dela (ver "Banco").

## Arquitetura
```
App.tsx                  boot de auth, rotas (lazy), redirecionamentos (onboarding / treino em andamento)
src/screens/             telas (lógica de tela + layout); estilos em X.styles.ts
src/components/          componentes reutilizáveis (ver lista abaixo)
src/services/            acesso a dados (Supabase e SQLite local) + lógica pura testável
src/utils/               funções puras genéricas (ex.: decimal.ts)
src/store/               zustand: useAppStore (usuário, sessão, onboarding), useDialogStore (alertas)
src/i18n/translations.ts textos em pt (padrão), en, es, fr
src/theme/               cores, espaçamentos, tipografia (tokens)
src/config/features.ts   chaves de funcionalidade (FEATURES)
supabase/*.sql           schema e migrações (aplicadas pela usuária no SQL Editor)
__tests__/               testes Jest (+ fixtures/)
```
- `backendMode` (`src/services/backendMode.ts`): `supabase` em produção, `local` (SQLite) sem env. Toda função de serviço trata os dois modos.
- Lógica de negócio em **funções puras** em `services/` ou `utils/` (testáveis), nunca dentro do JSX.

## Reutilizar SEMPRE — nunca duplicar
Antes de criar algo, procurar (`grep`) se já existe. Se dois lugares precisam da mesma coisa, extrair para um componente/função e usar nos dois.

| Precisa de… | Use |
|---|---|
| Aviso / erro | `showAlert(título, msg)` de `store/useDialogStore` (renderizado pelo `AlertHost`) |
| Confirmação | `ConfirmModal` (`confirmDanger` para ações destrutivas) |
| Banner do topo | `LogoBar` (toda tela; SafeAreaView **sem** `'top'` nos edges) |
| Editar treino (dias, exercícios, séries) | `ProgramEditor` + `services/programService` (`saveProgram`, `loadProgramDraft`, `draftFromText`) |
| Buscar/criar/apagar exercício | `ExercisePickerSheet` |
| Gráfico de evolução / mini gráfico | `ProgressChart`, `Sparkline` |
| Cartão com título | `SectionCard` |
| Carregamento | `Skeleton` (só no 1º carregamento; em recarga manter o conteúdo) |
| Números/cargas | `utils/decimal`: `sanitizeDecimalInput`, `parseDecimal`, `formatDecimal`, `formatKg`, `formatKgDelta` |
| Ícones | SVG inline no estilo dos existentes (`PencilIcon`, ícones do onboarding); sem libs de ícones |
| Cores/espaços/fontes | tokens de `src/theme` — nunca hex solto em tela nova |
| Textos | `t.chave` de `useI18n()` — nunca string visível hardcoded |
| Ligar/desligar recurso | `FEATURES` em `src/config/features.ts` |

## UI / UX
- **Nunca** `Alert.alert`, `window.alert`, `confirm` — não funcionam no react-native-web. Sempre `showAlert`/`ConfirmModal`.
- Ações destrutivas ou irreversíveis (sair, excluir, substituir treino, apagar registro) **sempre** pedem confirmação.
- **Não trocar o texto de botão durante loading** ("Salvando…"): desabilitar e/ou mostrar `ActivityIndicator`.
- Mobile-first: conferir em ~400px de largura. Botões lado a lado: `flex: 1`, `minHeight: 44`, `justifyContent: 'center'`, texto `textAlign: 'center'` — o texto pode quebrar linha em fr/es sem desalinhar.
- Área de toque ≥ 40px. `accessibilityRole`/`accessibilityLabel` em botões só com ícone.
- **4 idiomas**: toda chave nova em pt, en, es e fr (o tipo `Translations` obriga). Conferir textos longos em fr/es.
- Números: mostrar com o separador do idioma (43,5 em pt). Entrada de carga aceita `,` ou `.`.
- Gráficos: seguir a skill `dataviz` (cor validada `colors.chartLine`, grid sólido fino, sem eixo duplo, tooltip + tabela de valores).

## Banco (Supabase)
- Nunca alterar produção diretamente. Toda mudança vira `supabase/migration_<nome>.sql`, **idempotente** (`if not exists`, `drop … if exists`, `create or replace`), aplicada pela usuária no SQL Editor. Documentar no topo do arquivo o que faz e a ordem.
- Atualizar `schema.sql`/migrações para o repositório refletir o banco real (produção já teve triggers/policies fora do repo).
- Código novo que depende de coluna nova deve degradar bem se a migração ainda não rodou quando for barato (ex.: fallback em `getWorkoutExercises`), mas o padrão é: **migração primeiro, deploy depois**.
- Sem transações via PostgREST: operações em várias etapas desfazem o que fizeram em caso de erro (ex.: `createWorkoutForUser`) ou viram RPC `security definer`.

## Segurança
- **RLS em todas as tabelas**: cada usuário só lê/escreve as próprias linhas; admin (`profiles.role = 'admin'`) via `current_profile_is_admin()`. Ver `supabase/migration_security.sql`. Nunca criar policy `using (true)` para escrita.
- Admin é decidido **só** por `profiles.role` no banco. **Nunca confiar em `user_metadata`** (o usuário edita).
- Usuário não pode alterar `profiles.role`/`auth_id` (grants por coluna). Novas colunas editáveis → `grant update (coluna)`.
- RPC `security definer`: `set search_path`, checar `auth.uid()`/dono no início, `revoke … from public, anon` e `grant execute … to authenticated`.
- No app só existem `EXPO_PUBLIC_SUPABASE_URL` e a anon key. Service role apenas em `scripts/` (env local). **Nunca** commitar segredos; chaves de API (ex.: IA) ficam em Edge Function/secret do Supabase, configuradas pela usuária.
- Validar entrada no cliente (ex.: `sanitizeDecimalInput`, `maxLength`) **e** confiar no banco para autorização.
- Não logar dados pessoais/tokens no console.

## Performance
- Telas não críticas com `lazyScreen` (code splitting). Home e Login carregam direto.
- Caches em memória nos serviços (`getWorkoutsByUser`, `getWorkoutExercises`, catálogo do picker): **invalidar após escrita** (`invalidate*Cache`).
- Mostrar cache imediatamente e atualizar em segundo plano; sem "flash" de skeleton em recarga.
- Evitar N+1: buscar em lote / com join do PostgREST. Evitar refetch em cada foco quando o cache basta.
- Escritas por digitação com **debounce** (ex.: cargas: 700 ms; histórico só no blur).
- `useMemo`/`useCallback` em cálculos derivados pesados e listas; `FlatList` para listas longas.
- Sem bibliotecas pesadas para coisas simples (gráficos e ícones são SVG inline). Checar tamanho do bundle no `build:web`.

## Testes
- Toda lógica nova em função pura com teste em `__tests__/` (padrão: `progressUtils`, `workoutTextParser`, `programService`, `decimal`).
- Serviços com Supabase: testar a lógica isolando dependências com `jest.mock` (ver `programService.test.ts`).
- Bug corrigido = teste que reproduz o bug. Casos reais vão para `__tests__/fixtures/`.
- Verificar visualmente no navegador (Claude in Chrome) o que muda na UI, em ~400px; usar a conta de teste, **nunca** digitar/salvar dados numa conta real sem permissão.

## Decisões e pendências conhecidas
- Importar treino (`FEATURES.importWorkout`) desligado até ter IA; planejado também "criar treino com IA por perguntas". Saída da IA deve usar `DraftDay`/`saveProgram`.
- Exercícios privados: `exercises.owner_id` (null = catálogo). Séries/descanso/notas por treino em `workout_exercises`.
- Dívidas: `components/ExerciseRow.tsx` não é usado (a linha está duplicada dentro de `WorkoutScreen`); `AdminScreen` usa formulários antigos; DDL de `exercise_library` não está no repo.
