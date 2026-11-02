
const express = require('express');
const router = express.Router();

const { conectarBD, sql } = require('../config/database');

const {
  verificarToken,
  permitirRoles
} = require('../middlewares/auth.middleware');

// =============================================
// OBTENER TODAS LAS FACTURAS CON SUS PRODUCTOS
// GET /api/facturas/reporte
// Solo Administrador
// =============================================

router.get(
  '/reporte',
  verificarToken,
  permitirRoles('Administrador'),
  async (req, res) => {
    try {
      const pool = await conectarBD();

      const resultado = await pool.request().query(`
        SELECT
          F.IdFactura,
          F.NumeroFactura,
          F.FechaEmision,

          V.IdVenta,
          V.FechaVenta,
          V.MetodoPago,
          V.CanalVenta,
          V.Total,

          DV.IdDetalle,
          DV.IdProducto,
          P.NombreProducto,
          DV.Cantidad,
          DV.PrecioUnitario,
          DV.Subtotal

        FROM dbo.Facturas AS F

        INNER JOIN dbo.Ventas AS V
          ON V.IdVenta = F.IdVenta

        LEFT JOIN dbo.DetalleVenta AS DV
          ON DV.IdVenta = V.IdVenta

        LEFT JOIN dbo.Productos AS P
          ON P.IdProducto = DV.IdProducto

        ORDER BY
          F.FechaEmision DESC,
          F.IdFactura DESC,
          DV.IdDetalle ASC;
      `);

      const mapa = new Map();

      for (const fila of resultado.recordset) {
        if (!mapa.has(fila.IdFactura)) {
          mapa.set(fila.IdFactura, {
            factura: {
              IdFactura: fila.IdFactura,
              NumeroFactura: fila.NumeroFactura,
              FechaEmision: fila.FechaEmision
            },
            venta: {
              IdVenta: fila.IdVenta,
              FechaVenta: fila.FechaVenta,
              MetodoPago: fila.MetodoPago,
              CanalVenta: fila.CanalVenta,
              Total: fila.Total
            },
            productos: []
          });
        }

        if (fila.IdDetalle !== null) {
          mapa.get(fila.IdFactura).productos.push({
            IdDetalle: fila.IdDetalle,
            IdProducto: fila.IdProducto,
            NombreProducto: fila.NombreProducto,
            Cantidad: fila.Cantidad,
            PrecioUnitario: fila.PrecioUnitario,
            Subtotal: fila.Subtotal
          });
        }
      }

      return res.json(Array.from(mapa.values()));

    } catch (error) {
      console.error('Error al preparar el reporte de facturas:', error);

      return res.status(500).json({
        mensaje: 'No se pudo obtener la información de las facturas.'
      });
    }
  }
);


// =============================================
// CONSULTAR VENTAS QUE AÚN NO TIENEN FACTURA
// GET /api/facturas/pendientes
// =============================================
router.get('/pendientes', verificarToken, async (req, res) => {
  try {
    const pool = await conectarBD();

    const resultado = await pool.request().query(`
      SELECT
        V.IdVenta,
        V.FechaVenta,
        V.MetodoPago,
        V.CanalVenta,
        V.Total,
        COUNT(DV.IdDetalle) AS CantidadProductos
      FROM dbo.Ventas AS V
      INNER JOIN dbo.DetalleVenta AS DV
        ON DV.IdVenta = V.IdVenta
      WHERE
        V.Estado = 'Completada'
        AND NOT EXISTS (
          SELECT 1
          FROM dbo.Facturas AS F
          WHERE F.IdVenta = V.IdVenta
        )
      GROUP BY
        V.IdVenta,
        V.FechaVenta,
        V.MetodoPago,
        V.CanalVenta,
        V.Total
      ORDER BY V.FechaVenta DESC, V.IdVenta DESC;
    `);

    return res.json(resultado.recordset);
  } catch (error) {
    console.error('Error al consultar ventas pendientes:', error);

    return res.status(500).json({
      mensaje: 'No se pudieron consultar las ventas pendientes de facturación.'
    });
  }
});

