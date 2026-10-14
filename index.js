
const express = require('express');

const app = express();
const PORT = 3000;

// Permite recibir datos en formato JSON
app.use(express.json());

// Arreglo que simula una base de datos
let productos = [
    {
        id: 1,
        nombre: 'Laptop',
        precio: 12500,
        categoria: 'Computacion'
    },
    {
        id: 2,
        nombre: 'Mouse',
        precio: 350,
        categoria: 'Accesorios'
    },
    {
        id: 3,
        nombre: 'Teclado',
        precio: 650,
        categoria: 'Accesorios'
    }
];

// Ruta principal
app.get('/', (req, res) => {
    res.status(200).send('Servidor API REST en linea');
});

// 1. GET: consultar todos los productos
app.get('/api/productos', (req, res) => {
    res.status(200).json(productos);
});

// 2. GET: consultar un producto por ID
app.get('/api/productos/:id', (req, res) => {
    const id = Number(req.params.id);

    const producto = productos.find(p => p.id === id);

    if (!producto) {
        return res.status(404).json({
            mensaje: 'Producto no encontrado'
        });
    }

    res.status(200).json(producto);
});

// 3. POST: registrar un nuevo producto
app.post('/api/productos', (req, res) => {
    const { nombre, precio, categoria } = req.body;

    if (
        typeof nombre !== 'string' ||
        !nombre.trim() ||
        typeof precio !== 'number' ||
        !Number.isFinite(precio) ||
        precio < 0 ||
        typeof categoria !== 'string' ||
        !categoria.trim()
    ) {
        return res.status(400).json({
            mensaje: 'Envie nombre, precio numerico y categoria validos'
        });
    }

    const nuevoId = productos.length > 0
        ? Math.max(...productos.map(p => p.id)) + 1
        : 1;

    const nuevoProducto = {
        id: nuevoId,
        nombre: nombre.trim(),
        precio,
        categoria: categoria.trim()
    };

    productos.push(nuevoProducto);

    res.status(201).json(nuevoProducto);
});

// 4. PUT: actualizar un producto existente
app.put('/api/productos/:id', (req, res) => {
    const id = Number(req.params.id);

    const indice = productos.findIndex(p => p.id === id);

    if (indice === -1) {
        return res.status(404).json({
            mensaje: 'Producto no encontrado'
        });
    }

    const { nombre, precio, categoria } = req.body;

    if (
        typeof nombre !== 'string' ||
        !nombre.trim() ||
        typeof precio !== 'number' ||
        !Number.isFinite(precio) ||
        precio < 0 ||
        typeof categoria !== 'string' ||
        !categoria.trim()
    ) {
        return res.status(400).json({
            mensaje: 'Envie nombre, precio numerico y categoria validos'
        });
    }

    const productoActualizado = {
        id,
        nombre: nombre.trim(),
        precio,
        categoria: categoria.trim()
    };

    productos[indice] = productoActualizado;

    res.status(200).json(productoActualizado);
});

// 5. DELETE: eliminar un producto
app.delete('/api/productos/:id', (req, res) => {
    const id = Number(req.params.id);

    const indice = productos.findIndex(p => p.id === id);

    if (indice === -1) {
        return res.status(404).json({
            mensaje: 'Producto no encontrado'
        });
    }

    productos.splice(indice, 1);

    res.status(200).json({
        mensaje: 'Producto eliminado correctamente',
        id: id
    });
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor ejecutandose en http://localhost:${PORT}`);
});
