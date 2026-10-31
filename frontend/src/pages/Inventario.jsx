import { useMemo, useState } from 'react';

const API = '/api/productos';

function fechaActual() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');

  return `${anio}-${mes}-${dia}`;
}

function formatoFecha(fecha) {
  if (!fecha) return '—';

  const valor = String(fecha).slice(0, 10);
  const partes = valor.split('-');

  if (partes.length !== 3) return valor;

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function formatoPrecio(precio) {
  return `C$ ${Number(precio || 0).toFixed(2)}`;
}

function normalizarTexto(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function estadoLote(lote) {
  if (Number(lote.CantidadDisponible) <= 0) {
    return 'Agotado';
  }

  if (lote.EstadoVencimiento) {
    return lote.EstadoVencimiento;
  }

  if (!lote.FechaVencimiento) {
    return 'Sin fecha';
  }

  const vencimiento = new Date(
    `${String(lote.FechaVencimiento).slice(0, 10)}T00:00:00`
  );

  const hoy = new Date(`${fechaActual()}T00:00:00`);
  const dias = Math.ceil((vencimiento - hoy) / 86400000);

  if (dias < 0) return 'Vencido';
  if (dias <= 3) return 'Proximo a vencer';

  return 'Vigente';
}

function claseEstado(estado) {
  if (estado === 'Vencido') {
    return 'status-badge status-expired';
  }

  if (normalizarTexto(estado) === 'proximo a vencer') {
    return 'status-badge status-soon';
  }

  if (estado === 'Vigente') {
    return 'status-badge status-valid';
  }

  if (estado === 'Agotado') {
    return 'status-badge status-empty';
  }

  return 'status-badge';
}

function Buscador({
  busqueda,
  setBusqueda,
  placeholder,
  etiqueta,
}) {
  return (
    <div className="custom-search">
      <span className="custom-search-icon" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="16.65" y1="16.65" x2="21" y2="21" />
        </svg>
      </span>

      <input
        type="text"
        placeholder={placeholder}
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        aria-label={etiqueta}
      />
    </div>
  );
}

export default function Inventario({
  esAdministrador = false,
  productos = [],
  lotes = [],
  cargando = false,
  actualizarDatos,
  iniciarEdicion,
  desactivarProducto,
  productoEditando,
  setProductoEditando,
  cambiarEdicion,
  guardarEdicion,
}) {
  const [busquedaLotes, setBusquedaLotes] = useState('');
  const [busquedaProductos, setBusquedaProductos] = useState('');

  const [mostrarFormularioLote, setMostrarFormularioLote] =
    useState(false);

  const [guardandoLote, setGuardandoLote] = useState(false);
  const [errorLote, setErrorLote] = useState('');
  const [mensajeLote, setMensajeLote] = useState('');

  const [nuevoLote, setNuevoLote] = useState({
    IdProducto: '',
    Cantidad: '',
    FechaIngreso: fechaActual(),
    FechaVencimiento: '',
  });

  const productosFiltrados = useMemo(() => {
    const termino = normalizarTexto(busquedaProductos);

    return productos.filter((producto) =>
      normalizarTexto(
        `${producto.NombreProducto || ''} ${
          producto.Descripcion || ''
        }`
      ).includes(termino)
    );
  }, [productos, busquedaProductos]);

  const lotesFiltrados = useMemo(() => {
    const termino = normalizarTexto(busquedaLotes);

    return lotes.filter((lote) =>
      normalizarTexto(
        `${lote.NombreProducto || ''} ${
          lote.IdLote ?? ''
        } ${estadoLote(lote)}`
      ).includes(termino)
    );
  }, [lotes, busquedaLotes]);

  const totalProductos = productos.length;

  const totalUnidades = productos.reduce(
    (total, producto) =>
      total + Number(producto.Existencia || 0),
    0
  );

  const stockBajo = productos.filter(
    (producto) =>
      Number(producto.Existencia || 0) <=
      Number(producto.StockMinimo || 0)
  ).length;

  const lotesPorVencer = lotes.filter(
    (lote) =>
      normalizarTexto(estadoLote(lote)) === 'proximo a vencer'
  ).length;

  const lotesVencidos = lotes.filter(
    (lote) => estadoLote(lote) === 'Vencido'
  ).length;

  function cerrarEdicion() {
    setProductoEditando?.(null);
  }

  function cambiarCampoLote(e) {
    const { name, value } = e.target;

    setNuevoLote((actual) => ({
      ...actual,
      [name]: value,
    }));
  }

  function abrirFormularioLote() {
    setErrorLote('');
    setMensajeLote('');

    setNuevoLote({
      IdProducto: '',
      Cantidad: '',
      FechaIngreso: fechaActual(),
      FechaVencimiento: '',
    });

    setMostrarFormularioLote(true);
  }

  function cancelarFormularioLote() {
    if (guardandoLote) return;

    setMostrarFormularioLote(false);
    setErrorLote('');
    setMensajeLote('');

    setNuevoLote({
      IdProducto: '',
      Cantidad: '',
      FechaIngreso: fechaActual(),
      FechaVencimiento: '',
    });
  }

  async function registrarLote(e) {
    e.preventDefault();

    setErrorLote('');
    setMensajeLote('');

    const idProducto = Number(nuevoLote.IdProducto);
    const cantidad = Number(nuevoLote.Cantidad);

    if (!idProducto) {
      setErrorLote('Selecciona un producto.');
      return;
    }

    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      setErrorLote(
        'La cantidad debe ser un número entero mayor que cero.'
      );
      return;
    }

    if (!nuevoLote.FechaIngreso) {
      setErrorLote('Ingresa la fecha de ingreso.');
      return;
    }

    if (
      nuevoLote.FechaVencimiento &&
      nuevoLote.FechaVencimiento < nuevoLote.FechaIngreso
    ) {
      setErrorLote(
        'La fecha de vencimiento no puede ser anterior a la fecha de ingreso.'
      );
      return;
    }

    try {
      setGuardandoLote(true);

      const respuesta = await fetch(`${API}/lotes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          IdProducto: idProducto,
          Cantidad: cantidad,
          FechaIngreso: nuevoLote.FechaIngreso,
          FechaVencimiento:
            nuevoLote.FechaVencimiento || null,
        }),
      });

      const resultado = await respuesta
        .json()
        .catch(() => ({}));

      if (!respuesta.ok) {
        throw new Error(
          resultado.mensaje ||
            resultado.error ||
            'No fue posible registrar la entrada de inventario.'
        );
      }

      setMensajeLote(
        'La entrada de inventario se registró correctamente.'
      );

      setNuevoLote({
        IdProducto: '',
        Cantidad: '',
        FechaIngreso: fechaActual(),
        FechaVencimiento: '',
      });

      if (actualizarDatos) {
        await actualizarDatos();
      }
    } catch (error) {
      setErrorLote(
        error.message ||
          'Ocurrió un error al registrar la entrada de inventario.'
      );
    } finally {
      setGuardandoLote(false);
    }
  }

  return (
    <section className="section-content">

      {/* ENCABEZADO */}
      <div className="section-intro">
        <div>
          <h2>Control de inventario</h2>
          <p>
            Consulta las existencias, revisa los lotes y administra
            los productos de la panadería.
          </p>
        </div>
      </div>

      {/* ESTADÍSTICAS */}
      <div className="stats-grid">

        <div className="stat-card">
          <span className="stat-label">
            Productos registrados
          </span>

          <strong>{totalProductos}</strong>

          <span className="stat-description">
            Productos en el sistema
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">
            Unidades disponibles
          </span>

          <strong>{totalUnidades}</strong>

          <span className="stat-description">
            Existencia total registrada
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">
            Stock bajo
          </span>

          <strong>{stockBajo}</strong>

          <span className="stat-description">
            Productos en su mínimo o por debajo
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">
            Próximos a vencer
          </span>

          <strong>{lotesPorVencer}</strong>

          <span className="stat-description">
            Lotes que vencen en los próximos 3 días
          </span>
        </div>

      </div>

      {/* ========================================= */}
      {/* REGISTRAR ENTRADA DE INVENTARIO */}
      {/* ========================================= */}

      <div className="panel">

        <div className="panel-header inventory-header">
          <div>
            <h3>Entradas de inventario</h3>
          </div>

          {!mostrarFormularioLote && (
            <button
              type="button"
              className="btn-primary"
              onClick={abrirFormularioLote}
            >
              + Registrar entrada
            </button>
          )}
        </div>

        {mensajeLote && (
          <div className="alert alert-success" role="status">
            {mensajeLote}
          </div>
        )}

        {errorLote && (
          <div className="alert alert-error" role="alert">
            {errorLote}
          </div>
        )}

        {mostrarFormularioLote && (
          <form
            className="edit-product-form"
            onSubmit={registrarLote}
          >

            {/* PRODUCTO */}
            <div className="edit-form-field">

              <label htmlFor="lote-producto">
                Producto
              </label>

              <select
                id="lote-producto"
                name="IdProducto"
                value={nuevoLote.IdProducto}
                onChange={cambiarCampoLote}
                required
                disabled={productos.length === 0}
              >
                <option value="">
                  Selecciona un producto
                </option>

                {productos.map((producto) => (
                  <option
                    key={producto.IdProducto}
                    value={producto.IdProducto}
                  >
                    {producto.NombreProducto}
                  </option>
                ))}
              </select>

              {productos.length === 0 && (
                <small>
                  No hay productos registrados.
                </small>
              )}

            </div>

            {/* CANTIDAD */}
            <div className="edit-form-field">

              <label htmlFor="lote-cantidad">
                Cantidad que ingresa
              </label>

              <input
                id="lote-cantidad"
                name="Cantidad"
                type="number"
                min="1"
                step="1"
                value={nuevoLote.Cantidad}
                onChange={cambiarCampoLote}
                placeholder="Ej. 50"
                required
              />

            </div>

            {/* FECHA DE INGRESO */}
            <div className="edit-form-field">

              <label htmlFor="lote-fecha-ingreso">
                Fecha de ingreso
              </label>

              <input
                id="lote-fecha-ingreso"
                name="FechaIngreso"
                type="date"
                value={nuevoLote.FechaIngreso}
                onChange={cambiarCampoLote}
                required
              />

            </div>

            {/* FECHA DE VENCIMIENTO */}
            <div className="edit-form-field">

              <label htmlFor="lote-fecha-vencimiento">
                Fecha de vencimiento
              </label>

              <input
                id="lote-fecha-vencimiento"
                name="FechaVencimiento"
                type="date"
                min={nuevoLote.FechaIngreso || undefined}
                value={nuevoLote.FechaVencimiento}
                onChange={cambiarCampoLote}
              />

              <small>
                Si el producto no tiene fecha de vencimiento,
                puedes dejarla vacía.
              </small>

            </div>

            {/* BOTONES DEL FORMULARIO */}
            <div className="edit-form-actions">

              <button
                type="button"
                className="btn-secondary"
                onClick={cancelarFormularioLote}
                disabled={guardandoLote}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="btn-primary"
                disabled={
                  guardandoLote ||
                  productos.length === 0
                }
              >
                {guardandoLote
                  ? 'Registrando...'
                  : 'Guardar entrada'}
              </button>

            </div>

          </form>
        )}

      </div>

      {/* ========================================= */}
      {/* EXISTENCIAS POR LOTE */}
      {/* ========================================= */}

      <div className="panel">

        <div className="panel-header inventory-header">

          <div>
            <h3>Existencias por lote</h3>

            <p>
              Consulta las cantidades y fechas de vencimiento.
            </p>
          </div>

          <Buscador
            busqueda={busquedaLotes}
            setBusqueda={setBusquedaLotes}
            placeholder="Buscar producto, lote o estado..."
            etiqueta="Buscar producto, lote o estado"
          />

        </div>

        {/* LEYENDA */}
        <div className="status-legend">

          <span>
            <i className="status-dot legend-valid" />
            Vigente
          </span>

          <span>
            <i className="status-dot legend-soon" />
            Próximo a vencer
          </span>

          <span>
            <i className="status-dot legend-expired" />
            Vencido
          </span>

          <span>
            <i className="status-dot legend-empty" />
            Agotado
          </span>

        </div>

        {/* TABLA */}
        <div className="table-container">

          <table className="data-table">

            <thead>
              <tr>
                <th>Lote</th>
                <th>Producto</th>
                <th>Precio</th>
                <th>Existencia del lote</th>
                <th>Existencia total</th>
                <th>Stock mínimo</th>
                <th>Ingreso</th>
                <th>Vencimiento</th>
                <th>Estado</th>
              </tr>
            </thead>

            <tbody>

              {cargando ? (

                <tr>
                  <td
                    colSpan="9"
                    className="empty-table"
                  >
                    Cargando inventario...
                  </td>
                </tr>

              ) : lotesFiltrados.length === 0 ? (

                <tr>
                  <td
                    colSpan="9"
                    className="empty-table"
                  >
                    No se encontraron lotes registrados.
                  </td>
                </tr>

              ) : (

                lotesFiltrados.map((lote, indice) => {

                  const estado = estadoLote(lote);

                  return (
                    <tr
                      key={lote.IdLote ?? indice}
                    >

                      <td>
                        {lote.IdLote ?? '—'}
                      </td>

                      <td>
                        {lote.NombreProducto || '—'}
                      </td>

                      <td>
                        {formatoPrecio(lote.Precio)}
                      </td>

                      <td>
                        {lote.CantidadDisponible ?? 0}
                      </td>

                      <td>
                        {lote.Existencia ?? 0}
                      </td>

                      <td>
                        {lote.StockMinimo ?? 0}
                      </td>

                      <td>
                        {formatoFecha(lote.FechaIngreso)}
                      </td>

                      <td>
                        {formatoFecha(
                          lote.FechaVencimiento
                        )}
                      </td>

                      <td>
                        <span
                          className={claseEstado(estado)}
                        >
                          {estado}
                        </span>
                      </td>

                    </tr>
                  );
                })

              )}

            </tbody>

          </table>

        </div>

        {lotesVencidos > 0 && (
          <div className="alert alert-error">

            <span>
              Atención: hay {lotesVencidos} lote(s) vencido(s).
              Revisa su estado antes de utilizarlos o venderlos.
            </span>

          </div>
        )}

      </div>

      {/* ========================================= */}
      {/* ADMINISTRAR PRODUCTOS */}
      {/* ========================================= */}

      <div className="panel">

        <div className="panel-header">

          <div>

            <h3>Administrar productos</h3>

            <p>
              {esAdministrador
                ? 'Consulta, edita o desactiva productos.'
                : 'Consulta los productos registrados y sus precios.'}
            </p>

          </div>

        </div>

        <div className="product-search">

          <Buscador
            busqueda={busquedaProductos}
            setBusqueda={setBusquedaProductos}
            placeholder="Buscar producto por nombre o descripción..."
            etiqueta="Buscar producto por nombre o descripción"
          />

        </div>

        <div className="table-container">

          <table className="data-table">

            <thead>

              <tr>
                <th>Producto</th>
                <th>Descripción</th>
                <th>Precio</th>

                {esAdministrador && (
                  <th>Acciones</th>
                )}

              </tr>

            </thead>

            <tbody>

              {productosFiltrados.length === 0 ? (

                <tr>

                  <td
                    colSpan={
                      esAdministrador ? 4 : 3
                    }
                    className="empty-table"
                  >
                    No se encontraron productos.
                  </td>

                </tr>

              ) : (

                productosFiltrados.map((producto) => (

                  <tr key={producto.IdProducto}>

                    <td>
                      {producto.NombreProducto}
                    </td>

                    <td>
                      {producto.Descripcion || '—'}
                    </td>

                    <td>
                      {formatoPrecio(producto.Precio)}
                    </td>

                    {esAdministrador && (

                      <td>

                        <div className="product-actions">

                          <button
                            type="button"
                            className="btn-edit"
                            onClick={() =>
                              iniciarEdicion?.(producto)
                            }
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            className="btn-delete"
                            onClick={() =>
                              desactivarProducto?.(
                                producto
                              )
                            }
                          >
                            Desactivar
                          </button>

                        </div>

                      </td>

                    )}

                  </tr>

                ))

              )}

            </tbody>

          </table>

        </div>

      </div>

      {/* ========================================= */}
      {/* MODAL DE EDICIÓN */}
      {/* ========================================= */}

      {esAdministrador && productoEditando && (

        <div
          className="modal-overlay"
          onClick={cerrarEdicion}
        >

          <div
            className="modal-content modal-edit-product"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-editar-producto"
          >

            <div className="edit-modal-header">

              <div className="edit-modal-heading">

                <h3 id="titulo-editar-producto">
                  Editar producto
                </h3>

                <p>
                  Modifica los datos del producto seleccionado.
                </p>

              </div>

              <button
                type="button"
                className="modal-close"
                onClick={cerrarEdicion}
                aria-label="Cerrar ventana"
              >
                ×
              </button>

            </div>

            <form
              className="edit-product-form"
              onSubmit={(e) => {
                e.preventDefault();
                guardarEdicion?.(e);
              }}
            >

              {/* NOMBRE */}
              <div className="edit-form-field">

                <label htmlFor="editar-nombre">
                  Nombre del producto
                </label>

                <input
                  id="editar-nombre"
                  name="NombreProducto"
                  type="text"
                  value={
                    productoEditando.NombreProducto || ''
                  }
                  onChange={(e) =>
                    cambiarEdicion?.(
                      'NombreProducto',
                      e.target.value
                    )
                  }
                  required
                />

              </div>

              {/* DESCRIPCIÓN */}
              <div className="edit-form-field">

                <label htmlFor="editar-descripcion">
                  Descripción
                </label>

                <textarea
                  id="editar-descripcion"
                  name="Descripcion"
                  value={
                    productoEditando.Descripcion || ''
                  }
                  onChange={(e) =>
                    cambiarEdicion?.(
                      'Descripcion',
                      e.target.value
                    )
                  }
                  rows={3}
                />

              </div>

              {/* PRECIO */}
              <div className="edit-form-field">

                <label htmlFor="editar-precio">
                  Precio (C$)
                </label>

                <input
                  id="editar-precio"
                  name="Precio"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={
                    productoEditando.Precio ?? ''
                  }
                  onChange={(e) =>
                    cambiarEdicion?.(
                      'Precio',
                      e.target.value
                    )
                  }
                  required
                />

              </div>

              {/* BOTONES */}
              <div className="edit-form-actions">

                <button
                  type="submit"
                  className="btn-primary"
                >
                  Guardar cambios
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </section>
  );
}