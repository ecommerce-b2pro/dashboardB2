require('dotenv').config();

const express = require('express');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const NODE_ENV = process.env.NODE_ENV || 'development';

let JWT_SECRET = process.env.JWT_SECRET || '';
if (!JWT_SECRET || JWT_SECRET === 'dev-secret-change-me' || JWT_SECRET.length < 32) {
    if (NODE_ENV === 'production') {
        // Tenta carregar segredo persistido de execuções anteriores para não invalidar sessões
        const secretFile = path.join(process.env.DATA_DIR || path.join(__dirname, 'data'), '.jwt_secret');
        try {
            if (fs.existsSync(secretFile)) {
                JWT_SECRET = fs.readFileSync(secretFile, 'utf8').trim();
            } else {
                JWT_SECRET = crypto.randomBytes(48).toString('hex');
                fs.mkdirSync(path.dirname(secretFile), { recursive: true });
                fs.writeFileSync(secretFile, JWT_SECRET, { mode: 0o600 });
            }
            console.warn('⚠️  JWT_SECRET lido do arquivo local. Configure JWT_SECRET como variável de ambiente para maior segurança.');
        } catch (_) {
            JWT_SECRET = crypto.randomBytes(48).toString('hex');
            console.warn('⚠️  JWT_SECRET não configurado. Segredo temporário gerado — sessões serão invalidadas ao reiniciar.');
        }
    } else {
        JWT_SECRET = 'dev-secret-change-me';
    }
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@hubvendas.com').toLowerCase();
const ADMIN_USERNAME = String(process.env.ADMIN_USERNAME || 'admin').trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'TroqueEstaSenhaAgora123!';

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const EXCEL_FILE = path.join(__dirname, 'dados.xlsx');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

function convertPlaceholders(sql) {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
}

async function dbRun(sql, params = []) {
    const result = await pool.query(convertPlaceholders(sql), params);
    return { changes: result.rowCount };
}

async function dbGet(sql, params = []) {
    const result = await pool.query(convertPlaceholders(sql), params);
    return result.rows[0];
}

async function dbAll(sql, params = []) {
    const result = await pool.query(convertPlaceholders(sql), params);
    return result.rows;
}

function converterData(dataStr) {
    if (!dataStr) return '';

    const dataString = String(dataStr).trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(dataString)) {
        return dataString;
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataString)) {
        const [dia, mes, ano] = dataString.split('/');
        return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    }

    if (/^\d+(\.\d+)?$/.test(dataString)) {
        const serial = parseFloat(dataString);
        const epochDate = new Date(1900, 0, -1);
        const resultDate = new Date(epochDate.getTime() + serial * 86400000);
        const dia = String(resultDate.getDate()).padStart(2, '0');
        const mes = String(resultDate.getMonth() + 1).padStart(2, '0');
        const ano = resultDate.getFullYear();
        return `${ano}-${mes}-${dia}`;
    }

    return dataString;
}

function normalizarHeader(chave) {
    return String(chave || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
}

function getCampo(obj, aliasesNormalizados) {
    for (const [key, value] of Object.entries(obj || {})) {
        const normalizada = normalizarHeader(key);
        if (aliasesNormalizados.includes(normalizada)) {
            return value;
        }
    }
    return '';
}

function parseNumero(valor) {
    if (typeof valor === 'number') return valor;
    const bruto = String(valor || '').trim();
    if (!bruto) return 0;

    const normalizado = bruto.includes(',')
        ? bruto.replace(/\./g, '').replace(',', '.')
        : bruto;

    const numero = parseFloat(normalizado);
    return Number.isFinite(numero) ? numero : 0;
}

function normalizarUsername(valor) {
    return String(valor || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9._-]/g, '');
}

function usernameValido(username) {
    return /^[a-z0-9._-]{3,32}$/.test(username);
}

function roleValido(role) {
    return ['admin', 'user', 'viewer'].includes(role);
}

async function gerarUsernameUnico(base) {
    const usernameBase = normalizarUsername(base) || 'usuario';
    let candidato = usernameBase;
    let sufixo = 1;

    while (true) {
        const existente = await dbGet('SELECT id FROM users WHERE username = ?', [candidato]);
        if (!existente) return candidato;
        sufixo += 1;
        candidato = `${usernameBase}${sufixo}`;
    }
}

