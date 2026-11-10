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
  // Venta registrada que todavía puede generar su comprobante.
const [ventaRegistrada, setVentaRegistrada] = useState(null);

// Estado del formulario para editar una factura
const [editandoFactura, setEditandoFactura] = useState(false);
const [guardandoEdicion, setGuardandoEdicion] = useState(false);
const [formularioEdicion, setFormularioEdicion] = useState({
  MetodoPago: 'Efectivo',
  CanalVenta: 'Presencial',
  productos: []
});
const [anulandoFactura, setAnulandoFactura] = useState(false);

// Comprobante generado.
const [comprobanteGenerado, setComprobanteGenerado] = useState(null);

// Estado de la generación.
const [generandoComprobante, setGenerandoComprobante] = useState(false);

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
      setError("La cantidad no puede quedar vací¬a.");
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

  // Total que se muestra en el formulario de edición antes de guardar.
const totalEdicion = formularioEdicion.productos.reduce(
  (suma, item) =>
    suma + Number(item.PrecioUnitario) * Number(item.Cantidad),
  0
);

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
      const idVentaRegistrada = Number(resultado.IdVenta);

if (!Number.isInteger(idVentaRegistrada) || idVentaRegistrada <= 0) {
  throw new Error(
    "La venta se registró, pero no se recibió un identificador válido."
  );
}

// Guardar la venta para generar su comprobante.
setVentaRegistrada({
  IdVenta: idVentaRegistrada,
  Total: Number(resultado.Total ?? total),
});

setComprobanteGenerado(null);

setCarrito([]);
setBusqueda("");

setMensaje(
  `¡Venta registrada correctamente! Número de venta: ${
    idVentaRegistrada
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

  
  async function generarComprobante() {
    if (!ventaRegistrada?.IdVenta || generandoComprobante || comprobanteGenerado) {
      return;
    }

    const confirmar = window.confirm(
      `¿Deseas generar el comprobante de la venta ${ventaRegistrada.IdVenta}?`
    );

    if (!confirmar) return;

    const token = localStorage.getItem("token");

    if (!token) {
      setError("Tu sesión ha expirado. Inicia sesión nuevamente.");
      return;
    }

    setGenerandoComprobante(true);
    setError("");
    setMensaje("");

    try {
      const respuesta = await fetch(`${API}/facturas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          IdVenta: ventaRegistrada.IdVenta,
        }),
      });

      const resultado = await respuesta.json().catch(() => ({}));

      if (!respuesta.ok) {
        throw new Error(
          resultado.mensaje || "No se pudo generar el comprobante."
        );
      }

      setComprobanteGenerado({
  ...resultado,

  productos: agruparProductosFactura(
    resultado.productos || []
  )
});

      setMensaje(
        `Comprobante ${resultado.factura.NumeroFactura} generado correctamente.`
      );
    } catch (err) {
      setError(
        err.message || "Ocurrió un error al generar el comprobante."
      );
    } finally {
      setGenerandoComprobante(false);
    }
  }

  function quitarComprobante() {
    setComprobanteGenerado(null);
    setVentaRegistrada(null);

    setMensaje(
      "Comprobante ocultado correctamente. Sigue guardado en el sistema."
    );
  }
  // =============================================
// ABRIR EL FORMULARIO DE EDICIÓN
// =============================================

function abrirEdicionFactura() {

  if (!comprobanteGenerado?.factura?.IdFactura) {
    setError('No se encontró la factura que deseas editar.');
    return;
  }

  if (
    (comprobanteGenerado.factura.EstadoFactura || 'Vigente') !== 'Vigente'
  ) {
    setError('No se puede editar una factura anulada.');
    return;
  }

  setError('');
  setMensaje('');

  // Agrupar los registros que pertenecen
  // al mismo producto, aunque provengan de lotes diferentes.
  const productosAgrupados = agruparProductosFactura(
    comprobanteGenerado.productos || []
  );

  setFormularioEdicion({

    MetodoPago: comprobanteGenerado.venta.MetodoPago,

    CanalVenta: comprobanteGenerado.venta.CanalVenta,

    productos: productosAgrupados.map(producto => ({
      IdProducto: producto.IdProducto,
      NombreProducto: producto.NombreProducto,
      Cantidad: producto.Cantidad,
      PrecioUnitario: producto.PrecioUnitario
    }))

  });

  setEditandoFactura(true);
}

