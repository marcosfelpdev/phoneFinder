---
name: phone-finder-validation
description: >-
  Defines testing protocols, manual LAN verification runbooks, and acceptance criteria
  checklists for Phone Finder. Use when verifying or testing any phase of Phone Finder.
---

# Phone Finder Validation Standard

Esta skill padroniza os procedimentos de teste e validação rigorosa dos 14 Critérios de Aceitação do projeto Phone Finder.

## 1. Roteiro de Teste dos 14 Critérios de Aceitação

| # | Cenário a Validar | Procedimento de Teste | Critério de Sucesso |
| :- | :--- | :--- | :--- |
| **1** | Múltiplos Cards | Cadastrar "Celular Estoque 01" e "Celular Manutenção 02". | Ambos os cards aparecem na grade com seus respectivos nomes e IDs únicos. |
| **2** | Geração de Código | Clicar em "Parear celular" no card 1. | Modal exibe código de 6 dígitos numéricos e contador regressivo de 5 minutos. |
| **3** | Acesso LAN Wi-Fi | No celular, abrir `http://<IP_DO_PC>:3000/receiver`. | Página do receptor carrega com status "Conectado ao servidor, aguardando código". |
| **4** | Associação Válida | Digitar o código de 6 dígitos no celular. | Celular exibe tela de "Aparelho Vinculado" e Card 1 no Dashboard fica verde "Conectado". |
| **5** | Invalidação do Código | Tentar digitar o mesmo código em outro celular ou aba anônima. | Erro explícito "Código inválido ou expirado". Código não pode ser reusado. |
| **6** | Status em Tempo Real | Fechar a aba do navegador do celular. | Em até 3 segundos o Card 1 no Dashboard muda para "Desconectado". |
| **7** | Isolamento de Alerta | Com Card 1 e Card 2 conectados em aparelhos diferentes, clicar em "Localizar" no Card 1. | Apenas o celular 1 reage. O celular 2 permanece inalterado. |
| **8** | Tela 100% Vermelha | Observar a tela do Celular 1 durante o alerta. | Tela preenchida 100% de vermelho (#FF0000) por exatamente 5s, retornando ao normal. |
| **9** | Bloqueio Offline | Clicar em "Localizar" em um card com status "Desconectado". | Botão está desabilitado na UI; tentativa via API retorna erro 400/Socket error. |
| **10** | Feedback Visual | Testar falhas (código errado, timeout, exclusão). | Toasts/alertas claros de erro, feedback de loading e tela de lista vazia quando sem cards. |
| **11** | Persistência | Reiniciar o processo do servidor backend (`Ctrl+C` e reiniciar). | Cards e vínculos continuam existindo no arquivo local e reaparecem no dashboard. |
| **12** | Edição e Exclusão | Renomear "Celular Estoque 01" para "Estoque B". Excluir card com confirmação. | Nome atualiza sem alterar ID; exclusão solicita confirmação e remove o card. |
| **13** | Operação Offline | Desconectar a internet do roteador Wi-Fi (mantendo apenas LAN ativa). | O sistema continua funcionando perfeitamente entre PC e celulares locais. |
| **14** | Instruções no README | Seguir o passo a passo de instalação do README em ambiente limpo. | Comandos `npm install` e `npm run dev` funcionam sem comandos inventados ou erros. |

## 2. Ferramentas e Scripts Auxiliares
- Para listar os endereços IPv4 locais e checar as portas:
  Execute `powershell -ExecutionPolicy Bypass -File .agents/skills/phone-finder-validation/scripts/lan-ip-helper.ps1`
