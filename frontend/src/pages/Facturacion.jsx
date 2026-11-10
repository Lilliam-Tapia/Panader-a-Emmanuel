
/*import { useCallback, useEffect, useState } from 'react';
import '../style/Facturacion.css';

const API = '/api/facturas';

async function leerRespuesta(respuesta) {
  const datos = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    throw new Error(
      datos.mensaje || 'Ocurrió un error al comunicarse con el servidor.'
    );
  }

  return datos;
}

function obtenerCabeceras() {
  const token = localStorage.getItem('token');

  if (!token) {
    throw new Error('Tu sesión ha expirado. Inicia sesión nuevamente.');
  }

  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function formatoFecha(fecha) {
  if (!fecha) return 'No disponible';

  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) return 'No disponible';

  return valor.toLocaleString('es-NI');
}

function formatoMoneda(valor) {
  return `C$ ${Number(valor || 0).toFixed(2)}`;
}

export default function Facturacion() {
  const [pendientes, setPendientes] = useState([]);
  const [idSeleccionada, setIdSeleccionada] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [comprobante, setComprobante] = useState(null);

  const [cargandoLista, setCargandoLista] = useState(true);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [generando, setGenerando] = useState(false);

  const [error, setError] = useState('');

  // Consultar las ventas que todavía no tienen comprobante.
  const cargarPendientes = useCallback(async () => {
    setCargandoLista(true);
    setError('');

    try {
      const respuesta = await fetch(`${API}/pendientes`, {
        headers: obtenerCabeceras(),
      });

      const datos = await leerRespuesta(respuesta);

      setPendientes(Array.isArray(datos) ? datos : []);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las ventas pendientes.');
    } finally {
      setCargandoLista(false);
    }
  }, []);

  useEffect(() => {
    cargarPendientes();
  }, [cargarPendientes]);

  // Consultar los productos y datos de una venta seleccionada.
  async function consultarDetalle(venta) {
    setIdSeleccionada(venta.IdVenta);
    setDetalle(null);
    setComprobante(null);
    setError('');
    setCargandoDetalle(true);

    try {
      const respuesta = await fetch(
        `${API}/venta/${venta.IdVenta}`,
        {
          headers: obtenerCabeceras(),
        }
      );

      const datos = await leerRespuesta(respuesta);

      setDetalle(datos);
    } catch (err) {
      setError(err.message || 'No se pudo consultar el detalle de la venta.');
      setIdSeleccionada(null);
    } finally {
      setCargandoDetalle(false);
    }
  }

  // Generar y guardar el comprobante en SQL Server.
  async function generarComprobante() {
    if (!detalle?.venta) return;

    const confirmar = window.confirm(
      `¿Deseas generar el comprobante para la venta ${detalle.venta.IdVenta}? Esta operación quedará registrada en la base de datos.`
    );

    if (!confirmar) return;

    setGenerando(true);
    setError('');

    try {
      const respuesta = await fetch(API, {
        method: 'POST',
        headers: obtenerCabeceras(),
        body: JSON.stringify({
          IdVenta: detalle.venta.IdVenta,
        }),
      });

      const datos = await leerRespuesta(respuesta);

      setComprobante(datos);
      setDetalle(null);
      setIdSeleccionada(null);

      await cargarPendientes();
    } catch (err) {
      setError(err.message || 'No se pudo generar el comprobante.');
    } finally {
      setGenerando(false);
    }
  }

  function limpiarComprobante() {
    setComprobante(null);
    setDetalle(null);
    setIdSeleccionada(null);
  }

  return (
    <section className="facturacion-page">
      <header className="facturacion-header">
        <div>
          <h2>Comprobantes de venta</h2>
          <p>
            Selecciona una venta registrada para consultar sus datos
            y generar su comprobante.
          </p>
        </div>

        <button
          type="button"
          className="facturacion-btn secundario"
          onClick={cargarPendientes}
          disabled={cargandoLista}
        >
          {cargandoLista ? 'Actualizando...' : 'Actualizar ventas'}
        </button>
      </header>

      {error && (
        <div className="facturacion-error" role="alert">
          {error}
        </div>
      )}

      <div className="facturacion-columnas">
        <div className="facturacion-panel">
          <div className="facturacion-panel-titulo">
            <div>
              <h3>Ventas pendientes</h3>
              <p>Ventas que todavía no tienen comprobante.</p>
            </div>

            <span className="facturacion-contador">
              {pendientes.length}
            </span>
          </div>

          {cargandoLista ? (
            <p className="facturacion-vacio">Cargando ventas...</p>
          ) : pendientes.length === 0 ? (
            <p className="facturacion-vacio">
              No hay ventas pendientes de facturación.
            </p>
          ) : (
            <div className="facturacion-tabla-contenedor">
              <table className="facturacion-tabla">
                <thead>
                  <tr>
                    <th>Venta</th>
                    <th>Fecha</th>
                    <th>Total</th>
                    <th>Acción</th>
                  </tr>
                </thead>

                <tbody>
                  {pendientes.map((venta) => (
                    <tr
                      key={venta.IdVenta}
                      className={
                        idSeleccionada === venta.IdVenta
                          ? 'fila-seleccionada'
                          : ''
                      }
                    >
                      <td>#{venta.IdVenta}</td>
                      <td>{formatoFecha(venta.FechaVenta)}</td>
                      <td>{formatoMoneda(venta.Total)}</td>
                      <td>
                        <button
                          type="button"
                          className="facturacion-btn ver"
                          onClick={() => consultarDetalle(venta)}
                          disabled={cargandoDetalle}
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="facturacion-panel">
          {cargandoDetalle ? (
            <p className="facturacion-vacio">
              Consultando los datos de la venta...
            </p>
          ) : comprobante ? (
            <div className="facturacion-comprobante">
              <div className="comprobante-encabezado">
                <h2>PANADERÍA EMMANUEL</h2>
                <p>COMPROBANTE DE VENTA</p>
              </div>

              <div className="comprobante-numero">
                <span>Número de comprobante</span>
                <strong>{comprobante.factura.NumeroFactura}</strong>
              </div>

              <div className="comprobante-datos">
                <p>
                  <strong>Fecha de emisión:</strong>{' '}
                  {formatoFecha(comprobante.factura.FechaEmision)}
                </p>
                <p>
                  <strong>Venta relacionada:</strong>{' '}
                  #{comprobante.venta.IdVenta}
                </p>
                <p>
                  <strong>Fecha de venta:</strong>{' '}
                  {formatoFecha(comprobante.venta.FechaVenta)}
                </p>
                <p>
                  <strong>Método de pago:</strong>{' '}
                  {comprobante.venta.MetodoPago}
                </p>
                <p>
                  <strong>Canal de venta:</strong>{' '}
                  {comprobante.venta.CanalVenta}
                </p>
              </div>

              <h3>Detalle de productos</h3>

              <div className="facturacion-tabla-contenedor">
                <table className="facturacion-tabla">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Cant.</th>
                      <th>Precio</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>

                  <tbody>
                    {comprobante.productos.map((producto) => (
                      <tr key={producto.IdDetalle}>
                        <td>{producto.NombreProducto}</td>
                        <td>{producto.Cantidad}</td>
                        <td>{formatoMoneda(producto.PrecioUnitario)}</td>
                        <td>{formatoMoneda(producto.Subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="comprobante-total">
                <span>TOTAL</span>
                <strong>{formatoMoneda(comprobante.venta.Total)}</strong>
              </div>

              <p className="comprobante-nota">
                Comprobante interno de venta. No constituye una factura
                fiscal oficial.
              </p>

              <div className="facturacion-acciones facturacion-no-imprimir">
                <button
                  type="button"
                  className="facturacion-btn principal"
                  onClick={() => window.print()}
                >
                  Imprimir comprobante
                </button>

                <button
                  type="button"
                  className="facturacion-btn secundario"
                  onClick={limpiarComprobante}
                >
                  Volver a ventas pendientes
                </button>
              </div>
            </div>
          ) : detalle ? (
            <div className="facturacion-detalle">
              <h3>Detalle de la venta #{detalle.venta.IdVenta}</h3>

              <div className="detalle-datos">
                <p>
                  <strong>Fecha:</strong>{' '}
                  {formatoFecha(detalle.venta.FechaVenta)}
                </p>
                <p>
                  <strong>Método de pago:</strong>{' '}
                  {detalle.venta.MetodoPago}
                </p>
                <p>
                  <strong>Canal:</strong> {detalle.venta.CanalVenta}
                </p>
              </div>

              <h4>Productos</h4>

              <div className="facturacion-tabla-contenedor">
                <table className="facturacion-tabla">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Cantidad</th>
                      <th>Precio</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>

                  <tbody>
                    {detalle.productos.map((producto) => (
                      <tr key={producto.IdDetalle}>
                        <td>{producto.NombreProducto}</td>
                        <td>{producto.Cantidad}</td>
                        <td>{formatoMoneda(producto.PrecioUnitario)}</td>
                        <td>{formatoMoneda(producto.Subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="detalle-total">
                <span>Total de venta</span>
                <strong>{formatoMoneda(detalle.venta.Total)}</strong>
              </div>

              <button
                type="button"
                className="facturacion-btn principal generar"
                onClick={generarComprobante}
                disabled={generando}
              >
                {generando ? 'Generando...' : 'Generar comprobante'}
              </button>
            </div>
          ) : (
            <div className="facturacion-vacio">
              <div className="facturacion-icono">🧾</div>
              <h3 id="titulo-detalle-comprobante">Comprobante de venta</h3>
              <p>
                Selecciona una venta de la lista para consultar sus
                productos y generar el comprobante.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}*/


