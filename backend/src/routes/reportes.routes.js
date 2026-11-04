
const express = require('express');
const router = express.Router();

const { conectarBD, sql } = require('../config/database');

const {
  verificarToken,
  permitirRoles
} = require('../middlewares/auth.middleware');

// =============================================
// VALIDAR FORMATO DE FECHA
// =============================================

function fechaValida(fecha) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return false;
  }

  const fechaConvertida = new Date(`${fecha}T00:00:00.000Z`);

  return (
    !Number.isNaN(fechaConvertida.getTime()) &&
    fechaConvertida.toISOString().slice(0, 10) === fecha
  );
}

// =============================================
// REPORTE DE VENTAS POR PERÍODO
// GET /api/reportes/ventas-periodo?desde=2026-11-01&hasta=2026-11-30
// Solo Administrador
// =============================================

router.get(
  '/ventas-periodo',
  verificarToken,
  permitirRoles('Administrador'),
  async (req, res) => {
    const desde = String(req.query.desde || '');
    const hasta = String(req.query.hasta || '');

    if (!fechaValida(desde) || !fechaValida(hasta)) {
      return res.status(400).json({
        mensaje: 'Debes proporcionar fechas válidas en formato año-mes-día.'
      });
    }

    if (desde > hasta) {
      return res.status(400).json({
        mensaje: 'La fecha inicial no puede ser posterior a la fecha final.'
      });
    }

    try {
      const pool = await conectarBD();

      const resultado = await pool.request()
        .input('Desde', sql.Date, desde)
        .input('Hasta', sql.Date, hasta)
        .query(`
          SELECT
            COUNT(*) AS CantidadVentas,
            COALESCE(SUM(Total), 0) AS TotalVendido
          FROM dbo.Ventas
          WHERE
            Estado = 'Completada'
            AND FechaVenta >= DATEADD(HOUR, 6, CAST(@Desde AS DATETIME2))
            AND FechaVenta < DATEADD(
              HOUR,
              6,
              DATEADD(DAY, 1, CAST(@Hasta AS DATETIME2))
            );

           ;WITH Fechas AS (
  SELECT CAST(@Desde AS DATE) AS Fecha

  UNION ALL

  SELECT DATEADD(DAY, 1, Fecha)
  FROM Fechas
  WHERE Fecha < CAST(@Hasta AS DATE)
)
SELECT
  f.Fecha,
  COUNT(v.IdVenta) AS CantidadVentas,
  COALESCE(SUM(v.Total), 0) AS TotalVendido
FROM Fechas AS f
LEFT JOIN dbo.Ventas AS v
  ON v.Estado = 'Completada'
  AND v.FechaVenta >= DATEADD(
    HOUR, 6, CAST(f.Fecha AS DATETIME2)
  )
  AND v.FechaVenta < DATEADD(
    HOUR, 6, DATEADD(DAY, 1, CAST(f.Fecha AS DATETIME2))
  )
GROUP BY f.Fecha
ORDER BY f.Fecha
OPTION (MAXRECURSION 0);


          SELECT
            IdVenta,
            FechaVenta,
            MetodoPago,
            CanalVenta,
            Total
          FROM dbo.Ventas
          WHERE
            Estado = 'Completada'
            AND FechaVenta >= DATEADD(HOUR, 6, CAST(@Desde AS DATETIME2))
            AND FechaVenta < DATEADD(
              HOUR,
              6,
              DATEADD(DAY, 1, CAST(@Hasta AS DATETIME2))
            )
          ORDER BY FechaVenta DESC, IdVenta DESC;
        `);

      return res.json({
  desde,
  hasta,
  resumen: resultado.recordsets[0][0],
  ventasDiarias: resultado.recordsets[1],
  ventas: resultado.recordsets[2]
});

    } catch (error) {
      console.error(
        'Error al generar el reporte de ventas por período:',
        error
      );

      return res.status(500).json({
        mensaje: 'No se pudo generar el reporte de ventas por período.'
      });
    }
  }
);

// =============================================
// REPORTE DE VENTAS POR PRODUCTO
// GET /api/reportes/ventas-producto?desde=2026-11-01&hasta=2026-11-30
// Solo Administrador
// =============================================

