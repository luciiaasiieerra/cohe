const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar Express para entender JSON y servir archivos estáticos (el frontend)
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Inicializar la base de datos SQLite
const db = new sqlite3.Database('./familia.db', (err) => {
    if (err) console.error("Error al abrir DB:", err);
    else console.log("Base de datos conectada.");
});

// Crear tablas y datos iniciales (Reglas de negocio)
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        car TEXT,
        user TEXT,
        destination TEXT,
        datetime TEXT
    )`);

    // Configuramos los permisos según lo que pediste
    db.run(`CREATE TABLE IF NOT EXISTS permissions (
        car TEXT,
        user TEXT
    )`);

    // Limpiamos y rellenamos permisos para asegurar que están bien
    db.run(`DELETE FROM permissions`);
    const perms = [
        ['Zafira', 'Mamá'], ['Zafira', 'Hermana'],
        ['Peugeot', 'Yo'], ['Peugeot', 'Hermana']
    ];
    const stmt = db.prepare(`INSERT INTO permissions (car, user) VALUES (?, ?)`);
    perms.forEach(p => stmt.run(p));
    stmt.finalize();
});

// --- RUTAS DE LA API ---

// 1. Obtener todas las reservas
app.get('/api/bookings', (req, res) => {
    db.all(`SELECT * FROM bookings ORDER BY datetime ASC`, [], (err, rows) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(rows);
    });
});

// 2. Obtener los permisos de los coches
app.get('/api/permissions', (req, res) => {
    db.all(`SELECT * FROM permissions`, [], (err, rows) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(rows);
    });
});

// 3. Crear una nueva reserva
app.post('/api/bookings', (req, res) => {
    const { car, user, destination, datetime } = req.body;
    
    // Verificación de seguridad en el backend
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

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor de AutoFamily corriendo en el puerto ${PORT}`);
});