import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";

import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

import "../style/Facturacion.css";

const API = "/api/facturas";

function obtenerCabeceras() {
  const token = localStorage.getItem("token");

  if (!token) {
    throw new Error("Tu sesión ha expirado. Inicia sesión nuevamente.");
  }

  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
}

async function leerRespuesta(respuesta) {
  const datos = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    throw new Error(
      datos.mensaje || "Ocurrió un error al comunicarse con el servidor."
    );
  }

  return datos;
}

function formatoFecha(fecha) {
  if (!fecha) return "No disponible";

  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) {
    return "No disponible";
  }

  return valor.toLocaleString("es-NI");
}

function formatoMoneda(valor) {
  return `C$ ${Number(valor || 0).toFixed(2)}`;
}

// Agrupa las filas del mismo producto cuando la venta lo descontó
// desde varios lotes. Conserva el subtotal y calcula un precio promedio
// ponderado para que Cantidad x Precio mostrado sea coherente con el total.
function agruparProductos(productos = []) {
  const agrupados = new Map();

  for (const producto of productos) {
    const idProducto = Number(producto.IdProducto);
    const cantidad = Number(producto.Cantidad || 0);
    const precio = Number(producto.PrecioUnitario || 0);
    const subtotal = Number(
      producto.Subtotal ?? cantidad * precio
    );
    const clave = Number.isFinite(idProducto)
      ? `producto-${idProducto}`
      : `detalle-${producto.IdDetalle}`;

    if (!agrupados.has(clave)) {
      agrupados.set(clave, {
        IdProducto: idProducto,
        IdDetalle: producto.IdDetalle,
        NombreProducto: producto.NombreProducto,
        Cantidad: 0,
        Subtotal: 0
      });
    }

    const actual = agrupados.get(clave);
    actual.Cantidad += cantidad;
    actual.Subtotal += subtotal;
  }

  return Array.from(agrupados.values()).map((producto) => ({
    ...producto,
    Cantidad: Number(producto.Cantidad),
    Subtotal: Number(producto.Subtotal.toFixed(2)),
    PrecioUnitario: producto.Cantidad > 0
      ? Number((producto.Subtotal / producto.Cantidad).toFixed(2))
      : 0
  }));
}