// =============================================
// CONSULTAR EL DETALLE DE UNA VENTA PENDIENTE
// GET /api/facturas/venta/:idVenta
// =============================================
router.get('/venta/:idVenta', verificarToken, async (req, res) => {
  const idVenta = Number(req.params.idVenta);

  if (!Number.isInteger(idVenta) || idVenta <= 0) {
    return res.status(400).json({
      mensaje: 'El identificador de la venta no es válido.'
    });
  }

  try {
    const pool = await conectarBD();

    const ventaResultado = await pool.request()
      .input('IdVenta', sql.Int, idVenta)
      .query(`
        SELECT
          V.IdVenta,
          V.FechaVenta,
          V.MetodoPago,
          V.CanalVenta,
          V.Total,
          F.IdFactura
        FROM dbo.Ventas AS V
        LEFT JOIN dbo.Facturas AS F
          ON F.IdVenta = V.IdVenta
        WHERE V.IdVenta = @IdVenta
          AND V.Estado = 'Completada';
      `);

    if (ventaResultado.recordset.length === 0) {
      return res.status(404).json({
        mensaje: 'No se encontró una venta completada con ese identificador.'
      });
    }

    const venta = ventaResultado.recordset[0];

    if (venta.IdFactura !== null) {
      return res.status(409).json({
        mensaje: 'Esta venta ya tiene un comprobante generado.'
      });
    }

    const detalleResultado = await pool.request()
      .input('IdVenta', sql.Int, idVenta)
      .query(`
        SELECT
          DV.IdDetalle,
          DV.IdProducto,
          P.NombreProducto,
          DV.Cantidad,
          DV.PrecioUnitario,
          DV.Subtotal
        FROM dbo.DetalleVenta AS DV
        INNER JOIN dbo.Productos AS P
          ON P.IdProducto = DV.IdProducto
        WHERE DV.IdVenta = @IdVenta
        ORDER BY DV.IdDetalle;
      `);

    return res.json({
      venta: {
        IdVenta: venta.IdVenta,
        FechaVenta: venta.FechaVenta,
        MetodoPago: venta.MetodoPago,
        CanalVenta: venta.CanalVenta,
        Total: venta.Total
      },
      productos: detalleResultado.recordset
    });
  } catch (error) {
    console.error('Error al consultar el detalle de la venta:', error);

    return res.status(500).json({
      mensaje: 'No se pudo consultar el detalle de la venta.'
    });
  }
});

// =============================================
// GENERAR COMPROBANTE PARA UNA VENTA
// POST /api/facturas
// Recibe: { "IdVenta": 1 }
// =============================================
router.post('/', verificarToken, async (req, res) => {
  const idVenta = Number(req.body.IdVenta);

  if (!Number.isInteger(idVenta) || idVenta <= 0) {
    return res.status(400).json({
      mensaje: 'Debes proporcionar un identificador de venta válido.'
    });
  }

  let transaction;

  try {
    const pool = await conectarBD();

    transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    // 1. Buscar y bloquear la venta durante la generación.
    const ventaResultado = await new sql.Request(transaction)
      .input('IdVenta', sql.Int, idVenta)
      .query(`
        SELECT
          IdVenta,
          FechaVenta,
          MetodoPago,
          CanalVenta,
          Total
        FROM dbo.Ventas WITH (UPDLOCK, HOLDLOCK)
        WHERE IdVenta = @IdVenta
          AND Estado = 'Completada';
      `);

    if (ventaResultado.recordset.length === 0) {
      const error = new Error('No se encontró una venta completada con ese identificador.');
      error.status = 404;
      throw error;
    }

    const venta = ventaResultado.recordset[0];

    // 2. Comprobar que la venta todavía no tenga factura.
    const facturaExistente = await new sql.Request(transaction)
      .input('IdVenta', sql.Int, idVenta)
      .query(`
        SELECT IdFactura
        FROM dbo.Facturas WITH (UPDLOCK, HOLDLOCK)
        WHERE IdVenta = @IdVenta;
      `);

    if (facturaExistente.recordset.length > 0) {
      const error = new Error('Esta venta ya tiene un comprobante generado.');
      error.status = 409;
      throw error;
    }

    // 3. Obtener los productos que pertenecen a la venta.
    const detalleResultado = await new sql.Request(transaction)
      .input('IdVenta', sql.Int, idVenta)
      .query(`
        SELECT
          DV.IdDetalle,
          DV.IdProducto,
          P.NombreProducto,
          DV.Cantidad,
          DV.PrecioUnitario,
          DV.Subtotal
        FROM dbo.DetalleVenta AS DV
        INNER JOIN dbo.Productos AS P
          ON P.IdProducto = DV.IdProducto
        WHERE DV.IdVenta = @IdVenta
        ORDER BY DV.IdDetalle;
      `);

    if (detalleResultado.recordset.length === 0) {
      const error = new Error('La venta no tiene productos registrados.');
      error.status = 400;
      throw error;
    }

    // 4. Crear un número de comprobante basado en el IdVenta.
    const numeroFactura = `FAC-${String(idVenta).padStart(10, '0')}`;

    // 5. Guardar la factura. Los datos del cliente no se utilizan.
    const facturaResultado = await new sql.Request(transaction)
      .input('IdVenta', sql.Int, idVenta)
      .input('NumeroFactura', sql.VarChar(30), numeroFactura)
      .query(`
        INSERT INTO dbo.Facturas (
          IdVenta,
          NumeroFactura
        )
        OUTPUT
          INSERTED.IdFactura,
          INSERTED.IdVenta,
          INSERTED.NumeroFactura,
          INSERTED.FechaEmision
        VALUES (
          @IdVenta,
          @NumeroFactura
        );
      `);

    const factura = facturaResultado.recordset[0];

    await transaction.commit();
    transaction = null;

    // 6. Devolver el comprobante y el detalle de la venta.
    return res.status(201).json({
      mensaje: 'Comprobante generado correctamente.',
      factura,
      venta,
      productos: detalleResultado.recordset
    });

  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (errorRollback) {
        console.error('Error al revertir la generación del comprobante:', errorRollback);
      }
    }

    console.error('Error al generar comprobante:', error);

    return res.status(error.status || 500).json({
      mensaje: error.status
        ? error.message
        : 'No se pudo generar el comprobante.'
    });
  }
});

