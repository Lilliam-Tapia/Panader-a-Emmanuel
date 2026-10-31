import { useState } from 'react';

const API = '/api/productos';

const formularioInicial = {
  NombreProducto: '',
  Descripcion: '',
  Precio: '',
  Existencia: '',
  StockMinimo: '5',
  FechaIngreso: '',
  FechaVencimiento: '',
};

export default function Productos({ onRegistrado }) {
  const [formulario, setFormulario] = useState(formularioInicial);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  function cambiarCampo(e) {
    const { name, value } = e.target;

    setFormulario((anterior) => ({
      ...anterior,
      [name]: value,
    }));
  }

  async function guardarProducto(e) {
    e.preventDefault();
    setError('');
    setMensaje('');

    const precio = Number(formulario.Precio);
    const existencia = Number(formulario.Existencia);
    const stockMinimo = Number(formulario.StockMinimo);

    if (!formulario.NombreProducto.trim()) {
      setError('Escribe el nombre del producto.');
      return;
    }

    if (!Number.isFinite(precio) || precio <= 0) {
      setError('El precio debe ser mayor que cero.');
      return;
    }

    if (!Number.isInteger(existencia) || existencia <= 0) {
      setError('La cantidad inicial debe ser un entero mayor que cero.');
      return;
    }

    if (!Number.isInteger(stockMinimo) || stockMinimo < 0) {
      setError('El stock mínimo debe ser un entero igual o mayor que cero.');
      return;
    }

    if (!formulario.FechaIngreso || !formulario.FechaVencimiento) {
      setError('Completa las fechas de ingreso y vencimiento.');
      return;
    }

    if (formulario.FechaVencimiento < formulario.FechaIngreso) {
      setError('El vencimiento no puede ser anterior al ingreso.');
      return;
    }

    const datos = {
      ...formulario,
      NombreProducto: formulario.NombreProducto.trim(),
      Descripcion: formulario.Descripcion.trim(),
      Precio: precio,
      Existencia: existencia,
      StockMinimo: stockMinimo,
    };

    try {
      setCargando(true);

      const respuesta = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });

      const resultado = await respuesta.json().catch(() => ({}));

      if (!respuesta.ok) {
        throw new Error(
          resultado.mensaje ||
          resultado.error ||
          'No se pudo registrar el producto.'
        );
      }

      setFormulario({ ...formularioInicial });
      setMensaje(
        'Producto registrado correctamente. Ya puedes consultarlo en Inventario.'
      );

      if (onRegistrado) {
        await onRegistrado();
      }
    } catch (e) {
      setError(e.message || 'Ocurrió un error al registrar el producto.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <section className="products-section">
      {/* ENCABEZADO DESTACADO */}
      <div className="product-form-heading">
        <div className="product-form-heading-content">
          <div className="product-form-heading-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="27"
              height="27"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 3 3.5 7.5 12 12l8.5-4.5L12 3Z" />
              <path d="M3.5 7.5V16.5L12 21l8.5-4.5V7.5" />
              <path d="M12 12v9" />
              <path d="M17 3v6" />
              <path d="M14 6h6" />
            </svg>
          </div>

          <div>
            <h2>Registrar producto</h2>
            <p>Añade un producto y registra su existencia inicial.</p>
          </div>
        </div>

        <div className="product-form-heading-divider" />
      </div>

      {/* MENSAJES */}
      {error && (
        <div className="alert alert-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            aria-label="Cerrar mensaje de error"
          >
            ×
          </button>
        </div>
      )}

      {mensaje && (
        <div className="alert alert-success" role="status">
          <span>{mensaje}</span>
          <button
            type="button"
            onClick={() => setMensaje('')}
            aria-label="Cerrar mensaje de confirmación"
          >
            ×
          </button>
        </div>
      )}

      {/* FORMULARIO */}
      <div className="panel product-form-panel">
        <div className="panel-header">
          <div>
            <h2>Datos del producto</h2>
            <p>Los campos marcados con * son obligatorios.</p>
          </div>
        </div>

        <form className="product-form" onSubmit={guardarProducto}>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="NombreProducto">
                Nombre del producto *
              </label>
              <input
                id="NombreProducto"
                name="NombreProducto"
                type="text"
                value={formulario.NombreProducto}
                onChange={cambiarCampo}
                placeholder="Ej. Pan francés"
                maxLength={100}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="Precio">Precio de venta (C$) *</label>
              <input
                id="Precio"
                name="Precio"
                type="number"
                min="0.01"
                step="0.01"
                value={formulario.Precio}
                onChange={cambiarCampo}
                placeholder="0.00"
                required
              />
            </div>

            <div className="form-group form-group-full">
              <label htmlFor="Descripcion">Descripción</label>
              <textarea
                id="Descripcion"
                name="Descripcion"
                value={formulario.Descripcion}
                onChange={cambiarCampo}
                placeholder="Describe brevemente el producto"
                rows={3}
              />
            </div>

            <div className="form-group">
              <label htmlFor="Existencia">Cantidad inicial *</label>
              <input
                id="Existencia"
                name="Existencia"
                type="number"
                min="1"
                step="1"
                value={formulario.Existencia}
                onChange={cambiarCampo}
                placeholder="Ej. 50"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="StockMinimo">Stock mínimo *</label>
              <input
                id="StockMinimo"
                name="StockMinimo"
                type="number"
                min="0"
                step="1"
                value={formulario.StockMinimo}
                onChange={cambiarCampo}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="FechaIngreso">Fecha de ingreso *</label>
              <input
                id="FechaIngreso"
                name="FechaIngreso"
                type="date"
                value={formulario.FechaIngreso}
                onChange={cambiarCampo}
                max={formulario.FechaVencimiento || undefined}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="FechaVencimiento">
                Fecha de vencimiento *
              </label>
              <input
                id="FechaVencimiento"
                name="FechaVencimiento"
                type="date"
                value={formulario.FechaVencimiento}
                onChange={cambiarCampo}
                min={formulario.FechaIngreso || undefined}
                required
              />
            </div>
          </div>

          <div className="form-note">
            <span aria-hidden="true"></span>
            <p>
              Al registrar el producto, también se creará su existencia
              inicial y el primer lote con las fechas indicadas.
            </p>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary"
              disabled={cargando}
              onClick={() => {
                setFormulario({ ...formularioInicial });
                setError('');
                setMensaje('');
              }}
            >
              Limpiar formulario
            </button>

            <button
              type="submit"
              className="btn-primary"
              disabled={cargando}
            >
              {cargando ? 'Guardando...' : 'Registrar producto'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