function IlustracionFactura() {
  return (
    <svg
      className="facturacion-ilustracion"
      viewBox="0 0 220 160"
      role="img"
      aria-label="Ilustración de una factura de Panadería Emmanuel"
    >
      <circle
        cx="110"
        cy="78"
        r="72"
        fill="#f5e5d9"
      />

      {/* Documento de factura */}
      <path
        d="M70 16 H137 L165 44 V128 H70 Z"
        fill="#ffffff"
        stroke="#88543b"
        strokeWidth="4"
        strokeLinejoin="round"
      />

      <path
        d="M137 16 V44 H165"
        fill="#f3dfd0"
        stroke="#718579"
        strokeWidth="3"
        strokeLinejoin="round"
      />

      <text
        x="84"
        y="61"
        fontSize="15"
        fontWeight="bold"
        fill="#63351f"
      >
        FACTURA
      </text>

      <rect x="84" y="73" width="57" height="5" rx="2" fill="#d5c0b2" />
      <rect x="84" y="85" width="48" height="5" rx="2" fill="#d5c0b2" />
      <rect x="84" y="97" width="57" height="5" rx="2" fill="#d5c0b2" />
      <rect x="84" y="109" width="35" height="5" rx="2" fill="#d5c0b2" />

      {/* Sello de confirmación */}
      <circle cx="158" cy="119" r="22" fill="#b75f3c" />

      <path
        d="M147 119 L155 127 L170 110"
        fill="none"
        stroke="#ffffff"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Pan de la panadería */}
      <ellipse
        cx="51"
        cy="132"
        rx="36"
        ry="15"
        fill="#c98943"
      />

      <path
        d="M27 128 Q33 118 40 120 M44 128 Q50 117 57 119 M61 129 Q67 119 74 122"
        fill="none"
        stroke="#f4ce8f"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}


