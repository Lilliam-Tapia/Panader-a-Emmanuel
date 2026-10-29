import { useCallback, useEffect, useState } from 'react';
import './App.css';

import Login from './pages/Login.jsx';
import Productos from './pages/Productos.jsx';
import Inventario from './pages/Inventario.jsx';
import Ventas from './pages/Ventas.jsx';

const API = 'http://localhost:3000/api/productos';

function fechaActual() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');

  return `${anio}-${mes}-${dia}`;
}

function estadoLote(lote) {
  if (Number(lote.CantidadDisponible) <= 0) return 'Agotado';

  if (lote.EstadoVencimiento) {
    return lote.EstadoVencimiento;
  }

  if (!lote.FechaVencimiento) return 'Sin fecha';

  const vencimiento = new Date(
    `${String(lote.FechaVencimiento).slice(0, 10)}T00:00:00`
  );
  const hoy = new Date(`${fechaActual()}T00:00:00`);
  const dias = Math.ceil((vencimiento - hoy) / 86400000);

  if (dias < 0) return 'Vencido';
  if (dias <= 3) return 'Proximo a vencer';

  return 'Vigente';
}

export default function App() {
  const [sesion, setSesion] = useState(null);
  const rol = sesion?.usuario?.rol;
  const esAdministrador = rol === 'Administrador';
  const esVendedor = rol === 'Vendedor';
  const [seccion, setSeccion] = useState('inicio');
  const [productos, setProductos] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [productoEditando, setProductoEditando] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  const cargarProductos = useCallback(async () => {
    try {
      const respuesta = await fetch(API);

      if (!respuesta.ok) {
        throw new Error('No se pudieron consultar los productos.');
      }

      const datos = await respuesta.json();
      setProductos(Array.isArray(datos) ? datos : []);
    } catch (e) {
      setError(e.message || 'Error al cargar los productos.');
    }
  }, []);

  const cargarLotes = useCallback(async () => {
    try {
      const respuesta = await fetch(`${API}/lotes`);

      if (!respuesta.ok) {
        throw new Error('No se pudo consultar el inventario.');
      }

      const datos = await respuesta.json();
      setLotes(Array.isArray(datos) ? datos : []);
    } catch (e) {
      setError(e.message || 'Error al cargar el inventario.');
    }
  }, []);

  const actualizarDatos = useCallback(async () => {
    setCargando(true);
    setError('');

    try {
      await Promise.all([cargarProductos(), cargarLotes()]);
    } finally {
      setCargando(false);
    }
  }, [cargarProductos, cargarLotes]);

    useEffect(() => {
    if (sesion) {
      actualizarDatos();
    }
  }, [sesion, actualizarDatos]);

  function iniciarEdicion(producto) {
    setProductoEditando({
      IdProducto: producto.IdProducto,
      NombreProducto: producto.NombreProducto || '',
      Descripcion: producto.Descripcion || '',
      Precio: producto.Precio ?? '',
    });

    setError('');
    setMensaje('');
  }

  function cambiarEdicion(campoOEvento, valor) {
    if (typeof campoOEvento === 'string') {
      setProductoEditando((anterior) =>
        anterior
          ? { ...anterior, [campoOEvento]: valor }
          : anterior
      );

      return;
    }

    const { name, value } = campoOEvento.target;

    setProductoEditando((anterior) =>
      anterior ? { ...anterior, [name]: value } : anterior
    );
  }

  async function guardarEdicion(e) {
    e?.preventDefault();

    if (!productoEditando) return;

    const precio = Number(productoEditando.Precio);

    if (
      !productoEditando.NombreProducto.trim() ||
      !Number.isFinite(precio) ||
      precio <= 0
    ) {
      setError('Escribe un nombre y un precio mayor que cero.');
      return;
    }

    try {
      setCargando(true);
      setError('');
      setMensaje('');

      const respuesta = await fetch(
        `${API}/${productoEditando.IdProducto}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            NombreProducto: productoEditando.NombreProducto.trim(),
            Descripcion: productoEditando.Descripcion.trim(),
            Precio: precio,
          }),
        }
      );

      const resultado = await respuesta.json().catch(() => ({}));

      if (!respuesta.ok) {
        throw new Error(
          resultado.mensaje ||
          resultado.error ||
          'No se pudo actualizar el producto.'
        );
      }

      setProductoEditando(null);
      setMensaje('Producto actualizado correctamente.');

      await actualizarDatos();
    } catch (e) {
      setError(e.message || 'Ocurrió un error al editar.');
    } finally {
      setCargando(false);
    }
  }

  async function desactivarProducto(producto) {
    const confirmar = window.confirm(
      `¿Deseas desactivar "${producto.NombreProducto}"? Ya no aparecerá como producto activo.`
    );

    if (!confirmar) return;

    try {
      setCargando(true);
      setError('');
      setMensaje('');

      const respuesta = await fetch(
        `${API}/${producto.IdProducto}/desactivar`,
        { method: 'PATCH' }
      );

      const resultado = await respuesta.json().catch(() => ({}));

      if (!respuesta.ok) {
        throw new Error(
          resultado.mensaje ||
          resultado.error ||
          'No se pudo desactivar el producto.'
        );
      }

      setMensaje('Producto desactivado correctamente.');
      setProductoEditando(null);

      await actualizarDatos();
    } catch (e) {
      setError(e.message || 'Ocurrió un error al desactivar el producto.');
    } finally {
      setCargando(false);
    }
  }

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

  const lotesVencidos = lotes.filter(
    (lote) => estadoLote(lote) === 'Vencido'
  ).length;

  const lotesPorVencer = lotes.filter(
    (lote) => estadoLote(lote) === 'Proximo a vencer'
  ).length;

  const lotesVigentes = lotes.filter(
    (lote) => estadoLote(lote) === 'Vigente'
  ).length;

  const menuCompleto = [
  { id: 'inicio', nombre: 'Inicio', icono: '⌂' },
  { id: 'ventas', nombre: 'Ventas', icono: '🛒' },
  { id: 'productos', nombre: 'Productos', icono: '📦' },
  { id: 'inventario', nombre: 'Inventario', icono: '▤' },
  { id: 'facturacion', nombre: 'Facturación', icono: '🧾' },
  { id: 'reportes', nombre: 'Reportes', icono: '▥' },
];

const menu = menuCompleto.filter((item) => {
  if (item.id === 'reportes') {
    return esAdministrador;
  }

  return true;
});

  function cambiarSeccion(id) {
    setSeccion(id);
    setError('');
    setMensaje('');
    setBusqueda('');
    setProductoEditando(null);
  }

   if (!sesion) {
  return (
    <Login
      onLogin={(datos) => {
        if (!datos?.token) {
          setError('El servidor no devolvió un token de sesión.');
          return;
        }

        localStorage.setItem('token', datos.token);
        setSesion(datos);
      }}
    />
  );
}

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo">PE</div>

          <div>
            <h2>Panadería</h2>
            <p>Emmanuel</p>
          </div>
        </div>

        <p className="sidebar-label">MENÚ PRINCIPAL</p>

        <nav className="sidebar-nav">
          {menu.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${
                seccion === item.id ? 'active' : ''
              }`}
              onClick={() => cambiarSeccion(item.id)}
            >
              <span className="nav-icon">{item.icono}</span>
              <span>{item.nombre}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <strong>Panadería Emmanuel</strong>
          <span>Sistema de ventas y facturación</span>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <h1>
              {menu.find((item) => item.id === seccion)?.nombre || 'Inicio'}
            </h1>
          
          </div>

        </header>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
            <button type="button" onClick={() => setError('')}>
              ×
            </button>
          </div>
        )}

        {mensaje && (
          <div className="alert alert-success" role="status">
            {mensaje}
            <button type="button" onClick={() => setMensaje('')}>
              ×
            </button>
          </div>
        )}

        {seccion === 'inicio' && (
          <section className="dashboard-section">
            <div className="welcome-panel">
              <div>
                <span className="eyebrow">PANEL PRINCIPAL</span>
                <h2>¡Bienvenido al sistema!</h2>
                <p>
                  Administra los productos, revisa el inventario y controla
                  las existencias de Panadería Emmanuel.
                </p>
              </div>

              <div className="welcome-icon">🥖</div>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-label">Productos registrados</span>
                <strong>{totalProductos}</strong>
                <span className="stat-description">Productos activos</span>
              </div>

              <div className="stat-card">
                <span className="stat-label">Existencias totales</span>
                <strong>{totalUnidades}</strong>
                <span className="stat-description">Unidades disponibles</span>
              </div>

              <div className="stat-card">
                <span className="stat-label">Stock bajo</span>
                <strong>{stockBajo}</strong>
                <span className="stat-description">Productos por revisar</span>
              </div>

              <div className="stat-card">
                <span className="stat-label">Lotes vencidos</span>
                <strong>{lotesVencidos}</strong>
                <span className="stat-description">Requieren atención</span>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2>Accesos rápidos</h2>
                  <p>Selecciona el módulo que necesitas utilizar.</p>
                </div>
              </div>

              <div className="quick-actions">
                <button
                  type="button"
                  className="quick-action"
                  onClick={() => cambiarSeccion('productos')}
                >
                  <span>＋</span>
                  <strong>Registrar producto</strong>
                  <small>Ingresar un producto nuevo</small>
                </button>

                <button
                  type="button"
                  className="quick-action"
                  onClick={() => cambiarSeccion('inventario')}
                >
                  <span>▤</span>
                  <strong>Consultar inventario</strong>
                  <small>Revisar existencias y vencimientos</small>
                </button>

                <button
                  type="button"
                  className="quick-action"
                  onClick={() => cambiarSeccion('ventas')}
                >
                  <span>🛒</span>
                  <strong>Ventas</strong>
                  <small>Ir al módulo de ventas</small>
                </button>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2>Alertas de inventario</h2>
                  <p>Resumen del estado de los lotes registrados.</p>
                </div>
              </div>

              <div className="alert-summary">
                <div className="alert-summary-item">
                  <span className="status-dot dot-expired" />
                  Lotes vencidos
                  <strong>{lotesVencidos}</strong>
                </div>

                <div className="alert-summary-item">
                  <span className="status-dot dot-soon" />
                  Próximos a vencer
                  <strong>{lotesPorVencer}</strong>
                </div>

                <div className="alert-summary-item">
                  <span className="status-dot dot-valid" />
                  Lotes vigentes
                  <strong>{lotesVigentes}</strong>
                </div>
              </div>
            </div>
          </section>
        )}

        {seccion === 'productos' && (
          <Productos onRegistrado={actualizarDatos} />
        )}

        
      {seccion === 'inventario' && (
   <Inventario
    esAdministrador={esAdministrador}
    productos={productos}
    lotes={lotes}
    cargando={cargando}
    actualizarDatos={actualizarDatos}
    busqueda={busqueda}
    setBusqueda={setBusqueda}
    iniciarEdicion={iniciarEdicion}
    desactivarProducto={desactivarProducto}
    productoEditando={productoEditando}
    setProductoEditando={setProductoEditando}
    cambiarEdicion={cambiarEdicion}
    guardarEdicion={guardarEdicion}
   />
    )}
     {seccion === 'ventas' && (
  <Ventas onVentaRegistrada={actualizarDatos} />
)}
        

{['facturacion', 'reportes'].includes(seccion) && (
  <section className="panel placeholder-panel">
    <div className="placeholder-icon">
      {seccion === 'facturacion' ? '🧾' : '▥'}
    </div>

    <h2>
      {seccion === 'facturacion'
        ? 'Módulo de facturación'
        : 'Módulo de reportes'}
    </h2>

    <p>
      Este módulo todavía está pendiente de implementar.
      Puedes continuar trabajando en Productos e Inventario.
    </p>
  </section>
)}
       
      </main>
    </div>
  );
}
