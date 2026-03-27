# 📊 Dashboard de Vendas - Guia de Importação

## Padrão para Importar Arquivo Excel

O arquivo Excel deve estar em formato `.xlsx` ou `.xls` com a seguinte estrutura:

### **Colunas Obrigatórias:**

| data       | ecommerce      | quantidade | receita |
|-----------|----------------|------------|---------|
| 15/01/2024 | Amazon        | 10         | 1200    |
| 16/01/2024 | Shopee        | 8          | 800     |
| 17/01/2024 | Mercado Livre | 12         | 1440    |
| 18/01/2024 | Outro         | 6          | 600     |

### **Explicação das Colunas:**

- **data**: Formato `DD/MM/AAAA` (dia/mês/ano)
  - Exemplo: `15/01/2024`, `20/03/2024`
  - ⚠️ Importante: Use barra `/` como separador
  
- **ecommerce**: Nome do marketplace
  - Valores aceitos: `Amazon`, `Shopee`, `Mercado Livre`, `Outro`, ou qualquer outro customizado
  - Os ecommerces aparecerão automaticamente no dashboard conforme você adiciona no banco
  
- **quantidade**: Quantidade de vendas (número inteiro)
  - Exemplo: `10`, `15`, `100`
  - Note: Esta coluna será armazenada como "Vendas" internamente
  
- **receita**: Valor em reais (número com até 2 casas decimais)
  - Exemplo: `1200`, `1500.50`, `900.00`
  - Use ponto `.` como separador decimal

---

## 📁 Arquivo de Exemplo

Um arquivo de exemplo chamado **`exemplo_importacao.xlsx`** está disponível na mesma pasta.

Você pode:
1. ✅ **Usar como template** - Copie, edite e importe
2. ✅ **Verificar o padrão** - Abra no Excel/Sheets para ver a estrutura exata
3. ✅ **Importar diretamente** - Para testar o dashboard com dados de exemplo

---

## 🚀 Como Importar

1. Prepare seu arquivo Excel seguindo o padrão acima
2. Acesse a página **"Banco de Dados"** do dashboard
3. Clique em **"📁 Selecionar Arquivo Excel"**
4. Escolha seu arquivo
5. Clique em **"📤 Importar Arquivo"**
6. Pronto! Os dados serão carregados no dashboard

---

## ⚠️ Dicas Importantes

- ✅ Primeira linha deve conter os **nomes das colunas** exatamente: `data`, `ecommerce`, `quantidade`, `receita`
- ✅ Datas devem estar no formato `DD/MM/AAAA` (Ex: 15/01/2024)
- ✅ Valores de receita podem usar `.` (ponto) como separador decimal
- ✅ O arquivo será importado para `dados.xlsx` (banco de dados integrado)
- ✅ Você pode importar múltiplos arquivos - eles substituirão os dados anteriores
- ✅ Os ecommerces aparecem automaticamente no dashboard conforme existem no banco

---

## 📝 Exemplo de Uso

**Arquivo Excel:**
```
data       | ecommerce     | quantidade | receita
01/03/2024 | Amazon        | 25         | 3000.00
02/03/2024 | Shopee        | 18         | 1800.00
03/03/2024 | Mercado Livre | 12         | 1440.00
```

**Resultado no Dashboard:**
- Total de Vendas: 55
- Receita Total: R$ 6.240,00
- Gráficos e filtros funcionarão normalmente

---

## 🔄 Exportar Dados

Para fazer backup ou enviá-lo para outra pessoa:
1. Vá para **"Banco de Dados"**
2. Clique em **"💾 Exportar Dados para Excel"**
3. Um arquivo `vendas_backup.xlsx` será baixado

---

## ❓ Dúvidas Frequentes

**P: Posso usar Excel com datas em outro formato?**
R: Sim! O sistema converte automaticamente datas em formato `DD/MM/AAAA` para o padrão interno. Outros formatos serão aceitos automaticamente.

**P: Posso ter ecommerces com nomes diferentes?**
R: Sim! Qualquer ecommerce que você colocar será aceito. Ele aparecerá automaticamente nas opções de filtro.

**P: O que acontece se eu importar um arquivo?**
R: Os dados do arquivo substituem todos os dados anteriores. Faça backup se necessário usando a opção "Exportar".


