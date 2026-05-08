const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ⚠️ PON TU URL DE NEON AQUÍ
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_p7kZ0WFLcEnH@ep-green-rice-apzkp36u.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require", 
  ssl: { rejectUnauthorized: false }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function initDB() {
    try {
        const client = await pool.connect();
        
        await client.query(`CREATE TABLE IF NOT EXISTS bookings (
            id SERIAL PRIMARY KEY, car TEXT, user_name TEXT, 
            destination TEXT, datetime TEXT
        )`);
        
        await client.query(`CREATE TABLE IF NOT EXISTS permissions (
            car TEXT, user_name TEXT
        )`);

        // NUEVO: Añadimos la columna de pasajeros sin borrar lo anterior
        try {
            await client.query(`ALTER TABLE bookings ADD COLUMN passengers TEXT DEFAULT ''`);
        } catch (e) { /* La columna ya existe, todo bien */ }

        // IMPORTANTE: Ya NO borramos los permisos. 
        // Solo metemos los básicos si la tabla está completamente vacía (la primera vez).
        const permCheck = await client.query('SELECT count(*) FROM permissions');
        if (parseInt(permCheck.rows[0].count) === 0) {
            await client.query(`INSERT INTO permissions (car, user_name) VALUES 
                ('Zafira', 'Yolanda'), ('Peugeot', 'Yolanda'),
                ('Zafira', 'Alba'), ('Peugeot', 'Lucia')`);
        }
        
        client.release();
        console.log("✅ Servidor y base de datos listos");
    } catch (err) {
        console.error("❌ Error DB:", err.message);
    }
}
initDB();

// --- RUTAS API ---

// LEER PERMISOS
app.get('/api/permissions', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM permissions');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// MODIFICAR PERMISOS (SETTINGS)
app.put('/api/permissions', async (req, res) => {
    const { car, user, authorized } = req.body;
    try {
        if (authorized) {
            const check = await pool.query('SELECT * FROM permissions WHERE car=$1 AND user_name=$2', [car, user]);
            if (check.rows.length === 0) {
                await pool.query('INSERT INTO permissions (car, user_name) VALUES ($1, $2)', [car, user]);
            }
        } else {
            await pool.query('DELETE FROM permissions WHERE car=$1 AND user_name=$2', [car, user]);
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// LEER RESERVAS
app.get('/api/bookings', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM bookings ORDER BY datetime ASC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// CREAR RESERVA
app.post('/api/bookings', async (req, res) => {
    const { car, user, destination, datetime } = req.body;
    try {
        const check = await pool.query('SELECT * FROM permissions WHERE car = $1 AND user_name = $2', [car, user]);
        if (check.rows.length === 0) return res.status(403).json({ error: "Sin seguro" });
        
        await pool.query('INSERT INTO bookings (car, user_name, destination, datetime, passengers) VALUES ($1, $2, $3, $4, $5)', 
            [car, user, destination, datetime, '']);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// EDITAR RESERVA
app.put('/api/bookings/:id', async (req, res) => {
    const { car, user, destination, datetime } = req.body;
    try {
        const check = await pool.query('SELECT * FROM permissions WHERE car = $1 AND user_name = $2', [car, user]);
        if (check.rows.length === 0) return res.status(403).json({ error: "Sin seguro" });
        
        await pool.query('UPDATE bookings SET car=$1, user_name=$2, destination=$3, datetime=$4 WHERE id=$5', 
            [car, user, destination, datetime, req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// UNIRSE / SALIRSE DE UN VIAJE
app.post('/api/bookings/:id/join', async (req, res) => {
    const { user } = req.body;
    try {
        const b = await pool.query('SELECT passengers, user_name FROM bookings WHERE id=$1', [req.params.id]);
        if (b.rows.length === 0) return res.status(404).send("No encontrado");
        
        let passArr = b.rows[0].passengers ? b.rows[0].passengers.split(',').filter(Boolean) : [];
        
        if (passArr.includes(user)) {
            passArr = passArr.filter(u => u !== user); // Quitar
        } else {
            passArr.push(user); // Añadir
        }
        
        await pool.query('UPDATE bookings SET passengers=$1 WHERE id=$2', [passArr.join(','), req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// BORRAR RESERVA
app.delete('/api/bookings/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM bookings WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => console.log(`🚀 App en puerto ${PORT}`));