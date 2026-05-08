const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: "postgresql://postgres:f30042004J.1234@db.scsqndkrqskeqflwsuom.supabase.co:5432/postgres", // <--- TU URL AQUÍ
  ssl: { rejectUnauthorized: false }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function initDB() {
    try {
        // 1. Crear tablas
        await pool.query(`CREATE TABLE IF NOT EXISTS bookings (id SERIAL PRIMARY KEY, car TEXT, user_name TEXT, destination TEXT, datetime TEXT)`);
        await pool.query(`CREATE TABLE IF NOT EXISTS permissions (car TEXT, user_name TEXT)`);

        // 2. Limpiar y Re-insertar permisos exactos
        await pool.query(`DELETE FROM permissions`);
        await pool.query(`INSERT INTO permissions (car, user_name) VALUES 
            ('Zafira', 'Yolanda'), 
            ('Peugeot', 'Yolanda'),
            ('Zafira', 'Alba'), 
            ('Peugeot', 'Lucia')`);
        
        console.log("✅ Permisos cargados: Lucia(Peugeot), Alba(Zafira), Yolanda(Ambos)");
    } catch (err) {
        console.error("❌ Error en initDB:", err);
    }
}
initDB();

app.get('/api/bookings', async (req, res) => {
    const result = await pool.query('SELECT * FROM bookings ORDER BY id DESC');
    res.json(result.rows);
});

app.get('/api/permissions', async (req, res) => {
    const result = await pool.query('SELECT * FROM permissions');
    res.json(result.rows);
});

app.post('/api/bookings', async (req, res) => {
    const { car, user, destination, datetime } = req.body;
    try {
        const check = await pool.query('SELECT * FROM permissions WHERE car = $1 AND user_name = $2', [car, user]);
        if (check.rows.length === 0) return res.status(403).json({ error: "No autorizado" });
        
        await pool.query('INSERT INTO bookings (car, user_name, destination, datetime) VALUES ($1, $2, $3, $4)', [car, user, destination, datetime]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => console.log(`🚀 App en puerto ${PORT}`));