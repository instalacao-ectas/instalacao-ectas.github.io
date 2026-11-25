# Orçado x Realizado (Custos de Campo ECTAS): instalação da central

- Painel: **https://instalacao-ectas.github.io/orcado.html**, ou o botão **Orçado x Realizado** na barra do topo do Painel do Supervisor.

Substitui a planilha **BD - CUSTOS DE INSTALAÇÃO**. Mesmo modelo do Diário de Obra, da Agenda Técnica e do Controle de Ferramentas:
os dados ficam numa planilha do Google e a central é um Google Apps Script. O acesso usa a mesma senha do Painel do Diário de Obra.
Só o supervisor usa esta tela; os técnicos não veem custos.

**Importante:** este site é público. Nenhum dado de custo fica aqui. Salário, benefícios e impostos ficam só na planilha da central,
e a tela recebe apenas o valor hora e o valor dia de cada colaborador.

## O que a tela faz

- **Resumo:** orçado x realizado por categoria, realizado por mês, por tipo de visita e os maiores estouros.
- **Visitas:** busca por pedido, ID ou obra; cada visita abre no formato da aba ARQUIVO (orçado, realizado e final por item) e compara os dias lançados com a Agenda Técnica.
- **Novo lançamento:** 7 etapas (identificação, orçado da DIR, deslocamento, estadia e serviços, equipe e horas, gastos adicionais, revisão).
  A obra vem do cadastro do Painel; a equipe e os dias úteis podem ser trazidos da Agenda Técnica.
  O lançamento fica **Aguardando aprovação** até alguém aprovar.
- **Custos e regras:** valor hora e dia de cada colaborador, ligação com o nome usado na Agenda e a diária do carro.

## Ligar a central (uma vez só, cerca de 10 minutos)

1. Entre no Google com a conta da central (diariodeobra.ectas@gmail.com) e abra https://script.google.com.
2. Clique em **Novo projeto** e dê o nome **Custos de Campo ECTAS - Central**.
3. Apague o conteúdo de `Código.gs` e cole todo o conteúdo de `central-custos-Code.gs.txt` desta pasta. Salve.
4. Clique em **+ (Adicionar arquivo) > Script**, dê o nome **Carga** e cole o conteúdo do arquivo **carga-custos.gs.txt**
   (enviado à parte, porque tem salários; ele **não** fica no site). Salve.
   Ele traz as 279 visitas da planilha (nov/2023 a out/2026) e os 21 colaboradores da aba DADOS.
5. No menu de funções, escolha **configurar** e clique em **Executar**. Autorize o acesso (Planilhas, Drive e conexão externa).
   Isso cria a planilha "Custos de Campo ECTAS - Base" e liga a cópia de segurança semanal (domingo, 3h).
6. Depois de configurar, **apague o arquivo Carga** do projeto (os dados já estão na planilha).
7. Clique em **Implantar > Nova implantação**, tipo **App da Web**:
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
8. Copie o endereço que termina em `/exec` e coloque no arquivo `orcado/config.js` (campo `url`), ou envie para quem mantém o site.

## Primeiros ajustes na planilha da central

- Aba **Colaboradores**: inclua quem está na Agenda e ainda não tem custo (Adenilson, Thiago, João Fraga, Gabriel-Eletricista).
  Se o nome na Agenda for diferente do nome completo, preencha a coluna "Nome na Agenda Técnica". Marque Ativo = Não para quem saiu.
- Aba **Parâmetros**: confira a diária do carro (começa em R$ 150, como na aba DADOS; os lançamentos recentes usavam R$ 130).
  Também dá para trocar pela tela, em Custos e regras.
- Aba **Visitas**: uma linha por visita, com orçado, realizado e saldo já calculados. A última coluna (oculta) guarda os detalhes; não edite.

## Atualizar a central depois

Ao trocar o código do Apps Script, use **Implantar > Gerenciar implantações > Editar > Nova versão**. Assim o endereço `/exec` continua o mesmo.
Se o Google pedir nova autorização, rode a função **testarLigacaoDiario** pelo editor e aprove.
