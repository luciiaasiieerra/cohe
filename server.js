const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// CONEXIÓN A SUPABASE
// ¡OJO! Sustituye la URL de abajo por la tuya y pon tu contraseña real sin los corchetes []
const pool = new Pool({
  connectionString: "postgresql://postgres:f30042004J.1234@db.scsqndkrqskeqflwsuom.supabase.co:5432/postgres", 
  ssl: { rejectUnauthorized: false }
});

// Configuración para leer JSON y servir la carpeta "public"
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Crear las tablas y establecer las reglas si no existen (ahora en la nube)
async function initDB() {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS bookings (
            id SERIAL PRIMARY KEY,
            car TEXT,
            user_name TEXT,
            destination TEXT,
            datetime TEXT
        )`);
        
        await pool.query(`CREATE TABLE IF NOT EXISTS permissions (
            car TEXT,
            user_name TEXT
        )`);

        // Reset de permisos con las reglas que pediste para la familia
        await pool.query(`DELETE FROM permissions`);
        await pool.query(`INSERT INTO permissions (car, user_name) VALUES 
            ('Zafira', 'Yolanda'), ('Peugeot', 'Yolanda'),
            ('Zafira', 'Alba'), ('Peugeot', 'Lucia')`);
            
        console.log("Base de datos conectada a Supabase y reglas familiares actualizadas.");
    } catch (error) {
        console.error("Error conectando a la base de datos:", error);
    }
}

initDB();

// --- RUTAS DE LA API ---

// 1. Obtener todas las reservas (para mostrar en el Inicio)
app.get('/api/bookings', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM bookings ORDER BY datetime ASC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Obtener la lista de permisos (para que el frontend sepa quién conduce qué)
app.get('/api/permissions', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM permissions');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Crear una nueva reserva (incluye verificación de seguro en el servidor)
app.post('/api/bookings', async (req, res) => {
    const { car, user, destination, datetime } = req.body;
    
    try {
        // Verificamos en la base de datos si el usuario tiene permiso para ese coche
        const perm = await pool.query('SELECT * FROM permissions WHERE car = $1 AND user_name = $2', [car, user]);

        if (perm.rows.length === 0) {
            return res.status(403).json({ error: "Lo siento, no tienes permiso de seguro para este coche." });
        }

        // Si tiene permiso, guardamos la reserva permanentemente en Supabase
        await pool.query('INSERT INTO bookings (car, user_name, destination, datetime) VALUES ($1, $2, $3, $4)', 
            [car, user, destination, datetime]);
            
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor de AutoFamily corriendo en el puerto ${PORT}`);
});