// =============================================
// AGRUPAR PRODUCTOS DE UNA FACTURA
// Un mismo producto puede estar distribuido
// en diferentes lotes de inventario.
// En pantalla se mostrará una sola fila.
// =============================================

function agruparProductosFactura(productos = []) {

  const agrupados = new Map();

  for (const producto of productos) {

    const idProducto = Number(producto.IdProducto);
    const cantidad = Number(producto.Cantidad);
    const precio = Number(producto.PrecioUnitario);

    const subtotal = Number(
      producto.Subtotal ?? cantidad * precio
    );

    if (!agrupados.has(idProducto)) {

      agrupados.set(idProducto, {
        IdDetalle: producto.IdDetalle,
        IdProducto: idProducto,
        NombreProducto: producto.NombreProducto,
        Cantidad: cantidad,
        PrecioUnitario: precio,
        Subtotal: subtotal
      });

    } else {

      const existente = agrupados.get(idProducto);

      existente.Cantidad += cantidad;
      existente.Subtotal += subtotal;

    }
  }

  return Array.from(agrupados.values()).map(producto => ({
    ...producto,

    Subtotal: Number(producto.Subtotal.toFixed(2)),

    // Mantener el precio promedio ponderado
    // para conservar el subtotal original.
    PrecioUnitario: producto.Cantidad > 0
      ? Number(
          (producto.Subtotal / producto.Cantidad).toFixed(2)
        )
      : producto.PrecioUnitario
  }));
}
 
// =============================================
// CAMBIAR LA CANTIDAD DE UN PRODUCTO EN EL FORMULARIO
// =============================================
function cambiarCantidadEdicion(idProducto, valor) {
  const cantidad = valor === '' ? '' : Number(valor);
 
  setFormularioEdicion((actual) => ({
    ...actual,
    productos: actual.productos.map((producto) =>
      producto.IdProducto === idProducto
        ? { ...producto, Cantidad: cantidad }
        : producto
    )
  }));
}
 
// =============================================
// CERRAR EL FORMULARIO SIN GUARDAR
// =============================================
function cancelarEdicionFactura() {
  setEditandoFactura(false);
  setError('');
}
 
