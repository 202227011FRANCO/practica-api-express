
require('dotenv').config();

const express = require('express');
const pool = require('./config/db');
const cors = require('cors');

const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Parser } = require('json2csv');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 1. CONFIGURACIONES GENERALES
// ==========================================

app.use(cors());
app.use(express.json());

// Crear carpeta uploads si no existe
const carpetaUploads = path.join(__dirname, 'uploads');

if (!fs.existsSync(carpetaUploads)) {
    fs.mkdirSync(carpetaUploads, { recursive: true });
}

// ==========================================
// 2. CONFIGURACION DE MULTER
// ==========================================

const almacenamiento = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, carpetaUploads);
    },

    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname).toLowerCase();

        cb(
            null,
            `${Date.now()}-${crypto.randomUUID()}${extension}`
        );
    }
});

const upload = multer({
    storage: almacenamiento,

    limits: {
        fileSize: 5 * 1024 * 1024
    },

    fileFilter: (req, file, cb) => {
        const extension = path.extname(file.originalname).toLowerCase();

        if (extension !== '.json' && extension !== '.csv') {
            return cb(
                new Error('Formato no permitido. Utiliza archivos JSON o CSV.')
            );
        }

        cb(null, true);
    }
});

// ==========================================
// 3. FUNCIONES AUXILIARES
// ==========================================

// Eliminar archivo temporal
function eliminarArchivo(ruta) {
    if (ruta && fs.existsSync(ruta)) {
        fs.unlinkSync(ruta);
    }
}

// Validar estructura de los productos
function validarProductos(productos) {
    if (!Array.isArray(productos) || productos.length === 0) {
        throw new Error('El archivo no contiene registros validos.');
    }

    return productos.map((producto, indice) => {
        const nombre = producto.nombre;
        const categoria = producto.categoria;
        const precio = producto.precio;

        if (
            typeof nombre !== 'string' ||
            !nombre.trim() ||
            typeof categoria !== 'string' ||
            !categoria.trim() ||
            precio === undefined ||
            precio === null ||
            String(precio).trim() === '' ||
            !Number.isFinite(Number(precio)) ||
            Number(precio) < 0
        ) {
            throw new Error(
                `El registro ${indice + 1} contiene datos invalidos.`
            );
        }

        return [
            nombre.trim(),
            Number(precio),
            categoria.trim()
        ];
    });
}

// Leer archivo CSV mediante un stream
function leerCSV(ruta) {
    return new Promise((resolve, reject) => {
        const registros = [];

        fs.createReadStream(ruta)
            .pipe(csv({
                mapHeaders: ({ header }) => header.trim().toLowerCase()
            }))
            .on('data', (fila) => {
                registros.push(fila);
            })
            .on('end', () => {
                resolve(registros);
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}

// Insertar registros por lotes utilizando una transaccion
async function insertarLote(registros) {
    const conexion = await pool.getConnection();

    try {
        await conexion.beginTransaction();

        const tamanoLote = 500;

        for (let i = 0; i < registros.length; i += tamanoLote) {
            const lote = registros.slice(i, i + tamanoLote);

            const valores = lote.map(() => '(?, ?, ?)').join(', ');

            const datos = lote.flat();

            await conexion.execute(
                `INSERT INTO productos (nombre, precio, categoria)
                 VALUES ${valores}`,
                datos
            );
        }

        await conexion.commit();

        return registros.length;

    } catch (error) {
        await conexion.rollback();
        throw error;

    } finally {
        conexion.release();
    }
}

// ==========================================
// 4. RUTA PRINCIPAL
// ==========================================

app.get('/', (req, res) => {
    res.status(200).json({
        mensaje: 'Servidor API REST en linea',

        endpoints: [
            'GET /api/productos',
            'GET /api/productos/:id',
            'POST /api/productos',
            'PUT /api/productos/:id',
            'DELETE /api/productos/:id',
            'POST /api/productos/importar',
            'GET /api/productos/exportar/json',
            'GET /api/productos/exportar/csv'
        ]
    });
});

// ==========================================
// 5. CRUD DE PRODUCTOS
// ==========================================

// GET: consultar todos los productos
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

// GET: consultar un producto por ID
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

// POST: registrar un nuevo producto
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

// PUT: actualizar un producto existente
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

// DELETE: eliminar un producto
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

// ==========================================
// 6. IMPORTACION DE ARCHIVOS JSON Y CSV
// ==========================================

app.post('/api/productos/importar', (req, res) => {

    upload.single('archivo')(req, res, async (error) => {

        if (error) {
            const codigo = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;

            return res.status(codigo).json({
                mensaje: error.message
            });
        }

        if (!req.file) {
            return res.status(400).json({
                mensaje: 'Debes adjuntar un archivo en el campo archivo'
            });
        }

        const rutaArchivo = req.file.path;

        try {
            const extension = path.extname(
                req.file.originalname
            ).toLowerCase();

            let productos = [];

            // Importacion JSON
            if (extension === '.json') {

                const contenido = fs.readFileSync(
                    rutaArchivo,
                    'utf8'
                );

                productos = JSON.parse(contenido);

            }

            // Importacion CSV
            else if (extension === '.csv') {

                productos = await leerCSV(rutaArchivo);

            }

            else {
                return res.status(400).json({
                    mensaje: 'Formato de archivo no permitido'
                });
            }

            // Validar registros antes de insertarlos
            const registros = validarProductos(productos);

            // Insertar todos los registros
            const total = await insertarLote(registros);

            res.status(200).json({
                mensaje: 'Importacion realizada correctamente',
                formato: extension.replace('.', ''),
                registros_insertados: total
            });

        } catch (error) {
            console.error('Error al importar archivo:', error.message);

            const errorJSON = error instanceof SyntaxError;

            res.status(errorJSON ? 400 : 500).json({
                mensaje: errorJSON
                    ? 'El archivo JSON contiene un formato incorrecto'
                    : error.message
            });

        } finally {
            // Eliminar archivo temporal
            eliminarArchivo(rutaArchivo);
        }
    });
});

// ==========================================
// 7. EXPORTACION JSON Y CSV
// ==========================================

app.get('/api/productos/exportar/:formato', async (req, res) => {

    try {
        const formato = req.params.formato.toLowerCase();

        // Consultar todos los productos
        const [productos] = await pool.execute(
            'SELECT * FROM productos ORDER BY id ASC'
        );

        // Exportacion JSON
        if (formato === 'json') {

            res.setHeader(
                'Content-Disposition',
                'attachment; filename=datos_exportados.json'
            );

            res.setHeader(
                'Content-Type',
                'application/json; charset=utf-8'
            );

            return res.status(200).json(productos);
        }

        // Exportacion CSV
        if (formato === 'csv') {

            const parser = new Parser({
                fields: ['id', 'nombre', 'precio', 'categoria']
            });

            const csvData = parser.parse(productos);

            res.setHeader(
                'Content-Disposition',
                'attachment; filename=datos_exportados.csv'
            );

            res.setHeader(
                'Content-Type',
                'text/csv; charset=utf-8'
            );

            return res.status(200).send('\uFEFF' + csvData);
        }

        // Formato no valido
        return res.status(400).json({
            mensaje: 'Formato no valido. Utiliza json o csv.'
        });

    } catch (error) {
        console.error('Error al exportar productos:', error.message);

        res.status(500).json({
            mensaje: 'Error interno al exportar los productos'
        });
    }
});

// ==========================================
// 8. INICIAR SERVIDOR
// ==========================================

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
