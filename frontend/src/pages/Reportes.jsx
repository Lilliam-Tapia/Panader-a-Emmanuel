
import { useState } from "react";
import "../style/Reportes.css";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

const API = "/api/reportes";

function fechaActual() {
  const hoy = new Date();

  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");

  return `${anio}-${mes}-${dia}`;
}

function primerDiaMes() {
  const hoy = new Date();

  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");

  return `${anio}-${mes}-01`;
}

function formatoMoneda(valor) {
  return `C$ ${Number(valor || 0).toLocaleString("es-NI", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatoFecha(fecha) {
  if (!fecha) return "—";

  return new Date(fecha).toLocaleString("es-NI", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function Reportes() {
  const [desde, setDesde] = useState(primerDiaMes());
  const [hasta, setHasta] = useState(fechaActual());

  // Estados del reporte por período
  const [resumen, setResumen] = useState(null);
  const [ventas, setVentas] = useState([]);
  const [ventasDiarias, setVentasDiarias] = useState([]);

  // Estados del reporte por producto
  const [resumenProductos, setResumenProductos] = useState(null);
  const [productos, setProductos] = useState([]);

  const [cargando, setCargando] = useState(false);
  const [cargandoProductos, setCargandoProductos] = useState(false);

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  // Estados del reporte por canal
const [canales, setCanales] = useState([]);
const [cargandoCanales, setCargandoCanales] = useState(false);

  // =============================================
  // VALIDAR FECHAS
  // =============================================

  function validarFechas() {
    if (!desde || !hasta) {
      setError("Selecciona la fecha inicial y la fecha final.");
      return false;
    }

    if (desde > hasta) {
      setError(
        "La fecha inicial no puede ser posterior a la fecha final."
      );
      return false;
    }

    return true;
  }

  // =============================================
  // REPORTE DE VENTAS POR PERÍODO
  // =============================================

  async function generarReporte() {
    setError("");
    setMensaje("");
    setResumen(null);
    setVentas([]);
    setVentasDiarias([]);

    if (!validarFechas()) return;

    const token = localStorage.getItem("token");

    if (!token) {
      setError("Tu sesión ha expirado. Inicia sesión nuevamente.");
      return;
    }

    try {
      setCargando(true);

      const parametros = new URLSearchParams({
        desde,
        hasta,
      });

      const respuesta = await fetch(
        `${API}/ventas-periodo?${parametros.toString()}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const resultado = await respuesta.json().catch(() => ({}));

      if (!respuesta.ok) {
        throw new Error(
          resultado.mensaje ||
          "No se pudo generar el reporte de ventas."
        );
      }

      setResumen(resultado.resumen || {
        CantidadVentas: 0,
        TotalVendido: 0,
      });

      setVentas(
        Array.isArray(resultado.ventas)
          ? resultado.ventas
          : []
      );

      setVentasDiarias(
        Array.isArray(resultado.ventasDiarias)
          ? resultado.ventasDiarias
          : []
      );

      setMensaje("Reporte de ventas por período generado correctamente.");

    } catch (err) {
      setError(
        err.message || "Ocurrió un error al generar el reporte."
      );
    } finally {
      setCargando(false);
    }
  }

  // =============================================
  // REPORTE DE VENTAS POR PRODUCTO
  // =============================================

  async function generarReporteProductos() {
    setError("");
    setMensaje("");
    setResumenProductos(null);
    setProductos([]);

    if (!validarFechas()) return;

    const token = localStorage.getItem("token");

    if (!token) {
      setError("Tu sesión ha expirado. Inicia sesión nuevamente.");
      return;
    }

    try {
      setCargandoProductos(true);

      const parametros = new URLSearchParams({
        desde,
        hasta,
      });

      const respuesta = await fetch(
        `${API}/ventas-producto?${parametros.toString()}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const resultado = await respuesta.json().catch(() => ({}));

      if (!respuesta.ok) {
        throw new Error(
          resultado.mensaje ||
          "No se pudo generar el reporte de ventas por producto."
        );
      }

      setResumenProductos({
        cantidadProductos: resultado.cantidadProductos || 0,
        totalUnidades: resultado.totalUnidades || 0,
      });

      setProductos(
        Array.isArray(resultado.productos)
          ? resultado.productos
          : []
      );

      setMensaje("Reporte de ventas por producto generado correctamente.");

    } catch (err) {
      setError(
        err.message || "Ocurrió un error al generar el reporte por producto."
      );
    } finally {
      setCargandoProductos(false);
    }
  }

  // =============================================
// REPORTE DE VENTAS POR CANAL
// =============================================

async function generarReporteCanales() {
  setError("");
  setMensaje("");
  setCanales([]);

  if (!validarFechas()) return;

  const token = localStorage.getItem("token");

  if (!token) {
    setError("Tu sesión ha expirado. Inicia sesión nuevamente.");
    return;
  }

  try {
    setCargandoCanales(true);

    const parametros = new URLSearchParams({
      desde,
      hasta,
    });

    const respuesta = await fetch(
      `${API}/ventas-canal?${parametros.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const resultado = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
      throw new Error(
        resultado.mensaje ||
        "No se pudo generar el reporte de ventas por canal."
      );
    }

    setCanales(
      Array.isArray(resultado.canales)
        ? resultado.canales
        : []
    );

    setMensaje("Reporte de ventas por canal generado correctamente.");

  } catch (err) {
    setError(
      err.message || "Ocurrió un error al generar el reporte por canal."
    );
  } finally {
    setCargandoCanales(false);
  }
}

  return (
    <main className="reportes-page">

      <header className="reportes-header">
        <div>
          <h2>Reportes comerciales</h2>

          <p>
            Consulta y analiza las operaciones de venta de
            Panadería Emmanuel.
          </p>
        </div>

        <span className="reportes-etiqueta">
          Panel administrativo
        </span>
      </header>

      {error && (
        <div className="reportes-error" role="alert">
          {error}
        </div>
      )}

      {mensaje && (
        <div className="reportes-mensaje" role="status">
          {mensaje}
        </div>
      )}

      {/* =====================================
          FILTRO DE FECHAS
      ===================================== */}

      <section className="reportes-panel">

        <h3>Período de consulta</h3>

        <p className="reportes-descripcion">
          Selecciona las fechas para consultar los reportes comerciales.
        </p>

        <div className="reportes-filtros">

          <div className="reportes-campo">
            <label htmlFor="fechaDesde">
              Fecha inicial
            </label>

            <input
              id="fechaDesde"
              type="date"
              value={desde}
              max={hasta || undefined}
              onChange={(e) => setDesde(e.target.value)}
            />
          </div>

          <div className="reportes-campo">
            <label htmlFor="fechaHasta">
              Fecha final
            </label>

            <input
              id="fechaHasta"
              type="date"
              value={hasta}
              min={desde || undefined}
              max={fechaActual()}
              onChange={(e) => setHasta(e.target.value)}
            />
          </div>

        </div>
      </section>

      {/* =====================================
          REPORTE DE VENTAS POR PERÍODO
      ===================================== */}

      <section className="reportes-panel">

        <h3>Reporte de ventas por período</h3>

        <p className="reportes-descripcion">
          Consulta las ventas completadas durante el período seleccionado.
        </p>

        <button
          type="button"
          className="reportes-generar"
          onClick={generarReporte}
          disabled={cargando}
        >
          {cargando ? "Generando..." : "Generar reporte de ventas"}
        </button>

      </section>

      {resumen && (
        <>
          <section className="reportes-resumen">

            <article className="reportes-indicador">
              <span>Cantidad de ventas</span>

              <strong>
                {Number(resumen.CantidadVentas || 0)}
              </strong>
            </article>

            <article className="reportes-indicador">
              <span>Total vendido</span>

              <strong>
                {formatoMoneda(resumen.TotalVendido)}
              </strong>
            </article>

          </section>
          
          <section className="reportes-panel">

  <h3>Gráfico de ventas por día</h3>

  <p className="reportes-descripcion">
    Visualización de los ingresos obtenidos durante
    el período seleccionado.
  </p>

  {ventasDiarias.length > 0 ? (
    <div style={{ width: "100%", height: 320 }}>

      <ResponsiveContainer width="100%" height="100%">

        <BarChart
          data={ventasDiarias}
          margin={{
            top: 15,
            right: 20,
            left: 10,
            bottom: 10
          }}
        >

          <CartesianGrid strokeDasharray="3 3" />

          <XAxis
  dataKey="Fecha"
  interval={0}
  tick={{ fontSize: 12 }}
  tickFormatter={(fecha) =>
    new Date(fecha).toLocaleDateString("es-NI", {
      day: "2-digit",
      month: "short",
      timeZone: "UTC"
    })
  }
/>

          <YAxis />

          <Tooltip
            cursor={{ fill: "transparent" }}
            formatter={(valor) => [
              formatoMoneda(valor),
              "Total vendido"
            ]}
            labelFormatter={(fecha) =>
              new Date(fecha).toLocaleDateString("es-NI", {
                dateStyle: "long",
                timeZone: "UTC"
              })
            }
          />

          <Bar
  dataKey="TotalVendido"
  name="Total vendido"
  fill="#3b82f6"
  maxBarSize={65}
  radius={[6, 6, 0, 0]}
/>

        </BarChart>

      </ResponsiveContainer>

    </div>
  ) : (
    <p className="reportes-tabla-vacio">
      No hay ventas registradas para representar en el gráfico.
    </p>
  )}

</section>


          <section className="reportes-panel">

            <h3>Detalle de ventas</h3>

            <p className="reportes-descripcion">
              Ventas completadas desde el {desde} hasta el {hasta}.
            </p>

            <div className="reportes-tabla-contenedor">

              <table className="reportes-tabla">

                <thead>
                  <tr>
                    <th>N.º de venta</th>
                    <th>Fecha</th>
                    <th>Método de pago</th>
                    <th>Canal de venta</th>
                    <th>Total</th>
                    <th>Estado</th>
                  </tr>
                </thead>

                <tbody>

                  {ventas.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="reportes-tabla-vacio">
                        No se encontraron ventas en el período seleccionado.
                      </td>
                    </tr>
                  ) : (
                    ventas.map((venta) => (
                      <tr key={venta.IdVenta}>

                        <td>#{venta.IdVenta}</td>

                        <td>{formatoFecha(venta.FechaVenta)}</td>

                        <td>{venta.MetodoPago}</td>

                        <td>{venta.CanalVenta}</td>

                        <td className="reportes-total">
                          {formatoMoneda(venta.Total)}
                        </td>

                        <td>
                          <span className="reportes-estado">
                            Completada
                          </span>
                        </td>

                      </tr>
                    ))
                  )}

                </tbody>

              </table>

            </div>

          </section>
        </>
      )}

      {/* =====================================
          REPORTE DE VENTAS POR PRODUCTO
      ===================================== */}

      <section className="reportes-panel">

        <h3>Reporte de ventas por producto</h3>

        <p className="reportes-descripcion">
          Identifica los productos con mayor movimiento,
          la cantidad de unidades vendidas y los ingresos generados.
        </p>

        <button
          type="button"
          className="reportes-generar"
          onClick={generarReporteProductos}
          disabled={cargandoProductos}
        >
          {cargandoProductos
            ? "Generando..."
            : "Generar reporte por producto"}
        </button>

      </section>

      {resumenProductos && (
        <>
          {/* INDICADORES */}
          <section className="reportes-resumen">

            <article className="reportes-indicador">
              <span>Productos vendidos</span>

              <strong>
                {Number(resumenProductos.cantidadProductos)}
              </strong>
            </article>

            <article className="reportes-indicador">
              <span>Total de unidades vendidas</span>

              <strong>
                {Number(resumenProductos.totalUnidades)}
              </strong>
            </article>

            {/*AQUIIIIIII*/}
                      <section className="reportes-panel">

            <h3>Gráfico de ventas por producto</h3>

            <p className="reportes-descripcion">
              Comparación de las unidades vendidas por cada producto
              durante el período seleccionado.
            </p>

            {productos.length > 0 ? (
              <div style={{ width: "100%", height: Math.max(280, productos.length * 65) }}>

                <ResponsiveContainer width="100%" height="100%">

                  <BarChart
                    data={productos}
                    layout="vertical"
                    margin={{
                      top: 10,
                      right: 25,
                      left: 15,
                      bottom: 10
                    }}
                  >

                    <CartesianGrid strokeDasharray="3 3" />

                    <XAxis
                      type="number"
                      allowDecimals={false}
                    />

                    <YAxis
                      type="category"
                      dataKey="NombreProducto"
                      width={140}
                      tick={{ fontSize: 12 }}
                    />

                    <Tooltip
                      cursor={{ fill: "transparent" }}
                      content={({ active, payload }) => {

                        if (active && payload && payload.length > 0) {

                          const producto = payload[0].payload;

                          return (
                            <div style={{
                              background: "#ffffff",
                              border: "1px solid #e2e8f0",
                              borderRadius: "10px",
                              padding: "12px 15px",
                              boxShadow: "0 4px 12px rgba(0,0,0,0.10)"
                            }}>

                              <strong style={{
                                display: "block",
                                marginBottom: "8px",
                                color: "#263238"
                              }}>
                                {producto.NombreProducto}
                              </strong>

                              <p style={{ margin: "4px 0" }}>
                                Cantidad vendida:{" "}
                                <strong>
                                  {Number(producto.CantidadVendida)}
                                </strong>
                              </p>

                              <p style={{ margin: "4px 0" }}>
                                Número de ventas:{" "}
                                <strong>
                                  {Number(producto.NumeroVentas)}
                                </strong>
                              </p>

                              <p style={{ margin: "4px 0" }}>
                                Total generado:{" "}
                                <strong style={{ color: "#287a48" }}>
                                  {formatoMoneda(producto.TotalGenerado)}
                                </strong>
                              </p>

                            </div>
                          );
                        }

                        return null;
                      }}
                    />

                    <Bar
                      dataKey="CantidadVendida"
                      name="Unidades vendidas"
                      fill="#3b82f6"
                      maxBarSize={35}
                      radius={[0, 6, 6, 0]}
                    />

                  </BarChart>

                </ResponsiveContainer>

              </div>
            ) : (
              <p className="reportes-tabla-vacio">
                No hay productos vendidos para representar en el gráfico.
              </p>
            )}

          </section>


          </section>

          {/* GRÁFICO DE PRODUCTOS */}
          <section className="reportes-panel">

            <h3>Detalle de ventas por producto</h3>

            <p className="reportes-descripcion">
              Productos vendidos desde el {desde} hasta el {hasta}.
            </p>

            <div className="reportes-tabla-contenedor">

              <table className="reportes-tabla">

                <thead>
                  <tr>
                    <th>N.º</th>
                    <th>Producto</th>
                    <th>Cantidad vendida</th>
                    <th>Número de ventas</th>
                    <th>Total generado</th>
                  </tr>
                </thead>

                <tbody>

                  {productos.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="reportes-tabla-vacio">
                        No se encontraron productos vendidos en el período seleccionado.
                      </td>
                    </tr>
                  ) : (
                    productos.map((producto) => (
                      <tr key={producto.IdProducto}>

                        <td>{producto.IdProducto}</td>

                        <td>{producto.NombreProducto}</td>

                        <td>
                          {Number(producto.CantidadVendida || 0)}
                        </td>

                        <td>
                          {Number(producto.NumeroVentas || 0)}
                        </td>

                        <td className="reportes-total">
                          {formatoMoneda(producto.TotalGenerado)}
                        </td>

                      </tr>
                    ))
                  )}

                </tbody>

              </table>

            </div>

          </section>
        </>
      )}

      {/* =====================================
    REPORTE DE VENTAS POR CANAL
===================================== */}

