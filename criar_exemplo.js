const XLSX = require('xlsx');
const path = require('path');

// Dados de exemplo com novo formato
const exemploData = [
    { data: '15/01/2024', ecommerce: 'Amazon', vendas_ecommerce: 10, receita_ecommerce: 1200, vendas_sac: 3, receita_sac: 120 },
    { data: '15/01/2024', ecommerce: 'Shopee', vendas_ecommerce: 8, receita_ecommerce: 800, vendas_sac: 2, receita_sac: 80 },
    { data: '16/01/2024', ecommerce: 'Amazon', vendas_ecommerce: 12, receita_ecommerce: 1440, vendas_sac: 4, receita_sac: 144 },
    { data: '16/01/2024', ecommerce: 'Mercado Livre', vendas_ecommerce: 6, receita_ecommerce: 600, vendas_sac: 1, receita_sac: 60 },
    { data: '17/01/2024', ecommerce: 'Shopee', vendas_ecommerce: 15, receita_ecommerce: 1500, vendas_sac: 5, receita_sac: 150 },
    { data: '18/01/2024', ecommerce: 'Amazon', vendas_ecommerce: 18, receita_ecommerce: 2160, vendas_sac: 6, receita_sac: 216 },
    { data: '05/02/2024', ecommerce: 'Mercado Livre', vendas_ecommerce: 9, receita_ecommerce: 900, vendas_sac: 2, receita_sac: 90 },
    { data: '06/02/2024', ecommerce: 'Shopee', vendas_ecommerce: 11, receita_ecommerce: 1100, vendas_sac: 3, receita_sac: 110 },
    { data: '10/02/2024', ecommerce: 'Amazon', vendas_ecommerce: 14, receita_ecommerce: 1680, vendas_sac: 4, receita_sac: 168 },
    { data: '15/02/2024', ecommerce: 'Outro', vendas_ecommerce: 7, receita_ecommerce: 700, vendas_sac: 2, receita_sac: 70 }
];

// Criar arquivo Excel
const worksheet = XLSX.utils.json_to_sheet(exemploData);
const workbook = XLSX.utils.book_new();

// Adicionar largura às colunas: data, ecommerce, vendas_ecommerce, receita_ecommerce, vendas_sac, receita_sac
worksheet['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 14 }];

XLSX.utils.book_append_sheet(workbook, worksheet, 'Vendas');
XLSX.writeFile(workbook, path.join(__dirname, 'exemplo_importacao.xlsx'));

console.log('✅ Arquivo exemplo_importacao.xlsx criado com sucesso!');