// =============================================
// CONSULTAR HISTORIAL DE COMPROBANTES
// GET /api/facturas
// Solo Administrador
// =============================================

router.get(
  '/',
  verificarToken,
  permitirRoles('Administrador'),
  async (req, res) => {
    try {
      const pool = await conectarBD();

      const busqueda = String(req.query.buscar || '')
        .trim()
        .slice(0, 40);

      const resultado = await pool.request()
        .input('Busqueda', sql.VarChar(40), busqueda)
        .query(`
          SELECT
            F.IdFactura,
            F.IdVenta,
            F.NumeroFactura,
            F.FechaEmision,
            V.FechaVenta,
            V.MetodoPago,
            V.CanalVenta,
            V.Total
          FROM dbo.Facturas AS F
          INNER JOIN dbo.Ventas AS V
            ON V.IdVenta = F.IdVenta
          WHERE
            @Busqueda = ''
            OR F.NumeroFactura LIKE '%' + @Busqueda + '%'
            OR CONVERT(VARCHAR(20), F.IdVenta)
               LIKE '%' + @Busqueda + '%'
          ORDER BY
            F.FechaEmision DESC,
            F.IdFactura DESC;
        `);

      return res.json(resultado.recordset);

    } catch (error) {
      console.error('Error al consultar comprobantes:', error);

      return res.status(500).json({
        mensaje: 'No se pudo consultar el historial de comprobantes.'
      });
    }
  }
);


// =============================================
// CONSULTAR DETALLE DE UN COMPROBANTE
// GET /api/facturas/:idFactura
// Solo Administrador
// =============================================

router.get(
  '/:idFactura',
  verificarToken,
  permitirRoles('Administrador'),
  async (req, res) => {
    const idFactura = Number(req.params.idFactura);

    if (!Number.isInteger(idFactura) || idFactura <= 0) {
      return res.status(400).json({
        mensaje: 'El identificador del comprobante no es válido.'
      });
    }

    try {
      const pool = await conectarBD();

      const facturaResultado = await pool.request()
        .input('IdFactura', sql.Int, idFactura)
        .query(`
          SELECT
            F.IdFactura,
            F.NumeroFactura,
            F.FechaEmision,
            V.IdVenta,
            V.FechaVenta,
            V.MetodoPago,
            V.CanalVenta,
            V.Total
          FROM dbo.Facturas AS F
          INNER JOIN dbo.Ventas AS V
            ON V.IdVenta = F.IdVenta
          WHERE F.IdFactura = @IdFactura;
        `);

      if (facturaResultado.recordset.length === 0) {
        return res.status(404).json({
          mensaje: 'No se encontró el comprobante solicitado.'
        });
      }

      const datos = facturaResultado.recordset[0];

      const productosResultado = await pool.request()
        .input('IdVenta', sql.Int, datos.IdVenta)
        .query(`
          SELECT
            DV.IdDetalle,
            DV.IdProducto,
            P.NombreProducto,
            DV.Cantidad,
            DV.PrecioUnitario,
            DV.Subtotal
          FROM dbo.DetalleVenta AS DV
          INNER JOIN dbo.Productos AS P
            ON P.IdProducto = DV.IdProducto
          WHERE DV.IdVenta = @IdVenta
          ORDER BY DV.IdDetalle;
        `);

      return res.json({
        factura: {
          IdFactura: datos.IdFactura,
          NumeroFactura: datos.NumeroFactura,
          FechaEmision: datos.FechaEmision
        },

        venta: {
          IdVenta: datos.IdVenta,
          FechaVenta: datos.FechaVenta,
          MetodoPago: datos.MetodoPago,
          CanalVenta: datos.CanalVenta,
          Total: datos.Total
        },

        productos: productosResultado.recordset
      });

    } catch (error) {
      console.error('Error al consultar el comprobante:', error);

      return res.status(500).json({
        mensaje: 'No se pudo consultar el detalle del comprobante.'
      });
    }
  }
);

module.exports = router;