// =============================================
// GUARDAR LOS CAMBIOS DE LA FACTURA
// =============================================
async function guardarEdicionFactura(evento) {
  evento.preventDefault();
  setError('');
  setMensaje('');
 
  if (!comprobanteGenerado?.factura?.IdFactura) {
    setError('No se encontró la factura que deseas editar.');
    return;
  }
 
  if (!['Efectivo', 'Tarjeta', 'Transferencia'].includes(formularioEdicion.MetodoPago)) {
    setError('Selecciona un método de pago válido.');
    return;
  }
 
  if (!['Presencial', 'Pedido'].includes(formularioEdicion.CanalVenta)) {
    setError('Selecciona un canal de venta válido.');
    return;
  }
 
  for (const producto of formularioEdicion.productos) {
    if (
      !Number.isInteger(Number(producto.Cantidad)) ||
      Number(producto.Cantidad) < 1
    ) {
      setError(`La cantidad de ${producto.NombreProducto} debe ser un entero mayor que cero.`);
      return;
    }
  }
 
  const token = localStorage.getItem('token');
  if (!token) {
    setError('Tu sesión ha expirado. Inicia sesión nuevamente.');
    return;
  }
 
  try {
    setGuardandoEdicion(true);
 
    const idFactura = comprobanteGenerado.factura.IdFactura;
 
    const respuesta = await fetch(
      `${API}/facturas/${idFactura}/editar`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          MetodoPago: formularioEdicion.MetodoPago,
          CanalVenta: formularioEdicion.CanalVenta,
          productos: formularioEdicion.productos.map((producto) => ({
            IdProducto: Number(producto.IdProducto),
            Cantidad: Number(producto.Cantidad)
          }))
        })
      }
    );
 
    const resultado = await respuesta.json().catch(() => ({}));
 
    if (!respuesta.ok) {
      throw new Error(
        resultado.mensaje || 'No se pudo editar la factura.'
      );
    }
 
    // Actualizar inmediatamente el comprobante que está en pantalla.
    setComprobanteGenerado((actual) => ({
  ...actual,

  factura: {
    ...actual.factura,
    ...resultado.factura
  },

  venta: {
    ...actual.venta,
    ...resultado.venta
  },

  // Agrupar nuevamente los productos devueltos
  // por el backend después de guardar.
  productos: agruparProductosFactura(
    resultado.productos || []
  )
}));
 
    setEditandoFactura(false);
    setError('');
    // Este texto se muestra en el aviso de estado que ya existe en Ventas.jsx.
    setMensaje('Factura editada correctamente.');
 
    // Actualizar las existencias visibles en el módulo y en el resto de la aplicación.
    await cargarProductos(false);
 
    if (onVentaRegistrada) {
      try {
        await onVentaRegistrada();
      } catch (actualizacionError) {
        console.error(
          'La factura se editó, pero no se pudo refrescar el resto de los datos visuales:',
          actualizacionError
        );
      }
    }
 
  } catch (error) {
    setError(error.message || 'Ocurrió un error al editar la factura.');
  } finally {
    setGuardandoEdicion(false);
  }

} // Aquí termina guardarEdicionFactura

// =============================================
// ANULAR FACTURA DESDE EL MÓDULO DE VENTAS
// =============================================

async function anularFactura() {

  const factura = comprobanteGenerado?.factura;

  if (!factura?.IdFactura) {
    setError('No se encontró la factura que deseas anular.');
    return;
  }

  if ((factura.EstadoFactura || 'Vigente') !== 'Vigente') {
    setError('Esta factura ya se encuentra anulada.');
    return;
  }

  // Solicitar motivo.
  const motivo = window.prompt(
    'Escribe el motivo por el cual deseas anular esta factura:'
  );

  if (motivo === null) return;

  if (motivo.trim().length < 5 || motivo.trim().length > 250) {
    setError(
      'El motivo debe tener entre 5 y 250 caracteres.'
    );
    return;
  }

  // Confirmar anulación.
  const confirmar = window.confirm(
    `¿Estás seguro de anular la factura ${factura.NumeroFactura}?\n\n` +
    'Esta acción anulará también la venta y devolverá los productos al inventario.\n\n' +
    'Continúa únicamente si la venta no se concretó o los productos regresaron aptos para la venta.'
  );

  if (!confirmar) return;

  const token = localStorage.getItem('token');

  if (!token) {
    setError('Tu sesión ha expirado. Inicia sesión nuevamente.');
    return;
  }

  try {

    setAnulandoFactura(true);
    setError('');
    setMensaje('');

    const respuesta = await fetch(
      `${API}/facturas/${factura.IdFactura}/anular`,
      {
        method: 'PATCH',

        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },

        body: JSON.stringify({
          MotivoAnulacion: motivo.trim()
        })
      }
    );

    const resultado = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
      throw new Error(
        resultado.mensaje || 'No se pudo anular la factura.'
      );
    }

    // Actualizar el comprobante inmediatamente.
    setComprobanteGenerado((actual) => ({
      ...actual,

      factura: {
        ...actual.factura,
        ...resultado.factura
      },

      venta: {
        ...actual.venta,
        ...resultado.venta
      }
    }));

    setEditandoFactura(false);
    setError('');

    // Mostrar el mensaje de confirmación.
    setMensaje('Factura anulada correctamente.');

    // Actualizar las existencias de los productos.
    await cargarProductos(false);

    if (onVentaRegistrada) {
      try {
        await onVentaRegistrada();
      } catch (actualizacionError) {
        console.error(
          'La factura se anuló, pero no se pudieron actualizar todos los datos visuales:',
          actualizacionError
        );
      }
    }

  } catch (error) {

    setError(
      error.message || 'Ocurrió un error al anular la factura.'
    );

  } finally {

    setAnulandoFactura(false);

  }
}

