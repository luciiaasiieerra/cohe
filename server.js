const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ⚠️ SUSTITUYE POR TU URL DE NEON
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_p7kZ0WFLcEnH@ep-green-rice-apzkp36u.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require", 
  ssl: { rejectUnauthorized: false }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function initDB() {
    try {
        const client = await pool.connect();
        
        // Tabla de reservas actualizada
        await client.query(`CREATE TABLE IF NOT EXISTS bookings (
            id SERIAL PRIMARY KEY, 
            car TEXT, 
            user_name TEXT, 
            destination TEXT, 
            datetime TEXT,
            return_datetime TEXT,
            recurrence TEXT DEFAULT 'none',
            passengers TEXT DEFAULT ''
        )`);
        
        await client.query(`CREATE TABLE IF NOT EXISTS permissions (car TEXT, user_name TEXT)`);

        // Migración automática por si las columnas no existen de versiones anteriores
        try { await client.query(`ALTER TABLE bookings ADD COLUMN return_datetime TEXT`); } catch(e){}
        try { await client.query(`ALTER TABLE bookings ADD COLUMN recurrence TEXT DEFAULT 'none'`); } catch(e){}

        client.release();
        console.log("✅ Servidor listo con soporte para vueltas y viajes permanentes");
    } catch (err) {
        console.error("❌ Error DB:", err.message);
    }
}
initDB();

// --- API ---

app.get('/api/permissions', async (req, res) => {
    const result = await pool.query('SELECT * FROM permissions');
    res.json(result.rows);
});

app.put('/api/permissions', async (req, res) => {
    const { car, user, authorized } = req.body;
    if (authorized) await pool.query('INSERT INTO permissions (car, user_name) SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE car=$1 AND user_name=$2)', [car, user]);
    else await pool.query('DELETE FROM permissions WHERE car=$1 AND user_name=$2', [car, user]);
    res.json({ success: true });
});

app.get('/api/bookings', async (req, res) => {
    const result = await pool.query('SELECT * FROM bookings ORDER BY datetime ASC');
    res.json(result.rows);
});

app.post('/api/bookings', async (req, res) => {
    const { car, user, destination, datetime, return_datetime, recurrence } = req.body;
    const check = await pool.query('SELECT * FROM permissions WHERE car = $1 AND user_name = $2', [car, user]);
    if (check.rows.length === 0) return res.status(403).json({ error: "Sin seguro" });
    
    await pool.query('INSERT INTO bookings (car, user_name, destination, datetime, return_datetime, recurrence) VALUES ($1, $2, $3, $4, $5, $6)', 
        [car, user, destination, datetime, return_datetime, recurrence]);
    res.json({ success: true });
});

app.put('/api/bookings/:id', async (req, res) => {
    const { car, user, destination, datetime, return_datetime, recurrence } = req.body;
    await pool.query('UPDATE bookings SET car=$1, user_name=$2, destination=$3, datetime=$4, return_datetime=$5, recurrence=$6 WHERE id=$7', 
        [car, user, destination, datetime, return_datetime, recurrence, req.params.id]);
    res.json({ success: true });
});

app.post('/api/bookings/:id/join', async (req, res) => {
    const { user } = req.body;
    const b = await pool.query('SELECT passengers FROM bookings WHERE id=$1', [req.params.id]);
    let passArr = b.rows[0].passengers ? b.rows[0].passengers.split(',').filter(Boolean) : [];
    if (passArr.includes(user)) passArr = passArr.filter(u => u !== user);
    else passArr.push(user);
    await pool.query('UPDATE bookings SET passengers=$1 WHERE id=$2', [passArr.join(','), req.params.id]);
    res.json({ success: true });
});

app.delete('/api/bookings/:id', async (req, res) => {
    await pool.query('DELETE FROM bookings WHERE id = $1', [req.params.id]);
    res.json({ success: true });
});

app.listen(PORT, () => console.log(`🚀 App en puerto ${PORT}`));