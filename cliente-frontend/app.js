
const API_URL = 'http://localhost:3000/api/productos';

const tablaProductos = document.getElementById('tablaProductos');
const totalProductos = document.getElementById('totalProductos');
const precioPromedio = document.getElementById('precioPromedio');
const estado = document.getElementById('estado');
const btnActualizar = document.getElementById('btnActualizar');

let graficaProductos = null;

// Formatear cantidades como moneda mexicana.
function formatoMoneda(valor) {
    return Number(valor).toLocaleString('es-MX', {
        style: 'currency',
        currency: 'MXN'
    });
}

// Consultar la API y actualizar la interfaz.
async function cargarProductos() {
    btnActualizar.disabled = true;
    estado.classList.remove('error');
    estado.textContent = 'Consultando los productos...';

    try {
        const respuesta = await fetch(API_URL);

        // Verificar si el servidor respondió correctamente.
        if (!respuesta.ok) {
            throw new Error(
                `Error HTTP ${respuesta.status}: ${respuesta.statusText}`
            );
        }

        const datos = await respuesta.json();

        // La ruta GET debe devolver un arreglo de productos.
        // También se admite un arreglo dentro de la propiedad "data".
        const productos = Array.isArray(datos)
            ? datos
            : datos.data;

        if (!Array.isArray(productos)) {
            throw new Error(
                'La API no devolvió una lista de productos válida.'
            );
        }

        // Guardar y presentar los datos recibidos.
        mostrarProductos(productos);
        actualizarResumen(productos);
        crearGrafica(productos);

        estado.textContent =
            `Consulta exitosa. Se encontraron ${productos.length} producto(s).`;

    } catch (error) {
        console.error('Error al consultar la API:', error);

        estado.textContent =
            `No fue posible cargar los datos. ${error.message}`;

        estado.classList.add('error');

        tablaProductos.replaceChildren();

        const fila = document.createElement('tr');
        const celda = document.createElement('td');

        celda.colSpan = 4;
        celda.textContent =
            'No se pudieron obtener los productos. Verifica el backend y MySQL.';

        fila.appendChild(celda);
        tablaProductos.appendChild(fila);

        totalProductos.textContent = '—';
        precioPromedio.textContent = '—';

        // Evitar mostrar una gráfica anterior como si fuera actual.
        if (graficaProductos) {
            graficaProductos.destroy();
            graficaProductos = null;
        }

    } finally {
        btnActualizar.disabled = false;
    }
}

// Generar las filas de la tabla de forma dinámica.
function mostrarProductos(productos) {
    tablaProductos.replaceChildren();

    if (productos.length === 0) {
        const fila = document.createElement('tr');
        const celda = document.createElement('td');

        celda.colSpan = 4;
        celda.textContent = 'No hay productos registrados.';

        fila.appendChild(celda);
        tablaProductos.appendChild(fila);
        return;
    }

    productos.forEach((producto) => {
        const fila = document.createElement('tr');

        const valores = [
            producto.id,
            producto.nombre,
            producto.categoria,
            formatoMoneda(producto.precio)
        ];

        valores.forEach((valor) => {
            const celda = document.createElement('td');
            celda.textContent = valor ?? 'Sin información';
            fila.appendChild(celda);
        });

        tablaProductos.appendChild(fila);
    });
}

// Calcular indicadores generales de los productos.
function actualizarResumen(productos) {
    const precios = productos.map(
        (producto) => Number(producto.precio)
    );

    const sumaPrecios = precios.reduce(
        (acumulado, precio) => acumulado + precio,
        0
    );

    const promedio = productos.length > 0
        ? sumaPrecios / productos.length
        : 0;

    totalProductos.textContent = productos.length;
    precioPromedio.textContent = formatoMoneda(promedio);
}

// Construir una gráfica utilizando Chart.js.
function crearGrafica(productos) {
    const canvas = document.getElementById('graficaProductos');

    // Destruir la gráfica anterior para evitar duplicarla.
    if (graficaProductos) {
        graficaProductos.destroy();
    }

    const nombres = productos.map(
        (producto) => producto.nombre
    );

    const precios = productos.map(
        (producto) => Number(producto.precio)
    );

    graficaProductos = new Chart(canvas, {
        type: 'bar',

        data: {
            labels: nombres,

            datasets: [{
                label: 'Precio del producto (MXN)',
                data: precios,
                backgroundColor: 'rgba(37, 99, 235, 0.70)',
                borderColor: 'rgb(29, 78, 216)',
                borderWidth: 1,
                borderRadius: 5
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },

                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return formatoMoneda(context.raw);
                        }
                    }
                }
            },

            scales: {
                y: {
                    beginAtZero: true,

                    ticks: {
                        callback: function (valor) {
                            return formatoMoneda(valor);
                        }
                    },

                    title: {
                        display: true,
                        text: 'Precio en pesos mexicanos'
                    }
                },

                x: {
                    title: {
                        display: true,
                        text: 'Productos'
                    }
                }
            }
        }
    });
}

// Permitir que el usuario actualice los datos manualmente.
btnActualizar.addEventListener('click', cargarProductos);

// Primera consulta al abrir la página.
cargarProductos();