async function garantirColunaUsername() {
    const colunas = await dbAll(
        "SELECT column_name AS name FROM information_schema.columns WHERE table_name = 'users' AND table_schema = current_schema()"
    );
    const temUsername = colunas.some((c) => c.name === 'username');

    if (!temUsername) {
        await dbRun('ALTER TABLE users ADD COLUMN username TEXT');
    }

    const semUsername = await dbAll("SELECT id, email FROM users WHERE username IS NULL OR TRIM(username) = ''");
    for (const user of semUsername) {
        const base = String(user.email || '').split('@')[0] || 'usuario';
        const unico = await gerarUsernameUnico(base);
        await dbRun('UPDATE users SET username = ? WHERE id = ?', [unico, user.id]);
    }

    await dbRun('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email)');
    await dbRun('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique ON users(username)');
}

async function garantirColunasControleUsuarios() {
    const colunas = await dbAll(
        "SELECT column_name AS name FROM information_schema.columns WHERE table_name = 'users' AND table_schema = current_schema()"
    );
    const temStatus = colunas.some((c) => c.name === 'status');
    const temApprovedBy = colunas.some((c) => c.name === 'approved_by');

    if (!temStatus) {
        await dbRun("ALTER TABLE users ADD COLUMN status TEXT");
        await dbRun("UPDATE users SET status = 'active' WHERE status IS NULL OR TRIM(status) = ''");
    }

    if (!temApprovedBy) {
        await dbRun('ALTER TABLE users ADD COLUMN approved_by INTEGER');
    }
}