router.get(
  '/ventas-producto',
  verificarToken,
  permitirRoles('Administrador'),
  async (req, res) => {
    const desde = String(req.query.desde || '');
    const hasta = String(req.query.hasta || '');

    if (!fechaValida(desde) || !fechaValida(hasta)) {
      return res.status(400).json({
        mensaje: 'Debes proporcionar fechas válidas en formato año-mes-día.'
      });
    }

    if (desde > hasta) {
      return res.status(400).json({
        mensaje: 'La fecha inicial no puede ser posterior a la fecha final.'
      });
    }

    try {
      const pool = await conectarBD();

      const resultado = await pool.request()
        .input('Desde', sql.Date, desde)
        .input('Hasta', sql.Date, hasta)
        .query(`
          SELECT
            p.IdProducto,
            p.NombreProducto,
            SUM(dv.Cantidad) AS CantidadVendida,
            COUNT(DISTINCT v.IdVenta) AS NumeroVentas,
            COALESCE(SUM(dv.Subtotal), 0) AS TotalGenerado
          FROM dbo.DetalleVenta AS dv
          INNER JOIN dbo.Ventas AS v
            ON dv.IdVenta = v.IdVenta
          INNER JOIN dbo.Productos AS p
            ON dv.IdProducto = p.IdProducto
          WHERE
            v.Estado = 'Completada'
            AND v.FechaVenta >= DATEADD(
              HOUR, 6, CAST(@Desde AS DATETIME2)
            )
            AND v.FechaVenta < DATEADD(
              HOUR,
              6,
              DATEADD(DAY, 1, CAST(@Hasta AS DATETIME2))
            )
          GROUP BY
            p.IdProducto,
            p.NombreProducto
          ORDER BY
            CantidadVendida DESC,
            p.NombreProducto ASC;
        `);

      return res.json({
        desde,
        hasta,
        cantidadProductos: resultado.recordset.length,
        totalUnidades: resultado.recordset.reduce(
          (total, producto) => total + producto.CantidadVendida,
          0
        ),
        productos: resultado.recordset
      });

    } catch (error) {
      console.error(
        'Error al generar el reporte de ventas por producto:',
        error
      );

      return res.status(500).json({
        mensaje: 'No se pudo generar el reporte de ventas por producto.'
      });
    }
  }
);

// =============================================
// REPORTE DE VENTAS POR CANAL
// GET /api/reportes/ventas-canal?desde=2026-11-01&hasta=2026-11-30
// Solo Administrador
// =============================================

router.get(
  '/ventas-canal',
  verificarToken,
  permitirRoles('Administrador'),
  async (req, res) => {
    const desde = String(req.query.desde || '');
    const hasta = String(req.query.hasta || '');

    if (!fechaValida(desde) || !fechaValida(hasta)) {
      return res.status(400).json({
        mensaje: 'Debes proporcionar fechas válidas en formato año-mes-día.'
      });
    }

    if (desde > hasta) {
      return res.status(400).json({
        mensaje: 'La fecha inicial no puede ser posterior a la fecha final.'
      });
    }

    try {
      const pool = await conectarBD();

      const resultado = await pool.request()
        .input('Desde', sql.Date, desde)
        .input('Hasta', sql.Date, hasta)
        .query(`
          SELECT
            c.CanalVenta,
            COUNT(v.IdVenta) AS CantidadVentas,
            COALESCE(SUM(v.Total), 0) AS TotalGenerado
          FROM (
            SELECT 'Presencial' AS CanalVenta
            UNION ALL
            SELECT 'Pedido' AS CanalVenta
          ) AS c
          LEFT JOIN dbo.Ventas AS v
            ON v.CanalVenta = c.CanalVenta
            AND v.Estado = 'Completada'
            AND v.FechaVenta >= DATEADD(
              HOUR, 6, CAST(@Desde AS DATETIME2)
            )
            AND v.FechaVenta < DATEADD(
              HOUR,
              6,
              DATEADD(DAY, 1, CAST(@Hasta AS DATETIME2))
            )
          GROUP BY c.CanalVenta
          ORDER BY c.CanalVenta;
        `);

      return res.json({
        desde,
        hasta,
        canales: resultado.recordset
      });

    } catch (error) {
      console.error(
        'Error al generar el reporte de ventas por canal:',
        error
      );

      return res.status(500).json({
        mensaje: 'No se pudo generar el reporte de ventas por canal.'
      });
    }
  }
);
module.exports = router;




