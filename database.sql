
CREATE DATABASE IF NOT EXISTS api_practica;

USE api_practica;

CREATE TABLE IF NOT EXISTS productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    precio DECIMAL(10, 2) NOT NULL,
    categoria VARCHAR(60) NOT NULL
);

INSERT INTO productos (nombre, precio, categoria)
VALUES
    ('Laptop', 12500.00, 'Computadoras'),
    ('Mouse', 250.00, 'Accesorios'),
    ('Teclado', 450.00, 'Accesorios');

SELECT * FROM productos;
