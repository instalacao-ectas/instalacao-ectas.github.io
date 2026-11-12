# Agenda Técnica ECTAS: instalação da central

- App do técnico: **https://instalacao-ectas.github.io/agenda/**
- Painel do supervisor: **https://instalacao-ectas.github.io/agenda/supervisor.html**

Mesmo modelo do Diário de Obra e do Controle de Ferramentas: os dados ficam numa planilha do Google e a central é um Google Apps Script.
O acesso é único com o Diário de Obra: técnicos usam o mesmo usuário e senha, e o painel usa a mesma senha do Painel do Diário.
Quem já está logado no Diário entra na Agenda sem digitar a senha de novo.

## O que cada um vê

- **Técnico** (só leitura): Minha agenda (obra de hoje, cidade, veículo e próximas 6 semanas), Agenda da equipe e Onde está a equipe. A última agenda fica salva no celular e abre sem internet.
- **Supervisor**: tudo acima, mais lançar e editar alocações (várias pessoas de uma vez), lista de lançamentos com filtros e download para Excel, Obras em espera, Manutenções e Cadastros.

## Ligar a central (uma vez só, cerca de 10 minutos)

1. Entre no Google com a conta da central (a mesma do Diário: diariodeobra.ectas@gmail.com) e abra https://script.google.com.
2. Clique em **Novo projeto** e dê o nome **Agenda Técnica ECTAS - Central**.
3. Apague o conteúdo de `Código.gs` e cole todo o conteúdo do arquivo `central-agenda-Code.gs.txt` desta pasta. Salve.
4. Clique em **+ (Adicionar arquivo) > Script**, dê o nome **Carga** e cole todo o conteúdo de `carga-agenda.gs.txt`. Salve.
   Esse arquivo traz a agenda que estava na planilha CRONOGRAMA (1.169 lançamentos de janeiro de 2026 em diante, 12 funcionários, 297 obras, veículos, obras em espera e manutenções).
5. No menu de funções, escolha **configurar** e clique em **Executar**. Autorize o acesso (Planilhas, Drive e conexão externa).
   Isso cria a planilha "Agenda Técnica ECTAS - Base" já preenchida e liga a cópia de segurança semanal (domingo, 3h).
6. Clique em **Implantar > Nova implantação**, tipo **App da Web**:
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
7. Copie o endereço que termina em `/exec` e coloque no arquivo `config.js` desta pasta (campo `url`), ou envie para quem mantém o site.

## Primeiro acesso do supervisor

1. Abra o painel com a mesma senha do Painel do Diário de Obra.
2. Em **Cadastros > Funcionários**, ligue cada pessoa ao usuário dela no Diário de Obra. Assim a Minha agenda abre direto no nome certo.
3. Marque **Ativo** só para quem deve aparecer na agenda (até quem saiu continua no histórico).
4. Passe aos técnicos o endereço **instalacao-ectas.github.io/agenda** (o mesmo usuário e senha do Diário).

## Regras da agenda

- Um lançamento cobre um período (início e término) de um funcionário. Para a equipe inteira, marque todos no mesmo lançamento.
- Se dois lançamentos caem no mesmo dia, vale o salvo por último. A grade marca esse dia com um ponto vermelho e a lista mostra "Sobreposição".
- Planejado aparece em tom claro com borda tracejada; Confirmado em cor sólida.

## Atualizar a central depois

Ao trocar o código do Apps Script, use **Implantar > Gerenciar implantações > Editar > Nova versão**. Assim o endereço `/exec` continua o mesmo.
Se o Google pedir nova autorização, rode a função **testarLigacaoDiario** pelo editor e aprove.
