const XLSX = require('xlsx');
const path = require('path');

// Dados de exemplo com novo formato
const exemploData = [
    { data: '15/01/2024', ecommerce: 'Amazon', quantidade: 10, receita: 1200, receita_sac: 120 },
    { data: '15/01/2024', ecommerce: 'Shopee', quantidade: 8, receita: 800, receita_sac: 80 },
    { data: '16/01/2024', ecommerce: 'Amazon', quantidade: 12, receita: 1440, receita_sac: 144 },
    { data: '16/01/2024', ecommerce: 'Mercado Livre', quantidade: 6, receita: 600, receita_sac: 60 },
    { data: '17/01/2024', ecommerce: 'Shopee', quantidade: 15, receita: 1500, receita_sac: 150 },
    { data: '18/01/2024', ecommerce: 'Amazon', quantidade: 18, receita: 2160, receita_sac: 216 },
    { data: '05/02/2024', ecommerce: 'Mercado Livre', quantidade: 9, receita: 900, receita_sac: 90 },
    { data: '06/02/2024', ecommerce: 'Shopee', quantidade: 11, receita: 1100, receita_sac: 110 },
    { data: '10/02/2024', ecommerce: 'Amazon', quantidade: 14, receita: 1680, receita_sac: 168 },
    { data: '15/02/2024', ecommerce: 'Outro', quantidade: 7, receita: 700, receita_sac: 70 }
];

// Criar arquivo Excel
const worksheet = XLSX.utils.json_to_sheet(exemploData);
const workbook = XLSX.utils.book_new();

// Adicionar largura às colunas
worksheet['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];

XLSX.utils.book_append_sheet(workbook, worksheet, 'Vendas');
XLSX.writeFile(workbook, path.join(__dirname, 'exemplo_importacao.xlsx'));

console.log('✅ Arquivo exemplo_importacao.xlsx criado com sucesso!');

