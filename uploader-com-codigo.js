const db = readDB();


// evita colisão simples
if (db[code]) {
// caso raro, tenta novamente (simples)
let tries = 0;
while (db[code] && tries < 5) { code = generateCode(); tries++; }
if (db[code]) return res.status(500).send('Erro ao gerar código, tente novamente.');
}


const expiresAt = Date.now() + hours * 60 * 60 * 1000;
db[code] = {
id: path.basename(req.file.filename),
originalName: req.file.originalname,
size: req.file.size,
mime: req.file.mimetype,
expiresAt,
oneTime,
createdAt: Date.now()
};


writeDB(db);


// RETORNE APENAS O CÓDIGO — NÃO o link
res.send(`<p>Arquivo enviado com sucesso.</p><p>Compartilhe apenas este código com a outra pessoa:</p><pre>${code}</pre>`);
});


// página /download
app.get('/download', (req, res) => {
res.send(`
<h2>Baixar por código</h2>
<form method="post">
<label>Código: <input name="code" required></label>
<button type="submit">Baixar</button>
</form>
`);
});


// ação de download
app.post('/download', (req, res) => {
const code = (req.body.code || '').trim();
const db = readDB();
const entry = db[code];
if (!entry) return res.status(404).send('<p>Código inválido ou expirado.</p>');


if (Date.now() > entry.expiresAt) {
// cleanup
try { fs.removeSync(path.join(UPLOAD_DIR, entry.id)); } catch (e) {}
delete db[code]; writeDB(db);
return res.status(404).send('<p>Arquivo expirado.</p>');
}


const filePath = path.join(UPLOAD_DIR, entry.id);
if (!fs.existsSync(filePath)) {
delete db[code]; writeDB(db);
return res.status(404).send('<p>Arquivo não encontrado.</p>');
}


// envia o arquivo como attachment
res.download(filePath, entry.originalName, (err) => {
if (err) {
console.error('Erro no download', err);
} else {
if (entry.oneTime) {
// remove após o download
try { fs.removeSync(filePath); } catch (e) {}
delete db[code]; writeDB(db);
}
}
});
});


// rota administrativa opcional para listar (apenas para desenvolvedor)
app.get('/_admin/list', (req, res) => {
const db = readDB();
res.json(db);
});


// rotina simples de limpeza de expirados
setInterval(() => {
const db = readDB();
let changed = false;
for (const code of Object.keys(db)) {
if (Date.now() > db[code].expiresAt) {
try { fs.removeSync(path.join(UPLOAD_DIR, db[code].id)); } catch (e) {}
delete db[code]; changed = true;
}
}
if (changed) writeDB(db);
}, 1000 * 60 * 10); // a cada 10 minutos


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));