<section className="reportes-panel">

  <h3>Reporte de ventas por canal</h3>

  <p className="reportes-descripcion">
    Consulta la cantidad de ventas y los ingresos generados
    según el canal de venta utilizado.
  </p>

  <button
    type="button"
    className="reportes-generar"
    onClick={generarReporteCanales}
    disabled={cargandoCanales}
  >
    {cargandoCanales
      ? "Generando..."
      : "Generar reporte por canal"}
  </button>

</section>

{canales.length > 0 && (
  <section className="reportes-panel">

    
<h3>Gráfico de ventas por canal</h3>

<p className="reportes-descripcion">
  Comparación de la cantidad de ventas realizadas
  según el canal de comercialización.
</p>

{canales.length > 0 ? (
  <div style={{ width: "100%", height: 320 }}>

    <ResponsiveContainer width="100%" height="100%">

      <BarChart
        data={canales}
        margin={{
          top: 15,
          right: 25,
          left: 10,
          bottom: 10
        }}
      >

        <CartesianGrid strokeDasharray="3 3" />

        <XAxis
          dataKey="CanalVenta"
          tick={{ fontSize: 12 }}
        />

        <YAxis
          allowDecimals={false}
        />

        <Tooltip
          cursor={{ fill: "transparent" }}
          content={({ active, payload }) => {

            if (active && payload && payload.length > 0) {

              const canal = payload[0].payload;

              return (
                <div style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  padding: "12px 15px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.10)"
                }}>

                  <strong style={{
                    display: "block",
                    marginBottom: "8px",
                    color: "#263238"
                  }}>
                    {canal.CanalVenta}
                  </strong>

                  <p style={{ margin: "4px 0" }}>
                    Cantidad de ventas:{" "}
                    <strong>
                      {Number(canal.CantidadVentas)}
                    </strong>
                  </p>

                  <p style={{ margin: "4px 0" }}>
                    Total generado:{" "}
                    <strong style={{ color: "#287a48" }}>
                      {formatoMoneda(canal.TotalGenerado)}
                    </strong>
                  </p>

                </div>
              );
            }

            return null;
          }}
        />

        <Bar
          dataKey="CantidadVentas"
          name="Cantidad de ventas"
          fill="#3b82f6"
          maxBarSize={65}
          radius={[6, 6, 0, 0]}
        />

      </BarChart>

    </ResponsiveContainer>

  </div>
) : (
  <p className="reportes-tabla-vacio">
    No hay ventas registradas por canal para representar en el gráfico.
  </p>
)}


    <h3>Detalle de ventas por canal</h3>

    <p className="reportes-descripcion">
      Ventas completadas desde el {desde} hasta el {hasta}.
    </p>

    <div className="reportes-tabla-contenedor">

      <table className="reportes-tabla">

        <thead>
          <tr>
            <th>Canal de venta</th>
            <th>Cantidad de ventas</th>
            <th>Total generado</th>
          </tr>
        </thead>

        <tbody>
          {canales.map((canal) => (
            <tr key={canal.CanalVenta}>
              <td>{canal.CanalVenta}</td>

              <td>
                {Number(canal.CantidadVentas || 0)}
              </td>

              <td className="reportes-total">
                {formatoMoneda(canal.TotalGenerado)}
              </td>
            </tr>
          ))}
        </tbody>

      </table>

    </div>

  </section>
)}

    </main>
  );
}