// =============================================
// INTERFAZ PRINCIPAL DEL MÓDULO VENTAS
// =============================================

 
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

      
  {/* Botón para generar comprobante de la venta registrada */}
  {ventaRegistrada && !comprobanteGenerado && (
    <section className="ventas-factura-accion">
      <div>
        <h3>Venta registrada correctamente</h3>

        <p>
          Número de venta: #{ventaRegistrada.IdVenta}
        </p>

        <p>
          Total: C$ {ventaRegistrada.Total.toFixed(2)}
        </p>

        <small>
          Ahora puedes generar el comprobante de esta operación.
        </small>
      </div>

      <button
        type="button"
        className="ventas-generar-factura"
        onClick={generarComprobante}
        disabled={generandoComprobante}
      >
        {generandoComprobante
          ? "Generando Factura..."
          : "Generar Factura"}
      </button>
    </section>
  )}

  {/* Mostrar comprobante después de generarlo */}
  {comprobanteGenerado && (
  <div className="ventas-comprobante-overlay">

    <section
      className="ventas-comprobante ventas-comprobante-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Comprobante de venta"
    >
      <div className="ventas-comprobante-encabezado">
        <h2>PANADERÍA EMMANUEL</h2>
        <p>COMPROBANTE DE VENTA</p>
      </div>

      <div className="ventas-comprobante-info">
        <p>
          <strong>Número:</strong>{" "}
          {comprobanteGenerado.factura.NumeroFactura}
        </p>

        <p>
          <strong>Fecha de emisión:</strong>{" "}
          {new Date(
            comprobanteGenerado.factura.FechaEmision
          ).toLocaleString("es-NI")}
        </p>

        <p>
          <strong>Venta:</strong>{" "}
          #{comprobanteGenerado.venta.IdVenta}
        </p>

        <p>
          <strong>Método de pago:</strong>{" "}
          {comprobanteGenerado.venta.MetodoPago}
        </p>

        <p>
          <strong>Canal de venta:</strong>{" "}
          {comprobanteGenerado.venta.CanalVenta}
        </p>

        <p>
  <strong>Estado de la factura:</strong>{' '}

  <span
    className={
      comprobanteGenerado.factura.EstadoFactura === 'Anulada'
        ? 'venta-factura-anulada'
        : 'venta-factura-vigente'
    }
  >
    {comprobanteGenerado.factura.EstadoFactura || 'Vigente'}
  </span>
</p>

{comprobanteGenerado.factura.EstadoFactura === 'Anulada' && (
  <>
    <p>
      <strong>Fecha de anulación:</strong>{' '}
      {new Date(
        comprobanteGenerado.factura.FechaAnulacion
      ).toLocaleString('es-NI')}
    </p>

    <p>
      <strong>Motivo de anulación:</strong>{' '}
      {comprobanteGenerado.factura.MotivoAnulacion}
    </p>
  </>
)}
      </div>

      <h3>Productos vendidos</h3>

      <div className="ventas-tabla-contenedor">
        <table className="ventas-tabla">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>Precio</th>
              <th>Subtotal</th>
            </tr>
          </thead>

          <tbody>
            {comprobanteGenerado.productos.map((producto) => (
              <tr key={producto.IdDetalle}>
                <td>{producto.NombreProducto}</td>
                <td>{producto.Cantidad}</td>
                <td>
                  C$ {Number(producto.PrecioUnitario).toFixed(2)}
                </td>
                <td>
                  C$ {Number(producto.Subtotal).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ventas-comprobante-total">
        <strong>TOTAL</strong>

        <strong>
          C$ {Number(comprobanteGenerado.venta.Total).toFixed(2)}
        </strong>
      </div>

      

     <div className="ventas-comprobante-acciones ventas-no-imprimir">

 {(comprobanteGenerado.factura.EstadoFactura || 'Vigente') === 'Vigente' && (
    <>
      <button
        type="button"
        className="ventas-editar-factura"
        onClick={abrirEdicionFactura}
        disabled={guardandoEdicion || anulandoFactura}
      >
        Editar factura
      </button>

      <button
        type="button"
        className="ventas-anular-factura"
        onClick={anularFactura}
        disabled={guardandoEdicion || anulandoFactura}
      >
        {anulandoFactura
          ? 'Anulando factura...'
          : 'Anular factura'}
      </button>
    </>
  )}

  <button
    type="button"
    className="ventas-generar-factura"
    onClick={() => window.print()}
  >
    Imprimir comprobante
  </button>

  <button
    type="button"
    className="ventas-quitar-comprobante"
    onClick={quitarComprobante}
  >
    Quitar
  </button>
</div>
{editandoFactura && (
  <div className="ventas-modal-overlay ventas-no-imprimir">
    <div
      className="ventas-modal-edicion"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-editar-factura"
    >
      <form onSubmit={guardarEdicionFactura}>
        <div className="ventas-modal-encabezado">
          <div>
            <h2 id="titulo-editar-factura">Editar factura</h2>
            <p>
              Factura {comprobanteGenerado.factura.NumeroFactura}
            </p>
          </div>
          <button
            type="button"
            className="ventas-modal-cerrar"
            onClick={cancelarEdicionFactura}
            aria-label="Cerrar formulario"
            disabled={guardandoEdicion}
          >
            ×
          </button>
        </div>
 
        <div className="ventas-modal-campos">
          <label>
            Método de pago
            <select
              value={formularioEdicion.MetodoPago}
              onChange={(e) => setFormularioEdicion((actual) => ({
                ...actual,
                MetodoPago: e.target.value
              }))}
              disabled={guardandoEdicion}
            >
              <option value="Efectivo">Efectivo</option>
              <option value="Tarjeta">Tarjeta</option>
              <option value="Transferencia">Transferencia</option>
            </select>
          </label>
 
          <label>
            Canal de venta
            <select
              value={formularioEdicion.CanalVenta}
              onChange={(e) => setFormularioEdicion((actual) => ({
                ...actual,
                CanalVenta: e.target.value
              }))}
              disabled={guardandoEdicion}
            >
              <option value="Presencial">Presencial</option>
              <option value="Pedido">Pedido</option>
            </select>
          </label>
        </div>
 
        <h3 className="ventas-modal-subtitulo">Productos de la venta</h3>
        <p className="ventas-modal-ayuda">
          Corrige las cantidades. Los productos y sus precios unitarios originales se conservan.
        </p>
 
        <div className="ventas-modal-tabla-contenedor">
          <table className="ventas-modal-tabla">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Precio unitario</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {formularioEdicion.productos.map((producto) => (
                <tr key={producto.IdProducto}>
                  <td>{producto.NombreProducto}</td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={producto.Cantidad}
                      onChange={(e) => cambiarCantidadEdicion(
                        producto.IdProducto,
                        e.target.value
                      )}
                      disabled={guardandoEdicion}
                      required
                    />
                  </td>
                  <td>
                    C$ {Number(producto.PrecioUnitario).toFixed(2)}
                  </td>
                  <td>
                    C$ {
                      (
                        Number(producto.Cantidad || 0) *
                        Number(producto.PrecioUnitario)
                      ).toFixed(2)
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
 
        <div className="ventas-modal-total">
          <span>Nuevo total</span>
          <strong>C$ {Number(totalEdicion).toFixed(2)}</strong>
        </div>
 
        <div className="ventas-modal-acciones">
          <button
            type="button"
            className="ventas-modal-cancelar"
            onClick={cancelarEdicionFactura}
            disabled={guardandoEdicion}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="ventas-modal-guardar"
            disabled={guardandoEdicion}
          >
            {guardandoEdicion ? 'Guardando cambios...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  </div>
)}

    </section>
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

