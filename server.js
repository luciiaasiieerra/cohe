const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Inicializar la base de datos
const db = new sqlite3.Database('./familia.db', (err) => {
    if (err) console.error("Error al abrir DB:", err);
});

db.serialize(() => {
    // Tabla de reservas
    db.run(`CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        car TEXT,
        user TEXT,
        destination TEXT,
        datetime TEXT
    )`);

    // Tabla de permisos (Seguros)
    db.run(`CREATE TABLE IF NOT EXISTS permissions (
        car TEXT,
        user TEXT
    )`);

    // Actualizamos los permisos con vuestros nombres reales
    db.run(`DELETE FROM permissions`);
    const perms = [
        ['Zafira', 'Yolanda'], ['Zafira', 'Alba'], // Zafira: Mamá y Hermana
        ['Peugeot', 'Lucia'], ['Peugeot', 'Alba']  // Peugeot: Tú y Hermana
    ];
    const stmt = db.prepare(`INSERT INTO permissions (car, user) VALUES (?, ?)`);
    perms.forEach(p => stmt.run(p));
    stmt.finalize();
});

// API para obtener reservas
app.get('/api/bookings', (req, res) => {
    db.all(`SELECT * FROM bookings ORDER BY datetime ASC`, [], (err, rows) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(rows);
    });
});

// API para obtener permisos
app.get('/api/permissions', (req, res) => {
    db.all(`SELECT * FROM permissions`, [], (err, rows) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(rows);
    });
});

// API para crear reserva
app.post('/api/bookings', (req, res) => {
    const { car, user, destination, datetime } = req.body;
    
    db.get(`SELECT * FROM permissions WHERE car = ? AND user = ?`, [car, user], (err, row) => {
        if (!row) {
            return res.status(403).json({ error: "No estás en el seguro de este coche." });
        }
        
        db.run(`INSERT INTO bookings (car, user, destination, datetime) VALUES (?, ?, ?, ?)`, 
            [car, user, destination, datetime], 
            function(err) {
                if (err) res.status(500).json({ error: err.message });
                else res.json({ id: this.lastID, car, user, destination, datetime });
            }
        );
    });
});

app.listen(PORT, () => {
    console.log(`Servidor de AutoFamily en puerto ${PORT}`);
});