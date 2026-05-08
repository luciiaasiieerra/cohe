const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración para leer JSON y servir la carpeta "public"
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Inicializar la base de datos SQLite (se guarda en un archivo local)
const db = new sqlite3.Database('./familia.db', (err) => {
    if (err) console.error("Error al abrir la base de datos:", err);
    else console.log("Base de datos conectada correctamente.");
});

// Configuración inicial de las tablas y las reglas de seguro
db.serialize(() => {
    // Crear tabla de reservas
    db.run(`CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        car TEXT,
        user TEXT,
        destination TEXT,
        datetime TEXT
    )`);

    // Crear tabla de permisos (seguros)
    db.run(`CREATE TABLE IF NOT EXISTS permissions (
        car TEXT,
        user TEXT
    )`);

    // Actualizamos las reglas específicas que pediste:
    // Lucía -> Peugeot | Alba -> Zafira | Yolanda -> Ambos
    db.run(`DELETE FROM permissions`);
    const perms = [
        ['Zafira', 'Yolanda'], ['Peugeot', 'Yolanda'], // Yolanda: Ambos
        ['Zafira', 'Alba'],                            // Alba: Solo Zafira
        ['Peugeot', 'Lucia']                           // Lucía: Solo Peugeot
    ];
    
    const stmt = db.prepare(`INSERT INTO permissions (car, user) VALUES (?, ?)`);
    perms.forEach(p => stmt.run(p));
    stmt.finalize();
    console.log("Reglas de seguro actualizadas.");
});

// --- RUTAS DE LA API ---

// 1. Obtener todas las reservas (para mostrar en el Inicio)
app.get('/api/bookings', (req, res) => {
    db.all(`SELECT * FROM bookings ORDER BY datetime ASC`, [], (err, rows) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(rows);
    });
});

// 2. Obtener la lista de permisos (para que el frontend sepa quién puede conducir qué)
app.get('/api/permissions', (req, res) => {
    db.all(`SELECT * FROM permissions`, [], (err, rows) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(rows);
    });
});

// 3. Crear una nueva reserva (incluye verificación de seguro en el servidor)
app.post('/api/bookings', (req, res) => {
    const { car, user, destination, datetime } = req.body;
    
    // Verificamos si el usuario tiene permiso para ese coche antes de guardar
    db.get(`SELECT * FROM permissions WHERE car = ? AND user = ?`, [car, user], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (!row) {
            return res.status(403).json({ error: "Lo siento, no tienes permiso de seguro para este coche." });
        }
        
        // Si tiene permiso, guardamos la reserva
        db.run(`INSERT INTO bookings (car, user, destination, datetime) VALUES (?, ?, ?, ?)`, 
            [car, user, destination, datetime], 
            function(err) {
                if (err) res.status(500).json({ error: err.message });
                else res.json({ id: this.lastID, car, user, destination, datetime });
            }
        );
    });
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor de AutoFamily corriendo en el puerto ${PORT}`);
});