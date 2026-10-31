
import { useCallback, useEffect, useState } from "react";
import "../style/Ventas.css";

const API = "/api";

export default function Ventas({ onVentaRegistrada }) {
  const [productos, setProductos] = useState([]);
  const [carrito, setCarrito] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [metodoPago, setMetodoPago] = useState("Efectivo");
  const [canalVenta, setCanalVenta] = useState("Presencial");

  const cargarProductos = useCallback(async (mostrarCarga = true) => {
    if (mostrarCarga) setCargando(true);

    try {
      const respuesta = await fetch(`${API}/productos`);

      if (!respuesta.ok) {
        throw new Error("No se pudieron cargar los productos.");
      }

      const datos = await respuesta.json();
      const lista = Array.isArray(datos)
        ? datos
        : datos.productos || [];

      setProductos(lista);
    } catch (err) {
      setError(err.message || "Error al cargar los productos.");
    } finally {
      if (mostrarCarga) setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarProductos();
  }, [cargarProductos]);

  function productoActivo(producto) {
    return (
      producto.Estado === undefined ||
      Number(producto.Estado) === 1
    );
  }

  function validarProducto(producto) {
    const precio = Number(producto.Precio);
    const existencia = Number(producto.Existencia);

    if (!productoActivo(producto)) {
      return "Este producto está inactivo y no se puede vender.";
    }

    if (!Number.isFinite(precio) || precio < 0) {
      return "El producto tiene un precio inválido.";
    }

    if (!Number.isInteger(existencia) || existencia < 0) {
      return "Las existencias de este producto no son válidas.";
    }

    if (existencia === 0) {
      return "Este producto no tiene existencias disponibles.";
    }

    return "";
  }

  function agregarProducto(producto) {
    setError("");
    setMensaje("");

    const validacion = validarProducto(producto);

    if (validacion) {
      setError(validacion);
      return;
    }

    const id = producto.IdProducto;
    const existencia = Number(producto.Existencia);
    const precio = Number(producto.Precio);

    setCarrito((actual) => {
      const encontrado = actual.find(
        (item) => item.IdProducto === id
      );

      if (encontrado) {
        if (encontrado.cantidad >= existencia) {
          setError(
            `Solo hay ${existencia} unidades disponibles de ${producto.NombreProducto}.`
          );
          return actual;
        }

        return actual.map((item) =>
          item.IdProducto === id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        );
      }

      return [
        ...actual,
        {
          IdProducto: id,
          NombreProducto: producto.NombreProducto,
          Precio: precio,
          Existencia: existencia,
          cantidad: 1,
        },
      ];
    });
  }

  function cambiarCantidad(id, valor) {
    setError("");
    setMensaje("");

    if (valor === "") {
      setError("La cantidad no puede quedar vací­a.");
      return;
    }

    const cantidad = Number(valor);
    const item = carrito.find(
      (producto) => producto.IdProducto === id
    );

    if (!item) return;

    if (!Number.isInteger(cantidad) || cantidad < 1) {
      setError("La cantidad debe ser un número entero mayor que cero.");
      return;
    }

    if (cantidad > item.Existencia) {
      setError(
        `Solo hay ${item.Existencia} unidades disponibles de ${item.NombreProducto}.`
      );
      return;
    }

    setCarrito((actual) =>
      actual.map((producto) =>
        producto.IdProducto === id
          ? { ...producto, cantidad }
          : producto
      )
    );
  }

  function quitarProducto(id) {
    setCarrito((actual) =>
      actual.filter((item) => item.IdProducto !== id)
    );
    setError("");
    setMensaje("");
  }

  function limpiarVenta() {
    setCarrito([]);
    setError("");
    setMensaje("Se limpia el detalle de la venta.");
  }

  const total = carrito.reduce((suma, item) => {
    const subtotal = Number(item.Precio) * item.cantidad;
    return suma + (Number.isFinite(subtotal) ? subtotal : 0);
  }, 0);

  const productosFiltrados = productos.filter((producto) => {
    const nombre = producto.NombreProducto || "";

    return (
      nombre.toLowerCase().includes(busqueda.toLowerCase()) &&
      productoActivo(producto)
    );
  });

  async function registrarVenta() {
    setError("");
    setMensaje("");

    if (carrito.length === 0) {
      setError("Agrega al menos un producto para registrar la venta.");
      return;
    }

    // Comprueba nuevamente las existencias antes de enviar la venta.
    for (const item of carrito) {
      const productoActual = productos.find(
        (producto) => producto.IdProducto === item.IdProducto
      );

      if (!productoActual) {
        setError(`No se encontró el producto ${item.NombreProducto}.`);
        return;
      }

      const validacion = validarProducto(productoActual);

      if (validacion) {
        setError(`${item.NombreProducto}: ${validacion}`);
        await cargarProductos(false);
        return;
      }

      if (item.cantidad > Number(productoActual.Existencia)) {
        setError(
          `Las existencias de ${item.NombreProducto} cambiaron. Revisá la cantidad antes de continuar.`
        );
        await cargarProductos(false);
        return;
      }
    }

    const token = localStorage.getItem("token");

    if (!token) {
      setError(
        "No se encontro el token de sesión. Cerra sesión e inicia sesión nuevamente."
      );
      return;
    }

    try {
      setGuardando(true);

      const respuesta = await fetch(`${API}/ventas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          MetodoPago: metodoPago,
          CanalVenta: canalVenta,
          productos: carrito.map((item) => ({
            IdProducto: item.IdProducto,
            Cantidad: item.cantidad,
          })),
        }),
      });

      const resultado = await respuesta.json().catch(() => ({}));

      if (!respuesta.ok) {
        throw new Error(
          resultado.mensaje ||
          resultado.error ||
          "No se pudo registrar la venta."
        );
      }

      // La venta ya se registró en el servidor.
      setCarrito([]);
      setBusqueda("");
      setMensaje(
        `¡Venta registrada correctamente! Número de venta: ${
          resultado.IdVenta ?? "registrada"
        }. Total: C$ ${Number(
          resultado.Total ?? total
        ).toFixed(2)}.`
      );

      // Actualiza los productos del módulo Ventas.
      await cargarProductos(false);

      // Actualiza los productos y lotes de App.jsx,
      // incluyendo las existencias y alertas de Inventario.
      if (onVentaRegistrada) {
        try {
          await onVentaRegistrada();
        } catch (actualizacionError) {
          console.error(
            "La venta se registro, pero no se pudieron actualizar todos los datos visuales:",
            actualizacionError
          );
        }
      }
    } catch (err) {
      setError(err.message || "Ocurrio un error al registrar la venta.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <main className="ventas-page">
      <header className="ventas-header">
        <div>
          <h1>Nueva venta</h1>
          <p>Selecciona los productos para registrar una venta.</p>
        </div>
        <span className="ventas-etiqueta">Punto de venta</span>
      </header>

      {error && (
        <div className="ventas-error" role="alert">
          {error}
        </div>
      )}

      {mensaje && (
        <div className="ventas-mensaje" role="status">
          {mensaje}
        </div>
      )}

      <div className="ventas-columnas">
        <section className="ventas-panel">
          <h2>Productos disponibles</h2>

          <input
            className="ventas-busqueda"
            type="search"
            placeholder="Buscar producto..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />

          {cargando ? (
            <p>Cargando productos...</p>
          ) : productosFiltrados.length === 0 ? (
            <p>No se encontraron productos disponibles.</p>
          ) : (
            <div className="ventas-productos">
              {productosFiltrados.map((producto) => {
                const validacion = validarProducto(producto);
                const existencia = Number(producto.Existencia);
                const precio = Number(producto.Precio);

                return (
                  <article
                    className="ventas-producto"
                    key={producto.IdProducto}
                  >
                    <div>
                      <h3>{producto.NombreProducto}</h3>
                      <p>
                        C${" "}
                        {Number.isFinite(precio)
                          ? precio.toFixed(2)
                          : "Precio inválido"}
                      </p>
                      <small>
                        Existencia: {producto.Existencia ?? 0}
                      </small>
                    </div>

                    <button
                      type="button"
                      disabled={
                        guardando ||
                        Boolean(validacion) ||
                        !Number.isInteger(existencia) ||
                        !Number.isFinite(precio)
                      }
                      onClick={() => agregarProducto(producto)}
                      title={validacion || "Agregar al carrito"}
                    >
                      Agregar
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="ventas-panel">
          <h2>Detalle de la venta</h2>

          {carrito.length === 0 ? (
            <p className="ventas-vacio">
              Todavía no has agregado productos.
            </p>
          ) : (
            <div className="ventas-tabla-contenedor">
              <table className="ventas-tabla">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cant.</th>
                    <th>Subtotal</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {carrito.map((item) => (
                    <tr key={item.IdProducto}>
                      <td>
                        {item.NombreProducto}
                        <small>
                          C$ {item.Precio.toFixed(2)} c/u
                        </small>
                      </td>
                      <td>
                        <input
                          className="ventas-cantidad"
                          type="number"
                          min="1"
                          max={item.Existencia}
                          step="1"
                          value={item.cantidad}
                          disabled={guardando}
                          onChange={(e) =>
                            cambiarCantidad(
                              item.IdProducto,
                              e.target.value
                            )
                          }
                        />
                      </td>
                      <td>
                        C${" "}
                        {(item.Precio * item.cantidad).toFixed(2)}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="ventas-quitar"
                          disabled={guardando}
                          onClick={() =>
                            quitarProducto(item.IdProducto)
                          }
                          aria-label={`Quitar ${item.NombreProducto}`}
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="ventas-opciones">
            <label>
              Método de pago
              <select
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
                disabled={guardando}
              >
                <option value="Efectivo">Efectivo</option>
                <option value="Tarjeta">Tarjeta</option>
                <option value="Transferencia">Transferencia</option>
              </select>
            </label>

            <label>
              Canal de venta
              <select
                value={canalVenta}
                onChange={(e) => setCanalVenta(e.target.value)}
                disabled={guardando}
              >
                <option value="Presencial">Presencial</option>
                <option value="Pedido">Pedido</option>
              </select>
            </label>
          </div>

          <div className="ventas-total">
            <span>Total</span>
            <strong>C$ {total.toFixed(2)}</strong>
          </div>

          <button
            type="button"
            className="ventas-limpiar"
            disabled={carrito.length === 0 || guardando}
            onClick={limpiarVenta}
          >
            Limpiar venta
          </button>

          <button
            type="button"
            className="ventas-confirmar"
            disabled={carrito.length === 0 || guardando || cargando}
            onClick={registrarVenta}
          >
            {guardando ? "Registrando venta..." : "Registrar venta"}
          </button>

          <p className="ventas-nota">
            Las existencias se actualizan después de registrar la venta.
            El servidor valida los lotes disponibles y sus vencimientos.
          </p>
        </section>
      </div>
    </main>
  );
}