async function inicializarBanco() {
    await dbRun(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            status TEXT NOT NULL DEFAULT 'active',
            approved_by INTEGER,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await dbRun(`
        CREATE TABLE IF NOT EXISTS sales (
            id SERIAL PRIMARY KEY,
            data TEXT NOT NULL,
            ecommerce TEXT NOT NULL,
            vendas INTEGER NOT NULL,
            receita NUMERIC(15,2) NOT NULL,
            created_by INTEGER,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            FOREIGN KEY(created_by) REFERENCES users(id)
        )
    `);

    await dbRun(`CREATE INDEX IF NOT EXISTS idx_sales_data ON sales(data)`);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_sales_ecommerce ON sales(ecommerce)`);

    await garantirColunaUsername();
    await garantirColunasControleUsuarios();

    const admin = await dbGet('SELECT id FROM users WHERE email = ?', [ADMIN_EMAIL]);
    if (!admin) {
        const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
        const adminUsernameNormalizado = normalizarUsername(ADMIN_USERNAME || 'admin');
        const adminUsername = await gerarUsernameUnico(adminUsernameNormalizado || 'admin');
        await dbRun(
            'INSERT INTO users (username, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)',
            [adminUsername, ADMIN_EMAIL, hash, 'admin', 'active']
        );
        console.log(`✅ Usuário admin criado: ${ADMIN_EMAIL}`);
    } else {
        await dbRun('UPDATE users SET role = ?, status = ? WHERE email = ?', ['admin', 'active', ADMIN_EMAIL]);
    }

    const contagemSales = await dbGet('SELECT COUNT(*)::int AS total FROM sales');
    if (!contagemSales || contagemSales.total === 0) {
        await migrarExcelParaBanco();
    }
}

async function migrarExcelParaBanco() {
    try {
        if (!fs.existsSync(EXCEL_FILE)) {
            return;
        }

        const workbook = XLSX.readFile(EXCEL_FILE);
        const worksheet = workbook.Sheets['Vendas'] || workbook.Sheets[workbook.SheetNames[0]];
        const dados = XLSX.utils.sheet_to_json(worksheet);

        if (!Array.isArray(dados) || dados.length === 0) {
            return;
        }

        for (const row of dados) {
            const data = converterData(getCampo(row, ['data']));
            const ecommerce = String(getCampo(row, ['ecommerce']) || '').trim();
            const vendas = parseInt(parseNumero(getCampo(row, ['vendas', 'quantidade'])), 10) || 0;
            const receita = parseNumero(getCampo(row, ['receita']));

            if (!data || !ecommerce) continue;

            await dbRun(
                'INSERT INTO sales (data, ecommerce, vendas, receita) VALUES (?, ?, ?, ?)',
                [data, ecommerce, vendas, receita]
            );
        }

        console.log('✅ Migração do Excel para SQLite concluída.');
    } catch (error) {
        console.error('Erro ao migrar Excel para banco:', error);
    }
}

function gerarToken(user) {
    return jwt.sign(
        { sub: user.id, username: user.username, email: user.email, role: user.role, status: user.status },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

function autenticarToken(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({ erro: 'Não autenticado' });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        return next();
    } catch (error) {
        return res.status(401).json({ erro: 'Token inválido ou expirado' });
    }
}

function autorizarRoles(...rolesPermitidos) {
    return (req, res, next) => {
        if (!req.user || !rolesPermitidos.includes(req.user.role)) {
            return res.status(403).json({ erro: 'Sem permissão para esta operação' });
        }
        return next();
    };
}

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitas tentativas. Tente novamente em alguns minutos.' }
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false
});

app.use(helmet({
    contentSecurityPolicy: false
}));
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: '2mb' }));
app.use(apiLimiter);
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.post('/api/auth/register', authLimiter, async (req, res) => {
    try {
        const usernameBruto = String(req.body.username || '');
        const username = normalizarUsername(usernameBruto);
        const email = String(req.body.email || '').trim().toLowerCase();
        const password = String(req.body.password || '');

        if (!username || !email || !password) {
            return res.status(400).json({ erro: 'Nome de usuário, e-mail e senha são obrigatórios' });
        }

        if (!usernameValido(username)) {
            return res.status(400).json({ erro: 'Nome de usuário inválido. Use 3-32 caracteres: letras, números, ponto, underline ou hífen.' });
        }

        if (!/^\S+@\S+\.\S+$/.test(email)) {
            return res.status(400).json({ erro: 'E-mail inválido' });
        }

        if (password.length < 8) {
            return res.status(400).json({ erro: 'A senha deve ter ao menos 8 caracteres' });
        }

        const usernameExistente = await dbGet('SELECT id FROM users WHERE username = ?', [username]);
        if (usernameExistente) {
            return res.status(409).json({ erro: 'Nome de usuário já cadastrado' });
        }

        const existente = await dbGet('SELECT id FROM users WHERE email = ?', [email]);
        if (existente) {
            return res.status(409).json({ erro: 'E-mail já cadastrado' });
        }

        const hash = await bcrypt.hash(password, 12);
        await dbRun(
            'INSERT INTO users (username, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)',
            [username, email, hash, 'user', 'pending']
        );

        return res.status(201).json({
            sucesso: true,
            mensagem: 'Cadastro recebido e aguardando aprovação do administrador.'
        });
    } catch (error) {
        console.error('Erro no registro:', error);
        return res.status(500).json({ erro: 'Erro interno ao registrar usuário' });
    }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
    try {
        const identifierRaw = String(req.body.identifier || req.body.email || '').trim();
        const identifierEmail = identifierRaw.toLowerCase();
        const identifierUsername = normalizarUsername(identifierRaw);
        const password = String(req.body.password || '');

        if (!identifierRaw || !password) {
            return res.status(400).json({ erro: 'Usuário ou e-mail e senha são obrigatórios' });
        }

        const user = await dbGet(
            'SELECT id, username, email, password_hash, role, status FROM users WHERE email = ? OR username = ?',
            [identifierEmail, identifierUsername]
        );
        if (!user) {
            return res.status(401).json({ erro: 'Credenciais inválidas' });
        }

        if (user.status !== 'active') {
            return res.status(403).json({ erro: 'Cadastro aguardando aprovação do administrador' });
        }

        const senhaOk = await bcrypt.compare(password, user.password_hash);
        if (!senhaOk) {
            return res.status(401).json({ erro: 'Credenciais inválidas' });
        }

        const token = gerarToken(user);
        return res.json({
            token,
            user: { id: user.id, username: user.username, email: user.email, role: user.role }
        });
    } catch (error) {
        console.error('Erro no login:', error);
        return res.status(500).json({ erro: 'Erro interno ao autenticar' });
    }
});

app.get('/api/auth/me', autenticarToken, async (req, res) => {
    const user = await dbGet('SELECT id, username, email, role, status FROM users WHERE id = ?', [req.user.sub]);
    if (!user) {
        return res.status(401).json({ erro: 'Usuário não encontrado' });
    }
    if (user.status !== 'active') {
        return res.status(403).json({ erro: 'Conta sem acesso ativo' });
    }
    return res.json({ user });
});

app.get('/api/admin/users', autenticarToken, autorizarRoles('admin'), async (req, res) => {
    try {
        const users = await dbAll(
            `SELECT id, username, email, role, status, created_at
             FROM users
             ORDER BY created_at DESC, id DESC`
        );
        return res.json({ users });
    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        return res.status(500).json({ erro: 'Erro ao listar usuários' });
    }
});

app.get('/api/admin/users/:id', autenticarToken, autorizarRoles('admin'), async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);

        if (!Number.isFinite(userId) || userId <= 0) {
            return res.status(400).json({ erro: 'ID inválido' });
        }

        const user = await dbGet(
            `SELECT id, username, email, role, status, created_at
             FROM users
             WHERE id = ?`,
            [userId]
        );

        if (!user) {
            return res.status(404).json({ erro: 'Usuário não encontrado' });
        }

        return res.json({ user });
    } catch (error) {
        console.error('Erro ao buscar usuário por ID:', error);
        return res.status(500).json({ erro: 'Erro ao buscar usuário' });
    }
});

app.patch('/api/admin/users/:id/approve', autenticarToken, autorizarRoles('admin'), async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);

        if (!Number.isFinite(userId) || userId <= 0) {
            return res.status(400).json({ erro: 'ID inválido' });
        }

        const alvo = await dbGet('SELECT id FROM users WHERE id = ?', [userId]);
        if (!alvo) {
            return res.status(404).json({ erro: 'Usuário não encontrado' });
        }

        await dbRun(
            'UPDATE users SET role = ?, status = ?, approved_by = ? WHERE id = ?',
            ['viewer', 'active', req.user.sub, userId]
        );

        return res.json({ sucesso: true });
    } catch (error) {
        console.error('Erro ao aprovar usuário:', error);
        return res.status(500).json({ erro: 'Erro ao aprovar usuário' });
    }
});

app.patch('/api/admin/users/:id/reject', autenticarToken, autorizarRoles('admin'), async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);

        if (!Number.isFinite(userId) || userId <= 0) {
            return res.status(400).json({ erro: 'ID inválido' });
        }

        await dbRun('UPDATE users SET status = ? WHERE id = ?', ['blocked', userId]);
        return res.json({ sucesso: true });
    } catch (error) {
        console.error('Erro ao recusar usuário:', error);
        return res.status(500).json({ erro: 'Erro ao recusar usuário' });
    }
});

app.patch('/api/admin/users/:id', autenticarToken, autorizarRoles('admin'), async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        const username = normalizarUsername(req.body.username || '');
        const email = String(req.body.email || '').trim().toLowerCase();
        const role = String(req.body.role || '').trim().toLowerCase();
        const status = String(req.body.status || '').trim().toLowerCase();

        if (!Number.isFinite(userId) || userId <= 0) {
            return res.status(400).json({ erro: 'ID inválido' });
        }

        if (!usernameValido(username)) {
            return res.status(400).json({ erro: 'Nome de usuário inválido' });
        }

        if (!/^\S+@\S+\.\S+$/.test(email)) {
            return res.status(400).json({ erro: 'E-mail inválido' });
        }

        if (!roleValido(role)) {
            return res.status(400).json({ erro: 'Perfil inválido' });
        }

        if (!['active', 'blocked', 'pending'].includes(status)) {
            return res.status(400).json({ erro: 'Status inválido' });
        }

        const existenteUsername = await dbGet('SELECT id FROM users WHERE username = ? AND id <> ?', [username, userId]);
        if (existenteUsername) {
            return res.status(409).json({ erro: 'Nome de usuário já em uso' });
        }

        const existenteEmail = await dbGet('SELECT id FROM users WHERE email = ? AND id <> ?', [email, userId]);
        if (existenteEmail) {
            return res.status(409).json({ erro: 'E-mail já em uso' });
        }

        await dbRun(
            'UPDATE users SET username = ?, email = ?, role = ?, status = ? WHERE id = ?',
            [username, email, role, status, userId]
        );

        return res.json({ sucesso: true });
    } catch (error) {
        console.error('Erro ao editar usuário:', error);
        return res.status(500).json({ erro: 'Erro ao editar usuário' });
    }
});

app.patch('/api/admin/users/:id/role', autenticarToken, autorizarRoles('admin'), async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        const role = String(req.body.role || '').trim().toLowerCase();

        if (!Number.isFinite(userId) || userId <= 0) {
            return res.status(400).json({ erro: 'ID inválido' });
        }

        if (!roleValido(role)) {
            return res.status(400).json({ erro: 'Perfil inválido' });
        }

        await dbRun('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
        return res.json({ sucesso: true });
    } catch (error) {
        console.error('Erro ao alterar perfil:', error);
        return res.status(500).json({ erro: 'Erro ao alterar perfil' });
    }
});

app.patch('/api/admin/users/:id/password', autenticarToken, autorizarRoles('admin'), async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        const newPassword = String(req.body.password || '');

        if (!Number.isFinite(userId) || userId <= 0) {
            return res.status(400).json({ erro: 'ID inválido' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ erro: 'A senha deve ter ao menos 8 caracteres' });
        }

        const hash = await bcrypt.hash(newPassword, 12);
        await dbRun('UPDATE users SET password_hash = ? WHERE id = ?', [hash, userId]);
        return res.json({ sucesso: true });
    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        return res.status(500).json({ erro: 'Erro ao alterar senha' });
    }
});

app.patch('/api/admin/users/:id/status', autenticarToken, autorizarRoles('admin'), async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        const status = String(req.body.status || '').trim().toLowerCase();

        if (!Number.isFinite(userId) || userId <= 0) {
            return res.status(400).json({ erro: 'ID inválido' });
        }

        if (!['active', 'blocked', 'pending'].includes(status)) {
            return res.status(400).json({ erro: 'Status inválido' });
        }

        await dbRun('UPDATE users SET status = ? WHERE id = ?', [status, userId]);
        return res.json({ sucesso: true });
    } catch (error) {
        console.error('Erro ao alterar status:', error);
        return res.status(500).json({ erro: 'Erro ao alterar status' });
    }
});

app.get('/api/dados', autenticarToken, autorizarRoles('admin', 'user'), async (req, res) => {
    try {
        const rows = await dbAll('SELECT id, data, ecommerce, vendas, receita FROM sales ORDER BY id ASC');
        const dados = rows.map((row) => ({
            Data: row.data,
            Ecommerce: row.ecommerce,
            Vendas: row.vendas,
            Receita: row.receita,
            _id: row.id
        }));
        res.json(dados);
    } catch (error) {
        console.error('Erro ao listar dados:', error);
        res.status(500).json({ erro: 'Erro ao buscar dados' });
    }
});

app.post('/api/dados', autenticarToken, autorizarRoles('admin'), async (req, res) => {
    try {
        const data = converterData(req.body.data);
        const ecommerce = String(req.body.ecommerce || '').trim();
        const vendas = parseInt(req.body.vendas, 10);
        const receita = parseFloat(req.body.receita);

        if (!data || !ecommerce || Number.isNaN(vendas) || Number.isNaN(receita)) {
            return res.status(400).json({ erro: 'Dados inválidos' });
        }

        await dbRun(
            'INSERT INTO sales (data, ecommerce, vendas, receita, created_by) VALUES (?, ?, ?, ?, ?)',
            [data, ecommerce, vendas, receita, req.user.sub]
        );

        return res.json({ sucesso: true, mensagem: 'Venda adicionada com sucesso!' });
    } catch (error) {
        console.error('Erro ao adicionar venda:', error);
        return res.status(500).json({ erro: 'Erro ao salvar dados' });
    }
});

app.delete('/api/dados/:index', autenticarToken, autorizarRoles('admin'), async (req, res) => {
    try {
        const index = parseInt(req.params.index, 10);
        if (Number.isNaN(index) || index < 0) {
            return res.status(400).json({ erro: 'Índice inválido' });
        }

        const rows = await dbAll('SELECT id FROM sales ORDER BY id ASC');
        if (index >= rows.length) {
            return res.status(400).json({ erro: 'Índice inválido' });
        }

        const rowId = rows[index].id;
        await dbRun('DELETE FROM sales WHERE id = ?', [rowId]);

        return res.json({ sucesso: true, mensagem: 'Venda deletada com sucesso!' });
    } catch (error) {
        console.error('Erro ao deletar venda:', error);
        return res.status(500).json({ erro: 'Erro ao deletar dados' });
    }
});

app.post('/api/importar', autenticarToken, autorizarRoles('admin'), express.raw({ type: 'application/octet-stream', limit: '50mb' }), async (req, res) => {
    try {
        if (!req.body || req.body.length === 0) {
            return res.status(400).json({ erro: 'Arquivo vazio' });
        }

        const workbook = XLSX.read(req.body, { type: 'buffer' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const dados = XLSX.utils.sheet_to_json(worksheet);

        for (const row of dados) {
            const data = converterData(getCampo(row, ['data']));
            const ecommerce = String(getCampo(row, ['ecommerce']) || '').trim();
            const vendas = parseInt(parseNumero(getCampo(row, ['vendas', 'quantidade'])), 10) || 0;
            const receita = parseNumero(getCampo(row, ['receita']));

            if (!data || !ecommerce) continue;

            await dbRun(
                'INSERT INTO sales (data, ecommerce, vendas, receita, created_by) VALUES (?, ?, ?, ?, ?)',
                [data, ecommerce, vendas, receita, req.user.sub]
            );
        }

        return res.json({ sucesso: true, mensagem: `${dados.length} registros importados com sucesso!` });
    } catch (error) {
        console.error('Erro na importação:', error);
        return res.status(400).json({ erro: 'Erro ao processar arquivo', detalhes: error.message });
    }
});

app.get('/api/vendas-dia-anterior', autenticarToken, async (req, res) => {
    try {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const ontem = new Date(hoje);
        ontem.setDate(hoje.getDate() - 1);

        const yyyy = ontem.getFullYear();
        const mm = String(ontem.getMonth() + 1).padStart(2, '0');
        const dd = String(ontem.getDate()).padStart(2, '0');
        const dataRef = `${yyyy}-${mm}-${dd}`;

        const itens = await dbAll(
            `SELECT ecommerce,
                    SUM(vendas) AS vendas,
                    SUM(receita) AS receita
             FROM sales
             WHERE data = ?
             GROUP BY ecommerce
             ORDER BY ecommerce ASC`,
            [dataRef]
        );

        const totalVendas = itens.reduce((acc, item) => acc + (Number(item.vendas) || 0), 0);
        const totalReceita = itens.reduce((acc, item) => acc + (Number(item.receita) || 0), 0);

        return res.json({
            dataReferencia: dataRef,
            totalVendas,
            totalReceita,
            itens: itens.map((item) => ({
                ecommerce: item.ecommerce,
                vendas: Number(item.vendas) || 0,
                receita: Number(item.receita) || 0
            }))
        });
    } catch (error) {
        console.error('Erro ao buscar vendas do dia anterior:', error);
        return res.status(500).json({ erro: 'Erro ao buscar vendas do dia anterior' });
    }
});

app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ erro: 'Recurso não encontrado' });
    }
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

inicializarBanco()
    .then(() => {
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`\n========================================`);
            console.log(`🚀 Servidor iniciado com sucesso!`);
            console.log(`📊 Abra em: http://localhost:${PORT}`);
            console.log(`🗄️  Banco PostgreSQL: ${(process.env.DATABASE_URL || '').replace(/:[^:@]+@/, ':***@')}`);
            console.log(`========================================\n`);
        });
    })
    .catch((error) => {
        console.error('Falha ao inicializar servidor:', error);
        process.exit(1);
    });
