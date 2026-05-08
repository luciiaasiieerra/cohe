const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// CONEXIÓN A NEON
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_p7kZ0WFLcEnH@ep-green-rice-apzkp36u.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require", // <--- ⚠️ RECUERDA PEGAR TU URL AQUÍ
  ssl: { rejectUnauthorized: false }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function initDB() {
    try {
        const client = await pool.connect();
        await client.query(`CREATE TABLE IF NOT EXISTS bookings (id SERIAL PRIMARY KEY, car TEXT, user_name TEXT, destination TEXT, datetime TEXT)`);
        await client.query(`CREATE TABLE IF NOT EXISTS permissions (car TEXT, user_name TEXT)`);

        await client.query(`DELETE FROM permissions`);
        await client.query(`INSERT INTO permissions (car, user_name) VALUES 
            ('Zafira', 'Yolanda'), ('Peugeot', 'Yolanda'),
            ('Zafira', 'Alba'), ('Peugeot', 'Lucia')`);
        client.release();
        console.log("✅ Tablas listas en Neon");
    } catch (err) {
        console.error("❌ Error de base de datos:", err.message);
    }
}
initDB();

// --- RUTAS API ---

app.get('/api/permissions', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM permissions');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/bookings', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM bookings ORDER BY datetime ASC'); // Ordenado por fecha
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// NUEVO VIAJE
app.post('/api/bookings', async (req, res) => {
    const { car, user, destination, datetime } = req.body;
    try {
        const check = await pool.query('SELECT * FROM permissions WHERE car = $1 AND user_name = $2', [car, user]);
        if (check.rows.length === 0) return res.status(403).json({ error: "No autorizado" });
        
        await pool.query('INSERT INTO bookings (car, user_name, destination, datetime) VALUES ($1, $2, $3, $4)', [car, user, destination, datetime]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// MODIFICAR VIAJE EXISTENTE (EDITAR)
app.put('/api/bookings/:id', async (req, res) => {
    const { car, user, destination, datetime } = req.body;
    try {
        const check = await pool.query('SELECT * FROM permissions WHERE car = $1 AND user_name = $2', [car, user]);
        if (check.rows.length === 0) return res.status(403).json({ error: "No autorizado para cambiar a este coche" });
        
        await pool.query('UPDATE bookings SET car = $1, user_name = $2, destination = $3, datetime = $4 WHERE id = $5', 
            [car, user, destination, datetime, req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// BORRAR VIAJE (ELIMINAR)
app.delete('/api/bookings/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM bookings WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => console.log(`🚀 App en puerto ${PORT}`));