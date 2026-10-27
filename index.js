
require('dotenv').config();

const express = require('express');
const pool = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Permite recibir datos JSON
app.use(express.json());

// Ruta principal
app.get('/', (req, res) => {
    res.status(200).json({
        mensaje: 'Servidor API REST en linea',
        endpoints: [
            'GET /api/productos',
            'GET /api/productos/:id',
            'POST /api/productos',
            'PUT /api/productos/:id',
            'DELETE /api/productos/:id'
        ]
    });
});

// 1. GET: consultar todos los productos
app.get('/api/productos', async (req, res) => {
    try {
        const [productos] = await pool.execute(
            'SELECT * FROM productos'
        );

        res.status(200).json(productos);
    } catch (error) {
        console.error('Error al consultar productos:', error.message);

        res.status(500).json({
            mensaje: 'Error interno al consultar los productos'
        });
    }
});

// 2. GET: consultar un producto por ID
app.get('/api/productos/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                mensaje: 'El ID debe ser un entero positivo'
            });
        }

        const [productos] = await pool.execute(
            'SELECT * FROM productos WHERE id = ?',
            [id]
        );

        if (productos.length === 0) {
            return res.status(404).json({
                mensaje: 'Producto no encontrado'
            });
        }

        res.status(200).json(productos[0]);
    } catch (error) {
        console.error('Error al consultar producto:', error.message);

        res.status(500).json({
            mensaje: 'Error interno al consultar el producto'
        });
    }
});

// 3. POST: registrar un nuevo producto
app.post('/api/productos', async (req, res) => {
    try {
        const { nombre, precio, categoria } = req.body;

        if (
            typeof nombre !== 'string' ||
            !nombre.trim() ||
            typeof categoria !== 'string' ||
            !categoria.trim() ||
            precio === '' ||
            precio === null ||
            precio === undefined ||
            !Number.isFinite(Number(precio)) ||
            Number(precio) < 0
        ) {
            return res.status(400).json({
                mensaje: 'Envia nombre, precio numerico y categoria validos'
            });
        }

        const [resultado] = await pool.execute(
            `INSERT INTO productos (nombre, precio, categoria)
             VALUES (?, ?, ?)`,
            [nombre.trim(), Number(precio), categoria.trim()]
        );

        const [productos] = await pool.execute(
            'SELECT * FROM productos WHERE id = ?',
            [resultado.insertId]
        );

        res.status(201).json({
            mensaje: 'Producto registrado correctamente',
            producto: productos[0]
        });
    } catch (error) {
        console.error('Error al registrar producto:', error.message);

        res.status(500).json({
            mensaje: 'Error interno al registrar el producto'
        });
    }
});

// 4. PUT: actualizar un producto existente
app.put('/api/productos/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                mensaje: 'El ID debe ser un entero positivo'
            });
        }

        const { nombre, precio, categoria } = req.body;

        if (
            typeof nombre !== 'string' ||
            !nombre.trim() ||
            typeof categoria !== 'string' ||
            !categoria.trim() ||
            precio === '' ||
            precio === null ||
            precio === undefined ||
            !Number.isFinite(Number(precio)) ||
            Number(precio) < 0
        ) {
            return res.status(400).json({
                mensaje: 'Envia nombre, precio numerico y categoria validos'
            });
        }

        const [existentes] = await pool.execute(
            'SELECT id FROM productos WHERE id = ?',
            [id]
        );

        if (existentes.length === 0) {
            return res.status(404).json({
                mensaje: 'Producto no encontrado'
            });
        }

        await pool.execute(
            `UPDATE productos
             SET nombre = ?, precio = ?, categoria = ?
             WHERE id = ?`,
            [nombre.trim(), Number(precio), categoria.trim(), id]
        );

        const [productos] = await pool.execute(
            'SELECT * FROM productos WHERE id = ?',
            [id]
        );

        res.status(200).json({
            mensaje: 'Producto actualizado correctamente',
            producto: productos[0]
        });
    } catch (error) {
        console.error('Error al actualizar producto:', error.message);

        res.status(500).json({
            mensaje: 'Error interno al actualizar el producto'
        });
    }
});

// 5. DELETE: eliminar un producto
app.delete('/api/productos/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                mensaje: 'El ID debe ser un entero positivo'
            });
        }

        const [resultado] = await pool.execute(
            'DELETE FROM productos WHERE id = ?',
            [id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensaje: 'Producto no encontrado'
            });
        }

        res.status(200).json({
            mensaje: 'Producto eliminado correctamente',
            id: id
        });
    } catch (error) {
        console.error('Error al eliminar producto:', error.message);

        res.status(500).json({
            mensaje: 'Error interno al eliminar el producto'
        });
    }
});

// Iniciar el servidor después de verificar la conexión
async function iniciarServidor() {
    let conexion;

    try {
        conexion = await pool.getConnection();
        await conexion.ping();

        console.log('Conectado exitosamente a la base de datos');
    } catch (error) {
        console.error('Error al conectar con MySQL:', error.message);

        await pool.end().catch(() => {});
        process.exitCode = 1;
        return;
    } finally {
        if (conexion) {
            conexion.release();
        }
    }

    app.listen(PORT, () => {
        console.log(
            `Servidor ejecutandose en http://localhost:${PORT}`
        );
    });
}

iniciarServidor();