export default function Facturacion({ esAdministrador = false }) {
  const [pendientes, setPendientes] = useState([]);
  const [facturas, setFacturas] = useState([]);

  const [detalleVenta, setDetalleVenta] = useState(null);
  const [detalleComprobante, setDetalleComprobante] = useState(null);

  const [busqueda, setBusqueda] = useState("");

  const [cargandoPendientes, setCargandoPendientes] = useState(true);
  const [cargandoFacturas, setCargandoFacturas] = useState(false);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const [generandoIdVenta, setGenerandoIdVenta] = useState(null);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  // =========================================
  // CARGAR VENTAS PENDIENTES DE COMPROBANTE
  // =========================================

  const cargarPendientes = useCallback(async () => {
    setCargandoPendientes(true);
    setError("");

    try {
      const respuesta = await fetch(`${API}/pendientes`, {
        headers: obtenerCabeceras()
      });

      const datos = await leerRespuesta(respuesta);

      setPendientes(Array.isArray(datos) ? datos : []);

    } catch (err) {
      setError(
        err.message || "No se pudieron consultar las ventas pendientes."
      );
    } finally {
      setCargandoPendientes(false);
    }
  }, []);

  // =========================================
  // CARGAR HISTORIAL DE COMPROBANTES
  // Solo Administrador
  // =========================================

  const cargarFacturas = useCallback(async () => {
    if (!esAdministrador) return;

    setCargandoFacturas(true);

    try {
      const respuesta = await fetch(API, {
        headers: obtenerCabeceras()
      });

      const datos = await leerRespuesta(respuesta);

      setFacturas(Array.isArray(datos) ? datos : []);

    } catch (err) {
      setError(
        err.message || "No se pudo consultar el historial de comprobantes."
      );
    } finally {
      setCargandoFacturas(false);
    }
  }, [esAdministrador]);

  useEffect(() => {
    cargarPendientes();

    if (esAdministrador) {
      cargarFacturas();
    }
  }, [cargarPendientes, cargarFacturas, esAdministrador]);

  // Los avisos flotantes desaparecen automáticamente después de unos segundos.
  useEffect(() => {
    if (!error && !mensaje) return undefined;

    const temporizador = window.setTimeout(() => {
      setError("");
      setMensaje("");
    }, 4500);

    return () => window.clearTimeout(temporizador);
  }, [error, mensaje]);

  // =========================================
  // FILTRAR COMPROBANTES
  // =========================================

  const facturasFiltradas = useMemo(() => {
    const criterio = busqueda.trim().toLowerCase();

    if (!criterio) return facturas;

    return facturas.filter((factura) =>
      String(factura.NumeroFactura || "")
        .toLowerCase()
        .includes(criterio) ||
      String(factura.IdVenta || "")
        .toLowerCase()
        .includes(criterio)
    );
  }, [facturas, busqueda]);

  // =========================================
  // CONSULTAR DETALLE DE UNA VENTA PENDIENTE
  // =========================================

  async function consultarVenta(venta) {
    setCargandoDetalle(true);
    setDetalleVenta(null);
    setDetalleComprobante(null);
    setError("");
    setMensaje("");

    try {
      const respuesta = await fetch(
        `${API}/venta/${venta.IdVenta}`,
        {
          headers: obtenerCabeceras()
        }
      );

      const datos = await leerRespuesta(respuesta);

      setDetalleVenta(datos);

    } catch (err) {
      setError(
        err.message || "No se pudo consultar el detalle de la venta."
      );
    } finally {
      setCargandoDetalle(false);
    }
  }

  // =========================================
  // GENERAR COMPROBANTE DE UNA VENTA PENDIENTE
  // =========================================

  async function generarComprobante(idVenta) {
    const confirmar = window.confirm(
      `¿Deseas generar el comprobante de la venta ${idVenta}?`
    );

    if (!confirmar) return;

    setGenerandoIdVenta(idVenta);
    setError("");
    setMensaje("");

    try {
      const respuesta = await fetch(API, {
        method: "POST",
        headers: obtenerCabeceras(),
        body: JSON.stringify({
          IdVenta: idVenta
        })
      });

      const datos = await leerRespuesta(respuesta);

      setDetalleComprobante(datos);
      setDetalleVenta(null);

      setMensaje(
        `Factura ${datos.factura.NumeroFactura} generada correctamente.`
      );

      await cargarPendientes();

      if (esAdministrador) {
        await cargarFacturas();
      }

    } catch (err) {
      setError(
        err.message || "No se pudo generar el comprobante."
      );
    } finally {
      setGenerandoIdVenta(null);
    }
  }

  // =========================================
  // CONSULTAR UN COMPROBANTE YA EMITIDO
  // =========================================

  async function consultarComprobante(factura) {
    setCargandoDetalle(true);
    setDetalleVenta(null);
    setDetalleComprobante(null);
    setError("");

    try {
      const respuesta = await fetch(
        `${API}/${factura.IdFactura}`,
        {
          headers: obtenerCabeceras()
        }
      );

      const datos = await leerRespuesta(respuesta);

      setDetalleComprobante(datos);

    } catch (err) {
      setError(
        err.message || "No se pudo consultar el comprobante."
      );
    } finally {
      setCargandoDetalle(false);
    }
  }

  // =========================================
  // DESCARGAR UN PDF CON TODAS LAS FACTURAS
  // =========================================

  async function descargarTodasLasFacturas() {
    if (!esAdministrador || generandoPdf) return;

    setGenerandoPdf(true);
    setError("");
    setMensaje("");

    try {
      // Solicitar todos los comprobantes y sus productos.
      // Esta consulta no utiliza el filtro de búsqueda.
      const respuesta = await fetch(`${API}/reporte`, {
        headers: obtenerCabeceras()
      });

      const datos = await leerRespuesta(respuesta);

      if (!Array.isArray(datos) || datos.length === 0) {
        setMensaje("No hay comprobantes emitidos para incluir en el PDF.");
        return;
      }

      const documento = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const anchoPagina = documento.internal.pageSize.getWidth();
      const altoPagina = documento.internal.pageSize.getHeight();
      const margen = 14;

      // Agregar cada comprobante al mismo archivo PDF.
      datos.forEach((comprobante, indice) => {
        if (indice > 0) {
          documento.addPage();
        }

        documento.setFont("helvetica", "bold");
        documento.setFontSize(16);

        documento.text(
          "PANADERIA EMMANUEL",
          anchoPagina / 2,
          17,
          { align: "center" }
        );

        documento.setFontSize(12);

        documento.text(
          "COMPROBANTE DE VENTA",
          anchoPagina / 2,
          25,
          { align: "center" }
        );

        documento.setFont("helvetica", "normal");
        documento.setFontSize(9);

        documento.text(
          `Numero: ${comprobante.factura.NumeroFactura}`,
          margen,
          38
        );

        documento.text(
          `Fecha de emision: ${formatoFecha(comprobante.factura.FechaEmision)}`,
          margen,
          45
        );

        documento.text(
          `Venta: #${comprobante.venta.IdVenta}`,
          margen,
          52
        );

        documento.text(
          `Fecha de venta: ${formatoFecha(comprobante.venta.FechaVenta)}`,
          margen,
          59
        );

        documento.text(
          `Metodo de pago: ${comprobante.venta.MetodoPago}`,
          margen,
          66
        );

        documento.text(
          `Canal de venta: ${comprobante.venta.CanalVenta}`,
          margen,
          73
        );

        autoTable(documento, {
          startY: 82,

          head: [[
            "Producto",
            "Cantidad",
            "Precio unitario",
            "Subtotal"
          ]],

          body: agruparProductos(comprobante.productos).map((producto) => [
            producto.NombreProducto,
            String(producto.Cantidad),
            formatoMoneda(producto.PrecioUnitario),
            formatoMoneda(producto.Subtotal)
          ]),

          theme: "grid",

          margin: {
            left: margen,
            right: margen
          },

          styles: {
            font: "helvetica",
            fontSize: 8,
            cellPadding: 3
          },

          headStyles: {
            fillColor: [54, 118, 74],
            textColor: [255, 255, 255]
          },

          columnStyles: {
            1: { halign: "center" },
            2: { halign: "right" },
            3: { halign: "right" }
          }
        });

        let posicionTotal =
          documento.lastAutoTable.finalY + 12;

        // Si no queda espacio para el total, usar una página nueva.
        if (posicionTotal > altoPagina - 20) {
          documento.addPage();
          posicionTotal = 20;
        }

        documento.setFont("helvetica", "bold");
        documento.setFontSize(12);

        documento.text(
          `TOTAL: ${formatoMoneda(comprobante.venta.Total)}`,
          anchoPagina - margen,
          posicionTotal,
          { align: "right" }
        );

        documento.setFont("helvetica", "normal");
        documento.setFontSize(8);

        documento.text(
          "Comprobante interno de venta. No constituye una factura fiscal oficial.",
          anchoPagina / 2,
          Math.min(posicionTotal + 12, altoPagina - 15),
          { align: "center" }
        );
      });

      // Numerar las páginas del documento completo.
      const totalPaginas = documento.getNumberOfPages();

      for (let pagina = 1; pagina <= totalPaginas; pagina++) {
        documento.setPage(pagina);

        documento.setFont("helvetica", "normal");
        documento.setFontSize(8);

        documento.text(
          `Pagina ${pagina} de ${totalPaginas}`,
          anchoPagina - margen,
          altoPagina - 8,
          { align: "right" }
        );
      }

      const fechaArchivo = new Date()
        .toISOString()
        .slice(0, 10);

      documento.save(
        `Comprobantes_Panaderia_Emmanuel_${fechaArchivo}.pdf`
      );

      setMensaje(
        `PDF generado correctamente. Se incluyeron ${datos.length} comprobantes.`
      );

    } catch (err) {
      setError(
        err.message || "No se pudo generar el PDF de comprobantes."
      );
    } finally {
      setGenerandoPdf(false);
    }
  }

  return (
    <section className="facturacion-page">

      
<header className="facturacion-header">
  <div className="facturacion-header-contenido">

  <div className="facturacion-header-texto">
    <p>
      Genera facturas y consulta los documentos emitidos.
    </p>
  </div>

  <div className="facturacion-header-ilustracion">
    <IlustracionFactura />
  </div>



  </div>
        <button
          type="button"
          className="facturacion-btn secundario"
          onClick={() => {
            cargarPendientes();

            if (esAdministrador) {
              cargarFacturas();
            }
          }}
          disabled={cargandoPendientes || cargandoFacturas}
        >
          Actualizar información
        </button>
      </header>

      {(error || mensaje) && (
        <div
          className={`facturacion-toast ${error ? "error" : "success"}`}
          role={error ? "alert" : "status"}
          aria-live="polite"
        >
          <span className="facturacion-toast-icon" aria-hidden="true">
            {error ? "!" : "✓"}
          </span>
          <span className="facturacion-toast-text">{error || mensaje}</span>
          <button
            type="button"
            className="facturacion-toast-cerrar"
            aria-label="Cerrar notificación"
            onClick={() => {
              setError("");
              setMensaje("");
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* =====================================
          SECCIÓN 1: VENTAS SIN COMPROBANTE
      ====================================== */}

      <section className="facturacion-panel">

        <div className="facturacion-panel-titulo">
          <div>
            <h3>Ventas pendientes de comprobante</h3>

            <p>
              Estas ventas ya fueron registradas, pero todavía no
              tienen un comprobante emitido.
            </p>
          </div>

          <span className="facturacion-contador">
            {pendientes.length}
          </span>
        </div>

        {cargandoPendientes ? (
          <p className="facturacion-vacio">
            Consultando ventas pendientes...
          </p>
        ) : pendientes.length === 0 ? (
          <p className="facturacion-vacio">
            No hay ventas pendientes de facturación.
          </p>
        ) : (
          <div className="facturacion-tabla-contenedor">
            <table className="facturacion-tabla">
              <thead>
                <tr>
                  <th>Venta</th>
                  <th>Fecha</th>
                  <th>Método de pago</th>
                  <th>Total</th>
                  <th>Acción</th>
                </tr>
              </thead>

              <tbody>
                {pendientes.map((venta) => (
                  <tr key={venta.IdVenta}>
                    <td>#{venta.IdVenta}</td>

                    <td>{formatoFecha(venta.FechaVenta)}</td>

                    <td>{venta.MetodoPago}</td>

                    <td>{formatoMoneda(venta.Total)}</td>

                    <td>
                      <button
                        type="button"
                        className="facturacion-btn ver"
                        onClick={() => consultarVenta(venta)}
                        disabled={Boolean(generandoIdVenta)}
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* DETALLE DE UNA VENTA PENDIENTE */}

      {cargandoDetalle && (
        <section className="facturacion-panel">
          <p className="facturacion-vacio">
            Consultando detalle...
          </p>
        </section>
      )}

      {detalleVenta && (
        <div
          className="facturacion-modal-overlay"
          role="presentation"
          onClick={() => setDetalleVenta(null)}
        >
        <section
          className="facturacion-panel facturacion-detalle facturacion-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-detalle-venta"
          onClick={(evento) => evento.stopPropagation()}
        >

          <div className="facturacion-detalle-encabezado">
            <div>
              <h3 id="titulo-detalle-venta">
                Detalle de la venta #{detalleVenta.venta.IdVenta}
              </h3>

              <p>
                Esta venta todavía no tiene comprobante.
              </p>
            </div>

            <button
              type="button"
              className="facturacion-btn secundario"
              onClick={() => setDetalleVenta(null)}
            >
              Cerrar
            </button>
          </div>

          <div className="comprobante-datos">
            <p>
              <strong>Fecha:</strong>{" "}
              {formatoFecha(detalleVenta.venta.FechaVenta)}
            </p>

            <p>
              <strong>Método de pago:</strong>{" "}
              {detalleVenta.venta.MetodoPago}
            </p>

            <p>
              <strong>Canal:</strong>{" "}
              {detalleVenta.venta.CanalVenta}
            </p>
          </div>

          <h4>Productos vendidos</h4>

          <div className="facturacion-tabla-contenedor">
            <table className="facturacion-tabla">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Precio</th>
                  <th>Subtotal</th>
                </tr>
              </thead>

              <tbody>
                {agruparProductos(detalleVenta.productos).map((producto) => (
                  <tr key={producto.IdProducto ?? producto.IdDetalle}>
                    <td>{producto.NombreProducto}</td>
                    <td>{producto.Cantidad}</td>
                    <td>{formatoMoneda(producto.PrecioUnitario)}</td>
                    <td>{formatoMoneda(producto.Subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="comprobante-total">
            <strong>Total de venta</strong>

            <strong>
              {formatoMoneda(detalleVenta.venta.Total)}
            </strong>
          </div>

          <button
            type="button"
            className="facturacion-btn principal"
            onClick={() => generarComprobante(detalleVenta.venta.IdVenta)}
            disabled={Boolean(generandoIdVenta)}
          >
            {generandoIdVenta
              ? "Generando comprobante..."
              : "Generar comprobante"}
          </button>
        </section>
        </div>
      )}

      {/* =====================================
          SECCIÓN 2: HISTORIAL DE COMPROBANTES
          Solo Administrador
      ====================================== */}

      {esAdministrador && (
        <section className="facturacion-panel">

          <div className="facturacion-panel-titulo facturacion-historial-encabezado">
            <div>
              <h3>Comprobantes emitidos</h3>

              <p>
                Consulta, busca y descarga los comprobantes registrados.
              </p>
            </div>

            <button
              type="button"
              className="facturacion-btn principal"
              onClick={descargarTodasLasFacturas}
              disabled={generandoPdf || facturas.length === 0}
            >
              {generandoPdf
                ? "Preparando PDF..."
                : "Descargar todas las facturas en PDF"}
            </button>
          </div>

          <div className="facturacion-historial-resumen">
            <strong>{facturas.length}</strong>
            <span>Comprobantes emitidos</span>
          </div>

          <input
            type="search"
            className="facturacion-busqueda"
            placeholder="Buscar por número de comprobante o venta..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />

          {cargandoFacturas ? (
            <p className="facturacion-vacio">
              Cargando historial de comprobantes...
            </p>
          ) : facturasFiltradas.length === 0 ? (
            <p className="facturacion-vacio">
              {facturas.length === 0
                ? "Todavía no hay comprobantes emitidos."
                : "No se encontraron comprobantes con esa búsqueda."}
            </p>
          ) : (
            <div className="facturacion-tabla-contenedor">
              <table className="facturacion-tabla">
                <thead>
  <tr>
    <th>Número de comprobante</th>
    <th>Venta</th>
    <th>Fecha de emisión</th>
    <th>Estado</th>
    <th>Total</th>
    <th>Acción</th>
  </tr>
</thead>

                <tbody>
                  {facturasFiltradas.map((factura) => (
                    <tr key={factura.IdFactura}>
                      <td>{factura.NumeroFactura}</td>

<td>#{factura.IdVenta}</td>

<td>{formatoFecha(factura.FechaEmision)}</td>

<td>
  <span
    className={`facturacion-estado ${
      factura.EstadoFactura === "Anulada"
        ? "anulada"
        : "vigente"
    }`}
  >
    {factura.EstadoFactura || "Vigente"}
  </span>
</td>

<td>{formatoMoneda(factura.Total)}</td>

                      <td>
                        <button
                          type="button"
                          className="facturacion-btn ver"
                          onClick={() => consultarComprobante(factura)}
                          disabled={cargandoDetalle}
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* =====================================
          DETALLE DE COMPROBANTE EMITIDO
      ====================================== */}

      {detalleComprobante && (
        <div
          className="facturacion-modal-overlay"
          role="presentation"
          onClick={() => setDetalleComprobante(null)}
        >
        <section
          className="facturacion-panel facturacion-detalle facturacion-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-detalle-comprobante"
          onClick={(evento) => evento.stopPropagation()}
        >

          <div className="facturacion-detalle-encabezado">
            <div>
              <h3 id="titulo-detalle-comprobante">Comprobante de venta</h3>

              <p>
                {detalleComprobante.factura.NumeroFactura}
              </p>
            </div>

            <button
              type="button"
              className="facturacion-btn secundario facturacion-no-imprimir"
              onClick={() => setDetalleComprobante(null)}
            >
              Cerrar comprobante
            </button>
          </div>

          <div className="facturacion-comprobante">

            <div className="comprobante-encabezado">
              <h2>PANADERÍA EMMANUEL</h2>
              <p>COMPROBANTE DE VENTA</p>
            </div>

            <div className="comprobante-datos">
              <p>
                <strong>Número:</strong>{" "}
                {detalleComprobante.factura.NumeroFactura}
              </p>

              <p>
                <strong>Fecha de emisión:</strong>{" "}
                {formatoFecha(detalleComprobante.factura.FechaEmision)}
              </p>

              <p>
                <strong>Venta:</strong>{" "}
                #{detalleComprobante.venta.IdVenta}
              </p>

              <p>
                <strong>Fecha de venta:</strong>{" "}
                {formatoFecha(detalleComprobante.venta.FechaVenta)}
              </p>

              <p>
                <strong>Método de pago:</strong>{" "}
                {detalleComprobante.venta.MetodoPago}
              </p>


              <p>
                <strong>Canal:</strong>{" "}
                {detalleComprobante.venta.CanalVenta}
              </p>

<p>
  <strong>Estado de la factura:</strong>{" "}
  <span
    className={`facturacion-estado ${
      detalleComprobante.factura.EstadoFactura === "Anulada"
        ? "anulada"
        : "vigente"
    }`}
  >
    {detalleComprobante.factura.EstadoFactura || "Vigente"}
  </span>
</p>

{detalleComprobante.factura.EstadoFactura === "Anulada" && (
  <>
    <p>
      <strong>Fecha de anulación:</strong>{" "}
      {formatoFecha(
        detalleComprobante.factura.FechaAnulacion
      )}
    </p>

    <p className="facturacion-motivo-anulacion">
      <strong>Motivo de anulación:</strong>{" "}
      {detalleComprobante.factura.MotivoAnulacion ||
        "No se registró un motivo."}
    </p>
  </>
)}

            </div>

            <h3>Productos vendidos</h3>

            <div className="facturacion-tabla-contenedor">
              <table className="facturacion-tabla">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Precio</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>

                <tbody>
                  {agruparProductos(detalleComprobante.productos).map((producto) => (
                    <tr key={producto.IdProducto ?? producto.IdDetalle}>
                      <td>{producto.NombreProducto}</td>
                      <td>{producto.Cantidad}</td>
                      <td>{formatoMoneda(producto.PrecioUnitario)}</td>
                      <td>{formatoMoneda(producto.Subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="comprobante-total">
              <span>TOTAL</span>

              <strong>
                {formatoMoneda(detalleComprobante.venta.Total)}
              </strong>
            </div>

           

            <div className="facturacion-acciones facturacion-no-imprimir">
              <button
                type="button"
                className="facturacion-btn principal"
                onClick={() => window.print()}
              >
                Imprimir comprobante
              </button>

              <button
                type="button"
                className="facturacion-btn secundario"
                onClick={() => setDetalleComprobante(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </section>
        </div>
      )}

    </section>
  );
}

